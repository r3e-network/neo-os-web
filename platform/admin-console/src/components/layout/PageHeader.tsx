// =============================================================================
// Shared page header for admin-console routes.
//
// Replaces the ad-hoc `<div><h1>...</h1><p>...</p></div>` block that 9 of the
// 10 sub-pages were hand-rolling. Centralizing the style makes future polish
// changes a single-file edit and ensures every admin page reads the same.
// =============================================================================
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Main page title. */
  title: string;
  /** Optional highlight applied to the last word of the title (the dashboard's
   *  brand-mark treatment). When set, the trailing word is rendered in the
   *  neo green with a soft drop-shadow. */
  highlightLastWord?: boolean;
  /** Short descriptive subtitle. */
  description?: string;
  /** Optional right-aligned action cluster (filters, buttons, dropdowns). */
  actions?: ReactNode;
  /** Tag override for the title element. Defaults to h1. */
  as?: "h1" | "h2";
  /** Additional class names to merge onto the root element. */
  className?: string;
}

export function PageHeader({
  title,
  highlightLastWord = false,
  description,
  actions,
  as = "h1",
  className,
}: PageHeaderProps) {
  const Heading = as;
  const headingClass = cn(
    "text-2xl font-black text-gray-900 dark:text-white sm:text-3xl",
  );

  const titleNode = highlightLastWord ? renderHighlighted(title) : title;

  return (
    <header className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <Heading className={headingClass}>{titleNode}</Heading>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

function renderHighlighted(title: string): ReactNode {
  const trimmed = title.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) {
    return (
      <span className="text-neo drop-shadow-[0_0_8px_rgba(0,229,153,0.5)]">{trimmed}</span>
    );
  }
  return (
    <>
      {trimmed.slice(0, lastSpace)}{" "}
      <span className="text-neo drop-shadow-[0_0_8px_rgba(0,229,153,0.5)]">
        {trimmed.slice(lastSpace + 1)}
      </span>
    </>
  );
}
