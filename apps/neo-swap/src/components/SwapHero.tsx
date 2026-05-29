/**
 * SwapHero.tsx -- Pair and quote header for Neo Swap.
 */

import { ArrowRight } from "lucide-react";
import "./SwapHero.scss";

interface SwapHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  currentRate: string;
  fromSymbol: string;
  toSymbol: string;
}

export default function SwapHero({
  t,
  currentRate,
  fromSymbol,
  toSymbol,
}: SwapHeroProps) {
  return (
    <div className="swap-hero-content">
      <div className="swap-hero-pair" aria-label={t("subtitle")}>
        <div className="swap-hero-token">
          <span>{fromSymbol.slice(0, 1)}</span>
          <strong>{fromSymbol}</strong>
        </div>
        <ArrowRight size={20} aria-hidden="true" />
        <div className="swap-hero-token">
          <span>{toSymbol.slice(0, 1)}</span>
          <strong>{toSymbol}</strong>
        </div>
      </div>
      <div className="swap-hero-quote">
        <span>{t("sidebarRate")}</span>
        <strong>{currentRate}</strong>
      </div>
    </div>
  );
}
