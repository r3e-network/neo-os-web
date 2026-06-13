import { describe, expect, it, vi } from "vitest";

import { useSelfLoan } from "./useSelfLoan";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x87f94598c78cb954ca8200d3964ded9b584d7250";
const ALICE_HASH = addressToScriptHash(ALICE);

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

interface ChainReadState {
  /** getLoan() reply: undefined => no loan. */
  loan?: { collateral: string; borrowed: string; ltvBps: string; active: boolean };
  /** pool() base-unit GAS. */
  pool?: string;
  /** neoPrice() base-unit GAS per NEO (0 = unset). */
  neoPrice?: string;
  /** balanceOf() whole NEO. */
  neoBalance?: string;
  /** collateralCreditOf() whole NEO residual credit. */
  collateralCredit?: string;
}

/**
 * Minimal ChainService stand-in. Reads return the configured fixtures; writes
 * resolve successfully so the success path can be exercised end-to-end.
 */
function makeChain(s: ChainReadState) {
  const invoke = vi.fn(
    async (
      _op: string,
      _args: ContractArg[],
      _options?: { waitForEvent?: string; scriptHash?: string },
    ): Promise<TxResult> => ({ txid: "0xtx", success: true }),
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    switch (op) {
      case "ltvTierBps":
        return "2000";
      case "feeBps":
        return "50";
      case "neoPrice":
        return s.neoPrice ?? "0";
      case "pool":
        return s.pool ?? "0";
      case "balanceOf":
        return s.neoBalance ?? "100";
      case "collateralCreditOf":
        return s.collateralCredit ?? "0";
      case "repayCreditOf":
        return "0";
      case "getLoan":
        return s.loan ?? { collateral: "0", borrowed: "0", ltvBps: "0", active: false };
      case "totalLoans":
        return "0";
      case "totalBorrowed":
        return "0";
      case "totalRepaid":
        return "0";
      default:
        return "0";
    }
  });

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read,
  } as unknown as ChainService;
  return { chain, invoke, read };
}

describe("useSelfLoan — borrow gating + pool preflight", () => {
  it("loads pool() liquidity and the NEO price for the borrow card", async () => {
    // neoPrice 3 GAS/NEO (3e8), pool 50 GAS (50e8).
    const { chain } = makeChain({ neoPrice: "300000000", pool: "5000000000" });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();

    expect(app.neoPrice.get()).toBe(3);
    expect(app.poolGas.get()).toBe(50);
    // Display strings carry the GAS unit, never an empty/`0`-only placeholder.
    expect(app.neoPriceDisplay.get()).toContain("3");
    expect(app.poolDisplay.get()).toContain("50");
  });

  it("blocks Borrow up front when a loan is already active (no NEO transfer)", async () => {
    const { chain, invoke } = makeChain({
      loan: { collateral: "10", borrowed: "600000000", ltvBps: "2000", active: true },
      neoPrice: "300000000",
      pool: "5000000000",
    });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();
    invoke.mockClear();

    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow("loanAlreadyActiveHint");
    // The predictable revert must NOT route the user's NEO into the contract.
    expect(invoke.mock.calls.find((c) => c[0] === "transfer")).toBeUndefined();
    expect(app.hasActiveLoan.get()).toBe(true);
  });

  it("blocks Borrow before the deposit when the pool can't cover the disbursement", async () => {
    // price 3 GAS/NEO, 20% LTV, 0.5% fee. 5 NEO -> gross 3 GAS, net ~2.985 GAS.
    // Pool only 1 GAS (1e8) -> must be blocked.
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "100000000", neoBalance: "100" });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();
    invoke.mockClear();

    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow("insufficientPool");
    expect(invoke.mock.calls.find((c) => c[0] === "transfer")).toBeUndefined();
  });

  it("bumps borrowOkNonce only on a successful borrow", async () => {
    const { chain } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();

    expect(app.borrowOkNonce.get()).toBe(0);
    app.collateralAmount.set("5");
    await app.takeLoan();
    expect(app.borrowOkNonce.get()).toBe(1);
  });

  it("does not bump borrowOkNonce when the borrow fails", async () => {
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    // Make the borrow() leg revert; the deposit transfer succeeds.
    invoke.mockImplementation(async (op: string): Promise<TxResult> => {
      if (op === "borrow") throw new Error("on-chain revert");
      return { txid: "0xtx", success: true };
    });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();

    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow();
    expect(app.borrowOkNonce.get()).toBe(0);
  });

  it("derives the transfer to the configured contract with the collateral memo", async () => {
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    const app = useSelfLoan({ chain, t });
    app.setAddress(ALICE);
    await app.loadAll();
    invoke.mockClear();

    app.collateralAmount.set("5");
    await app.takeLoan();
    const transfer = invoke.mock.calls.find((c) => c[0] === "transfer");
    expect(transfer).toBeTruthy();
    expect(transfer![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "5" }, // WHOLE NEO — never x1e8
      { type: "String", value: "selfloan:collateral" },
    ]);
  });
});
