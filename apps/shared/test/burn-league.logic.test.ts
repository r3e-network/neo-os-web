import { describe, expect, it, vi } from "vitest";

import { useBurnLeague } from "../../burn-league/src/composables/useBurnLeague";
import { createMiniAppFramework } from "../react";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BURN_MEMO = "miniapp-burnleague:burn";
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    burnActionUnavailable: "The burn could not be submitted to the contract.",
    burnServiceUnavailable: "Stats unavailable; you can still prepare a burn. Pool and rank refresh later.",
    burnDepositHeld: "Your GAS was deposited as reusable burn credit.",
    burnPreparing: `Preparing a ${params?.amount ?? ""} burn wallet confirmation.`,
    burnSubmitted: "Burn confirmed on chain. Refreshing the pool and leaderboard.",
    burnWalletUnavailable: "Connect your wallet to confirm the burn transaction.",
    maxBurn: `Maximum burn is ${params?.amount ?? ""} ${params?.tokenGas ?? ""}`,
    minBurn: `Minimum burn is ${params?.amount ?? ""} ${params?.tokenGas ?? ""}`,
    missingContract: "Contract not configured",
    seasonActive: "Live now",
    seasonDormant: "Not started",
    seasonEnded: "Ended — awaiting settle",
    settleBeforeBurn: "The season has ended. Settle it first.",
    tokenGas: "GAS",
  };
  return messages[key] ?? key;
}

/**
 * A Burned event payload (seasonId, player, amount, userSeasonTotal). All GAS
 * fields are base units; player is a decoded address string (N3Index decodes the
 * Hash160 slot to an address, as dev-tipping's Tipped tipper slot relies on).
 */
function burnedEvent(
  seasonId: number,
  player: string,
  amount: string,
  userSeasonTotal: string,
): unknown {
  return {
    event_name: "Burned",
    state: [
      { type: "Integer", value: String(seasonId) },
      { type: "Hash160", value: player },
      { type: "Integer", value: amount },
      { type: "Integer", value: userSeasonTotal },
    ],
  };
}

interface ChainOpts {
  /** currentSeason() read. */
  season?: number;
  /** seasonEnd() read (ms epoch; 0 = dormant). */
  seasonEnd?: number;
  /** rewardPool()/totalBurned() read (base units). */
  pool?: string;
  /** burnCount() read. */
  burnCount?: number;
  /** topBurner() read (address or zero). */
  topBurner?: string;
  /** topBurned() read (base units). */
  topBurned?: string;
  /** userBurned(player) read (base units). */
  userBurned?: string;
  /** creditOf(player) read (base units). */
  credit?: string;
  /** Burned events returned by listEvents. */
  burnedEvents?: unknown[];
  /** Force the burn() invoke to throw. */
  burnThrows?: Error;
}

/**
 * Minimal ChainService stand-in. Records invoke/read/listEvents calls so tests
 * can assert the direct-contract deposit + burn + settle argument shapes and the
 * leaderboard-from-events wiring. No OS proxies are involved.
 */
