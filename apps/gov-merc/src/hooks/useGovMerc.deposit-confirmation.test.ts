import { describe, expect, it, vi } from "vitest";

import { useGovMerc } from "./useGovMerc";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ALICE_HASH = addressToScriptHash(ALICE);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BID_MEMO = "govmerc:bid";

const t = (key: string) => key;

/**
 * Minimal ChainService stand-in for the deposit-confirmation regression: the
 * bid-funding GAS transfer must carry waitForEvent:"Credited" so the prepaid
 * credit is CONFIRMED in a block before bid() consumes it. Without the wait
 * the consuming call can land first and fault with "insufficient prepaid
 * asset" after funds already left the wallet.
 */
function makeChain() {
  const invoke = vi.fn(
    async (_op: string, _args: ContractArg[], _options?: { waitForEvent?: string }): Promise<TxResult> => {
      return { txid: "0xtx", success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    switch (op) {
      case "currentEpoch": return "4";
      case "gasCreditOf": return "0"; // no prepaid credit — the deposit leg must run
      default: return "0";
    }
  });

  const listEvents = vi.fn(async (): Promise<unknown[]> => []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read,
    listEvents,
  } as unknown as ChainService;
  return { chain, invoke };
}

describe("useGovMerc — bid deposit waits for the Credited event before bid()", () => {
  it("passes waitForEvent:'Credited' on the bid-funding transfer and bids only after it settles", async () => {
    const { chain, invoke } = makeChain();
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-gov-merc" },
    );
    const app = useGovMerc({ app: framework, t });
    app.setAddress(ALICE);
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await app.placeBid();

    const transfer = invoke.mock.calls.find((c) => c[0] === "transfer");
    expect(transfer).toBeTruthy();
    expect(transfer![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "200000000" },
      { type: "String", value: BID_MEMO },
    ]);
    // The regression: the deposit must settle on the contract's Credited event
    // (a fire-and-forget transfer races the consuming bid() into the same block).
    expect(transfer![2]).toMatchObject({ scriptHash: GAS_HASH, waitForEvent: "Credited" });

    // The consuming bid() only fires after the confirmed deposit.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("bid"));
  });
});
