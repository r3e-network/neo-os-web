/**
 * Button Component - Enhanced with design system tokens
 * Supports multiple variants, sizes, and states
 */

import React, { forwardRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { colors, borderRadius, transitions } from "@/lib/design-system/tokens";
import { keyboardNavigation } from "@/lib/design-system/a11y";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Whether the button is loading */
  loading?: boolean;
  /** Whether the button takes full width */
  fullWidth?: boolean;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Animated icon on hover */
  animatedIcon?: boolean;
}

// ============================================================================
// Variant Styles Configuration
// ============================================================================

const variantStyles: Record<
  ButtonVariant,
  { base: string; hover: string; active: string; disabled: string }
> = {
  primary: {
    base: "bg-neo text-gray-900 font-semibold",
    hover: "hover:bg-neo/90 hover:shadow-glow",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-neo",
  },
  secondary: {
    base: "bg-secondary text-white font-semibold",
    hover: "hover:bg-secondary/90 hover:shadow-glow-secondary",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary",
  },
  outline: {
    base: "bg-transparent border-2 border-neo text-neo font-semibold",
    hover: "hover:bg-neo/10",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  },
  ghost: {
    base: "bg-transparent text-gray-300 font-medium",
    hover: "hover:bg-white/5 hover:text-white",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300",
  },
  danger: {
    base: "bg-red-500 text-white font-semibold",
    hover: "hover:bg-red-600 hover:shadow-glow-error",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500",
  },
  success: {
    base: "bg-emerald-500 text-white font-semibold",
    hover: "hover:bg-emerald-600",
    active: "active:scale-[0.98]",
    disabled:
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500",
  },
};

// ============================================================================
// Size Styles Configuration
// ============================================================================

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg gap-1.5",
  md: "px-4 py-2 text-base rounded-xl gap-2",
  lg: "px-6 py-3 text-lg rounded-xl gap-2.5",
  icon: "p-2.5 rounded-xl",
};

// ============================================================================
// Animation classes
// ============================================================================

const animationClasses = "transition-all duration-200 ease-out transform";

// ============================================================================
// Button Component
// ============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      animatedIcon = false,
      className,
      children,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!loading && !disabled) {
          onClick?.(e);
        }
      },
      [loading, disabled, onClick],
    );

    const handleKeyDown = useCallback(
      keyboardNavigation.activate(() => {
        // Trigger click on Enter/Space
      }),
      [],
    );

    const variantStyle = useMemo(() => variantStyles[variant], [variant]);
    const sizeStyle = useMemo(() => sizeStyles[size], [size]);

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Base styles
          "inline-flex items-center justify-center font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-neo focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
          // Animation
          animationClasses,
          // Variant
          variantStyle.base,
          variantStyle.hover,
          variantStyle.active,
          variantStyle.disabled,
          // Size
          sizeStyle,
          // Full width
          fullWidth && "w-full",
          // Loading
          loading && "cursor-wait",
          className,
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className={cn(
              "animate-spin h-4 w-4",
              size === "icon" ? "h-4 w-4" : "mr-2",
            )}
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
        {!loading && leftIcon && (
          <span
            className={cn(
              "flex-shrink-0",
              animatedIcon && "transition-transform hover:-translate-x-0.5",
            )}
          >
            {leftIcon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span
            className={cn(
              "flex-shrink-0",
              animatedIcon && "transition-transform hover:translate-x-0.5",
            )}
          >
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

// ============================================================================
// Icon Button Component
// ============================================================================

export interface IconButtonProps extends Omit<
  ButtonProps,
  "size" | "leftIcon" | "rightIcon"
> {
  /** Icon to display */
  icon: React.ReactNode;
  /** Button size for icon buttons */
  size?: ButtonSize;
  /** Accessibility label (required for icon buttons) */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = "md", className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size={size === "icon" ? "icon" : size}
        className={className}
        aria-label={label}
        {...props}
      >
        {icon}
      </Button>
    );
  },
);

IconButton.displayName = "IconButton";

// ============================================================================
// Button Group Component
// ============================================================================

export interface ButtonGroupProps {
  /** Array of buttons */
  children: React.ReactNode;
  /** Group orientation */
  orientation?: "horizontal" | "vertical";
  /** Whether buttons are connected */
  connected?: boolean;
  /** Additional class names */
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  orientation = "horizontal",
  connected = true,
  className,
}) => {
  const orientationClass =
    orientation === "horizontal" ? "flex-row" : "flex-col";
  const connectedClass = connected
    ? orientation === "horizontal"
      ? "[&>button]:rounded-none first:[&>button]:rounded-l-xl last:[&>button]:rounded-r-xl [&>button:not(:last-child)]:border-r-0"
      : "[&>button]:rounded-none first:[&>button]:rounded-t-xl last:[&>button]:rounded-b-xl [&>button:not(:last-child)]:border-b-0"
    : "gap-2";

  return (
    <div
      className={cn("inline-flex", orientationClass, connectedClass, className)}
      role="group"
      aria-label="Button group"
    >
      {children}
    </div>
  );
};

ButtonGroup.displayName = "ButtonGroup";
