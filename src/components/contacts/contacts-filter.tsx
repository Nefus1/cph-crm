"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ContactsFilter({ count }: { count: number }) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const filter = params.get("filter") ?? "clients";

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const id = setTimeout(() => update({ q: q || null }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 basis-full sm:max-w-sm sm:flex-1 sm:basis-auto">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filterPlaceholder")} className="pl-8" />
      </div>
      <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card">
        {(["clients", "others", "all"] as const).map((f) => (
          <button key={f} onClick={() => update({ filter: f === "clients" ? null : f })} className={cn("rounded-md px-3 py-1 text-sm", filter === f ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:text-foreground")}>
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>
      <span className="ml-auto text-xs text-muted">{pending ? <Loader2 className="size-4 animate-spin" /> : t("count", { count })}</span>
    </div>
  );
}
