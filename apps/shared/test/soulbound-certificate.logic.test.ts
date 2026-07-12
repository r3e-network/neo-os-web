import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { addressToScriptHash } from "../utils/neo";
import { useSoulbound } from "../../soulbound-certificate/src/composables/useSoulbound";
import { readCertificateTransactionOutcome } from "../../soulbound-certificate/src/certificate-safety";

const OWNER = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";
const OWNER_HASH = addressToScriptHash(OWNER);
const TXID_A = `0x${"a".repeat(64)}`;
const TXID_B = `0x${"b".repeat(64)}`;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

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
    supplyBelowIssued: "Supply below issued",
    templateUnchanged: "Template unchanged",
    verifyFailed: "Certificate lookup failed",
    revokeFailed: "Certificate revoke failed",
    transactionPending: "Pending confirmation",
    pendingReadback: "Pending readback",
    pendingContextMismatch: "Wrong recovery context",
    pendingEventMissing: "Expected event missing",
    transactionFaulted: "Transaction failed on-chain",
    transactionReceiptMissing: "Transaction receipt unavailable",
    pendingLongRunning: "Confirmation still unresolved",
    pendingBlocksWrites: "Confirm pending transaction first",
    recoveryStorageUnavailable: "Transaction recovery storage is unavailable",
    invalidTemplateId: "Invalid template ID",
    templateNotFound: "Template not found",
    templateInactive: "Template inactive",
    issuerMismatch: "Issuer mismatch",
    alreadyRevoked: "Already revoked",
    chainContextMismatch: "Wrong canonical chain context",
    certificateLoadFailed: "Certificate wallet unavailable",
  };
  return messages[key] ?? key;
}

