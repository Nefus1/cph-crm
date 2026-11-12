import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
const auth = vi.hoisted(() => ({ id: "70000000-0000-4000-8000-000000000001", role: "admin" }));
vi.mock("@/lib/auth", () => ({ requireStaff: async () => auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { db, resetDb } from "@/db";
import { staff, matters, contacts, matterParties, tasks, paperworkItems, activities } from "@/db/schema";
import { saveFollowUp, logContactAttempt, savePaperwork, saveProgress, savePaperworkTemplate, applyPaperworkTemplate } from "@/server/actions/office-workflows";
const matterId = randomUUID(),
  contactId = randomUUID();
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("office transactions", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/cph_test") throw Error("isolated database required");
    await db.insert(staff).values({ id: auth.id, email: "office-test@example.com", name: "Office test", role: "admin" }).onConflictDoNothing();
    await db
      .insert(matters)
      .values({ id: matterId, number: `TEST-${matterId}`, displayName: "Muñoz", practiceArea: "general", matterType: "other", side: "na", stage: "intake" });
    await db.insert(contacts).values({ id: contactId, displayName: "José Muñoz" });
    await db.insert(matterParties).values({ matterId, contactId, role: "client" });
  });
  afterAll(async () => {
    await resetDb();
  });
  it("deduplicates follow-ups and attempts while rejecting stale employee edits", async () => {
    const id = randomUUID(),
      mutation = randomUUID();
    const input = { matterId, contactId, title: "Documents", notes: "", assigneeId: auth.id, dueDate: "2026-11-11", channel: "gmail" as const, waiting: true };
    expect((await saveFollowUp(mutation, id, 0, input)).ok).toBe(true);
    expect((await saveFollowUp(mutation, id, 0, input)).ok).toBe(true);
    const results = await Promise.all([
      saveFollowUp(randomUUID(), id, 1, { ...input, title: "A" }),
      saveFollowUp(randomUUID(), id, 1, { ...input, title: "B" }),
    ]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(
      (
        await saveProgress(randomUUID(), matterId, 0, {
          nextActionId: id,
          blocker: "client",
          blockerNote: "Await documents",
          blockerReviewDate: "2026-11-12",
          pinnedNote: "Accented names preserved",
        })
      ).ok,
    ).toBe(true);
    const attempt = randomUUID();
    const raw = { taskId: id, version: 2, outcome: "resolved" as const, channel: "whatsapp" as const, notes: "Received", nextDate: null };
    expect((await logContactAttempt(attempt, raw)).ok).toBe(true);
    expect((await logContactAttempt(attempt, raw)).ok).toBe(true);
    expect((await db.query.matters.findFirst({ where: eq(matters.id, matterId) }))?.nextActionId).toBeNull();
    expect((await db.query.tasks.findFirst({ where: eq(tasks.id, id) }))?.completedAt).not.toBeNull();
    const logs = await db
      .select()
      .from(activities)
      .where(sql`${activities.matterId}=${matterId} and ${activities.messageKey}='contact_whatsapp_resolved'`);
    expect(logs).toHaveLength(1);
  });
  it("preserves paperwork through retries and rolls back invalid assignments", async () => {
    const id = randomUUID(),
      mutation = randomUUID();
    const input = {
      matterId,
      title: "Pleading",
      formNumber: "",
      revision: "",
      source: "docx" as const,
      fileUrl: "",
      preparerId: auth.id,
      reviewerId: auth.id,
      targetDate: null,
      missingInformation: "",
      status: "needed" as const,
    };
    expect((await savePaperwork(mutation, id, 0, input)).ok).toBe(true);
    expect((await savePaperwork(mutation, id, 0, input)).ok).toBe(true);
    expect((await savePaperwork(randomUUID(), id, 1, { ...input, reviewerId: randomUUID() })).ok).toBe(false);
    expect((await db.query.paperworkItems.findFirst({ where: eq(paperworkItems.id, id) }))?.version).toBe(1);
    expect((await savePaperwork(randomUUID(), id, 1, { ...input, status: "ready_for_review" })).ok).toBe(true);
    expect((await savePaperwork(randomUUID(), id, 1, input)).ok).toBe(false);
  });
  it("applies selected template items exactly once", async () => {
    const id = randomUUID(),
      mutation = randomUUID();
    expect(
      (
        await savePaperworkTemplate(randomUUID(), id, 0, {
          practiceArea: "general",
          title: "General",
          items: [
            { key: "a", en: "Letter", es: "Carta", formNumber: "" },
            { key: "b", en: "Pleading", es: "Escrito", formNumber: "" },
          ],
        })
      ).ok,
    ).toBe(true);
    expect((await applyPaperworkTemplate(mutation, matterId, id, 1, ["a"], "es")).ok).toBe(true);
    expect((await applyPaperworkTemplate(mutation, matterId, id, 1, ["a"], "es")).ok).toBe(true);
    const rows = await db
      .select()
      .from(paperworkItems)
      .where(sql`${paperworkItems.matterId}=${matterId} and ${paperworkItems.title}='Carta'`);
    expect(rows).toHaveLength(1);
  });
});
