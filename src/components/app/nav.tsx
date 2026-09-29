"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, CalendarDays, CheckSquare, Home, Search, Settings, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", key: "today", icon: Home, exact: true },
  { href: "/matters", key: "matters", icon: Briefcase },
  { href: "/contacts", key: "contacts", icon: Users },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/tasks", key: "tasks", icon: CheckSquare },
  { href: "/conflicts", key: "conflicts", icon: ShieldCheck },
] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = isActive(it.href, "exact" in it ? it.exact : false);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <it.icon className={cn("size-4", active ? "" : "text-subtle group-hover:text-foreground")} />
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = pathname.startsWith("/settings");
  return (
    <Link
      href="/settings"
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Settings className="size-4" />
      {t("settings")}
    </Link>
  );
}

export function SearchIcon() {
  return <Search className="size-4" />;
}
