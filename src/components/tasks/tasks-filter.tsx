"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/input";
import { useAppData } from "@/components/app/app-data";
import { cn } from "@/lib/utils";

export function TasksFilter({ who, scope }: { who: string; scope: string }) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { staff, me } = useAppData();
  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select className="w-auto" value={who} onChange={(e) => update({ who: e.target.value === "me" ? null : e.target.value })}>
        <option value="me">{t("mine")}</option>
        <option value="all">{t("everyone")}</option>
        {staff
          .filter((s) => s.id !== me.id)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.email}
            </option>
          ))}
        <option value="unassigned">{t("unassigned")}</option>
      </Select>
      <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card">
        {(["open", "done"] as const).map((s) => (
          <button key={s} onClick={() => update({ scope: s === "open" ? null : s })} className={cn("rounded-md px-3 py-1 text-sm", scope === s ? "bg-surface-2 font-medium" : "text-muted hover:text-foreground")}>
            {t(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
