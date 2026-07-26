/**
 * Economic + timing constants of the MiniAppFlappyDash contract, mirrored for the
 * UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppFlappyDash (getConfig() exposes the live values
 * for cross-checks).
 */

import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import { createDifficultyRuleSelector } from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export const ENTRY_MEMO = "miniapp-flappy-dash:entry";
export const FUND_MEMO = "miniapp-flappy-dash:fund";

export const BEACON_BLOCKS = 1;
export const SETTLE_GRACE_MS = 600_000;

export interface DifficultyRule {
  difficulty: number;
  key: "easy" | "medium" | "hard";
  entryFixed8: bigint;
  rewardFixed8: bigint;
  limitMs: number;
  minSolveMs: number;
  targetPipes: number;
}

const EASY_RULE: DifficultyRule = {
  difficulty: 0,
  key: "easy",
  entryFixed8: 2_000_000n,
  rewardFixed8: 10_000_000n,
  limitMs: 120_000,
  minSolveMs: 20_000,
  targetPipes: 5,
};

const MEDIUM_RULE: DifficultyRule = {
  difficulty: 1,
  key: "medium",
  entryFixed8: 10_000_000n,
  rewardFixed8: 50_000_000n,
  limitMs: 180_000,
  minSolveMs: 30_000,
  targetPipes: 10,
};

const HARD_RULE: DifficultyRule = {
  difficulty: 2,
  key: "hard",
  entryFixed8: 20_000_000n,
  rewardFixed8: 100_000_000n,
  limitMs: 300_000,
  minSolveMs: 45_000,
  targetPipes: 20,
};

export const DIFFICULTY_RULES: readonly DifficultyRule[] = [EASY_RULE, MEDIUM_RULE, HARD_RULE];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

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
      // Contract status 5 means the finalize request was broadcast and the
      // oracle callback is still pending. Never reopen or duplicate that run.
      return "unknown";
    default:
      return raw === 0 ? "committed" : "unknown";
  }
}
