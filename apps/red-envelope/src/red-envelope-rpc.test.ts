import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attestRedEnvelopeContract,
  buildRedEnvelopeShareUrl,
  normalizeRedEnvelopeId,
  readRedEnvelopeExecutionState,
} from "./red-envelope-rpc";

const TESTNET_CONTRACT = "0x5a5ecc80cd5225acd7431a5dd6f0e32bb9260a87";

const method = (name: string, params: number, returntype: string, safe: boolean) => ({
  name,
  parameters: Array.from({ length: params }, () => ({ type: "Any" })),
  returntype,
  safe,
});

const event = (name: string, params: number) => ({
  name,
  parameters: Array.from({ length: params }, () => ({ type: "Any" })),
});

function compatibleContractState(checksum = 4_293_893_390) {
  return {
    hash: TESTNET_CONTRACT,
    nef: { checksum },
    manifest: {
      name: "MiniAppRedEnvelope",
      extra: { Version: "1.1.0" },
      abi: {
        methods: [
          method("getOwner", 0, "Hash160", true),
          method("update", 2, "Void", false),
          method("createEnvelope", 4, "Integer", false),
          method("claim", 2, "Integer", false),
          method("reclaim", 2, "Integer", false),
          method("withdraw", 1, "Integer", false),
          method("lastEnvelopeId", 0, "Integer", true),
          method("creditOf", 1, "Integer", true),
          method("claimedAmount", 2, "Integer", true),
          method("hasClaimed", 2, "Boolean", true),
          method("getEnvelope", 1, "Map", true),
          method("creatorEnvelopeCount", 1, "Integer", true),
          method("getCreatorEnvelopes", 3, "Array", true),
          method("claimerEnvelopeCount", 1, "Integer", true),
          method("getClaimerEnvelopes", 3, "Array", true),
        ],
        events: [
          event("Credited", 3),
          event("EnvelopeCreated", 5),
          event("Claimed", 4),
          event("Reclaimed", 3),
          event("CreditWithdrawn", 2),
        ],
      },
    },
  };
}

function mockRpc(result: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe("red-envelope network binding", () => {
  it("builds a network-bound share link and rejects ambiguous ids", () => {
    expect(buildRedEnvelopeShareUrl("0007", "neo-n3-testnet")).toBe(
      "neomainapp://red-envelope?network=testnet&envelopeId=7",
    );
    expect(buildRedEnvelopeShareUrl("7", "")).toBe("");
    expect(buildRedEnvelopeShareUrl("guest-7", "testnet")).toBe("");
    expect(normalizeRedEnvelopeId("1.5")).toBe("");
    expect(normalizeRedEnvelopeId("0")).toBe("");
  });

  it("pins the live script checksum, manifest version and ABI before writes", async () => {
    mockRpc(compatibleContractState());

    await expect(attestRedEnvelopeContract("testnet", TESTNET_CONTRACT)).resolves.toMatchObject({
      compatible: true,
      boundedCreate: true,
      checksum: 4_293_893_390,
      version: "1.1.0",
      reason: "ok",
    });
  });

  it("fails closed after a same-address bytecode drift", async () => {
    mockRpc(compatibleContractState(123));

    await expect(attestRedEnvelopeContract("testnet", TESTNET_CONTRACT)).resolves.toMatchObject({
      compatible: false,
      reason: "checksum",
    });
  });
});

describe("red-envelope exact transaction state", () => {
  it("distinguishes HALT from FAULT using the exact application log", async () => {
    mockRpc({ executions: [{ vmstate: "HALT" }] });
    await expect(readRedEnvelopeExecutionState(
      "testnet",
      `0x${"ab".repeat(32)}`,
    )).resolves.toBe("halt");

    mockRpc({ executions: [{ vmstate: "FAULT" }] });
    await expect(readRedEnvelopeExecutionState(
      "testnet",
      `0x${"cd".repeat(32)}`,
    )).resolves.toBe("fault");
  });
});
