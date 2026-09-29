import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, checklistItems, contacts, events, ledgerEntries, matterParties, matters, type Contact } from "@/db/schema";
import { areaConfig, buildDisplayName, stagesFor } from "@/config/practice-areas";
import { todayISO } from "@/lib/dates";
import { contactDisplayName } from "@/lib/names";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { driveApi, getAuthedClient, sheetsApi } from "@/lib/google/client";
import { listGoogleEvents } from "@/lib/google/calendar";
import { nextMatterNumber } from "@/server/actions/_helpers";
import { guessMatter, mapSheetRow, parseCaseFolderName, parseIntakeDoc, rowsFromSheet, statusFromText, type MappedIntake } from "./mapping";

export function extractSpreadsheetId(input: string) {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

async function requireGoogle() {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected. Connect it in Settings → Google first.");
  return authed;
}

/* ─── Contact matching (dedupe) ─────────────────────────────────────────── */

type ContactLite = Pick<Contact, "id" | "displayName" | "phoneDigits" | "phoneAltDigits" | "email">;

function normName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

class ContactIndex {
  private byPhone = new Map<string, ContactLite>();
  private byEmail = new Map<string, ContactLite>();
  private byName = new Map<string, ContactLite>();
  constructor(rows: ContactLite[]) {
    rows.forEach((r) => this.add(r));
  }
  add(r: ContactLite) {
    if (r.phoneDigits.length >= 7) this.byPhone.set(r.phoneDigits, r);
    if (r.phoneAltDigits.length >= 7) this.byPhone.set(r.phoneAltDigits, r);
    if (r.email) this.byEmail.set(r.email.toLowerCase(), r);
    this.byName.set(normName(r.displayName), r);
  }
  find(c: { phone: string; phoneAlt?: string; email: string; displayName: string }): { contact: ContactLite; by: "phone" | "email" | "name" } | null {
    const p = phoneDigits(c.phone);
    if (p.length >= 7 && this.byPhone.has(p)) return { contact: this.byPhone.get(p)!, by: "phone" };
    const p2 = phoneDigits(c.phoneAlt ?? "");
    if (p2.length >= 7 && this.byPhone.has(p2)) return { contact: this.byPhone.get(p2)!, by: "phone" };
    if (c.email && this.byEmail.has(c.email)) return { contact: this.byEmail.get(c.email)!, by: "email" };
    const n = normName(c.displayName);
    if (n && this.byName.has(n)) return { contact: this.byName.get(n)!, by: "name" };
    return null;
  }
}

async function contactIndex() {
  const rows = await db.select({ id: contacts.id, displayName: contacts.displayName, phoneDigits: contacts.phoneDigits, phoneAltDigits: contacts.phoneAltDigits, email: contacts.email }).from(contacts);
  return new ContactIndex(rows);
}

/* ─── Intake sheet ──────────────────────────────────────────────────────── */

export interface SheetPreviewRow extends MappedIntake {
  status: "new" | "matched" | "already_imported";
  matchedContact?: string;
  matchedBy?: string;
  importStatus: "active" | "closed" | "intake";
}

async function readSheet(spreadsheetId: string) {
  const { client } = await requireGoogle();
  const sheets = sheetsApi(client);
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties.title" });
  const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${firstSheet.replace(/'/g, "''")}'`, valueRenderOption: "FORMATTED_VALUE" });
  return { title: meta.data.properties?.title ?? spreadsheetId, rows: rowsFromSheet((res.data.values ?? []) as string[][]) };
}

export async function previewSheet(spreadsheetInput: string, policy: "age" | "active" | "closed") {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
  const { title, rows } = await readSheet(spreadsheetId);
  const index = await contactIndex();
  const imported = new Set(
    (await db.select({ s: matters.importSource }).from(matters).where(sql`${matters.importSource} like ${`sheet:${spreadsheetId}:%`}`)).map((r) => r.s!.slice(`sheet:${spreadsheetId}:`.length)),
  );
  const today = todayISO();
  const seenInBatch = new Map<string, string>();
  const out: SheetPreviewRow[] = rows.map((r) => {
    const m = mapSheetRow(r);
    const importStatus = statusFromText(m.statusText, m.openedOn, policy, today);
    if (imported.has(m.key)) return { ...m, status: "already_imported", importStatus };
    const hit = index.find({ ...m.contact, displayName: m.displayName });
    if (hit) return { ...m, status: "matched", matchedContact: hit.contact.displayName, matchedBy: hit.by, importStatus };
    const batchKey = phoneDigits(m.contact.phone) || m.contact.email || normName(m.displayName);
    if (seenInBatch.has(batchKey)) return { ...m, status: "matched", matchedContact: seenInBatch.get(batchKey), matchedBy: "same_sheet", importStatus };
    seenInBatch.set(batchKey, m.displayName);
    return { ...m, status: "new", importStatus };
  });
  return { spreadsheetId, title, rows: out };
}

export async function commitSheet(spreadsheetInput: string, policy: "age" | "active" | "closed", keys: string[], authorId: string) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
  const preview = await previewSheet(spreadsheetId, policy);
  const wanted = new Set(keys);
  const rows = preview.rows.filter((r) => wanted.has(r.key) && r.status !== "already_imported");
  const index = await contactIndex();
  let createdContacts = 0;
  let createdMatters = 0;

  for (const r of rows) {
    await db.transaction(async (tx) => {
      let contactId: string;
      const hit = index.find({ ...r.contact, displayName: r.displayName });
      if (hit) contactId = hit.contact.id;
      else {
        const phone = formatPhone(r.contact.phone);
        const phoneAlt = formatPhone(r.contact.phoneAlt);
        const [c] = await tx
          .insert(contacts)
          .values({
            ...r.contact,
            phone,
            phoneAlt,
            phoneDigits: phoneDigits(phone),
            phoneAltDigits: phoneDigits(phoneAlt),
            displayName: contactDisplayName(r.contact),
            preferredLanguage: "es",
            importSource: `sheet:${spreadsheetId}`,
            createdBy: authorId,
          })
          .returning();
        contactId = c.id;
        index.add(c);
        createdContacts++;
      }
      const clientName = contactDisplayName(r.contact);
      const cfg = areaConfig(r.matter.area);
      const stages = stagesFor(r.matter.area, r.matter.side);
      const stage = r.importStatus === "closed" ? stages[stages.length - 1].key : stages[0].key;
      const openedOn = r.openedOn ?? todayISO();
      const [m] = await tx
        .insert(matters)
        .values({
          number: await nextMatterNumber(tx, openedOn),
          displayName: buildDisplayName(hit ? hit.contact.displayName : clientName, r.matter.area, r.matter.type, r.matter.side),
          practiceArea: r.matter.area,
          matterType: r.matter.type,
          side: cfg.sides.some((s) => s.value === r.matter.side) ? r.matter.side : cfg.sides[0].value,
          stage,
          status: r.importStatus,
          openedOn,
          closedOn: r.importStatus === "closed" ? openedOn : null,
          feeType: r.feeCents ? "flat" : "none",
          flatFeeCents: r.feeCents,
          details: r.details,
          summary: r.matterText && r.matter.type === "other" ? `Original matter: ${r.matterText}` : "",
          importSource: `sheet:${spreadsheetId}:${r.key}`,
          createdBy: authorId,
        })
        .returning();
      await tx.insert(matterParties).values({ matterId: m.id, contactId, role: "client", isPrimary: true });
      if (r.importStatus !== "closed" && cfg.checklist.length) {
        await tx.insert(checklistItems).values(cfg.checklist.map((l, i) => ({ matterId: m.id, label: l.en, labelEs: l.es, position: i })));
      }
      if (r.feeCents) await tx.insert(ledgerEntries).values({ matterId: m.id, kind: "charge", description: "Flat fee (imported)", amountCents: r.feeCents, entryDate: openedOn, createdBy: authorId });
      if (r.paymentCents) await tx.insert(ledgerEntries).values({ matterId: m.id, kind: "payment", description: "Payment (imported)", amountCents: r.paymentCents, entryDate: openedOn, createdBy: authorId });
      await tx.insert(activities).values({ matterId: m.id, type: "system", body: `Imported from intake sheet "${preview.title}"`, authorId, occurredAt: new Date(`${openedOn}T12:00:00Z`) });
      if (r.notes) await tx.insert(activities).values({ matterId: m.id, type: "note", body: r.notes, authorId, occurredAt: new Date(`${openedOn}T12:00:01Z`) });
      createdMatters++;
    });
  }
  return { createdContacts, createdMatters };
}

/* ─── Drive Cases folders ───────────────────────────────────────────────── */

export interface FolderPreviewRow {
  folderId: string;
  folderName: string;
  url: string;
  parsed: boolean;
  status: "new" | "link_existing" | "already_linked" | "unparsed";
  displayName: string;
  area: string;
  type: string;
  side: string;
  matchedMatter?: string;
  matchedContact?: string;
}

export async function previewDriveCases() {
  const { client, settings } = await requireGoogle();
  if (!settings.casesFolderId) throw new Error("Choose the Cases folder in Settings → Google first.");
  const drive = driveApi(client);
  const folders: { id: string; name: string; webViewLink?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${settings.casesFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name, webViewLink)",
      pageSize: 200,
      pageToken,
      orderBy: "name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    folders.push(...(res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name!, webViewLink: f.webViewLink })));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  const linked = new Map(
    (await db.select({ id: matters.id, folder: matters.driveFolderId, name: matters.displayName }).from(matters).where(isNotNull(matters.driveFolderId))).map((r) => [r.folder!, r.name]),
  );
  const byName = new Map((await db.select({ id: matters.id, name: matters.displayName, folder: matters.driveFolderId }).from(matters)).map((r) => [normName(r.name), r]));
  const index = await contactIndex();

  return folders.map<FolderPreviewRow>((f) => {
    const url = f.webViewLink ?? `https://drive.google.com/drive/folders/${f.id}`;
    const p = parseCaseFolderName(f.name);
    if (linked.has(f.id)) return { folderId: f.id, folderName: f.name, url, parsed: !!p, status: "already_linked", displayName: f.name, area: "", type: "", side: "", matchedMatter: linked.get(f.id) };
    if (!p) return { folderId: f.id, folderName: f.name, url, parsed: false, status: "unparsed", displayName: f.name, area: "general", type: "other", side: "na" };
    const g = guessMatter(p.typeText, p.sideText);
    const clientName = contactDisplayName({ firstName: p.firstName, lastName: p.lastName });
    const displayName = buildDisplayName(clientName, g.area, g.type, g.side);
    const existing = byName.get(normName(f.name)) ?? byName.get(normName(displayName));
    if (existing && !existing.folder) return { folderId: f.id, folderName: f.name, url, parsed: true, status: "link_existing", displayName, area: g.area, type: g.type, side: g.side, matchedMatter: existing.name };
    const hit = index.find({ phone: "", email: "", displayName: clientName });
    return { folderId: f.id, folderName: f.name, url, parsed: true, status: "new", displayName, area: g.area, type: g.type, side: g.side, matchedContact: hit?.contact.displayName };
  });
}

async function readIntakeDoc(folderId: string) {
  const { client } = await requireGoogle();
  const drive = driveApi(client);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'Intake' and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const doc = res.data.files?.find((f) => /^00\s*intake/i.test(f.name ?? "")) ?? res.data.files?.[0];
  if (!doc?.id) return {};
  const text = await drive.files.export({ fileId: doc.id, mimeType: "text/plain" }, { responseType: "text" });
  return parseIntakeDoc(String(text.data ?? ""));
}

export async function commitDriveCases(folderIds: string[], authorId: string) {
  const preview = await previewDriveCases();
  const wanted = new Set(folderIds);
  const rows = preview.filter((r) => wanted.has(r.folderId) && (r.status === "new" || r.status === "link_existing"));
  const index = await contactIndex();
  const byName = new Map((await db.select({ id: matters.id, name: matters.displayName }).from(matters)).map((r) => [normName(r.name), r.id]));
  let linkedCount = 0;
  let createdMatters = 0;

  for (const r of rows) {
    const extra = await readIntakeDoc(r.folderId).catch(() => ({}) as ReturnType<typeof parseIntakeDoc>);
    if (r.status === "link_existing") {
      const id = byName.get(normName(r.folderName)) ?? byName.get(normName(r.displayName));
      if (id) {
        await db.update(matters).set({ driveFolderId: r.folderId, driveFolderUrl: r.url, driveStatus: "ok", driveError: null }).where(eq(matters.id, id));
        linkedCount++;
      }
      continue;
    }
    const p = parseCaseFolderName(r.folderName)!;
    await db.transaction(async (tx) => {
      const clientName = contactDisplayName({ firstName: p.firstName, lastName: p.lastName });
      const hit = index.find({ phone: "", email: "", displayName: clientName });
      let contactId = hit?.contact.id;
      if (!contactId) {
        const [c] = await tx.insert(contacts).values({ firstName: p.firstName, lastName: p.lastName, displayName: clientName, importSource: "drive", createdBy: authorId }).returning();
        contactId = c.id;
        index.add(c);
      }
      const stages = stagesFor(r.area, r.side);
      const cfg = areaConfig(r.area);
      const [m] = await tx
        .insert(matters)
        .values({
          number: await nextMatterNumber(tx),
          displayName: r.folderName,
          caption: extra.caption ?? "",
          caseNumber: extra.caseNumber ?? "",
          courthouse: extra.courthouse ?? "",
          practiceArea: r.area,
          matterType: r.type,
          side: r.side,
          stage: stages[0].key,
          status: "active",
          driveFolderId: r.folderId,
          driveFolderUrl: r.url,
          driveStatus: "ok",
          importSource: `drive:${r.folderId}`,
          createdBy: authorId,
        })
        .returning();
      await tx.insert(matterParties).values({ matterId: m.id, contactId, role: "client", isPrimary: true });
      if (cfg.checklist.length) await tx.insert(checklistItems).values(cfg.checklist.map((l, i) => ({ matterId: m.id, label: l.en, labelEs: l.es, position: i })));
      await tx.insert(activities).values({ matterId: m.id, type: "system", body: `Imported from Drive folder "${r.folderName}"`, authorId });
      createdMatters++;
    });
  }
  return { linkedCount, createdMatters };
}

/* ─── Existing Google Calendar events ───────────────────────────────────── */

export interface CalendarPreviewRow {
  id: string;
  summary: string;
  date: string;
  time: string | null;
  location: string;
  description: string;
  linked: boolean;
  suggestedMatterId: string | null;
  suggestedKind: "hearing" | "deadline" | "appointment";
}

export async function previewCalendar() {
  const list = await listGoogleEvents(todayISO(), 250);
  const linkedIds = new Set(
    (await db.select({ g: events.gcalEventId }).from(events).where(and(isNotNull(events.gcalEventId), inArray(events.gcalEventId, list.map((e) => e.id).concat(["-"]))))).map((r) => r.g),
  );
  const ms = await db.select({ id: matters.id, name: matters.displayName, caseNumber: matters.caseNumber }).from(matters).where(sql`${matters.status} <> 'closed'`);
  return list.map<CalendarPreviewRow>((e) => {
    const hay = `${e.summary} ${e.description}`.toLowerCase();
    const byCase = ms.find((m) => m.caseNumber && hay.includes(m.caseNumber.toLowerCase()));
    const byName = ms.find((m) => {
      const last = m.name.split(",")[0].trim().toLowerCase();
      return last.length >= 3 && hay.includes(last);
    });
    const kind: CalendarPreviewRow["suggestedKind"] = /hearing|trial|rfo|osc|audiencia|juicio|msc|dept/i.test(hay) ? "hearing" : /due|deadline|expire|serve|file|vence/i.test(hay) ? "deadline" : "appointment";
    return {
      id: e.id,
      summary: e.summary,
      date: e.date,
      time: e.time,
      location: e.location,
      description: e.description,
      linked: linkedIds.has(e.id) || !!e.cphEventId,
      suggestedMatterId: (byCase ?? byName)?.id ?? null,
      suggestedKind: kind,
    };
  });
}

export async function linkCalendarEvents(links: { gcalId: string; matterId: string | null; kind: "hearing" | "deadline" | "appointment" }[], authorId: string) {
  const list = await listGoogleEvents(todayISO(), 250);
  const byId = new Map(list.map((e) => [e.id, e]));
  let count = 0;
  for (const l of links) {
    const e = byId.get(l.gcalId);
    if (!e) continue;
    const exists = await db.query.events.findFirst({ where: eq(events.gcalEventId, e.id) });
    if (exists) continue;
    await db.insert(events).values({
      matterId: l.matterId,
      kind: l.kind,
      title: e.summary.replace(/^\[[A-Z]+\]\s*/, "").slice(0, 300),
      date: e.date,
      time: e.time,
      allDay: e.allDay,
      location: e.location.slice(0, 300),
      notes: e.description.slice(0, 5000),
      ladder: "none",
      gcalEventId: e.id,
      // Linked events keep their existing Google title/reminders until edited in the CRM.
      syncStatus: "synced",
      createdBy: authorId,
    });
    count++;
  }
  return { count };
}
