import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  createAgentPayApp,
  createAgentPayProvider,
  validateProviderOptions,
} from "../server/provider.js";
import {
  createMemoryIntentStorage,
  createIntentStore,
} from "../server/intents.js";
import { createMemoryUsageStorage, createUsageStore } from "../server/logger.js";

const config = {
  port: 3000,
  gatewayUrl: "http://localhost:3000",
  rustServiceUrl: "",
  facilitatorUrl: "https://facilitator.stellar-x402.org",
  network: "stellar-testnet",
  walletAddress: "GD3PXXADIXMWGINT2LK3Q45SLI3HRCRA2I7NDOTXXTGNXO7GDYKI4SK7",
  asset: {
    address: "native",
    symbol: "XLM",
    decimals: 7,
    displayName: "Stellar Lumens",
  },
};

function getRoutePaths(app) {
  return app.router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
}

function findRouteLayer(app, path, method) {
  return app.router.stack.find(
    (layer) => layer.route
      && (
        layer.route.path === path
        || new RegExp(`^${String(layer.route.path).replace(/:[^/]+/g, "[^/]+")}$`).test(path)
      )
      && layer.route.methods?.[String(method).toLowerCase()],
  );
}

async function invokeRoute(app, path, method, reqOverrides = {}) {
  const layer = findRouteLayer(app, path, method);

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  const routePath = String(layer.route.path);
  const routeSegments = routePath.split("/");
  const pathSegments = path.split("/");
  const params = {};

  routeSegments.forEach((segment, index) => {
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = pathSegments[index];
    }
  });

  const req = {
    method: method.toUpperCase(),
    protocol: "http",
    originalUrl: path,
    path,
    params,
    query: {},
    body: {},
    headers: {},
    get(name) {
      return name.toLowerCase() === "host" ? "localhost:3000" : "";
    },
    ...reqOverrides,
  };

  let statusCode = 200;
  let jsonBody;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      jsonBody = value;
      return this;
    },
  };

  const stack = layer.route.stack.map((entry) => entry.handle);
  let index = 0;

  async function next(error) {
    if (error) {
      throw error;
    }

    const handler = stack[index];
    index += 1;

    if (!handler) {
      return;
    }

    await handler(req, res, next);
  }

  await next();

  return {
    statusCode,
    body: jsonBody,
    req,
  };
}

test("supports custom endpoint catalogs for implementers", () => {
  const app = createAgentPayApp({
    config,
    endpoints: {
      summarize: {
        id: "summarize",
        path: "/summarize",
        description: "Summarize content",
        basePriceUsd: "0.05",
      },
    },
    handlers: {
      summarize: async () => ({ ok: true }),
    },
  });

  const routePaths = getRoutePaths(app);

  assert.equal(routePaths.includes("/summarize"), true);
  assert.equal(routePaths.includes("/ai"), false);
});

test("supports declarative protected route definitions", () => {
  const app = createAgentPayApp({
    config,
    routes: [
      {
        method: "POST",
        path: "/summarize",
        description: "Summarize content",
        priceUsd: "0.05",
        handler: async () => ({ ok: true, source: "route-definition" }),
      },
    ],
  });

  const routePaths = getRoutePaths(app);

  assert.equal(routePaths.includes("/summarize"), true);
  assert.equal(routePaths.includes("/ai"), false);
});

