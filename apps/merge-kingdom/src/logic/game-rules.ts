/**
 * Game rules constants for Merge Kingdom (tile-merging puzzle).
 */
import { createDifficultyRuleSelector } from "@framework/game-rules";

export const ENTRY_MEMO = "miniapp-merge-kingdom:entry";
export const FUND_MEMO = "miniapp-merge-kingdom:fund";
export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
export const SETTLE_GRACE_MS = 600_000;
/** New paid entries stay closed until pool + oracle callback + live flow pass. */
export const GAMEFI_NEW_ENTRIES_ENABLED = false;
export const BOARD_SIZE = 4;
export const TILE_VALUES = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096] as const;
export const TILE_BG: Record<string, string> = {
  0: "rgba(112, 87, 54, 0.13)",
  2: "#fff7d6",
  4: "#f8e7bd",
  8: "#efd28f",
  16: "#e8bd67",
  32: "#dba84f",
  64: "#ce933d",
  128: "#bf7d31",
  256: "#ad6728",
  512: "#9b5222",
  1024: "#833f1d",
  2048: "#6f3118",
  4096: "#5b2413",
};
export const TILE_COLOR: Record<string, string> = {
  0: "transparent",
  2: "#6e4a12",
  4: "#6e4a12",
  8: "#5f3f10",
  16: "#5a3710",
  32: "#fff8e6",
  64: "#fff8e6",
  128: "#fff8e6",
  256: "#fff8e6",
  512: "#fff8e6",
  1024: "#fff8e6",
  2048: "#fff8e6",
  4096: "#fff8e6",
};
export const TILE_FONT_SIZE: Record<string, string> = {
  0: "0",
  2: "1rem",
  4: "1rem",
  8: "1rem",
  16: "0.92rem",
  32: "0.92rem",
  64: "0.92rem",
  128: "0.82rem",
  256: "0.82rem",
  512: "0.82rem",
  1024: "0.72rem",
  2048: "0.72rem",
  4096: "0.72rem",
};

export interface DifficultyRule {
  difficulty: number;
  entry: number;       // Fixed8 GAS (1 GAS = 1e8)
  reward: number;
  limitMs: number;
  minSolveMs: number;
  targetTile: number;   // tile value needed to win
}

export const DIFFICULTY_RULES: DifficultyRule[] = [
  { difficulty: 0, entry: 2_000_000, reward: 10_000_000, limitMs: 180_000, minSolveMs: 30_000, targetTile: 64 },
  { difficulty: 1, entry: 10_000_000, reward: 50_000_000, limitMs: 300_000, minSolveMs: 60_000, targetTile: 256 },
  { difficulty: 2, entry: 20_000_000, reward: 100_000_000, limitMs: 600_000, minSolveMs: 120_000, targetTile: 1024 },
];

/**
 * Guest routes are short, mobile-first skill rounds. The deployed GameFi
 * contract keeps its immutable 64/256/1024 targets above; local play uses a
 * smaller progression because each merge reveals only one fresh 2/4 resource
 * and adjacent repositioning also consumes player actions.
 */
export const GUEST_DIFFICULTY_RULES: DifficultyRule[] = [
  { difficulty: 0, entry: 0, reward: 0, limitMs: 45_000, minSolveMs: 0, targetTile: 32 },
  { difficulty: 1, entry: 0, reward: 0, limitMs: 60_000, minSolveMs: 0, targetTile: 64 },
  { difficulty: 2, entry: 0, reward: 0, limitMs: 90_000, minSolveMs: 0, targetTile: 128 },
];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES, { strict: true });

export function guestRuleOf(difficulty: number): DifficultyRule {
  const rule = GUEST_DIFFICULTY_RULES.find((candidate) => candidate.difficulty === difficulty);
  if (!rule) throw new Error(`unknown guest difficulty ${difficulty}`);
  return rule;
}

export function rewardPctAfterUndos(undos: number): number {
  return 100 - UNDO_PENALTY_PCT * undos;
}

export function payoutFixed8(reward: number, undos: number): number {
  const pct = rewardPctAfterUndos(undos);
  return Math.floor(reward * pct / 100);
}

export function gasDisplay(fixed8: number): string {
  return (fixed8 / 1e8).toFixed(2);
}

export function formatClock(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** The contract accepts expiry only strictly after deadline + settlement grace. */
export function canExpireAfterGrace(deadline: number, nowMs = Date.now()): boolean {
  return Number.isFinite(deadline)
    && deadline > 0
    && Number.isFinite(nowMs)
    && nowMs > deadline + SETTLE_GRACE_MS;
}

export function statusOf(s: number): string {
  switch (s) {
    case 0: return "awaiting-bind";
    case 1: return "playing";
    case 2: return "solved";
    case 3: return "expired";
    case 4: return "refunded";
    case 5: return "unknown"; // callback requested; settlement still pending
    default: return "unknown";
  }
}

/** Check if a tile value is a game tile (a power of 2 that is at least 2). */
export function isPowerOf2(v: number): boolean {
  return v >= 2 && (v & (v - 1)) === 0;
}

/** Create an empty 4x4 board */
export function emptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}
