/**
 * Single source of truth for CPH practice areas: matter types, sides, stages,
 * intake checklists, and the practice-specific fields stored in `matters.details`.
 *
 * Labels are bilingual ({ en, es }). `short` labels are English-only on purpose:
 * they build Drive folder names ("Acosta, Francisco — UD (Plaintiff)") so folders
 * stay consistent with the existing 1A CPH FOLDER/Cases structure.
 */

export type Locale = "en" | "es";
export type L10n = { en: string; es: string };

export const PRACTICE_AREAS = ["ud", "family", "probate", "trust", "general"] as const;
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

export type FieldType = "text" | "textarea" | "date" | "money" | "number" | "select" | "boolean";

export interface DetailField {
  key: string;
  label: L10n;
  type: FieldType;
  options?: { value: string; label: L10n }[];
  placeholder?: string;
  /** Show this field only for these sides (e.g. landlord-only fields). */
  sides?: string[];
}

export interface Option {
  value: string;
  label: L10n;
  /** English short label used in Drive folder names. */
  short?: string;
}

export interface Stage {
  key: string;
  label: L10n;
}

export interface PracticeAreaConfig {
  key: PracticeArea;
  label: L10n;
  /** Short badge text, English (also used in calendar titles: "[UD] ..."). */
  badge: string;
  /** Tailwind-friendly color token name, see globals.css (--area-*) */
  color: string;
  types: Option[];
  sides: Option[];
  /** Stages per side; `default` is used when no side-specific list exists. */
  stages: Record<string, Stage[]>;
  checklist: L10n[];
  fields: DetailField[];
}

const yesNo = [
  { value: "yes", label: { en: "Yes", es: "Sí" } },
  { value: "no", label: { en: "No", es: "No" } },
  { value: "unknown", label: { en: "Unknown", es: "Desconocido" } },
];

const CLOSED: Stage = { key: "closed", label: { en: "Closed", es: "Cerrado" } };

const GENERAL_CHECKLIST: L10n[] = [
  { en: "Client ID verified", es: "Identificación del cliente verificada" },
  { en: "Conflict check completed", es: "Verificación de conflictos completada" },
  { en: "Retainer agreement signed", es: "Contrato de servicios firmado" },
  { en: "Initial consultation notes recorded", es: "Notas de la consulta inicial registradas" },
  { en: "Fee arrangement confirmed", es: "Acuerdo de honorarios confirmado" },
];

