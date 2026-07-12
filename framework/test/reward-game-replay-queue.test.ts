/**
 * Reward-game session serialization: replayRewardGameOps must ride the same
 * per-session queue as recordRewardGameOp / finalizeRewardGame. A recovery
 * replay that interleaves with an in-flight recorded op would reuse its
 * monotonic sequence number and corrupt the persisted op-log.
 */
import { describe, expect, it } from "vitest";
import {
  createMemoryRewardGameStorage,
  recordRewardGameOp,
  replayRewardGameOps,
} from "../gamefi";
import type { RewardGameSession } from "../gamefi";

function makeSession(gameId: string, token: string): RewardGameSession {
  return {
    commitment: "a".repeat(64),
    publicKey: "pk",
    sessionToken: token,
    view: {},
    config: { limitMs: 0, minSolveMs: 0, maxUndos: 0, revealPolicy: "", raw: {} },
    identity: {
      appId: "replay-queue-test",
      engineHash: "e".repeat(64),
      network: "testnet",
      contractHash: `0x${"c".repeat(40)}`,
      gameId,
      player: `0x${"1".repeat(40)}`,
      difficulty: 0,
    },
  };
}

/** Fetch stub whose responses resolve only when the test releases them. */
function deferredFetcher() {
  const calls: Array<{ body: Record<string, unknown>; release: () => void }> = [];
  const fetcher = (async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Promise<Response>((resolve) => {
      calls.push({
        body,
        release: () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              seq: body.seq,
              op_count: Number(body.seq ?? 0) + 1,
              resumed: false,
            }),
          } as unknown as Response),
      });
    });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("replayRewardGameOps session-queue serialization", () => {
  it("does not reach the TEE while a recorded op on the same session is in flight", async () => {
    const session = makeSession("g-serialize", "tok-serialize");
    const storage = createMemoryRewardGameStorage();
    const { fetcher, calls } = deferredFetcher();

    const recorded = recordRewardGameOp(session, storage, { type: "tap" }, fetcher);
    await flush();
    expect(calls).toHaveLength(1); // the recorded op's step is in flight

    const replayed = replayRewardGameOps(session, [{ type: "tap" }], undefined, fetcher);
    await flush();
    // The replay is queued behind the in-flight op — no second TEE call yet.
    expect(calls).toHaveLength(1);

    calls[0]!.release();
    await recorded;
    await flush();
    expect(calls).toHaveLength(2); // replay released only after the op settled
    expect(calls[1]!.body.replay).toEqual([{ type: "tap" }]);

    calls[1]!.release();
    await expect(replayed).resolves.toHaveLength(1);
  });

  it("still resolves a plain replay on an idle session", async () => {
    const session = makeSession("g-idle", "tok-idle");
    const { fetcher, calls } = deferredFetcher();

    const replayed = replayRewardGameOps(
      session,
      [{ type: "tap" }, { type: "tap" }],
      undefined,
      fetcher,
    );
    await flush();
    expect(calls).toHaveLength(1);
    calls[0]!.release();
    await flush();
    expect(calls).toHaveLength(2);
    calls[1]!.release();

    const steps = await replayed;
    expect(steps.map((step) => step.seq)).toEqual([0, 1]);
  });
});
