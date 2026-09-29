"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/server/types";

/** Runs a server action with pending state and toast feedback. */
export function useAction() {
  const [pending, start] = useTransition();
  const t = useTranslations("errors");

  function errorText(code: string) {
    return t.has(code as never) ? t(code as never) : code;
  }

  function run<T>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data?: T) => void; onError?: (e: string) => void } = {}) {
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          if (opts.success) toast.success(opts.success);
          opts.onSuccess?.(res.data);
        } else {
          toast.error(errorText(res.error));
          opts.onError?.(res.error);
        }
      } catch (e) {
        toast.error(errorText(e instanceof Error ? e.message : String(e)));
      }
    });
  }
  return { pending, run };
}
