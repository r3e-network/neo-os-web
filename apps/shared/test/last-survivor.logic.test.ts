import { describe, expect, it, vi } from "vitest";

import { useLastSurvivor } from "../../last-survivor/src/composables/useLastSurvivor";
import { createMiniAppFramework } from "../react";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xe238516951196b87406d39b2b9d35809f6d857fb";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BUY_MEMO = "miniapp-lastsurvivor:buy";

function t(key: string) {
  const messages: Record<string, string> = {
    activeRound: "Active",
    inactiveRound: "Rollover ready",
    notAvailable: "Unavailable",
    invalidKeyCount: "Invalid key count",
    maxKeyCountExceeded: "Maximum 1000 keys per transaction",
    missingContract: "Contract not configured",
    walletNotConnected: "Wallet Not Connected",
    settleBeforeBuy: "Settle the round first.",
    keyPurchaseDepositHeld: "Deposit held as reusable credit.",
    roundStateUnavailable: "The countdown service is not available yet.",
    winnerDeclared: "Winner declared",
    tokenGas: "GAS",
  };
  return messages[key] ?? key;
}

/**
 * A getCurrentRound / getRound Map matching the deployed MiniAppLastSurvivor
 * ABI. pot/totalKeys are base-unit/integer; endTime is ms; remainingTime is
 * already SECONDS.
 */
function roundMap(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    roundId: 4,
    pot: "150000000", // 1.5 GAS in base units
    totalKeys: 20,
    lastBuyer: "0x0000000000000000000000000000000000000000", // fresh round → no buyer
    endTime: String(Date.now() + 3_600_000),
    settled: false,
    active: true,
    remainingTime: 3600, // seconds
    ...overrides,
  };
}

/** A KeysBought event payload (round, player, count, cost, pot, endTime). */
function keysBoughtEvent(cost: string): TxResult["event"] {
  return {
    state: [
      { type: "Integer", value: "4" },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "1" },
      { type: "Integer", value: cost },
      { type: "Integer", value: "150000000" },
      { type: "Integer", value: String(Date.now() + 3_600_000) },
    ],
  };
}

interface ChainOpts {
  round?: Record<string, unknown>;
  playerKeys?: string;
  currentKeyCost?: string;
  rounds?: Record<number, Record<string, unknown>>;
  currentRoundId?: number;
  buyThrows?: Error;
}

/**
 * Minimal ChainService stand-in. Records invoke/read calls so tests can assert
 * the direct-contract deposit + buyKeys + settle argument shapes. `read`
 * resolves getCurrentRound / getRound / playerKeys / currentKeyCost against the
 * options above.
 */
