import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  createMemoryUsageStorage,
  createSqliteUsageStorage,
  createUsageStore,
} from "../server/logger.js";

test("aggregates usage stats from in-memory storage", () => {
  const usageStore = createUsageStore(createMemoryUsageStorage());

  usageStore.logRequest({
    endpoint: "ai",
    query: "hello",
    timestamp: new Date().toISOString(),
    payment: {
      status: "verified",
      network: "stellar-testnet",
      asset: "USDC",
      amount: "0.02",
    },
  });

  usageStore.logRequest({
    endpoint: "data",
    query: "facts",
    timestamp: new Date().toISOString(),
    payment: {
      status: "verified",
      network: "stellar-testnet",
      asset: "USDC",
      amount: "0.01",
    },
  });

  assert.deepEqual(usageStore.readStats(), {
    total_requests: 2,
    total_revenue: "0.03 USDC",
  });
});

test("supports sqlite-backed usage storage", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "agentpay-usage-"));
  const sqliteFile = join(tempRoot, "usage.db");

  try {
    const usageStore = createUsageStore(createSqliteUsageStorage(sqliteFile));

    usageStore.logRequest({
      endpoint: "compute",
      query: "heavy",
      timestamp: new Date().toISOString(),
      payment: {
        status: "verified",
        network: "stellar-testnet",
        asset: "XLM",
        amount: "0.03",
      },
      flow: "intent-execution",
    });

    assert.equal(usageStore.storage.kind, "sqlite");
    assert.equal(usageStore.listLogs().length, 1);
    assert.equal(usageStore.readStats().total_revenue, "0.03 XLM");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
