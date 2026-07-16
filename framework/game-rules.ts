/**
 * framework/game-rules — the `app.game.rules(config)` factory (RFC P1-2).
 *
 * 13 reward games ship a near-identical `src/logic/game-rules.ts` whose only
 * real per-game content is the CONSTANTS (stakes, penalty percentages, grace
 * window). This factory keeps the constants in the app (as config) and moves
 * the helper bodies here — `statusOf` delegates to the SDK's
 * `rewardGameStatusOf`, `gasDisplay` delegates to `utils/format.formatGas` and
 * `formatClock` to the fleet-standard clock in `fmt-surface`, and the payout
 * math is bigint-exact.
 *
 * Migration: replace the game-rules.ts helper bodies with re-exports of
 * `app.game.rules({ ...constants })`; game-specific helpers stay local.
 */

import { formatClock as fleetFormatClock } from "./fmt-surface";
import { rewardGameStatusOf } from "./gamefi";
import type { RewardGameStatus } from "./gamefi";
import { MiniAppError } from "./utils/errors";
import { formatGas } from "./utils/format";
import type { FrameworkGameRuleConfig, FrameworkGameRules } from "./types";

/** Fleet-standard settlement grace (matches the contracts' SETTLE_GRACE_MS). */
export const DEFAULT_SETTLEMENT_GRACE_MS = 600_000;

/** Fleet-standard difficulty clamp: nearest integer in 0..2 (non-finite → 0). */
export function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/**
 * Build the standard game-rules helpers (see {@link FrameworkGameRules}).
 *
 * @example
 * ```ts
 * const rules = createGameRules({
 *   difficulties: {
 *     easy: { stakeFixed8: 2_000_000n, label: "Easy" },
 *     hard: { stakeFixed8: 20_000_000n, label: "Hard" },
 *   },
 *   payout: { basePct: 100, undoPenaltyPct: 30, maxUndos: 3 },
 * });
 * rules.rewardPctAfterUndos(2); // 40
 * rules.payoutFixed8(10_000_000n, 40); // 4_000_000n
 * ```
 */
export function createGameRules(config: FrameworkGameRuleConfig): FrameworkGameRules {
  const settlementGraceMs = Math.max(0, config.settlementGraceMs ?? DEFAULT_SETTLEMENT_GRACE_MS);
  const basePct = Math.max(0, Math.trunc(config.payout.basePct));
  const undoPenaltyPct = Math.max(0, Math.trunc(config.payout.undoPenaltyPct ?? 0));
  const maxUndos = config.payout.maxUndos;

  return {
    ruleOf(difficulty: string) {
      const rule = config.difficulties[difficulty];
      if (!rule) {
        throw new MiniAppError(`unknown difficulty ${difficulty}`, "UNKNOWN_DIFFICULTY");
      }
      return {
        stakeFixed8: rule.stakeFixed8,
        label: rule.label ?? difficulty,
        meta: rule.meta ?? {},
      };
    },
    statusOf(raw: unknown): RewardGameStatus {
      return rewardGameStatusOf(raw);
    },
    gasDisplay(fixed8: bigint | string): string {
      return formatGas(fixed8, 2);
    },
    formatClock(ms: number): string {
      return fleetFormatClock(ms);
    },
    rewardPctAfterUndos(undos: number): number {
      const clamped = Math.max(
        0,
        Math.min(Math.trunc(undos) || 0, maxUndos ?? Number.MAX_SAFE_INTEGER),
      );
      return Math.max(0, basePct - undoPenaltyPct * clamped);
    },
    payoutFixed8(stakeFixed8: bigint, pct: number): bigint {
      const safePct = BigInt(Math.max(0, Math.trunc(pct)));
      return (stakeFixed8 * safePct) / 100n;
    },
    canReleaseExpiredGame(state: { finishedAt: number }, nowMs: number): boolean {
      const finishedAt = Number(state?.finishedAt);
      if (!Number.isFinite(finishedAt) || finishedAt <= 0) return false;
      return nowMs > finishedAt + settlementGraceMs;
    },
    settlementGraceMs,
  };
}
