import { useEffect, useMemo, useRef, useState } from "react";
import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ArenaHero from "./components/ArenaHero";
import WagerControls from "./components/WagerControls";
import ResultOverlay from "./pages/index/components/ResultOverlay";
import type { GameResult, GameHistoryItem } from "./composables/useCoinFlip";
import coinHeadsUrl from "./static/coin_heads.png";
import coinTailsUrl from "./static/coin_tails.png";
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

  // Flip + commit/reveal state
  const isFlipping = bool("isFlipping");
  const revealing = bool("revealing");
  const hasPendingBet = bool("hasPendingBet");
  const revealFailed = bool("revealFailed");
  const result = val<GameResult>("result");
  const displayOutcome = val<"heads" | "tails">("displayOutcome");

  // Win overlay
  const showWinOverlay = bool("showWinOverlay");
  const winAmount = str("winAmount", "0");

  // Game history
  const gameHistory = val<GameHistoryItem[]>("gameHistory");
  const [flipActionPreview, setFlipActionPreview] = useState(false);
  const [revealActionPreview, setRevealActionPreview] = useState(false);
  const flipActionPreviewTimeout = useRef<number | null>(null);
  const revealActionPreviewTimeout = useRef<number | null>(null);
  const flipIsAnimating = isFlipping || flipActionPreview;
  const revealIsAnimating = revealing || revealActionPreview;

  useEffect(() => {
    return () => {
      if (flipActionPreviewTimeout.current !== null) {
        window.clearTimeout(flipActionPreviewTimeout.current);
      }
      if (revealActionPreviewTimeout.current !== null) {
        window.clearTimeout(revealActionPreviewTimeout.current);
      }
    };
  }, []);

  const startFlipActionPreview = () => {
    if (flipActionPreviewTimeout.current !== null) {
      window.clearTimeout(flipActionPreviewTimeout.current);
    }
    setFlipActionPreview(true);
    flipActionPreviewTimeout.current = window.setTimeout(() => {
      setFlipActionPreview(false);
      flipActionPreviewTimeout.current = null;
    }, 1300);
  };
  const startRevealActionPreview = () => {
    if (revealActionPreviewTimeout.current !== null) {
      window.clearTimeout(revealActionPreviewTimeout.current);
    }
    setRevealActionPreview(true);
    revealActionPreviewTimeout.current = window.setTimeout(() => {
      setRevealActionPreview(false);
      revealActionPreviewTimeout.current = null;
    }, 1300);
  };

  const recentHistory = useMemo(
    () => (gameHistory ?? []).slice(0, 10),
    [gameHistory],
  );
  const historyCoinArt: Record<"heads" | "tails", string> = {
    heads: coinHeadsUrl,
    tails: coinTailsUrl,
  };
  const playAreaClassName = [
    "coinflip-play-area",
    flipIsAnimating || revealIsAnimating ? "coinflip-play-area--tossing" : "",
    revealIsAnimating ? "coinflip-play-area--revealing" : "",
    hasPendingBet ? "coinflip-play-area--pending" : "",
    result ? `coinflip-play-area--${result.won ? "won" : "lost"}` : "",
    canBet ? "coinflip-play-area--ready" : "",
    `coinflip-play-area--choice-${choice}`,
  ]
    .filter(Boolean)
    .join(" ");

  const handleDismiss = async () => {
    await dispatch("dismissOverlay");
  };

  const handleReveal = async () => {
    startRevealActionPreview();
    await dispatch("revealResult");
  };

  return (
    <div
      className={playAreaClassName}
      aria-busy={flipIsAnimating || revealIsAnimating || undefined}
    >
      <header className="play-hero">
        <div className="play-hero__head">
          <span className="play-hero__badge" aria-hidden="true">
            <img src={coinHeadsUrl} alt="" loading="eager" decoding="async" />
          </span>
          <div className="play-hero__text">
            <span className="play-hero__eyebrow">{t("eyebrow")}</span>
            <h2 className="play-hero__title">{t("title")}</h2>
            <p className="play-hero__subtitle">{t("docSubtitle")}</p>
          </div>
        </div>
        {totalGames > 0 ? (
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
        ) : (
          <div className="first-round-prompt">
            <span className="first-round-prompt__icon" aria-hidden="true">
              <img src={coinTailsUrl} alt="" loading="lazy" decoding="async" />
            </span>
            <div className="first-round-prompt__text">
              <span className="first-round-prompt__title">
                {t("firstRoundPrompt")}
              </span>
              <span className="first-round-prompt__hint">
                {t("firstRoundHint")}
              </span>
            </div>
          </div>
        )}
      </header>

      <main
        className="coinflip-game-table"
        aria-label={t("title")}
        aria-busy={flipIsAnimating || revealIsAnimating || undefined}
      >
        <div className="coinflip-game-table__arena">
          <ArenaHero
            t={t}
            isFlipping={flipIsAnimating}
            revealing={revealIsAnimating}
            hasPendingBet={hasPendingBet}
            revealFailed={revealFailed}
            displayOutcome={displayOutcome}
            result={result}
            choice={choice}
            betAmount={betAmount}
            onReveal={handleReveal}
          />
        </div>

        <div className="coinflip-game-table__wager">
          <WagerControls
            t={t}
            choice={choice}
            betAmount={betAmount}
            canBet={canBet}
            isFlipping={flipIsAnimating}
            validationError={validationError ?? undefined}
            maxPayable={formattedMaxPayable}
            maxPayableBet={maxPayableBet}
            credit={formattedCredit}
            hasCredit={hasCredit}
            dispatch={dispatch}
            onFlipStart={startFlipActionPreview}
          />
        </div>
      </main>

      <div className="history-section">
        <div className="history-header">
          <span className="history-title">{t("gameHistory")}</span>
        </div>
        {recentHistory.length === 0 ? (
          <NeoCard variant="erobo">
            <div className="history-empty">
              <span className="history-empty__icon" aria-hidden="true">
                <img
                  src={coinHeadsUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="history-empty__text">{t("noHistory")}</span>
            </div>
          </NeoCard>
        ) : (
          <NeoCard variant="erobo">
            <div
              className="history-token-board"
              role="list"
              aria-label={t("gameHistory")}
            >
              {recentHistory.map((game) => (
                <article
                  key={game.betId}
                  className={[
                    "history-token",
                    `history-token--${game.won ? "win" : "loss"}`,
                    `history-token--${game.choice}`,
                  ].join(" ")}
                  role="listitem"
                >
                  <span className="history-token__coin" aria-hidden="true">
                    <img
                      src={historyCoinArt[game.choice]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  <span className="history-token__main">
                    <span className="history-token__id">#{game.betId}</span>
                    <strong className="history-token__choice">
                      {t(game.choice) || game.choice}
                    </strong>
                    <span className="history-token__outcome">
                      {t("outcomeHeader")}: {t(game.outcome) || game.outcome}
                    </span>
                  </span>
                  <span className="history-token__amounts">
                    <span>
                      {t("betHeader")} {game.amount.toFixed(2)}
                    </span>
                    <strong className={game.won ? "payout-win" : "payout-loss"}>
                      {t("payoutHeader")}{" "}
                      {game.won ? `+${game.payout.toFixed(2)}` : "0.00"}
                    </strong>
                  </span>
                </article>
              ))}
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
