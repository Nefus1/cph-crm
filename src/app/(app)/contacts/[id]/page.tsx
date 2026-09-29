import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Briefcase, ChevronRight, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, DefList } from "@/components/ui/misc";
import { AreaBadge } from "@/components/app/area-badge";
import { TimelineComposer, TimelineList } from "@/components/app/timeline";
import { ContactActions } from "@/components/contacts/contact-actions";
import { ADVERSE_ROLES, optionLabel, PARTY_ROLES, stageLabel } from "@/config/practice-areas";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { phoneHref } from "@/lib/phone";
import { isUuid } from "@/lib/utils";
import { getContact } from "@/server/queries/contacts";

export async function generateMetadata(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Contact" };
  const data = await getContact(id);
  return { title: data?.contact.displayName ?? "Contact" };
}

export default async function ContactPage(props: PageProps<"/contacts/[id]">) {
  const me = await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const data = await getContact(id);
  if (!data) notFound();
  const t = await getTranslations("contacts");
  const locale = (await getLocale()) as "en" | "es";
  const c = data.contact;
  const address = [c.addressLine1, c.addressLine2, [c.city, c.state].filter(Boolean).join(", "), c.zip].filter(Boolean).join(" ");

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Link href="/contacts" className="hover:text-foreground">
          {t("title")}
        </Link>
        <ChevronRight className="size-3" />
        <span>{c.displayName}</span>
      </div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={c.displayName} className="size-12 text-base" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{c.displayName}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[...new Set(data.matters.map((m) => m.role))].map((r) => (
                <Badge key={r} tone={r === "client" ? "primary" : ADVERSE_ROLES.has(r) ? "danger" : "neutral"}>
                  {optionLabel(PARTY_ROLES, r, locale)}
                </Badge>
              ))}
              {c.archivedAt ? <Badge tone="danger">{t("archived")}</Badge> : null}
            </div>
          </div>
        </div>
        <ContactActions contact={c} isAdmin={me.role === "admin"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("info")} />
            <CardBody>
              <DefList
                className="sm:grid-cols-1"
                items={[
                  { label: t("col.phone"), value: c.phone ? <a className="text-primary hover:underline" href={`tel:${phoneHref(c.phone)}`}>{c.phone}</a> : "" },
                  { label: t("altPhone"), value: c.phoneAlt ? <a className="text-primary hover:underline" href={`tel:${phoneHref(c.phoneAlt)}`}>{c.phoneAlt}</a> : "" },
                  { label: t("col.email"), value: c.email ? <a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "" },
                  { label: t("address"), value: address },
                  { label: t("language"), value: c.preferredLanguage === "es" ? "Español" : c.preferredLanguage === "en" ? "English" : t("other") },
                  { label: t("dob"), value: c.dateOfBirth ? formatDate(c.dateOfBirth, locale) : "" },
                  { label: t("howFound"), value: c.howFoundUs },
                  { label: t("since"), value: formatDate(c.createdAt.toISOString().slice(0, 10), locale) },
                ]}
              />
              {c.notes ? <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm">{c.notes}</p> : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<Briefcase />}
              title={t("matters")}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/matters/new?contact=${c.id}`}>
                    <Plus /> {t("newMatter")}
                  </Link>
                </Button>
              }
            />
            {data.matters.length ? (
              <ul className="divide-y divide-border">
                {data.matters.map((m) => (
                  <li key={`${m.matterId}-${m.role}`}>
                    <Link href={`/matters/${m.matterId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                      <AreaBadge area={m.practiceArea} locale={locale} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.displayName}</div>
                        <div className="truncate text-xs text-muted">
                          {[m.number, m.caseNumber, stageLabel(m.practiceArea, m.side, m.stage, locale)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Badge tone={m.role === "client" ? "primary" : ADVERSE_ROLES.has(m.role) ? "danger" : "neutral"}>{optionLabel(PARTY_ROLES, m.role, locale)}</Badge>
                      {m.balance > 0 && m.role === "client" ? <span className="text-xs tabular-nums text-muted">{formatCents(m.balance, locale)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("noMatters")} className="py-6" />
            )}
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">{t("activity")}</h2>
            <TimelineComposer contactId={c.id} />
            <TimelineList showMatter entries={data.activities.map((a) => ({ ...a.activity, authorName: a.authorName, matterName: a.matterName }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
