/**
 * Economic + timing constants of the MiniAppGame2048 contract, mirrored for
 * the UI. Values are FIXED8 base units (1 GAS = 1e8) and milliseconds; keep in
 * lockstep with contracts/MiniAppGame2048 (getConfig() exposes the live
 * values for cross-checks).
 */
import { formatClock as fleetFormatClock } from "@framework/fmt-surface";
import {
  createDifficultyRuleSelector,
  DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS,
} from "@framework/game-rules";
import { formatGas } from "@framework/utils/format";

export const ENTRY_MEMO = "miniapp-game-2048:entry";
export const FUND_MEMO = "miniapp-game-2048:fund";

export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
export const MAX_MOVES = 2000;
/** Must match MiniAppGame2048.SETTLE_GRACE_MS; refreshed from getConfig in GameFi mode. */
export { DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS } from "@framework/game-rules";

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

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES);

export function rewardPctAfterUndos(undos: number): number {
  const clamped = Math.max(0, Math.min(MAX_UNDOS, undos));
  return 100 - UNDO_PENALTY_PCT * clamped;
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
      return "committed";
  }
}
