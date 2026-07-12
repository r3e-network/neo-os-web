/**
 * app.mode guest-guard completeness + guest-board isolation (hardening audit).
 *
 * Locks the write lanes the original guard list missed:
 * - app.aa relay / sponsorship.request / sessionKey.create (on-chain writes
 *   through the host AA service) throw in guest mode; reads stay allowed.
 * - app.oracle.seal.store (confidential-store WRITE) throws in guest mode
 *   before any network call; the sibling publicKey/encrypt lanes are
 *   read/compute and stay ungated.
 * - app.game.reward().replayOps drives the TEE step lane like recordOp and
 *   throws in guest mode.
 *
 * And the guest-board isolation contract:
 * - stats.leaderboard.top() never returns guest-namespaced rows.
 * - guestLeaderboard.get() scans past the requested window on the mixed OS
 *   board and re-ranks decoded rows numerically (the host orders the RAW
 *   prefixed strings, which is meaningless for guest scores).
 */
import { describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const GUEST_ERROR = /guest-mode: on-chain\/oracle operations are disabled/;

function makeApp(appId = "mode-guard-test", options: Omit<MiniAppFrameworkOptions, "appId"> = {}) {
  const board: Array<{ user: string; score: string }> = [];
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    readArray: vi.fn(async () => []),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
  };
  const aa = {
    checkSponsorship: vi.fn(async () => ({ eligible: true, remaining: 2 })),
    requestSponsorship: vi.fn(async () => ({ approved: true, txid: "0xspon" })),
    submitRelay: vi.fn(async () => ({ txid: "0xrelay" })),
    createSessionKey: vi.fn(async () => ({ created: true })),
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
    services: { chain, os, aa },
    os,
    t: (key: string) => key,
    launchContext: { appId },
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, { appId, ...options });
  return { app, chain, aa, os, board };
}

/** Assert a call is blocked whether it throws synchronously or rejects. */
async function expectBlocked(fn: () => unknown) {
  await expect((async () => fn())()).rejects.toThrow(GUEST_ERROR);
}

const rewardConfig = {
  engineHash: "aa".repeat(32),
  entryMemo: "mode-guard-test:entry",
  modes: [
    { id: 0, entryFixed8: 1, rewardFixed8: 2, limitMs: 1000, minSolveMs: 100, target: 4 },
  ],
};

describe("app.aa guest guard", () => {
  it("blocks relay / sponsorship.request / sessionKey.create in guest mode", async () => {
    const { app, aa } = makeApp();
    app.mode.set("guest");

    await expectBlocked(() => app.aa.relay({ rawTransaction: "00" }));
    await expectBlocked(() => app.aa.sponsorship.request("0.5"));
    await expectBlocked(() => app.aa.sessionKey.create({ scope: "x" }, Date.now() + 1000));

    expect(aa.submitRelay).not.toHaveBeenCalled();
    expect(aa.requestSponsorship).not.toHaveBeenCalled();
    expect(aa.createSessionKey).not.toHaveBeenCalled();
  });

  it("leaves aa reads allowed in guest mode and writes allowed in gamefi", async () => {
    const { app, aa } = makeApp();
    app.mode.set("guest");
    expect(app.aa.available).toBe(true);
    await expect(app.aa.sponsorship.check({ dappId: "d" })).resolves.toMatchObject({
      eligible: true,
    });
    expect(aa.checkSponsorship).toHaveBeenCalledWith({ dappId: "d" });

    app.mode.set("gamefi");
    await expect(app.aa.relay({ rawTransaction: "00" })).resolves.toMatchObject({
      txid: "0xrelay",
    });
    await expect(app.aa.sponsorship.request("0.5")).resolves.toMatchObject({ approved: true });
    await expect(app.aa.sessionKey.create({}, 1)).resolves.toEqual({ created: true });
  });
});

