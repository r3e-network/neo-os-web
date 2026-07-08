/**
 * S13 app.oracle extensions spec (framework-extraction plan §2/S13).
 *
 * Covers: the wallet-free dataFeed JSON-RPC reader (canonical AGG record
 * preferred, TWELVEDATA fallback, 10^6 price descale), the pure freshness
 * math (recordTimestamp-keyed, fail-closed), capability gating when no feed
 * is deployed, and the seal lane (public-key TTL cache + stale fallback,
 * algorithm pinning, phase-tagged FrameworkSealError for key/package/store).
 */

import { describe, expect, it, vi } from "vitest";
import {
  createOracleExtensions,
  dataFeedFreshness,
  FrameworkSealError,
  MORPHEUS_ENCRYPTION_ALGORITHM,
} from "../oracle-ext";
import { FrameworkCapabilityError } from "../aa";
import { MiniAppError } from "../utils/errors";

/**
 * Real-node fixture (captured 2026-06-12 from api.n3index.dev/mainnet):
 * Struct fields: [pair, dataTimestamp, price, recordTimestamp, signature,
 * flag]. Timestamps are epoch SECONDS and the price integer is scaled by
 * 10^6 (2185000 = 2.185 USD).
 */
const LIVE_STRUCT = {
  type: "Struct",
  value: [
    { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
    { type: "Integer", value: "1781231101" },
    { type: "Integer", value: "2185000" },
    { type: "Integer", value: "1781231101" },
    { type: "ByteString", value: "b3bcd664405adedbc9d2d09183c1fb19" },
    { type: "Integer", value: "0" },
  ],
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function rpcResponse(result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id: 1, result });
}

function requestedPair(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): string {
  const body = JSON.parse(String(fetchMock.mock.calls[callIndex]?.[1]?.body ?? "{}")) as {
    params?: [string, string, Array<{ value?: string }>];
  };
  return String(body.params?.[2]?.[0]?.value ?? "");
}

function feedExtensions(fetchMock: ReturnType<typeof vi.fn>) {
  return createOracleExtensions({
    dataFeed: {
      rpcUrl: "https://rpc.test.local",
      contractHash: "0x03013f49c42a14546c8bbe58f9d434c3517fccab",
      network: "mainnet",
      fetcher: fetchMock as unknown as typeof fetch,
    },
  });
}

describe("app.oracle.dataFeed — JSON-RPC reader", () => {
  it("prefers the canonical AGG record and descales the 10^6 price", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }),
    );
    const ext = feedExtensions(fetchMock);

    await expect(ext.dataFeed.price("NEO")).resolves.toBe(2.185);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedPair(fetchMock, 0)).toBe("AGG:NEO-USD");
  });

  it("falls back to the per-provider TWELVEDATA record when AGG has no record", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rpcResponse({ state: "FAULT", exception: "no record", stack: [] }))
      .mockResolvedValueOnce(rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }));
    const ext = feedExtensions(fetchMock);

    await expect(ext.dataFeed.price("NEO")).resolves.toBe(2.185);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedPair(fetchMock, 0)).toBe("AGG:NEO-USD");
    expect(requestedPair(fetchMock, 1)).toBe("TWELVEDATA:NEO-USD");
  });

  it("reads a caller-prefixed pair verbatim without the canonical attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }),
    );
    const ext = feedExtensions(fetchMock);

    await ext.dataFeed.price("CHAINLINK:BTC-USD");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedPair(fetchMock, 0)).toBe("CHAINLINK:BTC-USD");
  });

  it("returns price together with both feed timestamps in meta mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }),
    );
    const ext = feedExtensions(fetchMock);

    await expect(ext.dataFeed.price("NEO", { meta: true })).resolves.toEqual({
      price: 2.185,
      dataTimestamp: 1781231101,
      recordTimestamp: 1781231101,
    });
  });

  it("rejects when neither the canonical nor the fallback pair has a record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      rpcResponse({ state: "FAULT", exception: "no record", stack: [] }),
    );
    const ext = feedExtensions(fetchMock);

    await expect(ext.dataFeed.price("NEO")).rejects.toThrow(
      "getLatest FAULT: no record for TWELVEDATA:NEO-USD",
    );
  });

  it("lists pairs by decoding the base64 ByteString items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      rpcResponse({
        state: "HALT",
        exception: null,
        stack: [
          {
            type: "Array",
            value: [
              { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
              { type: "Integer", value: "7" },
            ],
          },
        ],
      }),
    );
    const ext = feedExtensions(fetchMock);

    await expect(ext.dataFeed.listPairs()).resolves.toEqual(["TWELVEDATA:NEO-USD"]);
  });

  it("throws a typed capability error when the host has no deployed feed", async () => {
    const ext = createOracleExtensions({});

    expect(ext.dataFeed.available).toBe(false);
    for (const call of [() => ext.dataFeed.price("NEO"), () => ext.dataFeed.listPairs()]) {
      const error = await call().then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(FrameworkCapabilityError);
      expect((error as FrameworkCapabilityError).capability).toBe("oracle.dataFeed");
    }
  });

  it("names the network in the capability error when the contract hash is empty", async () => {
    const ext = createOracleExtensions({
      dataFeed: { rpcUrl: "https://rpc.test.local", contractHash: "", network: "testnet" },
    });

    await expect(ext.dataFeed.price("NEO")).rejects.toThrow(
      "MorpheusDataFeed not deployed on testnet",
    );
  });
});

