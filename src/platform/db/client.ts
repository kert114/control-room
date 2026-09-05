import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/platform/config/env";
import * as schema from "@/platform/db/schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

declare global {
  var __controlRoomDb: Database | undefined;
}

function connect(): Database {
  if (!globalThis.__controlRoomDb) {
    const pool = new Pool({ connectionString: env().DATABASE_URL, max: 5 });
    globalThis.__controlRoomDb = drizzle(pool, { schema });
  }
  return globalThis.__controlRoomDb;
}

/**
 * Connects on first use so importing platform modules never requires database
 * configuration (unit tests import the query builders without a database).
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const value = Reflect.get(connect(), property, receiver) as unknown;
    return typeof value === "function" ? value.bind(connect()) : value;
  },
});
