export const GRID_COLS = 9;
export const GRID_ROWS = 12;
export const ROUND_DURATION_MS = 120_000;
export const MAX_STRIKES = 3;
export const LEVEL_VERSION = 1 as const;
export const RUN_VERSION = 1 as const;

export type DirectionName = "up" | "right" | "down" | "left";
export type ArrowTone = "jade" | "coral";
export type RunStatus = "playing" | "paused" | "won" | "lost";

export interface GridPoint {
  x: number;
  y: number;
}

export interface Direction {
  name: DirectionName;
  dx: number;
  dy: number;
}

export interface ArrowPiece {
  id: number;
  segments: GridPoint[];
  direction: Direction;
  tone: ArrowTone;
}

export interface ArrowLevel {
  version: typeof LEVEL_VERSION;
  seed: string;
  arrows: ArrowPiece[];
  grid: number[][];
  witness: number[];
  coverage: number;
  checksum: string;
}

export interface ArrowRunSnapshot {
  version: typeof RUN_VERSION;
  seed: string;
  removed: number[];
  strikes: number;
  status: RunStatus;
  score: number;
  elapsedMs: number;
  resumedAt: number;
  updatedAt: number;
}

export interface MoveResult {
  run: ArrowRunSnapshot;
  outcome: "escaped" | "blocked" | "ignored" | "won" | "lost";
  blockers: number[];
}

const DIRECTIONS: readonly Direction[] = [
  { name: "up", dx: 0, dy: -1 },
  { name: "right", dx: 1, dy: 0 },
  { name: "down", dx: 0, dy: 1 },
  { name: "left", dx: -1, dy: 0 },
];

const POINT_KEY = (point: GridPoint) => `${point.x},${point.y}`;

function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashText(seed) || 0x6d2b79f5;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }
    return shuffled;
  }
}

function inBounds(point: GridPoint): boolean {
  return point.x >= 0 && point.x < GRID_COLS && point.y >= 0 && point.y < GRID_ROWS;
}

export function naturalDirection(segments: readonly GridPoint[]): Direction | null {
  if (segments.length < 2) return null;
  const previous = segments[segments.length - 2]!;
  const head = segments[segments.length - 1]!;
  const dx = head.x - previous.x;
  const dy = head.y - previous.y;
  return DIRECTIONS.find((direction) => direction.dx === dx && direction.dy === dy) ?? null;
}

function makeGrid(paths: readonly { id: number; segments: readonly GridPoint[] }[]): number[][] {
  const grid = Array.from({ length: GRID_ROWS }, () => Array<number>(GRID_COLS).fill(0));
  for (const path of paths) {
    for (const point of path.segments) {
      if (!inBounds(point) || grid[point.y]![point.x] !== 0) {
        throw new Error("Arrow layout contains an invalid or overlapping segment.");
      }
      grid[point.y]![point.x] = path.id;
    }
  }
  return grid;
}

function cloneDirection(direction: Direction): Direction {
  return { ...direction };
}

function orientPath(
  path: { id: number; segments: GridPoint[] },
  reverse: boolean,
  tone: ArrowTone,
): ArrowPiece {
  const segments = reverse ? [...path.segments].reverse() : [...path.segments];
  const direction = naturalDirection(segments);
  if (!direction) throw new Error("Arrow path has no natural escape direction.");
  return { id: path.id, segments, direction: cloneDirection(direction), tone };
}

export function buildDependencyGraph(
  arrows: readonly ArrowPiece[],
  grid: readonly number[][],
  remainingIds?: ReadonlySet<number>,
): Map<number, Set<number>> {
  const included = remainingIds ?? new Set(arrows.map((arrow) => arrow.id));
  const graph = new Map<number, Set<number>>();
  for (const arrow of arrows) {
    if (!included.has(arrow.id)) continue;
    const head = arrow.segments[arrow.segments.length - 1]!;
    const blockers = new Set<number>();
    let x = head.x + arrow.direction.dx;
    let y = head.y + arrow.direction.dy;
    while (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
      const occupant = grid[y]![x]!;
      if (occupant !== 0 && occupant !== arrow.id && included.has(occupant)) {
        blockers.add(occupant);
      }
      x += arrow.direction.dx;
      y += arrow.direction.dy;
    }
    graph.set(arrow.id, blockers);
  }
  return graph;
}

export function graphHasCycle(graph: ReadonlyMap<number, ReadonlySet<number>>): boolean {
  const visiting = new Set<number>();
  const visited = new Set<number>();

  const visit = (id: number): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (graph.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const id of graph.keys()) {
    if (visit(id)) return true;
  }
  return false;
}

