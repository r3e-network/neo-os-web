/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Flappy Dash.
 *
 * Bridges observable state from main.tsx into the Phaser FlappyScene and
 * forwards Phaser dispatch calls back to the blockchain layer.
 *
 * PlayStage provides only the app frame. Score, recovery actions, rules, and
 * leaderboard live inside the flight deck so the game does not feel like a form
 * with a canvas preview.
 */
import type * as Phaser from "phaser";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, Coins, RefreshCw, RotateCcw, ShieldCheck, Trophy, WalletCards, X } from "lucide-react";
import {
  DIFFICULTY_RULES,
  SETTLE_GRACE_MS,
  formatClock,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

const loadFlappyScene = () =>
  import("./scenes/FlappyScene").then((module) => module.FlappyScene);

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function gasAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(amount) >= 10 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function historyElapsed(row: SolveRow): number {
  const candidate = (row as { solveMs?: unknown; elapsedMs?: unknown }).solveMs
    ?? (row as { solveMs?: unknown; elapsedMs?: unknown }).elapsedMs;
  const value = Number(candidate ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function historyPipes(row: SolveRow): number {
  const value = Number((row as { pipes?: unknown }).pipes ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [a11yPrimaryPulse, setA11yPrimaryPulse] = useState(0);
  const [gameReady, setGameReady] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const difficultyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ── Observables ─────────────────────────────────────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const seed           = str("seed", "");
  const activeGameId   = str("activeGameId", "0");
  const gameDifficulty = clampDifficulty(Number(val<number>("gameDifficulty", 0) ?? 0));
  const commitment     = str("commitment", "");
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const pipesPassed    = val<number>("pipesPassed", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const creditGas      = Number(val<number>("credit", 0) ?? 0);
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const isRecovering   = bool("isRecovering");
  const lastPayout     = str("lastPayout", "");
  const myRank         = val<number>("myRank", 0) ?? 0;
  const myTotalWon     = Number(val<number>("myTotalWon", 0) ?? 0);
  const mySolves       = val<number>("mySolves", 0) ?? 0;
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const lastStatus     = str("lastStatus", "");
  const walletConnected = bool("walletConnected");
  const isConnectingWallet = bool("isConnectingWallet");
  const inputSyncFailed = bool("inputSyncFailed");
  // Play mode — guest hides GAS-at-stake / pool / reward framing and shows a
  // purely local ("practice") framing. GameFi copy is unchanged.
  const appMode        = str("appMode", "guest");
  const isGuest        = appMode === "guest";
  // Platform credits (Credits v2) — GameFi-only, hidden when the host injects
  // no credits config (dev/standalone) and always hidden in guest mode.
  const creditsAvailable = bool("creditsAvailable");
  const creditsBalance = val<number>("creditsBalance", -1) ?? -1;
  const creditsStale = bool("creditsStale");
  const creditsBusy = bool("creditsBusy");
  const creditsNeedsTopUp = bool("creditsNeedsTopUp");
  const creditsReviveEnabled = bool("creditsReviveEnabled");
  const creditsReviveCost = val<number>("creditsReviveCost", 5) ?? 5;
  const creditsBuyGas = val<number>("creditsBuyGas", 1) ?? 1;
  const creditsBuyCredits = val<number>("creditsBuyCredits", 50) ?? 50;
  const creditsRate = val<number>("creditsRate", 50) ?? 50;
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (gameStatus !== "dealt" && gameStatus !== "committed" && gameStatus !== "unknown") {
      return undefined;
    }
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [gameStatus, deadline]);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => drawerTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDrawer, drawerOpen]);

  const runAction = useCallback((action: string, args: Record<string, unknown> = {}) => {
    try {
      void Promise.resolve(dispatch(action, args)).catch(() => undefined);
    } catch {
      // The framework action wrapper already owns the localized error surface.
    }
  }, [dispatch]);

  const rule    = ruleOf(gameDifficulty);
  const nowMs   = clockNow;
  const isPlaying = gameStatus === "dealt";
  const isSolved  = gameStatus === "solved";
  const isExpired = gameStatus === "expired" || gameStatus === "refunded";
  const dealPending = gameStatus === "committed";
  const settlementPending = gameStatus === "unknown" && activeGameId !== "0";
  const remMs   = isPlaying && deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const canReleaseStuck =
    activeGameId !== "0"
    && deadline > 0
    && nowMs > deadline + SETTLE_GRACE_MS
    && (isPlaying || dealPending || settlementPending);
  const busy    = isStarting || isDealing || isSubmitting || isRecovering;
  const lobbyAvailable = ["idle", "solved", "expired", "refunded"].includes(gameStatus)
    && !busy;
  const drawerId = "flappy-ingame-drawer";
  // Credits UI gates: the chip needs only a configured host + GameFi mode;
  // the relaunch offer additionally needs a settled failed run AND a game
  // whose paid starts are currently enabled.
  const showCreditsChip = !isGuest && creditsAvailable;
  const showCreditsOffer = showCreditsChip && creditsReviveEnabled && isExpired;
  const creditsInsufficient = creditsNeedsTopUp
    || (creditsBalance >= 0 && creditsBalance < creditsReviveCost);
  const creditsBalanceDisplay = creditsBalance >= 0 ? String(creditsBalance) : "--";

  const difficultyOptions = DIFFICULTY_RULES.map((difficultyRule) => ({
    difficulty: difficultyRule.difficulty,
    label: t(`difficulty_${difficultyRule.key}`),
    detail: t("canvasRouteMeta", {
      gates: difficultyRule.targetPipes,
      pace: t(`routePace_${difficultyRule.key}`),
    }),
  }));

  const handleDifficultyKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (direction === 0 || !lobbyAvailable) return;
    event.preventDefault();
    const nextIndex = (index + direction + difficultyOptions.length) % difficultyOptions.length;
    const next = difficultyOptions[nextIndex];
    if (!next) return;
    difficultyRefs.current[nextIndex]?.focus();
    runAction("selectDifficulty", { difficulty: next.difficulty });
  };

  // ── Localized labels handed to the canvas ────────────────────────────────
  // The Phaser scene only sees the raw bridge snapshot, so every in-canvas
  // string is pre-resolved here through `t` and read back via this.str/val.
  // Templates keep their {placeholders}; the scene substitutes live values.
  const sceneLabels = {
    eyebrow:      t("canvasEyebrow"),
    heroTagline:  isGuest ? t("canvasGuestHeroTagline") : t("canvasHeroTagline"),
    title:        t("appEyebrow"),
    poolChip:     isGuest ? t("canvasGuestPoolChip") : t("canvasPoolChip"),
    awaitingPool: t("canvasAwaitingPool"),
    launch:       t("canvasLaunch"),
    guestLaunch:  t("canvasGuestLaunch"),
    payAndLaunch: t("canvasPayAndLaunch"),
    connectWallet: t("canvasConnectWallet"),
    connectingWallet: t("canvasConnectingWallet"),
    lobbyHint:    isGuest ? t("canvasGuestLobbyHint") : t("canvasGameFiLobbyHint"),
    launching:    t("canvasLaunching"),
    flyAgain:     t("canvasFlyAgain"),
    retryRun:     t("canvasRetryRun"),
    tapTitle:     t("canvasTapTitle"),
    tapHint:      t("canvasTapHint"),
    sealingTitle: t("canvasSealingTitle"),
    sealingHint:  t("canvasSealingHint"),
    settlementTitle: t("canvasSettlementTitle"),
    settlementHint:  t("canvasSettlementHint"),
    winTitle:     t("canvasWinTitle"),
    crashTitle:   t("canvasCrashTitle"),
    timeUpTitle:  t("canvasTimeUpTitle"),
    winBody:      isGuest ? t("canvasGuestWinBody") : t("canvasWinBody"),
    crashBody:    t("canvasCrashBody"),
    timeUpBody:   t("canvasTimeUpBody"),
    submitScore:  t("canvasSubmitScore"),
    saveScore:    t("canvasSaveScore"),
    settleRun:    t("canvasSettleRun"),
    submitting:   t("canvasSubmitting"),
    playAgain:    t("canvasPlayAgain"),
    backToLobby:  t("canvasBackToLobby"),
    tryAgain:     t("canvasTryAgain"),
    routes: DIFFICULTY_RULES.map((r) => ({
      title:     t("canvasRouteTitle", { name: t(`difficulty_${r.key}`) }),
      meta:      t("canvasRouteMeta", {
        gates: r.targetPipes,
        pace: t(`routePace_${r.key}`),
      }),
      cardName:  t(`difficulty_${r.key}`),
      cardGates: t("canvasCardGates", { gates: r.targetPipes }),
      entry:     isGuest ? t("canvasGuestEntry") : t("canvasEntry", { amount: gasDisplay(r.entryFixed8) }),
      reward:    isGuest
        ? t("canvasGuestRouteReward", { gates: r.targetPipes })
        : `${gasDisplay(r.rewardFixed8)} GAS`,
    })),
  };

  // ── Bridge state pushed into the Phaser scene ────────────────────────────
  const bridgeState = {
    appMode,
    gameStatus,
    seed,
    activeGameId,
    gameDifficulty,
    commitment,
    deadline,
    dealtAt,
    pipesPassed,
    poolFree,
    credit: creditGas,
    isStarting,
    isDealing,
    isSubmitting,
    isRecovering,
    walletConnected,
    isConnectingWallet,
    inputSyncFailed,
    a11yPrimaryPulse,
    lastPayout,
    myRank,
    myTotalWon,
    lastStatus,
    sceneLabels,
  };

  // ── PlayStage chrome ─────────────────────────────────────────────────────
  const stageTitle = (() => {
    if (isSubmitting) return t("statusSubmitting");
    if (settlementPending) return t("statusSettlementPending");
    if (isDealing || dealPending) return t("statusShuffling");
    if (isPlaying) return t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) });
    if (isSolved) return t("statusWonTitle");
    if (isExpired) return t("expiredBanner");
    return t("lobbyTitle");
  })();

  const hudItems = [
    {
      label: isGuest ? t("guestModeHudLabel") : t("scoreReward"),
      value: isGuest ? t("guestModeHudValue") : `${gasDisplay(rule.rewardFixed8)} GAS`,
      accent: true,
    },
    {
      label: t("scoreTime"),
      value: isPlaying ? formatClock(remMs) : formatClock(rule.limitMs),
    },
    {
      label: t("scorePipes"),
      value: `${pipesPassed}/${rule.targetPipes}`,
    },
  ];

  const drawerActions = [
    ...(settlementPending
      ? [
          {
            label:   isRecovering ? t("checkingSettlement") : t("checkSettlementAction"),
            onClick: () => runAction("refreshGame"),
            disabled: isRecovering,
            icon:    <RefreshCw size={16} aria-hidden="true" />,
            hint:    t("checkSettlementHint"),
          },
        ]
      : []),
    ...(dealPending && !isDealing
      ? [
          {
            label:   t("checkDealAgain"),
            onClick: () => runAction("retryDeal"),
            disabled: isDealing,
            icon:    <RefreshCw size={16} aria-hidden="true" />,
            hint:    t("statusDealPending"),
          },
        ]
      : []),
    ...(canReleaseStuck
      ? [
          {
            label:   t("releaseAction"),
            onClick: () => runAction("expireGame"),
            disabled: busy,
            icon:    <RotateCcw size={16} aria-hidden="true" />,
            hint:    t("releaseHint"),
          },
        ]
      : []),
  ];

  return (
    <div className="flappy-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="flappy-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestModeHudValue") : t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
              {!isGuest && creditGas > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {t("creditLabel")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="flappy-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadFlappyScene}
              state={bridgeState}
              dispatch={dispatch}
              className="flappy-phaser-canvas"
              ariaLabel={t("gameAriaLabel")}
              loadingLabel={t("gameLoadingLabel")}
              errorLabel={t("gameActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
              onReady={() => setGameReady(true)}
            />
            <div className="flappy-a11y-layer">
              {lobbyAvailable && (
                <>
                  <div
                    className="flappy-a11y-routes"
                    role="radiogroup"
                    aria-label={t("a11yDifficultyGroup")}
                  >
                    {difficultyOptions.map((option, index) => {
                      const selected = option.difficulty === gameDifficulty;
                      return (
                        <button
                          key={option.difficulty}
                          ref={(node) => {
                            difficultyRefs.current[index] = node;
                          }}
                          type="button"
                          role="radio"
                          className="flappy-a11y-hit flappy-a11y-route"
                          data-index={index}
                          aria-checked={selected}
                          aria-label={`${option.label}. ${option.detail}`}
                          tabIndex={selected ? 0 : -1}
                          disabled={!gameReady}
                          onClick={() => runAction("selectDifficulty", {
                            difficulty: option.difficulty,
                          })}
                          onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="flappy-a11y-hit flappy-a11y-start"
                    aria-label={`${t("a11yStartRoute")}: ${difficultyOptions[gameDifficulty]?.label ?? ""}`}
                    disabled={!gameReady}
                    onClick={() => setA11yPrimaryPulse((pulse) => pulse + 1)}
                  >
                    <span>{t("a11yStartRoute")}</span>
                  </button>
                </>
              )}
              {isPlaying && (
                <button
                  type="button"
                  className="flappy-a11y-hit flappy-a11y-flight"
                  aria-label={t("a11yFlyContinue")}
                  disabled={!gameReady || busy || (!isGuest && inputSyncFailed)}
                  onClick={() => setA11yPrimaryPulse((pulse) => pulse + 1)}
                >
                  <span>{t("a11yFlyContinue")}</span>
                </button>
              )}
            </div>
            <p className="flappy-a11y-status" aria-live="polite" aria-atomic="true">
              {`${stageTitle}. ${t("scorePipes")}: ${pipesPassed}/${rule.targetPipes}. ${t("scoreTime")}: ${isPlaying ? formatClock(remMs) : formatClock(rule.limitMs)}.`}
            </p>

            {showCreditsChip && (
              <button
                type="button"
                className="flappy-credits-chip"
                data-stale={creditsStale ? "true" : undefined}
                title={creditsStale ? t("creditsStaleHint") : t("creditsChipRefresh")}
                aria-label={`${t("creditsChipLabel")}: ${creditsBalanceDisplay}. ${t("creditsChipRefresh")}`}
                onClick={() => runAction("refreshCredits")}
              >
                <Coins size={14} aria-hidden="true" />
                <span>{t("creditsChipLabel")}</span>
                <strong>{creditsBalanceDisplay}</strong>
              </button>
            )}

            {showCreditsOffer && (
              <section className="flappy-credits-offer" aria-label={t("creditsOfferTitle")}>
                <h4>
                  <Coins size={15} aria-hidden="true" /> {t("creditsOfferTitle")}
                </h4>
                {creditsInsufficient ? (
                  <>
                    <p>{t("creditsInsufficientBody", { cost: creditsReviveCost, rate: creditsRate })}</p>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--primary flappy-credits-offer__buy"
                      disabled={creditsBusy}
                      onClick={() => runAction("buyCredits")}
                    >
                      {t("creditsBuyAction", { gas: creditsBuyGas, credits: creditsBuyCredits })}
                    </button>
                  </>
                ) : (
                  <>
                    <p>{t("creditsOfferBody", { cost: creditsReviveCost })}</p>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--primary flappy-credits-offer__retry"
                      disabled={creditsBusy}
                      onClick={() => runAction("retryWithCredits")}
                    >
                      {t("creditsOfferAction", { cost: creditsReviveCost })}
                    </button>
                  </>
                )}
                <p className="flappy-credits-offer__balance">
                  {t("creditsBalanceLine", { balance: creditsBalanceDisplay })}
                  {creditsStale && <em> · {t("creditsStaleTag")}</em>}
                </p>
              </section>
            )}
            <div className="flappy-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="flappy-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerTriggerRef}
                type="button"
                className="flappy-stage-hud__drawer"
                onClick={() => {
                  if (drawerOpen) closeDrawer();
                  else setDrawerOpen(true);
                }}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <>
                <button
                  type="button"
                  className="flappy-ingame-drawer__scrim"
                  aria-label={t("closeDrawer")}
                  tabIndex={-1}
                  onClick={() => closeDrawer()}
                />
              <section
                id={drawerId}
                className="flappy-ingame-drawer"
                aria-label={t("drawerTitle")}
                aria-modal="true"
                role="dialog"
              >
                <div className="flappy-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("fairnessShort")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="flappy-ingame-drawer__close"
                    aria-label={t("closeDrawer")}
                    onClick={() => closeDrawer()}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <section className="flappy-ingame-drawer__summary" aria-label={t("sidebarTitle")}>
                  <span>
                    <small>{isGuest ? t("guestPlayModeLabel") : t("scoreWon")}</small>
                    <strong>
                      {isGuest ? t("guestPlayModeValue") : `${gasAmountDisplay(myTotalWon)} GAS`}
                    </strong>
                  </span>
                  <span>
                    <small>{t("rankLabel")}</small>
                    <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                  </span>
                  <span>
                    <small>{t("solvesCount", { count: mySolves })}</small>
                    <strong>{mySolves}</strong>
                  </span>
                  <span>
                    <small>{isGuest ? t("guestModeHudLabel") : t("networkBadge")}</small>
                    <strong>{isGuest ? t("guestModeHudValue") : (activeGameId !== "0" ? `#${activeGameId}` : t("lobbyReady"))}</strong>
                  </span>
                </section>

                {drawerActions.length > 0 && (
                  <div className="flappy-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                        title={action.hint}
                        disabled={action.disabled}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flappy-drawer">
                  <div className="flappy-drawer__head">
                    <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
                  </div>

                  <section className="flappy-drawer__section" aria-label={t("leaderboardTitle")}>
                    <div className="flappy-drawer__section-head">
                      <h4>{t("leaderboardTitle")}</h4>
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost"
                        onClick={() => runAction("refreshLeaderboard")}
                        disabled={busy}
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        {t("refreshRanks")}
                      </button>
                    </div>
                    {leaderboard.length > 0 ? (
                      <ol className="flappy-ranks">
                        {leaderboard.slice(0, 10).map((entry) => (
                          <li
                            key={entry.address}
                            className="flappy-ranks__row"
                            data-me={entry.isUser ? "true" : undefined}
                          >
                            <span className="flappy-ranks__rank">#{entry.rank}</span>
                            <span className="flappy-ranks__addr">{shortHash(entry.address)}</span>
                            <span className="flappy-ranks__solves">
                              {t("solvesCount", { count: entry.solves })}
                            </span>
                            <span className="flappy-ranks__won">
                              {isGuest
                                ? t("historyPipes", { pipes: entry.totalWon })
                                : `${gasAmountDisplay(entry.totalWon)} GAS`}
                            </span>
                            {entry.isUser && (
                              <span className="flappy-ranks__me">{t("youTag")}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="flappy-drawer__empty">{t("leaderboardEmpty")}</p>
                    )}
                  </section>

                  <section className="flappy-drawer__section" aria-label={t("historyTitle")}>
                    <h4>{t("historyTitle")}</h4>
                    {myHistory.length > 0 ? (
                      <ul className="flappy-history">
                        {myHistory.slice(0, 8).map((row) => (
                          <li key={row.gameId} className="flappy-history__row">
                            <span>#{row.gameId}</span>
                            <span>{t(`difficulty_${ruleOf(Number(row.difficulty)).key}`)}</span>
                            <span>{formatClock(historyElapsed(row))}</span>
                            <span>{t("historyPipes", { pipes: historyPipes(row) })}</span>
                            <span className="flappy-history__won">{row.payout}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flappy-drawer__empty">{t("historyEmpty")}</p>
                    )}
                  </section>

                  <section className="flappy-drawer__section flappy-drawer__rules" aria-label={t("rulesTitle")}>
                    <h4>{t("rulesTitle")}</h4>
                    <p>{t("rulesCopy")}</p>
                  </section>

                  <section className="flappy-drawer__section flappy-drawer__fairness" aria-label={isGuest ? t("guestModeHudValue") : t("fairnessTitle")}>
                    <h4><ShieldCheck size={16} aria-hidden="true" /> {isGuest ? t("guestModeHudValue") : t("fairnessTitle")}</h4>
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("fairnessCopy")}</p>
                    <p className="flappy-drawer__status">{isGuest ? t("guestStatusReady") : t("rulesShort")}</p>
                    {!isGuest && activeGameId !== "0" && commitment && (
                      <p className="flappy-drawer__seed">
                        {t("commitmentLine", { gameId: activeGameId, commitment: shortHash(commitment) })}
                      </p>
                    )}
                    {lastStatus && <p className="flappy-drawer__status">{lastStatus}</p>}
                  </section>

                  {!isGuest && creditGas > 0 && (
                    <section className="flappy-drawer__credit" aria-label={t("withdrawTitle")}>
                      <span>
                        {t("creditLabel")}: <strong>{gasAmountDisplay(creditGas)} GAS</strong>
                        <em>{t("withdrawHint")}</em>
                      </span>
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost"
                        onClick={() => runAction("withdrawWinnings")}
                        disabled={busy}
                      >
                        <WalletCards size={16} aria-hidden="true" />
                        {t("withdrawAction", { amount: gasAmountDisplay(creditGas) })}
                      </button>
                    </section>
                  )}
                </div>
              </section>
              </>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
