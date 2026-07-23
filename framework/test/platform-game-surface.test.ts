/**
 * app.platformGame regression contract (Platform Contract Library v2 phase 2 —
 * the shared PlatformGame RewardGame engine surface).
 *
 * Locks the invariants of the one uniform lane apps consume for the engine
 * (design doc §3.3 + the §6 item 4 config-injection grammar):
 * - every call auto-threads the framework appId FIRST and targets the
 *   injected gameHash — apps never pass an appId or hardcode a script hash;
 * - the ABI is the verbatim engine ABI (startGame / finalizeGame /
 *   expireGame / withdraw + the eight reads), appId-first on the wire but
 *   appId-free at the call site;
 * - writes run the RFC P0-2 guarded-write stanza (guest guard BEFORE the
 *   S11 "invoke:primary" gate BEFORE the broadcast) and carry NO payment
 *   (entries come from prepaid engine credit);
 * - event decodes honor the appId-slot-0 shift (GameStarted gameId slot 1,
 *   Finalizing requestId slot 3, CreditWithdrawn amount slot 2);
 * - reads stay ungated (guests can quote the pool) and decode getGame /
 *   statsOf maps typed, keeping the raw status code alongside the
 *   SDK-vocabulary status;
 * - absent/invalid config throws typed FrameworkCapabilityError
 *   (capability "platformGame"), never silently no-ops, and fires NO chain
 *   call.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { addressToScriptHash } from "../utils/neo";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(ADDRESS);
const GAME_HASH = `0x${"ab".repeat(20)}`;
const OTHER_PLAYER_HASH = `0x${"11".repeat(20)}`;
const GUEST_ERROR = /guest-mode: on-chain\/oracle operations are disabled/;
const APP_ID = "platform-game-test";

/** Chain-read UInt160 shape: 0x + CHAIN (reversed) byte order hex. */
const chainHex = (display: string): string =>
  `0x${display
    .slice(2)
    .match(/../g)!
    .reverse()
    .join("")}`;

const GAME_STARTED_EVENT = {
  tx_hash: "0xstart",
  state: [
    { type: "String", value: APP_ID },
    { type: "Integer", value: "7" },
    { type: "Hash160", value: PLAYER_HASH },
    { type: "Integer", value: "1" },
    { type: "Integer", value: "100000000" },
    { type: "Integer", value: "1752700000000" },
  ],
};

const FINALIZING_EVENT = {
  tx_hash: "0xfin",
  state: [
    { type: "String", value: APP_ID },
    { type: "Integer", value: "7" },
    { type: "Hash160", value: PLAYER_HASH },
    { type: "Integer", value: "42" },
  ],
};

const CREDIT_WITHDRAWN_EVENT = {
  tx_hash: "0xwd",
  state: [
    { type: "String", value: APP_ID },
    { type: "Hash160", value: PLAYER_HASH },
    { type: "Integer", value: "150000000" },
  ],
};

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  ctxOverrides: Record<string, unknown> = {},
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (): Promise<unknown> => "0"),
    invoke: vi.fn(
      async (): Promise<{ txid: string; success: boolean; event?: unknown }> => ({
        txid: "0xinvoke",
        success: true,
      }),
    ),
    listEvents: vi.fn(async (): Promise<unknown[]> => []),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext: { appId: APP_ID },
    ...ctxOverrides,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    platformGame: { gameHash: GAME_HASH },
    ...options,
  });
  return { app, chain };
}

const isInvokePrimaryDenial = (error: unknown) =>
  error instanceof FrameworkPermissionError && error.permission === "invoke:primary";

