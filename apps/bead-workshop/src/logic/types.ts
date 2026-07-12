export type BeadColor = number;

export interface Position {
  row: number;
  col: number;
}

export interface BeadCell extends Position {
  valid: boolean;
  targetColor: BeadColor | -1;
  beadColor: BeadColor | null;
  chunkId: string;
}

export interface HoldingBead {
  id: string;
  color: BeadColor;
  source: Position;
}

export type BoardSelection = {
  source: "board";
  color: BeadColor;
  targetColor: BeadColor;
  cells: Position[];
};

export type HoldingSelection = {
  source: "holding";
  color: BeadColor;
};

export type BeadSelection = BoardSelection | HoldingSelection | null;
export type BeadPhase = "playing" | "paused" | "won" | "timeout" | "stuck";

export interface HistoryFrame {
  board: BeadCell[][];
  holding: HoldingBead[];
  steps: number;
}

export type BeadMoveKind =
  | "selected"
  | "deselected"
  | "to-holding"
  | "board-place"
  | "holding-place"
  | "undo"
  | "pause"
  | "resume"
  | "recovered"
  | "restart"
  | "blocked"
  | "won"
  | "timeout";

export interface BeadMoveEvent {
  nonce: number;
  kind: BeadMoveKind;
  color?: BeadColor;
  from?: Position[];
  to?: Position[];
  holdingFrom?: number[];
  holdingTo?: number[];
}

export interface BeadSnapshot {
  version: 1;
  seed: number;
  level: number;
  board: BeadCell[][];
  holding: HoldingBead[];
  selection: BeadSelection;
  phase: BeadPhase;
  steps: number;
  remainingMs: number;
  lastTickAt: number;
  savedAt: number;
  history: HistoryFrame[];
  lastAction: BeadMoveEvent;
  messageKey: string;
  matched: number;
  total: number;
}

export interface GeneratedChunk {
  id: string;
  targetColor: BeadColor;
  cells: Position[];
}

export interface GeneratedCycle {
  chunks: GeneratedChunk[];
}

export interface GeneratedLevel {
  seed: number;
  board: BeadCell[][];
  cycles: GeneratedCycle[];
  total: number;
}

export interface EngineResult {
  ok: boolean;
  action: BeadMoveKind;
  messageKey?: string;
  moved?: number;
}
