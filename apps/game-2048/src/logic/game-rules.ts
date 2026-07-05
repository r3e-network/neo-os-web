/**
 * Economic + timing constants of the MiniAppGame2048 contract, mirrored for
 * the UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppGame2048 (getConfig() exposes the live
 * values for cross-checks).
 */
export const ENTRY_MEMO = "miniapp-game-2048:entry";
export const FUND_MEMO = "miniapp-game-2048:fund";

export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
export const MAX_MOVES = 2000;

export type Difficulty = 0 | 1 | 2;

export interface DifficultyRule {
  difficulty: Difficulty;
  key: "sprint" | "climb" | "summit";
  targetExp: number;
  targetTile: number;
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
}

const SPRINT_RULE: DifficultyRule = {
  difficulty: 0,
  key: "sprint",
  targetExp: 9,
  targetTile: 512,
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 240_000,
  minSolveMs: 60_000,
};

const CLIMB_RULE: DifficultyRule = {
  difficulty: 1,
  key: "climb",
  targetExp: 10,
  targetTile: 1024,
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 480_000,
  minSolveMs: 120_000,
};

const SUMMIT_RULE: DifficultyRule = {
  difficulty: 2,
  key: "summit",
  targetExp: 11,
  targetTile: 2048,
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 900_000,
  minSolveMs: 240_000,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [SPRINT_RULE, CLIMB_RULE, SUMMIT_RULE];

export function ruleOf(difficulty: number): DifficultyRule {
  switch (difficulty) {
    case 1:
      return CLIMB_RULE;
    case 2:
      return SUMMIT_RULE;
    default:
      return SPRINT_RULE;
  }
}

export function rewardPctAfterUndos(undos: number): number {
  const clamped = Math.max(0, Math.min(MAX_UNDOS, undos));
  return 100 - UNDO_PENALTY_PCT * clamped;
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
