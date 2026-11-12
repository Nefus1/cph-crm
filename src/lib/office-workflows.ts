import { z } from "zod";

export const paperworkStatuses = ["needed", "drafting", "ready_for_review", "changes_requested", "ready_to_file", "filed"] as const;
export const communicationChannels = ["gmail", "dialpad", "whatsapp"] as const;
export const contactOutcomes = ["reached", "no_response", "left_message", "resolved"] as const;
export const officeDate = z.iso.date();
const optionalStaff = z.string().uuid().nullable();
export const documentUrl = z.union([
  z.literal(""),
  z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "invalid_input"),
]);
export const paperworkInput = z.object({
  matterId: z.string().uuid(),
  title: z.string().trim().min(1).max(250),
  formNumber: z.string().max(100),
  revision: z.string().max(100),
  source: z.enum(["pdf", "docx", "clio_draft"]),
  fileUrl: documentUrl,
  preparerId: optionalStaff,
  reviewerId: optionalStaff,
  targetDate: officeDate.nullable(),
  missingInformation: z.string().max(10000),
  status: z.enum(paperworkStatuses),
});
export const followUpInput = z.object({
  matterId: z.string().uuid(),
  contactId: z.string().uuid(),
  title: z.string().trim().min(1).max(250),
  notes: z.string().max(10000),
  assigneeId: z.string().uuid(),
  dueDate: officeDate,
  channel: z.enum(communicationChannels),
  waiting: z.boolean(),
});
export const contactAttemptInput = z
  .object({
    taskId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    outcome: z.enum(contactOutcomes),
    channel: z.enum(communicationChannels),
    notes: z.string().max(10000),
    nextDate: officeDate.nullable(),
  })
  .refine((value) => value.outcome === "resolved" || value.nextDate !== null, "invalid_input");

export function followUpBucket(dueDate: string, waiting: boolean, today: string) {
  return { overdue: dueDate < today, today: dueDate === today, upcoming: dueDate > today, waiting };
}

/** Launching a composer never records a contact attempt or sends a message. */
export function gmailCompose(email: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: email, su: subject, body })}`;
}
export function whatsappCompose(internationalPhone: string, body: string) {
  const phone = internationalPhone.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return `https://wa.me/${phone.slice(1)}?${new URLSearchParams({ text: body })}`;
}
export const progressInput = z.object({
  nextActionId: z.string().uuid().nullable(),
  blocker: z.enum(["client", "office", "court", "attorney", "other"]).nullable(),
  blockerNote: z.string().max(10000),
  blockerReviewDate: officeDate.nullable(),
  pinnedNote: z.string().max(20000),
});
export const requestInput = z.object({
  matterId: z.string().uuid(),
  title: z.string().trim().min(1).max(250),
  status: z.enum(["requested", "received", "reviewed"]),
  followUpTaskId: z.string().uuid().nullable(),
});
export const templateInput = z
  .object({
    practiceArea: z.enum(["ud", "family", "probate", "trust", "general"]),
    title: z.string().trim().min(1).max(250),
    items: z
      .array(z.object({ key: z.string().min(1).max(100), en: z.string().min(1).max(250), es: z.string().min(1).max(250), formNumber: z.string().max(100) }))
      .min(1)
      .max(100),
  })
  .refine((v) => new Set(v.items.map((i) => i.key)).size === v.items.length);
