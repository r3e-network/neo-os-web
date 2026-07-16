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
import { Activity, ChevronDown, HeartPulse, RefreshCw, ShieldCheck, Trophy, WalletCards, X } from "lucide-react";
import {
  ACTION_NAMES,
  formatClock,
  gasDisplay,
  MAX_MOVES,
  recipeReady,
  ruleOf,
  SETTLEMENT_GRACE_MS,
  type IngredientCounts,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 420,
  height: 580,
  transparent: true,
  backgroundColor: "transparent",
};
const loadPetPotionScene = () =>
  import("./scenes/PetPotionScene").then((module) => module.PetPotionScene);
const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

function ruleFor(difficulty: number) {
  try {
    return ruleOf(difficulty);
  } catch {
    return ruleOf(0);
  }
}

function difficultyKey(difficulty: number): (typeof DIFFICULTY_KEYS)[number] {
  return DIFFICULTY_KEYS[difficulty] ?? "easy";
}

function difficultyLabel(t: PlayAreaProps["t"], difficulty: number): string {
  return t(`difficulty_${difficultyKey(difficulty)}`);
}

function actionLabel(t: PlayAreaProps["t"], action: string): string {
  switch (action) {
    case "feed": return t("actionFeed");
    case "play": return t("actionPlay");
    case "pet": return t("actionPet");
    case "rest": return t("actionRest");
    default: return action;
  }
}

function gasLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

function fixed8Label(value: bigint | number): string {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return `${(Number.isFinite(numeric) ? numeric / 1e8 : 0).toFixed(2)} GAS`;
}

