import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { addressToScriptHash } from "../utils/neo";
import { useSoulbound } from "../../soulbound-certificate/src/composables/useSoulbound";

const OWNER = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";
const OWNER_HASH = addressToScriptHash(OWNER);

/**
 * The little-endian "0x<hex>" form a ByteString Hash160 arrives as over RPC
 * (ownerOf parses to this shape). parseHash160 reverses it back to the
 * big-endian display hash, so the My Certificates scan can match owners.
 */
function toLittleEndianHash(displayHash: string): string {
  const hex = displayHash.replace(/^0x/, "");
  const reversed = (hex.match(/.{2}/g) ?? []).reverse().join("");
  return `0x${reversed}`;
}

function t(key: string) {
  const messages: Record<string, string> = {
    templateCreated: "Template created",
    templateUpdated: "Template updated",
    issuedSuccess: "Certificate issued",
    revokeSuccess: "Certificate revoked",
    certificateValid: "Valid",
    certificateRevoked: "Revoked",
    walletConnected: "Wallet connected",
    nameRequired: "Certificate name is required",
    issuerNameRequired: "Issuer name is required",
    categoryRequired: "Category is required",
    invalidSupply: "Invalid supply",
    templateIdRequired: "Template ID required",
    invalidRecipient: "Recipient address required",
    recipientNameRequired: "Recipient name is required",
    achievementRequired: "Achievement is required",
    invalidTokenId: "Token ID required",
    certificateNotFound: "Certificate not found",
    loadFailed: "Failed to load certificate data",
    createTemplateFailed: "Template creation failed",
    issueFailed: "Certificate issue failed",
    templateUpdateFailed: "Template update failed",
    verifyFailed: "Certificate lookup failed",
    revokeFailed: "Certificate revoke failed",
  };
  return messages[key] ?? key;
}

function setup(options: { revoked?: boolean } = {}) {
  const { revoked = false } = options;
  const invoke = vi.fn(async (operation: string) => ({
    txid: `0x${operation}`,
    event:
      operation === "issueCertificate"
        ? {
            state: [
              { value: "0x0700000000000001" },
              { value: "7" },
              { value: OWNER_HASH },
            ],
          }
        : undefined,
  }));
  const read = vi.fn(async (operation: string, _args?: unknown[]) => {
    if (operation === "getIssuerTemplates") return ["7"];
    if (operation === "getTemplateDetails") {
      return {
        id: "7",
        issuer: OWNER_HASH,
        name: "Neo Builder Graduate",
        issuerName: "Neo Academy",
        category: "Course",
        maxSupply: "1000",
        issued: "12",
        description: "Issued to builders.",
        active: true,
      };
    }
    if (operation === "getCertificateDetails") {
      return {
        tokenId: "0x0700000000000001",
        templateId: "7",
        owner: OWNER_HASH,
        templateName: "Neo Builder Graduate",
        issuerName: "Neo Academy",
        category: "Course",
        description: "Issued to builders.",
        recipientName: "Alex Chen",
        achievement: "Advanced track",
        memo: "Cohort 1",
        issuedTime: 1780300000,
        revoked,
        revokedTime: revoked ? 1780400000 : 0,
      };
    }
    return null;
  });
  const storage = {
    list: vi.fn(async () => ({})),
  };
  const chain = {
    address: createObservable(OWNER),
    ensureWallet: vi.fn(async () => OWNER),
    invoke,
    read,
  };
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-soulbound-certificate" },
  );
  const soulbound = useSoulbound({
    nftService: { validate: vi.fn() } as never,
    storageService: storage as never,
    badgeService: { award: vi.fn(async () => undefined) } as never,
    clipboard: { copy: vi.fn(async () => true) } as never,
    eventBus: { emit: vi.fn() },
    app,
    t,
  });
  return { soulbound, invoke, read };
}

