/**
 * app.game.reward S11 permission gate (fleet permission sweep follow-up).
 *
 * The reward-game adapter (rewardChain) wraps the RAW host chain service, so
 * before this gate the entire app.game.reward surface — start / finalize /
 * expire / withdrawCredit — broadcast primary-contract invokes with NO
 * "invoke:primary" check, unlike app.chain.* and app.funds.*. This spec locks:
 *
 * - Bypass closed: a PRESENT manifest declaration omitting "invoke:primary"
 *   (including the pinned-empty declarations TEE games ship) denies every
 *   reward broadcast lane BEFORE any wallet prompt or chain call.
 * - Default-allow unchanged: hosts that deliver NO declaration keep every
 *   current game working (start broadcasts, expire broadcasts).
 * - Guest-guard ordering: assertNotGuest fires BEFORE the permission gate
 *   (round-2 idiom), so a guest sees the guest error, not a permission error.
 * - Read lanes stay ungated: balances/snapshot reads work without the grant.
 *
 * TEE session lanes (Lane 3 follow-up — RFC §7): openSession / recordOp /
 * replayOps hand rewardOptions.fetcher to the DIRECT enclave session client
 * (/api/morpheus/session/*), bypassing app.oracle's "oracle:request" gate.
 * This spec also locks the S11 "oracle:request" gate on those lanes:
 * - Denied under a present declaration missing the grant (incl. the pinned
 *   EMPTY TEE-game manifests) with ZERO fetcher traffic.
 * - Default-allow unchanged: no declaration → the session lanes round-trip.
 * - Guest guard fires first on all three lanes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework, FrameworkPermissionError } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import type { RewardGameSession } from "../gamefi";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const GUEST_ERROR = /guest-mode: on-chain\/oracle operations are disabled/;

const GAME_STARTED_EVENT = {
  tx_hash: "0xstart",
  state: [{ type: "Integer", value: "7" }],
};

const rewardConfig = {
  engineHash: "aa".repeat(32),
  entryMemo: "reward-gate-test:entry",
  modes: [
    { id: 0, entryFixed8: 1, rewardFixed8: 2, limitMs: 1000, minSolveMs: 100, target: 4 },
  ],
};

function makeApp(
  launchContext?: Record<string, unknown>,
  rewardOptions?: { fetcher?: typeof fetch },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (operation: string) => {
      if (operation === "freePool") return "100000000";
      if (operation === "activeGameOf") return "7";
      return "0";
    }),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({
      txid: "0xpay",
      success: true,
      event: GAME_STARTED_EVENT,
    })),
    listEvents: vi.fn(async () => []),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext: { appId: "reward-gate-test", ...launchContext },
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, { appId: "reward-gate-test" });
  return { app, chain, reward: app.game.reward(rewardConfig, rewardOptions) };
}

/**
 * Minimal generic-oracle session-host fetcher: answers /session/start with a
 * valid commitment + token and /session/step with a step payload. Lets the
 * default-allow tests drive the REAL tee-session client end to end.
 */