describe("platformGame config validation", () => {
  it("throws a typed capability error when no platformGame config is injected", async () => {
    const { app, chain } = makeApp({ platformGame: undefined });

    expect(app.platformGame.available).toBe(false);
    for (const call of [
      () => app.platformGame.startGame(ADDRESS, 0),
      () => app.platformGame.finalizeGame(ADDRESS, "aabb"),
      () => app.platformGame.expireGame("7"),
      () => app.platformGame.withdraw(),
      () => app.platformGame.freePool(),
      () => app.platformGame.poolBalance(),
      () => app.platformGame.reservedPool(),
      () => app.platformGame.heldForApp(),
      () => app.platformGame.creditOf(OTHER_PLAYER_HASH),
      () => app.platformGame.activeGameOf(OTHER_PLAYER_HASH),
      () => app.platformGame.statsOf(OTHER_PLAYER_HASH),
      () => app.platformGame.getGame("7"),
    ]) {
      await expect(call()).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof FrameworkCapabilityError && error.capability === "platformGame",
      );
    }
    // Denials happen before any chain traffic.
    expect(chain.read).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects an invalid game hash with a clear message", async () => {
    const { app } = makeApp({ platformGame: { gameHash: "not-a-hash" } });

    expect(app.platformGame.available).toBe(false);
    await expect(app.platformGame.freePool()).rejects.toThrow(/gameHash/);
  });

  it("reports available when the host injects a valid game hash", () => {
    const { app } = makeApp();
    expect(app.platformGame.available).toBe(true);
    // The lazy module caches: repeated access returns the same instance.
    expect(app.platformGame).toBe(app.platformGame);
  });
});

