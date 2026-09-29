import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotAuthorized() {
  const t = await getTranslations("auth");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">{t("notInvitedTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("notInvitedBody")}</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <Button type="submit">{t("useAnother")}</Button>
        </form>
      </div>
    </main>
  );
}