export const PRACTICE_AREA_CONFIG: Record<PracticeArea, PracticeAreaConfig> = {
  ud: {
    key: "ud",
    label: { en: "Unlawful Detainer", es: "Desalojo (UD)" },
    badge: "UD",
    color: "ud",
    types: [
      { value: "3day_pay", label: { en: "3-Day Pay or Quit", es: "Aviso de 3 días: pagar o desalojar" }, short: "UD" },
      { value: "3day_perform", label: { en: "3-Day Perform or Quit", es: "Aviso de 3 días: cumplir o desalojar" }, short: "UD" },
      { value: "30day", label: { en: "30-Day Notice", es: "Aviso de 30 días" }, short: "UD" },
      { value: "60day", label: { en: "60-Day Notice", es: "Aviso de 60 días" }, short: "UD" },
      { value: "90day", label: { en: "90-Day Notice", es: "Aviso de 90 días" }, short: "UD" },
      { value: "other", label: { en: "Other UD", es: "Otro desalojo" }, short: "UD" },
    ],
    sides: [
      { value: "plaintiff", label: { en: "Plaintiff (Landlord)", es: "Demandante (Arrendador)" }, short: "Plaintiff" },
      { value: "defendant", label: { en: "Defendant (Tenant)", es: "Demandado (Inquilino)" }, short: "Defendant" },
    ],
    stages: {
      plaintiff: [
        { key: "intake", label: { en: "Intake", es: "Admisión" } },
        { key: "notice_served", label: { en: "Notice Served", es: "Aviso entregado" } },
        { key: "complaint_filed", label: { en: "Complaint Filed", es: "Demanda presentada" } },
        { key: "defendant_served", label: { en: "Defendant Served", es: "Demandado notificado" } },
        { key: "answer_default", label: { en: "Answer / Default", es: "Respuesta / Rebeldía" } },
        { key: "trial_set", label: { en: "Trial Set", es: "Juicio programado" } },
        { key: "judgment", label: { en: "Judgment", es: "Sentencia" } },
        { key: "writ_lockout", label: { en: "Writ & Lockout", es: "Orden y desalojo" } },
        CLOSED,
      ],
      defendant: [
        { key: "intake", label: { en: "Intake", es: "Admisión" } },
        { key: "answer_filed", label: { en: "Answer Filed", es: "Respuesta presentada" } },
        { key: "trial_set", label: { en: "Trial Set", es: "Juicio programado" } },
        { key: "judgment", label: { en: "Judgment", es: "Sentencia" } },
        CLOSED,
      ],
    },
    checklist: [
      { en: "Property address confirmed", es: "Dirección de la propiedad confirmada" },
      { en: "Lease / rental agreement obtained", es: "Contrato de arrendamiento obtenido" },
      { en: "3-day / 30-day notice served (date logged)", es: "Aviso de 3/30 días entregado (fecha registrada)" },
      { en: "Proof of service obtained", es: "Comprobante de entrega obtenido" },
      { en: "Rent ledger / payment history obtained", es: "Historial de pagos de renta obtenido" },
      { en: "Landlord / property owner verified", es: "Arrendador / propietario verificado" },
      { en: "Filing fee confirmed", es: "Cuota de presentación confirmada" },
      { en: "Conflict check completed", es: "Verificación de conflictos completada" },
      { en: "Retainer agreement signed", es: "Contrato de servicios firmado" },
    ],
    fields: [
      { key: "property_address", label: { en: "Property address", es: "Dirección de la propiedad" }, type: "text" },
      { key: "unit", label: { en: "Unit / room", es: "Unidad / cuarto" }, type: "text" },
      { key: "monthly_rent", label: { en: "Monthly rent", es: "Renta mensual" }, type: "money" },
      {
        key: "rent_control",
        label: { en: "Rent control / just cause", es: "Control de renta / causa justa" },
        type: "select",
        options: [
          { value: "la_city_rso", label: { en: "LA City RSO", es: "RSO Ciudad de LA" } },
          { value: "la_county_rstpo", label: { en: "LA County RSTPO", es: "RSTPO Condado de LA" } },
          { value: "ab1482", label: { en: "AB 1482 only", es: "Solo AB 1482" } },
          { value: "local_other", label: { en: "Other local ordinance", es: "Otra ordenanza local" } },
          { value: "none", label: { en: "None / exempt", es: "Ninguno / exento" } },
          { value: "unknown", label: { en: "Unknown — verify", es: "Desconocido — verificar" } },
        ],
      },
      { key: "tenancy_start", label: { en: "Tenancy began", es: "Inicio del arrendamiento" }, type: "date" },
      {
        key: "notice_type",
        label: { en: "Notice type", es: "Tipo de aviso" },
        type: "select",
        options: [
          { value: "3day_pay", label: { en: "3-day pay or quit", es: "3 días pagar o desalojar" } },
          { value: "3day_perform", label: { en: "3-day perform or quit", es: "3 días cumplir o desalojar" } },
          { value: "30day", label: { en: "30-day", es: "30 días" } },
          { value: "60day", label: { en: "60-day", es: "60 días" } },
          { value: "90day", label: { en: "90-day", es: "90 días" } },
        ],
      },
      { key: "notice_served_on", label: { en: "Notice served on", es: "Aviso entregado el" }, type: "date" },
      {
        key: "notice_service_method",
        label: { en: "Service method", es: "Método de entrega" },
        type: "select",
        options: [
          { value: "personal", label: { en: "Personal", es: "Personal" } },
          { value: "substituted", label: { en: "Substituted", es: "Sustituta" } },
          { value: "post_and_mail", label: { en: "Post & mail", es: "Fijar y enviar por correo" } },
          { value: "mail", label: { en: "Mail only (+5 days)", es: "Solo correo (+5 días)" } },
        ],
      },
      { key: "amount_claimed", label: { en: "Amount claimed", es: "Monto reclamado" }, type: "money" },
    ],
  },

  family: {
    key: "family",
    label: { en: "Family Law", es: "Derecho Familiar" },
    badge: "FL",
    color: "family",
    types: [
      { value: "dissolution", label: { en: "Divorce (Dissolution)", es: "Divorcio" }, short: "Divorce" },
      { value: "legal_separation", label: { en: "Legal Separation", es: "Separación legal" }, short: "Legal Separation" },
      { value: "parentage", label: { en: "Parentage", es: "Paternidad" }, short: "Parentage" },
      { value: "custody", label: { en: "Custody / Visitation", es: "Custodia / Visitas" }, short: "Custody" },
      { value: "dvro", label: { en: "Restraining Order (DVRO)", es: "Orden de restricción (DVRO)" }, short: "DVRO" },
      { value: "support", label: { en: "Child / Spousal Support", es: "Manutención" }, short: "Support" },
      { value: "post_judgment", label: { en: "Post-Judgment / RFO", es: "Post-sentencia / RFO" }, short: "Post-Judgment" },
    ],
    sides: [
      { value: "petitioner", label: { en: "Petitioner", es: "Peticionario" }, short: "Petitioner" },
      { value: "respondent", label: { en: "Respondent", es: "Demandado" }, short: "Respondent" },
    ],
    stages: {
      default: [
        { key: "intake", label: { en: "Intake", es: "Admisión" } },
        { key: "petition_filed", label: { en: "Petition Filed", es: "Petición presentada" } },
        { key: "served", label: { en: "Served", es: "Notificado" } },
        { key: "response", label: { en: "Response", es: "Respuesta" } },
        { key: "disclosures", label: { en: "Disclosures", es: "Declaraciones" } },
        { key: "hearings", label: { en: "RFO / Hearings", es: "RFO / Audiencias" } },
        { key: "settlement_trial", label: { en: "Settlement / Trial", es: "Acuerdo / Juicio" } },
        { key: "judgment", label: { en: "Judgment", es: "Sentencia" } },
        CLOSED,
      ],
    },
    checklist: [
      ...GENERAL_CHECKLIST,
      { en: "Marriage / separation dates confirmed", es: "Fechas de matrimonio / separación confirmadas" },
      { en: "Children and custody facts gathered", es: "Información de hijos y custodia recopilada" },
      { en: "Income & expense info requested", es: "Información de ingresos y gastos solicitada" },
    ],
    fields: [
      { key: "date_of_marriage", label: { en: "Date of marriage (DOM)", es: "Fecha de matrimonio" }, type: "date" },
      { key: "date_of_separation", label: { en: "Date of separation (DOS)", es: "Fecha de separación" }, type: "date" },
      { key: "has_children", label: { en: "Minor children?", es: "¿Hijos menores?" }, type: "select", options: yesNo },
      { key: "children_count", label: { en: "Number of children", es: "Número de hijos" }, type: "number" },
      { key: "has_property", label: { en: "Community property?", es: "¿Bienes gananciales?" }, type: "select", options: yesNo },
      { key: "other_party_county", label: { en: "Other party's county / state", es: "Condado / estado de la otra parte" }, type: "text" },
    ],
  },

  probate: {
    key: "probate",
    label: { en: "Conservatorship & Probate", es: "Tutela y Sucesiones" },
    badge: "PB",
    color: "probate",
    types: [
      { value: "conservatorship", label: { en: "Probate Conservatorship", es: "Tutela de adulto (Conservatorship)" }, short: "Conservatorship" },
      { value: "lps", label: { en: "LPS Conservatorship", es: "Tutela LPS" }, short: "LPS Conservatorship" },
      { value: "guardianship", label: { en: "Guardianship", es: "Tutela de menor (Guardianship)" }, short: "Guardianship" },
      { value: "probate_admin", label: { en: "Probate Administration", es: "Sucesión (Probate)" }, short: "Probate" },
    ],
    sides: [
      { value: "petitioner", label: { en: "Petitioner", es: "Peticionario" }, short: "Petitioner" },
      { value: "objector", label: { en: "Objector", es: "Objetante" }, short: "Objector" },
    ],
    stages: {
      default: [
        { key: "intake", label: { en: "Intake", es: "Admisión" } },
        { key: "petition_filed", label: { en: "Petition Filed", es: "Petición presentada" } },
        { key: "notice_served", label: { en: "Notice / Citation Served", es: "Aviso / Citación entregada" } },
        { key: "investigator", label: { en: "Court Investigator", es: "Investigador de la corte" } },
        { key: "hearing", label: { en: "Hearing", es: "Audiencia" } },
        { key: "letters_issued", label: { en: "Letters Issued", es: "Cartas emitidas" } },
        { key: "inventory_accounting", label: { en: "Inventory / Accountings", es: "Inventario / Cuentas" } },
        CLOSED,
      ],
    },
    checklist: [
      ...GENERAL_CHECKLIST,
      { en: "Proposed conservatee / minor information gathered", es: "Información del conservado / menor recopilada" },
      { en: "Relatives list for notice gathered", es: "Lista de familiares para notificación recopilada" },
      { en: "Capacity declaration (GC-335) requested", es: "Declaración de capacidad (GC-335) solicitada" },
    ],
    fields: [
      { key: "protected_person", label: { en: "Conservatee / minor", es: "Conservado / menor" }, type: "text" },
      { key: "protected_person_dob", label: { en: "Their date of birth", es: "Su fecha de nacimiento" }, type: "date" },
      { key: "investigator", label: { en: "Court investigator", es: "Investigador de la corte" }, type: "text" },
      { key: "letters_issued_on", label: { en: "Letters issued on", es: "Cartas emitidas el" }, type: "date" },
      { key: "bond", label: { en: "Bond", es: "Fianza" }, type: "money" },
    ],
  },

  trust: {
    key: "trust",
    label: { en: "Living Trusts & Estate Planning", es: "Fideicomisos y Planificación" },
    badge: "LT",
    color: "trust",
    types: [
      { value: "living_trust", label: { en: "Living Trust", es: "Fideicomiso en vida" }, short: "Living Trust" },
      { value: "will", label: { en: "Will", es: "Testamento" }, short: "Will" },
      { value: "amendment", label: { en: "Trust Amendment", es: "Enmienda de fideicomiso" }, short: "Trust Amendment" },
      { value: "trust_admin", label: { en: "Trust Administration", es: "Administración de fideicomiso" }, short: "Trust Administration" },
    ],
    sides: [{ value: "na", label: { en: "N/A", es: "N/A" }, short: "" }],
    stages: {
      default: [
        { key: "consultation", label: { en: "Consultation", es: "Consulta" } },
        { key: "questionnaire", label: { en: "Questionnaire", es: "Cuestionario" } },
        { key: "drafting", label: { en: "Drafting", es: "Redacción" } },
        { key: "client_review", label: { en: "Client Review", es: "Revisión del cliente" } },
        { key: "signing", label: { en: "Signing", es: "Firma" } },
        { key: "funding", label: { en: "Funding", es: "Financiamiento" } },
        { key: "complete", label: { en: "Complete", es: "Completado" } },
      ],
    },
    checklist: [
      ...GENERAL_CHECKLIST,
      { en: "Trust questionnaire received", es: "Cuestionario de fideicomiso recibido" },
      { en: "Property deeds / assets list received", es: "Escrituras / lista de bienes recibida" },
      { en: "Signing appointment & notary scheduled", es: "Cita de firma y notario programada" },
    ],
    fields: [
      { key: "trustors", label: { en: "Trustor(s)", es: "Fideicomitente(s)" }, type: "text" },
      { key: "successor_trustee", label: { en: "Successor trustee", es: "Fiduciario sucesor" }, type: "text" },
      { key: "signing_date", label: { en: "Signing date", es: "Fecha de firma" }, type: "date" },
      {
        key: "funding_status",
        label: { en: "Funding status", es: "Estado de financiamiento" },
        type: "select",
        options: [
          { value: "not_started", label: { en: "Not started", es: "No iniciado" } },
          { value: "in_progress", label: { en: "In progress", es: "En progreso" } },
          { value: "complete", label: { en: "Complete", es: "Completo" } },
        ],
      },
      { key: "real_property", label: { en: "Real property", es: "Bienes raíces" }, type: "textarea" },
    ],
  },

  general: {
    key: "general",
    label: { en: "General", es: "General" },
    badge: "GEN",
    color: "general",
    types: [
      { value: "small_claims", label: { en: "Small Claims", es: "Reclamos menores" }, short: "Small Claims" },
      { value: "relocation", label: { en: "Relocation Assistance", es: "Asistencia de reubicación" }, short: "Relocation" },
      { value: "civil", label: { en: "Civil", es: "Civil" }, short: "Civil" },
      { value: "other", label: { en: "Other", es: "Otro" }, short: "General" },
    ],
    sides: [
      { value: "na", label: { en: "N/A", es: "N/A" }, short: "" },
      { value: "plaintiff", label: { en: "Plaintiff", es: "Demandante" }, short: "Plaintiff" },
      { value: "defendant", label: { en: "Defendant", es: "Demandado" }, short: "Defendant" },
    ],
    stages: {
      default: [
        { key: "intake", label: { en: "Intake", es: "Admisión" } },
        { key: "active", label: { en: "Active", es: "Activo" } },
        CLOSED,
      ],
    },
    checklist: GENERAL_CHECKLIST,
    fields: [],
  },
};

