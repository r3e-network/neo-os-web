/** Phaser 3 bridge and accessible shell for Curve Arrow. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import {
  canExpireAfterGrace,
  formatClock,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import type { Difficulty } from "./logic/game-rules";
import { ARROW_BUDGETS } from "./logic/arrow-engine";
import "./PlayArea.scss";

import type * as Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 440,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

const loadCurveArrowScene = () =>
  import("./scenes/CurveArrowScene").then((module) => module.CurveArrowScene);

const DIFFICULTIES = [0, 1, 2] as const satisfies readonly Difficulty[];
const DIFFICULTY_SHORT_KEYS = ["diffEasyShort", "diffMediumShort", "diffHardShort"] as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const controlPressedRef = useRef(false);

  const gameStatus = str("gameStatus", "idle");
  const clues = str("clues", "");
  const gameDifficulty = (num("gameDifficulty") ?? 0) as Difficulty;
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const creditGas = val<number>("credit", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myRank = val<number>("myRank", 0) ?? 0;
  const levelsCleared = val<number>("levelsCleared", 0) ?? 0;
  const arrowsUsed = val<number>("arrowsUsed", 0) ?? 0;
  const activeGameId = str("activeGameId", "0");
  const shotHistory = str("shotHistory", "[]");
  const lastStatus = str("lastStatus", t("statusReady"));
  const appMode = str("appMode", "guest");
  const controlPressNonce = val<number>("controlPressNonce", 0) ?? 0;
  const controlHeld = bool("controlHeld");
  const requiredDifficulty = val<number>("progressionRequiredDifficulty", 0) ?? 0;
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isRecovering = bool("isRecovering");
  const inputSyncPending = bool("inputSyncPending");
  const inputSyncFailed = bool("inputSyncFailed");
  const runDone = bool("runDone");
  const runWon = bool("runWon");
  const walletConnected = bool("walletConnected");
  const progressionReady = bool("progressionReady");
  const newPaidRunsEnabled = bool("newPaidRunsEnabled");
  const isGuest = appMode === "guest";

  const rule = ruleOf(gameDifficulty);
  const clockNow = useNowMs(1000, {
    enabled: gameStatus === "dealt",
    resetKey: deadline,
  });
  const remainMs = deadline > 0 ? Math.max(0, deadline - clockNow) : 0;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;
  const busy = isStarting || isDealing || isSubmitting || isRecovering;
  const canControl = gameStatus === "dealt" && !timeUp && !runDone && !inputSyncFailed;

  useEffect(() => {
    if (!drawerOpen) return;
    const focusable = () => Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], [tabindex]:not([tabindex='-1'])",
      ) ?? [],
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

  useEffect(() => () => {
    if (controlPressedRef.current) void dispatch("releaseControl", {});
  }, [dispatch]);

  const sceneText = useMemo(() => ({
    title: t("appEyebrow"),
    tagline: isGuest ? t("guestTagline") : t("sceneTagline"),
    howToTitle: t("howToTitle"),
    howToSteps: [t("howToStep1"), t("howToStep2"), t("howToStep3"), t("howToStep4")],
    diffLabels: [t("diffEasyShort"), t("diffMediumShort"), t("diffHardShort")],
    targetCount: t("sceneTargetCount"),
    freePlay: t("sceneFreePlay"),
    completed: t("sceneCompleted"),
    preparing: t("scenePreparing"),
    guestLobbyStatus: t("guestLobbyStatus"),
    paidModeLocked: t("paidModeLocked"),
    targetReadout: t("sceneTargetReadout"),
    arrowsReadout: t("sceneArrowsReadout"),
    shoot: t("sceneShoot"),
    holdToCurve: t("sceneHoldToCurve"),
    controlsHint: t("sceneControlsHint"),
    hintOutOfArrows: t("hintOutOfArrows"),
    hintTimeUp: t("hintTimeUp"),
    hintClosingSoon: t("hintClosingSoon"),
    hintWaitSubmit: t("hintWaitSubmit"),
    hintSubmit: t("hintSubmit"),
    hintFlight: t("hintFlight"),
    bullseye: t("sceneBullseye"),
    innerRing: t("sceneInnerRing"),
    onTarget: t("sceneOnTarget"),
    ovDealingTitle: t("ovDealingTitle"),
    ovDealingSub: t("ovDealingSub"),
    ovSubmittingTitle: t("ovSubmittingTitle"),
    ovSubmittingSub: t("ovSubmittingSub"),
    ovOutTitle: t("ovOutTitle"),
    ovOutSub: t("ovOutSub"),
    ovScoreBtn: t("ovScoreBtn"),
    ovSettleBtn: t("ovSettleBtn"),
    ovClearedTitle: t("ovClearedTitle"),
    ovSaveBtn: t("ovSaveBtn"),
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
    ovPendingTitle: t("ovPendingTitle"),
    ovPendingSub: t("ovPendingSub"),
    ovRecoverBtn: t("ovRecoverBtn"),
    ovTimeTitle: t("ovTimeTitle"),
    ovTimeSub: t("ovTimeSub"),
    ovEndRunBtn: t("ovEndRunBtn"),
    gateSubmitReady: isGuest ? t("guestGateReady") : t("gateSubmitReady"),
    gateTooClose: t("gateTooClose"),
    gateUnlockChecking: t("gateUnlockChecking"),
    gateUnlockIn: t("gateUnlockIn"),
  }), [isGuest, t]);

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
    inputSyncPending,
    inputSyncFailed,
    newPaidRunsEnabled,
    levelsCleared,
    arrowsUsed,
    runDone,
    runWon,
    shotHistory,
    controlHeld,
    controlPressNonce,
    lastStatus,
    walletConnected,
    progressionReady,
    progressionRequiredDifficulty: requiredDifficulty,
    sceneText,
  }), [
    activeGameId,
    appMode,
    arrowsUsed,
    clues,
    controlHeld,
    controlPressNonce,
    creditGas,
    deadline,
    dealtAt,
    gameDifficulty,
    gameStatus,
    inputSyncFailed,
    inputSyncPending,
    isDealing,
    isRecovering,
    isStarting,
    isSubmitting,
    lastStatus,
    levelsCleared,
    newPaidRunsEnabled,
    poolFree,
    progressionReady,
    requiredDifficulty,
    runDone,
    runWon,
    shotHistory,
    sceneText,
    walletConnected,
  ]);

  const handleDispatch = useCallback(
    (action: string, ...args: unknown[]) => args.length > 0
      ? dispatch(action, args[0] as Record<string, unknown>)
      : dispatch(action),
    [dispatch],
  );

  const pressControl = useCallback(() => {
    if (!canControl || controlPressedRef.current) return;
    controlPressedRef.current = true;
    void dispatch("pressControl", {});
  }, [canControl, dispatch]);

  const releaseControl = useCallback(() => {
    if (!controlPressedRef.current) return;
    controlPressedRef.current = false;
    void dispatch("releaseControl", {});
  }, [dispatch]);

  const stageTitle =
    isDealing || gameStatus === "committed" ? t("statusStarted")
      : gameStatus === "dealt" ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
        : gameStatus === "solved" ? t("statusWonTitle")
          : gameStatus === "expired" ? t("expiredBanner")
            : gameStatus === "unknown" ? t("ovPendingTitle")
              : t("lobbyTitle");

  const routeLocked = progressionReady && gameDifficulty < requiredDifficulty;
  const routeStatus = !progressionReady
    ? t("progressionUnavailableShort")
    : routeLocked
      ? t("progressionNextRoute", { difficulty: t(`difficulty_${ruleOf(requiredDifficulty).key}`) })
      : t(`difficulty_${rule.key}`);

  const canStartDifficulty = (difficulty: Difficulty): boolean => {
    if (busy || (progressionReady && difficulty < requiredDifficulty)) return false;
    if (isGuest) return true;
    const routeRule = ruleOf(difficulty);
    return newPaidRunsEnabled && walletConnected && progressionReady &&
      poolFree >= Number(gasDisplay(routeRule.rewardFixed8));
  };

  const drawerActions = [
    ...(["committed", "unknown"].includes(gameStatus) || inputSyncFailed
      ? [{
          label: gameStatus === "committed" ? t("checkDealAgain") : t("ovRecoverBtn"),
          icon: <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch(gameStatus === "committed" ? "retryDeal" : "recoverGame", {}); },
        }]
      : []),
    ...(!isGuest && activeGameId !== "0" && canExpireAfterGrace(deadline)
      ? [{
          label: t("releaseAction"),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("expireGame", {}); },
        }]
      : []),
    ...(!isGuest && creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon: <WalletCards size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("withdrawWinnings", {}); },
        }]
      : []),
  ];

  const hudItems = isGuest
    ? [
        { label: t("scoreLevels"), value: `${levelsCleared} / ${rule.targetLevels}`, accent: true },
        { label: t("timeMetric"), value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs), accent: timeUp },
        { label: t("guestBestMetric"), value: `${Math.round(myTotalWon)}`, accent: false },
      ]
    : [
        { label: t("rewardMetric"), value: `${gasDisplay(rule.rewardFixed8)} GAS`, accent: true },
        { label: t("timeMetric"), value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs), accent: timeUp },
        { label: t("wonMetric"), value: `${myTotalWon.toFixed(2)} GAS`, accent: false },
      ];

  const drawerCells = isGuest
    ? [
        { label: t("guestModeLabel"), value: t("guestLocalRun") },
        { label: t("guestBestMetric"), value: `${Math.round(myTotalWon)}` },
        { label: t("scoreLevels"), value: `${levelsCleared} / ${rule.targetLevels}` },
        { label: t("arrowsLabel"), value: `${Math.max(0, ARROW_BUDGETS[gameDifficulty] - arrowsUsed)}` },
      ]
    : [
        { label: t("progressionStatusLabel"), value: routeStatus },
        { label: t("creditLabel"), value: `${creditGas.toFixed(2)} GAS` },
        { label: t("scoreReward"), value: `${gasDisplay(rule.rewardFixed8)} GAS` },
        { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
      ];

  const needsRecoveryAction = inputSyncFailed || gameStatus === "unknown";
  const runAction = needsRecoveryAction
    ? { label: t("ovRecoverBtn"), action: "recoverGame" }
    : timeUp
      ? { label: t("ovEndRunBtn"), action: isGuest ? "submitSolution" : "recoverGame" }
      : runDone
        ? { label: runWon ? t("ovSaveBtn") : t("ovScoreBtn"), action: "submitSolution" }
        : ["solved", "expired", "refunded"].includes(gameStatus)
          ? { label: t("ovPlayAgainBtn"), action: "returnToLobby" }
          : null;

  return (
    <div className="curve-arrow-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="curve-arrow-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: isGuest ? t("guestModeLine") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {isGuest ? t("guestBadge") : t("networkBadge")}
              </span>
              {myRank > 0 && <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>}
            </>
          ),
        }}
        scene={(
          <div className="curve-arrow-stage-shell">
            <div className="curve-arrow-canvas-wrap">
              <PhaserGameComponent
                config={GAME_CONFIG}
                loadScene={loadCurveArrowScene}
                state={bridgeState}
                dispatch={handleDispatch}
                className="curve-arrow-phaser-canvas"
                ariaLabel={t("gameAriaLabel")}
                loadingLabel={t("gameLoadingLabel")}
              />
              {gameStatus === "idle" && (
                <div
                  className="curve-arrow-route-controls"
                  role="group"
                  aria-label={t("difficultyTitle")}
                >
                  {DIFFICULTIES.map((difficulty) => {
                    const optionRule = ruleOf(difficulty);
                    const label = t("lobbyPreviewLabel", {
                      difficulty: t(DIFFICULTY_SHORT_KEYS[difficulty]),
                      target: optionRule.targetLevels,
                    });
                    return (
                      <button
                        key={difficulty}
                        type="button"
                        aria-label={label}
                        disabled={!canStartDifficulty(difficulty)}
                        onClick={() => {
                          void dispatch("selectDifficulty", { difficulty });
                          void dispatch("startGame", { difficulty });
                        }}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {canControl && (
                <button
                  type="button"
                  className="curve-arrow-hold-control"
                  aria-label={t("holdControlAria")}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pressControl();
                  }}
                  onPointerUp={releaseControl}
                  onPointerCancel={releaseControl}
                  onLostPointerCapture={releaseControl}
                  onBlur={releaseControl}
                  onKeyDown={(event) => {
                    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                      event.preventDefault();
                      pressControl();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      releaseControl();
                    }
                  }}
                >
                  <span>{controlHeld ? t("sceneHoldToCurve") : t("sceneShoot")}</span>
                  <small>{t("holdControlHint")}</small>
                </button>
              )}
              {runAction && (
                <button
                  type="button"
                  className="curve-arrow-run-action"
                  onClick={() => { void dispatch(runAction.action, {}); }}
                >
                  {runAction.label}
                </button>
              )}
              {inputSyncPending && <p className="curve-arrow-sync-pill">{t("syncingShot")}</p>}
            </div>
            <p className="curve-arrow-sr-status" aria-live="polite">{lastStatus}</p>
            <div className="curve-arrow-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="curve-arrow-stage-hud__metric"
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
                className="curve-arrow-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section
                ref={drawerRef}
                className="curve-arrow-ingame-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("drawerTitle")}
              >
                <button
                  type="button"
                  className="curve-arrow-ingame-drawer__close"
                  aria-label={t("closeDrawer")}
                  onClick={() => {
                    setDrawerOpen(false);
                    drawerToggleRef.current?.focus();
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <div className="curve-arrow-ingame-drawer__head">
                  <img
                    className="curve-arrow-ingame-drawer__medal"
                    src="./art/reward-medal.webp"
                    alt=""
                    aria-hidden="true"
                  />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{isGuest ? t("guestModeLine") : t("fairnessShort")}</p>
                  </div>
                </div>
                <div className="curve-arrow-ingame-drawer__grid">
                  {drawerCells.map((cell) => (
                    <span key={cell.label}>
                      <small>{cell.label}</small>
                      <strong>{cell.value}</strong>
                    </span>
                  ))}
                </div>
                {drawerActions.length > 0 && (
                  <div className="curve-arrow-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="curve-arrow-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{t("rulesShort")}</p>
                </div>
              </section>
            )}
          </div>
        )}
        actions={{}}
      />
    </div>
  );
}
