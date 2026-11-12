import { describe, expect, it, vi, beforeEach } from "vitest";
import { folderPayload, safeFolderName } from "@/lib/folders/templates";

const google = vi.hoisted(() => ({ list: vi.fn(), connected: true }));
vi.mock("@/lib/google/client", () => ({
  getAuthedClient: async () => (google.connected ? { client: {} } : null),
  driveApi: () => ({ files: { list: google.list } }),
}));
import { findSyncedFolder } from "@/lib/folders/service";

const matter = { id: "id", number: "CPH-26-0001", displayName: "Muñoz García, José — UD (Plaintiff)", practiceArea: "ud", matterType: "3day_pay" };
describe("folder templates and naming", () => {
  it("keeps Unicode and separates repeated client/type combinations by matter number", () => {
    const a = folderPayload(matter, "D:\\Cases");
    const b = folderPayload({ ...matter, number: "CPH-26-0002" }, "D:\\Cases");
    expect(a.relativePath).toContain("Muñoz García, José");
    expect(a.relativePath).not.toEqual(b.relativePath);
    expect(a.folders).toContain("UD/Complaint/Filed");
  });
  it("sanitizes Windows-invalid characters and reserved names without stripping accents", () => {
    expect(safeFolderName("José: A/B?. ")).toBe("José_ A_B_");
    expect(safeFolderName("CON.txt")).toBe("_CON.txt");
    expect(() => safeFolderName("..")).toThrow();
  });
  it("keeps snapshots independent of future template changes", () => {
    const a = folderPayload(matter, "D:\\Cases");
    a.folders.push("Changed");
    a.files["Notes.txt"] = "changed";
    const b = folderPayload(matter, "D:\\Cases");
    expect(b.folders).not.toContain("Changed");
    expect(b.files["Notes.txt"]).not.toBe("changed");
  });
});
describe("read-only Google discovery", () => {
  beforeEach(() => {
    google.list.mockReset();
    google.connected = true;
  });
  it("waits for a delayed sync without creating anything", async () => {
    google.list.mockResolvedValue({ data: { files: [] } });
    expect(await findSyncedFolder("cases", "CPH-26-0001")).toBeNull();
  });
  it("rejects ambiguous folders", async () => {
    google.list.mockResolvedValue({ data: { files: [{ id: "a" }, { id: "b" }] } });
    await expect(findSyncedFolder("cases", "same")).rejects.toThrow("folder_ambiguous");
  });
  it("walks an exact relative path", async () => {
    google.list
      .mockResolvedValueOnce({ data: { files: [{ id: "a", name: "Parent" }] } })
      .mockResolvedValueOnce({ data: { files: [{ id: "b", name: "Child" }] } });
    expect((await findSyncedFolder("cases", "Parent/Child"))?.id).toBe("b");
    expect(google.list.mock.calls[1][0].q).toContain("'a' in parents");
  });
  it("reports a disconnected account", async () => {
    google.connected = false;
    await expect(findSyncedFolder("cases", "x")).rejects.toThrow("google_disconnected");
  });
});
