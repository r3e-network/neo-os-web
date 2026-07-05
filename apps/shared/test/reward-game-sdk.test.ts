import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RewardGameChain, RewardGameConfig, RewardGameContractArg } from "../gamefi";
import {
  createMemoryRewardGameStorage,
  finalizeRewardGame,
  fixed8ToGasString,
  gasToFixed8,
  observeRewardGameSettlement,
  openRewardGameSession,
  recordRewardGameOp,
  replayRewardGameOps,
  refreshRewardGameBalances,
  startRewardGame,
} from "../gamefi";
import type { TeeIdentity, TeeSessionOp } from "../logic/tee-session";

const teeMocks = vi.hoisted(() => ({
  seal: vi.fn(),
  start: vi.fn(),
  step: vi.fn(),
}));

vi.mock("@shared/logic/tee-session", () => ({
  morpheusNetworkOf: (detected: string) =>
    String(detected || "").toLowerCase().includes("mainnet") ? "mainnet" : "testnet",
  teeSessionSealOpLog: teeMocks.seal,
  teeSessionStart: teeMocks.start,
  teeSessionStep: teeMocks.step,
}));

const PLAYER = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const CONTRACT = "0xef1fac0247ccbad5810e3fcfa1a0885d44efde39";

const config: RewardGameConfig = {
  appId: "miniapp-test-runner",
  engineHash: "ab".repeat(32),
  entryMemo: "miniapp-test-runner:entry",
  modes: [
    {
      id: 0,
      key: "easy",
      entryFixed8: 2_000_000n,
      rewardFixed8: 10_000_000n,
      limitMs: 120_000,
      minSolveMs: 20_000,
      target: 5,
    },
  ],
  settlement: {
    pollAttempts: 2,
    pollDelayMs: 0,
  },
};

interface ChainCall {
  kind: "read" | "invoke" | "invokeWithPayment";
  operation: string;
  args: unknown[];
  options?: unknown;
}

function makeChain(overrides?: {
  activeGameId?: string;
  creditFixed8?: string;
  poolFreeFixed8?: string;
  startEvent?: unknown;
  solvedEvent?: unknown;
  gameSnapshots?: unknown[];
}): RewardGameChain & { calls: ChainCall[] } {
  const calls: ChainCall[] = [];
  const snapshots = [...(overrides?.gameSnapshots ?? [])];
  const chain = {
    address: { get: () => PLAYER },
    contractAddress: { get: () => CONTRACT },
    ensureWallet: vi.fn(async () => PLAYER),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read: vi.fn(async (operation: string, args: RewardGameContractArg[] = []) => {
      calls.push({ kind: "read", operation, args });
      if (operation === "freePool") return overrides?.poolFreeFixed8 ?? "100000000";
      if (operation === "creditOf") return overrides?.creditFixed8 ?? "0";
      if (operation === "activeGameOf") return overrides?.activeGameId ?? "77";
      if (operation === "getGame") {
        return (
          snapshots.shift() ?? {
            status: "2",
            difficulty: "0",
            commitment: "commitment",
            dealtAt: "10",
            deadline: "20",
            payout: "50000000",
            solveMs: "1234",
          }
        );
      }
      return "0";
    }),
    invoke: vi.fn(async (operation: string, args: RewardGameContractArg[], options?: unknown) => {
      calls.push({ kind: "invoke", operation, args, options });
      return { txid: "0xinvoke", event: overrides?.solvedEvent ?? overrides?.startEvent };
    }),
    invokeWithPayment: vi.fn(
      async (
        amount: string,
        memo: string,
        operation: string,
        args: RewardGameContractArg[],
        options?: unknown,
      ) => {
        calls.push({
          kind: "invokeWithPayment",
          operation,
          args: [amount, memo, ...args],
          options,
        });
        return { txid: "0xpayment", event: overrides?.startEvent };
      },
    ),
    calls,
  };
  return chain;
}

function makeIdentity(gameId = "42"): TeeIdentity {
  return {
    appId: config.appId,
    engineHash: config.engineHash,
    network: "testnet",
    contractHash: CONTRACT,
    gameId,
    player: "0x6d0656f6dd91469db1c90cc1e574380613f43738",
    difficulty: 0,
  };
}

