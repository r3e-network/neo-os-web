import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../red-envelope/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../red-envelope/src/logic/guest-engine";
import type { EnvelopeItem, ClaimItem } from "../../red-envelope/src/composables/useRedEnvelope";

/**
 * Guest engine tests for Red Envelope.
 *
 * The guest engine is a purely LOCAL packet game — it drives the same scene
 * observables the gamefi flow does (envelopes / pools / claims / openingId /
 * luckyMessage / …) while making ZERO chain / oracle / reward calls. These tests
 * exercise the local roll + open loop and assert the off-chain leaderboard is the
 * ONLY external surface it ever touches (and only on settle/refresh).
 */

const LATENCY = 400;

function setup() {
  const envelopes = createObservable<EnvelopeItem[]>([]);
  const pools = createObservable<EnvelopeItem[]>([]);
  const claims = createObservable<ClaimItem[]>([]);
  const isLoading = createObservable(false);
  const luckyMessage = createObservable<{ amount: number; from: string } | null>(null);
  const openingId = createObservable<string | null>(null);
  const prepaidCredit = createObservable(0);
  const lastCreatedEnvelopeId = createObservable("");
  const guestBest = createObservable(0);
  const guestTotal = createObservable(0);
  const guestOpened = createObservable(0);
  const guestBoard = createObservable<Array<{ user: string; score: number }>>([]);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    envelopes,
    pools,
    claims,
    isLoading,
    luckyMessage,
    openingId,
    prepaidCredit,
    lastCreatedEnvelopeId,
    guestBest,
    guestTotal,
    guestOpened,
    guestBoard,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    envelopes,
    pools,
    claims,
    isLoading,
    luckyMessage,
    openingId,
    prepaidCredit,
    lastCreatedEnvelopeId,
    guestBest,
    guestTotal,
    guestOpened,
    guestBoard,
    submit,
    get,
    board,
    setStatus,
  };
}

/** Sum of a local envelope's packet amounts (base units are hidden, use human). */
function totalAmount(env: EnvelopeItem): number {
  return env.totalAmount;
}

