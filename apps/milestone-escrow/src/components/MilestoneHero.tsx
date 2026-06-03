interface Checkpoint { position: number; done: boolean; label: string; }
interface MilestoneHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPercent: number;
  checkpoints: Checkpoint[];
  /** Whether any escrow exists; when false the progress band + metrics are hidden. */
  hasEscrows: boolean;
  activeCount: number;
  completedCount: number;
  totalEscrows: number;
}

export default function MilestoneHero({ t, progressPercent, checkpoints, hasEscrows, activeCount, completedCount, totalEscrows }: MilestoneHeroProps) {
  return (
    <div className="hero-container">
      <div className="hero-head">
        <div className="hero-badge" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="hero-headings">
          <span className="hero-eyebrow">{t("escrowsTab")}</span>
          <h2 className="hero-title">{t("title")}</h2>
          <p className="hero-subtitle">{t("docSubtitle")}</p>
          {hasEscrows && (
            <p className="hero-summary">
              <span className="hero-summary__num">{totalEscrows}</span> {t("escrowsTab")}
              <span className="hero-summary__sep">·</span>
              <span className="hero-summary__num">{activeCount}</span> {t("statusActive")}
              <span className="hero-summary__sep">·</span>
              <span className="hero-summary__num">{completedCount}</span> {t("statusCompleted")}
            </p>
          )}
        </div>
      </div>

      {/* Progress band is only meaningful once an escrow exists. */}
      {hasEscrows && (
        <div className="hero-progress">
          <div className="hero-progress-meta">
            <span className="hero-progress-label">{t("milestones")}</span>
            <span className="hero-progress-pct">{progressPercent}%</span>
          </div>
          <div className="hero-progress-track">
            <div className="hero-progress-fill" style={{ width: progressPercent + "%" }} />
            {checkpoints.map((cp) => (
              <div key={cp.label} className={`hero-checkpoint${cp.done ? " hero-checkpoint--done" : ""}`} style={{ left: cp.position + "%" }}>
                <div className="checkpoint-dot" />
                <span className="checkpoint-label">{cp.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
