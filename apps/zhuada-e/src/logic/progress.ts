/**
 * Versioned, pure meta-progression for Goose Basket Shuffle.
 *
 * v3 separates relaxed/timed best scores and adds per-level attempt/outcome
 * counters plus the player's last level/theme. `level`, `wins`, `best`, and
 * `geese` remain available so the existing UI can consume v3 before it adopts
 * the richer fields. Unknown future schemas are normalized for display only
 * and marked read-only so an older build can never serialize over them.
 */

import { TOTAL_LEVELS } from "./game-rules";
import { SCENES, isSceneFinalLevel, sceneIndexOfLevel } from "./scenes";
import {
  DEFAULT_THEME_ID,
  isGameThemeId,
  type GameThemeId,
} from "./themes";

export const PROGRESS_SCHEMA_VERSION = 3 as const;
export type PlayMode = "relaxed" | "timed";

export interface LevelProgress {
  /** Starts of this level, including abandoned runs. */
  attempts: number;
  /** Terminal losses (tray full or timeout). */
  failures: number;
  /** Successful clears, including replays. */
  clears: number;
  /** Comparable best scores, separated by scoring mode. */
  best: Partial<Record<PlayMode, number>>;
  /** v2 scores had no mode dimension; preserve them without guessing. */
  legacyBest?: number;
}

export interface GooseProgress {
  v: typeof PROGRESS_SCHEMA_VERSION;
  /** Canonical highest unlocked level. */
  highestUnlockedLevel: number;
  /** Sparse per-level progress keyed by 1-based level number. */
  levels: Record<number, LevelProgress>;
  lastPlayedLevel: number;
  lastTheme: GameThemeId;

  /** Compatibility alias for highestUnlockedLevel. */
  level: number;
  /** Cumulative wins. v2 replay totals are retained even when attribution is unknown. */
  wins: number;
  /** Compatibility best per level: max(legacy, relaxed, timed). */
  best: Record<number, number>;
  /** Unlocked limited-edition geese (scene ids, ordered by unlock time). */
  geese: number[];

  /** Runtime-only protection for data written by a newer client. */
  readonly readOnly?: true;
  /** Runtime-only version that caused read-only protection. */
  readonly sourceVersion?: number;
}

export interface PersistedProgressV3 {
  v: typeof PROGRESS_SCHEMA_VERSION;
  highestUnlockedLevel: number;
  levels: Record<number, LevelProgress>;
  lastPlayedLevel: number;
  lastTheme: GameThemeId;
  level: number;
  wins: number;
  best: Record<number, number>;
  geese: number[];
}

export type ProgressParseStatus =
  | "empty"
  | "current"
  | "migrated"
  | "future-version"
  | "invalid";

export interface ProgressParseResult {
  progress: GooseProgress;
  status: ProgressParseStatus;
  sourceVersion: number | null;
  readOnly: boolean;
}

const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampLevel(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1
    ? Math.min(Math.floor(n), TOTAL_LEVELS)
    : 1;
}

function clampCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0
    ? Math.min(Math.floor(n), MAX_SAFE_COUNT)
    : 0;
}

function clampScore(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0
    ? Math.min(Math.floor(n), MAX_SAFE_COUNT)
    : undefined;
}

function safeOutcomeCount(clears: number, failures: number): number {
  return Math.min(MAX_SAFE_COUNT, clears + failures);
}

function emptyLevelProgress(): LevelProgress {
  return { attempts: 0, failures: 0, clears: 0, best: {} };
}

function cloneLevelProgress(value: LevelProgress): LevelProgress {
  return {
    attempts: value.attempts,
    failures: value.failures,
    clears: value.clears,
    best: { ...value.best },
    ...(value.legacyBest === undefined ? {} : { legacyBest: value.legacyBest }),
  };
}

function parseGeese(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((entry) => Number(entry))
        .filter(
          (entry) =>
            Number.isInteger(entry) && entry >= 0 && entry < SCENES.length,
        ),
    ),
  ];
}

