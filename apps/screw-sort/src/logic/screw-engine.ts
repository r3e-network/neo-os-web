export const BOX_COUNT = 4;
export const BOX_CAPACITY = 3;
export const BUFFER_CAPACITY = 5;
export const PHASE_COUNT = 3;
export const BOARDS_PER_PHASE = 4;
export const SCREWS_PER_BOARD = 3;
export const MAX_UNDOS = 3;

// Soft-fail efficiency scoring. [PLACEHOLDER] — calibrate on real-device playtest.
// demerits = undosUsed + overflows; this is the threshold for a 2-star (vs 3-star) clear.
export const STAR_DEMERIT_TWO = 3;

export const SCREW_COLORS = [
  { id: "red", hex: 0xe34e3f },
  { id: "gold", hex: 0xe7a51a },
  { id: "green", hex: 0x62a83f },
  { id: "blue", hex: 0x3785c5 },
  { id: "violet", hex: 0x8b63c7 },
  { id: "coral", hex: 0xe77f52 },
] as const;

export type ScrewColor = (typeof SCREW_COLORS)[number]["id"];
export type RunStatus = "playing" | "won";

export interface ScrewDefinition {
  id: string;
  boardId: string;
  color: ScrewColor;
  lane: number;
  slot: number;
  blockedBy: string[];
}

export interface BoardDefinition {
  id: string;
  phase: number;
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
  z: number;
  woodTint: number;
  screws: ScrewDefinition[];
}

export interface ScrewLevel {
  version: 1;
  seed: string;
  phaseColors: ScrewColor[][];
  boxQueues: ScrewColor[][];
  boards: BoardDefinition[];
  solutionOrder: string[];
}

export interface BoxState {
  lane: number;
  queueIndex: number;
  count: number;
}

export interface BufferItem {
  screwId: string;
  color: ScrewColor;
  lane: number;
}

export interface FlushedScrew {
  screwId: string;
  lane: number;
}

export type MoveEvent =
  | {
      kind: "move";
      screwId: string;
      destination: "box" | "buffer";
      lane: number | null;
      flushed: FlushedScrew[];
      completedLanes: number[];
    }
  | { kind: "undo" }
  | { kind: "restart" }
  | { kind: "pause"; paused: boolean };

export interface CoreRunState {
  removedScrewIds: string[];
  boxes: BoxState[];
  buffer: BufferItem[];
  status: RunStatus;
  paused: boolean;
  moves: number;
  undosUsed: number;
  overflows: number;
  revision: number;
  lastEvent: MoveEvent | null;
}

export interface ScrewSession {
  level: ScrewLevel;
  core: CoreRunState;
  history: CoreRunState[];
  moveTrace: string[];
  startedAt: number;
}

export interface MoveResult {
  ok: boolean;
  reason?: "paused" | "finished" | "missing" | "removed" | "blocked";
  session: ScrewSession;
}

const BASE_LAYOUT: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [
    [118, 304, 42],
    [282, 322, -38],
    [133, 488, 10],
    [275, 496, 68],
  ],
  [
    [126, 350, -14],
    [276, 370, 20],
    [160, 452, -43],
    [244, 520, 36],
  ],
  [
    [124, 392, 24],
    [276, 402, -18],
    [146, 526, -6],
    [268, 540, 15],
  ],
];

const WOOD_TINTS = [0xffffff, 0xf2d7b0, 0xdcb788, 0xc99a6b, 0xe8c798] as const;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const currentValue = out[index]!;
    out[index] = out[other]!;
    out[other] = currentValue;
  }
  return out;
}

function phasePalette(previous: readonly ScrewColor[] | null, random: () => number): ScrewColor[] {
  const colors = SCREW_COLORS.map(({ id }) => id);
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = shuffle(colors, random).slice(0, BOX_COUNT);
    if (!previous || candidate.every((color, lane) => color !== previous[lane])) {
      return candidate;
    }
  }
  throw new Error("Unable to construct a deranged color phase");
}

