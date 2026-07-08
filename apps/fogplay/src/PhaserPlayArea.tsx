import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { FogplayScene } from "./scenes/FogplayScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = {
  scene: [FogplayScene],
  width: 400,
  height: 580,
} as const;

interface GameResultLike {
  won?: boolean;
  outcome?: string;
}

interface GameHistoryRow {
  id?: string;
  betId?: string;
  result?: string;
  choice?: string;
  amount?: string | number;
  won?: boolean;
  payout?: string | number;
  outcome?: string;
}

function normalizeResult(value: unknown): "" | "won" | "lost" {
  if (value === "won" || value === "lost") return value;
  if (value && typeof value === "object" && "won" in value) {
    return (value as GameResultLike).won ? "won" : "lost";
  }
  return "";
}

function normalizeOutcome(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "outcome" in value) {
    return String((value as GameResultLike).outcome ?? "");
  }
  return "";
}

function historyOutcome(row: GameHistoryRow): "" | "won" | "lost" {
  if (row.result === "won" || row.result === "lost") return row.result;
  if (typeof row.won === "boolean") return row.won ? "won" : "lost";
  return "";
}

function formatHistoryAmount(value: string | number | undefined): string {
  if (value == null || value === "") return "--";
  return typeof value === "number" ? `${value.toFixed(value >= 10 ? 0 : 2)} GAS` : String(value);
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const coinAnimating = bool("isFlipping") || bool("revealing");
  const rawResult = val<unknown>("result", null);
  const result = normalizeResult(rawResult);
  const rawOutcome = str("displayOutcome", "") || normalizeOutcome(rawResult);
  const showResult = Boolean(result) && !coinAnimating;
  const hasPendingBet = bool("hasPendingBet");
  const revealFailed = bool("revealFailed");
  const hasCredit = bool("hasCredit");
  const wins = num("wins");
  const losses = num("losses");
  const totalGames = num("totalGames");
  const totalWon = str("formattedTotalWon", "0 GAS");
  const betAmount = str("betAmount", "1");
  const choice = str("choice", "heads") === "tails" ? "tails" : "heads";
  const validationError = str("validationError", "");
  const formattedCredit = str("formattedCredit", "0 GAS");
  const formattedMaxPayable = str("formattedMaxPayable", "0 GAS");
  const winAmount = str("winAmount", "");
  const gameHistory = (val<GameHistoryRow[]>("gameHistory", []) ?? []) as GameHistoryRow[];
  const payoutPreview = `${(Number(betAmount) * 2 || 0).toFixed(2)} GAS`;

  const bridgeState = {
    choice,
    betAmount,
    isFlipping:      bool("isFlipping"),
    revealing:       bool("revealing"),
    result,
    displayOutcome:  rawOutcome,
    winAmount,
    canBet:          bool("canBet"),
    validationError,
    formattedMaxPayable,
    formattedCredit,
    hasCredit,
    hasPendingBet,
    revealFailed,
  };

  const stageTitle = (() => {
    if (coinAnimating) return bool("revealing") ? t("betPlacedRevealing") : t("committing");
    if (hasPendingBet || revealFailed) return t("revealStalled");
    if (result === "won") return t("youWon");
    if (result === "lost") return t("youLost");
    return t("title");
  })();

  const secondaryActions = [
    ...(hasCredit
      ? [{
          label: t("withdrawCredit"),
          onClick: () => void dispatch("withdrawCredit"),
          icon: <WalletCards size={16} aria-hidden="true" />,
          hint: t("creditWithdrawn"),
        }]
      : []),
    ...(showResult
      ? [{
          label: t("playAgain"),
          onClick: () => void dispatch("resetGame"),
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("playAgain"),
        }]
      : []),
  ];

  return (
    <div className="fogplay-play-area fogplay-phaser-playarea mx2 mx2-cat-game" aria-busy={coinAnimating || undefined}>
      <PlayStage
        category="game"
        className="fogplay-phaser-stage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> Neo N3
              </span>
              <span className="mx2-badge">{wins}W / {losses}L</span>
              {hasCredit && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {formattedCredit}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="fogplay-phaser-canvas"
            ariaLabel="FogPlay coin flip game"
            loadingLabel="Opening flip table"
          />
        }
        score={[
          { label: t("choiceHeader"), value: t(choice), accent: true },
          { label: t("wager"), value: `${betAmount} GAS` },
          { label: t("payoutPreviewLabel"), value: payoutPreview },
          { label: t("totalGames"), value: String(totalGames) },
          { label: t("totalWon"), value: totalWon },
        ]}
        actions={{
          primary: hasPendingBet || revealFailed
            ? {
                label: bool("revealing") ? t("betPlacedRevealing") : t("revealResult"),
                onClick: () => void dispatch("revealResult"),
                loading: bool("revealing"),
                icon: <Trophy size={16} aria-hidden="true" />,
                hint: t("revealStalled"),
              }
            : undefined,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("gameHistory")}
        drawer={{
          title: t("gameHistory"),
          children: (
            <div className="fogplay-phaser-drawer">
              <section className="fogplay-phaser-drawer__summary" aria-label={t("gameHistory")}>
                <div>
                  <span>{t("wins")}</span>
                  <strong>{wins}</strong>
                </div>
                <div>
                  <span>{t("losses")}</span>
                  <strong>{losses}</strong>
                </div>
                <div>
                  <span>{t("totalWon")}</span>
                  <strong>{totalWon}</strong>
                </div>
              </section>

              {validationError && (
                <section className="fogplay-phaser-drawer__notice" data-tone="alert">
                  <strong>{t("betHeader")}</strong>
                  <span>{validationError}</span>
                </section>
              )}

              {hasCredit && (
                <section className="fogplay-phaser-drawer__credit" aria-label={t("prepaidCredit")}>
                  <span>
                    {t("prepaidCredit")}: <strong>{formattedCredit}</strong>
                    <em>{t("betPrepaidNoFlip")}</em>
                  </span>
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("withdrawCredit")}
                  >
                    <WalletCards size={16} aria-hidden="true" />
                    {t("withdrawCredit")}
                  </button>
                </section>
              )}

              <section className="fogplay-phaser-drawer__section" aria-label={t("gameHistory")}>
                <h4>{t("gameHistory")}</h4>
                {gameHistory.length > 0 ? (
                  <ul className="fogplay-phaser-history">
                    {gameHistory.slice(0, 8).map((row, index) => {
                      const outcome = historyOutcome(row);
                      const side = row.choice === "tails" ? "tails" : "heads";
                      return (
                        <li
                          key={String(row.id ?? row.betId ?? index)}
                          className="fogplay-phaser-history__row"
                          data-outcome={outcome || undefined}
                        >
                          <span>{t(side)}</span>
                          <span>{formatHistoryAmount(row.amount)}</span>
                          <span>{outcome === "won" ? t("youWon") : outcome === "lost" ? t("youLost") : "--"}</span>
                          <strong>{formatHistoryAmount(row.payout)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="fogplay-phaser-drawer__empty">{t("noHistory")}</p>
                )}
              </section>

              <section className="fogplay-phaser-drawer__section fogplay-phaser-drawer__fairness" aria-label={t("commitRevealTimeline")}>
                <h4><ShieldCheck size={16} aria-hidden="true" /> {t("commitRevealTimeline")}</h4>
                <p>{t("fairnessNote")}</p>
                <div className="fogplay-phaser-timeline" aria-label={t("commitRevealTimeline")}>
                  <span>{t("timelineCommit")}</span>
                  <span>{t("timelineBlock")}</span>
                  <span>{t("timelineReveal")}</span>
                  <span>{t("timelineSettle")}</span>
                </div>
                <p>{t("maxPayableHint", { max: formattedMaxPayable })}</p>
                {revealFailed && (
                  <p className="fogplay-phaser-drawer__retry">{t("revealFailedRetry")}</p>
                )}
              </section>
            </div>
          ),
        }}
      />
    </div>
  );
}
