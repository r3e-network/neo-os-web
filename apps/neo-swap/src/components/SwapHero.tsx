/**
 * SwapHero.tsx -- Pair and quote header for Neo Swap.
 */

import { ArrowRight, ArrowRightLeft } from "lucide-react";
import "./SwapHero.scss";

interface SwapHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  fromSymbol: string;
  toSymbol: string;
}

export default function SwapHero({
  t,
  fromSymbol,
  toSymbol,
}: SwapHeroProps) {
  return (
    <div className="swap-hero-content">
      <div className="swap-hero-head">
        <span className="swap-hero-badge" aria-hidden="true">
          <ArrowRightLeft size={22} />
        </span>
        <div className="swap-hero-intro">
          <p className="swap-hero-eyebrow">{t("tabSwap")}</p>
          <h2 className="swap-hero-title">{t("title")}</h2>
          <p className="swap-hero-subtitle">{t("subtitle")}</p>
        </div>
      </div>

      <div className="swap-hero-pair" aria-label={t("subtitle")}>
        <div className="swap-hero-token">
          <span>{fromSymbol.slice(0, 1)}</span>
          <strong>{fromSymbol}</strong>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div className="swap-hero-token">
          <span>{toSymbol.slice(0, 1)}</span>
          <strong>{toSymbol}</strong>
        </div>
      </div>
    </div>
  );
}