export function solveLevel(level: Pick<ArrowLevel, "arrows" | "grid">): number[] | null {
  const remaining = new Set(level.arrows.map((arrow) => arrow.id));
  const witness: number[] = [];
  while (remaining.size > 0) {
    const graph = buildDependencyGraph(level.arrows, level.grid, remaining);
    const removable = [...remaining]
      .filter((id) => (graph.get(id)?.size ?? 0) === 0)
      .sort((a, b) => a - b);
    if (removable.length === 0) return null;
    // Remove one at a time so the witness is a direct replay script.
    const next = removable[0]!;
    witness.push(next);
    remaining.delete(next);
  }
  return witness;
}

export function blockersForArrow(
  level: Pick<ArrowLevel, "arrows" | "grid">,
  removed: ReadonlySet<number>,
  arrowId: number,
): number[] {
  const remaining = new Set(
    level.arrows.map((arrow) => arrow.id).filter((id) => !removed.has(id)),
  );
  return [...(buildDependencyGraph(level.arrows, level.grid, remaining).get(arrowId) ?? [])]
    .sort((a, b) => a - b);
}

export function isArrowRemovable(
  level: Pick<ArrowLevel, "arrows" | "grid">,
  removed: ReadonlySet<number>,
  arrowId: number,
): boolean {
  return !removed.has(arrowId) && blockersForArrow(level, removed, arrowId).length === 0;
}

export function verifyWitness(
  level: Pick<ArrowLevel, "arrows" | "grid" | "witness">,
): boolean {
  const expectedIds = new Set(level.arrows.map((arrow) => arrow.id));
  if (level.witness.length !== expectedIds.size) return false;
  const removed = new Set<number>();
  for (const arrowId of level.witness) {
    if (!expectedIds.has(arrowId) || removed.has(arrowId)) return false;
    if (!isArrowRemovable(level, removed, arrowId)) return false;
    removed.add(arrowId);
  }
  return removed.size === expectedIds.size;
}

type UndirectedPath = { id: number; segments: GridPoint[] };

function horizontalPath(id: number, x: number, y: number, length: number): UndirectedPath {
  return {
    id,
    segments: Array.from({ length }, (_, index) => ({ x: x + index, y })),
  };
}

function createTiledPaths(seed: string): UndirectedPath[] {
  const random = new SeededRandom(`${seed}:tiles`);
  const paths: UndirectedPath[] = [];
  let nextId = 1;

  for (let band = 0; band < GRID_ROWS / 2; band += 1) {
    const y = band * 2;
    const widths = random.shuffle([2, 3, 4] as const);
    let x = 0;
    for (const width of widths) {
      if (width === 2) {
        if (random.bool()) {
          paths.push(horizontalPath(nextId++, x, y, 2));
          paths.push(horizontalPath(nextId++, x, y + 1, 2));
        } else {
          paths.push({ id: nextId++, segments: [{ x, y }, { x, y: y + 1 }] });
          paths.push({ id: nextId++, segments: [{ x: x + 1, y }, { x: x + 1, y: y + 1 }] });
        }
      } else if (width === 3) {
        if (random.bool(0.56)) {
          paths.push({
            id: nextId++,
            segments: [{ x: x + 1, y }, { x, y }, { x, y: y + 1 }],
          });
          paths.push({
            id: nextId++,
            segments: [{ x: x + 1, y: y + 1 }, { x: x + 2, y: y + 1 }, { x: x + 2, y }],
          });
        } else {
          paths.push(horizontalPath(nextId++, x, y, 3));
          paths.push(horizontalPath(nextId++, x, y + 1, 3));
        }
      } else {
        const split = random.bool(0.55);
        if (split) {
          paths.push(horizontalPath(nextId++, x, y, 2));
          paths.push(horizontalPath(nextId++, x, y + 1, 2));
          paths.push({
            id: nextId++,
            segments: [
              { x: x + 2, y },
              { x: x + 3, y },
              { x: x + 3, y: y + 1 },
              { x: x + 2, y: y + 1 },
            ],
          });
        } else if (random.bool()) {
          paths.push({
            id: nextId++,
            segments: [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }],
          });
          paths.push({
            id: nextId++,
            segments: [
              { x: x + 2, y },
              { x: x + 3, y },
              { x: x + 3, y: y + 1 },
              { x: x + 2, y: y + 1 },
            ],
          });
        } else {
          paths.push(horizontalPath(nextId++, x, y, 4));
          paths.push(horizontalPath(nextId++, x, y + 1, 4));
        }
      }
      x += width;
    }
  }
  return paths;
}

