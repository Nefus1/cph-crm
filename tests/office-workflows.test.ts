import { describe, expect, it } from "vitest";
import { contactAttemptInput, documentUrl, followUpBucket, gmailCompose, officeDate, whatsappCompose } from "../src/lib/office-workflows";

describe("office workflow boundaries", () => {
  it("requires a new follow-up date unless the request is resolved", () => {
    const input = { taskId: "10000000-0000-4000-8000-000000000001", version: 0, channel: "dialpad", notes: "", nextDate: null };
    expect(contactAttemptInput.safeParse({ ...input, outcome: "no_response" }).success).toBe(false);
    expect(contactAttemptInput.safeParse({ ...input, outcome: "resolved" }).success).toBe(true);
  });
  it("rejects executable links, embedded credentials, and invalid dates", () => {
    for (const value of ["javascript:alert(1)", "file:///C:/case.pdf", "https://user:secret@example.com"]) expect(documentUrl.safeParse(value).success).toBe(false);
    expect(documentUrl.safeParse("https://drive.google.com/file/d/abc/view").success).toBe(true);
    expect(officeDate.safeParse("2026-02-30").success).toBe(false);
  });
  it("keeps waiting requests visible in their due-date bucket", () => {
    expect(followUpBucket("2026-11-10", true, "2026-11-11")).toEqual({ overdue: true, today: false, upcoming: false, waiting: true });
  });
  it("preserves accents and safely encodes message text", () => {
    const body = "José Muñoz & María + documentos";
    expect(new URL(gmailCompose("a@example.com", "Caso", body)).searchParams.get("body")).toBe(body);
    expect(new URL(whatsappCompose("+1 (213) 555-0100", body)!).searchParams.get("text")).toBe(body);
    expect(whatsappCompose("2135550100", body)).toBeNull();
  });
});
