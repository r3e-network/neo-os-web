/**
 * Economic + timing constants for Gomoku Arena.
 * Mirrors the platform-game shared economics pattern.
 */
import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import {
  createDifficultyRuleSelector,
  DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS,
} from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";
import type { Difficulty } from "./gomoku-engine";

export const ENTRY_MEMO = "miniapp-gomoku:entry";
export const FUND_MEMO = "miniapp-gomoku:fund";

/**
 * Paid entries disabled — same pattern as Sudoku. The guest game is fully
 * local and never consults this flag or the chain.
 */
export const GAMEFI_NEW_ENTRIES_ENABLED = false;

export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 20;
export { DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS } from "@framework/game-rules";

export interface DifficultyRule {
  difficulty: Difficulty;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 600_000,   // 10 min
  minSolveMs: 30_000,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 900_000,   // 15 min
  minSolveMs: 60_000,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 1_200_000, // 20 min
  minSolveMs: 90_000,
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

export function gasDisplay(fixed8: bigint): string {
  return formatGas(fixed8, 8);
}

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
    case 1: return "dealt";
    case 2: return "solved";
    case 3: return "expired";
    case 4: return "refunded";
    case 5: return "unknown";
    default: return "committed";
  }
}

export function canExpireAfterGrace(
  deadline: number,
  now = Date.now(),
  graceMs = SETTLEMENT_GRACE_MS,
): boolean {
  return deadline > 0 && now > deadline + Math.max(0, graceMs);
}
