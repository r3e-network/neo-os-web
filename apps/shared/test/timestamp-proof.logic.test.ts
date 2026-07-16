import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { useTimestampProofContract } from "../../timestamp-proof/src/composables/useTimestampProof";

// Minimal framework wrapper (mirrors main.tsx handing ctx.framework to the
// composable). The journal tests never touch the chain; storagePrefix pins
// app.storage.local to the legacy runtime-cache namespace.
function makeApp() {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ""),
    read: vi.fn(async () => null),
    invoke: vi.fn(),
    invokeWithPayment: vi.fn(),
  };
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-timestamp-proof", storagePrefix: "miniapp-timestamp-proof:" },
  );
}

function t(key: string) {
  const messages: Record<string, string> = {
    createSuccess: "Proof saved",
    contentTooLong: "Content too long",
    digestCopied: "Digest copied",
    enterContent: "Enter content",
    error: "Error",
    invalidProof: "Invalid proof",
    localProofFound: "Device proof found",
    localSaveFailed: "Local save failed",
    journalCorrupt: "Journal corrupt",
    journalUnavailable: "Journal unavailable",
    proofDeleted: "Proof deleted",
    proofsCleared: "Proofs cleared",
    referenceCopied: "Reference copied",
    referenceInspected: "Reference inspected",
    validProof: "Proof found",
    verifyFailed: "Verification failed",
  };
  return messages[key] ?? key;
}

