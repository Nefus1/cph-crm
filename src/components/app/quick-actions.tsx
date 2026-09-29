"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { TaskDialog, type TaskDraft } from "@/components/tasks/task-dialog";
import { EventDialog, type EventDraft } from "@/components/events/event-dialog";
import { ActivityDialog } from "./activity-dialog";

type Open =
  | { kind: "task"; initial?: TaskDraft; lockMatter?: boolean }
  | { kind: "event"; initial?: EventDraft; lockMatter?: boolean }
  | { kind: "activity"; matterId?: string | null; contactId?: string | null; type?: "call" | "note" | "email" | "meeting" | "sms"; lockMatter?: boolean }
  | null;

const Ctx = createContext<{ open: (o: NonNullable<Open>) => void } | null>(null);

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Open>(null);
  const [key, setKey] = useState(0);
  const open = useCallback((o: NonNullable<Open>) => {
    setKey((k) => k + 1);
    setState(o);
  }, []);
  const close = (v: boolean) => {
    if (!v) setState(null);
  };
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state?.kind === "task" ? <TaskDialog key={key} open onOpenChange={close} initial={state.initial} lockMatter={state.lockMatter} /> : null}
      {state?.kind === "event" ? <EventDialog key={key} open onOpenChange={close} initial={state.initial} lockMatter={state.lockMatter} /> : null}
      {state?.kind === "activity" ? (
        <ActivityDialog key={key} open onOpenChange={close} matterId={state.matterId} contactId={state.contactId} defaultType={state.type} lockMatter={state.lockMatter} />
      ) : null}
    </Ctx.Provider>
  );
}

export function useQuickActions() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQuickActions must be used inside QuickActionsProvider");
  return v;
}
