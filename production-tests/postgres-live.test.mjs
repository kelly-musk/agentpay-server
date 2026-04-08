import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  createIntentStore,
  createPostgresIntentStorage,
} from "../server/intents.js";
import {
  createPostgresUsageStorage,
  createUsageStore,
} from "../server/logger.js";

const connectionString = process.env.DATABASE_URL || process.env.AGENTPAY_TEST_DATABASE_URL;

test(
  "live Postgres storage adapters create, read, update, summarize, and close correctly",
  {
    skip: !connectionString ? "Set DATABASE_URL or AGENTPAY_TEST_DATABASE_URL to run live Postgres tests." : false,
  },
  async () => {
    const suffix = randomUUID().replace(/-/g, "_");
    const intentsTable = `agentpay_intents_${suffix}`;
    const usageTable = `agentpay_usage_${suffix}`;

    const intentStore = createIntentStore(
      createPostgresIntentStorage({
        connectionString,
        schemaName: "public",
        tableName: intentsTable,
      }),
    );
    const usageStore = createUsageStore(
      createPostgresUsageStorage({
        connectionString,
        schemaName: "public",
        tableName: usageTable,
      }),
    );

    const created = await intentStore.createIntent({
      endpoint: "ai",
      query: "live postgres integration",
      amount: "0.02",
      asset: "XLM",
    });
    const updated = await intentStore.updateIntent(created.id, {
      status: "executed",
      result: { ok: true, source: "live-postgres" },
    });
    const fetched = await intentStore.getIntentById(created.id);
    const listed = await intentStore.listIntents(10);

    await usageStore.logRequest({
      endpoint: "ai",
      query: "live postgres integration",
      timestamp: new Date().toISOString(),
      payment: {
        status: "verified",
        network: "stellar-testnet",
        asset: "XLM",
        amount: "0.02",
      },
      flow: "direct",
    });

    const stats = await usageStore.readStats();
    const intentHealth = await intentStore.healthCheck();
    const usageHealth = await usageStore.healthCheck();

    assert.equal(fetched?.id, created.id);
    assert.equal(updated?.status, "executed");
    assert.deepEqual(updated?.result, { ok: true, source: "live-postgres" });
    assert.equal(listed.some((intent) => intent.id === created.id), true);
    assert.equal(stats.total_revenue, "0.02 XLM");
    assert.equal(intentHealth.ok, true);
    assert.equal(usageHealth.ok, true);

    await intentStore.close();
    await usageStore.close();

    const cleanupClient = new Client({ connectionString });
    await cleanupClient.connect();
    await cleanupClient.query(`DROP TABLE IF EXISTS "public"."${intentsTable}"`);
    await cleanupClient.query(`DROP TABLE IF EXISTS "public"."${usageTable}"`);
    await cleanupClient.end();
  },
);
