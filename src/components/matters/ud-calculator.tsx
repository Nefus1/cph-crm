"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator, ShieldAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { computeAnswerDue, computeNoticeDeadlines, type NoticeType, type Step } from "@/lib/deadlines/ud";
import { nextCourtDayAfter } from "@/lib/deadlines/court-days";
import { formatDateLong } from "@/lib/dates";
import { createEvents } from "@/server/actions/work";

interface Candidate {
  key: string;
  title: string;
  date: string;
  ladder: "filing" | "service";
  computedFrom: string;
}

export function UdCalculator({ matterId, details, holidays }: { matterId: string; details: Record<string, string>; holidays: string[] }) {
  const t = useTranslations("calc");
  const { locale } = useAppData();
  const { pending, run } = useAction();
  const H = useMemo(() => new Set(holidays), [holidays]);

  const [noticeType, setNoticeType] = useState<NoticeType>((details.notice_type as NoticeType) || "30day");
  const [servedOn, setServedOn] = useState(details.notice_served_on ?? "");
  const [method, setMethod] = useState(details.notice_service_method ?? "personal");
  const [addMail, setAddMail] = useState((details.notice_service_method ?? "") === "mail");
  const [summonsOn, setSummonsOn] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [verified, setVerified] = useState(false);

  const notice = servedOn ? computeNoticeDeadlines({ noticeType, servedOn, addMailDays: addMail, holidays: H }) : null;
  const answer = summonsOn ? computeAnswerDue({ summonsServedOn: summonsOn, holidays: H }) : null;

  const candidates: Candidate[] = [];
  if (notice) {
    const label = t(`notice.${noticeType}`);
    candidates.push({ key: "expires", title: t("ev.expires", { notice: label }), date: notice.expires, ladder: "filing", computedFrom: `UD calculator: ${label} served ${servedOn} (${method}${addMail ? ", +5 mail" : ""})` });
    candidates.push({ key: "filing", title: t("ev.earliestFiling"), date: notice.earliestFiling, ladder: "filing", computedFrom: `UD calculator: next court day after notice expires ${notice.expires}` });
  }
  if (answer) {
    candidates.push({ key: "answer", title: t("ev.answerDue"), date: answer.answerDue, ladder: "filing", computedFrom: `UD calculator: 10 court days after summons served ${summonsOn} (CCP §1167)` });
    candidates.push({ key: "default", title: t("ev.defaultEarliest"), date: nextCourtDayAfter(answer.answerDue, H), ladder: "filing", computedFrom: `UD calculator: first court day after answer due ${answer.answerDue}` });
  }
  const chosen = candidates.filter((c) => selected[c.key] ?? true);

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader icon={<Calculator />} title={t("title")} description={t("subtitle")} />
      <CardBody className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("noticeSection")}</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("noticeType")} htmlFor="calc-type" className="col-span-2">
              <Select id="calc-type" value={noticeType} onChange={(e) => setNoticeType(e.target.value as NoticeType)}>
                {(["3day_pay", "3day_perform", "30day", "60day", "90day"] as const).map((n) => (
                  <option key={n} value={n}>
                    {t(`notice.${n}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("servedOn")} htmlFor="calc-served">
              <Input id="calc-served" type="date" value={servedOn} onChange={(e) => setServedOn(e.target.value)} />
            </Field>
            <Field label={t("method")} htmlFor="calc-method">
              <Select
                id="calc-method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setAddMail(e.target.value === "mail");
                }}
              >
                <option value="personal">{t("methods.personal")}</option>
                <option value="substituted">{t("methods.substituted")}</option>
                <option value="post_and_mail">{t("methods.post_and_mail")}</option>
                <option value="mail">{t("methods.mail")}</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={addMail} onChange={(e) => setAddMail(e.target.checked)} />
            <span>
              {t("addMail")}
              <span className="block text-xs text-muted">{t("addMailHint")}</span>
            </span>
          </label>
          {notice ? <Result rows={[{ label: t("expires"), date: notice.expires }, { label: t("earliestFiling"), date: notice.earliestFiling }]} steps={notice.steps} locale={locale} /> : null}
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("answerSection")}</h4>
          <Field label={t("summonsServed")} htmlFor="calc-summons" hint={t("summonsHint")}>
            <Input id="calc-summons" type="date" value={summonsOn} onChange={(e) => setSummonsOn(e.target.value)} />
          </Field>
          {answer ? <Result rows={[{ label: t("answerDue"), date: answer.answerDue }]} steps={answer.steps} locale={locale} /> : null}
        </section>

        {candidates.length ? (
          <section className="space-y-3 border-t border-border pt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("saveSection")}</h4>
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.key}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected[c.key] ?? true} onChange={(e) => setSelected((s) => ({ ...s, [c.key]: e.target.checked }))} />
                    <span className="flex-1">{c.title}</span>
                    <span className="text-xs text-muted">{formatDateLong(c.date, locale)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm">
              <Checkbox className="mt-0.5" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              <span>
                <ShieldAlert className="mr-1 inline size-3.5 text-warning" />
                {t("verify")}
              </span>
            </label>
            <Button
              variant="primary"
              className="w-full"
              disabled={!verified || pending || chosen.length === 0}
              onClick={() =>
                run(
                  () =>
                    createEvents(
                      chosen.map((c) => ({ matterId, kind: "deadline" as const, title: c.title, date: c.date, ladder: c.ladder, computedFrom: c.computedFrom, notes: "" })),
                    ),
                  {
                    success: t("saved", { count: chosen.length }),
                    onSuccess: () => {
                      setVerified(false);
                      setSelected({});
                    },
                  },
                )
              }
            >
              {t("saveButton", { count: chosen.length })}
            </Button>
          </section>
        ) : null}
        <p className="text-[11px] leading-relaxed text-subtle">{t("disclaimer")}</p>
      </CardBody>
    </Card>
  );
}

function Result({ rows, steps, locale }: { rows: { label: string; date: string }[]; steps: Step[]; locale: string }) {
  const t = useTranslations("calc");
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 p-3">
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-muted">{r.label}</dt>
            <dd className="text-sm font-semibold">{formatDateLong(r.date, locale)}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">{t("howComputed")}</summary>
        <ul className="mt-1.5 space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="text-[11px] leading-snug text-muted">
              {s.label}
              {s.authority ? <span className="ml-1 font-medium text-foreground/70">({s.authority})</span> : null}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
