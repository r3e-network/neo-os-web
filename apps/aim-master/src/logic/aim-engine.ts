/**
 * Aim Master — deterministic target physics and authoritative local scoring.
 *
 * The same seed/config always produces the same target path. A recorded shot is
 * canonicalised from its signed offset before it is scored, so React/Phaser
 * counters are projections of the shot log rather than trusted inputs.
 */

/** How many zones away from centre. 0 = bullseye, 5 = outer rim. */
export type Ring = 0 | 1 | 2 | 3 | 4 | 5;

export interface GaugeConfig {
  /** Width of the gauge in logical pixels (left = 0, right = width). */
  width: number;
  /** Centre position on the gauge (the bullseye). */
  centre: number;
  /** Radius of the bullseye zone in logical pixels. */
  bullseyeRadius: number;
  /** Width of each additional ring outward. */
  ringWidth: number;
  /** Maximum speed (pixels / tick) the target can move. */
  maxSpeed: number;
  /** Tick interval in ms (typically 16 ≈ 60 fps). */
  tickMs: number;
}

export interface TargetPatternConfig extends GaugeConfig {
  /** Minimum ticks before direction/speed can change. */
  minChangeTicks: number;
  /** Maximum ticks before direction/speed can change. */
  maxChangeTicks: number;
}

export interface HitResult {
  /** The ring hit: 0 (bullseye) … 5 (outer). */
  ring: Ring;
  /** Base points for the ring, before combo. */
  points: number;
  /** Signed distance from centre in pixels (negative = left, positive = right). */
  offset: number;
}

export interface ScoredHitResult extends HitResult {
  accuracyHit: boolean;
  combo: number;
  multiplier: number;
  awardedPoints: number;
}

export interface AimRunSummary {
  accuracyHits: number;
  totalShots: number;
  combo: number;
  maxCombo: number;
  score: number;
}

export interface AimRunEvaluation {
  summary: AimRunSummary;
  results: ScoredHitResult[];
}

export interface AimDifficultyProfile {
  maxSpeed: number;
  minChangeTicks: number;
  maxChangeTicks: number;
  /** Discrete position cadence used instead of continuous motion. */
  reducedMotionStepMs: number;
}

/** Points awarded per ring (index = ring 0..5). */
const RING_POINTS: readonly [number, number, number, number, number, number] = [
  10, 8, 6, 4, 2, 0,
];

const DEFAULT_CONFIG: GaugeConfig = {
  width: 300,
  centre: 150,
  bullseyeRadius: 6,
  ringWidth: 24,
  maxSpeed: 6,
  tickMs: 16,
};

const DEFAULT_PATTERN_CONFIG: TargetPatternConfig = {
  ...DEFAULT_CONFIG,
  minChangeTicks: 10,
  maxChangeTicks: 49,
};

export const AIM_DIFFICULTY_PROFILES: readonly [
  AimDifficultyProfile,
  AimDifficultyProfile,
  AimDifficultyProfile,
] = [
  { maxSpeed: 3, minChangeTicks: 28, maxChangeTicks: 64, reducedMotionStepMs: 440 },
  { maxSpeed: 5, minChangeTicks: 18, maxChangeTicks: 48, reducedMotionStepMs: 340 },
  { maxSpeed: 7, minChangeTicks: 10, maxChangeTicks: 34, reducedMotionStepMs: 250 },
];

export const EMPTY_AIM_RUN: Readonly<AimRunSummary> = Object.freeze({
  accuracyHits: 0,
  totalShots: 0,
  combo: 0,
  maxCombo: 0,
  score: 0,
});

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number, fallback: number): number {
  const finite = finiteOr(value, fallback);
  return finite > 0 ? finite : fallback;
}

