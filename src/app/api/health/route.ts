import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withTimeout } from "@/lib/with-timeout";

export const dynamic = "force-dynamic";

/** Describes a connection string without revealing the password. */
function describeUrl(name: string) {
  const raw = process.env[name];
  if (!raw) return { set: false };
  try {
    const u = new URL(raw);
    return {
      set: true,
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username),
      hasPasswordPlaceholder: raw.includes("[YOUR-PASSWORD]") || raw.includes("YOUR-PASSWORD"),
      looksLikeDirectHost: /^db\..+\.supabase\.co$/.test(u.hostname),
    };
  } catch {
    return { set: true, parseable: false, hint: "Not a valid URL. Special characters in the password (@ # / ? %) break it — reset the password to letters and numbers." };
  }
}

/**
 * GET /api/health          → { ok: true } (the site is up)
 * GET /api/health?db=1     → also tests the database and Supabase Auth, with plain-English hints.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("db") !== "1") return NextResponse.json({ ok: true });

  const report: Record<string, unknown> = { DATABASE_URL: describeUrl("DATABASE_URL") };

  const started = Date.now();
  try {
    await withTimeout(db.execute(sql`select 1`), 8000, "timed out after 8 seconds");
    const tables = await db.execute<{ n: number }>(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('staff','matters','contacts')`);
    report.database = { ok: true, ms: Date.now() - started, crmTablesFound: Number(tables[0]?.n ?? 0) };
  } catch (err) {
    const e = err as { message?: string; cause?: { message?: string; code?: string } };
    const message = e?.cause?.message || e?.message || String(err);
    let hint = "Copy DIRECT_DATABASE_URL into DATABASE_URL, change :5432 to :6543, save, and redeploy.";
    if (/password authentication failed/i.test(message)) hint = "Wrong password inside DATABASE_URL. Use the same password as DIRECT_DATABASE_URL (the build connects with that one).";
    else if (/tenant or user not found/i.test(message)) hint = "The user must be postgres.<project-ref> and the host must match your project's region (copy it from Supabase → Connect → Transaction pooler).";
    else if (/timed out|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/i.test(message)) hint = "The host can't be reached. Use the Transaction pooler host (…pooler.supabase.com, port 6543), not db.<ref>.supabase.co.";
    report.database = { ok: false, ms: Date.now() - started, error: message, hint };
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supaUrl) {
    try {
      const res = await withTimeout(
        fetch(`${supaUrl.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" }, cache: "no-store" }),
        5000,
        "timed out after 5 seconds",
      );
      report.supabaseAuth = { ok: res.ok, status: res.status };
    } catch (err) {
      report.supabaseAuth = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else report.supabaseAuth = { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL is not set" };

  report.APP_URL = process.env.APP_URL ?? null;
  report.ok = (report.database as { ok: boolean }).ok && (report.supabaseAuth as { ok: boolean }).ok;
  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
