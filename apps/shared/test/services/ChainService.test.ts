import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useContractInteraction: vi.fn(),
  waitForDepositConfirmation: vi.fn(),
}));

vi.mock("@shared/composables/useContractInteraction", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@shared/composables/useContractInteraction")
  >();
  return {
    ...actual,
    useContractInteraction: mocks.useContractInteraction,
    waitForDepositConfirmation: mocks.waitForDepositConfirmation,
  };
});

import { ChainService, TRANSACTION_UNVERIFIED } from "@shared/services/ChainService";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { CacheService } from "@shared/services/CacheService";
import { EventBus } from "@shared/services/EventBus";
import { createObservable } from "@shared/react/context";

const t = (key: string) => key;

type FakeInteraction = ReturnType<typeof makeInteraction>;

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    address: createObservable<string | null>("NMockWalletAddressForTest000000000"),
    contractAddress: createObservable<string | null>(
      "0x1234567890abcdef1234567890abcdef12345678",
    ),
    isProcessing: createObservable(false),
    ensureWallet: vi.fn(async () => "NMockWalletAddressForTest000000000"),
    read: vi.fn(async () => null),
    readArray: vi.fn(async () => [] as unknown[]),
    invokeDirectly: vi.fn(async () => ({ txid: "0xtx", tx: {} })),
    invokeWithDirectPrepaidGas: vi.fn(async () => ({ txid: "0xtx", tx: {} })),
    ...overrides,
  };
}

function makeChain(interaction: FakeInteraction) {
  mocks.useContractInteraction.mockReturnValue(interaction);
  const cache = new CacheService("miniapp-chain-test");
  const events = new EventBus();
  const chain = new ChainService("miniapp-chain-test", t, cache, events);
  return { chain, cache, events };
}

function stubEventWait(chain: ChainService, event: unknown) {
  const waitForEvent = vi.fn(async () => event);
  (chain as unknown as { listEventsComposable: { waitForEvent: typeof waitForEvent } })
    .listEventsComposable = { waitForEvent };
  return waitForEvent;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ChainService read cache", () => {
  it("scopes cached reads by contract so overrides never collide", async () => {
    const interaction = makeInteraction({
      read: vi.fn(async (_op: string, _args: unknown, scriptHash?: string) =>
        scriptHash ?? "default-contract-value",
      ),
    });
    const { chain } = makeChain(interaction);

    expect(
      await chain.read("balanceOf", [], { cache: true, scriptHash: "0xaaa" }),
    ).toBe("0xaaa");
    expect(
      await chain.read("balanceOf", [], { cache: true, scriptHash: "0xbbb" }),
    ).toBe("0xbbb");
    expect(await chain.read("balanceOf", [], { cache: true })).toBe(
      "default-contract-value",
    );
    expect(interaction.read).toHaveBeenCalledTimes(3);

    // Each contract's value comes back from its own cache entry.
    expect(
      await chain.read("balanceOf", [], { cache: true, scriptHash: "0xaaa" }),
    ).toBe("0xaaa");
    expect(await chain.read("balanceOf", [], { cache: true })).toBe(
      "default-contract-value",
    );
    expect(interaction.read).toHaveBeenCalledTimes(3);
  });

  it("caches legitimately-null results for their TTL instead of refetching", async () => {
    const interaction = makeInteraction({
      read: vi.fn(async () => null),
    });
    const { chain } = makeChain(interaction);

    expect(await chain.read("getEnvelope", [], { cache: true })).toBeNull();
    expect(await chain.read("getEnvelope", [], { cache: true })).toBeNull();
    expect(interaction.read).toHaveBeenCalledTimes(1);
  });

  it("scopes cached readArray results by contract as well", async () => {
    const interaction = makeInteraction({
      readArray: vi.fn(async (_op: string, _args: unknown, scriptHash?: string) => [
        scriptHash ?? "default",
      ]),
    });
    const { chain } = makeChain(interaction);

    expect(
      await chain.readArray("getInfo", [], { cache: true, scriptHash: "0xaaa" }),
    ).toEqual(["0xaaa"]);
    expect(
      await chain.readArray("getInfo", [], { cache: true, scriptHash: "0xbbb" }),
    ).toEqual(["0xbbb"]);
    expect(interaction.readArray).toHaveBeenCalledTimes(2);
  });
});

