import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";

import {
  attachWalletSignature,
  buildPassportPayload,
  buildPassportPendingOperation,
  canonicalMorpheusDid,
  canonicalize,
  normalizePassportForm,
  normalizeWalletSignature,
  probeNeoDidRegistry,
  resolveDidDocument,
  restorePassportPayload,
  restorePassportPendingOperation,
  sha256Hex,
  validatePassportForm,
  type NeoDidRegistryProbe,
  type PassportPayload,
  type ResolvedDidSummary,
} from "../../neodid-passport/src/passport";

const DID = "did:morpheus:neo_n3:service:neodid";
const MAINNET_REGISTRY = "0xb81f31ea81e279793b30411b82c2e82078b63105";
const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const SIGNATURE = `0x${"11".repeat(64)}`;
const PUBLIC_KEY = `0x02${"22".repeat(32)}`;
const ISSUED_AT = "2099-06-01T00:00:00.000Z";
const NONCE = "ab".repeat(16);
const REGISTRY_PROBE: NeoDidRegistryProbe = {
  environment: "mainnet",
  status: "verified",
  contract: MAINNET_REGISTRY,
  contractName: "NeoDIDRegistry",
  networkMagic: 860833102,
  checkedAt: "2099-06-01T00:00:01.000Z",
  reason: "verified-deployment",
};

const FORM = {
  subject: DID,
  claim: "wallet-signature-context",
  audience: "miniapp-neodid-passport",
};

