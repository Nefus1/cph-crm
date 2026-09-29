import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { ContactsFilter } from "@/components/contacts/contacts-filter";
import { NewContactButton } from "@/components/contacts/contact-dialog";
import { ADVERSE_ROLES, optionLabel, PARTY_ROLES } from "@/config/practice-areas";
import { requireStaff } from "@/lib/auth";
import { listContacts } from "@/server/queries/contacts";

export const metadata = { title: "Clients & contacts" };

export default async function ContactsPage(props: PageProps<"/contacts">) {
  await requireStaff();
  const sp = await props.searchParams;
  const t = await getTranslations("contacts");
  const locale = await getLocale();
  const filter = typeof sp.filter === "string" ? sp.filter : "clients";
  const rows = await listContacts({ q: typeof sp.q === "string" ? sp.q : undefined, filter: filter === "all" ? undefined : filter });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<NewContactButton label={t("new")} />} />
      <ContactsFilter count={rows.length} />
      {rows.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                  <Avatar name={c.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.displayName}</div>
                    <div className="truncate text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="text-xs text-muted">{c.matterCount}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">{t("col.name")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.phone")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.email")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.roles")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("col.matters")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="relative hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-2.5 after:absolute after:inset-0">
                        <Avatar name={c.displayName} />
                        <span className="font-medium">{c.displayName}</span>
                        {c.preferredLanguage === "es" ? <Badge>ES</Badge> : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{c.phone}</td>
                    <td className="px-3 py-2.5 text-muted">{c.email}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.roles.map((r) => (
                          <Badge key={r} tone={r === "client" ? "primary" : ADVERSE_ROLES.has(r) ? "danger" : "neutral"}>
                            {optionLabel(PARTY_ROLES, r, locale)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{c.matterCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<Users />} title={t("empty")} />
        </Card>
      )}
    </>
  );
}