function setupClipboard() {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useTimestampProofContract", () => {
  it("creates local SHA-256 proofs and verifies by id, digest, or original content", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });
    const statuses: Array<{ message: string; type: string }> = [];

    await proofApp.createProof(
      "release-notes.pdf v1.2.0",
      (message, type) => statuses.push({ message, type }),
      () => undefined,
    );

    const proof = proofApp.proofs.get()[0];
    expect(proof?.id).toBe(1);
    expect(proof?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // A freshly created proof is device-local, NOT a fake on-chain reference:
    // it carries no synthetic tx-hash-shaped field and is honestly unanchored.
    expect(proof?.anchored).toBe(false);
    expect(proof?.anchorTxid).toBe("");
    expect(statuses).toContainEqual({ message: "Proof saved", type: "success" });

    await proofApp.verifyProof("1");
    expect(proofApp.verifiedProof.get()?.id).toBe(1);

    await proofApp.verifyProof(proof?.contentHash ?? "");
    expect(proofApp.verifiedProof.get()?.content).toBe("release-notes.pdf v1.2.0");

    await proofApp.verifyProof("release-notes.pdf v1.2.0");
    expect(proofApp.verifyError.get()).toBe(false);
    expect(proofApp.lastMessage.get()).toBe("Device proof found");
    expect(proofApp.verificationSource.get()).toBe("local");
  });

  it("uses an existing SHA-256 digest directly instead of hashing the digest string again", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });
    const digest = "a".repeat(64);

    await proofApp.createProof(digest, () => undefined, () => undefined);

    const proof = proofApp.proofs.get()[0];
    expect(proof?.content).toBe(digest);
    expect(proof?.contentHash).toBe(digest);
  });

  it("rejects oversized source material before hashing or writing the journal", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });
    const statuses: Array<{ message: string; type: string }> = [];

    expect(await proofApp.createProof(
      "x".repeat(50_001),
      (message, type) => statuses.push({ message, type }),
      () => undefined,
    )).toBe(false);
    expect(proofApp.proofs.get()).toEqual([]);
    expect(statuses).toContainEqual({ message: "Content too long", type: "error" });
  });

  it("counts every device proof as 'yours' regardless of creator/wallet state", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });

    // Seed two proofs with mismatched creators (e.g. one before a wallet
    // connected, one after). For a device-local journal both belong to the
    // device, so the count must stay stable and equal to the proof total.
    await proofApp.createProof("doc-a", () => undefined, () => undefined);
    await proofApp.createProof("doc-b", () => undefined, () => undefined);

    expect(proofApp.proofs.get()).toHaveLength(2);
    expect(proofApp.myProofsCount.get()).toBe(2);

    await proofApp.deleteProof(proofApp.proofs.get()[0]?.id ?? 0);
    expect(proofApp.myProofsCount.get()).toBe(1);
  });

  it("copies proof evidence and can delete or clear saved proofs", async () => {
    const writeText = setupClipboard();
    const proofApp = useTimestampProofContract({ app: makeApp(), t });

    await proofApp.createProof("audit artifact", () => undefined, () => undefined);
    const proof = proofApp.proofs.get()[0];

    expect(await proofApp.copyProofDigest(proof?.id ?? 0)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(proof?.contentHash);

    expect(await proofApp.copyProofReference(proof?.id ?? 0)).toBe(true);
    const reference = String(writeText.mock.calls.at(-1)?.[0] ?? "");
    expect(reference).toContain("\"sha256\"");
    // The exported reference must be self-describing and never carry a synthetic
    // tx-hash-shaped field that a recipient could mistake for an on-chain tx.
    expect(reference).toContain("\"anchored\": false");
    expect(reference).toContain("\"anchorStatus\": \"local\"");
    expect(reference).toContain("\"proofSource\": \"device-local\"");
    expect(reference).not.toContain("txHash");
    expect(reference).not.toContain("local:");

    await proofApp.verifyProof(reference);
    expect(proofApp.verifyError.get()).toBe(false);
    expect(proofApp.verificationSource.get()).toBe("reference");
    expect(proofApp.verifiedProof.get()).toMatchObject({
      id: proof?.id,
      contentHash: proof?.contentHash,
      anchored: false,
    });
    expect(proofApp.lastMessage.get()).toBe("Reference inspected");

    await proofApp.deleteProof(proof?.id ?? 0);
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.lastMessage.get()).toBe("Proof deleted");

    await proofApp.createProof("second artifact", () => undefined, () => undefined);
    await proofApp.clearProofs();
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.verifiedProof.get()).toBeNull();
  });

  it("does not report deletion success for a proof that does not exist", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });
    await proofApp.loadProofs();

    expect(await proofApp.deleteProof(999)).toBe(false);
    expect(proofApp.lastMessage.get()).toBe("Invalid proof");
  });

  it("does not publish a proof or run success cleanup when durable storage readback fails", async () => {
    const app = makeApp();
    vi.spyOn(app.storage.local, "set").mockImplementation(() => undefined);
    const proofApp = useTimestampProofContract({ app, t });
    const onSuccess = vi.fn();
    const statuses: Array<{ message: string; type: string }> = [];

    const created = await proofApp.createProof(
      "draft that must survive in the editor",
      (message, type) => statuses.push({ message, type }),
      onSuccess,
    );

    expect(created).toBe(false);
    expect(proofApp.proofs.get()).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(statuses).toContainEqual({ message: "Local save failed", type: "error" });
  });

  it("keeps the journal verdict at 'checking' until the first read settles (read-cell pilot)", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(), t });

    // Before loadProofs the storage verdict is NOT a settled answer — a first
    // paint must never present "ready"/"unavailable" it has not measured.
    expect(proofApp.storageState.get()).toBe("checking");
    expect(proofApp.proofs.get()).toEqual([]);

    expect(await proofApp.loadProofs()).toBe(true);
    expect(proofApp.storageState.get()).toBe("ready");
  });

  it("reports an unavailable journal instead of presenting a failed read as zero proofs", async () => {
    const app = makeApp();
    vi.spyOn(app.storage.local, "set").mockImplementation(() => undefined);
    const proofApp = useTimestampProofContract({ app, t });

    expect(await proofApp.loadProofs()).toBe(false);
    expect(proofApp.storageState.get()).toBe("unavailable");
    expect(proofApp.proofs.get()).toEqual([]);
    expect(proofApp.lastMessage.get()).toBe("Journal unavailable");
  });

  it("preserves a malformed journal for recovery instead of overwriting it as empty", async () => {
    localStorage.setItem("miniapp-timestamp-proof:proofs:v2", JSON.stringify([{ id: 1, contentHash: "broken" }]));
    const proofApp = useTimestampProofContract({ app: makeApp(), t });

    expect(await proofApp.loadProofs()).toBe(false);
    expect(proofApp.storageState.get()).toBe("corrupt");
    expect(await proofApp.createProof("must not overwrite", () => undefined, () => undefined)).toBe(false);
    expect(localStorage.getItem("miniapp-timestamp-proof:proofs:v2")).toContain("broken");
  });
});
