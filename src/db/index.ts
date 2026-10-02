import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare: false keeps us compatible with Supabase's transaction pooler (port 6543).
  // connect_timeout makes a wrong DATABASE_URL fail fast instead of hanging; a small pool with a
  // short lifetime keeps one slow or dead connection from blocking every request on a Vercel instance.
  // Supabase's transaction pooler (port 6543) stalls when postgres.js pipelines concurrent
  // queries over one connection, so there we use a single connection (queries run one at a
  // time). The session pooler (port 5432, recommended) handles a small pool normally.
  let port = "";
  try {
    port = new URL(url).port;
  } catch {}
  const max = !process.env.VERCEL ? 5 : port === "6543" ? 1 : 3;
  const client = postgres(url, {
    prepare: false,
    max,
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 60 * 5,
  });
  return { client, db: drizzle(client, { schema }) };
}

type Conn = ReturnType<typeof create>;
type DB = Conn["db"];
const globalForDb = globalThis as unknown as { cphConn?: Conn };

function conn(): Conn {
  return (globalForDb.cphConn ??= create());
}

/** Created on first use so builds don't need database credentials. */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = conn().db;
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/** Drops the pool (e.g. after a hung query) so the next query opens fresh connections. */
export function resetDb() {
  const current = globalForDb.cphConn;
  globalForDb.cphConn = undefined;
  current?.client.end({ timeout: 0 }).catch(() => {});
}

export { schema };
