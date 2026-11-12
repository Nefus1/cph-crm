"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppData } from "@/components/app/app-data";
import { StaffSelect } from "@/components/app/matter-select";
import { AreaBadge } from "@/components/app/area-badge";
import { useAction } from "@/components/app/use-action";
import { ContactSearch } from "@/components/contacts/contact-search";
import { DetailFields } from "@/components/matters/detail-fields";
import { PAYMENT_METHODS } from "@/components/matters/billing-actions";
import { areaConfig, buildDisplayName, LA_COURTHOUSES, PARTY_ROLES, PRACTICE_AREAS, stagesFor, t as tl, type PracticeArea } from "@/config/practice-areas";
import { contactDisplayName, splitName } from "@/lib/names";
import { formatCents, parseMoneyToCents } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { createIntake } from "@/server/actions/matters";
import { cn } from "@/lib/utils";
import { saveIntakeDraft } from "@/server/actions/drafts";
import type { DraftPayload, SavedDraft } from "@/lib/intake-draft";
import Link from "next/link";
import { ConflictPanel } from "./conflict-panel";
import { PartyInput } from "./party-input";

type Picked = { id: string; title: string; subtitle?: string } | null;

const emptyClient = {
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  phoneAlt: "",
  email: "",
  addressLine1: "",
  city: "",
  state: "CA",
  zip: "",
  preferredLanguage: "es" as "es" | "en" | "other",
  howFoundUs: "",
  dateOfBirth: "",
};

