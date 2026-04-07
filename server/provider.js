import "dotenv/config";
import express from "express";
import { handleAi } from "./handlers/ai.js";
import { handleCompute } from "./handlers/compute.js";
import { handleData } from "./handlers/data.js";
import {
  createFileIntentStorage,
  createMemoryIntentStorage,
  createIntentStore,
  createSqliteIntentStorage,
} from "./intents.js";
import {
  createFileUsageStorage,
  createMemoryUsageStorage,
  createSqliteUsageStorage,
  createUsageStore,
} from "./logger.js";
import {
  createPaymentContext,
  loadGatewayConfig,
  requirePayment,
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

function normalizeProtectedRoutes(routes = []) {
  return routes.map((route) => {
    if (typeof route.handler !== "function") {
      throw new Error(`Missing handler for protected route ${route.path || route.id}`);
    }

    const id = deriveRouteId(route);

    const method = (route.method || "GET").toUpperCase();

    if (!SUPPORTED_HTTP_METHODS.has(method)) {
      throw new Error(`Unsupported protected route method: ${method}`);
    }

    const path = route.path || `/${id}`;
    assertValidRoutePath(path);

    return {
      id,
      path,
      method,
      description: route.description || `Protected route ${id}`,
      basePriceUsd: assertValidPrice(route.basePriceUsd || route.priceUsd || "0.01"),
      handler: route.handler,
    };
  });
}

function validateStorageConfig(name, storageConfig) {
  if (!storageConfig || typeof storageConfig !== "object") {
    throw new Error(`Invalid ${name} storage config: expected an object`);
  }

  if (!storageConfig.type) {
    throw new Error(`Invalid ${name} storage config: missing type`);
  }

  if (!["memory", "file", "sqlite"].includes(storageConfig.type)) {
    throw new Error(`Unsupported ${name} storage type: ${storageConfig.type}`);
  }

  if ((storageConfig.type === "file" || storageConfig.type === "sqlite") && !storageConfig.filename) {
    throw new Error(`Invalid ${name} storage config: filename is required for ${storageConfig.type}`);
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

  app.get("/stats", (req, res) => {
    res.json(usageStore.readStats());
  });

  app.get("/intents", (req, res) => {
    const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 50;
    res.json({
      items: intentStore.listIntents(Number.isNaN(limit) ? 50 : limit),
    });
  });

  app.post("/intents", (req, res) => {
    try {
      const endpoint = String(req.body.endpoint || "").trim();
      const query = String(req.body.query || "").trim();

      if (!endpoint) {
        return res.status(400).json({ error: "Missing required field: endpoint" });
      }

      getEndpointConfigFromCatalog(endpointCatalog, endpoint);

      const amount = getPriceUsdFromCatalog(endpointCatalog, endpoint, query);
      const intent = intentStore.createIntent({
        endpoint,
        query,
        amount,
        asset: config.asset.symbol,
      });
      const resourceUrl = `${config.gatewayUrl}/intents/${intent.id}/execute`;
      const accepts = [
        paymentContext.buildRequirementsForResource(resourceUrl, endpoint, query, {
          priceUsd: amount,
          description: `Execute AgentPay ${endpoint} intent`,
          extra: {
            intentId: intent.id,
            flow: "intent-execution",
          },
        }),
      ];

      return res.status(201).json({
        intent,
        paymentRequest: {
          resource: resourceUrl,
          amount,
          asset: config.asset.symbol,
        },
        accepts,
      });
    } catch (error) {
      return res.status(400).json({
        error: error.message,
      });
    }
  });

  app.get("/intents/:intentId", (req, res) => {
    const intent = intentStore.getIntentById(req.params.intentId);

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    return res.json({ intent });
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
    requirePaymentWith((req) => {
      const intent = intentStore.getIntentById(req.params.intentId);

      if (!intent) {
        throw new Error("Intent not found");
      }

      return paymentContext.buildRequirementsForResource(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        intent.endpoint,
        intent.query,
        {
          priceUsd: intent.amount,
          description: `Execute AgentPay ${intent.endpoint} intent`,
          extra: {
            intentId: intent.id,
            flow: "intent-execution",
          },
        },
      );
    }, paymentContext),
    async (req, res) => {
      const intent = intentStore.getIntentById(req.params.intentId);

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
        intentStore.updateIntent(intent.id, {
          status: "paid",
          payment: {
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
          },
        });

        const result = await handlers[intent.endpoint](config, intent.query, {
          intent,
          req,
        });
        let settlement = null;

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

        const finalizedIntent = intentStore.updateIntent(intent.id, {
          status: "executed",
          settlement,
          result,
          executedAt: new Date().toISOString(),
        });

        usageStore.logRequest({
          endpoint: intent.endpoint,
          query: intent.query,
          timestamp: new Date().toISOString(),
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
          },
          intentId: intent.id,
          flow: "intent-execution",
        });

        return res.json({
          success: true,
          intent: finalizedIntent,
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
            settlement,
          },
          result,
        });
      } catch (error) {
        intentStore.updateIntent(intent.id, {
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
    app[method](endpoint.path, requirePayment(endpoint.id, paymentContext), async (req, res) => {
      try {
        const rawQuery =
          method === "get"
            ? req.query.q
            : (req.body?.query ?? req.query.q);
        const query = String(rawQuery || "default query");
        const result = await handlers[endpoint.id](config, query, { req });
        let settlement = null;

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

        usageStore.logRequest({
          endpoint: endpoint.id,
          query,
          timestamp: new Date().toISOString(),
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: req.pricing.amount,
          },
        });

        res.json({
          success: true,
          endpoint: endpoint.id,
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: req.pricing.amount,
            settlement,
          },
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
  const paymentContext = createPaymentContext(config);
  const provider = {
    config,
    endpointCatalog: config.endpointCatalog,
    handlers,
    intentStore,
    usageStore,
    paymentContext,
    executingIntents: new Set(),
    protectedRoutes,
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
  registerAgentPayRoutes(app, options);
  return app;
}

export {
  createFileIntentStorage,
  createMemoryIntentStorage,
  createIntentStore,
  createSqliteIntentStorage,
} from "./intents.js";
export {
  createFileUsageStorage,
  createMemoryUsageStorage,
  createSqliteUsageStorage,
  createUsageStore,
} from "./logger.js";
