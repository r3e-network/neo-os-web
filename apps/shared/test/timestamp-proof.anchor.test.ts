import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import type { MiniAppFramework } from "../react";
import { GAS_HASH } from "../constants/rpc";

/**
 * The anchor path turns the device-local journal into a verifiable proof: a
 * 0-GAS self-transfer that embeds the SHA-256 digest in the data field. These
 * tests stub the wallet SDK (the address ref + connect stay on the SDK per the
 * §3.6 address-poll exemption) and drive the broadcast through the framework
 * chain surface the composable now uses (app.chain.invoke).
 */

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

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
function makeApp(invoke: ReturnType<typeof vi.fn>): MiniAppFramework {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ADDRESS),
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

beforeEach(() => {
  localStorage.clear();
  walletState.address = { value: ADDRESS };
  walletState.connect = vi.fn(async () => undefined);
  invoke = vi.fn(async () => ({ txid: "0xanchortx", success: true }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTimestampProofContract anchoring", () => {
  it("anchors a proof via a 0-GAS self-transfer embedding the digest", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t });
    await proofApp.createProof("contract-v2.pdf", () => undefined, () => undefined);
    const proof = proofApp.proofs.get()[0];
    expect(proof?.anchored).toBe(false);

    const statuses: Array<{ message: string; type: string }> = [];
    const ok = await proofApp.anchorProof(proof?.id ?? 0, (message, type) =>
      statuses.push({ message, type }),
    );

    expect(ok).toBe(true);
    // arg.hash160Raw passes the raw wallet address through unconverted and
    // arg.integer stringifies — the exact args the wallet SDK call produced.
    expect(invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: ADDRESS },
        { type: "Hash160", value: ADDRESS },
        { type: "Integer", value: "0" },
        { type: "String", value: `timestamp-proof:${proof?.contentHash}` },
      ],
      { scriptHash: GAS_HASH },
    );
    // Storage-prefix compatibility: the journal still lives at the exact
    // pre-framework runtime-cache key.
    expect(
      window.localStorage.getItem("miniapp-timestamp-proof:proofs:v2"),
    ).toContain("0xanchortx");

    const anchored = proofApp.proofs.get()[0];
    expect(anchored?.anchored).toBe(true);
    expect(anchored?.anchorTxid).toBe("0xanchortx");
    expect(statuses).toContainEqual({ message: "proofAnchored", type: "success" });
  });

  it("does not re-anchor an already-anchored proof", async () => {
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t });
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
    const proofApp = useTimestampProofContract({ app: makeApp(invoke), t });
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
