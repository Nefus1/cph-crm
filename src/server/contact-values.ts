import { contactDisplayName } from "@/lib/names";
import { formatPhone, phoneDigits } from "@/lib/phone";
import type { contactInput } from "@/server/schemas";

/** Normalizes parsed contact input into DB column values. */
export function contactValues(input: ReturnType<(typeof contactInput)["parse"]>) {
  const phone = formatPhone(input.phone);
  const phoneAlt = formatPhone(input.phoneAlt);
  return {
    ...input,
    phone,
    phoneAlt,
    phoneDigits: phoneDigits(phone),
    phoneAltDigits: phoneDigits(phoneAlt),
    displayName: contactDisplayName(input),
  };
}

