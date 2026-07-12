/**
 * app.fmt (RFC P0-3) — blessed display formatters.
 *
 * Locks: delegation to utils/format (byte-identical output to the shared
 * helpers apps already import), the fleet-standard clock (zero-padded mm:ss,
 * floored, clamped at zero), and the surface wiring on ctx.framework.
 */
import { describe, expect, it, vi } from "vitest";
import { createFmtSurface, formatClock } from "../fmt-surface";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { formatAddress, formatGas } from "../utils/format";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function makeApp() {
  const ctx = {
    services: {
      chain: {
        address: createObservable<string | null>(ADDRESS),
        ensureWallet: vi.fn(async () => ADDRESS),
        read: vi.fn(async () => "0"),
        invoke: vi.fn(async () => ({ txid: "0x1" })),
        invokeWithPayment: vi.fn(async () => ({ txid: "0x2" })),
      },
    },
    t: (key: string) => key,
  } as unknown as MiniAppFrameworkContext;
  return createMiniAppFramework(ctx, { appId: "fmt-test" });
}

describe("createFmtSurface", () => {
  const fmt = createFmtSurface();

  it("address/hash delegate to formatAddress/formatHash with 6/4 defaults", () => {
    expect(fmt.address(ADDRESS)).toBe(formatAddress(ADDRESS, 6, 4));
    expect(fmt.address(ADDRESS)).toBe("NNLi44...rNEs");
    expect(fmt.address(ADDRESS, { head: 10, tail: 6 })).toBe(formatAddress(ADDRESS, 10, 6));
    expect(fmt.address("")).toBe("");
    expect(fmt.address(undefined)).toBe("");
    const hash = `0x${"1a2b".repeat(10)}`;
    expect(fmt.hash(hash)).toBe(formatAddress(hash, 6, 4));
    // Short values pass through untruncated (formatAddress contract).
    expect(fmt.hash("0xabc")).toBe("0xabc");
  });

  it("gas/fixed8 delegate to formatGas (4-decimal default, trailing zeros trimmed)", () => {
    expect(fmt.gas(150_000_000n)).toBe("1.5");
    expect(fmt.gas("250000000")).toBe(formatGas("250000000", 4));
    expect(fmt.gas(123_456_789, { decimals: 2 })).toBe("1.23");
    expect(fmt.gas(0n)).toBe("0");
    expect(fmt.gas(-5)).toBe("0"); // negative rejected, formatGas contract
    expect(fmt.fixed8(123_456_789n)).toBe(fmt.gas(123_456_789n));
  });

  it("clock renders the fleet-standard zero-padded mm:ss", () => {
    expect(fmt.clock(0)).toBe("00:00");
    expect(fmt.clock(999)).toBe("00:00"); // floor, not round
    expect(fmt.clock(61_500)).toBe("01:01");
    expect(fmt.clock(83_000)).toBe("01:23");
    expect(fmt.clock(3_600_000)).toBe("60:00"); // minutes keep counting
    expect(fmt.clock(-5_000)).toBe("00:00"); // clamped at zero
    expect(fmt.clock(Number.NaN)).toBe("00:00");
    expect(formatClock(61_500)).toBe(fmt.clock(61_500)); // exported standalone
  });

  it("number/compact delegate to formatNumber/formatCompactNumber", () => {
    expect(fmt.number(1234.5)).toBe("1,234.50");
    expect(fmt.number("7", 0)).toBe("7");
    expect(fmt.compact(12_400)).toBe("12.4K");
    expect(fmt.compact(1_500_000)).toBe("1.5M");
    expect(fmt.compact(999)).toBe("999");
  });

  it("countdown delegates to formatCountdown (past targets render empty)", () => {
    expect(fmt.countdown(Math.floor(Date.now() / 1000) - 100)).toBe("");
    const inTwoHours = Math.floor(Date.now() / 1000) + 2 * 3600 + 120;
    expect(fmt.countdown(inTwoHours)).toMatch(/^\d+h \d+m$/);
  });
});

describe("app.fmt wiring", () => {
  it("exposes the surface on ctx.framework with delegating output", () => {
    const app = makeApp();
    expect(app.fmt.address(ADDRESS)).toBe("NNLi44...rNEs");
    expect(app.fmt.gas(150_000_000n)).toBe("1.5");
    expect(app.fmt.clock(83_000)).toBe("01:23");
  });
});
