import {
  BEAD_COLORS,
  BOARD_COLS,
  BOARD_ROWS,
  HOLDING_CAPACITY,
  MAX_UNDOS,
  ROUND_TIME_MS,
  SNAPSHOT_VERSION,
  validCellCount,
} from "./config";
import { BoardLogic } from "./BoardLogic";
import { ColorDistributor } from "./ColorDistributor";
import type {
  BeadCell,
  BeadMoveEvent,
  BeadPhase,
  BeadSelection,
  BeadSnapshot,
  EngineResult,
  HistoryFrame,
  HoldingBead,
  Position,
} from "./types";

const EMPTY_ACTION: BeadMoveEvent = { nonce: 0, kind: "restart" };
const VALID_PHASES = new Set<BeadPhase>([
  "playing",
  "paused",
  "won",
  "timeout",
  "stuck",
]);

function cloneBoard(board: BeadCell[][]): BeadCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function cloneHolding(holding: HoldingBead[]): HoldingBead[] {
  return holding.map((bead) => ({ ...bead, source: { ...bead.source } }));
}

function cloneSelection(selection: BeadSelection): BeadSelection {
  if (!selection) return null;
  return selection.source === "board"
    ? { ...selection, cells: selection.cells.map((cell) => ({ ...cell })) }
    : { ...selection };
}

function cloneHistory(history: HistoryFrame[]): HistoryFrame[] {
  return history.map((frame) => ({
    board: cloneBoard(frame.board),
    holding: cloneHolding(frame.holding),
    steps: frame.steps,
  }));
}

function historyFrameInvariant(
  value: unknown,
  currentBoard: BeadCell[][],
): value is HistoryFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as HistoryFrame;
  if (!boardInvariant(frame.board) || !holdingInvariant(frame.holding))
    return false;
  if (!Number.isInteger(frame.steps) || frame.steps < 0) return false;
  const sameTargets = frame.board.every((row, rowIndex) =>
    row.every((cell, colIndex) => {
      const current = currentBoard[rowIndex]?.[colIndex];
      return (
        current !== undefined &&
        cell.valid === current.valid &&
        cell.targetColor === current.targetColor &&
        cell.chunkId === current.chunkId
      );
    }),
  );
  if (!sameTargets) return false;
  const counts = countColors(frame.board, frame.holding);
  return counts.target.every((count, index) => count === counts.beads[index]);
}

function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Position;
  return (
    Number.isInteger(candidate.row) &&
    Number.isInteger(candidate.col) &&
    candidate.row >= 0 &&
    candidate.row < BOARD_ROWS &&
    candidate.col >= 0 &&
    candidate.col < BOARD_COLS
  );
}

function isColor(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0 &&
    Number(value) < BEAD_COLORS.length
  );
}

function boardInvariant(board: unknown): board is BeadCell[][] {
  if (!Array.isArray(board) || board.length !== BOARD_ROWS) return false;
  let valid = 0;
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const cells = board[row];
    if (!Array.isArray(cells) || cells.length !== BOARD_COLS) return false;
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const cell = cells[col] as Partial<BeadCell> | undefined;
      if (
        !cell ||
        cell.row !== row ||
        cell.col !== col ||
        typeof cell.valid !== "boolean"
      )
        return false;
      if (cell.valid) {
        valid += 1;
        if (!isColor(cell.targetColor)) return false;
        if (cell.beadColor !== null && !isColor(cell.beadColor)) return false;
        if (typeof cell.chunkId !== "string" || !cell.chunkId) return false;
      } else if (cell.targetColor !== -1 || cell.beadColor !== null) {
        return false;
      }
    }
  }
  return valid === validCellCount();
}

function holdingInvariant(value: unknown): value is HoldingBead[] {
  if (!Array.isArray(value) || value.length > HOLDING_CAPACITY) return false;
  const ids = new Set<string>();
  return value.every((bead) => {
    if (!bead || typeof bead !== "object") return false;
    const candidate = bead as HoldingBead;
    if (
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      ids.has(candidate.id)
    ) {
      return false;
    }
    ids.add(candidate.id);
    return isColor(candidate.color) && isPosition(candidate.source);
  });
}

