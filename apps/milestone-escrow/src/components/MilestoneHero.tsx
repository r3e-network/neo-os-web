import { type CSSProperties } from "react";

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
        </div>
      </div>

      {/* Boxed stat tiles — always present so the hero carries weight even
          before any escrow exists ("—" placeholders avoid an error-like 0).
          Each tile carries a sublabel that says exactly what it counts. */}
      <div className="hero-stats" role="group" aria-label={t("escrowsTab")}>
        <div className="hero-stat" style={{ "--i": "0" } as CSSProperties}>
          <span className={`hero-stat-value${hasEscrows ? "" : " hero-stat-value--empty"}`}>{hasEscrows ? totalEscrows : "—"}</span>
          <span className="hero-stat-label">{t("escrowsTab")}</span>
          <span className="hero-stat-hint">{t("statHintEscrows")}</span>
        </div>
        <span className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat" style={{ "--i": "1" } as CSSProperties}>
          <span className={`hero-stat-value${hasEscrows ? "" : " hero-stat-value--empty"}`}>{hasEscrows ? activeCount : "—"}</span>
          <span className="hero-stat-label">{t("statusActive")}</span>
          <span className="hero-stat-hint">{t("statHintActive")}</span>
        </div>
        <span className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat" style={{ "--i": "2" } as CSSProperties}>
          <span className={`hero-stat-value${hasEscrows ? "" : " hero-stat-value--empty"}`}>{hasEscrows ? completedCount : "—"}</span>
          <span className="hero-stat-label">{t("statusCompleted")}</span>
          <span className="hero-stat-hint">{t("statHintCompleted")}</span>
        </div>
      </div>

      {/* Progress band is only meaningful once an escrow exists. */}
      {hasEscrows && (
        <div className="hero-progress">
          <div className="hero-progress-meta">
            {/* The band plots completed escrows, not milestones — label it so. */}
            <span className="hero-progress-label">{t("escrowsCompleted")}</span>
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
