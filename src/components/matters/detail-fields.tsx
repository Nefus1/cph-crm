"use client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { areaConfig, t as tl, type Locale } from "@/config/practice-areas";

/** Renders the practice-area-specific fields (stored in matters.details). */
export function DetailFields({
  area,
  side,
  values,
  onChange,
  locale,
}: {
  area: string;
  side?: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  locale: Locale;
}) {
  const fields = areaConfig(area).fields.filter((f) => !f.sides || !side || f.sides.includes(side));
  if (!fields.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `detail-${f.key}`;
        const v = values[f.key] ?? "";
        return (
          <Field key={f.key} label={tl(f.label, locale)} htmlFor={id} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "select" ? (
              <Select id={id} value={v} onChange={(e) => onChange(f.key, e.target.value)}>
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tl(o.label, locale)}
                  </option>
                ))}
              </Select>
            ) : f.type === "textarea" ? (
              <Textarea id={id} rows={2} value={v} onChange={(e) => onChange(f.key, e.target.value)} />
            ) : f.type === "money" ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <Input id={id} inputMode="decimal" className="pl-6" value={v} onChange={(e) => onChange(f.key, e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
              </div>
            ) : (
              <Input id={id} type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} min={f.type === "number" ? 0 : undefined} value={v} onChange={(e) => onChange(f.key, e.target.value)} placeholder={f.placeholder} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
