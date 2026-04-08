import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import {
  buildQualifiedTableName,
  createPostgresQueryClient,
} from "./postgres.js";

const DEFAULT_INTENTS_FILE = "intents.json";
const DEFAULT_INTENTS_SQLITE_FILE = "agentpay-intents.db";
const DEFAULT_INTENTS_POSTGRES_SCHEMA = "public";
const DEFAULT_INTENTS_POSTGRES_TABLE = "agentpay_intents";

function sortIntents(intents) {
  return intents
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createIntentRecord({ endpoint, query, amount, asset }) {
  const timestamp = new Date().toISOString();

  return {
    id: `intent_${randomUUID()}`,
    endpoint,
    query,
    amount,
    asset,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createFileIntentStorage(filename = DEFAULT_INTENTS_FILE) {
  function readAll() {
    try {
      const raw = readFileSync(filename, "utf-8").trim();

      if (!raw) {
        return [];
      }

      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  function writeAll(intents) {
    writeFileSync(filename, `${JSON.stringify(intents, null, 2)}\n`);
  }

  return {
    kind: "file",
    async healthCheck() {
      return {
        ok: true,
        status: "ready",
        kind: "file",
        target: filename,
      };
    },
    async close() {},
    list(limit = 50) {
      return sortIntents(readAll()).slice(0, limit);
    },
    getById(intentId) {
      return readAll().find((intent) => intent.id === intentId) || null;
    },
    create(input) {
      const intents = readAll();
      const intent = createIntentRecord(input);
      intents.push(intent);
      writeAll(intents);
      return intent;
    },
    update(intentId, patch) {
      const intents = readAll();
      const index = intents.findIndex((intent) => intent.id === intentId);

      if (index === -1) {
        return null;
      }

      const updatedIntent = {
        ...intents[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      intents[index] = updatedIntent;
      writeAll(intents);

      return updatedIntent;
    },
  };
}

export function createSqliteIntentStorage(filename = DEFAULT_INTENTS_SQLITE_FILE) {
  const database = new DatabaseSync(filename);

  database.exec(`
    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      query TEXT NOT NULL,
      amount TEXT NOT NULL,
      asset TEXT NOT NULL,
      status TEXT NOT NULL,
      payment TEXT,
      settlement TEXT,
      result TEXT,
      error TEXT,
      executedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_intents_created_at
    ON intents (createdAt DESC);
  `);

  const selectByIdStatement = database.prepare(`
    SELECT *
    FROM intents
    WHERE id = ?
  `);
  const listStatement = database.prepare(`
    SELECT *
    FROM intents
    ORDER BY createdAt DESC
    LIMIT ?
  `);
  const insertStatement = database.prepare(`
    INSERT INTO intents (
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
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatement = database.prepare(`
    UPDATE intents
    SET
      endpoint = ?,
      query = ?,
      amount = ?,
      asset = ?,
      status = ?,
      payment = ?,
      settlement = ?,
      result = ?,
      error = ?,
      executedAt = ?,
      createdAt = ?,
      updatedAt = ?
    WHERE id = ?
  `);

  function serialize(value) {
    if (value === undefined) {
      return null;
    }

    if (value === null) {
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
      id: row.id,
      endpoint: row.endpoint,
      query: row.query,
      amount: row.amount,
      asset: row.asset,
      status: row.status,
      payment: row.payment ? JSON.parse(row.payment) : undefined,
      settlement: row.settlement ? JSON.parse(row.settlement) : undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error || undefined,
      executedAt: row.executedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

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
    list(limit = 50) {
      return listStatement.all(limit).map(deserialize);
    },
    getById(intentId) {
      return deserialize(selectByIdStatement.get(intentId));
    },
    create(input) {
      const intent = createIntentRecord(input);

      insertStatement.run(
        intent.id,
        intent.endpoint,
        intent.query,
        intent.amount,
        intent.asset,
        intent.status,
        serialize(intent.payment),
        serialize(intent.settlement),
        serialize(intent.result),
        serialize(intent.error),
        serialize(intent.executedAt),
        intent.createdAt,
        intent.updatedAt,
      );

      return intent;
    },
    update(intentId, patch) {
      const existing = deserialize(selectByIdStatement.get(intentId));

      if (!existing) {
        return null;
      }

      const updatedIntent = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      updateStatement.run(
        updatedIntent.endpoint,
        updatedIntent.query,
        updatedIntent.amount,
        updatedIntent.asset,
        updatedIntent.status,
        serialize(updatedIntent.payment),
        serialize(updatedIntent.settlement),
        serialize(updatedIntent.result),
        serialize(updatedIntent.error),
        serialize(updatedIntent.executedAt),
        updatedIntent.createdAt,
        updatedIntent.updatedAt,
        intentId,
      );

      return updatedIntent;
    },
  };
}

export function createPostgresIntentStorage(options = {}) {
  const schemaName = options.schemaName || DEFAULT_INTENTS_POSTGRES_SCHEMA;
  const tableName = options.tableName || DEFAULT_INTENTS_POSTGRES_TABLE;
  const qualifiedTableName = buildQualifiedTableName(schemaName, tableName);
  const queryClient = createPostgresQueryClient(options);
  let initializationPromise = null;

  async function initialize() {
    if (!initializationPromise) {
      initializationPromise = queryClient.query(`
        CREATE TABLE IF NOT EXISTS ${qualifiedTableName} (
          id TEXT PRIMARY KEY,
          endpoint TEXT NOT NULL,
          query TEXT NOT NULL,
          amount TEXT NOT NULL,
          asset TEXT NOT NULL,
          status TEXT NOT NULL,
          payment JSONB,
          settlement JSONB,
          result JSONB,
          error TEXT,
          executed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS ${tableName}_created_at_idx
        ON ${qualifiedTableName} (created_at DESC);
      `);
    }

    await initializationPromise;
  }

  function deserialize(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      endpoint: row.endpoint,
      query: row.query,
      amount: row.amount,
      asset: row.asset,
      status: row.status,
      payment: row.payment || undefined,
      settlement: row.settlement || undefined,
      result: row.result || undefined,
      error: row.error || undefined,
      executedAt: row.executed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
    async list(limit = 50) {
      await initialize();
      const result = await queryClient.query(
        `
          SELECT *
          FROM ${qualifiedTableName}
          ORDER BY created_at DESC
          LIMIT $1
        `,
        [limit],
      );
      return result.rows.map(deserialize);
    },
    async getById(intentId) {
      await initialize();
      const result = await queryClient.query(
        `
          SELECT *
          FROM ${qualifiedTableName}
          WHERE id = $1
        `,
        [intentId],
      );
      return deserialize(result.rows[0]);
    },
    async create(input) {
      await initialize();
      const intent = createIntentRecord(input);

      await queryClient.query(
        `
          INSERT INTO ${qualifiedTableName} (
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
            executed_at,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13)
        `,
        [
          intent.id,
          intent.endpoint,
          intent.query,
          intent.amount,
          intent.asset,
          intent.status,
          intent.payment ? JSON.stringify(intent.payment) : null,
          intent.settlement ? JSON.stringify(intent.settlement) : null,
          intent.result ? JSON.stringify(intent.result) : null,
          intent.error || null,
          intent.executedAt || null,
          intent.createdAt,
          intent.updatedAt,
        ],
      );

      return intent;
    },
    async update(intentId, patch) {
      await initialize();
      const existing = await this.getById(intentId);

      if (!existing) {
        return null;
      }

      const updatedIntent = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      await queryClient.query(
        `
          UPDATE ${qualifiedTableName}
          SET
            endpoint = $1,
            query = $2,
            amount = $3,
            asset = $4,
            status = $5,
            payment = $6::jsonb,
            settlement = $7::jsonb,
            result = $8::jsonb,
            error = $9,
            executed_at = $10,
            created_at = $11,
            updated_at = $12
          WHERE id = $13
        `,
        [
          updatedIntent.endpoint,
          updatedIntent.query,
          updatedIntent.amount,
          updatedIntent.asset,
          updatedIntent.status,
          updatedIntent.payment ? JSON.stringify(updatedIntent.payment) : null,
          updatedIntent.settlement ? JSON.stringify(updatedIntent.settlement) : null,
          updatedIntent.result ? JSON.stringify(updatedIntent.result) : null,
          updatedIntent.error || null,
          updatedIntent.executedAt || null,
          updatedIntent.createdAt,
          updatedIntent.updatedAt,
          intentId,
        ],
      );

      return updatedIntent;
    },
  };
}

export function createMemoryIntentStorage(initialIntents = []) {
  const intents = initialIntents.slice();

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
    list(limit = 50) {
      return sortIntents(intents).slice(0, limit);
    },
    getById(intentId) {
      return intents.find((intent) => intent.id === intentId) || null;
    },
    create(input) {
      const intent = createIntentRecord(input);
      intents.push(intent);
      return intent;
    },
    update(intentId, patch) {
      const index = intents.findIndex((intent) => intent.id === intentId);

      if (index === -1) {
        return null;
      }

      const updatedIntent = {
        ...intents[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      intents[index] = updatedIntent;
      return updatedIntent;
    },
  };
}

export function createIntentStore(storage = createFileIntentStorage()) {
  if (!storage || typeof storage.create !== "function") {
    throw new Error("Invalid intent storage: missing create()");
  }

  if (typeof storage.getById !== "function") {
    throw new Error("Invalid intent storage: missing getById()");
  }

  if (typeof storage.list !== "function") {
    throw new Error("Invalid intent storage: missing list()");
  }

  if (typeof storage.update !== "function") {
    throw new Error("Invalid intent storage: missing update()");
  }

  return {
    storage,
    createIntent(input) {
      return storage.create(input);
    },
    getIntentById(intentId) {
      return storage.getById(intentId);
    },
    listIntents(limit = 50) {
      return storage.list(limit);
    },
    updateIntent(intentId, patch) {
      return storage.update(intentId, patch);
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

const defaultIntentStore = createIntentStore();

export function createIntent(input) {
  return defaultIntentStore.createIntent(input);
}

export function getIntentById(intentId) {
  return defaultIntentStore.getIntentById(intentId);
}

export function listIntents(limit = 50) {
  return defaultIntentStore.listIntents(limit);
}

export function updateIntent(intentId, patch) {
  return defaultIntentStore.updateIntent(intentId, patch);
}