describe("ChainService event-wait honesty", () => {
  it("defaults the event wait to ~2 blocks + indexer margin", async () => {
    const { chain } = makeChain(makeInteraction());
    const waitForEvent = stubEventWait(chain, null);

    await chain.waitForEvent("0xtx", "Claimed");
    expect(waitForEvent).toHaveBeenCalledWith("0xtx", "Claimed", "miniapp-chain-test", 45_000);

    // Explicit timeouts pass through unchanged — including 0.
    await chain.waitForEvent("0xtx", "Claimed", 10);
    expect(waitForEvent).toHaveBeenLastCalledWith("0xtx", "Claimed", "miniapp-chain-test", 10);
    await chain.waitForEvent("0xtx", "Claimed", 0);
    expect(waitForEvent).toHaveBeenLastCalledWith("0xtx", "Claimed", "miniapp-chain-test", 0);
  });

  it("emits TRANSACTION_CONFIRMED only when the awaited event was observed", async () => {
    const { chain, events } = makeChain(makeInteraction());
    stubEventWait(chain, { name: "Claimed" });

    const confirmed = vi.fn();
    const unverified = vi.fn();
    events.on(EventBus.TRANSACTION_CONFIRMED, confirmed);
    events.on(TRANSACTION_UNVERIFIED, unverified);

    const result = await chain.invoke("claim", [], { waitForEvent: "Claimed" });

    expect(result.event).toEqual({ name: "Claimed" });
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(confirmed).toHaveBeenCalledWith({ txid: "0xtx", event: { name: "Claimed" } });
    expect(unverified).not.toHaveBeenCalled();
  });

  it("resolves verified:false when the events API fails after broadcast, never rejecting", async () => {
    // A broadcast tx must survive an events-API outage: the wait failure is
    // treated exactly like the timeout path instead of rejecting the invoke
    // (self-loan's deposit-then-act flows set their settled flags only after
    // the invoke resolves — a rejection here strands credit with no recovery
    // copy).
    const { chain } = makeChain(makeInteraction());
    const waitForEvent = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    (chain as unknown as { listEventsComposable: { waitForEvent: typeof waitForEvent } })
      .listEventsComposable = { waitForEvent };

    const result = await chain.invoke("borrow", [], { waitForEvent: "CollateralCredited" });
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.txid).toBe("0xtx");

    const paid = await chain.invokeWithPayment("1", "memo", "bury", [], {
      waitForEvent: "CapsuleBuried",
    });
    expect(paid.success).toBe(true);
    expect(paid.verified).toBe(false);
  });

  it("emits TRANSACTION_UNVERIFIED plus a deliberate balance refresh on timeout", async () => {
    const { chain, events } = makeChain(makeInteraction());
    stubEventWait(chain, null);

    const confirmed = vi.fn();
    const unverified = vi.fn();
    const balanceChanged = vi.fn();
    events.on(EventBus.TRANSACTION_CONFIRMED, confirmed);
    events.on(TRANSACTION_UNVERIFIED, unverified);
    events.on(EventBus.BALANCE_CHANGED, balanceChanged);

    const result = await chain.invoke("claim", [], { waitForEvent: "Claimed" });

    expect(result.event).toBeNull();
    expect(confirmed).not.toHaveBeenCalled();
    expect(unverified).toHaveBeenCalledWith({ txid: "0xtx", operation: "claim" });
    expect(balanceChanged).toHaveBeenCalledTimes(1);
  });
});

