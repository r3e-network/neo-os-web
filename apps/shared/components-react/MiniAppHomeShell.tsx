import React, { useEffect, useRef, useState } from "react";

export interface HomeShellStat {
  value: string;
  rawValue?: number;
  label: string;
  trend?: string;
}

export interface HomeShellFeature {
  icon?: string;
  title: string;
  desc: string;
  large?: boolean;
  gradient?: string;
}

export interface HomeShellLeaderboardItem {
  rank: number;
  avatar?: string;
  avatarGradient?: string;
  name: string;
  addr: string;
  score: string;
  scoreLabel?: string;
}

export interface HomeShellTeaser {
  icon?: string;
  title: string;
  desc: string;
}

export interface MiniAppHomeShellProps {
  className?: string;
  appIcon?: string;
  appLogoUrl?: string;
  appBannerUrl?: string;
  appName: string;
  categoryColor?: string;
  heroBadge: string;
  heroTitle: string;
  heroTitleAccent?: string;
  heroDesc: string;
  primaryLabel: string;
  ghostLabel?: string;
  /** Optional second entry CTA (e.g. "Play free" for guest mode). */
  secondaryLabel?: string;
  onPrimaryClick?: () => void;
  onGhostClick?: () => void;
  onSecondaryClick?: () => void;
  stats: HomeShellStat[];
  featuresEyebrow?: string;
  featuresTitle?: string;
  features: HomeShellFeature[];
  lbEyebrow?: string;
  lbTitle?: string;
  leaderboard: HomeShellLeaderboardItem[];
  teaser?: HomeShellTeaser;
  ctaTitle: string;
  ctaDesc: string;
  ctaLabel?: string;
  trustBadges?: string[];
}

const DEFAULT_CATEGORY = "#16C784";
const CATEGORY_FALLBACK = "rgba(22, 199, 132, 0.12)";
const RANK_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: "#FFF2C7", color: "#8A5A00" },
  2: { bg: "#EEF1F4", color: "#4B5563" },
  3: { bg: "#FFE6D6", color: "#A4480B" },
};

function toRgba(hex: string, alpha: number): string {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_CATEGORY;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.unobserve(element);
      },
      { threshold, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function renderTitle(title: string, accent?: string) {
  if (!accent || !title.includes(accent)) return title;
  const parts = title.split(accent);
  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && (
        <span className="n3h-title-accent">{accent}</span>
      )}
    </React.Fragment>
  ));
}

