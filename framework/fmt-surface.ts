/**
 * framework/fmt-surface — the fleet-standard elapsed-clock formatter.
 *
 * This module once also exported `createFmtSurface()` / `FrameworkFmt`, the
 * `app.fmt` accessor hung off `ctx.framework` (RFC P0-3). That accessor was
 * removed: it was unreachable by the view contract. `react/MiniAppRoot`'s
 * `PlayAreaProps` hands views `{ t, state, dispatch, services, status, ... }`
 * and no `app`/`framework` identifier, so no view could reach `app.fmt` — and
 * it was never called, in the fleet or anywhere in git history.
 *
 * The fleet's canonical display formatters are the plain module imports from
 * `utils/format.ts` (`formatAddress`, `formatGas`, `formatFixed8`, …), which
 * the surface only ever delegated to. Import those directly.
 *
 * `formatClock` stays here because it is the one implementation that was never
 * in `utils/format`. It is load-bearing: imported as a module by the fleet's
 * `logic/game-rules.ts` files and by `framework/game-rules.ts`.
 */

/**
 * Fleet-standard elapsed-clock formatter (`mm:ss`, zero-padded).
 *
 * Behavior is the majority signature of the fleet's `formatClock` copies:
 * zero-padded `mm:ss`, floor-of-seconds, clamped at zero. Minutes are not
 * wrapped at 60 — an hour renders `"60:00"`.
 *
 * Exported as a plain function so `game.rules`-style helpers can delegate
 * without constructing a surface.
 */
export function formatClock(ms: number): string {
  const clamped = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
