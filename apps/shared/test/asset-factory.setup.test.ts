import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../../../framework";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const OTHER_WALLET = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

const chainReads = vi.hoisted(() => ({
  fetchTemplateArtifactPresence: vi.fn(),
  estimateFactoryFeeGas: vi.fn(),
  inspectFactoryRecord: vi.fn(),
  readFactoryRecord: vi.fn(),
  fetchFactoryDeployments: vi.fn(),
}));

vi.mock("../factory/factoryChain", () => chainReads);

interface TestObservable<T = unknown> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: (value: T) => void) => () => void;
}

function observable<T>(initial: T): TestObservable<T> {
  let value = initial;
  const listeners = new Set<(next: T) => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe: (listener: (next: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function buildCtx(initialWallet: string | null = OWNER) {
  const registered = new Map<
    string,
    (...args: unknown[]) => Promise<unknown>
  >();
  const address = observable<string | null>(initialWallet);
  const chain = {
    address,
    ensureWallet: vi.fn(async () => address.get() || OWNER),
    invoke: vi.fn(async () => ({ txid: "0xmust-not-broadcast" })),
    signMessage: vi.fn(async () => ({
      publicKey: "02abcd",
      data: "issuer-signature",
    })),
  };
  const setStatus = vi.fn();
  const ctx = {
    services: { chain, notify: { success: vi.fn(), error: vi.fn() } },
    os: {},
    state: {},
    t: (key: string) => key,
    setStatus,
    clearStatus: vi.fn(),
    launchContext: parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/asset-factory/index.html?network=testnet",
      "miniapp-asset-factory",
    ),
    registerAction: (
      key: string,
      handler: (...args: unknown[]) => Promise<unknown>,
    ) => registered.set(key, handler),
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, {
      appId: "miniapp-asset-factory",
    }),
  });
  return { ctx, registered, chain, setStatus };
}

function readState<T>(
  result: { state?: Record<string, TestObservable> },
  key: string,
): T {
  return result.state?.[key]?.get() as T;
}

const DRAFT = {
  name: "Neo Credits",
  symbol: "NEOC",
  decimals: "8",
  initialSupply: "1000000",
  owner: OWNER,
  treasury: OWNER,
  mintable: true,
  network: "neo-n3-testnet",
};

beforeEach(() => {
  localStorage.clear();
  chainReads.fetchTemplateArtifactPresence
    .mockReset()
    .mockResolvedValue("present");
  chainReads.estimateFactoryFeeGas.mockReset().mockResolvedValue("12.5");
  chainReads.inspectFactoryRecord.mockReset().mockResolvedValue({
    status: "not-found",
  });
  chainReads.readFactoryRecord.mockReset().mockResolvedValue(null);
  chainReads.fetchFactoryDeployments.mockReset().mockResolvedValue({
    total: 0,
    items: [],
  });
  vi.stubEnv("VITE_NEO_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_ASSET_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe("Asset Factory app-owned setup", () => {
  it("keeps every Factory write closed even when a template appears present", async () => {
    const { createAssetFactorySetup } =
      await import("../../asset-factory/src/setup");
    const { ctx, registered, chain } = buildCtx();
    const result = createAssetFactorySetup("miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    await registered.get("persistAssetDraft")?.(DRAFT);
    await registered.get("generatePlan")?.(DRAFT);

    expect(
      readState<{ execution: { available: boolean } }>(result, "currentPlan")
        .execution.available,
    ).toBe(false);
    expect(readState(result, "feeEstimateGas")).toBe("");

    await registered.get("executePlan")?.();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe(
      "deploymentCertificationPending",
    );
    result.cleanup?.();
  });

  it("restores the exact draft, lock, and owner signature after refresh", async () => {
    const { createAssetFactorySetup } =
      await import("../../asset-factory/src/setup");
    const first = buildCtx();
    const firstResult = createAssetFactorySetup("miniapp-asset-factory")(
      first.ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    await first.registered.get("persistAssetDraft")?.(DRAFT);
    await first.registered.get("generatePlan")?.(DRAFT);
    await first.registered.get("signCurrentPlan")?.();
    const digest = readState<{ digest: string }>(
      firstResult,
      "currentPlan",
    ).digest;
    expect(readState(firstResult, "journalReady")).toBe(true);
    firstResult.cleanup?.();

    const refreshed = buildCtx();
    const refreshedResult = createAssetFactorySetup("miniapp-asset-factory")(
      refreshed.ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    expect(readState(refreshedResult, "restoredDraft")).toEqual(DRAFT);
    expect(
      readState<{ digest: string }>(refreshedResult, "currentPlan").digest,
    ).toBe(digest);
    expect(readState(refreshedResult, "walletSignature")).toBe(
      "issuer-signature",
    );
    expect(readState(refreshedResult, "journalRestored")).toBe(true);
    refreshedResult.cleanup?.();
  });

  it("does not restore an issuer signature into a different connected wallet", async () => {
    const { createAssetFactorySetup } =
      await import("../../asset-factory/src/setup");
    const first = buildCtx();
    const firstResult = createAssetFactorySetup("miniapp-asset-factory")(
      first.ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    await first.registered.get("persistAssetDraft")?.(DRAFT);
    await first.registered.get("generatePlan")?.(DRAFT);
    await first.registered.get("signCurrentPlan")?.();
    firstResult.cleanup?.();

    const refreshed = buildCtx(OTHER_WALLET);
    const refreshedResult = createAssetFactorySetup("miniapp-asset-factory")(
      refreshed.ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    expect(readState(refreshedResult, "walletSignature")).toBe("");
    expect(readState(refreshedResult, "walletSignatureInfo")).toBeNull();
    refreshedResult.cleanup?.();
  });

  it("distinguishes an unavailable RPC read from an authoritative missing record", async () => {
    chainReads.inspectFactoryRecord.mockResolvedValueOnce({
      status: "unavailable",
      error: "temporary RPC failure",
    });
    const { createAssetFactorySetup } =
      await import("../../asset-factory/src/setup");
    const { ctx, registered, setStatus } = buildCtx();
    const result = createAssetFactorySetup("miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable>; cleanup?: () => void };

    await registered.get("persistAssetDraft")?.(DRAFT);
    await registered.get("generatePlan")?.(DRAFT);
    await registered.get("recoverCurrentPlan")?.();

    expect(readState(result, "recoveryState")).toBe("unavailable");
    expect(readState(result, "recoveredDeployment")).toBeNull();
    expect(setStatus).toHaveBeenCalledWith("recovery_unavailable", "warning");
    result.cleanup?.();
  });
});
