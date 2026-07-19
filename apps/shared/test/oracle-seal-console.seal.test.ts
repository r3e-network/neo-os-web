// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOracleExtensions, FrameworkSealError } from "@framework/oracle-ext";
import {
  clearPendingOracleSeal,
  readPendingOracleSeal,
  savePendingOracleSeal,
  type OracleSealStore,
  type PendingOracleSeal,
} from "../../oracle-seal-console/src/history";
import {
  ORACLE_SEAL_APP_ID,
  isMorpheusCiphertextEnvelope,
  normalizeOracleSealError,
  prepareOracleSeal,
  storePreparedOracleSeal,
  validateOracleSealKey,
  type PreparedOracleSeal,
} from "../../oracle-seal-console/src/seal";

const TESTNET_CONTRACT = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const RAW_X25519_KEY = "X+mfM9Lg+Tm9GBzniOC0vwDcZE857Za9AbdJCD7IsWM=";

function sealClient(fetcher: typeof fetch) {
  return createOracleExtensions({
    appId: ORACLE_SEAL_APP_ID,
    seal: { network: "testnet", fetcher },
  }).seal;
}

function memoryStore(): OracleSealStore & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get<T>(key: string, fallback?: T | null) {
      return values.has(key) ? values.get(key) as T : (fallback ?? null);
    },
    set(key, value) { values.set(key, value); },
    delete(key) { values.delete(key); },
  };
}

