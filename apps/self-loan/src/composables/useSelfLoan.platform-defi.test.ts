import { describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { useSelfLoan } from "./useSelfLoan";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ALICE_HASH = addressToScriptHash(ALICE);
const APP_ID = "miniapp-self-loan";
const DEFI_HASH = `0x${"ab".repeat(20)}`;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_PRICE = 300_000_000n;

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

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

function makeSharedHarness(profile = 1n) {
  let neoCredit = 0n;
  let gasCredit = 0n;
  let loanId = 0n;
  let collateral = 0n;
  let borrowed = 0n;
  let ltvBps = 0n;
  let active = false;
  let batchEvent: unknown = null;

  const read = vi.fn(async (
    operation: string,
    _args?: ContractArg[],
    options?: { scriptHash?: string },
  ): Promise<unknown> => {
    switch (operation) {
      case "balanceOf":
        return options?.scriptHash === GAS_HASH ? "100000000000" : "100";
      case "getLendingProfile":
        return profile.toString();
      case "getLendingStats":
        return {
          totalLoans: loanId > 0n ? "1" : "0",
          totalDebt: borrowed.toString(),
          totalRepaid: "0",
          ltvTier1Bps: "2000",
          ltvTier2Bps: "3000",
          ltvTier3Bps: "4000",
          lendingFeeBps: "50",
          lendingProfile: profile.toString(),
        };
      case "getNeoGasPrice":
        return NEO_PRICE.toString();
      case "getLendingLiquidity":
        return "10000000000";
      case "getSingleLoanPosition":
        return {
          loanId: loanId.toString(),
          borrower: ALICE_HASH,
          collateral: collateral.toString(),
          borrowed: borrowed.toString(),
          ltvBps: ltvBps.toString(),
          active,
        };
      case "getDirectNeoCredit":
        return neoCredit.toString();
      case "getDirectGasCredit":
        return gasCredit.toString();
      default:
        return "0";
    }
  });

  const invoke = vi.fn(async (
    operation: string,
    args: ContractArg[],
    options?: {
      waitForEvent?: string;
      scriptHash?: string;
      onTransactionSent?: (txid: string) => void;
    },
  ): Promise<TxResult> => {
    const txid = `0x${operation}`;
    options?.onTransactionSent?.(txid);
    if (operation === "transfer") {
      const amount = BigInt(String(args[2]?.value ?? "0"));
      neoCredit += amount;
      return {
        txid,
        success: true,
        verified: true,
        event: {
          event_name: "CreditDeposited",
          tx_hash: txid,
          state: [
            { value: APP_ID },
            { value: ALICE_HASH },
            { value: NEO_HASH },
            { value: amount.toString() },
          ],
        },
      };
    }
    if (operation === "createLoan") {
      const tier = Number(args[2]?.value ?? 1);
      collateral = BigInt(String(args[3]?.value ?? "0"));
      ltvBps = BigInt(tier === 1 ? 2000 : tier === 2 ? 3000 : 4000);
      borrowed = collateral * NEO_PRICE * ltvBps / 10_000n;
      const disbursed = borrowed - borrowed * 50n / 10_000n;
      neoCredit = 0n;
      loanId = 1n;
      active = true;
      return {
        txid,
        success: true,
        verified: true,
        event: {
          event_name: "LoanCreated",
          tx_hash: txid,
          state: [
            { value: APP_ID },
            { value: loanId.toString() },
            { value: ALICE_HASH },
            { value: collateral.toString() },
            { value: disbursed.toString() },
          ],
        },
      };
    }
    throw new Error(`Unexpected invoke: ${operation}`);
  });

  const invokeMultiple = vi.fn(async (
    calls: Array<{ operation: string; args: ContractArg[] }>,
    options?: { onTransactionSent?: (txid: string) => void },
  ) => {
    const txid = "0xbatch";
    options?.onTransactionSent?.(txid);
    const transfer = calls.find((call) => call.operation === "transfer");
    if (transfer) gasCredit += BigInt(String(transfer.args[2]?.value ?? "0"));
    const repay = calls.find((call) => call.operation === "repayLoan");
    if (!repay) throw new Error("Missing repayLoan call");
    const repaid = gasCredit > borrowed ? borrowed : gasCredit;
    gasCredit -= repaid;
    borrowed -= repaid;
    batchEvent = {
      event_name: "LoanRepaid",
      tx_hash: txid,
      state: [
        { value: APP_ID },
        { value: loanId.toString() },
        { value: repaid.toString() },
        { value: borrowed.toString() },
      ],
    };
    if (borrowed === 0n) {
      loanId = 0n;
      collateral = 0n;
      ltvBps = 0n;
      active = false;
    }
    return { txid, state: "HALT" };
  });
  const chain = {
    contractAddress: { get: () => DEFI_HASH },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read,
    invoke,
    invokeMultiple,
    waitForEvent: vi.fn(async () => batchEvent),
  } as unknown as ChainService;
  const app = createMiniAppFramework(
    {
      services: { chain },
      t,
      launchContext: { appId: APP_ID, network: "neo-n3-testnet" },
    } as never,
    { appId: APP_ID, platformDeFi: { defiHash: DEFI_HASH } },
  );
  const attestPlatformContract = vi.fn(async () => ({
    compatible: true as const,
    network: "testnet" as const,
    contract: DEFI_HASH,
    checksum: 1_040_116_875,
    updateCounter: 0,
    reason: "ok" as const,
  }));
  const selfLoan = useSelfLoan({
    app,
    t,
    operationStorage: makeOperationStorage(),
    attestPlatformContract,
  });
  selfLoan.setAddress(ALICE);
  return { selfLoan, read, invoke, invokeMultiple, attestPlatformContract };
}

describe("useSelfLoan — PlatformDeFi tenant mode", () => {
  it("attests the SelfLoan profile and borrows through tenant-scoped calls", async () => {
    const { selfLoan, invoke, attestPlatformContract } = makeSharedHarness();

    await selfLoan.loadAll();

    expect(selfLoan.platformMode).toBe(true);
    expect(selfLoan.runtimeStatus.get()).toBe("ready");
    expect(selfLoan.runtimeCompatible.get()).toBe(true);
    expect(selfLoan.neoPrice.get()).toBe(3);
    expect(selfLoan.poolGas.get()).toBe(100);
    expect(attestPlatformContract).toHaveBeenCalledWith("testnet", DEFI_HASH);

    selfLoan.collateralAmount.set("5");
    await expect(selfLoan.takeLoan()).resolves.toBe("confirmed");

    expect(invoke).toHaveBeenCalledWith("transfer", [
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: DEFI_HASH },
      { type: "Integer", value: "5" },
      { type: "String", value: `${APP_ID}:credit` },
    ], expect.objectContaining({
      scriptHash: NEO_HASH,
      waitForEvent: "CreditDeposited",
    }));
    expect(invoke).toHaveBeenCalledWith("createLoan", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "1" },
      { type: "Integer", value: "5" },
    ], expect.objectContaining({
      scriptHash: DEFI_HASH,
      waitForEvent: "LoanCreated",
    }));
    expect(selfLoan.borrowOkNonce.get()).toBe(1);
    expect(selfLoan.hasActiveLoan.get()).toBe(true);
    expect(selfLoan.activeLoanId.get()).toBe(1n);
  });

  it("fails closed before any write when the tenant is not a SelfLoan profile", async () => {
    const { selfLoan, invoke } = makeSharedHarness(0n);

    await selfLoan.loadAll();

    expect(selfLoan.runtimeStatus.get()).toBe("error");
    expect(selfLoan.runtimeCompatible.get()).toBe(false);
    selfLoan.collateralAmount.set("5");
    await expect(selfLoan.takeLoan()).rejects.toThrow("criticalDataUnavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("repays atomically and clears the tenant active-loan pointer", async () => {
    const { selfLoan, invokeMultiple } = makeSharedHarness();
    await selfLoan.loadAll();
    selfLoan.collateralAmount.set("5");
    await selfLoan.takeLoan();

    await expect(selfLoan.repay("3")).resolves.toBe("confirmed");

    expect(invokeMultiple).toHaveBeenCalledWith([
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: ALICE_HASH },
          { type: "Hash160", value: DEFI_HASH },
          { type: "Integer", value: "300000000" },
          { type: "String", value: `${APP_ID}:credit` },
        ],
      },
      {
        scriptHash: DEFI_HASH,
        operation: "repayLoan",
        args: [
          { type: "String", value: APP_ID },
          { type: "Integer", value: "1" },
        ],
      },
    ], expect.objectContaining({ onTransactionSent: expect.any(Function) }));
    expect(selfLoan.repayOkNonce.get()).toBe(1);
    expect(selfLoan.hasActiveLoan.get()).toBe(false);
    expect(selfLoan.activeLoanId.get()).toBe(0n);
  });
});
