export interface NameParts {
  firstName: string;
  middleName: string;
  lastName: string;
}

const PARTICLES = new Set(["de", "del", "la", "las", "los", "van", "von", "da", "di", "y"]);

/** Common second given names (Juan Carlos, María José…) — treated as middle names. */
const GIVEN_NAMES = new Set(
  "carlos jose josé luis maria maría elena guadalupe antonio manuel alberto isabel fernanda alejandro miguel angel ángel eduardo francisco javier jesus jesús enrique alonso andres andrés david daniel ernesto fernando gabriel ignacio jorge ramon ramón rafael ricardo roberto salvador sofia sofía teresa victoria lucia lucía paola patricia beatriz esther rosa luz del carmen ana juan pablo michael james john robert marie ann anne lynn lee".split(" "),
);

/**
 * Splits a free-text name. Handles "Last, First" and "First [Middle] Last".
 * Hispanic names often carry two surnames, so 4+ tokens treat the last two as
 * surnames ("Juan Carlos Maldonado Fonseca" → "Maldonado Fonseca"). With 3 tokens
 * the middle token is a given name only when it is an initial or a common given
 * name ("Juan Carlos Ramirez"); otherwise it is the first surname.
 */
export function splitName(full: string): NameParts {
  const clean = full.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", middleName: "", lastName: "" };
  if (clean.includes(",")) {
    const [last, rest] = clean.split(",", 2).map((s) => s.trim());
    const restParts = rest.split(" ").filter(Boolean);
    return { firstName: restParts[0] ?? "", middleName: restParts.slice(1).join(" "), lastName: last };
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  // Keep particles attached to the surname ("Maria de la Cruz")
  const pIdx = parts.findIndex((p, i) => i > 0 && PARTICLES.has(p.toLowerCase()));
  if (pIdx > 0) {
    return { firstName: parts[0], middleName: parts.slice(1, pIdx).join(" "), lastName: parts.slice(pIdx).join(" ") };
  }
  if (parts.length === 3) {
    // "Ulises C. Ramirez" / "Juan Carlos Ramirez" → middle name; "Normando Rivas Quinonez" → two surnames
    const mid = parts[1].toLowerCase();
    if (/^[a-z]\.?$/i.test(parts[1]) || GIVEN_NAMES.has(mid)) return { firstName: parts[0], middleName: parts[1], lastName: parts[2] };
    return { firstName: parts[0], middleName: "", lastName: `${parts[1]} ${parts[2]}` };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -2).join(" "),
    lastName: parts.slice(-2).join(" "),
  };
}

export function contactDisplayName(c: { kind?: string; firstName?: string; middleName?: string; lastName?: string; orgName?: string }) {
  if (c.kind === "organization") return (c.orgName ?? "").trim() || "Unnamed organization";
  const first = [c.firstName, c.middleName].filter(Boolean).join(" ").trim();
  const last = (c.lastName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return last || first || "Unnamed";
}

/** "First Last" for greetings / titles. */
export function contactShortName(c: { kind?: string; firstName?: string; lastName?: string; orgName?: string; displayName?: string }) {
  if (c.kind === "organization") return c.orgName || c.displayName || "";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.displayName || "";
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
