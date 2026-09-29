"use client";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/input";
import { areaConfig } from "@/config/practice-areas";
import { useAppData } from "./app-data";

export function MatterSelect({ value, onChange, id, allowNone = true }: { value: string; onChange: (v: string) => void; id?: string; allowNone?: boolean }) {
  const { matters } = useAppData();
  const t = useTranslations("common");
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone ? <option value="">{t("noMatter")}</option> : null}
      {matters.map((m) => (
        <option key={m.id} value={m.id}>
          [{areaConfig(m.practiceArea).badge}] {m.displayName}
        </option>
      ))}
    </Select>
  );
}

export function StaffSelect({ value, onChange, id, allowNone = true, noneLabel }: { value: string; onChange: (v: string) => void; id?: string; allowNone?: boolean; noneLabel?: string }) {
  const { staff } = useAppData();
  const t = useTranslations("common");
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone ? <option value="">{noneLabel ?? t("unassigned")}</option> : null}
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name || s.email}
        </option>
      ))}
    </Select>
  );
}
