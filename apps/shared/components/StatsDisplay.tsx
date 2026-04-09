import { useI18n } from "@shared/react";
import "./StatsDisplay.scss";

export interface StatsDisplayItem {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "success" | "danger" | "warning" | "accent" | "erobo" | "erobo-neo" | "erobo-bitcoin";
  /** Optional trend indicator */
  trend?: "up" | "down" | "neutral";
}

export type StatsDisplayLayout = "grid" | "rows";

export interface StatsDisplayProps {
  items: StatsDisplayItem[];
  layout?: StatsDisplayLayout;
  /** Number of columns when layout is 'grid' */
  columns?: 2 | 3 | 4;
  /** Compact mode with reduced padding and font sizes */
  compact?: boolean;
  /** Show skeleton loading state */
  loading?: boolean;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  className?: string;
}

export function StatsDisplay({
  items,
  layout = "grid",
  columns = 2,
  compact = false,
  loading = false,
  ariaLabel,
  className,
}: StatsDisplayProps) {
  const { t } = useI18n();

  const classes = [
    "stats-display",
    `stats-display--${layout}`,
    `stats-display--cols-${columns}`,
    compact && "stats-display--compact",
    loading && "stats-display--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  /** Number of skeleton items to show while loading */
  const loadingCount = columns;

  return (
    <div className={classes} role="list" aria-label={ariaLabel || t("statistics")}>
      {loading
        ? Array.from({ length: loadingCount }, (_, n) => (
            <div
              key={`skeleton-${n}`}
              className="stats-display__item stats-display__item--skeleton"
              role="listitem"
              aria-label={t("loading")}
            >
              <div className="stats-display__skeleton-value" />
              <div className="stats-display__skeleton-label" />
            </div>
          ))
        : items.map((item) => (
            <div
              key={item.label}
              className={[
                "stats-display__item",
                item.variant && `stats-display__item--${item.variant}`,
              ]
                .filter(Boolean)
                .join(" ")}
              role="listitem"
              aria-label={`${item.label}: ${item.value}`}
            >
              {item.icon && layout === "grid" && (
                <span className="stats-display__icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <div className="stats-display__value-row">
                <span className="stats-display__value" aria-hidden="true">
                  {item.value}
                </span>
                {item.trend && (
                  <span
                    className={`stats-display__trend stats-display__trend--${item.trend}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="stats-display__label" aria-hidden="true">
                {item.label}
              </span>
            </div>
          ))}
    </div>
  );
}

export default StatsDisplay;