export function IntakeWizard({
  driveReady,
  defaultSupervising,
  initialClient,
  initialDraft,
}: {
  driveReady: boolean;
  defaultSupervising: string;
  initialClient: Picked;
  initialDraft?: SavedDraft;
}) {
  const t = useTranslations("intake");
  const td = useTranslations("drafts");
  const tb = useTranslations("billing");
  const saved = initialDraft?.payload;
  const [submissionId] = useState(() => initialDraft?.id ?? crypto.randomUUID());
  const [draftVersion, setDraftVersion] = useState(initialDraft?.version ?? 0);
  const [savedAt, setSavedAt] = useState(initialDraft?.updatedAt ? new Date(initialDraft.updatedAt).toISOString() : "");
  const [ackKey, setAckKey] = useState("");
  const tc = useTranslations("common");
  const router = useRouter();
  const { locale, me } = useAppData();
  const { pending, run } = useAction();
  const [step, setStep] = useState(saved?.step ?? 0);

  const [picked, setPicked] = useState<Picked>(saved?.picked ?? initialClient);
  const [client, setClient] = useState(saved?.client ?? emptyClient);
  const [area, setArea] = useState<PracticeArea | null>(saved?.area ?? null);
  const [matterType, setMatterType] = useState(saved?.matterType ?? "");
  const [side, setSide] = useState(saved?.side ?? "");
  const [caption, setCaption] = useState(saved?.caption ?? "");
  const [caseNumber, setCaseNumber] = useState(saved?.caseNumber ?? "");
  const [courthouse, setCourthouse] = useState(saved?.courthouse ?? "");
  const [details, setDetails] = useState<Record<string, string>>(saved?.details ?? {});
  const [others, setOthers] = useState<{ name: string; role: string; phone: string; contactId?: string }[]>(saved?.others ?? []);
  const [feeType, setFeeType] = useState<"flat" | "hourly" | "none">(saved?.feeType ?? "flat");
  const [fee, setFee] = useState(saved?.fee ?? "");
  const [payment, setPayment] = useState(saved?.payment ?? "");
  const [method, setMethod] = useState(saved?.method ?? "Cash");
  const [retained, setRetained] = useState(saved?.retained ?? true);
  const [assigneeId, setAssigneeId] = useState(saved?.assigneeId ?? me.id);
  const [supervising, setSupervising] = useState(saved?.supervising ?? defaultSupervising);
  const [note, setNote] = useState(saved?.note ?? "");
  const [drive, setDrive] = useState(saved?.drive ?? driveReady);

  const setC = <K extends keyof typeof client>(k: K, v: (typeof client)[K]) => setClient((c) => ({ ...c, [k]: v }));
  const clientName = picked ? picked.title : contactDisplayName(client);
  const clientValid = !!picked || !!(client.firstName.trim() || client.lastName.trim());
  const cfg = area ? areaConfig(area) : null;
  const matterValid = !!area && !!matterType;
  const feeCents = parseMoneyToCents(fee) ?? 0;
  const payCents = parseMoneyToCents(payment) ?? 0;
  const moneyValid = (feeType !== "flat" || !fee || parseMoneyToCents(fee) !== null) && (!payment || parseMoneyToCents(payment) !== null);

  function chooseArea(a: PracticeArea) {
    const c = areaConfig(a);
    setArea(a);
    setMatterType(c.types[0].value);
    setSide(c.sides[0].value);
    setDetails({});
  }

  function submit() {
    if (!area) return;
    const stages = stagesFor(area, side);
    run(
      () =>
        createIntake({
          submissionId,
          draftVersion,
          conflictReviewed: true,
          client: picked ? { contactId: picked.id } : { contact: { ...client, dateOfBirth: client.dateOfBirth || "" } },
          matter: {
            practiceArea: area,
            matterType,
            side,
            caption,
            status: retained ? "active" : "intake",
            stage: stages[0].key,
            assigneeId: assigneeId || null,
            supervisingAttorney: supervising,
            openedOn: todayISO(),
            courthouse,
            caseNumber,
            feeType,
            flatFeeCents: feeType === "flat" ? feeCents : 0,
            details,
          },
          otherParties: others
            .filter((o) => o.name.trim())
            .map((o) => (o.contactId ? { role: o.role, contactId: o.contactId } : { role: o.role, contact: { ...splitName(o.name), phone: o.phone } })),
          initialPaymentCents: payCents,
          paymentMethod: payCents ? method : "",
          note,
          createDriveFolder: drive,
        }),
      { success: t("created"), onSuccess: (d) => d && router.push(`/matters/${d.id}`) },
    );
  }

  const steps = [t("steps.client"), t("steps.matter"), t("steps.fee"), td("review")];
  const conflictNames = [picked ? picked.title : [client.firstName, client.lastName].filter(Boolean).join(" "), ...others.map((o) => o.name)];

  const conflictKey = JSON.stringify(conflictNames);
  const payload: DraftPayload = {
    picked,
    client,
    area,
    matterType,
    side,
    caption,
    caseNumber,
    courthouse,
    details,
    others,
    feeType,
    fee,
    payment,
    method,
    retained,
    assigneeId,
    supervising,
    note,
    drive,
    step,
  };
  const serialized = JSON.stringify(payload);
  const [lastSaved, setLastSaved] = useState(initialDraft ? JSON.stringify(initialDraft.payload) : serialized);
  const dirty = serialized !== lastSaved;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function saveDraft() {
    const snapshot = serialized;
    run(() => saveIntakeDraft(submissionId, draftVersion, payload), {
      success: td("saved"),
      onSuccess: (d) => {
        if (d) {
          setLastSaved(snapshot);
          setDraftVersion(d.version);
          setSavedAt(new Date(d.updatedAt).toISOString());
          if (!initialDraft) router.replace(`/matters/new?draft=${submissionId}`);
        }
      },
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={saveDraft}>
            {td("save")}
          </Button>
          <Link className="text-sm underline" href="/intake-drafts">
            {td("title")}
          </Link>
          <span role="status" className="text-xs text-muted">
            {dirty ? td("unsaved") : savedAt ? td("lastSaved", { time: new Date(savedAt).toLocaleString(locale, { timeZone: "America/Los_Angeles" }) }) : ""}
          </span>
        </div>
        {/* Stepper */}
        <ol className="mb-5 flex items-center gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => (i < step || (i === 1 && clientValid) || (i === 2 && clientValid && matterValid)) && setStep(i)}
                className={cn("flex items-center gap-2 text-sm font-medium", i === step ? "text-foreground" : i < step ? "text-primary" : "text-subtle")}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "bg-surface-2 ring-1 ring-border",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < steps.length - 1 ? <span className={cn("h-px flex-1", i < step ? "bg-primary/40" : "bg-border")} /> : null}
            </li>
          ))}
        </ol>

        <Card className="p-5 sm:p-6">
          <fieldset disabled={pending}>
            {step === 0 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold">{t("clientTitle")}</h2>
                  <p className="text-sm text-muted">{t("clientHint")}</p>
                </div>
                {picked ? (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
                    <User className="size-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{picked.title}</div>
                      {picked.subtitle ? <div className="text-xs text-muted">{picked.subtitle}</div> : null}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                      <X /> {t("change")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Field label={t("returning")}>
                      <ContactSearch onPick={(h) => setPicked({ id: h.id, title: h.title, subtitle: h.subtitle })} placeholder={t("returningPlaceholder")} />
                    </Field>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="h-px flex-1 bg-border" /> {t("orNewClient")} <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Field label={t("firstName")} htmlFor="c-first">
                        <Input id="c-first" autoFocus value={client.firstName} onChange={(e) => setC("firstName", e.target.value)} />
                      </Field>
                      <Field label={t("middleName")} htmlFor="c-middle">
                        <Input id="c-middle" value={client.middleName} onChange={(e) => setC("middleName", e.target.value)} />
                      </Field>
                      <Field label={t("lastName")} htmlFor="c-last" hint={t("lastNameHint")}>
                        <Input id="c-last" value={client.lastName} onChange={(e) => setC("lastName", e.target.value)} />
                      </Field>
                      <Field label={t("phone")} htmlFor="c-phone">
                        <Input id="c-phone" type="tel" value={client.phone} onChange={(e) => setC("phone", e.target.value)} placeholder="(310) 555-0100" />
                      </Field>
                      <Field label={t("phoneAlt")} htmlFor="c-phone2">
                        <Input id="c-phone2" type="tel" value={client.phoneAlt} onChange={(e) => setC("phoneAlt", e.target.value)} />
                      </Field>
                      <Field label={t("email")} htmlFor="c-email">
                        <Input id="c-email" type="email" value={client.email} onChange={(e) => setC("email", e.target.value)} />
                      </Field>
                      <Field label={t("address")} htmlFor="c-addr" className="sm:col-span-2">
                        <Input id="c-addr" value={client.addressLine1} onChange={(e) => setC("addressLine1", e.target.value)} />
                      </Field>
                      <Field label={t("city")} htmlFor="c-city">
                        <Input id="c-city" value={client.city} onChange={(e) => setC("city", e.target.value)} />
                      </Field>
                      <Field label={t("zip")} htmlFor="c-zip">
                        <Input id="c-zip" inputMode="numeric" value={client.zip} onChange={(e) => setC("zip", e.target.value)} />
                      </Field>
                      <Field label={t("language")} htmlFor="c-lang">
                        <Select id="c-lang" value={client.preferredLanguage} onChange={(e) => setC("preferredLanguage", e.target.value as "es")}>
                          <option value="es">Español</option>
                          <option value="en">English</option>
                          <option value="other">{t("otherLanguage")}</option>
                        </Select>
                      </Field>
                      <Field label={t("dob")} htmlFor="c-dob">
                        <Input id="c-dob" type="date" value={client.dateOfBirth} onChange={(e) => setC("dateOfBirth", e.target.value)} />
                      </Field>
                      <Field label={t("howFound")} htmlFor="c-how" className="sm:col-span-3">
                        <Input id="c-how" list="how-found" value={client.howFoundUs} onChange={(e) => setC("howFoundUs", e.target.value)} />
                        <datalist id="how-found">
                          {["Referral — friend/family", "Returning client", "Google", "Facebook", "Radio", "Walk-in", "Flyer"].map((x) => (
                            <option key={x} value={x} />
                          ))}
                        </datalist>
                      </Field>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">{t("matterTitle")}</h2>
                  <p className="text-sm text-muted">{t("matterHint")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {PRACTICE_AREAS.map((a) => {
                    const c = areaConfig(a);
                    const active = area === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => chooseArea(a)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all",
                          active
                            ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20"
                            : "border-border hover:border-border-strong hover:bg-surface-2/60",
                        )}
                      >
                        <AreaBadge area={a} locale={locale} />
                        <span className="text-sm font-medium leading-tight">{tl(c.label, locale)}</span>
                      </button>
                    );
                  })}
                </div>

                {cfg ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t("type")} htmlFor="m-type">
                        <Select id="m-type" value={matterType} onChange={(e) => setMatterType(e.target.value)}>
                          {cfg.types.map((o) => (
                            <option key={o.value} value={o.value}>
                              {tl(o.label, locale)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {cfg.sides.length > 1 ? (
                        <Field label={t("side")} htmlFor="m-side">
                          <Select id="m-side" value={side} onChange={(e) => setSide(e.target.value)}>
                            {cfg.sides.map((o) => (
                              <option key={o.value} value={o.value}>
                                {tl(o.label, locale)}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      ) : null}
                      <Field label={t("caption")} htmlFor="m-caption" hint={t("captionHint")} className="sm:col-span-2">
                        <Input
                          id="m-caption"
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder={area === "ud" ? "Acosta v. Mercado, et al." : area === "family" ? "In re Marriage of …" : ""}
                        />
                      </Field>
                      <Field label={t("caseNumber")} htmlFor="m-case" hint={t("caseNumberHint")}>
                        <Input
                          id="m-case"
                          className="font-mono"
                          value={caseNumber}
                          onChange={(e) => setCaseNumber(e.target.value.toUpperCase())}
                          placeholder="26STFL01234"
                        />
                      </Field>
                      <Field label={t("courthouse")} htmlFor="m-courthouse">
                        <Input id="m-courthouse" list="intake-courthouses" value={courthouse} onChange={(e) => setCourthouse(e.target.value)} />
                        <datalist id="intake-courthouses">
                          {LA_COURTHOUSES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </Field>
                    </div>

                    {cfg.fields.length ? (
                      <div>
                        <h3 className="mb-3 text-sm font-semibold">{t("keyFacts")}</h3>
                        <DetailFields area={area!} side={side} values={details} locale={locale} onChange={(k, v) => setDetails((d) => ({ ...d, [k]: v }))} />
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">{t("otherParties")}</h3>
                          <p className="text-xs text-muted">{t("otherPartiesHint")}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setOthers((o) => [...o, { name: "", role: "opposing_party", phone: "" }])}
                        >
                          <Plus /> {t("addParty")}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {others.map((o, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2">
                            <PartyInput
                              className="col-span-12 sm:col-span-5"
                              name={o.name}
                              contactId={o.contactId}
                              placeholder={t("partyName")}
                              onName={(v) => setOthers((l) => l.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                              onPick={(h) =>
                                setOthers((l) =>
                                  l.map((x, j) => (j === i ? (h ? { ...x, name: h.title, contactId: h.id } : { ...x, contactId: undefined }) : x)),
                                )
                              }
                            />
                            <Select
                              className="col-span-6 sm:col-span-3"
                              value={o.role}
                              onChange={(e) => setOthers((l) => l.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                            >
                              {PARTY_ROLES.filter((r) => r.value !== "client").map((r) => (
                                <option key={r.value} value={r.value}>
                                  {tl(r.label, locale)}
                                </option>
                              ))}
                            </Select>
                            <Input
                              className="col-span-5 sm:col-span-3"
                              type="tel"
                              value={o.phone}
                              placeholder={t("phone")}
                              onChange={(e) => setOthers((l) => l.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="col-span-1"
                              onClick={() => setOthers((l) => l.filter((_, j) => j !== i))}
                              aria-label={tc("remove")}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">{t("feeTitle")}</h2>
                  <p className="text-sm text-muted">{t("feeHint")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t("feeType")} htmlFor="f-type">
                    <Select id="f-type" value={feeType} onChange={(e) => setFeeType(e.target.value as "flat")}>
                      <option value="flat">{t("fee.flat")}</option>
                      <option value="hourly">{t("fee.hourly")}</option>
                      <option value="none">{t("fee.none")}</option>
                    </Select>
                  </Field>
                  {feeType === "flat" ? (
                    <Field label={t("flatFee")} htmlFor="f-fee">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                        <Input
                          id="f-fee"
                          autoFocus
                          inputMode="decimal"
                          className="pl-6"
                          value={fee}
                          onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="1,800.00"
                        />
                      </div>
                    </Field>
                  ) : null}
                  <Field label={t("paymentToday")} htmlFor="f-pay">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                      <Input
                        id="f-pay"
                        inputMode="decimal"
                        className="pl-6"
                        value={payment}
                        onChange={(e) => setPayment(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="0.00"
                      />
                    </div>
                  </Field>
                </div>
                {payCents > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm",
                          method === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border text-muted hover:text-foreground",
                        )}
                      >
                        {tb(`methods.${m.replace(" ", "_").toLowerCase() as "cash"}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {feeType === "flat" && feeCents > 0 ? (
                  <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
                    {t("balanceAfter")}: <span className="font-semibold tabular-nums">{formatCents(feeCents - payCents, locale)}</span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("assignee")} htmlFor="f-assignee">
                    <StaffSelect id="f-assignee" value={assigneeId} onChange={setAssigneeId} />
                  </Field>
                  <Field label={t("supervising")} htmlFor="f-sup">
                    <Input id="f-sup" value={supervising} onChange={(e) => setSupervising(e.target.value)} />
                  </Field>
                </div>

                <Field label={t("intakeNotes")} htmlFor="f-note">
                  <Textarea id="f-note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("intakeNotesPlaceholder")} />
                </Field>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox className="mt-0.5" checked={retained} onChange={(e) => setRetained(e.target.checked)} />
                    <span>
                      <span className="font-medium">{t("retained")}</span>
                      <span className="block text-xs text-muted">{t("retainedHint")}</span>
                    </span>
                  </label>
                  <label className={cn("flex items-start gap-3 text-sm", !driveReady && "opacity-60")}>
                    <Checkbox className="mt-0.5" checked={drive} disabled={!driveReady && !drive} onChange={(e) => setDrive(e.target.checked)} />
                    <span>
                      <span className="font-medium">{t("createFolder")}</span>
                      <span className="block text-xs text-muted">
                        {driveReady ? td("folderPreview", { name: area ? buildDisplayName(clientName, area, matterType, side) : "…" }) : t("driveNotReady")}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{td("review")}</h2>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted">{t("steps.client")}</dt>
                    <dd>{clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("steps.matter")}</dt>
                    <dd>
                      {cfg ? tl(cfg.types.find((x) => x.value === matterType)?.label, locale) : ""} ·{" "}
                      {cfg ? tl(cfg.sides.find((x) => x.value === side)?.label, locale) : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{td("parties")}</dt>
                    <dd>{others.map((o) => o.name).join("; ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("flatFee")}</dt>
                    <dd>{feeType === "flat" ? formatCents(feeCents, locale) : t(`fee.${feeType}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("paymentToday")}</dt>
                    <dd>{formatCents(payCents, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("supervising")}</dt>
                    <dd>{supervising || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("createFolder")}</dt>
                    <dd>{drive ? td("folderQueued") : td("folderLater")}</dd>
                  </div>
                </dl>
                <label className="flex gap-3 text-sm">
                  <Checkbox checked={ackKey === conflictKey} onChange={(e) => setAckKey(e.target.checked ? conflictKey : "")} />
                  {td("acknowledge")}
                </label>
              </div>
            )}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  <ArrowLeft /> {tc("back")}
                </Button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <Button variant="primary" disabled={step === 0 ? !clientValid : !matterValid || (step === 2 && !moneyValid)} onClick={() => setStep(step + 1)}>
                  {tc("next")} <ArrowRight />
                </Button>
              ) : (
                <Button variant="primary" disabled={pending || !clientValid || !matterValid || !moneyValid || ackKey !== conflictKey} onClick={submit}>
                  {pending ? <Loader2 className="animate-spin" /> : <Check />} {t("create")}
                </Button>
              )}
            </div>
          </fieldset>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("summary")}</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("steps.client")}</dt>
              <dd className="truncate text-right font-medium">{clientValid ? clientName : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("steps.matter")}</dt>
              <dd className="truncate text-right">{cfg ? tl(cfg.types.find((x) => x.value === matterType)?.label ?? cfg.label, locale) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("flatFee")}</dt>
              <dd className="text-right tabular-nums">{feeCents ? formatCents(feeCents, locale) : "—"}</dd>
            </div>
          </dl>
        </div>
        <ConflictPanel names={conflictNames} />
      </div>
    </div>
  );
}
