import "./CapsuleHero.scss";

interface CapsuleHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalCapsules: number;
  lockedCount: number;
  revealedCount: number;
}

export default function CapsuleHero({ t, totalCapsules, lockedCount, revealedCount }: CapsuleHeroProps) {
  return (
    <div className="hero-container">
      <div className="capsule-scene" aria-hidden="true">
        <div className="capsule-graphic">
          <div className="capsule-top" />
          <div className="capsule-body">
            <div className="capsule-band" />
          </div>
          <div className="capsule-glow" />
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{totalCapsules}</span>
          <span className="hero-stat-label">{t("sidebarTotalCapsules")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{lockedCount}</span>
          <span className="hero-stat-label">{t("sidebarLocked")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{revealedCount}</span>
          <span className="hero-stat-label">{t("sidebarRevealed")}</span>
        </div>
      </div>
    </div>
  );
}