describe("app.platformGame.startGame", () => {
  it("invokes appId-first with the player Hash160 and decodes the GameStarted gameId", async () => {
    const { app, chain } = makeApp();
    chain.invoke.mockResolvedValue({ txid: "0xstart", success: true, event: GAME_STARTED_EVENT });

    await expect(app.platformGame.startGame(ADDRESS, 1)).resolves.toEqual({
      tx: { txid: "0xstart", success: true, event: GAME_STARTED_EVENT },
      gameId: "7",
      player: ADDRESS,
      playerHash: PLAYER_HASH,
    });
    expect(chain.invoke).toHaveBeenCalledWith(
      "startGame",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
        { type: "Integer", value: "1" },
      ],
      { scriptHash: GAME_HASH, waitForEvent: "GameStarted", waitTimeoutMs: 30_000 },
    );
    // Carries NO payment — the entry comes from prepaid engine credit.
    expect(chain.read).not.toHaveBeenCalled();
  });

  it("accepts a Hash160 player and honors the configured start wait timeout", async () => {
    const { app, chain } = makeApp({
      platformGame: { gameHash: GAME_HASH, waitTimeoutMs: { start: 5_000 } },
    });
    chain.invoke.mockResolvedValue({ txid: "0xstart", success: true, event: GAME_STARTED_EVENT });

    const started = await app.platformGame.startGame(
      `0x${"11".repeat(20).toUpperCase()}`,
      2,
    );
    expect(started.playerHash).toBe(OTHER_PLAYER_HASH);
    expect(chain.invoke).toHaveBeenCalledWith(
      "startGame",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: OTHER_PLAYER_HASH },
        { type: "Integer", value: "2" },
      ],
      { scriptHash: GAME_HASH, waitForEvent: "GameStarted", waitTimeoutMs: 5_000 },
    );
  });

  it("falls back to the activeGameOf read when the host delivers no invoke event", async () => {
    const { app, chain } = makeApp();
    chain.invoke.mockResolvedValue({ txid: "0xstart", success: true });
    chain.read.mockResolvedValue("9");

    await expect(app.platformGame.startGame(ADDRESS, 0)).resolves.toMatchObject({
      gameId: "9",
    });
    expect(chain.read).toHaveBeenCalledWith(
      "activeGameOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );
  });

  it("throws when neither the event nor the active-game read exposes a game id", async () => {
    const { app, chain } = makeApp();
    chain.invoke.mockResolvedValue({ txid: "0xstart", success: true });
    chain.read.mockResolvedValue("0");

    await expect(app.platformGame.startGame(ADDRESS, 0)).rejects.toThrow(/active game id/);
  });

  it("rejects a bad difficulty or player before any broadcast", async () => {
    const { app, chain } = makeApp();

    await expect(app.platformGame.startGame(ADDRESS, -1)).rejects.toThrow(/difficulty/);
    await expect(app.platformGame.startGame(ADDRESS, 0.5)).rejects.toThrow(/difficulty/);
    await expect(app.platformGame.startGame("not-an-account", 0)).rejects.toThrow(
      /address or Hash160/,
    );
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});

describe("app.platformGame.finalizeGame", () => {
  it("invokes appId-first with the sealed op-log and decodes the Finalizing requestId", async () => {
    const { app, chain } = makeApp();
    chain.invoke.mockResolvedValue({ txid: "0xfin", success: true, event: FINALIZING_EVENT });

    await expect(app.platformGame.finalizeGame(ADDRESS, "aabbcc")).resolves.toEqual({
      tx: { txid: "0xfin", success: true, event: FINALIZING_EVENT },
      requestId: "42",
    });
    expect(chain.invoke).toHaveBeenCalledWith(
      "finalizeGame",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
        { type: "String", value: "aabbcc" },
      ],
      { scriptHash: GAME_HASH, waitForEvent: "Finalizing", waitTimeoutMs: 30_000 },
    );
  });

  it("resolves an empty requestId when the host delivers no invoke event", async () => {
    const { app, chain } = makeApp();
    chain.invoke.mockResolvedValue({ txid: "0xfin", success: true });

    await expect(app.platformGame.finalizeGame(ADDRESS, "aabbcc")).resolves.toMatchObject({
      requestId: "",
    });
  });

  it("rejects a malformed sealed op-log before any broadcast", async () => {
    const { app, chain } = makeApp();

    await expect(app.platformGame.finalizeGame(ADDRESS, "")).rejects.toThrow(/sealedOpLogHex/);
    await expect(app.platformGame.finalizeGame(ADDRESS, "abc")).rejects.toThrow(/sealedOpLogHex/);
    await expect(app.platformGame.finalizeGame(ADDRESS, "AABB")).rejects.toThrow(/sealedOpLogHex/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});

describe("app.platformGame.expireGame", () => {
  it("invokes appId-first with the gameId, without an event wait", async () => {
    const { app, chain } = makeApp();

    await expect(app.platformGame.expireGame("7")).resolves.toEqual({
      txid: "0xinvoke",
      success: true,
    });
    expect(chain.invoke).toHaveBeenCalledWith(
      "expireGame",
      [
        { type: "String", value: APP_ID },
        { type: "Integer", value: "7" },
      ],
      { scriptHash: GAME_HASH },
    );
  });

  it("rejects a non-positive game id before any broadcast", async () => {
    const { app, chain } = makeApp();

    await expect(app.platformGame.expireGame("0")).rejects.toThrow(/game id/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});

describe("app.platformGame.withdraw", () => {
  it("skips the broadcast when the credit read is zero", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("0");

    await expect(app.platformGame.withdraw()).resolves.toEqual({
      skipped: true,
      reason: "no-credit",
    });
    expect(chain.read).toHaveBeenCalledWith(
      "creditOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("invokes appId-first for the connected wallet and decodes the withdrawn amount", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("150000000");
    chain.invoke.mockResolvedValue({
      txid: "0xwd",
      success: true,
      event: CREDIT_WITHDRAWN_EVENT,
    });

    await expect(app.platformGame.withdraw()).resolves.toEqual({
      skipped: false,
      tx: { txid: "0xwd", success: true, event: CREDIT_WITHDRAWN_EVENT },
      amountFixed8: 150_000_000n,
    });
    expect(chain.invoke).toHaveBeenCalledWith(
      "withdraw",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH, waitForEvent: "CreditWithdrawn", waitTimeoutMs: 30_000 },
    );
  });

  it("prompts the wallet when no address is connected", async () => {
    const { app, chain } = makeApp();
    chain.address.set(null);
    chain.read.mockResolvedValue("100000000");

    await expect(app.platformGame.withdraw()).resolves.toMatchObject({ skipped: false });
    expect(chain.ensureWallet).toHaveBeenCalled();
    expect(chain.invoke).toHaveBeenCalledWith(
      "withdraw",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      expect.objectContaining({ scriptHash: GAME_HASH }),
    );
  });
});

describe("app.platformGame reads", () => {
  it("reads the pool ledgers appId-first with bigint fixed8 decodes", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("250000000");

    await expect(app.platformGame.freePool()).resolves.toBe(250_000_000n);
    expect(chain.read).toHaveBeenLastCalledWith(
      "freePool",
      [{ type: "String", value: APP_ID }],
      { scriptHash: GAME_HASH },
    );

    await app.platformGame.poolBalance();
    expect(chain.read).toHaveBeenLastCalledWith(
      "poolBalance",
      [{ type: "String", value: APP_ID }],
      { scriptHash: GAME_HASH },
    );

    await app.platformGame.reservedPool();
    expect(chain.read).toHaveBeenLastCalledWith(
      "reservedPool",
      [{ type: "String", value: APP_ID }],
      { scriptHash: GAME_HASH },
    );

    await app.platformGame.heldForApp();
    expect(chain.read).toHaveBeenLastCalledWith(
      "heldForApp",
      [{ type: "String", value: APP_ID }],
      { scriptHash: GAME_HASH },
    );
  });

  it("threads an explicit appId override into reads", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("5");

    await expect(app.platformGame.freePool("other-app")).resolves.toBe(5n);
    expect(chain.read).toHaveBeenLastCalledWith(
      "freePool",
      [{ type: "String", value: "other-app" }],
      { scriptHash: GAME_HASH },
    );
  });

  it("reads creditOf/activeGameOf with the connected wallet as the default player", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValueOnce("100000000");
    await expect(app.platformGame.creditOf()).resolves.toBe(100_000_000n);
    expect(chain.read).toHaveBeenLastCalledWith(
      "creditOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );

    chain.read.mockResolvedValueOnce("7");
    await expect(app.platformGame.activeGameOf()).resolves.toBe("7");
    chain.read.mockResolvedValueOnce(null);
    await expect(app.platformGame.activeGameOf()).resolves.toBe("0");
  });

  it("normalizes an explicit player (address or Hash160) and requires one", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("3");

    await app.platformGame.creditOf(`0x${"11".repeat(20).toUpperCase()}`);
    expect(chain.read).toHaveBeenLastCalledWith(
      "creditOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: OTHER_PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );

    chain.address.set(null);
    await expect(app.platformGame.creditOf()).rejects.toThrow(/player is required/);
  });

  it("decodes the statsOf row", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue({ played: "4", solved: "2", totalWon: "300000000" });

    await expect(app.platformGame.statsOf()).resolves.toEqual({
      played: 4,
      solved: 2,
      totalWonFixed8: 300_000_000n,
    });
    expect(chain.read).toHaveBeenLastCalledWith(
      "statsOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );
  });

  it("decodes the getGame row typed, keeping the raw status code", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue({
      id: "7",
      player: chainHex(PLAYER_HASH),
      difficulty: "1",
      entry: "100000000",
      reward: "200000000",
      startTime: "1752700000000",
      commitment: "cc".repeat(32),
      dealtAt: "1752700000001",
      deadline: "1752700060000",
      undos: "1",
      status: "5",
      payout: "0",
      solveMs: "0",
      answerHash: "",
      ringsHit: "9",
    });

    const snapshot = await app.platformGame.getGame("7");
    expect(snapshot).toMatchObject({
      gameId: "7",
      statusCode: 5,
      // 5 (settling) is engine-only: the SDK vocabulary decodes it "unknown",
      // the raw statusCode stays lossless.
      status: "unknown",
      player: PLAYER_HASH,
      difficulty: 1,
      entryFixed8: 100_000_000n,
      rewardFixed8: 200_000_000n,
      undos: 1,
      payoutFixed8: 0n,
      score: 9,
    });
    expect(chain.read).toHaveBeenLastCalledWith(
      "getGame",
      [
        { type: "String", value: APP_ID },
        { type: "Integer", value: "7" },
      ],
      { scriptHash: GAME_HASH },
    );

    chain.read.mockResolvedValueOnce({ status: "2" });
    await expect(app.platformGame.getGame(7)).resolves.toMatchObject({
      statusCode: 2,
      status: "solved",
    });
  });

  it("resolves null for an unknown game id (FAULT read)", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue(null);

    await expect(app.platformGame.getGame("99")).resolves.toBeNull();
  });
});

describe("shared app.game reads", () => {
  it("routes stats through the appId-first PlatformGame surface", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue({ played: "3", solved: "2", totalWon: "450000000" });

    await expect(app.game.stats.load()).resolves.toEqual({ solves: 2, totalWon: 4.5 });
    expect(chain.read).toHaveBeenCalledWith(
      "statsOf",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: PLAYER_HASH },
      ],
      { scriptHash: GAME_HASH },
    );
  });

  it("filters tenant events and uses the shared score/payout slots", async () => {
    const { app, chain } = makeApp();
    chain.listEvents.mockResolvedValue([
      {
        state: [
          { value: APP_ID },
          { value: "7" },
          { value: PLAYER_HASH },
          { value: "1" },
          { value: "900" },
          { value: "12" },
          { value: "200000000" },
          { value: "450000000" },
        ],
      },
      {
        state: [
          { value: "other-app" },
          { value: "8" },
          { value: OTHER_PLAYER_HASH },
          { value: "0" },
          { value: "800" },
          { value: "99" },
          { value: "900000000" },
          { value: "900000000" },
        ],
      },
    ]);

    const result = await app.game.leaderboard.load(
      "Solved",
      { solvedPayout: 5, totalWon: 6, undos: 7 },
      20,
    );
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]).toMatchObject({ totalWon: 4.5, solves: 1, isUser: true });
    expect(result.mine[0]).toMatchObject({ gameId: "7", payout: "2.00 GAS", undos: 0 });
  });

  it("fails closed instead of falling back when shared config is invalid", () => {
    const { app } = makeApp({ platformGame: { gameHash: "invalid" } });

    expect(() => app.game.reward({
      engineHash: "reviewed-engine",
      entryMemo: `${APP_ID}:entry`,
      modes: [{ id: 0, entryFixed8: 1n, rewardFixed8: 1n }],
    })).toThrow(/shared PlatformGame backend is unavailable/);
  });
});

