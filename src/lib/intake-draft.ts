import { z } from "zod";
import { PRACTICE_AREAS } from "@/config/practice-areas";
const text = z.string().max(10000);
export const draftPayloadSchema = z.object({
  picked: z.object({ id: z.string().uuid(), title: text, subtitle: text.optional() }).nullable(),
  client: z.object({
    firstName: text,
    middleName: text,
    lastName: text,
    phone: text,
    phoneAlt: text,
    email: text,
    addressLine1: text,
    city: text,
    state: text,
    zip: text,
    preferredLanguage: z.enum(["en", "es", "other"]),
    howFoundUs: text,
    dateOfBirth: text,
  }),
  area: z.enum(PRACTICE_AREAS).nullable(),
  matterType: text,
  side: text,
  caption: text,
  caseNumber: text,
  courthouse: text,
  details: z.record(z.string().max(100), text),
  others: z.array(z.object({ name: text, role: text, phone: text, contactId: z.string().uuid().optional() })).max(20),
  feeType: z.enum(["flat", "hourly", "none"]),
  fee: text,
  payment: text,
  method: text,
  retained: z.boolean(),
  assigneeId: z.string().uuid().or(z.literal("")),
  supervising: text,
  note: text,
  drive: z.boolean(),
  step: z.number().int().min(0).max(3),
});
export type DraftPayload = z.infer<typeof draftPayloadSchema>;
export type SavedDraft = { id: string; version: number; payload: DraftPayload; updatedAt: Date | string };
