/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Gomoku miniapp.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { MAX_UNDOS, formatClock, ruleOf } from "./logic/game-rules";
import { BOARD_SIZE, CELL_COUNT } from "./logic/gomoku-engine";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 420,
  height: 620,
  backgroundColor: "transparent",
  transparent: true,
};

const loadGomokuScene = () =>
  import("./scenes/GomokuScene").then((module) => module.GomokuScene);

const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

function difficultyCopyKey(difficulty: number): string {
  return `difficulty_${DIFFICULTY_KEYS[difficulty] ?? "easy"}`;
}

/**
 * The scene publishes its board through `lastStatus` as a `boardUpdate` frame so the
 * keyboard layer below reads the same state the canvas draws — no second source of truth.
 */
type BoardFrame = {
  cells: readonly number[];
  currentTurn: number;
  gameOver: boolean;
  moves: number;
};

/** Decode a scene frame, rejecting anything that is not a full 225-cell board. */
function parseBoardFrame(raw: string): BoardFrame | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const frame = parsed as Record<string, unknown>;
  if (frame.type !== "boardUpdate") return null;
  const board = frame.board;
  if (typeof board !== "string" || board.length !== CELL_COUNT) return null;

  const cells: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const digit = Number(board.charAt(cell));
    cells.push(digit === 1 || digit === 2 ? digit : 0);
  }

  const currentTurn = Number(frame.currentTurn);
  const moves = Number(frame.moves);
  return {
    cells,
    currentTurn: currentTurn === 2 ? 2 : 1,
    gameOver: frame.gameOver === true,
    moves: Number.isFinite(moves) && moves > 0 ? Math.floor(moves) : 0,
  };
}