export function areaConfig(area: string): PracticeAreaConfig {
  return PRACTICE_AREA_CONFIG[(PRACTICE_AREAS as readonly string[]).includes(area) ? (area as PracticeArea) : "general"];
}

export function stagesFor(area: string, side?: string | null): Stage[] {
  const cfg = areaConfig(area);
  return (side && cfg.stages[side]) || cfg.stages.default || Object.values(cfg.stages)[0];
}

export function isFinalStage(area: string, side: string | null | undefined, stage: string): boolean {
  const list = stagesFor(area, side);
  return list[list.length - 1]?.key === stage;
}

export function t(l: L10n | undefined, locale: Locale | string): string {
  if (!l) return "";
  return locale === "es" ? l.es : l.en;
}

export function optionLabel(options: Option[] | undefined, value: string | null | undefined, locale: Locale | string) {
  if (!value) return "";
  const o = options?.find((x) => x.value === value);
  return o ? t(o.label, locale) : value;
}

export function stageLabel(area: string, side: string | null | undefined, stage: string, locale: Locale | string) {
  const s = stagesFor(area, side).find((x) => x.key === stage);
  if (s) return t(s.label, locale);
  // Stage may belong to the other side's list (side changed) — search all lists.
  for (const list of Object.values(areaConfig(area).stages)) {
    const hit = list.find((x) => x.key === stage);
    if (hit) return t(hit.label, locale);
  }
  return stage;
}

