import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(__dirname, "../..");
const APP = resolve(ROOT, "nft-factory");
const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const OWNER = "NMUD7q5tYaFtw4w4hXk3feupGSGnv9jcrQ";

const VALID_DROP = {
  collectionName: "Sunlit Editions",
  symbol: "SUN",
  maxSupply: "500",
  royaltyBps: "500",
  baseUri: "https://metadata.example.com/sunlit/",
  owner: OWNER,
  transferable: true,
  network: "testnet",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

async function factoryPlanModule() {
  vi.stubEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
  return import("../factory/factoryPlan");
}

describe("NFT Factory production contract", () => {
  it("keeps the app write lane closed even when the shared planner sees a registry artifact", async () => {
    const { buildFactoryPlan } = await factoryPlanModule();
    const {
      enforceNftFactoryExecutionGate,
      enforceNftFactorySigningReadiness,
      isCanonicalNftFactoryPlan,
    } = await import(
      "../../nft-factory/src/NftFactorySetup"
    );

    const unverified = buildFactoryPlan("nep11", VALID_DROP, {
      appId: "miniapp-nft-factory",
    });
    const missing = buildFactoryPlan("nep11", VALID_DROP, {
      appId: "miniapp-nft-factory",
      artifactPresence: "missing",
    });
    const sharedVerified = buildFactoryPlan("nep11", VALID_DROP, {
      appId: "miniapp-nft-factory",
      artifactPresence: "present",
    });
    const verified = enforceNftFactoryExecutionGate(sharedVerified);

    expect(unverified.publishable).toBe(true);
    expect(unverified.execution.available).toBe(false);
    expect(unverified.execution.blockedReasonKey).toBe("artifactUnverified");
    expect(missing.execution.available).toBe(false);
    expect(missing.execution.blockedReasonKey).toBe("artifactNotRegistered");
    // The live contract rejects deployFromTemplate for artifact-backed
    // templates and requires a creator-unique artifact payload. NFT Factory
    // does not generate that payload yet, so it must not expose a write.
    expect(sharedVerified.execution.available).toBe(true);
    expect(verified.execution.available).toBe(false);
    expect(verified.execution.blockedReasonKey).toBe(
      "nftUniqueArtifactRequired",
    );
    expect(verified.execution.outcome).toBe("contract-deployment");
    expect(verified.execution.confirmingEvent).toBe("TokenDeployed");
    expect(verified.steps.find((step) => step.key === "deploy")).toMatchObject({
      status: "blocked",
      detailKey: "stepDeployUniqueArtifactRequired",
    });
    expect(isCanonicalNftFactoryPlan(verified)).toBe(true);
    const alteredContract = {
      ...verified,
      deploymentCall: {
        ...verified.deploymentCall,
        scriptHash: `0x${"99".repeat(20)}`,
      },
    };
    expect(isCanonicalNftFactoryPlan(alteredContract)).toBe(false);
    const alteredInitParams = {
      ...(verified.payload.initParams as Record<string, unknown>),
      collectionName: "Different collection",
    };
    const alteredPayload = {
      ...verified,
      payload: {
        ...verified.payload,
        initParams: alteredInitParams,
      },
      deploymentCall: {
        ...verified.deploymentCall,
        args: verified.deploymentCall.args.map((arg, index) =>
          index === 3
            ? { ...arg, value: JSON.stringify(alteredInitParams) }
            : arg,
        ),
      },
    };
    // Even a self-consistent visible payload/call mutation fails because the
    // original digest is recomputed before owner signing.
    expect(isCanonicalNftFactoryPlan(alteredPayload)).toBe(false);
    expect(
      enforceNftFactorySigningReadiness(alteredContract, {
        status: "verified",
        detailKey: "metadataVerified",
        sampleUrl: "https://metadata.example.com/sunlit/1",
        checkedAt: 1_789_000_000_000,
        name: "Sunlit Edition #1",
        image: "https://cdn.example.com/sunlit/1.webp",
      }),
    ).toMatchObject({
      publishable: false,
      blockingErrors: expect.arrayContaining(["canonical_nft_factory_plan"]),
    });
    expect(verified.digest).toBe(unverified.digest);
    expect(verified.digest).toBe(missing.digest);
  }, 15_000);

  it("rejects unsafe supply, royalty, metadata, and owner inputs", async () => {
    const { buildFactoryPlan } = await factoryPlanModule();
    const plan = buildFactoryPlan(
      "nep11",
      {
        ...VALID_DROP,
        maxSupply: "1000001",
        royaltyBps: "1001",
        baseUri: "http://metadata.example.com/no-trailing-slash",
        owner: "not-an-address",
      },
      { appId: "miniapp-nft-factory", artifactPresence: "present" },
    );

    expect(plan.publishable).toBe(false);
    expect(plan.execution.available).toBe(false);
    expect(plan.blockingErrors).toEqual(
      expect.arrayContaining([
        "max_supply_range",
        "royalty_range",
        "base_uri_https_trailing_slash",
        "owner_address",
      ]),
    );
  });

  it("ships an app-owned collection studio instead of the generic form shell", () => {
    const main = readFileSync(resolve(APP, "src/main.tsx"), "utf8");
    const appManifest = readFileSync(resolve(APP, "src/manifest.ts"), "utf8");
    const playArea = readFileSync(resolve(APP, "src/NftFactoryPlayArea.tsx"), "utf8");
    const setup = readFileSync(resolve(APP, "src/NftFactorySetup.ts"), "utf8");
    const styles = readFileSync(resolve(APP, "src/nft-factory.scss"), "utf8");
    const messages = readFileSync(resolve(APP, "src/locale/messages.ts"), "utf8");
    const attribution = readFileSync(resolve(APP, "ATTRIBUTION.md"), "utf8");
    const testnetStatus = readFileSync(resolve(APP, "TESTNET-STATUS.md"), "utf8");
    const provenance = readFileSync(
      resolve(APP, "ASSET_PROVENANCE.md"),
      "utf8",
    );
    const networkStatus = readFileSync(
      resolve(APP, "NETWORK_STATUS.md"),
      "utf8",
    );
    const productionStatus = readFileSync(
      resolve(APP, "PRODUCTION_STATUS.md"),
      "utf8",
    );

    expect(main).toContain("playArea: NftFactoryPlayArea");
    expect(main).not.toContain("createFactoryPlayArea");
    expect(main).toContain("setup: createNftFactorySetup");
    expect(appManifest).toContain("payments: false");
    expect(appManifest).toContain("storage: false");
    expect(appManifest).toContain("tabs: []");
    expect(appManifest).toContain("stats: []");
    expect(appManifest).toContain("operations: []");
    expect(playArea).toContain("fixedKind=\"nep11\"");
    expect(playArea).toContain("collectionStudioLabel");
    expect(playArea).toContain("nft-factory-release-scope");
    expect(playArea).toContain("chooseArtwork");
    expect(playArea).toContain("nep11ArtworkUrl");
    expect(playArea).toContain("supportedNetworks={NFT_FACTORY_SUPPORTED_NETWORKS}");
    expect(playArea).toContain("showExecuteAction={false}");
    expect(playArea).toContain("preventRepeatSigning");
    expect(playArea).toContain("requireVerifiedMetadataForSigning");
    expect(readFileSync(resolve(ROOT, "shared/factory/FactoryPlayArea.tsx"), "utf8")).toContain(
      "metadataObservation",
    );
    expect(playArea).not.toContain("releaseDeferredValue");
    expect(setup).toContain("enforceNftFactoryExecutionGate");
    expect(setup).toContain("enforceNftFactorySigningReadiness");
    expect(setup).toContain("metadataVerifier");
    expect(setup).toContain("ctx.framework.chain.detectNetwork()");
    expect(setup).toContain("withNftFactoryLaunchDefaults");
    expect(setup).toContain(': " "');
    expect(setup).toContain("ownerMatchesAddress");
    expect(setup).toContain("buildNftFactorySignatureMessage");
    expect(setup).toContain("isCanonicalNftFactoryPlan");
    expect(setup).toContain("nftUniqueArtifactRequired");
    expect(setup).not.toContain("ctx.services.chain.invoke(");
    expect(styles).toContain("sunlit collection atelier");
    expect(styles).toContain(".nft-factory-release-scope");
    expect(styles).toContain(".domain-factory--nep11 .domain-factory-preview__nft");
    expect(styles).toContain("background: rgba(255, 255, 255, 0.9)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(messages).toContain("Token #1 JSON verified");
    // Re-pinned 2026-07-15: the artwork disclosure was rewritten to production
    // voice ("Local preview only …" read as staging/status language in the
    // playarea-functionality audit). The guard's intent is unchanged — the
    // copy must still say the artwork stays on-device and is never uploaded.
    expect(messages).toContain("Stays on this device");
    expect(messages).toContain("deployed testnet Factory lacks");
    expect(messages).toContain("ownerWalletRequired");
    expect(attribution).toContain("019f4e01-96c2-75d0-a5e6-9ca5a60f7100");
    expect(attribution).toContain("No upstream game, marketplace");
    expect(testnetStatus).toContain("HasArtifact`: **false**");
    expect(testnetStatus).toContain("`deployArtifactFromTemplate` is **absent**");
    expect(testnetStatus).toContain("deployment must remain disabled");
    expect(provenance).toContain("No imagery from `IcedSoul/minigame-everyday`");
    expect(provenance).toContain("019f4e01-96c2-75d0-a5e6-9ca5a60f7100");
    expect(networkStatus).toContain("HasArtifact`: `false`");
    expect(networkStatus).toContain("persist the broadcast transaction");
    expect(productionStatus).toContain("65/65 tests passed");
    expect(productionStatus).toContain("Host synchronization was intentionally not performed");
  });

  it("publishes modern, non-placeholder collection media and honest permissions", async () => {
    const sharp = (await import("sharp")).default;
    const [logo, banner, artwork] = await Promise.all([
      sharp(resolve(APP, "public/logo.webp")).metadata(),
      sharp(resolve(APP, "public/banner.webp")).metadata(),
      sharp(resolve(APP, "public/nft-drop-preview.webp")).metadata(),
    ]);
    const manifest = JSON.parse(
      readFileSync(resolve(APP, "neo-manifest.json"), "utf8"),
    ) as {
      category: string;
      contracts: Record<string, unknown>;
      permissions: string[];
      supported_networks: string[];
      features: { offlineSupport: boolean };
      platform: { transactions: boolean };
      urls: { icon: string; banner: string };
    };

    expect(logo).toMatchObject({ width: 512, height: 512, format: "webp" });
    expect(banner).toMatchObject({ width: 1280, height: 640, format: "webp" });
    expect(artwork).toMatchObject({ width: 1536, height: 1024, format: "webp" });
    expect(manifest.category).toBe("nft");
    expect(manifest.contracts).toEqual({
      "neo-n3-testnet": FACTORY_HASH,
    });
    expect(manifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(manifest.features.offlineSupport).toBe(false);
    expect(manifest.permissions).toEqual([
      "wallet:sign-message",
      "read:blockchain",
    ]);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.urls.icon.endsWith("logo.webp")).toBe(true);
    expect(manifest.urls.banner.endsWith("banner.webp")).toBe(true);
  });
});