function parseLevelProgress(value: unknown): LevelProgress | null {
  if (!isRecord(value)) return null;
  const rawBest = isRecord(value.best) ? value.best : {};
  const relaxed = clampScore(rawBest.relaxed);
  const timed = clampScore(rawBest.timed);
  const legacyBest = clampScore(value.legacyBest);
  // A recorded best is authoritative evidence of at least one clear.
  const clears = Math.max(
    clampCount(value.clears),
    relaxed !== undefined || timed !== undefined || legacyBest !== undefined
      ? 1
      : 0,
  );
  const failures = clampCount(value.failures);
  const minimumAttempts = safeOutcomeCount(clears, failures);
  const attempts = Math.max(clampCount(value.attempts), minimumAttempts);
  const best: Partial<Record<PlayMode, number>> = {};
  if (relaxed !== undefined) best.relaxed = relaxed;
  if (timed !== undefined) best.timed = timed;

  if (
    attempts === 0 &&
    clears === 0 &&
    failures === 0 &&
    relaxed === undefined &&
    timed === undefined &&
    legacyBest === undefined
  ) {
    return null;
  }

  return {
    attempts,
    failures,
    clears,
    best,
    ...(legacyBest === undefined ? {} : { legacyBest }),
  };
}

function parseLevels(value: unknown): Record<number, LevelProgress> {
  if (!isRecord(value)) return {};
  const levels: Record<number, LevelProgress> = {};
  for (const [key, rawLevel] of Object.entries(value)) {
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1 || level > TOTAL_LEVELS) continue;
    const parsed = parseLevelProgress(rawLevel);
    if (parsed) levels[level] = parsed;
  }
  return levels;
}

function maxKnownBest(value: LevelProgress): number | undefined {
  const candidates = [value.legacyBest, value.best.relaxed, value.best.timed].filter(
    (score): score is number => score !== undefined,
  );
  return candidates.length > 0 ? Math.max(...candidates) : undefined;
}

/**
 * Merge a compatibility/v2 best map without turning a v3 derived alias into a
 * duplicate legacy score. Only information higher than the canonical mode
 * records is retained as legacy data.
 */
function mergeLegacyBest(
  levels: Record<number, LevelProgress>,
  value: unknown,
): Record<number, LevelProgress> {
  if (!isRecord(value)) return levels;
  const next = { ...levels };
  for (const [key, rawScore] of Object.entries(value)) {
    const level = Number(key);
    const score = clampScore(rawScore);
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > TOTAL_LEVELS ||
      score === undefined
    ) {
      continue;
    }
    const current = cloneLevelProgress(next[level] ?? emptyLevelProgress());
    const known = maxKnownBest(current);
    if (known === undefined || score > known) current.legacyBest = score;
    current.clears = Math.max(current.clears, 1);
    current.attempts = Math.max(
      current.attempts,
      safeOutcomeCount(current.clears, current.failures),
    );
    next[level] = current;
  }
  return next;
}

function deriveBest(levels: Record<number, LevelProgress>): Record<number, number> {
  const best: Record<number, number> = {};
  for (const [key, value] of Object.entries(levels)) {
    const score = maxKnownBest(value);
    if (score !== undefined) best[Number(key)] = score;
  }
  return best;
}

function maxClearedLevel(levels: Record<number, LevelProgress>): number {
  let maximum = 0;
  for (const [key, value] of Object.entries(levels)) {
    if (value.clears > 0) maximum = Math.max(maximum, Number(key));
  }
  return maximum;
}

function minimumUnlockedForClears(levels: Record<number, LevelProgress>): number {
  const cleared = maxClearedLevel(levels);
  if (cleared <= 0) return 1;
  return Math.min(TOTAL_LEVELS, cleared + 1);
}

function totalKnownClears(levels: Record<number, LevelProgress>): number {
  let total = 0;
  for (const value of Object.values(levels)) {
    total = Math.min(MAX_SAFE_COUNT, total + value.clears);
  }
  return total;
}

interface BuildProgressInput {
  highestUnlockedLevel: unknown;
  levels: Record<number, LevelProgress>;
  lastPlayedLevel: unknown;
  lastTheme: unknown;
  wins: unknown;
  geese: unknown;
  readOnly?: true;
  sourceVersion?: number;
}

