/**
 * MercBidsList.tsx -- Bid leaderboard for Gov Merc.
 */

import { NeoCard } from "@shared/components-react";
import { formatNum } from "@shared/utils/format";
import "./MercBidsList.scss";

interface MercBidsListProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  bids: Array<{ address: string; amount: number }>;
}

export default function MercBidsList({ t, bids }: MercBidsListProps) {
  return (
    <NeoCard variant="erobo">
      {bids.length === 0 ? (
        <div className="empty-neo">{t("noBids")}</div>
      ) : (
        bids.map((bid) => (
          <div key={bid.address} className="bid-row">
            <div className="bid-address">{bid.address}</div>
            <div className="bid-amount">{formatNum(bid.amount, 2)} GAS</div>
          </div>
        ))
      )}
    </NeoCard>
  );
}
