import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../../../framework";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const OWNER = "NMUD7q5tYaFtw4w4hXk3feupGSGnv9jcrQ";
const OTHER_WALLET = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";

const chainReads = vi.hoisted(() => ({
  fetchTemplateArtifactPresence: vi.fn(),
  estimateFactoryFeeGas: vi.fn(),
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

function buildCtx() {
  const registered = new Map<
    string,
    (...args: unknown[]) => Promise<unknown>
  >();
  const address = observable<string | null>(OTHER_WALLET);
  const chain = {
    address,
    ensureWallet: vi.fn(async () => address.get() || OTHER_WALLET),
    detectNetwork: vi.fn(async () => "testnet"),
    invoke: vi.fn(async () => ({ txid: "0xshould-not-send" })),
    signMessage: vi.fn(async () => ({
      publicKey: "02abcd",
      data: "owner-signature",
    })),
  };
  const setStatus = vi.fn();
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const ctx = {
    services: { chain, notify },
    os: {},
    state: {},
    t: (key: string) => key,
    setStatus,
    clearStatus: vi.fn(),
    launchContext: parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
      "miniapp-nft-factory",
    ),
    registerAction: (
      key: string,
      handler: (...args: unknown[]) => Promise<unknown>,
    ) => registered.set(key, handler),
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, {
      appId: "miniapp-nft-factory",
    }),
  });
  return { ctx, registered, chain };
}

function readState<T>(
  result: { state?: Record<string, TestObservable> },
  key: string,
): T {
  return result.state?.[key]?.get() as T;
}

const DROP = {
  collectionName: "Sunlit Editions",
  symbol: "SUN",
  maxSupply: "500",
  royaltyBps: "500",
  baseUri: "https://metadata.example.com/sunlit/",
  owner: OWNER,
  transferable: true,
  network: "testnet",
};

const VERIFIED_METADATA = {
  status: "verified" as const,
  sampleUrl: "https://metadata.example.com/sunlit/1",
  checkedAt: 1_789_000_000_000,
  detailKey: "metadataVerified" as const,
  name: "Sunlit Edition #1",
  image: "ipfs://bafybeigallery/1.webp",
};

async function createVerifiedSetup() {
  const { createNftFactorySetupWithOptions } = await import(
    "../../nft-factory/src/NftFactorySetup"
  );
  return createNftFactorySetupWithOptions({
    metadataVerifier: vi.fn(async () => VERIFIED_METADATA),
  });
}