test("supports declarative upstream proxy routes for implementers", async () => {
  const calls = [];
  const provider = createAgentPayProvider({
    config,
    routes: [
      {
        method: "POST",
        path: "/summarize",
        description: "Proxy summarize content",
        priceUsd: "0.05",
        upstream: {
          url: "https://api.example.com/summarize",
          headers: {
            Authorization: "Bearer test-token",
          },
          fetch: async (url, init) => {
            calls.push({
              url: String(url),
              method: init.method,
              headers: init.headers,
              body: JSON.parse(init.body),
            });

            return {
              ok: true,
              headers: {
                get(name) {
                  return name.toLowerCase() === "content-type" ? "application/json" : null;
                },
              },
              async json() {
                return {
                  ok: true,
                  source: "upstream-proxy",
                };
              },
            };
          },
        },
      },
    ],
  });

  const result = await provider.handlers.summarize(config, "hello proxy", {
    req: {
      body: {
        audience: "agents",
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    source: "upstream-proxy",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/summarize");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");
  assert.equal(calls[0].body.query, "hello proxy");
  assert.equal(calls[0].body.audience, "agents");
});

test("supports policy-based pricing, metadata, and conditional paywall bypass", async () => {
  const app = createAgentPayApp({
    config,
    routes: [
      {
        method: "POST",
        path: "/free-summarize",
        description: "Free for pro users",
        priceUsd: "0.05",
        shouldRequirePayment: ({ req }) => req.headers["x-plan"] !== "pro",
        paymentMetadata: ({ req }) => ({
          tenantId: req.headers["x-tenant-id"],
          plan: req.headers["x-plan"],
        }),
        handler: async () => ({ ok: true, source: "free-tier" }),
      },
      {
        method: "POST",
        path: "/dynamic-summarize",
        description: "Dynamically priced summarize route",
        priceUsd: "0.05",
        pricing: ({ query }) => (query.length > 10 ? "0.07" : "0.03"),
        paymentMetadata: ({ req }) => ({
          tenantId: req.headers["x-tenant-id"],
        }),
        handler: async () => ({ ok: true, source: "paid-tier" }),
      },
    ],
  });

  const freeResponse = await invokeRoute(app, "/free-summarize", "post", {
    headers: {
      "x-plan": "pro",
      "x-tenant-id": "tenant_123",
    },
    body: {
      query: "hello policy",
    },
  });
  const paidChallenge = await invokeRoute(app, "/dynamic-summarize", "post", {
    headers: {
      "x-tenant-id": "tenant_456",
    },
    body: {
      query: "this query is definitely longer than ten",
    },
  });

  assert.equal(freeResponse.statusCode, 200);
  assert.equal(freeResponse.body.payment.status, "not_required");
  assert.equal(freeResponse.body.payment.amount, "0.00");
  assert.equal(freeResponse.body.payment.metadata.tenantId, "tenant_123");
  assert.equal(freeResponse.body.payment.metadata.plan, "pro");

  assert.equal(paidChallenge.statusCode, 402);
  assert.equal(paidChallenge.body.accepts[0].extra.priceUsd, "0.07");
  assert.equal(paidChallenge.body.accepts[0].extra.tenantId, "tenant_456");
});

test("applies policy hooks to intent creation and execution", async () => {
  const app = createAgentPayApp({
    config,
    routes: [
      {
        method: "POST",
        path: "/intent-free",
        description: "Intent route with bypass",
        priceUsd: "0.05",
        shouldRequirePayment: ({ req }) => req.headers["x-plan"] !== "pro",
        paymentMetadata: ({ req }) => ({
          tenantId: req.headers["x-tenant-id"],
          plan: req.headers["x-plan"],
        }),
        handler: async () => ({ ok: true, source: "intent-free" }),
      },
      {
        method: "POST",
        path: "/intent-paid",
        description: "Intent route with dynamic pricing",
        priceUsd: "0.05",
        pricing: ({ query }) => (query.length > 10 ? "0.09" : "0.04"),
        paymentMetadata: ({ req }) => ({
          tenantId: req.headers["x-tenant-id"],
        }),
        handler: async () => ({ ok: true, source: "intent-paid" }),
      },
    ],
  });

  const freeIntent = await invokeRoute(app, "/intents", "post", {
    headers: {
      "x-plan": "pro",
      "x-tenant-id": "tenant_free",
    },
    body: {
      endpoint: "intent_free",
      query: "hello free intent",
    },
  });
  const paidIntent = await invokeRoute(app, "/intents", "post", {
    headers: {
      "x-tenant-id": "tenant_paid",
    },
    body: {
      endpoint: "intent_paid",
      query: "this query should trigger a higher intent price",
    },
  });
  const freeExecution = await invokeRoute(
    app,
    `/intents/${freeIntent.body.intent.id}/execute`,
    "post",
    {},
  );

  assert.equal(freeIntent.statusCode, 201);
  assert.equal(freeIntent.body.payment.status, "not_required");
  assert.equal(freeIntent.body.paymentRequest, null);
  assert.equal(freeIntent.body.accepts.length, 0);
  assert.equal(freeIntent.body.intent.paymentRequired, false);
  assert.equal(freeIntent.body.intent.paymentMetadata.tenantId, "tenant_free");

  assert.equal(paidIntent.statusCode, 201);
  assert.equal(paidIntent.body.payment.status, "required");
  assert.equal(paidIntent.body.intent.paymentRequired, true);
  assert.equal(paidIntent.body.intent.amount, "0.09");
  assert.equal(paidIntent.body.accepts[0].extra.priceUsd, "0.09");
  assert.equal(paidIntent.body.accepts[0].extra.tenantId, "tenant_paid");

  assert.equal(freeExecution.statusCode, 200);
  assert.equal(freeExecution.body.payment.status, "not_required");
  assert.equal(freeExecution.body.payment.metadata.plan, "pro");
  assert.equal(freeExecution.body.intent.payment.status, "not_required");
});

test("supports intent creation for built-in GET endpoints", async () => {
  const app = createAgentPayApp({ config });

  const intentResponse = await invokeRoute(app, "/intents", "post", {
    body: {
      endpoint: "ai",
      query: "hello built-in intent",
    },
  });

  assert.equal(intentResponse.statusCode, 201);
  assert.equal(intentResponse.body.intent.endpoint, "ai");
  assert.equal(intentResponse.body.intent.query, "hello built-in intent");
  assert.equal(intentResponse.body.payment.status, "required");
  assert.equal(intentResponse.body.accepts[0].extra.queryLength, "hello built-in intent".length);
});

test("supports injected intent storage for implementers", () => {
  const intentStore = createIntentStore(createMemoryIntentStorage());
  const app = createAgentPayApp({
    config,
    intentStore,
  });

  const created = intentStore.createIntent({
    endpoint: "ai",
    query: "hello",
    amount: "0.02",
    asset: "USDC",
  });

  const fetched = intentStore.getIntentById(created.id);
  const routePaths = getRoutePaths(app);

  assert.equal(fetched?.id, created.id);
  assert.equal(routePaths.includes("/intents"), true);
  assert.equal(intentStore.listIntents().length, 1);
});

test("supports sqlite intent storage for durable provider state", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "agentpay-sqlite-"));
  const sqliteFile = join(tempRoot, "intents.db");

  try {
    const provider = createAgentPayProvider({
      config,
      storage: {
        intents: {
          type: "sqlite",
          filename: sqliteFile,
        },
      },
    });
    const app = createAgentPayApp({
      config,
      storage: {
        intents: {
          type: "sqlite",
          filename: sqliteFile,
        },
      },
    });
    const { intentStore } = provider;

    const created = intentStore.createIntent({
      endpoint: "ai",
      query: "durable",
      amount: "0.02",
      asset: "USDC",
    });

    const updated = intentStore.updateIntent(created.id, {
      status: "executed",
      result: { ok: true },
    });

    assert.equal(getRoutePaths(app).includes("/intents/:intentId/execute"), true);
    assert.equal(intentStore.storage.kind, "sqlite");
    assert.equal(intentStore.getIntentById(created.id)?.id, created.id);
    assert.equal(updated?.status, "executed");
    assert.deepEqual(intentStore.listIntents()[0]?.result, { ok: true });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("supports injected usage storage for implementers", async () => {
  const usageStore = createUsageStore(createMemoryUsageStorage());
  const app = createAgentPayApp({
    config,
    usageStore,
  });

  await usageStore.logRequest({
    endpoint: "ai",
    query: "usage",
    timestamp: new Date().toISOString(),
    payment: {
      status: "verified",
      network: "stellar-testnet",
      asset: "USDC",
      amount: "0.02",
    },
  });

  assert.equal(getRoutePaths(app).includes("/stats"), true);
  assert.equal((await usageStore.readStats()).total_revenue, "0.02 USDC");
});

test("fails fast on invalid provider route and storage config", () => {
  assert.throws(
    () => validateProviderOptions({
      config: {
        ...config,
        network: undefined,
      },
    }),
    /Missing required network/,
  );

  assert.throws(
    () => validateProviderOptions({
      config,
      routes: [
        {
          method: "TRACE",
          path: "/summarize",
          priceUsd: "0.05",
          handler: async () => ({ ok: true }),
        },
      ],
    }),
    /Unsupported protected route method/,
  );

  assert.throws(
    () => validateProviderOptions({
      config,
      storage: {
        intents: {
          type: "sqlite",
        },
      },
    }),
    /filename is required/,
  );

  assert.throws(
    () => validateProviderOptions({
      config,
      storage: {
        usage: {
          type: "postgres",
        },
      },
    }),
    /connectionString or client is required/,
  );

  assert.throws(
    () => validateProviderOptions({
      config,
      routes: [
        {
          method: "POST",
          path: "/summarize",
          priceUsd: "0.05",
          upstream: {
            url: "/relative",
          },
        },
      ],
    }),
    /Invalid upstream.url/,
  );

  assert.throws(
    () => validateProviderOptions({
      config,
      routes: [
        {
          method: "POST",
          path: "/priced",
          priceUsd: "0.05",
          pricing: "0.07",
          handler: async () => ({ ok: true }),
        },
      ],
    }),
    /Invalid pricing policy/,
  );
});

test("exposes readiness and shutdown hooks for provider storage backends", async () => {
  let intentClosed = false;
  let usageClosed = false;

  const intentStore = createIntentStore({
    kind: "custom-intent",
    create(input) {
      return {
        id: "intent_test",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      };
    },
    getById() {
      return null;
    },
    list() {
      return [];
    },
    update() {
      return null;
    },
    async healthCheck() {
      return {
        ok: true,
        status: "ready",
        kind: "custom-intent",
      };
    },
    async close() {
      intentClosed = true;
    },
  });
  const usageStore = createUsageStore({
    kind: "custom-usage",
    append() {},
    list() {
      return [];
    },
    async healthCheck() {
      return {
        ok: true,
        status: "ready",
        kind: "custom-usage",
      };
    },
    async close() {
      usageClosed = true;
    },
  });
  const provider = createAgentPayProvider({
    config,
    intentStore,
    usageStore,
    paymentContext: {
      async checkPayeeAssetReadiness() {
        return {
          ok: true,
          status: "ready",
          kind: "payment",
        };
      },
    },
  });

  const readiness = await provider.getReadinessReport();

  assert.equal(readiness.ok, true);
  assert.equal(readiness.checks.intents.kind, "custom-intent");
  assert.equal(readiness.checks.usage.kind, "custom-usage");

  await provider.close();

  assert.equal(intentClosed, true);
  assert.equal(usageClosed, true);
});
