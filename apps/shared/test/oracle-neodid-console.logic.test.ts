import { describe, expect, it, vi } from "vitest";

import {
  buildEvidenceSnapshot,
  buildPendingOperation,
  canonicalize,
  canonicalMorpheusDid,
  didResolveEndpoint,
  evidenceMatchesForm,
  loadProviderCatalog,
  observeProviderContext,
  probeNeoDidRegistry,
  providerCatalogEndpoint,
  resolveDidDocument,
  restoreEvidenceSnapshot,
  restorePendingOperation,
  sha256Hex,
  unavailableProviderCatalog,
  validateConsoleForm,
  type NeoDidConsoleForm,
  type NeoDidRegistryProbe,
  type ProviderCatalogSnapshot,
  type ResolvedDidSummary,
} from "../../oracle-neodid-console/src/neodid-console";

const DID = "did:morpheus:neo_n3:service:neodid";
const MAINNET_REGISTRY = "0xb81f31ea81e279793b30411b82c2e82078b63105";
const CREATED_AT = "2099-07-11T00:00:00.000Z";
const FORM: NeoDidConsoleForm = {
  did: DID,
  provider: "web3auth",
  claim: "Web3Auth_PrimaryIdentity",
};

function resolution(overrides: Partial<ResolvedDidSummary> = {}): ResolvedDidSummary {
  return {
    id: DID,
    controller: [DID],
    versionId: "unversioned",
    anchorContract: MAINNET_REGISTRY,
    serviceTypes: [
      "DIDResolutionService",
      "MorpheusNeoDIDRegistry",
      "MorpheusOracleGateway",
      "MorpheusNeoDIDRuntime",
    ],
    serviceCount: 4,
    verificationMethodCount: 0,
    runtimeVerifierMetadata: false,
    oracleGatewayDeclared: true,
    contentType: "application/json",
    raw: {
      didDocument: {
        id: DID,
        controller: [DID],
        verificationMethod: [],
        service: [
          { id: "#resolver", type: "DIDResolutionService", serviceEndpoint: "/resolve" },
          { id: "#registry", type: "MorpheusNeoDIDRegistry", serviceEndpoint: { contract: MAINNET_REGISTRY } },
          { id: "#oracle", type: "MorpheusOracleGateway", serviceEndpoint: { request_types: ["neodid_bind"] } },
          { id: "#runtime", type: "MorpheusNeoDIDRuntime", serviceEndpoint: { runtime_url: "https://runtime.example" } },
        ],
      },
      didDocumentMetadata: { versionId: "unversioned", anchorContract: MAINNET_REGISTRY },
    },
    ...overrides,
  };
}

function catalog(overrides: Partial<ProviderCatalogSnapshot> = {}): ProviderCatalogSnapshot {
  return {
    endpoint: providerCatalogEndpoint("mainnet"),
    network: "mainnet",
    status: "providers-returned",
    source: "host-runtime",
    warning: "",
    providers: [{
      id: "web3auth",
      category: "identity",
      aliases: ["w3a"],
      authModes: ["aggregate_oauth", "mfa"],
      claimTypes: ["Web3Auth_PrimaryIdentity", "Web3Auth_LinkedSocials"],
      derivesProviderUidInTee: true,
    }],
    loadedAt: CREATED_AT,
    raw: {
      providers: [{
        id: "web3auth",
        category: "identity",
        aliases: ["w3a"],
        auth_modes: ["aggregate_oauth", "mfa"],
        claim_types: ["Web3Auth_PrimaryIdentity", "Web3Auth_LinkedSocials"],
        derives_provider_uid_in_tee: true,
      }],
    },
    ...overrides,
  };
}

const VERIFIED_REGISTRY: NeoDidRegistryProbe = {
  network: "mainnet",
  status: "verified",
  contract: MAINNET_REGISTRY,
  contractName: "NeoDIDRegistry",
  networkMagic: 860833102,
  checkedAt: CREATED_AT,
  reason: "verified-deployment",
};

