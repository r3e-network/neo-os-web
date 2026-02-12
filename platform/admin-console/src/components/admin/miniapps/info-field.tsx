// =============================================================================
// InfoField — Reusable label/value display block
// =============================================================================

import { cn } from "@/lib/utils";

interface InfoFieldProps {
  label: string;
  value: string;
  breakAll?: boolean;
  className?: string;
}

export function InfoField({ label, value, breakAll = false, className }: InfoFieldProps) {
  return (
    <div className={cn("border-border/20 bg-muted/30 rounded-lg border p-4", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={cn("text-sm font-medium text-foreground/80", breakAll && "break-all")}>{value || "\u2014"}</div>
    </div>
  );
}
