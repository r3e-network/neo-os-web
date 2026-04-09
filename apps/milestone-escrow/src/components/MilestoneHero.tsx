interface Checkpoint { position: number; done: boolean; label: string; }
interface MilestoneHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPercent: number;
  checkpoints: Checkpoint[];
  activeCount: number;
  completedCount: number;
}

export default function MilestoneHero({ t, progressPercent, checkpoints, activeCount, completedCount }: MilestoneHeroProps) {
  return (
    <div className="hero-container">
      <span className="hero-label">{t("appName")}</span>
      <div className="hero-progress-track">
        <div className="hero-progress-fill" style={{ width: progressPercent + "%" }} />
        {checkpoints.map((cp) => (
          <div key={cp.label} className={`hero-checkpoint${cp.done ? " hero-checkpoint--done" : ""}`} style={{ left: cp.position + "%" }}>
            <div className="checkpoint-dot" />
            <span className="checkpoint-label">{cp.label}</span>
          </div>
        ))}
      </div>
      <div className="hero-stats-row">
        <div className="hero-stat"><span className="hero-stat-label">{t("statusActive")}</span><span className="hero-stat-value">{activeCount}</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-label">{t("statusCompleted")}</span><span className="hero-stat-value">{completedCount}</span></div>
      </div>
    </div>
  );
}
