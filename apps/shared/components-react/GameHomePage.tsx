import React, { useCallback, useRef, useState } from "react";
import { BookOpenText, ChevronDown } from "lucide-react";
import { MiniAppHomeShell } from "./MiniAppHomeShell";
import type {
  MiniAppHomeShellProps,
  HomeShellStat,
  HomeShellFeature,
  HomeShellLeaderboardItem,
} from "./MiniAppHomeShell";

/* ═══════════════ Types ═══════════════ */

export { HomeShellStat, HomeShellFeature, HomeShellLeaderboardItem };

export interface GameHomePageRulesPreview {
  title: string;
  content: string;
}

export interface GameHomePageProps extends Omit<MiniAppHomeShellProps, "teaser"> {
  /** Game-specific settings element (difficulty picker, config, etc.).
   *  Rendered between Features and Leaderboard. */
  settingsElement?: React.ReactNode;
  /** Quick "How to Play" preview below the leaderboard.
   *  The platform also renders full docs below — this is just a teaser. */
  rulesPreview?: GameHomePageRulesPreview;
}

/* ═══════════════ Component ═══════════════ */

export function GameHomePage(props: GameHomePageProps) {
  const {
    settingsElement,
    rulesPreview,
    features,
    featuresEyebrow,
    featuresTitle,
    ctaTitle,
    ctaDesc,
    ctaLabel,
    trustBadges,
    ...shellProps
  } = props;
  const { onGhostClick } = shellProps;
  const shellClassName = ["n3h-shell--game", shellProps.className].filter(Boolean).join(" ");
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesRef = useRef<HTMLDivElement>(null);
  const shortHint = (value?: string) =>
    value && value.length <= 56 ? value : undefined;
  const shortTitle = (value?: string) =>
    value && value.length <= 40 ? value : undefined;
  const detailTitle =
    shortTitle(featuresTitle) ||
    shortTitle(rulesPreview?.title) ||
    shortTitle(ctaTitle) ||
    props.heroBadge ||
    props.appName;
  // The title and the hint share their last two fallbacks, so a game that
  // declares only ctaTitleKey resolved both to the same string and printed its
  // heading twice. A hint that merely repeats the title carries nothing.
  const detailHintCandidate =
    shortHint(featuresEyebrow) ||
    shortHint(rulesPreview?.title) ||
    shortHint(ctaTitle);
  const detailHint =
    detailHintCandidate === detailTitle ? undefined : detailHintCandidate;
  const detailsAvailable =
    Boolean(settingsElement) ||
    features.length > 0 ||
    Boolean(rulesPreview) ||
    Boolean(ctaTitle) ||
    Boolean(ctaDesc) ||
    (trustBadges?.length ?? 0) > 3;
  const handleRulesToggle = useCallback(() => {
    setRulesOpen((open) => !open);
  }, []);
  const handleGhostClick = useCallback(() => {
    if (!detailsAvailable) {
      onGhostClick?.();
      return;
    }
    setRulesOpen(true);
    const schedule =
      window.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    schedule(() => {
      if (typeof rulesRef.current?.scrollIntoView !== "function") return;
      rulesRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [detailsAvailable, onGhostClick]);

  return (
    <>
      <MiniAppHomeShell
        {...shellProps}
        className={shellClassName}
        onGhostClick={handleGhostClick}
        stats={[]}
        features={[]}
        leaderboard={[]}
        ctaTitle=""
        ctaDesc=""
        ctaLabel={undefined}
        trustBadges={trustBadges}
      />

      {detailsAvailable && (
        <section
          ref={rulesRef}
          className={`n3gh-details n3gh-reveal${rulesOpen ? " n3gh-details--open" : ""}`}
        >
          <button
            type="button"
            className="n3gh-details-toggle"
            onClick={handleRulesToggle}
            aria-expanded={rulesOpen}
          >
            <span className="n3gh-details-toggle__label">
              <BookOpenText size={17} strokeWidth={2.2} aria-hidden="true" />
              {detailTitle}
            </span>
            {!rulesOpen && detailHint && (
              <span className="n3gh-details-toggle__hint">{detailHint}</span>
            )}
            <ChevronDown
              className="n3gh-details-toggle__icon"
              aria-hidden="true"
              size={18}
              strokeWidth={2.2}
              data-open={rulesOpen ? "true" : undefined}
            />
          </button>

          {rulesOpen && (
            <div className="n3gh-details-body">
              {settingsElement && (
                <div className="n3gh-settings">
                  {settingsElement}
                </div>
              )}

              {features.length > 0 && (
                <div className="n3gh-feature-grid">
                  {features.map((feature) => (
                    <article
                      className="n3gh-feature-card"
                      key={`${feature.title}-${feature.desc}`}
                    >
                      <div>
                        <div className="n3gh-feature-title">{feature.title}</div>
                        <div className="n3gh-feature-desc">{feature.desc}</div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {(ctaTitle || ctaDesc) && (
                <div className="n3gh-note">
                  {ctaTitle && <div className="n3gh-note-title">{ctaTitle}</div>}
                  {ctaDesc && <div className="n3gh-note-desc">{ctaDesc}</div>}
                  {ctaLabel && ctaLabel !== props.primaryLabel && (
                    <button
                      type="button"
                      className="n3gh-note-action"
                      onClick={props.onPrimaryClick}
                    >
                      {ctaLabel}
                    </button>
                  )}
                </div>
              )}

              {rulesPreview && (
                <div className="n3gh-rules-body">
                  <div className="n3gh-rules-title">{rulesPreview.title}</div>
                  <div>{rulesPreview.content}</div>
                </div>
              )}

              {(trustBadges?.length ?? 0) > 3 && (
                <div className="n3gh-trust">
                  {trustBadges!.slice(3).map((badge) => (
                    <span key={badge}>{badge}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <style>{`
        .n3gh-reveal {
          opacity: 0;
          animation: n3gh-fade-in 220ms 80ms ease forwards;
        }
        .n3h-shell--game .n3h-hero {
          position: relative;
          min-height: min(680px, calc(100vh - 96px));
          display: block;
          overflow: hidden;
          padding: 0;
          border-radius: 28px;
          background: #fff8ed;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.58),
            0 18px 42px rgba(20, 22, 38, 0.08);
        }
        .n3h-shell--game .n3h-hero-copy {
          position: relative;
          z-index: 2;
          width: min(460px, calc(100% - 40px));
          min-height: min(680px, calc(100vh - 96px));
          align-content: end;
          padding: clamp(24px, 4.6vw, 48px);
        }
        .n3h-shell--game .n3h-badge {
          background: rgba(255, 255, 255, 0.84);
          box-shadow: 0 8px 18px rgba(20, 22, 38, 0.08);
        }
        .n3h-shell--game .n3h-title {
          max-width: 560px;
          font-size: clamp(38px, 5.4vw, 64px);
          font-weight: 700;
          letter-spacing: 0;
          line-height: 0.96;
          text-wrap: balance;
          text-shadow: 0 1px 18px rgba(255, 251, 244, 0.55), 0 1px 2px rgba(255, 251, 244, 0.8);
        }
        .n3h-shell--game .n3h-desc {
          max-width: 430px;
          color: rgba(26, 26, 25, 0.82);
          font-size: 15px;
          font-weight: 540;
          line-height: 1.52;
          -webkit-line-clamp: 4;
          text-shadow: 0 1px 12px rgba(255, 251, 244, 0.6);
        }
        .n3h-shell--game .n3h-actions {
          margin-top: 22px;
        }
        .n3h-shell--game .n3h-button {
          min-height: 48px;
          padding: 12px 24px;
          font-weight: 680;
        }
        .n3h-shell--game .n3h-button--primary {
          box-shadow: 0 14px 30px rgba(22, 199, 132, 0.24);
        }
        .n3h-shell--game .n3h-button--ghost {
          background: rgba(255, 255, 255, 0.72);
          border-color: rgba(255, 255, 255, 0.7);
          color: rgba(26, 26, 25, 0.72);
        }
        .n3h-shell--game .n3h-hero-trust span {
          border-color: rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.72);
          color: rgba(26, 26, 25, 0.68);
          box-shadow: 0 8px 18px rgba(20, 22, 38, 0.06);
        }
        .n3h-shell--game .n3h-hero-scene {
          position: absolute;
          inset: 0;
          z-index: 0;
          min-height: 100%;
          border: 0;
          border-radius: inherit;
          background: #fff8ed;
          box-shadow: none;
        }
        .n3h-shell--game .n3h-hero-scene::after {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.56) 32%, rgba(255, 255, 255, 0.12) 64%, rgba(255, 255, 255, 0) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 248, 237, 0.04) 46%, rgba(124, 45, 18, 0.14) 100%);
        }
        .n3h-shell--game .n3h-hero-banner {
          transform: scale(1.01);
          filter: saturate(1.08) contrast(1.03) brightness(1.02);
        }
        .n3h-shell--game .n3h-hero-scene-track {
          display: none;
        }
        .n3h-shell--game .n3h-hero-scene-card {
          left: auto;
          right: 24px;
          bottom: auto;
          top: 24px;
          width: 86px;
          height: 86px;
          grid-template-columns: 1fr;
          place-items: center;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.88);
          padding: 8px;
        }
        .n3h-shell--game .n3h-hero-scene-card .n3h-logo {
          width: 68px;
          height: 68px;
          border-radius: 18px;
          box-shadow: 0 12px 24px rgba(20, 22, 38, 0.12);
        }
        .n3h-shell--game .n3h-hero-scene-card .n3h-hero-scene-copy {
          display: none;
        }
        .n3gh-details {
          width: min(100% - 32px, 900px);
          margin: 14px auto 0;
          padding: 0 0 24px;
        }
        .n3gh-details-toggle {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          width: 100%;
          min-height: 48px;
          align-items: center;
          column-gap: 14px;
          row-gap: 3px;
          padding: 12px 14px;
          border: 1px solid var(--sd-border, #e8e6e1);
          border-radius: 8px;
          background: var(--sd-surface, #fff);
          color: var(--sd-ink, #1a1a19);
          cursor: pointer;
          font: inherit;
          text-align: left;
          box-shadow: 0 1px 3px rgba(20, 22, 38, 0.04);
          transition: background 150ms ease, border-color 150ms ease;
        }
        .n3gh-details-toggle:hover {
          border-color: var(--sd-border-strong, #d4d0c9);
          background: var(--sd-surface-hover, #f1efec);
        }
        .n3gh-details-toggle:focus-visible {
          outline: 3px solid rgba(22, 199, 132, 0.22);
          outline-offset: 2px;
        }
        .n3gh-details-toggle__label {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 8px;
          color: var(--sd-ink, #1a1a19);
          font-size: 14px;
          font-weight: 640;
          line-height: 1.35;
          text-align: left;
        }
        .n3gh-details-toggle__hint {
          grid-column: 1;
          overflow: hidden;
          color: var(--sd-ink-tertiary, #8b8984);
          font-size: 12px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .n3gh-details-toggle__icon {
          grid-column: 2;
          grid-row: 1 / span 2;
          flex: 0 0 auto;
          color: var(--sd-ink-tertiary, #8b8984);
          transition: transform 150ms ease;
        }
        .n3gh-details-toggle__icon[data-open="true"] {
          transform: rotate(180deg);
        }
        .n3gh-details-body {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }
        .n3gh-settings {
          min-width: 0;
        }
        .n3gh-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .n3gh-feature-card,
        .n3gh-note,
        .n3gh-rules-body {
          border: 1px solid var(--sd-border, #e8e6e1);
          border-radius: 8px;
          background: var(--sd-surface, #fff);
          box-shadow: 0 1px 3px rgba(20, 22, 38, 0.04);
        }
        .n3gh-feature-card {
          padding: 14px;
        }
        .n3gh-feature-title,
        .n3gh-note-title,
        .n3gh-rules-title {
          color: var(--sd-ink, #1a1a19);
          font-size: 14px;
          font-weight: 620;
          line-height: 1.35;
        }
        .n3gh-feature-desc,
        .n3gh-note-desc {
          margin-top: 4px;
          color: var(--sd-ink-secondary, #5c5a56);
          font-size: 13px;
          line-height: 1.5;
        }
        .n3gh-note {
          padding: 14px;
        }
        .n3gh-note-action {
          margin-top: 10px;
          border: 0;
          border-radius: 999px;
          background: var(--sd-brand-strong, #00805E);
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
        }
        .n3gh-rules-body {
          padding: 16px;
          color: var(--sd-ink-secondary, #5c5a56);
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .n3gh-rules-title {
          margin-bottom: 5px;
          color: var(--sd-ink, #1a1a19);
        }
        .n3gh-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .n3gh-trust span {
          padding: 5px 10px;
          border: 1px solid var(--sd-border, #e8e6e1);
          border-radius: 999px;
          background: var(--sd-surface, #fff);
          color: var(--sd-ink-secondary, #5c5a56);
          font-size: 12px;
          font-weight: 600;
        }
        @keyframes n3gh-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 760px) {
          .n3h-shell--game .n3h-hero {
            width: min(100% - 24px, 900px);
            min-height: min(650px, calc(100vh - 88px));
            border-radius: 26px;
          }
          .n3h-shell--game .n3h-hero-copy {
            width: 100%;
            min-height: min(650px, calc(100vh - 88px));
            padding: 88px 22px 26px;
          }
          .n3h-shell--game .n3h-title {
            font-size: clamp(34px, 11vw, 46px);
          }
          .n3h-shell--game .n3h-desc {
            max-width: 92%;
            font-size: 14px;
          }
          .n3h-shell--game .n3h-hero-scene::after {
            background:
              linear-gradient(180deg,
                rgba(255, 251, 244, 0) 0%,
                rgba(255, 251, 244, 0) 34%,
                rgba(255, 251, 244, 0.34) 50%,
                rgba(255, 250, 242, 0.82) 68%,
                rgba(255, 250, 242, 0.95) 84%,
                rgba(255, 250, 242, 0.99) 100%);
          }
          .n3h-shell--game .n3h-hero-scene-card {
            top: 18px;
            right: 18px;
            left: auto;
            width: 78px;
            height: 78px;
            border-radius: 22px;
          }
          .n3h-shell--game .n3h-hero-scene-card .n3h-logo {
            width: 62px;
            height: 62px;
          }
          .n3gh-details {
            width: min(100% - 24px, 900px);
          }
          .n3gh-feature-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .n3gh-reveal {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

export default GameHomePage;
