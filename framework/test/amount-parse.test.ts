/**
 * S6 app.amount null-variant spec (framework-extraction plan §2/S6).
 *
 * The parse* lane must NEVER throw — apps reject invalid input with their own
 * localized `t()` copy before touching the chain (flashloan, gas-sponsor,
 * self-loan, neo-pay, quadratic-funding). The throwing `gasToFixed8` lane is
 * a documented gotcha whose semantics must stay untouched.
 */

import { describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

function makeFramework() {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ""),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0x0", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0x0", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
  } as unknown as MiniAppFrameworkContext;
  return createMiniAppFramework(ctx, { appId: "amount-app" });
}

describe("S6 app.amount parse* null-variants", () => {
  const app = makeFramework();

  it("parseGasToFixed8 scales valid input to base-unit strings", () => {
    expect(app.amount.parseGasToFixed8("1.5")).toBe("150000000");
    expect(app.amount.parseGasToFixed8("0.00000001")).toBe("1");
    expect(app.amount.parseGasToFixed8(2)).toBe("200000000");
    expect(app.amount.parseGasToFixed8(150_000_000n)).toBe("150000000");
  });

  it("parseGasToFixed8 returns null on ANY invalid input — never throws", () => {
    const invalid: Array<bigint | number | string> = [
      "not-a-number",
      "-3",
      "0",
      "",
      "  ",
      "1.123456789", // > 8 decimals
      "1,5",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      -1n,
      0n,
    ];
    for (const value of invalid) {
      expect(() => app.amount.parseGasToFixed8(value)).not.toThrow();
      expect(app.amount.parseGasToFixed8(value)).toBeNull();
    }
    // Even hostile inputs that break String() coercion resolve to null.
    expect(
      app.amount.parseGasToFixed8(Symbol("boom") as unknown as string),
    ).toBeNull();
  });

  it("parseGasToFixed8 honors allowZero", () => {
    expect(app.amount.parseGasToFixed8("0", { allowZero: true })).toBe("0");
    expect(app.amount.parseGasToFixed8(0n, { allowZero: true })).toBe("0");
  });

  it("parseNeoToUnits keeps NEO integral — fractions reject to null, never ×1e8", () => {
    expect(app.amount.parseNeoToUnits("2")).toBe("2");
    expect(app.amount.parseNeoToUnits(3n)).toBe("3");
    expect(app.amount.parseNeoToUnits("2.5")).toBeNull();
    expect(app.amount.parseNeoToUnits("-2")).toBeNull();
    expect(app.amount.parseNeoToUnits("0")).toBeNull();
    expect(app.amount.parseNeoToUnits("0", { allowZero: true })).toBe("0");
    expect(app.amount.parseNeoToUnits("abc")).toBeNull();
  });

  it("parseAssetToUnits routes per asset with null-on-invalid semantics", () => {
    expect(app.amount.parseAssetToUnits("GAS", "1.00000001")).toBe("100000001");
    expect(app.amount.parseAssetToUnits("NEO", "3")).toBe("3");
    expect(app.amount.parseAssetToUnits("NEO", "3.5")).toBeNull();
    expect(app.amount.parseAssetToUnits("GAS", "oops")).toBeNull();
  });

  it("gasToFixed8 keeps its THROW semantics untouched (gotcha #2)", () => {
    expect(app.amount.gasToFixed8("1.5")).toBe(150_000_000n);
    expect(() => app.amount.gasToFixed8("not-a-number")).toThrow();
    expect(() => app.amount.gasToFixed8("-3")).toThrow();
    expect(() => app.amount.gasToFixed8("0")).toThrow();
    expect(() => app.amount.neoToUnits("2.5")).toThrow();
    expect(() => app.amount.assetToUnits("GAS", "oops")).toThrow();
  });
});
