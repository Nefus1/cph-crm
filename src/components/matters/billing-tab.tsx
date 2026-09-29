import { getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/config/practice-areas";
import { formatDate } from "@/lib/dates";
import { formatCents, ledgerTotals } from "@/lib/money";
import type { MatterDetail } from "@/server/queries/matters";
import { cn } from "@/lib/utils";
import { AddLedgerEntry, DeleteLedgerButton, PrintButton } from "./billing-actions";

export async function BillingTab({ data, locale, isAdmin, meId }: { data: MatterDetail; locale: Locale; isAdmin: boolean; meId: string }) {
  const t = await getTranslations("billing");
  const entries = data.ledger.map((l) => l.entry);
  const totals = ledgerTotals(entries);
  const runningBalances = data.ledger.reduce<number[]>((acc, { entry }) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + (entry.kind === "payment" ? -entry.amountCents : entry.amountCents));
    return acc;
  }, []);
  const client = data.parties.find((p) => p.party.role === "client")?.contact;

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">Centro Para Legal Hispano — {t("statement")}</h2>
        <p className="text-sm">
          {client?.displayName} · {data.matter.displayName} · {data.matter.number}
        </p>
        <p className="text-sm">{formatDate(new Date().toISOString().slice(0, 10), locale)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("charges"), value: totals.charges },
          { label: t("payments"), value: totals.payments },
          { label: t("adjustments"), value: totals.adjustments },
          { label: t("balance"), value: totals.balance, strong: true },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-card border border-border bg-surface p-4 shadow-card", s.strong && "border-primary/30 bg-primary-soft/40")}>
            <div className="text-xs font-medium text-muted">{s.label}</div>
            <div className={cn("mt-1.5 text-xl font-semibold tabular-nums", s.strong && s.value > 0 && "text-foreground", s.strong && s.value <= 0 && "text-success")}>{formatCents(s.value, locale)}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          icon={<Receipt />}
          title={t("ledger")}
          description={t("ledgerHint")}
          action={
            <div className="no-print flex gap-1">
              <PrintButton label={t("print")} />
              <AddLedgerEntry matterId={data.matter.id} />
            </div>
          }
        />
        {entries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">{t("date")}</th>
                  <th className="px-3 py-2 font-medium">{t("description")}</th>
                  <th className="px-3 py-2 font-medium">{t("method")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("amount")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("running")}</th>
                  <th className="no-print w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.ledger.map(({ entry, authorName }, idx) => {
                  const running = runningBalances[idx];
                  const canDelete = isAdmin || entry.createdBy === meId;
                  return (
                    <tr key={entry.id} className="group">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDate(entry.entryDate, locale)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge tone={entry.kind === "payment" ? "success" : entry.kind === "charge" ? "neutral" : "warning"}>{t(`kind.${entry.kind as "charge"}`)}</Badge>
                          <span>{entry.description}</span>
                        </div>
                        {entry.reference || authorName ? <div className="mt-0.5 text-xs text-subtle">{[entry.reference, authorName].filter(Boolean).join(" · ")}</div> : null}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{entry.method}</td>
                      <td className={cn("px-3 py-2.5 text-right tabular-nums", entry.kind === "payment" && "text-success")}>
                        {entry.kind === "payment" ? "−" : ""}
                        {formatCents(Math.abs(entry.amountCents), locale)}
                        {entry.kind === "adjustment" && entry.amountCents < 0 ? ` ${t("credit")}` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatCents(running, locale)}</td>
                      <td className="no-print px-2 py-2.5 text-right">{canDelete ? <DeleteLedgerButton id={entry.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Receipt />} title={t("empty")} description={t("emptyHint")} />
        )}
      </Card>
      <p className="text-xs text-muted">{t("notTrust")}</p>
    </div>
  );
}
