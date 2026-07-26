/**
 * Economic + timing constants of the MiniAppSheepSolitaire contract, mirrored for
 * the UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with the contract (getConfig() exposes the live values for cross-checks).
 */
import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import { createDifficultyRuleSelector } from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export const ENTRY_MEMO = "miniapp-sheep-solitaire:entry";
export const FUND_MEMO = "miniapp-sheep-solitaire:fund";

export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
export const SETTLE_GRACE_MS = 600_000;

export const MAX_SLOTS = 7;
export const MATCH_COUNT = 3;

export type Difficulty = 0 | 1 | 2;

export interface DifficultyRule {
  difficulty: Difficulty;
  key: "easy" | "medium" | "hard";
  cardTypes: number;
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  cardTypes: 8,
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 300_000,
  minSolveMs: 30_000,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  cardTypes: 12,
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 480_000,
  minSolveMs: 60_000,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  cardTypes: 15,
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 720_000,
  minSolveMs: 90_000,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

export function rewardPctAfterUndos(undos: number): number {
  const clamped = Math.max(0, Math.min(MAX_UNDOS, undos));
  return 100 - UNDO_PENALTY_PCT * clamped;
}

export function payoutFixed8(difficulty: number, undos: number): bigint {
  return (ruleOf(difficulty).rewardFixed8 * BigInt(rewardPctAfterUndos(undos))) / 100n;
}

/** Full-precision fixed8 display — delegates to the framework formatter (RFC P0-3). */
export function gasDisplay(fixed8: bigint): string {
  return formatGas(fixed8, 8);
}

/** Zero-padded mm:ss — delegates to the fleet-standard clock (RFC P0-3). */
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
