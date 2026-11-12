import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

const google = vi.hoisted(() => ({ connected: false, list: vi.fn(), get: vi.fn() }));
const auth = vi.hoisted(() => ({ id: "00000000-0000-4000-8000-000000000001", role: "admin" }));
vi.mock("@/lib/auth", () => ({
  requireStaff: async () => auth,
  requireAdmin: async () => {
    if (auth.role !== "admin") throw new Error("admin_only");
    return auth;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/google/client", () => ({
  getAuthedClient: async () => (google.connected ? { client: {} } : null),
  driveApi: () => ({ files: { list: google.list, get: google.get } }),
}));
import { db, resetDb } from "@/db";
import { appSettings, contacts, folderJobs, intakeDrafts, ledgerEntries, matterFolders, matters, staff } from "@/db/schema";
import { createIntake } from "@/server/actions/matters";
import { saveIntakeDraft, discardIntakeDraft, getIntakeDraft } from "@/server/actions/drafts";
import {
  registerFolderConnector,
  requestCaseFolder,
  revokeFolderConnector,
  saveFolderSettings,
  verifyFolderMapping,
  previewExistingFolder,
  linkExistingFolder,
} from "@/server/actions/folders";
import { discoverFolder } from "@/lib/folders/service";
import { POST } from "@/app/api/connector/[operation]/route";
import type { DraftPayload } from "@/lib/intake-draft";

const adminId = "00000000-0000-4000-8000-000000000001";
const employeeId = "00000000-0000-4000-8000-000000000002";
const payload: DraftPayload = {
  picked: null,
  client: {
    firstName: "José",
    middleName: "",
    lastName: "Muñoz García",
    phone: "",
    phoneAlt: "",
    email: "",
    addressLine1: "",
    city: "",
    state: "CA",
    zip: "",
    preferredLanguage: "es",
    howFoundUs: "",
    dateOfBirth: "",
  },
  area: "general",
  matterType: "other",
  side: "na",
  caption: "",
  caseNumber: "",
  courthouse: "",
  details: {},
  others: [],
  feeType: "flat",
  fee: "100",
  payment: "25",
  method: "Cash",
  retained: true,
  assigneeId: employeeId,
  supervising: "",
  note: "",
  drive: false,
  step: 0,
};
function intake(id = randomUUID()) {
  return {
    submissionId: id,
    conflictReviewed: true as const,
    client: { contact: payload.client },
    matter: { practiceArea: "general" as const, matterType: "other", flatFeeCents: 10000 },
    initialPaymentCents: 2500,
    createDriveFolder: false,
  };
}
async function call(operation: string, token: string, body = {}) {
  return POST(
    new Request(`https://crm.example/api/connector/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ operation }) },
  );
}
async function setup() {
  const registered = await registerFolderConnector("Reception");
  if (!registered.ok) throw new Error(registered.error);
  await db
    .update(appSettings)
    .set({
      folderRoot: "D:\\Cases",
      casesFolderId: "google-cases",
      folderConnectorId: registered.data.id,
      folderSetupEnabled: true,
      folderMappingVerifiedAt: new Date(),
    })
    .where(eq(appSettings.id, 1));
  return registered.data;
}

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("intake and folder transactions (isolated database)", () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/cph_test")
      throw new Error("Integration tests require an isolated local cph_test database");
  });
  beforeEach(async () => {
    auth.id = adminId;
    auth.role = "admin";
    google.connected = false;
    google.list.mockReset();
    google.get.mockReset();
    await db.execute(
      sql`truncate staff, contacts, matters, app_settings, intake_drafts, intake_submissions, folder_connectors, matter_folders, folder_jobs restart identity cascade`,
    );
    await db.insert(staff).values([
      { id: adminId, email: "admin@test.invalid", name: "Admin", role: "admin" },
      { id: employeeId, email: "employee@test.invalid", name: "Employee", locale: "es" },
    ]);
    await db.insert(appSettings).values({ id: 1 });
  });
  afterAll(() => resetDb());
  it("saves partial intake without creating business records, and another staff member can resume", async () => {
    const id = randomUUID();
    expect((await saveIntakeDraft(id, 0, payload)).ok).toBe(true);
    auth.id = employeeId;
    auth.role = "staff";
    expect((await getIntakeDraft(id))?.payload.client.firstName).toBe("José");
    expect(await db.select().from(matters)).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    expect(await db.select().from(ledgerEntries)).toHaveLength(0);
    expect(await db.select().from(folderJobs)).toHaveLength(0);
  });
  it("allows exactly one concurrent save and rejects stale discard and submission", async () => {
    const id = randomUUID();
    await saveIntakeDraft(id, 0, payload);
    const saves = await Promise.all([saveIntakeDraft(id, 1, { ...payload, note: "A" }), saveIntakeDraft(id, 1, { ...payload, note: "B" })]);
    expect(saves.filter((r) => r.ok)).toHaveLength(1);
    expect(await discardIntakeDraft(id, 1)).toEqual({ ok: false, error: "draft_conflict" });
    expect(await createIntake({ ...intake(id), draftVersion: 1 })).toEqual({ ok: false, error: "draft_conflict" });
    expect((await getIntakeDraft(id))?.version).toBe(2);
  });
  it("deduplicates simultaneous final submissions, including charges and payments", async () => {
    const input = intake();
    const [a, b] = await Promise.all([createIntake(input), createIntake(input)]);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
    expect(await db.select().from(matters)).toHaveLength(1);
    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(ledgerEntries)).toHaveLength(2);
    expect(await saveIntakeDraft(input.submissionId, 0, payload)).toEqual({ ok: false, error: "draft_conflict" });
  });
  it("rolls back all business records and keeps the draft if folder setup fails", async () => {
    const id = randomUUID();
    await saveIntakeDraft(id, 0, payload);
    const result = await createIntake({ ...intake(id), draftVersion: 1, createDriveFolder: true });
    expect(result).toEqual({ ok: false, error: "folder_setup_disabled" });
    expect(await db.select().from(matters)).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    expect(await db.select().from(ledgerEntries)).toHaveLength(0);
    expect((await getIntakeDraft(id))?.status).toBe("draft");
  });
  it("includes existing clients in the recorded conflict review", async () => {
    const [c] = await db.insert(contacts).values({ firstName: "José", lastName: "Muñoz García", displayName: "Muñoz García, José" }).returning();
    const input = { ...intake(), client: { contactId: c.id } };
    expect((await createIntake(input)).ok).toBe(true);
    expect((await db.query.intakeSubmissions.findFirst())?.conflictContactIds).toContain(c.id);
  });
  it("submits and retires the draft atomically", async () => {
    const id = randomUUID();
    await saveIntakeDraft(id, 0, payload);
    expect((await createIntake({ ...intake(id), draftVersion: 1 })).ok).toBe(true);
    expect((await db.select().from(intakeDrafts))[0].status).toBe("submitted");
    expect(await discardIntakeDraft(id, 1)).toEqual({ ok: false, error: "draft_conflict" });
  });
  it("enqueues only once and exclusively leases work; expired acknowledgments cannot complete a newer lease", async () => {
    const device = await setup();
    const result = await createIntake({ ...intake(), createDriveFolder: true });
    if (!result.ok || !result.data) throw new Error("intake failed");
    await requestCaseFolder(result.data.id);
    expect(await db.select().from(folderJobs)).toHaveLength(1);
    const responses = await Promise.all([call("claim", device.token), call("claim", device.token)]);
    const jobs = await Promise.all(responses.map((r) => r.json()));
    expect(jobs.filter((r) => r.job)).toHaveLength(1);
    const first = jobs.find((r) => r.job).job;
    await db
      .update(folderJobs)
      .set({ leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(folderJobs.id, first.id));
    const second = (await (await call("claim", device.token)).json()).job;
    expect(second.leaseToken).not.toBe(first.leaseToken);
    expect((await call("complete", device.token, { id: first.id, leaseToken: first.leaseToken })).status).toBe(409);
    const ack = { id: second.id, leaseToken: second.leaseToken };
    expect((await call("complete", device.token, ack)).status).toBe(200);
    expect((await call("complete", device.token, ack)).status).toBe(200);
    expect((await db.query.matterFolders.findFirst())?.localStatus).toBe("ready");
  });
  it("records connector failures with backoff and rejects revoked credentials", async () => {
    const device = await setup();
    await createIntake({ ...intake(), createDriveFolder: true });
    const job = (await (await call("claim", device.token)).json()).job;
    await call("failure", device.token, { id: job.id, leaseToken: job.leaseToken, error: "root_unavailable" });
    expect((await (await call("claim", device.token)).json()).job).toBeNull();
    expect((await db.query.folderJobs.findFirst())?.error).toBe("root_unavailable");
    await revokeFolderConnector(device.id);
    expect((await call("heartbeat", device.token)).status).toBe(401);
  });
  it("requires verified current mapping and admin privileges to enable setup", async () => {
    const device = await setup();
    await db.update(appSettings).set({ folderMappingVerifiedAt: null, folderSetupEnabled: false });
    expect(await saveFolderSettings({ root: "D:\\Cases", connectorId: device.id, enabled: true })).toEqual({ ok: false, error: "mapping_unverified" });
    expect(await verifyFolderMapping(randomUUID())).toEqual({ ok: false, error: "mapping_unverified" });
    auth.role = "staff";
    expect(await registerFolderConnector("Other")).toEqual({ ok: false, error: "admin_only" });
  });
  it("stops normal claims while disabled but permits a verification matter", async () => {
    const device = await setup();
    await createIntake({ ...intake(), createDriveFolder: true });
    await db.update(appSettings).set({ folderSetupEnabled: false });
    expect((await (await call("claim", device.token)).json()).job).toBeNull();
    const result = await createIntake(intake());
    if (!result.ok || !result.data) throw new Error("intake failed");
    await requestCaseFolder(result.data.id, true);
    expect((await (await call("claim", device.token)).json()).job.payload.matterId).toBe(result.data.id);
  });
  it("waits for Google sync independently, then links the folder and verifies the mapping", async () => {
    const device = await setup();
    await db.update(appSettings).set({ folderSetupEnabled: false, folderMappingVerifiedAt: null });
    const result = await createIntake(intake());
    if (!result.ok || !result.data) throw new Error("intake failed");
    const queued = await requestCaseFolder(result.data.id, true);
    if (!queued.ok) throw new Error(queued.error);
    const job = (await (await call("claim", device.token)).json()).job;
    await call("complete", device.token, { id: job.id, leaseToken: job.leaseToken });
    google.connected = true;
    google.list.mockResolvedValue({ data: { files: [] } });
    await discoverFolder(queued.data.id);
    expect((await db.query.matterFolders.findFirst())?.discoveryStatus).toBe("waiting");
    google.list.mockResolvedValue({ data: { files: [{ id: "synced", name: job.payload.relativePath }] } });
    await discoverFolder(queued.data.id);
    expect((await db.query.matters.findFirst())?.driveFolderId).toBe("synced");
    expect((await verifyFolderMapping(queued.data.id)).ok).toBe(true);
    expect((await saveFolderSettings({ root: "D:\\Cases", connectorId: device.id, enabled: true })).ok).toBe(true);
  });
  it("previews and links multiple existing folders without changing records or creating jobs", async () => {
    await setup();
    const result = await createIntake(intake());
    if (!result.ok || !result.data) throw new Error("intake failed");
    google.connected = true;
    google.get.mockImplementation(async ({ fileId }: { fileId: string }) => ({
      data: { id: fileId, name: fileId, parents: ["google-cases"], mimeType: "application/vnd.google-apps.folder", trashed: false },
    }));
    const preview = await previewExistingFolder("legacyA");
    expect(preview.ok).toBe(true);
    expect((await linkExistingFolder(result.data.id, "legacyA", "legacyA", true)).ok).toBe(true);
    expect((await linkExistingFolder(result.data.id, "legacyB", "legacyB", false)).ok).toBe(true);
    expect((await linkExistingFolder(result.data.id, "legacyA", "legacyA", true)).ok).toBe(true);
    expect(await db.select().from(matterFolders)).toHaveLength(2);
    expect(await db.select().from(folderJobs)).toHaveLength(0);
    expect((await db.query.matters.findFirst())?.driveFolderId).toBe("legacyA");
    expect(await linkExistingFolder(result.data.id, "legacyC", "wrong", false)).toEqual({ ok: false, error: "folder_changed" });
  });
  it("explicitly selecting an ambiguous Google match resolves the existing managed binding", async () => {
    const device = await setup();
    const result = await createIntake({ ...intake(), createDriveFolder: true });
    if (!result.ok || !result.data) throw new Error("intake failed");
    const job = (await (await call("claim", device.token)).json()).job;
    await call("complete", device.token, { id: job.id, leaseToken: job.leaseToken });
    const binding = (await db.select().from(matterFolders))[0];
    google.connected = true;
    google.list.mockResolvedValue({ data: { files: [{ id: "a" }, { id: "b" }] } });
    await discoverFolder(binding.id);
    expect((await db.query.matterFolders.findFirst())?.discoveryError).toBe("folder_ambiguous");
    google.get.mockResolvedValue({
      data: { id: "b", name: binding.relativePath, parents: ["google-cases"], mimeType: "application/vnd.google-apps.folder", trashed: false },
    });
    expect((await linkExistingFolder(result.data.id, "b", binding.relativePath!, true)).ok).toBe(true);
    expect(await db.select().from(matterFolders)).toHaveLength(1);
    expect((await db.query.matterFolders.findFirst())?.driveFolderId).toBe("b");
  });
});
