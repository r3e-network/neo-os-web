import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * v2 ActionRail — the primary action hierarchy under the Stage.
 *
 * Renders ONE prominent primary action (the main thing the user does — roll,
 * deal, claim, mint) plus optional secondary actions (withdraw, view rules).
 * This is the fix for "摊大饼": the main verb is unmissable, supporting verbs
 * are clearly secondary, and advanced parameters never appear here — they live
 * in a DetailDrawer toggled by the rail.
 *
 * The primary button is a styled <button>; callers wire onClick. A loading
 * state swaps the label for a spinner and disables interaction.
 */
export interface ActionRailAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Tooltip/aria description. */
  hint?: string;
}

export interface ActionRailProps {
  category?: "game" | "defi" | "nft" | "tool";
  className?: string;
  /** The dominant action; optional so informational views do not fake a primary button. */
  primary?: ActionRailAction;
  /** Supporting actions (rendered as secondary chips). Keep ≤ 2. */
  secondary?: ActionRailAction[];
  /** Label for grouped secondary actions when there are multiple support verbs. */
  secondaryToggleLabel?: string;
  /** A live readout above the rail (stake summary, payout preview, balance). */
  readout?: React.ReactNode;
  /** Toggle button text for the tucked-away detail drawer. */
  drawerToggleLabel?: string;
  onToggleDrawer?: () => void;
  drawerOpen?: boolean;
}

export function ActionRail({
  category = "game",
  className,
  primary,
  secondary,
  secondaryToggleLabel = "More actions",
  readout,
  drawerToggleLabel = "Details",
  onToggleDrawer,
  drawerOpen,
}: ActionRailProps) {
  const secondaryMenuId = useId();
  const [secondaryMenuOpen, setSecondaryMenuOpen] = useState(false);
  const secondaryActions = secondary ?? [];
  const inlineSecondary = secondaryActions.length <= 2 ? secondaryActions : [];
  const groupedSecondary = secondaryActions.length > 2 ? secondaryActions : [];
  const renderSecondaryAction = (
    action: ActionRailAction,
    index: number,
    className = "",
  ) => (
    <button
      key={`${action.label}-${index}`}
      type="button"
      className={["mx2-btn mx2-btn--ghost", className].filter(Boolean).join(" ")}
      onClick={() => {
        action.onClick();
        setSecondaryMenuOpen(false);
      }}
      disabled={action.disabled || action.loading}
      title={action.hint}
      role={className.includes("secondary-item") ? "menuitem" : undefined}
    >
      {action.icon}
      <span>{action.label}</span>
    </button>
  );

  return (
    <div
      className={["mx2", `mx2-cat-${category}`, "mx2-action-rail", className]
        .filter(Boolean)
        .join(" ")}
    >
      {readout && <div className="mx2-action-rail__readout">{readout}</div>}
      <div className="mx2-action-rail__row">
        {primary && (
          <button
            type="button"
            className="mx2-btn mx2-btn--primary"
            onClick={primary.onClick}
            disabled={primary.disabled || primary.loading}
            aria-busy={primary.loading || undefined}
            title={primary.hint}
          >
            {primary.loading ? (
              <span className="mx2-spinner" aria-hidden="true" />
            ) : (
              primary.icon
            )}
            <span>{primary.label}</span>
          </button>
        )}
        {inlineSecondary.map((a, i) => renderSecondaryAction(a, i))}
        {groupedSecondary.length > 0 && (
          <div className="mx2-action-rail__secondary-menu">
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost mx2-action-rail__secondary-toggle"
              onClick={() => setSecondaryMenuOpen((open) => !open)}
              aria-expanded={secondaryMenuOpen}
              aria-controls={secondaryMenuId}
            >
              <span>{secondaryToggleLabel}</span>
              <ChevronDown
                className="mx2-action-rail__caret"
                data-open={secondaryMenuOpen ? "true" : undefined}
                aria-hidden="true"
                size={16}
              />
            </button>
            {secondaryMenuOpen && (
              <div
                id={secondaryMenuId}
                className="mx2-action-rail__secondary-popover"
                role="menu"
                aria-label={secondaryToggleLabel}
              >
                {groupedSecondary.map((a, i) =>
                  renderSecondaryAction(
                    a,
                    i,
                    "mx2-action-rail__secondary-item",
                  ),
                )}
              </div>
            )}
          </div>
        )}
        {onToggleDrawer && (
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost mx2-action-rail__drawer-toggle"
            onClick={onToggleDrawer}
            aria-expanded={drawerOpen || undefined}
            aria-controls="mx2-detail-drawer"
          >
            <span>{drawerToggleLabel}</span>
            <ChevronDown
              className="mx2-action-rail__caret"
              data-open={drawerOpen ? "true" : undefined}
              aria-hidden="true"
              size={16}
            />
          </button>
        )}
      </div>
    </div>
  );
}
