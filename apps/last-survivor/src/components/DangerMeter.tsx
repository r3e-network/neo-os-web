import "./DangerMeter.scss";

interface DangerMeterProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  level: string;
  levelText: string;
  progress: number;
}

export default function DangerMeter({ t, level, levelText, progress }: DangerMeterProps) {
  return (
    <div className="danger-meter">
      <div className="meter-header">
        <span className="meter-label-left">{t("safe")}</span>
        <div className={`danger-badge ${level}`}><span>{levelText}</span></div>
        <span className="meter-label-right">{t("critical")}</span>
      </div>
      <div className="meter-track">
        <div className="meter-gradient-bg" />
        <div className={`meter-fill ${level}`} style={{ width: `${progress}%` }} />
        <div className="meter-glow-point" style={{ left: `${progress}%` }} />
      </div>
    </div>
  );
}
