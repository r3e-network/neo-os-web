import { describe, expect, it, vi } from "vitest";

import { useGovMerc } from "./useGovMerc";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ALICE_HASH = addressToScriptHash(ALICE);
const BID_MEMO = "govmerc:bid";

const t = (key: string) => key;

/**
 * Minimal ChainService stand-in for the deposit-confirmation regression: the
 * bid-funding GAS deposit must be CONFIRMED in a block before bid() consumes
 * it. Without the confirmation the consuming call can land first and fault
 * with "insufficient prepaid asset" after funds already left the wallet.
 *
 * The hook reaches that guarantee through app.funds.payAndCall →
 * ChainService.invokeWithPayment, whose lane is exactly: GAS transfer with the
 * bid memo → deposit confirmed in a block → consuming call (see
 * apps/shared/test/contract-interaction.deposit-settle.test.ts for the lane's
 * own ordering spec).
 */
function makeChain() {
  const invoke = vi.fn(
    async (_op: string, _args: ContractArg[], _options?: { waitForEvent?: string }): Promise<TxResult> => {
      return { txid: "0xtx", success: true };
    },
  );

  const invokeWithPayment = vi.fn(
    async (
      _amount: string,
      _memo: string,
      _op: string,
      _args: ContractArg[],
      _options?: { waitForEvent?: string },
    ): Promise<TxResult> => {
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
    invokeWithPayment,
    read,
    listEvents,
  } as unknown as ChainService;
  return { chain, invoke, invokeWithPayment };
}

describe("useGovMerc — bid deposit is confirmed in a block before bid()", () => {
  it("routes the funded bid through the confirmed-deposit payAndCall lane", async () => {
    const { chain, invoke, invokeWithPayment } = makeChain();
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

    // The regression: the deposit must settle in a block before the consuming
    // bid() (a fire-and-forget transfer races bid() into the same block and
    // faults with "insufficient prepaid asset"). invokeWithPayment owns that
    // ordering: transfer with the bid memo → confirm deposit → bid().
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(invokeWithPayment).toHaveBeenCalledWith(
      "200000000",
      BID_MEMO,
      "bid",
      [
        { type: "Hash160", value: ALICE_HASH },
        { type: "Integer", value: "200000000" },
      ],
      { waitForEvent: "BidPlaced" },
    );

    // No hand-rolled two-step remains: neither a raw transfer nor a raw bid
    // invoke goes out beside the confirmed-deposit lane.
    expect(invoke.mock.calls.some((c) => c[0] === "transfer")).toBe(false);
    expect(invoke.mock.calls.some((c) => c[0] === "bid")).toBe(false);
  });
});
