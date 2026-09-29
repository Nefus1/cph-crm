"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarOff, Cloud, Download, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  const items = [
    { href: "/settings", label: t("general"), icon: User, admin: false },
    { href: "/settings/team", label: t("team"), icon: Users, admin: true },
    { href: "/settings/google", label: t("google"), icon: Cloud, admin: true },
    { href: "/settings/holidays", label: t("holidays"), icon: CalendarOff, admin: false },
    { href: "/settings/import", label: t("import"), icon: Download, admin: true },
  ].filter((i) => isAdmin || !i.admin);
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const active = pathname === i.href;
        return (
          <Link key={i.href} href={i.href} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium", active ? "bg-surface text-foreground shadow-card ring-1 ring-border" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
            <i.icon className="size-4" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
