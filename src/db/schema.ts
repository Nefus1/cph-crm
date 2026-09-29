import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Team members allowed to sign in. Access is by invitation (email). */
export const staff = pgTable("staff", {
  id: id(),
  email: text("email").notNull().unique(),
  userId: uuid("user_id").unique(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("staff"), // admin | staff
  locale: text("locale").notNull().default("en"), // en | es
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    kind: text("kind").notNull().default("person"), // person | organization
    firstName: text("first_name").notNull().default(""),
    middleName: text("middle_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    orgName: text("org_name").notNull().default(""),
    /** "Last, First" for people, org name for organizations. Maintained by the app. */
    displayName: text("display_name").notNull(),
    preferredLanguage: text("preferred_language").notNull().default("es"),
    phone: text("phone").notNull().default(""),
    phoneDigits: text("phone_digits").notNull().default(""),
    phoneAlt: text("phone_alt").notNull().default(""),
    phoneAltDigits: text("phone_alt_digits").notNull().default(""),
    email: text("email").notNull().default(""),
    addressLine1: text("address_line1").notNull().default(""),
    addressLine2: text("address_line2").notNull().default(""),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default("CA"),
    zip: text("zip").notNull().default(""),
    dateOfBirth: date("date_of_birth"),
    howFoundUs: text("how_found_us").notNull().default(""),
    notes: text("notes").notNull().default(""),
    importSource: text("import_source"),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("contacts_display_name_trgm").using("gin", sql`${t.displayName} gin_trgm_ops`),
    index("contacts_phone_digits_idx").on(t.phoneDigits),
    index("contacts_email_idx").on(t.email),
  ],
);

export const matters = pgTable(
  "matters",
  {
    id: id(),
    number: text("number").notNull().unique(),
    displayName: text("display_name").notNull(),
    caption: text("caption").notNull().default(""),
    practiceArea: text("practice_area").notNull(),
    matterType: text("matter_type").notNull(),
    side: text("side").notNull().default("na"),
    stage: text("stage").notNull(),
    status: text("status").notNull().default("active"), // intake | active | closed
    assigneeId: uuid("assignee_id").references(() => staff.id, { onDelete: "set null" }),
    supervisingAttorney: text("supervising_attorney").notNull().default(""),
    openedOn: date("opened_on").notNull().defaultNow(),
    closedOn: date("closed_on"),
    court: text("court").notNull().default("Los Angeles Superior Court"),
    courthouse: text("courthouse").notNull().default(""),
    caseNumber: text("case_number").notNull().default(""),
    department: text("department").notNull().default(""),
    judge: text("judge").notNull().default(""),
    feeType: text("fee_type").notNull().default("flat"), // flat | hourly | none
    flatFeeCents: integer("flat_fee_cents").notNull().default(0),
    details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
    summary: text("summary").notNull().default(""),
    driveFolderId: text("drive_folder_id"),
    driveFolderUrl: text("drive_folder_url"),
    driveStatus: text("drive_status").notNull().default("none"), // none | pending | ok | error
    driveError: text("drive_error"),
    importSource: text("import_source"),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("matters_area_status_idx").on(t.practiceArea, t.status),
    index("matters_assignee_idx").on(t.assigneeId),
    index("matters_display_name_trgm").using("gin", sql`${t.displayName} gin_trgm_ops`),
    index("matters_case_number_idx").on(t.caseNumber),
  ],
);

export const matterParties = pgTable(
  "matter_parties",
  {
    id: id(),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("matter_parties_unique").on(t.matterId, t.contactId, t.role),
    index("matter_parties_contact_idx").on(t.contactId),
  ],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: id(),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    labelEs: text("label_es").notNull().default(""),
    position: integer("position").notNull().default(0),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: uuid("done_by").references(() => staff.id, { onDelete: "set null" }),
  },
  (t) => [index("checklist_matter_idx").on(t.matterId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    matterId: uuid("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    assigneeId: uuid("assignee_id").references(() => staff.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    urgent: boolean("urgent").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => staff.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_assignee_open_idx").on(t.assigneeId, t.completedAt),
    index("tasks_matter_idx").on(t.matterId),
  ],
);

/** Hearings, deadlines, and appointments. Pushed one-way to Google Calendar. */
export const events = pgTable(
  "events",
  {
    id: id(),
    matterId: uuid("matter_id").references(() => matters.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("deadline"), // hearing | deadline | appointment
    title: text("title").notNull(),
    allDay: boolean("all_day").notNull().default(true),
    /** Calendar date (America/Los_Angeles). Always set, also for timed events. */
    date: date("date").notNull(),
    /** HH:MM local time for timed events. */
    time: text("time"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    ladder: text("ladder").notNull().default("none"), // service | filing | none
    status: text("status").notNull().default("scheduled"), // scheduled | done | continued | vacated
    computedFrom: text("computed_from"),
    gcalEventId: text("gcal_event_id"),
    syncStatus: text("sync_status").notNull().default("pending"), // pending | synced | error | off
    syncError: text("sync_error"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("events_date_idx").on(t.date), index("events_matter_idx").on(t.matterId), index("events_sync_idx").on(t.syncStatus)],
);

/** Timeline: notes, calls, meetings, stage changes, payments, system messages. */
export const activities = pgTable(
  "activities",
  {
    id: id(),
    matterId: uuid("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("note"),
    body: text("body").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    authorId: uuid("author_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("activities_matter_idx").on(t.matterId, t.occurredAt), index("activities_contact_idx").on(t.contactId, t.occurredAt)],
);

/** Fees & payments. Balance = charges − payments ± adjustments. Not a trust account. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // charge | payment | adjustment
    description: text("description").notNull().default(""),
    /** Positive for charges/payments. Adjustments may be negative (credit) or positive. */
    amountCents: integer("amount_cents").notNull(),
    entryDate: date("entry_date").notNull().defaultNow(),
    method: text("method").notNull().default(""),
    reference: text("reference").notNull().default(""),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_matter_idx").on(t.matterId)],
);

export const courtHolidays = pgTable("court_holidays", {
  date: date("date").primaryKey(),
  name: text("name").notNull(),
});

/** Singleton row (id = 1) for firm-wide settings and the Google connection. */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  googleRefreshTokenEnc: text("google_refresh_token_enc"),
  googleEmail: text("google_email"),
  googleConnectedAt: timestamp("google_connected_at", { withTimezone: true }),
  casesFolderId: text("cases_folder_id"),
  casesFolderName: text("cases_folder_name"),
  calendarId: text("calendar_id"),
  calendarName: text("calendar_name"),
  defaultSupervisingAttorney: text("default_supervising_attorney").notNull().default(""),
  firmName: text("firm_name").notNull().default("CPH"),
  updatedAt: updatedAt(),
});

export type Staff = typeof staff.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Matter = typeof matters.$inferSelect;
export type MatterParty = typeof matterParties.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type CalEvent = typeof events.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
