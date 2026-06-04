import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { useSoulbound } from "../../soulbound-certificate/src/composables/useSoulbound";

const OWNER = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";
const OWNER_HASH = addressToScriptHash(OWNER);

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
  const read = vi.fn(async (operation: string) => {
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
  const soulbound = useSoulbound({
    nftService: { validate: vi.fn() } as never,
    storageService: storage as never,
    badgeService: { award: vi.fn(async () => undefined) } as never,
    clipboard: { copy: vi.fn(async () => true) } as never,
    eventBus: { emit: vi.fn() },
    chain: {
      address: createObservable(OWNER),
      ensureWallet: vi.fn(async () => OWNER),
      invoke,
      read,
    },
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
    expect(read).toHaveBeenCalledWith("getCertificateDetails", [
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
