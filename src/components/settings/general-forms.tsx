"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { setLocale, updateFirmSettings, updateMyName } from "@/server/actions/settings";

export function ProfileForm({ name, email, locale }: { name: string; email: string; locale: "en" | "es" }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const { pending, run } = useAction();
  const [n, setN] = useState(name);
  return (
    <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t("name")} htmlFor="p-name">
        <div className="flex gap-2">
          <Input id="p-name" value={n} onChange={(e) => setN(e.target.value)} />
          <Button disabled={pending || !n.trim() || n === name} onClick={() => run(() => updateMyName(n), { success: tc("saved") })}>
            {tc("save")}
          </Button>
        </div>
      </Field>
      <Field label={t("email")}>
        <Input value={email} disabled />
      </Field>
      <Field label={t("language")} htmlFor="p-lang">
        <Select id="p-lang" value={locale} onChange={(e) => run(() => setLocale(e.target.value as "en"))}>
          <option value="en">English</option>
          <option value="es">Español</option>
        </Select>
      </Field>
      <Field label={tn("theme")} htmlFor="p-theme">
        <Select id="p-theme" value={theme ?? "system"} onChange={(e) => setTheme(e.target.value)}>
          <option value="system">{tn("themes.system")}</option>
          <option value="light">{tn("themes.light")}</option>
          <option value="dark">{tn("themes.dark")}</option>
        </Select>
      </Field>
    </div>
  );
}

export function FirmSettingsForm({ firmName, supervising }: { firmName: string; supervising: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [f, setF] = useState({ firmName, defaultSupervisingAttorney: supervising });
  return (
    <form
      className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateFirmSettings(f), { success: tc("saved") });
      }}
    >
      <Field label={t("firmName")} htmlFor="fs-name" hint={t("firmNameHint")}>
        <Input id="fs-name" value={f.firmName} onChange={(e) => setF({ ...f, firmName: e.target.value })} />
      </Field>
      <Field label={t("defaultSupervising")} htmlFor="fs-sup" hint={t("defaultSupervisingHint")}>
        <Input id="fs-sup" value={f.defaultSupervisingAttorney} onChange={(e) => setF({ ...f, defaultSupervisingAttorney: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
