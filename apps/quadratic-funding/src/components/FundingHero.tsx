import { NeoButton } from "@shared/components-react";

interface FundingHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPct: number;
  matchingPoolDisplay: string;
  projectCount: number;
  roundCount: number;
  activeRoundCount: number;
  selectedRoundDisplay: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onContribute: () => void;
}

export default function FundingHero({
  t,
  progressPct,
  matchingPoolDisplay,
  projectCount,
  roundCount,
  activeRoundCount,
  selectedRoundDisplay,
  isRefreshing,
  onRefresh,
  onContribute,
}: FundingHeroProps) {
  const boundedProgress = Math.max(0, Math.min(100, progressPct));

  return (
    <section className="qf-hero" aria-labelledby="qf-hero-title">
      <div className="qf-hero-copy">
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
        <div className="qf-hero-actions">
          <NeoButton variant="primary" onClick={onContribute}>
            {t("qfPrimaryAction")}
          </NeoButton>
          <NeoButton variant="secondary" disabled={isRefreshing} onClick={onRefresh}>
            {t("qfRefreshAction")}
          </NeoButton>
        </div>
      </div>

      <div className="qf-hero-ledger" aria-label={t("qfRoundHealth")}>
        <div className="qf-hero-ledger-head">
          <span>{t("qfSelectedRound")}</span>
          <strong>{selectedRoundDisplay}</strong>
        </div>
        <div className="qf-progress-bar" aria-label={`${boundedProgress}% ${t("qfLiveRound")}`}>
          <span style={{ width: `${boundedProgress}%` }} />
        </div>
        <div className="qf-hero-metrics">
          <div className="qf-hero-metric">
            <span>{t("sidebarMatchingPool")}</span>
            <strong>{matchingPoolDisplay}</strong>
          </div>
          <div className="qf-hero-metric">
            <span>{t("qfLiveRound")}</span>
            <strong>
              {activeRoundCount}/{roundCount}
            </strong>
          </div>
          <div className="qf-hero-metric">
            <span>{t("tabProjects")}</span>
            <strong>{projectCount}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
