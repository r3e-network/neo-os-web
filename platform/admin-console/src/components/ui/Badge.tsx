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
      success:
        "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400 ring-success-500/30",
      warning:
        "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400 ring-warning-500/30",
      danger:
        "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400 ring-danger-500/30",
      info: "bg-primary-50 text-primary-700 dark:bg-neo/10 dark:text-neo ring-neo/30",
      default:
        "bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-gray-300 ring-white/10",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset uppercase",
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