describe("app.platformGame write guards (RFC P0-2)", () => {
  it("denies every write lane in guest mode while reads stay open", async () => {
    const { app, chain } = makeApp();
    app.mode.set("guest");

    await expect(app.platformGame.startGame(ADDRESS, 0)).rejects.toThrow(GUEST_ERROR);
    await expect(app.platformGame.finalizeGame(ADDRESS, "aabb")).rejects.toThrow(GUEST_ERROR);
    await expect(app.platformGame.expireGame("7")).rejects.toThrow(GUEST_ERROR);
    await expect(app.platformGame.withdraw()).rejects.toThrow(GUEST_ERROR);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();

    // Reads stay ungated so guest-mode upsell UI can quote the pool.
    chain.read.mockResolvedValue("100000000");
    await expect(app.platformGame.freePool()).resolves.toBe(100_000_000n);
  });

  it("denies every write lane when the manifest declaration omits invoke:primary", async () => {
    const { app, chain } = makeApp({}, { launchContext: { appId: APP_ID, permissions: [] } });

    await expect(app.platformGame.startGame(ADDRESS, 0)).rejects.toSatisfy(
      isInvokePrimaryDenial,
    );
    await expect(app.platformGame.finalizeGame(ADDRESS, "aabb")).rejects.toSatisfy(
      isInvokePrimaryDenial,
    );
    await expect(app.platformGame.expireGame("7")).rejects.toSatisfy(isInvokePrimaryDenial);
    await expect(app.platformGame.withdraw()).rejects.toSatisfy(isInvokePrimaryDenial);
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("keeps the write lanes working when invoke:primary is explicitly granted", async () => {
    const { app, chain } = makeApp(
      {},
      { launchContext: { appId: APP_ID, permissions: ["invoke:primary"] } },
    );
    chain.invoke.mockResolvedValue({ txid: "0xstart", success: true, event: GAME_STARTED_EVENT });

    await expect(app.platformGame.startGame(ADDRESS, 0)).resolves.toMatchObject({
      gameId: "7",
    });
    expect(chain.invoke).toHaveBeenCalledTimes(1);
  });

  it("fires the guest guard BEFORE the permission gate", async () => {
    const { app } = makeApp({}, { launchContext: { appId: APP_ID, permissions: [] } });
    app.mode.set("guest");

    // Both guards would deny; the guest guard must win the ordering.
    await expect(app.platformGame.startGame(ADDRESS, 0)).rejects.toThrow(GUEST_ERROR);
    await expect(app.platformGame.withdraw()).rejects.toThrow(GUEST_ERROR);
  });
});
