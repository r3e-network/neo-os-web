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
      <div className="hero-head">
        <div className="hero-identity">
          <div className="hero-badge" aria-hidden="true">
            <picture>
              <source srcSet="./logo.avif" type="image/avif" />
              <source srcSet="./logo.webp" type="image/webp" />
              <img src="./logo.jpg" alt="" />
            </picture>
          </div>
          <div className="hero-copy">
            <span className="hero-eyebrow">{t("vaultEyebrow")}</span>
            <h2 className="hero-title">{t("title")}</h2>
            <p className="hero-subtitle">{t("subtitle")}</p>
          </div>
        </div>
        <picture className="hero-media" aria-hidden="true">
          <source srcSet="./banner.avif" type="image/avif" />
          <source srcSet="./banner.webp" type="image/webp" />
          <img src="./banner.jpg" alt="" />
        </picture>
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
