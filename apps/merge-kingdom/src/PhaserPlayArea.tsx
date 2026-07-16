/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Merge Kingdom.
 *
 * Bridges the observable state from main.tsx into the Phaser
 * MergeKingdomScene and forwards scene dispatch calls back to the
 * blockchain layer. All chain/wallet/oracle logic remains in main.tsx.
 *
 * bridgeState keys pushed into the Phaser scene:
 *   gameStatus      string   "idle"|"committed"|"dealt"|"solved"|"expired"
 *   board           number[][] 4×4 grid (0 = empty)
 *   moveCount       number
 *   tileAchieved    number   highest tile value this session
 *   gameDifficulty  number   0=Easy 1=Medium 2=Hard
 *   deadline        number   Unix-epoch ms when the game expires (0=none)
 *   isStarting      boolean
 *   isDealing       boolean
 *   isSubmitting    boolean
 *   poolFree        number   pool GAS available for payouts
 *   credit          number   pending GAS credit (GAS units, not Fixed8)
 *   lastPayoutFixed8 number  Fixed8 payout of the last completed game
 *   lastElapsedMs   number   elapsed ms of the last completed game
 *   lastStatus      string   human-readable status key
 */
import { useEffect, useRef, useState } from "react";
import type * as Phaser from "phaser";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, RefreshCw, RotateCcw, ShieldCheck, Trophy, WalletCards, X } from "lucide-react";
import {
  GAMEFI_NEW_ENTRIES_ENABLED,
  SETTLE_GRACE_MS,
  TILE_VALUES,
  formatClock,
  gasDisplay,
  guestRuleOf,
  ruleOf,
} from "./logic/game-rules";
import { classifyMove, type Cell } from "./logic/merge-engine";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

const loadMergeKingdomScene = () =>
  import("./scenes/MergeKingdomScene").then((module) => module.MergeKingdomScene);

const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;
function ruleFor(difficulty: number) {
  try {
    return ruleOf(difficulty);
  } catch {
    return ruleOf(0);
  }
}

