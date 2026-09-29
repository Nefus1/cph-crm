"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { parseMoneyToCents } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { addLedgerEntry, deleteLedgerEntry } from "@/server/actions/work";
import { cn } from "@/lib/utils";

export const PAYMENT_METHODS = ["Cash", "Zelle", "Card", "Check", "Money order", "Other"];

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}

export function DeleteLedgerButton({ id }: { id: string }) {
  const t = useTranslations("billing");
  const { pending, run } = useAction();
  return (
    <button
      disabled={pending}
      className="rounded p-1 text-subtle opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
      aria-label={t("deleteEntry")}
      onClick={() => confirm(t("deleteConfirm")) && run(() => deleteLedgerEntry(id))}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function AddLedgerEntry({ matterId }: { matterId: string }) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const [kind, setKind] = useState<"payment" | "charge" | "adjustment">("payment");
  const [amount, setAmount] = useState("");
  const [credit, setCredit] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  function reset() {
    setAmount("");
    setDescription("");
    setReference("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoneyToCents(amount) ?? 0;
    run(
      () =>
        addLedgerEntry({
          matterId,
          kind,
          amountCents: kind === "adjustment" && credit ? -cents : cents,
          entryDate: date,
          method: kind === "payment" ? method : "",
          description: description || (kind === "payment" ? t("defaultPayment") : ""),
          reference,
        }),
      {
        success: kind === "payment" ? t("paymentAdded") : t("entryAdded"),
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus /> {t("addEntry")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("addEntry")}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
              {(["payment", "charge", "adjustment"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn("rounded-md px-2 py-1.5 text-sm font-medium", kind === k ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground")}
                >
                  {t(`kind.${k}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("amount")} htmlFor="le-amount">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                  <Input id="le-amount" autoFocus required inputMode="decimal" className="pl-6" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
                </div>
              </Field>
              <Field label={t("date")} htmlFor="le-date">
                <Input id="le-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            {kind === "payment" ? (
              <Field label={t("method")} htmlFor="le-method">
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn("rounded-full border px-3 py-1 text-sm", method === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border text-muted hover:text-foreground")}
                    >
                      {t(`methods.${m.replace(" ", "_").toLowerCase() as "cash"}`)}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}
            {kind === "adjustment" ? (
              <Field label={t("adjustmentType")} htmlFor="le-adj">
                <Select id="le-adj" value={credit ? "credit" : "debit"} onChange={(e) => setCredit(e.target.value === "credit")}>
                  <option value="credit">{t("adjCredit")}</option>
                  <option value="debit">{t("adjDebit")}</option>
                </Select>
              </Field>
            ) : null}
            <Field label={t("description")} htmlFor="le-desc">
              <Input id="le-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "charge" ? t("chargePlaceholder") : kind === "payment" ? t("defaultPayment") : ""} />
            </Field>
            <Field label={t("reference")} htmlFor="le-ref" hint={t("referenceHint")}>
              <Input id="le-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !parseMoneyToCents(amount)}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
