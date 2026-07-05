import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../../../framework";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";

const harness = vi.hoisted(() => ({
  presence: "present" as string,
  estimate: "0.007",
  record: {
    packageId: "",
    templateId: "tpl.nep17.asset.v1",
    digest: "0xdeadbeef",
    creator: "0x" + "11".repeat(20),
    deployedHash: "0x" + "22".repeat(20),
    createdAt: 1765500000000,
  },
  fetchTemplateArtifactPresence: vi.fn(),
  estimateFactoryFeeGas: vi.fn(),
  readFactoryRecord: vi.fn(),
  fetchFactoryDeployments: vi.fn(),
}));

vi.mock("../factory/factoryChain", () => ({
  fetchTemplateArtifactPresence: harness.fetchTemplateArtifactPresence,
  estimateFactoryFeeGas: harness.estimateFactoryFeeGas,
  readFactoryRecord: harness.readFactoryRecord,
  fetchFactoryDeployments: harness.fetchFactoryDeployments,
}));

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

interface TestCtx {
  ctx: Record<string, unknown>;
  actions: Map<string, (...args: unknown[]) => Promise<unknown>>;
  chain: {
    address: TestObservable<string | null>;
    invoke: ReturnType<typeof vi.fn>;
    signMessage: ReturnType<typeof vi.fn>;
  };
  setStatus: ReturnType<typeof vi.fn>;
}

function buildCtx(appId: string): TestCtx {
  const actions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const chain = {
    address: observable<string | null>(null),
    invoke: vi.fn(async () => ({ txid: "0xtx-1", event: { name: "ok" }, success: true })),
    signMessage: vi.fn(async () => ({ publicKey: "02abcd", data: "signature-bytes" })),
  };
  const setStatus = vi.fn();
  const notify = {
    success: vi.fn((key: string) => setStatus(key, "success")),
    error: vi.fn((error: unknown, fallbackKey = "error") => {
      setStatus(error instanceof Error ? error.message : fallbackKey, "error");
    }),
    guardResult: vi.fn(async (fn: () => Promise<unknown>, successKey?: string, errorKey?: string) => {
      try {
        const value = await fn();
        if (successKey) notify.success(successKey);
        return { ok: true as const, value };
      } catch (error) {
        notify.error(error, errorKey);
        return { ok: false as const, error };
      }
    }),
  };
  const ctx = {
    services: { chain, notify },
    os: {},
    state: {},
    t: (key: string) => key,
    setStatus,
    clearStatus: vi.fn(),
    launchContext: parseMiniAppLaunchContext(
      `https://neomini.app/miniapps/${appId.replace(/^miniapp-/, "")}/index.html?network=testnet`,
      appId,
    ),
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      actions.set(key, handler);
    },
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, { appId }),
  });
  return { ctx, actions, chain, setStatus };
}

