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
        <div className="zone-markers">
          <div className="zone-mark" style={{ left: "25%" }}><span className="zone-tick" /></div>
          <div className="zone-mark" style={{ left: "50%" }}><span className="zone-tick" /></div>
          <div className="zone-mark" style={{ left: "75%" }}><span className="zone-tick" /></div>
        </div>
      </div>
      <div className="meter-zone-labels">
        <span className="zone-label safe-label">SAFE</span>
        <span className="zone-label warn-label">WARN</span>
        <span className="zone-label high-label">HIGH</span>
        <span className="zone-label crit-label">CRIT</span>
      </div>
    </div>
  );
}
