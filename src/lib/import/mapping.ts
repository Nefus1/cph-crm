/**
 * Pure mapping helpers for importing CPH's existing data:
 *  - the "Client Intake Form (Responses)" Google Sheet
 *  - Drive folders named "Last, First — Type (Side)"
 */
import type { PracticeArea } from "@/config/practice-areas";
import { parseLooseDate } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { splitName, titleCase } from "@/lib/names";
import { splitPhones } from "@/lib/phone";

export interface MatterGuess {
  area: PracticeArea;
  type: string;
  side: string;
}

/** Maps free text ("Divorce", "UD", "Conservatorship", "Small Claims"…) to area/type. */
export function guessMatter(text: string, sideText = ""): MatterGuess {
  const s = ` ${text.toLowerCase()} `;
  const side = guessSide(sideText || text);
  const has = (...words: string[]) => words.some((w) => s.includes(w));
  if (has("divorce", "dissolution", "divorcio")) return { area: "family", type: "dissolution", side: side ?? "petitioner" };
  if (has("legal separation", "separación")) return { area: "family", type: "legal_separation", side: side ?? "petitioner" };
  if (has("parentage", "paternity", "paternidad")) return { area: "family", type: "parentage", side: side ?? "petitioner" };
  if (has("custody", "custodia", "visitation")) return { area: "family", type: "custody", side: side ?? "petitioner" };
  if (has("restraining", "dvro", "domestic violence", "orden de restric")) return { area: "family", type: "dvro", side: side ?? "petitioner" };
  if (has("child support", "spousal support", "support", "manutención")) return { area: "family", type: "support", side: side ?? "petitioner" };
  if (has("rfo", "post-judgment", "post judgment", "modification")) return { area: "family", type: "post_judgment", side: side ?? "petitioner" };
  if (has(" ud ", " ud(", "(ud", "unlawful detainer", "eviction", "desalojo", "3-day", "3 day", "30-day", "60-day")) {
    const type = has("3-day", "3 day") ? "3day_pay" : has("30-day", "30 day") ? "30day" : has("60-day", "60 day") ? "60day" : "other";
    return { area: "ud", type, side: side === "defendant" ? "defendant" : "plaintiff" };
  }
  if (has("lps")) return { area: "probate", type: "lps", side: "petitioner" };
  if (has("conservator")) return { area: "probate", type: "conservatorship", side: "petitioner" };
  if (has("guardian", "tutela")) return { area: "probate", type: "guardianship", side: "petitioner" };
  if (has("probate", "sucesión", "estate admin")) return { area: "probate", type: "probate_admin", side: "petitioner" };
  if (has("trust admin")) return { area: "trust", type: "trust_admin", side: "na" };
  if (has("amendment")) return { area: "trust", type: "amendment", side: "na" };
  if (has("trust", "fideicomiso")) return { area: "trust", type: "living_trust", side: "na" };
  if (has(" will", "testament")) return { area: "trust", type: "will", side: "na" };
  if (has("small claims", "reclamos menores")) return { area: "general", type: "small_claims", side: side ?? "plaintiff" };
  if (has("relocation", "reubicación")) return { area: "general", type: "relocation", side: "na" };
  return { area: "general", type: "other", side: side ?? "na" };
}

export function guessSide(text: string): string | null {
  const s = text.toLowerCase();
  if (/plaintiff|landlord|demandante|arrendador/.test(s)) return "plaintiff";
  if (/defendant|tenant|inquilino/.test(s)) return "defendant";
  if (/petitioner|peticionario/.test(s)) return "petitioner";
  if (/respondent/.test(s)) return "respondent";
  return null;
}

const PLACEHOLDER_EMAILS = new Set(["info@email.com", "info@cph.com", "none", "n/a", "na", "no", "-", "email@email.com", "test@test.com"]);

export function cleanEmail(input: string): string {
  const e = input.trim().toLowerCase();
  if (!e || PLACEHOLDER_EMAILS.has(e)) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

export function parseAddress(input: string) {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out = { addressLine1: "", city: "", state: "CA", zip: "" };
  if (!parts.length) return out;
  out.addressLine1 = parts[0];
  if (parts.length >= 2) out.city = parts[1];
  const tail = parts.slice(2).join(" ");
  const m = tail.match(/([A-Za-z]{2})?\s*(\d{5})?/);
  if (m?.[1]) out.state = m[1].toUpperCase();
  if (m?.[2]) out.zip = m[2];
  // "Inglewood CA 90304" in the city slot
  const cityZip = out.city.match(/^(.*?)\s+([A-Z]{2})\s+(\d{5})$/i);
  if (cityZip) {
    out.city = cityZip[1];
    out.state = cityZip[2].toUpperCase();
    out.zip = cityZip[3];
  }
  return out;
}

/** Pulls DOM / DOS / kids / property facts out of free-text intake notes. */
export function parseFamilyNotes(notes: string): Record<string, string> {
  const d: Record<string, string> = {};
  const dom = notes.match(/\bDOM\s*[:\-]?\s*([\d/\-]+)/i);
  const dos = notes.match(/\bDOS\s*[:\-]?\s*([\d/\-]+)/i);
  if (dom) {
    const v = parseLooseDate(dom[1]);
    if (v) d.date_of_marriage = v;
  }
  if (dos) {
    const v = parseLooseDate(dos[1]);
    if (v) d.date_of_separation = v;
  }
  if (/\bno\s+(kids|children|hijos)\b/i.test(notes)) d.has_children = "no";
  else {
    const kids = notes.match(/\b(\d+)\s+(kids|children|hijos)\b/i);
    if (kids) {
      d.has_children = "yes";
      d.children_count = kids[1];
    }
  }
  if (/\bno\s+(prop|property|propiedad)\b/i.test(notes)) d.has_property = "no";
  return d;
}

export type SheetRow = Record<"timestamp" | "name" | "address" | "phone" | "email" | "matter" | "fees" | "payment" | "notes" | "status", string>;

const HEADER_ALIASES: Record<keyof SheetRow, string[]> = {
  timestamp: ["timestamp", "date", "fecha"],
  name: ["name", "nombre", "client", "client name"],
  address: ["address", "dirección", "direccion"],
  phone: ["phone", "teléfono", "telefono", "phone number"],
  email: ["e-mail", "email", "correo"],
  matter: ["matter", "service", "servicio", "case type"],
  fees: ["fee(s)", "fees", "fee", "honorarios"],
  payment: ["payment", "pago", "paid"],
  notes: ["notes", "notas"],
  status: ["status", "estado"],
};

export function rowsFromSheet(values: string[][]): SheetRow[] {
  if (!values.length) return [];
  const header = values[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as (keyof SheetRow)[]).map((k) => [k, header.findIndex((h) => HEADER_ALIASES[k].includes(h))]),
  ) as Record<keyof SheetRow, number>;
  return values
    .slice(1)
    .map((r) => Object.fromEntries((Object.keys(idx) as (keyof SheetRow)[]).map((k) => [k, idx[k] >= 0 ? String(r[idx[k]] ?? "").trim() : ""])) as SheetRow)
    .filter((r) => r.name);
}

