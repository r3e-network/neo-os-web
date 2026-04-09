import type { ReactNode } from "react";
import { useI18n } from "@shared/react";
import { StatsDisplay } from "./StatsDisplay";
import type { StatsDisplayItem } from "./StatsDisplay";
import "./StatsTab.scss";

export interface StatsTabProps {
  /** Items displayed in the top grid section */
  gridItems?: StatsDisplayItem[];
  /** Items displayed in the bottom rows section */
  rowItems?: StatsDisplayItem[];
  /** Number of grid columns */
  gridColumns?: 2 | 3 | 4;
  /** Title for the rows section */
  rowsTitle?: string;
  /** Compact mode */
  compact?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
  className?: string;
  /** Extra content */
  children?: ReactNode;
}

export function StatsTab({
  gridItems = [],
  rowItems = [],
  gridColumns = 2,
  rowsTitle,
  compact = false,
  loading = false,
  ariaLabel,
  className,
  children,
}: StatsTabProps) {
  const { t } = useI18n();

  const classes = ["stats-tab", className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-label={ariaLabel || t("statistics")}>
      {gridItems.length > 0 && (
        <div className="stats-tab__grid">
          <StatsDisplay items={gridItems} layout="grid" columns={gridColumns} compact={compact} loading={loading} />
        </div>
      )}

      {rowItems.length > 0 && (
        <div className="stats-tab__rows">
          <div className="stats-tab__card">
            {rowsTitle && <span className="stats-tab__rows-title">{rowsTitle}</span>}
            <StatsDisplay items={rowItems} layout="rows" loading={loading} />
          </div>
        </div>
      )}

      {children && <div className="stats-tab__extra">{children}</div>}
    </div>
  );
}

export default StatsTab;
