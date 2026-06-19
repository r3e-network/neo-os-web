import "./DangerMeter.scss";

interface DangerMeterProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  level: string;
  levelText: string;
  progress: number;
  /**
   * Whether a live round is driving the gauge. While idle the derived level is
   * "critical" with 0% progress, which reads as a buggy red state — fall back
   * to the calm default tier instead.
   */
  active?: boolean;
}

export default function DangerMeter({ t, level, levelText, progress, active = true }: DangerMeterProps) {
  // Idle (no live round): the derived level is "critical" with 0% progress,
  // which renders an alarming red pill echoing the CRITICAL endpoint. Show an
  // explicit, dimmed "Round not started" placeholder instead so the gauge
  // reads as a dormant gauge — not a buggy/disabled red form control.
  const effectiveLevel = active ? level : "idle";
  const effectiveText = active ? levelText : t("roundNotStarted");

  return (
    <div className={`danger-meter${active ? "" : " is-idle"}`}>
      <div className="meter-header">
        <span className="meter-label-left">{t("safe")}</span>
        <div className={`danger-badge ${effectiveLevel}`}><span>{effectiveText}</span></div>
        <span className="meter-label-right">{t("critical")}</span>
      </div>
      <div className="meter-track">
        <div className="meter-gradient-bg" />
        <div className={`meter-fill ${effectiveLevel}`} style={{ width: `${active ? progress : 0}%` }}>
          {active ? <span className="meter-shimmer" aria-hidden="true" /> : null}
        </div>
        <div className="meter-glow-point" style={{ left: `${active ? progress : 0}%` }} />
      </div>
    </div>
  );
}