function makeTeeFetcher() {
  const fetcher = vi.fn(async (input: unknown) => {
    const url = String(input);
    const body: Record<string, unknown> = url.endsWith("/start")
      ? {
          commitment: "ab".repeat(32),
          session_token: "tok",
          public_key: "pk",
          view: {},
          config: {},
        }
      : { seq: 0, op_count: 1, resumed: false };
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
  return { fetcher, asFetch: fetcher as unknown as typeof fetch };
}

/** A well-formed session object for driving recordOp/replayOps directly. */
function makeSession(sessionToken: string): RewardGameSession {
  return {
    commitment: "ab".repeat(32),
    publicKey: "pk",
    sessionToken,
    view: {},
    config: { limitMs: 1000, minSolveMs: 100, maxUndos: 0, revealPolicy: "", raw: {} },
    identity: {
      appId: "reward-gate-test",
      engineHash: "aa".repeat(32),
      network: "testnet",
      contractHash: "0xabc",
      gameId: "7",
      player: `0x${"11".repeat(20)}`,
      difficulty: 0,
    },
  };
}

/** Normalize sync throws and rejections into one rejection assertion. */
function run(fn: () => unknown): Promise<unknown> {
  return (async () => fn())();
}

const isInvokePrimaryDenial = (error: unknown) =>
  error instanceof FrameworkPermissionError && error.permission === "invoke:primary";

const isOracleRequestDenial = (error: unknown) =>
  error instanceof FrameworkPermissionError && error.permission === "oracle:request";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("app.game.reward S11 gate — bypass closed", () => {
  it("denies every reward broadcast lane when the declaration omits invoke:primary", async () => {
    const { chain, reward } = makeApp({ permissions: ["oracle:request"] });

    await expect(run(() => reward.start(0))).rejects.toSatisfy(isInvokePrimaryDenial);
    await expect(run(() => reward.finalize({} as never))).rejects.toSatisfy(
      isInvokePrimaryDenial,
    );
    await expect(run(() => reward.expire("7"))).rejects.toSatisfy(isInvokePrimaryDenial);
    await expect(run(() => reward.withdrawCredit())).rejects.toSatisfy(isInvokePrimaryDenial);

    // Denials fire before ANY wallet prompt or chain broadcast.
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("enforces a pinned EMPTY declaration verbatim (TEE guest-only manifests)", async () => {
    const { chain, reward } = makeApp({ permissions: [] });

    await expect(run(() => reward.start(0))).rejects.toSatisfy(isInvokePrimaryDenial);
    await expect(run(() => reward.withdrawCredit())).rejects.toSatisfy(isInvokePrimaryDenial);
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("keeps reward READ lanes ungated under a denying declaration", async () => {
    const { chain, reward } = makeApp({ permissions: [] });

    const balances = await reward.balances("0x" + "11".repeat(20));
    expect(balances.poolFreeFixed8).toBe(100000000n);
    expect(chain.read).toHaveBeenCalledWith("freePool", []);
    await expect(reward.snapshot("7")).resolves.toMatchObject({ gameId: "7" });
  });
});

describe("app.game.reward S11 gate — default-allow back-compat", () => {
  it("keeps start broadcasting when the host delivers NO declaration", async () => {
    const { chain, reward } = makeApp();

    const started = await reward.start(0);
    expect(started.gameId).toBe("7");
    expect(started.usedCredit).toBe(false);
    // Entry is paid through the payment-carrying broadcast lane, untouched.
    expect(chain.invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "1",
      rewardConfig.entryMemo,
      "startGame",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "GameStarted" }),
    );
  });

  it("keeps expire and withdrawCredit broadcasting without a declaration", async () => {
    const { chain, reward } = makeApp();

    await expect(reward.expire("7")).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(chain.invoke).toHaveBeenCalledWith(
      "expireGame",
      [{ type: "Integer", value: "7" }],
      {},
    );
    // creditOf reads "0" → the SDK's no-credit skip, reached past the gate.
    await expect(reward.withdrawCredit()).resolves.toEqual({
      skipped: true,
      reason: "no-credit",
    });
  });

  it("keeps the lanes working when invoke:primary is explicitly granted", async () => {
    const { chain, reward } = makeApp({ permissions: ["invoke:primary"] });

    await expect(reward.expire("7")).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(chain.invoke).toHaveBeenCalledTimes(1);
  });
});

describe("app.game.reward guard ordering", () => {
  it("fires the guest guard BEFORE the permission gate (round-2 idiom)", async () => {
    const { app, chain, reward } = makeApp({ permissions: [] });
    app.mode.set("guest");

    // Both guards would deny; the guest guard must win the ordering.
    await expect(run(() => reward.start(0))).rejects.toThrow(GUEST_ERROR);
    await expect(run(() => reward.withdrawCredit())).rejects.toThrow(GUEST_ERROR);
    await expect(run(() => reward.expire("7"))).rejects.toThrow(GUEST_ERROR);
    await expect(run(() => reward.finalize({} as never))).rejects.toThrow(GUEST_ERROR);
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });
});

describe("app.game.reward TEE session lanes — S11 oracle:request gate (RFC §7)", () => {
  it("denies openSession/recordOp/replayOps under a pinned EMPTY declaration with ZERO TEE traffic", async () => {
    const { fetcher, asFetch } = makeTeeFetcher();
    const { chain, reward } = makeApp({ permissions: [] }, { fetcher: asFetch });
    const session = makeSession("tok-empty-deny");

    await expect(run(() => reward.openSession("7", 0))).rejects.toSatisfy(
      isOracleRequestDenial,
    );
    await expect(run(() => reward.recordOp(session, { type: "tap" }))).rejects.toSatisfy(
      isOracleRequestDenial,
    );
    await expect(
      run(() => reward.replayOps(session, [{ type: "tap" }])),
    ).rejects.toSatisfy(isOracleRequestDenial);

    // Denials fire BEFORE the identity build and the enclave request.
    expect(fetcher).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.read).not.toHaveBeenCalled();
  });

  it("denies the session lanes when only invoke:primary is granted (re-enable checklist gap)", async () => {
    const { fetcher, asFetch } = makeTeeFetcher();
    const { reward } = makeApp(
      { permissions: ["invoke:primary"] },
      { fetcher: asFetch },
    );

    await expect(run(() => reward.openSession("7", 0))).rejects.toSatisfy(
      isOracleRequestDenial,
    );
    await expect(
      run(() => reward.recordOp(makeSession("tok-primary-only"), { type: "tap" })),
    ).rejects.toSatisfy(isOracleRequestDenial);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the session lanes round-tripping when the host delivers NO declaration", async () => {
    const { fetcher, asFetch } = makeTeeFetcher();
    const { reward } = makeApp(undefined, { fetcher: asFetch });

    const session = await reward.openSession("7", 0);
    expect(session.sessionToken).toBe("tok");
    expect(session.commitment).toBe("ab".repeat(32));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("/api/morpheus/session/start");

    const recorded = await reward.recordOp(session, { type: "tap" });
    expect(recorded.step.opCount).toBe(1);
    expect(recorded.opLog).toEqual([{ type: "tap" }]);
    expect(String(fetcher.mock.calls[1]?.[0])).toBe("/api/morpheus/session/step");

    const steps = await reward.replayOps(session, [{ type: "tap" }]);
    expect(steps).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("allows openSession with the oracle:request grant alone (free lane — no invoke:primary needed)", async () => {
    const { fetcher, asFetch } = makeTeeFetcher();
    const { reward } = makeApp(
      { permissions: ["oracle:request"] },
      { fetcher: asFetch },
    );

    await expect(reward.openSession("7", 0)).resolves.toMatchObject({
      sessionToken: "tok",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fires the guest guard BEFORE the oracle:request gate on all three lanes", async () => {
    const { fetcher, asFetch } = makeTeeFetcher();
    const { app, reward } = makeApp({ permissions: [] }, { fetcher: asFetch });
    app.mode.set("guest");
    const session = makeSession("tok-guest-order");

    await expect(run(() => reward.openSession("7", 0))).rejects.toThrow(GUEST_ERROR);
    await expect(run(() => reward.recordOp(session, { type: "tap" }))).rejects.toThrow(
      GUEST_ERROR,
    );
    await expect(run(() => reward.replayOps(session, [{ type: "tap" }]))).rejects.toThrow(
      GUEST_ERROR,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
