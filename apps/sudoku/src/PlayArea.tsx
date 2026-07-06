import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Grid3x3, Undo2 } from "lucide-react";
import { isBoardComplete, boardToSolutionString } from "./logic/sudoku-engine";
import type { Difficulty } from "./logic/sudoku-engine";
import {
  applyUndo,
  canPlace,
  clearNotes,
  emptyCells,
  persistBoard,
  placeDigit,
  restoreBoard,
  toggleNote,
} from "./logic/board-store";
import type { BoardState } from "./logic/board-store";
import {
  DIFFICULTY_RULES,
  MAX_UNDOS,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// The contract judges deadlines/min-solve by BLOCK time while this UI ticks on
// the client clock. A submission broadcast in the last moments would land in a
// block past the deadline anyway (~15s cadence), so close the submit window a
// block early — and hold the min-solve gate a beat longer — to absorb both the
// clock skew and the landing delay instead of surfacing an on-chain revert.
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

const SUDOKU_ART = {
  cellGiven: "./art/cell-given.webp",
  cellPlaced: "./art/cell-placed.webp",
  cellSelected: "./art/cell-selected.webp",
  cellConflict: "./art/cell-conflict.webp",
  pencil: "./art/pencil.webp",
  noteToken: "./art/note-token.webp",
  sealedEnvelope: "./art/sealed-envelope.webp",
  solvedBadge: "./art/solved-badge.webp",
  rewardTrophy: "./art/reward-trophy.webp",
  seals: {
    0: "./art/seal-easy.webp",
    1: "./art/seal-medium.webp",
    2: "./art/seal-hard.webp",
  } satisfies Record<Difficulty, string>,
} as const;

const SHUFFLE_KIT = [
  SUDOKU_ART.sealedEnvelope,
  SUDOKU_ART.cellGiven,
  SUDOKU_ART.cellPlaced,
  SUDOKU_ART.pencil,
  SUDOKU_ART.noteToken,
  SUDOKU_ART.solvedBadge,
] as const;

const LOBBY_PREVIEWS = {
  0: [
    4, 0, 2, 0, 7, 0, 8, 0, 6,
    0, 7, 0, 3, 0, 8, 0, 2, 0,
    8, 0, 0, 0, 2, 0, 0, 0, 1,
    0, 1, 0, 8, 0, 2, 0, 6, 0,
    6, 0, 8, 0, 0, 0, 2, 0, 4,
    0, 2, 0, 7, 0, 6, 0, 8, 0,
    1, 0, 0, 0, 9, 0, 0, 0, 2,
    0, 8, 0, 2, 0, 7, 0, 4, 0,
    2, 0, 7, 0, 4, 0, 6, 0, 8,
  ],
  1: [
    0, 9, 0, 6, 0, 4, 0, 1, 0,
    6, 0, 0, 0, 9, 0, 0, 0, 8,
    0, 0, 8, 0, 0, 0, 3, 0, 0,
    0, 7, 0, 0, 4, 0, 0, 2, 0,
    4, 0, 0, 8, 0, 7, 0, 0, 3,
    0, 2, 0, 0, 6, 0, 0, 5, 0,
    0, 0, 3, 0, 0, 0, 7, 0, 0,
    7, 0, 0, 0, 2, 0, 0, 0, 6,
    0, 1, 0, 7, 0, 6, 0, 9, 0,
  ],
  2: [
    0, 0, 8, 0, 5, 0, 3, 0, 0,
    0, 7, 0, 0, 0, 0, 0, 4, 0,
    3, 0, 0, 9, 0, 2, 0, 0, 6,
    0, 0, 4, 0, 0, 0, 8, 0, 0,
    9, 0, 0, 0, 7, 0, 0, 0, 2,
    0, 0, 6, 0, 0, 0, 9, 0, 0,
    1, 0, 0, 4, 0, 8, 0, 0, 5,
    0, 3, 0, 0, 0, 0, 0, 7, 0,
    0, 0, 9, 0, 3, 0, 6, 0, 0,
  ],
} satisfies Record<Difficulty, readonly number[]>;

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const creditGas = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const activeGameId = str("activeGameId", "0");
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = (val<number>("gameDifficulty", 0) ?? 0) as Difficulty;
  const clues = str("clues", "");
  const commitmentHex = str("commitment", "");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isUndoing = bool("isUndoing");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState<Difficulty>(0);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [selected, setSelected] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [undoArmed, setUndoArmed] = useState(false);
  const [conflictFlash, setConflictFlash] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Immediate local motion when a digit lands / a deal starts, released on a
  // timer so the surface never sticks in its action state.
  const [placePreview, setPlacePreview] = useState(-1);
  const placePreviewTimeout = useRef<number | null>(null);

  const startPlacePreview = useCallback((index: number) => {
    if (placePreviewTimeout.current !== null) {
      window.clearTimeout(placePreviewTimeout.current);
    }
    setPlacePreview(index);
    placePreviewTimeout.current = window.setTimeout(() => {
      setPlacePreview(-1);
      setConflictFlash([]);
      placePreviewTimeout.current = null;
    }, 620);
  }, []);

  useEffect(
    () => () => {
      if (placePreviewTimeout.current !== null) {
        window.clearTimeout(placePreviewTimeout.current);
      }
    },
    [],
  );

  // 1s clock while a dealt game is live (drives the countdown + min-solve gate).
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : pickedDifficulty,
  );

  // The clue layout arrives from the TEE session (the solution never leaves
  // the enclave) — the client just validates its shape before rendering.
  const puzzle: string | null = useMemo(
    () => (/^[0-9]{81}$/.test(clues) ? clues : null),
    [clues],
  );

  // (Re)hydrate the board whenever a dealt puzzle becomes current.
  useEffect(() => {
    if (gameStatus === "dealt" && puzzle && activeGameId !== "0") {
      setBoard(restoreBoard(activeGameId, puzzle));
      setSelected(-1);
      setUndoArmed(false);
    } else if (gameStatus !== "dealt") {
      setBoard(null);
    }
  }, [gameStatus, puzzle, activeGameId]);

  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed =
    gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const timePct =
    deadline > 0 && dealtAt > 0
      ? Math.max(0, Math.min(100, (remainingMs / (deadline - dealtAt)) * 100))
      : 0;

  const boardComplete = board !== null && emptyCells(board) === 0 && isBoardComplete(board.entries);
  const busy = isStarting || isDealing || isSubmitting || isUndoing;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;
  const undosLeft = MAX_UNDOS - undosUsed;
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout =
    (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;

  const commitBoard = useCallback(
    (next: BoardState) => {
      setBoard(next);
      if (activeGameId !== "0") persistBoard(activeGameId, next);
    },
    [activeGameId],
  );

  const handleCellInput = useCallback(
    (digit: number) => {
      if (!board || selected < 0 || gameStatus !== "dealt" || timeUp || busy) return;
      if (notesMode) {
        commitBoard(toggleNote(board, selected, digit));
        return;
      }
      if (!canPlace(board, selected)) return;
      const { board: next, conflicts } = placeDigit(board, selected, digit);
      commitBoard(next);
      setConflictFlash(conflicts);
      startPlacePreview(selected);
      // Stream the placement to the TEE session (telemetry + undo ledger);
      // gameplay never blocks on it.
      void dispatch("recordMove", { cell: selected, digit });
    },
    [board, selected, gameStatus, timeUp, busy, notesMode, commitBoard, startPlacePreview, dispatch],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (gameStatus !== "dealt") return;
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      event.preventDefault();
      handleCellInput(digit);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace" || event.key === "0") {
      event.preventDefault();
      if (board && selected >= 0 && canPlace(board, selected)) {
        const { board: next } = placeDigit(board, selected, 0);
        commitBoard(next);
        startPlacePreview(selected);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSelected(-1);
      return;
    }
    if (event.key === "c" || event.key === "C") {
      event.preventDefault();
      if (board && selected >= 0 && canPlace(board, selected)) {
        commitBoard(clearNotes(board, selected));
      }
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      setNotesMode((mode) => !mode);
      return;
    }
    const moves: Record<string, number> = {
      ArrowUp: -9,
      ArrowDown: 9,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setSelected((prev) => {
        const base = prev < 0 ? 40 : prev;
        const next = base + (moves[event.key] ?? 0);
        return next >= 0 && next < 81 ? next : base;
      });
    }
  };

  const confirmUndo = async () => {
    if (!board || board.placedOrder.length === 0 || undosLeft <= 0 || busy) return;
    if (!undoArmed) {
      setUndoArmed(true);
      return;
    }
    setUndoArmed(false);
    try {
      await dispatch("useUndo", {});
      const { board: next, reverted } = applyUndo(board);
      commitBoard(next);
      if (reverted !== null) {
        setSelected(reverted);
        startPlacePreview(reverted);
      }
    } catch {
      /* the store surfaced the error toast; the board stays untouched */
    }
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (gameStatus === "dealt") {
      if (!board || !boardComplete || !minSolveReached || submitWindowClosed) return;
      startPlacePreview(-1);
      await dispatch("submitSolution", { solution: boardToSolutionString(board.entries) });
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  const selectedValue = (board && selected >= 0 ? board.entries[selected] : 0) ?? 0;
  const lobbyPreview = LOBBY_PREVIEWS[pickedDifficulty];

  const renderCell = (index: number) => {
    if (!board) return null;
    const value = board.entries[index] ?? 0;
    const given = board.given[index] ?? false;
    const notes = board.notes[index] ?? 0;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const isSelected = selected === index;
    const isConflict = conflictFlash.includes(index);
    const inSelectionLine =
      selected >= 0 &&
      (row === Math.floor(selected / 9) ||
        col === selected % 9 ||
        (Math.floor(row / 3) === Math.floor(selected / 27) &&
          Math.floor(col / 3) === Math.floor((selected % 9) / 3)));
    const classes = [
      "sudoku-cell",
      given ? "sudoku-cell--given" : null,
      !given && value > 0 ? "sudoku-cell--placed" : null,
      isSelected ? "sudoku-cell--selected" : null,
      inSelectionLine && !isSelected ? "sudoku-cell--line" : null,
      selectedValue > 0 && value === selectedValue && !isSelected
        ? "sudoku-cell--twin"
        : null,
      isConflict ? "sudoku-cell--conflict" : null,
      placePreview === index ? "sudoku-cell--landing" : null,
      col % 3 === 2 && col !== 8 ? "sudoku-cell--box-right" : null,
      row % 3 === 2 && row !== 8 ? "sudoku-cell--box-bottom" : null,
    ]
      .filter(Boolean)
      .join(" ");

    // Compute active pencil-marks for accessible description
    const activeNotes = notes > 0 ? DIGITS.filter((d) => (notes >> d) & 1) : [];
    const notesDesc = activeNotes.length > 0
      ? t("cellNotesDesc", { notes: activeNotes.join(", ") })
      : undefined;

    return (
      <button
        key={index}
        id={`cell-${index}`}
        type="button"
        role="gridcell"
        className={classes}
        onClick={() => setSelected(index)}
        onDoubleClick={() => {
          if (!given && value === 0) commitBoard(clearNotes(board, index));
        }}
        aria-label={t("cellLabel", { row: row + 1, col: col + 1 })}
        aria-description={notesDesc}
        aria-selected={isSelected}
        aria-invalid={isConflict || undefined}
        data-value={value || undefined}
      >
        {isSelected && (
          <img
            className="sudoku-cell__mark sudoku-cell__mark--selected"
            src={SUDOKU_ART.cellSelected}
            alt=""
            draggable={false}
          />
        )}
        {isConflict && (
          <img
            className="sudoku-cell__mark sudoku-cell__mark--conflict"
            src={SUDOKU_ART.cellConflict}
            alt=""
            draggable={false}
          />
        )}
        {value > 0 ? (
          <>
            <img
              className="sudoku-cell__tile"
              src={given ? SUDOKU_ART.cellGiven : SUDOKU_ART.cellPlaced}
              alt=""
              draggable={false}
            />
            <span className="sudoku-cell__digit">{value}</span>
          </>
        ) : notes > 0 ? (
          <>
            <img
              className="sudoku-cell__tile sudoku-cell__tile--note"
              src={SUDOKU_ART.noteToken}
              alt=""
              draggable={false}
            />
            <span className="sudoku-cell__notes" aria-hidden="true">
              {DIGITS.map((d) => (
                <i key={d} data-on={(notes >> d) & 1 ? "true" : undefined}>
                  {(notes >> d) & 1 ? d : ""}
                </i>
              ))}
            </span>
          </>
        ) : null}
      </button>
    );
  };

  const difficultyPicker = (
    <div className="sudoku-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="sudoku-lobby__result" data-state="won">
          <span aria-hidden="true"><ParticleBurst coins count={12} /></span>
          <img src={SUDOKU_ART.solvedBadge} alt="" draggable={false} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="sudoku-lobby__result" data-state="expired">
          <img src={SUDOKU_ART.sealedEnvelope} alt="" draggable={false} />
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <div className="sudoku-lobby__stage" data-route={rule.key}>
        <div className="sudoku-lobby__board" aria-hidden="true">
          <img
            className="sudoku-lobby__seal"
            src={SUDOKU_ART.seals[pickedDifficulty]}
            alt=""
            draggable={false}
          />
          <div className="sudoku-lobby__mini-grid">
            {lobbyPreview.map((digit, index) => {
              const row = Math.floor(index / 9);
              const col = index % 9;
              const classes = [
                digit > 0 ? "is-given" : "is-open",
                col % 3 === 2 && col !== 8 ? "is-box-right" : null,
                row % 3 === 2 && row !== 8 ? "is-box-bottom" : null,
              ]
                .filter(Boolean)
                .join(" ");
              const cellClass = ["sudoku-lobby__mini-grid__cell", ...classes.split(" ")]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={`${digit}-${index}`} className={cellClass}>
                  {digit > 0 && (
                    <>
                      <img src={SUDOKU_ART.cellGiven} alt="" draggable={false} />
                      <b>{digit}</b>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div className="sudoku-lobby__hud">
          <div className="sudoku-lobby__route">
            <span className="sudoku-lobby__eyebrow">{t("routeEyebrow")}</span>
            <strong>{t(`difficulty_${rule.key}`)}</strong>
            <p>{t(`routeObjective_${rule.key}`)}</p>
          </div>
          <div className="sudoku-lobby__ribbon" role="region" aria-label={t("routeSummary")}>
            <span className="sudoku-lobby__ribbon-prize">
              <img src={SUDOKU_ART.rewardTrophy} alt="" draggable={false} />
              {t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}
            </span>
            <span>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</span>
            <span>{t("timeAmount", { minutes: Math.round(rule.limitMs / 60000) })}</span>
          </div>
        </div>
      </div>
      <div className="sudoku-lobby__cards" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={["sudoku-route-card", active ? "sudoku-route-card--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <img
                className="sudoku-route-card__seal"
                src={SUDOKU_ART.seals[entry.difficulty]}
                alt=""
                draggable={false}
              />
              <span className="sudoku-route-card__name">{t(`difficulty_${entry.key}`)}</span>
              <span className="sudoku-route-card__reward">
                <img src={SUDOKU_ART.rewardTrophy} alt="" draggable={false} />
                {t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}
              </span>
            </button>
          );
        })}
      </div>
      <p className="sudoku-lobby__pool" data-low={!rewardPoolReady ? "true" : undefined}>
        {t("poolLine", { pool: poolFree.toFixed(2) })}
        {creditGas > 0 ? ` · ${t("creditLine", { credit: creditGas.toFixed(2) })}` : ""}
        {!rewardPoolReady ? ` · ${t("statusPoolLow")}` : ""}
      </p>
    </div>
  );

  const dealingStage = (
    <div className="sudoku-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="sudoku-shuffle__kit" aria-hidden="true">
        {SHUFFLE_KIT.map((src, i) => (
          <img
            key={src}
            className="sudoku-shuffle__asset"
            src={src}
            alt=""
            draggable={false}
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
      <p>{t("shufflingCopy")}</p>
      {!isDealing && (
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          onClick={() => void dispatch("retryDeal", {})}
        >
          {t("checkDealAgain")}
        </button>
      )}
    </div>
  );

  const boardStage = board && (
    <div className="sudoku-table">
      <div className="sudoku-timer" data-low={remainingMs < 60_000 ? "true" : undefined}>
        <span className="sudoku-timer__clock">{formatClock(remainingMs)}</span>
        <div
          className="sudoku-timer__track"
          role="progressbar"
          aria-valuenow={Math.round(timePct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("timerProgress")}
        >
          <i style={{ width: `${timePct}%` }} />
        </div>
        <span className="sudoku-timer__reward">
          {t("rewardNow", { amount: projectedPayout.toFixed(2), pct: currentRewardPct })}
        </span>
      </div>
      <div
        className="sudoku-board"
        role="grid"
        aria-label={t("boardLabel")}
        aria-rowcount={9}
        aria-colcount={9}
        aria-activedescendant={selected >= 0 ? `cell-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: 9 }, (_, rowIdx) => (
          <div key={rowIdx} role="row">
            {Array.from({ length: 9 }, (_, colIdx) => renderCell(rowIdx * 9 + colIdx))}
          </div>
        ))}
      </div>
      <div className="sudoku-pad">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            className={["sudoku-pad__key", notesMode ? "sudoku-pad__key--note" : null]
              .filter(Boolean)
              .join(" ")}
            aria-label={notesMode ? t("padNoteLabel", { digit }) : t("padPlaceLabel", { digit })}
            onClick={() => handleCellInput(digit)}
            // Keep the pad live before a cell is selected — handleCellInput
            // no-ops when selected < 0, and the selection ring teaches the
            // cell-first order without the pad reading as broken.
            disabled={busy || timeUp}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={["sudoku-pad__toggle", notesMode ? "sudoku-pad__toggle--on" : null]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={notesMode}
          onClick={() => setNotesMode((mode) => !mode)}
        >
          <img src={SUDOKU_ART.noteToken} alt="" draggable={false} />
          {t("notesToggle")}
        </button>
      </div>
      {!minSolveReached && boardComplete && (
        <p className="sudoku-hint" role="status">
          {t("minSolveHint", {
            clock: formatClock(rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs),
          })}
        </p>
      )}
      {submitWindowClosed && !timeUp && (
        <p className="sudoku-hint sudoku-hint--expired" role="alert">
          {t("deadlineBufferHint")}
        </p>
      )}
      {timeUp && (
        <p className="sudoku-hint sudoku-hint--expired" role="alert">
          {t("timeUpHint")}
        </p>
      )}
    </div>
  );

  const scene = (
    <div
      className="sudoku-scene"
      data-state={
        isSubmitting
          ? "submitting"
          : isDealing || gameStatus === "committed"
            ? "dealing"
            : gameStatus === "dealt"
              ? placePreview >= 0
                ? "placing"
                : "playing"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <span className="sudoku-scene__paper" aria-hidden="true" />
      {gameStatus === "committed" || (gameStatus === "dealt" && !puzzle)
        ? dealingStage
        : gameStatus === "dealt" && board
          ? boardStage
          : difficultyPicker}
      <p className="sudoku-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: timeUp ? t("timeUpAction") : t("submitAction"),
          onClick: () => void handleSubmit(),
          disabled: busy || !boardComplete || !minSolveReached || submitWindowClosed,
          loading: isSubmitting,
          icon: <Grid3x3 size={18} aria-hidden="true" />,
          hint: boardComplete ? t("submitHint") : t("fillHint", { left: board ? emptyCells(board) : 81 }),
        }
      : gameStatus === "committed"
        ? {
            label: t("statusShuffling"),
            onClick: () => void dispatch("retryDeal", {}),
            disabled: isDealing,
            loading: isDealing,
            hint: t("shufflingCopy"),
          }
        : {
            label: t("startAction"),
            onClick: () => void handleSubmit(),
            disabled: busy || !rewardPoolReady,
            loading: isStarting,
            icon: <Grid3x3 size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(gameStatus === "dealt" && !submitWindowClosed
      ? [
          {
            label: undoArmed
              ? t("undoConfirm", { pct: rewardPctAfterUndos(undosUsed + 1) })
              : t("undoAction", { left: undosLeft }),
            onClick: () => void confirmUndo(),
            disabled:
              busy || undosLeft <= 0 || !board || board.placedOrder.length === 0,
            icon: <Undo2 size={16} aria-hidden="true" />,
            hint: t("undoHint"),
          },
        ]
      : []),
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [
          {
            label: t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            hint: t("releaseHint"),
          },
        ]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            hint: t("withdrawHint"),
          },
        ]
      : []),
  ];

  return (
    <div
      className="sudoku-playarea mx2 mx2-cat-game"
      aria-busy={busy || undefined}
    >
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("appEyebrow"),
          title:
            gameStatus === "dealt"
              ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
              : gameStatus === "committed"
                ? t("statusShuffling")
                : gameStatus === "solved"
                  ? t("statusWonTitle")
                  : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={scene}
        score={gameStatus === "idle" ? undefined : [
          {
            label: t("scoreReward"),
            value: `${projectedPayout.toFixed(2)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreUndos"), value: `${undosLeft}/${MAX_UNDOS}` },
          { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
        ]}
        actions={{
          primary: primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <>
              <div className="sudoku-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="sudoku-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="sudoku-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="sudoku-ranks__rank">#{entry.rank}</span>
                      <span className="sudoku-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="sudoku-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="sudoku-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="sudoku-ranks__me">{t("youTag")}</span>}
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
                {t("refreshRanks")}
              </button>
              <h4>{t("historyTitle")}</h4>
              {myHistory.length > 0 ? (
                <ul className="mx2-history">
                  {myHistory.map((row) => (
                    <li key={row.gameId} className="mx2-history__item" data-outcome={row.payout && Number(row.payout) > 0 ? "won" : "lost"}>
                      <span className="mx2-history__face">
                        {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                      </span>
                      <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                      <span className="mx2-history__result">
                        {t("historyUndos", { undos: row.undos })}
                      </span>
                      <span className="mx2-history__stake">{row.payout}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("historyEmpty")}</p>
              )}
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {commitmentHex && (
                <p className="sudoku-drawer__seed">
                  {t("commitmentLine", {
                    commitment: shortHash(commitmentHex, 12, 8),
                    gameId: activeGameId,
                  })}
                </p>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}