describe("app.oracle.seal.store guest guard", () => {
  it("blocks the confidential-store write before any network call", async () => {
    const sealFetcher = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ secret_ref: "ref-1" }) }) as unknown as Response,
    );
    const { app } = makeApp("seal-guard-test", {
      oracle: { seal: { fetcher: sealFetcher as unknown as typeof fetch } },
    });
    app.mode.set("guest");

    await expectBlocked(() => app.oracle.seal.store({ name: "n", ciphertext: "ct" }));
    expect(sealFetcher).not.toHaveBeenCalled();
  });

  it("still delegates to the store lane in gamefi mode", async () => {
    const sealFetcher = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ secret_ref: "ref-1" }) }) as unknown as Response,
    );
    const { app } = makeApp("seal-pass-test", {
      oracle: { seal: { fetcher: sealFetcher as unknown as typeof fetch } },
    });

    await expect(app.oracle.seal.store({ name: "n", ciphertext: "ct" })).resolves.toMatchObject({
      secretRef: "ref-1",
    });
    expect(sealFetcher).toHaveBeenCalledTimes(1);
  });
});

describe("app.game.reward().replayOps guest guard", () => {
  it("blocks replayOps in guest mode like the sibling TEE lanes", async () => {
    const { app } = makeApp();
    app.mode.set("guest");
    const reward = app.game.reward(rewardConfig);
    await expectBlocked(() => reward.replayOps({} as never, [] as never));
  });
});

describe("guest board isolation", () => {
  it("filters guest-namespaced rows out of stats.leaderboard.top", async () => {
    const { app, board } = makeApp("iso-app");
    board.push({ user: "gamefi-player", score: "77" });
    await app.mode.guestLeaderboard.submit(8);

    const rows = await app.stats.leaderboard.top();
    expect(rows).toEqual([{ user: "gamefi-player", score: "77" }]);
  });

  it("routes stats.leaderboard.submit through the guest namespace in guest mode", async () => {
    const { app, os } = makeApp("submit-guard-app");
    app.mode.set("guest");

    // Pre-fix failure mode: a guest run wrote the UNPREFIXED score straight
    // onto the shared OS board, mixing guest and gamefi rows.
    await app.stats.leaderboard.submit(31);
    expect(os.leaderboard.submitScore).toHaveBeenCalledWith(
      "submit-guard-app:guest:31",
    );
    expect(os.leaderboard.submitScore).not.toHaveBeenCalledWith("31");

    // The routed row stays invisible to the gamefi board view and readable
    // through the guest lane — same isolation as mode.guestLeaderboard.
    await expect(app.stats.leaderboard.top()).resolves.toEqual([]);
    await expect(app.mode.guestLeaderboard.get()).resolves.toEqual([
      { user: ADDRESS, score: "31" },
    ]);
  });

  it("keeps stats.leaderboard.submit unprefixed in gamefi mode", async () => {
    const { app, os } = makeApp("submit-gamefi-app");

    await app.stats.leaderboard.submit(64);
    expect(os.leaderboard.submitScore).toHaveBeenCalledWith("64");
    await expect(app.stats.leaderboard.top()).resolves.toEqual([
      { user: ADDRESS, score: "64" },
    ]);
  });

  it("guestLeaderboard.get scans past the requested window on a mixed board", async () => {
    const { app, board, os } = makeApp("window-app");
    // 120 non-guest rows ahead of the guest rows: a limit-sized (100) window
    // would return zero guest rows even though guest scores exist.
    for (let index = 0; index < 120; index += 1) {
      board.push({ user: `player-${index}`, score: String(index) });
    }
    await app.mode.guestLeaderboard.submit(42);

    const rows = await app.mode.guestLeaderboard.get(100);
    expect(rows).toEqual([{ user: ADDRESS, score: "42" }]);
    // The scan requested a defensive window, not the caller-facing limit.
    expect(os.leaderboard.get).toHaveBeenCalledWith(500);
  });

  it("guestLeaderboard.get re-ranks decoded rows numerically, descending", async () => {
    const { app } = makeApp("rank-app");
    await app.mode.guestLeaderboard.submit(9);
    await app.mode.guestLeaderboard.submit(100);
    await app.mode.guestLeaderboard.submit(25);

    const rows = await app.mode.guestLeaderboard.get();
    expect(rows.map((row) => row.score)).toEqual(["100", "25", "9"]);
  });
});
