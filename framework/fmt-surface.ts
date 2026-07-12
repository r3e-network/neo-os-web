/**
 * framework/fmt-surface — app.fmt blessed display helpers (RFC P0-3).
 *
 * The fleet re-implements the same display formatters app-by-app
 * (`shortAddr`/`shortHash`, `formatGas`-family, raw `/ 1e8` display math,
 * `formatClock`) even though `utils/format.ts` already ships the
 * implementations — they just were not discoverable from `ctx.framework`.
 * `app.fmt` is the discoverable home; every method DELEGATES to the existing
 * `utils/format` implementation (single source of truth), so output is
 * byte-identical to what shared-format-importing apps already render.
 *
 * `clock` is the one new implementation; its behavior is the majority
 * signature of the 18 fleet `formatClock` copies (zero-padded `mm:ss`,
 * floor-of-seconds, clamped at zero).
 *
 * Display only — protocol math stays on `app.amount` (which returns bigint
 * base units); `app.fmt` returns strings for UI.
 */

import {
  formatAddress,
  formatCompactNumber,
  formatCountdown,
  formatFixed8,
  formatGas,
  formatHash,
  formatNumber,
} from "./utils/format";

/** Middle-truncation options for {@link FrameworkFmt.address} / `hash`. */
export interface FrameworkFmtTruncateOptions {
  /** Leading characters kept (default 6). */
  head?: number;
  /** Trailing characters kept (default 4). */
  tail?: number;
}

/** Decimal-precision option for {@link FrameworkFmt.gas} / `fixed8`. */
export interface FrameworkFmtDecimalsOptions {
  /** Maximum fraction digits displayed (default 4, trailing zeros trimmed). */
  decimals?: number;
}

/**
 * app.fmt — the blessed display formatters (see module doc).
 *
 * @example
 * ```ts
 * app.fmt.address("NUVxNjZi2wxShJnTh9SyCJHBUCd5PJ9fKq"); // "NUVxNj...J9fKq" style
 * app.fmt.gas(150_000_000n);                             // "1.5"
 * app.fmt.clock(83_000);                                 // "01:23"
 * app.fmt.compact(12_400);                               // "12.4K"
 * ```
 */
export interface FrameworkFmt {
  /** NEO address → `"NUVx…9fKq"`. Delegates to `utils/format.formatAddress`. */
  address(value?: string, opts?: FrameworkFmtTruncateOptions): string;
  /** Tx/contract hash → `"0x1a2b…9f0e"`. Delegates to `formatHash`. */
  hash(value?: string, opts?: FrameworkFmtTruncateOptions): string;
  /** GAS fixed8 base units → decimal display string. Delegates to `formatGas`. */
  gas(amountFixed8: bigint | number | string, opts?: FrameworkFmtDecimalsOptions): string;
  /** Generic fixed8 → decimal display. Delegates to `formatFixed8`. */
  fixed8(value: bigint | number | string, opts?: FrameworkFmtDecimalsOptions): string;
  /** Seconds-until-target → `"1h 2m"`-style countdown. Delegates to `formatCountdown`. */
  countdown(targetSeconds: number): string;
  /**
   * Elapsed/remaining ms → zero-padded `"mm:ss"` clock — the fleet-standard
   * `formatClock` (floor of seconds, clamped at `"00:00"` for `<= 0` input).
   */
  clock(ms: number): string;
  /** Locale-grouped fixed-decimal number. Delegates to `formatNumber` (default 2 decimals). */
  number(value: number | string, decimals?: number): string;
  /** Compact magnitude display: `12_400` → `"12.4K"`. Delegates to `formatCompactNumber`. */
  compact(value: number): string;
}

/**
 * Fleet-standard elapsed-clock formatter (`mm:ss`, zero-padded). Exported so
 * `game.rules`-style helpers can delegate without constructing a surface.
 */
export function formatClock(ms: number): string {
  const clamped = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Build the `app.fmt` surface. Stateless — every method delegates to
 * `utils/format` (see {@link FrameworkFmt}).
 */
export function createFmtSurface(): FrameworkFmt {
  return {
    address(value?: string, opts?: FrameworkFmtTruncateOptions): string {
      return formatAddress(value, opts?.head ?? 6, opts?.tail ?? 4);
    },
    hash(value?: string, opts?: FrameworkFmtTruncateOptions): string {
      return formatHash(value ?? "", opts?.head ?? 6, opts?.tail ?? 4);
    },
    gas(amountFixed8: bigint | number | string, opts?: FrameworkFmtDecimalsOptions): string {
      return formatGas(amountFixed8, opts?.decimals ?? 4);
    },
    fixed8(value: bigint | number | string, opts?: FrameworkFmtDecimalsOptions): string {
      return formatFixed8(value, opts?.decimals ?? 4);
    },
    countdown(targetSeconds: number): string {
      return formatCountdown(targetSeconds);
    },
    clock(ms: number): string {
      return formatClock(ms);
    },
    number(value: number | string, decimals = 2): string {
      return formatNumber(value, decimals);
    },
    compact(value: number): string {
      return formatCompactNumber(value);
    },
  };
}
