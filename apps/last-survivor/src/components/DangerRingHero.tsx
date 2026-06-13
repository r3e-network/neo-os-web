import "./DangerRingHero.scss";

interface DangerRingHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  countdown: string;
  dangerLevel: string;
  shouldPulse: boolean;
  formattedPot: string;
  /**
   * Whether a live round is driving the countdown. When false (idle / no
   * round data) the ring stays on the calm system accent instead of showing
   * an alarming red state for an empty timer.
   */
  active?: boolean;
  /**
   * A fresh round (active on-chain but with no keys sold yet) reports
   * remainingTime 0; the ring shows this "awaiting the first key" caption
   * instead of an alarming red CRITICAL 00:00:00 state.
   */
  awaitingFirstKey?: boolean;
}

export default function DangerRingHero({
  t,
  countdown,
  dangerLevel,
  shouldPulse,
  formattedPot,
  active = true,
  awaitingFirstKey = false,
}: DangerRingHeroProps) {
  // Red/amber hues are reserved for a genuinely live round nearing zero.
  // While idle the derived level is "critical" (0s remaining) but that is not
  // real danger, so collapse to the calm default accent.
  const effectiveLevel = active ? dangerLevel : "low";
  const effectivePulse = active && shouldPulse;

  return (
    <div className="danger-ring-hero">
      <div className={`danger-ring ${effectiveLevel}${effectivePulse ? " pulse" : ""}`}>
        <div className="ring-inner">
          <div className="ring-glow" />
          <div className="hero-countdown" aria-live="polite" role="timer">
            <span className="countdown-digits">{countdown}</span>
            <span className="countdown-label">
              {awaitingFirstKey ? t("awaitingFirstKey") : t("timeUntilEvent")}
            </span>
          </div>
        </div>
      </div>

      <div className="hero-prize-pool">
        <span className="prize-label">{t("totalPot")}</span>
        <div className="prize-amount-row">
          <span className="prize-amount">{formattedPot}</span>
          <span className="prize-token">{t("tokenGas")}</span>
        </div>
        <div className="pot-glow-bar" />
      </div>
    </div>
  );
}