function setup(options: {
  revoked?: boolean;
  verified?: boolean;
  templateIssuer?: string;
  returnedTokenId?: string;
  ownerOfHash?: string;
  contractAddress?: string;
  launchNetwork?: string;
  detectedNetwork?: string;
  transactionId?: string;
  returnedTemplateDescription?: string;
  returnedRecipientName?: string;
  returnedAchievement?: string;
  returnedMemo?: string;
  storageUnavailable?: boolean;
} = {}) {
  const {
    revoked = false,
    verified = true,
    templateIssuer = OWNER_HASH,
    returnedTokenId = "7-1",
    ownerOfHash = OWNER_HASH,
    contractAddress = "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b",
    launchNetwork = "neo-n3-testnet",
    detectedNetwork = "neo-n3",
    transactionId,
    returnedTemplateDescription = "Issued to builders.",
    returnedRecipientName = "Alex Chen",
    returnedAchievement = "Advanced track",
    returnedMemo = "Cohort 1",
    storageUnavailable = false,
  } = options;
  let templateActive = true;
  let templateName = "Neo Builder Graduate";
  let templateIssuerName = "Neo Academy";
  let templateCategory = "Course";
  let templateMaxSupply = "1000";
  let templateDescription = returnedTemplateDescription;
  let certificateRevoked = revoked;
  const invoke = vi.fn(async (
    operation: string,
    args: Array<{ value?: unknown }> = [],
    invokeOptions?: { onTransactionSent?: (txid: string) => void },
  ) => {
    const txid = transactionId ?? `0x${operation.length.toString(16).padStart(64, "0")}`;
    invokeOptions?.onTransactionSent?.(txid);
    if (operation === "setTemplateActive") templateActive = Boolean(args[2]?.value);
    if (operation === "updateTemplate") {
      templateName = String(args[2]?.value ?? "");
      templateIssuerName = String(args[3]?.value ?? "");
      templateCategory = String(args[4]?.value ?? "");
      templateMaxSupply = String(args[5]?.value ?? "");
      templateDescription = String(args[6]?.value ?? "");
    }
    if (operation === "revokeCertificate") certificateRevoked = true;
    const event = operation === "createTemplate"
      ? { state: [{ value: "7" }, { value: OWNER_HASH }, { value: "Neo Builder Graduate" }] }
      : operation === "issueCertificate"
        ? { state: [{ value: "7-1" }, { value: "7" }, { value: OWNER_HASH }] }
        : operation === "setTemplateActive" || operation === "updateTemplate"
          ? { state: [{ value: "7" }] }
          : { state: [{ value: "7-1" }, { value: "7" }, { value: OWNER_HASH }] };
    return { txid, event: verified ? event : null, success: true, verified };
  });
  const read = vi.fn(async (operation: string, _args?: unknown[]) => {
    if (operation === "getIssuerTemplateCount") return "1";
    if (operation === "getIssuerTemplates") return ["7"];
    if (operation === "getTemplateDetails") {
      return {
        id: "7",
        issuer: templateIssuer,
        name: templateName,
        issuerName: templateIssuerName,
        category: templateCategory,
        maxSupply: templateMaxSupply,
        issued: "12",
        description: templateDescription,
        active: templateActive,
      };
    }
    if (operation === "getCertificateDetails") {
      return {
        tokenId: returnedTokenId,
        templateId: "7",
        owner: OWNER_HASH,
        templateName,
        issuerName: templateIssuerName,
        category: templateCategory,
        description: templateDescription,
        recipientName: returnedRecipientName,
        achievement: returnedAchievement,
        memo: returnedMemo,
        issuedTime: 1780300000,
        revoked: certificateRevoked,
        revokedTime: certificateRevoked ? 1780400000 : 0,
      };
    }
    if (operation === "ownerOf") return ownerOfHash;
    return null;
  });
  const storage = {
    list: vi.fn(async () => ({})),
  };
  const chain = {
    address: createObservable(OWNER),
    contractAddress: createObservable(contractAddress),
    ensureWallet: vi.fn(async () => OWNER),
    detectNetwork: vi.fn(async () => detectedNetwork),
    invoke,
    read,
    waitForEvent: vi.fn(async (): Promise<{
      state: Array<{ value: string }>;
    } | null> => null),
  };
  const app = createMiniAppFramework(
    { services: { chain }, t, launchContext: { network: launchNetwork } } as never,
    { appId: "miniapp-soulbound-certificate" },
  );
  if (storageUnavailable) {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });
  }
  const clipboard = { copy: vi.fn(async () => true) };
  const transactionOutcomeReader = vi.fn(async (): Promise<{
    state: "halt" | "fault" | "unknown";
    event: unknown | null;
  }> => ({ state: "unknown", event: null }));
  const soulbound = useSoulbound({
    storageService: storage as never,
    badgeService: { award: vi.fn(async () => undefined) } as never,
    clipboard: clipboard as never,
    app,
    t,
    transactionOutcomeReader,
  });
  return { soulbound, invoke, read, chain, clipboard, transactionOutcomeReader };
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
      expect.objectContaining({
        waitForEvent: "TemplateCreated",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("issues, updates, toggles, verifies, and revokes certificates through contract ABI methods", async () => {
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
      expect.objectContaining({
        waitForEvent: "CertificateIssued",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );

    await soulbound.updateTemplate({
      templateId: "7",
      name: "Neo Builder Credential",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1500",
      description: "Issued to production-ready builders.",
    });
    expect(invoke).toHaveBeenCalledWith(
      "updateTemplate",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "7" },
        { type: "String", value: "Neo Builder Credential" },
        { type: "String", value: "Neo Academy" },
        { type: "String", value: "Course" },
        { type: "Integer", value: "1500" },
        { type: "String", value: "Issued to production-ready builders." },
      ],
      expect.objectContaining({
        waitForEvent: "TemplateUpdated",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
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
      expect.objectContaining({
        waitForEvent: "TemplateUpdated",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );

    await soulbound.verifyCertificate({ tokenId: "7-1" });
    // readRaw passes options through as a trailing arg, so match the operation +
    // args positionally rather than asserting an exact 2-arg call shape.
    const detailsRead = read.mock.calls.find((c) => c[0] === "getCertificateDetails");
    expect(detailsRead, "getCertificateDetails read").toBeTruthy();
    expect(detailsRead?.[1]).toEqual([
      { type: "ByteArray", value: "Ny0x" },
    ]);
    expect(soulbound.verifiedCertificate.get()?.recipientName).toBe("Alex Chen");

    await soulbound.revokeCertificate({ tokenId: "7-1" });
    expect(invoke).toHaveBeenCalledWith(
      "revokeCertificate",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "ByteArray", value: "Ny0x" },
      ],
      expect.objectContaining({
        waitForEvent: "CertificateRevoked",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("reports a valid lookup with the Valid status message", async () => {
    const { soulbound } = setup({ revoked: false });

    await soulbound.verifyCertificate({ tokenId: "7-1" });

    expect(soulbound.verifiedCertificate.get()?.revoked).toBe(false);
    expect(soulbound.lastSuccess.get()).toBe("Valid");
  });

  it("does not claim a revoked certificate is Valid in the status strip", async () => {
    const { soulbound } = setup({ revoked: true });

    const cert = await soulbound.verifyCertificate({ tokenId: "7-1" });

    expect(cert?.revoked).toBe(true);
    expect(soulbound.verifiedCertificate.get()?.revoked).toBe(true);
    // Status strip must reflect the actual revocation status, never "Valid".
    expect(soulbound.lastSuccess.get()).toBe("Revoked");
    expect(soulbound.lastSuccess.get()).not.toBe("Valid");
  });

  it("rejects a certificate readback whose token id does not match the request", async () => {
    const { soulbound } = setup({ returnedTokenId: "7-2" });

    await expect(soulbound.verifyCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Certificate not found");

    expect(soulbound.verifiedCertificate.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("rejects a certificate whose NEP-11 owner readback disagrees", async () => {
    const { soulbound } = setup({
      ownerOfHash: "0x00112233445566778899aabbccddeeff00112233",
    });

    await expect(soulbound.verifyCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Certificate not found");

    expect(soulbound.verifiedCertificate.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("binds verification to the canonical contract and an explicit network", async () => {
    const wrongContract = setup({
      contractAddress: "0x00112233445566778899aabbccddeeff00112233",
    });
    await expect(wrongContract.soulbound.verifyCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Wrong canonical chain context");
    expect(wrongContract.read).not.toHaveBeenCalledWith("getCertificateDetails", expect.anything());

    const genericNetwork = setup({ launchNetwork: "neo-n3", detectedNetwork: "neo-n3" });
    await expect(genericNetwork.soulbound.verifyCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Wrong canonical chain context");
    expect(genericNetwork.soulbound.verifiedCertificate.get()).toBeNull();
  });

  it("rejects a wallet network that disagrees with the selected launch network", async () => {
    const mismatchedNetwork = setup({
      launchNetwork: "neo-n3-mainnet",
      detectedNetwork: "neo-n3-testnet",
    });

    await expect(mismatchedNetwork.soulbound.verifyCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Wrong canonical chain context");
    expect(mismatchedNetwork.read).not.toHaveBeenCalledWith(
      "getCertificateDetails",
      expect.anything(),
    );
  });

  it("fails closed after broadcast until the exact event and readback are confirmed", async () => {
    const { soulbound, invoke } = setup({ verified: false });

    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });

    expect(soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      version: 2,
      kind: "issue-certificate",
      eventName: "CertificateIssued",
      templateId: "7",
      recipient: OWNER_HASH.toLowerCase(),
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
      network: "neo-n3-testnet",
    }));
    expect(soulbound.lastSuccess.get()).toBe("");
    expect(soulbound.lastNotice.get()).toBe("Pending confirmation");

    await expect(soulbound.createTemplate({
      name: "Second template",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "10",
      description: "Blocked duplicate write.",
    })).rejects.toThrow("Confirm pending transaction first");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("binds every authored template and certificate field before recording success", async () => {
    const createMismatch = setup({ returnedTemplateDescription: "Unexpected metadata" });
    await createMismatch.soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    expect(createMismatch.soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      version: 2,
      templateIssuerName: "Neo Academy",
      templateCategory: "Course",
      templateMaxSupply: "1000",
      templateDescription: "Issued to builders.",
    }));
    expect(createMismatch.soulbound.lastSuccess.get()).toBe("");
    expect(createMismatch.soulbound.lastNotice.get()).toBe("Pending readback");

    window.localStorage.clear();
    const issueMismatch = setup({ returnedAchievement: "Different achievement" });
    await issueMismatch.soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    expect(issueMismatch.soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      version: 2,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
      tokenId: "7-1",
    }));
    expect(issueMismatch.soulbound.lastSuccess.get()).toBe("");
    expect(issueMismatch.soulbound.lastNotice.get()).toBe("Pending readback");
  });

  it("proves recovery storage before invoking and restores a persisted pending receipt", async () => {
    const unavailable = setup({ storageUnavailable: true });
    expect(unavailable.soulbound.recoveryStorageAvailable.get()).toBe(false);
    await expect(unavailable.soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    })).rejects.toThrow("Transaction recovery storage is unavailable");
    expect(unavailable.invoke).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    expect(unavailable.soulbound.refreshRecoveryStorage()).toBe(true);
    expect(unavailable.soulbound.recoveryStorageAvailable.get()).toBe(true);
    const first = setup({ verified: false });
    await first.soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    const receipt = first.soulbound.pendingOperation.get();
    expect(receipt).toBeTruthy();

    const restored = setup({ verified: false });
    expect(restored.soulbound.recoveryStorageAvailable.get()).toBe(true);
    expect(restored.soulbound.pendingOperation.get()).toEqual(receipt);
  });

  it("keeps the receipt locked when storage disappears during reconciliation", async () => {
    const { soulbound, chain, transactionOutcomeReader } = setup({ verified: false });
    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    const receipt = soulbound.pendingOperation.get();
    chain.waitForEvent.mockResolvedValue(null);
    transactionOutcomeReader.mockResolvedValue({ state: "fault", event: null });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });

    await expect(soulbound.recoverPendingOperation(25)).resolves.toBe(false);
    expect(soulbound.pendingOperation.get()).toEqual(receipt);
    expect(soulbound.recoveryStorageAvailable.get()).toBe(false);
    expect(soulbound.lastError.get()).toBe("Transaction recovery storage is unavailable");
  });

  it("persists an exact in-memory broadcast receipt when recovery storage returns", async () => {
    const { soulbound } = setup({ verified: false });
    const nativeSetItem = Storage.prototype.setItem;
    const unavailable = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      key: string,
      value: string,
    ) {
      if (key.endsWith(":state/pendingOperation")) {
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    });

    await expect(soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    })).resolves.toBeNull();

    const receipt = soulbound.pendingOperation.get();
    expect(receipt).toEqual(expect.objectContaining({
      kind: "issue-certificate",
      txid: expect.stringMatching(/^0x[0-9a-f]{64}$/),
    }));
    expect(soulbound.recoveryStorageAvailable.get()).toBe(false);
    expect(window.localStorage.getItem("neo:miniapp-soulbound-certificate:state/pendingOperation")).toBeNull();

    unavailable.mockRestore();
    expect(soulbound.refreshRecoveryStorage()).toBe(true);
    expect(soulbound.recoveryStorageAvailable.get()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(
      "neo:miniapp-soulbound-certificate:state/pendingOperation",
    ) ?? "null")).toEqual(receipt);
  });

  it("keeps version-1 pending receipts recoverable across the metadata-binding upgrade", () => {
    const legacy = {
      version: 1,
      kind: "create-template",
      txid: TXID_A,
      eventName: "TemplateCreated",
      network: "neo-n3-testnet",
      contractHash: "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b",
      issuer: OWNER_HASH,
      createdAt: Date.now(),
      templateName: "Legacy credential",
    };
    window.localStorage.setItem(
      "neo:miniapp-soulbound-certificate:state/pendingOperation",
      JSON.stringify(legacy),
    );

    expect(setup({ verified: false }).soulbound.pendingOperation.get()).toEqual(legacy);
  });

  it("never records success without a valid durable Neo transaction receipt", async () => {
    const { soulbound } = setup({ transactionId: "0xabc123" });

    await expect(soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    })).rejects.toThrow("Transaction receipt unavailable");

    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("recovers a pending issue only from its exact tx event plus authoritative state", async () => {
    const { soulbound, chain } = setup({ verified: false });
    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    const pending = soulbound.pendingOperation.get();
    expect(pending?.txid).toBeTruthy();
    chain.waitForEvent.mockResolvedValue({
      state: [
        { value: "7-1" },
        { value: "7" },
        { value: OWNER_HASH },
      ],
    });

    await expect(soulbound.recoverPendingOperation(25)).resolves.toBe(true);

    expect(chain.waitForEvent).toHaveBeenCalledWith(pending?.txid, "CertificateIssued", 25);
    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("Certificate issued");
    expect(soulbound.verifiedCertificate.get()?.tokenId).toBe("7-1");
  });

  it("recovers a pending template update only after its metadata readback matches", async () => {
    const { soulbound, chain } = setup({ verified: false });
    await soulbound.updateTemplate({
      templateId: "7",
      name: "Neo Builder Credential",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1500",
      description: "Issued to production-ready builders.",
    });
    expect(soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      kind: "update-template",
      eventName: "TemplateUpdated",
      templateId: "7",
      templateName: "Neo Builder Credential",
      templateMaxSupply: "1500",
    }));
    chain.waitForEvent.mockResolvedValue({ state: [{ value: "7" }] });

    await expect(soulbound.recoverPendingOperation(25)).resolves.toBe(true);

    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("Template updated");
  });

  it("keeps pending recovery bound to the wallet that broadcast it", async () => {
    const { soulbound, chain } = setup({ verified: false });
    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    chain.address.set("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq");

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(chain.waitForEvent).not.toHaveBeenCalled();
    expect(soulbound.pendingOperation.get()?.kind).toBe("create-template");
    expect(soulbound.lastNotice.get()).toBe("Wrong recovery context");
  });

  it("keeps recovery pending when the exact confirmation event is unavailable", async () => {
    const { soulbound, chain } = setup({ verified: false });
    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    chain.waitForEvent.mockResolvedValue(null);

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(soulbound.pendingOperation.get()?.kind).toBe("create-template");
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("unlocks a pending write only after an authoritative FAULT outcome", async () => {
    const { soulbound, transactionOutcomeReader } = setup({ verified: false });
    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    transactionOutcomeReader.mockResolvedValue({ state: "fault", event: null });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastError.get()).toBe("Transaction failed on-chain");
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("keeps HALT transactions pending until the expected event can be bound", async () => {
    const { soulbound, transactionOutcomeReader } = setup({ verified: false });
    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    transactionOutcomeReader.mockResolvedValue({ state: "halt", event: null });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(soulbound.pendingOperation.get()?.kind).toBe("create-template");
    expect(soulbound.lastNotice.get()).toBe("Expected event missing");
  });

  it("recovers from the exact RPC application-log event when the event index is lagging", async () => {
    const { soulbound, transactionOutcomeReader } = setup({ verified: false });
    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    transactionOutcomeReader.mockResolvedValue({
      state: "halt",
      event: {
        state: [{ value: "7-1" }, { value: "7" }, { value: OWNER_HASH }],
      },
    });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(true);

    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("Certificate issued");
  });

  it("falls back to the application log when the event index request fails", async () => {
    const { soulbound, chain, transactionOutcomeReader } = setup({ verified: false });
    await soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });
    chain.waitForEvent.mockRejectedValue(new Error("index unavailable"));
    transactionOutcomeReader.mockResolvedValue({
      state: "halt",
      event: {
        state: [{ value: "7-1" }, { value: "7" }, { value: OWNER_HASH }],
      },
    });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(true);

    expect(soulbound.pendingOperation.get()).toBeNull();
    expect(soulbound.lastSuccess.get()).toBe("Certificate issued");
  });

  it("keeps an unknown receipt locked after 24 hours and changes only the guidance", async () => {
    const { soulbound } = setup({ verified: false });
    await soulbound.createTemplate({
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    });
    const pending = soulbound.pendingOperation.get();
    expect(pending).toBeTruthy();
    soulbound.pendingOperation.set({
      ...pending!,
      createdAt: Date.now() - 25 * 60 * 60 * 1_000,
    });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      kind: "create-template",
      txid: pending?.txid,
    }));
    expect(soulbound.lastNotice.get()).toBe("Confirmation still unresolved");
  });

  it("does not clear revoke recovery for a different token's event", async () => {
    const { soulbound, chain } = setup({ verified: false });
    await soulbound.revokeCertificate({ tokenId: "7-1" });
    chain.waitForEvent.mockResolvedValue({
      state: [{ value: "7-2" }, { value: "7" }, { value: OWNER_HASH }],
    });

    await expect(soulbound.recoverPendingOperation(5)).resolves.toBe(false);

    expect(soulbound.pendingOperation.get()).toEqual(expect.objectContaining({
      kind: "revoke-certificate",
      tokenId: "7-1",
    }));
    expect(soulbound.lastSuccess.get()).toBe("");
  });

  it("rechecks issuer authority on-chain before issue or revoke wallet writes", async () => {
    const otherIssuer = "0x00112233445566778899aabbccddeeff00112233";
    const { soulbound, invoke } = setup({ templateIssuer: otherIssuer });

    await expect(soulbound.issueCertificate({
      templateId: "7",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "",
    })).rejects.toThrow("Issuer mismatch");
    await expect(soulbound.revokeCertificate({ tokenId: "7-1" }))
      .rejects.toThrow("Issuer mismatch");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects unsafe ids, recipients, and oversized contract text before invoking", async () => {
    const { soulbound, invoke } = setup();

    await expect(soulbound.issueCertificate({
      templateId: "0",
      recipient: OWNER,
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "",
    })).rejects.toThrow("Invalid template ID");
    await expect(soulbound.issueCertificate({
      templateId: "7",
      recipient: "not-an-address",
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "",
    })).rejects.toThrow("Recipient address required");
    await expect(soulbound.issueCertificate({
      templateId: "7",
      recipient: "0x0000000000000000000000000000000000000000",
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "",
    })).rejects.toThrow("Recipient address required");
    await expect(soulbound.verifyCertificate({ tokenId: "0xabc123" }))
      .rejects.toThrow("Token ID required");
    await expect(soulbound.createTemplate({
      name: "x".repeat(61),
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "10",
      description: "",
    })).rejects.toThrow();
    await expect(soulbound.updateTemplate({
      templateId: "7",
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "10",
      description: "Issued to builders.",
    })).rejects.toThrow("Supply below issued");
    await expect(soulbound.updateTemplate({
      templateId: "7",
      name: "Neo Builder Graduate",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    })).rejects.toThrow("Template unchanged");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("copies portable HTTPS issue and verification links", async () => {
    const { soulbound, clipboard } = setup();

    await soulbound.copyIssueLink({ id: "7" });
    await soulbound.copyVerifyLink("7-1");

    expect(clipboard.copy).toHaveBeenNthCalledWith(
      1,
      "https://neomini.app/miniapps/miniapp-soulbound-certificate?issueTemplateId=7&autoIssueDraft=1",
      { successKey: "issueLinkCopied" },
    );
    expect(clipboard.copy).toHaveBeenNthCalledWith(
      2,
      "https://neomini.app/miniapps/miniapp-soulbound-certificate?verifyTokenId=7-1",
      { successKey: "verifyLinkCopied" },
    );
  });
});

describe("useSoulbound issuer template pagination", () => {
  function templateRecord(id: string) {
    return {
      id,
      issuer: OWNER_HASH,
      name: `Credential ${id}`,
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      issued: "0",
      description: "Issued to builders.",
      active: true,
    };
  }

  it("loads every issuer template page before marking the list complete", async () => {
    const { soulbound, read } = setup();
    read.mockImplementation(async (operation: string, args?: unknown[]) => {
      if (operation === "getIssuerTemplateCount") return "61";
      if (operation === "getIssuerTemplates") {
        const offset = Number((args?.[1] as { value?: unknown } | undefined)?.value ?? 0);
        const limit = Number((args?.[2] as { value?: unknown } | undefined)?.value ?? 0);
        return Array.from(
          { length: Math.min(limit, 61 - offset) },
          (_, index) => String(offset + index + 1),
        );
      }
      if (operation === "getTemplateDetails") {
        return templateRecord(String((args?.[0] as { value?: unknown } | undefined)?.value ?? ""));
      }
      return null;
    });

    await soulbound.refreshTemplates();

    expect(soulbound.templates.get()).toHaveLength(61);
    expect(soulbound.templatesSource.get()).toBe("chain");
    expect(read).toHaveBeenCalledWith("getIssuerTemplates", [
      expect.objectContaining({ value: OWNER_HASH }),
      expect.objectContaining({ value: "0" }),
      expect.objectContaining({ value: "50" }),
    ], undefined);
    expect(read).toHaveBeenCalledWith("getIssuerTemplates", [
      expect.objectContaining({ value: OWNER_HASH }),
      expect.objectContaining({ value: "50" }),
      expect.objectContaining({ value: "11" }),
    ], undefined);
  });

  it("labels a safely bounded issuer list partial instead of claiming completeness", async () => {
    const { soulbound, read } = setup();
    read.mockImplementation(async (operation: string, args?: unknown[]) => {
      if (operation === "getIssuerTemplateCount") return "501";
      if (operation === "getIssuerTemplates") {
        const offset = Number((args?.[1] as { value?: unknown } | undefined)?.value ?? 0);
        const limit = Number((args?.[2] as { value?: unknown } | undefined)?.value ?? 0);
        return Array.from({ length: limit }, (_, index) => String(offset + index + 1));
      }
      if (operation === "getTemplateDetails") {
        return templateRecord(String((args?.[0] as { value?: unknown } | undefined)?.value ?? ""));
      }
      return null;
    });

    await soulbound.refreshTemplates();

    expect(soulbound.templates.get()).toHaveLength(500);
    expect(soulbound.templatesSource.get()).toBe("partial");
    expect(read.mock.calls.filter(([operation]) => operation === "getIssuerTemplates")).toHaveLength(10);
  });
});

describe("useSoulbound My Certificates reconstruction", () => {
  // tokensOf returns a session iterator the public RPC cannot traverse, so the
  // holdings are reconstructed from balanceOf + totalTemplates + ownerOf instead.
  function setupHolder(options: { ownsToken?: boolean; balance?: unknown } = {}) {
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
      if (operation === "balanceOf") return balance;
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
      if (operation === "getIssuerTemplateCount") return "1";
      if (operation === "getIssuerTemplates") return ["1"];
      return null;
    });
    const chain = {
      address: createObservable(OWNER),
      contractAddress: createObservable("0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b"),
      ensureWallet: vi.fn(async () => OWNER),
      detectNetwork: vi.fn(async () => "neo-n3-testnet"),
      invoke: vi.fn(),
      read,
    };
    const app = createMiniAppFramework(
      { services: { chain }, t, launchContext: { network: "neo-n3-testnet" } } as never,
      { appId: "miniapp-soulbound-certificate" },
    );
    const soulbound = useSoulbound({
      storageService: { list: vi.fn(async () => ({})) } as never,
      badgeService: { award: vi.fn(async () => undefined) } as never,
      clipboard: { copy: vi.fn(async () => true) } as never,
      app,
      t,
      transactionOutcomeReader: vi.fn(async () => ({ state: "unknown" as const, event: null })),
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
    expect(soulbound.certificatesSource.get()).toBe("chain");
  });

  it("short-circuits to an empty list when balanceOf is zero", async () => {
    const { soulbound, read } = setupHolder({ balance: "0" });

    await soulbound.refreshCertificates();

    expect(soulbound.certificates.get()).toEqual([]);
    expect(soulbound.certificatesSource.get()).toBe("chain");
    // No template/owner scan once the balance is known to be zero.
    expect(read).not.toHaveBeenCalledWith("ownerOf", expect.anything());
  });

  it("never turns an unreadable balance into a trusted empty wallet", async () => {
    const { soulbound, read } = setupHolder({ balance: null });

    await soulbound.refreshCertificates();

    expect(soulbound.certificates.get()).toEqual([]);
    expect(soulbound.certificatesSource.get()).toBe("failed");
    expect(soulbound.lastError.get()).toBe("Certificate wallet unavailable");
    expect(read).not.toHaveBeenCalledWith("totalTemplates", expect.anything());
  });

  it("excludes tokens owned by other wallets", async () => {
    const { soulbound } = setupHolder({ ownsToken: false });

    await soulbound.refreshCertificates();

    expect(soulbound.certificates.get()).toEqual([]);
    expect(soulbound.certificatesSource.get()).toBe("partial");
  });
});

describe("soulbound transaction execution reconciliation", () => {
  it("extracts the expected event from a HALT application log", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b",
            eventname: "CertificateIssued",
            state: {
              type: "Array",
              value: [
                { type: "ByteString", value: "Ny0x" },
                { type: "Integer", value: "7" },
                { type: "ByteString", value: "ABEiM0RVZneImaq7zN3u/wARIjM=" },
              ],
            },
          }],
        }],
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await readCertificateTransactionOutcome(
      "neo-n3-testnet",
      TXID_A,
      "CertificateIssued",
      "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b",
    );

    expect(outcome.state).toBe("halt");
    expect(outcome.event).toEqual({
      state: [
        { value: "7-1" },
        { value: 7 },
        { value: "0x00112233445566778899aabbccddeeff00112233" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.n3index.dev/testnet",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces a mined FAULT without fabricating an event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }), { status: 200 })));

    await expect(readCertificateTransactionOutcome(
      "neo-n3-mainnet",
      TXID_B,
      "TemplateCreated",
      "0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b",
    )).resolves.toEqual({ state: "fault", event: null });
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