function normalisePatternConfig(
  config: Partial<TargetPatternConfig>,
): TargetPatternConfig {
  const width = Math.max(1, positiveOr(config.width ?? DEFAULT_CONFIG.width, DEFAULT_CONFIG.width));
  const centre = PhaserMathClamp(
    finiteOr(config.centre ?? DEFAULT_CONFIG.centre, DEFAULT_CONFIG.centre),
    0,
    width,
  );
  const minChangeTicks = Math.max(
    1,
    Math.round(positiveOr(config.minChangeTicks ?? DEFAULT_PATTERN_CONFIG.minChangeTicks, DEFAULT_PATTERN_CONFIG.minChangeTicks)),
  );
  const maxChangeTicks = Math.max(
    minChangeTicks,
    Math.round(positiveOr(config.maxChangeTicks ?? DEFAULT_PATTERN_CONFIG.maxChangeTicks, DEFAULT_PATTERN_CONFIG.maxChangeTicks)),
  );
  return {
    width,
    centre,
    bullseyeRadius: Math.max(0, finiteOr(config.bullseyeRadius ?? DEFAULT_CONFIG.bullseyeRadius, DEFAULT_CONFIG.bullseyeRadius)),
    ringWidth: positiveOr(config.ringWidth ?? DEFAULT_CONFIG.ringWidth, DEFAULT_CONFIG.ringWidth),
    maxSpeed: Math.max(
      1,
      Math.floor(positiveOr(config.maxSpeed ?? DEFAULT_CONFIG.maxSpeed, DEFAULT_CONFIG.maxSpeed)),
    ),
    tickMs: Math.max(1, positiveOr(config.tickMs ?? DEFAULT_CONFIG.tickMs, DEFAULT_CONFIG.tickMs)),
    minChangeTicks,
    maxChangeTicks,
  };
}

function PhaserMathClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Stable FNV-1a seed followed by Mulberry32; never touches Math.random. */
function seededRandom(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  }
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function difficultyProfile(difficulty: number): AimDifficultyProfile {
  const index = Math.max(0, Math.min(2, Number.isFinite(difficulty) ? Math.round(difficulty) : 0));
  return AIM_DIFFICULTY_PROFILES[index] ?? AIM_DIFFICULTY_PROFILES[0];
}

/** Generate a deterministic target timeline from a seed. */
export function generateTargetPattern(
  seed: string,
  config: Partial<TargetPatternConfig> = {},
  durationMs = 5_000,
): number[] {
  const cfg = normalisePatternConfig(config);
  const duration = Math.max(cfg.tickMs, finiteOr(durationMs, 5_000));
  const ticks = Math.ceil(duration / cfg.tickMs);
  const positions: number[] = [];
  const random = seededRandom(String(seed));
  let pos = cfg.centre;
  let direction: 1 | -1 = random() < 0.5 ? 1 : -1;
  let speed = 1;
  let ticksUntilChange = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    positions.push(pos);

    if (ticksUntilChange <= 0) {
      direction = random() < 0.5 ? 1 : -1;
      speed = 1 + Math.floor(random() * cfg.maxSpeed);
      ticksUntilChange = cfg.minChangeTicks
        + Math.floor(random() * (cfg.maxChangeTicks - cfg.minChangeTicks + 1));
    }
    ticksUntilChange -= 1;
    pos += direction * speed;

    if (pos < 0) {
      pos = -pos;
      direction = 1;
    } else if (pos > cfg.width) {
      pos = cfg.width - (pos - cfg.width);
      direction = -1;
    }
    pos = PhaserMathClamp(pos, 0, cfg.width);
  }

  return positions;
}

/** Local Guest path with an explicit, testable difficulty curve. */
export function generateDifficultyPattern(
  seed: string,
  difficulty: number,
  durationMs = 12_000,
): number[] {
  const profile = difficultyProfile(difficulty);
  return generateTargetPattern(seed, {
    maxSpeed: profile.maxSpeed,
    minChangeTicks: profile.minChangeTicks,
    maxChangeTicks: profile.maxChangeTicks,
  }, durationMs);
}

/**
 * Validate an enclave/local pattern without silently deleting corrupt ticks.
 * Removing a bad sample would shift the timeline and make the rendered target
 * disagree with the session replay, so malformed or oversized views fail as a
 * whole and can be retried safely.
 */
export function parseTargetPattern(
  value: unknown,
  width = DEFAULT_CONFIG.width,
  maxTicks = 10_000,
): number[] {
  if (typeof value !== "string" || !value.trim()) return [];
  const safeWidth = positiveOr(width, DEFAULT_CONFIG.width);
  const safeMaxTicks = Math.max(2, Math.floor(positiveOr(maxTicks, 10_000)));
  const parts = value.split(",");
  if (parts.length < 2 || parts.length > safeMaxTicks) return [];

  const positions = parts.map((part) => Number(part.trim()));
  if (positions.some((position) => (
    !Number.isFinite(position) || position < 0 || position > safeWidth
  ))) {
    return [];
  }
  return positions;
}

