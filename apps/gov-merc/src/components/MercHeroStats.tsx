import { formatNum } from "@shared/utils/format";
import "./MercHeroStats.scss";

interface MercHeroStatsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalPool: number;
  bidCount: number;
  currentEpoch: number;
}

export default function MercHeroStats({
  t,
  totalPool,
  bidCount,
  currentEpoch,
}: MercHeroStatsProps) {
  return (
    <>
      <div className="gov-merc-stat">
        <span>{t("totalPool")}</span>
        <strong>{formatNum(totalPool, 0)} NEO</strong>
      </div>
      <div className="gov-merc-stat">
        <span>{t("activeBids")}</span>
        <strong>{bidCount}</strong>
      </div>
      <div className="gov-merc-stat">
        <span>{t("currentEpoch")}</span>
        <strong>{currentEpoch}</strong>
      </div>
    </>
  );
}
