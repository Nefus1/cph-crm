"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { globalSearch } from "@/server/actions/search";
import type { SearchHit } from "@/server/queries/search";

/**
 * Name field for another party on a new intake. Suggests existing contacts so the
 * same opposing party isn't created twice; picking one links the existing record.
 */
export function PartyInput({
  name,
  contactId,
  onName,
  onPick,
  placeholder,
  className,
}: {
  name: string;
  contactId?: string;
  onName: (v: string) => void;
  onPick: (hit: { id: string; title: string } | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("intake");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [focused, setFocused] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    const term = name.trim();
    const id = ++req.current;
    if (contactId || term.length < 3) {
      const clear = setTimeout(() => id === req.current && setHits([]), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      const res = await globalSearch(term).catch(() => []);
      if (id === req.current) setHits(res.filter((h) => h.type === "contact").slice(0, 5));
    }, 200);
    return () => clearTimeout(timer);
  }, [name, contactId]);

  if (contactId) {
    return (
      <div className={`flex h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 text-sm ${className ?? ""}`}>
        <Link2 className="size-3.5 text-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        <span className="text-xs text-muted">{t("linked")}</span>
        <button type="button" onClick={() => onPick(null)} className="text-subtle hover:text-foreground" aria-label={t("unlink")}>
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Input value={name} placeholder={placeholder} onChange={(e) => onName(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} />
      {focused && hits.length ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
          <li className="px-3 py-1.5 text-[11px] font-medium text-muted">{t("useExisting")}</li>
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick({ id: h.id, title: h.title })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2">
                <User className="size-3.5 text-muted" />
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                {h.subtitle ? <span className="truncate text-xs text-muted">{h.subtitle}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
