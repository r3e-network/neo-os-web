import { forwardRef, useRef, type ReactNode, type MouseEvent } from "react";
import "./NeoButton.scss";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "erobo";

export type ButtonSize = "sm" | "md" | "lg";

export interface NeoButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Accessibility label for screen readers -- use when button has no visible text */
  "aria-label"?: string;
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** Debounce threshold in ms to prevent double-clicks */
const DEBOUNCE_MS = 300;

export const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  function NeoButton(
    {
      variant = "primary",
      size = "md",
      block = false,
      disabled = false,
      loading = false,
      "aria-label": ariaLabel,
      className,
      children,
      onClick,
    },
    ref,
  ) {
    const lastClickRef = useRef(0);

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
      if (loading || disabled) return;
      const now = Date.now();
      if (now - lastClickRef.current < DEBOUNCE_MS) return;
      lastClickRef.current = now;
      onClick?.(event);
    }

    const classes = [
      "neo-btn",
      `neo-btn--${variant}`,
      `neo-btn--${size}`,
      block && "neo-btn--block",
      loading && "neo-btn--loading",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type="button"
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        aria-label={ariaLabel}
        onClick={handleClick}
      >
        {loading ? (
          <div className="neo-btn__spinner" aria-hidden="true" />
        ) : (
          children
        )}
      </button>
    );
  },
);
