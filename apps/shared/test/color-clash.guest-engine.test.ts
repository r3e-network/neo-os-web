import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameSessionObservables } from "../../../framework/game";
import { createObservable } from "../../../framework/reactive";
import type { ColorUiPhase } from "../../color-clash/src/logic/color-engine";
import { createGuestEngine } from "../../color-clash/src/logic/guest-engine";
import { ruleOf } from "../../color-clash/src/logic/game-rules";

function messages(key: string, params?: Record<string, string | number>): string {
  let value = key;
  for (const [param, replacement] of Object.entries(params ?? {})) {
    value += ` ${param}=${replacement}`;
  }
  return value;
}

function makeGuest() {
  const obs = createGameSessionObservables();
  const sequence = createObservable("");
  const playerSequence = createObservable("");
  const seqAchieved = createObservable(0);
  const roundNumber = createObservable(0);
  const roundPhase = createObservable<ColorUiPhase>("lobby");
  const lastPayoutFixed8 = createObservable(0n);
  const submitted: Array<number | string> = [];
  const board: Array<{ user: string; score: string }> = [];
  const guestLeaderboard = {
    submit: vi.fn(async (score: number | string) => {
      submitted.push(score);
      board.push({ user: "guest-player", score: String(score) });
    }),
    get: vi.fn(async () => board.slice()),
  };
  const setStatus = vi.fn();
  const engine = createGuestEngine({
    obs,
    sequence,
    playerSequence,
    seqAchieved,
    roundNumber,
    roundPhase,
    lastPayoutFixed8,
    guestLeaderboard,
    t: messages,
    setStatus,
  });
  return {
    obs,
    sequence,
    playerSequence,
    seqAchieved,
    roundNumber,
    roundPhase,
    lastPayoutFixed8,
    guestLeaderboard,
    submitted,
    setStatus,
    engine,
  };
}

function playVisibleRound(guest: ReturnType<typeof makeGuest>): void {
  guest.engine.sequencePlaybackComplete();
  for (const color of guest.sequence.get()) {
    guest.engine.recordPress(Number(color));
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("color-clash guest engine", () => {
  it("starts each difficulty as a one-cue watching round", () => {
    for (const difficulty of [0, 1, 2]) {
      const guest = makeGuest();
      guest.engine.startGame(difficulty);
      expect(guest.obs.gameStatus.get()).toBe("dealt");
      expect(guest.obs.gameDifficulty.get()).toBe(difficulty);
      expect(guest.obs.activeGameId.get()).toBe("guest");
      expect(guest.sequence.get()).toMatch(/^[0-3]$/);
      expect(guest.playerSequence.get()).toBe("");
      expect(guest.roundNumber.get()).toBe(1);
      expect(guest.roundPhase.get()).toBe("watching");
      expect(guest.obs.deadline.get()).toBeGreaterThan(Date.now());
    }
  });

  it("ignores input until the scene reports playback complete", () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    const first = Number(guest.sequence.get()[0]);
    guest.engine.recordPress(first);
    expect(guest.playerSequence.get()).toBe("");
    expect(guest.roundPhase.get()).toBe("watching");
  });

  it("grows one cue per successful classic-Simon round", () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    playVisibleRound(guest);
    expect(guest.seqAchieved.get()).toBe(1);
    expect(guest.sequence.get()).toHaveLength(2);
    expect(guest.roundNumber.get()).toBe(2);
    expect(guest.roundPhase.get()).toBe("watching");
    expect(guest.playerSequence.get()).toBe("");
  });

  it("preserves completed-round score on a later wrong press", () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    playVisibleRound(guest);
    guest.engine.sequencePlaybackComplete();
    const expected = Number(guest.sequence.get()[0]);
    guest.engine.recordPress((expected + 1) % 4);
    expect(guest.roundPhase.get()).toBe("wrong");
    expect(guest.seqAchieved.get()).toBe(1);
    expect(guest.obs.myTotalWon.get()).toBe(1);
    expect(guest.setStatus).toHaveBeenCalledWith("wrongPress", "error");
  });

  it("refuses early settlement and settles a completed run only once", async () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    await guest.engine.submitSolution();
    expect(guest.obs.gameStatus.get()).toBe("dealt");

    const target = ruleOf(0).targetSeq;
    while (guest.roundPhase.get() !== "complete") playVisibleRound(guest);
    expect(guest.seqAchieved.get()).toBe(target);
    await Promise.all([guest.engine.submitSolution(), guest.engine.submitSolution()]);
    expect(guest.obs.gameStatus.get()).toBe("solved");
    expect(guest.obs.mySolves.get()).toBe(1);
    expect(guest.obs.myTotalWon.get()).toBe(target);
    expect(guest.guestLeaderboard.submit).toHaveBeenCalledTimes(1);
    expect(guest.submitted).toEqual([target]);
    expect(guest.obs.myHistory.get()).toHaveLength(1);
    expect(guest.obs.myHistory.get()[0]).toMatchObject({
      difficulty: 0,
      payout: "0 GAS",
      seqAchieved: target,
    });
  });

  it("fails closed when Web Crypto is unavailable", () => {
    const guest = makeGuest();
    vi.stubGlobal("crypto", undefined);

    expect(() => guest.engine.startGame(0)).toThrow("secureRandomUnavailable");
    expect(guest.obs.gameStatus.get()).toBe("idle");
    expect(guest.sequence.get()).toBe("");
    expect(guest.obs.isStarting.get()).toBe(false);
  });

  it("expires a late run and clears its private sequence", () => {
    const guest = makeGuest();
    guest.engine.startGame(1);
    guest.obs.deadline.set(Date.now() - 1);
    guest.engine.sequencePlaybackComplete();
    expect(guest.obs.gameStatus.get()).toBe("expired");
    expect(guest.sequence.get()).toBe("");
    expect(guest.roundPhase.get()).toBe("expired");
  });

  it("does not replace an active run on repeated start input", () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    const sequence = guest.sequence.get();
    const deadline = guest.obs.deadline.get();
    guest.engine.startGame(2);
    expect(guest.obs.gameDifficulty.get()).toBe(0);
    expect(guest.sequence.get()).toBe(sequence);
    expect(guest.obs.deadline.get()).toBe(deadline);
  });

  it("restarts a finished local run directly without a second lobby action", () => {
    const guest = makeGuest();
    guest.engine.startGame(0);
    guest.engine.sequencePlaybackComplete();
    const expected = Number(guest.sequence.get()[0]);
    guest.engine.recordPress((expected + 1) % 4);
    const oldDeadline = guest.obs.deadline.get();

    guest.engine.startGame(2);

    expect(guest.obs.gameStatus.get()).toBe("dealt");
    expect(guest.obs.gameDifficulty.get()).toBe(2);
    expect(guest.roundPhase.get()).toBe("watching");
    expect(guest.sequence.get()).toHaveLength(1);
    expect(guest.obs.deadline.get()).toBeGreaterThan(oldDeadline);
  });

  it("enters Guest as a clean chain-free lobby", async () => {
    const guest = makeGuest();
    guest.obs.credit.set(4);
    guest.obs.poolFree.set(9);
    guest.obs.myRank.set(2);
    await guest.engine.enter();
    expect(guest.obs.gameStatus.get()).toBe("idle");
    expect(guest.obs.activeGameId.get()).toBe("0");
    expect(guest.obs.credit.get()).toBe(0);
    expect(guest.obs.poolFree.get()).toBe(0);
    expect(guest.obs.myRank.get()).toBe(0);
    expect(guest.roundPhase.get()).toBe("lobby");
  });
});
