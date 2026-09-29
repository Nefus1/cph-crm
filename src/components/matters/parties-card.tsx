"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Phone, Trash2, UserPlus, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useAction } from "@/components/app/use-action";
import { ContactSearch } from "@/components/contacts/contact-search";
import { ADVERSE_ROLES, optionLabel, PARTY_ROLES, type Locale, t as tl } from "@/config/practice-areas";
import { splitName } from "@/lib/names";
import { phoneHref } from "@/lib/phone";
import { addMatterParty, removeMatterParty } from "@/server/actions/matters";
import type { MatterDetail } from "@/server/queries/matters";

export function PartiesCard({ matterId, parties, locale }: { matterId: string; parties: MatterDetail["parties"]; locale: Locale }) {
  const t = useTranslations("matter");
  const [open, setOpen] = useState(false);
  const { run } = useAction();

  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title={t("parties")}
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <UserPlus /> {t("addPerson")}
          </Button>
        }
      />
      <ul className="divide-y divide-border">
        {parties.map(({ party, contact }) => (
          <li key={party.id} className="group flex items-center gap-3 px-4 py-3">
            <Avatar name={contact.displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/contacts/${contact.id}`} className="truncate text-sm font-medium hover:text-primary">
                  {contact.displayName}
                </Link>
                <Badge tone={party.role === "client" ? "primary" : ADVERSE_ROLES.has(party.role) ? "danger" : "neutral"}>{optionLabel(PARTY_ROLES, party.role, locale)}</Badge>
                {contact.preferredLanguage === "es" && party.role === "client" ? <Badge>ES</Badge> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                {contact.phone ? (
                  <a href={`tel:${phoneHref(contact.phone)}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Phone className="size-3" /> {contact.phone}
                  </a>
                ) : null}
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Mail className="size-3" /> {contact.email}
                  </a>
                ) : null}
              </div>
            </div>
            <button
              className="rounded p-1 text-subtle opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
              aria-label={t("removeFromMatter")}
              onClick={() => confirm(t("removePartyConfirm")) && run(() => removeMatterParty(party.id))}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {open ? <AddPartyDialog matterId={matterId} open={open} onOpenChange={setOpen} locale={locale} /> : null}
    </Card>
  );
}

function AddPartyDialog({ matterId, open, onOpenChange, locale }: { matterId: string; open: boolean; onOpenChange: (o: boolean) => void; locale: Locale }) {
  const t = useTranslations("matter");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [role, setRole] = useState("opposing_party");
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = picked ? { contactId: picked.id, role } : { role, contact: { ...splitName(name), phone, email } };
    run(() => addMatterParty(matterId, payload), { success: t("personAdded"), onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("addPerson")}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("role")} htmlFor="party-role">
            <Select id="party-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {PARTY_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {tl(r.label, locale)}
                </option>
              ))}
            </Select>
          </Field>
          {picked ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
              <span className="text-sm font-medium">{picked.title}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicked(null)}>
                {tc("remove")}
              </Button>
            </div>
          ) : (
            <>
              <Field label={t("existingContact")}>
                <ContactSearch onPick={(h) => setPicked({ id: h.id, title: h.title })} />
              </Field>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" /> {t("orNew")} <span className="h-px flex-1 bg-border" />
              </div>
              <Field label={t("fullName")} htmlFor="party-name">
                <Input id="party-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ashley Mercado" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("phone")} htmlFor="party-phone">
                  <Input id="party-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label={t("emailLabel")} htmlFor="party-email">
                  <Input id="party-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={pending || (!picked && !name.trim())}>
              {tc("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
