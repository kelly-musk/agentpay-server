function assertObject(name, value) {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid ${name}: expected an object`);
  }
}

export function assertValidPostgresIdentifier(name, value) {
  if (!value || typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${name}: expected a safe SQL identifier`);
  }
}

export function quoteIdentifier(value) {
  assertValidPostgresIdentifier("Postgres identifier", value);
  return `"${value}"`;
}

export function buildQualifiedTableName(schemaName, tableName) {
  assertValidPostgresIdentifier("Postgres schemaName", schemaName);
  assertValidPostgresIdentifier("Postgres tableName", tableName);
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}

async function loadPgModule() {
  try {
    return await import("pg");
  } catch (error) {
    throw new Error(
      `Postgres storage requires the optional "pg" package at runtime: ${error.message}`,
    );
  }
}

export function createPostgresQueryClient(options = {}) {
  assertObject("Postgres storage options", options);

  const { client, connectionString, ssl, max } = options;

  if (client) {
    if (typeof client.query !== "function") {
      throw new Error("Invalid Postgres client: missing query()");
    }

    return {
      async query(text, params) {
        return client.query(text, params);
      },
      async close() {
        if (typeof client.end === "function") {
          await client.end();
        }
      },
    };
  }

  if (!connectionString || typeof connectionString !== "string") {
    throw new Error("Invalid Postgres storage config: connectionString is required");
  }

  let poolPromise = null;

  async function getPool() {
    if (!poolPromise) {
      poolPromise = (async () => {
        const { Pool } = await loadPgModule();
        return new Pool({
          connectionString,
          ssl,
          max,
        });
      })();
    }

    return poolPromise;
  }

  return {
    async query(text, params) {
      const pool = await getPool();
      return pool.query(text, params);
    },
    async close() {
      if (!poolPromise) {
        return;
      }

      const pool = await poolPromise;
      await pool.end();
    },
  };
}
