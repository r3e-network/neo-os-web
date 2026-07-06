import { useState, useEffect, useRef } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { ChipArt, ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import ThreeDCoin from "./components/ThreeDCoin";
import { BET_PRESETS } from "./composables/useCoinFlip";
import coinHeadsUrl from "./static/coin_heads.png";
import coinTailsUrl from "./static/coin_tails.png";
import holoPedestalUrl from "./static/holo_pedestal.webp";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}
interface GameHistory {
  id?: string;
  betId?: string;
  result?: string;
  choice?: string;
  amount?: string | number;
  won?: boolean;
  [k: string]: unknown;
}

type CoinSide = "heads" | "tails";
const SIDE_ASSETS: Record<CoinSide, string> = {
  heads: coinHeadsUrl,
  tails: coinTailsUrl,
};

function asSide(value: string): CoinSide {
  return value === "tails" ? "tails" : "heads";
}

function oppositeSide(side: CoinSide): CoinSide {
  return side === "heads" ? "tails" : "heads";
}

function formatPayout(amount: string): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? (numeric * 2).toFixed(2) : "0.00";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const wins = num("wins");
  const losses = num("losses");
  const totalGames = num("totalGames");
  const totalWon = str("formattedTotalWon", "0");
  const betAmount = str("betAmount", "1");
  const choice = asSide(str("choice", "heads"));
  const isFlipping = bool("isFlipping");
  const revealing = bool("revealing");
  const result = str("result", "");
  const displayOutcome = str("displayOutcome", "");
  const showWinOverlay = bool("showWinOverlay");
  const winAmount = str("winAmount", "");
  const validationError = str("validationError", "");
  const canBet = bool("canBet");
  const hasPendingBet = bool("hasPendingBet");
  const revealFailed = bool("revealFailed");
  const gameHistory = (val("gameHistory") ?? []) as GameHistory[];
  const formattedCredit = str("formattedCredit", "0");
  const hasCredit = bool("hasCredit");
  const formattedMaxPayable = str("formattedMaxPayable", "0");

  const [betPreview, setBetPreview] = useState(false);
  const betPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (betPreviewTimeout.current) clearTimeout(betPreviewTimeout.current);
    },
    [],
  );
  const startBetPreview = () => {
    if (betPreviewTimeout.current) clearTimeout(betPreviewTimeout.current);
    setBetPreview(true);
    betPreviewTimeout.current = setTimeout(() => {
      setBetPreview(false);
      betPreviewTimeout.current = null;
    }, 1500);
  };

  const coinAnimating = isFlipping || revealing || betPreview;
  const showResult = Boolean(result) && !coinAnimating;
  const revealedSide = showResult && result === "lost" ? oppositeSide(choice) : choice;
  const payoutPreview = formatPayout(betAmount);

  const handlePlaceBet = () => { if (!canBet) return; startBetPreview(); void dispatch("placeBet"); };
  const handleReveal = () => void dispatch("revealResult");
  const handleChoice = (side: CoinSide) => void dispatch("setChoice", side);
  const handleBetAmount = (amt: string) => void dispatch("setBetAmount", amt);

  const stageTitle = coinAnimating
    ? t("committing")
    : showResult
      ? result === "won"
        ? t("youWon")
        : t("youLost")
      : t("title");
  // A stalled reveal is the highest-stakes state in the app (the wager is
  // escrowed on-chain) — surface it in the scene status pill, not just the drawer.
  const revealStalled = revealFailed && !coinAnimating && !showResult;
  const firstRun = totalGames === 0 && !showResult && !coinAnimating && !revealStalled && !validationError;
  const statusText = coinAnimating
    ? revealing
      ? t("betPlacedRevealing")
      : t("committing")
    : showResult
      ? displayOutcome || (result === "won" ? t("youWon") : t("youLost"))
      : revealStalled
        ? t("revealStalled")
        : validationError ||
          (firstRun ? t("firstRoundPrompt") : `${t("betHeader")} ${betAmount} ${t("tokenGas")}`);

  const scene = (
    <div
      className="fogplay-scene"
      data-state={coinAnimating ? "flipping" : showResult ? result : "idle"}
      aria-label={
        coinAnimating
          ? revealing
            ? t("betPlacedRevealing")
            : t("committing")
          : showResult
            ? result === "won"
              ? t("youWon")
              : t("youLost")
            : t("title")
      }
      role="region"
    >
      <div className="fogplay-scene__arena" aria-hidden="true">
        <span className="fogplay-scene__orbit fogplay-scene__orbit--one" />
        <span className="fogplay-scene__orbit fogplay-scene__orbit--two" />
        <span className="fogplay-scene__runway" />
      </div>

      <div className="fogplay-scene__side-rail" role="radiogroup" aria-label={t("choiceHeader")}>
        {(["heads", "tails"] as const).map((side) => {
          const active = choice === side;
          return (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(side)}
              aria-pressed={active}
              className={[
                "fogplay-choice-btn",
                "fogplay-choice-card",
                `fogplay-choice-card--${side}`,
                active && "fogplay-choice-btn--active",
                active && "fogplay-choice-card--active",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleChoice(side)}
              disabled={coinAnimating}
            >
              <span className="fogplay-choice-card__coin" aria-hidden="true">
                <img src={SIDE_ASSETS[side]} alt="" draggable={false} decoding="async" />
              </span>
              <span className="fogplay-choice-card__copy">
                <span>{t(side)}</span>
                <strong>{active ? t("youPicked") : t("choiceHeader")}</strong>
              </span>
            </button>
          );
        })}
      </div>

      <div className="fogplay-scene__table" aria-hidden="true">
        <img className="fogplay-scene__pedestal" src={holoPedestalUrl} alt="" draggable={false} />
      </div>
      <div
        key={`${choice}-${coinAnimating}-${result}`}
        className={[
          "fogplay-scene__coin",
          coinAnimating ? "fogplay-scene__coin--flipping" : null,
          showResult ? "fogplay-scene__coin--landed" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ThreeDCoin
          result={revealedSide}
          flipping={coinAnimating}
          headsLabel={t("heads")}
          tailsLabel={t("tails")}
          showLabels={false}
        />
      </div>

      {showResult && result === "won" && <ParticleBurst coins count={10} />}
      <p
        className="fogplay-scene__status"
        role={coinAnimating ? "alert" : "status"}
        aria-live={coinAnimating ? "assertive" : "polite"}
        aria-atomic="true"
        data-tone={revealStalled ? "alert" : undefined}
      >
        {statusText}
        {firstRun && <span className="fogplay-scene__status-sub">{t("oddsChip")}</span>}
      </p>
    </div>
  );

  const controls = (
    <div className="fogplay-controls">
      <div className="fogplay-controls__header">
        <span className="fogplay-controls__header-cell">
          <span>{t("wager")}</span>
          <b>{betAmount} {t("tokenGas")}</b>
        </span>
        <span className="fogplay-controls__header-cell fogplay-controls__header-cell--payout">
          <span>{t("payoutPreviewLabel")}</span>
          <strong>{payoutPreview} {t("tokenGas")}</strong>
        </span>
      </div>
      <div className="fogplay-controls__bets">
        {BET_PRESETS.map((p) => {
          const betActive = betAmount === p;
          return (
          <button
            key={p}
            type="button"
            className={[
              "fogplay-bet-chip",
              betActive && "fogplay-bet-chip--active",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleBetAmount(p)}
            disabled={coinAnimating}
            aria-pressed={betActive}
            data-active={betActive}
          >
            <ChipArt label={p} size={46} selected={betAmount === p} />
            <span>{t("tokenGas")}</span>
          </button>
        ))}
      </div>
      {validationError && <p className="fogplay-controls__error" role="alert">{validationError}</p>}
    </div>
  );

  return (
    <div className="fogplay-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("title"),
          title: stageTitle,
          subtitle: t("docSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {wins}W / {losses}L
              </span>
              {hasCredit && <span className="mx2-badge">{formattedCredit}</span>}
            </>
          ),
        }}
        scene={
          <>
            {scene}
            {controls}
          </>
        }
        score={[
          { label: t("choiceHeader"), value: t(choice), accent: true },
          { label: t("wager"), value: `${betAmount} ${t("tokenGas")}` },
          ...(showResult && result === "won" && winAmount
            ? [{ label: t("youWon"), value: winAmount, accent: true }]
            : []),
          { label: t("totalGames"), value: String(totalGames) },
          { label: t("totalWon"), value: totalWon },
        ]}
        actions={{
          primary: hasPendingBet
            ? {
                label: revealing ? t("betPlacedRevealing") : t("revealResult"),
                onClick: () => void handleReveal(),
                loading: revealing,
                hint: t("betPlacedRevealing"),
              }
            : {
                label: coinAnimating ? t("flipping") : t("flipCoin"),
                onClick: () => void handlePlaceBet(),
                disabled: coinAnimating || !canBet,
                loading: coinAnimating,
                hint: t("betHeader"),
              },
          secondary: [
            ...(hasCredit
              ? [
                  {
                    label: t("withdrawCredit"),
                    onClick: () => void dispatch("withdrawCredit"),
                    hint: t("creditWithdrawn"),
                  },
                ]
              : []),
            ...(showResult
              ? [{ label: t("playAgain"), onClick: () => void dispatch("resetGame"), hint: t("playAgain") }]
              : []),
          ],
        }}
        drawerToggleLabel={t("gameHistory")}
        drawer={{
          title: t("gameHistory"),
          children: (
            <>
              <h4>{t("gameHistory")}</h4>
              {gameHistory.length > 0 ? (
                <ul className="mx2-history">
                  {gameHistory.slice(0, 8).map((g) => {
                    const historySide = asSide(String(g.choice ?? "heads"));
                    // History rows arrive either from the composable (won:
                    // boolean, betId) or test fixtures (result: string, id) —
                    // normalize both shapes to one outcome tone + label.
                    const won = g.result === "won" || g.won === true;
                    const lost = g.result === "lost" || g.won === false;
                    return (
                      <li
                        key={String(g.id ?? g.betId ?? "")}
                        className="mx2-history__item"
                        data-outcome={won ? "won" : lost ? "lost" : undefined}
                      >
                        <span className="mx2-history__face">{t(historySide)}</span>
                        <span className="mx2-history__stake">{g.amount}</span>
                        <span className="mx2-history__result">
                          {won ? t("youWon") : lost ? t("youLost") : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>{t("noHistory")}</p>
              )}
              <h4>{t("commitRevealTimeline")}</h4>
              <p>{t("timelineCommit")}</p>
              <p>{t("timelineReveal") || t("timelineResultReady")}</p>
              <p>
                {t("wagerRange")}: {formattedMaxPayable}
              </p>
              {revealFailed && <p className="fogplay-controls__error">{t("timelineNeedsRetry")}</p>}
            </>
          ),
        }}
      />
      {showWinOverlay && (
        <div className="fogplay-win-overlay" role="dialog" aria-modal="true">
          <div className="fogplay-win-overlay__card mx2-rise-in">
            <ParticleBurst coins count={14} />
            <img className="fogplay-win-overlay__coin" src={coinHeadsUrl} alt="" draggable={false} />
            <h3>{t("youWon")}</h3>
            <p className="fogplay-win-overlay__amount">{winAmount}</p>
            <button
              type="button"
              className="mx2-btn mx2-btn--primary"
              onClick={() => void dispatch("dismissOverlay")}
            >
              {t("overlayTapContinue")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
