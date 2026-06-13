import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "../constants/rpc";

/**
 * The anchor path turns the device-local journal into a verifiable proof: a
 * 0-GAS self-transfer that embeds the SHA-256 digest in the data field. These
 * tests stub the wallet SDK so the broadcast plumbing runs standalone, isolated
 * from the other timestamp-proof tests (which use the real useWallet).
 */

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

const walletState: {
  address: { value: string };
  invokeContract: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
} = {
  address: { value: ADDRESS },
  invokeContract: vi.fn(async () => ({ txid: "0xanchortx" })),
  connect: vi.fn(async () => undefined),
};

vi.mock("@shared/utils/wallet-sdk", () => ({
  useWallet: () => walletState,
}));

import { useTimestampProofContract } from "../../timestamp-proof/src/composables/useTimestampProof";

function t(key: string) {
  return key;
}

beforeEach(() => {
  localStorage.clear();
  walletState.address = { value: ADDRESS };
  walletState.invokeContract = vi.fn(async () => ({ txid: "0xanchortx" }));
  walletState.connect = vi.fn(async () => undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTimestampProofContract anchoring", () => {
  it("anchors a proof via a 0-GAS self-transfer embedding the digest", async () => {
    const proofApp = useTimestampProofContract(t);
    await proofApp.createProof("contract-v2.pdf", () => undefined, () => undefined);
    const proof = proofApp.proofs.get()[0];
    expect(proof?.anchored).toBe(false);

    const statuses: Array<{ message: string; type: string }> = [];
    const ok = await proofApp.anchorProof(proof?.id ?? 0, (message, type) =>
      statuses.push({ message, type }),
    );

    expect(ok).toBe(true);
    expect(walletState.invokeContract).toHaveBeenCalledWith({
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: ADDRESS },
        { type: "Hash160", value: ADDRESS },
        { type: "Integer", value: "0" },
        { type: "String", value: `timestamp-proof:${proof?.contentHash}` },
      ],
    });

    const anchored = proofApp.proofs.get()[0];
    expect(anchored?.anchored).toBe(true);
    expect(anchored?.anchorTxid).toBe("0xanchortx");
    expect(statuses).toContainEqual({ message: "proofAnchored", type: "success" });
  });

  it("does not re-anchor an already-anchored proof", async () => {
    const proofApp = useTimestampProofContract(t);
    await proofApp.createProof("doc", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    await proofApp.anchorProof(id);
    walletState.invokeContract.mockClear();

    const ok = await proofApp.anchorProof(id);
    expect(ok).toBe(false);
    expect(walletState.invokeContract).not.toHaveBeenCalled();
  });

  it("reports an error and leaves the proof local when the broadcast fails", async () => {
    walletState.invokeContract = vi.fn(async () => {
      throw new Error("wallet rejected");
    });
    const proofApp = useTimestampProofContract(t);
    await proofApp.createProof("doc", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    const statuses: Array<{ message: string; type: string }> = [];
    const ok = await proofApp.anchorProof(id, (message, type) =>
      statuses.push({ message, type }),
    );

    expect(ok).toBe(false);
    expect(proofApp.proofs.get()[0]?.anchored).toBe(false);
    expect(statuses.some((entry) => entry.type === "error")).toBe(true);
  });
});
