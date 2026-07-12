import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  createDicePendingBet,
  createDicePendingBetStore,
} from "./pending-bet-store";
import type { DicePendingBet } from "./pending-bet-store";

const harness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => unknown;
  },
}));

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("@shared/react")>(
    "@shared/react",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as {
        setup?: (ctx: Record<string, unknown>) => unknown;
      };
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("./PhaserPlayArea", () => ({ default: () => null }));

const PLAYER_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const PLAYER_HASH = addressToScriptHash(PLAYER_ADDRESS);
const CONTRACT = "0xef1fac0247ccbad5810e3fcfa1a0885d44efde39";
const NETWORK = "neo-n3-testnet";

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

function observable<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface HarnessScript {
  creditFixed8?: string;
  invoke?: (
    operation: string,
    args: unknown[],
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  invokeWithPayment?: (
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  events?: Record<string, unknown[]>;
  pendingReads?: Record<string, Map<string, unknown>>;
}

type Action = (...args: unknown[]) => Promise<unknown>;

function buildHarness(script: HarnessScript = {}) {
  const actions = new Map<string, Action>();
  const address = observable(PLAYER_ADDRESS);
  const contractAddress = observable<string | null>(CONTRACT);
  const listEvents = vi.fn(async (eventName: string) =>
    script.events?.[eventName] ?? [],
  );
  const read = vi.fn(
    async (operation: string, args: Array<{ value?: unknown }> = []) => {
      if (operation === "bankroll") return "4700000000";
      if (operation === "creditOf") return script.creditFixed8 ?? "0";
      if (operation === "getPendingBet") {
        return script.pendingReads?.[String(args[0]?.value ?? "")] ?? null;
      }
      return "0";
    },
  );
  const invoke = vi.fn(
    async (
      operation: string,
      args: unknown[],
      options?: Record<string, unknown>,
    ) => {
      if (script.invoke) return script.invoke(operation, args, options);
      if (operation === "commit") {
        (options?.onTransactionSent as ((txid: string) => void) | undefined)?.(
          "0xcredit-commit",
        );
        return {
          txid: "0xcredit-commit",
          event: {
            tx_hash: "0xcredit-commit",
            state: ["42", PLAYER_HASH, "4", "10000000", "101"],
          },
          success: true,
          verified: true,
        };
      }
      return {
        txid: "0xsettle",
        event: null,
        success: true,
        verified: false,
      };
    },
  );
  const invokeWithPayment = vi.fn(
    async (
      _amount: string,
      _memo: string,
      _operation: string,
      _args: unknown[],
      options?: Record<string, unknown>,
    ) => {
      if (script.invokeWithPayment) return script.invokeWithPayment(options);
      (options?.onPaymentSent as ((txid: string) => void) | undefined)?.(
        "0xdeposit",
      );
      (options?.onTransactionSent as ((txid: string) => void) | undefined)?.(
        "0xcommit",
      );
      return {
        txid: "0xcommit",
        event: {
          tx_hash: "0xcommit",
          state: ["41", PLAYER_HASH, "4", "10000000", "100"],
        },
        success: true,
        verified: true,
      };
    },
  );
  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => PLAYER_ADDRESS),
    detectNetwork: vi.fn(async () => NETWORK),
    isEvmNetwork: (network: string) => network.startsWith("neo-x"),
    ensureEvmWallet: vi.fn(),
    invokeEvmWithValue: vi.fn(),
    read,
    invoke,
    invokeWithPayment,
    listEvents,
  };
  const setStatus = vi.fn();
  const ctx: Record<string, unknown> = {
    services: { chain },
    launchContext: { params: {}, network: NETWORK },
    t: (key: string) => key,
    setStatus,
    registerAction: (key: string, action: Action) => actions.set(key, action),
  };
  const framework = createMiniAppFramework(ctx as never, {
    appId: "miniapp-dice-game",
  });
  ctx.framework = framework;
  return {
    ctx,
    framework,
    actions,
    chain,
    setStatus,
    pendingStore: createDicePendingBetStore(framework.storage.local),
  };
}

async function setupApp(
  script: HarnessScript = {},
  pending: DicePendingBet[] = [],
) {
  const built = buildHarness(script);
  for (const record of pending) built.pendingStore.upsert(record);
  const setup = harness.definition?.setup;
  expect(setup).toBeTypeOf("function");
  const result = (await setup?.(built.ctx)) as {
    state: Record<string, { get: () => unknown }>;
    loadData: () => Promise<void>;
  };
  return { ...built, result };
}

function pendingRecord(
  txid: string,
  selection: string,
  amount: string,
  amountFixed8: string,
  betId = "",
  now = 1,
) {
  return createDicePendingBet({
    lane: "n3",
    player: PLAYER_HASH,
    network: NETWORK,
    contract: CONTRACT,
    txid,
    betId,
    amount,
    amountFixed8,
    selection,
    phase: betId ? "pending" : "broadcast",
    now,
  });
}

function settledBet(
  id: string,
  face: string,
  wager: string,
  rolled: string,
  won: boolean,
) {
  const payout = won ? ((BigInt(wager) * 57n) / 10n).toString() : "0";
  return new Map<string, unknown>([
    ["id", id],
    ["player", PLAYER_HASH],
    ["face", face],
    ["wager", wager],
    ["settled", true],
    ["rolled", rolled],
    ["won", won],
    ["payout", payout],
  ]);
}

describe("dice durable pending recovery", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.definition = null;
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", new MemoryLocalStorage());
    await import("./main");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tops up only the shortfall beyond reusable N3 credit", async () => {
    const app = await setupApp({ creditFixed8: "4000000" });

    await app.actions.get("placeDiceBet")?.({
      chosenNumber: "4",
      amount: "0.1",
    });

    expect(app.chain.invokeWithPayment).toHaveBeenCalledWith(
      "6000000",
      expect.any(String),
      "commit",
      expect.any(Array),
      expect.any(Object),
    );
  });

  it("commits without another transfer when reusable credit covers the wager", async () => {
    const app = await setupApp({ creditFixed8: "10000000" });

    await app.actions.get("placeDiceBet")?.({
      chosenNumber: "4",
      amount: "0.1",
    });

    expect(app.chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(app.chain.invoke).toHaveBeenCalledWith(
      "commit",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "Committed" }),
    );
  });

  it("does not persist a wager when the wallet rejects before broadcast", async () => {
    const app = await setupApp({
      invokeWithPayment: async () => {
        throw new Error("User rejected the request");
      },
    });

    // The framework action boundary intentionally swallows handler rejection
    // after surfacing status; the important invariant is that no financial
    // recovery record is fabricated before a transaction exists.
    await expect(
      app.actions.get("placeDiceBet")?.({ chosenNumber: "4", amount: "0.1" }),
    ).resolves.toBeUndefined();

    expect(
      app.pendingStore.list({
        player: PLAYER_HASH,
        network: NETWORK,
        contract: CONTRACT,
      }),
    ).toEqual([]);
    expect(app.result.state.rollHistory!.get()).toEqual([]);
    expect(app.setStatus).toHaveBeenCalledWith(
      "User rejected the request",
      "error",
    );
  });

  it("retains an event-timeout broadcast and exposes a repeatable recheck", async () => {
    const app = await setupApp({
      invokeWithPayment: async (options) => {
        (options?.onPaymentSent as ((txid: string) => void) | undefined)?.(
          "0xdeposit-timeout",
        );
        (options?.onTransactionSent as
          | ((txid: string) => void)
          | undefined)?.("0xcommit-timeout");
        return {
          txid: "0xcommit-timeout",
          event: null,
          success: true,
          verified: false,
        };
      },
      events: { Committed: [], Settled: [] },
    });

    await app.actions.get("placeDiceBet")?.({
      chosenNumber: "3",
      amount: "0.2",
    });
    let records = app.pendingStore.list({
      player: PLAYER_HASH,
      network: NETWORK,
      contract: CONTRACT,
    });
    expect(records).toMatchObject([
      {
        txid: "0xcommit-timeout",
        betId: "",
        amount: "0.2",
        amountFixed8: "20000000",
        selection: "3",
        phase: "broadcast",
      },
    ]);

    // Six exact-tx recovery reads give up; the record becomes unknown, not lost.
    await vi.advanceTimersByTimeAsync(36_000);
    expect(app.result.state.isUnresolved!.get()).toBe(true);
    records = app.pendingStore.list({
      player: PLAYER_HASH,
      network: NETWORK,
      contract: CONTRACT,
    });
    expect(records[0]?.phase).toBe("unknown");
    expect(app.chain.listEvents).toHaveBeenCalledTimes(6);

    await app.actions.get("recheckSettlement")?.();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(app.chain.listEvents).toHaveBeenCalledTimes(7);
    expect(
      app.pendingStore.list({
        player: PLAYER_HASH,
        network: NETWORK,
        contract: CONTRACT,
      }),
    ).toHaveLength(1);
  });

  it("persists the commit tx before the event wait resolves, closing the refresh window", async () => {
    let finishWait!: (value: Record<string, unknown>) => void;
    const app = await setupApp({
      invokeWithPayment: async (options) => {
        (options?.onPaymentSent as ((txid: string) => void) | undefined)?.(
          "0xdeposit-inflight",
        );
        (options?.onTransactionSent as
          | ((txid: string) => void)
          | undefined)?.("0xcommit-inflight");
        return new Promise<Record<string, unknown>>((resolve) => {
          finishWait = resolve;
        });
      },
      events: { Committed: [], Settled: [] },
    });

    const placement = app.actions.get("placeDiceBet")?.({
      chosenNumber: "6",
      amount: "0.5",
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(
      app.pendingStore.list({
        player: PLAYER_HASH,
        network: NETWORK,
        contract: CONTRACT,
      }),
    ).toMatchObject([
      {
        txid: "0xcommit-inflight",
        betId: "",
        amount: "0.5",
        selection: "6",
        phase: "broadcast",
      },
    ]);

    finishWait({
      txid: "0xcommit-inflight",
      event: null,
      success: true,
      verified: false,
    });
    await placement;
  });

  it("restores by exact bet id after refresh and clears only after confirmed settlement", async () => {
    const record = pendingRecord(
      "0xcommit-refresh",
      "4",
      "0.1",
      "10000000",
      "42",
    );
    const app = await setupApp(
      {
        pendingReads: {
          "42": settledBet("42", "4", "10000000", "4", true),
        },
        events: { Settled: [] },
      },
      [record],
    );

    await app.result.loadData();

    expect(app.chain.invoke).not.toHaveBeenCalled();
    expect(app.result.state.rollHistory!.get()).toMatchObject([
      { face: "4", outcome: "won", rolled: "4" },
    ]);
    expect(app.pendingStore.list(record)).toEqual([]);
  });

  it("keeps a settled-looking row pending when canonical payout arithmetic is inconsistent", async () => {
    const record = pendingRecord(
      "0xcommit-corrupt",
      "4",
      "0.1",
      "10000000",
      "42",
    );
    const malformed = settledBet("42", "4", "10000000", "4", true);
    malformed.set("payout", "1");
    const app = await setupApp(
      {
        pendingReads: { "42": malformed },
        events: {
          Settled: [{
            tx_hash: "0xsettle-corrupt",
            state: ["42", PLAYER_HASH, "4", "4", true, "57000000"],
          }],
        },
      },
      [record],
    );

    await app.result.loadData();

    expect(app.pendingStore.list(record)).toHaveLength(1);
    expect(app.result.state.isUnresolved!.get()).toBe(true);
    expect(app.result.state.rollHistory!.get()).toMatchObject([
      { face: "4", outcome: "pending" },
    ]);
  });

  it("maps concurrent refresh recovery by each txid and never by the newest player event", async () => {
    const first = pendingRecord(
      "0xtx-a",
      "2",
      "0.1",
      "10000000",
      "",
      1,
    );
    const second = pendingRecord(
      "0xtx-b",
      "5",
      "0.2",
      "20000000",
      "",
      2,
    );
    const app = await setupApp(
      {
        events: {
          Committed: [
            {
              tx_hash: "0xlatest-other",
              state: ["99", PLAYER_HASH, "6", "10000000", "300"],
            },
            {
              tx_hash: "0xtx-b",
              state: ["12", PLAYER_HASH, "5", "20000000", "200"],
            },
            {
              tx_hash: "0xtx-a",
              state: ["11", PLAYER_HASH, "2", "10000000", "100"],
            },
          ],
          Settled: [],
        },
        pendingReads: {
          "11": settledBet("11", "2", "10000000", "1", false),
          "12": settledBet("12", "5", "20000000", "5", true),
          "99": settledBet("99", "6", "10000000", "6", true),
        },
      },
      [first, second],
    );

    await app.result.loadData();

    const getPendingCalls = app.chain.read.mock.calls
      .filter(([operation]) => operation === "getPendingBet")
      .map(([, args]) =>
        String((args as Array<{ value?: unknown }> | undefined)?.[0]?.value),
      );
    expect(getPendingCalls).toEqual(["11", "12"]);
    expect(getPendingCalls).not.toContain("99");
    expect(app.pendingStore.list(first)).toEqual([]);
    expect(app.result.state.rollHistory!.get()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ face: "2", outcome: "lost", rolled: "1" }),
        expect.objectContaining({ face: "5", outcome: "won", rolled: "5" }),
      ]),
    );
  });
});
