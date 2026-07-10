/**
 * progress.ts — pure meta-progression state for Catch the Goose (G4).
 *
 * Persisted under localStorage "zhuada-e:progress" as schema v2:
 *   { v: 2, level, wins, best: { [level]: score }, geese: [sceneId…] }
 *
 * The legacy v1 shape `{ level }` (written by earlier builds) migrates in
 * place on first read — the player keeps their unlocked level. All functions
 * are pure so tests can exercise migration + win transitions without a DOM.
 */

import { TOTAL_LEVELS } from "./game-rules";
import { SCENES, isSceneFinalLevel, sceneIndexOfLevel } from "./scenes";

export interface GooseProgress {
  /** Highest UNLOCKED level (1-based; playable levels are 1..level). */
  level: number;
  /** Cumulative level wins (replays included). */
  wins: number;
  /** Best score per level (only levels won at least once appear). */
  best: Record<number, number>;
  /** Unlocked limited-edition geese (scene ids, ordered by unlock time). */
  geese: number[];
}

export const EMPTY_PROGRESS: GooseProgress = { level: 1, wins: 0, best: {}, geese: [] };

function clampLevel(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), TOTAL_LEVELS) : 1;
}

/** Parse a persisted payload (v2, legacy v1 `{level}`, or garbage → defaults). */
export function parseProgress(raw: string | null | undefined): GooseProgress {
  if (!raw) return { ...EMPTY_PROGRESS, best: {}, geese: [] };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") throw new Error("not an object");
    const level = clampLevel(data.level);
    if (data.v !== 2) {
      // Legacy v1 `{ level }` → keep the unlocked level, empty meta.
      return { level, wins: 0, best: {}, geese: [] };
    }
    const wins = Math.max(0, Math.floor(Number(data.wins) || 0));
    const best: Record<number, number> = {};
    const rawBest = (data.best ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(rawBest)) {
      const lvl = Number(k);
      const score = Number(v);
      if (Number.isInteger(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS && Number.isFinite(score) && score >= 0) {
        best[lvl] = Math.floor(score);
      }
    }
    const geese = Array.isArray(data.geese)
      ? [...new Set(data.geese.map((g) => Number(g)).filter((g) => Number.isInteger(g) && g >= 0 && g < SCENES.length))]
      : [];
    return { level, wins, best, geese };
  } catch {
    return { ...EMPTY_PROGRESS, best: {}, geese: [] };
  }
}

export function serializeProgress(p: GooseProgress): string {
  return JSON.stringify({ v: 2, level: p.level, wins: p.wins, best: p.best, geese: p.geese });
}

export interface WinOutcome {
  next: GooseProgress;
  /** Scene id of a goose unlocked BY THIS WIN, or -1 when none. */
  unlockedGoose: number;
  /** True when this win cleared the final level of the final scene. */
  allClear: boolean;
}

/** Apply one level win: unlock the next level, bump stats, maybe unlock a goose. */
export function progressAfterWin(p: GooseProgress, level: number, score: number): WinOutcome {
  const lvl = clampLevel(level);
  const next: GooseProgress = {
    level: Math.max(p.level, Math.min(TOTAL_LEVELS, lvl + 1)),
    wins: p.wins + 1,
    best: { ...p.best, [lvl]: Math.max(p.best[lvl] ?? 0, Math.max(0, Math.floor(score))) },
    geese: p.geese.slice(),
  };
  let unlockedGoose = -1;
  if (isSceneFinalLevel(lvl)) {
    const sceneId = sceneIndexOfLevel(lvl);
    if (!next.geese.includes(sceneId)) {
      next.geese.push(sceneId);
      unlockedGoose = sceneId;
    }
  }
  return { next, unlockedGoose, allClear: lvl >= TOTAL_LEVELS };
}

/** Count of distinct levels cleared at least once. */
export function clearedLevels(p: GooseProgress): number {
  return Object.keys(p.best).length;
}

/** Best single-level score across the catalog. */
export function bestOverall(p: GooseProgress): number {
  let best = 0;
  for (const v of Object.values(p.best)) if (v > best) best = v;
  return best;
}