describe("reward-game SDK", () => {
  beforeEach(() => {
    teeMocks.seal.mockReset();
    teeMocks.start.mockReset();
    teeMocks.step.mockReset();
  });

  it("formats and parses GAS using Fixed8 precision", () => {
    expect(gasToFixed8("0.02000001")).toBe(2_000_001n);
    expect(gasToFixed8(1)).toBe(100_000_000n);
    expect(gasToFixed8(0.00000001)).toBe(1n);
    expect(fixed8ToGasString(2_000_000n)).toBe("0.02");
    expect(() => gasToFixed8("0.000000001")).toThrow(/8 decimals/);
  });

  it("rejects a reward mode with a non-positive entry", async () => {
    const badConfig: RewardGameConfig = {
      ...config,
      modes: [{ id: 0, entryFixed8: 0n, rewardFixed8: 1n }],
    };

    await expect(startRewardGame(badConfig, makeChain(), 0)).rejects.toThrow(/positive entry/);
  });

  it("refreshes pool balance without requiring a connected wallet", async () => {
    const chain = {
      ...makeChain({ poolFreeFixed8: "25000000" }),
      address: { get: () => null },
    };

    const balances = await refreshRewardGameBalances(config, chain);

    expect(balances).toMatchObject({
      playerHash: "",
      poolFreeFixed8: 25_000_000n,
      poolFreeGas: 0.25,
      creditFixed8: 0n,
      creditGas: 0,
    });
  });

  it("starts from existing reward credit when credit covers the entry", async () => {
    const chain = makeChain({
      creditFixed8: "2000000",
      startEvent: { state: [{ value: "42" }] },
    });
    const storage = createMemoryRewardGameStorage();

    const result = await startRewardGame(config, chain, 0, storage);

    expect(result.gameId).toBe("42");
    expect(result.usedCredit).toBe(true);
    expect(chain.invoke).toHaveBeenCalledWith(
      "startGame",
      expect.arrayContaining([{ type: "Integer", value: "0" }]),
      { waitForEvent: "GameStarted", waitTimeoutMs: 30_000 },
    );
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("prepays GAS when reward credit is insufficient and falls back to activeGameOf", async () => {
    const chain = makeChain({
      activeGameId: "77",
      creditFixed8: "0",
      startEvent: null,
    });

    const result = await startRewardGame(config, chain, 0);

    expect(result.gameId).toBe("77");
    expect(result.usedCredit).toBe(false);
    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "2000000",
      "miniapp-test-runner:entry",
      "startGame",
      expect.arrayContaining([{ type: "Integer", value: "0" }]),
      { waitForEvent: "GameStarted", waitTimeoutMs: 30_000 },
    );
    expect(chain.calls.some((call) => call.operation === "activeGameOf")).toBe(true);
  });

  it("opens a Morpheus session with the normalized game identity", async () => {
    teeMocks.start.mockResolvedValue({
      commitment: "a".repeat(64),
      publicKey: "pub",
      sessionToken: "token",
      view: { seed: "seed" },
      config: { limitMs: 120_000, minSolveMs: 20_000, maxUndos: 0, revealPolicy: "seed", raw: {} },
    });
    const chain = makeChain();

    const session = await openRewardGameSession(config, chain, "42", 0);

    expect(session.sessionToken).toBe("token");
    expect(teeMocks.start).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: config.appId,
        contractHash: CONTRACT,
        difficulty: 0,
        gameId: "42",
        network: "testnet",
      }),
      undefined,
    );
  });

  it("records an op and retries with replay when the live TEE session was evicted", async () => {
    const identity = makeIdentity();
    const session = {
      identity,
      commitment: "a".repeat(64),
      publicKey: "pub",
      sessionToken: "token",
      view: {},
      config: { limitMs: 0, minSolveMs: 0, maxUndos: 0, revealPolicy: "", raw: {} },
    };
    const replay: TeeSessionOp[] = [{ type: "flap" }];
    const op: TeeSessionOp = { type: "flap" };
    const storage = createMemoryRewardGameStorage({ "42": replay });
    teeMocks.step
      .mockRejectedValueOnce(new Error("session evicted"))
      .mockResolvedValueOnce({ seq: 2, opCount: 2, resumed: true, view: { score: 1 } });

    const result = await recordRewardGameOp(session, storage, op);

    expect(result.recovered).toBe(true);
    expect(result.opLog).toEqual([...replay, op]);
    expect(storage.load("42")).toEqual([...replay, op]);
    expect(teeMocks.step).toHaveBeenNthCalledWith(
      1,
      identity,
      "token",
      1,
      op,
      undefined,
      undefined,
    );
    expect(teeMocks.step).toHaveBeenNthCalledWith(2, identity, "token", 1, op, replay, undefined);
  });

  it("replays a stored op-log through the TEE without mutating storage", async () => {
    const identity = makeIdentity();
    const session = {
      identity,
      commitment: "a".repeat(64),
      publicKey: "pub",
      sessionToken: "token",
      view: {},
      config: { limitMs: 0, minSolveMs: 0, maxUndos: 0, revealPolicy: "", raw: {} },
    };
    const replay: TeeSessionOp[] = [{ type: "move", dir: 0 }, { type: "move", dir: 1 }];
    const views: unknown[] = [];
    teeMocks.step
      .mockResolvedValueOnce({ seq: 1, opCount: 1, resumed: true, view: { board: [1] } })
      .mockResolvedValueOnce({ seq: 2, opCount: 2, resumed: false, view: { board: [2] } });

    const steps = await replayRewardGameOps(session, replay, (step) => {
      views.push(step.view);
    });

    expect(steps).toHaveLength(2);
    expect(views).toEqual([{ board: [1] }, { board: [2] }]);
    expect(teeMocks.step).toHaveBeenNthCalledWith(
      1,
      identity,
      "token",
      0,
      replay[0],
      replay,
      undefined,
    );
    expect(teeMocks.step).toHaveBeenNthCalledWith(
      2,
      identity,
      "token",
      1,
      replay[1],
      replay,
      undefined,
    );
  });

  it("seals the op-log, finalizes on-chain, decodes Solved, and clears storage", async () => {
    const identity = makeIdentity();
    const session = {
      identity,
      commitment: "a".repeat(64),
      publicKey: "pub",
      sessionToken: "token",
      view: {},
      config: { limitMs: 0, minSolveMs: 0, maxUndos: 0, revealPolicy: "", raw: {} },
    };
    const solvedEvent = {
      state: [
        { value: "42" },
        { value: identity.player },
        { value: "0" },
        { value: "1234" },
        { value: "5" },
        { value: "50000000" },
      ],
    };
    const chain = makeChain({ solvedEvent });
    const storage = createMemoryRewardGameStorage({ "42": [{ type: "flap" }] });
    teeMocks.seal.mockResolvedValue({ sealedOpLogHex: "deadbeef" });

    const result = await finalizeRewardGame(config, chain, session, storage, {
      pollDelayMs: 0,
      delay: async () => {},
    });

    expect(teeMocks.seal).toHaveBeenCalledWith(identity, [{ type: "flap" }], undefined);
    expect(chain.invoke).toHaveBeenCalledWith(
      "finalizeGame",
      [
        { type: "Integer", value: "42" },
        { type: "String", value: "deadbeef" },
      ],
      { waitForEvent: "Solved", waitTimeoutMs: 60_000 },
    );
    expect(result.opCount).toBe(1);
    expect(result.settlement).toMatchObject({
      elapsedMs: 1234,
      payoutFixed8: 50_000_000n,
      payoutGas: 0.5,
      source: "event",
      status: "solved",
    });
    expect(storage.load("42")).toEqual([]);
  });

  it("polls getGame when the finalize event is not observed", async () => {
    const chain = makeChain({
      gameSnapshots: [
        { status: "1", payout: "0", solveMs: "0" },
        { status: "2", payout: "10000000", solveMs: "987" },
      ],
    });
    const delay = vi.fn(async () => {});

    const settlement = await observeRewardGameSettlement(config, chain, "77", null, {
      pollAttempts: 2,
      pollDelayMs: 0,
      delay,
    });

    expect(settlement).toMatchObject({
      gameId: "77",
      status: "solved",
      payoutFixed8: 10_000_000n,
      payoutGas: 0.1,
      elapsedMs: 987,
      source: "poll",
    });
    expect(delay).toHaveBeenCalledTimes(1);
  });
});
