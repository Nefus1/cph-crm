"use client";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { AreaBadge } from "@/components/app/area-badge";
import { useAppData } from "@/components/app/app-data";
import { MatterSelect } from "@/components/app/matter-select";
import { formatDate, formatTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { CalendarPreviewRow, FolderPreviewRow, SheetPreviewRow } from "@/lib/import/server";
import { commitCalendarLinks, commitDriveImport, commitSheetImport, previewCalendarImport, previewDriveImport, previewSheetImport } from "@/server/actions/import";

const statusTone: Record<string, BadgeTone> = { new: "success", matched: "primary", already_imported: "neutral", link_existing: "primary", already_linked: "neutral", unparsed: "warning" };

function Summary({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations("import");
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => (
          <Badge key={k} tone={statusTone[k] ?? "neutral"}>
            {t(`status.${k as "new"}`)}: {n}
          </Badge>
        ))}
    </div>
  );
}

export function SheetImport({ disabled }: { disabled: boolean }) {
  const t = useTranslations("import");
  const { locale } = useAppData();
  const [sheet, setSheet] = useState("");
  const [policy, setPolicy] = useState<"age" | "active" | "closed">("age");
  const [data, setData] = useState<{ title: string; rows: SheetPreviewRow[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, start] = useTransition();

  function preview() {
    start(async () => {
      const r = await previewSheetImport(sheet, policy);
      if (!r.ok) return void toast.error(r.error);
      setData(r.data!);
      setSelected(new Set(r.data!.rows.filter((x) => x.status !== "already_imported").map((x) => x.key)));
    });
  }
  function commit() {
    start(async () => {
      const r = await commitSheetImport(sheet, policy, [...selected]);
      if (!r.ok) return void toast.error(r.error);
      toast.success(t("sheet.done", { matters: r.data!.createdMatters, contacts: r.data!.createdContacts }));
      setData(null);
    });
  }
  const counts = useMemo(() => (data ? data.rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}) : {}), [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder={t("sheet.placeholder")} disabled={disabled} />
        <Select value={policy} onChange={(e) => setPolicy(e.target.value as "age")} disabled={disabled} className="sm:w-64">
          <option value="age">{t("sheet.policy.age")}</option>
          <option value="active">{t("sheet.policy.active")}</option>
          <option value="closed">{t("sheet.policy.closed")}</option>
        </Select>
        <Button onClick={preview} disabled={disabled || loading || !sheet.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Eye />} {t("preview")}
        </Button>
      </div>
      {data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-medium">{data.title}</span> · <span className="text-muted">{t("rows", { count: data.rows.length })}</span>
            </div>
            <Summary counts={counts} />
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === data.rows.filter((r) => r.status !== "already_imported").length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(data.rows.filter((r) => r.status !== "already_imported").map((r) => r.key)) : new Set())}
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">{t("col.client")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.matter")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.opened")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("col.fee")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("col.paid")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.status")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.result")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.key} className={r.status === "already_imported" ? "opacity-50" : ""}>
                    <td className="px-3 py-2">
                      <Checkbox
                        disabled={r.status === "already_imported"}
                        checked={selected.has(r.key)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.key);
                          else next.delete(r.key);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.displayName}</div>
                      <div className="text-muted">{[r.contact.phone, r.contact.email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <AreaBadge area={r.matter.area} locale={locale} />
                        <span className="text-muted">{r.matterText || "—"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-muted">{r.openedOn ? formatDate(r.openedOn, locale) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.feeCents ? formatCents(r.feeCents, locale) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.paymentCents ? formatCents(r.paymentCents, locale) : "—"}</td>
                    <td className="px-2 py-2">{t(`importStatus.${r.importStatus}`)}</td>
                    <td className="px-2 py-2">
                      <Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge>
                      {r.matchedContact ? <div className="mt-0.5 text-muted">→ {r.matchedContact}</div> : null}
                      {r.warnings.length ? <div className="mt-0.5 text-warning">{r.warnings.map((w) => t(`warn.${w as "email_skipped"}`)).join(", ")}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">{t("sheet.commitHint")}</p>
            <Button variant="primary" onClick={commit} disabled={loading || selected.size === 0}>
              {loading ? <Loader2 className="animate-spin" /> : <Download />} {t("importN", { count: selected.size })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function DriveImport({ disabled }: { disabled: boolean }) {
  const t = useTranslations("import");
  const { locale } = useAppData();
  const [rows, setRows] = useState<FolderPreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, start] = useTransition();
  const actionable = (r: FolderPreviewRow) => r.status === "new" || r.status === "link_existing";
  const counts = useMemo(() => (rows ? rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}) : {}), [rows]);

  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          start(async () => {
            const r = await previewDriveImport();
            if (!r.ok) return void toast.error(r.error);
            setRows(r.data!);
            setSelected(new Set(r.data!.filter(actionable).map((x) => x.folderId)));
          })
        }
        disabled={disabled || loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Eye />} {t("drive.scan")}
      </Button>
      {rows ? (
        <>
          <Summary counts={counts} />
          <div className="max-h-[24rem] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2 font-medium">{t("col.folder")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.matter")}</th>
                  <th className="px-2 py-2 font-medium">{t("col.result")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.folderId} className={actionable(r) ? "" : "opacity-50"}>
                    <td className="px-3 py-2">
                      <Checkbox
                        disabled={!actionable(r)}
                        checked={selected.has(r.folderId)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.folderId);
                          else next.delete(r.folderId);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {r.folderName}
                      </a>
                    </td>
                    <td className="px-2 py-2">{r.area ? <AreaBadge area={r.area} locale={locale} /> : null}</td>
                    <td className="px-2 py-2">
                      <Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge>
                      {r.matchedMatter ? <div className="mt-0.5 text-muted">→ {r.matchedMatter}</div> : r.matchedContact ? <div className="mt-0.5 text-muted">{t("existingClient")}: {r.matchedContact}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">{t("drive.commitHint")}</p>
            <Button
              variant="primary"
              disabled={loading || selected.size === 0}
              onClick={() =>
                start(async () => {
                  const r = await commitDriveImport([...selected]);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(t("drive.done", { created: r.data!.createdMatters, linked: r.data!.linkedCount }));
                  setRows(null);
                })
              }
            >
              {loading ? <Loader2 className="animate-spin" /> : <Download />} {t("importN", { count: selected.size })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CalendarImport({ disabled }: { disabled: boolean }) {
  const t = useTranslations("import");
  const te = useTranslations("events");
  const { locale } = useAppData();
  const [rows, setRows] = useState<CalendarPreviewRow[] | null>(null);
  const [choices, setChoices] = useState<Record<string, { matterId: string; kind: CalendarPreviewRow["suggestedKind"]; on: boolean }>>({});
  const [loading, start] = useTransition();
  const chosen = Object.entries(choices).filter(([, c]) => c.on);

  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          start(async () => {
            const r = await previewCalendarImport();
            if (!r.ok) return void toast.error(r.error);
            setRows(r.data!);
            setChoices(Object.fromEntries(r.data!.filter((x) => !x.linked).map((x) => [x.id, { matterId: x.suggestedMatterId ?? "", kind: x.suggestedKind, on: !!x.suggestedMatterId }])));
          })
        }
        disabled={disabled || loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Eye />} {t("calendar.scan")}
      </Button>
      {rows ? (
        rows.length ? (
          <>
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const c = choices[r.id];
                  return (
                    <li key={r.id} className={`grid grid-cols-1 items-center gap-2 px-3 py-2.5 text-xs sm:grid-cols-[auto_1fr_220px_130px] ${r.linked ? "opacity-50" : ""}`}>
                      <Checkbox disabled={r.linked} checked={!!c?.on} onChange={(e) => setChoices((s) => ({ ...s, [r.id]: { ...s[r.id], on: e.target.checked } }))} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.summary}</div>
                        <div className="text-muted">
                          {formatDate(r.date, locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          {r.time ? ` · ${formatTime(r.time, locale)}` : ""}
                          {r.linked ? ` · ${t("status.already_linked")}` : ""}
                        </div>
                      </div>
                      {!r.linked && c ? (
                        <>
                          <MatterSelect value={c.matterId} onChange={(v) => setChoices((s) => ({ ...s, [r.id]: { ...s[r.id], matterId: v, on: s[r.id].on || !!v } }))} />
                          <Select value={c.kind} onChange={(e) => setChoices((s) => ({ ...s, [r.id]: { ...s[r.id], kind: e.target.value as "hearing" } }))}>
                            <option value="hearing">{te("kind.hearing")}</option>
                            <option value="deadline">{te("kind.deadline")}</option>
                            <option value="appointment">{te("kind.appointment")}</option>
                          </Select>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">{t("calendar.commitHint")}</p>
              <Button
                variant="primary"
                disabled={loading || chosen.length === 0}
                onClick={() =>
                  start(async () => {
                    const r = await commitCalendarLinks(chosen.map(([gcalId, c]) => ({ gcalId, matterId: c.matterId || null, kind: c.kind })));
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(t("calendar.done", { count: r.data!.count }));
                    setRows(null);
                  })
                }
              >
                {t("linkN", { count: chosen.length })}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{t("calendar.none")}</p>
        )
      ) : null}
    </div>
  );
}
