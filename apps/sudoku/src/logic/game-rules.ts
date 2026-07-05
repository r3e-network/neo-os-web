/**
 * Economic + timing constants of the MiniAppSudoku contract, mirrored for the
 * UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppSudoku (getConfig() exposes the live values
 * for cross-checks).
 */
import type { Difficulty } from "./sudoku-engine";

export const ENTRY_MEMO = "miniapp-sudoku:entry";
export const FUND_MEMO = "miniapp-sudoku:fund";

export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;

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
  limitMs: 900_000,
  minSolveMs: 90_000,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 1_500_000,
  minSolveMs: 150_000,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 2_400_000,
  minSolveMs: 240_000,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export function ruleOf(difficulty: number): DifficultyRule {
  switch (difficulty) {
    case 1:
      return MEDIUM_RULE;
    case 2:
      return HARD_RULE;
    default:
      return EASY_RULE;
  }
}

export function rewardPctAfterUndos(undos: number): number {
  const pct = 100 - UNDO_PENALTY_PCT * Math.max(0, Math.min(MAX_UNDOS, undos));
  return Math.max(pct, 100 - UNDO_PENALTY_PCT * MAX_UNDOS);
}

export function payoutFixed8(difficulty: number, undos: number): bigint {
  return (ruleOf(difficulty).rewardFixed8 * BigInt(rewardPctAfterUndos(undos))) / 100n;
}

export function gasDisplay(fixed8: bigint): string {
  const whole = fixed8 / 100_000_000n;
  const fraction = fixed8 % 100_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
