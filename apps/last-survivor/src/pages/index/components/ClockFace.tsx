import { NeoCard } from "@shared/components-react";
import "./ClockFace.scss";

interface ClockFaceProps {
  dangerLevel: string;
  dangerLevelText: string;
  shouldPulse: boolean;
  countdown: string;
  dangerProgress: number;
  currentEventDescription: string;
  t: (key: string, ...args: unknown[]) => string;
}

export default function ClockFace({ dangerLevel, dangerLevelText, shouldPulse, countdown, dangerProgress, currentEventDescription, t }: ClockFaceProps) {
  return (
    <NeoCard variant="erobo-bitcoin" className={`last-survivor-card ${dangerLevel}`}>
      <div className="clock-header">
        <span className="clock-label text-glass-glow">{t("timeUntilEvent")}</span>
        <div className={`danger-badge-glass ${dangerLevel}`}><span className="danger-text">{dangerLevelText}</span></div>
      </div>
      <div className="clock-display-glass" aria-live="polite" role="timer" aria-label={t("timeUntilEvent")}>
        <span className={`clock-time-glass ${dangerLevel}${shouldPulse ? " pulse" : ""}`}>{countdown}</span>
      </div>
      <div className="danger-meter-glass">
        <div className="meter-labels">
          <span className="meter-label text-glass">{t("safe")}</span>
          <span className="meter-label text-glass">{t("critical")}</span>
        </div>
        <div className="meter-bar-glass">
          <div className={`meter-fill-glass ${dangerLevel}`} style={{ width: `${dangerProgress}%` }} />
          <div className="meter-indicator-glass" style={{ left: `${dangerProgress}%` }} />
        </div>
      </div>
      <div className="event-description-glass">
        <span className="event-title-glass">{t("nextEvent")}</span>
        <span className="event-text-glass">{currentEventDescription}</span>
      </div>
    </NeoCard>
  );
}
