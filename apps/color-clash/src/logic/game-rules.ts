/**
 * Game rules constants for Color Clash (Simon Says).
 */
import {
  createDifficultyRuleSelector,
  DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS,
} from "@framework/game-rules";

export const ENTRY_MEMO = "miniapp-color-clash:entry";
export const FUND_MEMO = "miniapp-color-clash:fund";
export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
/** Must match MiniAppColorClash.SETTLE_GRACE_MS; refreshed from getConfig in GameFi mode. */
export { DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS } from "@framework/game-rules";

export interface DifficultyRule {
  difficulty: number;
  entry: number;       // Fixed8 GAS (1 GAS = 1e8)
  reward: number;
  limitMs: number;
  minSolveMs: number;
  targetSeq: number;    // how many colors the player must repeat
}

export interface CueTiming {
  leadInMs: number;
  litMs: number;
  gapMs: number;
  pressLockMs: number;
}

export const DIFFICULTY_RULES: DifficultyRule[] = [
  { difficulty: 0, entry: 2_000_000, reward: 10_000_000, limitMs: 120_000, minSolveMs: 15_000, targetSeq: 8 },
  { difficulty: 1, entry: 10_000_000, reward: 50_000_000, limitMs: 180_000, minSolveMs: 30_000, targetSeq: 12 },
  { difficulty: 2, entry: 20_000_000, reward: 100_000_000, limitMs: 300_000, minSolveMs: 45_000, targetSeq: 16 },
];

export const CUE_TIMINGS: readonly [CueTiming, CueTiming, CueTiming] = [
  { leadInMs: 360, litMs: 520, gapMs: 220, pressLockMs: 220 },
  { leadInMs: 320, litMs: 390, gapMs: 180, pressLockMs: 180 },
  { leadInMs: 280, litMs: 290, gapMs: 140, pressLockMs: 150 },
];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES, { strict: true });

export function cueTimingOf(difficulty: number): CueTiming {
  const index = Math.max(0, Math.min(2, Number.isFinite(difficulty) ? Math.round(difficulty) : 0));
  return CUE_TIMINGS[index] ?? CUE_TIMINGS[0];
}

export function releaseAtOf(deadline: unknown, graceMs = SETTLEMENT_GRACE_MS): number {
  const safeDeadline = Number(deadline);
  const safeGrace = Number(graceMs);
  if (!Number.isFinite(safeDeadline) || safeDeadline <= 0) return 0;
  return safeDeadline + (
    Number.isFinite(safeGrace) && safeGrace >= 0
      ? safeGrace
      : SETTLEMENT_GRACE_MS
  );
}

export function canReleaseExpiredGame(
  deadline: unknown,
  graceMs = SETTLEMENT_GRACE_MS,
  now = Date.now(),
): boolean {
  const releaseAt = releaseAtOf(deadline, graceMs);
  return releaseAt > 0 && now > releaseAt;
}

export function rewardPctAfterUndos(undos: number): number {
  return 100 - UNDO_PENALTY_PCT * undos;
}

export function payoutFixed8(reward: number, undos: number): number {
  const pct = rewardPctAfterUndos(undos);
  return Math.floor(reward * pct / 100);
}

export function gasDisplay(fixed8: number): string {
  return (fixed8 / 1e8).toFixed(2);
}

export function formatClock(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function statusOf(s: number): string {
  switch (s) {
    case 0: return "awaiting-bind";
    case 1: return "playing";
    case 2: return "solved";
    case 3: return "expired";
    case 4: return "refunded";
    default: return "unknown";
  }
}

/** Colors mapped: 0=Red, 1=Blue, 2=Green, 3=Yellow */
export const COLOR_NAMES = ["red", "blue", "green", "yellow"] as const;
export const COLOR_HEX = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"] as const;
export const COLOR_GLOW = ["rgba(231,76,60,0.5)", "rgba(52,152,219,0.5)", "rgba(46,204,113,0.5)", "rgba(241,196,15,0.5)"] as const;