function buildProgress(input: BuildProgressInput): GooseProgress {
  const levels = Object.fromEntries(
    Object.entries(input.levels).map(([key, value]) => [
      key,
      cloneLevelProgress(value),
    ]),
  ) as Record<number, LevelProgress>;
  const highestUnlockedLevel = Math.max(
    clampLevel(input.highestUnlockedLevel),
    minimumUnlockedForClears(levels),
  );
  const requestedLastLevel = clampLevel(input.lastPlayedLevel);
  const lastPlayedLevel = Math.min(requestedLastLevel, highestUnlockedLevel);
  const lastTheme = isGameThemeId(input.lastTheme)
    ? input.lastTheme
    : DEFAULT_THEME_ID;
  const wins = Math.max(clampCount(input.wins), totalKnownClears(levels));
  const best = deriveBest(levels);

  return {
    v: PROGRESS_SCHEMA_VERSION,
    highestUnlockedLevel,
    levels,
    lastPlayedLevel,
    lastTheme,
    level: highestUnlockedLevel,
    wins,
    best,
    geese: parseGeese(input.geese),
    ...(input.readOnly ? { readOnly: true as const } : {}),
    ...(input.sourceVersion === undefined
      ? {}
      : { sourceVersion: input.sourceVersion }),
  };
}

export function createEmptyProgress(): GooseProgress {
  return buildProgress({
    highestUnlockedLevel: 1,
    levels: {},
    lastPlayedLevel: 1,
    lastTheme: DEFAULT_THEME_ID,
    wins: 0,
    geese: [],
  });
}

export const EMPTY_PROGRESS: GooseProgress = createEmptyProgress();

function migrateV1(data: Record<string, unknown>): GooseProgress {
  const level = clampLevel(data.level);
  return buildProgress({
    highestUnlockedLevel: level,
    levels: {},
    lastPlayedLevel: level,
    lastTheme: DEFAULT_THEME_ID,
    wins: 0,
    geese: [],
  });
}

function migrateV2(data: Record<string, unknown>): GooseProgress {
  const level = clampLevel(data.level);
  const levels = mergeLegacyBest({}, data.best);
  return buildProgress({
    highestUnlockedLevel: level,
    levels,
    lastPlayedLevel: level,
    lastTheme: DEFAULT_THEME_ID,
    wins: data.wins,
    geese: data.geese,
  });
}

function parseV3Like(
  data: Record<string, unknown>,
  protection?: { readOnly: true; sourceVersion: number },
): GooseProgress {
  const levels = mergeLegacyBest(parseLevels(data.levels), data.best);
  return buildProgress({
    highestUnlockedLevel: data.highestUnlockedLevel ?? data.level,
    levels,
    lastPlayedLevel:
      data.lastPlayedLevel ?? data.highestUnlockedLevel ?? data.level,
    lastTheme: data.lastTheme,
    wins: data.wins,
    geese: data.geese,
    ...protection,
  });
}

/** Inspect a payload while retaining migration/future-version metadata. */
export function parseProgressResult(
  raw: string | null | undefined,
): ProgressParseResult {
  if (!raw) {
    return {
      progress: createEmptyProgress(),
      status: "empty",
      sourceVersion: null,
      readOnly: false,
    };
  }

  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) throw 0;
    const rawVersion = data.v;

    if (
      (rawVersion === undefined || rawVersion === 1) &&
      Object.hasOwn(data, "level")
    ) {
      return {
        progress: migrateV1(data),
        status: "migrated",
        sourceVersion: 1,
        readOnly: false,
      };
    }
    if (rawVersion === 2) {
      return {
        progress: migrateV2(data),
        status: "migrated",
        sourceVersion: 2,
        readOnly: false,
      };
    }
    if (rawVersion === PROGRESS_SCHEMA_VERSION) {
      return {
        progress: parseV3Like(data),
        status: "current",
        sourceVersion: PROGRESS_SCHEMA_VERSION,
        readOnly: false,
      };
    }
    if (
      typeof rawVersion === "number" &&
      Number.isInteger(rawVersion) &&
      rawVersion > PROGRESS_SCHEMA_VERSION
    ) {
      return {
        progress: parseV3Like(data, {
          readOnly: true,
          sourceVersion: rawVersion,
        }),
        status: "future-version",
        sourceVersion: rawVersion,
        readOnly: true,
      };
    }
  } catch {
    // Invalid data is isolated by the storage layer before any replacement.
  }

  return {
    progress: createEmptyProgress(),
    status: "invalid",
    sourceVersion: null,
    readOnly: false,
  };
}

