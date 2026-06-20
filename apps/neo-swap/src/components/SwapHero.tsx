/**
 * SwapHero.tsx -- market-stage header for Neo Swap.
 */

import { ArrowRight, ArrowRightLeft } from "lucide-react";
import TokenIcon from "./TokenIcon";
import "./SwapHero.scss";

interface SwapHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  fromSymbol: string;
  toSymbol: string;
  rateDisplay: string;
  routeHealth: string;
  rateAsOf: string;
  rateStale: boolean;
}

export default function SwapHero({
  t,
  fromSymbol,
  toSymbol,
  rateDisplay,
  routeHealth,
  rateAsOf,
  rateStale,
}: SwapHeroProps) {
  return (
    <div className="swap-hero-content">
      <img
        className="swap-hero-stage-image"
        src="./swap-liquidity-stage.jpg"
        alt=""
        loading="eager"
        decoding="async"
      />
      <div className="swap-hero-shade" aria-hidden="true" />

      <div className="swap-hero-copy">
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
      </div>

      <div className="swap-hero-trade-strip" aria-label={t("subtitle")}>
        <div className="swap-hero-pair">
          <div className="swap-hero-token">
            <TokenIcon symbol={fromSymbol} />
            <strong>{fromSymbol}</strong>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
          <div className="swap-hero-token">
            <TokenIcon symbol={toSymbol} />
            <strong>{toSymbol}</strong>
          </div>
        </div>
        <div className="swap-hero-metrics">
          <div>
            <span>{t("quoteHealth")}</span>
            <strong>{routeHealth}</strong>
          </div>
          <div>
            <span>{t("exchangeRate")}</span>
            <strong>{rateDisplay}</strong>
          </div>
          {rateAsOf && (
            <div className={rateStale ? "is-stale" : ""}>
              <span>{t("rateAsOf", { time: rateAsOf })}</span>
              <strong>{rateStale ? t("rateStale") : t("swapRouteReady")}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
