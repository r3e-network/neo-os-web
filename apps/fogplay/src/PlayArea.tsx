import { useMemo } from "react";
import { NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ArenaHero from "./components/ArenaHero";
import RecordStatsBar from "./components/RecordStatsBar";
import WagerControls from "./components/WagerControls";
import ResultOverlay from "./pages/index/components/ResultOverlay";
import type { GameResult, GameHistoryItem } from "./composables/useCoinFlip";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // Game stats
  const wins = num("wins");
  const losses = num("losses");
  const totalGames = num("totalGames");
  const totalWon = num("totalWon");
  const formattedTotalWon = str("formattedTotalWon", "0 GAS");

  // Bet state
  const betAmount = str("betAmount", "1");
  const choice = useMemo(
    () => (state.choice?.get() ?? "heads") as "heads" | "tails",
    [state],
  );
  const canBet = bool("canBet");
  const validationError = val<string>("validationError");

  // Flip state
  const isFlipping = bool("isFlipping");
  const result = val<GameResult>("result");
  const displayOutcome = val<"heads" | "tails">("displayOutcome");

  // Win overlay
  const showWinOverlay = bool("showWinOverlay");
  const winAmount = str("winAmount", "0");

  // Game history
  const gameHistory = val<GameHistoryItem[]>("gameHistory") ?? [];
  const recentHistory = useMemo(() => gameHistory.slice(0, 10), [gameHistory]);

  const handleDismiss = async () => {
    await dispatch("dismissOverlay");
  };

  const handleBetAmountChange = (amount: string) => {
    dispatch("setBetAmount", amount);
  };

  return (
    <div className="coinflip-play-area">
      <header className="play-hero">
        <div className="play-hero__head">
          <span className="play-hero__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M8.5 7.5h5a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h5" />
            </svg>
          </span>
          <div className="play-hero__text">
            <h2 className="play-hero__title">{t("title") || "FogPlay"}</h2>
            <p className="play-hero__subtitle">
              {t("docSubtitle") || "Oracle-backed coin toss with on-chain escrow"}
            </p>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-cell win">
            <span className="stat-count">{wins}</span>
            <span className="stat-label">{t("wins") || "Wins"}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell loss">
            <span className="stat-count">{losses}</span>
            <span className="stat-label">{t("losses") || "Losses"}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell total">
            <span className="stat-count">{totalGames}</span>
            <span className="stat-label">{t("totalGames") || "Games"}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell won">
            <span className="stat-count won-amount">{formattedTotalWon}</span>
            <span className="stat-label">{t("totalWon") || "Won"}</span>
          </div>
        </div>
      </header>

      <ArenaHero
        t={t}
        isFlipping={isFlipping}
        displayOutcome={displayOutcome}
        result={result}
      />

      <RecordStatsBar t={t} wins={wins} losses={losses} totalGames={totalGames} />

      <div className="custom-bet-section">
        <NeoInput
          type="number"
          label={t("customBet") || "Custom Bet Amount"}
          value={betAmount}
          placeholder="1"
          suffix={t("tokenGas") || "GAS"}
          min={0.05}
          max={100}
          error={validationError ?? undefined}
          hint={t("wagerRange") || "Min 0.05 - Max 100 GAS"}
          onChange={handleBetAmountChange}
          aria-label={t("betAmount") || "Bet amount"}
        />
      </div>

      <WagerControls
        t={t}
        choice={choice}
        betAmount={betAmount}
        canBet={canBet}
        isFlipping={isFlipping}
        dispatch={dispatch}
      />

      <div className="history-section">
        <div className="history-header">
          <span className="history-title">{t("gameHistory") || "Recent Games"}</span>
        </div>
        {recentHistory.length === 0 ? (
          <NeoCard variant="erobo">
            <div className="history-empty">
              {t("noHistory") || "No games played yet. Place your first bet!"}
            </div>
          </NeoCard>
        ) : (
          <NeoCard variant="erobo">
            <div className="history-table-wrap">
              <table className="history-table" aria-label={t("gameHistory") || "Game History"}>
                <thead>
                  <tr>
                    <th>{t("choiceHeader") || "Pick"}</th>
                    <th>{t("outcomeHeader") || "Result"}</th>
                    <th>{t("betHeader") || "Bet"}</th>
                    <th>{t("payoutHeader") || "Payout"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map((game) => (
                    <tr key={game.betId} className={game.won ? "row-win" : "row-loss"}>
                      <td>
                        <span className="choice-badge">{t(game.choice) || game.choice}</span>
                      </td>
                      <td>
                        <span className={`outcome-badge ${game.won ? "won" : "lost"}`}>
                          {t(game.outcome) || game.outcome}
                        </span>
                      </td>
                      <td className="amount-cell">{game.amount.toFixed(2)}</td>
                      <td className={`amount-cell ${game.won ? "payout-win" : "payout-loss"}`}>
                        {game.won ? `+${game.payout.toFixed(2)}` : "0.00"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NeoCard>
        )}
      </div>

      {/* Win celebration overlay */}
      <ResultOverlay
        visible={showWinOverlay}
        winAmount={winAmount}
        t={t}
        onClose={handleDismiss}
      />
    </div>
  );
}