export interface MappedIntake {
  key: string;
  contact: {
    firstName: string;
    middleName: string;
    lastName: string;
    phone: string;
    phoneAlt: string;
    email: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
  };
  displayName: string;
  matter: MatterGuess;
  matterText: string;
  openedOn: string | null;
  feeCents: number;
  paymentCents: number;
  notes: string;
  details: Record<string, string>;
  statusText: string;
  warnings: string[];
}

export function mapSheetRow(r: SheetRow): MappedIntake {
  const warnings: string[] = [];
  const name = splitName(titleCase(r.name));
  const [phone, phoneAlt] = splitPhones(r.phone);
  const email = cleanEmail(r.email);
  if (r.email && !email) warnings.push("email_skipped");
  const matter = guessMatter(r.matter);
  if (!r.matter || matter.type === "other") warnings.push("matter_unmapped");
  const feeCents = parseMoneyToCents(r.fees) ?? 0;
  const paymentCents = parseMoneyToCents(r.payment) ?? 0;
  if (r.fees && parseMoneyToCents(r.fees) === null) warnings.push("fee_unparsed");
  const details = matter.area === "family" ? parseFamilyNotes(r.notes) : {};
  const openedOn = parseLooseDate(r.timestamp);
  return {
    key: `${r.timestamp}|${r.name}`.toLowerCase(),
    contact: { ...name, phone, phoneAlt, email, ...parseAddress(r.address) },
    displayName: name.lastName ? `${name.lastName}, ${[name.firstName, name.middleName].filter(Boolean).join(" ")}` : name.firstName,
    matter,
    matterText: r.matter,
    openedOn,
    feeCents,
    paymentCents,
    notes: r.notes,
    details,
    statusText: r.status,
    warnings,
  };
}

export function statusFromText(text: string, openedOn: string | null, policy: "age" | "active" | "closed", today: string): "active" | "closed" | "intake" {
  const s = text.toLowerCase();
  if (/closed|done|complete|finished|cerrado|terminado/.test(s)) return "closed";
  if (/active|open|pending|abierto|activo/.test(s)) return "active";
  if (policy === "active") return "active";
  if (policy === "closed") return "closed";
  if (!openedOn) return "active";
  const ageDays = (Date.parse(today) - Date.parse(openedOn)) / 86_400_000;
  return ageDays > 365 ? "closed" : "active";
}

/** Parses "Acosta, Francisco — UD (Plaintiff)" (also accepts "-" or "–" separators). */
export function parseCaseFolderName(name: string): { lastName: string; firstName: string; typeText: string; sideText: string } | null {
  const m = name.match(/^\s*(.+?)\s+[—–-]\s+(.+?)\s*(?:\(([^)]+)\))?\s*$/);
  if (!m) return null;
  const who = m[1];
  const [last, first] = who.includes(",") ? who.split(",", 2).map((s) => s.trim()) : [who.trim(), ""];
  return { lastName: last, firstName: first ?? "", typeText: m[2], sideText: m[3] ?? "" };
}

/** Best-effort extraction from a matter's "00 Intake" doc text. */
export function parseIntakeDoc(text: string): { caseNumber?: string; caption?: string; courthouse?: string } {
  const clean = text.replace(/\*\*/g, "");
  const out: { caseNumber?: string; caption?: string; courthouse?: string } = {};
  const cn = clean.match(/Case number:\s*([0-9]{2}[A-Z]{2,6}[0-9]{3,8})/i);
  if (cn) out.caseNumber = cn[1].toUpperCase();
  const cap = clean.match(/Matter name:\s*([^\n]+)/i);
  if (cap && !/NEEDED/i.test(cap[1])) out.caption = cap[1].trim().replace(/\.$/, "");
  const house = clean.match(/\b(Stanley Mosk|Compton|Long Beach|Deukmejian|Inglewood|Torrance|Norwalk|Pasadena|Van Nuys|Santa Monica|Chatsworth|Pomona|Lancaster|Alhambra|Bellflower|Downey|West Covina|Burbank|Glendale)\b/i);
  if (house) out.courthouse = house[1].replace(/Deukmejian/i, "Governor George Deukmejian (Long Beach)");
  return out;
}