function orientAcyclic(paths: readonly UndirectedPath[], grid: number[][], seed: string): ArrowPiece[] | null {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const random = new SeededRandom(`${seed}:orientation:${attempt}`);
    const order = random.shuffle(paths);
    const oriented = new Map<number, ArrowPiece>();
    let failed = false;

    for (const path of order) {
      const tone: ArrowTone = random.bool(0.58) ? "jade" : "coral";
      const choices = random.bool() ? [false, true] : [true, false];
      let accepted: ArrowPiece | null = null;
      for (const reverse of choices) {
        const candidate = orientPath(path, reverse, tone);
        const next = [...oriented.values(), candidate];
        if (!graphHasCycle(buildDependencyGraph(next, grid))) {
          accepted = candidate;
          break;
        }
      }
      if (!accepted) {
        failed = true;
        break;
      }
      oriented.set(path.id, accepted);
    }

    if (!failed && oriented.size === paths.length) {
      const arrows = [...oriented.values()].sort((a, b) => a.id - b.id);
      if (!graphHasCycle(buildDependencyGraph(arrows, grid))) return arrows;
    }
  }
  return null;
}

function createFallbackLevel(seed: string): Omit<ArrowLevel, "witness" | "checksum"> {
  const random = new SeededRandom(`${seed}:fallback`);
  const arrows: ArrowPiece[] = [];
  let id = 1;
  for (let y = 0; y < GRID_ROWS; y += 1) {
    const lengths = random.shuffle([2, 3, 4] as const);
    const pointRight = random.bool();
    let x = 0;
    for (const length of lengths) {
      const path = horizontalPath(id, x, y, length);
      arrows.push(orientPath(path, !pointRight, random.bool(0.58) ? "jade" : "coral"));
      x += length;
      id += 1;
    }
  }
  const grid = makeGrid(arrows);
  return { version: LEVEL_VERSION, seed, arrows, grid, coverage: 1 };
}

function checksumFor(seed: string, arrows: readonly ArrowPiece[], witness: readonly number[]): string {
  const payload = arrows
    .map((arrow) => `${arrow.id}:${arrow.direction.name}:${arrow.segments.map(POINT_KEY).join(";")}`)
    .join("|");
  return hashText(`${seed}|${payload}|${witness.join(",")}`).toString(16).padStart(8, "0");
}

export function generateLevel(seed: string): ArrowLevel {
  const normalizedSeed = String(seed).trim().slice(0, 80) || "garden-arrowworks";
  const paths = createTiledPaths(normalizedSeed);
  const grid = makeGrid(paths);
  const arrows = orientAcyclic(paths, grid, normalizedSeed);
  const candidate = arrows
    ? { version: LEVEL_VERSION, seed: normalizedSeed, arrows, grid, coverage: 1 }
    : createFallbackLevel(normalizedSeed);
  const witness = solveLevel(candidate);
  if (!witness) {
    const fallback = createFallbackLevel(normalizedSeed);
    const fallbackWitness = solveLevel(fallback);
    if (!fallbackWitness) throw new Error("Unable to construct an acyclic arrow level.");
    return {
      ...fallback,
      witness: fallbackWitness,
      checksum: checksumFor(normalizedSeed, fallback.arrows, fallbackWitness),
    };
  }
  return {
    ...candidate,
    witness,
    checksum: checksumFor(normalizedSeed, candidate.arrows, witness),
  };
}

export function createRun(seed: string, now = Date.now()): ArrowRunSnapshot {
  const level = generateLevel(seed);
  return {
    version: RUN_VERSION,
    seed: level.seed,
    removed: [],
    strikes: 0,
    status: "playing",
    score: 0,
    elapsedMs: 0,
    resumedAt: now,
    updatedAt: now,
  };
}

export function elapsedFor(run: ArrowRunSnapshot, now = Date.now()): number {
  const liveDelta = run.status === "playing" ? Math.max(0, now - run.resumedAt) : 0;
  return Math.max(0, Math.min(ROUND_DURATION_MS, run.elapsedMs + liveDelta));
}

export function remainingFor(run: ArrowRunSnapshot, now = Date.now()): number {
  return Math.max(0, ROUND_DURATION_MS - elapsedFor(run, now));
}

export function settleRunClock(run: ArrowRunSnapshot, now = Date.now()): ArrowRunSnapshot {
  const elapsedMs = elapsedFor(run, now);
  if (run.status !== "playing") return { ...run, elapsedMs, updatedAt: now };
  return {
    ...run,
    elapsedMs,
    resumedAt: now,
    updatedAt: now,
    status: elapsedMs >= ROUND_DURATION_MS ? "lost" : run.status,
  };
}

export function pauseRun(run: ArrowRunSnapshot, now = Date.now()): ArrowRunSnapshot {
  const settled = settleRunClock(run, now);
  return settled.status === "playing" ? { ...settled, status: "paused" } : settled;
}

export function resumeRun(run: ArrowRunSnapshot, now = Date.now()): ArrowRunSnapshot {
  if (run.status !== "paused" || run.elapsedMs >= ROUND_DURATION_MS) return run;
  return { ...run, status: "playing", resumedAt: now, updatedAt: now };
}

