import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_INTENTS_FILE = "intents.json";
const DEFAULT_INTENTS_SQLITE_FILE = "agentpay-intents.db";

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

export function createMemoryIntentStorage(initialIntents = []) {
  const intents = initialIntents.slice();

  return {
    kind: "memory",
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
