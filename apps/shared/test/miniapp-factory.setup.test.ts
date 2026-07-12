import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../../../framework";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const ADMIN = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const TXID = `0x${"42".repeat(32)}`;

const chainReads = vi.hoisted(() => ({
  fetchTemplateArtifactPresence: vi.fn(),
  estimateFactoryFeeGas: vi.fn(),
  inspectFactoryRecord: vi.fn(),
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
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function buildCtx(network = "testnet") {
  const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const address = observable<string | null>(ADMIN);
  const chain = {
    address,
    ensureWallet: vi.fn(async () => ADMIN),
    detectNetwork: vi.fn(async () => network),
    invoke: vi.fn(async () => ({ txid: TXID })),
    signMessage: vi.fn(async () => ({ data: "developer-signature", pubkey: "02abcd" })),
  };
  const ctx = {
    services: { chain, notify: { success: vi.fn(), error: vi.fn() } },
    os: {},
    state: {},
    t: (key: string) => key,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    launchContext: parseMiniAppLaunchContext(
      `https://neomini.app/miniapps/miniapp-factory/index.html?network=testnet&owner=${ADMIN}`,
      "miniapp-miniapp-factory",
    ),
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      registered.set(key, handler);
    },
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, { appId: "miniapp-miniapp-factory" }),
  });
  return { ctx, registered, chain };
}

function readState<T>(
  result: { state?: Record<string, TestObservable> },
  key: string,
): T {
  return result.state?.[key]?.get() as T;
}

const DRAFT = {
  appId: "miniapp-sunlit-rewards",
  appName: "Sunlit Rewards",
  templateKind: "reward-vault",
  admin: ADMIN,
  network: "neo-n3-testnet",
  needsOracle: false,
  needsOneGate: true,
};

beforeEach(() => {
  localStorage.clear();
  chainReads.fetchTemplateArtifactPresence.mockReset().mockResolvedValue("missing");
  chainReads.estimateFactoryFeeGas.mockReset().mockResolvedValue("0.007");
  chainReads.inspectFactoryRecord.mockReset().mockResolvedValue({ status: "not-found" });
  chainReads.fetchFactoryDeployments.mockReset().mockResolvedValue({ total: 0, items: [] });
  vi.stubEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

async function createSetup() {
  const { createMiniAppFactorySetup } = await import("../../miniapp-factory/src/setup");
  return createMiniAppFactorySetup("miniapp-miniapp-factory");
}

describe("MiniApp Studio app-owned setup", () => {
  it("keeps registration closed when the template read is unknown", async () => {
    chainReads.fetchTemplateArtifactPresence.mockResolvedValue("unknown");
    const setup = await createSetup();
    const { ctx, registered, chain } = buildCtx();
    const result = setup(ctx as never) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DRAFT);
    expect(readState<{ execution: { available: boolean; blockedReasonKey: string } }>(result, "currentPlan").execution)
      .toMatchObject({ available: false, blockedReasonKey: "artifactUnverified" });

    await registered.get("executePlan")?.();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("artifactUnverified");
    result.cleanup?.();
  });

  it("re-checks the template immediately before wallet registration", async () => {
    chainReads.fetchTemplateArtifactPresence
      .mockResolvedValueOnce("missing")
      .mockResolvedValueOnce("unknown");
    const setup = await createSetup();
    const { ctx, registered, chain } = buildCtx();
    const result = setup(ctx as never) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DRAFT);
    await registered.get("executePlan")?.();

    expect(chainReads.fetchTemplateArtifactPresence).toHaveBeenCalledTimes(2);
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("templateVerificationRequired");
    expect(readState(result, "registrationState")).toBe("idle");
    expect(readState(result, "registrationSnapshot")).toBeNull();
    result.cleanup?.();
  });

  it("registers one testnet record, reads it back and blocks duplicate submission", async () => {
    const setup = await createSetup();
    const { ctx, registered, chain } = buildCtx();
    const result = setup(ctx as never) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DRAFT);
    const plan = readState<{
      digest: string;
      packageId: string;
      templateId: string;
    }>(result, "currentPlan");
    chainReads.inspectFactoryRecord.mockResolvedValue({
      status: "found",
      record: {
        packageId: plan.packageId,
        templateId: plan.templateId,
        digest: plan.digest,
        creator: ADMIN,
        deployedHash: "",
        createdAt: 1_789_000_000_000,
      },
    });

    await registered.get("executePlan")?.();

    expect(chain.detectNetwork).toHaveBeenCalledTimes(1);
    expect(chain.invoke).toHaveBeenCalledTimes(1);
    expect(chain.invoke).toHaveBeenCalledWith(
      "createMiniAppFromTemplate",
      expect.any(Array),
      expect.objectContaining({ scriptHash: FACTORY_HASH, waitForEvent: "MiniAppCreated" }),
    );
    expect(readState(result, "registrationState")).toBe("confirmed");
    expect(readState(result, "lastTxid")).toBe(TXID);
    expect(readState(result, "executedDigest")).toBe(plan.digest);
    expect(readState<{ txid: string }>(result, "registrationSnapshot").txid).toBe(TXID);

    await registered.get("executePlan")?.();
    expect(chain.invoke).toHaveBeenCalledTimes(1);
    expect(readState(result, "lastError")).toBe("alreadyExecuted");
    result.cleanup?.();
  });

  it("does not invoke when the wallet is on mainnet and clears the empty intent", async () => {
    const setup = await createSetup();
    const { ctx, registered, chain } = buildCtx("mainnet");
    const result = setup(ctx as never) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DRAFT);
    await registered.get("executePlan")?.();

    expect(chain.invoke).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("testnetRequired");
    expect(readState(result, "registrationState")).toBe("idle");
    expect(readState(result, "registrationSnapshot")).toBeNull();
    result.cleanup?.();
  });

  it("restores a submitted transaction as pending when readback is not yet found", async () => {
    const setup = await createSetup();
    const first = buildCtx();
    const firstResult = setup(first.ctx as never) as {
      state?: Record<string, TestObservable>;
      loadData?: () => Promise<void>;
      cleanup?: () => void;
    };
    await first.registered.get("generatePlan")?.(DRAFT);
    await first.registered.get("executePlan")?.();
    expect(readState(firstResult, "registrationState")).toBe("submitted");
    firstResult.cleanup?.();

    const refreshed = buildCtx();
    const refreshedResult = setup(refreshed.ctx as never) as {
      state?: Record<string, TestObservable>;
      loadData?: () => Promise<void>;
      cleanup?: () => void;
    };
    await refreshedResult.loadData?.();

    expect(readState(refreshedResult, "registrationState")).toBe("submitted");
    expect(readState<{ txid: string }>(refreshedResult, "registrationSnapshot").txid).toBe(TXID);
    expect(refreshed.chain.invoke).not.toHaveBeenCalled();
    refreshedResult.cleanup?.();
  });
});
