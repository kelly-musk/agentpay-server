import "dotenv/config";
import express from "express";
import { handleAi } from "./handlers/ai.js";
import { handleCompute } from "./handlers/compute.js";
import { handleData } from "./handlers/data.js";
import { createUpstreamHandler, validateUpstreamRouteConfig } from "./handlers/shared.js";
import {
  createFileIntentStorage,
  createMemoryIntentStorage,
  createIntentStore,
  createPostgresIntentStorage,
  createSqliteIntentStorage,
} from "./intents.js";
import {
  createFileUsageStorage,
  createMemoryUsageStorage,
  createPostgresUsageStorage,
  createSqliteUsageStorage,
  createUsageStore,
} from "./logger.js";
import { assertValidPostgresIdentifier } from "./postgres.js";
import {
  createPaymentContext,
  loadGatewayConfig,
  requirePaymentWith,
  validateGatewayConfig,
} from "./payments.js";
import {
  createEndpointCatalog,
  getEndpointConfigFromCatalog,
  getPriceUsdFromCatalog,
} from "./pricing.js";

export function createDefaultHandlers() {
  return {
    ai: handleAi,
    data: handleData,
    compute: handleCompute,
  };
}

const SUPPORTED_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function assertValidRoutePath(path) {
  if (!path || typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("Invalid protected route path: expected a path starting with '/'");
  }
}

function assertValidPrice(value) {
  const parsed = Number.parseFloat(String(value));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid protected route price: expected a positive numeric value");
  }

  return parsed.toFixed(2);
}

function assertValidPaymentMetadata(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid payment metadata: expected an object");
  }

  return value;
}

function validateEndpointPolicy(endpoint) {
  if (endpoint.pricing !== undefined && typeof endpoint.pricing !== "function") {
    throw new Error(`Invalid pricing policy for endpoint ${endpoint.id}: expected a function`);
  }

  if (
    endpoint.shouldRequirePayment !== undefined
    && typeof endpoint.shouldRequirePayment !== "function"
    && typeof endpoint.shouldRequirePayment !== "boolean"
  ) {
    throw new Error(
      `Invalid shouldRequirePayment policy for endpoint ${endpoint.id}: expected a function or boolean`,
    );
  }

  if (
    endpoint.paymentMetadata !== undefined
    && typeof endpoint.paymentMetadata !== "function"
    && (typeof endpoint.paymentMetadata !== "object" || Array.isArray(endpoint.paymentMetadata))
  ) {
    throw new Error(
      `Invalid paymentMetadata policy for endpoint ${endpoint.id}: expected a function or object`,
    );
  }
}

async function evaluateEndpointPolicy(endpoint, req, config) {
  const rawQuery =
    String(endpoint.method || "GET").toUpperCase() === "GET"
      ? req.query.q
      : (req.body?.query ?? req.query.q);
  const query = String(rawQuery || "default query");
  const context = {
    req,
    query,
    config,
    endpoint,
  };

  const shouldRequirePayment = typeof endpoint.shouldRequirePayment === "function"
    ? await endpoint.shouldRequirePayment(context)
    : endpoint.shouldRequirePayment ?? true;
  const priceUsd = endpoint.pricing
    ? assertValidPrice(await endpoint.pricing(context))
    : getPriceUsdFromCatalog(config.endpointCatalog, endpoint.id, query);
  const paymentMetadata = typeof endpoint.paymentMetadata === "function"
    ? assertValidPaymentMetadata(await endpoint.paymentMetadata(context))
    : assertValidPaymentMetadata(endpoint.paymentMetadata);

  return {
    query,
    shouldRequirePayment: Boolean(shouldRequirePayment),
    priceUsd,
    paymentMetadata,
  };
}

async function evaluateIntentPolicy(endpoint, req, config, queryOverride) {
  const normalizedQuery = queryOverride
    ?? req.body?.query
    ?? req.query?.q;

  return evaluateEndpointPolicy(
    endpoint,
    {
      ...req,
      query: {
        ...(req.query || {}),
        q: normalizedQuery,
      },
      body: {
        ...(req.body || {}),
        query: normalizedQuery,
      },
    },
    config,
  );
}