describe("ChainService.invoke verified flag", () => {
  it("reports verified=true when the awaited event is observed", async () => {
    const { chain } = makeChain(makeInteraction());
    stubEventWait(chain, { name: "Claimed" });

    const result = await chain.invoke("claim", [], { waitForEvent: "Claimed" });

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
  });

  it("reports success=true but verified=false on an event-wait timeout (relayed, unconfirmed)", async () => {
    const { chain } = makeChain(makeInteraction());
    stubEventWait(chain, null);

    const result = await chain.invoke("claim", [], { waitForEvent: "Claimed" });

    // The broadcast happened (success) but its event never landed (unverified):
    // callers can tell a relayed-but-unconfirmed tx from a confirmed one.
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
  });

  it("defaults verified=true when no event wait was requested (nothing to confirm)", async () => {
    const { chain } = makeChain(makeInteraction());

    const result = await chain.invoke("settle", []);

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
  });

  it("applies the same verified semantics to invokeWithPayment", async () => {
    const { chain } = makeChain(makeInteraction());
    stubEventWait(chain, null);

    const result = await chain.invokeWithPayment("100000000", "memo", "buy", [], {
      waitForEvent: "Bought",
    });

    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
  });
});

describe("ChainService.prepayAndInvoke deposit settlement", () => {
  function trackedInteraction(ops: string[], failTarget = false) {
    return makeInteraction({
      invokeDirectly: vi.fn(async (operation: string) => {
        ops.push(operation);
        if (operation !== "transfer" && failTarget) {
          throw new Error("FAULT: insufficient prepaid gas");
        }
        return { txid: operation === "transfer" ? "0xdeposit" : "0xaction", tx: {} };
      }),
    });
  }

  it("does not fire the consuming call until the deposit confirms", async () => {
    const ops: string[] = [];
    const { chain } = makeChain(trackedInteraction(ops));
    let resolveConfirm!: (value: string) => void;
    mocks.waitForDepositConfirmation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ops).toEqual(["transfer"]);
    expect(mocks.waitForDepositConfirmation.mock.calls[0][0]).toBe("0xdeposit");

    resolveConfirm("confirmed");
    await pending;
    expect(ops).toEqual(["transfer", "lockStake"]);
  });

  it("uses the fixed 4s sleep only when the indexer is unreachable", async () => {
    vi.useFakeTimers();
    const ops: string[] = [];
    const { chain } = makeChain(trackedInteraction(ops));
    mocks.waitForDepositConfirmation.mockResolvedValue("unreachable");

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);

    await vi.advanceTimersByTimeAsync(3999);
    expect(ops).toEqual(["transfer"]);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(ops).toEqual(["transfer", "lockStake"]);
  });

  it("surfaces a post-confirmation action failure as credit-withdrawable", async () => {
    const ops: string[] = [];
    const { chain } = makeChain(trackedInteraction(ops, true));
    mocks.waitForDepositConfirmation.mockResolvedValue("confirmed");

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);

    await expect(pending).rejects.toBeInstanceOf(DepositConfirmedActionFailedError);
    await pending.catch((error: DepositConfirmedActionFailedError) => {
      expect(error.operation).toBe("lockStake");
      expect(error.depositTxid).toBe("0xdeposit");
      expect(error.settlement).toBe("confirmed");
    });
  });

  it("wraps a consuming-call failure as credit-withdrawable on settlement timeout too", async () => {
    // Indexer lag: the deposit transfer was BROADCAST in step 1 but never
    // showed up in the poll window. The credit still lands on the contract,
    // so the failure must keep the stranded-credit shape — a raw FAULT here
    // reads as "funds lost" to the user.
    const ops: string[] = [];
    const { chain } = makeChain(trackedInteraction(ops, true));
    mocks.waitForDepositConfirmation.mockResolvedValue("timeout");

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);

    await expect(pending).rejects.toBeInstanceOf(DepositConfirmedActionFailedError);
    await pending.catch((error: DepositConfirmedActionFailedError) => {
      expect(error.operation).toBe("lockStake");
      expect(error.depositTxid).toBe("0xdeposit");
      expect(error.settlement).toBe("timeout");
    });
  });

  it("wraps a consuming-call failure as credit-withdrawable when the indexer is unreachable", async () => {
    vi.useFakeTimers();
    const ops: string[] = [];
    const { chain } = makeChain(trackedInteraction(ops, true));
    mocks.waitForDepositConfirmation.mockResolvedValue("unreachable");

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);
    const outcome = pending.then(
      () => null,
      (error: unknown) => error,
    );
    // Ride out the unreachable-indexer fallback sleep before the consuming call.
    await vi.advanceTimersByTimeAsync(4000);

    const error = (await outcome) as DepositConfirmedActionFailedError;
    expect(error).toBeInstanceOf(DepositConfirmedActionFailedError);
    expect(error.operation).toBe("lockStake");
    expect(error.depositTxid).toBe("0xdeposit");
    expect(error.settlement).toBe("unreachable");
  });

  it("propagates a deposit-transfer failure raw — nothing was broadcast, nothing is stranded", async () => {
    const { chain } = makeChain(
      makeInteraction({
        invokeDirectly: vi.fn(async (operation: string) => {
          if (operation === "transfer") throw new Error("User rejected the request");
          return { txid: "0xaction", tx: {} };
        }),
      }),
    );

    const pending = chain.prepayAndInvoke("100000000", "stake", "lockStake", []);

    await expect(pending).rejects.toThrow("User rejected the request");
    await pending.catch((error: unknown) => {
      expect(error).not.toBeInstanceOf(DepositConfirmedActionFailedError);
    });
    expect(mocks.waitForDepositConfirmation).not.toHaveBeenCalled();
  });
});

