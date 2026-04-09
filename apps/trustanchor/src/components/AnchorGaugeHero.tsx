/**
 * AnchorGaugeHero.tsx -- Hero gauge display for TrustAnchor.
 */

import { formatNumber } from "@shared/utils/format";
import "./AnchorGaugeHero.scss";

interface AnchorGaugeHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalStaked: number;
  agentCount: number;
}

const GAUGE_ARC = Math.PI * 80;
const MAX_STAKED = 10_000_000;

export default function AnchorGaugeHero({ t, totalStaked, agentCount }: AnchorGaugeHeroProps) {
  const formatNum = (n: number | string) => formatNumber(n, 2);
  const gaugePercent = Math.min(totalStaked / MAX_STAKED, 1);
  const gaugeOffset = GAUGE_ARC - gaugePercent * GAUGE_ARC;

  return (
    <div className="hero-container">
      <span className="hero-label">{t("appName")}</span>
      <span className="hero-description">{t("heroDescription")}</span>

      <div className="hero-gauge" aria-hidden="true">
        <svg viewBox="0 0 200 120" className="gauge-svg">
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={GAUGE_ARC} strokeDashoffset={gaugeOffset} className="gauge-fill" />
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--trustanchor-emerald-light, #34d399)" />
              <stop offset="100%" stopColor="var(--trustanchor-emerald, #10b981)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">{formatNum(totalStaked)}</span>
          <span className="gauge-unit">{t("tokenNeo")}</span>
        </div>
      </div>
    </div>
  );
}
