/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Jump Rush.
 *
 * Bridges the observable state from main.tsx into the JumpRushScene and
 * forwards Phaser dispatch calls back to main.tsx.
 * All blockchain / TEE logic stays in main.tsx; this component is pure UI.
 */
import type * as Phaser from "phaser";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, RefreshCw, ShieldCheck, Trophy, WalletCards, X, Zap } from "lucide-react";
import {
  DIFFICULTY_RULES,
  SETTLE_GRACE_MS,
  formatClock,
  gasDisplay,
  ruleOf,
  rewardPctAfterUndos,
  MAX_UNDOS,
  GAMEFI_MAX_UNDOS,
} from "./logic/game-rules";
import type { Platform } from "./logic/jump-engine";
import type { LeaderEntry, RunRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS  = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width:           400,
  height:          580,
  backgroundColor: "transparent",
  transparent:     true,
};

const loadJumpRushScene = () =>
  import("./scenes/JumpRushScene").then((module) => module.JumpRushScene);

function shortAddress(value: string): string {
  if (!value) return "--";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function gasLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

function runTimeLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "--";
  return formatClock(ms);
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [a11yStartPulse, setA11yStartPulse] = useState(0);
  const [a11yJumpPulse, setA11yJumpPulse] = useState(0);
  const [a11yChargeLevel, setA11yChargeLevel] = useState(50);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const difficultyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ── Core observable state ────────────────────────────────────────────────
  const gameStatus      = str("gameStatus", "idle");
  const gameDifficulty  = val<number>("gameDifficulty", 0) ?? 0;
  const activeGameId    = str("activeGameId", "0");
  const poolFree        = val<number>("poolFree", 0) ?? 0;
  const creditGas       = val<number>("credit", 0) ?? 0;
  const deadline        = val<number>("deadline", 0) ?? 0;
  const dealtAt         = val<number>("dealtAt", 0) ?? 0;
  const undosUsed       = val<number>("undosUsed", 0) ?? 0;
  const lastPayout      = str("lastPayout", "");
  const commitment      = str("commitment", "");
  const leaderboard     = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank          = val<number>("myRank", 0) ?? 0;
  const myTotalWon      = val<number>("myTotalWon", 0) ?? 0;
  const myRuns          = val<number>("myRuns", 0) ?? 0;
  const myHistory       = val<RunRow[]>("myHistory", []) ?? [];
  const lastElapsedMs   = val<number>("lastElapsedMs", 0) ?? 0;
  const jumpCount       = val<number>("jumpCount", 0) ?? 0;
  const currentPlatform = val<number>("currentPlatform", 0) ?? 0;
  const perfectCount    = val<number>("perfectCount", 0) ?? 0;
  const comboCount      = val<number>("comboCount", 0) ?? 0;
  const missedPlatform  = bool("missedPlatform");
  const inputSyncFailed = bool("inputSyncFailed");
  const lastStatus      = str("lastStatus", "");

  // ── Play mode (guest = local practice, no token/pool/reward) ──────────────
  const appMode         = str("appMode", "guest");
  const isGuest         = appMode === "guest";

  const isStarting      = bool("isStarting");
  const isDealing       = bool("isDealing");
  const isSubmitting    = bool("isSubmitting");
  const isUndoing       = bool("isUndoing");

  const rawPlatforms    = val<Platform[]>("platformsView", []) ?? [];

  const clockNow = useNowMs(1_000, {
    enabled: gameStatus === "dealt" || gameStatus === "committed",
    resetKey: `${gameStatus}|${deadline}`,
  });

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => drawerTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer();
    };
    window.addEventListener("keydown", onEscape);
    window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeDrawer, drawerOpen]);

  const runAction = useCallback((action: string, args: Record<string, unknown> = {}) => {
    try {
      void Promise.resolve(dispatch(action, args)).catch(() => undefined);
    } catch {
      // The framework action wrapper already owns the localized error surface.
    }
  }, [dispatch]);

  // ── Derived values ───────────────────────────────────────────────────────
  const nowMs           = clockNow;
  const rule            = ruleOf(gameDifficulty);
  const platformsView   = rawPlatforms.slice(0, rule.targetJumps + 1);
  const remainingMs     = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const elapsedMs       = dealtAt > 0 ? nowMs - dealtAt : 0;
  const timeUp          = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed = gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  // Guest has no anti-bot floor (no reward at stake), so submit unlocks the
  // moment the local route is cleared.
  const minSolveReached = isGuest || (dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS);
  const rewardPoolReady = isGuest || poolFree >= Number(gasDisplay(rule.rewardFixed8));
  const modeMaxUndos    = isGuest ? MAX_UNDOS : GAMEFI_MAX_UNDOS;
  const undosLeft       = modeMaxUndos - undosUsed;
  const routeCleared    = jumpCount >= rule.targetJumps;
  const interactionPaused = drawerOpen;
  const canReleaseRun   = isGuest
    ? timeUp || (missedPlatform && undosLeft <= 0)
    : gameStatus === "dealt" && deadline > 0 && nowMs > deadline + SETTLE_GRACE_MS;
  const recoveryWaitMs  = !isGuest && timeUp
    ? Math.max(0, deadline + SETTLE_GRACE_MS - nowMs)
    : 0;
  const busy            = isStarting || isDealing || isSubmitting || isUndoing;
  const lobbyAvailable  = ["idle", "solved", "expired", "refunded"].includes(gameStatus) && !busy;
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * rewardPctAfterUndos(undosUsed)) / 100;
  const selectedEntryGas = Number(gasDisplay(rule.entryFixed8));
  const visibleRanks    = leaderboard.slice(0, 5);
  const visibleHistory  = myHistory.slice(0, 5);
  const isPlaying       = gameStatus === "dealt";
  const canJump         = gameReady && !interactionPaused && isPlaying && !busy && !routeCleared &&
    !missedPlatform && !timeUp && !submitWindowClosed && !inputSyncFailed;
  const canSubmit       = gameReady && !interactionPaused && isPlaying && routeCleared && minSolveReached &&
    !timeUp && !submitWindowClosed && !busy;
  const difficultyOptions = DIFFICULTY_RULES.map((difficultyRule) => ({
    difficulty: difficultyRule.difficulty,
    label: t(`difficulty_${difficultyRule.key}`),
    detail: t("a11yDifficultyDetail", { count: difficultyRule.targetJumps }),
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

  const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  // ── Bridge state forwarded to Phaser scene ───────────────────────────────
  const bridgeState = {
    gameStatus,
    gameDifficulty,
    activeGameId,
    poolFree,
    credit:       creditGas,
    deadline,
    dealtAt,
    remainingMs,
    elapsedMs,
    timeLimitMs:  rule.limitMs,
    platformsView,
    isGuest,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    inputSyncFailed,
    interactionPaused,
    timeUp,
    submitWindowClosed,
    minSolveReached,
    rewardPoolReady,
    undosUsed,
    undosLeft,
    canReleaseRun,
    recoveryWaitMs,
    maxUndos:     modeMaxUndos,
    projectedPayout,
    rewardGas:    Number(gasDisplay(rule.rewardFixed8)),
    entryGas:     Number(gasDisplay(rule.entryFixed8)),
    a11yStartPulse,
    a11yJumpPulse,
    a11yChargeLevel,
    lastPayout,
    commitment,
    currentPlatform,
    jumpCount,
    perfectCount,
    comboCount,
    missedPlatform,
    difficultyRules: DIFFICULTY_RULES.map((r) => ({
      difficulty: r.difficulty,
      key:        r.key,
      entryGas:   Number(gasDisplay(r.entryFixed8)),
      // Guest has no reward pool — zero the gate so every route is playable
      // locally, and swap the GAS reward/entry chips for local-play copy.
      rewardGas:  isGuest ? 0 : Number(gasDisplay(r.rewardFixed8)),
      limitMs:    r.limitMs,
      minSolveMs: r.minSolveMs,
      targetJumps: r.targetJumps,
      // Localized card copy so the canvas mirrors the themed route names and
      // language used everywhere else in the app (never hardcode in the scene).
      label:      t(`difficulty_${r.key}`),
      jumpsText:  t("cardJumps",  { count: r.targetJumps }),
      rewardText: isGuest ? t("guestCardReward") : t("cardReward", { amount: gasDisplay(r.rewardFixed8) }),
      entryText:  isGuest ? t("guestCardEntry")  : t("cardEntry",  { amount: gasDisplay(r.entryFixed8) }),
    })),
    // Flat i18n string map consumed by the scene (this.tr) so every in-canvas
    // HUD/overlay label is localized rather than a hardcoded English literal.
    // Guest overrides swap the TEE/GAS framing for local-play framing under the
    // SAME keys the scene reads, so no scene change is needed.
    sceneText: {
      chargeHold:         t("chargeHold"),
      chargeRelease:      t("chargeRelease"),
      chargeTip:          t("chargeHint"),
      perfect:            t("perfectLanding"),
      submitRun:          t("submitAction"),
      submitSettleHint:   isGuest ? t("guestSubmitHint")     : t("submitSettleHint"),
      submitVerifiedHint: isGuest ? t("guestSubmitDoneHint") : t("submitVerifiedHint"),
      timeExpired:        t("timeExpiredLabel"),
      releaseThisRun:     isGuest ? t("guestEndRun") : t("releaseThisRun"),
      waitLabel:          t("waitLabel"),
      antiBotFloor:       t("antiBotFloor"),
      recoveryWindow:     t("recoveryWindow"),
      keepJumping:        t("keepJumping"),
      targetNotCleared:   t("targetNotCleared"),
      startJump:          t("startJump"),
      preparing:          t("preparingLabel"),
      startSealHint:      isGuest ? t("guestStartHint")      : t("startSealHint"),
      poolRefilling:      isGuest ? t("guestReadyHint")      : t("statusPoolLow"),
      loadingRouteHint:   t("loadingRouteHint"),
      preparingPlatforms: isGuest ? t("guestBuildingTitle")  : t("preparingPlatforms"),
      sealingFairRoute:   isGuest ? t("guestBuildingHint")   : t("sealingFairRoute"),
      retryDeal:          t("checkDealAgain"),
      retryDealHint:      isGuest ? t("guestBuildingHint") : t("statusDealPending"),
      missedTitle:        t("missedTitle"),
      missedCopy:         isGuest ? t("guestMissedCopy") : t("missedCopy"),
      clearedTitle:       t("clearedTitle"),
      undoJump:           t("undoAction"),
      undoLeft:           t("undoLeftLabel"),
      noUndos:            t("noUndosLabel"),
    },
  };

  // ── Stage title ──────────────────────────────────────────────────────────
  const stageTitle = isSubmitting
    ? t("statusSubmitting")
    : isDealing || isStarting
      ? t("statusShuffling")
      : gameStatus === "dealt"
        ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
        : gameStatus === "solved"
          ? t("statusWonTitle")
          : t("lobbyTitle");

  // ── Score bar items ──────────────────────────────────────────────────────
  // Guest shows local/practice metrics (best run, route length, live jumps) with
  // no GAS-at-stake / pool / credit framing; gamefi keeps the reward economy.
  const guestScoreItems = gameStatus === "idle"
    ? [
        { label: t("guestBestLabel"), value: myTotalWon > 0 ? t("guestJumpsValue", { count: myTotalWon }) : t("guestBestEmpty"), accent: true },
        { label: t("guestRouteLabel"), value: t("guestJumpsValue", { count: rule.targetJumps }) },
        { label: t("guestModeLabel"), value: t("guestModeValue") },
      ]
    : [
        { label: t("guestJumpsLabel"), value: String(jumpCount), accent: true },
        {
          label: t("scoreTime"),
          value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
        },
        { label: t("scoreUndos"), value: `${undosLeft}/${modeMaxUndos}` },
      ];
  const gamefiScoreItems = gameStatus === "idle"
    ? [
        { label: t("scoreReward"), value: gasLabel(Number(gasDisplay(rule.rewardFixed8))), accent: true },
        { label: t("poolShort"), value: gasLabel(poolFree) },
        { label: t("creditShort"), value: gasLabel(creditGas) },
      ]
    : [
        { label: t("scoreReward"), value: `${projectedPayout.toFixed(2)} GAS`, accent: true },
        {
          label: t("scoreTime"),
          value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
        },
        { label: t("scoreUndos"), value: `${undosLeft}/${modeMaxUndos}` },
      ];
  const scoreItems = isGuest ? guestScoreItems : gamefiScoreItems;
  const drawerTitle = t("drawerTitle");
  const drawerId = "jump-rush-ingame-drawer";
  const drawerContent = (
    <div className="jr-drawer">
      <div className="jr-drawer__summary" aria-label={t("drawerSummaryLabel")}>
        <div>
          <span>{t("rankLabel")}</span>
          <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
        </div>
        <div>
          <span>{isGuest ? t("guestBestLabel") : t("scoreWon")}</span>
          <strong>
            {isGuest
              ? (myTotalWon > 0 ? t("guestJumpsValue", { count: myTotalWon }) : t("guestBestEmpty"))
              : gasLabel(myTotalWon)}
          </strong>
        </div>
        <div>
          <span>{isGuest ? t("guestRunsLabel") : t("creditLabel")}</span>
          <strong>{isGuest ? String(myRuns) : gasLabel(creditGas)}</strong>
        </div>
      </div>

      <section className="jr-drawer__panel jr-drawer__panel--run">
        <div className="jr-drawer__panel-head">
          <Zap size={16} aria-hidden="true" />
          <h4>{gameStatus === "dealt" ? t("activeRunTitle") : t("nextRunTitle")}</h4>
        </div>
        <div className="jr-run-card">
          <span>{t(`difficulty_${rule.key}`)}</span>
          <strong>{gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs)}</strong>
          <small>
            {isGuest
              ? t("guestRunEconomyLine", { jumps: rule.targetJumps })
              : t("runEconomyLine", {
                  entry:  selectedEntryGas.toFixed(selectedEntryGas >= 1 ? 0 : 2),
                  reward: Number(gasDisplay(rule.rewardFixed8)).toFixed(Number(gasDisplay(rule.rewardFixed8)) >= 1 ? 0 : 1),
                })}
          </small>
        </div>
        {!isGuest && !rewardPoolReady && gameStatus !== "dealt" && (
          <p className="jr-drawer__notice">{t("statusPoolLow")}</p>
        )}
        {gameStatus === "solved" && lastPayout && (
          <p className="jr-drawer__notice" data-tone="success">
            {isGuest
              ? t("guestLastRunLine", { count: lastPayout, time: runTimeLabel(lastElapsedMs) })
              : t("lastRunLine", { payout: lastPayout, time: runTimeLabel(lastElapsedMs) })}
          </p>
        )}
        {!isGuest && creditGas > 0 && gameStatus !== "dealt" && (
          <div className="jr-drawer__actions">
            <button type="button" onClick={() => runAction("withdrawWinnings")} disabled={busy}>
              <WalletCards size={15} aria-hidden="true" />
              <span>{t("withdrawAction", { amount: creditGas.toFixed(2) })}</span>
            </button>
            <small>{t("withdrawHint")}</small>
          </div>
        )}
      </section>

      <section className="jr-drawer__panel">
        <div className="jr-drawer__panel-head">
          <Trophy size={16} aria-hidden="true" />
          <h4>{t("leaderboardTitle")}</h4>
          <button type="button" onClick={() => runAction("refreshLeaderboard")} disabled={busy}>
            <RefreshCw size={14} aria-hidden="true" />
            <span>{t("refreshRanks")}</span>
          </button>
        </div>
        {visibleRanks.length > 0 ? (
          <ol className="jr-ranks jr-ranks--phaser">
            {visibleRanks.map((entry) => (
              <li key={`${entry.rank}-${entry.address}`} className="jr-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                <span className="jr-ranks__rank">#{entry.rank}</span>
                <span className="jr-ranks__addr">{shortAddress(entry.address)}</span>
                <span className="jr-ranks__runs">{t("solvesCount", { count: entry.runs })}</span>
                <strong className="jr-ranks__won">
                  {isGuest ? t("guestJumpsValue", { count: entry.totalWon }) : gasLabel(entry.totalWon)}
                </strong>
                {entry.isUser && <span className="jr-ranks__me">{t("youTag")}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="jr-drawer__empty">{t("leaderboardEmpty")}</p>
        )}
      </section>

      <section className="jr-drawer__panel">
        <h4>{t("historyTitle")}</h4>
        {visibleHistory.length > 0 ? (
          <ul className="jr-history">
            {visibleHistory.map((run) => (
              <li key={`${run.gameId}-${run.elapsedMs}-${run.payout}`}>
                <span>{t(`difficulty_${ruleOf(run.difficulty).key}`)}</span>
                <strong>{isGuest ? t("guestJumpsValue", { count: run.jumps }) : run.payout}</strong>
                <small>
                  {run.jumps}{run.perfects === null ? "" : ` / ${run.perfects}`} · {runTimeLabel(run.elapsedMs)} · {t("historyUndos", { undos: run.undos })}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="jr-drawer__empty">{t("historyEmpty")}</p>
        )}
      </section>

      <section className="jr-drawer__panel jr-drawer__panel--guide">
        <div className="jr-drawer__guide-title">
          <ShieldCheck size={16} aria-hidden="true" />
          <h4>{isGuest ? t("guestGuideTitle") : t("fairnessTitle")}</h4>
        </div>
        <p>{isGuest ? t("guestRulesCopy") : t("rulesCopy")}</p>
        <p>{isGuest ? t("guestModeLine") : t("fairnessCopy")}</p>
      </section>

      {!isGuest && commitment && (
        <p className="jr-drawer__seed">
          {t("commitmentLine", {
            commitment: `${commitment.slice(0, 12)}…${commitment.slice(-8)}`,
            gameId:     activeGameId,
          })}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="jr-playarea mx2 mx2-cat-game"
      data-playing={isPlaying ? "true" : undefined}
      aria-busy={busy}
    >
      <PlayStage
        category="game"
        className="jr-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {isGuest ? t("guestModeValue") : t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <div className="jr-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadJumpRushScene}
              state={bridgeState}
              dispatch={dispatch}
              className="jr-phaser-canvas"
              ariaLabel={t("gameAriaLabel")}
              loadingLabel={t("gameLoadingLabel")}
              errorLabel={t("gameActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
              onReady={() => setGameReady(true)}
            />

            <div className="jr-a11y-layer" aria-hidden={interactionPaused || undefined}>
              {lobbyAvailable && (
                <>
                  <div className="jr-a11y-routes" role="radiogroup" aria-label={t("a11yDifficultyGroup")}>
                    {difficultyOptions.map((option, index) => {
                      const selected = option.difficulty === gameDifficulty;
                      return (
                        <button
                          key={option.difficulty}
                          ref={(node) => { difficultyRefs.current[index] = node; }}
                          type="button"
                          role="radio"
                          className="jr-a11y-hit jr-a11y-route"
                          data-index={index}
                          aria-checked={selected}
                          aria-label={`${option.label}. ${option.detail}`}
                          tabIndex={selected ? 0 : -1}
                          disabled={!gameReady || interactionPaused}
                          onClick={() => runAction("selectDifficulty", { difficulty: option.difficulty })}
                          onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="jr-a11y-hit jr-a11y-start"
                    aria-label={`${t("a11yStartRoute")}: ${difficultyOptions[gameDifficulty]?.label ?? ""}`}
                    disabled={!gameReady || busy || interactionPaused}
                    onClick={() => setA11yStartPulse((pulse) => pulse + 1)}
                  >
                    <span>{t("a11yStartRoute")}</span>
                  </button>
                </>
              )}

              {isPlaying && !routeCleared && !missedPlatform && !canReleaseRun && (
                <>
                  <label className="jr-a11y-charge">
                    <span>{t("a11yChargePower", { power: a11yChargeLevel })}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={a11yChargeLevel}
                      disabled={!gameReady || busy || interactionPaused || timeUp || submitWindowClosed || inputSyncFailed}
                      aria-label={t("a11yChargePower", { power: a11yChargeLevel })}
                      onChange={(event) => setA11yChargeLevel(Number(event.currentTarget.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className="jr-a11y-hit jr-a11y-jump"
                    aria-label={t("a11yJumpAtPower", { power: a11yChargeLevel })}
                    disabled={!canJump}
                    onClick={() => setA11yJumpPulse((pulse) => pulse + 1)}
                  >
                    <span>{t("a11yJumpAtPower", { power: a11yChargeLevel })}</span>
                  </button>
                </>
              )}

              {isPlaying && !routeCleared && !missedPlatform && canReleaseRun && (
                <button
                  type="button"
                  className="jr-a11y-hit jr-a11y-recovery"
                  aria-label={t("a11yEndRun")}
                  disabled={!gameReady || busy || interactionPaused}
                  onClick={() => runAction("expireGame")}
                >
                  <span>{t("a11yEndRun")}</span>
                </button>
              )}

              {isPlaying && missedPlatform && (
                <button
                  type="button"
                  className="jr-a11y-hit jr-a11y-recovery"
                  aria-label={canReleaseRun ? t("a11yEndRun") : t("a11yUndoJump", { count: undosLeft })}
                  disabled={!gameReady || busy || interactionPaused || (!canReleaseRun && undosLeft <= 0)}
                  onClick={() => runAction(canReleaseRun ? "expireGame" : "useUndo")}
                >
                  <span>{canReleaseRun ? t("a11yEndRun") : t("a11yUndoJump", { count: undosLeft })}</span>
                </button>
              )}

              {isPlaying && routeCleared && (
                <button
                  type="button"
                  className="jr-a11y-hit jr-a11y-submit"
                  aria-label={canReleaseRun ? t("a11yEndRun") : t("a11ySubmitRun")}
                  disabled={interactionPaused || (!canReleaseRun && !canSubmit)}
                  onClick={() => runAction(canReleaseRun ? "expireGame" : "submitRun")}
                >
                  <span>{canReleaseRun ? t("a11yEndRun") : t("a11ySubmitRun")}</span>
                </button>
              )}
            </div>

            <p className="jr-a11y-status" aria-live="polite" aria-atomic="true">
              {`${stageTitle}. ${t("guestJumpsLabel")}: ${currentPlatform}/${rule.targetJumps}. ${t("perfectLabel")}: ${perfectCount}. ${t("comboLabel", { x: comboCount })}. ${t("scoreTime")}: ${isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs)}. ${lastStatus}`}
            </p>

            <div className="jr-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item) => (
                <div
                  className="jr-stage-hud__metric"
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
                className="jr-stage-hud__drawer"
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
                  className="jr-ingame-drawer__scrim"
                  aria-label={t("closeDrawer")}
                  tabIndex={-1}
                  onClick={() => closeDrawer()}
                />
                <section
                  id={drawerId}
                  className="jr-ingame-drawer"
                  aria-label={drawerTitle}
                  aria-modal="true"
                  role="dialog"
                  onKeyDown={handleDrawerKeyDown}
                >
                  <div className="jr-ingame-drawer__head">
                    <Trophy size={18} aria-hidden="true" />
                    <div>
                      <h3>{drawerTitle}</h3>
                      <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
                    </div>
                    <button
                      ref={drawerCloseRef}
                      type="button"
                      className="jr-ingame-drawer__close"
                      aria-label={t("closeDrawer")}
                      onClick={() => closeDrawer()}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {drawerContent}
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