/** Calculate a hit using inclusive visual ring boundaries. */
export function calculateHitResult(
  stopPosition: number,
  config: Partial<GaugeConfig> = {},
): HitResult {
  const cfg = normalisePatternConfig(config);
  if (!Number.isFinite(stopPosition)) {
    return { ring: 5, points: RING_POINTS[5], offset: cfg.width - cfg.centre };
  }
  const safePosition = stopPosition;
  const offset = safePosition - cfg.centre;
  const absDistance = Math.abs(offset);

  if (absDistance <= cfg.bullseyeRadius) {
    return { ring: 0, points: RING_POINTS[0], offset };
  }

  const ring = Math.min(
    5,
    Math.max(1, Math.ceil((absDistance - cfg.bullseyeRadius) / cfg.ringWidth)),
  ) as Ring;
  return { ring, points: RING_POINTS[ring], offset };
}

/** Convert any recorded shot into the canonical result derived from offset. */
export function canonicalHitResult(value: unknown): HitResult | null {
  if (!value || typeof value !== "object") return null;
  const offset = Number((value as { offset?: unknown }).offset);
  if (!Number.isFinite(offset)) return null;
  return calculateHitResult(DEFAULT_CONFIG.centre + offset);
}

export function isAccuracyHit(ring: Ring): boolean {
  return ring <= 2;
}

export function isWin(ringsHit: number[], targetAccuracy: number): boolean {
  const target = Math.max(0, Math.round(finiteOr(targetAccuracy, 0)));
  return ringsHit.filter((ring) => Number.isFinite(ring) && ring >= 0 && ring <= 2).length >= target;
}

/** Combo grows on accuracy hits, resets on misses, and caps at a readable 2x. */
export function comboMultiplier(combo: number): number {
  const safeCombo = Math.max(0, Math.round(finiteOr(combo, 0)));
  if (safeCombo <= 1) return 1;
  return 1 + Math.min(10, safeCombo - 1) / 10;
}

export function scoreHit(
  current: Readonly<AimRunSummary>,
  value: unknown,
): { summary: AimRunSummary; result: ScoredHitResult } | null {
  const hit = canonicalHitResult(value);
  if (!hit) return null;
  const accuracyHit = isAccuracyHit(hit.ring);
  const previousCombo = Math.max(0, finiteOr(current.combo, 0));
  const combo = accuracyHit ? previousCombo + 1 : 0;
  const multiplier = accuracyHit ? comboMultiplier(combo) : 1;
  const awardedPoints = Math.round(hit.points * multiplier);
  const accuracyHits = Math.max(0, finiteOr(current.accuracyHits, 0));
  const totalShots = Math.max(0, finiteOr(current.totalShots, 0));
  const previousMaxCombo = Math.max(0, finiteOr(current.maxCombo, 0));
  const previousScore = Math.max(0, finiteOr(current.score, 0));
  const summary: AimRunSummary = {
    accuracyHits: accuracyHits + (accuracyHit ? 1 : 0),
    totalShots: totalShots + 1,
    combo,
    maxCombo: Math.max(previousMaxCombo, combo),
    score: previousScore + awardedPoints,
  };
  return {
    summary,
    result: { ...hit, accuracyHit, combo, multiplier, awardedPoints },
  };
}

/** Rebuild the entire run from its append-only shot log. */
export function evaluateHitResults(values: unknown): AimRunEvaluation {
  const results: ScoredHitResult[] = [];
  let summary: AimRunSummary = { ...EMPTY_AIM_RUN };
  if (!Array.isArray(values)) return { summary, results };
  for (const value of values.slice(0, 512)) {
    const scored = scoreHit(summary, value);
    if (!scored) continue;
    summary = scored.summary;
    results.push(scored.result);
  }
  return { summary, results };
}

/** Legacy base-ring total retained for enclave/economic compatibility. */
export function totalPoints(ringsHit: number[]): number {
  return ringsHit.reduce((sum, value) => {
    const finite = Number.isFinite(value) ? Math.round(value) : 5;
    const ring = Math.min(5, Math.max(0, finite)) as Ring;
    return sum + RING_POINTS[ring];
  }, 0);
}

export { RING_POINTS, DEFAULT_CONFIG };
