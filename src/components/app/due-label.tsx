"use client";
import { useTranslations } from "next-intl";
import { formatDate, relativeDays, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useAppData } from "./app-data";

export function DueLabel({ date, className, done }: { date: string | null; className?: string; done?: boolean }) {
  const t = useTranslations("dates");
  const { locale } = useAppData();
  if (!date) return null;
  const d = relativeDays(date, todayISO());
  const text =
    d === 0 ? t("today") : d === 1 ? t("tomorrow") : d === -1 ? t("yesterday") : d < 0 ? t("daysAgo", { n: -d }) : d <= 6 ? t("inDays", { n: d }) : formatDate(date, locale, { month: "short", day: "numeric", year: d > 300 ? "numeric" : undefined });
  const tone = done ? "text-muted" : d < 0 ? "text-danger font-medium" : d <= 1 ? "text-warning font-medium" : "text-muted";
  return (
    <span className={cn("whitespace-nowrap text-xs", tone, className)} title={formatDate(date, locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
      {text}
    </span>
  );
}