function selectionInvariant(
  value: unknown,
  board: BeadCell[][],
  holding: HoldingBead[],
): value is BeadSelection {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const selection = value as Exclude<BeadSelection, null>;
  if (selection.source === "holding") {
    return (
      isColor(selection.color) &&
      holding.some((bead) => bead.color === selection.color)
    );
  }
  if (
    selection.source !== "board" ||
    !isColor(selection.color) ||
    !isColor(selection.targetColor)
  ) {
    return false;
  }
  if (!Array.isArray(selection.cells) || selection.cells.length === 0)
    return false;
  const keys = new Set<string>();
  const cellsValid = selection.cells.every((position) => {
    if (!isPosition(position)) return false;
    const key = `${position.row},${position.col}`;
    if (keys.has(key)) return false;
    keys.add(key);
    const cell = board[position.row]?.[position.col];
    return Boolean(
      cell?.valid &&
      cell.beadColor === selection.color &&
      cell.targetColor === selection.targetColor,
    );
  });
  if (!cellsValid) return false;
  const first = selection.cells[0];
  if (!first) return false;
  const actualRegion = BoardLogic.connectedMovableRegion(
    board,
    first.row,
    first.col,
  );
  return (
    actualRegion.length === selection.cells.length &&
    actualRegion.every((position) =>
      keys.has(`${position.row},${position.col}`),
    )
  );
}

function countColors(
  board: BeadCell[][],
  holding: HoldingBead[],
): {
  target: number[];
  beads: number[];
} {
  const target = Array(BEAD_COLORS.length).fill(0) as number[];
  const beads = Array(BEAD_COLORS.length).fill(0) as number[];
  for (const row of board) {
    for (const cell of row) {
      if (!cell.valid) continue;
      target[cell.targetColor] = (target[cell.targetColor] ?? 0) + 1;
      if (cell.beadColor !== null)
        beads[cell.beadColor] = (beads[cell.beadColor] ?? 0) + 1;
    }
  }
  for (const bead of holding) beads[bead.color] = (beads[bead.color] ?? 0) + 1;
  return { target, beads };
}

function snapshotInvariant(value: unknown): value is BeadSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as BeadSnapshot;
  if (
    snapshot.version !== SNAPSHOT_VERSION ||
    !Number.isInteger(snapshot.seed) ||
    snapshot.seed <= 0
  )
    return false;
  if (!Number.isInteger(snapshot.level) || snapshot.level < 1) return false;
  if (!boardInvariant(snapshot.board) || !holdingInvariant(snapshot.holding))
    return false;
  if (!VALID_PHASES.has(snapshot.phase)) return false;
  if (
    typeof snapshot.messageKey !== "string" ||
    snapshot.messageKey.length === 0
  )
    return false;
  if (
    !Number.isFinite(snapshot.remainingMs) ||
    snapshot.remainingMs < 0 ||
    snapshot.remainingMs > ROUND_TIME_MS
  )
    return false;
  if (
    !Number.isFinite(snapshot.savedAt) ||
    !Number.isFinite(snapshot.lastTickAt)
  )
    return false;
  if (!Number.isInteger(snapshot.steps) || snapshot.steps < 0) return false;
  if (!selectionInvariant(snapshot.selection, snapshot.board, snapshot.holding))
    return false;
  const counts = countColors(snapshot.board, snapshot.holding);
  if (counts.target.some((count, index) => count !== counts.beads[index]))
    return false;
  const solved =
    snapshot.holding.length === 0 &&
    snapshot.board.every((row) =>
      row.every((cell) => !cell.valid || cell.beadColor === cell.targetColor),
    );
  if ((snapshot.phase === "won") !== solved) return false;
  if (snapshot.phase === "timeout" && snapshot.remainingMs !== 0) return false;
  if (snapshot.remainingMs === 0 && snapshot.phase !== "timeout" && !solved)
    return false;
  return true;
}