/** Arrow/Home/End navigation for the mirrored grid; edges clamp instead of wrapping. */
function nextCellForKey(cell: number, key: string): number {
  const row = Math.floor(cell / BOARD_SIZE);
  const col = cell % BOARD_SIZE;
  switch (key) {
    case "ArrowLeft":
      return row * BOARD_SIZE + Math.max(0, col - 1);
    case "ArrowRight":
      return row * BOARD_SIZE + Math.min(BOARD_SIZE - 1, col + 1);
    case "ArrowUp":
      return Math.max(0, row - 1) * BOARD_SIZE + col;
    case "ArrowDown":
      return Math.min(BOARD_SIZE - 1, row + 1) * BOARD_SIZE + col;
    case "Home":
      return row * BOARD_SIZE;
    case "End":
      return row * BOARD_SIZE + (BOARD_SIZE - 1);
    default:
      return cell;
  }
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [focusedCell, setFocusedCell] = useState(0);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const isStarting = bool("isStarting");
  const isPaused = bool("isPaused");
  const lastStatus = str("lastStatus", "");
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const isGuest = str("appMode", "guest") === "guest";

  useEffect(() => {
    setNowMs(Date.now());
    if (deadline <= 0 || gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadline, gameStatus]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  };

  // Canvas labels
  const canvasLabels = {
    lobbyTitle: t("lobbyTitle"),
    lobbySub: t("lobbySub"),
    diffNames: [t("diffName_0"), t("diffName_1"), t("diffName_2")],
    diffCopy: [t("difficulty_easy"), t("difficulty_medium"), t("difficulty_hard")],
    yourTurn: t("yourTurn"),
    aiThinking: t("aiThinking"),
    undo: t("undoShort"),
    pause: t("pauseShort"),
    resume: t("resumeShort"),
    restart: t("restartShort"),
    pausedTitle: t("pausedTitle"),
    pausedCopy: t("pausedCopy"),
    act: {
      open: t("startAction"),
      playAgain: t("playAgainAction"),
      tryAgain: t("tryAgainAction"),
      starting: t("startingShort"),
    },
    resultWin: t("resultWin"),
    resultLose: t("resultLose"),
    resultDraw: t("resultDraw"),
  };

  const bridgeState = {
    gameStatus,
    gameDifficulty,
    deadline,
    dealtAt,
    isStarting,
    isPaused,
    lastStatus,
    appMode: "guest",
    labels: canvasLabels,
  };

  const stageTitle =
    gameStatus === "dealt" ? t("playingTitle", { difficulty: t(difficultyCopyKey(gameDifficulty)) })
    : gameStatus === "solved" ? t("statusWonTitle")
    : gameStatus === "expired" ? t("statusLostTitle")
    : t("lobbyTitle");

  const rule = ruleOf(gameDifficulty);
  const remainMs = deadline > 0 ? deadline - nowMs : 0;
  const busy = isStarting;

  const hudItems = [
    { label: t("guestRunLabel"), value: t("guestRunValue"), accent: true },
    {
      label: t("timeMetric"),
      value: gameStatus === "dealt" && deadline > 0
        ? formatClock(remainMs)
        : formatClock(rule.limitMs),
      accent: false,
    },
    { label: t("winsLabel"), value: String(mySolves), accent: false },
  ];

  const drawerActions = [
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
  ];

  // Keyboard/screen-reader mirror of the canvas. The scene is the only board author; this
  // layer decodes the frame it publishes so both surfaces always agree.
  const boardFrame = useMemo(() => parseBoardFrame(lastStatus), [lastStatus]);
  const isDealt = gameStatus === "dealt";
  const boardLocked = isPaused || busy || boardFrame?.gameOver === true;
  const undosLeft = Math.max(0, MAX_UNDOS - undosUsed);
  const startLabel =
    isStarting ? t("startingShort")
    : gameStatus === "solved" ? t("playAgainAction")
    : gameStatus === "expired" ? t("tryAgainAction")
    : t("startAction");

  const boardStatusText = (() => {
    if (!isDealt) return "";
    if (!boardFrame) return t("a11yBoardPending");
    if (isPaused) return `${t("pausedTitle")} · ${t("a11yMovesPlayed", { moves: boardFrame.moves })}`;
    const turn = boardFrame.currentTurn === 2 ? t("aiThinking") : t("yourTurn");
    return `${turn} · ${t("a11yMovesPlayed", { moves: boardFrame.moves })}`;
  })();

  const cellLabel = (cell: number, stone: number): string => {
    const params = {
      row: Math.floor(cell / BOARD_SIZE) + 1,
      col: (cell % BOARD_SIZE) + 1,
    };
    if (stone === 1) return t("a11yCellBlack", params);
    if (stone === 2) return t("a11yCellWhite", params);
    return t("a11yCellEmpty", params);
  };

  /** Move the roving focus; returns false when the key does not move it (edge or unknown key). */
  const moveGridFocus = (cell: number, key: string, from: HTMLButtonElement): boolean => {
    const next = nextCellForKey(cell, key);
    if (next === cell) return false;
    setFocusedCell(next);
    from.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-gomoku-cell="${next}"]`)
      ?.focus();
    return true;
  };

  return (
    <div className="gomoku-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="gomoku-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("guestModeValue")}
            </span>
          ),
        }}
        scene={
          <div className="gomoku-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadGomokuScene}
              state={bridgeState}
              dispatch={dispatch}
              className="gomoku-phaser-canvas"
              ariaLabel={t("canvasAriaLabel")}
              loadingLabel={t("canvasLoadingLabel")}
            />
            <div className="gomoku-a11y-controls" aria-label={t("a11yControlsLabel")}>
              {isDealt ? (
                <>
                  {boardFrame && (
                    <div
                      className="gomoku-a11y-board"
                      role="group"
                      aria-label={t("a11yBoardLabel")}
                    >
                      {boardFrame.cells.map((stone, cell) => (
                        <button
                          key={cell}
                          type="button"
                          data-gomoku-cell={cell}
                          data-stone={stone > 0 ? stone : undefined}
                          aria-label={cellLabel(cell, stone)}
                          disabled={stone > 0 || boardLocked}
                          tabIndex={cell === focusedCell ? 0 : -1}
                          onFocus={() => setFocusedCell(cell)}
                          onKeyDown={(event) => {
                            if (moveGridFocus(cell, event.key, event.currentTarget)) {
                              event.preventDefault();
                            }
                          }}
                          onClick={() => void dispatch("placeStone", { cell })}
                        >
                          {stone === 1 ? "X" : stone === 2 ? "O" : "·"}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="gomoku-a11y-actions">
                    <button
                      type="button"
                      aria-label={t("a11yUndoLabel", { left: undosLeft })}
                      disabled={undosLeft === 0 || boardLocked}
                      onClick={() => void dispatch("useUndo", {})}
                    >
                      {t("undoShort")}
                    </button>
                    <button type="button" onClick={() => void dispatch("togglePause", {})}>
                      {isPaused ? t("resumeShort") : t("pauseShort")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void dispatch("restartGame", { difficulty: gameDifficulty })}
                    >
                      {t("restartShort")}
                    </button>
                  </div>
                  <p className="gomoku-a11y-status" role="status" aria-live="polite">
                    {boardStatusText}
                  </p>
                </>
              ) : (
                <>
                  <div role="radiogroup" aria-label={t("a11yDifficultyLabel")}>
                    {DIFFICULTY_KEYS.map((_key, index) => (
                      <button
                        key={`difficulty-${index}`}
                        type="button"
                        role="radio"
                        aria-checked={index === gameDifficulty}
                        disabled={busy}
                        onClick={() => void dispatch("selectDifficulty", { difficulty: index })}
                      >
                        {t(`diffName_${index}`)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="gomoku-a11y-start"
                    disabled={busy}
                    onClick={() => void dispatch("startGame", { difficulty: gameDifficulty })}
                  >
                    {startLabel}
                  </button>
                </>
              )}
            </div>
            <div className="gomoku-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="gomoku-stage-hud__metric"
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
                className="gomoku-stage-hud__drawer"
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
                className="gomoku-ingame-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("drawerTitle")}
              >
                <div className="gomoku-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{t("guestFairnessShort")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="gomoku-ingame-drawer__close"
                    onClick={closeDrawer}
                    aria-label={t("closeDrawer")}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="gomoku-ingame-drawer__grid">
                  <span>
                    <small>{t("guestModeLabel")}</small>
                    <strong>{t("guestModeValue")}</strong>
                  </span>
                  <span>
                    <small>{t("guestBestLabel")}</small>
                    <strong>{myTotalWon}</strong>
                  </span>
                  <span>
                    <small>{t("timeMetric")}</small>
                    <strong>{deadline > 0 ? formatClock(remainMs) : "--"}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="gomoku-ingame-drawer__actions">
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
                <div className="gomoku-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{t("guestRulesShort")}</p>
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
