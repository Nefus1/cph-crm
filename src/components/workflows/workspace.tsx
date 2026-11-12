"use client";
import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OfficeWorkspace } from "@/server/queries/office-workflows";
import {
  saveFollowUp,
  logContactAttempt,
  savePaperwork,
  saveProgress,
  saveDocumentRequest,
  savePaperworkTemplate,
  applyPaperworkTemplate,
} from "@/server/actions/office-workflows";
import { paperworkStatuses, communicationChannels, contactOutcomes, gmailCompose, whatsappCompose, followUpBucket } from "@/lib/office-workflows";

type Values = Record<string, string>;
type Field = { key: string; value?: string | null; options?: { value: string; label: string }[]; type?: string; required?: boolean };
function Editor({
  fields,
  save,
  label,
}: {
  fields: Field[];
  save: (values: Values, mutation: string) => Promise<{ ok: boolean; error?: string }>;
  label?: string;
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const receipt = useRef({ signature: "", id: "" });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget)) as Values;
        const signature = JSON.stringify(values);
        if (signature !== receipt.current.signature) receipt.current = { signature, id: crypto.randomUUID() };
        setBusy(true);
        setError("");
        try {
          const result = await save(values, receipt.current.id);
          if (!result.ok) setError(result.error === "workflow_conflict" ? t("conflict") : t("failed"));
          else {
            router.refresh();
            setError(t("saved"));
          }
        } catch {
          setError(t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <label className="grid gap-1 text-sm" key={f.key}>
          {f.key.startsWith("item_") ? t("apply") : t(f.key as never)}
          {f.options ? (
            <select aria-label={f.key.startsWith("item_") ? t("apply") : t(f.key as never)} className="rounded border p-2 bg-surface" name={f.key} defaultValue={f.value ?? ""} required={f.required}>
              <option value="">—</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea className="rounded border p-2" name={f.key} defaultValue={f.value ?? ""} />
          ) : (
            <input className="rounded border p-2" name={f.key} type={f.type ?? "text"} defaultValue={f.value ?? ""} required={f.required} />
          )}
        </label>
      ))}
      <div className="sm:col-span-2">
        <button disabled={busy} className="rounded bg-primary px-4 py-2 text-primary-foreground">
          {busy ? t("saving") : (label ?? t("save"))}
        </button>
        <p role="status" className="mt-2 text-sm">
          {error}
        </p>
      </div>
    </form>
  );
}
export function Workspace({
  data,
  mode,
  today,
  embedded = false,
}: {
  data: OfficeWorkspace;
  mode: "followups" | "paperwork" | "progress";
  today: string;
  embedded?: boolean;
}) {
  const t = useTranslations("office");
  const locale = useLocale() === "es" ? "es" : "en";
  const [scope, setScope] = useState("mine");
  const [bucket, setBucket] = useState("all");
  const [matterId, setMatterId] = useState(data.cases[0]?.id ?? "");
  const [clipboardError, setClipboardError] = useState("");
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setClipboardError(t("copied"));
    } catch {
      setClipboardError(t("failed"));
    }
  };
  const options = (values: readonly string[]) => values.map((value) => ({ value, label: t(value as never) }));
  const team = data.team.map((s) => ({ value: s.id, label: s.name }));
  const caseOptions = data.cases.map((m) => ({ value: m.id, label: `${m.number} — ${m.displayName}` }));
  const common = [
    { key: "title", required: true },
    { key: "matterId", value: matterId, options: caseOptions, required: true },
  ];
  const matter = data.cases.find((m) => m.id === matterId);
  const openTasks = data.tasks.filter((task) => task.matterId === matterId && !task.completedAt);
  const taskOptions = openTasks.map((task) => ({ value: task.id, label: task.title }));
  const heading = (id: string) => (
    <Link className="text-primary underline" href={`/matters/${id}`}>
      {data.cases.find((m) => m.id === id)?.displayName}
    </Link>
  );
  const section = "rounded-xl border bg-surface p-4 space-y-4";
  return (
    <div className="space-y-5">
      {embedded ? <h2 className="text-xl font-semibold">{t(mode)}</h2> : <h1 className="text-2xl font-semibold">{t(mode)}</h1>}
      <div className="flex flex-wrap gap-3">
        <label>
          {t("scope")}{" "}
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="border rounded p-2">
            <option value="mine">{t("mine")}</option>
            <option value="all">{t("all")}</option>
          </select>
        </label>
        <label>
          {t("filter")}{" "}
          <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="border rounded p-2">
            {options(mode === "followups" ? ["all", "overdue", "today", "upcoming", "waiting"] : mode === "paperwork" ? ["all", "overdue", "today", "upcoming", "ready_for_review", "filed"] : ["all", "no_next_action"]).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "followups" && (
        <>
          <details className={section}>
            <summary>{t("newFollowup")}</summary>
            <Editor
              fields={[
                ...common,
                {
                  key: "contactId",
                  options: data.people.map((p) => ({
                    value: p.contact.id,
                    label: `${p.contact.displayName} (${data.cases.find((m) => m.id === p.matterId)?.number})`,
                  })),
                  required: true,
                },
                { key: "assigneeId", value: data.me.id, options: team, required: true },
                { key: "dueDate", type: "date", required: true },
                { key: "channel", value: "gmail", options: options(communicationChannels), required: true },
                { key: "notes", type: "textarea" },
              ]}
              save={(v, id) => saveFollowUp(id, id, 0, { ...v, waiting: true } as Parameters<typeof saveFollowUp>[3])}
            />
          </details>
          {data.tasks
            .filter(
              (task) =>
                task.category === "follow_up" &&
                !task.completedAt &&
                (scope === "all" || task.assigneeId === data.me.id) &&
                (bucket === "all" || (task.dueDate && followUpBucket(task.dueDate, task.waiting, today)[bucket as "overdue"])),
            )
            .map((task) => {
              const person = data.people.find((p) => p.contact.id === task.contactId)?.contact;
              return (
                <article key={`${task.id}:${task.version}`} className={section}>
                  {heading(task.matterId!)}
                  <h2 className="font-semibold">{task.title}</h2>
                  <p>
                    {task.dueDate} · {data.team.find((s) => s.id === task.assigneeId)?.name}
                  </p>
                  {person && <Composer person={person} copy={copy} />}
                  <details>
                    <summary>{t("edit")}</summary>
                    <Editor
                      fields={[
                        { key: "title", value: task.title, required: true },
                        { key: "assigneeId", value: task.assigneeId, options: team, required: true },
                        { key: "dueDate", value: task.dueDate, type: "date", required: true },
                        { key: "notes", value: task.notes, type: "textarea" },
                      ]}
                      save={(v, id) =>
                        saveFollowUp(id, task.id, task.version, {
                          matterId: task.matterId!,
                          contactId: task.contactId!,
                          channel: task.channel as "gmail",
                          waiting: task.waiting,
                          ...v,
                        } as Parameters<typeof saveFollowUp>[3])
                      }
                    />
                  </details>
                  <details>
                    <summary>{t("logAttempt")}</summary>
                    <Editor
                      fields={[
                        { key: "channel", value: task.channel, options: options(communicationChannels), required: true },
                        { key: "outcome", options: options(contactOutcomes), required: true },
                        { key: "nextDate", type: "date" },
                        { key: "notes", type: "textarea" },
                      ]}
                      save={(v, id) =>
                        logContactAttempt(id, {
                          taskId: task.id,
                          version: task.version,
                          channel: v.channel as "gmail",
                          outcome: v.outcome as "reached",
                          nextDate: v.nextDate || null,
                          notes: v.notes,
                        })
                      }
                    />
                  </details>
                </article>
              );
            })}
        </>
      )}
      {mode === "paperwork" && (
        <>
          <details className={section}>
            <summary>{t("newPaperwork")}</summary>
            <PaperEditor data={data} matterId={matterId} />
          </details>
          {data.paperwork
            .filter(
              (p) =>
                (bucket === "filed" ? p.status === "filed" : p.status !== "filed") &&
                (scope === "all" || (p.status === "ready_for_review" ? p.reviewerId : p.preparerId) === data.me.id) &&
                (bucket === "all" || bucket === p.status || (p.targetDate && followUpBucket(p.targetDate, false, today)[bucket as "overdue"])),
            )
            .map((p) => (
              <article className={section} key={`${p.id}:${p.version}`}>
                {heading(p.matterId)}
                <h2>
                  {p.title} · {t(p.status as never)}
                </h2>
                {p.fileUrl && (
                  <a className="underline" href={p.fileUrl} target="_blank" rel="noreferrer">
                    {t("openFile")}
                  </a>
                )}
                <details>
                  <summary>{t("edit")}</summary>
                  <PaperEditor data={data} matterId={p.matterId} item={p} />
                </details>
              </article>
            ))}
        </>
      )}
      <section className={section}>
        <label>
          {t("matterId")}{" "}
          <select className="border rounded p-2 max-w-full" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
            {caseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {matter && (
          <div key={`${matter.id}:${matter.workflowVersion}`} className="space-y-4">
            <p>
              {matter.number} · {matter.caseNumber} · {matter.court}
            </p>
            {data.people
              .filter((p) => p.matterId === matterId)
              .map((p) => (
                <p key={p.contact.id}>
                  {p.contact.displayName} · {p.contact.phone} ·{" "}
                  {[p.contact.addressLine1, p.contact.addressLine2, p.contact.city, p.contact.state, p.contact.zip].filter(Boolean).join(", ")}
                </p>
              ))}
            <button
              className="underline"
              onClick={() =>
                copy(
                  [
                    matter.number,
                    matter.caseNumber,
                    matter.caption,
                    matter.court,
                    matter.courthouse,
                    ...data.people
                      .filter((p) => p.matterId === matterId)
                      .map((p) =>
                        [
                          p.contact.displayName,
                          p.contact.phone,
                          p.contact.email,
                          p.contact.addressLine1,
                          p.contact.addressLine2,
                          p.contact.city,
                          p.contact.state,
                          p.contact.zip,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      ),
                  ].join("\n"),
                )
              }
            >
              {t("copySummary")}
            </button>
            <p className="whitespace-pre-wrap">{matter.pinnedNote}</p>
            <details>
              <summary>{t("progress")}</summary>
              <Editor
                fields={[
                  { key: "nextActionId", value: matter.nextActionId, options: taskOptions },
                  { key: "blocker", value: matter.blocker, options: options(["client", "office", "court", "attorney", "other"]) },
                  { key: "blockerNote", value: matter.blockerNote, type: "textarea" },
                  { key: "blockerReviewDate", value: matter.blockerReviewDate, type: "date" },
                  { key: "pinnedNote", value: matter.pinnedNote, type: "textarea" },
                ]}
                save={(v, id) =>
                  saveProgress(id, matter.id, matter.workflowVersion, {
                    nextActionId: v.nextActionId || null,
                    blocker: (v.blocker || null) as "client",
                    blockerNote: v.blockerNote,
                    blockerReviewDate: v.blockerReviewDate || null,
                    pinnedNote: v.pinnedNote,
                  })
                }
              />
            </details>
            {mode === "paperwork" && (
              <>
                <h2 className="font-semibold">{t("requests")}</h2>
                {[...data.requests.filter((r) => r.matterId === matterId), null].map((r) => (
                  <details key={r ? `${r.id}:${r.version}` : "new"}>
                    <summary>{r ? `${r.title} — ${t(r.status as never)}` : t("newRequest")}</summary>
                    <Editor
                      fields={[
                        { key: "title", value: r?.title, required: true },
                        { key: "status", value: r?.status ?? "requested", options: options(["requested", "received", "reviewed"]), required: true },
                        {
                          key: "followUpTaskId",
                          value: r?.followUpTaskId,
                          options: openTasks.filter((task) => task.category === "follow_up").map((task) => ({ value: task.id, label: task.title })),
                        },
                      ]}
                      save={(v, id) =>
                        saveDocumentRequest(id, r?.id ?? id, r?.version ?? 0, {
                          matterId,
                          title: v.title,
                          status: v.status as "requested",
                          followUpTaskId: v.followUpTaskId || null,
                        })
                      }
                    />
                  </details>
                ))}
                {data.templates
                  .filter((template) => template.practiceArea === matter.practiceArea)
                  .map((template) => (
                    <details key={`${template.id}:${template.version}`}>
                      <summary>{template.title}</summary>
                      <Editor
                        fields={template.items.map((item) => ({ key: "item_" + item.key, value: "", options: [{ value: item.key, label: item[locale] }] }))}
                        save={(v, id) => applyPaperworkTemplate(id, matterId, template.id, template.version, Object.values(v).filter(Boolean), locale)}
                        label={t("apply")}
                      />
                    </details>
                  ))}
              </>
            )}
          </div>
        )}
      </section>
      {mode === "progress" &&
        data.cases
          .filter(
            (m) =>
              (scope === "all" || m.assigneeId === data.me.id) &&
              (bucket !== "no_next_action" || !data.tasks.some((task) => task.id === m.nextActionId && !task.completedAt)),
          )
          .map((m) => {
            const task = data.tasks.find((task) => task.id === m.nextActionId && !task.completedAt);
            return (
              <article className={section} key={m.id}>
                {heading(m.id)}
                <p>
                  {m.caseNumber} · {m.stage}
                </p>
                <p>{task ? `${task.title} · ${data.team.find((s) => s.id === task.assigneeId)?.name ?? "—"} · ${task.dueDate ?? "—"}` : t("no_next_action")}</p>
                {m.blocker && (
                  <p>
                    {t(m.blocker as never)} · {m.blockerReviewDate} · {m.blockerNote}
                  </p>
                )}
              </article>
            );
          })}
      {mode === "paperwork" && data.me.admin && <TemplateManager data={data} />}
      <p role="status">{clipboardError}</p>
    </div>
  );
}
function PaperEditor({ data, matterId, item }: { data: OfficeWorkspace; matterId: string; item?: OfficeWorkspace["paperwork"][number] }) {
  const t = useTranslations("office");
  const team = data.team.map((s) => ({ value: s.id, label: s.name }));
  return (
    <Editor
      fields={[
        { key: "title", value: item?.title, required: true },
        { key: "matterId", value: matterId, options: data.cases.map((m) => ({ value: m.id, label: m.displayName })), required: true },
        { key: "formNumber", value: item?.formNumber },
        { key: "revision", value: item?.revision },
        {
          key: "source",
          value: item?.source ?? "pdf",
          options: ["pdf", "docx", "clio_draft"].map((value) => ({ value, label: t(value as never) })),
          required: true,
        },
        { key: "fileUrl", value: item?.fileUrl, type: "url" },
        { key: "preparerId", value: item?.preparerId ?? data.me.id, options: team },
        { key: "reviewerId", value: item?.reviewerId, options: team },
        { key: "targetDate", value: item?.targetDate, type: "date" },
        { key: "missingInformation", value: item?.missingInformation, type: "textarea" },
        { key: "status", value: item?.status ?? "needed", options: paperworkStatuses.map((value) => ({ value, label: t(value) })), required: true },
      ]}
      save={(v, id) =>
        savePaperwork(id, item?.id ?? id, item?.version ?? 0, {
          ...v,
          preparerId: v.preparerId || null,
          reviewerId: v.reviewerId || null,
          targetDate: v.targetDate || null,
        } as Parameters<typeof savePaperwork>[3])
      }
    />
  );
}
function Composer({ person, copy }: { person: OfficeWorkspace["people"][number]["contact"]; copy: (text: string) => Promise<void> }) {
  const t = useTranslations("office");
  const [language, setLanguage] = useState(person.preferredLanguage === "es" ? "es" : "en");
  const templates = {
    en: [
      "Please send the missing information for your case.",
      "Please send the documents we requested.",
      "Please contact our office to confirm your appointment.",
      "Please contact our office for an update on your case.",
    ],
    es: [
      "Por favor, envíe la información que falta para su caso.",
      "Por favor, envíe los documentos que solicitamos.",
      "Comuníquese con nuestra oficina para confirmar su cita.",
      "Comuníquese con nuestra oficina para recibir información sobre su caso.",
    ],
  };
  const [body, setBody] = useState(templates[language as "en"][0]);
  const wa = whatsappCompose(person.phone, body);
  return (
    <div className="space-y-2">
      <label>
        {t("language")}{" "}
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setBody(templates[e.target.value as "en"][0]);
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      <label>
        {t("template")}{" "}
        <select defaultValue="" onChange={(e) => setBody(templates[language as "en"][Number(e.target.value)])}>
          <option value="" disabled>
            —
          </option>
          {["missingInformation", "requests", "appointments", "progress"].map((key, i) => (
            <option key={key} value={i}>
              {t(key as never)}
            </option>
          ))}
        </select>
      </label>
      <textarea aria-label={t("message")} className="w-full border rounded p-2" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap gap-4">
        {person.email && (
          <a target="_blank" rel="noreferrer" href={gmailCompose(person.email, "", body)}>
            Gmail ↗
          </a>
        )}
        {wa && (
          <a target="_blank" rel="noreferrer" href={wa}>
            WhatsApp ↗
          </a>
        )}
        <button onClick={() => copy(person.phone)}>
          {t("copyPhone")}: {person.phone}
        </button>
        <button onClick={() => copy(body)}>{t("copyMessage")}</button>
      </div>
      <p className="text-xs text-muted">{t("manualLog")}</p>
    </div>
  );
}
function TemplateManager({ data }: { data: OfficeWorkspace }) {
  const t = useTranslations("office");
  return (
    <section className="rounded border p-4">
      <h2>{t("templates")}</h2>
      {[...data.templates, null].map((template) => (
        <details key={template ? `${template.id}:${template.version}` : "new"}>
          <summary>{template?.title ?? t("newTemplate")}</summary>
          <p>{t("templateHint")}</p>
          <Editor
            fields={[
              { key: "title", value: template?.title, required: true },
              {
                key: "practiceArea",
                value: template?.practiceArea ?? "general",
                options: ["ud", "family", "probate", "trust", "general"].map((value) => ({ value, label: value })),
                required: true,
              },
              { key: "items", value: template?.items.map((i) => `${i.en} | ${i.es} | ${i.formNumber}`).join("\n"), type: "textarea" },
            ]}
            save={(v, id) =>
              savePaperworkTemplate(id, template?.id ?? id, template?.version ?? 0, {
                title: v.title,
                practiceArea: v.practiceArea as "general",
                items: v.items
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line, index) => {
                    const [en, es, formNumber = ""] = line.split("|").map((s) => s.trim());
                    return { key: String(index), en, es, formNumber };
                  }),
              })
            }
          />
        </details>
      ))}
    </section>
  );
}
