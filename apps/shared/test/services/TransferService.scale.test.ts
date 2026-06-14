import { describe, expect, it, vi } from "vitest";

import { TransferService } from "@shared/services/TransferService";
import { EventBus } from "@shared/services/EventBus";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { ChainService } from "@shared/services/ChainService";

/**
 * Minimal ChainService stub. transferToken/prepayGas only need ensureWallet,
 * a contractAddress, and invoke — the scaled Integer arg is captured from the
 * invoke() call so we can assert the exact base-unit string.
 */
type InvokeArg = { type: string; value: string };

function makeChainStub() {
  const invoke = vi.fn(
    async (_op: string, _args: InvokeArg[], _options?: unknown) => ({
      txid: "0xtx",
      success: true,
    }),
  );
  const chain = {
    ensureWallet: vi.fn(async () => "NSenderAddressForTransferScaleTest00"),
    contractAddress: { get: () => "0xcontract", value: "0xcontract" },
    invoke,
  } as unknown as ChainService;
  return { chain, invoke };
}

function makeTransfer() {
  const { chain, invoke } = makeChainStub();
  const events = new EventBus();
  const transfer = new TransferService(chain, events);
  return { transfer, invoke };
}

/** Pull the scaled Integer amount out of the captured invoke() transfer args. */
function scaledFromInvoke(invoke: ReturnType<typeof makeTransfer>["invoke"]): string {
  const args = invoke.mock.calls[0][1];
  const integerArg = args.find((a) => a.type === "Integer");
  return integerArg!.value;
}

describe("TransferService.scaleAmount precision (C12)", () => {
  it("scales the max 8-decimal GAS amount without float drift", async () => {
    const { transfer, invoke } = makeTransfer();
    await transfer.transferGas("NRecipient0000000000000000000000000", "99999999.99999999");
    // Float math (amount * 1e8) loses precision at this magnitude; the BigInt
    // helper is exact.
    expect(scaledFromInvoke(invoke)).toBe("9999999999999999");
  });

  it("scales a small sub-1e8 GAS amount exactly", async () => {
    const { transfer, invoke } = makeTransfer();
    await transfer.transferGas("NRecipient0000000000000000000000000", "0.00000001");
    expect(scaledFromInvoke(invoke)).toBe("1");
  });

  it("avoids the legacy 0.1 float bug", async () => {
    const { transfer, invoke } = makeTransfer();
    await transfer.transferGas("NRecipient0000000000000000000000000", "0.1");
    expect(scaledFromInvoke(invoke)).toBe("10000000");
  });

  it("passes whole NEO through as an integer count (never x1e8)", async () => {
    const { transfer, invoke } = makeTransfer();
    await transfer.transferNeo("NRecipient0000000000000000000000000", 7);
    expect(scaledFromInvoke(invoke)).toBe("7");
  });

  it("rejects a zero-value transfer (0n) before touching the chain", async () => {
    const { transfer, invoke } = makeTransfer();
    await expect(
      transfer.transferGas("NRecipient0000000000000000000000000", "0"),
    ).rejects.toThrow(/Invalid transfer amount/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects malformed and negative amounts", async () => {
    const { transfer } = makeTransfer();
    await expect(
      transfer.transferGas("NR", "not-a-number"),
    ).rejects.toThrow(/Invalid transfer amount/);
    await expect(transfer.transferGas("NR", "-1")).rejects.toThrow(
      /Invalid transfer amount/,
    );
    // Fractional NEO is invalid (indivisible token).
    await expect(
      transfer.transferToken(BLOCKCHAIN_CONSTANTS.NEO_HASH, "NR", "1.5"),
    ).rejects.toThrow(/Invalid transfer amount/);
  });
});
