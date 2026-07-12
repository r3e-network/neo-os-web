import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import type { MiniAppFramework } from "../react";
import { GAS_HASH } from "../constants/rpc";
import { addressToScriptHash } from "../utils/neo";

/**
 * The anchor path turns the device-local journal into a verifiable proof: a
 * 0-GAS self-transfer that embeds the SHA-256 digest in the data field. These
 * tests stub the wallet SDK (the address ref + connect stay on the SDK per the
 * §3.6 address-poll exemption) and drive the broadcast through the framework
 * chain surface the composable now uses (app.chain.invoke).
 */

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const TXID = `0x${"a".repeat(64)}`;

const walletState: {
  address: { value: string };
  connect: ReturnType<typeof vi.fn>;
} = {
  address: { value: ADDRESS },
  connect: vi.fn(async () => undefined),
};

vi.mock("@shared/utils/wallet-sdk", () => ({
  useWallet: () => walletState,
}));

import { useTimestampProofContract } from "../../timestamp-proof/src/composables/useTimestampProof";

function t(key: string) {
  return key;
}

// Wrap a mock chain in the MiniApp framework SDK, mirroring how main.tsx hands
// ctx.framework to the composable. storagePrefix pins app.storage.local to the
// legacy runtime-cache namespace (defineMiniApp does the same), so the journal
// still lives at the exact pre-framework
// "miniapp-timestamp-proof:proofs:v2" localStorage key.
function makeApp(
  invoke: ReturnType<typeof vi.fn>,
  detectedNetwork = "neo-n3-mainnet",
): MiniAppFramework {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ADDRESS),
    detectNetwork: vi.fn(async () => detectedNetwork),
    read: vi.fn(async () => null),
    invoke,
    invokeWithPayment: vi.fn(),
  };
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-timestamp-proof", storagePrefix: "miniapp-timestamp-proof:" },
  );
}

