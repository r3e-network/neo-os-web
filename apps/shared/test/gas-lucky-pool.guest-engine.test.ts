import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../gas-lucky-pool/src/logic/guest-engine";
import type { GuestEngineDeps, GuestBoardRow } from "../../gas-lucky-pool/src/logic/guest-engine";

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function stubRandomUnit(value: number): void {
  const raw = Math.max(0, Math.min(0xffffffff, Math.floor(value * 0x100000000)));
  vi.stubGlobal("crypto", {
    getRandomValues(array: Uint32Array) {
      array[0] = raw;
      return array;
    },
  });
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

function setup(boardRows: Array<{ user: string; score: string }> = []) {
  const lastClaimAmount = makeObs(10n);
  const lastClaimLuckPercent = makeObs("old");
  const lastError = makeObs("old error");
  const lastTxid = makeObs("0xold");
  const lastSuccessType = makeObs("claim");
  const claimStatus = makeObs("paid");
  const claimProgress = makeObs("waiting");
  const currentClaimKey = makeObs("claim-key");
  const currentPoolId = makeObs("pool-1");
  const currentPool = makeObs<unknown>({ id: "pool-1" });
  const recentPools = makeObs<unknown[]>([{ id: "pool-1" }]);
  const recentClaims = makeObs<unknown[]>([{ id: "claim-1" }]);
  const gasCredit = makeObs(99n);
  const guestBest = makeObs(7);
  const guestLast = makeObs(4);
  const guestDraws = makeObs(2);
  const guestBoard = makeObs<GuestBoardRow[]>([]);
  const rows = [...boardRows];
  const submit = vi.fn(async (score: number | string) => {
    rows.push({ user: "Nyou", score: String(score) });
  });
  const get = vi.fn(async (_limit?: number) => rows.slice());
  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    lastClaimAmount,
    lastClaimLuckPercent,
    lastError,
    lastTxid,
    lastSuccessType,
    claimStatus,
    claimProgress,
    currentClaimKey,
    currentPoolId,
    currentPool,
    recentPools,
    recentClaims,
    gasCredit,
    guestBest,
    guestLast,
    guestDraws,
    guestBoard,
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
    lastClaimAmount,
    lastClaimLuckPercent,
    lastError,
    lastTxid,
    lastSuccessType,
    claimStatus,
    claimProgress,
    currentClaimKey,
    currentPoolId,
    currentPool,
    recentPools,
    recentClaims,
    gasCredit,
    guestBest,
    guestLast,
    guestDraws,
    guestBoard,
  };
}

describe("gas-lucky-pool guest engine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enter() clears claim/pool/credit context and loads the guest board", async () => {
    const h = setup([
      { user: "Nalpha", score: "350" },
      { user: "Nbeta", score: "1200" },
    ]);

    await h.engine.enter();

    expect(h.lastClaimAmount.get()).toBe(0n);
    expect(h.lastClaimLuckPercent.get()).toBe("");
    expect(h.lastError.get()).toBe("");
    expect(h.lastTxid.get()).toBe("");
    expect(h.lastSuccessType.get()).toBe("");
    expect(h.claimStatus.get()).toBe("");
    expect(h.claimProgress.get()).toBe("");
    expect(h.currentClaimKey.get()).toBe("");
    expect(h.currentPoolId.get()).toBe("");
    expect(h.currentPool.get()).toBeNull();
    expect(h.recentPools.get()).toEqual([]);
    expect(h.recentClaims.get()).toEqual([]);
    expect(h.gasCredit.get()).toBe(0n);
    expect(h.guestBest.get()).toBe(0);
    expect(h.guestLast.get()).toBe(0);
    expect(h.guestDraws.get()).toBe(0);
    expect(h.guestBoard.get()).toEqual([
      { user: "Nbeta", score: 12 },
      { user: "Nalpha", score: 3.5 },
    ]);
    expect(h.get).toHaveBeenCalled();
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("draws local points, drives the reward reveal state, and writes only guest score", async () => {
    stubRandomUnit(0.5);
    const h = setup();
    await h.engine.enter();
    h.get.mockClear();

    h.engine.draw({ min: 1, max: 5 });
    await flushAsyncWork();

    expect(h.lastError.get()).toBe("");
    expect(h.lastTxid.get()).toBe("");
    expect(h.lastSuccessType.get()).toBe("");
    expect(h.claimStatus.get()).toBe("");
    expect(h.claimProgress.get()).toBe("");
    expect(h.lastClaimAmount.get()).toBe(300000000n);
    expect(h.lastClaimLuckPercent.get()).toBe("50");
    expect(h.guestLast.get()).toBe(3);
    expect(h.guestBest.get()).toBe(3);
    expect(h.guestDraws.get()).toBe(1);
    expect(h.submit).toHaveBeenCalledWith(300);
    expect(h.get).toHaveBeenCalled();
    expect(h.setStatus).toHaveBeenCalledWith(
      'guestDrawResult:{"amount":"3.00","luck":50}',
      "success",
    );
  });

  it("keeps best score across local draws and maps board centi-points to points", async () => {
    stubRandomUnit(0);
    const h = setup([{ user: "Nold", score: "275" }]);
    await h.engine.enter();

    h.engine.draw({ min: 2, max: 2 });
    await flushAsyncWork();

    expect(h.guestLast.get()).toBe(2);
    expect(h.guestBest.get()).toBe(2);
    expect(h.lastClaimLuckPercent.get()).toBe("50");
    expect(h.submit).toHaveBeenCalledWith(200);
    expect(h.guestBoard.get().some((row) => row.user === "Nold" && row.score === 2.75)).toBe(true);
  });
});
