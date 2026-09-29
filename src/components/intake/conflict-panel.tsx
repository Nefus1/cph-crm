"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/components/app/app-data";
import { ADVERSE_ROLES, optionLabel, PARTY_ROLES } from "@/config/practice-areas";
import { runConflictCheck } from "@/server/actions/search";
import type { ConflictHit } from "@/server/queries/search";
import { cn } from "@/lib/utils";

export function ConflictResults({ hits, compact }: { hits: ConflictHit[]; compact?: boolean }) {
  const t = useTranslations("conflicts");
  const { locale } = useAppData();
  return (
    <ul className="space-y-2">
      {hits.map((h) => {
        const adverse = h.roles.some((r) => ADVERSE_ROLES.has(r.role));
        return (
          <li key={h.contactId} className={cn("rounded-lg border p-3", adverse ? "border-danger/30 bg-danger-soft/50" : "border-border bg-surface")}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/contacts/${h.contactId}`} target={compact ? "_blank" : undefined} className="text-sm font-medium hover:text-primary">
                {h.displayName}
              </Link>
              <Badge tone={h.exact ? "danger" : "warning"}>{h.exact ? t("strong") : t("possible")}</Badge>
            </div>
            {h.phone || h.email ? <div className="mt-0.5 text-xs text-muted">{[h.phone, h.email].filter(Boolean).join(" · ")}</div> : null}
            {h.roles.length ? (
              <ul className="mt-2 space-y-1">
                {h.roles.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge tone={r.role === "client" ? "primary" : ADVERSE_ROLES.has(r.role) ? "danger" : "neutral"}>{optionLabel(PARTY_ROLES, r.role, locale)}</Badge>
                    <Link href={`/matters/${r.matterId}`} target={compact ? "_blank" : undefined} className="truncate text-muted hover:text-foreground">
                      {r.matterName}
                    </Link>
                    {r.status === "closed" ? <span className="text-subtle">({t("closed")})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-muted">{t("noMatters")}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Live conflict check that re-runs as names change (debounced). */
export function ConflictPanel({ names }: { names: string[] }) {
  const t = useTranslations("conflicts");
  const [hits, setHits] = useState<ConflictHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = names.map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 3).join("|");
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    if (!key) {
      const clear = setTimeout(() => id === req.current && setHits(null), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await runConflictCheck(key.split("|")).catch(() => []);
      if (id === req.current) {
        setHits(res);
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [key]);

  return (
    <div className="rounded-card border border-border bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {loading ? <Loader2 className="size-4 animate-spin text-muted" /> : hits && hits.length ? <ShieldAlert className="size-4 text-warning" /> : <ShieldCheck className="size-4 text-muted" />}
        <h3 className="text-sm font-semibold">{t("live")}</h3>
      </div>
      <div className="p-3">
        {!key ? (
          <p className="px-1 py-2 text-xs text-muted">{t("liveHint")}</p>
        ) : hits && hits.length === 0 && !loading ? (
          <p className="flex items-center gap-2 px-1 py-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> {t("clear")}
          </p>
        ) : hits ? (
          <>
            <p className="mb-2 px-1 text-xs text-muted">{t("reviewHint")}</p>
            <ConflictResults hits={hits} compact />
          </>
        ) : null}
      </div>
    </div>
  );
}