function shortHash(value: string, head = 8, tail = 6): string {
  if (!value) return "--";
  return value.length > head + tail + 1 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

function historyPayout(row: SolveRow): string {
  return typeof row.payout === "string" ? row.payout : String(row.payout ?? "0 GAS");
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const difficultyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = num("gameDifficulty");
  const activeGameId = str("activeGameId", "0");
  const deadline = val<number>("deadline", 0) ?? 0;
  const commitment = str("commitment", "");
  const credit = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const actionsUsed = val<number>("actionsUsed", 0) ?? 0;
  const happinessAchieved = val<number>("happinessAchieved", 0) ?? 0;
  const petHappiness = val<number>("petHappiness", 50) ?? 50;
  const petHunger = val<number>("petHunger", 50) ?? 50;
  const petEnergy = val<number>("petEnergy", 50) ?? 50;
  const petStage = val<number>("petStage", 0) ?? 0;
  const actionHistory = val<string[]>("actionHistory", []) ?? [];
  const ingredientCounts = val<IngredientCounts>("ingredientCounts", {
    feed: 0, play: 0, pet: 0, rest: 0,
  }) ?? { feed: 0, play: 0, pet: 0, rest: 0 };
  const potionBrewed = bool("potionBrewed");
  const lastElapsedMs = val<number>("lastElapsedMs", 0) ?? 0;
  const lastPayoutFixed8 = val<bigint>("lastPayoutFixed8", 0n) ?? 0n;
  const lastStatus = str("lastStatus", "");
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isActing = bool("isActing");
  const isRecovering = bool("isRecovering");
  const isConnectingWallet = bool("isConnectingWallet");
  const walletConnected = bool("walletConnected");
  const inputSyncFailed = bool("inputSyncFailed");
  const newPaidRunsEnabled = bool("newPaidRunsEnabled");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const appMode = str("appMode", "guest");
  const isGuest = appMode === "guest";

  const rule = ruleFor(gameDifficulty);
  const isPlaying = gameStatus === "dealt";
  const isSolved = gameStatus === "solved";
  const isExpired = gameStatus === "expired" || gameStatus === "refunded";
  const isPending = gameStatus === "unknown";
  const busy = isStarting || isDealing || isSubmitting || isActing || isRecovering || isConnectingWallet;
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;
  const releaseAt = deadline > 0 ? deadline + SETTLEMENT_GRACE_MS : 0;
  const releaseInMs = releaseAt > 0 ? Math.max(0, releaseAt - nowMs) : 0;
  const currentHappiness = Math.max(happinessAchieved, petHappiness);
  const targetReached = isPlaying && currentHappiness >= rule.targetHappiness;
  const recipeComplete = !isGuest || recipeReady(ingredientCounts);
  const moveCapReached = actionsUsed >= MAX_MOVES;
  const lobbyAvailable = ["idle", "solved", "expired", "refunded"].includes(gameStatus) && !busy;
  // Fleet gate (restored from the deleted DOM PlayArea): a paid run must never
  // start while the reward pool cannot cover the payout. Guest play is a free
  // local game and stays exempt. `rule.reward` is Fixed8, poolFree human GAS.
  const rewardPoolReady = isGuest || poolFree >= rule.reward / 1e8;
  const careActionsOpen = isPlaying && !busy && !timeUp && !potionBrewed &&
    (!targetReached || !recipeComplete) && actionsUsed < MAX_MOVES && !inputSyncFailed;

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => drawerTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawerRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawerRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onEscape);
    window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeDrawer, drawerOpen]);

  const runAction = useCallback((action: string, args?: unknown) => {
    try {
      const pending = args === undefined ? dispatch(action) : dispatch(action, args);
      void Promise.resolve(pending).catch(() => undefined);
    } catch {
      // Framework action notifications own the localized error surface.
    }
  }, [dispatch]);

  const difficultyOptions = DIFFICULTY_KEYS.map((key, difficulty) => ({
    difficulty,
    label: t(`difficulty_${key}`),
    detail: t("a11yDifficultyDetail", { happiness: ruleFor(difficulty).targetHappiness }),
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

  const needsWalletReconnect = !isGuest && !walletConnected && (
    inputSyncFailed || gameStatus === "committed" || isPending || isPlaying
  );
  const semanticPrimaryLabel = needsWalletReconnect
    ? t("sceneConnectWallet")
    : inputSyncFailed
      ? t("a11yRecoverRun")
    : gameStatus === "committed"
      ? t("sceneRetrySealing")
      : isPending
        ? t("sceneCheckSettlement")
        : isPlaying
          ? timeUp
            ? t("sceneSettleRun")
            : moveCapReached
              ? t("sceneSettleRun")
            : !potionBrewed
              ? t("brewPotionAction")
              : t("sceneSaveScore")
          // Pool-low copy outranks the lobby launch labels (flappy-dash
          // order): the disabled start must say why, not silently eat clicks.
          : !isGuest && !rewardPoolReady
            ? t("statusPoolLow")
          : !isGuest && !walletConnected
            ? t("sceneConnectWallet")
            : isGuest
              ? t("startAction")
              : t("paidRunsUnavailableShort");
  const semanticPrimaryEnabled = gameReady && !busy && (
    inputSyncFailed ||
    gameStatus === "committed" ||
    isPending ||
    (isPlaying && (timeUp || moveCapReached || potionBrewed || (targetReached && recipeComplete))) ||
    (lobbyAvailable && (isGuest || (rewardPoolReady && (!walletConnected || newPaidRunsEnabled))))
  );

  const handleSemanticPrimary = () => {
    if (!semanticPrimaryEnabled) return;
    if (needsWalletReconnect) { runAction("connectWallet"); return; }
    if (inputSyncFailed || isPending) { runAction("recoverGame"); return; }
    if (gameStatus === "committed") { runAction("retryDeal"); return; }
    if (isPlaying) {
      if (timeUp || moveCapReached || potionBrewed) runAction("submitSolution");
      else runAction("brewPotion");
      return;
    }
    if (!isGuest && !rewardPoolReady) return;
    if (!isGuest && !walletConnected) { runAction("connectWallet"); return; }
    if (isGuest || newPaidRunsEnabled) runAction("startGame", gameDifficulty);
  };

  useEffect(() => {
    if (!isPlaying && !isPending && gameStatus !== "committed") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus, isPending, isPlaying]);

  const sceneText = {
    brand: t("sceneBrand"),
    titlePreparing: t("sceneTitlePreparing"),
    titleSealPending: t("sceneTitleSealPending"),
    titleSettlementPending: t("sceneTitleSettlementPending"),
    titleSolved: t("sceneTitleSolved"),
    titleClosed: t("sceneTitleClosed"),
    titleTimedOut: t("sceneTitleTimedOut"),
    titlePlaying: t("sceneTitlePlaying"),
    titleLobby: t("sceneTitleLobby"),
    subtitleSealPending: t("sceneSubtitleSealPending"),
    subtitleSettlementPending: t("sceneSubtitleSettlementPending"),
    subtitlePath: t("sceneSubtitlePath"),
    subtitleGuestPath: t("sceneSubtitleGuestPath"),
    subtitleGameFiPath: t("sceneSubtitleGameFiPath"),
    pathEasy: t("scenePathEasy"),
    pathMedium: t("scenePathMedium"),
    pathHard: t("scenePathHard"),
    actionFeed: t("actionFeed"),
    actionPlay: t("actionPlay"),
    actionPet: t("actionPet"),
    actionRest: t("actionRest"),
    statHappy: t("statHappiness"),
    statFed: t("sceneStatFed"),
    statEnergy: t("statEnergy"),
    statSealed: t("statSealed"),
    stageEgg: t("sceneStageEgg"),
    stageResting: t("sceneStageResting"),
    stageBaby: t("stage_baby"),
    stageTeen: t("stage_child"),
    stageAdult: t("stage_adult"),
    goalProgress: t("sceneGoalProgress"),
    careGoal: t("lobbyCareGoal"),
    freePlay: t("guestRunValue"),
    connectWallet: t("sceneConnectWallet"),
    connectingWallet: t("sceneConnectingWallet"),
    beginCare: t("startAction"),
    working: t("sceneWorking"),
    settleRun: t("sceneSettleRun"),
    saveScore: t("sceneSaveScore"),
    claimReward: t("submitAction"),
    raiseAnother: t("sceneRaiseAnother"),
    tryAgain: t("sceneTryAgain"),
    retrySealing: t("sceneRetrySealing"),
    checkSettlement: t("sceneCheckSettlement"),
    releaseRun: t("sceneReleaseRun"),
    statusPreparingGuest: t("sceneStatusPreparingGuest"),
    statusPreparingGameFi: t("sceneStatusPreparingGameFi"),
    statusSealPending: t("sceneStatusSealPending"),
    statusSettlementPending: t("statusSettlementPending"),
    statusSolvedGuest: t("sceneStatusSolvedGuest"),
    statusSolvedGameFi: t("sceneStatusSolvedGameFi"),
    statusClosed: t("sceneStatusClosed"),
    statusTimeUp: t("sceneStatusTimeUp"),
    statusTargetGuest: t("sceneStatusTargetGuest"),
    statusTargetGameFi: t("sceneStatusTargetGameFi"),
    statusActionCount: t("actionsCounter"),
    statusReleaseCountdown: t("sceneStatusReleaseCountdown"),
    statusReleaseReady: t("sceneStatusReleaseReady"),
    potionReady: t("scenePotionReady"),
    brewPotion: t("brewPotionAction"),
    paidLocked: t("paidRunsUnavailableShort"),
    statusRecipeMissing: t("sceneStatusRecipeMissing"),
    statusPotionBrewed: t("sceneStatusPotionBrewed"),
    statusInputSyncFailed: t("statusInputSyncFailed"),
    statusReconnectWallet: t("sceneStatusReconnectWallet"),
    statusPoolLow: t("statusPoolLow"),
  };

  const bridgeState = {
    gameStatus,
    activeGameId:     activeGameId,
    gameDifficulty,
    petStage,
    petHappiness,
    petHunger,
    petEnergy,
    happinessAchieved,
    actionsUsed,
    ingredientCounts,
    recipeReady: recipeComplete,
    potionBrewed,
    deadline:         deadline,
    credit,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    isActing,
    isRecovering,
    isConnectingWallet,
    walletConnected,
    inputSyncFailed,
    newPaidRunsEnabled,
    nowMs,
    releaseAt,
    releaseInMs,
    lastStatus,
    // Play mode (guest | gamefi) — lets the scene drop the GAS reward tier and
    // entry/reward subtitle in guest while keeping the GAMEFI lobby exactly as-is.
    appMode,
    sceneText,
  };

  const stageTitle = isConnectingWallet
    ? t("sceneConnectingWallet")
    : isStarting || isDealing
    ? t("statusShuffling")
    : isSubmitting || isRecovering
      ? t("statusSubmitting")
      : isPending
        ? t("sceneTitleSettlementPending")
      : isPlaying
        ? t("playingTitle", { difficulty: difficultyLabel(t, gameDifficulty) })
        : isSolved
          ? t("statusWonTitle")
          : isExpired
            ? t("expiredBanner")
            : t("lobbyTitle");

  const scoreItems = isPlaying || isSolved || isExpired || isPending
    ? [
        { label: t("scoreHappiness"), value: `${Math.round(currentHappiness)}/${rule.targetHappiness}`, accent: true },
        { label: t("actionTrailTitle"), value: `${actionsUsed}/${MAX_MOVES}` },
        {
          label: isPending ? t("sceneReleaseWindow") : t("scoreTime"),
          value: isPlaying ? formatClock(remainingMs) : isPending ? formatClock(releaseInMs) : formatClock(rule.limitMs),
        },
      ]
    : isGuest
      ? [
          // Guest has no stake — local framing instead of "REWARD AT STAKE" / pool / credit.
          { label: t("guestRunLabel"), value: t("guestRunValue"), accent: true },
          // Lobby: no run has been dealt, so there is no current happiness to
          // report. This used to hard-code "0/{target}", which both invented a
          // reading and contradicted the nursery meters right above it — those
          // correctly show the egg's stats as sealed. State the goal instead,
          // which is what this chip is actually for before a run starts.
          { label: t("scoreHappiness"), value: t("happinessTarget", { happiness: rule.targetHappiness }) },
          { label: t("scoreTime"), value: formatClock(rule.limitMs) },
        ]
      : [
          { label: t("scoreReward"), value: `${gasDisplay(rule.reward)} GAS`, accent: true },
          { label: t("poolLabel"), value: gasLabel(poolFree) },
          { label: t("creditLabel"), value: gasLabel(credit) },
        ];
  const drawerTitle = t("drawerTitle");
  const drawerId = "pet-potion-ingame-drawer";

  return (
    <div className="pp-playarea mx2 mx2-cat-game" aria-busy={busy}>
      <PlayStage
        category="game"
        className="pp-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: isGuest ? t("guestModeLine") : t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {isGuest ? t("guestRunValue") : t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <div className="pp-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadPetPotionScene}
              state={bridgeState}
              dispatch={dispatch}
              className="pp-phaser-canvas"
              ariaLabel={t("sceneAriaLabel")}
              loadingLabel={t("sceneLoadingLabel")}
              errorLabel={t("sceneErrorLabel")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
              onReady={() => setGameReady(true)}
            />

            <div className="pp-a11y-layer">
              {lobbyAvailable && (
                <div className="pp-a11y-routes" role="radiogroup" aria-label={t("a11yDifficultyGroup")}>
                  {difficultyOptions.map((option, index) => {
                    const selected = option.difficulty === gameDifficulty;
                    return (
                      <button
                        key={option.difficulty}
                        ref={(node) => { difficultyRefs.current[index] = node; }}
                        type="button"
                        role="radio"
                        className="pp-a11y-hit pp-a11y-route"
                        data-index={index}
                        aria-checked={selected}
                        aria-label={`${option.label}. ${option.detail}`}
                        tabIndex={selected ? 0 : -1}
                        disabled={!gameReady}
                        onClick={() => runAction("selectDifficulty", { difficulty: option.difficulty })}
                        onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                      >
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {careActionsOpen && ACTION_NAMES.map((action, index) => (
                <button
                  key={action}
                  type="button"
                  className="pp-a11y-hit pp-a11y-action"
                  data-index={index}
                  aria-label={t("a11yCareAction", {
                    action: actionLabel(t, action),
                    count: ingredientCounts[action],
                  })}
                  disabled={!gameReady}
                  onClick={() => runAction("recordAction", { type: action })}
                >
                  <span>{actionLabel(t, action)}</span>
                </button>
              ))}

              {(lobbyAvailable || isPlaying || gameStatus === "committed" || isPending || inputSyncFailed) && (
                <button
                  type="button"
                  className="pp-a11y-hit pp-a11y-primary"
                  aria-label={semanticPrimaryLabel}
                  disabled={!semanticPrimaryEnabled}
                  onClick={handleSemanticPrimary}
                >
                  <span>{semanticPrimaryLabel}</span>
                </button>
              )}
            </div>

            <p className="pp-a11y-status" aria-live="polite" aria-atomic="true">
              {t("a11yLiveStatus", {
                happiness: Math.round(currentHappiness),
                target: rule.targetHappiness,
                actions: actionsUsed,
                recipe: recipeComplete ? t("recipeComplete") : t("recipeIncomplete"),
              })}
            </p>

            <div className="pp-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item) => (
                <div
                  className="pp-stage-hud__metric"
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
                className="pp-stage-hud__drawer"
                onClick={() => {
                  if (drawerOpen) closeDrawer();
                  else setDrawerOpen(true);
                }}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{drawerTitle}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <>
              <button
                type="button"
                className="pp-ingame-drawer__scrim"
                aria-label={t("closeDrawer")}
                tabIndex={-1}
                onClick={() => closeDrawer()}
              />
               <section
                 ref={drawerRef}
                 id={drawerId}
                className="pp-ingame-drawer"
                aria-label={drawerTitle}
                aria-modal="true"
                role="dialog"
              >
                <div className="pp-ingame-drawer__head">
                  <HeartPulse size={18} aria-hidden="true" />
                  <div>
                    <h3>{drawerTitle}</h3>
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="pp-ingame-drawer__close"
                    aria-label={t("closeDrawer")}
                    onClick={() => closeDrawer()}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="pp-drawer">
                  <div className="pp-drawer__inner">
                    <div className="pp-drawer__head">
                      <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
                      <p>{isGuest ? t("guestModeLine") : t("leaderboardIntro")}</p>
                    </div>

                    <div className="pp-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                      <div>
                        <span>{t("rankLabel")}</span>
                        <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                      </div>
                      <div>
                        <span>{isGuest ? t("guestBestLabel") : t("scoreWon")}</span>
                        <strong>{isGuest ? `${Math.round(myTotalWon)}` : gasLabel(myTotalWon)}</strong>
                      </div>
                      <div>
                        <span>{t("historyTitle")}</span>
                        <strong>{t("solvesCount", { count: mySolves })}</strong>
                      </div>
                      {!isGuest && (
                        <div>
                          <span>{t("poolLabel")}</span>
                          <strong>{gasLabel(poolFree)}</strong>
                        </div>
                      )}
                      {!isGuest && (
                        <div>
                          <span>{t("creditLabel")}</span>
                          <strong>{gasLabel(credit)}</strong>
                        </div>
                      )}
                    </div>

                    {!isGuest && credit > 0 && (
                      <section className="pp-drawer__credit" aria-label={t("withdrawTitle")}>
                        <span>
                          <small>{t("withdrawHint")}</small>
                          <strong>{gasLabel(credit)}</strong>
                        </span>
                        <button
                          type="button"
                          className="mx2-btn mx2-btn--ghost"
                          disabled={busy}
                          onClick={() => runAction("withdrawWinnings")}
                        >
                          <WalletCards size={16} aria-hidden="true" />
                          <span>{t("withdrawTitle")}</span>
                        </button>
                      </section>
                    )}

                    <section className="pp-drawer__section">
                      <div className="pp-drawer__section-head">
                        <HeartPulse size={16} aria-hidden="true" />
                        <h4>{isPlaying ? t("activeRunTitle") : t("difficultyTitle")}</h4>
                      </div>
                      <div className="pp-run-card">
                        <span>{difficultyLabel(t, gameDifficulty)}</span>
                        <strong>{Math.round(currentHappiness)}/{rule.targetHappiness}</strong>
                        <small>
                          {t("activeRouteLine", {
                            actions: actionsUsed,
                            max: MAX_MOVES,
                            time: isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs),
                          })}
                        </small>
                      </div>
                      {targetReached && (
                        <p className="pp-drawer__notice" data-tone="success">{t("targetReachedHint")}</p>
                      )}
                      {lastStatus === "deal-pending" && (
                        <p className="pp-drawer__notice">{t("statusDealPending")}</p>
                      )}
                      {lastStatus === "settlement-pending" && (
                        <p className="pp-drawer__notice">{t("statusSettlementPending")}</p>
                      )}
                      {(isSolved || isExpired) && (
                        <p className="pp-drawer__notice" data-tone={isSolved ? "success" : undefined}>
                          {isGuest
                            ? t("guestResultLine", {
                                happiness: Math.round(currentHappiness),
                                time: formatClock(lastElapsedMs),
                              })
                            : t("lastResultLine", {
                                payout: fixed8Label(lastPayoutFixed8),
                                time: formatClock(lastElapsedMs),
                              })}
                        </p>
                      )}
                      {actionHistory.length > 0 && (
                        <div className="pp-action-trail" aria-label={t("actionTrailTitle")}>
                          {actionHistory.slice(-8).map((action, index) => (
                            <span key={`${action}-${index}`}>{actionLabel(t, action)}</span>
                          ))}
                        </div>
                      )}
                      <div className="pp-recipe-strip" aria-label={t("recipeShelfTitle")}>
                        {ACTION_NAMES.map((action) => (
                          <span key={action} data-ready={ingredientCounts[action] > 0 ? "true" : undefined}>
                            {actionLabel(t, action)} ×{ingredientCounts[action]}
                          </span>
                        ))}
                        <strong>{recipeComplete ? t("recipeComplete") : t("recipeIncomplete")}</strong>
                      </div>
                    </section>

                    <section className="pp-drawer__section">
                      <div className="pp-drawer__section-head">
                        <Trophy size={16} aria-hidden="true" />
                        <h4>{t("leaderboardTitle")}</h4>
                      </div>
                      <ol className="pp-ranks">
                        {leaderboard.slice(0, 8).map((entry) => (
                          <li key={entry.address} className="pp-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                            <span className="pp-ranks__rank">#{entry.rank}</span>
                            <span className="pp-ranks__addr">{shortHash(entry.address)}</span>
                            <span className="pp-ranks__solves">{t("solvesCount", { count: entry.solves })}</span>
                            <span className="pp-ranks__won">{isGuest ? `${Math.round(entry.totalWon)}` : gasLabel(entry.totalWon)}</span>
                            {entry.isUser && <span className="pp-ranks__me">{t("youTag")}</span>}
                          </li>
                        ))}
                      </ol>
                      {leaderboard.length === 0 && (
                        <p className="pp-drawer__empty">{t("leaderboardEmpty")}</p>
                      )}
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost pp-ranks__refresh"
                        onClick={() => runAction("refreshLeaderboard")}
                        disabled={busy}
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        <span>{t("refreshRanks")}</span>
                      </button>
                    </section>

                    <section className="pp-drawer__section">
                      <div className="pp-drawer__section-head">
                        <Activity size={16} aria-hidden="true" />
                        <h4>{t("historyTitle")}</h4>
                      </div>
                      <ul className="pp-history">
                        {myHistory.slice(0, 8).map((row) => (
                          <li key={row.gameId} className="pp-history__row">
                            <span>{difficultyLabel(t, row.difficulty)}</span>
                            <span>{t("happinessCurrent", { happiness: row.happinessAchieved })}</span>
                            <span>{formatClock(row.solveMs)}</span>
                            <strong>{historyPayout(row)}</strong>
                          </li>
                        ))}
                      </ul>
                      {myHistory.length === 0 && (
                        <p className="pp-drawer__empty">{t("historyEmpty")}</p>
                      )}
                    </section>

                    <section className="pp-drawer__section pp-drawer__fairness">
                      <div className="pp-drawer__section-head">
                        <ShieldCheck size={16} aria-hidden="true" />
                        <h4>{isGuest ? t("rulesTitle") : t("fairnessTitle")}</h4>
                      </div>
                      {isGuest ? (
                        <p>{t("guestRulesCopy")}</p>
                      ) : (
                        <>
                          <p>{t("rulesCopy")}</p>
                          <p>{t("fairnessCopy")}</p>
                          {!isGuest && commitment && (
                            <p className="pp-drawer__seed">
                              {t("commitmentLine", {
                                gameId: activeGameId,
                                commitment: shortHash(commitment, 12, 8),
                              })}
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  </div>
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