describe("ChainService.isProcessing write-in-flight flag", () => {
  it("is true while invoke() is in flight and false before/after", async () => {
    // withValueCompat augments the interaction's observable in place, so
    // reading interaction.isProcessing inside the mock sees the service's writes.
    const interaction = makeInteraction();
    const seenDuring: boolean[] = [];
    interaction.invokeDirectly = vi.fn(async () => {
      seenDuring.push(interaction.isProcessing.get());
      return { txid: "0xtx", tx: {} };
    });
    const { chain } = makeChain(interaction);

    expect(chain.isProcessing.get()).toBe(false);
    await chain.invoke("claim", []);

    expect(seenDuring).toEqual([true]);
    expect(chain.isProcessing.get()).toBe(false);
  });

  it("resets to false when invoke() throws (try/finally)", async () => {
    const interaction = makeInteraction({
      invokeDirectly: vi.fn(async () => {
        throw new Error("wallet rejected");
      }),
    });
    const { chain } = makeChain(interaction);

    await expect(chain.invoke("claim", [])).rejects.toThrow("wallet rejected");
    expect(chain.isProcessing.get()).toBe(false);
  });

  it("toggles around invokeWithPayment() and resets on failure", async () => {
    const interaction = makeInteraction();
    const seenDuring: boolean[] = [];
    interaction.invokeWithDirectPrepaidGas = vi.fn(async () => {
      seenDuring.push(interaction.isProcessing.get());
      return { txid: "0xtx", tx: {} };
    });
    const { chain } = makeChain(interaction);

    await chain.invokeWithPayment("100000000", "memo", "buy", []);
    expect(seenDuring).toEqual([true]);
    expect(chain.isProcessing.get()).toBe(false);

    interaction.invokeWithDirectPrepaidGas = vi.fn(async () => {
      throw new Error("FAULT");
    });
    await expect(
      chain.invokeWithPayment("100000000", "memo", "buy", []),
    ).rejects.toThrow("FAULT");
    expect(chain.isProcessing.get()).toBe(false);
  });

  it("stays true across prepayAndInvoke's nested steps instead of flickering", async () => {
    const interaction = makeInteraction();
    const seenDuring: boolean[] = [];
    interaction.invokeDirectly = vi.fn(async () => ({ txid: "0xtx", tx: {} }));
    const { chain } = makeChain(interaction);
    mocks.waitForDepositConfirmation.mockImplementation(async () => {
      // Between the transfer invoke and the consuming invoke the flag must
      // hold — a depth counter, not a plain boolean, guarantees that.
      seenDuring.push(chain.isProcessing.get());
      return "confirmed";
    });

    await chain.prepayAndInvoke("100000000", "stake", "lockStake", []);

    expect(seenDuring).toEqual([true]);
    expect(chain.isProcessing.get()).toBe(false);
  });
});
