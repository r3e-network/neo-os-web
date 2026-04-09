import { useMemo } from "react";
import ThreeDCoin from "@/components/ThreeDCoin";
import "./CoinArena.scss";

interface CoinArenaProps {
  displayOutcome: "heads" | "tails" | null;
  isFlipping: boolean;
  result: { won: boolean; outcome: string } | null;
  t: (key: string) => string;
}

export default function CoinArena({ displayOutcome, isFlipping, result, t }: CoinArenaProps) {
  const statusText = useMemo(() => {
    if (isFlipping) return t("flipping");
    if (result) return result.won ? t("youWon") : t("youLost");
    return t("placeBet");
  }, [isFlipping, result, t]);

  return (
    <div className="premium-arena">
      <div className="arena-content">
        <div className="arena-bg">
          <div className="arena-orbit" />
          <div className={`arena-glow${isFlipping ? " flipping" : ""}`} />
        </div>
        <div className="coin-wrapper">
          <ThreeDCoin result={displayOutcome} flipping={isFlipping} />
        </div>
        <div className="status-box">
          <div className="game-status-pill">
            <div className={`status-dot${isFlipping ? " flipping" : ""}`} />
            <span>{statusText}</span>
          </div>
        </div>
        {result && !isFlipping && (
          <div className={`result-banner${result.won ? " won" : ""}`} role="status" aria-live="polite" aria-atomic="true">
            <span className="result-text">{result.won ? t("youWon") : t("youLost")}</span>
            <span className="outcome-tag">{t(result.outcome)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