describe("useSoulbound contract intents", () => {
  it("creates templates with the dedicated contract method and issuer witness", async () => {
    const { soulbound, invoke } = setup();

    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });

    expect(invoke).toHaveBeenCalledWith(
      "createTemplate",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "String", value: "Neo Builder Graduate" },
        { type: "String", value: "Neo Academy" },
        { type: "String", value: "Course" },
        { type: "Integer", value: "1000" },
        { type: "String", value: "Issued to builders." },
      ],
      { waitForEvent: "TemplateCreated", waitTimeoutMs: 30000 },
    );
  });

  it("issues, toggles, verifies, and revokes certificates through contract ABI methods", async () => {
    const { soulbound, invoke, read } = setup();

    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    expect(invoke).toHaveBeenCalledWith(
      "issueCertificate",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "7" },
        { type: "String", value: "Alex Chen" },
        { type: "String", value: "Advanced track" },
        { type: "String", value: "Cohort 1" },
      ],
      { waitForEvent: "CertificateIssued", waitTimeoutMs: 30000 },
    );

    await soulbound.toggleTemplate({
      id: "7",
      active: true,
      name: "Neo Builder Graduate",
    });
    expect(invoke).toHaveBeenCalledWith(
      "setTemplateActive",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "7" },
        { type: "Boolean", value: false },
      ],
      { waitForEvent: "TemplateUpdated", waitTimeoutMs: 30000 },
    );

    await soulbound.verifyCertificate({ tokenId: "0x0700000000000001" });
    // readRaw passes options through as a trailing arg, so match the operation +
    // args positionally rather than asserting an exact 2-arg call shape.
    const detailsRead = read.mock.calls.find((c) => c[0] === "getCertificateDetails");
    expect(detailsRead, "getCertificateDetails read").toBeTruthy();
    expect(detailsRead?.[1]).toEqual([
      { type: "ByteArray", value: "MHgwNzAwMDAwMDAwMDAwMDAx" },
    ]);
    expect(soulbound.verifiedCertificate.get()?.recipientName).toBe("Alex Chen");

    await soulbound.revokeCertificate({ tokenId: "0x0700000000000001" });
    expect(invoke).toHaveBeenCalledWith(
      "revokeCertificate",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "ByteArray", value: "MHgwNzAwMDAwMDAwMDAwMDAx" },
      ],
      { waitForEvent: "CertificateRevoked", waitTimeoutMs: 30000 },
    );
  });

  it("reports a valid lookup with the Valid status message", async () => {
    const { soulbound } = setup({ revoked: false });

    await soulbound.verifyCertificate({ tokenId: "0x0700000000000001" });

    expect(soulbound.verifiedCertificate.get()?.revoked).toBe(false);
    expect(soulbound.lastSuccess.get()).toBe("Valid");
  });

  it("does not claim a revoked certificate is Valid in the status strip", async () => {
    const { soulbound } = setup({ revoked: true });

    const cert = await soulbound.verifyCertificate({ tokenId: "0x0700000000000001" });

    expect(cert?.revoked).toBe(true);
    expect(soulbound.verifiedCertificate.get()?.revoked).toBe(true);
    // Status strip must reflect the actual revocation status, never "Valid".
    expect(soulbound.lastSuccess.get()).toBe("Revoked");
    expect(soulbound.lastSuccess.get()).not.toBe("Valid");
  });
});

