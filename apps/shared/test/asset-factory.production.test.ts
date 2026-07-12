import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assetFactorySignatureMessage,
  classifyRecoveredAsset,
  createAssetFactoryJournal,
  enforceAssetPlanSafety,
  issuerWalletMatches,
  normalizeAssetFactoryDraft,
  restoreAssetFactoryJournal,
} from "../../asset-factory/src/setup";
import { manifest as internalManifest } from "../../asset-factory/src/manifest";
import { messages as assetMessages } from "../../asset-factory/src/locale/messages";
import type { FactoryDeploymentItem } from "../factory/factoryChain";
import {
  buildFactoryPlan,
  type FactoryPlan,
  type Nep17Draft,
} from "../factory/factoryPlan";

const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const OTHER_OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function executablePlan(): FactoryPlan {
  return {
    kind: "nep17",
    title: "NEOC asset",
    network: "neo-n3-testnet",
    templateRef: "tpl.nep17.asset.v1",
    templateId: "tpl.nep17.asset.v1",
    templateVersion: "1.0.0",
    templateArtifact: {
      status: "preloaded-on-chain",
      nefHash: `0x${"1".repeat(64)}`,
      manifestHash: `0x${"2".repeat(64)}`,
      configSchemaHash: `0x${"3".repeat(64)}`,
    },
    operation: "prepareNEP17",
    deploymentCall: {
      scriptHash: "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49",
      operation: "deployFromTemplate",
      args: [],
    },
    execution: {
      outcome: "contract-deployment",
      available: true,
      blockedReasonKey: "",
      confirmingEvent: "TokenDeployed",
      signerHint: OWNER,
    },
    packageId: "tpl-nep17-asset-v1-1234567890",
    digest: `0x${"a".repeat(64)}`,
    publishable: true,
    blockingErrors: [],
    warnings: [],
    payload: { standard: "NEP-17" },
    steps: [
      {
        key: "validate",
        titleKey: "stepValidateTitle",
        detailKey: "stepValidateReady",
        status: "ready",
      },
      {
        key: "deploy",
        titleKey: "stepDeployTitleNep17",
        detailKey: "stepDeployReadyDetail",
        status: "ready",
      },
    ],
    oneGate: { url: "https://example.test", params: {} },
    generatedAt: "deterministic",
  };
}

function matchingRecord(plan: FactoryPlan): FactoryDeploymentItem {
  return {
    packageId: plan.packageId,
    templateId: plan.templateId,
    digest: plan.digest,
    creator: OWNER,
    deployedHash: "0x1234567890abcdef1234567890abcdef12345678",
    createdAt: 1,
  };
}

function recoverableDraft(): Nep17Draft {
  return {
    name: "Neo Credits",
    symbol: "NEOC",
    decimals: "8",
    initialSupply: "1000000",
    owner: OWNER,
    treasury: OWNER,
    mintable: true,
    network: "neo-n3-testnet",
  };
}

function recoverablePlan(draft = recoverableDraft()): FactoryPlan {
  return enforceAssetPlanSafety(
    buildFactoryPlan("nep17", draft as unknown as Record<string, unknown>, {
      appId: "miniapp-asset-factory",
      artifactPresence: "unknown",
    }),
  );
}

