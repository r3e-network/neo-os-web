import { describe, expect, it, vi } from "vitest";
import {
  buildLocalComputeRequest,
  COMPUTE_WORKFLOW_ID,
  inspectComputeSource,
  LOCAL_PACKAGE_VERSION,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_DEPTH,
  REQUEST_DIGEST_SCOPE,
  resolveComputeRouteSnapshot,
} from "../../oracle-compute-lab/src/compute-workbench";

describe("Oracle Compute Lab request packaging", () => {
  it("creates a real SHA-256-bound local package without inventing execution output", async () => {
    const request = await buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"secret":"stays-local","asset":"GAS"}',
    }, "mainnet");

    expect(request.kind).toBe("oracle.compute.request");
    expect(request.packageFormat).toBe(LOCAL_PACKAGE_VERSION);
    expect(request.requestDigestScope).toBe(REQUEST_DIGEST_SCOPE);
    expect(request.requestDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.payload.inputDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.payload.workflow).toBe(COMPUTE_WORKFLOW_ID);
    expect(request.payload).toMatchObject({
      sourcePolicy: "digest-only",
      encryption: "none",
      dispatchReady: false,
      execution: "not_dispatched",
    });
    expect(request.payload).not.toHaveProperty("input");
    expect(request.payload).not.toHaveProperty("requestDigest");
    expect(JSON.stringify(request)).not.toContain("stays-local");
    expect(request.boundary).toEqual({
      jobId: null,
      compute: "not_executed",
      result: "unavailable",
      proof: "unavailable",
      attestation: "unavailable",
      pending: "not_applicable",
      retry: "not_applicable",
      readback: "not_applicable",
      reason: "authenticated_runtime_dispatch_not_implemented",
    });
  });

  it("includes source only after explicit public disclosure", async () => {
    const request = await buildLocalComputeRequest({
      profile: "proof-review",
      disclosure: "public-input",
      source: '{"claim":"public"}',
    }, "testnet");

    expect(request.payload.input).toEqual({ claim: "public" });
    expect(request.routeSnapshot.network).toBe("testnet");
  });

  it("canonicalizes JSON object keys so equivalent input produces the same digests", async () => {
    const left = await buildLocalComputeRequest({
      profile: "batch-transform",
      disclosure: "digest-only",
      source: '{"b":2,"a":{"d":4,"c":3}}',
    }, "mainnet");
    const right = await buildLocalComputeRequest({
      profile: "batch-transform",
      disclosure: "digest-only",
      source: '{"a":{"c":3,"d":4},"b":2}',
    }, "mainnet");

    expect(left.payload.inputDigest).toBe(right.payload.inputDigest);
    expect(left.requestDigest).toBe(right.requestDigest);
  });

  it("keeps the source digest about source while the request digest also binds intent", async () => {
    const risk = await buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"asset":"GAS"}',
    }, "mainnet");
    const proof = await buildLocalComputeRequest({
      profile: "proof-review",
      disclosure: "digest-only",
      source: '{"asset":"GAS"}',
    }, "mainnet");

    expect(risk.payload.inputDigest).toBe(proof.payload.inputDigest);
    expect(risk.requestDigest).not.toBe(proof.requestDigest);
  });

  it("binds the request digest to the selected registry network and route", async () => {
    const draft = {
      profile: "risk-signal" as const,
      disclosure: "digest-only" as const,
      source: '{"asset":"GAS"}',
    };
    const mainnet = await buildLocalComputeRequest(draft, "mainnet");
    const testnet = await buildLocalComputeRequest(draft, "testnet");

    expect(mainnet.payload.inputDigest).toBe(testnet.payload.inputDigest);
    expect(mainnet.requestDigest).not.toBe(testnet.requestDigest);
    expect(mainnet.routeSnapshot.network).toBe("mainnet");
    expect(testnet.routeSnapshot.network).toBe("testnet");
    expect(mainnet.requestDigestScope).toBe("oracle-compute-lab/payload+route-snapshot-v1");
  });

  it("rejects blank, malformed, and oversized source before hashing", async () => {
    expect(inspectComputeSource("")).toMatchObject({ valid: false, error: "source_required" });
    expect(inspectComputeSource("{not json")).toMatchObject({ valid: false, error: "invalid_json" });
    expect(inspectComputeSource(`"${"x".repeat(MAX_SOURCE_BYTES)}"`)).toMatchObject({
      valid: false,
      error: "source_too_large",
    });
    await expect(buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: "{not json",
    })).rejects.toThrow("invalid_json");
  });

  it("counts the full source bytes and rejects pathological nesting with a clear state", () => {
    expect(inspectComputeSource(`${" ".repeat(MAX_SOURCE_BYTES)}{}`)).toMatchObject({
      valid: false,
      error: "source_too_large",
    });

    let nested: unknown = 1;
    for (let depth = 0; depth <= MAX_SOURCE_DEPTH; depth += 1) nested = [nested];
    expect(inspectComputeSource(JSON.stringify(nested))).toMatchObject({
      valid: false,
      error: "source_too_deep",
    });
  });

  it("rejects numbers that JSON.parse would silently change before hashing", async () => {
    expect(inspectComputeSource('{"unsafe":9007199254740993}')).toMatchObject({
      valid: false,
      error: "source_unsafe_number",
    });
    expect(inspectComputeSource('{"overflow":1e400}')).toMatchObject({
      valid: false,
      error: "source_unsafe_number",
    });
    await expect(buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "public-input",
      source: '{"unsafe":9007199254740993}',
    }, "mainnet")).rejects.toThrow("source_unsafe_number");
  });

  it("rejects unknown intent/disclosure values at the workbench boundary", async () => {
    await expect(buildLocalComputeRequest({
      profile: "unknown" as never,
      disclosure: "digest-only",
      source: "{}",
    }, "mainnet")).rejects.toThrow("invalid_profile");
    await expect(buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "encrypted" as never,
      source: "{}",
    }, "mainnet")).rejects.toThrow("invalid_disclosure");
  });

  it("fails honestly when browser SHA-256 is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", undefined);
    try {
      await expect(buildLocalComputeRequest({
        profile: "risk-signal",
        disclosure: "digest-only",
        source: "{}",
      }, "mainnet")).rejects.toThrow("shaUnavailable");
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });

  it("uses the checked-in compute route contract without calling it live", () => {
    const mainnet = resolveComputeRouteSnapshot("mainnet");
    const testnet = resolveComputeRouteSnapshot("testnet");

    expect(mainnet).toMatchObject({
      workflow: "compute.execute",
      route: "/compute/execute",
      policies: ["tenant", "risk"],
      teeRequired: true,
      deliveryMode: "api_response",
      runtimeBaseUrl: "https://oracle.meshmini.app/mainnet",
      registryOracleContract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
    });
    expect(testnet.runtimeBaseUrl).toBe("https://oracle.meshmini.app/testnet");
    expect(testnet.registryOracleContract).toBe("0xf54d8584ef82315c1800373272ab08ae0db2d5ef");
  });
});
