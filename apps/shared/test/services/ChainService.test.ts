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
    });
  });
});
