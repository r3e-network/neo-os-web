/**
 * Economic + timing constants of the MiniAppAimMaster contract, mirrored for
 * the UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppAimMaster (getConfig() exposes the live values
 * for cross-checks).
 */

import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import { createDifficultyRuleSelector } from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export const ENTRY_MEMO = "miniapp-aim-master:entry";
export const FUND_MEMO = "miniapp-aim-master:fund";
/** Must match MiniAppAimMaster.SETTLE_GRACE_MS / getConfig(). */
export const SETTLE_GRACE_MS = 600_000;

export interface DifficultyRule {
  difficulty: 0 | 1 | 2;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
  targetAccuracy: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 60_000,
  minSolveMs: 10_000,
  targetAccuracy: 3,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 90_000,
  minSolveMs: 20_000,
  targetAccuracy: 5,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 120_000,
  minSolveMs: 30_000,
  targetAccuracy: 7,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

/**
 * Payout based on accuracy: ringsHit / targetAccuracy fraction of reward.
 */
export function payoutFixed8ForAccuracy(
  difficulty: number,
  ringsHit: number,
): bigint {
  const rule = ruleOf(difficulty);
  const safeHits = Number.isFinite(ringsHit)
    ? Math.max(0, Math.min(Math.floor(ringsHit), rule.targetAccuracy))
    : 0;
  return (rule.rewardFixed8 * BigInt(safeHits)) / BigInt(rule.targetAccuracy);
}

export function canReleaseAfterGrace(
  deadline: number,
  nowMs = Date.now(),
  graceMs = SETTLE_GRACE_MS,
): boolean {
  if (!Number.isFinite(deadline) || deadline <= 0 || !Number.isFinite(nowMs)) return false;
  const safeGrace = Number.isFinite(graceMs) ? Math.max(0, graceMs) : SETTLE_GRACE_MS;
  return nowMs > deadline + safeGrace;
}

/** Full-precision fixed8 display — delegates to the framework formatter (RFC P0-3). */
export function gasDisplay(fixed8: bigint): string {
  return formatGas(fixed8, 8);
}

/** Zero-padded mm:ss — delegates to the fleet-standard clock (RFC P0-3). */
export function formatClock(ms: number): string {
  return fleetFormatClock(ms);
}

export type GameStatus =
  | "committed"
  | "dealt"
  | "solved"
  | "expired"
  | "refunded"
  | "unknown";

export function statusOf(raw: number): GameStatus {
  switch (raw) {
    case 1:
      return "dealt";
    case 2:
      return "solved";
    case 3:
      return "expired";
    case 4:
      return "refunded";
    case 5:
      // Finalize was broadcast and the Morpheus callback is still pending.
      // Never reinterpret this as a fresh committed game or reopen the TEE.
      return "unknown";
    default:
      return raw === 0 ? "committed" : "unknown";
  }
}
