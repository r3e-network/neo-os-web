import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";
import { accountToHash160 } from "../chain-surface";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const SECOND_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const ACCOUNT = accountToHash160(ADDRESS);
const ESCROW_HASH = `0x${"cd".repeat(20)}`;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const APP_ID = "escrow-surface-test";

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (_operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => []),
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
    platformEscrow: { escrowHash: ESCROW_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.platformEscrow", () => {
  it("fails closed without a valid engine config", async () => {
    const missing = makeApp({ platformEscrow: undefined });
    expect(missing.app.platformEscrow.available).toBe(false);
    await expect(missing.app.platformEscrow.totalEscrows()).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformEscrow",
    );
    expect(missing.chain.read).not.toHaveBeenCalled();
  });

  it("targets the injected engine and native token contracts", async () => {
    const { app, chain } = makeApp();
    await app.platformEscrow.prepayGas(100);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: ESCROW_HASH },
      { type: "Integer", value: "100" },
      { type: "String", value: `${APP_ID}:fund` },
    ], { scriptHash: GAS_HASH });

    await app.platformEscrow.prepayNeo(3);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", expect.any(Array), { scriptHash: NEO_HASH });

    await app.platformEscrow.createEscrow({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 50,
      milestoneAmounts: [20, 30],
      title: "Delivery",
      notes: "Two steps",
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("createEscrow", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "50" },
      { type: "Array", value: [
        { type: "Integer", value: "20" },
        { type: "Integer", value: "30" },
      ] },
      { type: "String", value: "Delivery" },
      { type: "String", value: "Two steps" },
    ], { scriptHash: ESCROW_HASH });
  });

  it("can atomically fund and create an escrow", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformEscrow.createEscrow({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 50,
      milestoneAmounts: [50],
      fundAmount: 100,
    })).resolves.toMatchObject({ txid: "0xbatch", success: true });
    expect(chain.invokeMultiple).toHaveBeenCalledWith([
      expect.objectContaining({ scriptHash: GAS_HASH, operation: "transfer" }),
      expect.objectContaining({ scriptHash: ESCROW_HASH, operation: "createEscrow" }),
    ], {});
  });

  it("encodes multi-approver escrow creation without changing the default lane", async () => {
    const { app, chain } = makeApp();
    await app.platformEscrow.createEscrow({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 50,
      milestoneAmounts: [50],
      approvers: [ADDRESS, SECOND_ADDRESS],
      approvalThreshold: 2,
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("createEscrowWithApprovers", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "50" },
      { type: "Array", value: [{ type: "Integer", value: "50" }] },
      { type: "Array", value: [
        { type: "Hash160", value: ACCOUNT },
        { type: "Hash160", value: accountToHash160(SECOND_ADDRESS) },
      ] },
      { type: "Integer", value: "2" },
      { type: "String", value: "" },
      { type: "String", value: "" },
    ], { scriptHash: ESCROW_HASH });
  });

  it("threads appId through reads and guards every escrow write", async () => {
    const { app, chain } = makeApp();
    await app.platformEscrow.creditOf("GAS");
    await app.platformEscrow.creditLiability("NEO");
    await app.platformEscrow.escrowLiability("GAS");
    await app.platformEscrow.totalCreditLiability("NEO");
    await app.platformEscrow.totalEscrowLiability("GAS");
    await app.platformEscrow.totalEscrows();
    await app.platformEscrow.getEscrowDetails(2);
    await app.platformEscrow.getMilestoneDetails(2, 1);
    await app.platformEscrow.getPlatformStats();
    await app.platformEscrow.getCreatorEscrows();
    await app.platformEscrow.getBeneficiaryEscrows();
    expect(chain.read.mock.calls.map((call) => call[0])).toEqual([
      "creditOf", "creditLiabilityOf", "escrowLiabilityOf", "totalCreditLiability",
      "totalEscrowLiability", "totalEscrows", "getEscrowDetails", "getMilestoneDetails",
      "getPlatformStats", "getCreatorEscrows", "getBeneficiaryEscrows",
    ]);

    const guest = makeApp();
    guest.app.mode.set("guest");
    await expect(guest.app.platformEscrow.prepayGas(1)).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: { "invoke:platform-game": true } });
    await expect(denied.app.platformEscrow.prepayGas(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:platform-escrow",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid milestone totals and negative paging before broadcast", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformEscrow.createEscrow({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 3,
      milestoneAmounts: [1, 1],
    })).rejects.toThrow(/sum to totalAmount/);
    await expect(app.platformEscrow.getCreatorEscrows(ADDRESS, -1)).rejects.toThrow(/non-negative/);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeMultiple).not.toHaveBeenCalled();
  });
});
