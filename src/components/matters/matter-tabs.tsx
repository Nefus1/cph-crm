import Link from "next/link";
import { cn } from "@/lib/utils";

export function MatterTabs({ id, active, tabs }: { id: string; active: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <div className="-mx-4 mt-6 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <nav className="flex gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "overview" ? `/matters/${id}` : `/matters/${id}?tab=${tab.key}`}
            scroll={false}
            className={cn(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active === tab.key ? "border-primary text-foreground" : "border-transparent text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-muted ring-1 ring-border">{tab.count}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