function cryptoSeed(): number {
  try {
    const values = new Uint32Array(1);
    if (!globalThis.crypto?.getRandomValues)
      throw new Error("Web Crypto unavailable");
    globalThis.crypto.getRandomValues(values);
    return values[0] || 1;
  } catch {
    return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
  }
}

export class BeadEngine {
  private state: BeadSnapshot;
  private actionNonce = 0;
  private beadNonce = 0;

  private constructor(snapshot: BeadSnapshot) {
    this.state = snapshot;
    this.actionNonce = Math.max(0, snapshot.lastAction.nonce || 0);
    this.beadNonce = snapshot.holding.length;
  }

  static fresh(seed = cryptoSeed(), level = 1, now = Date.now()): BeadEngine {
    const generated = ColorDistributor.create(seed);
    const snapshot: BeadSnapshot = {
      version: SNAPSHOT_VERSION,
      seed: generated.seed,
      level: Math.max(1, Math.floor(level)),
      board: cloneBoard(generated.board),
      holding: [],
      selection: null,
      phase: "playing",
      steps: 0,
      remainingMs: ROUND_TIME_MS,
      lastTickAt: now,
      savedAt: now,
      history: [],
      lastAction: { ...EMPTY_ACTION },
      messageKey: "statusReady",
      matched: 0,
      total: generated.total,
    };
    const engine = new BeadEngine(snapshot);
    engine.recalculate(now);
    return engine;
  }

  static restore(raw: unknown, now = Date.now()): BeadEngine | null {
    if (!snapshotInvariant(raw)) return null;
    const history = Array.isArray(raw.history)
      ? raw.history
          .filter((frame) => historyFrameInvariant(frame, raw.board))
          .slice(-MAX_UNDOS)
      : [];
    const restoredNonce =
      raw.lastAction &&
      typeof raw.lastAction === "object" &&
      Number.isInteger(raw.lastAction.nonce) &&
      raw.lastAction.nonce >= 0
        ? raw.lastAction.nonce
        : 0;
    const snapshot: BeadSnapshot = {
      ...raw,
      board: cloneBoard(raw.board),
      holding: cloneHolding(raw.holding),
      selection: cloneSelection(raw.selection),
      history: cloneHistory(history),
      lastTickAt: now,
      savedAt: now,
      lastAction: { nonce: restoredNonce + 1, kind: "recovered" },
      messageKey:
        raw.phase === "playing" ? "statusRecoveredPaused" : raw.messageKey,
      phase: raw.phase === "playing" ? "paused" : raw.phase,
    };
    const engine = new BeadEngine(snapshot);
    engine.recalculate(now);
    return engine;
  }

  snapshot(now = Date.now()): BeadSnapshot {
    if (this.state.phase === "playing") this.tick(now);
    this.state.savedAt = now;
    return {
      ...this.state,
      board: cloneBoard(this.state.board),
      holding: cloneHolding(this.state.holding),
      selection: cloneSelection(this.state.selection),
      history: cloneHistory(this.state.history),
      lastAction: {
        ...this.state.lastAction,
        from: this.state.lastAction.from?.map((position) => ({ ...position })),
        to: this.state.lastAction.to?.map((position) => ({ ...position })),
        holdingFrom: this.state.lastAction.holdingFrom
          ? [...this.state.lastAction.holdingFrom]
          : undefined,
        holdingTo: this.state.lastAction.holdingTo
          ? [...this.state.lastAction.holdingTo]
          : undefined,
      },
    };
  }

