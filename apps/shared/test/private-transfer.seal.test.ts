// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  isPositiveAssetAmount,
  isPositiveAmount,
  isValidNeoAddress,
  normalizePrivateTransferErrorKey,
  preparePrivateTransfer,
  PrivateTransferSealError,
} from "../../private-transfer/src/seal";

const GOLDEN_PUBLIC_KEY_RAW = "X+mfM9Lg+Tm9GBzniOC0vwDcZE857Za9AbdJCD7IsWM=";

describe("private-transfer sealing action helpers", () => {
  it("validates Neo address and amount before sealing", () => {
    expect(isValidNeoAddress("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32")).toBe(true);
    expect(isValidNeoAddress("0x123")).toBe(false);
    expect(isPositiveAmount("0.01")).toBe(true);
    expect(isPositiveAssetAmount("10", "NEO")).toBe(true);
    expect(isPositiveAssetAmount("10.5", "NEO")).toBe(false);
    expect(isPositiveAmount("0")).toBe(false);
  });

  it("builds, encrypts, and stores a private transfer package", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({ public_key: GOLDEN_PUBLIC_KEY_RAW, algorithm: "X25519-HKDF-SHA256-AES-256-GCM", contract: "0xoracle" }), { status: 200 });
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
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(sealed.secretRef).toBe("secret-ref-1");
    expect(sealed.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sealed.nullifier).toMatch(/^0x[0-9a-f]{64}$/);
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
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow("errorMissingInputs");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps storage failures to the user-facing storage error key", () => {
    const error = new PrivateTransferSealError("store", "Morpheus confidential store is unavailable");
    expect(normalizePrivateTransferErrorKey(error)).toBe("sealErrorStore");
  });
});