export function generateLevel(seed: string | number): ScrewLevel {
  const normalizedSeed = String(seed).trim() || "screw-sort";
  const random = createSeededRandom(normalizedSeed);
  const phaseColors: ScrewColor[][] = [];
  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    phaseColors.push(phasePalette(phaseColors.at(-1) ?? null, random));
  }

  const boxQueues = Array.from({ length: BOX_COUNT }, (_, lane) =>
    phaseColors.map((colors) => colors[lane]!),
  );
  const boards: BoardDefinition[] = [];
  const solutionOrder: string[] = [];

  for (let phase = PHASE_COUNT - 1; phase >= 0; phase -= 1) {
    for (let boardIndex = 0; boardIndex < BOARDS_PER_PHASE; boardIndex += 1) {
      const [baseX, baseY, baseAngle] = BASE_LAYOUT[phase]![boardIndex]!;
      const id = `p${phase}b${boardIndex}`;
      const screws: ScrewDefinition[] = [];
      for (let slot = 0; slot < SCREWS_PER_BOARD; slot += 1) {
        const lane = (boardIndex + slot + phase) % BOX_COUNT;
        const screwId = `${id}s${slot}`;
        screws.push({
          id: screwId,
          boardId: id,
          color: phaseColors[phase]![lane]!,
          lane,
          slot,
          blockedBy: phase === 0
            ? []
            : [`p${phase - 1}b${(boardIndex + slot) % BOARDS_PER_PHASE}`],
        });
      }
      boards.push({
        id,
        phase,
        x: Math.round(baseX + (random() - 0.5) * 10),
        y: Math.round(baseY + (random() - 0.5) * 10),
        angle: Math.round(baseAngle + (random() - 0.5) * 8),
        width: 184 + Math.round(random() * 16),
        height: 54,
        z: (PHASE_COUNT - phase) * 20 + boardIndex,
        woodTint: WOOD_TINTS[Math.floor(random() * WOOD_TINTS.length)]!,
        screws,
      });
    }
  }

  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    const phaseBoards = boards
      .filter((board) => board.phase === phase)
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const board of phaseBoards) {
      solutionOrder.push(...board.screws.map(({ id }) => id));
    }
  }

  return {
    version: 1,
    seed: normalizedSeed,
    phaseColors,
    boxQueues,
    boards,
    solutionOrder,
  };
}

export function createCoreState(): CoreRunState {
  return {
    removedScrewIds: [],
    boxes: Array.from({ length: BOX_COUNT }, (_, lane) => ({ lane, queueIndex: 0, count: 0 })),
    buffer: [],
    status: "playing",
    paused: false,
    moves: 0,
    undosUsed: 0,
    overflows: 0,
    revision: 0,
    lastEvent: null,
  };
}

export function createSession(seed: string | number, now = Date.now()): ScrewSession {
  return {
    level: generateLevel(seed),
    core: createCoreState(),
    history: [],
    moveTrace: [],
    startedAt: now,
  };
}

export function currentBoxColor(level: ScrewLevel, box: BoxState): ScrewColor | null {
  return level.boxQueues[box.lane]?.[box.queueIndex] ?? null;
}

export function allScrews(level: ScrewLevel): ScrewDefinition[] {
  return level.boards.flatMap((board) => board.screws);
}

export function screwById(level: ScrewLevel, screwId: string): ScrewDefinition | null {
  for (const board of level.boards) {
    const screw = board.screws.find(({ id }) => id === screwId);
    if (screw) return screw;
  }
  return null;
}

export function isBoardCleared(level: ScrewLevel, core: CoreRunState, boardId: string): boolean {
  const board = level.boards.find(({ id }) => id === boardId);
  if (!board) return false;
  const removed = new Set(core.removedScrewIds);
  return board.screws.every(({ id }) => removed.has(id));
}

export function isScrewUnlocked(
  level: ScrewLevel,
  core: CoreRunState,
  screw: ScrewDefinition,
): boolean {
  return screw.blockedBy.every((boardId) => isBoardCleared(level, core, boardId));
}

function cloneCore(core: CoreRunState): CoreRunState {
  return {
    ...core,
    removedScrewIds: [...core.removedScrewIds],
    boxes: core.boxes.map((box) => ({ ...box })),
    buffer: core.buffer.map((item) => ({ ...item })),
    overflows: core.overflows,
    lastEvent: core.lastEvent
      ? JSON.parse(JSON.stringify(core.lastEvent)) as MoveEvent
      : null,
  };
}

function flushBuffer(
  level: ScrewLevel,
  core: CoreRunState,
  flushed: FlushedScrew[],
  completedLanes: number[],
): void {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let index = 0; index < core.buffer.length; index += 1) {
      const item = core.buffer[index]!;
      const preferred = core.boxes.find((candidate) =>
        candidate.lane === item.lane &&
        currentBoxColor(level, candidate) === item.color &&
        candidate.count < BOX_CAPACITY,
      );
      const box = preferred ?? core.boxes.find((candidate) =>
        currentBoxColor(level, candidate) === item.color && candidate.count < BOX_CAPACITY,
      );
      if (!box) continue;

      core.buffer.splice(index, 1);
      box.count += 1;
      flushed.push({ screwId: item.screwId, lane: box.lane });
      if (box.count === BOX_CAPACITY) {
        box.count = 0;
        box.queueIndex += 1;
        completedLanes.push(box.lane);
      }
      progressed = true;
      break;
    }
  }
}

function runWon(level: ScrewLevel, core: CoreRunState): boolean {
  return (
    core.removedScrewIds.length === allScrews(level).length &&
    core.buffer.length === 0 &&
    core.boxes.every((box) => currentBoxColor(level, box) === null && box.count === 0)
  );
}

