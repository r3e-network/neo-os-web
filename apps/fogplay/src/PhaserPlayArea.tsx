import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, ShieldCheck, WalletCards, X } from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = {
  width: 400,
  height: 580,
} as const;

const WAGER_PRESETS = ["0.25", "0.50", "1.00", "2.00"] as const;

function translatedOr(t: P["t"], key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

const loadFogplayScene = () =>
  import("./scenes/FogplayScene").then((module) => module.FogplayScene);

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
  // Guest (free / local) mode branches every GAS-centric label to local framing
  // (no wager/pool/reward). GameFi is disabled by the compatibility gate, so a
  // bridge state that has not arrived yet must fail closed to the guest table.
  const isGuest = str("mode", "guest") === "guest";
  const streak = num("streak");
  const coinAnimating = bool("isFlipping") || bool("revealing");
  const rawResult = val<unknown>("result", null);
  const result = normalizeResult(rawResult);
  const rawOutcome = str("displayOutcome", "") || normalizeOutcome(rawResult);
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
  const bankrollAvailable = bool("bankrollAvailable");
  const winAmount = str("winAmount", "");
  const gameHistory = (val<GameHistoryRow[]>("gameHistory", []) ?? []) as GameHistoryRow[];
  const payoutPreview = `${(Number(betAmount) * 2 || 0).toFixed(2)} GAS`;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        drawerToggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (controls.length === 0) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const bridgeState = {
    choice,
    betAmount,
    isGuest,
    isFlipping:      bool("isFlipping"),
    revealing:       bool("revealing"),
    result,
    displayOutcome:  rawOutcome,
    landedLabel:     rawOutcome === "heads" || rawOutcome === "tails" ? t(rawOutcome) : "",
    winAmount:       !isGuest && winAmount ? `${winAmount} GAS` : winAmount,
    canBet:          bool("canBet"),
    validationError,
    formattedMaxPayable,
    formattedCredit,
    hasCredit,
    hasPendingBet,
    revealFailed,
    // Localized in-canvas copy (additive — the scene reads these via this.str
    // so the coin table never renders hardcoded English under a non-en locale).
    tableTitle:      t("tableTitle"),
    headsLabel:      t("heads"),
    tailsLabel:      t("tails"),
    headsHint:       t("headsHint"),
    tailsHint:       t("tailsHint"),
    // Mode-aware in-canvas copy: guest reframes the GAS payout row + status line
    // as a local streak run (no wager/pool). `payoutValue` is the value the
    // scene renders in the payout row (GameFi keeps the "N.NN GAS" string).
    payoutCaption:   isGuest ? t("guestStreak") : t("payoutPreviewLabel"),
    payoutValue:     isGuest ? String(streak) : payoutPreview,
    statusIdle:      isGuest
      ? t("guestStatusIdle")
      : bankrollAvailable
        ? t("oddsShort")
        : t("houseUnavailableShort"),
    statusFlipping:  isGuest ? t("guestStatusFlipping") : t("awaitingReveal"),
    flipCta:         !isGuest && !bankrollAvailable ? t("houseUnavailableCta") : t("flipCta"),
    flippingCta:     t("flippingCta"),
    revealCta:       t("revealResult"),
    playAgainCta:    t("playAgain"),
    resultWin:       t("resultWin"),
    resultMiss:      t("resultMiss"),
    tryAgainShort:   t("tryAgainShort"),
  };

  const stageTitle = (() => {
    if (coinAnimating) {
      if (isGuest) return t("guestStatusFlipping");
      return bool("revealing") ? t("betPlacedRevealing") : t("committing");
    }
    if (hasPendingBet || revealFailed) return t("revealStalled");
    if (result === "won") return t("youWon");
    if (result === "lost") return t("youLost");
    if (!isGuest && validationError) return t("gameFiPausedTitle");
    return t("title");
  })();
  const scoreItems = isGuest
    ? [
        { label: t("choiceHeader"), value: t(choice), accent: true },
        { label: t("guestStreak"), value: String(streak), accent: true },
        { label: t("wins"), value: String(wins) },
        { label: t("losses"), value: String(losses) },
        { label: t("totalGames"), value: String(totalGames) },
      ]
    : [
        { label: t("choiceHeader"), value: t(choice), accent: true },
        { label: t("wager"), value: `${betAmount} GAS` },
        { label: t("payoutPreviewLabel"), value: payoutPreview },
        { label: t("totalGames"), value: String(totalGames) },
        { label: t("totalWon"), value: totalWon },
      ];
  const drawerId = "fogplay-ingame-drawer";
  const primaryAction = hasPendingBet || revealFailed
    ? "revealResult"
    : result
      ? "resetGame"
      : "placeBet";
  const primaryLabel = primaryAction === "revealResult"
    ? t("revealResult")
    : primaryAction === "resetGame"
      ? t("playAgain")
      : t("flipCta");
  const primaryEnabled =
    !coinAnimating &&
    (primaryAction !== "placeBet" || bool("canBet"));

  return (
    <div className="fogplay-play-area fogplay-phaser-playarea mx2 mx2-cat-game" aria-busy={coinAnimating || undefined}>
      <PlayStage
        category="game"
        className="fogplay-phaser-stage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestModeBadge") : "Neo N3"}
              </span>
              <span className="mx2-badge">{wins}W / {losses}L</span>
              {!isGuest && hasCredit && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {formattedCredit}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="fogplay-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadFogplayScene}
              state={bridgeState}
              dispatch={dispatch}
              className="fogplay-phaser-canvas"
              ariaLabel={translatedOr(t, "gameAriaLabel", "FogPlay coin flip game")}
              loadingLabel={translatedOr(t, "gameLoadingLabel", "Opening flip table")}
              errorLabel={translatedOr(t, "gameLoadError", "Flip table failed to load")}
              retryLabel={translatedOr(t, "retryLoad", "Retry")}
              continueLabel={translatedOr(t, "continue", "Continue")}
              enableSoundLabel={translatedOr(t, "enableGameSound", "Enable game sound")}
              muteSoundLabel={translatedOr(t, "muteGameSound", "Mute game sound")}
            />

            <div
              className="fogplay-a11y-controls"
              aria-label={translatedOr(t, "gameControls", "Coin flip controls")}
            >
              <p>{translatedOr(t, "keyboardHelp", "Choose a side, then flip the coin.")}</p>
              <div role="radiogroup" aria-label={t("choiceHeader")}>
                {(["heads", "tails"] as const).map((side) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={choice === side}
                    disabled={coinAnimating}
                    onClick={() => void dispatch("setChoice", side)}
                    key={side}
                  >
                    {t(side)}
                  </button>
                ))}
              </div>
              {!isGuest && (
                <div role="radiogroup" aria-label={t("wager")}>
                  {WAGER_PRESETS.map((amount) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={Number(betAmount) === Number(amount)}
                      disabled={coinAnimating || hasPendingBet}
                      onClick={() => void dispatch("setBetAmount", amount)}
                      key={amount}
                    >
                      {amount} GAS
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="fogplay-a11y-controls__primary"
                aria-label={primaryLabel}
                disabled={!primaryEnabled}
                onClick={() => void dispatch(primaryAction)}
              >
                {primaryLabel}
              </button>
            </div>

            <p className="fogplay-sr-only" role="status" aria-live="polite">
              {stageTitle}
            </p>

            <div className="fogplay-stage-hud" aria-label={t("gameHistory")}>
              {scoreItems.map((item) => (
                <div
                  className="fogplay-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerToggleRef}
                type="button"
                className="fogplay-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{t("gameHistory")}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <section
                ref={drawerRef}
                id={drawerId}
                className="fogplay-ingame-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${drawerId}-title`}
              >
                <div className="fogplay-phaser-drawer">
                  <header className="fogplay-phaser-drawer__header">
                    <h3 id={`${drawerId}-title`}>{t("gameHistory")}</h3>
                    <button
                      ref={drawerCloseRef}
                      type="button"
                      aria-label={translatedOr(t, "closeHistory", "Close recent games")}
                      onClick={() => {
                        setDrawerOpen(false);
                        drawerToggleRef.current?.focus();
                      }}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </header>
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
                      <span>{isGuest ? t("guestBestStreak") : t("totalWon")}</span>
                      <strong>{isGuest ? streak : totalWon}</strong>
                    </div>
                  </section>

                  {validationError && (
                    <section className="fogplay-phaser-drawer__notice" data-tone="alert">
                      <strong>{t("betHeader")}</strong>
                      <span>{validationError}</span>
                    </section>
                  )}

                  {!isGuest && hasCredit && (
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
                              {!isGuest && <span>{formatHistoryAmount(row.amount)}</span>}
                              <span>{outcome === "won" ? t("youWon") : outcome === "lost" ? t("youLost") : "--"}</span>
                              {!isGuest && <strong>{formatHistoryAmount(row.payout)}</strong>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="fogplay-phaser-drawer__empty">
                        {isGuest ? t("guestNoHistory") : t("noHistory")}
                      </p>
                    )}
                  </section>

                  {isGuest ? (
                    <section className="fogplay-phaser-drawer__section fogplay-phaser-drawer__fairness" aria-label={t("guestModeBadge")}>
                      <h4><ShieldCheck size={16} aria-hidden="true" /> {t("guestModeBadge")}</h4>
                      <p>{t("guestFairnessNote")}</p>
                    </section>
                  ) : (
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
                  )}
                </div>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
