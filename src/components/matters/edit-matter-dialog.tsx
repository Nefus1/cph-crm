"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAppData } from "@/components/app/app-data";
import { StaffSelect } from "@/components/app/matter-select";
import { useAction } from "@/components/app/use-action";
import { areaConfig, LA_COURTHOUSES, PRACTICE_AREAS, stagesFor, t as tl } from "@/config/practice-areas";
import { centsToInput, parseMoneyToCents } from "@/lib/money";
import { updateMatter } from "@/server/actions/matters";
import type { MatterDetail } from "@/server/queries/matters";
import { DetailFields } from "./detail-fields";

export function EditMatterDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: MatterDetail }) {
  const t = useTranslations("matter");
  const ti = useTranslations("intake");
  const tc = useTranslations("common");
  const { locale } = useAppData();
  const { pending, run } = useAction();
  const m = data.matter;
  const [f, setF] = useState({
    practiceArea: m.practiceArea,
    matterType: m.matterType,
    side: m.side,
    caption: m.caption,
    status: m.status,
    stage: m.stage,
    assigneeId: m.assigneeId ?? "",
    supervisingAttorney: m.supervisingAttorney,
    openedOn: m.openedOn,
    courthouse: m.courthouse,
    caseNumber: m.caseNumber,
    department: m.department,
    judge: m.judge,
    feeType: m.feeType,
    flatFee: centsToInput(m.flatFeeCents),
    details: { ...(m.details ?? {}) } as Record<string, string>,
    summary: m.summary,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const cfg = areaConfig(f.practiceArea);
  const stages = stagesFor(f.practiceArea, f.side);

  function changeArea(area: string) {
    const c = areaConfig(area);
    setF((x) => ({ ...x, practiceArea: area, matterType: c.types[0].value, side: c.sides[0].value, stage: stagesFor(area, c.sides[0].value)[0].key }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        updateMatter(m.id, {
          ...f,
          practiceArea: f.practiceArea as "ud",
          status: f.status as "active",
          feeType: f.feeType as "flat",
          assigneeId: f.assigneeId || null,
          flatFeeCents: parseMoneyToCents(f.flatFee) ?? 0,
        }),
      { success: tc("saved"), onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("editTitle")} size="lg">
        <form onSubmit={submit} className="space-y-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={ti("area")} htmlFor="em-area">
              <Select id="em-area" value={f.practiceArea} onChange={(e) => changeArea(e.target.value)}>
                {PRACTICE_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {tl(areaConfig(a).label, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ti("type")} htmlFor="em-type">
              <Select id="em-type" value={f.matterType} onChange={(e) => set("matterType", e.target.value)}>
                {cfg.types.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tl(o.label, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ti("side")} htmlFor="em-side">
              <Select id="em-side" value={f.side} onChange={(e) => setF((x) => ({ ...x, side: e.target.value, stage: stagesFor(x.practiceArea, e.target.value).some((s) => s.key === x.stage) ? x.stage : stagesFor(x.practiceArea, e.target.value)[0].key }))}>
                {cfg.sides.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tl(o.label, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ti("caption")} htmlFor="em-caption" className="sm:col-span-2" hint={ti("captionHint")}>
              <Input id="em-caption" value={f.caption} onChange={(e) => set("caption", e.target.value)} placeholder="Acosta v. Mercado, et al." />
            </Field>
            <Field label={t("stage")} htmlFor="em-stage">
              <Select id="em-stage" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {tl(s.label, locale)}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">{ti("court")}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={ti("caseNumber")} htmlFor="em-case">
                <Input id="em-case" className="font-mono" value={f.caseNumber} onChange={(e) => set("caseNumber", e.target.value.toUpperCase())} placeholder="26STFL01234" />
              </Field>
              <Field label={ti("courthouse")} htmlFor="em-courthouse">
                <Input id="em-courthouse" list="courthouses" value={f.courthouse} onChange={(e) => set("courthouse", e.target.value)} />
                <datalist id="courthouses">
                  {LA_COURTHOUSES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label={ti("department")} htmlFor="em-dept">
                <Input id="em-dept" value={f.department} onChange={(e) => set("department", e.target.value)} />
              </Field>
              <Field label={ti("judge")} htmlFor="em-judge">
                <Input id="em-judge" value={f.judge} onChange={(e) => set("judge", e.target.value)} />
              </Field>
            </div>
          </section>

          {cfg.fields.length ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold">{tl(cfg.label, locale)}</h3>
              <DetailFields area={f.practiceArea} side={f.side} values={f.details} locale={locale} onChange={(k, v) => setF((x) => ({ ...x, details: { ...x.details, [k]: v } }))} />
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 text-sm font-semibold">{ti("team")}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={ti("assignee")} htmlFor="em-assignee">
                <StaffSelect id="em-assignee" value={f.assigneeId} onChange={(v) => set("assigneeId", v)} />
              </Field>
              <Field label={ti("supervising")} htmlFor="em-sup">
                <Input id="em-sup" value={f.supervisingAttorney} onChange={(e) => set("supervisingAttorney", e.target.value)} />
              </Field>
              <Field label={ti("opened")} htmlFor="em-opened">
                <Input id="em-opened" type="date" value={f.openedOn} onChange={(e) => set("openedOn", e.target.value)} />
              </Field>
              <Field label={ti("feeType")} htmlFor="em-feetype">
                <Select id="em-feetype" value={f.feeType} onChange={(e) => set("feeType", e.target.value)}>
                  <option value="flat">{ti("fee.flat")}</option>
                  <option value="hourly">{ti("fee.hourly")}</option>
                  <option value="none">{ti("fee.none")}</option>
                </Select>
              </Field>
              {f.feeType === "flat" ? (
                <Field label={ti("flatFee")} htmlFor="em-fee" hint={t("feeEditHint")}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                    <Input id="em-fee" inputMode="decimal" className="pl-6" value={f.flatFee} onChange={(e) => set("flatFee", e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                </Field>
              ) : null}
            </div>
          </section>

          <Field label={t("summary")} htmlFor="em-summary">
            <Textarea id="em-summary" rows={4} value={f.summary} onChange={(e) => set("summary", e.target.value)} placeholder={t("summaryPlaceholder")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
