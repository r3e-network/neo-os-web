/**
 * app.mode (two-mode guest / gamefi) surface.
 *
 * Covers the locked API shape: default gamefi, set/get/onChange, the guest
 * guard that THROWS at every on-chain/oracle/reward WRITE entry point while
 * leaving read-only calls allowed, and the guest leaderboard namespacing that
 * keeps guest scores separate from any other board usage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../../../framework";
import type { MiniAppFrameworkContext } from "../../../framework";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const GUEST_ERROR = /guest-mode: on-chain\/oracle operations are disabled/;

function makeApp(appId = "miniapp-test") {
  const board: Array<{ user: string; score: string }> = [];
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    readArray: vi.fn(async () => []),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    invokeMultiple: vi.fn(async () => ({ txid: "0xmulti", state: "HALT" })),
    listEvents: vi.fn(async () => []),
  };
  const os = {
    leaderboard: {
      submitScore: vi.fn(async (score: string) => {
        board.push({ user: ADDRESS, score });
      }),
      get: vi.fn(async (limit = 100) => board.slice(0, limit)),
    },
  };
  const ctx = {
    services: { chain, os },
    os,
    t: (key: string) => key,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    launchContext: { appId },
    registerAction: vi.fn(),
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, { appId });
  return { app, chain, os, board };
}

/** Assert a call is blocked whether it throws synchronously or rejects. */
async function expectBlocked(fn: () => unknown) {
  await expect((async () => fn())()).rejects.toThrow(GUEST_ERROR);
}

const rewardConfig = {
  engineHash: "aa".repeat(32),
  entryMemo: "miniapp-test:entry",
  modes: [
    { id: 0, entryFixed8: 1, rewardFixed8: 2, limitMs: 1000, minSolveMs: 100, target: 4 },
  ],
};

describe("app.mode — default + toggling", () => {
  it("defaults to gamefi for back-compat", () => {
    const { app } = makeApp();
    expect(app.mode.current.get()).toBe("gamefi");
    expect(app.mode.get()).toBe("gamefi");
    expect(app.mode.isGameFi()).toBe(true);
    expect(app.mode.isGuest()).toBe(false);
  });

  it("set()/get()/isGuest()/isGameFi() reflect the switch and coerce bad input", () => {
    const { app } = makeApp();
    app.mode.set("guest");
    expect(app.mode.get()).toBe("guest");
    expect(app.mode.isGuest()).toBe(true);
    expect(app.mode.isGameFi()).toBe(false);
    // Any non-"guest" value coerces back to "gamefi".
    app.mode.set("nonsense" as unknown as "gamefi");
    expect(app.mode.get()).toBe("gamefi");
  });

  it("onChange fires with the new mode and returns an unsubscribe", () => {
    const { app } = makeApp();
    const seen: string[] = [];
    const unsub = app.mode.onChange((mode) => seen.push(mode));
    app.mode.set("guest");
    app.mode.set("gamefi");
    unsub();
    app.mode.set("guest");
    expect(seen).toEqual(["guest", "gamefi"]);
  });
});

describe("app.mode — guest guard blocks chain/oracle/reward writes", () => {
  it("throws the guest error at every write / oracle / reward entry point", async () => {
    const { app, chain } = makeApp();
    app.mode.set("guest");
    const reward = app.game.reward(rewardConfig);

    // chain writes
    await expectBlocked(() => app.chain.invoke("op", []));
    await expectBlocked(() => app.chain.invokeWithPayment("1", "m", "op", []));
    await expectBlocked(() => app.chain.write({ operation: "op", args: [] }));
    await expectBlocked(() =>
      app.chain.invokeMultiple([{ operation: "op", args: [] }]),
    );
    // funds
    await expectBlocked(() => app.funds.payAndCall({ operation: "op", args: [], memo: "m", amountGas: 1 }));
    await expectBlocked(() =>
      app.funds.prepayAndCall({ operation: "op", args: [], memo: "m", amountGas: 1 }),
    );
    await expectBlocked(() =>
      app.funds.receiptPay({ operation: "op", args: [], receiptId: 1 }),
    );
    await expectBlocked(() => app.funds.withdrawCredit());
    // oracle
    await expectBlocked(() => app.oracle.http({ url: "https://example.com" }));
    await expectBlocked(() => app.oracle.vrf({ consumer: "c", salt: "s" }));
    await expectBlocked(() => app.oracle.compute({ workflow: "w", input: {} }));
    await expectBlocked(() => app.oracle.seal({ purpose: "p", payload: {} }));
    await expectBlocked(() =>
      app.oracle.dispatch(
        { kind: "k", digest: "d", payload: { kind: "k", appId: "a", digest: "d" } },
        { operation: "op" },
      ),
    );
    // reward game
    await expectBlocked(() => reward.start(0));
    await expectBlocked(() => reward.openSession("1", 0));
    await expectBlocked(() => reward.recordOp({} as never, {} as never));
    await expectBlocked(() => reward.finalize({} as never));
    await expectBlocked(() => reward.expire("1"));
    await expectBlocked(() => reward.withdrawCredit());

    // The chain write mocks must never have been reached.
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("leaves read-only calls allowed in guest mode", async () => {
    const { app, chain } = makeApp();
    app.mode.set("guest");
    await expect(app.chain.query("getThing").raw()).resolves.toBe("0");
    await expect(app.chain.readRaw("getThing")).resolves.toBe("0");
    await expect(app.chain.readArray("getList")).resolves.toEqual([]);
    await expect(app.chain.events("Solved")).resolves.toEqual([]);
    expect(chain.read).toHaveBeenCalled();
  });
});

describe("app.mode — gamefi allows the same lanes", () => {
  it("permits chain writes and oracle envelopes in the default mode", async () => {
    const { app, chain } = makeApp();
    await expect(app.chain.invoke("op", [])).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(chain.invoke).toHaveBeenCalledTimes(1);
    await expect(app.chain.invokeWithPayment("1", "m", "op", [])).resolves.toMatchObject({
      txid: "0xpay",
    });
    // oracle envelope builders resolve to a signed digest envelope.
    await expect(app.oracle.vrf({ consumer: "c", salt: "s" })).resolves.toMatchObject({
      kind: "oracle.vrf.request",
    });
  });
});

describe("app.mode.guestLeaderboard — off-chain namespacing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits under an <appId>:guest namespace and get() decodes only guest rows", async () => {
    const { app, os, board } = makeApp("miniapp-color-clash");
    await app.mode.guestLeaderboard.submit(8);
    expect(os.leaderboard.submitScore).toHaveBeenCalledWith("miniapp-color-clash:guest:8");

    // Simulate an unrelated (non-guest) row sharing the same board.
    board.push({ user: "someone", score: "999" });

    const rows = await app.mode.guestLeaderboard.get();
    // Only the guest-namespaced row is returned, decoded back to a plain score.
    expect(rows).toEqual([{ user: ADDRESS, score: "8" }]);
  });

  it("keeps guest boards isolated per app id", async () => {
    const a = makeApp("app-one");
    const b = makeApp("app-two");
    await a.app.mode.guestLeaderboard.submit(5);
    // b's board is separate; a cross-app read never sees app-one's guest rows.
    expect(a.os.leaderboard.submitScore).toHaveBeenCalledWith("app-one:guest:5");
    expect(b.board).toHaveLength(0);
  });
});
