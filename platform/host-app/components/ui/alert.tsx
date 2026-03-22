/**
 * Alert Component - Inline notification for forms and content
 * Supports various types, dismissibility, and custom actions
 */

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

export type AlertVariant = "success" | "error" | "warning" | "info";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alert variant/type */
  variant?: AlertVariant;
  /** Alert title */
  title?: string;
  /** Whether to show dismiss button */
  dismissible?: boolean;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Additional actions */
  actions?: React.ReactNode;
  /** Icon override */
  icon?: React.ReactNode;
}

// ============================================================================
// Variant Styles
// ============================================================================

const variantStyles: Record<AlertVariant, { container: string; icon: string; title: string }> = {
  success: {
    container: "bg-emerald-500/10 border-emerald-500/20",
    icon: "text-emerald-400",
    title: "text-emerald-300",
  },
  error: {
    container: "bg-red-500/10 border-red-500/20",
    icon: "text-red-400",
    title: "text-red-300",
  },
  warning: {
    container: "bg-amber-500/10 border-amber-500/20",
    icon: "text-amber-400",
    title: "text-amber-300",
  },
  info: {
    container: "bg-blue-500/10 border-blue-500/20",
    icon: "text-blue-400",
    title: "text-blue-300",
  },
};

// ============================================================================
// Default Icons
// ============================================================================

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ============================================================================
// Alert Component
// ============================================================================

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = "info",
      title,
      dismissible = false,
      onDismiss,
      actions,
      icon,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const alertId = useId();

    const variantStyle = variantStyles[variant];
    const displayIcon = icon || defaultIcons[variant];

    return (
      <div
        ref={ref}
        id={alertId}
        className={cn(
          // Base styles
          "relative flex gap-3 p-4 rounded-xl border",
          // Variant
          variantStyle.container,
          // Class
          className
        )}
        role="alert"
        aria-live="polite"
        {...props}
      >
        {/* Icon */}
        <div className={cn("shrink-0 mt-0.5", variantStyle.icon)}>
          {displayIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className={cn("font-semibold text-sm", variantStyle.title)}>
              {title}
            </p>
          )}
          <div className={cn("text-sm text-gray-300", title && "mt-1")}>
            {children}
          </div>
          
          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 mt-3">
              {actions}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss alert"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";

// ============================================================================
// Alert Link
// ============================================================================

export interface AlertLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Link variant */
  variant?: AlertVariant;
}

export const AlertLink = forwardRef<HTMLAnchorElement, AlertLinkProps>(
  ({ variant = "info", className, children, ...props }, ref) => {
    const variantStyle = variantStyles[variant];

    return (
      <a
        ref={ref}
        className={cn(
          "font-medium underline underline-offset-2 hover:opacity-80 transition-opacity",
          variantStyle.title,
          className
        )}
        {...props}
      >
        {children}
      </a>
    );
  }
);

AlertLink.displayName = "AlertLink";

// ============================================================================
// Alert Button
// ============================================================================

export interface AlertButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: AlertVariant;
}

export const AlertButton = forwardRef<HTMLButtonElement, AlertButtonProps>(
  ({ variant = "info", className, children, ...props }, ref) => {
    const variantStyle = variantStyles[variant];

    return (
      <button
        ref={ref}
        className={cn(
          "text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors",
          "border-gray-600 hover:border-gray-500 text-white",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

AlertButton.displayName = "AlertButton";

// ============================================================================
// Alert Title (Standalone)
// ============================================================================

export const AlertTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={cn("font-semibold text-white", className)} {...props}>
      {children}
    </p>
  );
};

AlertTitle.displayName = "AlertTitle";

// ============================================================================
// Alert Description (Standalone)
// ============================================================================

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={cn("text-sm text-gray-300", className)} {...props}>
      {children}
    </p>
  );
};

AlertDescription.displayName = "AlertDescription";
