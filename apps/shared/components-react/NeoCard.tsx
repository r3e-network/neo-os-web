import { type ReactNode, type MouseEvent, type KeyboardEvent } from "react";
import "./NeoCard.scss";

export type CardVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "erobo"
  | "erobo-neo"
  | "erobo-bitcoin";

export interface NeoCardProps {
  title?: string;
  variant?: CardVariant;
  hoverable?: boolean;
  flat?: boolean;
  /** Accessibility label for screen readers */
  "aria-label"?: string;
  className?: string;
  children?: ReactNode;
  /** Content rendered inside the header alongside the title */
  header?: ReactNode;
  /** Content rendered in the footer section */
  footer?: ReactNode;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

function createClickEvent(keyboardEvent: KeyboardEvent<HTMLDivElement>): MouseEvent<HTMLDivElement> {
  // Synthesize a MouseEvent from the keyboard event for the onClick handler
  return new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
  }) as unknown as MouseEvent<HTMLDivElement>;
}

export function NeoCard({
  title,
  variant = "default",
  hoverable = false,
  flat = false,
  "aria-label": ariaLabel,
  className,
  children,
  header,
  footer,
  onClick,
}: NeoCardProps) {
  const classes = [
    "neo-card",
    `neo-card--${variant}`,
    hoverable && "neo-card--hoverable",
    flat && "neo-card--flat",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hoverable || !onClick) return;
    if (event.key === "Enter") {
      onClick(createClickEvent(event));
    } else if (event.key === " ") {
      event.preventDefault();
      onClick(createClickEvent(event));
    }
  }

  return (
    <div
      className={classes}
      role={hoverable ? "button" : "region"}
      tabIndex={hoverable ? 0 : undefined}
      aria-label={ariaLabel || title || undefined}
      onClick={hoverable ? onClick : undefined}
      onKeyDown={handleKeyDown}
    >
      {(title || header) && (
        <div className="neo-card__header">
          {title && <span className="neo-card__title">{title}</span>}
          {header}
        </div>
      )}
      <div className="neo-card__body">{children}</div>
      {footer && <div className="neo-card__footer">{footer}</div>}
    </div>
  );
}
