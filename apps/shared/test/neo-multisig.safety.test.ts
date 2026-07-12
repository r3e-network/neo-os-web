import { afterEach, describe, expect, it, vi } from "vitest";

import { addressToScriptHash } from "../utils/neo";
import {
  isPendingMultisigOperation,
  readMultisigTransactionOutcome,
  requireCanonicalMultisigContext,
} from "../../neo-multisig/src/multisig-safety";

const CONTRACT = "0xa361cdc792e97c4d8ddf42048cf48f3283ea7178";
const ALICE = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const BOB = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const TXID = `0x${"ab".repeat(32)}`;

afterEach(() => vi.restoreAllMocks());

describe("neo-multisig canonical context", () => {
  it("accepts the canonical deployment and rejects a wallet/launch mismatch", async () => {
    const app = {
      platform: { launch: { network: "neo-n3-mainnet" } },
      chain: {
        detectNetwork: vi.fn(async () => "mainnet"),
        contractAddress: { get: () => CONTRACT },
      },
    };
    await expect(requireCanonicalMultisigContext(app as never, "context mismatch")).resolves.toEqual({
      network: "mainnet",
      contractHash: CONTRACT,
    });

    app.chain.detectNetwork.mockResolvedValueOnce("testnet");
    await expect(requireCanonicalMultisigContext(app as never, "context mismatch")).rejects.toThrow("context mismatch");
  });
});

describe("neo-multisig pending-operation validation", () => {
  it("requires canonical signer order and a non-negative approval baseline", () => {
    const signerHashes = [addressToScriptHash(ALICE), addressToScriptHash(BOB)].sort();
    const base = {
      version: 1,
      network: "mainnet",
      contractHash: CONTRACT,
      actorHash: signerHashes[0],
      txid: TXID,
      createdAt: Date.now(),
    } as const;

    expect(isPendingMultisigOperation({
      ...base,
      kind: "create-vault",
      eventName: "VaultCreated",
      signerHashes,
      threshold: 2,
    })).toBe(true);
    expect(isPendingMultisigOperation({
      ...base,
      kind: "create-vault",
      eventName: "VaultCreated",
      signerHashes: [...signerHashes].reverse(),
      threshold: 2,
    })).toBe(false);
    expect(isPendingMultisigOperation({
      ...base,
      kind: "approve",
      eventName: "Approved",
      requestId: "4",
      beforeApprovalCount: -1,
    })).toBe(false);
  });
});

describe("neo-multisig application-log recovery", () => {
  it("accepts only a HALT log carrying the exact contract event and surfaces FAULT", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: CONTRACT,
            eventname: "RequestCancelled",
            state: { type: "Array", value: [{ type: "Integer", value: "4" }] },
          }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(readMultisigTransactionOutcome("mainnet", TXID, "RequestCancelled", CONTRACT)).resolves.toMatchObject({
      state: "halt",
      event: expect.any(Object),
    });

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(readMultisigTransactionOutcome("mainnet", TXID, "RequestCancelled", CONTRACT)).resolves.toEqual({
      state: "fault",
      event: null,
    });
  });
});
