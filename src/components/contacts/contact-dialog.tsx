"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { createContact, updateContact } from "@/server/actions/contacts";
import type { Contact } from "@/db/schema";

export function ContactDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (o: boolean) => void; contact?: Contact }) {
  const t = useTranslations("intake");
  const tc = useTranslations("common");
  const tk = useTranslations("contacts");
  const router = useRouter();
  const { pending, run } = useAction();
  const [f, setF] = useState({
    kind: (contact?.kind ?? "person") as "person" | "organization",
    firstName: contact?.firstName ?? "",
    middleName: contact?.middleName ?? "",
    lastName: contact?.lastName ?? "",
    orgName: contact?.orgName ?? "",
    preferredLanguage: (contact?.preferredLanguage ?? "es") as "es" | "en" | "other",
    phone: contact?.phone ?? "",
    phoneAlt: contact?.phoneAlt ?? "",
    email: contact?.email ?? "",
    addressLine1: contact?.addressLine1 ?? "",
    addressLine2: contact?.addressLine2 ?? "",
    city: contact?.city ?? "",
    state: contact?.state ?? "CA",
    zip: contact?.zip ?? "",
    dateOfBirth: contact?.dateOfBirth ?? "",
    howFoundUs: contact?.howFoundUs ?? "",
    notes: contact?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (contact) run(() => updateContact(contact.id, f), { success: tc("saved"), onSuccess: () => onOpenChange(false) });
    else run(() => createContact(f), { success: tk("created"), onSuccess: (d) => { onOpenChange(false); if (d) router.push(`/contacts/${d.id}`); } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={contact ? tk("edit") : tk("new")} size="lg">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid w-fit grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            {(["person", "organization"] as const).map((k) => (
              <button key={k} type="button" onClick={() => set("kind", k)} className={`rounded-md px-3 py-1 text-sm font-medium ${f.kind === k ? "bg-surface shadow-card" : "text-muted"}`}>
                {tk(`kind.${k}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {f.kind === "person" ? (
              <>
                <Field label={t("firstName")} htmlFor="cd-first">
                  <Input id="cd-first" autoFocus value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </Field>
                <Field label={t("middleName")} htmlFor="cd-middle">
                  <Input id="cd-middle" value={f.middleName} onChange={(e) => set("middleName", e.target.value)} />
                </Field>
                <Field label={t("lastName")} htmlFor="cd-last">
                  <Input id="cd-last" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label={tk("orgName")} htmlFor="cd-org" className="sm:col-span-3">
                <Input id="cd-org" autoFocus value={f.orgName} onChange={(e) => set("orgName", e.target.value)} />
              </Field>
            )}
            <Field label={t("phone")} htmlFor="cd-phone">
              <Input id="cd-phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label={t("phoneAlt")} htmlFor="cd-phone2">
              <Input id="cd-phone2" type="tel" value={f.phoneAlt} onChange={(e) => set("phoneAlt", e.target.value)} />
            </Field>
            <Field label={t("email")} htmlFor="cd-email">
              <Input id="cd-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("address")} htmlFor="cd-addr" className="sm:col-span-2">
              <Input id="cd-addr" value={f.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
            </Field>
            <Field label={tk("address2")} htmlFor="cd-addr2">
              <Input id="cd-addr2" value={f.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
            </Field>
            <Field label={t("city")} htmlFor="cd-city">
              <Input id="cd-city" value={f.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label={tk("state")} htmlFor="cd-state">
              <Input id="cd-state" value={f.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label={t("zip")} htmlFor="cd-zip">
              <Input id="cd-zip" value={f.zip} onChange={(e) => set("zip", e.target.value)} />
            </Field>
            <Field label={t("language")} htmlFor="cd-lang">
              <Select id="cd-lang" value={f.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value as "es")}>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="other">{t("otherLanguage")}</option>
              </Select>
            </Field>
            <Field label={t("dob")} htmlFor="cd-dob">
              <Input id="cd-dob" type="date" value={f.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label={t("howFound")} htmlFor="cd-how">
              <Input id="cd-how" value={f.howFoundUs} onChange={(e) => set("howFoundUs", e.target.value)} />
            </Field>
          </div>
          <Field label={tc("notes")} htmlFor="cd-notes">
            <Textarea id="cd-notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewContactButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      {open ? <ContactDialog open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