function deriveRouteId(route) {
  if (route.id) {
    return route.id;
  }

  return (
    String(route.path || "")
      .replace(/^\//, "")
      .replace(/[^\w]+/g, "_")
      .replace(/^_+|_+$/g, "") || "route"
  );
}

function isDependencyStorageError(error) {
  const message = String(error?.message || error || "");

  return /ECONNREFUSED|ENOTFOUND|connect|timeout|authentication failed|password authentication failed/i
    .test(message);
}

function getStorageFailureStatus(error, fallbackStatus = 500) {
  return isDependencyStorageError(error) ? 503 : fallbackStatus;
}

function normalizeProtectedRoutes(routes = []) {
  return routes.map((route) => {
    const id = deriveRouteId(route);

    const method = (route.method || "GET").toUpperCase();

    if (!SUPPORTED_HTTP_METHODS.has(method)) {
      throw new Error(`Unsupported protected route method: ${method}`);
    }

    const path = route.path || `/${id}`;
    assertValidRoutePath(path);

    const hasHandler = typeof route.handler === "function";
    const hasUpstream = Boolean(route.upstream);

    if (!hasHandler && !hasUpstream) {
      throw new Error(`Missing handler or upstream config for protected route ${path}`);
    }

    if (hasUpstream) {
      validateUpstreamRouteConfig({ ...route, id, path, method });
    }

    const normalizedRoute = {
      id,
      path,
      method,
      description: route.description || `Protected route ${id}`,
      basePriceUsd: assertValidPrice(route.basePriceUsd || route.priceUsd || "0.01"),
      handler: hasHandler ? route.handler : createUpstreamHandler({ ...route, id, path, method }),
      upstream: route.upstream,
      pricing: route.pricing,
      shouldRequirePayment: route.shouldRequirePayment,
      paymentMetadata: route.paymentMetadata,
    };

    validateEndpointPolicy(normalizedRoute);

    return normalizedRoute;
  });
}

function validateStorageConfig(name, storageConfig) {
  if (!storageConfig || typeof storageConfig !== "object") {
    throw new Error(`Invalid ${name} storage config: expected an object`);
  }

  if (!storageConfig.type) {
    throw new Error(`Invalid ${name} storage config: missing type`);
  }

  if (!["memory", "file", "sqlite", "postgres"].includes(storageConfig.type)) {
    throw new Error(`Unsupported ${name} storage type: ${storageConfig.type}`);
  }

  if ((storageConfig.type === "file" || storageConfig.type === "sqlite") && !storageConfig.filename) {
    throw new Error(`Invalid ${name} storage config: filename is required for ${storageConfig.type}`);
  }

  if (
    storageConfig.type === "postgres" &&
    !storageConfig.connectionString &&
    !storageConfig.client
  ) {
    throw new Error(
      `Invalid ${name} storage config: connectionString or client is required for postgres`,
    );
  }

  if (storageConfig.schemaName) {
    assertValidPostgresIdentifier(`${name} storage schemaName`, storageConfig.schemaName);
  }

  if (storageConfig.tableName) {
    assertValidPostgresIdentifier(`${name} storage tableName`, storageConfig.tableName);
  }
}

export function validateProviderOptions(options = {}) {
  const config = validateGatewayConfig(options.config || loadGatewayConfig());
  const protectedRoutes = normalizeProtectedRoutes(
    options.protectedRoutes || options.routes || [],
  );

  if (options.storage?.intents) {
    validateStorageConfig("intent", options.storage.intents);
  }

  if (options.storage?.usage) {
    validateStorageConfig("usage", options.storage.usage);
  }

  return {
    config,
    protectedRoutes,
    hasIntentStore: Boolean(options.intentStore || options.intentStorage || options.storage?.intents),
    hasUsageStore: Boolean(options.usageStore || options.usageStorage || options.storage?.usage),
  };
}

function normalizeProviderOptions(options = {}) {
  const validation = validateProviderOptions(options);
  const config = validation.config;
  const protectedRoutes = normalizeProtectedRoutes(
    options.protectedRoutes || options.routes || [],
  );
  const routeEndpoints = Object.fromEntries(
    protectedRoutes.map((route) => [route.id, route]),
  );
  const endpointCatalog = createEndpointCatalog(
    Object.keys(routeEndpoints).length > 0
      ? routeEndpoints
      : (options.endpoints || config.endpoints),
  );
  const intentStore = resolveIntentStore(options);
  const usageStore = resolveUsageStore(options);
  const handlers = {
    ...createDefaultHandlers(),
    ...Object.fromEntries(protectedRoutes.map((route) => [route.id, route.handler])),
    ...(options.handlers || {}),
  };

  for (const endpointId of Object.keys(endpointCatalog)) {
    validateEndpointPolicy(endpointCatalog[endpointId]);

    if (typeof handlers[endpointId] !== "function") {
      throw new Error(`Missing handler for endpoint: ${endpointId}`);
    }
  }

  return {
    config: {
      ...config,
      endpointCatalog,
    },
    handlers,
    intentStore,
    usageStore,
    protectedRoutes,
  };
}

function resolveIntentStore(options) {
  if (options.intentStore) {
    return options.intentStore;
  }

  if (options.intentStorage) {
    return createIntentStore(options.intentStorage);
  }

  const storageConfig = options.storage?.intents;

  if (!storageConfig) {
    return createIntentStore();
  }

  if (storageConfig.type === "memory") {
    return createIntentStore(createMemoryIntentStorage(storageConfig.initialIntents));
  }

  if (storageConfig.type === "sqlite") {
    return createIntentStore(createSqliteIntentStorage(storageConfig.filename));
  }

  if (storageConfig.type === "postgres") {
    return createIntentStore(createPostgresIntentStorage(storageConfig));
  }

  if (storageConfig.type === "file") {
    return createIntentStore(createFileIntentStorage(storageConfig.filename));
  }

  validateStorageConfig("intent", storageConfig);
  throw new Error(`Unsupported intent storage type: ${storageConfig.type}`);
}

function resolveUsageStore(options) {
  if (options.usageStore) {
    return options.usageStore;
  }

  if (options.usageStorage) {
    return createUsageStore(options.usageStorage);
  }

  const storageConfig = options.storage?.usage;

  if (!storageConfig) {
    return createUsageStore();
  }

  if (storageConfig.type === "memory") {
    return createUsageStore(createMemoryUsageStorage(storageConfig.initialEntries));
  }

  if (storageConfig.type === "sqlite") {
    return createUsageStore(createSqliteUsageStorage(storageConfig.filename));
  }

  if (storageConfig.type === "postgres") {
    return createUsageStore(createPostgresUsageStorage(storageConfig));
  }

  if (storageConfig.type === "file") {
    return createUsageStore(createFileUsageStorage(storageConfig.filename));
  }

  validateStorageConfig("usage", storageConfig);
  throw new Error(`Unsupported usage storage type: ${storageConfig.type}`);
}

function registerPublicRoutes(app, provider) {
  const { config, paymentContext, endpointCatalog, intentStore, usageStore } = provider;
  const endpointValues = Object.values(endpointCatalog);

  app.get("/", (req, res) => {
    res.json({
      service: "agentpay-gateway",
      protocol: "x402-stellar",
      network: config.network,
      asset: paymentContext.getCapabilities().asset.symbol,
      routes: paymentContext.getCapabilities().endpoints,
    });
  });

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "agentpay-gateway",
      network: config.network,
      asset: config.asset.symbol,
    });
  });

  app.get("/ready", async (req, res) => {
    const readiness = await provider.getReadinessReport();
    res.status(readiness.ok ? 200 : 503).json(readiness);
  });

  app.get("/capabilities", (req, res) => {
    res.json(paymentContext.getCapabilities());
  });

  app.get("/discovery/resources", (req, res) => {
    const type = req.query.type ? String(req.query.type) : undefined;
    const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
    const offset = req.query.offset ? Number.parseInt(String(req.query.offset), 10) : 0;

    let items = paymentContext.getDiscoveryResources();

    if (type) {
      items = items.filter((item) => item.type === type);
    }

    const start = Number.isNaN(offset) ? 0 : offset;
    const end = limit && !Number.isNaN(limit) ? start + limit : undefined;
    const pagedItems = items.slice(start, end);

    res.json({
      x402Version: 1,
      items: pagedItems,
      pagination: {
        limit: limit && !Number.isNaN(limit) ? limit : items.length,
        offset: start,
        total: items.length,
      },
    });
  });

  app.get("/stats", async (req, res) => {
    try {
      res.json(await usageStore.readStats());
    } catch (error) {
      res.status(getStorageFailureStatus(error)).json({
        error: String(error.message || error),
      });
    }
  });

  app.get("/intents", async (req, res) => {
    try {
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 50;
      res.json({
        items: await intentStore.listIntents(Number.isNaN(limit) ? 50 : limit),
      });
    } catch (error) {
      res.status(getStorageFailureStatus(error)).json({
        error: String(error.message || error),
      });
    }
  });

  app.post("/intents", async (req, res) => {
    try {
      const endpoint = String(req.body.endpoint || "").trim();
      const query = String(req.body.query || "").trim();

      if (!endpoint) {
        return res.status(400).json({ error: "Missing required field: endpoint" });
      }

      const endpointConfig = getEndpointConfigFromCatalog(endpointCatalog, endpoint);
      const policy = await evaluateIntentPolicy(endpointConfig, req, config, query);
      const amount = policy.shouldRequirePayment ? policy.priceUsd : "0.00";
      const intent = await intentStore.createIntent({
        endpoint,
        query: policy.query,
        amount,
        asset: config.asset.symbol,
        paymentRequired: policy.shouldRequirePayment,
        paymentMetadata: policy.paymentMetadata,
      });
      const resourceUrl = `${config.gatewayUrl}/intents/${intent.id}/execute`;
      const accepts = policy.shouldRequirePayment
        ? [
          paymentContext.buildRequirementsForResource(resourceUrl, endpoint, policy.query, {
            priceUsd: amount,
            description: `Execute AgentPay ${endpoint} intent`,
            extra: {
              intentId: intent.id,
              flow: "intent-execution",
              ...policy.paymentMetadata,
            },
          }),
        ]
        : [];

      return res.status(201).json({
        intent,
        paymentRequest: policy.shouldRequirePayment
          ? {
            resource: resourceUrl,
            amount,
            asset: config.asset.symbol,
          }
          : null,
        accepts,
        payment: {
          status: policy.shouldRequirePayment ? "required" : "not_required",
          network: config.network,
          asset: config.asset.symbol,
          amount,
          metadata: policy.paymentMetadata,
        },
      });
    } catch (error) {
      return res.status(getStorageFailureStatus(error, 400)).json({
        error: error.message,
      });
    }
  });

  app.get("/intents/:intentId", async (req, res) => {
    try {
      const intent = await intentStore.getIntentById(req.params.intentId);

      if (!intent) {
        return res.status(404).json({ error: "Intent not found" });
      }

      return res.json({ intent });
    } catch (error) {
      return res.status(getStorageFailureStatus(error)).json({
        error: String(error.message || error),
      });
    }
  });

  return endpointValues;
}

