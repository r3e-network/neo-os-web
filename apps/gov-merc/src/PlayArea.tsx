/**
 * PlayArea.tsx -- Gov Merc
 *
 * React version of the governance mercenary pool play area.
 */

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
  const { val, bool } = useStateBindings(state);

  const totalPool = val<number>("totalPool", 0);
  const currentEpoch = val<number>("currentEpoch", 0);
  const bids = val<Array<{ address: string; amount: number }>>("bids", []);
  const isBusy = bool("isBusy");

  return (
    <div className="gov-merc-play-area">
      <MercHeroStats
        t={t}
        totalPool={totalPool}
        bidCount={bids.length}
        currentEpoch={currentEpoch}
      />

      <MercActionCards
        t={t}
        isBusy={isBusy}
        dispatch={dispatch}
      />

      <MercBidsList t={t} bids={bids} />
    </div>
  );
}
