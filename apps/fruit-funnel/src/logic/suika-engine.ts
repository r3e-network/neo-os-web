/**
 * Suika Orchard — pure game logic (the single source of truth).
 *
 * Physics lives in the Phaser/Matter scene; this engine owns the discrete
 * model: the fruit board (id + level + position), the drop queue, score,
 * best, and phase. The scene reports transitions (drop / merge / sync /
 * game over) here and re-renders from the returned snapshot. Positions are
 * tracked so a refresh can restore the exact board (policy: scene is never
 * the sole source of truth).
 *
 * All tuning values are hypotheses — see docs/suika-redesign-2026.md §4.
 */

export const SNAPSHOT_VERSION = 1 as const;

export const MAX_LEVEL = 10;
export const MAX_DROPPABLE_LEVEL = 4;

/** Fruit radii (logical px) per level 0..10. Index order = evolution chain. */
export const FRUIT_RADII = [
  16, 22, 29, 37, 46, 56, 67, 79, 92, 106, 120,
] as const;

/** Points awarded when two level-(L-1) fruits merge into level L. Triangular ×10. */
export const SCORE_PER_MERGE: readonly number[] = (() => {
  const table: number[] = [0];
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    table[level] = (level * (level + 1)) / 2 * 10;
  }
  return table;
})();

/** Bonus when two watermelons (MAX_LEVEL) merge and clear. [PLACEHOLDER] */
export const WATERMELON_BONUS = 100;

/** Physics/UX tuning shared with the scene. [PLACEHOLDER] until playtest. */
export const DANGER_Y = 150;
export const GRACE_MS = 1_500;
export const SETTLE_SPEED = 0.6;
export const DROP_COOLDOWN_MS = 350;
export const GRAVITY_Y = 1.1;
export const RESTITUTION = 0.08;
export const FRICTION = 0.4;

export const SUIKA_ENGINE_MESSAGE_KEYS = [
  "statusReady",
  "statusDropped",
  "statusMerged",
  "statusGameOver",
  "statusPaused",
  "statusResumed",
] as const;
export type SuikaEngineMessageKey = (typeof SUIKA_ENGINE_MESSAGE_KEYS)[number];

export type SuikaLevel = number;
export type SuikaPhase = "playing" | "paused" | "gameover";

export interface SuikaFruit {
  id: string;
  level: SuikaLevel;
  x: number;
  y: number;
}

export interface SuikaAction {
  nonce: number;
  kind: "ready" | "dropped" | "merged" | "gameover" | "pause" | "resume";
  fruitId?: string;
  clearedIds?: [string, string];
  newId?: string;
  level?: SuikaLevel;
}

export interface SuikaSnapshot {
  version: typeof SNAPSHOT_VERSION;
  seed: number;
  board: SuikaFruit[];
  currentLevel: SuikaLevel;
  nextLevel: SuikaLevel;
  score: number;
  best: number;
  phase: SuikaPhase;
  lastAction: SuikaAction;
  messageKey: SuikaEngineMessageKey;
  savedAt: number;
}

const MESSAGE_KEYS = new Set<SuikaEngineMessageKey>(SUIKA_ENGINE_MESSAGE_KEYS);
const PHASES = new Set<SuikaPhase>(["playing", "paused", "gameover"]);

function randomDroppableLevel(): SuikaLevel {
  return Math.floor(Math.random() * (MAX_DROPPABLE_LEVEL + 1));
}

function newFruitId(seed: number, counter: number): string {
  return `${seed}:${counter}`;
}

export class SuikaEngine {
  private state: SuikaSnapshot;
  private nonce: number;
  private counter: number;

  private constructor(snapshot: SuikaSnapshot) {
    this.state = snapshot;
    this.nonce = snapshot.lastAction.nonce;
    this.counter = snapshot.board.length;
  }

  static fresh(seed = Date.now() >>> 0, best = 0, now = Date.now()): SuikaEngine {
    return new SuikaEngine({
      version: SNAPSHOT_VERSION,
      seed: seed || 1,
      board: [],
      currentLevel: randomDroppableLevel(),
      nextLevel: randomDroppableLevel(),
      score: 0,
      best,
      phase: "playing",
      lastAction: { nonce: 0, kind: "ready" },
      messageKey: "statusReady",
      savedAt: now,
    });
  }

  static restore(value: unknown, best = 0, now = Date.now()): SuikaEngine | null {
    if (!isValidSuikaSnapshot(value)) return null;
    const snapshot: SuikaSnapshot = {
      ...value,
      board: value.board.map((fruit) => ({ ...fruit })),
      phase: value.phase === "playing" ? "paused" : value.phase,
      savedAt: now,
      lastAction: { nonce: value.lastAction.nonce + 1, kind: "ready" },
      messageKey: value.phase === "gameover" ? "statusGameOver" : "statusReady",
      best: Math.max(best, value.best, value.score),
    };
    return new SuikaEngine(snapshot);
  }

  snapshot(now = Date.now()): SuikaSnapshot {
    this.state.savedAt = now;
    return {
      ...this.state,
      board: this.state.board.map((fruit) => ({ ...fruit })),
    };
  }

