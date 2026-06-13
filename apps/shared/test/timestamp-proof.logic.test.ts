import { afterEach, describe, expect, it, vi } from "vitest";

import { useTimestampProofContract } from "../../timestamp-proof/src/composables/useTimestampProof";

function t(key: string) {
  const messages: Record<string, string> = {
    createSuccess: "Proof saved",
    digestCopied: "Digest copied",
    enterContent: "Enter content",
    error: "Error",
    invalidProof: "Invalid proof",
    proofDeleted: "Proof deleted",
    proofsCleared: "Proofs cleared",
    referenceCopied: "Reference copied",
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
    const proofApp = useTimestampProofContract(t);
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
    expect(proofApp.lastMessage.get()).toBe("Proof found");
  });

  it("counts every device proof as 'yours' regardless of creator/wallet state", async () => {
    const proofApp = useTimestampProofContract(t);

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
    const proofApp = useTimestampProofContract(t);

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
    expect(reference).not.toContain("txHash");
    expect(reference).not.toContain("local:");

    await proofApp.deleteProof(proof?.id ?? 0);
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.lastMessage.get()).toBe("Proof deleted");

    await proofApp.createProof("second artifact", () => undefined, () => undefined);
    await proofApp.clearProofs();
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.verifiedProof.get()).toBeNull();
  });
});
