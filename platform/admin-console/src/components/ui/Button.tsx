// =============================================================================
// Button Component - Reusable button with variants
// =============================================================================

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-100";

    const variants = {
      primary:
        "bg-neo text-gray-900 shadow-sm hover:bg-neo/90 focus-visible:ring-primary-500/50 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none",
      secondary:
        "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400",
      danger:
        "bg-danger-600 text-white shadow-sm hover:bg-danger-700 focus-visible:ring-danger-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none",
      ghost:
        "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 disabled:text-gray-400 disabled:hover:bg-transparent",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        type={type}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