/** Compatibility parser used by the current engine. */
export function parseProgress(raw: string | null | undefined): GooseProgress {
  return parseProgressResult(raw).progress;
}

function normalizeRuntimeProgress(progress: GooseProgress): GooseProgress {
  const normalized = parseV3Like(progress as unknown as Record<string, unknown>);
  return buildProgress({
    highestUnlockedLevel: normalized.highestUnlockedLevel,
    levels: normalized.levels,
    lastPlayedLevel: normalized.lastPlayedLevel,
    lastTheme: normalized.lastTheme,
    wins: normalized.wins,
    geese: normalized.geese,
    ...(progress.readOnly ? { readOnly: true as const } : {}),
    ...(progress.sourceVersion === undefined
      ? {}
      : { sourceVersion: progress.sourceVersion }),
  });
}

export function isProgressReadOnly(progress: GooseProgress): boolean {
  return progress.readOnly === true;
}

export function serializeProgress(progress: GooseProgress): string {
  if (isProgressReadOnly(progress)) {
    throw Error();
  }
  const normalized = normalizeRuntimeProgress(progress);
  const persisted: PersistedProgressV3 = {
    v: PROGRESS_SCHEMA_VERSION,
    highestUnlockedLevel: normalized.highestUnlockedLevel,
    levels: normalized.levels,
    lastPlayedLevel: normalized.lastPlayedLevel,
    lastTheme: normalized.lastTheme,
    level: normalized.level,
    wins: normalized.wins,
    best: normalized.best,
    geese: normalized.geese,
  };
  return JSON.stringify(persisted);
}

function playableLevel(progress: GooseProgress, level: unknown): number {
  return Math.min(clampLevel(level), progress.highestUnlockedLevel);
}

function updateLevel(
  progress: GooseProgress,
  level: number,
  transform: (current: LevelProgress) => LevelProgress,
  extra?: Partial<Pick<GooseProgress, "lastPlayedLevel" | "lastTheme">>,
): GooseProgress {
  const base = normalizeRuntimeProgress(progress);
  const levels = { ...base.levels };
  levels[level] = transform(
    cloneLevelProgress(levels[level] ?? emptyLevelProgress()),
  );
  return buildProgress({
    highestUnlockedLevel: base.highestUnlockedLevel,
    levels,
    lastPlayedLevel: extra?.lastPlayedLevel ?? base.lastPlayedLevel,
    lastTheme: extra?.lastTheme ?? base.lastTheme,
    wins: base.wins,
    geese: base.geese,
    ...(base.readOnly ? { readOnly: true as const } : {}),
    ...(base.sourceVersion === undefined
      ? {}
      : { sourceVersion: base.sourceVersion }),
  });
}

/** Record a level start and the exact theme the player chose. */
export function progressAfterAttempt(
  progress: GooseProgress,
  level: number,
  theme: GameThemeId = progress.lastTheme,
): GooseProgress {
  const base = normalizeRuntimeProgress(progress);
  const played = playableLevel(base, level);
  return updateLevel(
    base,
    played,
    (current) => ({
      ...current,
      attempts: Math.min(MAX_SAFE_COUNT, current.attempts + 1),
    }),
    {
      lastPlayedLevel: played,
      lastTheme: isGameThemeId(theme) ? theme : base.lastTheme,
    },
  );
}

/** Record a terminal loss; repairs a missing start hook if necessary. */
export function progressAfterFailure(
  progress: GooseProgress,
  level: number,
  theme: GameThemeId = progress.lastTheme,
): GooseProgress {
  const base = normalizeRuntimeProgress(progress);
  const played = playableLevel(base, level);
  return updateLevel(
    base,
    played,
    (current) => {
      const failures = Math.min(MAX_SAFE_COUNT, current.failures + 1);
      return {
        ...current,
        failures,
        attempts: Math.max(
          current.attempts,
          safeOutcomeCount(current.clears, failures),
        ),
      };
    },
    {
      lastPlayedLevel: played,
      lastTheme: isGameThemeId(theme) ? theme : base.lastTheme,
    },
  );
}

