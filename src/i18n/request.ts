import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { getCurrentStaff } from "@/lib/auth";

export type AppLocale = "en" | "es";

async function resolveLocale(): Promise<AppLocale> {
  try {
    const me = await getCurrentStaff();
    if (me?.locale === "es" || me?.locale === "en") return me.locale;
  } catch {
    // Not signed in / DB unavailable on public pages
  }
  const c = (await cookies()).get("cph_locale")?.value;
  if (c === "es" || c === "en") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("es") ? "es" : "en";
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: "America/Los_Angeles",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
