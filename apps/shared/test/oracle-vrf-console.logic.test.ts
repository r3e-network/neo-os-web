import { createHash } from "node:crypto";
import { wallet } from "@cityofzion/neon-js";
import { describe, expect, it, vi } from "vitest";
import {
  buildVrfRequestDraft,
  getVrfEnvironment,
  markVrfServiceSnapshotStale,
  probeVrfService,
  restoreVrfRequestDraft,
  stableStringify,
  verifyVrfResponse,
  type VrfServiceSnapshot,
} from "../../oracle-vrf-console/src/vrf-workbench";

const PRIVATE_KEY = "1".repeat(64);
const ACCOUNT = new wallet.Account(PRIVATE_KEY);

function messageHex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex");
}

function signedResponse(requestId: string, overrides: Record<string, unknown> = {}) {
  const randomness = "ab".repeat(32);
  const canonical = stableStringify({ randomness });
  const outputHash = createHash("sha256").update(canonical).digest("hex");
  const signature = wallet.sign(messageHex(canonical), PRIVATE_KEY);
  const base = {
    request_id: requestId,
    randomness,
    output_hash: outputHash,
    attestation_hash: outputHash,
    signature,
    public_key: ACCOUNT.publicKey,
    tee_attestation: { report_data: outputHash },
    verification: {
      output_hash: outputHash,
      attestation_hash: outputHash,
      signature,
      public_key: ACCOUNT.publicKey,
      tee_attestation: { report_data: outputHash },
    },
    timestamp: 1_783_728_000,
    vrf_method: "csprng-signed",
  };
  return { ...base, ...overrides };
}

function serviceSnapshot(
  overrides: Partial<VrfServiceSnapshot> = {},
): VrfServiceSnapshot {
  const environment = getVrfEnvironment("mainnet");
  return {
    network: "mainnet",
    freshness: "live",
    availability: "protected",
    checkedAt: "2026-07-11T00:00:00.000Z",
    apiBaseUrl: environment.apiBaseUrl,
    requestEndpoint: environment.requestEndpoint,
    rpcUrl: environment.rpcUrl,
    reportedNetwork: "mainnet",
    healthReady: true,
    runtimeOperational: true,
    workflowAdvertised: false,
    dispatchMode: "authenticated-consumer-integration",
    apiVerifierKey: ACCOUNT.publicKey,
    healthVerifierKey: ACCOUNT.publicKey,
    contractVerifierKey: ACCOUNT.publicKey,
    responseSignerKey: ACCOUNT.publicKey,
    responseSignerPinned: true,
    registryFulfillmentKey: environment.fulfillmentVerifierKey,
    keysMatch: true,
    runtimeKeyMatches: true,
    oracleContract: environment.oracleContract,
    oracleContractName: "MorpheusOracle",
    oracleChecksum: 454480263,
    callbackConsumer: environment.callbackConsumer,
    callbackContractName: "OracleCallbackConsumer",
    callbackChecksum: 1435370910,
    callbackBound: true,
    totalRequests: 7,
    totalFulfilled: 6,
    pendingRequests: 1,
    requestFeeGas: 0.01,
    errors: [],
    ...overrides,
  };
}

function base64Hex(hex: string): string {
  return Buffer.from(hex.replace(/^0x/, ""), "hex").toString("base64");
}

function base64ScriptHash(hash: string): string {
  return Buffer.from(hash.replace(/^0x/, ""), "hex").reverse().toString("base64");
}

