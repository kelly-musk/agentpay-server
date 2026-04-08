import { appendFileSync, readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import {
  buildQualifiedTableName,
  createPostgresQueryClient,
} from "./postgres.js";

const DEFAULT_LOG_FILE = "logs.txt";
const DEFAULT_USAGE_SQLITE_FILE = "agentpay-usage.db";
const DEFAULT_USAGE_POSTGRES_SCHEMA = "public";
const DEFAULT_USAGE_POSTGRES_TABLE = "agentpay_usage";

function parseEntries(raw) {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function serialize(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function deserialize(row) {
  if (!row) {
    return null;
  }

  return {
    endpoint: row.endpoint,
    query: row.query,
    timestamp: row.timestamp,
    payment: row.payment ? JSON.parse(row.payment) : undefined,
    intentId: row.intentId || undefined,
    flow: row.flow || undefined,
  };
}

function summarize(entries) {
  if (entries.length === 0) {
    return { total_requests: 0, total_revenue: "0.00 XLM" };
  }

  const totalRevenue = entries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.payment?.amount || "0"),
    0,
  );

  return {
    total_requests: entries.length,
    total_revenue: `${totalRevenue.toFixed(2)} ${entries[0]?.payment?.asset || "XLM"}`,
  };
}

export function createFileUsageStorage(filename = DEFAULT_LOG_FILE) {
  return {
    kind: "file",
    filename,
    async healthCheck() {
      return {
        ok: true,
        status: "ready",
        kind: "file",
        target: filename,
      };
    },
    async close() {},
    append(entry) {
      appendFileSync(filename, `${JSON.stringify(entry)}\n`);
    },
    list() {
      try {
        const raw = readFileSync(filename, "utf-8");
        return parseEntries(raw);
      } catch (error) {
        if (error.code === "ENOENT") {
          return [];
        }

        throw error;
      }
    },
  };
}

export function createMemoryUsageStorage(initialEntries = []) {
  const entries = initialEntries.slice();

  return {
    kind: "memory",
    async healthCheck() {
      return {
        ok: true,
        status: "ready",
        kind: "memory",
      };
    },
    async close() {},
    append(entry) {
      entries.push(entry);
    },
    list() {
      return entries.slice();
    },
  };
}

export function createSqliteUsageStorage(filename = DEFAULT_USAGE_SQLITE_FILE) {
  const database = new DatabaseSync(filename);

  database.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      query TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payment TEXT,
      intentId TEXT,
      flow TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp
    ON request_logs (timestamp DESC);
  `);

  const insertStatement = database.prepare(`
    INSERT INTO request_logs (
      endpoint,
      query,
      timestamp,
      payment,
      intentId,
      flow
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const listStatement = database.prepare(`
    SELECT endpoint, query, timestamp, payment, intentId, flow
    FROM request_logs
    ORDER BY timestamp ASC
  `);

  return {
    kind: "sqlite",
    filename,
    async healthCheck() {
      database.prepare("SELECT 1 AS ok").get();
      return {
        ok: true,
        status: "ready",
        kind: "sqlite",
        target: filename,
      };
    },
    async close() {
      if (typeof database.close === "function") {
        database.close();
      }
    },
    append(entry) {
      insertStatement.run(
        entry.endpoint,
        entry.query,
        entry.timestamp,
        serialize(entry.payment),
        serialize(entry.intentId),
        serialize(entry.flow),
      );
    },
    list() {
      return listStatement.all().map(deserialize);
    },
  };
}

export function createPostgresUsageStorage(options = {}) {
  const schemaName = options.schemaName || DEFAULT_USAGE_POSTGRES_SCHEMA;
  const tableName = options.tableName || DEFAULT_USAGE_POSTGRES_TABLE;
  const qualifiedTableName = buildQualifiedTableName(schemaName, tableName);
  const queryClient = createPostgresQueryClient(options);
  let initializationPromise = null;

  async function initialize() {
    if (!initializationPromise) {
      initializationPromise = queryClient.query(`
        CREATE TABLE IF NOT EXISTS ${qualifiedTableName} (
          id BIGSERIAL PRIMARY KEY,
          endpoint TEXT NOT NULL,
          query TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          payment JSONB,
          intent_id TEXT,
          flow TEXT
        );

        CREATE INDEX IF NOT EXISTS ${tableName}_timestamp_idx
        ON ${qualifiedTableName} (timestamp DESC);
      `);
    }

    await initializationPromise;
  }

  function deserializePostgresRow(row) {
    if (!row) {
      return null;
    }

    return {
      endpoint: row.endpoint,
      query: row.query,
      timestamp: row.timestamp,
      payment: row.payment || undefined,
      intentId: row.intent_id || undefined,
      flow: row.flow || undefined,
    };
  }

  return {
    kind: "postgres",
    schemaName,
    tableName,
    async healthCheck() {
      await initialize();
      await queryClient.query("SELECT 1 AS ok");
      return {
        ok: true,
        status: "ready",
        kind: "postgres",
        schemaName,
        tableName,
      };
    },
    async close() {
      await queryClient.close();
    },
    async append(entry) {
      await initialize();
      await queryClient.query(
        `
          INSERT INTO ${qualifiedTableName} (
            endpoint,
            query,
            timestamp,
            payment,
            intent_id,
            flow
          ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        `,
        [
          entry.endpoint,
          entry.query,
          entry.timestamp,
          entry.payment ? JSON.stringify(entry.payment) : null,
          entry.intentId || null,
          entry.flow || null,
        ],
      );
    },
    async list() {
      await initialize();
      const result = await queryClient.query(
        `
          SELECT endpoint, query, timestamp, payment, intent_id, flow
          FROM ${qualifiedTableName}
          ORDER BY timestamp ASC
        `,
      );
      return result.rows.map(deserializePostgresRow);
    },
  };
}

export function createUsageStore(storage = createFileUsageStorage()) {
  if (!storage || typeof storage.append !== "function") {
    throw new Error("Invalid usage storage: missing append()");
  }

  if (typeof storage.list !== "function") {
    throw new Error("Invalid usage storage: missing list()");
  }

  return {
    storage,
    async logRequest(entry) {
      await storage.append(entry);
      return entry;
    },
    async listLogs() {
      return storage.list();
    },
    async readStats() {
      return summarize(await storage.list());
    },
    async healthCheck() {
      if (typeof storage.healthCheck === "function") {
        return storage.healthCheck();
      }

      return {
        ok: true,
        status: "ready",
        kind: storage.kind || "custom",
      };
    },
    async close() {
      if (typeof storage.close === "function") {
        await storage.close();
      }
    },
  };
}

const defaultUsageStore = createUsageStore();

export function logRequest(entry) {
  return defaultUsageStore.logRequest(entry);
}

export function readStats() {
  return defaultUsageStore.readStats();
}
