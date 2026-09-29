import { ArrowRightLeft, CircleDollarSign, Info, Mail, MessageSquare, NotebookPen, Phone, Users } from "lucide-react";

export const ACTIVITY_TYPES = ["call", "note", "email", "meeting", "sms"] as const;

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const Icon =
    { call: Phone, note: NotebookPen, email: Mail, meeting: Users, sms: MessageSquare, stage_change: ArrowRightLeft, payment: CircleDollarSign }[type] ?? Info;
  return <Icon className={className} />;
}
