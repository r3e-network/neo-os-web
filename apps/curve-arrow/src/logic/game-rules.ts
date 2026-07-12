/**
 * Economic + timing constants of the MiniAppCurveArrow contract, mirrored for
 * the UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppCurveArrow (getConfig() exposes the live
 * values for cross-checks).
 */

export type Difficulty = 0 | 1 | 2;

export const ENTRY_MEMO = "miniapp-curve-arrow:entry";
export const FUND_MEMO = "miniapp-curve-arrow:fund";
/** Contract-enforced delay before an abandoned active/settling game can expire. */
export const SETTLEMENT_GRACE_MS = 600_000;

export interface DifficultyRule {
  difficulty: Difficulty;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
  targetLevels: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 180_000,
  minSolveMs: 10_000,
  targetLevels: 3,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 300_000,
  minSolveMs: 25_000,
  targetLevels: 5,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 600_000,
  minSolveMs: 45_000,
  targetLevels: 7,
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

export type GameStatus = "committed" | "dealt" | "solved" | "expired" | "refunded" | "unknown";

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
      return "unknown";
    default:
      return raw === 0 ? "committed" : "unknown";
  }
}

/** Expiry is valid only strictly after the on-chain deadline plus grace. */
export function canExpireAfterGrace(deadline: number, nowMs = Date.now()): boolean {
  return Number.isFinite(deadline) && deadline > 0 && nowMs > deadline + SETTLEMENT_GRACE_MS;
}
