import { appendFileSync, readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_LOG_FILE = "logs.txt";
const DEFAULT_USAGE_SQLITE_FILE = "agentpay-usage.db";

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

export function createUsageStore(storage = createFileUsageStorage()) {
  if (!storage || typeof storage.append !== "function") {
    throw new Error("Invalid usage storage: missing append()");
  }

  if (typeof storage.list !== "function") {
    throw new Error("Invalid usage storage: missing list()");
  }

  return {
    storage,
    logRequest(entry) {
      storage.append(entry);
      return entry;
    },
    listLogs() {
      return storage.list();
    },
    readStats() {
      return summarize(storage.list());
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
