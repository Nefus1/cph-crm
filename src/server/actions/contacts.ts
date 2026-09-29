"use server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { contactInput, type ContactInput } from "@/server/schemas";
import { contactValues } from "@/server/contact-values";
import { fail, type ActionResult } from "@/server/types";
import { logActivity, revalidateAll } from "./_helpers";

export async function createContact(raw: ContactInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireStaff();
    const input = contactInput.parse(raw);
    if (!input.firstName && !input.lastName && !input.orgName) return { ok: false, error: "name_required" };
    const [row] = await db
      .insert(contacts)
      .values({ ...contactValues(input), createdBy: me.id })
      .returning({ id: contacts.id });
    revalidateAll();
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateContact(id: string, raw: ContactInput): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const input = contactInput.parse(raw);
    if (!input.firstName && !input.lastName && !input.orgName) return { ok: false, error: "name_required" };
    await db.update(contacts).set(contactValues(input)).where(eq(contacts.id, id));
    await logActivity(db, { contactId: id, type: "system", body: "Contact details updated", authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveContact(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await requireStaff();
    await db.update(contacts).set({ archivedAt: archived ? sql`now()` : null }).where(eq(contacts.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteContact(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const inUse = await db.execute<{ n: number }>(sql`select count(*)::int as n from matter_parties where contact_id = ${id}`);
    if (Number(inUse[0]?.n) > 0) return { ok: false, error: "contact_in_use" };
    await db.delete(contacts).where(and(eq(contacts.id, id)));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
