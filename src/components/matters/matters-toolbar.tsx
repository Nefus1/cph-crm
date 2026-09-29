"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Columns3, List, Loader2, Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { useAppData } from "@/components/app/app-data";
import { areaConfig, PRACTICE_AREAS, t as tl } from "@/config/practice-areas";
import { cn } from "@/lib/utils";

export function MattersToolbar({ area, view, side, count }: { area: string; view: "list" | "board"; side?: string; count: number }) {
  const t = useTranslations("matters");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { staff, locale, me } = useAppData();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => update({ q: q || null }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const tabs = ["all", ...PRACTICE_AREAS];
  const cfg = area !== "all" ? areaConfig(area) : null;

  return (
    <div className="mb-4 space-y-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((a) => (
          <button
            key={a}
            onClick={() => update({ area: a === "all" ? null : a, side: null, view: a === "all" ? null : params.get("view") })}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              area === a ? "bg-surface text-foreground shadow-card ring-1 ring-border" : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {a === "all" ? t("allAreas") : tl(areaConfig(a).label, locale)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filterPlaceholder")} className="pl-8" />
          {q ? (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground" aria-label="Clear">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Select className="w-auto" value={params.get("status") ?? "open"} onChange={(e) => update({ status: e.target.value === "open" ? null : e.target.value })}>
          <option value="open">{t("status.open")}</option>
          <option value="intake">{t("status.intake")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="closed">{t("status.closed")}</option>
          <option value="all">{t("status.all")}</option>
        </Select>
        <Select className="w-auto" value={params.get("assignee") ?? ""} onChange={(e) => update({ assignee: e.target.value || null })}>
          <option value="">{t("anyone")}</option>
          <option value={me.id}>{t("assignedToMe")}</option>
          {staff
            .filter((s) => s.id !== me.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.email}
              </option>
            ))}
          <option value="unassigned">{t("unassigned")}</option>
        </Select>
        {params.get("balance") === "1" ? (
          <button onClick={() => update({ balance: null })} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary-soft px-3 text-sm text-primary-soft-foreground">
            {t("withBalance")} <X className="size-3.5" />
          </button>
        ) : null}
        {cfg && side && Object.keys(cfg.stages).length > 1 && view === "board" ? (
          <Select className="w-auto" value={side} onChange={(e) => update({ side: e.target.value })}>
            {cfg.sides.map((s) => (
              <option key={s.value} value={s.value}>
                {tl(s.label, locale)}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {pending ? <Loader2 className="size-4 animate-spin text-muted" /> : <span className="text-xs text-muted">{t("count", { count })}</span>}
          <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card">
            <button
              onClick={() => update({ view: null })}
              className={cn("rounded-md p-1.5", view === "list" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground")}
              aria-label={t("listView")}
              title={t("listView")}
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => (area === "all" ? update({ area: "ud", view: "board" }) : update({ view: "board" }))}
              className={cn("rounded-md p-1.5", view === "board" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground")}
              aria-label={t("boardView")}
              title={area === "all" ? t("boardNeedsArea") : t("boardView")}
            >
              <Columns3 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
