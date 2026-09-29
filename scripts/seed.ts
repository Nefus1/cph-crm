/**
 * Demo data for local development and screenshots. All people are FICTIONAL.
 * Refuses to run against a Supabase URL unless --force is passed.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { PRACTICE_AREA_CONFIG, buildDisplayName, stagesFor } from "../src/config/practice-areas";
import { contactDisplayName } from "../src/lib/names";
import { formatPhone, phoneDigits } from "../src/lib/phone";
import { addDaysISO, todayISO } from "../src/lib/dates";

const url = process.env.DATABASE_URL!;
if (/supabase/.test(url) && !process.argv.includes("--force")) {
  console.error("Refusing to seed a Supabase database. Pass --force if you really mean it.");
  process.exit(1);
}
const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema });
const today = todayISO();

async function main() {
  if (process.argv.includes("--reset")) {
    await db.execute(sql`truncate activities, ledger_entries, events, tasks, checklist_items, matter_parties, matters, contacts restart identity cascade`);
    await db.execute(sql`alter sequence matter_number_seq restart with 1`);
  }
  const admin = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const [owner] = await db
    .insert(schema.staff)
    .values({ email: admin, name: "Admin (demo)", role: "admin" })
    .onConflictDoUpdate({ target: schema.staff.email, set: { role: "admin" } })
    .returning();
  const [ana] = await db.insert(schema.staff).values({ email: "ana.demo@example.com", name: "Ana Demo", role: "staff" }).onConflictDoUpdate({ target: schema.staff.email, set: { active: true } }).returning();
  await db.update(schema.appSettings).set({ defaultSupervisingAttorney: "Supervising Attorney (demo)" }).where(sql`id = 1`);

  async function person(first: string, last: string, extra: Partial<typeof schema.contacts.$inferInsert> = {}) {
    const phone = formatPhone(extra.phone ?? "");
    const [c] = await db
      .insert(schema.contacts)
      .values({ firstName: first, lastName: last, displayName: contactDisplayName({ firstName: first, lastName: last }), ...extra, phone, phoneDigits: phoneDigits(phone), createdBy: owner.id })
      .returning();
    return c;
  }


  async function matter(opts: {
    client: typeof schema.contacts.$inferSelect;
    area: keyof typeof PRACTICE_AREA_CONFIG;
    type: string;
    side: string;
    stageIndex: number;
    status?: string;
    caption?: string;
    caseNumber?: string;
    courthouse?: string;
    fee?: number;
    paid?: number[];
    details?: Record<string, string>;
    assignee?: string;
    opened?: number;
    others?: { c: typeof schema.contacts.$inferSelect; role: string }[];
    doneChecklist?: number;
  }) {

    const stages = stagesFor(opts.area, opts.side);
    const stage = stages[Math.min(opts.stageIndex, stages.length - 1)].key;
    const opened = addDaysISO(today, -(opts.opened ?? 30));
    const [m] = await db
      .insert(schema.matters)
      .values({
        number: `CPH-26-${String((await db.execute<{ n: string }>(sql`select nextval('matter_number_seq')::text as n`))[0].n).padStart(4, "0")}`,
        displayName: buildDisplayName(opts.client.displayName, opts.area, opts.type, opts.side),
        caption: opts.caption ?? "",
        practiceArea: opts.area,
        matterType: opts.type,
        side: opts.side,
        stage,
        status: opts.status ?? (opts.stageIndex === 0 ? "intake" : "active"),
        assigneeId: opts.assignee ?? owner.id,
        supervisingAttorney: "Supervising Attorney (demo)",
        openedOn: opened,
        caseNumber: opts.caseNumber ?? "",
        courthouse: opts.courthouse ?? "",
        flatFeeCents: (opts.fee ?? 0) * 100,
        details: opts.details ?? {},
        createdBy: owner.id,
      })
      .returning();
    await db.insert(schema.matterParties).values({ matterId: m.id, contactId: opts.client.id, role: "client", isPrimary: true });
    for (const o of opts.others ?? []) await db.insert(schema.matterParties).values({ matterId: m.id, contactId: o.c.id, role: o.role });
    const cl = PRACTICE_AREA_CONFIG[opts.area].checklist;
    await db.insert(schema.checklistItems).values(
      cl.map((l, i) => ({ matterId: m.id, label: l.en, labelEs: l.es, position: i, doneAt: i < (opts.doneChecklist ?? 0) ? new Date() : null, doneBy: i < (opts.doneChecklist ?? 0) ? owner.id : null })),
    );
    if (opts.fee) await db.insert(schema.ledgerEntries).values({ matterId: m.id, kind: "charge", description: "Flat fee", amountCents: opts.fee * 100, entryDate: opened, createdBy: owner.id });
    for (const [i, p] of (opts.paid ?? []).entries()) {
      await db.insert(schema.ledgerEntries).values({ matterId: m.id, kind: "payment", description: i === 0 ? "Initial payment" : "Installment", amountCents: p * 100, entryDate: addDaysISO(opened, i * 14), method: i % 2 ? "Zelle" : "Cash", createdBy: owner.id });
    }
    await db.insert(schema.activities).values({ matterId: m.id, type: "system", body: `Matter opened (${m.number})`, authorId: owner.id, occurredAt: new Date(`${opened}T17:00:00Z`) });
    return m;
  }

  const rosa = await person("Rosa", "Villalobos", { phone: "310-555-0142", email: "rosa.demo@example.com", city: "Inglewood", addressLine1: "100 Demo St" });
  const tenant1 = await person("Kevin", "Marsh");
  const tenant2 = await person("Lucia", "Marsh");
  const ud1 = await matter({
    client: rosa, area: "ud", type: "30day", side: "plaintiff", stageIndex: 2, caption: "Villalobos v. Marsh, et al.", caseNumber: "26CMUD99001", courthouse: "Compton", fee: 1500, paid: [500, 500], opened: 40, doneChecklist: 7,
    details: { property_address: "200 Example Ave, Inglewood, CA 90301", monthly_rent: "1850.00", rent_control: "la_county_rstpo", notice_type: "30day", notice_served_on: addDaysISO(today, -35), notice_service_method: "personal", tenancy_start: "2025-11-01" },
    others: [{ c: tenant1, role: "opposing_party" }, { c: tenant2, role: "opposing_party" }],
  });

  const jorge = await person("Jorge", "Castañeda Ruiz", { phone: "(323) 555-0199", preferredLanguage: "es" });
  const ud2 = await matter({ client: jorge, area: "ud", type: "3day_pay", side: "plaintiff", stageIndex: 0, fee: 1200, paid: [300], opened: 3, doneChecklist: 2, details: { property_address: "45 Sample Pl, Gardena, CA 90247", monthly_rent: "1400.00", rent_control: "unknown" } });

  const maria = await person("María José", "Hernández", { phone: "424-555-0110", email: "mj.demo@example.com", preferredLanguage: "es" });
  const exHusband = await person("Daniel", "Hernández");
  const fam1 = await matter({
    client: maria, area: "family", type: "dissolution", side: "petitioner", stageIndex: 5, caseNumber: "26STFL99002", courthouse: "Stanley Mosk (Central)", fee: 1800, paid: [800, 400, 200], opened: 120, assignee: ana.id, doneChecklist: 6,
    details: { date_of_marriage: "2012-06-09", date_of_separation: "2025-10-15", has_children: "yes", children_count: "2", has_property: "no" },
    others: [{ c: exHusband, role: "opposing_party" }],
  });

  const luis = await person("Luis", "Ortega", { phone: "562-555-0123" });
  const fam2 = await matter({ client: luis, area: "family", type: "parentage", side: "respondent", stageIndex: 2, caseNumber: "25TRPT99003", courthouse: "Torrance", fee: 1800, paid: [300], opened: 60, doneChecklist: 4 });

  const elena = await person("Elena", "Salazar", { phone: "310-555-0177", preferredLanguage: "es" });
  const son = await person("Mateo", "Salazar");
  const pb1 = await matter({ client: elena, area: "probate", type: "conservatorship", side: "petitioner", stageIndex: 3, caseNumber: "26STPB99004", courthouse: "Stanley Mosk (Central)", fee: 3500, paid: [1500, 1000], opened: 75, assignee: ana.id, doneChecklist: 7, details: { protected_person: "Mateo Salazar", investigator: "TBD" }, others: [{ c: son, role: "conservatee" }] });

  const couple = await person("Ramón", "Aguilar", { phone: "213-555-0155" });
  const lt1 = await matter({ client: couple, area: "trust", type: "living_trust", side: "na", stageIndex: 2, fee: 2200, paid: [1100], opened: 20, doneChecklist: 5, details: { trustors: "Ramón and Teresa Aguilar", funding_status: "not_started" } });

  const small = await person("Patricia", "Núñez", { phone: "310-555-0166" });
  const gen1 = await matter({ client: small, area: "general", type: "small_claims", side: "plaintiff", stageIndex: 1, fee: 330, paid: [280], opened: 15, doneChecklist: 3 });

  // Dates
  const ev = (m: typeof ud1, kind: string, title: string, days: number, extra: Partial<typeof schema.events.$inferInsert> = {}) =>
    db.insert(schema.events).values({ matterId: m.id, kind, title, date: addDaysISO(today, days), allDay: !extra.time, syncStatus: "off", ladder: kind === "appointment" ? "none" : "filing", createdBy: owner.id, ...extra });
  await ev(ud1, "deadline", "Answer due", 3, { computedFrom: "UD calculator: 10 court days after summons service" });
  await ev(ud1, "hearing", "Trial (UD)", 16, { time: "08:30", location: "Dept. A — Compton" });
  await ev(fam1, "hearing", "RFO hearing — custody & support", 6, { time: "08:30", location: "Dept. 2 — Stanley Mosk" });
  await ev(fam1, "deadline", "Serve FL-142 disclosures", -1, { ladder: "service" });
  await ev(pb1, "hearing", "Petition hearing", 11, { time: "09:00", location: "Dept. 9 — Stanley Mosk" });
  await ev(pb1, "appointment", "Court investigator visit", 2, { time: "14:00" });
  await ev(lt1, "appointment", "Signing appointment + notary", 9, { time: "11:00", location: "Office" });
  await ev(fam2, "deadline", "Response due", 8);

  // Tasks
  const task = (title: string, m: typeof ud1 | null, days: number | null, who = owner.id, urgent = false) =>
    db.insert(schema.tasks).values({ title, matterId: m?.id ?? null, dueDate: days === null ? null : addDaysISO(today, days), assigneeId: who, urgent, createdBy: owner.id });
  await task("Prepare request for entry of default if no answer", ud1, 4);
  await task("Get tenant's full legal name from client", ud2, 0, owner.id, true);
  await task("Verify filing courthouse on LASC locator", ud2, 1);
  await task("Collect income & expense declaration from client", fam1, -2, ana.id, true);
  await task("Send capacity declaration GC-335 to doctor", pb1, 3, ana.id);
  await task("Draft trust and pour-over will", lt1, 5);
  await task("Call client re: balance and next installment", fam2, null);
  await task("Order LASC holiday calendar for 2027", null, 20);

  // Timeline
  const note = (m: typeof ud1, type: string, body: string, daysAgo: number) =>
    db.insert(schema.activities).values({ matterId: m.id, type, body, authorId: owner.id, occurredAt: new Date(Date.now() - daysAgo * 86400000) });
  await note(ud1, "call", "Client confirmed tenants are still in possession. Rent not paid for September.", 2);
  await note(ud1, "note", "Summons served personally on both defendants. Proof of service filed.", 7);
  await note(fam1, "meeting", "Went over disclosures checklist with client in Spanish. She'll bring pay stubs Friday.", 1);
  await note(ud2, "call", "Initial consult. Client owns the property (grant deed in hand). 3-day notice not yet served.", 3);

  console.log(`Seeded demo data: 7 matters, ${await db.$count(schema.contacts)} contacts.`);
  void gen1;
}

main()
  .then(() => client.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
