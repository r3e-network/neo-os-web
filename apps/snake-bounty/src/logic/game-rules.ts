/**
 * Economic + timing constants of the MiniAppSnakeBounty contract, mirrored for the
 * UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppSnakeBounty (getConfig() exposes the live values
 * for cross-checks).
 */
import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import {
  createDifficultyRuleSelector,
  DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS,
} from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export type Difficulty = 0 | 1 | 2;

export const ENTRY_MEMO = "miniapp-snake-bounty:entry";
export const FUND_MEMO = "miniapp-snake-bounty:fund";
/** Contract-enforced delay before an abandoned active/settling game can expire. */
export { DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS } from "@framework/game-rules";

export interface DifficultyRule {
  difficulty: Difficulty;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
  targetLength: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 180_000,
  minSolveMs: 20_000,
  targetLength: 10,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 300_000,
  minSolveMs: 40_000,
  targetLength: 20,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 600_000,
  minSolveMs: 60_000,
  targetLength: 35,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

/**
 * Arcade movement cadence is intentionally separate from the on-chain economy.
 * Higher trails demand faster steering while preserving the contract's existing
 * target/deadline/settlement rules.
 */
export function tickMsOf(difficulty: number): number {
  if (difficulty === 1) return 180;
  if (difficulty === 2) return 145;
  return 230;
}

/** Full-precision fixed8 display — delegates to the framework formatter (RFC P0-3). */
export function gasDisplay(fixed8: bigint): string {
  return formatGas(fixed8, 8);
}

/** Zero-padded mm:ss — delegates to the fleet-standard clock (RFC P0-3). */
export function formatClock(ms: number): string {
  return fleetFormatClock(ms);
}

export type GameStatus = "committed" | "dealt" | "solved" | "expired" | "refunded" | "unknown";

export function statusOf(raw: number): GameStatus {
  switch (raw) {
    case 0:
      return "committed";
    case 1:
      return "dealt";
    case 2:
      return "solved";
    case 3:
      return "expired";
    case 4:
      return "refunded";
    case 5:
      return "unknown";
    default:
      return "unknown";
  }
}

/** Expiry is valid only strictly after the on-chain deadline plus grace. */
export function canExpireAfterGrace(deadline: number, nowMs = Date.now()): boolean {
  return Number.isFinite(deadline) && deadline > 0 && nowMs > deadline + SETTLEMENT_GRACE_MS;
}
