"use client";
import { CalendarPlus, CheckSquare, Phone, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useQuickActions } from "./quick-actions";

export function QuickButton({
  kind,
  label,
  matterId,
  contactId,
  variant = "ghost",
  size = "sm",
  activityType,
}: {
  kind: "task" | "event" | "activity";
  label: string;
  matterId?: string;
  contactId?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  activityType?: "call" | "note" | "email" | "meeting" | "sms";
}) {
  const quick = useQuickActions();
  const Icon = kind === "task" ? CheckSquare : kind === "event" ? CalendarPlus : activityType === "call" ? Phone : Plus;
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        if (kind === "task") quick.open({ kind, initial: { matterId }, lockMatter: !!matterId });
        else if (kind === "event") quick.open({ kind, initial: { matterId }, lockMatter: !!matterId });
        else quick.open({ kind, matterId, contactId, type: activityType, lockMatter: !!matterId });
      }}
    >
      <Icon /> {label}
    </Button>
  );
}