async function loadRuntime() {
  vi.stubEnv("VITE_NEO_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_ASSET_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
  return import("../factory/runtime");
}

const NEP17_FORM = {
  name: "Yiwu Credits",
  symbol: "YIWU",
  decimals: "8",
  initialSupply: "1000000",
  owner: OWNER,
  treasury: OWNER,
  mintable: true,
  network: "testnet",
};

function readState(result: { state?: Record<string, TestObservable> }, key: string): unknown {
  return result.state?.[key]?.get();
}

beforeEach(() => {
  harness.presence = "present";
  harness.fetchTemplateArtifactPresence.mockReset().mockImplementation(async () => harness.presence);
  harness.estimateFactoryFeeGas.mockReset().mockImplementation(async () => harness.estimate);
  harness.readFactoryRecord.mockReset().mockImplementation(async () => harness.record);
  harness.fetchFactoryDeployments.mockReset().mockImplementation(async () => ({ total: 0, items: [] }));
  vi.unstubAllEnvs();
});

describe("factory runtime setup", () => {
  it("generatePlan live-verifies the template artifact and surfaces an executable plan with a fee estimate", async () => {
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    await actions.get("generatePlan")!(NEP17_FORM);

    const plan = readState(result, "currentPlan") as {
      publishable: boolean;
      execution: { available: boolean };
      templateArtifact: { status: string };
    };
    expect(harness.fetchTemplateArtifactPresence).toHaveBeenCalledWith(
      "neo-n3-testnet",
      FACTORY_HASH,
      "tpl.nep17.asset.v1",
    );
    expect(plan.publishable).toBe(true);
    expect(plan.templateArtifact.status).toBe("preloaded-on-chain");
    expect(plan.execution.available).toBe(true);
    // Fee estimate runs in the background off the publishable plan.
    await vi.waitFor(() => {
      expect(readState(result, "feeEstimateGas")).toBe("0.007");
    });
  });

  it("executePlan submits the deployment call, captures txid + deployed hash, and refreshes the registry", async () => {
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions, chain, setStatus } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    await actions.get("generatePlan")!(NEP17_FORM);
    harness.fetchFactoryDeployments.mockClear();
    await actions.get("executePlan")!();

    expect(chain.invoke).toHaveBeenCalledTimes(1);
    const [operation, args, options] = chain.invoke.mock.calls[0] as [
      string,
      Array<{ type: string; value: string }>,
      { scriptHash: string; waitForEvent: string },
    ];
    expect(operation).toBe("deployFromTemplate");
    expect(options.scriptHash).toBe(FACTORY_HASH);
    expect(options.waitForEvent).toBe("TokenDeployed");
    expect(args[0]).toEqual({ type: "String", value: "tpl.nep17.asset.v1" });
    expect(readState(result, "lastTxid")).toBe("0xtx-1");
    expect(readState(result, "deployedContractHash")).toBe("0x" + "22".repeat(20));
    expect(setStatus).toHaveBeenCalledWith("executeConfirmed", "success");
    // The registry view refreshes so the new package shows up immediately.
    expect(harness.fetchFactoryDeployments).toHaveBeenCalled();
  });

  it("refuses to execute artifact-less deploy templates with the honest blocked reason", async () => {
    harness.presence = "missing";
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions, chain, setStatus } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    await actions.get("generatePlan")!(NEP17_FORM);
    const plan = readState(result, "currentPlan") as {
      publishable: boolean;
      execution: { available: boolean; blockedReasonKey: string };
      templateArtifact: { status: string };
    };
    expect(plan.publishable).toBe(true);
    expect(plan.execution.available).toBe(false);
    expect(plan.templateArtifact.status).toBe("metadata-only");

    await expect(actions.get("executePlan")!()).resolves.toBeUndefined();
    expect(setStatus).toHaveBeenCalledWith("artifactNotRegistered", "error");
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("guards against double-submitting the same package", async () => {
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions, chain, setStatus } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    await actions.get("generatePlan")!(NEP17_FORM);
    await actions.get("executePlan")!();
    await expect(actions.get("executePlan")!()).resolves.toBeUndefined();
    expect(readState(result, "lastError")).toBe("");
    expect(setStatus).toHaveBeenCalledWith("alreadyExecuted", "error");
    expect(chain.invoke).toHaveBeenCalledTimes(1);
  });

  it("executes the miniapp registry record even without an artifact and waits for MiniAppCreated", async () => {
    harness.presence = "missing";
    harness.readFactoryRecord.mockImplementation(async () => ({
      ...harness.record,
      templateId: "tpl.miniapp.ticket-pass.v1",
      deployedHash: "",
    }));
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions, chain } = buildCtx("miniapp-miniapp-factory");
    createFactorySetup("miniapp", "miniapp-miniapp-factory")(ctx as never);

    await actions.get("generatePlan")!({
      appId: "miniapp-launch-pass",
      appName: "Launch Pass",
      templateKind: "ticket-pass",
      admin: OWNER,
      network: "testnet",
    });
    await actions.get("executePlan")!();

    const [operation, , options] = chain.invoke.mock.calls[0] as [
      string,
      unknown,
      { waitForEvent: string },
    ];
    expect(operation).toBe("createMiniAppFromTemplate");
    expect(options.waitForEvent).toBe("MiniAppCreated");
  });

  it("binds the wallet signature (with public key and message) into the exported signature info", async () => {
    const { createFactorySetup } = await loadRuntime();
    const { ctx, actions } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    await actions.get("generatePlan")!(NEP17_FORM);
    await actions.get("signCurrentPlan")!();

    const info = readState(result, "walletSignatureInfo") as {
      signature: string;
      publicKey: string;
      message: string;
      signedAt: string;
    };
    expect(info.signature).toBe("signature-bytes");
    expect(info.publicKey).toBe("02abcd");
    const plan = readState(result, "currentPlan") as { digest: string; packageId: string };
    expect(info.message).toContain(plan.digest);
    expect(info.message).toContain(plan.packageId);
    expect(info.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readState(result, "walletSignature")).toBe("signature-bytes");
  });

  it("exposes the connected wallet address for owner prefill", async () => {
    const { createFactorySetup } = await loadRuntime();
    const { ctx, chain } = buildCtx("miniapp-asset-factory");
    const result = createFactorySetup("nep17", "miniapp-asset-factory")(
      ctx as never,
    ) as { state?: Record<string, TestObservable> };

    expect(readState(result, "walletAddress")).toBeNull();
    chain.address.set(OWNER);
    expect(readState(result, "walletAddress")).toBe(OWNER);
  });
});
