import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff, type Staff } from "@/db/schema";
import { devAuthBypass } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function resolveStaff(email: string, userId: string | null, fullName: string): Promise<Staff | null> {
  const normalized = email.trim().toLowerCase();
  let row = await db.query.staff.findFirst({ where: eq(staff.email, normalized) });

  if (!row) {
    // Bootstrap: the configured owner becomes the first admin automatically.
    const bootstrap = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (bootstrap && bootstrap === normalized) {
      const [created] = await db
        .insert(staff)
        .values({ email: normalized, name: fullName || normalized, role: "admin", userId })
        .onConflictDoNothing()
        .returning();
      row = created ?? (await db.query.staff.findFirst({ where: eq(staff.email, normalized) }));
    }
  }
  if (!row || !row.active) return null;

  if ((userId && row.userId !== userId) || (!row.name && fullName)) {
    await db
      .update(staff)
      .set({ userId: userId ?? row.userId, name: row.name || fullName })
      .where(eq(staff.id, row.id));
  }
  // Touch last_seen at most every 10 minutes
  if (!row.lastSeenAt || Date.now() - row.lastSeenAt.getTime() > 10 * 60_000) {
    await db.update(staff).set({ lastSeenAt: sql`now()` }).where(and(eq(staff.id, row.id)));
  }
  return row;
}

/** Current signed-in staff member, or null. Memoized per request. */
export const getCurrentStaff = cache(async (): Promise<Staff | null> => {
  // Never prerender anything that depends on who is signed in.
  await connection();
  if (devAuthBypass()) {
    const email = process.env.DEV_AUTH_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "dev@example.com";
    return resolveStaff(email, null, "Dev User");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return resolveStaff(user.email, user.id, meta.full_name || meta.name || "");
});

/** For pages and server actions: redirects if not signed in / not invited. */
export async function requireStaff(): Promise<Staff> {
  const me = await getCurrentStaff();
  if (!me) {
    if (devAuthBypass()) redirect("/not-authorized");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/not-authorized" : "/login");
  }
  return me;
}

export async function requireAdmin(): Promise<Staff> {
  const me = await requireStaff();
  if (me.role !== "admin") redirect("/?error=admin_only");
  return me;
}
