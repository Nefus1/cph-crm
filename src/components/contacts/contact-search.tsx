"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { globalSearch } from "@/server/actions/search";
import type { SearchHit } from "@/server/queries/search";

/** Type-ahead search over existing contacts. */
export function ContactSearch({ onPick, placeholder, autoFocus }: { onPick: (hit: SearchHit) => void; placeholder?: string; autoFocus?: boolean }) {
  const t = useTranslations("contacts");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = ++req.current;
    if (term.length < 2) {
      const clear = setTimeout(() => id === req.current && setHits([]), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await globalSearch(term).catch(() => []);
      if (id === req.current) {
        setHits(res.filter((h) => h.type === "contact"));
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        {loading ? <Loader2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle" /> : <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />}
        <Input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? t("searchExisting")} className="pl-8" />
      </div>
      {hits.length > 0 ? (
        <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-card">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
              >
                <User className="size-4 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.title}</span>
                  {h.subtitle ? <span className="block truncate text-xs text-muted">{h.subtitle}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !loading ? (
        <p className="mt-1.5 text-xs text-muted">{t("noMatchCreate")}</p>
      ) : null}
    </div>
  );
}