describe("app.oracle.dataFeed — freshness math", () => {
  const RECORD_SEC = 1_781_231_101;
  const RECORD_MS = RECORD_SEC * 1000;

  it("reports fresh while the on-chain record is within the stale window", () => {
    const result = dataFeedFreshness(
      { recordTimestamp: RECORD_SEC, dataTimestamp: RECORD_SEC - 60 },
      60_000,
      RECORD_MS + 30_000,
    );

    expect(result).toEqual({
      recordTimestampMs: RECORD_MS,
      dataTimestampMs: (RECORD_SEC - 60) * 1000,
      ageMs: 30_000,
      stale: false,
    });
  });

  it("reports stale once the record age exceeds staleMs", () => {
    const result = dataFeedFreshness({ recordTimestamp: RECORD_SEC }, 60_000, RECORD_MS + 60_001);

    expect(result.stale).toBe(true);
    expect(result.ageMs).toBe(60_001);
  });

  it("treats a never-written feed (recordTimestamp 0) as stale with a null age", () => {
    const result = dataFeedFreshness(
      { recordTimestamp: 0, dataTimestamp: RECORD_SEC },
      60_000,
      RECORD_MS,
    );

    expect(result).toEqual({
      recordTimestampMs: 0,
      dataTimestampMs: RECORD_MS,
      ageMs: null,
      stale: true,
    });
    expect(dataFeedFreshness(null, 60_000).stale).toBe(true);
  });

  it("fails closed on a non-numeric stale window and open on an infinite one", () => {
    expect(dataFeedFreshness({ recordTimestamp: RECORD_SEC }, Number.NaN, RECORD_MS + 1).stale)
      .toBe(true);
    expect(
      dataFeedFreshness(
        { recordTimestamp: RECORD_SEC },
        Number.POSITIVE_INFINITY,
        RECORD_MS + 1e12,
      ).stale,
    ).toBe(false);
  });

  it("exposes the same pure function on the surface", () => {
    const ext = createOracleExtensions({});
    expect(ext.dataFeed.freshness).toBe(dataFeedFreshness);
  });
});

