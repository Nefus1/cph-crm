"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { formatDate, todayISO } from "@/lib/dates";
import { addHoliday, deleteHoliday } from "@/server/actions/work";
import { cn } from "@/lib/utils";

export function HolidayManager({ rows, isAdmin, locale }: { rows: { date: string; name: string }[]; isAdmin: boolean; locale: string }) {
  const t = useTranslations("settings");
  const { pending, run } = useAction();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const today = todayISO();
  return (
    <div>
      {isAdmin ? (
        <form
          className="flex flex-wrap gap-2 border-b border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addHoliday(date, name), {
              onSuccess: () => {
                setDate("");
                setName("");
              },
            });
          }}
        >
          <Input type="date" required className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input required className="min-w-0 flex-1" placeholder={t("holidayName")} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="primary" disabled={pending}>
            <Plus /> {t("addHoliday")}
          </Button>
        </form>
      ) : null}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.date} className={cn("group flex items-center gap-3 px-4 py-2", r.date < today && "opacity-50")}>
            <span className="w-40 text-sm tabular-nums text-muted">{formatDate(r.date, locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            <span className="flex-1 text-sm">{r.name}</span>
            {isAdmin ? (
              <button className="rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100" aria-label="Delete" onClick={() => run(() => deleteHoliday(r.date))}>
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