function probeFetcher(options: { network?: "mainnet" | "testnet"; mismatch?: boolean } = {}) {
  const network = options.network ?? "mainnet";
  const environment = getVrfEnvironment(network);
  const healthKey = options.mismatch
    ? getVrfEnvironment("mainnet").oracleContract
    : environment.fulfillmentVerifierKey;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/morpheus/vrf/status?")) {
      return Response.json({
        network,
        health: {
          status: "ok",
          ready: true,
          network: options.mismatch ? "mainnet" : network,
          checks: { oracle_verifier_public_key: healthKey },
        },
        status: {
          runtime: { status: "operational" },
          catalog: { workflows: { ids: ["oracle.query", "compute.execute"] } },
        },
        key: {
          verification_public_key: `0x${environment.fulfillmentVerifierKey}`,
          source: { network, oracle_contract: environment.oracleContract },
        },
        errors: [],
      });
    }
    if (url.endsWith("/health")) {
      return Response.json({
        status: "ok",
        ready: true,
        network: options.mismatch ? "mainnet" : network,
        checks: { oracle_verifier_public_key: healthKey },
      });
    }
    if (url.endsWith("/v1/status")) {
      return Response.json({
        runtime: { status: "operational" },
        catalog: { workflows: { ids: ["oracle.query", "compute.execute"] } },
      });
    }
    if (url.endsWith("/oracle/public-key")) {
      return Response.json({
        verification_public_key: `0x${environment.fulfillmentVerifierKey}`,
        source: { network, oracle_contract: environment.oracleContract },
      });
    }
    if (url === environment.rpcUrl) {
      const requests = JSON.parse(String(init?.body)) as Array<{ id: string }>;
      return Response.json(requests.map(({ id }) => {
        if (id === "oracle-state") {
          return { id, result: { manifest: { name: "MorpheusOracle" }, nef: { checksum: 11 } } };
        }
        if (id === "callback-state") {
          return { id, result: { manifest: { name: "OracleCallbackConsumer" }, nef: { checksum: 12 } } };
        }
        const values: Record<string, { type: string; value: string }> = {
          total: { type: "Integer", value: "9" },
          fulfilled: { type: "Integer", value: "8" },
          fee: { type: "Integer", value: "1000000" },
          verifier: { type: "ByteString", value: base64Hex(environment.fulfillmentVerifierKey) },
          "callback-oracle": { type: "ByteString", value: base64ScriptHash(environment.oracleContract) },
        };
        return { id, result: { state: "HALT", stack: [values[id]] } };
      }));
    }
    throw new Error(`unexpected URL ${url}`);
  });
  return { environment, fetcher };
}

