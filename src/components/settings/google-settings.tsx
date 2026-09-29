"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronRight, Folder, FolderCheck, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { browseDriveFolders, disconnectGoogle, getCalendars, setCalendar, setCasesFolder } from "@/server/actions/settings";

export function DisconnectButton() {
  const t = useTranslations("google");
  const { pending, run } = useAction();
  return (
    <Button variant="danger-ghost" size="sm" disabled={pending} onClick={() => confirm(t("disconnectConfirm")) && run(() => disconnectGoogle())}>
      {t("disconnect")}
    </Button>
  );
}

export function FolderPicker({ currentId, currentName }: { currentId: string | null; currentName: string | null }) {
  const t = useTranslations("google");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, start] = useTransition();
  const { pending, run } = useAction();

  function load(parent: string, q?: string) {
    start(async () => {
      const res = await browseDriveFolders(parent, q);
      if (res.ok) setFolders(res.data ?? []);
      else toast.error(res.error);
    });
  }

  function openPicker() {
    setOpen(true);
    setPath([{ id: "root", name: "My Drive" }]);
    load("root");
  }

  const current = path[path.length - 1];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        {currentId ? <FolderCheck className="size-4 text-success" /> : <Folder className="size-4 text-muted" />}
        {currentId ? (
          <a className="font-medium hover:underline" href={`https://drive.google.com/drive/folders/${currentId}`} target="_blank" rel="noreferrer">
            {currentName}
          </a>
        ) : (
          <span className="text-muted">{t("noFolder")}</span>
        )}
      </div>
      <Button onClick={openPicker}>{currentId ? t("changeFolder") : t("chooseFolder")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("chooseFolder")} description={t("chooseFolderHint")} size="lg">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) load("root", search);
              else load(current.id);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchFolders")} />
            </div>
            <Button type="submit">{tc("search")}</Button>
          </form>
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3" /> : null}
                <button
                  className="hover:text-foreground"
                  onClick={() => {
                    setPath(path.slice(0, i + 1));
                    setSearch("");
                    load(p.id);
                  }}
                >
                  {p.name}
                </button>
              </span>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted" />
              </div>
            ) : folders.length ? (
              <ul className="divide-y divide-border">
                {folders.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2">
                    <Folder className="size-4 text-area-ud" />
                    <button
                      className="flex-1 truncate text-left text-sm"
                      onClick={() => {
                        setPath([...path, f]);
                        setSearch("");
                        load(f.id);
                      }}
                    >
                      {f.name}
                    </button>
                    <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => setCasesFolder(f.id), { success: t("folderSet", { name: f.name }), onSuccess: () => setOpen(false) })}>
                      {t("select")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted">{t("noSubfolders")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            {current.id !== "root" ? (
              <Button variant="primary" disabled={pending} onClick={() => run(() => setCasesFolder(current.id), { success: t("folderSet", { name: current.name }), onSuccess: () => setOpen(false) })}>
                {t("useThis", { name: current.name })}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CalendarPicker({ currentId, currentName }: { currentId: string | null; currentName: string | null }) {
  const t = useTranslations("google");
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  const [loading, start] = useTransition();
  const { pending, run } = useAction();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays className={currentId ? "size-4 text-success" : "size-4 text-muted"} />
        {currentId ? <span className="font-medium">{currentName}</span> : <span className="text-muted">{t("noCalendar")}</span>}
      </div>
      {list ? (
        <Select
          className="w-auto"
          defaultValue={currentId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const cal = list.find((c) => c.id === e.target.value);
            if (cal) run(() => setCalendar(cal.id, cal.name), { success: t("calendarSet", { name: cal.name }) });
          }}
        >
          <option value="" disabled>
            {t("pickCalendar")}
          </option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : (
        <Button
          disabled={loading}
          onClick={() =>
            start(async () => {
              const r = await getCalendars();
              if (r.ok) setList(r.data ?? []);
              else toast.error(r.error);
            })
          }
        >
          {loading ? <Loader2 className="animate-spin" /> : null}
          {currentId ? t("changeCalendar") : t("chooseCalendar")}
        </Button>
      )}
    </div>
  );
}