describe("useSoulbound My Certificates reconstruction", () => {
  // tokensOf returns a session iterator the public RPC cannot traverse, so the
  // holdings are reconstructed from balanceOf + totalTemplates + ownerOf instead.
  function setupHolder(options: { ownsToken?: boolean; balance?: string } = {}) {
    const { ownsToken = true, balance = "1" } = options;
    const ownerOfHash = ownsToken
      ? toLittleEndianHash(OWNER_HASH)
      : toLittleEndianHash("0x00112233445566778899aabbccddeeff00112233");
    const read = vi.fn(async (operation: string, args?: unknown[]) => {
      if (operation === "tokensOf") {
        // The real node returns an un-traversable iterator here; the composable
        // must NOT rely on it.
        return { type: "InteropInterface", interface: "IIterator" };
      }
      if (operation === "balanceOf") return Number(balance);
      if (operation === "totalTemplates") return "1";
      if (operation === "getTemplateDetails") {
        return {
          id: "1",
          issuer: OWNER_HASH,
          name: "Neo Builder Graduate",
          issuerName: "Neo Academy",
          category: "Course",
          maxSupply: "1000",
          issued: "2",
          description: "Issued to builders.",
          active: true,
        };
      }
      if (operation === "ownerOf") return ownerOfHash;
      if (operation === "getCertificateDetails") {
        const tokenIdArg = (args?.[0] as { value?: string } | undefined)?.value ?? "";
        return {
          tokenId: "1-1",
          templateId: "1",
          owner: OWNER_HASH,
          templateName: "Neo Builder Graduate",
          issuerName: "Neo Academy",
          category: "Course",
          description: "Issued to builders.",
          recipientName: "Alex Chen",
          achievement: "Advanced track",
          memo: tokenIdArg ? "Cohort 1" : "",
          issuedTime: 1780300000,
          revoked: false,
          revokedTime: 0,
        };
      }
      if (operation === "getIssuerTemplates") return ["1"];
      return null;
    });
    const chain = {
      address: createObservable(OWNER),
      ensureWallet: vi.fn(async () => OWNER),
      invoke: vi.fn(),
      read,
    };
    const app = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-soulbound-certificate" },
    );
    const soulbound = useSoulbound({
      nftService: { validate: vi.fn() } as never,
      storageService: { list: vi.fn(async () => ({})) } as never,
      badgeService: { award: vi.fn(async () => undefined) } as never,
      clipboard: { copy: vi.fn(async () => true) } as never,
      eventBus: { emit: vi.fn() },
      app,
      t,
    });
    return { soulbound, read };
  }

  it("reconstructs a holder's certificates without the tokensOf iterator", async () => {
    const { soulbound, read } = setupHolder();

    await soulbound.refreshCertificates();

    // The iterator read must never be used as the source of truth.
    expect(read).not.toHaveBeenCalledWith("tokensOf", expect.anything());
    const certs = soulbound.certificates.get();
    expect(certs).toHaveLength(1);
    expect(certs[0]?.tokenId).toBe("1-1");
    expect(certs[0]?.recipientName).toBe("Alex Chen");
  });

  it("short-circuits to an empty list when balanceOf is zero", async () => {
    const { soulbound, read } = setupHolder({ balance: "0" });

    await soulbound.refreshCertificates();

    expect(soulbound.certificates.get()).toEqual([]);
    // No template/owner scan once the balance is known to be zero.
    expect(read).not.toHaveBeenCalledWith("ownerOf", expect.anything());
  });

  it("excludes tokens owned by other wallets", async () => {
    const { soulbound } = setupHolder({ ownsToken: false });

    await soulbound.refreshCertificates();

    expect(soulbound.certificates.get()).toEqual([]);
  });
});

describe("useSoulbound issue-link deep link", () => {
  const originalHref = window.location.href;

  afterEach(() => {
    window.history.replaceState({}, "", originalHref);
  });

  it("ignores the deep link when no issue-link params are present", () => {
    window.history.replaceState({}, "", "/miniapps/miniapp-soulbound-certificate");
    const { soulbound } = setup();

    expect(soulbound.deepLinkTemplateId.get()).toBe("");
    expect(soulbound.deepLinkAutoIssue.get()).toBe(false);
  });

  it("surfaces issueTemplateId and autoIssueDraft from a copied issue link", () => {
    window.history.replaceState(
      {},
      "",
      "/miniapps/miniapp-soulbound-certificate?issueTemplateId=7&autoIssueDraft=1",
    );
    const { soulbound } = setup();

    expect(soulbound.deepLinkTemplateId.get()).toBe("7");
    expect(soulbound.deepLinkAutoIssue.get()).toBe(true);

    // Once the view applies the prefill it can clear the launch flag so the
    // user is free to edit the template id afterwards.
    soulbound.consumeDeepLink();
    expect(soulbound.deepLinkTemplateId.get()).toBe("");
    expect(soulbound.deepLinkAutoIssue.get()).toBe(false);
  });
});
