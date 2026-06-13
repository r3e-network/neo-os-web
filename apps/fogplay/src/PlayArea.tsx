import { useMemo } from "react";
import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ArenaHero from "./components/ArenaHero";
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

  // Bet state — read the choice LIVE via str() so the highlighted side tracks
  // the observable on every render. A useMemo([state]) here froze on the
  // first-render value (state identity never changes), so the card stayed on
  // "heads" while the bet used the real (possibly "tails") selection.
  const betAmount = str("betAmount", "1");
  const choice = str("choice", "heads") as "heads" | "tails";
  const canBet = bool("canBet");
  const validationError = val<string>("validationError");

  // House cap + recoverable prepaid credit
  const maxPayableBet = num("maxPayableBet", 0);
  const formattedMaxPayable = str("formattedMaxPayable", "");
  const formattedCredit = str("formattedCredit", "");
  const hasCredit = bool("hasCredit");

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
            <span className="play-hero__eyebrow">{t("eyebrow")}</span>
            <h2 className="play-hero__title">{t("title")}</h2>
            <p className="play-hero__subtitle">{t("docSubtitle")}</p>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-cell win">
            <span className="stat-count">{wins}</span>
            <span className="stat-label">{t("wins")}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell loss">
            <span className="stat-count">{losses}</span>
            <span className="stat-label">{t("losses")}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell total">
            <span className="stat-count">{totalGames}</span>
            <span className="stat-label">{t("totalGames")}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell won">
            <span className="stat-count won-amount">{formattedTotalWon}</span>
            <span className="stat-label">{t("totalWon")}</span>
          </div>
        </div>
      </header>

      <ArenaHero
        t={t}
        isFlipping={isFlipping}
        displayOutcome={displayOutcome}
        result={result}
      />

      <WagerControls
        t={t}
        choice={choice}
        betAmount={betAmount}
        canBet={canBet}
        isFlipping={isFlipping}
        validationError={validationError ?? undefined}
        maxPayable={formattedMaxPayable}
        maxPayableBet={maxPayableBet}
        credit={formattedCredit}
        hasCredit={hasCredit}
        dispatch={dispatch}
      />

      <div className="history-section">
        <div className="history-header">
          <span className="history-title">{t("gameHistory")}</span>
        </div>
        {recentHistory.length === 0 ? (
          <NeoCard variant="erobo">
            <div className="history-empty">
              <span className="history-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span className="history-empty__text">{t("noHistory")}</span>
            </div>
          </NeoCard>
        ) : (
          <NeoCard variant="erobo">
            <div className="history-table-wrap">
              <table className="history-table" aria-label={t("gameHistory")}>
                <thead>
                  <tr>
                    <th>{t("choiceHeader")}</th>
                    <th>{t("outcomeHeader")}</th>
                    <th>{t("betHeader")}</th>
                    <th>{t("payoutHeader")}</th>
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
