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
    expect(proof?.txHash).toMatch(/^local:/);
    expect(statuses).toContainEqual({ message: "Proof saved", type: "success" });

    await proofApp.verifyProof("1");
    expect(proofApp.verifiedProof.get()?.id).toBe(1);

    await proofApp.verifyProof(proof?.contentHash ?? "");
    expect(proofApp.verifiedProof.get()?.content).toBe("release-notes.pdf v1.2.0");

    await proofApp.verifyProof("release-notes.pdf v1.2.0");
    expect(proofApp.verifyError.get()).toBe(false);
    expect(proofApp.lastMessage.get()).toBe("Proof found");
  });

  it("copies proof evidence and can delete or clear saved proofs", async () => {
    const writeText = setupClipboard();
    const proofApp = useTimestampProofContract(t);

    await proofApp.createProof("audit artifact", () => undefined, () => undefined);
    const proof = proofApp.proofs.get()[0];

    expect(await proofApp.copyProofDigest(proof?.id ?? 0)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(proof?.contentHash);

    expect(await proofApp.copyProofReference(proof?.id ?? 0)).toBe(true);
    expect(writeText.mock.calls.at(-1)?.[0]).toContain("\"sha256\"");

    await proofApp.deleteProof(proof?.id ?? 0);
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.lastMessage.get()).toBe("Proof deleted");

    await proofApp.createProof("second artifact", () => undefined, () => undefined);
    await proofApp.clearProofs();
    expect(proofApp.proofs.get()).toHaveLength(0);
    expect(proofApp.verifiedProof.get()).toBeNull();
  });
});
