import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
        primary: "bg-primary-soft text-primary-soft-foreground",
        danger: "bg-danger-soft text-danger",
        warning: "bg-warning-soft text-warning",
        success: "bg-success-soft text-success",
        ud: "bg-area-ud-soft text-area-ud",
        family: "bg-area-family-soft text-area-family",
        probate: "bg-area-probate-soft text-area-probate",
        trust: "bg-area-trust-soft text-area-trust",
        general: "bg-area-general-soft text-area-general",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full bg-current", className)} />;
}
