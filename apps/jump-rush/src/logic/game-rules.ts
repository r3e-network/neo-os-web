/**
 * Economic + timing constants of the MiniAppJumpRush contract, mirrored for the
 * UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppJumpRush (getConfig() exposes the live values
 * for cross-checks).
 */
import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import { createDifficultyRuleSelector } from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export const ENTRY_MEMO = "miniapp-jump-rush:entry";
export const FUND_MEMO = "miniapp-jump-rush:fund";

export const MAX_UNDOS = 3;
export const GAMEFI_MAX_UNDOS = 0;
export const UNDO_PENALTY_PCT = 30;
/** Mirrors MiniAppJumpRush.SETTLE_GRACE_MS; expiry is not callable at deadline. */
export const SETTLE_GRACE_MS = 600_000;

export interface DifficultyRule {
  difficulty: number;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
  targetJumps: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 180_000,
  minSolveMs: 20_000,
  targetJumps: 15,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 300_000,
  minSolveMs: 40_000,
  targetJumps: 25,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 480_000,
  minSolveMs: 60_000,
  targetJumps: 35,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

export function rewardPctAfterUndos(undos: number): number {
  const pct = 100 - UNDO_PENALTY_PCT * Math.max(0, Math.min(MAX_UNDOS, undos));
  return Math.max(pct, 100 - UNDO_PENALTY_PCT * MAX_UNDOS);
}

export function payoutFixed8(difficulty: number, undos: number): bigint {
  return (ruleOf(difficulty).rewardFixed8 * BigInt(rewardPctAfterUndos(undos))) / 100n;
}

/** Full-precision fixed8 → GAS display (delegates to the framework formatter). */
export function gasDisplay(fixed8: bigint): string {
  return formatGas(fixed8, 8);
}

/** Fleet-standard zero-padded mm:ss clock (delegates to the framework formatter). */
export function formatClock(ms: number): string {
  return fleetFormatClock(ms);
}

export type GameStatus = "committed" | "dealt" | "solved" | "expired" | "refunded";

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
    default:
      return "committed";
  }
}