describe("Oracle VRF workbench logic", () => {
  it("builds only the canonical service body and labels it as unsubmitted", () => {
    const draft = buildVrfRequestDraft(
      { consumer: "game-engine", reference: "final", purpose: "game" },
      "mainnet",
      {
        nonce: () => "00000000-0000-4000-8000-000000000001",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
      },
    );

    expect(draft.status).toBe("draft-not-submitted");
    expect(draft.submission).toEqual({
      mode: "authenticated-consumer-integration",
      dispatched: false,
    });
    expect(draft.request).toEqual({
      request_id: "vrf:mainnet:game-engine:00000000-0000-4000-8000-000000000001",
      target_chain: "neo_n3",
    });
    expect(draft.request).not.toHaveProperty("rounds");
    expect(draft.request).not.toHaveProperty("mode");
    expect(draft.request).not.toHaveProperty("consumer");
  });

  it("restores drafts only on the same canonical network and endpoint", () => {
    const draft = buildVrfRequestDraft(
      { purpose: "raffle" },
      "mainnet",
      { nonce: () => "nonce" },
    );
    expect(restoreVrfRequestDraft(draft, "mainnet")).toEqual(draft);
    expect(restoreVrfRequestDraft(draft, "testnet")).toBeNull();
    expect(restoreVrfRequestDraft({ ...draft, endpoint: "https://attacker.test/vrf" }, "mainnet")).toBeNull();
    expect(restoreVrfRequestDraft({
      ...draft,
      context: { ...draft.context, reference: " padded reference " },
    }, "mainnet")).toBeNull();
    expect(restoreVrfRequestDraft({
      ...draft,
      request: { ...draft.request, request_id: `${draft.request.request_id}:extra` },
    }, "mainnet")).toBeNull();
    expect(restoreVrfRequestDraft({
      ...draft,
      context: { ...draft.context, purpose: ["raffle"] },
    }, "mainnet")).toBeNull();
  });

  it("fails request identity creation when secure browser randomness is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", undefined);
    try {
      expect(() => buildVrfRequestDraft({}, "mainnet")).toThrow("secureNonceUnavailable");
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });

  it("matches the canonical stable serializer", () => {
    expect(stableStringify({ z: 1, a: { d: undefined, b: 2 }, c: [undefined, 3n] }))
      .toBe('{"a":{"b":2},"c":[null,"3"],"z":1}');
  });

  it("verifies the signed randomness while keeping request correlation and attestation scope explicit", async () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "signed" });
    const result = await verifyVrfResponse(
      JSON.stringify(signedResponse(draft.request.request_id)),
      draft,
      serviceSnapshot(),
    );

    expect(result.status).toBe("verified");
    expect(result.requestCorrelationSigned).toBe(false);
    expect(result.attestation).toBe("hash-bound-not-independently-verified");
    expect(result.checks).toEqual(expect.arrayContaining([
      { key: "network-key", status: "pass" },
      { key: "output-hash", status: "pass" },
      { key: "signature", status: "pass" },
      { key: "request", status: "pass" },
    ]));
  });

  it("does not accept a valid signature as fulfillment for a different request", async () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "active" });
    const result = await verifyVrfResponse(
      JSON.stringify(signedResponse("vrf:mainnet:other:different")),
      draft,
      serviceSnapshot(),
    );
    expect(result.status).toBe("unbound");
    expect(result.reason).toBe("request-mismatch");
    expect(result.checks).toContainEqual({ key: "signature", status: "pass" });
    expect(result.checks).toContainEqual({ key: "request", status: "fail" });
  });

  it("uses the network-pinned response signer even when live service evidence is stale", async () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "active" });
    const response = signedResponse(draft.request.request_id);

    await expect(verifyVrfResponse(
      JSON.stringify(response),
      draft,
      serviceSnapshot({ freshness: "stale" }),
    )).resolves.toMatchObject({ status: "verified", reason: "ok" });
  });

  it("rejects response-signer substitution and hash tampering", async () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "active" });
    const response = signedResponse(draft.request.request_id);

    await expect(verifyVrfResponse(
      JSON.stringify(response),
      draft,
      serviceSnapshot({ responseSignerKey: `03${"22".repeat(32)}` }),
    )).resolves.toMatchObject({ status: "invalid", reason: "signer-mismatch" });

    await expect(verifyVrfResponse(
      JSON.stringify(response),
      draft,
      serviceSnapshot({ responseSignerPinned: false }),
    )).resolves.toMatchObject({ status: "blocked", reason: "service-key-unavailable" });

    await expect(verifyVrfResponse(
      JSON.stringify({ ...response, output_hash: "cd".repeat(32) }),
      draft,
      serviceSnapshot(),
    )).resolves.toMatchObject({ status: "invalid", reason: "invalid-schema" });

    await expect(verifyVrfResponse(
      JSON.stringify({ ...response, timestamp: "1783728000" }),
      draft,
      serviceSnapshot(),
    )).resolves.toMatchObject({ status: "invalid", reason: "invalid-schema" });

    await expect(verifyVrfResponse(
      JSON.stringify({ ...response, request_id: [draft.request.request_id] }),
      draft,
      serviceSnapshot(),
    )).resolves.toMatchObject({ status: "invalid", reason: "invalid-schema" });

    await expect(verifyVrfResponse(
      JSON.stringify(response),
      draft,
      serviceSnapshot({ network: "testnet" }),
    )).resolves.toMatchObject({ status: "blocked", reason: "service-key-unavailable" });
  });

  it("checks service, contract key, callback binding, and counters without touching /vrf/random", async () => {
    const { fetcher } = probeFetcher();
    const snapshot = await probeVrfService("mainnet", fetcher);

    expect(snapshot).toMatchObject({
      availability: "protected",
      healthReady: true,
      runtimeOperational: true,
      workflowAdvertised: false,
      keysMatch: true,
      runtimeKeyMatches: true,
      responseSignerKey: getVrfEnvironment("mainnet").responseSignerKey,
      responseSignerPinned: true,
      callbackBound: true,
      totalRequests: 9,
      totalFulfilled: 8,
      pendingRequests: 1,
      requestFeeGas: 0.01,
    });
    expect(fetcher.mock.calls.map(([url]) => String(url))).not.toContainEqual(expect.stringContaining("/vrf/random"));
    expect(fetcher.mock.calls.map(([url]) => String(url))).toContain("/api/morpheus/vrf/status?network=mainnet");
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("classifies a health-network or runtime-key split as a network mismatch", async () => {
    const { fetcher } = probeFetcher({ network: "testnet", mismatch: true });
    const snapshot = await probeVrfService("testnet", fetcher);
    expect(snapshot.availability).toBe("network-mismatch");
    expect(snapshot.reportedNetwork).toBe("mainnet");
    expect(snapshot.keysMatch).toBe(true);
    expect(snapshot.runtimeKeyMatches).toBe(false);
    expect(markVrfServiceSnapshotStale(snapshot, "testnet")).toMatchObject({ freshness: "stale" });
  });

  it("retains contract-key verification when the status proxy and upstream CORS reads are unavailable", async () => {
    const { environment, fetcher: healthyFetcher } = probeFetcher();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === environment.rpcUrl) return healthyFetcher(input, init);
      throw new TypeError("Failed to fetch");
    });
    const snapshot = await probeVrfService("mainnet", fetcher);
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "cors-recovery" });

    expect(snapshot).toMatchObject({
      availability: "degraded",
      healthReady: false,
      keysMatch: true,
      callbackBound: true,
    });
    await expect(verifyVrfResponse(
      JSON.stringify(signedResponse(draft.request.request_id)),
      draft,
      { ...snapshot, responseSignerKey: ACCOUNT.publicKey, responseSignerPinned: true },
    )).resolves.toMatchObject({ status: "verified", reason: "ok" });
  });

  it("does not turn malformed chain counters into believable zero values", async () => {
    const { environment, fetcher: healthyFetcher } = probeFetcher();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await healthyFetcher(input, init);
      if (String(input) !== environment.rpcUrl) return response;
      const body = await response.json() as Array<Record<string, unknown>>;
      return Response.json(body.map((entry) => entry.id === "total"
        ? {
            ...entry,
            result: { state: "HALT", stack: [{ type: "Integer", value: "9.5" }] },
          }
        : entry));
    });

    const snapshot = await probeVrfService("mainnet", fetcher);
    expect(snapshot.availability).toBe("degraded");
    expect(snapshot.totalRequests).toBeNull();
    expect(snapshot.pendingRequests).toBeNull();
    expect(snapshot.errors).toContain("request-counter");
  });

  it("rejects corrupted cached evidence instead of resurfacing it as a stale snapshot", () => {
    const environment = getVrfEnvironment("mainnet");
    const healthy = serviceSnapshot({
      apiVerifierKey: environment.fulfillmentVerifierKey,
      healthVerifierKey: environment.fulfillmentVerifierKey,
      contractVerifierKey: environment.fulfillmentVerifierKey,
      responseSignerKey: environment.responseSignerKey,
    });
    expect(markVrfServiceSnapshotStale({
      ...healthy,
      pendingRequests: 99,
    }, "mainnet")).toBeNull();
    expect(markVrfServiceSnapshotStale({
      ...healthy,
      requestEndpoint: "https://wrong.example/vrf/random",
    }, "mainnet")).toBeNull();
    expect(markVrfServiceSnapshotStale({
      ...healthy,
      responseSignerKey: healthy.contractVerifierKey,
    }, "mainnet")).toBeNull();
  });

  it("keeps mainnet response signing separate from on-chain fulfillment verification", () => {
    const environment = getVrfEnvironment("mainnet");
    expect(environment.responseSignerKey).toMatch(/^(02|03)[0-9a-f]{64}$/);
    expect(environment.fulfillmentVerifierKey).toMatch(/^(02|03)[0-9a-f]{64}$/);
    expect(environment.responseSignerKey).not.toBe(environment.fulfillmentVerifierKey);
    expect(getVrfEnvironment("testnet").responseSignerKey)
      .toBe(getVrfEnvironment("testnet").fulfillmentVerifierKey);
  });
});