  tapBoard(row: number, col: number, now = Date.now()): EngineResult {
    this.tick(now);
    if (!this.canAct()) return this.blocked("statusPaused");
    const cell = this.state.board[row]?.[col];
    if (!cell?.valid) return this.blocked("statusOutsideBoard");
    if (cell.beadColor !== null) return this.selectBoard(row, col, now);
    return this.placeAt(row, col, now);
  }

  tapHolding(index: number, now = Date.now()): EngineResult {
    this.tick(now);
    if (!this.canAct()) return this.blocked("statusPaused");
    if (this.state.selection?.source === "board")
      return this.moveSelectionToHolding(now);
    const bead = this.state.holding[index];
    if (!bead) return this.blocked("statusSelectBatch");
    if (
      this.state.selection?.source === "holding" &&
      this.state.selection.color === bead.color
    ) {
      this.state.selection = null;
      this.recordAction("deselected", { color: bead.color });
      this.state.messageKey = "statusSelectionCleared";
      return { ok: true, action: "deselected" };
    }
    this.state.selection = { source: "holding", color: bead.color };
    this.recordAction("selected", { color: bead.color });
    this.state.messageKey = "statusHoldingSelected";
    return { ok: true, action: "selected" };
  }

  moveSelectionToHolding(now = Date.now()): EngineResult {
    this.tick(now);
    const selection = this.state.selection;
    if (!this.canAct() || selection?.source !== "board")
      return this.blocked("statusSelectBoardFirst");
    const available = HOLDING_CAPACITY - this.state.holding.length;
    if (selection.cells.length > available)
      return this.blocked("statusHoldingNeedsSpace");
    this.pushHistory();
    const holdingTo: number[] = [];
    for (const position of selection.cells) {
      const cell = this.state.board[position.row]?.[position.col];
      if (!cell || cell.beadColor === null) continue;
      holdingTo.push(this.state.holding.length);
      this.state.holding.push({
        id: `${this.state.seed}:${(this.beadNonce += 1)}`,
        color: cell.beadColor,
        source: { ...position },
      });
      cell.beadColor = null;
    }
    this.state.steps += 1;
    this.state.selection = null;
    this.recordAction("to-holding", {
      color: selection.color,
      from: selection.cells,
      holdingTo,
    });
    this.state.messageKey = "statusMovedToHolding";
    this.recalculate(now);
    return { ok: true, action: "to-holding", moved: selection.cells.length };
  }

  togglePause(now = Date.now()): EngineResult {
    if (this.state.phase === "playing") {
      this.tick(now);
      if (this.state.phase !== "playing") return this.blocked("statusTimeUp");
      this.state.phase = "paused";
      this.state.selection = null;
      this.recordAction("pause");
      this.state.messageKey = "statusPaused";
      this.state.savedAt = now;
      return { ok: true, action: "pause" };
    }
    if (this.state.phase === "paused") {
      this.state.phase = "playing";
      this.state.lastTickAt = now;
      this.recordAction("resume");
      this.state.messageKey = "statusResumed";
      this.recalculate(now);
      return { ok: true, action: "resume" };
    }
    return this.blocked("statusCannotResume");
  }

  pauseForVisibility(now = Date.now()): boolean {
    if (this.state.phase !== "playing") return false;
    this.tick(now);
    if (this.state.phase !== "playing") return false;
    this.state.phase = "paused";
    this.state.selection = null;
    this.recordAction("pause");
    this.state.messageKey = "statusAutoPaused";
    return true;
  }

  undo(now = Date.now()): EngineResult {
    this.tick(now);
    if (this.state.phase === "timeout" || this.state.phase === "won")
      return this.blocked("statusUndoUnavailable");
    const frame = this.state.history.pop();
    if (!frame) return this.blocked("statusNothingToUndo");
    this.state.board = cloneBoard(frame.board);
    this.state.holding = cloneHolding(frame.holding);
    this.state.steps = frame.steps;
    this.state.selection = null;
    this.state.phase = "playing";
    this.state.lastTickAt = now;
    this.recordAction("undo");
    this.state.messageKey = "statusUndone";
    this.recalculate(now);
    return { ok: true, action: "undo" };
  }