describe("app.oracle.seal — public key, pinning, store", () => {
  const GOOD_KEY_BODY = {
    public_key: "a2V5LW9uZQ==",
    algorithm: MORPHEUS_ENCRYPTION_ALGORITHM,
    contract: "0xseal",
  };

  function sealExtensions(
    fetchMock: ReturnType<typeof vi.fn>,
    clock: { now: number },
    extra: { publicKeyTtlMs?: number } = {},
  ) {
    return createOracleExtensions({
      appId: "test-app",
      seal: {
        network: "testnet",
        fetcher: fetchMock as unknown as typeof fetch,
        now: () => clock.now,
        publicKeyTtlMs: extra.publicKeyTtlMs ?? 1000,
      },
    });
  }

  it("fetches the oracle public key once per TTL window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(GOOD_KEY_BODY));
    const clock = { now: 0 };
    const ext = sealExtensions(fetchMock, clock);

    const first = await ext.seal.publicKey();
    clock.now = 500;
    const second = await ext.seal.publicKey();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/morpheus/oracle/public-key?network=testnet",
    );
    expect(first).toMatchObject({
      publicKey: "a2V5LW9uZQ==",
      algorithm: MORPHEUS_ENCRYPTION_ALGORITHM,
      contract: "0xseal",
      network: "testnet",
      stale: false,
    });
    expect(second).toEqual(first);
  });

  it("refreshes after the TTL and serves the stale key when the refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(GOOD_KEY_BODY))
      .mockRejectedValueOnce(new Error("edge outage"));
    const clock = { now: 0 };
    const ext = sealExtensions(fetchMock, clock);

    await ext.seal.publicKey();
    clock.now = 2000;
    const fallback = await ext.seal.publicKey();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fallback.publicKey).toBe("a2V5LW9uZQ==");
    expect(fallback.stale).toBe(true);
  });

  it("throws a key-phase FrameworkSealError when no key was ever fetched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "not configured" }, false, 503));
    const ext = sealExtensions(fetchMock, { now: 0 });

    const error = await ext.seal.publicKey().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FrameworkSealError);
    expect(error).toBeInstanceOf(MiniAppError);
    expect((error as FrameworkSealError).phase).toBe("key");
    expect((error as FrameworkSealError).message).toBe("not configured");
  });

  it("pins the encryption algorithm and never masks pin failures with the stale cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(GOOD_KEY_BODY))
      .mockResolvedValueOnce(jsonResponse({ ...GOOD_KEY_BODY, algorithm: "RSA-OAEP-256" }));
    const clock = { now: 0 };
    const ext = sealExtensions(fetchMock, clock);

    await ext.seal.publicKey();
    clock.now = 2000;
    const error = await ext.seal.publicKey().then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(FrameworkSealError);
    expect((error as FrameworkSealError).phase).toBe("package");
    expect((error as FrameworkSealError).message).toBe(
      "Unsupported Morpheus encryption algorithm: RSA-OAEP-256",
    );
  });

  it("tags envelope-encryption failures with the package phase", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(GOOD_KEY_BODY));
    const ext = sealExtensions(fetchMock, { now: 0 });

    const error = await ext.seal.encrypt(["not", "an", "object"]).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FrameworkSealError);
    expect((error as FrameworkSealError).phase).toBe("package");
    expect((error as FrameworkSealError).message).toBe(
      "Morpheus confidential payload must be a JSON object",
    );
  });

  it("stores an envelope and returns the secret reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ secret_ref: "ref-123" }));
    const ext = sealExtensions(fetchMock, { now: 0 });

    const result = await ext.seal.store({
      name: "private-transfer:0xcommit",
      ciphertext: "b64-ciphertext",
      publicEnvelope: { note_commitment: "0xcommit" },
    });

    expect(result.secretRef).toBe("ref-123");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/morpheus/confidential/store");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      network: "testnet",
      target_chain: "neo_n3",
      app_id: "test-app",
      name: "private-transfer:0xcommit",
      ciphertext: "b64-ciphertext",
      public_envelope: { note_commitment: "0xcommit" },
    });
  });

  it("tags store rejections and inline fallbacks with the store phase", async () => {
    const inlineFallback = vi.fn().mockResolvedValue(
      jsonResponse({ inline_fallback: true, message: "store degraded" }),
    );
    const missingRef = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }));

    for (const [fetchMock, message] of [
      [inlineFallback, "store degraded"],
      [missingRef, "Morpheus confidential store did not return a secret reference"],
    ] as const) {
      const ext = sealExtensions(fetchMock, { now: 0 });
      const error = await ext.seal.store({ name: "n", ciphertext: "c" }).then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(FrameworkSealError);
      expect((error as FrameworkSealError).phase).toBe("store");
      expect((error as FrameworkSealError).message).toBe(message);
    }
  });
});
