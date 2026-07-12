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
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework, FrameworkPermissionError } from "../index";
import type { MiniAppFrameworkContext } from "../index";
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

function makeApp(launchContext?: Record<string, unknown>) {
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
  return { app, chain, reward: app.game.reward(rewardConfig) };
}

/** Normalize sync throws and rejections into one rejection assertion. */
function run(fn: () => unknown): Promise<unknown> {
  return (async () => fn())();
}

const isInvokePrimaryDenial = (error: unknown) =>
  error instanceof FrameworkPermissionError && error.permission === "invoke:primary";

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
