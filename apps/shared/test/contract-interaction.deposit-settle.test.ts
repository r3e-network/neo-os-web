import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DepositConfirmedActionFailedError,
  useContractInteraction,
  waitForDepositConfirmation,
} from "../composables/useContractInteraction";
import type { DepositConfirmation } from "../composables/useContractInteraction";

/**
 * The prepaid flow is TWO transactions: a GAS deposit transfer, then the
 * consuming call. Intra-block ordering on Neo N3 is fee/hash-based, so the
 * consuming call MUST NOT be issued until the deposit is confirmed in a block
 * — a fixed sleep cannot guarantee that. These tests pin the new
 * confirmation-gated ordering, the waitMs=0 falsy fix, the
 * indexer-unreachable fallback, and the distinct "deposit confirmed, action
 * failed — credit withdrawable" error.
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

function orderedWallet(order: string[], targetFails = false) {
  const wallet = makeWallet("NMockWalletAddressForTest000000000");
  (wallet as { invokeContract: ReturnType<typeof vi.fn> }).invokeContract = vi
    .fn()
    .mockImplementationOnce(async () => {
      order.push("transfer");
      return { txid: "0xtransfer" };
    })
    .mockImplementationOnce(async () => {
      order.push("target");
      if (targetFails) throw new Error("FAULT: insufficient prepaid gas");
      return { txid: "0xtarget" };
    });
  return wallet;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("invokeWithDirectPrepaidGas deposit settlement", () => {
  it("does not issue the consuming call until the deposit confirmation resolves", async () => {
    const order: string[] = [];
    const wallet = orderedWallet(order);
    let resolveConfirm!: (value: DepositConfirmation) => void;
    const confirmDeposit = vi.fn(
      () =>
        new Promise<DepositConfirmation>((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    const ci = useContractInteraction({ appId: "test-app", t, wallet, confirmDeposit });
    const pending = ci.invokeWithDirectPrepaidGas(
      "100000000",
      "test-app:stake",
      "doThing",
      [],
      CONTRACT,
      0,
    );

    // Let the transfer broadcast and the confirmation wait begin.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(confirmDeposit).toHaveBeenCalledWith("0xtransfer");
    expect(order).toEqual(["transfer"]);

    resolveConfirm("confirmed");
    await pending;
    expect(order).toEqual(["transfer", "target"]);
  });

  it("treats waitMs=0 as zero — no fallback sleep even when the indexer is unreachable", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const wallet = orderedWallet(order);
    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      confirmDeposit: async () => "unreachable",
    });

    let settled = false;
    const pending = ci
      .invokeWithDirectPrepaidGas("100000000", "test-app:stake", "doThing", [], CONTRACT, 0)
      .then(() => {
        settled = true;
      });

    // Flushes microtasks only — under the old `waitMs || 4000` coalesce a
    // 4s timer would still be pending here and settled would stay false.
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    await pending;
    expect(order).toEqual(["transfer", "target"]);
  });

  it("keeps the 4s fallback sleep when the indexer is unreachable and waitMs is defaulted", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const wallet = orderedWallet(order);
    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      confirmDeposit: async () => "unreachable",
    });

    let settled = false;
    const pending = ci
      .invokeWithDirectPrepaidGas("100000000", "test-app:stake", "doThing", [], CONTRACT)
      .then(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);
    expect(order).toEqual(["transfer"]);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(order).toEqual(["transfer", "target"]);
    await pending;
  });

  it("surfaces a post-confirmation action failure as DepositConfirmedActionFailedError", async () => {
    const order: string[] = [];
    const wallet = orderedWallet(order, true);
    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      confirmDeposit: async () => "confirmed",
    });

    const pending = ci.invokeWithDirectPrepaidGas(
      "100000000",
      "test-app:stake",
      "doThing",
      [],
      CONTRACT,
      0,
    );

    await expect(pending).rejects.toBeInstanceOf(DepositConfirmedActionFailedError);
    await pending.catch((error: DepositConfirmedActionFailedError) => {
      expect(error.operation).toBe("doThing");
      expect(error.depositTxid).toBe("0xtransfer");
      expect(error.message).toContain("withdrawable");
    });
  });

  it("propagates the raw error when the deposit was never confirmed", async () => {
    const order: string[] = [];
    const wallet = orderedWallet(order, true);
    const ci = useContractInteraction({
      appId: "test-app",
      t,
      wallet,
      confirmDeposit: async () => "timeout",
    });

    const pending = ci.invokeWithDirectPrepaidGas(
      "100000000",
      "test-app:stake",
      "doThing",
      [],
      CONTRACT,
      0,
    );

    await expect(pending).rejects.toThrow("FAULT: insufficient prepaid gas");
    await pending.catch((error: unknown) => {
      expect(error).not.toBeInstanceOf(DepositConfirmedActionFailedError);
    });
  });
});

describe("waitForDepositConfirmation", () => {
  const eventsPayload = JSON.stringify([
    {
      id: 1,
      txid: "0xdeposit",
      contract_hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      event_name: "Transfer",
      state: null,
      block_index: 100,
      block_time: "2026-06-11T00:00:00Z",
      network: "testnet",
    },
  ]);

  it("returns 'confirmed' once the deposit tx is indexed", async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => ({
      ok: true,
      text: async () => eventsPayload,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await waitForDepositConfirmation("0xdeposit", {
      network: "testnet",
      timeoutMs: 50,
      pollIntervalMs: 1,
    });

    expect(result).toBe("confirmed");
    expect(String(fetchMock.mock.calls[0][0])).toContain("tx_hash=0xdeposit");
  });

  it("returns 'unreachable' when the indexer cannot be queried at all", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await waitForDepositConfirmation("0xdeposit", {
      network: "testnet",
      timeoutMs: 50,
      pollIntervalMs: 1,
    });

    expect(result).toBe("unreachable");
  });

  it("returns 'timeout' when the indexer is reachable but the tx never appears", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "[]",
      })),
    );

    const result = await waitForDepositConfirmation("0xdeposit", {
      network: "testnet",
      timeoutMs: 5,
      pollIntervalMs: 1,
    });

    expect(result).toBe("timeout");
  });

  it("returns 'unreachable' without polling when no txid is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await waitForDepositConfirmation("")).toBe("unreachable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
