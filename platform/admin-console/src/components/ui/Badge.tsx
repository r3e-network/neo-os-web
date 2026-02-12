// =============================================================================
// Badge Component - Status indicator
// =============================================================================

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "default";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      success: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
      warning: "bg-amber-400/10 text-amber-400 ring-amber-400/20",
      danger: "bg-red-400/10 text-red-400 ring-red-400/20",
      info: "bg-primary-400/10 text-primary-400 ring-primary-400/20",
      default: "bg-muted/30 text-muted-foreground ring-border/20",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