function registerIntentExecutionRoutes(app, provider) {
  const {
    config,
    paymentContext,
    handlers,
    executingIntents,
    intentStore,
    usageStore,
  } = provider;

  app.post(
    "/intents/:intentId/execute",
    async (req, res, next) => {
      const intent = await intentStore.getIntentById(req.params.intentId);

      if (!intent) {
        return res.status(404).json({ error: "Intent not found" });
      }

      req.intent = intent;

      if (!intent.paymentRequired) {
        req.pricing = {
          amount: "0.00",
          asset: config.asset.symbol,
          metadata: intent.paymentMetadata || {},
        };
        req.paymentState = {
          status: "not_required",
          network: config.network,
          asset: config.asset.symbol,
          amount: "0.00",
          metadata: intent.paymentMetadata || {},
        };
        return next();
      }

      return requirePaymentWith(async (paymentReq) => paymentContext.buildRequirementsForResource(
        `${paymentReq.protocol}://${paymentReq.get("host")}${paymentReq.originalUrl}`,
        intent.endpoint,
        intent.query,
        {
          priceUsd: intent.amount,
          description: `Execute AgentPay ${intent.endpoint} intent`,
          extra: {
            intentId: intent.id,
            flow: "intent-execution",
            ...(intent.paymentMetadata || {}),
          },
        },
      ), paymentContext)(req, res, next);
    },
    async (req, res) => {
      const intent = req.intent || await intentStore.getIntentById(req.params.intentId);

      if (!intent) {
        return res.status(404).json({ error: "Intent not found" });
      }

      if (intent.status === "executed") {
        return res.status(409).json({ error: "Intent already executed" });
      }

      if (executingIntents.has(intent.id)) {
        return res.status(409).json({ error: "Intent is already executing" });
      }

      executingIntents.add(intent.id);

      try {
        if (intent.paymentRequired) {
          await intentStore.updateIntent(intent.id, {
            status: "paid",
            payment: {
              network: config.network,
              asset: config.asset.symbol,
              amount: intent.amount,
              metadata: intent.paymentMetadata || {},
            },
          });
        }

        const result = await handlers[intent.endpoint](config, intent.query, {
          intent,
          req,
        });
        let settlement = null;
        let payment = req.paymentState;

        if (intent.paymentRequired) {
          try {
            settlement = await paymentContext.settle(
              req.paymentPayload,
              req.paymentRequirements,
            );
          } catch (error) {
            settlement = {
              success: false,
              network: config.network,
              error: error.message,
            };
            console.error("Settlement failed:", error.message);
          }

          payment = {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
            metadata: intent.paymentMetadata || {},
            receipt: settlement?.receipt || null,
            settlement,
          };
        } else if (!payment) {
          payment = {
            status: "not_required",
            network: config.network,
            asset: config.asset.symbol,
            amount: "0.00",
            metadata: intent.paymentMetadata || {},
          };
        }

        const finalizedIntent = await intentStore.updateIntent(intent.id, {
          status: "executed",
          payment,
          settlement,
          result,
          executedAt: new Date().toISOString(),
        });

        await usageStore.logRequest({
          endpoint: intent.endpoint,
          query: intent.query,
          timestamp: new Date().toISOString(),
          payment,
          intentId: intent.id,
          flow: "intent-execution",
        });

        return res.json({
          success: true,
          intent: finalizedIntent,
          payment,
          result,
        });
      } catch (error) {
        await intentStore.updateIntent(intent.id, {
          status: "failed",
          error: error.message,
        });

        return res.status(502).json({
          success: false,
          intentId: intent.id,
          error: error.message,
        });
      } finally {
        executingIntents.delete(intent.id);
      }
    },
  );
}

