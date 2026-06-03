import { NeoButton } from "@shared/components-react";

interface FundingHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPct: number;
  matchingPoolDisplay: string;
  activeRoundCount: number;
  roundCount: number;
  selectedRoundDisplay: string;
  hasSelectedRound: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onContribute: () => void;
}

export default function FundingHero({
  t,
  progressPct,
  matchingPoolDisplay,
  activeRoundCount,
  roundCount,
  selectedRoundDisplay,
  hasSelectedRound,
  isRefreshing,
  onRefresh,
  onContribute,
}: FundingHeroProps) {
  const boundedProgress = Math.max(0, Math.min(100, progressPct));

  return (
    <section className="qf-hero" aria-labelledby="qf-hero-title">
      <div className="qf-hero-intro">
        <span className="qf-hero-badge" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
        <span className="qf-hero-kicker">{t("title")}</span>
      </div>

      <h1 id="qf-hero-title">{t("qfHeroTitle")}</h1>
      <p>{t("qfHeroSubtitle")}</p>

      {hasSelectedRound ? (
        <div className="qf-hero-facts">
          <span>
            {t("qfSelectedRound")}: <strong>{selectedRoundDisplay}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t("sidebarMatchingPool")}: <strong>{matchingPoolDisplay}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t("qfLiveRound")}: <strong>{activeRoundCount}/{roundCount}</strong>
          </span>
        </div>
      ) : (
        <p className="qf-hero-empty">{t("qfNoRoundBody")}</p>
      )}

      {hasSelectedRound && (
        <div className="qf-progress-bar" aria-label={`${boundedProgress}% ${t("qfLiveRound")}`}>
          <span style={{ width: `${boundedProgress}%` }} />
        </div>
      )}

      <div className="qf-hero-actions">
        <NeoButton variant="primary" onClick={onContribute}>
          {t("qfPrimaryAction")}
        </NeoButton>
        <NeoButton variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
          {t("qfRefreshAction")}
        </NeoButton>
      </div>
    </section>
  );
}
