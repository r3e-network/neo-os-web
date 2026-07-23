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

const APP_ID = "registry-tenant-test";
const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACCOUNT = addressToScriptHash(ADDRESS);
const REGISTRY_HASH = `0x${"ab".repeat(20)}`;
const OTHER_HASH = `0x${"12".repeat(20)}`;
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const controlMethods = new Set([
  "_deploy",
  "_initialize",
  "onNEP17Payment",
  "proposeAbstractAccountCore",
  "setAbstractAccountCore",
  "cancelAbstractAccountCore",
  "proposeAppAccountArtifact",
  "setAppAccountArtifact",
  "cancelAppAccountArtifact",
  "proposeUpgradeAppAccount",
  "upgradeAppAccount",
  "cancelUpgradeAppAccount",
  "proposeEngine",
  "registerEngine",
  "proposeRetireEngine",
  "retireEngine",
  "cancelEnginePending",
  "proposeAdmin",
  "executeAdminChange",
  "cancelAdminChange",
  "setGlobalPaused",
  "scheduleUpdate",
  "update",
  "cancelUpdate",
  "registerAppByPlatform",
  "withdrawPlatformFees",
]);

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(REGISTRY_HASH),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (_operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => "1"),
    invoke: vi.fn(async (_operation: string, _args: unknown[], _options?: unknown) => ({ txid: "0xtx", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    registry: { registryHash: REGISTRY_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.registry tenant surface", () => {
  it("fails closed before reads or writes when Registry is not configured", async () => {
    const { app, chain } = makeApp({ registry: undefined });
    expect(app.registry.available).toBe(false);
    await expect(app.registry.creditOf()).rejects.toBeInstanceOf(FrameworkCapabilityError);
    await expect(app.registry.materializeAbstractAccount()).rejects.toBeInstanceOf(FrameworkCapabilityError);
    expect(chain.read).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("builds permissionless registration and GAS-credit calls centrally", async () => {
    const { app, chain } = makeApp();
    await app.registry.prepayGasCredit(100_000_000, undefined, undefined, {
      waitForEvent: "Credited",
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: REGISTRY_HASH },
      { type: "Integer", value: "100000000" },
      { type: "String", value: `${APP_ID}:credit` },
    ], { scriptHash: GAS_HASH, waitForEvent: "Credited" });

    await app.registry.registerApp("platform-game", {
      "platform-game:difficulty": 2,
      "platform-game:enabled": true,
      "platform-game:label": "ranked",
      "platform-game:optional": null,
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("registerApp", [
      { type: "String", value: APP_ID },
      { type: "String", value: "platform-game" },
      { type: "Hash160", value: ACCOUNT },
      {
        type: "Map",
        value: [
          { key: { type: "String", value: "platform-game:difficulty" }, value: { type: "Integer", value: "2" } },
          { key: { type: "String", value: "platform-game:enabled" }, value: { type: "Boolean", value: true } },
          { key: { type: "String", value: "platform-game:label" }, value: { type: "String", value: "ranked" } },
          { key: { type: "String", value: "platform-game:optional" }, value: { type: "Any", value: null } },
        ],
      },
    ], { scriptHash: REGISTRY_HASH });
  });

  it("covers every non-control-plane PlatformRegistry ABI method", async () => {
    const { app, chain } = makeApp();

    await app.registry.abstractAccountCore();
    await app.registry.pendingAbstractAccountCore();
    await app.registry.abstractAccountCoreAvailableAt();
    await app.registry.materializeAbstractAccount();
    await app.registry.getAbstractAccount();
    await app.registry.appIdOfAbstractAccount(OTHER_HASH, REGISTRY_HASH);
    await app.registry.mintAccount();
    await app.registry.setShimUpgradeConsent(true);
    await app.registry.predictedAccountHash(ADDRESS);
    await app.registry.withdrawCredit(1);
    await app.registry.creditOf();
    await app.registry.totalCreditLiability();
    await app.registry.accruedFees();
    await app.registry.setDescriptor("platform-game:difficulty", 1);
    await app.registry.getDescriptor("platform-game:difficulty");
    await app.registry.executeSpendThresholdRaise();
    await app.registry.cancelSpendThresholdRaise();
    await app.registry.admin();
    await app.registry.getApp();
    await app.registry.appAccountOf();
    await app.registry.appIdOfAccount(OTHER_HASH);
    await app.registry.engineOf();
    await app.registry.appAdminOf();
    await app.registry.isPaused();
    await app.registry.getGlobalPause();
    await app.registry.artifactVersion();
    await app.registry.artifactChecksum();
    await app.registry.shimUpgradeConsentOf();
    await app.registry.getEngine("platform-game");
    await app.registry.engineIdOfHash(OTHER_HASH);
    await app.registry.proposeAppAdmin(ADDRESS);
    await app.registry.executeAppAdminChange();
    await app.registry.cancelAppAdminChange();
    await app.registry.setAppPaused(true);
    await app.registry.registerApp("", {});
    await app.registry.attachEngine("platform-game");
    await app.registry.proposePayoutAddress(ADDRESS);
    await app.registry.executePayoutAddress();
    await app.registry.cancelPayoutAddress();
    await app.registry.spendToPayout("GAS", 1);
    await app.registry.proposeSpend("NEO", 1);
    await app.registry.executeSpend();
    await app.registry.cancelSpend();
    await app.registry.fundEnginePool(1);
    await app.registry.transitHopInProgress();
    await app.registry.payoutAddressOf();
    await app.registry.spendThresholdOf();
    await app.registry.spentInWindow();

    const operations = [
      ...chain.read.mock.calls.map((call) => call[0]),
      ...chain.invoke.mock.calls.map((call) => call[0]),
    ].sort();
    const manifest = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), "../contracts/build/PlatformRegistry.manifest.json"),
      "utf8",
    ));
    const tenantAbi = manifest.abi.methods
      .map((method: { name: string }) => method.name)
      .filter((name: string) => !controlMethods.has(name))
      .sort();
    expect(operations).toEqual(tenantAbi);
  });

  it("runs guest then invoke:platform-registry guards before wallet access or broadcast", async () => {
    const guest = makeApp({}, { appId: APP_ID, permissions: {} });
    guest.chain.address.set(null);
    guest.app.mode.set("guest");
    await expect(guest.app.registry.prepayGasCredit(1)).rejects.toThrow(/guest-mode/);
    expect(guest.chain.ensureWallet).not.toHaveBeenCalled();
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: { "invoke:primary": true } });
    await expect(denied.app.registry.materializeAbstractAccount()).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:platform-registry",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();

    const allowed = makeApp({}, { appId: APP_ID, permissions: { "invoke:platform-registry": true } });
    await expect(allowed.app.registry.materializeAbstractAccount()).resolves.toMatchObject({ txid: "0xtx" });
  });

  it("rejects invalid tenant values before broadcasting", async () => {
    const { app, chain } = makeApp();
    await expect(app.registry.withdrawCredit(0)).rejects.toThrow(/positive integer/);
    await expect(app.registry.attachEngine(" ")).rejects.toThrow(/engineId is required/);
    await expect(app.registry.setDescriptor("", 1)).rejects.toThrow(/descriptor key is required/);
    await expect(app.registry.proposeSpend("bad", 1)).rejects.toThrow(/valid Neo N3/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});
