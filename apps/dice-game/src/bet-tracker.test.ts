import { describe, expect, it } from "vitest";
import { createBetTracker } from "./bet-tracker";
import type { RollHistoryItem } from "./bet-tracker";

function pendingRow(face: string, stake: string): Omit<RollHistoryItem, "id"> {
  return {
    face,
    stake: `${stake} GAS`,
    result: "Rolling…",
    payout: "0 GAS",
    outcome: "pending",
    txid: `0xtx-${face}-${stake}`,
    at: new Date().toISOString(),
  };
}

describe("createBetTracker — interleaved bets settle into their own rows", () => {
  it("settles the FIRST bet into its own row while a second bet occupies row 0", () => {
    const tracker = createBetTracker();

    const first = tracker.beginBet(pendingRow("3", "0.5"));
    const second = tracker.beginBet(pendingRow("6", "1"));

    // The second bet is now row 0; the first bet sits behind it.
    expect(tracker.rollHistory.get().map((r) => r.id)).toEqual([second, first]);

    // The first bet's poller finishes AFTER the second bet was placed. Before
    // the per-bet keying this rewrote row 0 (the second bet's row).
    tracker.settleBet(first, {
      outcome: "won",
      rolled: 3,
      result: "Won · Rolled 3",
      payout: "2.85 GAS",
    });

    const [secondRow, firstRow] = tracker.rollHistory.get();
    expect(firstRow).toMatchObject({ id: first, outcome: "won", rolled: "3", result: "Won · Rolled 3", payout: "2.85 GAS" });
    expect(secondRow).toMatchObject({ id: second, outcome: "pending", result: "Rolling…" });

    // The reveal banner still tracks the ACTIVE (second) bet — it stays rolling.
    expect(tracker.isResolving.get()).toBe(true);
    expect(tracker.lastOutcome.get()).toBe("pending");
    expect(tracker.lastRoll.get()).toBe("");
    expect(tracker.lastPayout.get()).toBe("");

    // Now the second bet settles: its row updates and the banner reveals it.
    tracker.settleBet(second, {
      outcome: "lost",
      rolled: 1,
      result: "Lost · Rolled 1",
      payout: "0 GAS",
    });

    expect(tracker.rollHistory.get()[0]).toMatchObject({ id: second, outcome: "lost", rolled: "1" });
    expect(tracker.rollHistory.get()[1]).toMatchObject({ id: first, outcome: "won" });
    expect(tracker.isResolving.get()).toBe(false);
    expect(tracker.lastOutcome.get()).toBe("lost");
    expect(tracker.lastRoll.get()).toBe("1");
    expect(tracker.lastPayout.get()).toBe("0 GAS");
  });

  it("keeps the banner on the newest result when an OLDER bet settles last", () => {
    const tracker = createBetTracker();

    const first = tracker.beginBet(pendingRow("2", "0.1"));
    const second = tracker.beginBet(pendingRow("5", "0.2"));

    // Newest bet settles first — banner reveals it.
    const secondWasActive = tracker.settleBet(second, {
      outcome: "won",
      rolled: 5,
      result: "Won · Rolled 5",
      payout: "1.14 GAS",
    });
    expect(secondWasActive).toBe(true);
    expect(tracker.lastOutcome.get()).toBe("won");
    expect(tracker.lastRoll.get()).toBe("5");
    expect(tracker.lastPayout.get()).toBe("1.14 GAS");
    expect(tracker.isResolving.get()).toBe(false);

    // The older bet settles afterwards: its row updates, the banner does NOT.
    const firstWasActive = tracker.settleBet(first, {
      outcome: "lost",
      rolled: 4,
      result: "Lost · Rolled 4",
      payout: "0 GAS",
    });
    expect(firstWasActive).toBe(false);
    expect(tracker.rollHistory.get()[1]).toMatchObject({ id: first, outcome: "lost", rolled: "4" });
    expect(tracker.lastOutcome.get()).toBe("won");
    expect(tracker.lastRoll.get()).toBe("5");
    expect(tracker.lastPayout.get()).toBe("1.14 GAS");
    expect(tracker.isResolving.get()).toBe(false);
  });

  it("only clears the rolling banner when the ACTIVE bet's poll gives up", () => {
    const tracker = createBetTracker();

    const first = tracker.beginBet(pendingRow("1", "0.1"));
    const second = tracker.beginBet(pendingRow("2", "0.1"));

    // An older bet timing out must not hide the newer bet's rolling state.
    tracker.markUnresolved(first);
    expect(tracker.isResolving.get()).toBe(true);
    expect(tracker.isUnresolved.get()).toBe(false);

    tracker.markUnresolved(second);
    expect(tracker.isResolving.get()).toBe(false);
    // Rows are untouched — both stay "rolling" in history.
    expect(tracker.rollHistory.get().every((r) => r.outcome === "pending")).toBe(true);
  });

  it("flags the active bet unresolved on timeout and clears it on re-poll/settle", () => {
    const tracker = createBetTracker();

    const bet = tracker.beginBet(pendingRow("4", "0.5"));
    expect(tracker.isResolving.get()).toBe(true);
    expect(tracker.isUnresolved.get()).toBe(false);

    // Poll gave up — definite "settlement pending" state, not a frozen spinner.
    tracker.markUnresolved(bet);
    expect(tracker.isResolving.get()).toBe(false);
    expect(tracker.isUnresolved.get()).toBe(true);

    // The oracle finally calls back (e.g. via "Check again"): the unresolved flag
    // clears and the row reveals its result.
    tracker.settleBet(bet, { outcome: "won", rolled: 4, result: "Won · Rolled 4", payout: "2.85 GAS" });
    expect(tracker.isUnresolved.get()).toBe(false);
    expect(tracker.isResolving.get()).toBe(false);
    expect(tracker.lastOutcome.get()).toBe("won");
  });

  it("clears a prior unresolved flag when a new bet begins", () => {
    const tracker = createBetTracker();

    const first = tracker.beginBet(pendingRow("1", "0.1"));
    tracker.markUnresolved(first);
    expect(tracker.isUnresolved.get()).toBe(true);

    tracker.beginBet(pendingRow("2", "0.1"));
    expect(tracker.isUnresolved.get()).toBe(false);
    expect(tracker.isResolving.get()).toBe(true);
  });

  it("caps history at 6 rows and ignores settlement of an evicted row", () => {
    const tracker = createBetTracker();

    const firstId = tracker.beginBet(pendingRow("1", "0.1"));
    for (let i = 2; i <= 7; i += 1) {
      tracker.beginBet(pendingRow(String(Math.min(i, 6)), "0.1"));
    }

    const history = tracker.rollHistory.get();
    expect(history).toHaveLength(6);
    expect(history.some((r) => r.id === firstId)).toBe(false);

    // Settling the evicted bet must not throw or corrupt the remaining rows.
    tracker.settleBet(firstId, { outcome: "won", rolled: 1, result: "Won · Rolled 1", payout: "0.57 GAS" });
    expect(tracker.rollHistory.get()).toHaveLength(6);
    expect(tracker.rollHistory.get().every((r) => r.outcome === "pending")).toBe(true);
  });

  it("records untracked failure rows without touching the reveal state", () => {
    const tracker = createBetTracker();

    const active = tracker.beginBet(pendingRow("6", "1"));
    tracker.recordRow({
      face: "4",
      stake: "0.5 GAS",
      result: "Funds recoverable",
      payout: "0 GAS",
      txid: "",
      at: new Date().toISOString(),
    });

    // The failure row is on top, but the active bet still owns the banner.
    expect(tracker.rollHistory.get()[0]?.result).toBe("Funds recoverable");
    expect(tracker.isResolving.get()).toBe(true);

    tracker.settleBet(active, { outcome: "won", rolled: 6, result: "Won · Rolled 6", payout: "5.70 GAS" });
    expect(tracker.rollHistory.get()[1]).toMatchObject({ id: active, outcome: "won" });
    expect(tracker.lastOutcome.get()).toBe("won");
  });
});
