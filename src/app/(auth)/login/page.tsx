import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { devAuthBypass, supabaseConfigured } from "@/lib/env";
import { Scale } from "lucide-react";
import { LoginButton } from "./login-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const t = await getTranslations("auth");
  const tl = await getTranslations("legal");
  if (devAuthBypass() || (supabaseConfigured() && (await getCurrentStaff().catch(() => null)))) redirect("/");
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--primary-soft),transparent)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Scale className="size-7" strokeWidth={2.25} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Centro Para Legal Hispano</h1>
          <p className="mt-1 text-sm text-muted">{t("tagline")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-pop">
          {sp.error ? <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{t("error")}</p> : null}
          {supabaseConfigured() ? (
            <LoginButton next={next} label={t("google")} />
          ) : (
            <p className="text-sm text-muted">{t("notConfigured")}</p>
          )}
          <p className="mt-4 text-center text-xs text-muted">{t("inviteOnly")}</p>
        </div>
        <div className="mt-6 flex justify-center gap-4 text-xs text-muted">
          <Link href="/privacy" className="hover:text-foreground">
            {tl("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {tl("terms")}
          </Link>
        </div>
      </div>
    </main>
  );
}
