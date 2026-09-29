"use client";
import { createContext, useContext } from "react";
import type { Locale } from "@/config/practice-areas";

export interface AppData {
  me: { id: string; name: string; email: string; role: string };
  staff: { id: string; name: string; email: string; role: string }[];
  matters: { id: string; displayName: string; number: string; practiceArea: string }[];
  locale: Locale;
  googleCalendar: boolean;
  googleDrive: boolean;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}

export function useStaffName() {
  const { staff } = useAppData();
  return (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? "";
}