let invoke: ReturnType<typeof vi.fn>;
let inspectAnchor: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  walletState.address = { value: ADDRESS };
  walletState.connect = vi.fn(async () => undefined);
  invoke = vi.fn(async (_operation, _args, options) => {
    options?.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: true };
  });
  inspectAnchor = vi.fn(async (input: { expectedDigest?: string }) => ({
    status: "confirmed",
    digest: input.expectedDigest ?? "",
    blockTime: 1_700_000_000_000,
    reason: "confirmed",
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTimestampProofContract anchoring", () => {
  it("anchors a proof via a 0-GAS self-transfer embedding the digest", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("contract-v2.pdf", () => undefined, () => undefined);
    const proof = proofApp.proofs.get()[0];
    expect(proof?.anchored).toBe(false);

    const statuses: Array<{ message: string; type: string }> = [];
    const ok = await proofApp.anchorProof(proof?.id ?? 0, (message, type) =>
      statuses.push({ message, type }),
    );

    expect(ok).toBe(true);
    // Native GAS transfer arguments use canonical script hashes; the raw
    // address passthrough lane is reserved for deployed ABI quirks.
    expect(invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: addressToScriptHash(ADDRESS) },
        { type: "Hash160", value: addressToScriptHash(ADDRESS) },
        { type: "Integer", value: "0" },
        { type: "String", value: `timestamp-proof:${proof?.contentHash}` },
      ],
      expect.objectContaining({
        scriptHash: GAS_HASH,
        waitForEvent: "Transfer",
        onTransactionSent: expect.any(Function),
      }),
    );
    // Storage-prefix compatibility: the journal still lives at the exact
    // pre-framework runtime-cache key.
    expect(
      window.localStorage.getItem("miniapp-timestamp-proof:proofs:v2"),
    ).toContain(TXID);

    const anchored = proofApp.proofs.get()[0];
    expect(anchored?.anchored).toBe(true);
    expect(anchored?.anchorTxid).toBe(TXID);
    expect(anchored?.anchorStatus).toBe("anchored");
    expect(anchored?.anchorNetwork).toBe("neo-n3-mainnet");
    expect(statuses).toContainEqual({ message: "proofAnchored", type: "success" });
  });

  it("does not re-anchor an already-anchored proof", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("doc", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    await proofApp.anchorProof(id);
    invoke.mockClear();

    const ok = await proofApp.anchorProof(id);
    expect(ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("reports an error and leaves the proof local when the broadcast fails", async () => {
    invoke = vi.fn(async () => {
      throw new Error("wallet rejected");
    });
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
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

  it("keeps an ambiguous provider failure locked because absence of broadcast was not proven", async () => {
    invoke = vi.fn(async () => {
      throw new Error("provider transport closed");
    });
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("ambiguous-provider-failure", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    expect(await proofApp.anchorProof(id)).toBe(false);
    expect(proofApp.proofs.get()[0]?.anchorStatus).toBe("preparing");
    expect(await proofApp.anchorProof(id)).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("cannot clear the retry reservation while the wallet submission is still open", async () => {
    let rejectInvoke!: (error: unknown) => void;
    invoke = vi.fn(() => new Promise((_resolve, reject) => {
      rejectInvoke = reject;
    }));
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("wallet-prompt-open", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    const anchoring = proofApp.anchorProof(id);
    await vi.waitFor(() => expect(proofApp.proofs.get()[0]?.anchorStatus).toBe("preparing"));
    expect(await proofApp.releasePreparingAnchor(id)).toBe(false);
    expect(proofApp.proofs.get()[0]?.anchorStatus).toBe("preparing");

    rejectInvoke(new Error("wallet rejected"));
    await expect(anchoring).resolves.toBe(false);
    expect(proofApp.proofs.get()[0]?.anchorStatus).toBe("local");
  });

  it("persists a broadcast as pending and recovers it after refresh before claiming anchored", async () => {
    inspectAnchor.mockResolvedValueOnce({
      status: "pending",
      digest: "",
      blockTime: 0,
      reason: "receipt-pending",
    });
    const app = makeApp(invoke);
    const first = useTimestampProofContract({ app, t, inspectAnchor });
    await first.createProof("pending-doc", () => undefined, () => undefined);
    const id = first.proofs.get()[0]?.id ?? 0;

    expect(await first.anchorProof(id)).toBe(true);
    expect(first.proofs.get()[0]).toMatchObject({
      anchored: false,
      anchorStatus: "pending",
      anchorTxid: TXID,
      anchorNetwork: "neo-n3-mainnet",
    });
    expect(await first.deleteProof(id)).toBe(false);
    expect(await first.clearProofs()).toBe(false);
    expect(first.proofs.get()[0]?.anchorTxid).toBe(TXID);

    inspectAnchor.mockResolvedValue({
      status: "confirmed",
      digest: first.proofs.get()[0]?.contentHash,
      blockTime: 1_700_000_100_000,
      reason: "confirmed",
    });
    const restored = useTimestampProofContract({ app, t, inspectAnchor });
    await restored.loadProofs();

    await vi.waitFor(() => {
      expect(restored.proofs.get()[0]).toMatchObject({
        anchored: true,
        anchorStatus: "anchored",
        anchorTxid: TXID,
      });
    });
  });

  it("records a confirmed VM FAULT as failed rather than anchored", async () => {
    inspectAnchor.mockResolvedValue({
      status: "fault",
      digest: "",
      blockTime: 0,
      reason: "ASSERT failed",
    });
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("fault-doc", () => undefined, () => undefined);

    expect(await proofApp.anchorProof(proofApp.proofs.get()[0]?.id ?? 0)).toBe(false);
    expect(proofApp.proofs.get()[0]).toMatchObject({
      anchored: false,
      anchorStatus: "fault",
      anchorError: "ASSERT failed",
    });
  });

  it("revalidates a stored anchored claim before presenting it as chain-confirmed after reload", async () => {
    const app = makeApp(invoke);
    const first = useTimestampProofContract({ app, t, inspectAnchor });
    await first.createProof("reload-revalidation", () => undefined, () => undefined);
    const id = first.proofs.get()[0]?.id ?? 0;
    expect(await first.anchorProof(id)).toBe(true);
    expect(first.proofs.get()[0]?.anchorStatus).toBe("anchored");

    let resolveReceipt!: (value: {
      status: "confirmed";
      digest: string;
      blockTime: number;
      reason: string;
    }) => void;
    inspectAnchor.mockImplementation(() => new Promise((resolve) => {
      resolveReceipt = resolve;
    }));
    const restored = useTimestampProofContract({ app, t, inspectAnchor });

    await restored.loadProofs();
    expect(restored.proofs.get()[0]).toMatchObject({
      anchorStatus: "pending",
      anchored: false,
      anchorError: "revalidation-required",
    });

    resolveReceipt({
      status: "confirmed",
      digest: restored.proofs.get()[0]?.contentHash ?? "",
      blockTime: 1_700_000_200_000,
      reason: "confirmed",
    });
    await vi.waitFor(() => expect(restored.proofs.get()[0]?.anchorStatus).toBe("anchored"));
  });

  it("rejects a confirmed-looking receipt that omits the public block time", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("no-public-time", () => undefined, () => undefined);
    inspectAnchor.mockResolvedValue({
      status: "confirmed",
      digest: proofApp.proofs.get()[0]?.contentHash,
      blockTime: 0,
      reason: "confirmed",
    });

    expect(await proofApp.anchorProof(proofApp.proofs.get()[0]?.id ?? 0)).toBe(false);
    expect(proofApp.proofs.get()[0]).toMatchObject({
      anchored: false,
      anchorStatus: "fault",
      anchorError: "confirmed-receipt-incomplete",
    });
  });

  it("fails closed on an unsupported wallet network before invoking GAS", async () => {
    const proofApp = useTimestampProofContract({
      app: makeApp(invoke, "neo-x-mainnet"),
      t,
      inspectAnchor,
    });
    await proofApp.createProof("wrong-chain", () => undefined, () => undefined);

    expect(await proofApp.anchorProof(proofApp.proofs.get()[0]?.id ?? 0)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(proofApp.proofs.get()[0]?.anchorStatus).toBe("local");
  });

  it("rejects non-canonical network aliases so framework fallbacks cannot bind a wallet write", async () => {
    const proofApp = useTimestampProofContract({
      app: makeApp(invoke, "testnet"),
      t,
      inspectAnchor,
    });
    await proofApp.createProof("ambiguous-wallet-network", () => undefined, () => undefined);

    expect(await proofApp.anchorProof(proofApp.proofs.get()[0]?.id ?? 0)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(proofApp.network.get()).toBe("");
  });

  it("keeps the exact txid in memory and a durable retry lock when receipt persistence fails after broadcast", async () => {
    const app = makeApp(invoke);
    const proofApp = useTimestampProofContract({ app, t, inspectAnchor });
    await proofApp.createProof("post-broadcast-storage-failure", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;
    const realSet = app.storage.local.set.bind(app.storage.local);
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      const pendingWrite =
        key === "proofs:v2" &&
        Array.isArray(value) &&
        value.some((item) => (item as { anchorStatus?: string }).anchorStatus === "pending");
      if (!pendingWrite) realSet(key, value);
    });
    const statuses: Array<{ message: string; type: string }> = [];

    expect(await proofApp.anchorProof(id, (message, type) => statuses.push({ message, type }))).toBe(false);
    expect(proofApp.proofs.get()[0]).toMatchObject({
      anchorStatus: "pending",
      anchorTxid: TXID,
      anchored: false,
    });
    expect(statuses.at(-1)).toMatchObject({ type: "error" });
    expect(String(statuses.at(-1)?.message)).toContain("anchorReceiptNotSaved");

    const durableBeforeReload = String(localStorage.getItem("miniapp-timestamp-proof:proofs:v2"));
    expect(durableBeforeReload).toContain('"anchorStatus":"preparing"');
    expect(durableBeforeReload).not.toContain(TXID);

    storageSet.mockRestore();
    const restored = useTimestampProofContract({ app, t, inspectAnchor });
    await restored.loadProofs();
    expect(restored.proofs.get()[0]).toMatchObject({
      anchorStatus: "preparing",
      anchorTxid: "",
      anchored: false,
    });

    invoke.mockClear();
    expect(await restored.anchorProof(id)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(await restored.releasePreparingAnchor(id)).toBe(true);
    expect(restored.proofs.get()[0]?.anchorStatus).toBe("local");
  });

  it("keeps a retry lock when a resolved wallet call omits a valid txid", async () => {
    invoke = vi.fn(async () => ({ txid: "not-a-txid", success: true, verified: false }));
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });
    await proofApp.createProof("missing-wallet-receipt", () => undefined, () => undefined);
    const id = proofApp.proofs.get()[0]?.id ?? 0;

    expect(await proofApp.anchorProof(id)).toBe(false);
    expect(proofApp.proofs.get()[0]).toMatchObject({
      anchorStatus: "preparing",
      anchorTxid: "",
      anchorError: "missing-transaction-id",
    });
    expect(await proofApp.anchorProof(id)).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("binds the exact pre-network legacy receipt shape to its original Mainnet-only product scope", async () => {
    localStorage.setItem("miniapp-timestamp-proof:proofs:v2", JSON.stringify([{
      id: 1,
      content: "legacy-mainnet-proof",
      contentHash: "f".repeat(64),
      timestamp: 1_700_000_000_000,
      creator: ADDRESS,
      anchorTxid: TXID,
      anchored: true,
    }]));
    inspectAnchor.mockResolvedValue({
      status: "unreachable",
      digest: "",
      blockTime: 0,
      reason: "rpc-unreachable",
    });
    const restored = useTimestampProofContract({ app: makeApp(invoke), t, inspectAnchor });

    await restored.loadProofs();
    expect(restored.proofs.get()[0]).toMatchObject({
      anchorStatus: "pending",
      anchorNetwork: "neo-n3-mainnet",
      anchorTxid: TXID,
      anchored: false,
    });
  });
});
