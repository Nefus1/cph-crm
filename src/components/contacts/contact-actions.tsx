"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, MessageSquare, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useAction } from "@/components/app/use-action";
import { useQuickActions } from "@/components/app/quick-actions";
import { archiveContact, deleteContact } from "@/server/actions/contacts";
import { phoneHref } from "@/lib/phone";
import type { Contact } from "@/db/schema";
import { ContactDialog } from "./contact-dialog";

export function ContactActions({ contact, isAdmin }: { contact: Contact; isAdmin: boolean }) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const router = useRouter();
  const quick = useQuickActions();
  const { run } = useAction();
  const [edit, setEdit] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {contact.phone ? (
        <>
          <Button asChild size="sm">
            <a href={`tel:${phoneHref(contact.phone)}`}>
              <Phone /> {t("call")}
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={`sms:${phoneHref(contact.phone)}`}>
              <MessageSquare /> {t("text")}
            </a>
          </Button>
        </>
      ) : null}
      <Button size="sm" onClick={() => quick.open({ kind: "activity", contactId: contact.id, type: "call" })}>
        {t("logCall")}
      </Button>
      <Button size="sm" onClick={() => setEdit(true)}>
        <Pencil /> {tc("edit")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={tc("more")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {contact.archivedAt ? (
            <DropdownMenuItem onSelect={() => run(() => archiveContact(contact.id, false))}>
              <ArchiveRestore /> {tc("restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => archiveContact(contact.id, true), { success: t("archivedToast") })}>
              <Archive /> {tc("archive")}
            </DropdownMenuItem>
          )}
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger" onSelect={() => confirm(tc("confirmDelete")) && run(() => deleteContact(contact.id), { onSuccess: () => router.push("/contacts") })}>
                <Trash2 /> {tc("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {edit ? <ContactDialog open={edit} onOpenChange={setEdit} contact={contact} /> : null}
    </div>
  );
}