function registerDirectEndpointRoutes(app, provider) {
  const { config, paymentContext, handlers, endpointCatalog, usageStore } = provider;

  for (const endpoint of Object.values(endpointCatalog)) {
    const method = String(endpoint.method || "GET").toLowerCase();
    app[method](endpoint.path, async (req, res, next) => {
      try {
        const policy = await evaluateEndpointPolicy(endpoint, req, config);
        req.agentpayPolicy = policy;

        if (!policy.shouldRequirePayment) {
          req.pricing = {
            amount: "0.00",
            asset: config.asset.symbol,
            metadata: policy.paymentMetadata,
          };
          req.paymentState = {
            status: "not_required",
            network: config.network,
            asset: config.asset.symbol,
            amount: "0.00",
            metadata: policy.paymentMetadata,
          };
          return next();
        }

        return requirePaymentWith(
          (paymentReq) => paymentContext.buildRequirementsForResource(
            `${paymentReq.protocol}://${paymentReq.get("host")}${paymentReq.originalUrl}`,
            endpoint.id,
            policy.query,
            {
              priceUsd: policy.priceUsd,
              extra: {
                ...policy.paymentMetadata,
              },
            },
          ),
          paymentContext,
        )(req, res, next);
      } catch (error) {
        return res.status(400).json({
          error: String(error.message || error),
        });
      }
    }, async (req, res) => {
      try {
        const query = req.agentpayPolicy?.query
          || String((method === "get" ? req.query.q : (req.body?.query ?? req.query.q)) || "default query");
        const result = await handlers[endpoint.id](config, query, { req });
        let settlement = null;
        let payment = req.paymentState;

        if (req.paymentPayload && req.paymentRequirements) {
          try {
            settlement = await paymentContext.settle(
              req.paymentPayload,
              req.paymentRequirements,
            );
          } catch (error) {
            settlement = {
              success: false,
              network: config.network,
              error: error.message,
            };
            console.error("Settlement failed:", error.message);
          }

          payment = {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: req.pricing.amount,
            metadata: req.agentpayPolicy?.paymentMetadata || {},
            receipt: settlement?.receipt || null,
            settlement,
          };
        } else if (!payment) {
          payment = {
            status: "not_required",
            network: config.network,
            asset: config.asset.symbol,
            amount: "0.00",
            metadata: req.agentpayPolicy?.paymentMetadata || {},
          };
        }

        await usageStore.logRequest({
          endpoint: endpoint.id,
          query,
          timestamp: new Date().toISOString(),
          payment,
        });

        res.json({
          success: true,
          endpoint: endpoint.id,
          payment,
          result,
        });
      } catch (error) {
        res.status(502).json({
          success: false,
          endpoint: endpoint.id,
          error: error.message,
        });
      }
    });
  }
}

