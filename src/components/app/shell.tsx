"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { CalendarPlus, CheckSquare, Languages, LogOut, Menu, Monitor, Moon, Phone, Plus, Scale, Search, Sun, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Avatar, Kbd } from "@/components/ui/misc";
import { setLocale } from "@/server/actions/settings";
import { useAppData } from "./app-data";
import { CommandPalette } from "./command-palette";
import { NavLinks, SettingsLink } from "./nav";
import { useQuickActions } from "./quick-actions";

function Brand({ firmName }: { firmName: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
        <Scale className="size-5" strokeWidth={2.25} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">{firmName}</span>
        <span className="block text-[11px] text-muted">Centro Para Legal Hispano</span>
      </span>
    </Link>
  );
}

export function AppShell({ children, firmName }: { children: React.ReactNode; firmName: string }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const t = useTranslations("nav");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4 lg:flex">
        <Brand firmName={firmName} />
        <div className="mt-5 px-0.5">
          <NewMenu full />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-border pt-3">
          <SettingsLink />
        </div>
      </aside>

      {/* Mobile nav */}
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent title={t("menu")}>
          <div className="flex h-full flex-col px-3 py-4">
            <Brand firmName={firmName} />
            <div className="mt-5 flex-1">
              <NavLinks onNavigate={() => setNavOpen(false)} />
            </div>
            <div className="border-t border-border pt-3">
              <SettingsLink onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label={t("menu")}>
            <Menu />
          </Button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-subtle shadow-card transition-colors hover:border-border-strong sm:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">{t("searchPlaceholder")}</span>
            <Kbd className="ml-auto hidden sm:inline">⌘K</Kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="lg:hidden">
              <NewMenu />
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function NewMenu({ full }: { full?: boolean }) {
  const t = useTranslations("nav");
  const quick = useQuickActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {full ? (
          <Button variant="primary" className="w-full justify-start">
            <Plus /> {t("new")}
          </Button>
        ) : (
          <Button variant="primary" size="icon-sm" aria-label={t("new")}>
            <Plus />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={full ? "start" : "end"} className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/matters/new">
            <UserPlus /> {t("newIntake")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => quick.open({ kind: "activity", type: "call" })}>
          <Phone /> {t("logCall")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => quick.open({ kind: "task" })}>
          <CheckSquare /> {t("addTask")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => quick.open({ kind: "event" })}>
          <CalendarPlus /> {t("addDate")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { me, locale } = useAppData();
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50" aria-label={t("account")}>
          <Avatar name={me.name || me.email} className="size-8" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="text-foreground">
          <div className="truncate text-sm font-medium">{me.name || me.email}</div>
          <div className="truncate text-xs font-normal text-muted">{me.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setLocale(locale === "es" ? "en" : "es")}>
          <Languages /> {locale === "es" ? "English" : "Español"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark"); }}>
          {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
          {t("theme")}: {t(`themes.${(theme as "dark" | "light" | "system") ?? "system"}`)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
