import { useMemo } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ArenaHero from "./components/ArenaHero";
import RecordStatsBar from "./components/RecordStatsBar";
import WagerControls from "./components/WagerControls";
import ResultOverlay from "./pages/index/components/ResultOverlay";
import type { GameResult } from "./composables/useCoinFlip";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const betAmount = str("betAmount", "1");
  const choice = useMemo(() => (state.choice?.get() ?? "heads") as "heads" | "tails", [state]);
  const isFlipping = bool("isFlipping");
  const result = val<GameResult>("result");
  const displayOutcome = val<"heads" | "tails">("displayOutcome");
  const showWinOverlay = bool("showWinOverlay");
  const winAmount = str("winAmount", "0");
  const canBet = bool("canBet");
  const wins = num("wins");
  const losses = num("losses");
  const totalGames = num("totalGames");

  const handleDismiss = async () => { await dispatch("dismissOverlay"); };

  return (
    <div className="coinflip-play-area">
      <ArenaHero t={t} isFlipping={isFlipping} displayOutcome={displayOutcome} result={result} />
      <RecordStatsBar t={t} wins={wins} losses={losses} totalGames={totalGames} />
      <WagerControls t={t} choice={choice} betAmount={betAmount} canBet={canBet} isFlipping={isFlipping} dispatch={dispatch} />
      <ResultOverlay visible={showWinOverlay} winAmount={winAmount} t={t} onClose={handleDismiss} />
    </div>
  );
}
