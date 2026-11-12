"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { registerFolderConnector, revokeFolderConnector, saveFolderSettings } from "@/server/actions/folders";

type Device = { id: string; name: string; revokedAt: Date | null; lastSeenAt: Date | null; online: boolean };
export function FolderSettings({
  root,
  connectorId,
  enabled,
  verified,
  devices,
}: {
  root: string;
  connectorId: string | null;
  enabled: boolean;
  verified: boolean;
  devices: Device[];
}) {
  const t = useTranslations("folders");
  const [form, setForm] = useState({ root, connectorId: connectorId ?? "", enabled });
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const { pending, run } = useAction();
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted">{t("setupHint")}</p>
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">{t("devices")}</h2>
        <Field label={t("deviceName")} htmlFor="device-name">
          <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            run(() => registerFolderConnector(name), {
              onSuccess: (d) => {
                if (d) {
                  setToken(d.token);
                  setForm((f) => ({ ...f, connectorId: d.id, enabled: false }));
                }
              },
            })
          }
        >
          {t("register")}
        </Button>
        {token && (
          <div role="status" className="space-y-2 rounded border border-border p-3">
            <p>{t("tokenHint")}</p>
            <code className="block break-all select-all">{token}</code>
            <Button onClick={() => setToken("")}>{t("hideToken")}</Button>
          </div>
        )}
        {devices.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm">
            <span>
              {d.name} · {d.revokedAt ? t("revoked") : !d.lastSeenAt ? t("neverSeen") : d.online ? t("online") : t("offline")}
            </span>
            {!d.revokedAt && (
              <Button disabled={pending} size="sm" onClick={() => confirm(t("revokeConfirm")) && run(() => revokeFolderConnector(d.id))}>
                {t("revoke")}
              </Button>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">{t("mapping")}</h2>
        <Field label={t("root")} htmlFor="folder-root">
          <Input
            id="folder-root"
            value={form.root}
            onChange={(e) => setForm((f) => ({ ...f, root: e.target.value, enabled: false }))}
            placeholder="D:\SynologyDrive\CPH\Cases"
          />
        </Field>
        <Field label={t("device")} htmlFor="folder-device">
          <Select id="folder-device" value={form.connectorId} onChange={(e) => setForm((f) => ({ ...f, connectorId: e.target.value, enabled: false }))}>
            <option value="">—</option>
            {devices
              .filter((d) => !d.revokedAt)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </Select>
        </Field>
        <Link className="block text-sm underline" href="/settings/google">
          {t("googleRoot")}
        </Link>
        <p className="text-sm">{verified ? t("verified") : t("unverified")}</p>
        <label className="flex gap-2 text-sm">
          <Checkbox checked={form.enabled} disabled={!verified} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
          {t("enable")}
        </label>
        <Button disabled={pending || !form.connectorId || !form.root} onClick={() => run(() => saveFolderSettings(form), { success: t("saved") })}>
          {t("save")}
        </Button>
        <Link className="ml-3 text-sm underline" href="/case-generator">
          {t("testSetup")}
        </Link>
      </section>
    </div>
  );
}
