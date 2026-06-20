import { HandCoins, Leaf, RefreshCw, Sparkles } from "lucide-react";
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
      <div className="qf-hero-copy">
        <div className="qf-hero-intro">
          <span className="qf-hero-badge" aria-hidden="true">
            <Leaf />
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
              {t("qfLiveRound")}:{" "}
              <strong>
                {activeRoundCount}/{roundCount}
              </strong>
            </span>
          </div>
        ) : (
          <p className="qf-hero-empty">{t("qfNoRoundBody")}</p>
        )}

        {hasSelectedRound && (
          <div
            className="qf-progress-bar"
            aria-label={`${boundedProgress}% ${t("qfLiveRound")}`}
          >
            <span style={{ width: `${boundedProgress}%` }} />
          </div>
        )}

        <div className="qf-hero-actions">
          <NeoButton variant="primary" onClick={onContribute}>
            <HandCoins aria-hidden="true" />
            {t("qfPrimaryAction")}
          </NeoButton>
          <NeoButton
            variant="secondary"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" />
            {t("qfRefreshAction")}
          </NeoButton>
        </div>
      </div>
      <div
        className="qf-hero-art"
        role="img"
        aria-label={t("qfFundingDeskAlt")}
      >
        <img src="./funding-desk.jpg" alt="" loading="eager" decoding="async" />
        <div className="qf-hero-art-card">
          <span>
            <Sparkles aria-hidden="true" />
            {t("qfMatchSignal")}
          </span>
          <strong>{matchingPoolDisplay}</strong>
        </div>
      </div>
    </section>
  );
}
