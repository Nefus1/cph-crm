"use client";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/app/use-action";
import { syncCalendarNow } from "@/server/actions/settings";

export function SyncNowButton() {
  const t = useTranslations("calendar");
  const { pending, run } = useAction();
  return (
    <Button disabled={pending} onClick={() => run(() => syncCalendarNow(), { success: t("syncDone") })}>
      <RefreshCw className={pending ? "animate-spin" : ""} /> {t("syncNow")}
    </Button>
  );
}
