import { z } from "zod";
import { PRACTICE_AREAS } from "@/config/practice-areas";

const trimmed = (max = 500) => z.string().trim().max(max);
const optionalDate = z
  .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const requiredDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const uuidOrNull = z
  .string()
  .uuid()
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v ? v : null));

export const contactInput = z.object({
  kind: z.enum(["person", "organization"]).default("person"),
  firstName: trimmed(100).default(""),
  middleName: trimmed(100).default(""),
  lastName: trimmed(100).default(""),
  orgName: trimmed(200).default(""),
  preferredLanguage: z.enum(["es", "en", "other"]).default("es"),
  phone: trimmed(40).default(""),
  phoneAlt: trimmed(40).default(""),
  email: z.string().trim().toLowerCase().email().or(z.literal("")).default(""),
  addressLine1: trimmed(200).default(""),
  addressLine2: trimmed(200).default(""),
  city: trimmed(100).default(""),
  state: trimmed(40).default("CA"),
  zip: trimmed(20).default(""),
  dateOfBirth: optionalDate,
  howFoundUs: trimmed(200).default(""),
  notes: trimmed(5000).default(""),
});
export type ContactInput = z.input<typeof contactInput>;

export const partyInput = z.object({
  contactId: z.string().uuid().optional(),
  contact: contactInput.optional(),
  role: z.string().min(1).max(40),
});

export const matterCoreInput = z.object({
  practiceArea: z.enum(PRACTICE_AREAS),
  matterType: z.string().min(1).max(40),
  side: z.string().max(40).default("na"),
  caption: trimmed(300).default(""),
  status: z.enum(["intake", "active", "closed"]).default("active"),
  stage: z.string().max(60).optional(),
  assigneeId: uuidOrNull,
  supervisingAttorney: trimmed(120).default(""),
  openedOn: optionalDate,
  courthouse: trimmed(120).default(""),
  caseNumber: trimmed(60).default(""),
  department: trimmed(60).default(""),
  judge: trimmed(120).default(""),
  feeType: z.enum(["flat", "hourly", "none"]).default("flat"),
  flatFeeCents: z.number().int().min(0).max(100_000_000).default(0),
  details: z.record(z.string(), z.string().max(2000)).default({}),
  summary: trimmed(10000).default(""),
});

export const intakeInput = z.object({
  client: z.object({ contactId: z.string().uuid().optional(), contact: contactInput.optional() }),
  matter: matterCoreInput,
  otherParties: z.array(partyInput).max(20).default([]),
  initialPaymentCents: z.number().int().min(0).max(100_000_000).default(0),
  paymentMethod: trimmed(40).default(""),
  note: trimmed(10000).default(""),
  createDriveFolder: z.boolean().default(true),
});
export type IntakeInput = z.input<typeof intakeInput>;

export const taskInput = z.object({
  matterId: uuidOrNull,
  title: z.string().trim().min(1).max(300),
  notes: trimmed(5000).default(""),
  assigneeId: uuidOrNull,
  dueDate: optionalDate,
  urgent: z.boolean().default(false),
});

export const eventInput = z.object({
  matterId: uuidOrNull,
  kind: z.enum(["hearing", "deadline", "appointment"]),
  title: z.string().trim().min(1).max(300),
  date: requiredDate,
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .or(z.literal(""))
    .nullish()
    .transform((v) => (v ? v : null)),
  durationMinutes: z.number().int().min(5).max(24 * 60).default(60),
  location: trimmed(300).default(""),
  notes: trimmed(5000).default(""),
  ladder: z.enum(["service", "filing", "none"]).default("none"),
  status: z.enum(["scheduled", "done", "continued", "vacated"]).default("scheduled"),
  computedFrom: trimmed(200).nullish(),
});

export const ledgerInput = z.object({
  matterId: z.string().uuid(),
  kind: z.enum(["charge", "payment", "adjustment"]),
  description: trimmed(300).default(""),
  amountCents: z.number().int().min(-100_000_000).max(100_000_000),
  entryDate: requiredDate,
  method: trimmed(40).default(""),
  reference: trimmed(120).default(""),
});

export const activityInput = z.object({
  matterId: uuidOrNull,
  contactId: uuidOrNull,
  type: z.enum(["note", "call", "email", "meeting", "sms"]),
  body: z.string().trim().min(1).max(20000),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});
