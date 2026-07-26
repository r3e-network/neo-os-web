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
const ACCOUNT = accountToHash160(ADDRESS);
const VESTING_HASH = `0x${"ab".repeat(20)}`;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const APP_ID = "vesting-surface-test";

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
    platformVesting: { vestingHash: VESTING_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.platformVesting", () => {
  it("fails closed without a valid engine config", async () => {
    const missing = makeApp({ platformVesting: undefined });
    expect(missing.app.platformVesting.available).toBe(false);
    expect(missing.app.platformVesting.configuredHash).toBeNull();
    await expect(missing.app.platformVesting.totalStreams()).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformVesting",
    );
    expect(missing.chain.read).not.toHaveBeenCalled();
  });

  it("targets the injected engine and native token contracts", async () => {
    const { app, chain } = makeApp();
    expect(app.platformVesting.configuredHash).toBe(VESTING_HASH);
    await app.platformVesting.prepayGas(100);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: VESTING_HASH },
      { type: "Integer", value: "100" },
      { type: "String", value: `${APP_ID}:fund` },
    ], { scriptHash: GAS_HASH });

    await app.platformVesting.prepayNeo(3);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", expect.any(Array), { scriptHash: NEO_HASH });

    await app.platformVesting.createStream({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 50,
      rateAmount: 10,
      intervalSeconds: 60,
      title: "Salary",
      notes: "Monthly",
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("createStream", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "50" },
      { type: "Integer", value: "10" },
      { type: "Integer", value: "60" },
      { type: "String", value: "Salary" },
      { type: "String", value: "Monthly" },
    ], { scriptHash: VESTING_HASH });
  });

  it("can atomically fund and create a stream", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformVesting.createStream({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 50,
      rateAmount: 10,
      intervalSeconds: 60,
      fundAmount: 100,
    })).resolves.toMatchObject({ txid: "0xbatch", success: true });

    expect(chain.invokeMultiple).toHaveBeenCalledWith([
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: ACCOUNT },
          { type: "Hash160", value: VESTING_HASH },
          { type: "Integer", value: "100" },
          { type: "String", value: `${APP_ID}:fund` },
        ],
      },
      expect.objectContaining({ scriptHash: VESTING_HASH, operation: "createStream" }),
    ], {});
  });

  it("threads appId through reads and guards every write", async () => {
    const { app, chain } = makeApp();
    await app.platformVesting.creditOf("GAS");
    await app.platformVesting.creditLiability("NEO");
    await app.platformVesting.streamLiability("GAS");
    await app.platformVesting.totalCreditLiability("NEO");
    await app.platformVesting.totalStreams();
    await app.platformVesting.claimableOf(2);
    await app.platformVesting.getStreamDetails(2);
    await app.platformVesting.getUserStreams();
    await app.platformVesting.getBeneficiaryStreams();
    expect(chain.read.mock.calls.map((call) => call[0])).toEqual([
      "creditOf", "creditLiabilityOf", "streamLiabilityOf", "totalCreditLiability",
      "totalStreams", "claimableOf", "getStreamDetails", "getUserStreams", "getBeneficiaryStreams",
    ]);
    expect(chain.read.mock.calls[0]?.[1]).toEqual([
      { type: "String", value: APP_ID },
      { type: "Hash160", value: GAS_HASH },
      { type: "Hash160", value: ACCOUNT },
    ]);

    const guest = makeApp();
    guest.app.mode.set("guest");
    await expect(guest.app.platformVesting.prepayGas(1)).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: { "invoke:platform-game": true } });
    await expect(denied.app.platformVesting.prepayGas(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:platform-vesting",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid stream inputs before broadcasting", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformVesting.createStream({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 0,
      rateAmount: 1,
      intervalSeconds: 1,
    })).rejects.toThrow(/positive integer/);
    await expect(app.platformVesting.createStream({
      beneficiary: ADDRESS,
      asset: "GAS",
      totalAmount: 2,
      rateAmount: 1,
      intervalSeconds: 1,
      fundAmount: 1,
    })).rejects.toThrow(/cover totalAmount/);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeMultiple).not.toHaveBeenCalled();
  });
});
