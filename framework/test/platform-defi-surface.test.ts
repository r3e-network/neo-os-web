import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACCOUNT = addressToScriptHash(ADDRESS);
const OTHER = `0x${"22".repeat(20)}`;
const DEFI_HASH = `0x${"ab".repeat(20)}`;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const APP_ID = "platform-defi-test";
const controlMethods = new Set([
  "_deploy",
  "_initialize",
  "admin",
  "isPaused",
  "setAdmin",
  "setPaused",
  "update",
  "registerProduct",
  "getProductType",
  "getAppAdmin",
  "setAppPaused",
  "isAppPaused",
  "onNEP17Payment",
  "legacyCreditRecoveryState",
  "legacyCreditSnapshotHash",
  "legacyNeoCreditLiability",
  "legacyGasCreditLiability",
  "legacyNeoCreditRows",
  "legacyGasCreditRows",
  "getLegacyNeoCredit",
  "getLegacyGasCredit",
  "initializeLegacyCreditRecovery",
  "activateLegacyCreditRecovery",
  "withdrawLegacyNeoCredit",
  "withdrawLegacyGasCredit",
]);

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(DEFI_HASH),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (_operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => "1"),
    invoke: vi.fn(async (_operation: string, _args: unknown[], _options?: unknown) => ({ txid: "0xtx", success: true })),
    invokeMultiple: vi.fn(async () => ({ txid: "0xbatch", state: "HALT" })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    platformDeFi: { defiHash: DEFI_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.platformDeFi", () => {
  it("fails closed without a valid config", async () => {
    const missing = makeApp({ platformDeFi: undefined });
    expect(missing.app.platformDeFi.available).toBe(false);
    await expect(missing.app.platformDeFi.getLendingStats()).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformDeFi",
    );
    expect(missing.chain.read).not.toHaveBeenCalled();

    const invalid = makeApp({ platformDeFi: { defiHash: "bad" } });
    await expect(invalid.app.platformDeFi.getCapsuleStats()).rejects.toBeInstanceOf(FrameworkCapabilityError);
    expect(invalid.chain.read).not.toHaveBeenCalled();
  });

  it("auto-threads appId, wallet and native deposit targets", async () => {
    const { app, chain } = makeApp();
    await app.platformDeFi.createLoan({ ltvTier: 2, collateralAmount: 5 });
    expect(chain.invoke).toHaveBeenLastCalledWith("createLoan", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Integer", value: "2" },
      { type: "Integer", value: "5" },
    ], { scriptHash: DEFI_HASH });

    await app.platformDeFi.depositNeo(3);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: DEFI_HASH },
      { type: "Integer", value: "3" },
      { type: "String", value: `${APP_ID}:credit` },
    ], { scriptHash: NEO_HASH });

    await app.platformDeFi.depositGas(100_000_000);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", expect.any(Array), { scriptHash: GAS_HASH });
  });

  it("keeps GAS deposit and repayment in one guarded transaction", async () => {
    const { app, chain } = makeApp();
    const onTransactionSent = vi.fn();

    await expect(app.platformDeFi.repayLoanWithGasDeposit({
      loanId: 7,
      depositAmount: 250,
      options: { onTransactionSent },
    })).resolves.toEqual({ txid: "0xbatch", success: true });

    expect(chain.invokeMultiple).toHaveBeenCalledWith([
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: ACCOUNT },
          { type: "Hash160", value: DEFI_HASH },
          { type: "Integer", value: "250" },
          { type: "String", value: `${APP_ID}:credit` },
        ],
      },
      {
        scriptHash: DEFI_HASH,
        operation: "repayLoan",
        args: [
          { type: "String", value: APP_ID },
          { type: "Integer", value: "7" },
        ],
      },
    ], { onTransactionSent });
  });

  it("covers every tenant-facing PlatformDeFi ABI method", async () => {
    const { app, chain } = makeApp();

    await app.platformDeFi.createCapsule({ lockDays: 30, principalAmount: 2 });
    await app.platformDeFi.unlockCapsule(1);
    await app.platformDeFi.earlyWithdraw(1);
    await app.platformDeFi.compoundYield(1);
    await app.platformDeFi.withdrawCapsulePenalties();
    await app.platformDeFi.getCapsule(1);
    await app.platformDeFi.getCapsuleStats();
    await app.platformDeFi.getCapsuleDetails(1);
    await app.platformDeFi.neoCreditOf();
    await app.platformDeFi.gasCreditOf();
    await app.platformDeFi.neoCreditLiability();
    await app.platformDeFi.gasCreditLiability();
    await app.platformDeFi.totalNeoCreditLiability();
    await app.platformDeFi.totalGasCreditLiability();
    await app.platformDeFi.withdrawNeoCredit(1);
    await app.platformDeFi.withdrawGasCredit(1);
    await app.platformDeFi.withdrawLendingFees();
    await app.platformDeFi.getTotalLendingFees();
    await app.platformDeFi.withdrawCapsuleFees();
    await app.platformDeFi.getTotalCapsuleFees();
    await app.platformDeFi.withdrawFlashLoanFees();
    await app.platformDeFi.getUnclaimedFlashLoanFees();
    await app.platformDeFi.requestFlashLoan({ amount: 1, callbackContract: OTHER, callbackMethod: "onFlashLoan" });
    await app.platformDeFi.flashDeposit(1);
    await app.platformDeFi.flashWithdraw(1);
    await app.platformDeFi.getFlashLoan(1);
    await app.platformDeFi.getFlashLoanStats();
    await app.platformDeFi.getFlashProviderBalance();
    await app.platformDeFi.getFlashTotalLpDeposits();
    await app.platformDeFi.migrateFlashProviderBalance(OTHER, 1);
    await app.platformDeFi.getLendingLiquidity();
    await app.platformDeFi.lendingDeposit(1);
    await app.platformDeFi.withdrawLendingLiquidity(1);
    await app.platformDeFi.getCapsuleYieldReserve();
    await app.platformDeFi.fundCapsuleYieldReserve(1);
    await app.platformDeFi.withdrawCapsuleYieldReserve(1);
    await app.platformDeFi.abandonLoan(1);
    await app.platformDeFi.withdrawAbandonedCollateral();
    await app.platformDeFi.getTotalAbandonedCollateral();
    await app.platformDeFi.setProfitAnchor(OTHER, "miniapp-profitanchor");
    await app.platformDeFi.syncProfitAnchorVote();
    await app.platformDeFi.getProfitAnchorContract();
    await app.platformDeFi.getProfitAnchorAppId();
    await app.platformDeFi.getProfitAnchor();
    await app.platformDeFi.getLendingProfile();
    await app.platformDeFi.getActiveLoanId();
    await app.platformDeFi.getSingleLoanPosition();
    await app.platformDeFi.getLoan(1);
    await app.platformDeFi.getHealthFactor(1);
    await app.platformDeFi.getLendingStats();
    await app.platformDeFi.createLoan({ ltvTier: 1, collateralAmount: 1 });
    await app.platformDeFi.repayLoan(1);
    await app.platformDeFi.addCollateral(1, 1);
    await app.platformDeFi.getNeoGasPrice();
    await app.platformDeFi.setNeoGasPrice(1);
    await app.platformDeFi.getLastPriceDropTime();
    await app.platformDeFi.liquidateLoan(1);
    await app.platformDeFi.isLiquidatable(1);

    const operations = [
      ...chain.read.mock.calls.map((call) => call[0]),
      ...chain.invoke.mock.calls.map((call) => call[0]),
    ].sort();
    const manifest = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), "../contracts/build/PlatformDeFi.manifest.json"),
      "utf8",
    ));
    const tenantAbi = manifest.abi.methods
      .map((method: { name: string }) => method.name)
      .filter((name: string) => !controlMethods.has(name))
      .sort();
    expect(operations).toEqual(tenantAbi);
  });

  it("runs guest then permission guards before every write", async () => {
    const guest = makeApp();
    guest.app.mode.set("guest");
    await expect(guest.app.platformDeFi.repayLoan(1)).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: { "invoke:primary": true } });
    await expect(denied.app.platformDeFi.depositGas(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:platform-defi",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();

    const allowed = makeApp({}, { appId: APP_ID, permissions: { "invoke:platform-defi": true } });
    await expect(allowed.app.platformDeFi.depositGas(1)).resolves.toMatchObject({ txid: "0xtx" });
  });

  it("rejects invalid values before invoking", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformDeFi.repayLoan(0)).rejects.toThrow(/positive integer/);
    await expect(app.platformDeFi.requestFlashLoan({ amount: 1, callbackContract: OTHER, callbackMethod: "" }))
      .rejects.toThrow(/callbackMethod is required/);
    await expect(app.platformDeFi.setProfitAnchor("bad", "anchor")).rejects.toThrow();
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});
