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

test("supports injected usage storage for implementers", () => {
  const usageStore = createUsageStore(createMemoryUsageStorage());
  const app = createAgentPayApp({
    config,
    usageStore,
  });

  usageStore.logRequest({
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
  assert.equal(usageStore.readStats().total_revenue, "0.02 USDC");
});

test("fails fast on invalid provider route and storage config", () => {
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
});
