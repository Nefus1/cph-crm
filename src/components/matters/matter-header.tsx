"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Check, ChevronRight, FolderOpen, FolderPlus, Loader2, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { AreaBadge } from "@/components/app/area-badge";
import { StaffSelect } from "@/components/app/matter-select";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { areaConfig, optionLabel, stagesFor, t as tl, type Locale } from "@/config/practice-areas";
import { phoneHref } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { archiveMatter, deleteMatter, retryDriveFolder, setMatterAssignee, setMatterStage, setMatterStatus } from "@/server/actions/matters";
import type { MatterDetail } from "@/server/queries/matters";
import { EditMatterDialog } from "./edit-matter-dialog";

export function MatterHeader({ data, locale, isAdmin }: { data: MatterDetail; locale: Locale; isAdmin: boolean }) {
  const t = useTranslations("matter");
  const tc = useTranslations("common");
  const router = useRouter();
  const { matter } = data;
  const cfg = areaConfig(matter.practiceArea);
  const stages = stagesFor(matter.practiceArea, matter.side);
  const idx = stages.findIndex((s) => s.key === matter.stage);
  const { pending, run } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const client = data.parties.find((p) => p.party.role === "client")?.contact;
  const { googleDrive } = useAppData();

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Link href="/matters" className="hover:text-foreground">
          {t("breadcrumb")}
        </Link>
        <ChevronRight className="size-3" />
        <span>{matter.number}</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AreaBadge area={matter.practiceArea} locale={locale} full />
            <Badge>{optionLabel(cfg.types, matter.matterType, locale)}</Badge>
            {matter.side !== "na" ? <Badge>{optionLabel(cfg.sides, matter.side, locale)}</Badge> : null}
            {matter.status === "intake" ? <Badge tone="warning">{t("status.intake")}</Badge> : matter.status === "closed" ? <Badge tone="neutral">{t("status.closed")}</Badge> : null}
            {matter.archivedAt ? <Badge tone="danger">{t("archived")}</Badge> : null}
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{matter.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {matter.caption ? <span className="italic">{matter.caption}</span> : null}
            {matter.caseNumber ? (
              <span className="font-mono text-xs">
                {t("caseNo")} {matter.caseNumber}
              </span>
            ) : (
              <button className="text-xs text-warning hover:underline" onClick={() => setEditOpen(true)}>
                {t("addCaseNumber")}
              </button>
            )}
            {matter.courthouse ? <span className="text-xs">{matter.courthouse}{matter.department ? ` · ${matter.department}` : ""}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {client?.phone ? (
            <>
              <Button asChild size="sm">
                <a href={`tel:${phoneHref(client.phone)}`} title={client.phone}>
                  <Phone /> {t("call")}
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={`sms:${phoneHref(client.phone)}`}>
                  <MessageSquare /> {t("text")}
                </a>
              </Button>
            </>
          ) : null}
          {client?.email ? (
            <Button asChild size="sm" variant="secondary">
              <a href={`mailto:${client.email}`}>
                <Mail /> {t("email")}
              </a>
            </Button>
          ) : null}
          {matter.driveFolderUrl ? (
            <Button asChild size="sm" variant="secondary">
              <a href={matter.driveFolderUrl} target="_blank" rel="noreferrer">
                <FolderOpen /> {t("driveFolder")}
              </a>
            </Button>
          ) : matter.driveStatus === "pending" ? (
            <Button size="sm" variant="secondary" disabled>
              <Loader2 className="animate-spin" /> {t("drivePending")}
            </Button>
          ) : !googleDrive ? null : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => retryDriveFolder(matter.id), { success: t("driveCreated") })} title={matter.driveError ?? ""}>
              {matter.driveStatus === "error" ? <AlertTriangle className="text-danger" /> : <FolderPlus />}
              {matter.driveStatus === "error" ? t("driveRetry") : t("driveCreate")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil /> {tc("edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={tc("more")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {matter.archivedAt ? (
                <DropdownMenuItem onSelect={() => run(() => archiveMatter(matter.id, false), { success: t("restored") })}>
                  <ArchiveRestore /> {tc("restore")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => run(() => archiveMatter(matter.id, true), { success: t("archivedToast") })}>
                  <Archive /> {tc("archive")}
                </DropdownMenuItem>
              )}
              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger"
                    onSelect={() => {
                      if (confirm(t("deleteConfirm"))) run(() => deleteMatter(matter.id), { success: t("deleted"), onSuccess: () => router.push("/matters") });
                    }}
                  >
                    <Trash2 /> {t("deleteForever")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mt-5 flex flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-card md:flex-row md:items-center">
        <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {stages.map((s, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <button
                key={s.key}
                disabled={pending}
                onClick={() => !current && run(() => setMatterStage(matter.id, s.key), { success: t("stageSet", { stage: tl(s.label, locale) }) })}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  current ? "bg-primary text-primary-foreground shadow-card" : done ? "text-primary-soft-foreground hover:bg-primary-soft" : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
                title={t("setStage")}
              >
                <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px]", current ? "bg-primary-foreground/20" : done ? "bg-primary-soft" : "ring-1 ring-border-strong")}>
                  {done ? <Check className="size-2.5" /> : i + 1}
                </span>
                {tl(s.label, locale)}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
          <Select
            className="h-8 w-auto text-xs"
            value={matter.status}
            aria-label={t("statusLabel")}
            onChange={(e) => run(() => setMatterStatus(matter.id, e.target.value as "active"))}
          >
            <option value="intake">{t("status.intake")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="closed">{t("status.closed")}</option>
          </Select>
          <div className="w-40">
            <StaffSelect value={matter.assigneeId ?? ""} onChange={(v) => run(() => setMatterAssignee(matter.id, v || null))} />
          </div>
        </div>
      </div>

      {editOpen ? <EditMatterDialog open={editOpen} onOpenChange={setEditOpen} data={data} /> : null}
    </div>
  );
}
