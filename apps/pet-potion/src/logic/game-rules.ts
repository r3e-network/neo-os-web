/**
 * Game rules constants for Pet Potion (virtual pet care).
 */
import {
  createDifficultyRuleSelector,
  DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS,
} from "@framework/game-rules";

export const ENTRY_MEMO = "miniapp-pet-potion:entry";
export const FUND_MEMO = "miniapp-pet-potion:fund";
export const MAX_UNDOS = 3;
export const UNDO_PENALTY_PCT = 30;
export const BEACON_BLOCKS = 1;
export const MAX_MOVES = 40; // max actions per game
/** Contract-enforced grace period before an abandoned playing/settling run can be expired. */
export { DEFAULT_SETTLEMENT_GRACE_MS as SETTLEMENT_GRACE_MS } from "@framework/game-rules";

export interface DifficultyRule {
  difficulty: number;
  entry: number;       // Fixed8 GAS (1 GAS = 1e8)
  reward: number;
  limitMs: number;
  minSolveMs: number;
  targetHappiness: number; // happiness level needed to win
}

export const DIFFICULTY_RULES: DifficultyRule[] = [
  { difficulty: 0, entry: 2_000_000, reward: 10_000_000, limitMs: 180_000, minSolveMs: 30_000, targetHappiness: 50 },
  { difficulty: 1, entry: 10_000_000, reward: 50_000_000, limitMs: 300_000, minSolveMs: 60_000, targetHappiness: 70 },
  { difficulty: 2, entry: 20_000_000, reward: 100_000_000, limitMs: 600_000, minSolveMs: 120_000, targetHappiness: 100 },
];

export const ruleOf = createDifficultyRuleSelector(DIFFICULTY_RULES, { strict: true });

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

/** The expire transaction is valid only strictly after deadline + contract grace. */
export function canExpireAfterGrace(deadline: number, nowMs = Date.now()): boolean {
  return Number.isFinite(deadline) && deadline > 0 && nowMs > deadline + SETTLEMENT_GRACE_MS;
}

export function statusOf(s: number): string {
  switch (s) {
    case 0: return "awaiting-bind";
    case 1: return "playing";
    case 2: return "solved";
    case 3: return "expired";
    case 4: return "refunded";
    default: return "unknown";
  }
}

/** Pet actions: 0=Feed, 1=Play, 2=Pet, 3=Rest */
export const ACTION_NAMES = ["feed", "play", "pet", "rest"] as const;
export type CareAction = (typeof ACTION_NAMES)[number];

/** One essence from every care tool completes the local potion recipe. */
export const POTION_RECIPE: Readonly<Record<CareAction, number>> = {
  feed: 1,
  play: 1,
  pet: 1,
  rest: 1,
};

export type IngredientCounts = Record<CareAction, number>;

export function emptyIngredientCounts(): IngredientCounts {
  return { feed: 0, play: 0, pet: 0, rest: 0 };
}

export function ingredientCountsOf(actions: readonly string[]): IngredientCounts {
  const counts = emptyIngredientCounts();
  for (const action of actions) {
    if ((ACTION_NAMES as readonly string[]).includes(action)) {
      counts[action as CareAction] += 1;
    }
  }
  return counts;
}

export function recipeReady(counts: IngredientCounts): boolean {
  return ACTION_NAMES.every((action) => counts[action] >= POTION_RECIPE[action]);
}

/** Pet evolution stages */
export const EVOLUTION_STAGES = ["baby", "child", "adult"] as const;

/** Get evolution stage index based on happiness */
export function evolutionStage(happiness: number): number {
  if (happiness >= 60) return 2; // adult
  if (happiness >= 30) return 1; // child
  return 0; // baby
}
