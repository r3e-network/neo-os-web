import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../burn-league/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../burn-league/src/logic/guest-engine";
import type { LeaderEntry } from "../../burn-league/src/composables/useBurnLeague";

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function stubRand(values: number[]): void {
  const queue = values.map((value) =>
    Math.max(0, Math.min(0xffffffff, Math.floor(value * 4294967296))),
  );
  vi.stubGlobal("crypto", {
    getRandomValues(array: Uint32Array) {
      array[0] = queue.shift() ?? 0x7fffffff;
      return array;
    },
  });
}

function setup(boardRows: Array<{ user: string; score: string }> = []) {
  const rewardPool = makeObs(12);
  const totalBurned = makeObs(12);
  const userBurned = makeObs(4);
  const rank = makeObs(3);
  const burnCount = makeObs(9);
  const leaderboard = makeObs<LeaderEntry[]>([]);
  const isBurning = makeObs(false);
  const isSettling = makeObs(true);
  const seasonId = makeObs(7);
  const seasonEndMs = makeObs(Date.now() + 1000);
  const topBurnerAddress = makeObs<string | null>("Nold");
  const topBurnedGas = makeObs(12);
  const prepaidCredit = makeObs(5);
  const actionNotice = makeObs("old notice");
  const serviceNotice = makeObs("old service");
  const burnValidationError = makeObs<string | null>("old error");
  const lastSettleResult = makeObs<{ won: boolean; amount: string; token: number } | null>({
    won: true,
    amount: "1",
    token: 1,
  });
  const burnAmount = makeObs("5");
  const minBurnGas = makeObs(1);
  const maxBurnGas = makeObs(1000);
  const guestStreak = makeObs(2);
  const address = makeObs<string | null>("Nyou");
  const rows = [...boardRows];
  const submit = vi.fn(async (score: number | string) => {
    rows.push({ user: "Nyou", score: String(score) });
  });
  const get = vi.fn(async (_limit?: number) => rows.slice());
  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    rewardPool,
    totalBurned,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isBurning,
    isSettling,
    seasonId,
    seasonEndMs,
    topBurnerAddress,
    topBurnedGas,
    prepaidCredit,
    actionNotice,
    serviceNotice,
    burnValidationError,
    lastSettleResult,
    burnAmount,
    minBurnGas,
    maxBurnGas,
    guestStreak,
    address,
    guestLeaderboard: { submit, get },
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    rows,
    submit,
    get,
    setStatus,
    rewardPool,
    totalBurned,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isBurning,
    isSettling,
    seasonId,
    seasonEndMs,
    topBurnerAddress,
    topBurnedGas,
    prepaidCredit,
    actionNotice,
    serviceNotice,
    burnValidationError,
    lastSettleResult,
    burnAmount,
    minBurnGas,
    maxBurnGas,
    guestStreak,
  };
}

