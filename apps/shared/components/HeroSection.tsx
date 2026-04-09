import type { ReactNode } from "react";
import { useI18n } from "@shared/react";
import "./HeroSection.scss";

export type HeroVariant = "default" | "erobo" | "erobo-neo" | "erobo-bitcoin" | "accent" | "danger";

export interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  suffix?: string;
  variant?: HeroVariant;
  /** Emoji or icon character displayed above the title */
  icon?: string;
  /** Description text below the suffix */
  description?: string;
  /** Compact mode with reduced padding */
  compact?: boolean;
  /** Accessibility label override */
  ariaLabel?: string;
  className?: string;
  /** Background slot content */
  background?: ReactNode;
  /** Stats slot content */
  stats?: ReactNode;
  /** Actions slot content */
  actions?: ReactNode;
  /** Default slot content */
  children?: ReactNode;
}

export function HeroSection({
  title,
  subtitle,
  suffix,
  variant = "default",
  icon,
  description,
  compact = false,
  ariaLabel,
  className,
  background,
  stats,
  actions,
  children,
}: HeroSectionProps) {
  const { t } = useI18n();

  const classes = [
    "hero-section",
    variant !== "default" && `hero-section--${variant}`,
    compact && "hero-section--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={classes} aria-label={title || ariaLabel || t("heroSectionAriaLabel")}>
      {background && (
        <div className="hero-section__background" aria-hidden="true">
          {background}
        </div>
      )}

      <div className="hero-section__content">
        {icon && (
          <span className="hero-section__icon" aria-hidden="true">
            {icon}
          </span>
        )}

        {subtitle && <span className="hero-section__subtitle">{subtitle}</span>}
        {title && <span className="hero-section__title">{title}</span>}
        {suffix && <span className="hero-section__suffix">{suffix}</span>}

        {description && (
          <div className="hero-section__description">
            <span>{description}</span>
          </div>
        )}

        {stats && <div className="hero-section__stats">{stats}</div>}
        {actions && <div className="hero-section__actions">{actions}</div>}
        {children && <div className="hero-section__extra">{children}</div>}
      </div>
    </header>
  );
}

export default HeroSection;
