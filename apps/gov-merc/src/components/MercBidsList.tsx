import { formatNum } from "@shared/utils/format";
import "./MercBidsList.scss";

interface MercBidsListProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  bids: Array<{ address: string; amount: number }>;
}

function shortAddress(address: string) {
  if (!address || address.length < 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export default function MercBidsList({ t, bids }: MercBidsListProps) {
  if (bids.length === 0) {
    return (
      <div className="gov-merc-empty-bids">
        <strong>{t("emptyBidTitle")}</strong>
        <p>{t("emptyBidCopy")}</p>
      </div>
    );
  }

  return (
    <div className="gov-merc-bid-list">
      {bids.map((bid, index) => {
        const rank = index + 1;
        return (
          <div key={bid.address} className="gov-merc-bid-row">
            <span>{rank}</span>
            <strong>{shortAddress(bid.address)}</strong>
            <em>{formatNum(bid.amount, 2)} GAS</em>
          </div>
        );
      })}
    </div>
  );
}
