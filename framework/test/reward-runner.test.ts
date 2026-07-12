/**
 * Reward-game lifecycle runner (RFC P0-7).
 *
 * Part 1 exercises the state machine against an injected fake handle
 * (phases, resume-replay reconstruction, settlement verify, wallet-change
 * reset, standard actions, single-flighted refresh).
 *
 * Part 2 smoke-tests the framework wiring: `app.game.reward(cfg).runner(...)`
 * composes the REAL guarded SDK primitives (guest guard included) with a
 * mocked chain + TEE fetcher.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createMemoryRewardGameStorage,
  createRewardRunner,
  RewardGameError,
} from "../gamefi";
import type {
  FrameworkRewardPhase,
  RewardRunnerDeps,
  RewardGameBalances,
  RewardGameConfig,
  RewardGameSession,
  RewardGameSnapshot,
} from "../gamefi";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

type Op = { type: string; n?: number };
type View = { ops: string[] };

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

const config: RewardGameConfig = {
  appId: "runner-test",
  engineHash: "e".repeat(64),
  entryMemo: "runner-test:entry",
  modes: [
    { id: 0, key: "easy", entryFixed8: 100_000_000n, rewardFixed8: 200_000_000n, limitMs: 60_000 },
    { id: 1, key: "hard", entryFixed8: 200_000_000n, rewardFixed8: 500_000_000n, limitMs: 30_000 },
  ],
};

function makeSession(gameId: string, difficulty = 0): RewardGameSession {
  return {
    commitment: "a".repeat(64),
    publicKey: "pk",
    sessionToken: `tok-${gameId}`,
    view: {},
    config: { limitMs: 60_000, minSolveMs: 0, maxUndos: 0, revealPolicy: "", raw: {} },
    identity: {
      appId: config.appId,
      engineHash: config.engineHash,
      network: "testnet",
      contractHash: `0x${"c".repeat(40)}`,
      gameId,
      player: `0x${"1".repeat(40)}`,
      difficulty,
    },
  };
}

const balancesOf = (creditFixed8: bigint): RewardGameBalances => ({
  playerHash: `0x${"1".repeat(40)}`,
  poolFreeFixed8: 100_000_000_000n,
  poolFreeGas: 1000,
  creditFixed8,
  creditGas: Number(creditFixed8) / 1e8,
});

const snapshotOf = (
  gameId: string,
  status: RewardGameSnapshot["status"],
  difficulty = 0,
): RewardGameSnapshot => ({
  gameId,
  status,
  difficulty,
  commitment: "a".repeat(64),
  dealtAt: 1,
  deadline: 2,
  payoutFixed8: 200_000_000n,
  payoutGas: 2,
  solveMs: 1234,
  raw: {},
});

function makeFakeDeps(overrides: {
  snapshotStatus?: RewardGameSnapshot["status"];
  activeGameId?: string;
  persistedOps?: Op[];
  settlementStatus?: "solved" | "expired" | "unknown";
} = {}) {
  const storage = createMemoryRewardGameStorage<Op>(
    overrides.persistedOps ? { g1: overrides.persistedOps } : {},
  );
  const accountHandlers: Array<(change: { previous: string | null; current: string | null }) => void> = [];
  const handle = {
    mode: vi.fn((difficulty: number | string) => ({
      id: Number(difficulty),
      key: "easy",
      entryFixed8: 100_000_000n,
      rewardFixed8: 200_000_000n,
      entryGas: 1,
      rewardGas: 2,
    })),
    start: vi.fn(async (difficulty: number) => ({
      tx: { txid: "0xstart" },
      gameId: "g1",
      player: ADDRESS,
      playerHash: `0x${"1".repeat(40)}`,
      mode: handle.mode(difficulty),
      usedCredit: false,
      balances: balancesOf(0n),
    })),
    openSession: vi.fn(async (gameId: string, difficulty: number) =>
      makeSession(gameId, difficulty),
    ),
    recordOp: vi.fn(async (_session: RewardGameSession, op: Op) => ({
      step: { seq: 0, opCount: 1, resumed: false, view: {} },
      opLog: [op],
      recovered: false,
    })),
    replayOps: vi.fn(async (_session: RewardGameSession, _ops: readonly Op[]) => []),
    finalize: vi.fn(async () => ({
      tx: { txid: "0xfinal" },
      sealedOpLogHex: "aa",
      opCount: 1,
      settlement: {
        gameId: "g1",
        status: overrides.settlementStatus ?? "solved",
        payoutFixed8: 200_000_000n,
        payoutGas: 2,
        elapsedMs: 1234,
        source: "event" as const,
      },
    })),
    recoverActive: vi.fn(async () => ({
      gameId: overrides.activeGameId ?? "g1",
      playerHash: `0x${"1".repeat(40)}`,
      snapshot:
        (overrides.activeGameId ?? "g1") === "0"
          ? null
          : snapshotOf(overrides.activeGameId ?? "g1", overrides.snapshotStatus ?? "dealt"),
    })),
    expire: vi.fn(async () => ({ txid: "0xexpire" })),
    withdrawCredit: vi.fn(async () => ({ skipped: false as const, tx: { txid: "0xwd" } })),
    snapshot: vi.fn(async (gameId: string) =>
      snapshotOf(gameId, overrides.snapshotStatus ?? "solved"),
    ),
    balances: vi.fn(async () => balancesOf(200_000_000n)),
    storage,
  };
  const deps: RewardRunnerDeps<Op> = {
    config,
    handle,
    loadStats: vi.fn(async () => ({ solves: 3, totalWon: 6 })),
    loadLeaderboard: vi.fn(async () => [{ user: "0xabc", score: "6" }]),
    onAccountChanged: vi.fn((handler) => {
      accountHandlers.push(handler);
      return () => {
        accountHandlers.length = 0;
      };
    }),
  };
  return { deps, handle, storage, accountHandlers };
}

const hooks = {
  createView: (_session: RewardGameSession): View => ({ ops: [] }),
  applyOp: (view: View, op: Op): View => ({ ops: [...view.ops, op.type] }),
};

describe("createRewardRunner state machine", () => {
  it("start(): dealing → deal-pending, session/view/balances fan-out, modeKey resolution", async () => {
    const { deps, handle } = makeFakeDeps();
    const phases: FrameworkRewardPhase[] = [];
    const runner = createRewardRunner<Op, View>(deps, {
      ...hooks,
      onPhase: (phase) => {
        phases.push(phase);
      },
    });

    await runner.start({ modeKey: "hard" });
    expect(handle.start).toHaveBeenCalledWith(1); // modeKey → difficulty id
    expect(handle.openSession).toHaveBeenCalledWith("g1", 1);
    expect(phases).toEqual(["dealing", "deal-pending"]);
    expect(runner.phase.get()).toBe("deal-pending");
    expect(runner.session.get()?.identity.gameId).toBe("g1");
    expect(runner.view.get()).toEqual({ ops: [] });
    expect(runner.balances.get()?.poolFreeGas).toBe(1000);

    await expect(runner.start({ modeKey: "nope" })).rejects.toThrow(/no reward-game mode/);
  });

  it("start() failure lands on error and rethrows", async () => {
    const { deps, handle } = makeFakeDeps();
    handle.start.mockRejectedValueOnce(new RewardGameError("POOL_LOW", "pool too low"));
    const detail: unknown[] = [];
    const runner = createRewardRunner<Op, View>(deps, {
      ...hooks,
      onPhase: (phase, info) => {
        if (phase === "error") detail.push(info?.error);
      },
    });
    await expect(runner.start()).rejects.toThrow(/pool too low/);
    expect(runner.phase.get()).toBe("error");
    expect(detail).toHaveLength(1);
  });

  it("record(): applies the op to the view and moves deal-pending → playing", async () => {
    const { deps, handle } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await expect(runner.record({ type: "tap" })).rejects.toThrow(/No active session/);

    await runner.start();
    await runner.record({ type: "tap" });
    expect(runner.view.get()).toEqual({ ops: ["tap"] });
    expect(runner.phase.get()).toBe("playing");
    expect(handle.recordOp).toHaveBeenCalledTimes(1);
  });

  it("resume(): recoverActive + storage.load + replayOps + phase reconstruction", async () => {
    const { deps, handle } = makeFakeDeps({ persistedOps: [{ type: "a" }, { type: "b" }] });
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await expect(runner.resume()).resolves.toBe(true);
    expect(handle.openSession).toHaveBeenCalledWith("g1", 0);
    expect(handle.replayOps).toHaveBeenCalledTimes(1);
    expect(handle.replayOps.mock.calls[0]![1]).toEqual([{ type: "a" }, { type: "b" }]);
    expect(runner.view.get()).toEqual({ ops: ["a", "b"] }); // deterministic replay
    expect(runner.phase.get()).toBe("playing");
  });

  it("resume(): no active game → false; expired game → phase expired + false", async () => {
    const none = makeFakeDeps({ activeGameId: "0" });
    const runnerNone = createRewardRunner<Op, View>(none.deps, hooks);
    await expect(runnerNone.resume()).resolves.toBe(false);
    expect(runnerNone.phase.get()).toBe("idle");
    expect(none.handle.openSession).not.toHaveBeenCalled();

    const expired = makeFakeDeps({ snapshotStatus: "expired" });
    const runnerExpired = createRewardRunner<Op, View>(expired.deps, hooks);
    await expect(runnerExpired.resume()).resolves.toBe(false);
    expect(runnerExpired.phase.get()).toBe("expired");
  });

  it("resume(): dealt game with no persisted ops resumes to deal-pending", async () => {
    const { deps } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await expect(runner.resume()).resolves.toBe(true);
    expect(runner.phase.get()).toBe("deal-pending");
  });

  it("finalize(): finalizing → settled, snapshot verify, session cleared, refresh ran", async () => {
    const { deps, handle } = makeFakeDeps();
    const verifyView = vi.fn(() => true);
    const runner = createRewardRunner<Op, View>(deps, { ...hooks, verifyView });
    await runner.start();
    await runner.finalize();
    expect(verifyView).toHaveBeenCalledTimes(1);
    expect(handle.snapshot).toHaveBeenCalledWith("g1");
    expect(runner.phase.get()).toBe("settled");
    expect(runner.session.get()).toBeNull();
    expect(runner.balances.get()?.creditFixed8).toBe(200_000_000n); // refresh fan-out
    expect(runner.stats.get()).toEqual({ solves: 3, totalWon: 6 });
    expect(runner.leaderboard.get()).toEqual([{ user: "0xabc", score: "6" }]);
  });

  it("finalize(): unobservable settlement lands on settlement-pending, session retained", async () => {
    const { deps } = makeFakeDeps({ settlementStatus: "unknown" });
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await runner.start();
    await runner.finalize();
    expect(runner.phase.get()).toBe("settlement-pending");
    expect(runner.session.get()).not.toBeNull();
  });

  it("finalize(): verify mismatch → error phase + VIEW_MISMATCH", async () => {
    const { deps } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, { ...hooks, verifyView: () => false });
    await runner.start();
    await expect(runner.finalize()).rejects.toThrow(/does not match/);
    expect(runner.phase.get()).toBe("error");
  });

  it("finalize() without a session throws NO_SESSION", async () => {
    const { deps } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await expect(runner.finalize()).rejects.toThrow(/No active session/);
  });

  it("wallet change resets the session; an in-flight settlement reports settlement-pending", async () => {
    const { deps, accountHandlers } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await runner.start();

    accountHandlers[0]!({ previous: ADDRESS, current: "NOtherAccount111111111111111111111" });
    expect(runner.session.get()).toBeNull();
    expect(runner.view.get()).toBeNull();
    expect(runner.phase.get()).toBe("idle");

    // Re-start, then simulate the change landing mid-finalize.
    await runner.start();
    runner.phase.set("finalizing");
    accountHandlers[0]!({ previous: ADDRESS, current: null });
    expect(runner.phase.get()).toBe("settlement-pending");
  });

  it("withdraw()/expire() run their lanes and refresh; expire recovers the game id", async () => {
    const { deps, handle } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await runner.withdraw();
    expect(handle.withdrawCredit).toHaveBeenCalledTimes(1);

    await runner.expire(); // no local gameId — recovered via recoverActive
    expect(handle.recoverActive).toHaveBeenCalled();
    expect(handle.expire).toHaveBeenCalledWith("g1");
    expect(runner.phase.get()).toBe("expired");
  });

  it("refresh() is single-flighted and keeps last-known values on loader errors", async () => {
    const { deps, handle } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    await Promise.all([runner.refresh(), runner.refresh()]);
    expect(handle.balances).toHaveBeenCalledTimes(1); // joined

    handle.balances.mockRejectedValueOnce(new Error("rpc down"));
    await runner.refresh();
    expect(runner.balances.get()?.creditFixed8).toBe(200_000_000n); // kept
  });

  it("registerStandardActions registers the four standard bodies", async () => {
    const { deps, handle } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    const registered = new Map<string, () => Promise<unknown>>();
    runner.registerStandardActions({
      register: (key, handler) => {
        registered.set(key, handler);
      },
    });
    expect([...registered.keys()].sort()).toEqual([
      "expireGame",
      "refreshLeaderboard",
      "retryDeal",
      "withdrawWinnings",
    ]);
    await registered.get("withdrawWinnings")!();
    expect(handle.withdrawCredit).toHaveBeenCalledTimes(1);
    await registered.get("retryDeal")!(); // ≡ resume()
    expect(handle.recoverActive).toHaveBeenCalled();
  });

  it("dispose() releases the wallet-change subscription", async () => {
    const { deps, accountHandlers } = makeFakeDeps();
    const runner = createRewardRunner<Op, View>(deps, hooks);
    expect(accountHandlers).toHaveLength(1);
    runner.dispose();
    expect(accountHandlers).toHaveLength(0);
  });
});

describe("app.game.reward(config).runner(hooks) wiring", () => {
  function makeApp() {
    const reads = new Map<string, unknown>([
      ["freePool", "100000000000"],
      ["creditOf", "0"],
      ["activeGameOf", "0"],
    ]);
    const chain = {
      address: createObservable<string | null>(ADDRESS),
      contractAddress: createObservable<string | null>(`0x${"c".repeat(40)}`),
      ensureWallet: vi.fn(async () => ADDRESS),
      detectNetwork: vi.fn(async () => "testnet"),
      read: vi.fn(async (operation: string) => reads.get(operation) ?? "0"),
      invoke: vi.fn(async () => ({
        txid: "0xstart",
        success: true,
        event: { state: [{ value: "9" }] }, // GameStarted gameId slot
      })),
      invokeWithPayment: vi.fn(async () => ({
        txid: "0xpay",
        success: true,
        event: { state: [{ value: "9" }] },
      })),
      listEvents: vi.fn(async () => []),
    };
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/start")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            commitment: "a".repeat(64),
            session_token: "tok-wiring",
            public_key: "pk",
            view: {},
            config: { limit_ms: 60000, min_solve_ms: 0, max_undos: 0, reveal_policy: "" },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ seq: 0, op_count: 1, resumed: false }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const ctx = {
      services: { chain },
      t: (key: string) => key,
      launchContext: { appId: "runner-wiring" },
    } as unknown as MiniAppFrameworkContext;
    const app = createMiniAppFramework(ctx, { appId: "runner-wiring" });
    return { app, chain, fetcher };
  }

  it("start() drives the REAL SDK primitives end to end (payment entry + TEE open)", async () => {
    const { app, chain, fetcher } = makeApp();
    const runner = app.game
      .reward<Op>(config, { fetcher })
      .runner({ ...hooks });
    await runner.start();
    expect(chain.invokeWithPayment).toHaveBeenCalledTimes(1); // no credit → paid entry
    expect(runner.phase.get()).toBe("deal-pending");
    expect(runner.session.get()?.identity.gameId).toBe("9");
    expect(runner.view.get()).toEqual({ ops: [] });
  });

  it("keeps the guest guard: runner.start rejects in guest mode before any broadcast", async () => {
    const { app, chain, fetcher } = makeApp();
    const runner = app.game.reward<Op>(config, { fetcher }).runner({ ...hooks });
    app.mode.set("guest");
    await expect(runner.start()).rejects.toThrow(/guest-mode/);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(runner.phase.get()).toBe("error");
  });
});
