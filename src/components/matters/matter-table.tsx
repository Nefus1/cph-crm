import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AreaBadge } from "@/components/app/area-badge";
import { areaConfig, optionLabel, stageLabel, type Locale } from "@/config/practice-areas";
import { formatDate, relativeDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { MatterRow } from "@/server/queries/matters";
import { cn } from "@/lib/utils";

export async function MatterTable({ rows, locale }: { rows: MatterRow[]; locale: Locale }) {
  const t = await getTranslations("matters");
  return (
    <Card className="overflow-hidden">
      {/* Phones: compact cards */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/matters/${r.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-surface-2">
              <AreaBadge area={r.practiceArea} locale={locale} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.displayName}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{stageLabel(r.practiceArea, r.side, r.stage, locale)}</span>
                  {r.caseNumber ? <span className="font-mono">{r.caseNumber}</span> : null}
                  {r.nextDate ? <span>{formatDate(r.nextDate, locale, { month: "short", day: "numeric", year: undefined })}</span> : null}
                </div>
              </div>
              {r.balance > 0 ? <span className="text-sm font-medium tabular-nums">{formatCents(r.balance, locale)}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-left text-xs font-medium text-muted">
              <th className="px-4 py-2.5 font-medium">{t("col.matter")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.stage")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.case")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.nextDate")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.assignee")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("col.balance")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const cfg = areaConfig(r.practiceArea);
              const nd = r.nextDate ? relativeDays(r.nextDate) : null;
              return (
                <tr key={r.id} className="group relative transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <Link href={`/matters/${r.id}`} className="flex min-w-0 items-start gap-2.5 after:absolute after:inset-0">
                      <AreaBadge area={r.practiceArea} locale={locale} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{r.displayName}</div>
                        <div className="truncate text-xs text-muted">
                          {r.caption || optionLabel(cfg.types, r.matterType, locale)} · {r.number}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.status === "intake" ? <Badge tone="warning">{t("status.intake")}</Badge> : r.status === "closed" ? <Badge>{t("status.closed")}</Badge> : null}
                      <span className="truncate text-muted">{stageLabel(r.practiceArea, r.side, r.stage, locale)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{r.caseNumber || "—"}</td>
                  <td className="px-3 py-3">
                    {r.nextDate ? (
                      <span className={cn("text-xs", nd !== null && nd <= 2 ? "font-medium text-warning" : "text-muted")}>{formatDate(r.nextDate, locale, { month: "short", day: "numeric", year: undefined })}</span>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {r.assigneeName ? (
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Avatar name={r.assigneeName} className="size-6 text-[10px]" />
                        <span className="truncate">{r.assigneeName.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </td>
                  <td className={cn("px-4 py-3 text-right tabular-nums", r.balance > 0 ? "font-medium" : "text-subtle")}>{r.balance !== 0 ? formatCents(r.balance, locale) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
