import { useMemo } from "react";
import ThreeDCoin from "@/components/ThreeDCoin";
import "./CoinArena.scss";

const PAYOUT_MULTIPLIER = 2;

interface CoinArenaProps {
  displayOutcome: "heads" | "tails" | null;
  isFlipping: boolean;
  result: { won: boolean; outcome: string } | null;
  /** Currently selected side — drives the "you picked" caption. */
  choice: "heads" | "tails";
  /** Current wager amount (formatted GAS string) for the payout preview. */
  betAmount: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function CoinArena({ displayOutcome, isFlipping, result, choice, betAmount, t }: CoinArenaProps) {
  const statusText = useMemo(() => {
    if (isFlipping) return t("flipping");
    if (result) return result.won ? t("youWon") : t("youLost");
    return t("placeBet");
  }, [isFlipping, result, t]);

  // 2x potential return on the current wager — em-dash until the bet parses.
  const payoutPreview = useMemo(() => {
    const numeric = Number(betAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return "—";
    return `${(numeric * PAYOUT_MULTIPLIER).toFixed(2)} ${t("tokenGas")}`;
  }, [betAmount, t]);

  return (
    <div className="premium-arena">
      <div className="arena-content">
        <div className="arena-bg">
          <div className="arena-orbit" />
          <div className={`arena-glow${isFlipping ? " flipping" : ""}`} />
        </div>
        <div className="coin-wrapper">
          <ThreeDCoin
            result={displayOutcome}
            flipping={isFlipping}
            headsLabel={t("heads")}
            tailsLabel={t("tails")}
          />
        </div>
        <div className="status-box">
          <div className="game-status-pill">
            <div className={`status-dot${isFlipping ? " flipping" : ""}`} />
            <span>{statusText}</span>
          </div>
        </div>
        {!isFlipping && !result && (
          <div className="bet-preview" aria-live="polite">
            <span className="bet-preview__cell">
              <span className="bet-preview__label">{t("youPicked")}</span>
              <strong>{t(choice)}</strong>
            </span>
            <span className="bet-preview__divider" aria-hidden="true" />
            <span className="bet-preview__cell">
              <span className="bet-preview__label">{t("payoutPreviewLabel")}</span>
              <strong>{payoutPreview}</strong>
            </span>
            <span className="bet-preview__odds">{t("oddsChip")}</span>
          </div>
        )}
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
