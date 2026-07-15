import { describe, expect, it } from "vitest";

import oracleComputeManifest from "../../oracle-compute-lab/neo-manifest.json";
import {
  appMeta,
  DEFAULT_COMPUTE_SOURCE,
  DISCLOSURE_OPTIONS,
  manifest,
  messages,
  PROFILE_OPTIONS,
} from "../../oracle-compute-lab/src/appConfig";

type LocalizedMessage = { en: string; zh: string };
const appMessages = messages as Record<string, LocalizedMessage>;

describe("Oracle Compute Lab product configuration", () => {
  it("keeps one designed play surface instead of manifest-generated form chrome", () => {
    expect(manifest.tabs).toBeUndefined();
    expect(manifest.stats).toBeUndefined();
    expect(manifest.operations).toBeUndefined();
    expect(manifest.sidebar).toBeUndefined();
    expect(manifest.permissions).toEqual({});
    // Audit finding H1 (commit a7c65461e): the empty permission array this
    // previously pinned was the defect — it left the host privacy gate unable
    // to coerce permissions.confidential for an app that builds Morpheus
    // compute requests. Declared tokens are product truth, not form chrome.
    expect(oracleComputeManifest.permissions).toEqual(["oracle", "compute", "confidential"]);
    expect(oracleComputeManifest).not.toHaveProperty("operation_panel");
    expect(oracleComputeManifest).not.toHaveProperty("stateSource");
  });

  it("labels profile choices as intent presets and disclosure as a separate policy", () => {
    expect(PROFILE_OPTIONS.map((option) => option.value)).toEqual([
      "risk-signal",
      "proof-review",
      "batch-transform",
    ]);
    expect(DISCLOSURE_OPTIONS.map((option) => option.value)).toEqual([
      "digest-only",
      "public-input",
    ]);
    expect(DEFAULT_COMPUTE_SOURCE).toContain('"signals"');
    expect(appMessages.profileProofHint.en).toMatch(/no proof is verified here/i);
    expect(appMessages.policyDigestOnlyHint.en).toMatch(/not encryption/i);
  });

  it("uses canonical route metadata while labeling it as a registry target", () => {
    expect(appMeta.endpointLabel).toBe("compute.execute · /compute/execute");
    expect(appMeta.runtimeBaseUrl).toMatch(/^https:\/\/oracle\.meshmini\.app\/(mainnet|testnet)$/);
    expect(appMeta.envelopeVersion).toBe("2026-04-tee-v1");
    expect(appMeta.policiesLabel).toBe("tenant · risk");
    expect(appMeta.teeRequired).toBe(true);
    expect(appMeta.deliveryMode).toBe("api_response");
    expect(appMeta.requestDigestScope).toBe("oracle-compute-lab/payload+route-snapshot-v1");
    expect(appMessages.networkTargetBadge.en).toBe("Registry target");
    expect(appMessages.routeCopy.en).toMatch(/not a live service check/i);
  });

  it("keeps every visible result claim inside the implemented boundary", () => {
    const copy = [
      manifest.description,
      oracleComputeManifest.description,
      appMessages.panelSubtitle.en,
      appMessages.boundaryHeadline.en,
      appMessages.boundaryCopy.en,
      appMessages.docsBoundaryCopy.en,
      appMessages.docsRecoveryCopy.en,
    ].join(" ");

    expect(copy).toMatch(/no compute job|does not execute compute|not pretending/i);
    expect(copy).toMatch(/proof/i);
    expect(copy).toMatch(/attestation/i);
    expect(copy).toMatch(/no pending transaction|no write exists/i);
    expect(copy).not.toMatch(/compute complete|proof verified|attestation verified/i);
  });

  it("ships complete English and Chinese boundary copy", () => {
    for (const [key, value] of Object.entries(appMessages)) {
      expect(value.en, `${key} is missing English copy`).toBeTruthy();
      expect(value.zh, `${key} is missing Chinese copy`).toBeTruthy();
    }
    for (const key of [
      "panelTitle",
      "panelSubtitle",
      "policyDigestOnlyHint",
      "boundaryHeadline",
      "boundaryCopy",
      "boundaryRecovery",
      "routeCopy",
      "sourcePublicBadge",
      "sourceTooDeep",
      "digestUnavailable",
    ]) {
      expect(appMessages[key]?.en).toBeTruthy();
      expect(appMessages[key]?.zh).toBeTruthy();
    }
  });
});
