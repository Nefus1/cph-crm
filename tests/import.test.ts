import { describe, expect, it } from "vitest";
import { cleanEmail, guessMatter, mapSheetRow, parseAddress, parseCaseFolderName, parseFamilyNotes, parseIntakeDoc, rowsFromSheet, statusFromText } from "@/lib/import/mapping";
import { splitName } from "@/lib/names";
import { phoneDigits, splitPhones, formatPhone } from "@/lib/phone";
import { ledgerTotals, parseMoneyToCents } from "@/lib/money";

describe("matter mapping", () => {
  it.each([
    ["Divorce", "family", "dissolution"],
    ["Parentage", "family", "parentage"],
    ["Small Claims", "general", "small_claims"],
    ["UD", "ud", "other"],
    ["Conservatorship", "probate", "conservatorship"],
    ["Living Trust", "trust", "living_trust"],
    ["Other", "general", "other"],
  ])("%s → %s/%s", (text, area, type) => {
    const g = guessMatter(text);
    expect(g.area).toBe(area);
    expect(g.type).toBe(type);
  });
  it("reads the side from a Drive folder", () => {
    expect(guessMatter("UD", "Plaintiff").side).toBe("plaintiff");
    expect(guessMatter("UD", "Defendant").side).toBe("defendant");
  });
});

describe("intake sheet rows", () => {
  const values = [
    ["Timestamp", "Name", "Address", "Phone", "E-mail", "Matter", "Fee(s)", "Payment", "Notes", "Status"],
    ["1/26/2023 12:53:13", "John Doe", "123 Fake St", "310-222-0000", "info@cph.com", "Divorce", "$1,800.00", "$800.00", "DOM: 12/11/2008\nDOS: 10/15/2018\n\nNo Prop\nNo Kids", ""],
    ["2/24/2023 15:57:33", "Normando Rivas Quinonez", "1523 W 154th St, Compton, CA 90220", "562-244-2554 / 562-228-4166", "", "Divorce", "$750.00", "$250.00", "", ""],
    ["", "", "", "", "", "", "", "", "", ""],
  ];
  const rows = rowsFromSheet(values);

  it("skips blank rows and maps headers", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].matter).toBe("Divorce");
  });

  it("maps family facts, fees and placeholder email", () => {
    const m = mapSheetRow(rows[0]);
    expect(m.contact.email).toBe("");
    expect(m.warnings).toContain("email_skipped");
    expect(m.feeCents).toBe(180000);
    expect(m.paymentCents).toBe(80000);
    expect(m.openedOn).toBe("2023-01-26");
    expect(m.details).toEqual({ date_of_marriage: "2008-12-11", date_of_separation: "2018-10-15", has_children: "no", has_property: "no" });
  });

  it("splits two phones and parses address", () => {
    const m = mapSheetRow(rows[1]);
    expect(m.contact.phone).toBe("562-244-2554");
    expect(m.contact.phoneAlt).toBe("562-228-4166");
    expect(m.contact.city).toBe("Compton");
    expect(m.contact.zip).toBe("90220");
    expect(m.contact.lastName).toBe("Rivas Quinonez");
  });
});

describe("helpers", () => {
  it("parses addresses", () => {
    expect(parseAddress("10320 S Freeman Ave, Inglewood, CA 90304")).toEqual({ addressLine1: "10320 S Freeman Ave", city: "Inglewood", state: "CA", zip: "90304" });
  });
  it("cleans emails", () => {
    expect(cleanEmail("info@email.com")).toBe("");
    expect(cleanEmail("Someone@Example.com ")).toBe("someone@example.com");
  });
  it("splits Hispanic names", () => {
    expect(splitName("Juan Carlos Maldonado Fonseca")).toEqual({ firstName: "Juan", middleName: "Carlos", lastName: "Maldonado Fonseca" });
    expect(splitName("Acosta, Francisco")).toEqual({ firstName: "Francisco", middleName: "", lastName: "Acosta" });
    expect(splitName("Maria de la Cruz")).toEqual({ firstName: "Maria", middleName: "", lastName: "de la Cruz" });
  });
  it("normalizes phones", () => {
    expect(formatPhone("3106140806")).toBe("(310) 614-0806");
    expect(phoneDigits("+1 (310) 614-0806")).toBe("3106140806");
    expect(splitPhones("323-552-4257")).toEqual(["323-552-4257", ""]);
  });
  it("family notes", () => {
    expect(parseFamilyNotes("2 kids, DOM 6/9/2012")).toEqual({ has_children: "yes", children_count: "2", date_of_marriage: "2012-06-09" });
  });
  it("status policy", () => {
    expect(statusFromText("", "2023-01-26", "age", "2026-09-29")).toBe("closed");
    expect(statusFromText("", "2026-08-01", "age", "2026-09-29")).toBe("active");
    expect(statusFromText("Closed", "2026-08-01", "active", "2026-09-29")).toBe("closed");
  });
  it("parses Drive case folder names", () => {
    expect(parseCaseFolderName("Acosta, Francisco — UD (Plaintiff)")).toEqual({ lastName: "Acosta", firstName: "Francisco", typeText: "UD", sideText: "Plaintiff" });
    expect(parseCaseFolderName("Lamar Shorts - Conservatorship")).toEqual({ lastName: "Lamar Shorts", firstName: "", typeText: "Conservatorship", sideText: "" });
    expect(parseCaseFolderName("Random folder")).toBeNull();
  });
  it("parses the 00 Intake doc", () => {
    const doc = "- **Matter name:** Acosta v. Merdado, et al.\n- **Case number:** 26CMUD01121\n- Venue: routes to the **Governor George Deukmejian Courthouse (Long Beach)**";
    expect(parseIntakeDoc(doc)).toEqual({ caption: "Acosta v. Merdado, et al", caseNumber: "26CMUD01121", courthouse: "Governor George Deukmejian (Long Beach)" });
    expect(parseIntakeDoc("Case number: — NEEDED —").caseNumber).toBeUndefined();
  });
});

describe("money", () => {
  it("parses and totals", () => {
    expect(parseMoneyToCents("$1,800.00")).toBe(180000);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(ledgerTotals([{ kind: "charge", amountCents: 180000 }, { kind: "payment", amountCents: 80000 }, { kind: "adjustment", amountCents: -10000 }]).balance).toBe(90000);
  });
});

import { contactInput, intakeInput } from "@/server/schemas";

describe("schemas", () => {
  it("contact input can be parsed twice (intake re-validates nested contacts)", () => {
    const once = contactInput.parse({ firstName: "A", lastName: "B", dateOfBirth: "" });
    expect(once.dateOfBirth).toBeNull();
    expect(() => contactInput.parse(once)).not.toThrow();
  });
  it("intake input accepts a minimal new client", () => {
    const r = intakeInput.parse({ client: { contact: { firstName: "Dbg", lastName: "Test", dateOfBirth: "" } }, matter: { practiceArea: "ud", matterType: "30day", side: "plaintiff", openedOn: "2026-09-29", assigneeId: null } });
    expect(r.matter.status).toBe("active");
    expect(r.client.contact?.dateOfBirth).toBeNull();
  });
});
