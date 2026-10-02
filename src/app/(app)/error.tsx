"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">Something went wrong / Algo salió mal</h1>
      <p className="mt-2 text-sm text-muted">
        The CRM couldn&apos;t load this page. If it keeps happening, an administrator can open <a className="text-primary underline" href="/api/health?db=1">/api/health?db=1</a> to see what&apos;s wrong.
      </p>
      <Button className="mt-6" onClick={() => reset()}>
        <RefreshCw /> Try again
      </Button>
    </div>
  );
}
