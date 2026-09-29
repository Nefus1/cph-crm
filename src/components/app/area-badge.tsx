import { areaConfig, t, type Locale } from "@/config/practice-areas";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AreaBadge({ area, locale, full, className }: { area: string; locale?: Locale; full?: boolean; className?: string }) {
  const cfg = areaConfig(area);
  return (
    <Badge tone={cfg.color as BadgeTone} className={className} title={t(cfg.label, locale ?? "en")}>
      {full ? t(cfg.label, locale ?? "en") : cfg.badge}
    </Badge>
  );
}

export function AreaDot({ area, className }: { area: string; className?: string }) {
  const colors: Record<string, string> = {
    ud: "bg-area-ud",
    family: "bg-area-family",
    probate: "bg-area-probate",
    trust: "bg-area-trust",
    general: "bg-area-general",
  };
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", colors[area] ?? colors.general, className)} />;
}
