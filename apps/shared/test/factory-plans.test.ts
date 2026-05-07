import { describe, expect, it } from "vitest";

import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  parseDecimalToUnits,
} from "../factory/factoryPlan";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";

describe("Domain factory plans", () => {
  it("builds deterministic NEP-17 deployments from preloaded on-chain templates", () => {
    const input = {
      name: "R3E Credits",
      symbol: "R3E",
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
    expect(first.templateArtifact.status).toBe("preloaded-on-chain");
    expect(first.templateArtifact.nefHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.templateArtifact.manifestHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(first.deploymentCall.operation).toBe("deployFromTemplate");
    expect(first.deploymentCall.scriptHash).toBe("");
    expect(first.deploymentCall.args).toEqual([
      { type: "String", value: "tpl.nep17.asset.v1" },
      { type: "String", value: first.packageId },
      { type: "String", value: first.digest },
      { type: "String", value: JSON.stringify(first.payload.initParams) },
    ]);
    expect(first.payload.standard).toBe("NEP-17");
    expect(first.payload.initParams.initialSupplyUnits).toBe("100000025000000");
    expect(first.payload.initParams.symbol).toBe("R3E");
    expect(first.payload).not.toHaveProperty("contractManifest");
    expect(JSON.stringify(first.payload).toLowerCase()).not.toContain("\"nef\"");
    expect(JSON.stringify(first.payload).toLowerCase()).not.toContain("\"manifest\"");
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
    expect(plan.deploymentCall.operation).toBe("deployFromTemplate");
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
    expect(JSON.stringify(plan.payload).toLowerCase()).not.toContain("\"nef\"");
    expect(JSON.stringify(plan.payload).toLowerCase()).not.toContain("\"manifest\"");
  });

  it("derives a factory draft from OneGate query parameters", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/asset-factory/index.html?source=onegate&operation=prepareNEP17&template=nep17&symbol=R3E&name=R3E%20Credits&owner=NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3&network=testnet",
      "miniapp-asset-factory",
    );

    const draft = createFactoryDraftFromLaunchContext(context);

    expect(draft.kind).toBe("nep17");
    expect(draft.nep17.symbol).toBe("R3E");
    expect(draft.nep17.name).toBe("R3E Credits");
    expect(draft.nep17.owner).toBe(OWNER);
    expect(draft.nep17.network).toBe("neo-n3-testnet");
  });

  it("keeps domain factory apps focused even when OneGate query parameters include another template", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/asset-factory/index.html?source=onegate&template=miniapp&name=Focused%20Asset&owner=NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3&network=testnet",
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
