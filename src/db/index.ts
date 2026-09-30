import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare: false keeps us compatible with Supabase's transaction pooler (port 6543).
  // connect_timeout makes a wrong DATABASE_URL fail fast with a clear error instead of hanging.
  const client = postgres(url, { prepare: false, max: process.env.VERCEL ? 1 : 5, connect_timeout: 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}

type DB = ReturnType<typeof create>;
const globalForDb = globalThis as unknown as { cphDb?: DB };

/** Created on first use so builds don't need database credentials. */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = (globalForDb.cphDb ??= create());
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
