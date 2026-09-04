import "@/platform/config/dotenv";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { readEnv } from "@/platform/config/env";

async function main(): Promise<void> {
  const { DATABASE_URL } = readEnv();
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const database = drizzle(pool);
  await migrate(database, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("migrations applied");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
