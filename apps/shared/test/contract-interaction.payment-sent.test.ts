import { describe, expect, it, vi } from "vitest";

import { useContractInteraction } from "../composables/useContractInteraction";

/**
 * The direct-prepaid-GAS flow is TWO transactions: it broadcasts a GAS transfer
 * to the contract, then calls the target method. The optional onPaymentSent
 * callback must fire at the exact boundary — after the transfer is broadcast and
 * before the target call — so callers (e.g. dice-game) can tell a pre-transfer
 * failure (nothing left the wallet) from a post-broadcast failure (funds in
 * flight / recoverable). Passing an explicit scriptHash bypasses the manifest
 * contract-address lookup so this exercises only the payment-signal logic.
 */
function makeWallet(address: string) {
  return {
    address: { value: address },
    connect: vi.fn(async () => {}),
    invokeContract: vi.fn(async () => ({ txid: "0xtransfer" })),
    invokeRead: vi.fn(async () => ({})),
  } as never;
}

const t = (key: string) => key;
const CONTRACT = "0x1234567890abcdef1234567890abcdef12345678";

describe("invokeWithDirectPrepaidGas onPaymentSent signal", () => {
  it("fires once with the transfer txid, after the transfer and before the target call", async () => {
    const wallet = makeWallet("NMockWalletAddressForTest000000000");
    const order: string[] = [];
    (wallet as { invokeContract: ReturnType<typeof vi.fn> }).invokeContract = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push("transfer");
        return { txid: "0xtransfer" };
      })
      .mockImplementationOnce(async () => {
        order.push("target");
        return { txid: "0xtarget" };
      });

    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      // Deterministic settle — keeps the test off the live indexer.
      confirmDeposit: async () => "confirmed",
    });
    const onPaymentSent = vi.fn(() => order.push("onPaymentSent"));

    await ci.invokeWithDirectPrepaidGas(
      "100000000",
      "test-app:stake",
      "doThing",
      [],
      CONTRACT,
      1,
      undefined,
      onPaymentSent,
    );

    expect(onPaymentSent).toHaveBeenCalledTimes(1);
    expect(onPaymentSent).toHaveBeenCalledWith("0xtransfer");
    // The signal lands strictly between the two on-chain calls.
    expect(order).toEqual(["transfer", "onPaymentSent", "target"]);
  });

  it("does NOT fire when the wallet cannot connect (pre-transfer failure)", async () => {
    // Empty address and a connect() that never populates it -> ensureWallet throws
    // before any transfer is broadcast, so no funds move and the callback is silent.
    const wallet = makeWallet("");
    const onPaymentSent = vi.fn();
    const confirmDeposit = vi.fn(async () => "confirmed" as const);

    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      confirmDeposit,
    });

    await expect(
      ci.invokeWithDirectPrepaidGas(
        "100000000",
        "test-app:stake",
        "doThing",
        [],
        CONTRACT,
        0,
        undefined,
        onPaymentSent,
      ),
    ).rejects.toThrow();

    expect(onPaymentSent).not.toHaveBeenCalled();
    expect(confirmDeposit).not.toHaveBeenCalled();
    expect(
      (wallet as { invokeContract: ReturnType<typeof vi.fn> }).invokeContract,
    ).not.toHaveBeenCalled();
  });
});