const setupHarness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => {
      state: Record<string, { get: () => unknown }>;
      loadData: () => Promise<void>;
      cleanup: () => void;
    };
  },
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("../react/defineMiniApp")>(
    "../react/defineMiniApp",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: typeof setupHarness.definition) => {
      setupHarness.definition = definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

function resolution(overrides: Partial<ResolvedDidSummary> = {}): ResolvedDidSummary {
  return {
    id: DID,
    controller: [DID],
    versionId: "compose-mainnet-123",
    anchorContract: MAINNET_REGISTRY,
    serviceTypes: ["DIDResolutionService", "MorpheusNeoDIDRuntime"],
    serviceCount: 2,
    verificationMethodCount: 1,
    runtimeAttested: true,
    contentType: 'application/ld+json;profile="https://w3id.org/did-resolution"',
    raw: {
      didDocument: {
        id: DID,
        controller: [DID],
        verificationMethod: [{ id: `${DID}#tee-verifier` }],
        service: [
          { id: "#resolver", type: "DIDResolutionService" },
          { id: "#runtime", type: "MorpheusNeoDIDRuntime" },
        ],
      },
      didDocumentMetadata: {
        versionId: "compose-mainnet-123",
        anchorContract: MAINNET_REGISTRY,
      },
    },
    ...overrides,
  };
}

function buildPayload() {
  return buildPassportPayload(
    FORM,
    resolution(),
    "mainnet",
    ISSUED_AT,
    NONCE,
    REGISTRY_PROBE,
  );
}

interface FetchControl {
  failResolver: boolean;
}

interface StorageControl {
  setFails: boolean;
  setNoops: boolean;
  deleteNoops: boolean;
}

function installNetworkFetch(network: "mainnet" | "testnet") {
  const control: FetchControl = { failResolver: false };
  const anchorContract = network === "mainnet" ? MAINNET_REGISTRY : "";
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/morpheus/neodid/resolve?")) {
      if (control.failResolver) {
        return new Response(JSON.stringify({ error: "resolver unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        didDocument: {
          id: DID,
          controller: [DID],
          verificationMethod: [],
          service: [
            { id: "#resolver", type: "DIDResolutionService" },
            { id: "#registry", type: "MorpheusNeoDIDRegistry" },
            { id: "#oracle", type: "MorpheusOracleGateway" },
            { id: "#runtime", type: "MorpheusNeoDIDRuntime" },
          ],
        },
        didDocumentMetadata: {
          versionId: "unversioned",
          anchorContract,
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const request = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    if (request.method === "getversion") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { protocol: { network: network === "mainnet" ? 860833102 : 894710606 } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (request.method === "getcontractstate") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { hash: MAINNET_REGISTRY, manifest: { name: "NeoDIDRegistry" } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { control, fetchMock };
}

function setupMainApp(options: {
  network?: "mainnet" | "testnet";
  detectedNetwork?: string;
  store?: Map<string, unknown>;
  storageSetFails?: boolean;
  storageControl?: Partial<StorageControl>;
} = {}) {
  const network = options.network ?? "testnet";
  const store = options.store ?? new Map<string, unknown>();
  const actions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const address = createObservable(ADDRESS);
  const ensureWallet = vi.fn(async () => ADDRESS);
  const detectNetwork = vi.fn(async () => options.detectedNetwork ?? `neo-n3-${network}`);
  const signMessage = vi.fn(async () => ({ data: SIGNATURE, publicKey: PUBLIC_KEY, address: ADDRESS }));
  const invoke = vi.fn();
  const copy = vi.fn(async () => true);
  const setStatus = vi.fn();
  const storageControl: StorageControl = {
    setFails: Boolean(options.storageSetFails),
    setNoops: false,
    deleteNoops: false,
    ...options.storageControl,
  };
  const framework = {
    storage: {
      local: {
        get: (key: string, fallback: unknown) => store.has(key) ? store.get(key) : fallback,
        set: (key: string, value: unknown) => {
          if (storageControl.setFails) throw new Error("storage unavailable");
          if (!storageControl.setNoops) store.set(key, value);
        },
        delete: (key: string) => {
          if (!storageControl.deleteNoops) store.delete(key);
        },
      },
    },
    actions: {
      register: (name: string, action: (...args: unknown[]) => Promise<unknown>) => {
        actions.set(name, action);
      },
    },
    chain: { address, ensureWallet, detectNetwork, signMessage, invoke },
    clipboard: { copy },
  };
  const ctx = {
    launchContext: { network: `neo-n3-${network}`, params: {} },
    framework,
    t: (key: string) => key,
    setStatus,
  };
  const result = setupHarness.definition?.setup?.(ctx as never);
  expect(result).toBeTruthy();
  return {
    actions,
    address,
    copy,
    detectNetwork,
    ensureWallet,
    invoke,
    result: result!,
    setStatus,
    signMessage,
    store,
    storageControl,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeAll(async () => {
  await import("../../neodid-passport/src/main");
}, 30_000);

describe("NeoDID passport production logic", () => {
  it("uses launch values only for fields that were not explicitly edited", () => {
    expect(normalizePassportForm({}, {
      subject: DID,
      claim: "developer-context",
      audience: "miniapp-oracle-services",
    })).toEqual({
      subject: DID,
      claim: "developer-context",
      audience: "miniapp-oracle-services",
    });

    const explicitlyCleared = normalizePassportForm({ subject: DID, claim: "", audience: "" }, {
      claim: "do-not-restore-this",
      audience: "do-not-restore-this",
    });
    expect(explicitlyCleared.claim).toBe("");
    expect(explicitlyCleared.audience).toBe("");
    expect(validatePassportForm(explicitlyCleared)).toBe("passportClaimInvalid");

    const malformed = normalizePassportForm({
      subject: DID,
      claim: { value: "developer-context" },
      audience: ["miniapp-oracle-services"],
    });
    expect(malformed.claim).toBe("");
    expect(malformed.audience).toBe("");
    expect(validatePassportForm(malformed)).toBe("passportClaimInvalid");
  });

  it("canonicalizes only supported Morpheus service, vault, and AA identifiers", () => {
    expect(canonicalMorpheusDid("DID:morpheus:neo_n3:service:neodid")).toBeNull();
    expect(canonicalMorpheusDid(DID)).toBe(DID);
    expect(canonicalMorpheusDid(`did:morpheus:neo_n3:vault:${"AB".repeat(20)}`))
      .toBe(`did:morpheus:neo_n3:vault:${"ab".repeat(20)}`);
    expect(canonicalMorpheusDid("did:morpheus:neo_n3:aa:alex%2Fprimary"))
      .toBe("did:morpheus:neo_n3:aa:alex%2Fprimary");
    expect(canonicalMorpheusDid("did:morpheus:neo_n3:aa:alex%0Aadmin")).toBeNull();
    expect(canonicalMorpheusDid("did:wrong:value")).toBeNull();
  });

  it("bounds self-authored fields before any resolver request", () => {
    expect(validatePassportForm({ ...FORM, claim: "x".repeat(97) })).toBe("passportClaimInvalid");
    expect(validatePassportForm({ ...FORM, audience: "x\ny" })).toBe("passportAudienceInvalid");
    expect(validatePassportForm({ ...FORM, subject: "did:wrong:value" })).toBe("passportInvalidDid");
  });

  it("resolves the exact requested DID and records document evidence without calling it identity verification", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      didDocument: {
        id: DID,
        controller: [DID],
        verificationMethod: [{ id: `${DID}#tee-verifier` }],
        service: [
          { id: "#resolver", type: "DIDResolutionService" },
          { id: "#runtime", type: ["MorpheusNeoDIDRuntime", "DIDResolutionService"] },
        ],
      },
      didDocumentMetadata: {
        versionId: "compose-mainnet-123",
        anchorContract: MAINNET_REGISTRY,
      },
    }), {
      status: 200,
      headers: { "content-type": 'application/ld+json;profile="https://w3id.org/did-resolution"' },
    })) as unknown as typeof fetch;

    const result = await resolveDidDocument(FORM, "mainnet", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/morpheus/neodid/resolve?did=did%3Amorpheus%3Aneo_n3%3Aservice%3Aneodid&network=mainnet",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(result).toMatchObject({
      id: DID,
      anchorContract: MAINNET_REGISTRY,
      serviceCount: 2,
      verificationMethodCount: 1,
      runtimeAttested: true,
    });
    expect(result.serviceTypes).toEqual(["DIDResolutionService", "MorpheusNeoDIDRuntime"]);
  });

  it("rejects a resolver response for a different subject and sanitizes invalid anchors", async () => {
    const mismatch = vi.fn(async () => new Response(JSON.stringify({
      didDocument: { id: `did:morpheus:neo_n3:vault:${"a".repeat(40)}` },
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    await expect(resolveDidDocument(FORM, "testnet", mismatch)).rejects.toThrow("resolverSubjectMismatch");

    const invalidAnchor = vi.fn(async () => new Response(JSON.stringify({
      didDocument: { id: DID, service: [] },
      didDocumentMetadata: { anchorContract: "0xabc" },
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    await expect(resolveDidDocument(FORM, "testnet", invalidAnchor)).resolves.toMatchObject({
      anchorContract: "",
      runtimeAttested: false,
    });
  });

  it("rejects structurally malformed DID arrays instead of coercing them into evidence", async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({
      didDocument: {
        id: DID,
        controller: [{ id: DID }],
        service: [{ id: "#resolver", type: ["DIDResolutionService", 7] }],
        verificationMethod: ["not-a-verification-method"],
      },
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

    await expect(resolveDidDocument(FORM, "testnet", malformed)).rejects.toThrow("resolverFailed");
  });

  it("builds an expiring self-authored review envelope with a real SHA-256 digest", async () => {
    const payload = await buildPayload();

    expect(payload.kind).toBe("neodid.passport.review");
    expect(payload.formatVersion).toBe(1);
    expect(payload.issuer).toBe("self-authored-local-review");
    expect(payload.expiresAt).toBe("2099-06-01T00:10:00.000Z");
    expect(payload.nonce).toBe(NONCE);
    expect(payload.assurance).toEqual({
      claimVerification: "not-performed",
      didWalletBinding: "not-checked",
      registryAnchor: "deployment-verified",
      runtimeAttestation: "metadata-available",
      walletProof: "not-attached",
    });
    expect(payload.proof).toMatchObject({
      type: "NeoWalletMessageSignature",
      status: "prepared",
      verification: "not-performed",
    });
    expect(payload.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.registry).toEqual(REGISTRY_PROBE);
    expect(canonicalize(payload)).toContain('"claim":"wallet-signature-context"');
  });

  it("fails closed when the runtime cannot provide SHA-256", async () => {
    vi.stubGlobal("crypto", undefined);
    await expect(sha256Hex("review")).rejects.toThrow("shaUnavailable");
  });

  it("attaches a wallet-returned signature without relabeling it as verified", async () => {
    const payload = await buildPayload();
    const signed = await attachWalletSignature(
      payload,
      { data: SIGNATURE, publicKey: PUBLIC_KEY, address: ADDRESS },
      ADDRESS,
      "mainnet",
      "2099-06-01T00:01:00.000Z",
    );

    expect(signed.assurance.walletProof).toBe("attached-unverified");
    expect(signed.proof).toMatchObject({
      status: "attached",
      verification: "not-performed",
      verificationLimitation: "wallet-preimage-convention-not-disclosed",
      address: ADDRESS,
      network: "mainnet",
      signature: SIGNATURE,
      publicKey: PUBLIC_KEY,
      requestInterface: "framework.chain.signMessage(text)",
      preimageConvention: "wallet-adapter-specific-not-disclosed",
    });
    expect(signed.proof.signedMessage).toBe(canonicalize(payload));
    expect(signed.proof.messageDigest).toBe(await sha256Hex(canonicalize(payload)));
    await expect(attachWalletSignature(signed, SIGNATURE, ADDRESS)).rejects.toThrow("passportAlreadySigned");
  });

  it("rejects malformed signatures and a wallet result for another account", async () => {
    const payload = await buildPayload();
    await expect(attachWalletSignature(payload, "0x1234", ADDRESS)).rejects.toThrow("walletSignFailed");
    await expect(attachWalletSignature(
      payload,
      { data: SIGNATURE, address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" },
      ADDRESS,
    )).rejects.toThrow("walletAddressInvalid");
    await expect(attachWalletSignature(
      payload,
      { data: SIGNATURE, account: addressToScriptHash("NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX") },
      ADDRESS,
    )).rejects.toThrow("walletAddressInvalid");
  });

  it("accepts a wallet-reported signer script hash only when it matches the connected address", async () => {
    const payload = await buildPayload();
    const signed = await attachWalletSignature(
      payload,
      { data: SIGNATURE, account: addressToScriptHash(ADDRESS) },
      ADDRESS,
      "mainnet",
      "2099-06-01T00:01:00.000Z",
    );

    expect(signed.proof.address).toBe(ADDRESS);
  });

  it("rejects impossible base64 signature lengths instead of padding malformed output", () => {
    expect(() => normalizeWalletSignature("A".repeat(89))).toThrow("walletSignFailed");
  });

  it("rejects a signature timestamp outside the prepared review window", async () => {
    const payload = await buildPayload();
    await expect(attachWalletSignature(
      payload,
      SIGNATURE,
      ADDRESS,
      "mainnet",
      "2099-05-31T23:59:59.000Z",
    )).rejects.toThrow("passportTimeInvalid");

    const signed = await attachWalletSignature(
      payload,
      SIGNATURE,
      ADDRESS,
      "mainnet",
      "2099-06-01T00:01:00.000Z",
    );
    await expect(restorePassportPayload({
      ...signed,
      proof: { ...signed.proof, signedAt: "2099-06-01T00:10:01.000Z" },
    }, "mainnet", Date.parse(ISSUED_AT) + 120_000)).resolves.toBeNull();
  });

  it("exports an exact signing request and an explicit non-verifiability contract even without a public key", async () => {
    const payload = await buildPayload();
    const signed = await attachWalletSignature(
      payload,
      SIGNATURE,
      ADDRESS,
      "mainnet",
      "2099-06-01T00:01:00.000Z",
    );

    expect(signed.proof.publicKey).toBeUndefined();
    expect(signed.proof.signedMessage).toBe(canonicalize(payload));
    expect(signed.proof.requestInterface).toBe("framework.chain.signMessage(text)");
    expect(signed.proof.preimageConvention).toBe("wallet-adapter-specific-not-disclosed");
    expect(signed.proof.verification).toBe("not-performed");
    expect(signed.proof.verificationLimitation).toBe("wallet-preimage-convention-not-disclosed");
  });

  it("restores only current, untampered envelopes for the selected network", async () => {
    const issued = Date.parse(ISSUED_AT);
    const payload = await buildPayload();
    await expect(restorePassportPayload(payload, "mainnet", issued + 60_000)).resolves.toEqual(payload);
    await expect(restorePassportPayload(payload, "testnet", issued + 60_000)).resolves.toBeNull();
    await expect(restorePassportPayload({ ...payload, claim: "tampered" }, "mainnet", issued + 60_000)).resolves.toBeNull();
    await expect(restorePassportPayload(payload, "mainnet", issued + 10 * 60_000)).resolves.toBeNull();
  });

  it("restores an attached proof only when its message digest and account fields remain valid", async () => {
    const issued = Date.parse(ISSUED_AT);
    const payload = await buildPayload();
    const signed = await attachWalletSignature(
      payload,
      { data: SIGNATURE, publicKey: PUBLIC_KEY },
      ADDRESS,
      "mainnet",
      "2099-06-01T00:01:00.000Z",
    );
    await expect(restorePassportPayload(signed, "mainnet", issued + 120_000)).resolves.toEqual(signed);
    await expect(restorePassportPayload({
      ...signed,
      proof: { ...signed.proof, messageDigest: "0".repeat(64) },
    }, "mainnet", issued + 120_000)).resolves.toBeNull();
    await expect(restorePassportPayload({
      ...signed,
      proof: { ...signed.proof, signedMessage: `${signed.proof.signedMessage} ` },
    }, "mainnet", issued + 120_000)).resolves.toBeNull();
  });

  it("recovers only recent resolver/signing checkpoints", () => {
    const started = Date.parse(ISSUED_AT);
    const resolving = buildPassportPendingOperation("resolving", "mainnet", FORM, "", ISSUED_AT);
    const signing = buildPassportPendingOperation("signing", "mainnet", FORM, "a".repeat(64), ISSUED_AT);

    expect(restorePassportPendingOperation(resolving, "mainnet", started + 60_000)).toEqual(resolving);
    expect(restorePassportPendingOperation(signing, "mainnet", started + 60_000)).toEqual(signing);
    expect(restorePassportPendingOperation(resolving, "testnet", started + 60_000)).toBeNull();
    expect(restorePassportPendingOperation(resolving, "mainnet", started + 5 * 60_000 + 1)).toBeNull();
  });

  it("proves only the canonical mainnet NeoDIDRegistry deployment", async () => {
    const rpc = vi.fn(async (_url: string, method: string) => method === "getversion"
      ? { protocol: { network: 860833102 } }
      : { manifest: { name: "NeoDIDRegistry" } });

    await expect(probeNeoDidRegistry("mainnet", MAINNET_REGISTRY, rpc)).resolves.toMatchObject({
      status: "verified",
      reason: "verified-deployment",
      contract: MAINNET_REGISTRY,
      contractName: "NeoDIDRegistry",
      networkMagic: 860833102,
    });
    expect(rpc).toHaveBeenCalledTimes(2);

    const mismatched = vi.fn();
    await expect(probeNeoDidRegistry("mainnet", `0x${"1".repeat(40)}`, mismatched as never)).resolves.toMatchObject({
      status: "mismatch",
      reason: "resolver-anchor-mismatch",
    });
    expect(mismatched).not.toHaveBeenCalled();
  });

  it("reports the absent testnet deployment and RPC/contract mismatches honestly", async () => {
    const noTestnetRpc = vi.fn();
    await expect(probeNeoDidRegistry("testnet", "", noTestnetRpc as never)).resolves.toMatchObject({
      status: "unavailable",
      reason: "no-network-deployment",
      contract: "",
    });
    expect(noTestnetRpc).not.toHaveBeenCalled();

    const wrongNetwork = vi.fn(async () => ({ protocol: { network: 894710606 } }));
    await expect(probeNeoDidRegistry("mainnet", MAINNET_REGISTRY, wrongNetwork)).resolves.toMatchObject({
      status: "mismatch",
      reason: "network-mismatch",
    });

    const wrongContract = vi.fn(async (_url: string, method: string) => method === "getversion"
      ? { protocol: { network: 860833102 } }
      : { manifest: { name: "AnotherContract" } });
    await expect(probeNeoDidRegistry("mainnet", MAINNET_REGISTRY, wrongContract)).resolves.toMatchObject({
      status: "mismatch",
      reason: "contract-state-mismatch",
      contractName: "AnotherContract",
    });
  });
});

describe("NeoDID passport setup orchestration", () => {
  it("builds and persists an honest testnet review without opening a wallet or write path", async () => {
    installNetworkFetch("testnet");
    const app = setupMainApp({ network: "testnet" });

    const payload = await app.actions.get("buildPassport")?.(FORM) as Awaited<PassportPayload>;

    expect(payload.registry).toMatchObject({
      status: "unavailable",
      reason: "no-network-deployment",
      contract: "",
    });
    expect(payload.assurance).toMatchObject({
      claimVerification: "not-performed",
      didWalletBinding: "not-checked",
      registryAnchor: "unavailable",
      runtimeAttestation: "unavailable",
    });
    expect(payload.resolver.snapshot).toMatchObject({ didDocument: { id: DID } });
    expect(app.store.get("neodid/passport-review-v2")).toEqual(payload);
    expect(app.store.has("neodid/passport-pending-v1")).toBe(false);
    expect(app.ensureWallet).not.toHaveBeenCalled();
    expect(app.signMessage).not.toHaveBeenCalled();
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.lastStatus.get()).toBe("passportReviewReadyDegraded");
    expect(app.setStatus).toHaveBeenLastCalledWith("passportReviewReadyDegraded", "warning");
  });

  it("signs the exact prepared mainnet JSON while keeping proof verification unclaimed", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ network: "mainnet" });
    const prepared = await app.actions.get("buildPassport")?.(FORM) as PassportPayload;

    const signed = await app.actions.get("signPassport")?.(FORM) as PassportPayload;

    expect(prepared.registry).toMatchObject({
      status: "verified",
      contract: MAINNET_REGISTRY,
      contractName: "NeoDIDRegistry",
    });
    expect(app.ensureWallet).toHaveBeenCalledTimes(1);
    expect(app.detectNetwork).toHaveBeenCalledTimes(2);
    expect(app.signMessage).toHaveBeenCalledWith(canonicalize(prepared));
    expect(app.invoke).not.toHaveBeenCalled();
    expect(signed.proof).toMatchObject({
      status: "attached",
      verification: "not-performed",
      address: ADDRESS,
      network: "mainnet",
      requestInterface: "framework.chain.signMessage(text)",
      preimageConvention: "wallet-adapter-specific-not-disclosed",
    });
    expect(signed.proof.signedMessage).toBe(canonicalize(prepared));
    expect(signed.assurance.didWalletBinding).toBe("not-checked");
    expect(app.store.get("neodid/passport-review-v2")).toEqual(signed);
  });

  it("collapses concurrent sign attempts into one wallet prompt", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ network: "mainnet" });
    await app.actions.get("buildPassport")?.(FORM);

    const [first, second] = await Promise.all([
      app.actions.get("signPassport")?.(FORM),
      app.actions.get("signPassport")?.(FORM),
    ]);

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(app.ensureWallet).toHaveBeenCalledTimes(1);
    expect(app.signMessage).toHaveBeenCalledTimes(1);
  });

  it("does not open a stale signing prompt after the review is discarded during wallet connection", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ network: "mainnet" });
    await app.actions.get("buildPassport")?.(FORM);
    let releaseWallet: ((address: string) => void) | undefined;
    app.ensureWallet.mockImplementationOnce(() => new Promise<string>((resolve) => {
      releaseWallet = resolve;
    }));

    const signing = app.actions.get("signPassport")?.(FORM);
    await vi.waitFor(() => expect(app.ensureWallet).toHaveBeenCalledTimes(1));
    await app.actions.get("discardPassportReview")?.();
    releaseWallet?.(ADDRESS);

    await expect(signing).resolves.toBeNull();
    expect(app.signMessage).not.toHaveBeenCalled();
    expect(app.result.state.passportPayload.get()).toBeNull();
  });

  it("fails closed on a wallet network mismatch before requesting a signature", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({
      network: "mainnet",
      detectedNetwork: "neo-n3-testnet",
    });
    await app.actions.get("buildPassport")?.(FORM);

    const result = await app.actions.get("signPassport")?.(FORM);

    expect(result).toBeNull();
    expect(app.signMessage).not.toHaveBeenCalled();
    expect(app.result.state.lastError.get()).toBe("walletNetworkMismatch");
    expect((app.result.state.passportPayload.get() as PassportPayload).proof.status).toBe("prepared");
  });

  it("clears old evidence and storage when a fresh resolver attempt fails", async () => {
    const { control } = installNetworkFetch("testnet");
    const app = setupMainApp({ network: "testnet" });
    await app.actions.get("buildPassport")?.(FORM);
    expect(app.result.state.passportPayload.get()).toBeTruthy();

    control.failResolver = true;
    const result = await app.actions.get("buildPassport")?.(FORM);

    expect(result).toBeNull();
    expect(app.result.state.passportPayload.get()).toBeNull();
    expect(app.store.has("neodid/passport-review-v2")).toBe(false);
    expect(app.store.has("neodid/passport-pending-v1")).toBe(false);
    expect(app.result.state.lastError.get()).toBe("resolverFailed");
  });

  it("recovers an interrupted signing checkpoint without replaying the wallet prompt", async () => {
    installNetworkFetch("testnet");
    const store = new Map<string, unknown>();
    const first = setupMainApp({ network: "testnet", store });
    const payload = await first.actions.get("buildPassport")?.(FORM) as PassportPayload;
    store.set(
      "neodid/passport-pending-v1",
      buildPassportPendingOperation("signing", "testnet", FORM, payload.digest),
    );
    first.result.cleanup();

    const recovered = setupMainApp({ network: "testnet", store });
    await recovered.result.loadData();

    expect(recovered.signMessage).not.toHaveBeenCalled();
    expect(recovered.result.state.lastStatus.get()).toBe("signingInterrupted");
    expect((recovered.result.state.passportPayload.get() as PassportPayload).digest).toBe(payload.digest);
    expect(store.has("neodid/passport-pending-v1")).toBe(false);

    await recovered.result.loadData();
    expect(recovered.signMessage).not.toHaveBeenCalled();
    expect(recovered.result.state.recoveryStatus.get()).toBe("");
    expect(recovered.result.state.lastStatus.get()).toBe("passportRecovered");

    await recovered.actions.get("discardPassportReview")?.();
    expect(recovered.result.state.passportPayload.get()).toBeNull();
    expect(recovered.result.state.recoveryStatus.get()).toBe("");
    expect(recovered.result.state.lastStatus.get()).toBe("draftChangedStatus");
  });

  it("consumes a resolver recovery checkpoint once when loadData is called twice", async () => {
    const { fetchMock } = installNetworkFetch("testnet");
    const store = new Map<string, unknown>();
    store.set(
      "neodid/passport-pending-v1",
      buildPassportPendingOperation("resolving", "testnet", FORM),
    );
    const app = setupMainApp({ network: "testnet", store });

    await app.result.loadData();
    await app.result.loadData();

    const resolverCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/morpheus/neodid/resolve?"),
    );
    expect(resolverCalls).toHaveLength(1);
    expect(app.result.state.passportPayload.get()).toBeTruthy();
    expect(store.has("neodid/passport-pending-v1")).toBe(false);
  });

  it("keeps a usable in-memory review but warns when local recovery cannot persist it", async () => {
    installNetworkFetch("testnet");
    const app = setupMainApp({ network: "testnet", storageSetFails: true });

    const payload = await app.actions.get("buildPassport")?.(FORM);

    expect(payload).toBeTruthy();
    expect(app.result.state.passportPayload.get()).toBeTruthy();
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("passportReviewReadyStorageUnavailable");
    expect(app.setStatus).toHaveBeenLastCalledWith("passportReviewReadyStorageUnavailable", "warning");
  });

  it("detects silent storage failures and can read back the exact envelope on retry", async () => {
    installNetworkFetch("testnet");
    const app = setupMainApp({
      network: "testnet",
      storageControl: { setNoops: true },
    });

    const payload = await app.actions.get("buildPassport")?.(FORM) as PassportPayload;

    expect(payload).toBeTruthy();
    expect(app.store.has("neodid/passport-review-v2")).toBe(false);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("passportReviewReadyStorageUnavailable");

    app.storageControl.setNoops = false;
    await expect(app.actions.get("retryPassportStorage")?.()).resolves.toBe(true);
    expect(app.store.get("neodid/passport-review-v2")).toEqual(payload);
    expect(app.result.state.storageHealthy.get()).toBe(true);
    expect(app.result.state.lastStatus.get()).toBe("storageRecoveryRestored");
    expect(app.setStatus).toHaveBeenLastCalledWith("storageRecoveryRestored", "success");
  });

  it("does not claim durable recovery while a stale checkpoint cannot be deleted", async () => {
    installNetworkFetch("testnet");
    const app = setupMainApp({
      network: "testnet",
      storageControl: { deleteNoops: true },
    });

    const payload = await app.actions.get("buildPassport")?.(FORM) as PassportPayload;

    expect(app.store.get("neodid/passport-review-v2")).toEqual(payload);
    expect(app.store.has("neodid/passport-pending-v1")).toBe(true);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("passportReviewReadyStorageUnavailable");

    app.storageControl.deleteNoops = false;
    await expect(app.actions.get("retryPassportStorage")?.()).resolves.toBe(true);
    expect(app.store.has("neodid/passport-pending-v1")).toBe(false);
    expect(app.result.state.storageHealthy.get()).toBe(true);
  });

  it("does not claim a durable reset when local recovery cannot be removed", async () => {
    installNetworkFetch("testnet");
    const app = setupMainApp({ network: "testnet" });
    await app.actions.get("buildPassport")?.(FORM);
    app.storageControl.deleteNoops = true;

    await app.actions.get("resetPassport")?.();

    expect(app.result.state.passportPayload.get()).toBeNull();
    expect(app.store.has("neodid/passport-review-v2")).toBe(true);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("resetStorageUnavailable");
    expect(app.setStatus).toHaveBeenLastCalledWith("resetStorageUnavailable", "warning");

    app.storageControl.deleteNoops = false;
    await app.actions.get("resetPassport")?.();
    expect(app.store.has("neodid/passport-review-v2")).toBe(false);
    expect(app.result.state.storageHealthy.get()).toBe(true);
    expect(app.result.state.lastStatus.get()).toBe("statusReady");
  });
});
