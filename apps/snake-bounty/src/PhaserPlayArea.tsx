/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Snake Bounty miniapp.
 *
 * Replaces PlayArea.tsx when the Phaser renderer is active.
 * All blockchain / wallet / oracle logic stays in main.tsx; this component:
 *   1. Reads observable state and builds a flat bridge-state snapshot.
 *   2. Mounts <PhaserGameComponent> which injects that snapshot into the
 *      running SnakeScene via the GameBridge.
 *   3. Forwards SnakeScene dispatch calls back to main.tsx actions.
 *
 * Bridge state shape consumed by SnakeScene:
 *   gameStatus      string  — "idle"|"committed"|"dealt"|"solved"|"expired"
 *   clues           string  — JSON: { body, direction, food, foodQueue }
 *   gameDifficulty  number  — 0=easy, 1=medium, 2=hard
 *   deadline        number  — ms epoch deadline
 *   dealtAt         number  — ms epoch when game was dealt
 *   poolFree        number  — available reward pool (human GAS units)
 *   isStarting      boolean
 *   isDealing       boolean
 *   isSubmitting    boolean
 *   lastStatus      string
 *
 * Actions forwarded to main.tsx:
 *   "startGame"       { difficulty: number }
 *   "recordMove"      { dir: number }
 *   "submitSolution"  {}
 *   "expireGame"      {}
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import {
  ruleOf,
  formatClock,
  gasDisplay,
  canExpireAfterGrace,
} from "./logic/game-rules";
import type { Difficulty } from "./logic/game-rules";
import "./PhaserPlayArea.scss";

// ── Game config ───────────────────────────────────────────────────────────────

import type * as Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width:  440,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