export function applyArrowMove(
  level: ArrowLevel,
  run: ArrowRunSnapshot,
  arrowId: number,
  now = Date.now(),
): MoveResult {
  const settled = settleRunClock(run, now);
  if (settled.status !== "playing") {
    return { run: settled, outcome: settled.status === "lost" ? "lost" : "ignored", blockers: [] };
  }
  const arrowIds = new Set(level.arrows.map((arrow) => arrow.id));
  const removed = new Set(settled.removed);
  if (!arrowIds.has(arrowId) || removed.has(arrowId)) {
    return { run: settled, outcome: "ignored", blockers: [] };
  }

  const blockers = blockersForArrow(level, removed, arrowId);
  if (blockers.length > 0) {
    const strikes = Math.min(MAX_STRIKES, settled.strikes + 1);
    const lost = strikes >= MAX_STRIKES;
    return {
      run: {
        ...settled,
        strikes,
        score: Math.max(0, settled.score - 15),
        status: lost ? "lost" : "playing",
        updatedAt: now,
      },
      outcome: lost ? "lost" : "blocked",
      blockers,
    };
  }

  const nextRemoved = [...settled.removed, arrowId];
  const won = nextRemoved.length === level.arrows.length;
  const timeBonus = Math.floor(remainingFor(settled, now) / 10_000);
  return {
    run: {
      ...settled,
      removed: nextRemoved,
      score: settled.score + 100 + timeBonus,
      status: won ? "won" : "playing",
      updatedAt: now,
    },
    outcome: won ? "won" : "escaped",
    blockers: [],
  };
}

function isRunStatus(value: unknown): value is RunStatus {
  return value === "playing" || value === "paused" || value === "won" || value === "lost";
}

export function restoreRun(value: unknown, now = Date.now()): ArrowRunSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ArrowRunSnapshot>;
  if (
    candidate.version !== RUN_VERSION
    || typeof candidate.seed !== "string"
    || candidate.seed.trim().length === 0
    || !Array.isArray(candidate.removed)
    || !candidate.removed.every((id) => Number.isSafeInteger(id) && id > 0)
    || !Number.isInteger(candidate.strikes)
    || Number(candidate.strikes) < 0
    || Number(candidate.strikes) > MAX_STRIKES
    || !isRunStatus(candidate.status)
    || !Number.isFinite(candidate.score)
    || Number(candidate.score) < 0
    || !Number.isFinite(candidate.elapsedMs)
    || Number(candidate.elapsedMs) < 0
    || !Number.isFinite(candidate.resumedAt)
    || !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }

  const level = generateLevel(candidate.seed);
  const removed = candidate.removed as number[];
  if (new Set(removed).size !== removed.length) return null;
  const replayed = new Set<number>();
  for (const arrowId of removed) {
    if (!isArrowRemovable(level, replayed, arrowId)) return null;
    replayed.add(arrowId);
  }
  if (candidate.status === "won" && removed.length !== level.arrows.length) return null;
  if (candidate.status !== "won" && removed.length === level.arrows.length) return null;
  if (candidate.status !== "lost" && Number(candidate.strikes) >= MAX_STRIKES) return null;

  const restored: ArrowRunSnapshot = {
    version: RUN_VERSION,
    seed: level.seed,
    removed: [...removed],
    strikes: Number(candidate.strikes),
    status: candidate.status,
    score: Math.floor(Number(candidate.score)),
    elapsedMs: Math.min(ROUND_DURATION_MS, Number(candidate.elapsedMs)),
    resumedAt: Number(candidate.resumedAt),
    updatedAt: Number(candidate.updatedAt),
  };
  // A normal visibility transition or unmount persists a settled paused run.
  // If the browser crashes before those lifecycle hooks fire, do not charge
  // unknown background wall-clock time on recovery. Preserve the last settled
  // foreground segment and require an explicit resume instead.
  if (restored.status === "playing") {
    return {
      ...restored,
      status: restored.elapsedMs >= ROUND_DURATION_MS ? "lost" : "paused",
      resumedAt: now,
      updatedAt: now,
    };
  }
  return restored;
}

export function createLocalSeed(now = Date.now(), sequence = 0): string {
  const date = new Date(now).toISOString().slice(0, 10).replaceAll("-", "");
  const entropy = hashText(`${now}:${sequence}`).toString(36).toUpperCase().padStart(6, "0");
  return `GA-${date}-${entropy}`;
}

export function shortSeed(seed: string): string {
  const normalized = seed.replace(/^GA-/, "");
  return normalized.length <= 16 ? normalized : `${normalized.slice(0, 8)}…${normalized.slice(-6)}`;
}