/**
 * Drive-style display name: "Last, First — Type (Side)".
 * Mirrors the existing 1A CPH FOLDER/Cases naming convention.
 */
export function buildDisplayName(clientName: string, area: string, type: string, side: string | null | undefined) {
  const cfg = areaConfig(area);
  const typeShort = cfg.types.find((x) => x.value === type)?.short ?? cfg.badge;
  const sideShort = cfg.sides.find((x) => x.value === side)?.short ?? "";
  const name = clientName.trim() || "Unnamed";
  return `${name} — ${typeShort}${sideShort ? ` (${sideShort})` : ""}`;
}

/** Roles a contact can play on a matter. */
export const PARTY_ROLES: Option[] = [
  { value: "client", label: { en: "Client", es: "Cliente" } },
  { value: "co_client", label: { en: "Co-client", es: "Co-cliente" } },
  { value: "opposing_party", label: { en: "Opposing party", es: "Parte contraria" } },
  { value: "opposing_counsel", label: { en: "Opposing counsel", es: "Abogado contrario" } },
  { value: "tenant", label: { en: "Tenant / occupant", es: "Inquilino / ocupante" } },
  { value: "landlord", label: { en: "Landlord / owner", es: "Arrendador / propietario" } },
  { value: "conservatee", label: { en: "Conservatee", es: "Conservado" } },
  { value: "minor", label: { en: "Minor child", es: "Menor" } },
  { value: "relative", label: { en: "Relative", es: "Familiar" } },
  { value: "other", label: { en: "Other", es: "Otro" } },
];

/** Roles that are adverse to our client (flagged red in conflict checks). */
export const ADVERSE_ROLES = new Set(["opposing_party", "opposing_counsel"]);

export const LA_COURTHOUSES = [
  "Stanley Mosk (Central)",
  "Compton",
  "Governor George Deukmejian (Long Beach)",
  "Inglewood",
  "Torrance",
  "Norwalk",
  "Pasadena",
  "Van Nuys",
  "Santa Monica",
  "Chatsworth",
  "Pomona",
  "Lancaster",
  "Alhambra",
  "Airport",
  "Bellflower",
  "Downey",
  "West Covina",
  "Burbank",
  "Glendale",
  "Other",
];
