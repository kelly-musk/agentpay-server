import test from "node:test";
import assert from "node:assert/strict";
import { createAgentPayApp } from "../server/provider.js";

const BROKEN_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/agentpay_unreachable";

function createBrokenPostgresApp() {
  return createAgentPayApp({
    config: {
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
    },
    storage: {
      intents: {
        type: "postgres",
        connectionString: BROKEN_DATABASE_URL,
        schemaName: "public",
        tableName: "agentpay_intents_broken_test",
      },
      usage: {
        type: "postgres",
        connectionString: BROKEN_DATABASE_URL,
        schemaName: "public",
        tableName: "agentpay_usage_broken_test",
      },
    },
  });
}

function findRouteLayer(app, path, method) {
  return app.router.stack.find(
    (layer) => layer.route
      && layer.route.path === path
      && layer.route.methods?.[String(method).toLowerCase()],
  );
}

async function invokeRoute(app, path, method, reqOverrides = {}) {
  const layer = findRouteLayer(app, path, method);

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  const req = {
    method: method.toUpperCase(),
    protocol: "http",
    originalUrl: path,
    path,
    params: {},
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
  };
}

test("readiness reports unhealthy Postgres dependencies without crashing startup", async () => {
  const app = createBrokenPostgresApp();
  const response = await invokeRoute(app, "/ready", "get");

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.ok, false);
  assert.equal(typeof response.body.checks.payment.ok, "boolean");
  assert.equal(response.body.checks.intents.ok, false);
  assert.equal(response.body.checks.usage.ok, false);
  assert.match(response.body.checks.intents.error, /connect|ECONNREFUSED|authentication failed/i);
  assert.match(response.body.checks.usage.error, /connect|ECONNREFUSED|authentication failed/i);
});

test("request handlers surface broken Postgres as dependency failures", async () => {
  const app = createBrokenPostgresApp();

  const createIntentResponse = await invokeRoute(app, "/intents", "post", {
    body: {
      endpoint: "ai",
      query: "storage failure test",
    },
  });
  const statsResponse = await invokeRoute(app, "/stats", "get");

  assert.equal(createIntentResponse.statusCode, 503);
  assert.match(createIntentResponse.body.error, /connect|ECONNREFUSED|authentication failed/i);

  assert.equal(statsResponse.statusCode, 503);
  assert.match(statsResponse.body.error, /connect|ECONNREFUSED|authentication failed/i);
});
