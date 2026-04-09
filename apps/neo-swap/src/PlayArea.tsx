/**
 * PlayArea.tsx -- Neo Swap
 *
 * The custom component for the neo-swap miniapp. Contains the token swap
 * hero visualization, swap form, and popular pairs list.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SwapHero from "./components/SwapHero";
import PopularPairs from "./components/PopularPairs";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const popularPairs = [
  { id: "neo-gas", name: "NEO/GAS", rate: "1:45.2" },
  { id: "gas-bneo", name: "GAS/bNEO", rate: "1:0.95" },
  { id: "neo-flm", name: "NEO/FLM", rate: "1:125.8" },
];

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str } = useStateBindings(state);

  const selectedPair = str("selectedPair", "neo-gas");
  const currentRate = str("currentRate", "--");

  return (
    <div className="neo-swap-play-area">
      <SwapHero t={t} currentRate={currentRate} />
      <div className="swap-tab-placeholder">
        {/* SwapTab UI will be rendered by the platform's operation panel */}
      </div>
      <PopularPairs t={t} selectedPair={selectedPair} popularPairs={popularPairs} dispatch={dispatch} />
    </div>
  );
}
