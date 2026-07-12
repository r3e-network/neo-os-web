/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Sudoku miniapp.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer path.
 * All blockchain / session logic stays in main.tsx; this component
 * bridges the observable state into SudokuScene and forwards Phaser
 * dispatch calls back to main.tsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import {
  DIFFICULTY_RULES,
  GAMEFI_NEW_ENTRIES_ENABLED,
  canExpireAfterGrace,
  formatClock,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import "./PlayArea.scss";

// GameConfig — scene array must not be readonly (satisfies Phaser.Types.Core.GameConfig)
const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

const loadSudokuScene = () =>
  import("./scenes/SudokuScene").then((module) => module.SudokuScene);
const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

function difficultyCopyKey(difficulty: number): string {
  return `difficulty_${DIFFICULTY_KEYS[difficulty] ?? "easy"}`;
}

function nextCellForKey(cell: number, key: string): number {
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  if (key === "ArrowUp" && row > 0) return cell - 9;
  if (key === "ArrowDown" && row < 8) return cell + 9;
  if (key === "ArrowLeft" && col > 0) return cell - 1;
  if (key === "ArrowRight" && col < 8) return cell + 1;
  if (key === "Home") return row * 9;
  if (key === "End") return row * 9 + 8;
  return cell;
}

interface SceneBoardSnapshot {
  entries: number[];
  given: boolean[];
  notes: number[];
  selectedCell: number;
  notesMode: boolean;
  conflicts: number[];
  complete: boolean;
}

type A11yCommandType =
  | "select-cell"
  | "digit"
  | "toggle-notes"
  | "clear-notes"
  | "undo"
  | "submit";
interface A11yCommand {
  nonce: number;
  type: A11yCommandType;
  cell?: number;
  digit?: number;
}

const EMPTY_SCENE_BOARD: SceneBoardSnapshot = {
  entries: Array(81).fill(0),
  given: Array(81).fill(false),
  notes: Array(81).fill(0),
  selectedCell: -1,
  notesMode: false,
  conflicts: [],
  complete: false,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sceneBoard, setSceneBoard] = useState<SceneBoardSnapshot>(EMPTY_SCENE_BOARD);
  const [a11yCommand, setA11yCommand] = useState<A11yCommand>({
    nonce: 0,
    type: "select-cell",
  });
  const [a11yMessage, setA11yMessage] = useState("");
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const gameStatus     = str("gameStatus", "idle");
  const activeGameId   = str("activeGameId", "0");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const clues          = str("clues", "");
  const undosUsed      = val<number>("undosUsed", 0) ?? 0;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const isUndoing      = bool("isUndoing");
  const isActing       = bool("isActing");
  const isRecovering   = bool("isRecovering");
  const inputSyncFailed = bool("inputSyncFailed");
  const rollbackNonce = val<number>("rollbackNonce", 0) ?? 0;
  const undoNonce = val<number>("undoNonce", 0) ?? 0;
  const boardRecoveryNonce = val<number>("boardRecoveryNonce", 0) ?? 0;
  const isConnectingWallet = bool("isConnectingWallet");
  const isPaused       = bool("isPaused");
  const hintsUsed      = val<number>("hintsUsed", 0) ?? 0;
  const hintCell       = val<number>("hintCell", -1) ?? -1;
  const hintDigit      = val<number>("hintDigit", 0) ?? 0;
  const hintNonce      = val<number>("hintNonce", 0) ?? 0;
  const settlementGraceMs = val<number>("settlementGraceMs", 600_000) ?? 600_000;
  const lastStatus     = str("lastStatus", t("statusReady"));
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const walletConnected = bool("walletConnected");
  const progressionReady = bool("progressionReady");
  const progressionRequiredDifficulty =
    val<number>("progressionRequiredDifficulty", 0) ?? 0;
  // Play mode (guest | gamefi). Guest is a plain local puzzle, so every
  // GAS-at-stake / pool / reward label is swapped for local framing while the
  // GAMEFI copy stays exactly as-is.
  const isGuest        = str("appMode", "guest") === "guest";

  const sceneDispatch = useCallback((action: string, ...args: unknown[]) => {
    if (action === "sudokuBoardState") {
      const snapshot = args[0] as Partial<SceneBoardSnapshot> | undefined;
      if (
        snapshot &&
        Array.isArray(snapshot.entries) && snapshot.entries.length === 81 &&
        Array.isArray(snapshot.given) && snapshot.given.length === 81 &&
        Array.isArray(snapshot.notes) && snapshot.notes.length === 81
      ) {
        const next: SceneBoardSnapshot = {
          entries: snapshot.entries.map((value) => Number(value) || 0),
          given: snapshot.given.map(Boolean),
          notes: snapshot.notes.map((value) => Number(value) || 0),
          selectedCell: Number.isInteger(snapshot.selectedCell) ? Number(snapshot.selectedCell) : -1,
          notesMode: Boolean(snapshot.notesMode),
          conflicts: Array.isArray(snapshot.conflicts)
            ? snapshot.conflicts.filter((value) => Number.isInteger(value)).map(Number)
            : [],
          complete: Boolean(snapshot.complete),
        };
        setSceneBoard(next);
        setA11yMessage(
          next.conflicts.length > 0
            ? t("conflictMessage")
            : next.complete
              ? t("boardReadyMessage")
              : next.selectedCell >= 0
                ? t("a11ySelectedCell", {
                    row: Math.floor(next.selectedCell / 9) + 1,
                    col: (next.selectedCell % 9) + 1,
                  })
                : "",
        );
      }
      return;
    }
    return dispatch(action, ...args);
  }, [dispatch, t]);

  const sendA11yCommand = useCallback((
    type: A11yCommandType,
    payload: { cell?: number; digit?: number } = {},
  ) => {
    setA11yCommand((current) => ({ nonce: current.nonce + 1, type, ...payload }));
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    if (
      deadline <= 0 ||
      (gameStatus !== "dealt" && gameStatus !== "unknown" && gameStatus !== "committed")
    ) {
      return undefined;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadline, gameStatus]);

  useEffect(() => {
    if (gameStatus === "dealt") return;
    setSceneBoard(EMPTY_SCENE_BOARD);
    setA11yMessage("");
  }, [gameStatus]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const handleDrawerKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleDrawerKeydown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleDrawerKeydown);
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  };

  // Pre-translated canvas strings. BaseScene reads only bridge state, so every
  // label the Phaser scene draws is localised here and handed over as a plain
  // object under `labels` — new bridge data only, no renamed/removed keys.
  const canvasLabels = {
    vaultTitle: t("lobbyVaultTitle"),
    vaultSub: isGuest ? t("guestVaultSub") : t("lobbyVaultSub"),
    diffNames: [t("diffName_0"), t("diffName_1"), t("diffName_2")],
    diffCopy: [t("difficulty_easy"), t("difficulty_medium"), t("difficulty_hard")],
    diffRewards: isGuest
      ? DIFFICULTY_RULES.map(() => t("guestDiffTag"))
      : DIFFICULTY_RULES.map((r) => `${gasDisplay(r.rewardFixed8)} GAS`),
    sealing: t("statusShuffling"),
    undoTemplate: t("undoLeftTemplate"),
    undoNone: t("undoNoneLabel"),
    undo: t("undoShort"),
    notes: t("notesShort"),
    notesOn: t("notesOnShort"),
    erase: t("eraseNotesShort"),
    hint: t("hintShort"),
    hintTemplate: t("hintLeftTemplate"),
    pause: t("pauseShort"),
    resume: t("resumeShort"),
    restart: t("restartShort"),
    pausedTitle: t("pausedTitle"),
    pausedCopy: t("pausedCopy"),
    conflict: t("conflictMessage"),
    selectCell: t("selectCellMessage"),
    givenLocked: t("givenLockedMessage"),
    placedLocked: t("placedLockedMessage"),
    eraseFirst: t("eraseFirstMessage"),
    keyboardHelp: t("keyboardHelp"),
    syncFailed: t("statusInputSyncFailed"),
    gameFiUnavailable: t("gameFiMaintenanceBody"),
    boardReady: t("boardReadyMessage"),
    poolTemplate: isGuest ? t("guestPoolLine") : t("poolLimitTemplate"),
    gateConnect: t("gateConnect"),
    gateChecking: t("gateChecking"),
    gateRouteLocked: t("gateRouteLockedTemplate"),
    gatePoolLow: t("gatePoolLowTemplate"),
    gateChoose: isGuest ? t("guestGateChoose") : t("gateChoose"),
    act: {
      open: t("startAction"),
      playAgain: t("playAgainAction"),
      tryAgain: t("tryAgainAction"),
      starting: t("startingShort"),
      connect: t("connectWalletAction"),
      maintenance: t("gameFiMaintenanceShort"),
      routeLocked: t("routeLockedAction"),
      poolLow: t("poolLowShort"),
      submit: t("submitAction"),
      submitting: t("submittingShort"),
      working: t("workingShort"),
      timeUp: t("timeUpAction"),
      tooLate: t("tooLateAction"),
      wait: t("waitToSubmitAction"),
      solve: t("solveToUnlockAction"),
      recover: t("recoverAction"),
    },
    msg: {
      deadlinePassed: t("deadlinePassedMsg"),
      deadlineClose: t("deadlineCloseMsg"),
      submitUnlock: t("submitUnlockTemplate"),
      graceWait: t("graceWaitTemplate"),
      settlementPending: t("statusSettlementPending"),
    },
    resultSolved: isGuest ? t("guestResultSolved") : t("resultCaptionSolved"),
    resultExpired: isGuest ? t("guestResultExpired") : t("resultCaptionExpired"),
  };

  // Plain-object snapshot pushed into the Phaser bridge on every render
  const bridgeState = {
    activeGameId,
    gameStatus,
    gameDifficulty,
    clues,
    undosUsed,
    deadline,
    dealtAt,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    isActing,
    isRecovering,
    inputSyncFailed,
    rollbackNonce,
    undoNonce,
    boardRecoveryNonce,
    isConnectingWallet,
    isPaused,
    hintsUsed,
    hintCell,
    hintDigit,
    hintNonce,
    settlementGraceMs,
    lastStatus,
    walletConnected,
    credit: creditGas,
    progressionReady,
    progressionRequiredDifficulty,
    appMode: isGuest ? "guest" : "gamefi",
    gameFiNewEntriesEnabled: GAMEFI_NEW_ENTRIES_ENABLED,
    a11yCommand,
    labels: canvasLabels,
  };

  // Stage title follows game phase
  const stageTitle =
    isSubmitting                              ? t("submittingTitle")
    : isDealing || gameStatus === "committed" ? t("statusShuffling")
    : gameStatus === "dealt"                  ? t("playingTitle", { difficulty: t(difficultyCopyKey(gameDifficulty)) })
    : gameStatus === "solved"                 ? t("statusWonTitle")
    : gameStatus === "expired"                ? (isGuest ? t("guestResultExpired") : t("expiredBanner"))
    : gameStatus === "unknown"                ? t("settlementPendingTitle")
    : isGuest                                 ? t("guestLobbyTitle")
    : t("lobbyTitle");

  const hasCredit =
    (gameStatus === "expired" || gameStatus === "solved") && creditGas > 0;
  const remainMs = deadline > 0 ? deadline - nowMs : 0;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;
  const canRelease = !isGuest && activeGameId !== "0" &&
    canExpireAfterGrace(deadline, nowMs, settlementGraceMs);
  const busy = isStarting || isDealing || isSubmitting || isUndoing ||
    isActing || isRecovering || isConnectingWallet;
  const rule = ruleOf(gameDifficulty);
  const submitUnlocked = isGuest || (dealtAt > 0 && nowMs - dealtAt >= rule.minSolveMs + 10_000);
  const hasLiveGame = gameStatus !== "idle";
  const drawerActions = [
    ...(gameStatus === "committed" && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          icon:    <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("retryDeal", {}),
        }]
      : []),
    ...(gameStatus === "unknown"
      ? [{
          label: t("recoverAction"),
          icon: <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("recoverGame", {}),
        }]
      : []),
    ...(!isGuest && inputSyncFailed && gameStatus !== "unknown"
      ? [{
          label: t("recoverAction"),
          icon: <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("recoverGame", {}),
        }]
      : []),
    ...(canRelease
      ? [{
          label:   t("releaseAction"),
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame", {}),
        }]
      : []),
    ...(isGuest && gameStatus === "dealt"
      ? [{
          label: isPaused ? t("resumeShort") : t("pauseShort"),
          icon: isPaused
            ? <Play size={16} aria-hidden="true" />
            : <Pause size={16} aria-hidden="true" />,
          onClick: () => void dispatch("togglePause", {}),
        }, {
          label: t("restartShort"),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("restartGame", { difficulty: gameDifficulty }),
        }]
      : []),
    ...(!isGuest && hasCredit
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon:    <WalletCards size={16} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
        }]
      : []),
  ];
  const hudItems = [
    isGuest
      ? {
          // Guest has no stake — surface local framing instead of a GAS reward.
          label: t("guestRunLabel"),
          value: t("guestRunValue"),
          accent: true,
        }
      : {
          label: t("rewardMetric"),
          value: `${gasDisplay(rule.rewardFixed8)} GAS`,
          accent: true,
        },
    {
      label: t("timeMetric"),
      value: gameStatus === "dealt" && deadline > 0
        ? formatClock(deadline - nowMs)
        : formatClock(rule.limitMs),
      accent: timeUp,
    },
    isGuest
      ? {
          label: t("hintsMetric"),
          value: hasLiveGame ? `${Math.max(0, 3 - hintsUsed)}/3` : "3/3",
          accent: false,
        }
      : {
          label: t("undosMetric"),
          value: hasLiveGame ? `${Math.max(0, 3 - undosUsed)}/3` : "3/3",
          accent: false,
        },
  ];

  return (
    <div className="sudoku-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="sudoku-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestModeValue") : t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="sudoku-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadSudokuScene}
              state={bridgeState}
              dispatch={sceneDispatch}
              className="sudoku-phaser-canvas"
              ariaLabel={t("canvasAriaLabel")}
              loadingLabel={t("canvasLoadingLabel")}
            />
            <div className="sudoku-a11y-controls" aria-label={t("a11yControlsLabel")}>
              {gameStatus === "dealt" ? (
                <>
                  <div
                    className="sudoku-a11y-board"
                    role="group"
                    aria-label={t("a11yBoardLabel")}
                  >
                    {sceneBoard.entries.map((value, cell) => {
                      const row = Math.floor(cell / 9) + 1;
                      const col = (cell % 9) + 1;
                      const notes = sceneBoard.notes[cell] ?? 0;
                      const noteDigits = Array.from({ length: 9 }, (_, index) => index + 1)
                        .filter((digit) => (notes & (1 << digit)) !== 0)
                        .join(", ");
                      const conflict = sceneBoard.conflicts.includes(cell);
                      const baseLabel = sceneBoard.given[cell]
                        ? t("a11yCellGiven", { row, col, digit: value })
                        : value > 0
                          ? t("a11yCellPlaced", { row, col, digit: value })
                          : t("a11yCellEmpty", { row, col });
                      const label = [
                        baseLabel,
                        noteDigits ? t("a11yCellNotes", { notes: noteDigits }) : "",
                        conflict ? t("a11yCellConflict") : "",
                      ].filter(Boolean).join(". ");
                      return (
                        <button
                          type="button"
                          key={cell}
                          aria-label={label}
                          aria-pressed={sceneBoard.selectedCell === cell}
                          data-sudoku-cell={cell}
                          disabled={busy || isPaused || inputSyncFailed || timeUp}
                          tabIndex={
                            sceneBoard.selectedCell === cell ||
                            (sceneBoard.selectedCell < 0 && cell === 0)
                              ? 0
                              : -1
                          }
                          onClick={() => sendA11yCommand("select-cell", { cell })}
                          onKeyDown={(event) => {
                            const next = nextCellForKey(cell, event.key);
                            if (next === cell) return;
                            event.preventDefault();
                            sendA11yCommand("select-cell", { cell: next });
                            const target = event.currentTarget.parentElement
                              ?.querySelector<HTMLButtonElement>(`[data-sudoku-cell="${next}"]`);
                            target?.focus();
                          }}
                        >
                          {value > 0 ? value : noteDigits || "·"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="sudoku-a11y-pad" aria-label={t("a11yDigitPadLabel")}>
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
                      <button
                        type="button"
                        key={digit}
                        aria-label={sceneBoard.notesMode
                          ? t("padNoteLabel", { digit })
                          : t("padPlaceLabel", { digit })}
                        disabled={
                          busy || isPaused || inputSyncFailed || timeUp ||
                          sceneBoard.selectedCell < 0 ||
                          sceneBoard.given[sceneBoard.selectedCell] ||
                          (!isGuest && (sceneBoard.entries[sceneBoard.selectedCell] ?? 0) > 0) ||
                          (sceneBoard.notesMode && (sceneBoard.entries[sceneBoard.selectedCell] ?? 0) > 0)
                        }
                        onClick={() => sendA11yCommand("digit", { digit })}
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                  <div className="sudoku-a11y-actions">
                    <button
                      type="button"
                      aria-pressed={sceneBoard.notesMode}
                      disabled={busy || isPaused || inputSyncFailed || timeUp}
                      onClick={() => sendA11yCommand("toggle-notes")}
                    >
                      {sceneBoard.notesMode ? t("notesOnShort") : t("notesShort")}
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy || isPaused || inputSyncFailed ||
                        sceneBoard.selectedCell < 0 ||
                        (
                          (sceneBoard.notes[sceneBoard.selectedCell] ?? 0) === 0 &&
                          !(
                            isGuest &&
                            !sceneBoard.given[sceneBoard.selectedCell] &&
                            (sceneBoard.entries[sceneBoard.selectedCell] ?? 0) > 0
                          )
                        )
                      }
                      onClick={() => sendA11yCommand("clear-notes")}
                    >
                      {t("eraseNotesShort")}
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy || isPaused || inputSyncFailed || (!isGuest && undosUsed >= 3) ||
                        !sceneBoard.entries.some((value, cell) => value > 0 && !sceneBoard.given[cell])
                      }
                      onClick={() => sendA11yCommand("undo")}
                    >
                      {isGuest
                        ? t("undoShort")
                        : t("undoLeftTemplate", { left: Math.max(0, 3 - undosUsed) })}
                    </button>
                    {isGuest && (
                      <button
                        type="button"
                        disabled={
                          busy || isPaused || hintsUsed >= 3 || sceneBoard.selectedCell < 0 ||
                          (sceneBoard.entries[sceneBoard.selectedCell] ?? 0) > 0
                        }
                        onClick={() => void dispatch("requestHint", { cell: sceneBoard.selectedCell })}
                      >
                        {t("hintLeftTemplate", { left: Math.max(0, 3 - hintsUsed) })}
                      </button>
                    )}
                    {isGuest && (
                      <button type="button" onClick={() => void dispatch("togglePause", {})}>
                        {isPaused ? t("resumeShort") : t("pauseShort")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={
                        !sceneBoard.complete || !submitUnlocked || busy || isPaused ||
                        inputSyncFailed || timeUp || (!isGuest && remainMs <= 15_000)
                      }
                      onClick={() => sendA11yCommand("submit")}
                      className="sudoku-a11y-submit-proxy"
                    >
                      {t("submitAction")}
                    </button>
                  </div>
                </>
              ) : gameStatus === "unknown" || gameStatus === "committed" ? (
                <button
                  type="button"
                  disabled={busy || isGuest}
                  onClick={() => void dispatch(gameStatus === "committed" ? "retryDeal" : "recoverGame", {})}
                >
                  {gameStatus === "committed" ? t("checkDealAgain") : t("recoverAction")}
                </button>
              ) : (
                <>
                  <div role="radiogroup" aria-label={t("difficultyTitle")}>
                    {[0, 1, 2].map((difficulty) => (
                      <button
                        type="button"
                        role="radio"
                        key={difficulty}
                        aria-checked={gameDifficulty === difficulty}
                        disabled={busy}
                        onClick={() => void dispatch("selectDifficulty", { difficulty })}
                      >
                        {t(`diffName_${difficulty}`)} · {t(difficultyCopyKey(difficulty))}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy || (!isGuest && !GAMEFI_NEW_ENTRIES_ENABLED)}
                    onClick={() => void dispatch("startGame", { difficulty: gameDifficulty })}
                  >
                    {isGuest ? t("a11yStartGuest", { difficulty: t(`diffName_${gameDifficulty}`) }) : t("startAction")}
                  </button>
                </>
              )}
              <p role="status" aria-live="polite">
                {isPaused
                  ? t("pausedTitle")
                  : inputSyncFailed
                    ? t("statusInputSyncFailed")
                    : a11yMessage || lastStatus}
              </p>
            </div>
            <p className="sudoku-sr-status" aria-live="polite">
              {lastStatus} {gameStatus === "dealt" ? t("keyboardHelp") : ""}
            </p>
            <div className="sudoku-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="sudoku-stage-hud__metric"
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
                className="sudoku-stage-hud__drawer"
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
                className="sudoku-ingame-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("drawerTitle")}
              >
                <div className="sudoku-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{isGuest ? t("guestFairnessShort") : t("fairnessShort")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="sudoku-ingame-drawer__close"
                    onClick={closeDrawer}
                    aria-label={t("closeDrawer")}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="sudoku-ingame-drawer__grid">
                  {isGuest ? (
                    <>
                      <span>
                        <small>{t("guestModeLabel")}</small>
                        <strong>{t("guestModeValue")}</strong>
                      </span>
                      <span>
                        <small>{t("guestBestLabel")}</small>
                        <strong>{myTotalWon}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <small>{t("creditLabel")}</small>
                        <strong>{creditGas.toFixed(2)} GAS</strong>
                      </span>
                      <span>
                        <small>{t("scoreWon")}</small>
                        <strong>{myTotalWon.toFixed(2)} GAS</strong>
                      </span>
                    </>
                  )}
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{deadline > 0 ? formatClock(remainMs) : "--"}</strong>
                  </span>
                  <span>
                    <small>{isGuest ? t("hintsMetric") : t("scoreUndos")}</small>
                    <strong>
                      {isGuest
                        ? `${Math.max(0, 3 - hintsUsed)}/3`
                        : `${Math.max(0, 3 - undosUsed)}/3`}
                    </strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="sudoku-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={() => {
                          action.onClick();
                          closeDrawer();
                        }}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="sudoku-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{isGuest ? t("guestRulesShort") : t("rulesShort")}</p>
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
