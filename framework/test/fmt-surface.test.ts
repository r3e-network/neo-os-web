/**
 * framework/fmt-surface — the fleet-standard elapsed clock.
 *
 * Locks the clock contract every `logic/game-rules.ts` in the fleet depends on:
 * zero-padded mm:ss, floored (not rounded), clamped at zero, minutes uncapped.
 *
 * The `createFmtSurface()` / `app.fmt` accessor tests that used to live here
 * went with the accessor itself: it was unreachable by the view contract
 * (`react/MiniAppRoot`'s PlayAreaProps hands views no `app`/`framework`
 * identifier) and was never called in the fleet or in git history. Its methods
 * only delegated to `utils/format`, which has its own tests and which apps
 * import directly. `formatClock` is the load-bearing export that remains.
 */
import { describe, expect, it } from "vitest";
import { formatClock } from "../fmt-surface";

describe("formatClock", () => {
  it("renders the fleet-standard zero-padded mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(61_500)).toBe("01:01");
    expect(formatClock(83_000)).toBe("01:23");
  });

  it("floors seconds rather than rounding them", () => {
    expect(formatClock(999)).toBe("00:00");
    expect(formatClock(1_999)).toBe("00:01");
  });

  it("keeps counting minutes past an hour instead of wrapping at 60", () => {
    expect(formatClock(3_600_000)).toBe("60:00");
  });

  it("clamps negative and non-finite input at zero", () => {
    expect(formatClock(-5_000)).toBe("00:00");
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});
