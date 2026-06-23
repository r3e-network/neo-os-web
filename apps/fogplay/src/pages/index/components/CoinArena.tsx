import { useMemo } from "react";
import { NeoButton } from "@shared/components-react";
import ThreeDCoin from "../../../components/ThreeDCoin";
import vaultBgUrl from "../../../static/bg_vault.png";
import pedestalUrl from "../../../static/holo_pedestal.png";
import winnerUrl from "../../../static/holo_winner.png";
import coinHeadsUrl from "../../../static/coin_heads.png";
import coinTailsUrl from "../../../static/coin_tails.png";
import "./CoinArena.scss";

const PAYOUT_MULTIPLIER = 2;
const COIN_ART: Record<"heads" | "tails", string> = {
  heads: coinHeadsUrl,
  tails: coinTailsUrl,
};

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
  const stageState = coinSpinning
    ? revealing
      ? "revealing"
      : "flipping"
    : result
      ? result.won
        ? "won"
        : "lost"
      : "ready";
  const raceState = isFlipping
    ? "committing"
    : revealing || (hasPendingBet && !result)
      ? "revealing"
      : result
        ? "settled"
        : "ready";
  const raceSteps = [
    {
      key: "commit",
      label: t("timelineCommit"),
      value: raceState === "ready" ? t("timelineReady") : t("timelineOnChain"),
      active: raceState === "committing",
      complete: raceState !== "ready",
    },
    {
      key: "block",
      label: t("timelineBlock"),
      value:
        raceState === "revealing"
          ? t("timelineListening")
          : result
            ? t("timelineResultReady")
            : t("timelineWaiting"),
      active: raceState === "revealing",
      complete: raceState === "revealing" || raceState === "settled",
    },
    {
      key: "settle",
      label: t("timelineSettle"),
      value: result
        ? result.won
          ? t("timelineWon")
          : t("timelineLost")
        : revealFailed
          ? t("timelineNeedsRetry")
          : t("timelineWaiting"),
      active: raceState === "settled",
      complete: Boolean(result),
    },
  ];

  return (
    <div
      className={`premium-arena premium-arena--${stageState}`}
      data-state={stageState}
    >
      <div className="arena-content">
        <div className="arena-bg" aria-hidden="true">
          <img
            className="arena-bg__vault"
            src={vaultBgUrl}
            alt=""
            loading="eager"
            decoding="async"
          />
          <span className="arena-bg__wash" />
          <div className="arena-orbit" />
          <div className="arena-orbit arena-orbit--inner" />
          <div className={`arena-glow${coinSpinning ? " flipping" : ""}`} />
        </div>
        <div className="arena-stage" aria-hidden="true">
          <img
            className="arena-stage__pedestal"
            src={pedestalUrl}
            alt=""
            loading="eager"
            decoding="async"
          />
          {coinSpinning && (
            <div className="coin-flight-trail">
              <span />
              <span />
              <span />
            </div>
          )}
          {result?.won && !coinSpinning && (
            <img
              className="arena-stage__winner"
              src={winnerUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className={`coin-wrapper coin-wrapper--${stageState}`}>
          <ThreeDCoin
            result={displayOutcome}
            flipping={coinSpinning}
            headsLabel={t("heads")}
            tailsLabel={t("tails")}
          />
        </div>
        <div
          className={`arena-choice-beacons arena-choice-beacons--${choice}`}
          aria-hidden="true"
        >
          {(["heads", "tails"] as const).map((side) => (
            <span
              key={side}
              className={`arena-choice-beacon${side === choice ? " is-selected" : ""}`}
            >
              <img
                src={COIN_ART[side]}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span>
                <small>{t(side)}</small>
                <strong>
                  {side === choice ? payoutPreview : t("oddsChip")}
                </strong>
              </span>
            </span>
          ))}
        </div>
        <div className="status-box">
          <div className={`game-status-pill${revealing ? " revealing" : ""}`}>
            <div className={`status-dot${coinSpinning ? " flipping" : ""}`} />
            <span>{statusText}</span>
          </div>
        </div>
        <div
          className={`commit-reveal-race commit-reveal-race--${raceState}`}
          aria-label={t("commitRevealTimeline")}
        >
          <div className="commit-reveal-race__track" aria-hidden="true">
            <span className="commit-reveal-race__fill" />
            <span className="commit-reveal-race__runner" />
          </div>
          <div className="commit-reveal-race__steps" role="list">
            {raceSteps.map((step) => (
              <span
                key={step.key}
                className={[
                  "commit-reveal-race__step",
                  step.active ? "is-active" : "",
                  step.complete ? "is-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
              >
                <small>{step.label}</small>
                <strong>{step.value}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Pending-reveal banner: the bet is committed + irrevocable on-chain. */}
        {hasPendingBet && (
          <div className="reveal-pending" role="status" aria-live="polite">
            <span className="reveal-pending__text">
              {revealFailed ? t("revealStalled") : t("betPlacedRevealing")}
            </span>
            {!revealFailed && (
              <span className="reveal-pending__reassure">
                {t("betLockedReassure")}
              </span>
            )}
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
              <span className="bet-preview__label">
                {t("payoutPreviewLabel")}
              </span>
              <strong>{payoutPreview}</strong>
            </span>
            <span className="bet-preview__odds">{t("oddsChip")}</span>
          </div>
        )}
        {result && !coinSpinning && (
          <div
            className={`result-banner${result.won ? " won" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="result-text">
              {result.won ? t("youWon") : t("youLost")}
            </span>
            <span className="outcome-tag">{t(result.outcome)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
