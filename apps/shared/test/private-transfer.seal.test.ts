// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOracleExtensions, FrameworkSealError } from "@framework/oracle-ext";
import {
  isPositiveAssetAmount,
  isPositiveAmount,
  isValidNeoAddress,
  normalizePrivateTransferErrorKey,
  preparePrivateTransfer,
} from "../../private-transfer/src/seal";

const GOLDEN_PUBLIC_KEY_RAW = "X+mfM9Lg+Tm9GBzniOC0vwDcZE857Za9AbdJCD7IsWM=";

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
      seal: sealClient(fetcher as unknown as typeof fetch),
    });

    expect(sealed.secretRef).toBe("secret-ref-1");
    expect(sealed.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sealed.nullifier).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sealed.contract).toBe("0xoracle");
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
});
