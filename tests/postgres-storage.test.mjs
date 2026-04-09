import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntentStore,
  createPostgresIntentStorage,
} from "../server/intents.js";
import {
  createPostgresUsageStorage,
  createUsageStore,
} from "../server/logger.js";

function createIntentClient() {
  const rows = new Map();

  return {
    async query(text, params = []) {
      if (text.includes("CREATE TABLE IF NOT EXISTS")) {
        return { rows: [] };
      }

      if (text.includes("INSERT INTO")) {
        const [
          id,
          endpoint,
          query,
          amount,
          asset,
          status,
          payment,
          settlement,
          result,
          error,
          executedAt,
          createdAt,
          updatedAt,
        ] = params;
        rows.set(id, {
          id,
          endpoint,
          query,
          amount,
          asset,
          status,
          payment: payment ? JSON.parse(payment) : null,
          settlement: settlement ? JSON.parse(settlement) : null,
          result: result ? JSON.parse(result) : null,
          error,
          executed_at: executedAt,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return { rows: [] };
      }

      if (text.includes("WHERE id = $1")) {
        const row = rows.get(params[0]);
        return { rows: row ? [row] : [] };
      }

      if (text.includes("ORDER BY created_at DESC")) {
        return {
          rows: Array.from(rows.values())
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
            .slice(0, params[0]),
        };
      }

      if (text.includes("UPDATE")) {
        const [
          endpoint,
          query,
          amount,
          asset,
          status,
          payment,
          settlement,
          result,
          error,
          executedAt,
          createdAt,
          updatedAt,
          id,
        ] = params;
        rows.set(id, {
          id,
          endpoint,
          query,
          amount,
          asset,
          status,
          payment: payment ? JSON.parse(payment) : null,
          settlement: settlement ? JSON.parse(settlement) : null,
          result: result ? JSON.parse(result) : null,
          error,
          executed_at: executedAt,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return { rows: [] };
      }

      throw new Error(`Unexpected intents SQL in test client: ${text}`);
    },
  };
}

function createUsageClient() {
  const rows = [];

  return {
    async query(text, params = []) {
      if (text.includes("CREATE TABLE IF NOT EXISTS")) {
        return { rows: [] };
      }

      if (text.includes("INSERT INTO")) {
        const [endpoint, query, timestamp, payment, intentId, flow] = params;
        rows.push({
          endpoint,
          query,
          timestamp,
          payment: payment ? JSON.parse(payment) : null,
          intent_id: intentId,
          flow,
        });
        return { rows: [] };
      }

      if (text.includes("ORDER BY timestamp ASC")) {
        return {
          rows: rows.slice().sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
        };
      }

      throw new Error(`Unexpected usage SQL in test client: ${text}`);
    },
  };
}

test("supports postgres-backed intent storage through an injected query client", async () => {
  const intentStore = createIntentStore(
    createPostgresIntentStorage({
      client: createIntentClient(),
      schemaName: "public",
      tableName: "stellar_oxide_gateway_intents_test",
    }),
  );

  const created = await intentStore.createIntent({
    endpoint: "ai",
    query: "postgres",
    amount: "0.02",
    asset: "USDC",
  });

  const updated = await intentStore.updateIntent(created.id, {
    status: "executed",
    result: { ok: true },
  });
  const fetched = await intentStore.getIntentById(created.id);

  assert.equal(intentStore.storage.kind, "postgres");
  assert.equal(fetched?.id, created.id);
  assert.equal(updated?.status, "executed");
  assert.deepEqual(updated?.result, { ok: true });
});

test("supports postgres-backed usage storage through an injected query client", async () => {
  const usageStore = createUsageStore(
    createPostgresUsageStorage({
      client: createUsageClient(),
      schemaName: "public",
      tableName: "stellar_oxide_gateway_usage_test",
    }),
  );

  await usageStore.logRequest({
    endpoint: "compute",
    query: "postgres usage",
    timestamp: new Date().toISOString(),
    payment: {
      status: "verified",
      network: "stellar-testnet",
      asset: "USDC",
      amount: "0.03",
    },
    flow: "intent-execution",
  });

  assert.equal(usageStore.storage.kind, "postgres");
  assert.equal((await usageStore.listLogs()).length, 1);
  assert.equal((await usageStore.readStats()).total_revenue, "0.03 USDC");
});
