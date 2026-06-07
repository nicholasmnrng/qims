import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/server/env";
import { schema } from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  qimsPgPool?: Pool;
};

export const pool =
  globalForDb.qimsPgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.qimsPgPool = pool;
}

export const db = drizzle(pool, { schema });
