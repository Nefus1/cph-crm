import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normalizes US phone numbers to "(310) 614-0806"; keeps other input readable. */
export function formatPhone(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const p = parsePhoneNumberFromString(raw, "US");
  if (p && p.isValid()) return p.country === "US" ? p.formatNational() : p.formatInternational();
  return raw;
}

/** Digits only (without leading US country code) for searching / dedupe. */
export function phoneDigits(input: string | null | undefined): string {
  const d = (input ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** E.164 for tel:/sms: links. */
export function phoneHref(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  const p = parsePhoneNumberFromString(raw, "US");
  if (p && p.isValid()) return p.number;
  return raw.replace(/[^\d+]/g, "");
}

/** Splits "562-244-2554 / 562-228-4166" style input into [primary, alt]. */
export function splitPhones(input: string | null | undefined): [string, string] {
  const parts = (input ?? "")
    .split(/\s*(?:\/|,|;|\bor\b|\by\b)\s*/i)
    .map((s) => s.trim())
    .filter((s) => phoneDigits(s).length >= 7);
  return [parts[0] ?? "", parts[1] ?? ""];
}
