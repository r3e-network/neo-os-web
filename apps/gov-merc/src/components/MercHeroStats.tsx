/**
 * MercHeroStats.tsx -- Hero stats display for Gov Merc.
 */

import { formatNum } from "@shared/utils/format";
import "./MercHeroStats.scss";

interface MercHeroStatsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalPool: number;
  bidCount: number;
  currentEpoch: number;
}

export default function MercHeroStats({ t, totalPool, bidCount, currentEpoch }: MercHeroStatsProps) {
  return (
    <div className="hero-container">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{formatNum(totalPool, 0)}</span>
          <span className="hero-stat-label">{t("totalPool")} {t("tokenNeo")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{bidCount}</span>
          <span className="hero-stat-label">{t("activeBids")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{currentEpoch}</span>
          <span className="hero-stat-label">{t("currentEpoch")}</span>
        </div>
      </div>
    </div>
  );
}
