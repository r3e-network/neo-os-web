import { describe, expect, it, vi } from "vitest";

import { useSelfLoan } from "./useSelfLoan";
import { createMiniAppFramework } from "@shared/react";
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
  let collateralCredit = BigInt(s.collateralCredit ?? "0");
  let liveLoan = s.loan
    ? {
      collateral: BigInt(s.loan.collateral),
      borrowed: BigInt(s.loan.borrowed),
      ltvBps: BigInt(s.loan.ltvBps),
      active: s.loan.active,
    }
    : { collateral: 0n, borrowed: 0n, ltvBps: 0n, active: false };
  // Mirror ChainService.invoke: a waitForEvent whose event lands resolves
  // verified=true (a confirmed tx). Tests that need the relayed-but-unconfirmed
  // path override this to return verified=false.
  const invoke = vi.fn(
    async (
      _op: string,
      _args: ContractArg[],
      _options?: { waitForEvent?: string; scriptHash?: string; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      const txid = `0x${_op}`;
      _options?.onTransactionSent?.(txid);
      let state: Array<{ value: string }> = [];
      if (_op === "transfer") {
        const amount = BigInt(String(_args[2]?.value ?? "0"));
        collateralCredit += amount;
        state = [
          { value: ALICE_HASH },
          { value: amount.toString() },
          { value: collateralCredit.toString() },
        ];
      } else if (_op === "borrow") {
        const tier = Number(_args[1]?.value ?? 1);
        const ltvBps = BigInt(tier === 1 ? 2000 : tier === 2 ? 3000 : 4000);
        const gross = collateralCredit * BigInt(s.neoPrice ?? "0") * ltvBps / 10_000n;
        const disbursed = gross - gross * 50n / 10_000n;
        liveLoan = { collateral: collateralCredit, borrowed: gross, ltvBps, active: true };
        collateralCredit = 0n;
        state = [
          { value: ALICE_HASH },
          { value: liveLoan.collateral.toString() },
          { value: gross.toString() },
          { value: disbursed.toString() },
        ];
      }
      return {
        txid,
        success: true,
        verified: true,
        event: { event_name: _options?.waitForEvent, tx_hash: txid, state },
      };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[], options?: { scriptHash?: string }): Promise<unknown> => {
    switch (op) {
      case "ltvTierBps": {
        const tier = Number(args?.[0]?.value ?? 1);
        return tier === 1 ? "2000" : tier === 2 ? "3000" : "4000";
      }
      case "feeBps":
        return "50";
      case "neoPrice":
        return s.neoPrice ?? "0";
      case "pool":
        return s.pool ?? "0";
      case "balanceOf":
        return options?.scriptHash === "0xd2a4cff31913016155e38e474a2c06d08be276cf"
          ? "100000000000"
          : s.neoBalance ?? "100";
      case "collateralCreditOf":
        return collateralCredit.toString();
      case "repayCreditOf":
        return "0";
      case "getLoan":
        return {
          collateral: liveLoan.collateral.toString(),
          borrowed: liveLoan.borrowed.toString(),
          ltvBps: liveLoan.ltvBps.toString(),
          active: liveLoan.active,
        };
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

/** Wrap a mock chain in the MiniApp framework SDK the composable now consumes. */
function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-self-loan" },
  );
}

function makeOperationStorage() {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null) {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown) {
      values.set(key, value);
    },
    delete(key: string) {
      values.delete(key);
    },
  };
}

function useTestSelfLoan(chain: ChainService) {
  return useSelfLoan({ app: makeApp(chain), t, operationStorage: makeOperationStorage() });
}

describe("useSelfLoan — borrow gating + pool preflight", () => {
  it("loads pool() liquidity and the NEO price for the borrow card", async () => {
    // neoPrice 3 GAS/NEO (3e8), pool 50 GAS (50e8).
    const { chain } = makeChain({ neoPrice: "300000000", pool: "5000000000" });
    const app = useTestSelfLoan(chain);
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
    const app = useTestSelfLoan(chain);
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
    const app = useTestSelfLoan(chain);
    app.setAddress(ALICE);
    await app.loadAll();
    invoke.mockClear();

    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow("insufficientPool");
    expect(invoke.mock.calls.find((c) => c[0] === "transfer")).toBeUndefined();
  });

  it("bumps borrowOkNonce only on a successful borrow", async () => {
    const { chain } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    const app = useTestSelfLoan(chain);
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
    const invokeDefault = invoke.getMockImplementation()!;
    invoke.mockImplementation(async (op: string, args: ContractArg[], options): Promise<TxResult> => {
      if (op === "borrow") throw new Error("on-chain revert");
      return invokeDefault(op, args, options);
    });
    const app = useTestSelfLoan(chain);
    app.setAddress(ALICE);
    await app.loadAll();

    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow();
    expect(app.borrowOkNonce.get()).toBe(0);
  });

  it("surfaces pending-confirmation (not success) when the borrow tx is unverified", async () => {
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    // The borrow tx broadcasts (success) but its LoanTaken event was never
    // observed — ChainService reports verified=false. The deposit transfer stays
    // verified=true so only the borrow leg is unconfirmed.
    const invokeDefault = invoke.getMockImplementation()!;
    invoke.mockImplementation(async (op: string, args: ContractArg[], options): Promise<TxResult> => {
      if (op === "borrow") {
        options?.onTransactionSent?.("0xborrow");
        return { txid: "0xborrow", success: true, verified: false };
      }
      return invokeDefault(op, args, options);
    });
    const app = useTestSelfLoan(chain);
    app.setAddress(ALICE);
    await app.loadAll();

    expect(app.hasPendingConfirmation.get()).toBe(false);
    app.collateralAmount.set("5");
    // No throw — the tx was broadcast; it is pending, not failed.
    await app.takeLoan();

    expect(app.hasPendingConfirmation.get()).toBe(true);
    expect(app.pendingConfirmation.get()).toBe("loanPendingConfirmation");
    // A pending (unverified) borrow must NOT be reported as a definitive success.
    expect(app.borrowOkNonce.get()).toBe(0);
    // The form input is preserved (not cleared) so the user keeps their context.
    expect(app.collateralAmount.get()).toBe("5");
  });

  it("blocks a duplicate borrow while the exact prior transaction is still pending", async () => {
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    let unverified = true;
    const invokeDefault = invoke.getMockImplementation()!;
    invoke.mockImplementation(async (op: string, args: ContractArg[], options): Promise<TxResult> => {
      if (op === "borrow" && unverified) {
        options?.onTransactionSent?.("0xborrow");
        return { txid: "0xborrow", success: true, verified: false };
      }
      return invokeDefault(op, args, options);
    });
    const app = useTestSelfLoan(chain);
    app.setAddress(ALICE);
    await app.loadAll();

    app.collateralAmount.set("5");
    await app.takeLoan();
    expect(app.hasPendingConfirmation.get()).toBe(true);

    // A second wallet request must not race the persisted first transaction.
    unverified = false;
    app.collateralAmount.set("5");
    await expect(app.takeLoan()).rejects.toThrow("pendingTransactionBlocksAction");
    expect(app.hasPendingConfirmation.get()).toBe(true);
    expect(app.borrowOkNonce.get()).toBe(0);
  });

  it("derives the transfer to the configured contract with the collateral memo", async () => {
    const { chain, invoke } = makeChain({ neoPrice: "300000000", pool: "10000000000", neoBalance: "100" });
    const app = useTestSelfLoan(chain);
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
