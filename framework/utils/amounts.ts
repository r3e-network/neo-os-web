/**
 * Canonical NEO / GAS amount-input helpers for miniapp composables.
 *
 * Promoted from the byte-identical copies that lived in 11+ miniapp
 * composables (gov-merc, self-loan, burn-league, red-envelope, time-capsule,
 * dev-tipping, fogplay, breakup-contract, gasbox, milestone-escrow, neo-pay).
 *
 * ASSET CONVENTION (the #1 correctness risk — kept strictly separate):
 * - NEO is an INDIVISIBLE integer token: 1 NEO = 1 unit, NEVER scaled by 1e8.
 * - GAS uses BASE UNITS (×1e8); the helpers here are the SINGLE scaling point.
 *
 * ERROR SEMANTICS (do NOT unify — both variants are load-bearing):
 * - These helpers return `0n` on invalid input so callers can reject with
 *   their own localized `t(...)` copy before touching the chain.
 * - `app.amount.gasToFixed8` (framework/index.ts) THROWS on invalid input.
 *   Apps that need non-throwing scalers use these / the S6 `parse*` lane.
 *
 * Canonical home of apps/shared/utils/amounts.ts — shared re-exports from
 * here.
 */

import { toFixedDecimals } from "./format";

/** GAS base units per whole GAS (1e8). */
export const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

/**
 * Convert a human-entered GAS amount string to contract BASE UNITS without
 * floats. Accepts up to 8 decimal places; returns 0n for any invalid /
 * non-positive input so callers can reject before touching the chain.
 */
export function gasToBaseUnits(raw: string): bigint {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const base = BigInt(toFixedDecimals(trimmed, 8));
  return base > 0n ? base : 0n;
}

/**
 * Parse a WHOLE NEO amount string to an integer bigint. NEO is INDIVISIBLE, so
 * a fractional value is rejected (returns 0n) — it is NEVER scaled by 1e8.
 * Returns 0n for any invalid / non-positive input.
 */
export function neoToInteger(raw: string): bigint {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return 0n;
  const n = BigInt(trimmed);
  return n > 0n ? n : 0n;
}

/**
 * Convert a human-entered amount string to contract BASE UNITS for an asset.
 *
 * GAS: value * 1e8, up to 8 decimal places, scaled without floats. NEO: the
 * integer token count with NO scaling — fractional NEO is rejected (NEO is
 * indivisible). Returns 0n for any invalid / non-positive input so callers can
 * reject before touching the chain.
 */
export function amountToBaseUnits(raw: string, asset: "NEO" | "GAS"): bigint {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return 0n;
  return asset === "NEO" ? neoToInteger(trimmed) : gasToBaseUnits(trimmed);
}