export function createAgentPayProvider(options = {}) {
  const {
    config,
    handlers,
    intentStore,
    usageStore,
    protectedRoutes,
  } = normalizeProviderOptions(options);
  const paymentContext = options.paymentContext || createPaymentContext(config);
  const provider = {
    config,
    endpointCatalog: config.endpointCatalog,
    handlers,
    intentStore,
    usageStore,
    paymentContext,
    executingIntents: new Set(),
    protectedRoutes,
    async getReadinessReport() {
      const checks = {};

      async function runCheck(name, fn) {
        try {
          checks[name] = await fn();
        } catch (error) {
          checks[name] = {
            ok: false,
            status: "error",
            error: String(error.message || error),
          };
        }
      }

      await runCheck("payment", async () => ({
        ...(await paymentContext.checkPayeeAssetReadiness()),
        network: config.network,
        asset: config.asset.symbol,
      }));
      await runCheck("intents", () => intentStore.healthCheck());
      await runCheck("usage", () => usageStore.healthCheck());

      const ok = Object.values(checks).every((check) => check?.ok !== false);

      return {
        ok,
        service: "agentpay-gateway",
        network: config.network,
        asset: config.asset.symbol,
        checks,
      };
    },
    async close() {
      const results = await Promise.allSettled([
        intentStore.close?.(),
        usageStore.close?.(),
      ]);

      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length > 0) {
        throw new Error(
          `Provider shutdown failed: ${rejected
            .map((result) => result.reason?.message || String(result.reason))
            .join("; ")}`,
        );
      }
    },
  };

  return {
    ...provider,
    register(app) {
      registerPublicRoutes(app, provider);
      registerIntentExecutionRoutes(app, provider);
      registerDirectEndpointRoutes(app, provider);
      return app;
    },
  };
}

export function registerAgentPayRoutes(app, options = {}) {
  const provider = createAgentPayProvider(options);
  provider.register(app);
  return provider;
}

export function createAgentPayApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.set("trust proxy", true);
  const provider = registerAgentPayRoutes(app, options);
  app.locals.agentpayProvider = provider;
  return app;
}

export {
  createFileIntentStorage,
  createMemoryIntentStorage,
  createIntentStore,
  createPostgresIntentStorage,
  createSqliteIntentStorage,
} from "./intents.js";
export {
  createFileUsageStorage,
  createMemoryUsageStorage,
  createPostgresUsageStorage,
  createSqliteUsageStorage,
  createUsageStore,
} from "./logger.js";
