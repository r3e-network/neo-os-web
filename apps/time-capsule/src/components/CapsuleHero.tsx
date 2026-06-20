import "./CapsuleHero.scss";
import { Archive, LockKeyhole, TimerReset, UnlockKeyhole } from "lucide-react";

interface CapsuleHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalCapsules: number;
  lockedCount: number;
  revealedCount: number;
}

export default function CapsuleHero({
  t,
  totalCapsules,
  lockedCount,
  revealedCount,
}: CapsuleHeroProps) {
  return (
    <div className="hero-container">
      <img
        className="hero-stage-media"
        src="./time-capsule-stage.jpg"
        alt={t("heroStageAlt")}
        loading="eager"
        decoding="async"
      />
      <div className="hero-stage-shade" aria-hidden="true" />
      <div className="hero-head">
        <div className="hero-identity">
          <span className="hero-badge" aria-hidden="true">
            <Archive size={25} />
          </span>
          <div className="hero-copy">
            <span className="hero-eyebrow">{t("vaultEyebrow")}</span>
            <h2 className="hero-title">{t("title")}</h2>
            <p className="hero-subtitle">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="hero-stats">
        <div className="hero-stat">
          <TimerReset size={17} aria-hidden="true" />
          <span className="hero-stat-value">{totalCapsules}</span>
          <span className="hero-stat-label">{t("sidebarTotalCapsules")}</span>
        </div>
        <div className="hero-stat">
          <LockKeyhole size={17} aria-hidden="true" />
          <span className="hero-stat-value">{lockedCount}</span>
          <span className="hero-stat-label">{t("sidebarLocked")}</span>
        </div>
        <div className="hero-stat">
          <UnlockKeyhole size={17} aria-hidden="true" />
          <span className="hero-stat-value">{revealedCount}</span>
          <span className="hero-stat-label">{t("sidebarRevealed")}</span>
        </div>
      </div>
    </div>
  );
}