  tick(now = Date.now()): boolean {
    if (this.state.phase !== "playing") return false;
    const elapsed = Math.max(0, now - this.state.lastTickAt);
    this.state.lastTickAt = now;
    if (elapsed <= 0) return false;
    this.state.remainingMs = Math.max(0, this.state.remainingMs - elapsed);
    if (this.state.remainingMs === 0) {
      this.state.phase = "timeout";
      this.state.selection = null;
      this.recordAction("timeout");
      this.state.messageKey = "statusTimeUp";
    }
    this.state.savedAt = now;
    return true;
  }

  private selectBoard(row: number, col: number, now: number): EngineResult {
    const cell = this.state.board[row]?.[col];
    if (!cell || cell.beadColor === null)
      return this.blocked("statusEmptySocket");
    if (cell.beadColor === cell.targetColor)
      return this.blocked("statusMatchedLocked");
    const region = BoardLogic.connectedMovableRegion(
      this.state.board,
      row,
      col,
    );
    if (region.length === 0) return this.blocked("statusNoMovableBatch");
    const previous = this.state.selection;
    if (
      previous?.source === "board" &&
      previous.cells.length === region.length &&
      previous.cells.every((position, index) => {
        const next = region[index];
        return next?.row === position.row && next.col === position.col;
      })
    ) {
      this.state.selection = null;
      this.recordAction("deselected", { color: cell.beadColor });
      this.state.messageKey = "statusSelectionCleared";
      return { ok: true, action: "deselected" };
    }
    this.state.selection = {
      source: "board",
      color: cell.beadColor,
      targetColor: cell.targetColor,
      cells: region,
    };
    this.recordAction("selected", { color: cell.beadColor, from: region });
    this.state.messageKey = "statusBoardSelected";
    this.state.savedAt = now;
    return { ok: true, action: "selected", moved: region.length };
  }