describe("Oracle NeoDID Console production logic", () => {
  it("accepts only supported Morpheus service, Vault, and AA identifiers", () => {
    expect(canonicalMorpheusDid(DID)).toBe(DID);
    expect(canonicalMorpheusDid(`did:morpheus:neo_n3:vault:${"AB".repeat(20)}`))
      .toBe(`did:morpheus:neo_n3:vault:${"ab".repeat(20)}`);
    expect(canonicalMorpheusDid("did:morpheus:neo_n3:aa:alex%2Fprimary"))
      .toBe("did:morpheus:neo_n3:aa:alex%2Fprimary");
    expect(canonicalMorpheusDid("did:morpheus:neo_n3:aa:broken%")).toBeNull();
    expect(canonicalMorpheusDid("did:neo:testnet:sample-user")).toBeNull();
    expect(validateConsoleForm({ ...FORM, did: "did:web:example.com" })).toBe("consoleInvalidDid");
  });

  it("builds same-origin network-scoped resolver and catalog endpoints", () => {
    expect(didResolveEndpoint(DID, "mainnet"))
      .toBe(`/api/morpheus/neodid/resolve?did=${encodeURIComponent(DID)}&network=mainnet`);
    expect(providerCatalogEndpoint("testnet"))
      .toBe("/api/morpheus/neodid/providers?network=testnet");
  });

  it("parses the live provider shape without relabeling it as attestation", async () => {
    const response = new Response(JSON.stringify({
      providers: [{
        id: "web3auth",
        category: "identity",
        aliases: ["w3a"],
        auth_modes: ["aggregate_oauth", "mfa"],
        claim_types: ["Web3Auth_PrimaryIdentity"],
        derives_provider_uid_in_tee: true,
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const result = await loadProviderCatalog("mainnet", vi.fn(async () => response), undefined, CREATED_AT);

    expect(result.status).toBe("providers-returned");
    expect(result.source).toBe("host-runtime");
    expect(result.providers[0]).toMatchObject({
      id: "web3auth",
      aliases: ["w3a"],
      claimTypes: ["Web3Auth_PrimaryIdentity"],
      derivesProviderUidInTee: true,
    });
    expect(observeProviderContext(result, { ...FORM, provider: "w3a" })).toMatchObject({
      matchedProviderId: "web3auth",
      matchedBy: "alias",
      status: "claim-listed",
    });
  });

  it("rejects cross-network catalog responses", async () => {
    const response = new Response(JSON.stringify({ network: "testnet", providers: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    await expect(loadProviderCatalog("mainnet", vi.fn(async () => response)))
      .rejects.toThrow("catalogNetworkMismatch");
  });

  it("rejects malformed or ambiguous provider catalogs instead of filtering them into evidence", async () => {
    const malformed = new Response(JSON.stringify({
      providers: [{ id: "web3auth", aliases: ["w3a", 7] }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(loadProviderCatalog("mainnet", vi.fn(async () => malformed)))
      .rejects.toThrow("catalogFailed");

    const ambiguous = new Response(JSON.stringify({
      providers: [
        { id: "alpha", aliases: ["shared"] },
        { id: "beta", aliases: ["shared"] },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(loadProviderCatalog("mainnet", vi.fn(async () => ambiguous)))
      .rejects.toThrow("catalogFailed");
  });

  it("rejects a resolver response whose subject differs from the request", async () => {
    const response = new Response(JSON.stringify({
      didDocument: { id: "did:morpheus:neo_n3:aa:someone-else" },
      didDocumentMetadata: {},
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(resolveDidDocument(FORM, "mainnet", vi.fn(async () => response)))
      .rejects.toThrow("resolverSubjectMismatch");
  });

  it("rejects structurally malformed DID service and verification arrays", async () => {
    const malformedService = new Response(JSON.stringify({
      didDocument: {
        id: DID,
        controller: [DID],
        service: [{
          id: "#oracle",
          type: ["MorpheusOracleGateway", 7],
          serviceEndpoint: { request_types: ["neodid_bind"] },
        }],
      },
      didDocumentMetadata: { anchorContract: MAINNET_REGISTRY },
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(resolveDidDocument(FORM, "mainnet", vi.fn(async () => malformedService)))
      .rejects.toThrow("resolverFailed");

    const malformedVerifier = new Response(JSON.stringify({
      didDocument: {
        id: DID,
        controller: [DID],
        verificationMethod: [{ id: 7 }],
        service: [],
      },
      didDocumentMetadata: { anchorContract: MAINNET_REGISTRY },
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(resolveDidDocument(FORM, "mainnet", vi.fn(async () => malformedVerifier)))
      .rejects.toThrow("resolverFailed");
  });

  it("rejects deeply nested or numerically lossy resolver payloads before evidence hashing", async () => {
    let endpoint: Record<string, unknown> = { value: "ok" };
    for (let depth = 0; depth < 70; depth += 1) endpoint = { child: endpoint };
    const deeplyNested = new Response(JSON.stringify({
      didDocument: {
        id: DID,
        controller: [DID],
        service: [{ id: "#deep", type: "MorpheusNeoDIDRuntime", serviceEndpoint: endpoint }],
      },
      didDocumentMetadata: { anchorContract: MAINNET_REGISTRY },
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(resolveDidDocument(FORM, "mainnet", vi.fn(async () => deeplyNested)))
      .rejects.toThrow("resolverFailed");

    const unsafeInteger = new Response(JSON.stringify({
      didDocument: { id: DID, controller: [DID], service: [] },
      didDocumentMetadata: { anchorContract: MAINNET_REGISTRY },
      sequence: 9_007_199_254_740_992,
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(resolveDidDocument(FORM, "mainnet", vi.fn(async () => unsafeInteger)))
      .rejects.toThrow("resolverFailed");
  });

  it("distinguishes catalog listing from missing provider, missing claim, and outage", () => {
    expect(observeProviderContext(catalog(), FORM).status).toBe("claim-listed");
    expect(observeProviderContext(catalog(), { ...FORM, claim: "Unknown" }).status)
      .toBe("claim-unlisted");
    expect(observeProviderContext(catalog(), { ...FORM, provider: "unknown" }).status)
      .toBe("provider-unlisted");
    expect(observeProviderContext(unavailableProviderCatalog("mainnet", CREATED_AT), FORM).status)
      .toBe("catalog-unavailable");
  });

  it("verifies the exact mainnet registry deployment with network magic and manifest name", async () => {
    const rpc = vi.fn(async (_url: string, method: string) => method === "getversion"
      ? { protocol: { network: 860833102 } }
      : { manifest: { name: "NeoDIDRegistry" } });
    const probe = await probeNeoDidRegistry("mainnet", MAINNET_REGISTRY, rpc, CREATED_AT);

    expect(probe).toEqual(VERIFIED_REGISTRY);
    expect(rpc.mock.calls.map((call) => call[1])).toEqual(["getversion", "getcontractstate"]);
  });

  it("binds the canonical testnet no-deployment boundary to testnet network magic", async () => {
    const rpc = vi.fn(async () => ({ protocol: { network: 894710606 } }));
    const probe = await probeNeoDidRegistry("testnet", "", rpc, CREATED_AT);

    expect(probe).toMatchObject({
      network: "testnet",
      status: "unavailable",
      contract: "",
      networkMagic: 894710606,
      reason: "no-network-deployment",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(expect.any(String), "getversion", [], undefined);
  });

  it("reports a testnet RPC network mismatch instead of calling it no-deployment evidence", async () => {
    const rpc = vi.fn(async () => ({ protocol: { network: 860833102 } }));
    await expect(probeNeoDidRegistry("testnet", "", rpc, CREATED_AT)).resolves.toMatchObject({
      status: "mismatch",
      reason: "network-mismatch",
      networkMagic: 860833102,
    });
  });

  it("rejects a resolver-declared registry on a network with no canonical deployment", async () => {
    const rpc = vi.fn();
    await expect(probeNeoDidRegistry("testnet", MAINNET_REGISTRY, rpc, CREATED_AT)).resolves.toMatchObject({
      status: "mismatch",
      reason: "resolver-anchor-mismatch",
      contract: MAINNET_REGISTRY,
      networkMagic: null,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records every unsupported proof operation as not performed", async () => {
    const evidence = await buildEvidenceSnapshot(
      FORM,
      resolution(),
      catalog(),
      VERIFIED_REGISTRY,
      CREATED_AT,
    );

    expect(evidence.resolver.status).toBe("document-returned");
    expect(evidence.context.status).toBe("claim-listed");
    expect(evidence.didDocument.oracleGateway).toBe("declared");
    expect(evidence.didDocument.runtimeVerifierMetadata).toBe("unavailable");
    expect(evidence.boundaries).toEqual({
      identityVerification: "not-performed",
      claimAttestation: "not-performed",
      signatureVerification: "not-performed",
      oracleDispatch: "not-performed",
      providerCatalog: "metadata-only",
    });
    expect(evidence.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("NeoDID")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("restores only unexpired digest-valid evidence for the same network", async () => {
    const evidence = await buildEvidenceSnapshot(
      FORM,
      resolution(),
      catalog(),
      VERIFIED_REGISTRY,
      CREATED_AT,
    );
    const now = Date.parse(CREATED_AT) + 60_000;

    expect(await restoreEvidenceSnapshot(evidence, "mainnet", now)).toEqual(evidence);
    expect(await restoreEvidenceSnapshot(evidence, "testnet", now)).toBeNull();
    expect(await restoreEvidenceSnapshot({ ...evidence, digest: "0".repeat(64) }, "mainnet", now))
      .toBeNull();
    expect(await restoreEvidenceSnapshot(evidence, "mainnet", Date.parse(evidence.expiresAt)))
      .toBeNull();
  });

  it("rejects a locally re-digested summary that does not match the raw resolver snapshot", async () => {
    const evidence = await buildEvidenceSnapshot(
      FORM,
      resolution(),
      catalog(),
      VERIFIED_REGISTRY,
      CREATED_AT,
    );
    const tampered = {
      ...evidence,
      didDocument: { ...evidence.didDocument, serviceCount: 99 },
    };
    const { digest: _discarded, ...tamperedBase } = tampered;
    const reDigested = { ...tampered, digest: await sha256Hex(canonicalize(tamperedBase)) };

    expect(await restoreEvidenceSnapshot(reDigested, "mainnet", Date.parse(CREATED_AT) + 60_000))
      .toBeNull();
  });

  it("invalidates evidence when DID or catalog context changes", async () => {
    const evidence = await buildEvidenceSnapshot(
      FORM,
      resolution(),
      catalog(),
      VERIFIED_REGISTRY,
      CREATED_AT,
    );
    expect(evidenceMatchesForm(evidence, FORM)).toBe(true);
    expect(evidenceMatchesForm(evidence, { ...FORM, claim: "Web3Auth_LinkedSocials" })).toBe(false);
  });

  it("restores only fresh, same-network safe-read checkpoints", () => {
    const pending = buildPendingOperation("mainnet", FORM, CREATED_AT);
    const now = Date.parse(CREATED_AT) + 30_000;
    expect(restorePendingOperation(pending, "mainnet", now)).toEqual(pending);
    expect(restorePendingOperation(pending, "testnet", now)).toBeNull();
    expect(restorePendingOperation(pending, "mainnet", now + 6 * 60_000)).toBeNull();
  });
});
