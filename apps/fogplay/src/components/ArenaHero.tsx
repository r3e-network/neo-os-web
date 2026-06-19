import CoinArena from "../pages/index/components/CoinArena";
import type { GameResult } from "../composables/useCoinFlip";
import "./ArenaHero.scss";

interface ArenaHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isFlipping: boolean;
  /** True during the post-commit, pre-reveal wait. */
  revealing: boolean;
  /** A committed bet is awaiting its reveal. */
  hasPendingBet: boolean;
  /** The inline reveal failed — show the manual retry. */
  revealFailed: boolean;
  displayOutcome: "heads" | "tails" | null;
  result: GameResult | null;
  choice: "heads" | "tails";
  betAmount: string;
  /** Retry the permissionless settle for the persisted pending bet. */
  onReveal: () => void;
}

export default function ArenaHero({
  t,
  isFlipping,
  revealing,
  hasPendingBet,
  revealFailed,
  displayOutcome,
  result,
  choice,
  betAmount,
  onReveal,
}: ArenaHeroProps) {
  // The coin keeps spinning through both the commit and the reveal wait.
  const coinSpinning = isFlipping || revealing;
  return (
    <div className="arena-hero">
      <div className="hero-arena-bg">
        <div className="arena-ring" />
        <div className="arena-ring arena-ring-2" />
        <div className={`arena-ambient${coinSpinning ? " flipping" : ""}`} />
      </div>
      <div className="coin-stage">
        <CoinArena
          displayOutcome={displayOutcome}
          isFlipping={isFlipping}
          revealing={revealing}
          hasPendingBet={hasPendingBet}
          revealFailed={revealFailed}
          result={result}
          choice={choice}
          betAmount={betAmount}
          onReveal={onReveal}
          t={t}
        />
      </div>
      {result && !coinSpinning && (
        <div className={`result-flash ${result.won ? "win" : "lose"}`}>
          <span className="result-flash-icon" aria-hidden="true">
            {result.won ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5 10 17l9-10" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            )}
          </span>
          <span className="result-flash-text">{result.won ? t("youWon") : t("youLost")}</span>
        </div>
      )}
    </div>
  );
}
