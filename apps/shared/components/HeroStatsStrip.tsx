import { useI18n } from "@shared/react";
import "./HeroStatsStrip.scss";

export interface HeroStatsStripItem {
  label: string;
  value: string | number;
  icon?: string;
}

export interface HeroStatsStripProps {
  items: HeroStatsStripItem[];
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function HeroStatsStrip({ items, compact = false, ariaLabel, className }: HeroStatsStripProps) {
  const { t } = useI18n();

  const classes = [
    "hero-stats-strip",
    compact && "hero-stats-strip--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="list" aria-label={ariaLabel || t("heroStatsAriaLabel")}>
      {items.map((item) => (
        <div
          key={`${item.label}:${item.value}`}
          className="hero-stats-strip__item"
          role="listitem"
          aria-label={`${item.label}: ${item.value}`}
        >
          {item.icon && (
            <span className="hero-stats-strip__icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className="hero-stats-strip__value">{item.value}</span>
          <span className="hero-stats-strip__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default HeroStatsStrip;
