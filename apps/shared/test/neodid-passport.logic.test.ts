import { describe, expect, it, vi } from "vitest";

import {
  buildPassportPayload,
  canonicalize,
  normalizePassportForm,
  resolveDidDocument,
  validatePassportForm,
} from "../../neodid-passport/src/passport";

describe("NeoDID passport logic", () => {
  it("normalizes launch and form values into a passport form", () => {
    const form = normalizePassportForm(
      { subject: "", provider: "github", claim: "" },
      {
        subject: "did:morpheus:neo_n3:service:neodid",
        claim: "developer-pass",
        audience: "miniapp-neo-pay",
      },
    );

    expect(form).toEqual({
      subject: "did:morpheus:neo_n3:service:neodid",
      provider: "github",
      claim: "developer-pass",
      audience: "miniapp-neo-pay",
    });
    expect(validatePassportForm(form)).toBe("");
  });

  it("rejects unsupported DID methods before calling the resolver", () => {
    const form = normalizePassportForm({
      subject: "did:wrong:value",
      provider: "wallet",
      claim: "wallet-ownership",
    });

    expect(validatePassportForm(form)).toBe("passportInvalidDid");
  });

  it("resolves a DID document response and builds a stable credential payload", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/ld+json;profile="https://w3id.org/did-resolution"' },
      text: async () => JSON.stringify({
        didDocument: {
          id: "did:morpheus:neo_n3:service:neodid",
          controller: ["did:morpheus:neo_n3:service:neodid"],
          service: [
            { id: "#resolver", type: "DIDResolutionService" },
            { id: "#runtime", type: "MorpheusNeoDIDRuntime" },
          ],
        },
        didDocumentMetadata: {
          versionId: "compose-testnet-123",
          anchorContract: "0xabc",
        },
      }),
    })) as unknown as typeof fetch;

    const form = normalizePassportForm({
      subject: "did:morpheus:neo_n3:service:neodid",
      provider: "wallet",
      claim: "wallet-ownership",
      audience: "miniapp-neodid-passport",
    });
    const resolution = await resolveDidDocument(form, "testnet", fetcher);
    const payload = await buildPassportPayload(
      form,
      resolution,
      "testnet",
      "2026-06-01T00:00:00.000Z",
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/morpheus/neodid/resolve?did=did%3Amorpheus%3Aneo_n3%3Aservice%3Aneodid&network=testnet",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(payload.kind).toBe("neodid.passport.credential");
    expect(payload.didDocument.serviceCount).toBe(2);
    expect(payload.proof.type).toBe("NeoWalletSignature2026");
    expect(payload.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalize(payload)).toContain('"claim":"wallet-ownership"');
  });
});
