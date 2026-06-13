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
            <path d="M12 21V11" />
            <path d="M12 11C12 7.5 9.5 5 6 5c0 3.5 2.5 6 6 6Z" />
            <path d="M12 11c0-3 2.2-5.2 5-5.2 0 3-2.2 5.2-5 5.2Z" />
            <path d="M7 21h10" />
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
