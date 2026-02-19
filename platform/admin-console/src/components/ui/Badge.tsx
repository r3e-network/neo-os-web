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
      success: "bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500 ring-success-600/20",
      warning: "bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500 ring-warning-600/20",
      danger: "bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-500 ring-danger-600/20",
      info: "bg-primary-50 text-primary-700 dark:bg-primary-700/20 dark:text-primary-400 ring-primary-600/20",
      default: "bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 ring-gray-600/20",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
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