function makeChain(opts: ChainOpts = {}) {
  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      let event: unknown;
      if (op === "buyKeys") {
        if (opts.buyThrows) throw opts.buyThrows;
        if (options?.waitForEvent === "KeysBought") event = keysBoughtEvent("2000095000");
      }
      if (op === "settle" && options?.waitForEvent === "RoundSettled") {
        event = { state: [{ type: "Integer", value: "4" }] };
      }
      return { txid: "0xtx", event, success: true };
    },
  );

  const read = vi.fn(
    async (op: string, args?: ContractArg[]): Promise<unknown> => {
      if (op === "getCurrentRound") return opts.round ?? roundMap();
      if (op === "getRound") {
        const id = Number(args?.[0]?.value ?? 0);
        return opts.rounds?.[id] ?? {};
      }
      if (op === "currentRoundId") return opts.currentRoundId ?? 4;
      if (op === "playerKeys") return opts.playerKeys ?? "0";
      if (op === "currentKeyCost") return opts.currentKeyCost ?? "2000095000";
      return {};
    },
  );

  const readArray = vi.fn(async (): Promise<unknown[]> => []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    readArray,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    read: typeof read;
    readArray: typeof readArray;
  };
  return { chain, invoke, read };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, read } = makeChain(opts);
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-last-survivor" },
  );
  const app = useLastSurvivor({ app: framework, t });
  app.setAddress(PLAYER);
  return { app, chain, invoke, read };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useLastSurvivor (direct MiniAppLastSurvivor contract)", () => {
  it("loads the current round from getCurrentRound and scales the pot to whole GAS", async () => {
    const { app, read } = setup({ playerKeys: "5" });

    await app.loadAll();

    expect(app.roundDataAvailable.get()).toBe(true);
    expect(app.roundId.get()).toBe(4);
    expect(app.isRoundActive.get()).toBe(true);
    expect(app.roundStatusDisplay.get()).toBe("Active");
    // Pot scaled by 1e8: 150000000 base units -> 1.5 GAS.
    expect(app.totalPot.get()).toBeCloseTo(1.5, 8);
    // totalKeysInRound is the chain round total (bigint), surfaced as a number.
    expect(app.totalKeysInRound.get()).toBe(20n);
    expect(app.totalKeysDisplay.get()).toBe(20);
    // The round data came from getCurrentRound + playerKeys, NOT os.game proxies.
    expect(read.mock.calls.some((c) => c[0] === "getCurrentRound")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "playerKeys")).toBe(true);
  });

  it("reads the user's keys via playerKeys(roundId, player) and derives share from the round total", async () => {
    const { app, read } = setup({ playerKeys: "5" });

    await app.loadAll();

    // Player owns 5 of the 20 round keys.
    expect(app.userKeys.get()).toBe(5);
    expect(app.userSharePercent.get()).toBeCloseTo(25, 8);

    const pkCall = read.mock.calls.find((c) => c[0] === "playerKeys");
    expect(pkCall?.[1]).toEqual([
      { type: "Integer", value: "4" },
      { type: "Hash160", value: PLAYER_HASH },
    ]);
  });

  it("guards divide-by-zero for share when no keys have been sold", async () => {
    const { app } = setup({
      round: roundMap({ totalKeys: 0, pot: "0", remainingTime: 3600 }),
      playerKeys: "0",
    });

    await app.loadAll();

    expect(app.totalKeysDisplay.get()).toBe(0);
    expect(app.userSharePercent.get()).toBe(0);
  });

  it("surfaces a service notice when the round read fails", async () => {
    const { chain, invoke } = makeChain();
    (chain.read as ReturnType<typeof vi.fn>).mockImplementation(async (op: string) => {
      if (op === "getCurrentRound") throw new Error("rpc unavailable");
      return {};
    });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-last-survivor" },
    );
    const app = useLastSurvivor({ app: framework, t });
    app.setAddress(PLAYER);

    await expect(app.loadAll()).resolves.toBeUndefined();
    expect(app.roundDataAvailable.get()).toBe(false);
    expect(app.isRoundActive.get()).toBe(false);
    expect(app.serviceNotice.get()).toBe("The countdown service is not available yet.");
    expect(app.history.get()).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rebuilds history from settled past rounds via getRound (newest first)", async () => {
    const winner = "0x1111111111111111111111111111111111111111";
    const { app } = setup({
      round: roundMap({ roundId: 3 }),
      rounds: {
        1: roundMap({ roundId: 1, settled: true, active: false, totalKeys: 4, pot: "100000000", lastBuyer: winner, remainingTime: 0 }),
        2: roundMap({ roundId: 2, settled: true, active: false, totalKeys: 6, pot: "300000000", lastBuyer: winner, remainingTime: 0 }),
      },
    });

    await app.loadAll();

    const hist = app.history.get();
    // Two settled rounds yield winnerDeclared entries; newest (round 2) first.
    expect(hist).toHaveLength(2);
    expect(hist[0].title).toBe("Winner declared");
    expect(hist[0].sortKey).toBe(2);
    expect(hist[1].sortKey).toBe(1);
    // Prize is the pot scaled to GAS (3 GAS for round 2).
    expect(hist[0].details).toContain("3.00 GAS");
  });

  it("deposits the buy cost then calls buyKeys, in that order", async () => {
    const { app, invoke } = setup({ currentKeyCost: "2000095000" });

    await app.loadAll();
    await app.buyKeys("1");

    // Step 1: DEPOSIT — GAS transfer to the contract with the buy memo, base units.
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "2000095000" }, // on-chain currentKeyCost
      { type: "String", value: BUY_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: buyKeys(player, count) waiting for the KeysBought event.
    const buy = callFor(invoke, "buyKeys");
    expect(buy).toBeTruthy();
    expect(buy![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "1" },
    ]);
    expect(buy![2]).toMatchObject({ waitForEvent: "KeysBought" });

    // The deposit must precede the buy.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("buyKeys"));
  });

  it("rejects an invalid key count before any chain call", async () => {
    const { app, invoke } = setup();
    await app.loadAll();
    invoke.mockClear();

    await expect(app.buyKeys("0")).rejects.toThrow("Invalid key count");
    await expect(app.buyKeys("1001")).rejects.toThrow("Maximum 1000 keys per transaction");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("blocks a buy on an expired round and asks the player to settle first", async () => {
    const { app, invoke } = setup({
      // Round has keys but the timer expired: active=false, remainingTime 0.
      round: roundMap({ active: false, remainingTime: 0, totalKeys: 8, pot: "200000000", lastBuyer: "0x2222222222222222222222222222222222222222" }),
    });

    await app.loadAll();
    invoke.mockClear();

    await expect(app.buyKeys("1")).rejects.toThrow("Settle the round first.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a held-deposit message when buyKeys faults after the deposit lands", async () => {
    const { app, invoke } = setup({ buyThrows: new Error("some chain fault") });

    await app.loadAll();
    await expect(app.buyKeys("1")).rejects.toThrow("Deposit held as reusable credit.");

    // The deposit DID go out (it landed); only the buy faulted.
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "buyKeys")).toBeTruthy();
  });

  it("maps a contract 'settle first' fault on buy to the settle-before-buy message", async () => {
    const { app } = setup({ buyThrows: new Error("round ended; settle first") });

    await app.loadAll();
    await expect(app.buyKeys("1")).rejects.toThrow("Settle the round first.");
  });

  it("settles a round permissionlessly via settle()", async () => {
    const { app, invoke } = setup();

    await app.loadAll();
    await app.settleRound();

    const settle = callFor(invoke, "settle");
    expect(settle).toBeTruthy();
    expect(settle![1]).toEqual([]); // no args — pays the on-chain last buyer
    expect(settle![2]).toMatchObject({ waitForEvent: "RoundSettled" });
  });

  it("flags needsLifecycleSync when a round has ended with a recorded winner and pot", async () => {
    const { app } = setup({
      round: roundMap({ active: false, remainingTime: 0, totalKeys: 8, pot: "200000000", lastBuyer: "0x3333333333333333333333333333333333333333" }),
    });

    await app.loadAll();

    expect(app.isRoundActive.get()).toBe(false);
    expect(app.lastBuyer.get()).toBe("0x3333333333333333333333333333333333333333");
    expect(app.totalPot.get()).toBeCloseTo(2, 8);
    expect(app.needsLifecycleSync.get()).toBe(true);
  });
});
