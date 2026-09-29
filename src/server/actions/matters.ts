"use server";
import { after } from "next/server";
import { and, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { checklistItems, contacts, events, ledgerEntries, matterParties, matters } from "@/db/schema";
import { areaConfig, buildDisplayName, isFinalStage, optionLabel, PARTY_ROLES, stageLabel, stagesFor } from "@/config/practice-areas";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { ensureMatterFolder } from "@/lib/google/drive";
import { syncEvent } from "@/lib/google/calendar";
import { formatCents } from "@/lib/money";
import { contactInput, intakeInput, matterCoreInput, partyInput, type IntakeInput } from "@/server/schemas";
import { getSettings } from "@/server/queries/settings";
import { fail, type ActionResult } from "@/server/types";
import { contactValues } from "@/server/contact-values";
import { logActivity, nextMatterNumber, revalidateAll } from "./_helpers";

function cleanDetails(area: string, details: Record<string, string>) {
  const allowed = new Set(areaConfig(area).fields.map((f) => f.key));
  return Object.fromEntries(Object.entries(details).filter(([k, v]) => allowed.has(k) && v !== ""));
}

/** New Intake: contacts + matter + parties + checklist + ledger + timeline, in one transaction. */
export async function createIntake(raw: IntakeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireStaff();
    const input = intakeInput.parse(raw);
    const settings = await getSettings();
    const m = input.matter;
    const cfg = areaConfig(m.practiceArea);
    const side = cfg.sides.some((s) => s.value === m.side) ? m.side : cfg.sides[0].value;
    const stages = stagesFor(m.practiceArea, side);
    const stage = m.stage && stages.some((s) => s.key === m.stage) ? m.stage : stages[0].key;

    const matterId = await db.transaction(async (tx) => {
      // 1. Client
      let clientId = input.client.contactId;
      let clientName = "";
      if (clientId) {
        const c = await tx.query.contacts.findFirst({ where: eq(contacts.id, clientId) });
        if (!c) throw new Error("Client not found");
        clientName = c.displayName;
      } else {
        if (!input.client.contact) throw new Error("client_required");
        const cv = contactValues(contactInput.parse(input.client.contact));
        if (!cv.firstName && !cv.lastName && !cv.orgName) throw new Error("name_required");
        const [c] = await tx.insert(contacts).values({ ...cv, createdBy: me.id }).returning();
        clientId = c.id;
        clientName = c.displayName;
      }

      // 2. Matter
      const number = await nextMatterNumber(tx, m.openedOn);
      const [matter] = await tx
        .insert(matters)
        .values({
          number,
          displayName: buildDisplayName(clientName, m.practiceArea, m.matterType, side),
          caption: m.caption,
          practiceArea: m.practiceArea,
          matterType: m.matterType,
          side,
          stage,
          status: m.status,
          assigneeId: m.assigneeId ?? me.id,
          supervisingAttorney: m.supervisingAttorney || settings.defaultSupervisingAttorney,
          openedOn: m.openedOn ?? todayISO(),
          courthouse: m.courthouse,
          caseNumber: m.caseNumber,
          department: m.department,
          judge: m.judge,
          feeType: m.feeType,
          flatFeeCents: m.flatFeeCents,
          details: cleanDetails(m.practiceArea, m.details),
          summary: m.summary,
          driveStatus: input.createDriveFolder ? "pending" : "none",
          createdBy: me.id,
        })
        .returning();

      // 3. Parties
      await tx.insert(matterParties).values({ matterId: matter.id, contactId: clientId, role: "client", isPrimary: true });
      for (const p of input.otherParties) {
        let contactId = p.contactId;
        if (!contactId && p.contact) {
          const cv = contactValues(contactInput.parse(p.contact));
          if (!cv.firstName && !cv.lastName && !cv.orgName) continue;
          const [c] = await tx.insert(contacts).values({ ...cv, createdBy: me.id }).returning({ id: contacts.id });
          contactId = c.id;
        }
        if (contactId) await tx.insert(matterParties).values({ matterId: matter.id, contactId, role: p.role }).onConflictDoNothing();
      }

      // 4. Checklist from the practice-area template
      if (cfg.checklist.length) {
        await tx.insert(checklistItems).values(cfg.checklist.map((l, i) => ({ matterId: matter.id, label: l.en, labelEs: l.es, position: i })));
      }

      // 5. Fees
      if (m.feeType === "flat" && m.flatFeeCents > 0) {
        await tx.insert(ledgerEntries).values({ matterId: matter.id, kind: "charge", description: "Flat fee", amountCents: m.flatFeeCents, entryDate: matter.openedOn, createdBy: me.id });
      }
      if (input.initialPaymentCents > 0) {
        await tx.insert(ledgerEntries).values({
          matterId: matter.id,
          kind: "payment",
          description: "Initial payment",
          amountCents: input.initialPaymentCents,
          entryDate: todayISO(),
          method: input.paymentMethod,
          createdBy: me.id,
        });
      }

      // 6. Timeline
      await logActivity(tx, { matterId: matter.id, type: "system", body: `Matter opened (${number})`, authorId: me.id });
      if (input.note) await logActivity(tx, { matterId: matter.id, type: "note", body: input.note, authorId: me.id });
      if (input.initialPaymentCents > 0) {
        await logActivity(tx, { matterId: matter.id, type: "payment", body: `Payment received: ${formatCents(input.initialPaymentCents)}${input.paymentMethod ? ` (${input.paymentMethod})` : ""}`, authorId: me.id });
      }
      return matter.id;
    });

    if (input.createDriveFolder) after(() => ensureMatterFolder(matterId));
    revalidateAll();
    return { ok: true, data: { id: matterId } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMatter(id: string, raw: z.input<typeof matterCoreInput>): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const m = matterCoreInput.parse(raw);
    const current = await db.query.matters.findFirst({ where: eq(matters.id, id) });
    if (!current) return { ok: false, error: "not_found" };
    const cfg = areaConfig(m.practiceArea);
    const side = cfg.sides.some((s) => s.value === m.side) ? m.side : cfg.sides[0].value;
    const stages = stagesFor(m.practiceArea, side);
    const stage = stages.some((s) => s.key === (m.stage ?? current.stage)) ? (m.stage ?? current.stage) : stages[0].key;

    // Keep the display name in sync with the primary client + type + side
    const client = await db
      .select({ name: contacts.displayName })
      .from(matterParties)
      .innerJoin(contacts, eq(contacts.id, matterParties.contactId))
      .where(and(eq(matterParties.matterId, id), eq(matterParties.role, "client")))
      .orderBy(sql`${matterParties.isPrimary} desc`)
      .limit(1);
    const displayName = buildDisplayName(client[0]?.name ?? current.displayName.split(" — ")[0], m.practiceArea, m.matterType, side);

    await db
      .update(matters)
      .set({
        displayName,
        caption: m.caption,
        practiceArea: m.practiceArea,
        matterType: m.matterType,
        side,
        stage,
        status: m.status,
        assigneeId: m.assigneeId,
        supervisingAttorney: m.supervisingAttorney,
        openedOn: m.openedOn ?? current.openedOn,
        courthouse: m.courthouse,
        caseNumber: m.caseNumber,
        department: m.department,
        judge: m.judge,
        feeType: m.feeType,
        flatFeeCents: m.flatFeeCents,
        details: cleanDetails(m.practiceArea, m.details),
        summary: m.summary,
        closedOn: m.status === "closed" ? (current.closedOn ?? todayISO()) : null,
      })
      .where(eq(matters.id, id));

    const changes: string[] = [];
    if (current.caseNumber !== m.caseNumber && m.caseNumber) changes.push(`Case number set to ${m.caseNumber}`);
    if (current.status !== m.status) changes.push(`Status: ${current.status} → ${m.status}`);
    if (current.stage !== stage) changes.push(`Stage: ${stageLabel(current.practiceArea, current.side, current.stage, "en")} → ${stageLabel(m.practiceArea, side, stage, "en")}`);
    await logActivity(db, { matterId: id, type: current.stage !== stage ? "stage_change" : "system", body: changes.length ? changes.join(" · ") : "Matter details updated", authorId: me.id });

    // Calendar titles include the case number / name — resync if those changed
    if (current.caseNumber !== m.caseNumber || current.displayName !== displayName) {
      const evs = await db.select({ id: events.id }).from(events).where(eq(events.matterId, id));
      if (evs.length) {
        await db.update(events).set({ syncStatus: "pending" }).where(eq(events.matterId, id));
        after(async () => {
          for (const e of evs) await syncEvent(e.id);
        });
      }
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setMatterStage(id: string, stage: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const current = await db.query.matters.findFirst({ where: eq(matters.id, id) });
    if (!current) return { ok: false, error: "not_found" };
    const stages = stagesFor(current.practiceArea, current.side);
    if (!stages.some((s) => s.key === stage)) return { ok: false, error: "invalid_stage" };
    if (current.stage === stage) return { ok: true };
    const final = isFinalStage(current.practiceArea, current.side, stage);
    const status = final ? "closed" : current.status === "closed" ? "active" : current.status === "intake" && stage !== stages[0].key ? "active" : current.status;
    await db
      .update(matters)
      .set({ stage, status, closedOn: status === "closed" ? todayISO() : null })
      .where(eq(matters.id, id));
    await logActivity(db, {
      matterId: id,
      type: "stage_change",
      body: `Stage: ${stageLabel(current.practiceArea, current.side, current.stage, "en")} → ${stageLabel(current.practiceArea, current.side, stage, "en")}`,
      authorId: me.id,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setMatterStatus(id: string, status: "intake" | "active" | "closed"): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const current = await db.query.matters.findFirst({ where: eq(matters.id, id) });
    if (!current) return { ok: false, error: "not_found" };
    await db
      .update(matters)
      .set({ status, closedOn: status === "closed" ? todayISO() : null })
      .where(eq(matters.id, id));
    await logActivity(db, { matterId: id, type: "system", body: `Status: ${current.status} → ${status}`, authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setMatterAssignee(id: string, assigneeId: string | null): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    await db.update(matters).set({ assigneeId }).where(eq(matters.id, id));
    await logActivity(db, { matterId: id, type: "system", body: assigneeId ? "Assignee changed" : "Assignee removed", authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveMatter(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    await db.update(matters).set({ archivedAt: archived ? sql`now()` : null }).where(eq(matters.id, id));
    await logActivity(db, { matterId: id, type: "system", body: archived ? "Matter archived" : "Matter restored", authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Admin-only hard delete. Calendar events are removed from Google first. */
export async function deleteMatter(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const evs = await db.select({ id: events.id }).from(events).where(eq(events.matterId, id));
    await db.update(events).set({ deletedAt: sql`now()` }).where(eq(events.matterId, id));
    for (const e of evs) await syncEvent(e.id);
    await db.delete(matters).where(eq(matters.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addMatterParty(matterId: string, raw: z.input<typeof partyInput>): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const p = partyInput.parse(raw);
    let contactId = p.contactId;
    if (!contactId && p.contact) {
      const cv = contactValues(contactInput.parse(p.contact));
      if (!cv.firstName && !cv.lastName && !cv.orgName) return { ok: false, error: "name_required" };
      const [c] = await db.insert(contacts).values({ ...cv, createdBy: me.id }).returning({ id: contacts.id });
      contactId = c.id;
    }
    if (!contactId) return { ok: false, error: "name_required" };
    await db.insert(matterParties).values({ matterId, contactId, role: p.role }).onConflictDoNothing();
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    await logActivity(db, { matterId, type: "system", body: `Added ${c?.displayName ?? "contact"} as ${optionLabel(PARTY_ROLES, p.role, "en")}`, authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMatterParty(partyId: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const party = await db.query.matterParties.findFirst({ where: eq(matterParties.id, partyId) });
    if (!party) return { ok: true };
    if (party.role === "client") {
      const clients = await db.execute<{ n: number }>(sql`select count(*)::int as n from matter_parties where matter_id = ${party.matterId} and role = 'client'`);
      if (Number(clients[0]?.n) <= 1) return { ok: false, error: "last_client" };
    }
    await db.delete(matterParties).where(eq(matterParties.id, partyId));
    await logActivity(db, { matterId: party.matterId, type: "system", body: `Removed a ${optionLabel(PARTY_ROLES, party.role, "en").toLowerCase()} from the matter`, authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function retryDriveFolder(matterId: string): Promise<ActionResult> {
  try {
    await requireStaff();
    const res = await ensureMatterFolder(matterId);
    revalidateAll();
    return res.ok ? { ok: true } : { ok: false, error: res.error ?? "drive_error" };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    await db
      .update(checklistItems)
      .set(done ? { doneAt: sql`now()`, doneBy: me.id } : { doneAt: null, doneBy: null })
      .where(eq(checklistItems.id, itemId));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addChecklistItem(matterId: string, label: string): Promise<ActionResult> {
  try {
    await requireStaff();
    const text = label.trim().slice(0, 300);
    if (!text) return { ok: false, error: "required" };
    const [row] = await db.select({ pos: max(checklistItems.position) }).from(checklistItems).where(eq(checklistItems.matterId, matterId));
    await db.insert(checklistItems).values({ matterId, label: text, labelEs: text, position: (row?.pos ?? -1) + 1 });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  try {
    await requireStaff();
    await db.delete(checklistItems).where(eq(checklistItems.id, itemId));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
