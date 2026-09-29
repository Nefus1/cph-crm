import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { MattersToolbar } from "@/components/matters/matters-toolbar";
import { MatterTable } from "@/components/matters/matter-table";
import { MatterBoard } from "@/components/matters/matter-board";
import { areaConfig, PRACTICE_AREAS } from "@/config/practice-areas";
import { requireStaff } from "@/lib/auth";
import { listMatters } from "@/server/queries/matters";

export const metadata = { title: "Matters" };

export default async function MattersPage(props: PageProps<"/matters">) {
  await requireStaff();
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const t = await getTranslations("matters");
  const locale = (await getLocale()) as "en" | "es";

  const area = str("area") && (PRACTICE_AREAS as readonly string[]).includes(str("area")!) ? str("area")! : "all";
  const view = str("view") === "board" && area !== "all" ? "board" : "list";
  const cfg = area !== "all" ? areaConfig(area) : null;
  const side = cfg && Object.keys(cfg.stages).length > 1 ? (str("side") && cfg.stages[str("side")!] ? str("side")! : cfg.sides[0].value) : undefined;

  const rows = await listMatters({
    area,
    status: view === "board" ? (str("status") ?? "open") : str("status"),
    assignee: str("assignee"),
    q: str("q"),
    balance: str("balance") === "1",
  });
  const boardRows = side ? rows.filter((r) => r.side === side) : rows;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="primary">
            <Link href="/matters/new">
              <Plus /> {t("newIntake")}
            </Link>
          </Button>
        }
      />
      <MattersToolbar area={area} view={view} side={side} count={view === "board" ? boardRows.length : rows.length} />
      {view === "board" && cfg ? (
        <MatterBoard rows={boardRows} area={area} side={side ?? null} locale={locale} />
      ) : rows.length ? (
        <MatterTable rows={rows} locale={locale} />
      ) : (
        <Card>
          <EmptyState
            icon={<Briefcase />}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              <Button asChild variant="primary">
                <Link href="/matters/new">
                  <Plus /> {t("newIntake")}
                </Link>
              </Button>
            }
          />
        </Card>
      )}
    </>
  );
}