  private placeAt(row: number, col: number, now: number): EngineResult {
    const selection = this.state.selection;
    if (!selection) return this.blocked("statusSelectBatch");
    const destination = BoardLogic.connectedEmptyTargets(
      this.state.board,
      row,
      col,
      selection.color,
    );
    if (destination.length === 0) return this.blocked("statusWrongTarget");

    if (selection.source === "board") {
      if (destination.length < selection.cells.length)
        return this.blocked("statusTargetTooSmall");
      this.pushHistory();
      const targets = destination.slice(0, selection.cells.length);
      for (let index = 0; index < selection.cells.length; index += 1) {
        const from = selection.cells[index];
        const to = targets[index];
        if (!from || !to) continue;
        const sourceCell = this.state.board[from.row]?.[from.col];
        const targetCell = this.state.board[to.row]?.[to.col];
        if (!sourceCell || !targetCell || sourceCell.beadColor === null)
          continue;
        targetCell.beadColor = sourceCell.beadColor;
        sourceCell.beadColor = null;
      }
      this.state.steps += 1;
      this.state.selection = null;
      this.recordAction("board-place", {
        color: selection.color,
        from: selection.cells,
        to: targets,
      });
      this.state.messageKey = "statusPlacedBatch";
      this.recalculate(now);
      return { ok: true, action: "board-place", moved: targets.length };
    }

    const matchingIndices = this.state.holding
      .map((bead, index) => ({ bead, index }))
      .filter(({ bead }) => bead.color === selection.color)
      .map(({ index }) => index);
    if (matchingIndices.length === 0)
      return this.blocked("statusHoldingColorMissing");
    const placeCount = Math.min(destination.length, matchingIndices.length);
    this.pushHistory();
    const holdingFrom = matchingIndices.slice(0, placeCount);
    const selectedIds = new Set(
      holdingFrom.map((index) => this.state.holding[index]?.id).filter(Boolean),
    );
    const removed = this.state.holding.filter((bead) =>
      selectedIds.has(bead.id),
    );
    this.state.holding = this.state.holding.filter(
      (bead) => !selectedIds.has(bead.id),
    );
    const targets = destination.slice(0, removed.length);
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const bead = removed[index];
      if (target && bead)
        this.state.board[target.row]![target.col]!.beadColor = bead.color;
    }
    this.state.steps += 1;
    this.state.selection = this.state.holding.some(
      (bead) => bead.color === selection.color,
    )
      ? { source: "holding", color: selection.color }
      : null;
    this.recordAction("holding-place", {
      color: selection.color,
      holdingFrom,
      to: targets,
    });
    this.state.messageKey =
      targets.length < matchingIndices.length
        ? "statusPlacedPartialBatch"
        : "statusPlacedBatch";
    this.recalculate(now);
    return { ok: true, action: "holding-place", moved: targets.length };
  }

  private canAct(): boolean {
    return this.state.phase === "playing";
  }

  private blocked(messageKey: string): EngineResult {
    this.state.messageKey = messageKey;
    this.recordAction("blocked");
    return { ok: false, action: "blocked", messageKey };
  }

  private pushHistory(): void {
    this.state.history.push({
      board: cloneBoard(this.state.board),
      holding: cloneHolding(this.state.holding),
      steps: this.state.steps,
    });
    if (this.state.history.length > MAX_UNDOS) this.state.history.shift();
  }

  private recordAction(
    kind: BeadMoveEvent["kind"],
    details: Omit<BeadMoveEvent, "nonce" | "kind"> = {},
  ): void {
    this.actionNonce += 1;
    this.state.lastAction = { nonce: this.actionNonce, kind, ...details };
  }

  private recalculate(now: number): void {
    let matched = 0;
    let total = 0;
    for (const row of this.state.board) {
      for (const cell of row) {
        if (!cell.valid) continue;
        total += 1;
        if (cell.beadColor === cell.targetColor) matched += 1;
      }
    }
    this.state.matched = matched;
    this.state.total = total;
    this.state.savedAt = now;
    if (matched === total && this.state.holding.length === 0) {
      const finalMove = this.state.lastAction;
      this.state.phase = "won";
      this.state.selection = null;
      this.state.messageKey = "statusWon";
      this.recordAction("won", {
        color: finalMove.color,
        from: finalMove.from,
        to: finalMove.to,
        holdingFrom: finalMove.holdingFrom,
        holdingTo: finalMove.holdingTo,
      });
      return;
    }
    if (this.state.phase === "stuck" && this.hasLegalMove()) {
      this.state.phase = "paused";
      this.state.messageKey = "statusRecoveredPaused";
    }
    if (this.state.phase === "playing" && !this.hasLegalMove()) {
      this.state.phase = "stuck";
      this.state.selection = null;
      this.state.messageKey = "statusStuck";
    }
  }

  private hasLegalMove(): boolean {
    const emptyRegions = BoardLogic.emptyTargetRegions(this.state.board);
    for (const bead of this.state.holding) {
      if (
        emptyRegions.some((region) => {
          const first = region[0];
          return (
            first &&
            this.state.board[first.row]?.[first.col]?.targetColor === bead.color
          );
        })
      )
        return true;
    }
    const movable = BoardLogic.movableRegions(this.state.board);
    const available = HOLDING_CAPACITY - this.state.holding.length;
    if (movable.some((region) => region.length <= available)) return true;
    return movable.some((region) => {
      const first = region[0];
      const color = first
        ? this.state.board[first.row]?.[first.col]?.beadColor
        : null;
      return (
        color !== null &&
        emptyRegions.some((empty) => {
          const target = empty[0];
          return (
            target &&
            this.state.board[target.row]?.[target.col]?.targetColor === color &&
            empty.length >= region.length
          );
        })
      );
    });
  }
}

export function isValidBeadSnapshot(value: unknown): value is BeadSnapshot {
  return snapshotInvariant(value);
}