describe("burn-league guest engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("enter() resets on-chain season surfaces and loads the guest board", async () => {
    const h = setup([
      { user: "Nalpha", score: "22" },
      { user: "Nyou", score: "31" },
    ]);

    await h.engine.enter();

    expect(h.seasonId.get()).toBe(0);
    expect(h.seasonEndMs.get()).toBe(0);
    expect(h.rewardPool.get()).toBe(31);
    expect(h.totalBurned.get()).toBe(31);
    expect(h.userBurned.get()).toBe(0);
    expect(h.rank.get()).toBe(0);
    expect(h.burnCount.get()).toBe(0);
    expect(h.topBurnerAddress.get()).toBe("Nyou");
    expect(h.topBurnedGas.get()).toBe(31);
    expect(h.prepaidCredit.get()).toBe(0);
    expect(h.isSettling.get()).toBe(false);
    expect(h.serviceNotice.get()).toBe("");
    expect(h.burnValidationError.get()).toBeNull();
    expect(h.lastSettleResult.get()).toBeNull();
    expect(h.guestStreak.get()).toBe(0);
    expect(h.leaderboard.get()[0]).toMatchObject({ address: "Nyou", burned: 31, rank: 1, isUser: true });
    expect(h.get).toHaveBeenCalled();
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("stokes a local run with animation timing and no leaderboard write", async () => {
    stubRand([0.5, 0.5]);
    const h = setup();
    await h.engine.enter();

    h.engine.stoke("5");

    expect(h.isBurning.get()).toBe(true);
    expect(h.actionNotice.get()).toBe("guestStoking");
    expect(h.submit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(280);

    expect(h.isBurning.get()).toBe(false);
    expect(h.guestStreak.get()).toBe(1);
    expect(h.userBurned.get()).toBeGreaterThan(0);
    expect(h.rewardPool.get()).toBe(0);
    expect(h.totalBurned.get()).toBe(0);
    expect(h.burnCount.get()).toBe(1);
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.setStatus).toHaveBeenCalledWith(expect.stringContaining("guestStoked"), "success");
  });

  it("rejects invalid local fuel before any timer or board write", async () => {
    const h = setup();
    await h.engine.enter();
    h.burnAmount.set("0");

    h.engine.stoke();

    expect(h.isBurning.get()).toBe(false);
    expect(h.burnValidationError.get()).toContain("guestFuelInvalid");
    expect(h.setStatus).toHaveBeenCalledWith(expect.stringContaining("guestFuelInvalid"), "error");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("cancels an in-flight stoke when the local engine is disposed", async () => {
    stubRand([0.5, 0.5]);
    const h = setup();
    await h.engine.enter();

    h.engine.stoke("5");
    expect(h.isBurning.get()).toBe(true);
    h.engine.dispose();
    await vi.advanceTimersByTimeAsync(280);

    expect(h.isBurning.get()).toBe(false);
    expect(h.guestStreak.get()).toBe(0);
    expect(h.userBurned.get()).toBe(0);
    expect(h.burnCount.get()).toBe(0);
  });

  it("banks a live run only when the player chooses to lock it", async () => {
    stubRand([0.5, 0.5]);
    const h = setup();
    await h.engine.enter();

    h.engine.stoke("5");
    await vi.advanceTimersByTimeAsync(280);
    const banked = h.userBurned.get();

    expect(h.engine.bank()).toBe(true);
    await vi.runAllTimersAsync();
    expect(h.submit).toHaveBeenCalledWith(banked);
    expect(h.userBurned.get()).toBe(0);
    expect(h.guestStreak.get()).toBe(0);
    expect(h.rewardPool.get()).toBe(banked);
    expect(h.setStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("guestBanked"),
      "success",
    );
  });

  it("starts flare risk on the fourth stoke after three safe successes", async () => {
    stubRand([
      0.5, 0.5,
      0.5, 0.5,
      0.5, 0.5,
      0,
    ]);
    const h = setup();
    await h.engine.enter();

    for (let i = 0; i < 3; i += 1) {
      h.engine.stoke("5");
      await vi.advanceTimersByTimeAsync(280);
    }
    expect(h.guestStreak.get()).toBe(3);
    expect(h.userBurned.get()).toBeGreaterThan(0);

    h.engine.stoke("5");
    await vi.advanceTimersByTimeAsync(280);

    expect(h.guestStreak.get()).toBe(0);
    expect(h.userBurned.get()).toBe(0);
    expect(h.setStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("guestFlareOut"),
      "warning",
    );
  });

  it("loses unbanked heat on a flare-out instead of silently banking it", async () => {
    // Four successful stokes build a run; the fifth flare check rolls 0.
    stubRand([
      0.5, 0.5,
      0.5, 0.5,
      0.5, 0.5,
      0.5, 0.5, 0.5,
      0,
    ]);
    const h = setup();
    await h.engine.enter();

    for (let i = 0; i < 4; i += 1) {
      h.engine.stoke("5");
      await vi.advanceTimersByTimeAsync(280);
    }
    const heatBeforeFlare = h.userBurned.get();
    expect(heatBeforeFlare).toBeGreaterThan(0);

    h.engine.stoke("5");
    await vi.advanceTimersByTimeAsync(280);

    expect(h.submit).not.toHaveBeenCalled();
    expect(h.guestStreak.get()).toBe(0);
    expect(h.userBurned.get()).toBe(0);
    expect(h.setStatus).toHaveBeenLastCalledWith(expect.stringContaining("guestFlareOut"), "warning");
  });

  it("fails closed when Web Crypto is unavailable without changing the run", async () => {
    const h = setup();
    await h.engine.enter();
    vi.stubGlobal("crypto", undefined);

    h.engine.stoke("5");
    await vi.advanceTimersByTimeAsync(280);

    expect(h.isBurning.get()).toBe(false);
    expect(h.userBurned.get()).toBe(0);
    expect(h.guestStreak.get()).toBe(0);
    expect(h.burnCount.get()).toBe(0);
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.burnValidationError.get()).toBe("guestSecureRandomUnavailable");
    expect(h.setStatus).toHaveBeenLastCalledWith(
      "guestSecureRandomUnavailable",
      "error",
    );
  });
});
