/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for game-2048.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer.
 * All blockchain logic stays in main.tsx; this component bridges the
 * observable state into Game2048Scene and forwards dispatch calls back.
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, RefreshCw, RotateCcw, Trophy, WalletCards, X } from "lucide-react";
import { applyMove, hasAnyMove, tileValue } from "./logic/engine-2048";
import type { MoveTransition } from "./logic/engine-2048";
import {
  MAX_UNDOS,
  MAX_MOVES,
  SETTLEMENT_GRACE_MS,
  canReleaseExpiredGame,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const DIFFICULTY_KEYS = ["sprint", "climb", "summit"] as const;

const GAME_CONFIG = {
  width:  400,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

const loadGame2048Scene = () =>
  import("./scenes/Game2048Scene").then((module) => module.Game2048Scene);

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function historyPayout(row: SolveRow): string {
  return typeof row.payout === "string" ? row.payout : String(row.payout ?? "0 GAS");
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const activeGameId   = str("activeGameId", "0");
  const commitmentHex  = str("commitment", "");
  const gameStatus     = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const isMoving       = bool("isMoving");
  const isUndoing      = bool("isUndoing");
  const isRecovering   = bool("isRecovering");
  const balancesReady  = bool("balancesReady");
  const runBoard       = val<number[]>("runBoard") ?? [];
  const runMoveCount   = val<number>("runMoveCount", 0) ?? 0;
  const runMaxExp      = val<number>("runMaxExp", 0) ?? 0;
  const moveTransition = val<MoveTransition | null>("moveTransition") ?? null;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const undosUsed      = val<number>("undosUsed", 0) ?? 0;
  const lastPayout     = str("lastPayout", "");
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const myRank         = val<number>("myRank", 0) ?? 0;
  const mySolves       = val<number>("mySolves", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const lastStatus     = str("lastStatus", t("statusReady"));
  const appMode        = str("appMode", "guest");
  const isGuest        = appMode === "guest";
  const selectedDifficulty = val<number>("selectedDifficulty", gameDifficulty)
    ?? gameDifficulty;
  const settlementGraceMs = val<number>("settlementGraceMs", SETTLEMENT_GRACE_MS)
    ?? SETTLEMENT_GRACE_MS;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const difficultyRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!["committed", "dealt", "unknown"].includes(gameStatus)) return undefined;
    // A finished run stops the ticker, so the cached clock can otherwise make
    // a newly opened board briefly show more time than the lane allows.
    const immediateNow = Date.now();
    setNowMs((current) => (
      Math.abs(immediateNow - current) > 1_000 ? immediateNow : current
    ));
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline, gameStatus]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  const rule = ruleOf(gameDifficulty);
  const isPlaying = gameStatus === "dealt";
  const isSolved = gameStatus === "solved";
  const isExpired = gameStatus === "expired" || gameStatus === "refunded";
  const isCommitted = gameStatus === "committed";
  const settlementPending = gameStatus === "unknown";
  const hasActiveGame = activeGameId !== "0";
  const busy = isStarting || isDealing || isSubmitting || isMoving || isUndoing || isRecovering;
  const boardReady = runBoard.length === 16;
  const dealPending = hasActiveGame && (isCommitted || (isPlaying && !boardReady));
  const targetReached = boardReady && runMaxExp >= rule.targetExp;
  const boardDead = boardReady && !targetReached && !hasAnyMove(runBoard);
  const moveCapReached = runMoveCount >= MAX_MOVES;
  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed = isPlaying && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const runEnded = targetReached || boardDead || moveCapReached;
  const canSubmit = isPlaying
    && runEnded
    && !timeUp
    && (isGuest || minSolveReached)
    && (isGuest || !submitWindowClosed);
  const releaseReady = !isGuest && hasActiveGame && canReleaseExpiredGame(
    deadline,
    settlementGraceMs,
    nowMs,
  );
  const recoveryPending = !isGuest
    && hasActiveGame
    && deadline > 0
    && (dealPending || settlementPending || timeUp);
  const undosLeft = Math.max(0, MAX_UNDOS - undosUsed);
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;
  const isLobby = ["idle", "solved", "expired", "refunded"].includes(gameStatus);
  const difficultyOptions = DIFFICULTY_KEYS.map((key, index) => {
    const optionRule = ruleOf(index);
    return {
      id: index,
      label: t(`difficulty_${key}`),
      target: t("targetTile", { tile: optionRule.targetTile }),
    };
  });
  const canMoveControls = isPlaying
    && boardReady
    && !busy
    && !timeUp
    && !boardDead
    && !moveCapReached;

  const handleDifficultyKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!isLobby || busy) return;
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const next = (index + direction + difficultyOptions.length) % difficultyOptions.length;
    difficultyRadioRefs.current[next]?.focus();
    void dispatch("setDifficulty", next);
  };

  const semanticPrimary: {
    action: string;
    args?: unknown[];
    disabled: boolean;
    label: string;
  } | null = (() => {
    if (isGuest && timeUp) {
      return { action: "expireGame", args: [{}], disabled: busy, label: t("endRunAction") };
    }
    if (releaseReady && recoveryPending) {
      return { action: "expireGame", args: [{}], disabled: busy, label: t("releaseAction") };
    }
    if (settlementPending) {
      return {
        action: "checkSettlement",
        args: [{}],
        disabled: busy,
        label: isRecovering ? t("settlementCheckingTitle") : t("checkSettlementAction"),
      };
    }
    if (dealPending) {
      return {
        action: "retryDeal",
        args: [{}],
        disabled: busy,
        label: isDealing ? t("statusShuffling") : t("checkDealAgain"),
      };
    }
    if (isLobby) {
      // Mirror the canvas gate (Game2048Scene.canStartPicked) on the
      // accessible start path: a paid run must never open while the reward
      // pool cannot cover the payout. Guest (free local) play has no reward
      // pool and stays exempt. Label semantics match updateStartBtn: while
      // balances are still unknown the copy stays "checking" instead of the
      // discouraging "pool low", but the press is gated either way.
      const startPoolReady = isGuest
        || poolFree >= Number(gasDisplay(ruleOf(selectedDifficulty).rewardFixed8));
      return {
        action: "startGame",
        args: [{ difficulty: selectedDifficulty }],
        disabled: busy || !startPoolReady,
        label: isStarting
          ? t("startOpening")
          : startPoolReady
            ? t("startOpenRun")
            : balancesReady
              ? t("startPoolLow")
              : t("startCheckingPool"),
      };
    }
    if (canSubmit) {
      return {
        action: "submitRun",
        args: [{}],
        disabled: busy,
        label: targetReached ? t("submitAction") : t("endRunAction"),
      };
    }
    if (recoveryPending) {
      return {
        action: "expireGame",
        args: [{}],
        disabled: true,
        label: t("releaseWaitAction"),
      };
    }
    return null;
  })();

  // Bridge state pushed into the Phaser scene via GameBridge
  const bridgeState = {
    activeGameId,
    commitment: commitmentHex,
    gameStatus,
    gameDifficulty,
    selectedDifficulty,
    runBoard,
    runMoveCount,
    runMaxExp,
    moveTransition,
    isStarting,
    isDealing,
    isSubmitting,
    isMoving,
    isUndoing,
    creditGas,
    credit: creditGas,
    poolFree,
    dealtAt,
    deadline,
    undosUsed,
    myRank,
    mySolves,
    myTotalWon,
    lastStatus,
    balancesReady,
    // Play mode (guest | gamefi) — lets the scene drop pool gating + GAS copy
    // in guest while keeping the GAMEFI lobby exactly as-is.
    appMode,
    // Localized in-canvas labels (the scene has no translator of its own).
    scoreMovesCaption: t("scoreMovesCaption"),
    startOpenRun: t("startOpenRun"),
    startOpening: t("startOpening"),
    startCheckingPool: t("startCheckingPool"),
    startPoolLow: t("startPoolLow"),
    guestLaneTag: t("guestRunValue"),
    scoreBestCaption: t("scoreBestCaption"),
    boardControlsHint: t("controlsHint"),
    lobbyHeading: t("lobbyHeading"),
    lobbySubtitle: isGuest ? t("guestLobbySubtitle") : t("lobbySubtitle"),
    difficultyLabels: DIFFICULTY_KEYS.map((key) => t(`difficulty_${key}`)),
    difficultyCopy: DIFFICULTY_KEYS.map((key) => t(`difficulty_${key}_copy`)),
    difficultyTimes: DIFFICULTY_KEYS.map((_, index) => t("timeAmount", {
      minutes: Math.round(ruleOf(index).limitMs / 60_000),
    })),
    dealingLabel: t("dealingLabel"),
    celebrationTitle: t("celebrationTitle"),
    celebrationCopy: t("celebrationCopy"),
    celebrationDismiss: t("celebrationDismiss"),
  };

  const stageTitle = isSolved
    ? t("statusWonTitle")
    : isExpired
      ? (isGuest ? t("guestGameOverTitle") : t("expiredBanner"))
    : isPlaying
      ? t("playingTitle", { tile: rule.targetTile })
      : isCommitted
        ? t("statusShuffling")
        : settlementPending
          ? t("settlementPendingTitle")
          : recoveryPending
            ? t("releaseWaitTitle")
            : t("lobbyTitle");

  const submitAction = canSubmit
    ? {
        label:    targetReached ? t("submitAction") : t("endRunAction"),
        onClick:  () => void dispatch("submitRun", {}),
        disabled: busy,
        loading:  isSubmitting,
        icon:     <Trophy size={18} aria-hidden="true" />,
        hint:     t("submitHint"),
      }
    : undefined; // lobby/start/move live inside Phaser; outer rail only settles or recovers.

  const drawerActions = [
    ...(isPlaying
      ? [{
          label:   t("useUndo") ?? "Undo",
          onClick: () => void dispatch("useUndo", {}),
          disabled: busy || runMoveCount === 0 || undosLeft <= 0 || submitWindowClosed,
          loading:  isUndoing,
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          hint:    t("undoHint"),
        }]
      : []),
    ...(((releaseReady || (isGuest && timeUp)) && hasActiveGame)
      ? [{
          label:   t("releaseAction") ?? "Release",
          onClick: () => void dispatch("expireGame", {}),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    timeUp || boardDead ? t("timeUpHint") : t("releaseHint"),
        }]
      : []),
    ...(dealPending && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          onClick: () => void dispatch("retryDeal", {}),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    t("statusDealPending"),
        }]
      : []),
    ...(settlementPending
      ? [{
          label: t("checkSettlementAction"),
          onClick: () => void dispatch("checkSettlement", {}),
          disabled: busy,
          loading: isRecovering,
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("settlementStillPending"),
        }]
      : []),
  ];

  const hudItems = [
    isGuest
      ? {
          // Guest has no stake — surface local framing instead of "REWARD AT STAKE".
          label: t("guestRunLabel"),
          value: t("guestRunValue"),
          accent: true,
        }
      : {
          label: t("scoreReward"),
          value: `${projectedPayout.toFixed(2)} GAS`,
          accent: true,
        },
    {
      label: t("scoreBest"),
      value: `${tileValue(runMaxExp)}/${rule.targetTile}`,
    },
    {
      label: recoveryPending ? t("scoreReleaseIn") : t("scoreTime"),
      value: recoveryPending
        ? formatClock(deadline + settlementGraceMs - nowMs)
        : isPlaying
          ? formatClock(remainingMs)
          : formatClock(rule.limitMs),
    },
  ];

  return (
    <div className="rush-playarea mx2 mx2-cat-game rush-phaser-playarea" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="rush-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestModeLine") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestRunValue") : t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
              {targetReached && isPlaying && (
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {t("submitHint")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="rush-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadGame2048Scene}
              state={bridgeState}
              dispatch={dispatch}
              className="rush-phaser-canvas"
              ariaLabel={t("game2048StageAlt")}
              loadingLabel={t("openingTileBoard")}
              errorLabel={t("game2048ActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />

            <div className="rush-a11y-layer">
              <div
                className="rush-a11y-difficulties"
                role="radiogroup"
                aria-label={t("difficultyTitle")}
              >
                {difficultyOptions.map((option, index) => {
                  const selected = option.id === selectedDifficulty;
                  return (
                    <button
                      key={option.id}
                      ref={(node) => {
                        difficultyRadioRefs.current[index] = node;
                      }}
                      type="button"
                      role="radio"
                      className="rush-a11y-hit rush-a11y-difficulty"
                      data-index={index}
                      aria-checked={selected}
                      aria-label={`${option.label}. ${option.target}`}
                      tabIndex={selected ? 0 : -1}
                      disabled={!isLobby || busy}
                      onClick={() => void dispatch("setDifficulty", option.id)}
                      onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rush-a11y-moves" role="group" aria-label={t("padLabel")}>
                {[
                  { dir: 0, label: t("moveUp") },
                  { dir: 1, label: t("moveRight") },
                  { dir: 2, label: t("moveDown") },
                  { dir: 3, label: t("moveLeft") },
                ].map((move) => (
                  <button
                    key={move.dir}
                    type="button"
                    className="rush-a11y-hit rush-a11y-move"
                    data-dir={move.dir}
                    aria-label={move.label}
                    disabled={!canMoveControls || !applyMove([...runBoard], move.dir)}
                    onClick={() => void dispatch("playMove", { dir: move.dir })}
                  >
                    <span>{move.label}</span>
                  </button>
                ))}
              </div>

              {semanticPrimary && (
                <button
                  type="button"
                  className="rush-a11y-hit rush-a11y-primary"
                  aria-label={semanticPrimary.label}
                  disabled={semanticPrimary.disabled}
                  onClick={() => void dispatch(
                    semanticPrimary.action,
                    ...(semanticPrimary.args ?? []),
                  )}
                >
                  <span>{semanticPrimary.label}</span>
                </button>
              )}
            </div>
            <p className="rush-a11y-status" aria-live="polite" aria-atomic="true">
              {stageTitle}. {lastStatus}. {isPlaying && deadline > 0 ? `${formatClock(remainingMs)}.` : ""}
            </p>
            <div className="rush-stage-hud" aria-label={t("sidebarTitle")}>
              {hudItems.map((item) => (
                <div
                  className="rush-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {submitAction && (
                <button
                  type="button"
                  className="rush-stage-hud__submit"
                  disabled={submitAction.disabled}
                  onClick={submitAction.onClick}
                  title={submitAction.hint}
                >
                  {submitAction.icon}
                  <span>{submitAction.loading ? t("statusSubmitting") : submitAction.label}</span>
                </button>
              )}
              <button
                type="button"
                className="rush-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitle")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="rush-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="rush-drawer__head">
                  <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                  <p>{isGuest ? t("guestModeLine") : t("leaderboardIntro")}</p>
                  <button
                    type="button"
                    className="rush-drawer__close"
                    aria-label={t("close")}
                    title={t("close")}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>

                <div className="rush-drawer__summary">
                  <span>
                    <small>{t("rankLabel")}</small>
                    <strong>{myRank > 0 ? `#${myRank}` : "—"}</strong>
                  </span>
                  <span>
                    <small>{isGuest ? t("guestBestLabel") : t("scoreWon")}</small>
                    <strong>{isGuest ? `${myTotalWon}` : `${myTotalWon.toFixed(2)} GAS`}</strong>
                  </span>
                  <span>
                    <small>{t("historyTitle")}</small>
                    <strong>{t("solvesCount", { count: mySolves })}</strong>
                  </span>
                  <span>
                    <small>{t("scoreUndos")}</small>
                    <strong>{undosLeft}</strong>
                  </span>
                </div>

                {drawerActions.length > 0 && (
                  <div className="rush-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        disabled={action.disabled}
                        onClick={action.onClick}
                        title={action.hint}
                      >
                        {action.icon}
                        <span>{action.loading ? action.hint : action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!isGuest && creditGas > 0 && (
                  <div className="rush-drawer__credit">
                    <span>
                      <small>{t("creditLabel")}</small>
                      <strong>{creditGas.toFixed(2)} GAS</strong>
                    </span>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("withdrawWinnings", {})}
                    >
                      <WalletCards size={16} aria-hidden="true" />
                      <span>{t("withdrawTitle")}</span>
                    </button>
                  </div>
                )}

                <h4>{t("leaderboardTitle")}</h4>
                {leaderboard.length > 0 ? (
                  <ol className="rush-ranks">
                    {leaderboard.slice(0, 10).map((entry) => (
                      <li
                        key={entry.address}
                        className="rush-ranks__row"
                        data-me={entry.isUser ? "true" : undefined}
                      >
                        <span className="rush-ranks__rank">#{entry.rank}</span>
                        <span className="rush-ranks__addr">{shortHash(entry.address)}</span>
                        <span className="rush-ranks__solves">
                          {t("solvesCount", { count: entry.solves })}
                        </span>
                        <span className="rush-ranks__won">
                          {isGuest ? `${entry.totalWon}` : `${entry.totalWon.toFixed(2)} GAS`}
                        </span>
                        {entry.isUser && <span className="rush-ranks__me">{t("youTag")}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>{t("leaderboardEmpty")}</p>
                )}
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("refreshLeaderboard", {})}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{t("refreshRanks")}</span>
                </button>

                <h4>{t("historyTitle")}</h4>
                {myHistory.length > 0 ? (
                  <ul className="rush-history">
                    {myHistory.map((row) => {
                      const historyRule = ruleOf(row.difficulty);
                      return (
                        <li key={row.gameId} className="rush-history__item">
                          <span className="rush-history__target">{historyRule.targetTile}</span>
                          <span className="rush-history__time">{formatClock(row.solveMs)}</span>
                          <span className="rush-history__undos">
                            {t("historyUndos", { undos: row.undos })}
                          </span>
                          <strong>
                            {isGuest
                              ? t("bestTile", { tile: Number(row.bestTile ?? 0) })
                              : historyPayout(row)}
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>{t("historyEmpty")}</p>
                )}

                <h4>{t("rulesTitle")}</h4>
                <p>{isGuest ? t("guestRulesCopy") : t("rulesCopy")}</p>
                {!isGuest && (
                  <>
                    <h4>{t("fairnessTitle")}</h4>
                    <p>{t("fairnessCopy")}</p>
                  </>
                )}
                {!isGuest && commitmentHex && (
                  <p className="rush-drawer__seed">
                    {t("commitmentLine", {
                      commitment: shortHash(commitmentHex, 12, 8),
                      gameId: activeGameId,
                    })}
                  </p>
                )}
                {!isGuest && lastPayout && (
                  <p className="rush-drawer__seed">{t("solvedBanner", { payout: lastPayout })}</p>
                )}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
