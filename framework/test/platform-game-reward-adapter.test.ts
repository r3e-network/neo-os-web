import { describe, expect, it, vi } from "vitest";
import type { FrameworkPlatformGameSnapshot, FrameworkPlatformGameSurface } from "../platform-game-surface";
import { createObservable } from "../reactive";
import {
  createPlatformGameRewardChain,
  observeRewardGameSettlement,
  recoverActiveRewardGame,
  startRewardGame,
} from "../gamefi";
import type { RewardGameConfig } from "../gamefi";

const APP_ID = "miniapp-shared-game";
const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ENGINE_HASH = `0x${"ab".repeat(20)}`;

const config: RewardGameConfig = {
  appId: APP_ID,
  engineHash: "morpheus-session",
  entryMemo: `${APP_ID}:entry`,
  modes: [{ id: 0, entryFixed8: 100_000_000n, rewardFixed8: 200_000_000n }],
};

function snapshot(statusCode: number): FrameworkPlatformGameSnapshot {
  return {
    gameId: "7",
    statusCode,
    status: statusCode === 2 ? "solved" : "unknown",
    player: `0x${"11".repeat(20)}`,
    difficulty: 0,
    entryFixed8: 100_000_000n,
    rewardFixed8: 200_000_000n,
    startTime: 1,
    commitment: "commitment",
    dealtAt: 2,
    deadline: 3,
    undos: 0,
    payoutFixed8: statusCode === 2 ? 200_000_000n : 0n,
    solveMs: statusCode === 2 ? 900 : 0,
    answerHash: "",
    score: 4,
    raw: {},
  };
}

function setup(options: { credit?: bigint; snapshots?: FrameworkPlatformGameSnapshot[] } = {}) {
  const snapshots = [...(options.snapshots ?? [snapshot(1)])];
  const platformGame = {
    available: true,
    startGame: vi.fn(async (player: string) => ({
      tx: { txid: "0xstart", success: true },
      gameId: "7",
      player,
      playerHash: player,
    })),
    finalizeGame: vi.fn(async () => ({
      tx: { txid: "0xfinalize", success: true, event: { state: [APP_ID, "7"] } },
      requestId: "42",
    })),
    expireGame: vi.fn(async () => ({ txid: "0xexpire", success: true })),
    withdraw: vi.fn(async () => ({
      skipped: false as const,
      tx: { txid: "0xwithdraw", success: true },
      amountFixed8: 1n,
    })),
    freePool: vi.fn(async () => 500_000_000n),
    poolBalance: vi.fn(async () => 500_000_000n),
    reservedPool: vi.fn(async () => 0n),
    heldForApp: vi.fn(async () => 500_000_000n),
    creditOf: vi.fn(async () => options.credit ?? 100_000_000n),
    activeGameOf: vi.fn(async () => "7"),
    statsOf: vi.fn(async () => ({ played: 2, solved: 1, totalWonFixed8: 200_000_000n })),
    getGame: vi.fn(async () => snapshots.shift() ?? snapshot(2)),
  } as unknown as FrameworkPlatformGameSurface;
  const listEvents = vi.fn(async () => [
    { state: [{ value: APP_ID }, { value: "7" }, { value: "player" }] },
    { state: [{ value: "other-app" }, { value: "8" }, { value: "other" }] },
  ]);
  const rawChain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    detectNetwork: vi.fn(async () => "testnet"),
    listEvents,
  };
  const chain = createPlatformGameRewardChain({
    appId: APP_ID,
    engineHash: ENGINE_HASH,
    config,
    chain: rawChain,
    platformGame,
  });
  return { chain, platformGame, listEvents };
}

describe("PlatformGame reward adapter", () => {
  it("starts from prepaid credit without invokeWithPayment", async () => {
    const { chain, platformGame } = setup();
    const result = await startRewardGame(config, chain, 0);

    expect(result.gameId).toBe("7");
    expect(result.usedCredit).toBe(true);
    expect(platformGame.startGame).toHaveBeenCalledWith(result.playerHash, 0);
  });

  it("fails closed when prepaid credit is insufficient", async () => {
    const { chain, platformGame } = setup({ credit: 0n });

    await expect(startRewardGame(config, chain, 0)).rejects.toMatchObject({ code: "CREDIT_LOW" });
    expect(platformGame.startGame).not.toHaveBeenCalled();
  });

  it("drops the Finalizing event and polls until a settled snapshot", async () => {
    const { chain, platformGame } = setup({ snapshots: [snapshot(5), snapshot(2)] });
    const tx = await chain.invoke(
      "finalizeGame",
      [
        { type: "Integer", value: "7" },
        { type: "String", value: "aabb" },
      ],
    );

    expect(tx.event).toBeUndefined();
    const settlement = await observeRewardGameSettlement(config, chain, "7", tx.event, {
      pollAttempts: 2,
      pollDelayMs: 0,
      delay: async () => {},
    });
    expect(settlement).toMatchObject({ status: "solved", source: "poll", payoutFixed8: 200_000_000n });
    expect(platformGame.getGame).toHaveBeenCalledTimes(2);
  });

  it("recovers the active shared game through clone-shaped snapshots", async () => {
    const { chain } = setup({ snapshots: [snapshot(1)] });
    const recovered = await recoverActiveRewardGame(config, chain);

    expect(recovered.gameId).toBe("7");
    expect(recovered.snapshot).toMatchObject({ status: "dealt", difficulty: 0 });
    expect(chain.contractAddress.get()).toBe(ENGINE_HASH);
  });

  it("filters shared events by appId and removes the tenant slot", async () => {
    const { chain, listEvents } = setup();
    const events = await chain.listEvents?.("Solved", { limit: 20 });

    expect(listEvents).toHaveBeenCalledWith("Solved", { limit: 20 });
    expect(events).toEqual([{ state: [{ value: "7" }, { value: "player" }] }]);
  });
});
