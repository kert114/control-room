import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import { env } from "@/platform/config/env";
import * as schema from "@/platform/db/schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

declare global {
  var __controlRoomDb: Database | undefined;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * TLS with certificate verification for every non-local server unless the
 * connection string states its own `sslmode`, which pg then honours as written.
 */
export function databaseSsl(connectionString: string): PoolConfig["ssl"] {
  const url = new URL(connectionString);
  if (url.searchParams.has("sslmode")) {
    return undefined;
  }
  return LOCAL_HOSTS.has(url.hostname) ? false : { rejectUnauthorized: true };
}

export function poolConfig(connectionString: string, max: number): PoolConfig {
  const ssl = databaseSsl(connectionString);
  return ssl === undefined ? { connectionString, max } : { connectionString, max, ssl };
}

function connect(): Database {
  if (!globalThis.__controlRoomDb) {
    const pool = new Pool(poolConfig(env().DATABASE_URL, 5));
    globalThis.__controlRoomDb = drizzle(pool, { schema });
  }
  return globalThis.__controlRoomDb;
}

/**
 * Connects on first use so importing platform modules never requires database
 * configuration (unit tests import the query builders without a database).
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const database = connect();
    const value = Reflect.get(database, property, database) as unknown;
    return typeof value === "function" ? value.bind(database) : value;
  },
});
