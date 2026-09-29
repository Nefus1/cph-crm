import { getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/components/ui/card";
import { TeamManager } from "@/components/settings/team-manager";
import { requireAdmin } from "@/lib/auth";
import { listAllStaff } from "@/server/queries/staff";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const t = await getTranslations("settings");
  const staff = await listAllStaff();
  return (
    <Card>
      <CardHeader title={t("team")} description={t("teamHint")} />
      <TeamManager staff={staff.map((s) => ({ id: s.id, email: s.email, name: s.name, role: s.role, active: s.active, joined: !!s.userId || !!s.lastSeenAt, lastSeenAt: s.lastSeenAt?.toISOString() ?? null }))} meId={me.id} />
    </Card>
  );
}
