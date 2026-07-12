import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AIM_MASTER_TESTNET_CHECKSUM,
  AIM_MASTER_TESTNET_CONTRACT,
  attestAimMasterContract,
} from "../../aim-master/src/aim-master-rpc";

const repoRoot = resolve(import.meta.dirname, "../../..");

function reviewedState() {
  const manifest = JSON.parse(
    readFileSync(resolve(repoRoot, "contracts/build/MiniAppAimMaster.manifest.json"), "utf8"),
  );
  return {
    hash: AIM_MASTER_TESTNET_CONTRACT,
    nef: { checksum: AIM_MASTER_TESTNET_CHECKSUM },
    manifest,
  };
}

function mockRpc(result: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
    { status: 200, headers: { "content-type": "application/json" } },
  ));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("aim-master contract attestation", () => {
  it("accepts only the exact reviewed checksum, version, methods, and events", async () => {
    const fetchMock = mockRpc(reviewedState());
    await expect(attestAimMasterContract(AIM_MASTER_TESTNET_CONTRACT)).resolves.toEqual({
      compatible: true,
      checksum: AIM_MASTER_TESTNET_CHECKSUM,
      version: "3.0.0",
      reason: "ok",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a different binding before making an RPC request", async () => {
    const fetchMock = mockRpc(reviewedState());
    await expect(
      attestAimMasterContract("0x0000000000000000000000000000000000000001"),
    ).resolves.toMatchObject({ compatible: false, reason: "binding" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an in-place contract upgrade with a different checksum", async () => {
    const state = reviewedState();
    state.nef.checksum += 1;
    mockRpc(state);
    await expect(attestAimMasterContract(AIM_MASTER_TESTNET_CONTRACT)).resolves.toMatchObject({
      compatible: false,
      reason: "checksum",
    });
  });

  it("rejects an ABI that drifts at the same hash and checksum", async () => {
    const state = reviewedState();
    state.manifest.abi.methods = state.manifest.abi.methods.filter(
      (method: { name?: string }) => method.name !== "withdraw",
    );
    mockRpc(state);
    await expect(attestAimMasterContract(AIM_MASTER_TESTNET_CONTRACT)).resolves.toMatchObject({
      compatible: false,
      reason: "abi",
    });
  });

  it("fails closed when contract state cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(attestAimMasterContract(AIM_MASTER_TESTNET_CONTRACT)).resolves.toMatchObject({
      compatible: false,
      reason: "unreachable",
    });
  });
});
