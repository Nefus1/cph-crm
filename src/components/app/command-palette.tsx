"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Briefcase, CalendarPlus, CheckSquare, Loader2, Phone, Plus, Search, ShieldCheck, User } from "lucide-react";
import { globalSearch } from "@/server/actions/search";
import type { SearchHit } from "@/server/queries/search";
import { AreaBadge } from "./area-badge";
import { useQuickActions } from "./quick-actions";
import { useAppData } from "./app-data";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("search");
  const router = useRouter();
  const { locale } = useAppData();
  const quick = useQuickActions();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = ++reqId.current;
    const timer = setTimeout(
      async () => {
        if (term.length < 2) {
          if (id === reqId.current) setHits([]);
          return;
        }
        setLoading(true);
        try {
          const res = await globalSearch(term);
          if (id === reqId.current) setHits(res);
        } finally {
          if (id === reqId.current) setLoading(false);
        }
      },
      term.length < 2 ? 0 : 180,
    );
    return () => clearTimeout(timer);
  }, [q]);

  function go(path: string) {
    onOpenChange(false);
    setQ("");
    router.push(path);
  }
  function action(fn: () => void) {
    onOpenChange(false);
    setQ("");
    fn();
  }

  const matters = hits.filter((h) => h.type === "matter");
  const contacts = hits.filter((h) => h.type === "contact");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-pop outline-none animate-fade-in">
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t("placeholder")}</DialogPrimitive.Description>
          <Command shouldFilter={false} className="flex flex-col" loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              {loading ? <Loader2 className="size-4 animate-spin text-muted" /> : <Search className="size-4 text-muted" />}
              <Command.Input value={q} onValueChange={setQ} placeholder={t("placeholder")} className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle" autoFocus />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {q.trim().length >= 2 && !loading && hits.length === 0 ? <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{t("noResults")}</Command.Empty> : null}
              {matters.length ? (
                <Command.Group heading={t("matters")} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
                  {matters.map((h) => (
                    <Item key={h.id} value={`m-${h.id}`} onSelect={() => go(`/matters/${h.id}`)}>
                      <Briefcase className="size-4 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{h.title}</div>
                        {h.subtitle ? <div className="truncate text-xs text-muted">{h.subtitle}</div> : null}
                      </div>
                      {h.area ? <AreaBadge area={h.area} locale={locale} /> : null}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
              {contacts.length ? (
                <Command.Group heading={t("contacts")} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
                  {contacts.map((h) => (
                    <Item key={h.id} value={`c-${h.id}`} onSelect={() => go(`/contacts/${h.id}`)}>
                      <User className="size-4 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{h.title}</div>
                        {h.subtitle ? <div className="truncate text-xs text-muted">{h.subtitle}</div> : null}
                      </div>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
              {q.trim().length < 2 ? (
                <Command.Group heading={t("actions")} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
                  <Item value="new-intake" onSelect={() => go("/matters/new")}>
                    <Plus className="size-4 text-muted" /> {t("newIntake")}
                  </Item>
                  <Item value="log-call" onSelect={() => action(() => quick.open({ kind: "activity", type: "call" }))}>
                    <Phone className="size-4 text-muted" /> {t("logCall")}
                  </Item>
                  <Item value="add-task" onSelect={() => action(() => quick.open({ kind: "task" }))}>
                    <CheckSquare className="size-4 text-muted" /> {t("addTask")}
                  </Item>
                  <Item value="add-date" onSelect={() => action(() => quick.open({ kind: "event" }))}>
                    <CalendarPlus className="size-4 text-muted" /> {t("addDate")}
                  </Item>
                  <Item value="conflict" onSelect={() => go("/conflicts")}>
                    <ShieldCheck className="size-4 text-muted" /> {t("conflictCheck")}
                  </Item>
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Item({ children, ...props }: React.ComponentProps<typeof Command.Item>) {
  return (
    <Command.Item {...props} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-surface-2">
      {children}
    </Command.Item>
  );
}
