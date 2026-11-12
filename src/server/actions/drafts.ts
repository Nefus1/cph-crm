"use server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { intakeDrafts, intakeSubmissions, staff } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { draftPayloadSchema, type DraftPayload } from "@/lib/intake-draft";
import { fail } from "@/server/types";
import { revalidateAll } from "./_helpers";

export async function saveIntakeDraft(id: string, version: number, raw: DraftPayload) {
  try {
    const me = await requireStaff();
    z.string().uuid().parse(id);
    z.number().int().min(0).parse(version);
    const payload = draftPayloadSchema.parse(raw);
    if (JSON.stringify(payload).length > 100000) throw new Error("invalid_input");
    const row = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      if (await tx.query.intakeSubmissions.findFirst({ where: eq(intakeSubmissions.id, id) })) throw new Error("draft_conflict");
      const current = await tx.query.intakeDrafts.findFirst({ where: eq(intakeDrafts.id, id) });
      if (current ? current.version !== version || current.status !== "draft" : version !== 0) throw new Error("draft_conflict");
      if (payload.assigneeId && !(await tx.query.staff.findFirst({ where: and(eq(staff.id, payload.assigneeId), eq(staff.active, true)) })))
        throw new Error("invalid_input");
      const values = { payload, assigneeId: payload.assigneeId || me.id, updatedBy: me.id, version: version + 1, updatedAt: new Date() };
      const [saved] = current
        ? await tx.update(intakeDrafts).set(values).where(eq(intakeDrafts.id, id)).returning()
        : await tx
            .insert(intakeDrafts)
            .values({ id, ...values })
            .returning();
      return { id: saved.id, version: saved.version, updatedAt: saved.updatedAt };
    });
    revalidateAll();
    return { ok: true as const, data: row };
  } catch (e) {
    return fail(e);
  }
}
export async function discardIntakeDraft(id: string, version: number) {
  try {
    await requireStaff();
    z.string().uuid().parse(id);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const rows = await tx
        .update(intakeDrafts)
        .set({ status: "discarded", version: sql`${intakeDrafts.version} + 1` })
        .where(and(eq(intakeDrafts.id, id), eq(intakeDrafts.version, version), eq(intakeDrafts.status, "draft")))
        .returning();
      if (!rows.length) throw new Error("draft_conflict");
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function listIntakeDrafts() {
  await requireStaff();
  return db
    .select({ id: intakeDrafts.id, version: intakeDrafts.version, payload: intakeDrafts.payload, updatedAt: intakeDrafts.updatedAt, assignee: staff.name })
    .from(intakeDrafts)
    .leftJoin(staff, eq(staff.id, intakeDrafts.assigneeId))
    .where(eq(intakeDrafts.status, "draft"))
    .orderBy(desc(intakeDrafts.updatedAt));
}
export async function getIntakeDraft(id: string) {
  await requireStaff();
  z.string().uuid().parse(id);
  return db.query.intakeDrafts.findFirst({ where: and(eq(intakeDrafts.id, id), eq(intakeDrafts.status, "draft")) });
}