export function applyScrewMove(session: ScrewSession, screwId: string): MoveResult {
  const { level } = session;
  const previous = session.core;
  if (previous.paused) return { ok: false, reason: "paused", session };
  if (previous.status !== "playing") return { ok: false, reason: "finished", session };
  const screw = screwById(level, screwId);
  if (!screw) return { ok: false, reason: "missing", session };
  if (previous.removedScrewIds.includes(screwId)) {
    return { ok: false, reason: "removed", session };
  }
  if (!isScrewUnlocked(level, previous, screw)) {
    return { ok: false, reason: "blocked", session };
  }

  const core = cloneCore(previous);
  const flushed: FlushedScrew[] = [];
  const completedLanes: number[] = [];
  const preferredBox = core.boxes.find((box) =>
    box.lane === screw.lane &&
    currentBoxColor(level, box) === screw.color &&
    box.count < BOX_CAPACITY,
  );
  const targetBox = preferredBox ?? core.boxes.find((box) =>
    currentBoxColor(level, box) === screw.color && box.count < BOX_CAPACITY,
  );
  let destination: "box" | "buffer" | "loss";
  let lane: number | null = null;

  if (targetBox) {
    destination = "box";
    lane = targetBox.lane;
    core.removedScrewIds.push(screwId);
    targetBox.count += 1;
    if (targetBox.count === BOX_CAPACITY) {
      targetBox.count = 0;
      targetBox.queueIndex += 1;
      completedLanes.push(targetBox.lane);
      flushBuffer(level, core, flushed, completedLanes);
    }
  } else if (core.buffer.length < BUFFER_CAPACITY) {
    destination = "buffer";
    core.removedScrewIds.push(screwId);
    core.buffer.push({ screwId, color: screw.color, lane: screw.lane });
  } else {
    // Soft-fail: the safe tray is full, but we never lose. The screw still
    // lands in the tray and only erodes the efficiency star rating.
    destination = "buffer";
    core.removedScrewIds.push(screwId);
    core.buffer.push({ screwId, color: screw.color, lane: screw.lane });
    core.overflows += 1;
  }

  core.moves += 1;
  core.revision += 1;
  core.lastEvent = {
    kind: "move",
    screwId,
    destination,
    lane,
    flushed,
    completedLanes,
  };
  if (runWon(level, core)) core.status = "won";

  return {
    ok: true,
    session: {
      ...session,
      core,
      history: [...session.history.slice(-(MAX_UNDOS - 1)), cloneCore(previous)],
      moveTrace: [...session.moveTrace, screwId],
    },
  };
}

export function undoMove(session: ScrewSession): ScrewSession {
  if (session.history.length === 0 || session.core.undosUsed >= MAX_UNDOS) return session;
  const restored = cloneCore(session.history.at(-1) as CoreRunState);
  restored.undosUsed = session.core.undosUsed + 1;
  restored.paused = false;
  restored.revision = session.core.revision + 1;
  restored.lastEvent = { kind: "undo" };
  return {
    ...session,
    core: restored,
    history: session.history.slice(0, -1),
    moveTrace: session.moveTrace.slice(0, -1),
  };
}

export function togglePause(session: ScrewSession): ScrewSession {
  if (session.core.status !== "playing") return session;
  const core = cloneCore(session.core);
  core.paused = !core.paused;
  core.revision += 1;
  core.lastEvent = { kind: "pause", paused: core.paused };
  return { ...session, core };
}

export function restartSession(session: ScrewSession, nextSeed = session.level.seed): ScrewSession {
  const restarted = createSession(nextSeed);
  restarted.core.revision = session.core.revision + 1;
  restarted.core.lastEvent = { kind: "restart" };
  return restarted;
}

export function verifyConstructiveSolution(level: ScrewLevel): boolean {
  let session = createSession(level.seed, 0);
  session = { ...session, level };
  for (const screwId of level.solutionOrder) {
    const result = applyScrewMove(session, screwId);
    if (!result.ok) return false;
    session = result.session;
  }
  return session.core.status === "won" && session.core.buffer.length === 0;
}

export function deriveSeed(now = Date.now(), entropy?: Uint32Array): string {
  const value = entropy?.[0] ?? Math.floor(Math.random() * 0xffffffff);
  return `${now.toString(36)}-${value.toString(36)}`;
}

/**
 * Efficiency star rating for a cleared run. Replaces the removed hard-fail:
 * every clear earns at least 1 star; a flawless clear (no undo, no overflow)
 * earns 3. [PLACEHOLDER] STAR_DEMERIT_TWO needs real-device calibration.
 */
export function computeStars(core: CoreRunState): 1 | 2 | 3 {
  const demerits = core.undosUsed + core.overflows;
  if (demerits === 0) return 3;
  if (demerits <= STAR_DEMERIT_TWO) return 2;
  return 1;
}
