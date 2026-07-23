import { describe, expect, it, vi } from "vitest";

import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryTemplateIdFor,
  parseDecimalToUnits,
} from "../factory/factoryPlan";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
const SHA256_DIGEST = /^0x[a-f0-9]{64}$/;

/**
 * factoryPlan reads the factory contract env at module load, so a configured
 * variant has to stub the env and re-import the module fresh.
 */
async function importConfiguredFactoryPlan() {
  vi.stubEnv("VITE_NEO_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_ASSET_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
  const module = await import("../factory/factoryPlan");
  vi.unstubAllEnvs();
  return module;
}

describe("Domain factory plans", () => {
  it("builds deterministic NEP-17 deployments with a SHA-256 digest and honest unverified artifact state", () => {
    const input = {
      name: "Yiwu Credits",
      symbol: "YIWU",
      decimals: "8",
      initialSupply: "1000000.25",
      owner: OWNER,
      treasury: OWNER,
      mintable: true,
      network: "testnet",
    };

    const first = buildFactoryPlan("nep17", input);
    const second = buildFactoryPlan("nep17", { ...input });

    expect(first.blockingErrors).toEqual(["factory_contract_not_configured"]);
    expect(first.templateRef).toBe("tpl.nep17.asset.v1");
    expect(first.templateId).toBe("tpl.nep17.asset.v1");
    // Without a live chain read the artifact state must never claim
    // "preloaded-on-chain" — that was the dishonest pre-fix default.
    expect(first.templateArtifact.status).toBe("unverified");
    expect(first.templateArtifact.nefHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.templateArtifact.manifestHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.deploymentCall.operation).toBe("deployArtifactFromTemplate");
    expect(first.deploymentCall.scriptHash).toBe("");
    expect(first.deploymentCall.args).toHaveLength(6);
    expect(first.deploymentCall.args.slice(0, 3)).toEqual([
      { type: "String", value: first.templateId },
      { type: "String", value: first.packageId },
      { type: "String", value: first.artifactDigest },
    ]);
    expect(first.artifactDigest).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(first.payload.standard).toBe("NEP-17");
    expect(first.payload.initParams.initialSupplyUnits).toBe("100000025000000");
    expect(first.payload.initParams.symbol).toBe("YIWU");
    expect(first.payload).not.toHaveProperty("contractManifest");
    expect(JSON.stringify(first.payload).toLowerCase()).not.toContain("\"nef\"");
    expect(JSON.stringify(first.payload).toLowerCase()).not.toContain("\"manifest\"");
    // Cryptographic digest: SHA-256 over the canonical payload.
    expect(first.digest).toMatch(SHA256_DIGEST);
    expect(first.digest).toBe(second.digest);
    expect(first.oneGate.params.template).toBe("nep17");
    expect(first.oneGate.params.templateId).toBe("tpl.nep17.asset.v1");
    expect(first.oneGate.url).toContain("appId=miniapp-asset-factory");
    expect(first.warnings).not.toContain("deploy_adapter_required");
    expect(first.steps.map((step) => step.status)).toEqual([
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    // Steps carry i18n keys, never hardcoded English copy.
    for (const step of first.steps) {
      expect(step.titleKey).toMatch(/^step/);
      expect(step.detailKey).toMatch(/^step/);
    }
    // Unconfigured factory → not publishable → execution unavailable.
    expect(first.execution.outcome).toBe("contract-deployment");
    expect(first.execution.available).toBe(false);
    expect(first.execution.confirmingEvent).toBe("TokenDeployed");
    expect(first.execution.signerHint).toBe(OWNER);
  });

  it("keeps the digest stable across live artifact states so verified plans reproduce the same package id", () => {
    const input = {
      name: "Yiwu Credits",
      symbol: "YIWU",
      decimals: "8",
      initialSupply: "1000000.25",
      owner: OWNER,
      network: "testnet",
    };

    const unverified = buildFactoryPlan("nep17", input);
    const present = buildFactoryPlan("nep17", input, { artifactPresence: "present" });
    const missing = buildFactoryPlan("nep17", input, { artifactPresence: "missing" });

    expect(present.digest).toBe(unverified.digest);
    expect(missing.digest).toBe(unverified.digest);
    expect(present.packageId).toBe(unverified.packageId);
    expect(present.templateArtifact.status).toBe("preloaded-on-chain");
    expect(missing.templateArtifact.status).toBe("metadata-only");
  });

  it("gates creator-artifact deployment on both governed artifact and live ABI", async () => {
    const { buildFactoryPlan: buildConfigured } = await importConfiguredFactoryPlan();
    const input = {
      name: "Yiwu Credits",
      symbol: "YIWU",
      decimals: "8",
      initialSupply: "1000000",
      owner: OWNER,
      network: "testnet",
    };

    const missing = buildConfigured("nep17", input, {
      artifactPresence: "missing",
      artifactDeploymentSupport: "supported",
    });
    expect(missing.publishable).toBe(true);
    expect(missing.execution.available).toBe(false);
    expect(missing.execution.blockedReasonKey).toBe("artifactNotRegistered");
    expect(missing.steps.find((step) => step.key === "deploy")?.status).toBe("blocked");

    const unverified = buildConfigured("nep17", input);
    expect(unverified.execution.available).toBe(false);
    expect(unverified.execution.blockedReasonKey).toBe("factoryAbiUnverified");
    expect(unverified.steps.find((step) => step.key === "deploy")?.status).toBe("manual");

    const abiMissing = buildConfigured("nep17", input, {
      artifactPresence: "present",
      artifactDeploymentSupport: "missing",
    });
    expect(abiMissing.execution.available).toBe(false);
    expect(abiMissing.execution.blockedReasonKey).toBe("factoryAbiUnavailable");

    const present = buildConfigured("nep17", input, {
      artifactPresence: "present",
      artifactDeploymentSupport: "supported",
    });
    expect(present.execution.available).toBe(true);
    expect(present.execution.blockedReasonKey).toBe("");
    expect(present.steps.find((step) => step.key === "deploy")?.status).toBe("ready");
    expect(present.deploymentCall).toMatchObject({
      operation: "deployArtifactFromTemplate",
    });
    expect(present.deploymentCall.args).toHaveLength(6);
  });

  it("treats the miniapp registry record as the designed outcome — executable without an artifact", async () => {
    const { buildFactoryPlan: buildConfigured } = await importConfiguredFactoryPlan();
    const plan = buildConfigured("miniapp", {
      appId: "miniapp-launch-pass",
      appName: "Launch Pass",
      templateKind: "ticket-pass",
      admin: OWNER,
      network: "neo-n3-testnet",
    }, { artifactPresence: "missing" });

    expect(plan.publishable).toBe(true);
    expect(plan.execution.outcome).toBe("registry-record");
    expect(plan.execution.available).toBe(true);
    expect(plan.execution.confirmingEvent).toBe("MiniAppCreated");
    expect(plan.steps.find((step) => step.key === "deploy")?.status).toBe("ready");

    const unregistered = buildConfigured("miniapp", {
      appId: "miniapp-launch-pass",
      appName: "Launch Pass",
      templateKind: "ticket-pass",
      admin: OWNER,
      network: "neo-n3-testnet",
    }, { artifactPresence: "not-registered" });
    expect(unregistered.execution.available).toBe(false);
    expect(unregistered.execution.blockedReasonKey).toBe("templateNotRegistered");
  });

  it("rejects unsafe NEP-17 decimals, supply precision, and owner addresses before publishing", () => {
    const plan = buildFactoryPlan("nep17", {
      name: "Bad Token",
      symbol: "bad token",
      decimals: "8",
      initialSupply: "1.000000001",
      owner: "not-a-neo-address",
      network: "mainnet",
    });

    expect(plan.blockingErrors).toContain("symbol_format");
    expect(plan.blockingErrors).toContain("initial_supply_precision");
    expect(plan.blockingErrors).toContain("owner_address");
    expect(plan.publishable).toBe(false);
  });

  it("builds NEP-11 collection packages with royalty bounds and collection metadata", () => {
    const plan = buildFactoryPlan("nep11", {
      collectionName: "Neo Builder Pass",
      symbol: "NBP",
      maxSupply: "5000",
      royaltyBps: "250",
      baseUri: "https://assets.neomini.app/nft/neo-builder-pass/",
      owner: OWNER,
      network: "neo-n3-testnet",
      transferable: false,
    });

    expect(plan.blockingErrors).toEqual(["factory_contract_not_configured"]);
    expect(plan.payload.standard).toBe("NEP-11");
    expect(plan.payload.initParams.maxSupply).toBe(5000);
    expect(plan.payload.initParams.royaltyBps).toBe(250);
    expect(plan.payload.initParams.transferPolicy).toBe("soulbound");
    expect(plan.templateRef).toBe("tpl.nep11.collection.v1");
    expect(plan.deploymentCall.operation).toBe("deployArtifactFromTemplate");
    expect(plan.deploymentCall.args).toHaveLength(6);
    expect(plan.artifactDigest).toBe(plan.deploymentCall.args[2]?.value);
    expect(plan.oneGate.url).toContain("appId=miniapp-nft-factory");
    expect(JSON.stringify(plan.payload).toLowerCase()).not.toContain("\"manifest\"");
  });

  it("builds miniapp template plans as platform template binding calls, not external artifact uploads", () => {
    const plan = buildFactoryPlan("miniapp", {
      appId: "miniapp-launch-pass",
      appName: "Launch Pass",
      templateKind: "ticket-pass",
      admin: OWNER,
      network: "neo-n3-testnet",
      needsOracle: false,
      needsOneGate: true,
    });

    expect(plan.blockingErrors).toEqual(["factory_contract_not_configured"]);
    expect(plan.templateId).toBe("tpl.miniapp.ticket-pass.v1");
    expect(plan.deploymentCall.operation).toBe("createMiniAppFromTemplate");
    expect(plan.oneGate.url).toContain("appId=miniapp-miniapp-factory");
    expect(plan.payload.initParams.appId).toBe("miniapp-launch-pass");
    expect(plan.payload.initParams.capabilities.nep21).toBe(true);
    expect(plan.execution.signerHint).toBe(OWNER);
    expect(JSON.stringify(plan.payload).toLowerCase()).not.toContain("\"nef\"");
    expect(JSON.stringify(plan.payload).toLowerCase()).not.toContain("\"manifest\"");
  });

  it("resolves template ids for every factory kind", () => {
    expect(factoryTemplateIdFor("nep17")).toBe("tpl.nep17.asset.v1");
    expect(factoryTemplateIdFor("nep11")).toBe("tpl.nep11.collection.v1");
    expect(factoryTemplateIdFor("miniapp", "oracle-console")).toBe("tpl.miniapp.oracle-console.v1");
    expect(factoryTemplateIdFor("miniapp")).toBe("tpl.miniapp.reward-vault.v1");
    expect(factoryTemplateIdFor("miniapp", "bogus")).toBe("tpl.miniapp.reward-vault.v1");
  });

  it("derives a factory draft from OneGate query parameters", () => {
    const context = parseMiniAppLaunchContext(
      `https://neomini.app/miniapps/asset-factory/index.html?source=onegate&operation=prepareNEP17&template=nep17&symbol=YIWU&name=Yiwu%20Credits&owner=${OWNER}&network=testnet`,
      "miniapp-asset-factory",
    );

    const draft = createFactoryDraftFromLaunchContext(context);

    expect(draft.kind).toBe("nep17");
    expect(draft.nep17.symbol).toBe("YIWU");
    expect(draft.nep17.name).toBe("Yiwu Credits");
    expect(draft.nep17.owner).toBe(OWNER);
    expect(draft.nep17.network).toBe("neo-n3-testnet");
  });

  it("keeps domain factory apps focused even when OneGate query parameters include another template", () => {
    const context = parseMiniAppLaunchContext(
      `https://neomini.app/miniapps/asset-factory/index.html?source=onegate&template=miniapp&name=Focused%20Asset&owner=${OWNER}&network=testnet`,
      "miniapp-asset-factory",
    );

    const draft = createFactoryDraftFromLaunchContext(context, "nep17");

    expect(draft.kind).toBe("nep17");
    expect(draft.nep17.name).toBe("Focused Asset");
    expect(draft.miniapp.appName).toBe("Focused Asset");
  });

  it("converts decimal display amounts to fixed token units without floating point drift", () => {
    expect(parseDecimalToUnits("0.00000001", 8).toString()).toBe("1");
    expect(parseDecimalToUnits("1000000.25", 8).toString()).toBe("100000025000000");
    expect(() => parseDecimalToUnits("1.001", 2)).toThrow("precision");
  });
});
