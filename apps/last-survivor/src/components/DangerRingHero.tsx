import { NeoButton } from "@shared/components-react";
import "./DangerRingHero.scss";

interface DangerRingHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  countdown: string;
  dangerLevel: string;
  shouldPulse: boolean;
  formattedPot: string;
  canClaim: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}

export default function DangerRingHero({ t, countdown, dangerLevel, shouldPulse, formattedPot, canClaim, isClaiming, onClaim }: DangerRingHeroProps) {
  return (
    <div className="danger-ring-hero">
      <div className={`danger-ring ${dangerLevel}${shouldPulse ? " pulse" : ""}`}>
        <div className="ring-inner">
          <div className="ring-glow" />
          <div className="hero-countdown" aria-live="polite" role="timer">
            <span className="countdown-digits">{countdown}</span>
            <span className="countdown-label">{t("timeUntilEvent")}</span>
          </div>
        </div>
      </div>

      <div className="hero-prize-pool">
        <span className="prize-label">{t("totalPot")}</span>
        <div className="prize-amount-row">
          <span className="prize-gas-icon" aria-hidden="true">&#x26FD;</span>
          <span className="prize-amount">{formattedPot}</span>
          <span className="prize-token">{t("tokenGas")}</span>
        </div>
        <div className="pot-glow-bar" />
      </div>

      {canClaim && (
        <div className="hero-claim-banner" role="alert">
          <div className="claim-trophy" aria-hidden="true">&#x1F3C6;</div>
          <span className="claim-text">{t("youWon")}</span>
          <NeoButton variant="primary" size="lg" block loading={isClaiming} onClick={onClaim} aria-label={t("claimPrize")}>
            {t("claimPrize")}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
