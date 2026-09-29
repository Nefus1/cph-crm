"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useAction } from "@/components/app/use-action";
import { useAppData } from "@/components/app/app-data";
import { formatDateTime } from "@/lib/dates";
import { inviteStaff, updateStaffMember } from "@/server/actions/settings";

interface Row {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  joined: boolean;
  lastSeenAt: string | null;
}

export function TeamManager({ staff, meId }: { staff: Row[]; meId: string }) {
  const t = useTranslations("settings");
  const { locale } = useAppData();
  const { pending, run } = useAction();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");

  return (
    <div>
      <form
        className="grid grid-cols-1 gap-2 border-b border-border p-4 sm:grid-cols-[1fr_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => inviteStaff({ email, name, role }), {
            success: t("invited", { email }),
            onSuccess: () => {
              setEmail("");
              setName("");
            },
          });
        }}
      >
        <Input type="email" required placeholder={t("inviteEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder={t("inviteName")} value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={role} onChange={(e) => setRole(e.target.value as "staff")} className="sm:w-32">
          <option value="staff">{t("roles.staff")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </Select>
        <Button type="submit" variant="primary" disabled={pending || !email}>
          <UserPlus /> {t("invite")}
        </Button>
      </form>
      <p className="border-b border-border bg-surface-2/40 px-4 py-2 text-xs text-muted">{t("inviteHint")}</p>
      <ul className="divide-y divide-border">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={s.name || s.email} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {s.name || s.email}
                {s.id === meId ? <Badge tone="primary">{t("you")}</Badge> : null}
                {!s.active ? <Badge tone="danger">{t("deactivated")}</Badge> : !s.joined ? <Badge tone="warning">{t("pending")}</Badge> : null}
              </div>
              <div className="text-xs text-muted">
                {s.email}
                {s.lastSeenAt ? ` · ${t("lastSeen")} ${formatDateTime(s.lastSeenAt, locale)}` : ""}
              </div>
            </div>
            <Select className="h-8 w-28 text-xs" value={s.role} disabled={s.id === meId} onChange={(e) => run(() => updateStaffMember(s.id, { role: e.target.value as "staff" }), { success: t("updated") })}>
              <option value="staff">{t("roles.staff")}</option>
              <option value="admin">{t("roles.admin")}</option>
            </Select>
            {s.id !== meId ? (
              <Button size="sm" variant={s.active ? "danger-ghost" : "secondary"} onClick={() => run(() => updateStaffMember(s.id, { active: !s.active }), { success: t("updated") })}>
                {s.active ? t("deactivate") : t("reactivate")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