export function MiniAppHomeShell(props: MiniAppHomeShellProps) {
  const category = props.categoryColor || DEFAULT_CATEGORY;
  const categorySoft = toRgba(category, 0.1);
  const hasCta = Boolean(props.ctaTitle || props.ctaDesc || props.ctaLabel);
  const heroTrustBadges = props.trustBadges?.slice(0, 3) ?? [];
  const statsReveal = useReveal();
  const featuresReveal = useReveal(0.08);
  const leaderboardReveal = useReveal(0.08);
  const teaserReveal = useReveal(0.12);
  const ctaReveal = useReveal(0.12);

  const features = props.features.slice(0, 3);
  const largeFeature = features.find((feature) => feature.large) ?? features[0];
  const smallFeatures = features.filter((feature) => feature !== largeFeature);

  const revealClass = (visible: boolean) =>
    visible ? " n3h-section--visible" : "";
  const shellClassName = ["n3h-shell", props.className].filter(Boolean).join(" ");

  return (
    <div
      className={shellClassName}
      style={
        {
          "--n3h-accent": category,
          "--n3h-accent-soft": categorySoft || CATEGORY_FALLBACK,
        } as React.CSSProperties
      }
    >
      <style>{`
        .n3h-shell {
          min-height: 0;
          background: var(--sd-canvas, #FAF9F7);
          color: var(--sd-ink, #1A1A19);
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          line-height: 1.55;
          overflow-x: hidden;
        }

        .n3h-hero,
        .n3h-section {
          width: min(100% - 32px, 900px);
          margin: 0 auto;
        }

        .n3h-hero {
          box-sizing: border-box;
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(280px, 0.78fr);
          gap: 22px;
          align-items: stretch;
          padding: 22px;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 12px;
          background: linear-gradient(180deg, #fff 0%, var(--sd-canvas-alt, #F4F2EF) 100%);
          box-shadow: 0 10px 26px rgba(20, 22, 38, 0.05);
          text-align: left;
        }

        .n3h-hero-copy {
          min-width: 0;
          display: grid;
          align-content: center;
          justify-items: start;
          padding: 10px 4px 10px 8px;
        }

        .n3h-logo {
          display: grid;
          width: 74px;
          height: 74px;
          place-items: center;
          overflow: hidden;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 16px 28px rgba(20, 22, 38, 0.13);
        }

        .n3h-logo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .n3h-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding: 5px 12px;
          border: 1px solid var(--n3h-accent-soft);
          border-radius: 999px;
          background: var(--n3h-accent-soft);
          color: var(--n3h-accent);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .n3h-badge-mark {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
        }

        .n3h-title {
          max-width: 680px;
          margin: 0;
          color: var(--sd-ink, #1A1A19);
          font-size: 32px;
          font-weight: 650;
          letter-spacing: 0;
          line-height: 1.14;
        }

        .n3h-title-accent {
          color: var(--n3h-accent);
        }

        .n3h-desc {
          max-width: 560px;
          display: -webkit-box;
          margin: 12px 0 0;
          overflow: hidden;
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 15px;
          line-height: 1.55;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .n3h-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 10px;
          margin-top: 24px;
        }

        .n3h-hero-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .n3h-hero-trust span {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.74);
          color: var(--sd-ink-secondary, #5C5A56);
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 620;
        }

        .n3h-hero-scene {
          position: relative;
          min-height: 300px;
          overflow: hidden;
          border: 1px solid rgba(20, 22, 38, 0.08);
          border-radius: 12px;
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.74);
          isolation: isolate;
        }

        .n3h-hero-scene::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.84)),
            linear-gradient(90deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.12));
          pointer-events: none;
        }

        .n3h-hero-banner {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transform: scale(1.02);
        }

        .n3h-hero-scene-fallback {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 28% 22%, var(--n3h-accent-soft), transparent 34%),
            linear-gradient(135deg, #fff 0%, var(--sd-canvas-alt, #F4F2EF) 100%);
        }

        .n3h-hero-scene-card {
          position: absolute;
          z-index: 2;
          left: 18px;
          right: 18px;
          bottom: 18px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 13px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 18px 34px rgba(20, 22, 38, 0.12);
          padding: 14px;
          backdrop-filter: blur(12px);
        }

        .n3h-hero-scene-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .n3h-hero-scene-copy span {
          color: var(--n3h-accent);
          font-size: 11px;
          font-weight: 680;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .n3h-hero-scene-copy strong {
          overflow: hidden;
          color: var(--sd-ink, #1A1A19);
          font-size: 16px;
          font-weight: 660;
          line-height: 1.22;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .n3h-hero-scene-track {
          position: absolute;
          z-index: 2;
          left: 20px;
          right: 20px;
          top: 20px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .n3h-hero-scene-track span {
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.58);
        }

        .n3h-hero-scene-track span::after {
          content: "";
          display: block;
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: var(--n3h-accent);
          animation: n3h-track-sweep 1.8s ease-in-out infinite;
        }

        .n3h-hero-scene-track span:nth-child(2)::after {
          animation-delay: 160ms;
        }

        .n3h-hero-scene-track span:nth-child(3)::after {
          animation-delay: 320ms;
        }

        .n3h-button {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          padding: 10px 22px;
          border: 1px solid transparent;
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0;
          text-decoration: none;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
        }

        .n3h-button:focus-visible {
          outline: 3px solid ${toRgba(category, 0.24)};
          outline-offset: 2px;
        }

        .n3h-button--primary {
          background: var(--sd-brand-strong, #00805E);
          color: #fff;
          box-shadow: 0 8px 20px rgba(22, 199, 132, 0.2);
        }

        .n3h-button--primary:hover {
          background: var(--sd-brand-strong-hover, #00735F);
          transform: translateY(-1px);
        }

        .n3h-button--secondary {
          background: var(--sd-surface, #fff);
          border-color: var(--sd-border-strong, #D4D0C9);
          color: var(--sd-ink, #1A1A19);
          box-shadow: var(--sd-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.04));
        }

        .n3h-button--secondary:hover {
          background: var(--sd-surface-hover, #F1EFEC);
          border-color: var(--sd-ink-tertiary, #8B8984);
          transform: translateY(-1px);
        }

        .n3h-button--ghost {
          background: transparent;
          border-color: transparent;
          color: var(--sd-ink-secondary, #5C5A56);
          box-shadow: none;
        }

        .n3h-button--ghost:hover {
          border-color: var(--sd-border, #E8E6E1);
          background: rgba(255, 255, 255, 0.72);
          color: var(--sd-ink, #1A1A19);
        }

        .n3h-section {
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 220ms ease, transform 220ms ease;
        }

        .n3h-section--visible {
          opacity: 1;
          transform: translateY(0);
        }

        .n3h-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 8px;
          background: var(--sd-border, #E8E6E1);
        }

        .n3h-stat {
          min-width: 0;
          padding: 16px 12px;
          background: #fff;
          text-align: center;
        }

        .n3h-stat-value {
          overflow: hidden;
          color: var(--sd-ink, #1A1A19);
          font-size: 20px;
          font-weight: 700;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .n3h-stat-label {
          margin-top: 6px;
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0;
        }

        .n3h-stat-trend {
          margin-top: 5px;
          color: var(--n3h-accent);
          font-size: 12px;
          font-weight: 700;
        }

        .n3h-features {
          display: grid;
          gap: 14px;
          padding-top: 42px;
        }

        .n3h-section-kicker {
          color: var(--n3h-accent);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0;
        }

        .n3h-section-title {
          margin: 4px 0 4px;
          color: var(--sd-ink, #1A1A19);
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1.22;
        }

        .n3h-feature-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.95fr);
          gap: 14px;
        }

        .n3h-feature-card {
          min-width: 0;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 1px 3px rgba(20, 22, 38, 0.04);
        }

        .n3h-feature-card--primary {
          overflow: hidden;
        }

        .n3h-feature-visual {
          display: flex;
          min-height: 118px;
          align-items: center;
          gap: 14px;
          padding: 20px;
          background: var(--n3h-feature-bg, var(--n3h-accent-soft));
        }

        .n3h-feature-visual-copy {
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 8px 22px rgba(20, 22, 38, 0.08);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
        }

        .n3h-feature-logo {
          width: 54px;
          height: 54px;
          overflow: hidden;
          flex: 0 0 auto;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 8px 18px rgba(20, 22, 38, 0.08);
        }

        .n3h-feature-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .n3h-feature-body {
          padding: 18px;
        }

        .n3h-feature-card--primary .n3h-feature-body {
          padding: 18px 20px 20px;
        }

        .n3h-feature-card--primary .n3h-feature-title {
          color: #1A1A19;
        }

        .n3h-feature-card--primary .n3h-feature-desc {
          color: #44413D;
        }

        .n3h-feature-title {
          color: var(--sd-ink, #1A1A19);
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1.25;
        }

        .n3h-feature-desc {
          margin-top: 6px;
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 13px;
          line-height: 1.55;
        }

        .n3h-feature-list {
          display: grid;
          gap: 14px;
        }

        .n3h-feature-card--small {
          padding: 18px;
        }

        .n3h-feature-rule {
          width: 36px;
          height: 3px;
          margin-bottom: 12px;
          border-radius: 999px;
          background: var(--n3h-accent);
        }

        .n3h-lb {
          padding-top: 42px;
        }

        .n3h-lb-list {
          margin-top: 16px;
          overflow: hidden;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 8px;
          background: #fff;
        }

        .n3h-lb-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 13px 16px;
        }

        .n3h-lb-row + .n3h-lb-row {
          border-top: 1px solid var(--sd-border, #E8E6E1);
        }

        .n3h-rank {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border-radius: 999px;
          background: var(--sd-canvas-alt, #F4F2EF);
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 13px;
          font-weight: 600;
        }

        .n3h-lb-name,
        .n3h-lb-score {
          color: var(--sd-ink, #1A1A19);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.25;
        }

        .n3h-lb-name,
        .n3h-lb-addr {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .n3h-lb-addr,
        .n3h-lb-score-label {
          margin-top: 2px;
          color: var(--sd-ink-tertiary, #8B8984);
          font-size: 11px;
          letter-spacing: 0;
        }

        .n3h-lb-score-wrap {
          text-align: right;
        }

        .n3h-teaser {
          display: grid;
          gap: 5px;
          margin-top: 34px;
          padding: 18px;
          border: 1px dashed var(--sd-border-strong, #D4D0C9);
          border-radius: 8px;
          background: var(--sd-canvas-alt, #F4F2EF);
          text-align: center;
        }

        .n3h-teaser-title {
          color: var(--sd-ink, #1A1A19);
          font-size: 15px;
          font-weight: 600;
        }

        .n3h-teaser-desc {
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 13px;
          line-height: 1.5;
        }

        .n3h-cta {
          display: grid;
          justify-items: center;
          padding: 46px 0 44px;
          text-align: center;
        }

        .n3h-cta-title {
          max-width: 520px;
          margin: 0;
          color: var(--sd-ink, #1A1A19);
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1.25;
        }

        .n3h-cta-desc {
          max-width: 520px;
          margin: 9px 0 20px;
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 14px;
          line-height: 1.6;
        }

        .n3h-trust {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
        }

        .n3h-trust span {
          padding: 5px 10px;
          border: 1px solid var(--sd-border, #E8E6E1);
          border-radius: 999px;
          background: #fff;
          color: var(--sd-ink-secondary, #5C5A56);
          font-size: 12px;
          font-weight: 640;
        }

        @media (max-width: 760px) {
          .n3h-hero,
          .n3h-section {
            width: min(100% - 24px, 900px);
          }

          .n3h-hero {
            grid-template-columns: 1fr;
            gap: 16px;
            padding: 18px;
          }

          .n3h-hero-copy {
            padding: 0;
          }

          .n3h-hero-scene {
            min-height: 224px;
            order: -1;
          }

          .n3h-logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
          }

          .n3h-title {
            font-size: 27px;
          }

          .n3h-stats,
          .n3h-feature-grid {
            grid-template-columns: 1fr;
          }

          .n3h-stat {
            text-align: left;
          }

          .n3h-lb-row {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .n3h-lb-score-wrap {
            grid-column: 2;
            text-align: left;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .n3h-section,
          .n3h-button,
          .n3h-hero-scene-track span::after {
            transition: none;
            animation: none;
          }
        }

        @keyframes n3h-track-sweep {
          0%, 100% { transform: translateX(-10%); opacity: 0.64; }
          50% { transform: translateX(148%); opacity: 1; }
        }
      `}</style>

      <section className="n3h-hero">
        <div className="n3h-hero-copy">
          <div className="n3h-badge">
            <span className="n3h-badge-mark" />
            {props.heroBadge}
          </div>
          <h1 className="n3h-title">
            {renderTitle(props.heroTitle, props.heroTitleAccent)}
          </h1>
          <p className="n3h-desc">{props.heroDesc}</p>
          <div className="n3h-actions">
            <button
              type="button"
              className="n3h-button n3h-button--primary"
              onClick={props.onPrimaryClick}
            >
              {props.primaryLabel}
            </button>
            {props.secondaryLabel && (
              <button
                type="button"
                className="n3h-button n3h-button--secondary"
                onClick={props.onSecondaryClick}
              >
                {props.secondaryLabel}
              </button>
            )}
            {props.ghostLabel && (
              <button
                type="button"
                className="n3h-button n3h-button--ghost"
                onClick={props.onGhostClick}
              >
                {props.ghostLabel}
              </button>
            )}
          </div>
          {heroTrustBadges.length > 0 && (
            <div className="n3h-hero-trust">
              {heroTrustBadges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          )}
        </div>

        <div className="n3h-hero-scene" aria-hidden="true">
          {props.appBannerUrl ? (
            <img
              className="n3h-hero-banner"
              src={props.appBannerUrl}
              alt=""
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="n3h-hero-scene-fallback" />
          )}
          <div className="n3h-hero-scene-track">
            <span />
            <span />
            <span />
          </div>
          <div className="n3h-hero-scene-card">
            <span className="n3h-logo">
              {props.appLogoUrl ? (
                <img
                  src={props.appLogoUrl}
                  alt=""
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </span>
            <span className="n3h-hero-scene-copy">
              <span>{props.heroBadge}</span>
              <strong>{props.appName}</strong>
            </span>
          </div>
        </div>
      </section>

      {props.stats.length > 0 && (
        <section
          className={`n3h-section n3h-stats${revealClass(statsReveal.visible)}`}
          ref={statsReveal.ref}
        >
          {props.stats.map((stat) => (
            <div className="n3h-stat" key={`${stat.label}-${stat.value}`}>
              <div className="n3h-stat-value">{stat.value}</div>
              <div className="n3h-stat-label">{stat.label}</div>
              {stat.trend && <div className="n3h-stat-trend">{stat.trend}</div>}
            </div>
          ))}
        </section>
      )}

      {features.length > 0 && largeFeature && (
        <section
          className={`n3h-section n3h-features${revealClass(featuresReveal.visible)}`}
          ref={featuresReveal.ref}
        >
          {props.featuresEyebrow && (
            <div className="n3h-section-kicker">{props.featuresEyebrow}</div>
          )}
          {props.featuresTitle && (
            <h2 className="n3h-section-title">{props.featuresTitle}</h2>
          )}
          <div className="n3h-feature-grid">
            <article className="n3h-feature-card n3h-feature-card--primary">
              <div
                className="n3h-feature-visual"
                style={
                  largeFeature.gradient
                    ? ({ "--n3h-feature-bg": largeFeature.gradient } as React.CSSProperties)
                    : undefined
                }
              >
                {props.appLogoUrl && (
                  <span className="n3h-feature-logo" aria-hidden="true">
                    <img src={props.appLogoUrl} alt="" draggable={false} />
                  </span>
                )}
                <div className="n3h-feature-visual-copy">
                  <div className="n3h-feature-title">{largeFeature.title}</div>
                  <div className="n3h-feature-desc">{largeFeature.desc}</div>
                </div>
              </div>
            </article>
            {smallFeatures.length > 0 && (
              <div className="n3h-feature-list">
                {smallFeatures.map((feature) => (
                  <article
                    className="n3h-feature-card n3h-feature-card--small"
                    key={feature.title}
                  >
                    <div className="n3h-feature-rule" />
                    <div className="n3h-feature-title">{feature.title}</div>
                    <div className="n3h-feature-desc">{feature.desc}</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {props.leaderboard.length > 0 && (
        <section
          className={`n3h-section n3h-lb${revealClass(leaderboardReveal.visible)}`}
          ref={leaderboardReveal.ref}
        >
          {props.lbEyebrow && (
            <div className="n3h-section-kicker">{props.lbEyebrow}</div>
          )}
          {props.lbTitle && <h2 className="n3h-section-title">{props.lbTitle}</h2>}
          <div className="n3h-lb-list">
            {props.leaderboard.map((item) => {
              const rankStyle = RANK_COLORS[item.rank];
              return (
                <div className="n3h-lb-row" key={`${item.rank}-${item.addr}`}>
                  <span
                    className="n3h-rank"
                    style={rankStyle ? { background: rankStyle.bg, color: rankStyle.color } : undefined}
                  >
                    {item.rank}
                  </span>
                  <div>
                    <div className="n3h-lb-name">{item.name}</div>
                    <div className="n3h-lb-addr">{item.addr}</div>
                  </div>
                  <div className="n3h-lb-score-wrap">
                    <div className="n3h-lb-score">{item.score}</div>
                    <div className="n3h-lb-score-label">{item.scoreLabel || "Score"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {props.teaser && (
        <section
          className={`n3h-section n3h-teaser${revealClass(teaserReveal.visible)}`}
          ref={teaserReveal.ref}
        >
          <div className="n3h-teaser-title">{props.teaser.title}</div>
          <div className="n3h-teaser-desc">{props.teaser.desc}</div>
        </section>
      )}

      {hasCta && (
        <section
          className={`n3h-section n3h-cta${revealClass(ctaReveal.visible)}`}
          ref={ctaReveal.ref}
        >
          {props.ctaTitle && <h2 className="n3h-cta-title">{props.ctaTitle}</h2>}
          {props.ctaDesc && <p className="n3h-cta-desc">{props.ctaDesc}</p>}
          {props.ctaLabel && (
            <button
              type="button"
              className="n3h-button n3h-button--primary"
              onClick={props.onPrimaryClick}
            >
              {props.ctaLabel}
            </button>
          )}
          {(props.trustBadges?.length ?? 0) > 0 && (
            <div className="n3h-trust">
              {props.trustBadges!.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default MiniAppHomeShell;