/** Update only the continue target, clamped to an unlocked level. */
export function progressWithLastPlayedLevel(
  progress: GooseProgress,
  level: number,
): GooseProgress {
  const base = normalizeRuntimeProgress(progress);
  return buildProgress({
    highestUnlockedLevel: base.highestUnlockedLevel,
    levels: base.levels,
    lastPlayedLevel: playableLevel(base, level),
    lastTheme: base.lastTheme,
    wins: base.wins,
    geese: base.geese,
    ...(base.readOnly ? { readOnly: true as const } : {}),
    ...(base.sourceVersion === undefined
      ? {}
      : { sourceVersion: base.sourceVersion }),
  });
}

/** Update only the player's preferred presentation theme. */
export function progressWithLastTheme(
  progress: GooseProgress,
  theme: GameThemeId,
): GooseProgress {
  const base = normalizeRuntimeProgress(progress);
  return buildProgress({
    highestUnlockedLevel: base.highestUnlockedLevel,
    levels: base.levels,
    lastPlayedLevel: base.lastPlayedLevel,
    lastTheme: isGameThemeId(theme) ? theme : base.lastTheme,
    wins: base.wins,
    geese: base.geese,
    ...(base.readOnly ? { readOnly: true as const } : {}),
    ...(base.sourceVersion === undefined
      ? {}
      : { sourceVersion: base.sourceVersion }),
  });
}

export interface ProgressWinContext {
  mode?: PlayMode;
  theme?: GameThemeId;
}

export interface WinOutcome {
  next: GooseProgress;
  /** Scene id of a goose unlocked BY THIS WIN, or -1 when none. */
  unlockedGoose: number;
  /** True when this win cleared the final level of the final scene. */
  allClear: boolean;
}

/**
 * Apply one clear: unlock the next level, count the clear, update only the
 * selected mode's best, and maybe unlock a scene goose. Existing three-arg
 * callers remain relaxed-mode compatible until the engine passes context.
 */
export function progressAfterWin(
  progress: GooseProgress,
  level: number,
  score: number,
  context: PlayMode | ProgressWinContext = "relaxed",
): WinOutcome {
  const base = normalizeRuntimeProgress(progress);
  const played = clampLevel(level);
  const options: ProgressWinContext =
    typeof context === "string" ? { mode: context } : context;
  const mode: PlayMode = options.mode === "timed" ? "timed" : "relaxed";
  const nextScore = clampScore(score) ?? 0;
  const current = cloneLevelProgress(
    base.levels[played] ?? emptyLevelProgress(),
  );
  const clears = Math.min(MAX_SAFE_COUNT, current.clears + 1);
  const levels = {
    ...base.levels,
    [played]: {
      ...current,
      clears,
      attempts: Math.max(
        current.attempts,
        safeOutcomeCount(clears, current.failures),
      ),
      best: {
        ...current.best,
        [mode]: Math.max(current.best[mode] ?? 0, nextScore),
      },
    },
  };
  const geese = base.geese.slice();
  let unlockedGoose = -1;
  if (isSceneFinalLevel(played)) {
    const sceneId = sceneIndexOfLevel(played);
    if (!geese.includes(sceneId)) {
      geese.push(sceneId);
      unlockedGoose = sceneId;
    }
  }

  const next = buildProgress({
    highestUnlockedLevel: Math.max(
      base.highestUnlockedLevel,
      Math.min(TOTAL_LEVELS, played + 1),
    ),
    levels,
    lastPlayedLevel: played,
    lastTheme: isGameThemeId(options.theme)
      ? options.theme
      : base.lastTheme,
    wins: Math.min(MAX_SAFE_COUNT, base.wins + 1),
    geese,
    ...(base.readOnly ? { readOnly: true as const } : {}),
    ...(base.sourceVersion === undefined
      ? {}
      : { sourceVersion: base.sourceVersion }),
  });

  return {
    next,
    unlockedGoose,
    allClear: played >= TOTAL_LEVELS,
  };
}

/** Count of distinct levels cleared at least once. */
export function clearedLevels(progress: GooseProgress): number {
  const normalized = normalizeRuntimeProgress(progress);
  return Object.values(normalized.levels).filter((value) => value.clears > 0)
    .length;
}

/** Best single-level score across legacy, relaxed, and timed catalogs. */
export function bestOverall(progress: GooseProgress): number {
  const normalized = normalizeRuntimeProgress(progress);
  let best = 0;
  for (const score of Object.values(normalized.best)) {
    if (score > best) best = score;
  }
  return best;
}