  dropFruit(level: SuikaLevel, x: number, y: number, now = Date.now()): { snapshot: SuikaSnapshot; fruitId: string } {
    if (this.state.phase !== "playing") {
      return { snapshot: this.snapshot(now), fruitId: "" };
    }
    if (level < 0 || level > MAX_DROPPABLE_LEVEL || level !== this.state.currentLevel) {
      return { snapshot: this.snapshot(now), fruitId: "" };
    }
    const id = newFruitId(this.state.seed, this.counter);
    this.counter += 1;
    this.state.board.push({ id, level, x, y });
    this.state.currentLevel = this.state.nextLevel;
    this.state.nextLevel = randomDroppableLevel();
    this.record("dropped", { fruitId: id, level });
    this.state.messageKey = "statusDropped";
    return { snapshot: this.snapshot(now), fruitId: id };
  }

  mergeFruits(
    idA: string,
    idB: string,
    newLevel: SuikaLevel,
    x: number,
    y: number,
    now = Date.now(),
  ): { snapshot: SuikaSnapshot; newFruitId: string | null } {
    if (this.state.phase !== "playing") {
      return { snapshot: this.snapshot(now), newFruitId: null };
    }
    const indexA = this.state.board.findIndex((fruit) => fruit.id === idA);
    const indexB = this.state.board.findIndex((fruit) => fruit.id === idB);
    if (indexA < 0 || indexB < 0 || indexA === indexB) {
      return { snapshot: this.snapshot(now), newFruitId: null };
    }
    this.state.board.splice(Math.max(indexA, indexB), 1);
    this.state.board.splice(Math.min(indexA, indexB), 1);

    let newFruitId: string | null = null;
    if (newLevel > MAX_LEVEL) {
      this.state.score += WATERMELON_BONUS;
    } else {
      const id = newFruitIdFrom(this.state.seed, this.counter);
      this.counter += 1;
      this.state.board.push({ id, level: newLevel, x, y });
      this.state.score += SCORE_PER_MERGE[newLevel] ?? 0;
      newFruitId = id;
    }
    this.state.best = Math.max(this.state.best, this.state.score);
    this.record("merged", { clearedIds: [idA, idB], newId: newFruitId ?? undefined, level: newLevel });
    this.state.messageKey = "statusMerged";
    return { snapshot: this.snapshot(now), newFruitId };
  }

  syncBoard(positions: Array<{ id: string; x: number; y: number }>, now = Date.now()): SuikaSnapshot {
    if (this.state.phase !== "playing") return this.snapshot(now);
    const byId = new Map(positions.map((entry) => [entry.id, entry]));
    for (const fruit of this.state.board) {
      const entry = byId.get(fruit.id);
      if (entry) {
        fruit.x = entry.x;
        fruit.y = entry.y;
      }
    }
    return this.snapshot(now);
  }

  setGameOver(now = Date.now()): SuikaSnapshot {
    if (this.state.phase !== "playing") return this.snapshot(now);
    this.state.phase = "gameover";
    this.state.best = Math.max(this.state.best, this.state.score);
    this.record("gameover");
    this.state.messageKey = "statusGameOver";
    return this.snapshot(now);
  }

  togglePause(now = Date.now()): SuikaSnapshot {
    if (this.state.phase === "playing") {
      this.state.phase = "paused";
      this.record("pause");
      this.state.messageKey = "statusPaused";
    } else if (this.state.phase === "paused") {
      this.state.phase = "playing";
      this.record("resume");
      this.state.messageKey = "statusResumed";
    }
    return this.snapshot(now);
  }

  getBest(): number {
    return this.state.best;
  }

  private record(kind: SuikaAction["kind"], details: Omit<SuikaAction, "nonce" | "kind"> = {}): void {
    this.nonce += 1;
    this.state.lastAction = { nonce: this.nonce, kind, ...details };
  }
}

function newFruitIdFrom(seed: number, counter: number): string {
  return newFruitId(seed, counter);
}

export function isValidSuikaSnapshot(value: unknown): value is SuikaSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as SuikaSnapshot;
  if (snapshot.version !== SNAPSHOT_VERSION) return false;
  if (!Number.isInteger(snapshot.seed) || snapshot.seed <= 0) return false;
  if (!Array.isArray(snapshot.board)) return false;
  for (const fruit of snapshot.board) {
    if (!fruit || typeof fruit !== "object") return false;
    if (typeof fruit.id !== "string" || fruit.id.length === 0) return false;
    if (!Number.isInteger(fruit.level) || fruit.level < 0 || fruit.level > MAX_LEVEL) return false;
    if (!Number.isFinite(fruit.x) || !Number.isFinite(fruit.y)) return false;
  }
  if (!Number.isInteger(snapshot.currentLevel) || snapshot.currentLevel < 0 || snapshot.currentLevel > MAX_DROPPABLE_LEVEL) return false;
  if (!Number.isInteger(snapshot.nextLevel) || snapshot.nextLevel < 0 || snapshot.nextLevel > MAX_DROPPABLE_LEVEL) return false;
  if (!Number.isInteger(snapshot.score) || snapshot.score < 0) return false;
  if (!Number.isInteger(snapshot.best) || snapshot.best < 0) return false;
  if (!PHASES.has(snapshot.phase)) return false;
  if (!MESSAGE_KEYS.has(snapshot.messageKey)) return false;
  if (!snapshot.lastAction || typeof snapshot.lastAction !== "object") return false;
  if (!Number.isInteger(snapshot.lastAction.nonce) || snapshot.lastAction.nonce < 0) return false;
  if (!Number.isFinite(snapshot.savedAt)) return false;
  return true;
}
