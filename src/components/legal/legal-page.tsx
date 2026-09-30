import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Scale } from "lucide-react";

export async function LegalPage({ title, sections }: { title: string; sections: { heading?: string; body: string }[] }) {
  const t = await getTranslations("legal");
  return (
    <main className="min-h-dvh bg-background px-4 py-12">
      <article className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="size-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">Centro Para Legal Hispano</div>
            <div className="text-xs text-muted">CPH CRM</div>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{t("updated")}</p>
        <div className="mt-8 space-y-6">
          {sections.map((s, i) => (
            <section key={i}>
              {s.heading ? <h2 className="mb-1.5 text-base font-semibold">{s.heading}</h2> : null}
              <p className="text-sm leading-relaxed text-foreground/85">{s.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex gap-4 border-t border-border pt-6 text-sm">
          <Link href="/login" className="text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
          <Link href="/privacy" className="text-muted hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="text-muted hover:text-foreground">
            {t("terms")}
          </Link>
        </div>
      </article>
    </main>
  );
}
