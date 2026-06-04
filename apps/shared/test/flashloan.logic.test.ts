import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { useFlashloanCore } from "../../flashloan/src/composables/useFlashloanCore";

const OWNER = "NTestAddress";
const CALLBACK = "0x1111111111111111111111111111111111111111";

function t(key: string) {
  const messages: Record<string, string> = {
    invalidLoanId: "Invalid loan ID",
    invalidLoanAmount: "Invalid loan amount",
    invalidCallbackContract: "Invalid callback contract address",
    invalidCallbackMethod: "Callback method must be onFlashLoan",
    loanNotFound: "Loan not found",
    notAvailable: "Unavailable",
    connectWallet: "Connect Wallet",
  };
  return messages[key] ?? key;
}

function setup() {
  const read = vi.fn(async (operation: string, args?: unknown[]) => {
    if (operation === "getFlashLoanStats") {
      return {
        totalLoans: 2,
        totalBorrowed: "1000000000",
        totalFees: "900000",
        poolBalance: "1250000000",
        minLoan: "100000000",
        maxLoan: "10000000000000",
        feeBasisPoints: 9,
        cooldownMs: 300000,
        maxDailyLoans: 10,
      };
    }
    if (operation === "getFlashLoan") {
      const loanId = Number((args?.[1] as { value?: string })?.value ?? 0);
      return [
        OWNER,
        loanId === 2 ? "200000000" : "100000000",
        loanId === 2 ? "180000" : "90000",
        CALLBACK,
        "onFlashLoan",
        1780000000000,
        true,
        true,
      ];
    }
    return null;
  });
  const invoke = vi.fn(async () => ({
    txid: "0xflashrequest",
    success: true,
  }));
  const chain = {
    address: createObservable(OWNER),
    ensureWallet: vi.fn(async () => OWNER),
    invoke,
    read,
  };
  const badge = { award: vi.fn(async () => undefined) };
  const flashloan = useFlashloanCore({
    chainService: chain as never,
    badgeService: badge as never,
    t,
  });
  flashloan.setAddress(OWNER);
  return { flashloan, chain, badge, invoke, read };
}

describe("useFlashloanCore contract flow", () => {
  it("submits requestFlashLoan through ChainService instead of storage", async () => {
    const { flashloan, chain, invoke } = setup();

    await flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "onFlashLoan",
    });

    expect(chain.ensureWallet).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(
      "requestFlashLoan",
      [
        { type: "String", value: "miniapp-flashloan" },
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "100000000" },
        { type: "Hash160", value: CALLBACK },
        { type: "String", value: "onFlashLoan" },
      ],
    );
    expect(flashloan.lastRequest.get()?.txid).toBe("0xflashrequest");
  });

  it("loads pool, totals, contract limits, and recent loans from contract reads", async () => {
    const { flashloan, read } = setup();

    await flashloan.loadData();

    expect(read).toHaveBeenCalledWith(
      "getFlashLoanStats",
      [{ type: "String", value: "miniapp-flashloan" }],
      { cache: true, cacheTtlMs: 30000 },
    );
    expect(flashloan.poolBalance.get()).toBe(12.5);
    expect(flashloan.stats.get()).toEqual({
      totalLoans: 2,
      totalVolume: 10,
      totalFees: 0.009,
    });
    expect(flashloan.contractStats.get()).toMatchObject({
      minLoan: 1,
      maxLoan: 100000,
      feeBasisPoints: 9,
    });
    expect(flashloan.recentLoans.get()).toHaveLength(2);
  });

  it("throws loanNotFound and keeps loanDetails null for a non-existent loan", async () => {
    // read returns an all-zero/empty payload for a loan ID that does not exist.
    const emptyChain = {
      address: createObservable(OWNER),
      ensureWallet: vi.fn(async () => OWNER),
      invoke: vi.fn(),
      read: vi.fn(async () => ["", "0", "0", "", "", 0, false, false]),
    };
    const emptyLoan = useFlashloanCore({
      chainService: emptyChain as never,
      badgeService: { award: vi.fn(async () => undefined) } as never,
      t,
    });

    await expect(emptyLoan.lookupLoan("999")).rejects.toThrow("Loan not found");
    expect(emptyLoan.loanDetails.get()).toBeNull();
  });
});
