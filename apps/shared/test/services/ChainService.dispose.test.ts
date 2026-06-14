import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useContractInteraction: vi.fn(),
}));

vi.mock("@shared/composables/useContractInteraction", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@shared/composables/useContractInteraction")
  >();
  return {
    ...actual,
    useContractInteraction: mocks.useContractInteraction,
  };
});

import { ChainService } from "@shared/services/ChainService";
import { CacheService } from "@shared/services/CacheService";
import { EventBus } from "@shared/services/EventBus";
import { createObservable } from "@shared/react/context";

const t = (key: string) => key;

function makeInteraction(dispose: () => void) {
  return {
    address: createObservable<string | null>(null),
    contractAddress: createObservable<string | null>(null),
    isProcessing: createObservable(false),
    ensureWallet: vi.fn(async () => ""),
    read: vi.fn(async () => null),
    readArray: vi.fn(async () => [] as unknown[]),
    invokeDirectly: vi.fn(async () => ({ txid: "0xtx", tx: {} })),
    invokeWithDirectPrepaidGas: vi.fn(async () => ({ txid: "0xtx", tx: {} })),
    dispose,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ChainService.dispose (C11)", () => {
  it("forwards dispose() to the underlying contract interaction", () => {
    const dispose = vi.fn();
    mocks.useContractInteraction.mockReturnValue(makeInteraction(dispose));
    const chain = new ChainService(
      "miniapp-dispose-test",
      t,
      new CacheService("miniapp-dispose-test"),
      new EventBus(),
    );

    chain.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — repeated dispose() stays safe", () => {
    const dispose = vi.fn();
    mocks.useContractInteraction.mockReturnValue(makeInteraction(dispose));
    const chain = new ChainService(
      "miniapp-dispose-test",
      t,
      new CacheService("miniapp-dispose-test"),
      new EventBus(),
    );

    chain.dispose();
    chain.dispose();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});

describe("useContractInteraction timer cleanup contract (C11)", () => {
  it("dispose() clears the disposable settle-delay timer so it never fires after unmount", async () => {
    vi.useFakeTimers();
    const real = await vi.importActual<
      typeof import("@shared/composables/useContractInteraction")
    >("@shared/composables/useContractInteraction");

    const wallet = {
      address: { value: "NWalletForTimerCleanupTest000000000" },
      chainType: { value: "neo-n3-testnet" },
      connect: vi.fn(async () => undefined),
      // First call = the GAS transfer, second = the consuming op (never reached
      // here because the settle delay is still pending when we dispose).
      invokeContract: vi.fn(async () => ({ txid: "0xtransfer" })),
      invokeRead: vi.fn(async () => ({})),
    };

    const interaction = real.useContractInteraction({
      appId: "miniapp-timer-cleanup",
      t,
      wallet: wallet as never,
      // Force the "unreachable" branch so the disposable delay() schedules a
      // real timer (the only deterministic way to arm one of the tracked timers).
      confirmDeposit: async () => "unreachable",
    });

    // Fire-and-forget: it parks on the internal delay(waitMs) timer.
    void interaction
      .invokeWithDirectPrepaidGas(
        "100000000",
        "memo",
        "consume",
        [],
        "0xcontract",
        4000,
      )
      .catch(() => undefined);

    // Let the transfer + confirmDeposit microtask chain run so the disposable
    // delay() timer is scheduled. advanceTimersByTimeAsync(0) flushes the
    // microtask queue without advancing wall-clock; loop until the tracked
    // timer appears (the chain is several awaits deep before delay()).
    for (let i = 0; i < 10 && vi.getTimerCount() === 0; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    interaction.dispose();
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });
});
