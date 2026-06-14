import { useMemo } from "react";
import { NeoButton } from "@shared/components-react";
import ThreeDCoin from "@/components/ThreeDCoin";
import "./CoinArena.scss";

const PAYOUT_MULTIPLIER = 2;

interface CoinArenaProps {
  displayOutcome: "heads" | "tails" | null;
  isFlipping: boolean;
  /** True during the post-commit, pre-reveal wait (waiting for the next block). */
  revealing: boolean;
  /** A bet is committed on-chain and awaiting its reveal. */
  hasPendingBet: boolean;
  /** The inline reveal failed — show the manual "Reveal result" retry. */
  revealFailed: boolean;
  result: { won: boolean; outcome: string } | null;
  /** Currently selected side — drives the "you picked" caption. */
  choice: "heads" | "tails";
  /** Current wager amount (formatted GAS string) for the payout preview. */
  betAmount: string;
  /** Retry the permissionless settle for the persisted pending bet. */
  onReveal: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function CoinArena({
  displayOutcome,
  isFlipping,
  revealing,
  hasPendingBet,
  revealFailed,
  result,
  choice,
  betAmount,
  onReveal,
  t,
}: CoinArenaProps) {
  const statusText = useMemo(() => {
    // Distinguish the two phases of the commit/reveal flow so the player knows
    // the bet is irrevocably placed and the outcome is being revealed next block.
    if (revealing) return t("revealingNextBlock");
    if (isFlipping) return t("committing");
    if (result) return result.won ? t("youWon") : t("youLost");
    return t("placeBet");
  }, [revealing, isFlipping, result, t]);

  // 2x potential return on the current wager — em-dash until the bet parses.
  const payoutPreview = useMemo(() => {
    const numeric = Number(betAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return "—";
    return `${(numeric * PAYOUT_MULTIPLIER).toFixed(2)} ${t("tokenGas")}`;
  }, [betAmount, t]);

  // The coin spins through both the commit and the reveal wait.
  const coinSpinning = isFlipping || revealing;

  return (
    <div className="premium-arena">
      <div className="arena-content">
        <div className="arena-bg">
          <div className="arena-orbit" />
          <div className={`arena-glow${coinSpinning ? " flipping" : ""}`} />
        </div>
        <div className="coin-wrapper">
          <ThreeDCoin
            result={displayOutcome}
            flipping={coinSpinning}
            headsLabel={t("heads")}
            tailsLabel={t("tails")}
          />
        </div>
        <div className="status-box">
          <div className={`game-status-pill${revealing ? " revealing" : ""}`}>
            <div className={`status-dot${coinSpinning ? " flipping" : ""}`} />
            <span>{statusText}</span>
          </div>
        </div>

        {/* Pending-reveal banner: the bet is committed + irrevocable on-chain. */}
        {hasPendingBet && (
          <div className="reveal-pending" role="status" aria-live="polite">
            <span className="reveal-pending__text">
              {revealFailed ? t("revealStalled") : t("betPlacedRevealing")}
            </span>
            {revealFailed && (
              <NeoButton
                variant="primary"
                size="sm"
                className="reveal-retry-btn"
                onClick={onReveal}
                aria-label={t("revealResult")}
              >
                {t("revealResult")}
              </NeoButton>
            )}
          </div>
        )}

        {!coinSpinning && !result && !hasPendingBet && (
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
        {result && !coinSpinning && (
          <div className={`result-banner${result.won ? " won" : ""}`} role="status" aria-live="polite" aria-atomic="true">
            <span className="result-text">{result.won ? t("youWon") : t("youLost")}</span>
            <span className="outcome-tag">{t(result.outcome)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
