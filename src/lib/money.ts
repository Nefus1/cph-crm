/** All money is stored as integer cents. */

export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function formatCents(cents: number | null | undefined, locale: string = "en") {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function centsToInput(cents: number | null | undefined) {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

export interface LedgerLike {
  kind: string;
  amountCents: number;
}

export function ledgerTotals(entries: LedgerLike[]) {
  let charges = 0;
  let payments = 0;
  let adjustments = 0;
  for (const e of entries) {
    if (e.kind === "charge") charges += e.amountCents;
    else if (e.kind === "payment") payments += e.amountCents;
    else if (e.kind === "adjustment") adjustments += e.amountCents;
  }
  // Adjustments: negative = credit to client, positive = additional amount owed.
  return { charges, payments, adjustments, balance: charges + adjustments - payments };
}