beforeEach(() => {
  chainReads.fetchTemplateArtifactPresence.mockReset().mockResolvedValue(
    "present",
  );
  chainReads.estimateFactoryFeeGas.mockReset().mockResolvedValue("12.5");
  chainReads.readFactoryRecord.mockReset().mockResolvedValue(null);
  chainReads.fetchFactoryDeployments.mockReset().mockResolvedValue({
    total: 0,
    items: [],
  });
  vi.stubEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("NFT Factory app-owned setup", () => {
  it("drops the dead shared metadata seed but preserves an explicit creator URI", async () => {
    const { withNftFactoryLaunchDefaults } = await import(
      "../../nft-factory/src/NftFactorySetup"
    );
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
      "miniapp-nft-factory",
    );
    expect(withNftFactoryLaunchDefaults(context).params.baseUri).toBe(" ");

    const explicit = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/nft-factory/index.html?baseUri=https%3A%2F%2Fmetadata.example.com%2Fdrop%2F",
      "miniapp-nft-factory",
    );
    expect(withNftFactoryLaunchDefaults(explicit).params.baseUri).toBe(
      "https://metadata.example.com/drop/",
    );
  });

  it("never invokes the incompatible deployment route, even for a present artifact", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);

    const plan = readState<{
      execution: { available: boolean; blockedReasonKey: string };
    }>(result, "currentPlan");
    expect(plan.execution).toMatchObject({
      available: false,
      blockedReasonKey: "nftUniqueArtifactRequired",
    });
    expect(readState(result, "feeEstimateGas")).toBe("");

    await registered.get("executePlan")?.();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe(
      "nftUniqueArtifactRequired",
    );
    result.cleanup?.();
  });

  it("accepts a creator commitment only from the configured collection owner", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { buildNftFactorySignatureMessage } = await import(
      "../../nft-factory/src/NftFactorySetup"
    );
    const { ctx, registered, chain } = buildCtx();
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    await registered.get("signCurrentPlan")?.();
    expect(chain.signMessage).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("ownerWalletRequired");

    chain.address.set(OWNER);
    await registered.get("signCurrentPlan")?.();
    expect(chain.signMessage).toHaveBeenCalledTimes(1);
    expect(readState(result, "walletSignature")).toBe("owner-signature");
    const plan = readState<Parameters<typeof buildNftFactorySignatureMessage>[0]>(
      result,
      "currentPlan",
    );
    const signatureInfo = readState<{
      message: string;
      signature: string;
    }>(result, "walletSignatureInfo");
    const expectedMessage = buildNftFactorySignatureMessage(plan);
    expect(chain.signMessage).toHaveBeenCalledWith(expectedMessage);
    expect(signatureInfo).toMatchObject({
      message: expectedMessage,
      signature: "owner-signature",
    });
    expect(expectedMessage).toContain(`factory=${FACTORY_HASH}`);
    expect(expectedMessage).toContain("network=neo-n3-testnet");
    expect(expectedMessage).toContain("template=tpl.nep11.collection.v1@1.0.0");
    expect(expectedMessage).toContain(`digest=${plan.digest}`);
    expect(expectedMessage).toContain('payload={"initParams":');

    // A completed commitment is one-shot: repeated clicks do not reopen the
    // wallet or replace the timestamp/signature for the same exact package.
    await registered.get("signCurrentPlan")?.();
    expect(chain.signMessage).toHaveBeenCalledTimes(1);
    expect(readState(result, "walletSignatureInfo")).toBe(signatureInfo);
    result.cleanup?.();
  });

  it("refuses a package whose visible call no longer matches the canonical Factory", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    const plan = readState<Record<string, unknown>>(result, "currentPlan") as {
      deploymentCall: Record<string, unknown>;
    } & Record<string, unknown>;
    result.state?.currentPlan?.set({
      ...plan,
      deploymentCall: {
        ...plan.deploymentCall,
        scriptHash: `0x${"99".repeat(20)}`,
      },
    });

    await registered.get("signCurrentPlan")?.();
    expect(chain.signMessage).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("canonicalPlanMismatch");
    result.cleanup?.();
  });

  it("keeps an unreadable metadata package copyable but blocks owner signing", async () => {
    const { createNftFactorySetupWithOptions } = await import(
      "../../nft-factory/src/NftFactorySetup"
    );
    const createNftFactorySetup = createNftFactorySetupWithOptions({
      metadataVerifier: vi.fn(async () => ({
        status: "unavailable" as const,
        sampleUrl: "https://metadata.example.com/sunlit/1",
        checkedAt: 1_789_000_000_000,
        detailKey: "metadataSampleUnavailable" as const,
      })),
    });
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    const plan = readState<{
      publishable: boolean;
      blockingErrors: string[];
    }>(result, "currentPlan");
    expect(plan.publishable).toBe(false);
    expect(plan.blockingErrors).toContain("metadata_sample_unverified");
    expect(readState(result, "metadataStatus")).toBe("unavailable");

    await registered.get("signCurrentPlan")?.();
    expect(chain.signMessage).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe(
      "metadataVerificationRequired",
    );
    result.cleanup?.();
  });

  it("refuses to sign when the connected wallet is on a different network", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    chain.detectNetwork.mockResolvedValue("mainnet");
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    await registered.get("signCurrentPlan")?.();

    expect(chain.signMessage).not.toHaveBeenCalled();
    expect(readState(result, "lastError")).toBe("walletNetworkMismatch");
    result.cleanup?.();
  });

  it("clears a signature when the wallet changes during signing", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    let finishSigning: ((value: { publicKey: string; data: string }) => void) | null =
      null;
    chain.signMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSigning = resolve;
        }),
    );
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    const pending = registered.get("signCurrentPlan")?.();
    await vi.waitFor(() => expect(chain.signMessage).toHaveBeenCalledTimes(1));
    chain.address.set(OTHER_WALLET);
    finishSigning?.({ publicKey: "02abcd", data: "stale-signature" });
    await pending;

    expect(readState(result, "walletSignature")).toBe("");
    expect(readState(result, "walletSignatureInfo")).toBe(null);
    expect(readState(result, "lastError")).toBe("walletChangedDuringSigning");
    result.cleanup?.();
  });

  it("opens only one wallet request when signing is triggered twice", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    let finishSigning: ((value: { publicKey: string; data: string }) => void) | null =
      null;
    chain.signMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSigning = resolve;
        }),
    );
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    const first = registered.get("signCurrentPlan")?.();
    await vi.waitFor(() => expect(chain.signMessage).toHaveBeenCalledTimes(1));
    const second = registered.get("signCurrentPlan")?.();
    await second;
    expect(chain.signMessage).toHaveBeenCalledTimes(1);

    finishSigning?.({ publicKey: "02abcd", data: "owner-signature" });
    await first;
    expect(readState(result, "walletSignature")).toBe("owner-signature");
    result.cleanup?.();
  });

  it("drops a signature when the locked package changes while the wallet is open", async () => {
    const createNftFactorySetup = await createVerifiedSetup();
    const { ctx, registered, chain } = buildCtx();
    chain.address.set(OWNER);
    let finishSigning: ((value: { publicKey: string; data: string }) => void) | null =
      null;
    chain.signMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSigning = resolve;
        }),
    );
    const result = (await createNftFactorySetup(ctx as never)) as {
      state?: Record<string, TestObservable>;
      cleanup?: () => void;
    };

    await registered.get("generatePlan")?.(DROP);
    const pending = registered.get("signCurrentPlan")?.();
    await vi.waitFor(() => expect(chain.signMessage).toHaveBeenCalledTimes(1));
    result.state?.currentPlan?.set(null);
    finishSigning?.({ publicKey: "02abcd", data: "stale-signature" });
    await pending;

    expect(readState(result, "walletSignature")).toBe("");
    expect(readState(result, "walletSignatureInfo")).toBe(null);
    expect(readState(result, "lastError")).toBe("planChangedDuringSigning");
    result.cleanup?.();
  });
});