describe("red-envelope guest engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("enter() seeds a playable starter envelope, zeroes counters, loads the board", async () => {
    const h = setup();
    h.prepaidCredit.set(5);
    h.guestBest.set(9);

    await h.engine.enter();

    const list = h.envelopes.get();
    expect(list).toHaveLength(1);
    expect(list[0]?.canOpen).toBe(true);
    expect(list[0]?.active).toBe(true);
    expect(h.pools.get()).toHaveLength(1); // claimable subset mirrors envelopes
    expect(h.prepaidCredit.get()).toBe(0); // on-chain-only counter zeroed
    expect(h.guestBest.get()).toBe(0);
    expect(h.get).toHaveBeenCalled(); // off-chain board loaded
    expect(h.submit).not.toHaveBeenCalled(); // entering never writes a score
  });

  it("createEnvelope splits a total into random packets locally, no writes", async () => {
    const h = setup();
    h.engine.createEnvelope({ amount: "1", count: "8", expiryHours: "24" });
    // Busy while the local roll runs (mirrors the gamefi round-trip).
    expect(h.isLoading.get()).toBe(true);

    await vi.advanceTimersByTimeAsync(LATENCY);

    expect(h.isLoading.get()).toBe(false);
    const list = h.envelopes.get();
    expect(list).toHaveLength(1);
    expect(list[0]?.packetCount).toBe(8);
    expect(totalAmount(list[0]!)).toBeCloseTo(1, 6); // packets sum to the total
    expect(h.lastCreatedEnvelopeId.get()).toBe(list[0]?.id);
    // Rolling packets never touches the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("rejects an under-funded create with an error status and no envelope", () => {
    const h = setup();
    // 3 packets need >= 0.03 GAS; 0.01 is below the per-packet minimum.
    h.engine.createEnvelope({ amount: "0.01", count: "3", expiryHours: "24" });
    expect(h.isLoading.get()).toBe(false);
    expect(h.envelopes.get()).toHaveLength(0);
    expect(h.setStatus).toHaveBeenCalledWith("invalidPerPacket", "error");
  });

  it("claimEnvelope opens one packet, reveals it, and records the score off-chain", async () => {
    const h = setup();
    await h.engine.enter();
    h.get.mockClear();
    const env = h.envelopes.get()[0]!;

    h.engine.claimEnvelope(env.id);
    expect(h.openingId.get()).toBe(env.id); // busy/opening state renders

    await vi.advanceTimersByTimeAsync(LATENCY);

    expect(h.openingId.get()).toBeNull();
    const lucky = h.luckyMessage.get();
    expect(lucky).not.toBeNull();
    expect(lucky!.amount).toBeGreaterThan(0);
    expect(h.claims.get()).toHaveLength(1);
    expect(h.guestOpened.get()).toBe(1);
    expect(h.guestTotal.get()).toBeGreaterThan(0);
    expect(h.guestBest.get()).toBe(lucky!.amount);
    // One packet consumed of the 8-packet starter.
    expect(h.envelopes.get()[0]?.remainingPackets).toBe(7);
    // Score submitted to the OFF-CHAIN board and the board refreshed.
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.get).toHaveBeenCalled();
  });

  it("opening every packet depletes the envelope and disables further opens", async () => {
    const h = setup();
    await h.engine.enter();
    const env = h.envelopes.get()[0]!;
    const packets = env.packetCount;

    for (let i = 0; i < packets; i += 1) {
      h.engine.claimEnvelope(env.id);
      await vi.advanceTimersByTimeAsync(LATENCY);
    }

    const drained = h.envelopes.get()[0]!;
    expect(drained.remainingPackets).toBe(0);
    expect(drained.depleted).toBe(true);
    expect(drained.canOpen).toBe(false);
    expect(h.pools.get()).toHaveLength(0); // no longer claimable
    expect(h.guestOpened.get()).toBe(packets);

    // A further open is ignored (no envelope to draw from).
    h.submit.mockClear();
    h.engine.claimEnvelope(env.id);
    await vi.advanceTimersByTimeAsync(LATENCY);
    expect(h.setStatus).toHaveBeenLastCalledWith("guestNoEnvelope", "info");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("reclaim removes a local envelope; withdraw/share only set a local status", async () => {
    const h = setup();
    await h.engine.enter();
    const env = h.envelopes.get()[0]!;

    h.engine.reclaimEnvelope(env.id);
    expect(h.envelopes.get()).toHaveLength(0);
    expect(h.setStatus).toHaveBeenLastCalledWith("guestReclaimed", "info");

    h.engine.withdrawCredit();
    expect(h.setStatus).toHaveBeenLastCalledWith("guestNoCredit", "info");

    h.engine.shareEnvelope("guest-1");
    expect(h.setStatus).toHaveBeenLastCalledWith("guestShareLocal", "info");
    // None of these write a score.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("maps the off-chain guest board into ranked rows", async () => {
    const h = setup();
    h.board.push({ user: "NplayerA", score: "150" }); // 1.5 GAS
    h.board.push({ user: "NplayerB", score: "320" }); // 3.2 GAS

    await h.engine.refreshLeaderboard();

    const board = h.guestBoard.get();
    expect(board).toHaveLength(2);
    expect(board[0]?.user).toBe("NplayerB");
    expect(board[0]?.score).toBeCloseTo(3.2, 6);
    expect(board[1]?.score).toBeCloseTo(1.5, 6);
  });

  it("serializes local actions and cancels delayed writes when guest mode exits", async () => {
    const h = setup();

    h.engine.createEnvelope({ amount: "1", count: "8", expiryHours: "24" });
    h.engine.createEnvelope({ amount: "5", count: "20", expiryHours: "72" });

    expect(h.setStatus).toHaveBeenLastCalledWith("operationBusy", "info");
    h.engine.leave();
    await vi.advanceTimersByTimeAsync(LATENCY);

    expect(h.isLoading.get()).toBe(false);
    expect(h.envelopes.get()).toHaveLength(0);

    await h.engine.enter();
    const env = h.envelopes.get()[0]!;
    h.engine.claimEnvelope(env.id);
    h.engine.claimEnvelope(env.id);
    expect(h.setStatus).toHaveBeenLastCalledWith("operationBusy", "info");

    h.engine.destroy();
    await vi.advanceTimersByTimeAsync(LATENCY);
    expect(h.openingId.get()).toBeNull();
    expect(h.claims.get()).toHaveLength(0);
  });
});