function difficultyLabel(t: PlayAreaProps["t"], difficulty: number): string {
  const key = DIFFICULTY_KEYS[difficulty] ?? "easy";
  return t(`difficulty_${key}`);
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

function historyResult(t: PlayAreaProps["t"], row: SolveRow, isGuest: boolean): string {
  if (isGuest) return row.won ? t("guestHistoryWon") : t("guestHistoryFinished");
  return typeof row.payout === "string" ? row.payout : String(row.payout ?? "0 GAS");
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [a11yDifficulty, setA11yDifficulty] = useState(0);
  const [a11ySelectedCell, setA11ySelectedCell] = useState<Cell | null>(null);
  const [a11yMessage, setA11yMessage] = useState("");
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const status = str("gameStatus", "idle");
  const gameDifficulty = num("gameDifficulty");
  const activeGameId = str("activeGameId", "0");
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const creditGas = num("credit");
  const poolFree = num("poolFree");
  const tileAchieved = val<number>("tileAchieved", 0) ?? 0;
  const moveCount = val<number>("moveCount", 0) ?? 0;
  const commitment = str("commitment", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const lastPayoutFixed8 = val<bigint>("lastPayoutFixed8", 0n) ?? 0n;
  const lastElapsedMs = val<number>("lastElapsedMs", 0) ?? 0;
  const lastStatus = str("lastStatus", "");
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isMoving = bool("isMoving");
  const inputSyncFailed = bool("inputSyncFailed");
  const isRecovering = bool("isRecovering");
  const isConnectingWallet = bool("isConnectingWallet");
  const walletConnected = bool("walletConnected");
  const appMode = str("appMode", "guest");
  const isGuest = appMode === "guest";
  const board = val<number[][]>("board", []) ?? [];

  const rule = isGuest ? guestRuleOf(gameDifficulty) : ruleFor(gameDifficulty);
  const routeRuleFor = (difficulty: number) => isGuest
    ? guestRuleOf(difficulty)
    : ruleFor(difficulty);
  const isPlaying = status === "dealt";
  const isSolved = status === "solved";
  const isExpired = status === "expired" || status === "refunded";
  const isCommitted = status === "committed";
  // Unknown can also mean the start transaction was broadcast without an
  // observed GameStarted event, so recovery must stay available before the
  // game id is known locally.
  const settlementPending = status === "unknown";
  const nowMs = useNowMs(1000, {
    enabled: status === "dealt" || status === "committed" || status === "unknown",
    resetKey: `${status}|${deadline}`,
  });
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const elapsedMs = dealtAt > 0 ? Math.max(0, nowMs - dealtAt) : 0;
  const canReleaseStuck =
    !isGuest
    && activeGameId !== "0"
    && deadline > 0
    && nowMs > deadline + SETTLE_GRACE_MS
    && (isPlaying || isCommitted || settlementPending);
  const busy = isStarting || isDealing || isSubmitting || isMoving || isRecovering || isConnectingWallet;

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (status !== "dealt") {
      setA11ySelectedCell(null);
      // Do not carry a transient "moving" announcement into the result/lobby
      // state after the guest timer settles the run.
      setA11yMessage("");
    }
    if (status === "idle") setA11yDifficulty(gameDifficulty);
  }, [gameDifficulty, status]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  };

  const sceneLabels = {
    eyebrow: isGuest ? t("canvasGuestEyebrow") : t("canvasEyebrow"),
    title: t("appEyebrow"),
    tagline: isGuest ? t("canvasGuestTagline") : t("canvasTagline"),
    difficultyNames: DIFFICULTY_KEYS.map((key) => t(`difficulty_${key}`)),
    routeTitle: DIFFICULTY_KEYS.map((key) =>
      t("canvasRouteTitle", { difficulty: t(`difficulty_${key}`) }),
    ),
    reachTarget: t("canvasReachTarget"),
    routeGoal: t("canvasCardTarget"),
    entryLabel: t("entryLabel"),
    localRun: t("guestRunLabel"),
    freePractice: t("canvasFreePractice"),
    buildRealm: t("canvasBuildRealm"),
    connectWallet: t("canvasConnectWallet"),
    connectingWallet: t("canvasConnectingWallet"),
    building: t("canvasBuilding"),
    gameFiUnavailable: t("gameFiMaintenanceShort"),
    buildingNames: Object.fromEntries(
      TILE_VALUES.filter((value) => value > 0).map((value) => [String(value), t(`building_${value}`)]),
    ),
    localPracticeStatus: t("canvasLocalPracticeStatus"),
    connectStatus: t("canvasConnectStatus"),
    poolLow: t("canvasPoolLow"),
    entryReward: t("canvasEntryReward"),
    timeLimit: t("canvasTimeLimit"),
    timeLimitSeconds: t("canvasSecondsLimit"),
    preparing: t("canvasPreparing"),
    sealing: t("canvasSealing"),
    opening: t("canvasOpening"),
    settlementTitle: t("canvasSettlementTitle"),
    settlementHint: t("canvasSettlementHint"),
    retryDeal: t("checkDealAgain"),
    checkSettlement: t("checkSettlementAction"),
    releaseGame: t("releaseAction"),
    time: t("canvasTime"),
    target: t("canvasTarget"),
    moves: t("canvasMoves"),
    best: t("canvasBest"),
    bestUnset: t("canvasBestUnset"),
    selectTile: t("canvasSelectTile"),
    selectDestination: t("canvasSelectDestination"),
    moving: t("canvasMoving"),
    syncFailed: t("statusInputSyncFailed"),
    targetReached: t("canvasTargetReached"),
    finishLocal: t("canvasFinishLocal"),
    claimReward: t("submitAction"),
    proofWarming: t("canvasProofWarming"),
    playAgain: t("canvasPlayAgain"),
    buildNext: t("canvasBuildNext"),
    guestVictory: t("canvasGuestVictory"),
    victory: t("canvasVictory"),
    runOver: t("canvasRunOver"),
    timeUp: t("canvasTimeUp"),
    localSaved: t("canvasLocalSaved"),
    reward: t("canvasReward"),
    bestTile: t("canvasBestTile"),
  };

  // ── Bridge state pushed into the Phaser scene ─────────────────────────────
  const bridgeState = {
    gameStatus:      status,
    activeGameId,
    board,
    moveCount,
    tileAchieved,
    gameDifficulty,
    deadline,
    dealtAt,
    isStarting,
    isDealing,
    isSubmitting,
    isMoving,
    inputSyncFailed,
    isRecovering,
    isConnectingWallet,
    canReleaseStuck,
    settlementPending,
    walletConnected,
    poolFree,
    credit:          creditGas,
    lastPayoutFixed8:Number(lastPayoutFixed8),
    lastElapsedMs,
    lastStatus,
    // Play mode (guest | gamefi) — lets the scene drop pool gating + GAS copy in
    // guest while keeping the GAMEFI lobby/HUD exactly as-is.
    appMode,
    gameFiNewEntriesEnabled: GAMEFI_NEW_ENTRIES_ENABLED,
    sceneLabels,
  };

  // ── Derive UI state for PlayStage chrome ──────────────────────────────────
  const stageTitle = settlementPending
    ? t("statusSettlementPending")
    : isPlaying
    ? t("tileTarget", { tile: rule.targetTile })
    : isSolved
      ? t("statusWonTitle")
      : isExpired
        ? isGuest ? t("canvasRunOver") : t("statusExpired")
        : isCommitted
          ? t("statusShuffling")
        : t("lobbyTitle");

  const scoreItems = isPlaying || isSolved || isExpired
    ? [
        isGuest
          // Guest has no stake — surface local framing instead of "REWARD AT STAKE".
          ? { label: t("guestRunLabel"), value: t("guestRunValue"), accent: true }
          : { label: t("scoreReward"), value: `${gasDisplay(rule.reward)} GAS`, accent: true },
        { label: t("scoreTile"), value: `${tileAchieved}/${rule.targetTile}` },
        {
          label: t("scoreTime"),
          value: isPlaying
            ? formatClock(remainingMs)
            : formatClock(lastElapsedMs > 0 ? lastElapsedMs : rule.limitMs),
        },
      ]
    : isGuest
      ? [
          { label: t("guestRunLabel"), value: t("guestRunValue"), accent: true },
          { label: t("scoreTile"), value: `0/${rule.targetTile}` },
          { label: t("scoreTime"), value: formatClock(rule.limitMs) },
        ]
      : [
          { label: t("scoreReward"), value: `${gasDisplay(rule.reward)} GAS`, accent: true },
          { label: t("poolLabel"), value: gasLabel(poolFree) },
          { label: t("creditLabel"), value: gasLabel(creditGas) },
        ];

  const buildingName = (value: number) => value > 0 ? t(`building_${value}`) : "";
  const a11yCanMove = isPlaying
    && !busy
    && !inputSyncFailed
    && (deadline <= 0 || remainingMs > 0);
  const activateA11yCell = (row: number, col: number) => {
    if (!a11yCanMove) return;
    const value = Number(board[row]?.[col] ?? 0);
    const next = { row, col };
    if (!a11ySelectedCell) {
      if (value <= 0) {
        setA11yMessage(t("a11yMoveRejected"));
        return;
      }
      setA11ySelectedCell(next);
      setA11yMessage(t("a11ySelected"));
      return;
    }
    if (a11ySelectedCell.row === row && a11ySelectedCell.col === col) {
      setA11ySelectedCell(null);
      setA11yMessage(t("canvasSelectTile"));
      return;
    }
    if (classifyMove(board, a11ySelectedCell, next)) {
      const from = a11ySelectedCell;
      setA11ySelectedCell(null);
      setA11yMessage(t("canvasMoving"));
      void dispatch("recordMove", from.row, from.col, row, col).catch(() => {
        setA11yMessage(t("statusInputSyncFailed"));
      });
      return;
    }
    if (value > 0) {
      setA11ySelectedCell(next);
      setA11yMessage(t("a11ySelected"));
      return;
    }
    setA11yMessage(t("a11yMoveRejected"));
  };

  const targetReached = tileAchieved >= rule.targetTile;
  const proofReady = isGuest || (dealtAt > 0 && elapsedMs >= rule.minSolveMs);
  const a11yCanFinish = isPlaying && targetReached && remainingMs > 0 && proofReady && !busy;
  const a11yStatus = a11yMessage
    || (inputSyncFailed ? t("statusInputSyncFailed") : "")
    || lastStatus
    || (isPlaying
      ? `${t("canvasMoves", { count: moveCount })} · ${t("canvasTarget", {
          current: tileAchieved,
          target: rule.targetTile,
        })}`
      : isGuest ? t("guestStartHint") : t("gameFiMaintenanceBody"));
  const drawerTitle = t("drawerTitle");
  const drawerId = "merge-kingdom-ingame-drawer";
  const drawerContent = (
    <div className="mk-drawer">
      <div className="mk-drawer__inner">
        <div className="mk-drawer__head">
          <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
          <p>{isGuest ? t("guestModeLine") : t("leaderboardIntro")}</p>
          <button
            ref={drawerCloseRef}
            type="button"
            className="mk-drawer__close"
            onClick={closeDrawer}
            aria-label={t("closeDrawer")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {!isGuest && (settlementPending || isCommitted || canReleaseStuck || inputSyncFailed) && (
          <section className="mk-drawer__actions" aria-label={t("recoveryActionsLabel")}>
            {settlementPending && (
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("refreshGame")}
                disabled={isRecovering}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{isRecovering ? t("checkingSettlement") : t("checkSettlementAction")}</span>
              </button>
            )}
            {isCommitted && !isDealing && (
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("retryDeal")}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{t("checkDealAgain")}</span>
              </button>
            )}
            {inputSyncFailed && !settlementPending && (
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("refreshGame")}
                disabled={isRecovering}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{t("recoverRunAction")}</span>
              </button>
            )}
            {canReleaseStuck && (
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("expireGame")}
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>{t("releaseAction")}</span>
              </button>
            )}
            <p>{settlementPending ? t("checkSettlementHint") : t("recoveryHint")}</p>
          </section>
        )}

        <div className="mk-drawer__summary" aria-label={t("drawerSummaryLabel")}>
          <div>
            <span>{t("rankLabel")}</span>
            <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
          </div>
          <div>
            <span>{isGuest ? t("guestBestLabel") : t("scoreWon")}</span>
            <strong>{isGuest ? `${myTotalWon}` : gasLabel(myTotalWon)}</strong>
          </div>
          <div>
            <span>{isGuest ? t("guestClearsLabel") : t("historyTitle")}</span>
            <strong>{isGuest
              ? t("guestClearsCount", { count: mySolves })
              : t("solvesCount", { count: mySolves })}</strong>
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
              <strong>{gasLabel(creditGas)}</strong>
            </div>
          )}
        </div>

        {!isGuest && creditGas > 0 && !isPlaying && (
          <section className="mk-drawer__credit" aria-label={t("withdrawTitle")}>
            <span>
              <small>{t("withdrawHint")}</small>
              <strong>{gasLabel(creditGas)}</strong>
            </span>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("withdrawWinnings")}
            >
              <WalletCards size={16} aria-hidden="true" />
              <span>{t("withdrawTitle")}</span>
            </button>
          </section>
        )}

        <section className="mk-drawer__section">
          <div className="mk-drawer__section-head">
            <Trophy size={16} aria-hidden="true" />
            <h4>{t("leaderboardTitle")}</h4>
          </div>
          <ol className="mk-ranks">
            {leaderboard.slice(0, 8).map((entry) => (
              <li key={entry.address} className="mk-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                <span className="mk-ranks__rank">#{entry.rank}</span>
                <span className="mk-ranks__addr">{shortHash(entry.address)}</span>
                <span className="mk-ranks__solves">
                  {isGuest ? t("guestScoreLabel") : t("solvesCount", { count: entry.solves })}
                </span>
                <span className="mk-ranks__won">{isGuest ? `${entry.totalWon}` : gasLabel(entry.totalWon)}</span>
                {entry.isUser && <span className="mk-ranks__me">{t("youTag")}</span>}
              </li>
            ))}
          </ol>
          {leaderboard.length === 0 && (
            <p className="mk-drawer__empty">{t("leaderboardEmpty")}</p>
          )}
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost mk-ranks__refresh"
            onClick={() => void dispatch("refreshLeaderboard")}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{t("refreshRanks")}</span>
          </button>
        </section>

        <section className="mk-drawer__section">
          <div className="mk-drawer__section-head">
            <Trophy size={16} aria-hidden="true" />
            <h4>{t("historyTitle")}</h4>
          </div>
          <ul className="mk-history">
            {myHistory.slice(0, 8).map((row) => (
              <li key={row.gameId} className="mk-history__row">
                <span>{difficultyLabel(t, row.difficulty)}</span>
                <span>{t("tileAchieved", { tile: Number(row.tileAchieved ?? 0) })}</span>
                <span>{formatClock(row.solveMs)}</span>
                <strong>{historyResult(t, row, isGuest)}</strong>
              </li>
            ))}
          </ul>
          {myHistory.length === 0 && (
            <p className="mk-drawer__empty">{t("historyEmpty")}</p>
          )}
        </section>

        <section className="mk-drawer__section mk-drawer__fairness">
          <div className="mk-drawer__section-head">
            <ShieldCheck size={16} aria-hidden="true" />
            <h4>{isGuest ? t("guestRulesTitle") : t("fairnessTitle")}</h4>
          </div>
          {isGuest ? (
            <p>{t("guestRulesCopy")}</p>
          ) : (
            <>
              <p>{t("rulesCopy")}</p>
              <p>{t("fairnessCopy")}</p>
            </>
          )}
          {!isGuest && commitment && (
            <p className="mk-drawer__seed">
              {t("commitmentLine", {
                gameId: activeGameId,
                commitment: shortHash(commitment, 12, 8),
              })}
            </p>
          )}
          {!isGuest && (isSolved || isExpired) && (
            <p className="mk-drawer__seed">
              {t("lastResultLine", {
                payout: fixed8Label(lastPayoutFixed8),
                time: formatClock(lastElapsedMs),
              })}
            </p>
          )}
          {isPlaying && (
            <p className="mk-drawer__seed">
              {t("activeRouteLine", {
                route: difficultyLabel(t, gameDifficulty),
                moves: moveCount,
                target: rule.targetTile,
                time: formatClock(remainingMs || elapsedMs),
              })}
            </p>
          )}
        </section>
      </div>
    </div>
  );

  return (
    <div className="mk-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="mk-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestModeLine") : t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {isGuest ? t("guestRunValue") : t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <div className="mk-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadMergeKingdomScene}
              state={bridgeState}
              dispatch={dispatch}
              className="mk-phaser-canvas"
              ariaLabel={t("gameAriaLabel")}
              loadingLabel={t("gameLoadingLabel")}
            />
            <div
              className="mk-a11y-controls"
              aria-label={t("a11yControlsLabel")}
              onKeyDownCapture={(event) => {
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                  event.stopPropagation();
                }
              }}
            >
              {(status === "idle" || isSolved || isExpired) && (
                <>
                  <span id="mk-a11y-route-label">{t("difficultyTitle")}</span>
                  <div role="radiogroup" aria-labelledby="mk-a11y-route-label">
                    {DIFFICULTY_KEYS.map((key, index) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={a11yDifficulty === index}
                        onClick={() => {
                          setA11yDifficulty(index);
                          void dispatch("selectDifficulty", index);
                        }}
                        disabled={busy}
                      >
                        {t(`difficulty_${key}`)} · {buildingName(routeRuleFor(index).targetTile)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mk-a11y-controls__primary"
                    disabled={busy || (!isGuest && !GAMEFI_NEW_ENTRIES_ENABLED)}
                    onClick={() => void dispatch("startGame", a11yDifficulty)}
                  >
                    {isGuest
                      ? t("a11yStartRun", { difficulty: difficultyLabel(t, a11yDifficulty) })
                      : t("gameFiMaintenanceShort")}
                  </button>
                </>
              )}

              {isPlaying && (
                <>
                  <div className="mk-a11y-board" role="group" aria-label={t("a11yBoardLabel")}>
                    {Array.from({ length: 16 }, (_, index) => {
                      const row = Math.floor(index / 4);
                      const col = index % 4;
                      const value = Number(board[row]?.[col] ?? 0);
                      const selected = a11ySelectedCell?.row === row && a11ySelectedCell.col === col;
                      const label = value > 0
                        ? t("tileOccupied", {
                            name: `${buildingName(value)} ${value}`,
                            row: row + 1,
                            col: col + 1,
                          })
                        : t("tileEmpty", { row: row + 1, col: col + 1 });
                      return (
                        <button
                          key={`${row}-${col}`}
                          type="button"
                          aria-label={label}
                          aria-pressed={selected}
                          disabled={!a11yCanMove || (!a11ySelectedCell && value <= 0)}
                          onClick={() => activateA11yCell(row, col)}
                        >
                          {value > 0 ? `${buildingName(value)} · ${value}` : t("tileEmpty", {
                            row: row + 1,
                            col: col + 1,
                          })}
                        </button>
                      );
                    })}
                  </div>
                  {targetReached && (
                    <button
                      type="button"
                      className="mk-a11y-controls__primary"
                      disabled={!a11yCanFinish}
                      onClick={() => void dispatch("submitSolution")}
                    >
                      {isGuest ? t("guestSubmitAction") : t("submitAction")}
                    </button>
                  )}
                  {deadline > 0 && remainingMs <= 0 && (
                    <button
                      type="button"
                      disabled={!isGuest && !canReleaseStuck}
                      onClick={() => void dispatch("expireGame")}
                    >
                      {isGuest ? t("canvasTimeUp") : t("releaseAction")}
                    </button>
                  )}
                </>
              )}

              {(isCommitted || settlementPending || inputSyncFailed) && !isGuest && (
                <>
                  <button
                    type="button"
                    disabled={isRecovering}
                    onClick={() => void dispatch(settlementPending || inputSyncFailed ? "refreshGame" : "retryDeal")}
                  >
                    {settlementPending
                      ? t("checkSettlementAction")
                      : inputSyncFailed ? t("recoverRunAction") : t("checkDealAgain")}
                  </button>
                  {canReleaseStuck && (
                    <button type="button" onClick={() => void dispatch("expireGame")}>
                      {t("releaseAction")}
                    </button>
                  )}
                </>
              )}

              <p id="mk-a11y-status" role="status" aria-live="polite">{a11yStatus}</p>
            </div>
            <div className="mk-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="mk-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerToggleRef}
                type="button"
                className="mk-stage-hud__drawer"
                onClick={() => drawerOpen ? closeDrawer() : setDrawerOpen(true)}
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
                  className="mk-ingame-drawer__scrim"
                  aria-label={t("closeDrawer")}
                  tabIndex={-1}
                  onClick={closeDrawer}
                />
                <section
                  id={drawerId}
                  className="mk-ingame-drawer"
                  role="dialog"
                  aria-modal="false"
                  aria-label={drawerTitle}
                >
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
