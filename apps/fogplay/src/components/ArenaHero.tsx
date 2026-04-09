import CoinArena from "../pages/index/components/CoinArena";
import type { GameResult } from "../composables/useCoinFlip";
import "./ArenaHero.scss";

interface ArenaHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isFlipping: boolean;
  displayOutcome: "heads" | "tails" | null;
  result: GameResult | null;
}

export default function ArenaHero({ t, isFlipping, displayOutcome, result }: ArenaHeroProps) {
  return (
    <div className="arena-hero">
      <div className="hero-arena-bg">
        <div className="arena-ring" />
        <div className="arena-ring arena-ring-2" />
        <div className={`arena-ambient${isFlipping ? " flipping" : ""}`} />
      </div>
      <div className="coin-stage">
        <CoinArena displayOutcome={displayOutcome} isFlipping={isFlipping} result={result} t={t} />
      </div>
      {result && !isFlipping && (
        <div className={`result-flash ${result.won ? "win" : "lose"}`}>
          <span className="result-flash-icon" aria-hidden="true">{result.won ? "\u2705" : "\u274C"}</span>
          <span className="result-flash-text">{result.won ? "WIN" : "LOSE"}</span>
        </div>
      )}
      <div className="side-labels">
        <div className={`side-badge${displayOutcome === "heads" || (!displayOutcome && !isFlipping) ? " active" : ""}`}>
          <span className="side-text">{t("heads")}</span>
        </div>
        <div className="side-vs">{t("vs")}</div>
        <div className={`side-badge${displayOutcome === "tails" ? " active" : ""}`}>
          <span className="side-text">{t("tails")}</span>
        </div>
      </div>
    </div>
  );
}