function makeChain(opts: ChainOpts = {}) {
  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      let event: unknown;
      if (op === "burn") {
        if (opts.burnThrows) throw opts.burnThrows;
        if (options?.waitForEvent === "Burned") {
          event = burnedEvent(opts.season ?? 1, PLAYER, "500000000", "500000000");
        }
      }
      if (op === "settle" && options?.waitForEvent === "SeasonSettled") {
        event = { state: [{ type: "Integer", value: String(opts.season ?? 1) }] };
      }
      return { txid: "0xtx", event, success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    switch (op) {
      case "currentSeason": return String(opts.season ?? 1);
      case "seasonEnd": return String(opts.seasonEnd ?? Date.now() + 120_000);
      case "rewardPool":
      case "totalBurned": return opts.pool ?? "0";
      case "burnCount": return String(opts.burnCount ?? 0);
      case "topBurner": return opts.topBurner ?? ZERO_HASH;
      case "topBurned": return opts.topBurned ?? "0";
      case "userBurned": return opts.userBurned ?? "0";
      case "creditOf": return opts.credit ?? "0";
      default: return "0";
    }
  });

  const listEvents = vi.fn(async (): Promise<unknown[]> => opts.burnedEvents ?? []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    listEvents,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    read: typeof read;
    listEvents: typeof listEvents;
  };
  return { chain, invoke, read, listEvents };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, read, listEvents } = makeChain(opts);
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-burn-league" },
  );
  const app = useBurnLeague({ app: framework, t, getAddress: () => PLAYER });
  app.setAddress(PLAYER);
  return { app, chain, invoke, read, listEvents };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useBurnLeague (direct MiniAppBurnLeague contract)", () => {
  it("loads season stats from the contract and scales base units to whole GAS", async () => {
    const future = Date.now() + 120_000;
    const { app, read } = setup({
      season: 2,
      seasonEnd: future,
      pool: "1200000000", // 12 GAS pool
      burnCount: 3,
      topBurner: "0x1111111111111111111111111111111111111111",
      topBurned: "800000000", // 8 GAS leader total
      userBurned: "300000000", // 3 GAS user total
    });

    await app.loadAll();

    expect(app.leagueDataAvailable.get()).toBe(true);
    expect(app.seasonId.get()).toBe(2);
    expect(app.formattedSeason.get()).toBe("#2");
    // Pool scaled by 1e8: 1200000000 -> 12 GAS. totalBurned == rewardPool.
    expect(app.rewardPool.get()).toBeCloseTo(12, 8);
    expect(app.totalBurned.get()).toBeCloseTo(12, 8);
    expect(app.burnCount.get()).toBe(3);
    expect(app.userBurned.get()).toBeCloseTo(3, 8);
    expect(app.topBurnedGas.get()).toBeCloseTo(8, 8);
    expect(app.seasonPhase.get()).toBe("active");
    expect(app.isSeasonActive.get()).toBe(true);
    expect(app.needsSettle.get()).toBe(false);
    // Reads came from the contract, NOT os.game/leaderboard proxies.
    expect(read.mock.calls.some((c) => c[0] === "currentSeason")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "rewardPool")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "userBurned")).toBe(true);
  });

  it("treats seasonEnd==0 as a dormant season", async () => {
    const { app } = setup({ season: 0, seasonEnd: 0 });

    await app.loadAll();

    expect(app.seasonPhase.get()).toBe("dormant");
    expect(app.isSeasonActive.get()).toBe(false);
    expect(app.needsSettle.get()).toBe(false);
    expect(app.formattedSeason.get()).toBe("--");
  });

  it("flags needsSettle once the season deadline has passed", async () => {
    const { app } = setup({ season: 1, seasonEnd: Date.now() - 1_000, pool: "500000000" });

    await app.loadAll();

    expect(app.seasonPhase.get()).toBe("ended");
    expect(app.needsSettle.get()).toBe(true);
    expect(app.isSeasonActive.get()).toBe(false);
  });

  it("rebuilds the leaderboard from current-season Burned events, latest total per player, desc", async () => {
    const top = "Ntop1111111111111111111111111111111";
    const mid = PLAYER;
    const low = "Nlow3333333333333333333333333333333";
    const { app, listEvents } = setup({
      season: 2,
      seasonEnd: Date.now() + 120_000,
      pool: "1100000000",
      burnedEvents: [
        // Newest first. The FIRST event per player is their latest season total.
        burnedEvent(2, mid, "200000000", "500000000"), // me: latest 5 GAS
        burnedEvent(2, top, "100000000", "800000000"), // top: latest 8 GAS
        burnedEvent(2, mid, "300000000", "300000000"), // stale earlier total — ignored
        burnedEvent(2, low, "200000000", "200000000"), // low: 2 GAS
        burnedEvent(1, top, "900000000", "900000000"), // PRIOR season — excluded
      ],
    });

    await app.loadAll();

    const board = app.leaderboard.get();
    expect(board.map((e) => [e.address, e.burned])).toEqual([
      [top, 8],
      [mid, 5],
      [low, 2],
    ]);
    // The user's rank is resolved by wallet identity (#2 here), independent of
    // the userBurned read.
    expect(app.rank.get()).toBe(2);
    expect(board.find((e) => e.isUser)?.address).toBe(mid);
    expect(board.filter((e) => e.isUser)).toHaveLength(1);
    // The leaderboard was read from Burned events, filtered to the current season.
    expect(listEvents).toHaveBeenCalledWith("Burned", { limit: 200 });
  });

  it("leaves rank unresolved when the connected wallet has no current-season burns", async () => {
    const { app } = setup({
      season: 1,
      burnedEvents: [burnedEvent(1, "Nsomeone1111111111111111111111111111", "100000000", "100000000")],
    });

    await app.loadAll();

    expect(app.rank.get()).toBe(0);
    expect(app.leaderboard.get().some((e) => e.isUser)).toBe(false);
  });

  it("deposits the burn amount then calls burn(player, amountBase), in that order", async () => {
    const { app, invoke } = setup({ season: 1, credit: "0" });

    await app.loadAll();
    invoke.mockClear();
    await app.burnTokens("5");

    // Step 1: DEPOSIT — GAS transfer to the contract with the burn memo, base units.
    // 5 GAS -> 500000000 base units (×1e8, scaled ONCE — no double-scale).
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "500000000" },
      { type: "String", value: BURN_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: burn(player, amountBase) waiting for the Burned event.
    const burn = callFor(invoke, "burn");
    expect(burn).toBeTruthy();
    expect(burn![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "500000000" },
    ]);
    expect(burn![2]).toMatchObject({ waitForEvent: "Burned" });

    // The deposit must precede the burn.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("burn"));
    expect(app.lastSubmittedAmount.get()).toBe("5.00 GAS");
    expect(app.actionNotice.get()).toBe(
      "Burn confirmed on chain. Refreshing the pool and leaderboard.",
    );
  });

  it("skips the deposit when prepaid burn credit already covers the amount", async () => {
    const { app, invoke } = setup({ season: 1, credit: "600000000" }); // 6 GAS credit

    await app.loadAll();
    invoke.mockClear();
    await app.burnTokens("5"); // needs 5 GAS, credit covers it

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "burn")).toBeTruthy();
  });

  it("rejects an out-of-range burn before any chain call", async () => {
    const { app, invoke } = setup();
    await app.loadAll();
    invoke.mockClear();

    await expect(app.burnTokens("0")).rejects.toThrow("Minimum burn is 1 GAS");
    await expect(app.burnTokens("1001")).rejects.toThrow("Maximum burn is 1000 GAS");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("blocks a burn on an ended season and asks the player to settle first", async () => {
    const { app, invoke } = setup({ season: 1, seasonEnd: Date.now() - 1_000, pool: "500000000" });

    await app.loadAll();
    invoke.mockClear();

    await expect(app.burnTokens("5")).rejects.toThrow(
      "The season has ended. Settle it first.",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a held-deposit message when burn faults after the deposit lands", async () => {
    const { app, invoke } = setup({ season: 1, credit: "0", burnThrows: new Error("some chain fault") });

    await app.loadAll();
    await expect(app.burnTokens("5")).rejects.toThrow(
      "Your GAS was deposited as reusable burn credit.",
    );

    // The deposit DID go out (it landed); only the burn faulted.
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "burn")).toBeTruthy();
  });

  it("maps a contract 'settle first' fault on burn to the settle-before-burn message", async () => {
    const { app } = setup({ season: 1, credit: "0", burnThrows: new Error("season ended; settle first") });

    await app.loadAll();
    await expect(app.burnTokens("5")).rejects.toThrow(
      "The season has ended. Settle it first.",
    );
  });

  it("surfaces a service notice when the season reads fail", async () => {
    const { chain, invoke } = makeChain();
    (chain.read as ReturnType<typeof vi.fn>).mockImplementation(async (op: string) => {
      if (op === "currentSeason") throw new Error("rpc unavailable");
      return "0";
    });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-burn-league" },
    );
    const app = useBurnLeague({ app: framework, t, getAddress: () => PLAYER });
    app.setAddress(PLAYER);

    await expect(app.loadAll()).resolves.toBeUndefined();
    expect(app.leagueDataAvailable.get()).toBe(false);
    expect(app.serviceNotice.get()).toBe(
      "Stats unavailable; you can still prepare a burn. Pool and rank refresh later.",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("settles a season permissionlessly via settle()", async () => {
    const { app, invoke } = setup({ season: 1, seasonEnd: Date.now() - 1_000, pool: "500000000" });

    await app.loadAll();
    await app.settleSeason();

    const settle = callFor(invoke, "settle");
    expect(settle).toBeTruthy();
    expect(settle![1]).toEqual([]); // no args — pays the on-chain top burner
    expect(settle![2]).toMatchObject({ waitForEvent: "SeasonSettled" });
  });

  it("exposes the whole reward pool as the prize (no 0.1x estimate)", async () => {
    const { app } = setup({ season: 1, pool: "1500000000" }); // 15 GAS pool

    await app.loadAll();

    // The prize is the WHOLE pool, not a fraction of the player's burn.
    expect(app.prizePoolDisplay.get()).toBe("15.00 GAS");
  });
});
