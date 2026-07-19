// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOracleExtensions, FrameworkSealError } from "@framework/oracle-ext";
import {
  assertOracleContractPublicKey,
  isMorpheusCiphertextEnvelope,
  isPositiveAssetAmount,
  isPositiveAmount,
  isValidNeoAddress,
  normalizePrivateTransferErrorKey,
  preparePrivateTransfer,
  resolvePrivateTransferNetwork,
  storePreparedPrivateTransfer,
} from "../../private-transfer/src/seal";

const GOLDEN_PUBLIC_KEY_RAW = "X+mfM9Lg+Tm9GBzniOC0vwDcZE857Za9AbdJCD7IsWM=";
const TEST_ORACLE_CONTRACT = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";

/** Framework seal lane (app.oracle.seal) wired to an injected transport. */
function sealClient(fetcher: typeof fetch) {
  return createOracleExtensions({
    appId: "miniapp-private-transfer",
    seal: { network: "testnet", fetcher },
  }).seal;
}

describe("private-transfer sealing action helpers", () => {
  it("validates Neo address and amount before sealing", () => {
    expect(isValidNeoAddress("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32")).toBe(true);
    expect(isValidNeoAddress("0x123")).toBe(false);
    expect(isPositiveAmount("0.01")).toBe(true);
    expect(isPositiveAssetAmount("10", "NEO")).toBe(true);
    expect(isPositiveAssetAmount("10.5", "NEO")).toBe(false);
    expect(isPositiveAssetAmount("100000001", "NEO")).toBe(false);
    expect(isPositiveAssetAmount("1", "BTC")).toBe(false);
    expect(isPositiveAssetAmount("10000000000000000", "GAS")).toBe(false);
    expect(isPositiveAssetAmount("1e3", "GAS")).toBe(false);
    expect(isPositiveAssetAmount("1,000", "GAS")).toBe(false);
    expect(isPositiveAssetAmount("0.00000000", "GAS")).toBe(false);
    expect(isPositiveAssetAmount("0.00000001", "GAS")).toBe(true);
    expect(isPositiveAmount("0")).toBe(false);
  });

  it("honors explicit launch networks and rejects unknown or EVM lanes", () => {
    expect(resolvePrivateTransferNetwork("neo-n3", "testnet")).toBe("testnet");
    expect(resolvePrivateTransferNetwork("neo-n3-testnet", "testnet")).toBe("testnet");
    expect(resolvePrivateTransferNetwork("neo-n3-testnet", "mainnet")).toBe("mainnet");
    expect(resolvePrivateTransferNetwork("neo-n3", "mainnet")).toBe("mainnet");
    expect(resolvePrivateTransferNetwork("neo-x-testnet", "testnet")).toBe("unsupported");
    expect(resolvePrivateTransferNetwork("unknown", "testnet")).toBe("unsupported");
    expect(resolvePrivateTransferNetwork("neo-n3-testnet", "neo-x-testnet")).toBe("unsupported");
  });

  it("builds, encrypts, and stores a private transfer package", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({ public_key: GOLDEN_PUBLIC_KEY_RAW, algorithm: "X25519-HKDF-SHA256-AES-256-GCM", contract: TEST_ORACLE_CONTRACT }), { status: 200 });
      }
      expect(url).toBe("/api/morpheus/confidential/store");
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.public_envelope.note_commitment).toMatch(/^0x[0-9a-f]{64}$/);
      expect(body.ciphertext).toEqual(expect.any(String));
      return new Response(JSON.stringify({ secret_ref: "secret-ref-1" }), { status: 200 });
    });

    const sealed = await preparePrivateTransfer({
      appId: "miniapp-private-transfer",
      network: "testnet",
      recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      amount: "1.25",
      memo: "private note",
      seal: sealClient(fetcher as unknown as typeof fetch),
    });

    expect(sealed.secretRef).toBe("secret-ref-1");
    expect(sealed.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sealed.nullifier).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sealed.contract).toBe(TEST_ORACLE_CONTRACT);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects fractional NEO before fetching Morpheus keys", async () => {
    const fetcher = vi.fn();

    await expect(
      preparePrivateTransfer({
        appId: "miniapp-private-transfer",
        network: "testnet",
        recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
        amount: "1.25",
        asset: "NEO",
        seal: sealClient(fetcher as unknown as typeof fetch),
      }),
    ).rejects.toThrow("errorMissingInputs");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects GAS values beyond fixed8 before fetching Morpheus keys", async () => {
    const fetcher = vi.fn();
    await expect(
      preparePrivateTransfer({
        appId: "miniapp-private-transfer",
        network: "testnet",
        recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
        amount: "0.000000001",
        asset: "GAS",
        seal: sealClient(fetcher as unknown as typeof fetch),
      }),
    ).rejects.toThrow("errorMissingInputs");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("exposes ciphertext-only recovery data before a failed store call", async () => {
    const onPrepared = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({
          public_key: GOLDEN_PUBLIC_KEY_RAW,
          algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          contract: TEST_ORACLE_CONTRACT,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "runtime route unavailable" }), { status: 503 });
    });

    await expect(preparePrivateTransfer({
      appId: "miniapp-private-transfer",
      network: "testnet",
      recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      amount: "1.25",
      memo: "private note",
      seal: sealClient(fetcher as unknown as typeof fetch),
      onPrepared,
    })).rejects.toBeInstanceOf(FrameworkSealError);

    expect(onPrepared).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(onPrepared.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32");
    expect(serialized).not.toContain("1.25");
    expect(serialized).not.toContain("private note");
    expect(serialized).toContain("ciphertext");
  });

  it("surfaces public-key failures as phase-tagged key errors", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Morpheus oracle public key is unavailable" }), { status: 503 }),
    );

    const rejection = preparePrivateTransfer({
      appId: "miniapp-private-transfer",
      network: "testnet",
      recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      amount: "1.25",
      seal: sealClient(fetcher as unknown as typeof fetch),
    });

    await expect(rejection).rejects.toBeInstanceOf(FrameworkSealError);
    const error = await rejection.catch((e: unknown) => e);
    expect((error as FrameworkSealError).phase).toBe("key");
    expect(normalizePrivateTransferErrorKey(error)).toBe("sealErrorKey");
  });

  it("maps storage failures to the user-facing storage error key", () => {
    const error = new FrameworkSealError("store", "Morpheus confidential store is unavailable");
    expect(normalizePrivateTransferErrorKey(error)).toBe("sealErrorStore");
  });

  it("fails closed when an endpoint key does not match its contract source", () => {
    const key = {
      publicKey: GOLDEN_PUBLIC_KEY_RAW,
      algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
      contract: TEST_ORACLE_CONTRACT,
      network: "testnet",
      fetchedAt: Date.now(),
      stale: false,
    };
    expect(() => assertOracleContractPublicKey(key, GOLDEN_PUBLIC_KEY_RAW)).not.toThrow();
    expect(() => assertOracleContractPublicKey(key, "different-key")).toThrow(FrameworkSealError);
    expect(() => assertOracleContractPublicKey(
      { ...key, contract: `0x${"11".repeat(20)}` },
      GOLDEN_PUBLIC_KEY_RAW,
    )).toThrow(FrameworkSealError);
    expect(() => assertOracleContractPublicKey(
      key,
      GOLDEN_PUBLIC_KEY_RAW,
      "AES-128-CBC",
    )).toThrow(FrameworkSealError);
  });

  it("validates retry ciphertext structure and rejects malformed storage receipts", async () => {
    const validCiphertext = Buffer.from(JSON.stringify({
      v: 2,
      alg: "X25519-HKDF-SHA256-AES-256-GCM",
      epk: Buffer.alloc(32, 1).toString("base64"),
      iv: Buffer.alloc(12, 2).toString("base64"),
      ct: Buffer.from("ciphertext").toString("base64"),
      tag: Buffer.alloc(16, 3).toString("base64"),
    })).toString("base64");
    expect(isMorpheusCiphertextEnvelope(validCiphertext)).toBe(true);
    expect(isMorpheusCiphertextEnvelope("encrypted-packet")).toBe(false);

    await expect(storePreparedPrivateTransfer({
      appId: "miniapp-private-transfer",
      prepared: {
        name: `private-transfer:0x${"ab".repeat(32)}`,
        ciphertext: validCiphertext,
        publicEnvelope: {},
        commitment: `0x${"ab".repeat(32)}`,
        nullifier: `0x${"cd".repeat(32)}`,
        network: "testnet",
        asset: "GAS",
        contract: TEST_ORACLE_CONTRACT,
      },
      seal: {
        publicKey: vi.fn(),
        encrypt: vi.fn(),
        store: vi.fn().mockResolvedValue({ secretRef: "bad\nreference", raw: {} }),
      },
    })).rejects.toMatchObject({ phase: "store" });
  });

  it("requires the fresh endpoint key to pass the pre-encryption contract verifier", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({
        public_key: GOLDEN_PUBLIC_KEY_RAW,
        algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
        contract: TEST_ORACLE_CONTRACT,
      }), { status: 200 }),
    );
    const verifyKey = vi.fn(() => {
      throw new FrameworkSealError("key", "contract key mismatch");
    });

    await expect(preparePrivateTransfer({
      appId: "miniapp-private-transfer",
      network: "testnet",
      recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      amount: "1.25",
      seal: sealClient(fetcher as unknown as typeof fetch),
      verifyKey,
    })).rejects.toMatchObject({ phase: "key" });

    expect(verifyKey).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects a key that changes between verification and encryption", async () => {
    const verifiedKey = {
      publicKey: GOLDEN_PUBLIC_KEY_RAW,
      algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
      contract: TEST_ORACLE_CONTRACT,
      network: "testnet",
      fetchedAt: Date.now(),
      stale: false,
    };
    const store = vi.fn();
    const seal = {
      publicKey: vi.fn().mockResolvedValue(verifiedKey),
      encrypt: vi.fn().mockResolvedValue({
        ciphertext: "encrypted-with-a-different-key",
        key: { ...verifiedKey, publicKey: "A".repeat(44) },
      }),
      store,
    };

    await expect(preparePrivateTransfer({
      appId: "miniapp-private-transfer",
      network: "testnet",
      recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      amount: "1.25",
      seal,
      verifyKey: vi.fn(),
    })).rejects.toMatchObject({ phase: "key" });

    expect(store).not.toHaveBeenCalled();
  });
});