describe("Oracle Seal Console seal protocol", () => {
  it("encrypts locally, persists ciphertext before store, and never exposes source JSON", async () => {
    const events: string[] = [];
    let storeBody: Record<string, unknown> = {};
    let prepared: PreparedOracleSeal | null = null;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({
          public_key: RAW_X25519_KEY,
          algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          contract: TESTNET_CONTRACT,
        }), { status: 200 });
      }
      events.push("store");
      storeBody = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify({ secret_ref: "secret-ref-verified" }), { status: 200 });
    });

    const receipt = await prepareOracleSeal({
      network: "testnet",
      purpose: "oracle-input",
      publicRoute: "oracle://policy/check",
      payload: "{\"private_token\":\"do-not-leak\",\"threshold\":7}",
      seal: sealClient(fetcher as unknown as typeof fetch),
      verifyKey: vi.fn(),
      onPrepared: (packet) => {
        events.push("prepared");
        prepared = packet;
      },
    });

    expect(events).toEqual(["prepared", "store"]);
    expect(receipt.secretRef).toBe("secret-ref-verified");
    expect(receipt.fingerprint).toMatch(/^0x[0-9a-f]{64}$/);
    expect(prepared).not.toBeNull();
    expect(isMorpheusCiphertextEnvelope((prepared as PreparedOracleSeal).ciphertext)).toBe(true);
    const durableText = JSON.stringify(prepared);
    expect(durableText).not.toContain("do-not-leak");
    expect(durableText).not.toContain("private_token");
    expect(JSON.stringify(storeBody)).not.toContain("do-not-leak");
    expect(storeBody.ciphertext).toBe((prepared as PreparedOracleSeal).ciphertext);
    expect(storeBody.public_envelope).toMatchObject({
      kind: "miniapp.oracle_seal.packet.v1",
      ciphertext_fingerprint: receipt.fingerprint,
      oracle_contract: TESTNET_CONTRACT,
    });
  });

  it("rejects invalid or empty JSON before fetching a key", async () => {
    const fetcher = vi.fn();
    let tooDeep = "0";
    for (let index = 0; index < 65; index += 1) tooDeep = `{"nested":${tooDeep}}`;
    for (const payload of [
      "",
      "{}",
      "[]",
      "{ invalid",
      "{\"unsafe\":9007199254740993}",
      "{\"overflow\":1e400}",
      tooDeep,
    ]) {
      await expect(prepareOracleSeal({
        network: "testnet",
        purpose: "oracle-input",
        payload,
        seal: sealClient(fetcher as unknown as typeof fetch),
      })).rejects.toMatchObject({ name: "OracleSealInputError" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed on stale, cross-network, or unpinned keys", () => {
    const valid = {
      publicKey: RAW_X25519_KEY,
      algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
      contract: TESTNET_CONTRACT,
      network: "testnet",
      fetchedAt: Date.now(),
      stale: false,
    };
    expect(() => validateOracleSealKey(valid, "testnet")).not.toThrow();
    expect(() => validateOracleSealKey({ ...valid, stale: true }, "testnet")).toThrow(FrameworkSealError);
    expect(() => validateOracleSealKey({ ...valid, network: "mainnet" }, "testnet")).toThrow(FrameworkSealError);
    expect(() => validateOracleSealKey({ ...valid, contract: `0x${"11".repeat(20)}` }, "testnet")).toThrow(FrameworkSealError);
  });

  it("retries the exact packet without fetching a key or encrypting again and rejects zero receipts", async () => {
    let prepared: PreparedOracleSeal | null = null;
    const initialFetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({
          public_key: RAW_X25519_KEY,
          algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          contract: TESTNET_CONTRACT,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "store unavailable" }), { status: 503 });
    });
    await expect(prepareOracleSeal({
      network: "testnet",
      purpose: "callback-secret",
      payload: "{\"secret\":\"retry-me\"}",
      seal: sealClient(initialFetcher as unknown as typeof fetch),
      onPrepared: (packet) => { prepared = packet; },
    })).rejects.toMatchObject({ phase: "store" });
    expect(prepared).not.toBeNull();

    const publicKey = vi.fn();
    const encrypt = vi.fn();
    const store = vi.fn().mockResolvedValue({ secretRef: "retry-ref", raw: {} });
    const receipt = await storePreparedOracleSeal({
      prepared: prepared as PreparedOracleSeal,
      seal: { publicKey, encrypt, store },
    });
    expect(receipt.secretRef).toBe("retry-ref");
    expect(store).toHaveBeenCalledWith(expect.objectContaining({
      ciphertext: (prepared as PreparedOracleSeal).ciphertext,
    }));
    expect(publicKey).not.toHaveBeenCalled();
    expect(encrypt).not.toHaveBeenCalled();

    for (const secretRef of ["", "0", "0x0000", "bad\nref"]) {
      await expect(storePreparedOracleSeal({
        prepared: prepared as PreparedOracleSeal,
        seal: { publicKey, encrypt, store: vi.fn().mockResolvedValue({ secretRef, raw: {} }) },
      })).rejects.toMatchObject({ phase: "store" });
    }

    const decoded = JSON.parse(atob((prepared as PreparedOracleSeal).ciphertext));
    decoded.plaintext = "must-not-pass";
    const tainted = { ...prepared as PreparedOracleSeal, ciphertext: btoa(JSON.stringify(decoded)) };
    const taintedStore = vi.fn().mockResolvedValue({ secretRef: "must-not-run", raw: {} });
    expect(isMorpheusCiphertextEnvelope(tainted.ciphertext)).toBe(false);
    await expect(storePreparedOracleSeal({
      prepared: tainted,
      seal: { publicKey, encrypt, store: taintedStore },
    })).rejects.toMatchObject({ phase: "store" });
    expect(taintedStore).not.toHaveBeenCalled();
  });

  it("persists only validated recovery packets and ignores plaintext-tainted state", async () => {
    let prepared: PreparedOracleSeal | null = null;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({
          public_key: RAW_X25519_KEY,
          algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          contract: TESTNET_CONTRACT,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "store unavailable" }), { status: 503 });
    });
    await prepareOracleSeal({
      network: "testnet",
      purpose: "private-compute",
      payload: "{\"input\":42}",
      seal: sealClient(fetcher as unknown as typeof fetch),
      onPrepared: (packet) => { prepared = packet; },
    }).catch(() => undefined);

    const store = memoryStore();
    const pending: PendingOracleSeal = {
      version: 1,
      ...(prepared as PreparedOracleSeal),
      createdAt: Date.now(),
      attempts: 1,
    };
    savePendingOracleSeal(store, pending);
    expect(readPendingOracleSeal(store)?.fingerprint).toBe(pending.fingerprint);
    expect(JSON.stringify(readPendingOracleSeal(store))).not.toContain("\"input\":42");

    const storageKey = [...store.values.keys()][0];
    store.values.set(storageKey, { ...pending, payload: "plaintext" });
    expect(readPendingOracleSeal(store)).toBeNull();
    clearPendingOracleSeal(store);
    expect(readPendingOracleSeal(store)).toBeNull();
    expect(normalizeOracleSealError(new FrameworkSealError("store", "store unavailable"))).toBe("sealErrorStore");
  });
});