const loadSnakeScene = () =>
  import("./scenes/SnakeScene").then((module) => module.SnakeScene);

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);

  // ── Observable bindings ───────────────────────────────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const clues          = str("clues", "");
  const gameDifficulty = (num("gameDifficulty") ?? 0) as Difficulty;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const lastStatus     = str("lastStatus", t("statusReady"));
  const walletConnected = bool("walletConnected");
  const creditGas      = val<number>("credit", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;
  const progressionReady = bool("progressionReady");
  const requiredDifficulty = val<number>("progressionRequiredDifficulty", 0) ?? 0;
  const activeGameId   = str("activeGameId", "0");
  const currentLength  = val<number>("currentLength", 3) ?? 3;
  const snakeDead      = bool("snakeDead");
  const inputSyncFailed = bool("inputSyncFailed");
  const isRecovering   = bool("isRecovering");
  const newPaidRunsEnabled = bool("newPaidRunsEnabled");
  const steerDirection = val<number>("steerDirection", -1) ?? -1;
  const steerNonce     = val<number>("steerNonce", 0) ?? 0;

  // ── Play mode (guest = plain local snake, no token/pool/reward) ────────────
  const appMode  = str("appMode", "guest");
  const isGuest  = appMode === "guest";

  const rule     = ruleOf(gameDifficulty);
  const clockNow = useNowMs(1000, {
    enabled: gameStatus === "dealt",
    resetKey: deadline,
  });
  const nowMs    = clockNow;
  const remainMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const busy     = isStarting || isDealing || isSubmitting || isRecovering;

  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    const focusable = () => Array.from(
      drawer?.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])") ?? [],
    );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        drawerToggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // ── Localized canvas strings (additive bridge payload) ────────────────────
  // Passed by reference into the scene (no serialization), so the SnakeScene can
  // render every user-visible label through the active locale via this.str/txt.
  // Templates keep their {placeholders}; the scene fills them with live values.
  const sceneText = useMemo(() => ({
    title: t("appEyebrow"),
    // Guest strings swap the reward/pool/TEE framing for local-play framing;
    // GameFi copy is unchanged.
    tagline: isGuest ? t("guestTagline") : t("sceneTagline"),
    howToTitle: t("howToTitle"),
    howToSteps: [t("howToStep1"), t("howToStep2"), t("howToStep3"), t("howToStep4")],
    chooseRoute: isGuest ? t("guestChooseRoute") : t("routeChooseHeading"),
    diffLabels: [t("diffEasyShort"), t("diffMediumShort"), t("diffHardShort")],
    paceLabels: [t("guestPaceEasy"), t("guestPaceMedium"), t("guestPaceHard")],
    targetCells: t("targetCells"),
    winLine: isGuest ? t("guestCardWin") : t("winAmount"),
    entryLine: isGuest ? t("guestCardEntry") : t("entryAmount"),
    cleared: t("routeClearedShort"),
    completed: t("routeCompletedShort"),
    lengthReadout: t("lengthReadout"),
    rewardBadge: isGuest ? t("guestRewardBadge") : t("rewardBadge"),
    controlsHint: t("controlsHintScene"),
    hintCrashed: t("hintCrashed"),
    hintStartMoving: t("hintStartMoving"),
    hintTimeUp: t("hintTimeUp"),
    hintClosingSoon: t("hintClosingSoon"),
    hintWaitSubmit: t("hintWaitSubmit"),
    hintTargetSubmit: t("hintTargetSubmit"),
    ovDealingTitle: t("ovDealingTitle"),
    ovDealingSub: t("ovDealingSub"),
    ovSubmittingTitle: t("ovSubmittingTitle"),
    ovSubmittingSub: t("ovSubmittingSub"),
    ovGameOverTitle: t("ovGameOverTitle"),
    ovGameOverSub: t("ovGameOverSub"),
    ovGameOverBtn: t("ovGameOverBtn"),
    // Guest crashes route to a local reset instead of an on-chain settle.
    ovGameOverGuestBtn: t("guestGameOverBtn"),
    ovTargetTitle: t("ovTargetTitle"),
    ovSubmitBtn: t("ovSubmitBtn"),
    ovWaitingBtn: t("ovWaitingBtn"),
    ovSolvedTitle: isGuest ? t("guestSolvedTitle") : t("ovSolvedTitle"),
    ovSolvedSub: isGuest ? t("guestSolvedSub") : t("ovSolvedSub"),
    ovExpiredTitle: t("ovExpiredTitle"),
    ovExpiredSub: t("ovExpiredSub"),
    ovPlayAgain: t("ovPlayAgainBtn"),
    ovRecoveringTitle: t("ovRecoveringTitle"),
    ovRecoveringSub: t("ovRecoveringSub"),
    ovSyncTitle: t("ovSyncTitle"),
    ovSyncSub: t("ovSyncSub"),
    ovBoardInvalidTitle: t("ovBoardInvalidTitle"),
    ovBoardInvalidSub: t("ovBoardInvalidSub"),
    ovPendingTitle: t("ovPendingTitle"),
    ovPendingSub: t("ovPendingSub"),
    ovRecoverBtn: t("ovRecoverBtn"),
    gateSubmitReady: isGuest ? t("guestGateReady") : t("gateSubmitReady"),
    guestTargetResolving: t("guestTargetResolving"),
    gateTooClose: t("gateTooClose"),
    gateUnlockChecking: t("gateUnlockChecking"),
    gateUnlockIn: t("gateUnlockIn"),
    lobbyPreparing: t("lobbyPreparing"),
    lobbyConnectWallet: t("lobbyConnectWallet"),
    lobbyCheckingHistory: t("lobbyCheckingHistory"),
    lobbyRouteCleared: t("progressionCleared"),
    lobbyTapToStart: t("lobbyTapToStart"),
    lobbyPoolLow: t("lobbyPoolLow"),
    paidModeLocked: t("paidModeLocked"),
    // Guest lobby: one local-run status line (no wallet/pool/progression gating).
    guestLobbyStatus: t("guestLobbyStatus"),
  }), [isGuest, t]);

  // ── Bridge state snapshot (plain object pushed into the Phaser scene) ─────
  const bridgeState = useMemo(() => ({
    appMode,
    activeGameId,
    gameStatus,
    clues,
    gameDifficulty,
    deadline,
    dealtAt,
    poolFree,
    credit: creditGas,
    isStarting,
    isDealing,
    isSubmitting,
    isRecovering,
    uiPaused: drawerOpen,
    inputSyncFailed,
    newPaidRunsEnabled,
    currentLength,
    steerDirection,
    steerNonce,
    lastStatus,
    walletConnected,
    progressionReady,
    progressionRequiredDifficulty: requiredDifficulty,
    sceneText,
  }), [
    activeGameId,
    appMode,
    clues,
    creditGas,
    currentLength,
    deadline,
    dealtAt,
    gameDifficulty,
    gameStatus,
    inputSyncFailed,
    isDealing,
    isRecovering,
    isStarting,
    isSubmitting,
    lastStatus,
    newPaidRunsEnabled,
    poolFree,
    progressionReady,
    requiredDifficulty,
    sceneText,
    steerDirection,
    steerNonce,
    drawerOpen,
    walletConnected,
  ]);

  // ── Dispatch forwarding ───────────────────────────────────────────────────
  const handleDispatch = useCallback(
    (action: string, ...args: unknown[]) => (
      args.length > 0
        ? dispatch(action, args[0] as Record<string, unknown>)
        : dispatch(action)
    ),
    [dispatch],
  );

  // ── Stage title ───────────────────────────────────────────────────────────
  const stageTitle =
    isDealing || gameStatus === "committed" ? t("statusStarted")
    : gameStatus === "dealt"               ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
    : gameStatus === "solved"              ? t("statusWonTitle")
    : gameStatus === "expired"             ? t("expiredBanner")
    : t("lobbyTitle");

  // ── Route and recovery status ─────────────────────────────────────────────
  const routeLocked = progressionReady && gameDifficulty < requiredDifficulty;
  const timeUp    = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;

  // ── Secondary actions ─────────────────────────────────────────────────────
  const drawerActions = [
    ...(["committed", "unknown"].includes(gameStatus) || inputSyncFailed
      ? [{
          label:   gameStatus === "committed" ? t("checkDealAgain") : t("ovRecoverBtn"),
          icon:    <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch(gameStatus === "committed" ? "retryDeal" : "recoverGame", {}); },
        }]
      : []),
    ...(!isGuest && activeGameId !== "0" && canExpireAfterGrace(deadline)
      ? [{
          label:   t("releaseAction"),
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("expireGame", {}); },
        }]
      : []),
    ...(!isGuest && creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon:    <WalletCards size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("withdrawWinnings", {}); },
        }]
      : []),
  ];

  const routeStatus = !progressionReady
    ? t("progressionUnavailableShort")
    : routeLocked
      ? t("progressionNextRoute", { difficulty: t(`difficulty_${ruleOf(requiredDifficulty).key}`) })
      : t(`difficulty_${rule.key}`);
  // Guest shows local metrics (trail target, live clock, best length) with no
  // GAS-at-stake / reward framing; GameFi keeps its reward + total-won strip.
  const hudItems = isGuest
    ? [
        {
          label: t("scoreLength"),
          value: `${currentLength} / ${rule.targetLength}`,
          accent: true,
        },
        {
          label: t("timeMetric"),
          value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs),
          accent: timeUp,
        },
        {
          label: t("guestBestMetric"),
          value: myTotalWon > 0 ? t("guestCells", { count: myTotalWon }) : "--",
          accent: false,
        },
      ]
    : [
        {
          label: t("rewardMetric"),
          value: `${gasDisplay(rule.rewardFixed8)} GAS`,
          accent: true,
        },
        {
          label: t("timeMetric"),
          value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs),
          accent: timeUp,
        },
        {
          label: t("wonMetric"),
          value: `${myTotalWon.toFixed(2)} GAS`,
          accent: false,
        },
      ];

  // In-stage drawer summary — guest drops the credit / reward-at-stake columns
  // for local trail + best-length readouts; GameFi keeps the GAS economy.
  const drawerStats = isGuest
    ? [
        { label: t("guestTargetMetric"), value: t("guestCells", { count: rule.targetLength }) },
        { label: t("guestBestLabel"), value: myTotalWon > 0 ? t("guestCells", { count: myTotalWon }) : "--" },
      ]
    : [
        { label: t("progressionStatusLabel"), value: routeStatus },
        { label: t("creditLabel"), value: `${creditGas.toFixed(2)} GAS` },
        { label: t("scoreReward"), value: `${gasDisplay(rule.rewardFixed8)} GAS` },
        { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
      ];

  return (
    <div className="snake-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="snake-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestModeLine") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {isGuest ? t("guestRewardBadge") : t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="snake-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadSnakeScene}
              state={bridgeState}
              dispatch={handleDispatch}
              className="snake-phaser-canvas"
              ariaLabel={t("gameAriaLabel")}
              loadingLabel={t("gameLoadingLabel")}
            />
            {gameStatus === "dealt" && !timeUp && !snakeDead && currentLength < rule.targetLength && !inputSyncFailed && (
              <div className="snake-touch-controls" role="group" aria-label={t("touchControlsLabel")}>
                {[
                  { dir: 0, label: t("directionUp"), icon: <ArrowUp aria-hidden="true" /> },
                  { dir: 3, label: t("directionLeft"), icon: <ArrowLeft aria-hidden="true" /> },
                  { dir: 2, label: t("directionDown"), icon: <ArrowDown aria-hidden="true" /> },
                  { dir: 1, label: t("directionRight"), icon: <ArrowRight aria-hidden="true" /> },
                ].map((control) => (
                  <button
                    key={control.dir}
                    type="button"
                    data-dir={control.dir}
                    aria-label={control.label}
                    onClick={() => { void dispatch("steerSnake", { dir: control.dir }); }}
                  >
                    {control.icon}
                  </button>
                ))}
              </div>
            )}
            {gameStatus === "dealt" && (snakeDead || timeUp || (!isGuest && currentLength >= rule.targetLength)) && (
              <button
                type="button"
                className="snake-run-action"
                onClick={() => {
                  if (snakeDead || timeUp) void dispatch(isGuest ? "expireGame" : "recoverGame", {});
                  else void dispatch("submitSolution", {});
                }}
              >
                {snakeDead || timeUp ? t("guestGameOverBtn") : t("ovSubmitBtn")}
              </button>
            )}
            <p className="snake-sr-status" aria-live="polite">{lastStatus}</p>
            <div className="snake-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="snake-stage-hud__metric"
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
                className="snake-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <div
                className="snake-ingame-scrim"
                onMouseDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  setDrawerOpen(false);
                  drawerToggleRef.current?.focus();
                }}
              >
                <section
                  ref={drawerRef}
                  className="snake-ingame-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("drawerTitle")}
                >
                  <button
                    type="button"
                    className="snake-ingame-drawer__close"
                    aria-label={t("closeDrawer")}
                    onClick={() => {
                      setDrawerOpen(false);
                      drawerToggleRef.current?.focus();
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                  <div className="snake-ingame-drawer__head">
                    <Trophy size={18} aria-hidden="true" />
                    <div>
                      <h3>{t("drawerTitle")}</h3>
                      <p>{isGuest ? t("guestModeLine") : t("fairnessShort")}</p>
                    </div>
                  </div>
                  <div className="snake-ingame-drawer__grid">
                    {drawerStats.map((stat) => (
                      <span key={stat.label}>
                        <small>{stat.label}</small>
                        <strong>{stat.value}</strong>
                      </span>
                    ))}
                  </div>
                  {drawerActions.length > 0 && (
                    <div className="snake-ingame-drawer__actions">
                      {drawerActions.map((action) => (
                        <button type="button" key={action.label} onClick={action.onClick}>
                          {action.icon}
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="snake-ingame-drawer__fairness">
                    <ShieldCheck size={17} aria-hidden="true" />
                    <p>{t("rulesShort")}</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
