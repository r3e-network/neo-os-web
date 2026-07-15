import { describe, expect, it } from "vitest";

import neoDidManifest from "../../oracle-neodid-console/neo-manifest.json";
import {
  DEFAULT_SUBJECT_DID,
  manifest,
  messages,
} from "../../oracle-neodid-console/src/appConfig";

type LocalizedMessage = { en: string; zh: string };

describe("Oracle NeoDID Console product configuration", () => {
  it("uses the resolver-supported Morpheus service DID as the immediate default", () => {
    expect(DEFAULT_SUBJECT_DID).toBe("did:morpheus:neo_n3:service:neodid");
    expect(manifest.description).toMatch(/without claiming identity verification/i);
    expect(manifest.features.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual({ oracle: true });
  });

  it("declares a read-only, stateful product with no fake host operations", () => {
    expect(neoDidManifest.version).toBe("2.1.0");
    expect(neoDidManifest.default_network).toBe("neo-n3-mainnet");
    // Audit finding H1 (commit a7c65461e): the "neodid" token was added so the
    // host privacy gate coerces this console's confidential NeoDID lane; it
    // declares a capability the app actually calls, not a host operation.
    expect(neoDidManifest.permissions).toEqual(["read:blockchain", "oracle", "neodid"]);
    expect(neoDidManifest.features.stateless).toBe(false);
    expect(neoDidManifest.platform.transactions).toBe(false);
    expect(neoDidManifest.urls.banner).toBe(
      "/miniapps/oracle-neodid-console/oracle-workspace-stage.webp",
    );
    expect(neoDidManifest).not.toHaveProperty("operation_panel");
    expect(neoDidManifest).not.toHaveProperty("stateSource");
    expect(JSON.stringify(neoDidManifest)).not.toMatch(/sealOracleRequest|buildOraclePackage|did:neo:testnet/);
  });

  it("keeps critical truth-boundary copy bilingual", () => {
    const localized = messages as Record<string, LocalizedMessage>;
    for (const [key, value] of Object.entries(localized)) {
      expect(value.en, `${key} is missing English copy`).toBeTruthy();
      expect(value.zh, `${key} is missing Chinese copy`).toBeTruthy();
    }
    for (const key of [
      "boundaryNote",
      "detailBoundaryCopy",
      "evidenceReady",
      "resolverReturned",
      "noVerificationBadge",
    ]) {
      expect(localized[key]?.en).toBeTruthy();
      expect(localized[key]?.zh).toBeTruthy();
    }
    expect(localized.detailBoundaryCopy.en).toMatch(/does not connect a wallet/i);
    expect(localized.boundaryNote.en).toMatch(/not an attestation/i);
  });

  it("does not describe a catalog match or resolver response as verification success", () => {
    const localized = messages as Record<string, LocalizedMessage>;
    expect(localized.catalogListed.en).toBe("Provider and claim listed");
    expect(localized.resolverReturned.en).toContain("identity not verified");
    expect(localized.resolveAction.en).toBe("Resolve DID");
  });
});