describe("Asset Factory production safety", () => {
  it("fails closed even when the shared template plan appears executable", () => {
    const original = executablePlan();
    const safe = enforceAssetPlanSafety(original);

    expect(original.execution.available).toBe(true);
    expect(safe.publishable).toBe(true);
    expect(safe.digest).toBe(original.digest);
    expect(safe.execution.available).toBe(false);
    expect(safe.execution.blockedReasonKey).toBe("artifactUnverified");
    expect(safe.steps.find((step) => step.key === "deploy")).toMatchObject({
      status: "blocked",
      detailKey: "artifactUnverified",
    });
  });

  it("never confuses a record-only or mismatched record with a deployment", () => {
    const plan = executablePlan();
    const confirmed = matchingRecord(plan);

    expect(classifyRecoveredAsset(plan, confirmed)).toBe("confirmed");
    expect(
      classifyRecoveredAsset(plan, { ...confirmed, deployedHash: "" }),
    ).toBe("record-only");
    expect(
      classifyRecoveredAsset(plan, {
        ...confirmed,
        digest: `0x${"b".repeat(64)}`,
      }),
    ).toBe("mismatch");
    expect(
      classifyRecoveredAsset(plan, { ...confirmed, creator: OTHER_OWNER }),
    ).toBe("mismatch");
    expect(classifyRecoveredAsset(plan, null)).toBe("unconfirmed");
  });

  it("accepts an issuer commitment only from the declared Owner wallet", () => {
    const plan = executablePlan();

    expect(issuerWalletMatches(plan, OWNER)).toBe(true);
    expect(issuerWalletMatches(plan, OTHER_OWNER)).toBe(false);
    expect(issuerWalletMatches(plan, null)).toBe(false);
  });

  it("round-trips the exact TestNet draft, locked digest, and issuer signature", () => {
    const draft = recoverableDraft();
    const plan = recoverablePlan(draft);
    const signatureInfo = {
      signature: "wallet-signature",
      publicKey: "02aabb",
      message: assetFactorySignatureMessage(plan),
      signedAt: "2026-07-11T00:00:00.000Z",
    };
    const journal = createAssetFactoryJournal(
      draft,
      plan,
      signatureInfo,
      OWNER,
      "2026-07-11T00:01:00.000Z",
    );
    const restored = restoreAssetFactoryJournal(
      journal,
      "miniapp-asset-factory",
    );

    expect(restored?.draft).toEqual(draft);
    expect(restored?.plan?.digest).toBe(plan.digest);
    expect(restored?.plan?.execution.available).toBe(false);
    expect(restored?.signatureInfo).toEqual(signatureInfo);
    expect(restored?.signedWalletAddress).toBe(OWNER);
  });

  it("restores editable inputs but discards tampered locks and signatures", () => {
    const draft = recoverableDraft();
    const plan = recoverablePlan(draft);
    const journal = createAssetFactoryJournal(
      draft,
      plan,
      {
        signature: "wallet-signature",
        publicKey: "02aabb",
        message: assetFactorySignatureMessage(plan),
        signedAt: "2026-07-11T00:00:00.000Z",
      },
      OWNER,
    );

    const tampered = {
      ...journal,
      locked: { ...journal.locked!, digest: `0x${"f".repeat(64)}` },
      signedWalletAddress: OTHER_OWNER,
    };
    const restored = restoreAssetFactoryJournal(
      tampered,
      "miniapp-asset-factory",
    );

    expect(restored?.draft).toEqual(draft);
    expect(restored?.plan).toBeNull();
    expect(restored?.signatureInfo).toBeNull();
    expect(restored?.signedWalletAddress).toBe("");
    expect(
      normalizeAssetFactoryDraft({ ...draft, network: "neo-n3-mainnet" }),
    ).toBeNull();
  });

  it("advertises only the read/sign capabilities the app actually exposes", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../asset-factory/neo-manifest.json"),
        "utf8",
      ),
    ) as {
      contracts: Record<string, string>;
      permissions: string[];
      supported_networks: string[];
      version: string;
      features: { stateless: boolean };
      platform: { transactions: boolean };
    };

    expect(manifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(manifest.version).toBe("1.2.0");
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.contracts["neo-n3-testnet"]).toMatch(/^0x[a-f0-9]{40}$/);
    expect(manifest.permissions).toEqual([
      "wallet:sign-message",
      "read:blockchain",
    ]);
    expect(manifest.platform.transactions).toBe(false);
    expect(internalManifest.tabs).toEqual([]);
    expect(internalManifest.stats).toEqual([]);
    expect(internalManifest.sidebar?.items).toEqual([]);
    expect(internalManifest.operations).toEqual([]);
    expect(internalManifest.features?.activityFeed).toBe(false);
  });

  it("boots through the app-local safety setup and suppresses duplicate studio sections", () => {
    const main = readFileSync(
      resolve(process.cwd(), "../asset-factory/src/main.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      resolve(process.cwd(), "../asset-factory/src/AssetFactoryPlayArea.scss"),
      "utf8",
    );
    const playArea = readFileSync(
      resolve(process.cwd(), "../asset-factory/src/AssetFactoryPlayArea.tsx"),
      "utf8",
    );
    const index = readFileSync(
      resolve(process.cwd(), "../asset-factory/index.html"),
      "utf8",
    );

    expect(main).toContain("createAssetFactorySetup");
    expect(main).toContain("AssetFactoryPlayArea");
    expect(main).not.toContain("createFactorySetup(kind");
    expect(playArea).toContain('persistDraftAction="persistAssetDraft"');
    expect(playArea).toContain("showExecuteAction={false}");
    expect(styles).toContain(".domain-factory-token-rail");
    expect(styles).toContain(".domain-factory-hero");
    expect(styles).toContain(".domain-factory-output > .neo-card:first-child");
    expect(styles).toMatch(
      /\.domain-factory-actions__execute:disabled\s*\{[\s\S]*display:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 560px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(index).toContain('type="image/webp"');
    expect(index).not.toContain('type="image/svg+xml"');
  });

  it("keeps signature and recovered-record copy inside the evidence actually checked", () => {
    const localized = assetMessages as Record<
      string,
      { en?: string; zh?: string }
    >;

    expect(localized.signed.en).toBe("Signature captured");
    expect(localized.walletSignature.en).toMatch(/not independently verified/i);
    expect(localized.planSigned.en).toMatch(/no deployment was submitted/i);
    expect(localized.recoveryTitle_confirmed.en).toBe(
      "Factory record confirmed",
    );
    expect(localized.recovery_confirmed.en).toMatch(
      /token contract ABI and state were not inspected/i,
    );
    expect(localized.deployedContractLabel.en).toBe(
      "Factory-recorded contract hash",
    );
  });

  it("puts supply, decimals, policy, and Owner in the primary token hierarchy", () => {
    const sharedPlayArea = readFileSync(
      resolve(process.cwd(), "factory/FactoryPlayArea.tsx"),
      "utf8",
    );

    expect(sharedPlayArea).toContain('{ label: t("previewSupply"), value: nep17SupplyLabel }');
    expect(sharedPlayArea).toContain('{ label: t("decimals"), value: nep17.decimals.trim() || "—" }');
    expect(sharedPlayArea).toContain('{ label: t("previewMintPolicy"), value: nep17PolicyLabel }');
    expect(sharedPlayArea).toContain('`${t("owner")}: ${compactIdentity(nep17.owner, "—")}`');
  });
});
