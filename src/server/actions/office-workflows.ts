"use server";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  activities,
  matters,
  paperworkItems,
  staff,
  workflowMutations,
  tasks,
  contacts,
  matterParties,
  documentRequests,
  paperworkTemplates,
} from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { paperworkInput, followUpInput, contactAttemptInput, progressInput, requestInput, templateInput } from "@/lib/office-workflows";
import { fail } from "@/server/types";
import { revalidateAll } from "./_helpers";

/** Stable mutation IDs survive transport failures; versions prevent lost updates. */
export async function savePaperwork(mutationId: string, itemId: string, version: number, raw: z.input<typeof paperworkInput>) {
  try {
    const me = await requireStaff();
    z.string().uuid().parse(mutationId);
    z.string().uuid().parse(itemId);
    z.number().int().nonnegative().parse(version);
    const input = paperworkInput.parse(raw);
    const fingerprint = createHash("sha256").update(JSON.stringify({ itemId, version, input })).digest("hex");
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${mutationId}, 0))`);
      const receipt = await tx.query.workflowMutations.findFirst({ where: eq(workflowMutations.id, mutationId) });
      if (receipt) {
        if (receipt.actorId !== me.id || receipt.fingerprint !== fingerprint) throw new Error("invalid_input");
        return;
      }
      const matter = await tx.query.matters.findFirst({ where: and(eq(matters.id, input.matterId), isNull(matters.archivedAt)) });
      if (!matter || matter.status === "closed") throw new Error("invalid_input");
      for (const id of [input.preparerId, input.reviewerId]) {
        if (id && !(await tx.query.staff.findFirst({ where: and(eq(staff.id, id), eq(staff.active, true)) }))) throw new Error("invalid_input");
      }
      const values = { ...input, version: version + 1, updatedBy: me.id, updatedAt: new Date() };
      if (version === 0) {
        const inserted = await tx
          .insert(paperworkItems)
          .values({ id: itemId, ...values })
          .onConflictDoNothing()
          .returning({ id: paperworkItems.id });
        if (!inserted.length) throw new Error("workflow_conflict");
      } else {
        const updated = await tx
          .update(paperworkItems)
          .set(values)
          .where(and(eq(paperworkItems.id, itemId), eq(paperworkItems.matterId, input.matterId), eq(paperworkItems.version, version)))
          .returning({ id: paperworkItems.id });
        if (!updated.length) throw new Error("workflow_conflict");
      }
      await tx
        .insert(activities)
        .values({ matterId: input.matterId, authorId: me.id, type: "system", body: "", messageKey: `paperwork_${input.status}`, messageValues: { title: input.title } });
      await tx.insert(workflowMutations).values({ id: mutationId, actorId: me.id, fingerprint });
    });
    revalidateAll();
    return { ok: true as const, data: { id: itemId, version: version + 1 } };
  } catch (error) {
    return fail(error);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function mutate(mutationId: string, payload: unknown, operation: (tx: Tx, actor: string) => Promise<void>) {
  try {
    const me = await requireStaff();
    z.string().uuid().parse(mutationId);
    const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${mutationId}, 0))`);
      const receipt = await tx.query.workflowMutations.findFirst({ where: eq(workflowMutations.id, mutationId) });
      if (receipt) {
        if (receipt.actorId !== me.id || receipt.fingerprint !== fingerprint) throw new Error("invalid_input");
        return;
      }
      await operation(tx, me.id);
      await tx.insert(workflowMutations).values({ id: mutationId, actorId: me.id, fingerprint });
    });
    revalidateAll();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
