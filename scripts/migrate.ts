/**
 * Applies SQL migrations in ./drizzle. Uses DIRECT_DATABASE_URL when set
 * (Supabase session/direct connection), otherwise DATABASE_URL.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DIRECT_DATABASE_URL)");
  let host = "(unparseable URL)";
  try {
    const u = new URL(url);
    host = `${u.hostname}:${u.port || "5432"} as ${decodeURIComponent(u.username)}`;
  } catch {}
  console.log(`Connecting to database at ${host} …`);
  if (url.includes("[YOUR-PASSWORD]")) throw new Error("The database URL still contains [YOUR-PASSWORD] — replace it with your real database password.");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 15 });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  const cause = err?.cause?.message ?? err?.cause?.code ?? "";
  console.error("\nDatabase migration failed:", cause || err?.message || err);
  console.error(
    "Check DIRECT_DATABASE_URL in Vercel → Settings → Environment Variables. Use Supabase → Connect → Session pooler " +
      "(host ends in pooler.supabase.com, port 5432), with your real password. The db.<ref>.supabase.co direct host does not work from Vercel.",
  );
  process.exit(1);
});
