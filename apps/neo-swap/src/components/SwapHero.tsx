/**
 * SwapHero.tsx -- Hero display for Neo Swap.
 */

import "./SwapHero.scss";

interface SwapHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  currentRate: string;
}

export default function SwapHero({ t, currentRate }: SwapHeroProps) {
  return (
    <div className="hero-container">
      <div className="hero-swap-display">
        <div className="hero-token">
          <div className="token-icon token-icon--from">N</div>
          <span className="token-name">NEO</span>
        </div>
        <div className="hero-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <path d="M5 12h14m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="hero-token">
          <div className="token-icon token-icon--to">G</div>
          <span className="token-name">GAS</span>
        </div>
      </div>
      <div className="hero-price-quote">
        <span className="price-label">{t("sidebarRate")}</span>
        <span className="price-value">{currentRate}</span>
      </div>
    </div>
  );
}