async function activeMatter(tx: Tx, id: string) {
  const row = await tx.query.matters.findFirst({ where: and(eq(matters.id, id), isNull(matters.archivedAt)) });
  if (!row || row.status === "closed") throw new Error("invalid_input");
  return row;
}
async function activeStaff(tx: Tx, id: string) {
  if (!(await tx.query.staff.findFirst({ where: and(eq(staff.id, id), eq(staff.active, true)) }))) throw new Error("invalid_input");
}
async function history(tx: Tx, actor: string, matterId: string, key: string, title: string) {
  await tx.insert(activities).values({ matterId, authorId: actor, type: "system", body: "", messageKey: key, messageValues: { title } });
}
export async function saveFollowUp(mutationId: string, id: string, version: number, raw: z.input<typeof followUpInput>) {
  return mutate(mutationId, { action: "followup", id, version, raw }, async (tx, actor) => {
    z.string().uuid().parse(id);
    z.number().int().nonnegative().parse(version);
    const input = followUpInput.parse(raw);
    await activeMatter(tx, input.matterId);
    await activeStaff(tx, input.assigneeId);
    if (!(await tx.query.matterParties.findFirst({ where: and(eq(matterParties.matterId, input.matterId), eq(matterParties.contactId, input.contactId)) })))
      throw new Error("invalid_input");
    if (!(await tx.query.contacts.findFirst({ where: and(eq(contacts.id, input.contactId), isNull(contacts.archivedAt)) }))) throw new Error("invalid_input");
    const values = { ...input, category: "follow_up", version: version + 1 };
    const rows =
      version === 0
        ? await tx
            .insert(tasks)
            .values({ id, ...values, createdBy: actor })
            .onConflictDoNothing()
            .returning()
        : await tx
            .update(tasks)
            .set(values)
            .where(
              and(eq(tasks.id, id), eq(tasks.version, version), eq(tasks.category, "follow_up"), isNull(tasks.completedAt), eq(tasks.matterId, input.matterId)),
            )
            .returning();
    if (!rows.length) throw new Error("workflow_conflict");
    await history(tx, actor, input.matterId, "followUpUpdated", input.title);
  });
}
export async function logContactAttempt(mutationId: string, raw: z.input<typeof contactAttemptInput>) {
  return mutate(mutationId, { action: "attempt", raw }, async (tx, actor) => {
    const input = contactAttemptInput.parse(raw);
    const task = await tx.query.tasks.findFirst({ where: eq(tasks.id, input.taskId) });
    if (!task?.matterId || task.category !== "follow_up") throw new Error("invalid_input");
    await activeMatter(tx, task.matterId);
    const resolved = input.outcome === "resolved";
    const rows = await tx
      .update(tasks)
      .set({
        dueDate: resolved ? task.dueDate : input.nextDate,
        channel: input.channel,
        completedAt: resolved ? new Date() : null,
        completedBy: resolved ? actor : null,
        waiting: !resolved,
        version: input.version + 1,
      })
      .where(and(eq(tasks.id, input.taskId), eq(tasks.version, input.version), isNull(tasks.completedAt)))
      .returning();
    if (!rows.length) throw new Error("workflow_conflict");
    await tx.insert(activities).values({
      matterId: task.matterId,
      contactId: task.contactId,
      authorId: actor,
      type: "system",
      body: "",
      messageKey: `contact_${input.channel}_${input.outcome}`,
      messageValues: { title: task.title },
    });
    if (input.notes.trim())
      await tx.insert(activities).values({ matterId: task.matterId, contactId: task.contactId, authorId: actor, type: "note", body: input.notes });
    if (resolved)
      await tx
        .update(matters)
        .set({ nextActionId: null, workflowVersion: sql`${matters.workflowVersion} + 1` })
        .where(and(eq(matters.id, task.matterId), eq(matters.nextActionId, task.id)));
  });
}
export async function saveProgress(mutationId: string, id: string, version: number, raw: z.input<typeof progressInput>) {
  return mutate(mutationId, { action: "progress", id, version, raw }, async (tx, actor) => {
    z.string().uuid().parse(id);
    z.number().int().nonnegative().parse(version);
    const input = progressInput.parse(raw);
    await activeMatter(tx, id);
    if (
      input.nextActionId &&
      !(await tx.query.tasks.findFirst({ where: and(eq(tasks.id, input.nextActionId), eq(tasks.matterId, id), isNull(tasks.completedAt)) }))
    )
      throw new Error("invalid_input");
    const rows = await tx
      .update(matters)
      .set({ ...input, workflowVersion: version + 1, updatedAt: new Date() })
      .where(and(eq(matters.id, id), eq(matters.workflowVersion, version)))
      .returning();
    if (!rows.length) throw new Error("workflow_conflict");
    await history(tx, actor, id, "progressUpdated", "");
  });
}
export async function saveDocumentRequest(mutationId: string, id: string, version: number, raw: z.input<typeof requestInput>) {
  return mutate(mutationId, { action: "request", id, version, raw }, async (tx, actor) => {
    z.string().uuid().parse(id);
    z.number().int().nonnegative().parse(version);
    const input = requestInput.parse(raw);
    await activeMatter(tx, input.matterId);
    if (
      input.followUpTaskId &&
      !(await tx.query.tasks.findFirst({ where: and(eq(tasks.id, input.followUpTaskId), eq(tasks.matterId, input.matterId), eq(tasks.category, "follow_up")) }))
    )
      throw new Error("invalid_input");
    const values = { ...input, version: version + 1, updatedBy: actor, updatedAt: new Date() };
    const rows =
      version === 0
        ? await tx
            .insert(documentRequests)
            .values({ id, ...values })
            .onConflictDoNothing()
            .returning()
        : await tx
            .update(documentRequests)
            .set(values)
            .where(and(eq(documentRequests.id, id), eq(documentRequests.matterId, input.matterId), eq(documentRequests.version, version)))
            .returning();
    if (!rows.length) throw new Error("workflow_conflict");
    await history(tx, actor, input.matterId, `request_${input.status}`, input.title);
  });
}
export async function savePaperworkTemplate(mutationId: string, id: string, version: number, raw: z.input<typeof templateInput>) {
  return mutate(mutationId, { action: "template", id, version, raw }, async (tx, actor) => {
    if ((await tx.query.staff.findFirst({ where: eq(staff.id, actor) }))?.role !== "admin") throw new Error("invalid_input");
    z.string().uuid().parse(id);
    z.number().int().nonnegative().parse(version);
    const input = templateInput.parse(raw);
    const values = { ...input, version: version + 1, updatedAt: new Date() };
    const rows =
      version === 0
        ? await tx
            .insert(paperworkTemplates)
            .values({ id, ...values })
            .onConflictDoNothing()
            .returning()
        : await tx
            .update(paperworkTemplates)
            .set(values)
            .where(and(eq(paperworkTemplates.id, id), eq(paperworkTemplates.version, version)))
            .returning();
    if (!rows.length) throw new Error("workflow_conflict");
  });
}
export async function applyPaperworkTemplate(mutationId: string, matterId: string, templateId: string, version: number, keys: string[], locale: "en" | "es") {
  return mutate(mutationId, { action: "apply", matterId, templateId, version, keys, locale }, async (tx, actor) => {
    z.string().uuid().parse(matterId);
    z.string().uuid().parse(templateId);
    z.enum(["en", "es"]).parse(locale);
    z.array(z.string()).min(1).max(100).parse(keys);
    const matter = await activeMatter(tx, matterId);
    const template = await tx.query.paperworkTemplates.findFirst({ where: eq(paperworkTemplates.id, templateId) });
    if (
      !template ||
      template.version !== version ||
      template.practiceArea !== matter.practiceArea ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !template.items.some((i) => i.key === key))
    )
      throw new Error("workflow_conflict");
    for (const item of template.items.filter((i) => keys.includes(i.key)))
      await tx.insert(paperworkItems).values({ matterId, title: item[locale], formNumber: item.formNumber, preparerId: matter.assigneeId, updatedBy: actor });
    await history(tx, actor, matterId, "templateApplied", template.title);
  });
}
