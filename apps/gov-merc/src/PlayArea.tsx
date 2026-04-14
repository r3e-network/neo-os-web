/**
 * PlayArea.tsx -- Gov Merc
 *
 * React version of the governance mercenary pool play area.
 * Uses all state: totalPool, currentEpoch, userDeposits, bids, depositAmount,
 * withdrawAmount, bidAmount, isBusy, dataLoading, address,
 * totalPoolDisplay, userDepositsDisplay, bidCount.
 * Actions: depositNeo, withdrawNeo, placeBid.
 */

import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import MercHeroStats from "./components/MercHeroStats";
import MercActionCards from "./components/MercActionCards";
import MercBidsList from "./components/MercBidsList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str, bool, num } = useStateBindings(state);

  const totalPool = val<number>("totalPool", 0);
  const currentEpoch = val<number>("currentEpoch", 0);
  const userDeposits = val<number>("userDeposits", 0);
  const bids = val<Array<{ address: string; amount: number }>>("bids", []);
  const isBusy = bool("isBusy");
  const dataLoading = bool("dataLoading");
  const address = str("address", "");
  const totalPoolDisplay = str("totalPoolDisplay", "0 NEO");
  const userDepositsDisplay = str("userDepositsDisplay", "0 NEO");
  const bidCount = num("bidCount");

  return (
    <div className="gov-merc-play-area">
      {/* Hero stats */}
      <MercHeroStats
        t={t}
        totalPool={totalPool}
        bidCount={bidCount}
        currentEpoch={currentEpoch}
      />

      {/* Pool overview card */}
      <NeoCard title={t("poolStats") || "Pool Stats"} variant="erobo">
        <div className="pool-overview">
          <div className="pool-row">
            <span className="pool-label">{t("totalPool") || "Total Pool"}</span>
            <span className="pool-value">{totalPoolDisplay}</span>
          </div>
          <div className="pool-row">
            <span className="pool-label">{t("yourDeposits") || "Your Deposits"}</span>
            <span className="pool-value">{userDepositsDisplay}</span>
          </div>
          <div className="pool-row">
            <span className="pool-label">{t("currentEpoch") || "Current Epoch"}</span>
            <span className="pool-value">{currentEpoch}</span>
          </div>
          {address && (
            <div className="pool-row">
              <span className="pool-label address-label">{address.slice(0, 8)}...{address.slice(-6)}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Loading state */}
      {dataLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner" />
          <span>{t("loading") || "Loading..."}</span>
        </div>
      )}

      {/* Action cards: deposit, withdraw, bid */}
      <MercActionCards
        t={t}
        isBusy={isBusy}
        dispatch={dispatch}
      />

      {/* Bid leaderboard */}
      <NeoCard title={t("bidLeaderboard") || "Bid Leaderboard"} variant="erobo">
        <MercBidsList t={t} bids={bids} />
      </NeoCard>
    </div>
  );
}
