import { formatNum } from "@shared/utils/format";
import "./MercHeroStats.scss";

interface MercHeroStatsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalPool: number;
  bidCount: number;
  currentEpoch: number;
  /** Live epoch's highest bid in whole GAS — the prize to beat / incoming yield. */
  highestBid: number;
  /** GAS paid to stakers in the most recently settled epoch (whole GAS). */
  lastDistributed: number;
}

export default function MercHeroStats({
  t,
  totalPool,
  bidCount,
  currentEpoch,
  highestBid,
  lastDistributed,
}: MercHeroStatsProps) {
  const tokenGas = t("tokenGas");
  return (
    <>
      <div className="gov-merc-stat">
        <span>{t("totalPool")}</span>
        <strong>{formatNum(totalPool, 0)} {t("tokenNeo")}</strong>
      </div>
      <div className="gov-merc-stat">
        <span>{t("currentTopBid")}</span>
        <strong>{formatNum(highestBid, 2)} {tokenGas}</strong>
      </div>
      <div className="gov-merc-stat">
        <span>{t("lastDistributed")}</span>
        <strong>{formatNum(lastDistributed, 2)} {tokenGas}</strong>
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
