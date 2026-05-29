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
      success: "bg-success-50 text-success-700 ring-success-100",
      warning: "bg-warning-50 text-warning-700 ring-warning-100",
      danger: "bg-danger-50 text-danger-700 ring-danger-100",
      info: "bg-primary-50 text-primary-700 ring-primary-200",
      default: "bg-gray-50 text-gray-700 ring-gray-200",
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
