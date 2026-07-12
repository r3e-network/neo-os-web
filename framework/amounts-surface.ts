/**
 * framework/amounts-surface — app.amount scalers + the strict amount parsers
 * (RFC P0-1 §2 step 9, moved verbatim from index.ts).
 *
 * Two deliberate semantics live side by side (gotcha #2 — do NOT unify):
 * - `gasToFixed8`/`neoToUnits`/`assetToUnits` THROW on invalid input.
 * - `parseGasToFixed8`/`parseNeoToUnits`/`parseAssetToUnits` return `null`
 *   for ANY invalid input — NEVER throw — so app-side localized `t()`
 *   rejection paths keep working (S6).
 */

import { fixed8ToGasString } from "./gamefi";
import type { FrameworkAmountSurface, FrameworkAssetSymbol } from "./types";

/**
 * Human GAS (or fixed8 bigint) → fixed8 base-unit integer STRING.
 * THROWS on negative/malformed/over-precision input; zero rejected unless
 * `allowZero`. The framework-internal amount core (funds specs, credits).
 */
export function gasFixed8Amount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("GAS amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("GAS amount must be positive");
    return value.toString();
  }
  const raw = typeof value === "number"
    ? Number.isFinite(value)
      ? value.toFixed(8).replace(/\.?0+$/, "")
      : ""
    : String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("GAS amount cannot be negative");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("GAS amount must be a positive decimal amount");
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  if (fraction.length > 8) throw new Error("GAS amount cannot have more than 8 decimals");
  const fixed8 = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  if (!allowZero && fixed8 <= 0n) throw new Error("GAS amount must be positive");
  return fixed8.toString();
}

/**
 * Whole-NEO input → integer unit STRING. NEO is indivisible — fractions
 * reject. THROWS on invalid input; zero rejected unless `allowZero`.
 */
export function neoWholeAmount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("NEO amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("NEO amount must be positive");
    return value.toString();
  }
  const raw = String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("NEO amount cannot be negative");
  if (!/^\d+$/.test(raw)) {
    throw new Error("NEO amount must be a whole number");
  }
  const units = BigInt(raw);
  if (units < 0n) throw new Error("NEO amount cannot be negative");
  if (!allowZero && units === 0n) throw new Error("NEO amount must be positive");
  return units.toString();
}

/**
 * Build the `app.amount` surface (see module doc for the throw-vs-null split).
 *
 * @example
 * ```ts
 * const amount = createAmountSurface();
 * amount.gasToFixed8("1.5");        // 150000000n (throws on garbage)
 * amount.parseGasToFixed8("abc");   // null (never throws)
 * ```
 */
export function createAmountSurface(): FrameworkAmountSurface {
  return {
    gasToFixed8(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
    fixed8ToGas(value: bigint | number | string, maxDecimals = 8): string {
      return fixed8ToGasString(value, maxDecimals);
    },
    neoToUnits(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(neoWholeAmount(value, options?.allowZero === true));
    },
    assetToUnits(
      asset: FrameworkAssetSymbol,
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): bigint {
      return asset === "NEO"
        ? BigInt(neoWholeAmount(value, options?.allowZero === true))
        : BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
    /**
     * Null-on-invalid GAS scaler (S6): returns the fixed8 base-unit integer
     * string, or `null` for ANY invalid input — NEVER throws, so app-side
     * localized `t()` rejection paths keep working. `gasToFixed8` (above)
     * intentionally keeps its THROW semantics — do not unify (gotcha #2).
     */
    parseGasToFixed8(
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return gasFixed8Amount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
    /** Null-on-invalid NEO parser — NEO is indivisible, fractions reject to null. */
    parseNeoToUnits(
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return neoWholeAmount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
    /** Null-on-invalid asset scaler: GAS ×1e8, NEO whole units — never throws. */
    parseAssetToUnits(
      asset: FrameworkAssetSymbol,
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return asset === "NEO"
          ? neoWholeAmount(value, options?.allowZero === true)
          : gasFixed8Amount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
  };
}
