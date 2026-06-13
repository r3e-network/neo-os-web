import { describe, it, expect } from "vitest";
import { chainLabelOf, maxStakeOf, evmStatusToOutcome, maxPayableStakeOf } from "../../dice-game/src/dice-logic";
import { createBetTracker } from "../../dice-game/src/bet-tracker";
import { decodeReturnWord } from "../utils/evm-chain";

describe("chainLabelOf", () => {
  it("labels each supported network", () => {
    expect(chainLabelOf("neo-x-mainnet")).toBe("Neo X");
    expect(chainLabelOf("neo-x-testnet")).toBe("Neo X Testnet");
    expect(chainLabelOf("neo-n3-mainnet")).toBe("Neo N3");
    expect(chainLabelOf("neo-n3-testnet")).toBe("Neo N3 Testnet");
    expect(chainLabelOf("neo-n3")).toBe("Neo N3");
  });
});

describe("maxStakeOf", () => {
  it("caps Neo X at the contract limit (2 GAS), Neo N3 at 20", () => {
    expect(maxStakeOf("neo-x-mainnet")).toBe(2);
    expect(maxStakeOf("neo-x-testnet")).toBe(2);
    expect(maxStakeOf("neo-n3-mainnet")).toBe(20);
    expect(maxStakeOf("neo-n3")).toBe(20);
  });
});

describe("maxPayableStakeOf", () => {
  it("returns the stake the house can pay a win on (liquidity / 5.7), floored to 2 decimals", () => {
    // The mainnet strand case: 1.4479 GAS liquidity → ~0.25 GAS max stake.
    expect(maxPayableStakeOf(1.4479)).toBe(0.25);
    // 5.7 GAS liquidity pays exactly a 1 GAS win.
    expect(maxPayableStakeOf(5.7)).toBe(1);
    // 11.4 GAS → 2 GAS.
    expect(maxPayableStakeOf(11.4)).toBe(2);
  });

  it("adds the player's standing credit (the stake is consumed from credit first)", () => {
    // 1 GAS liquidity + 4.7 GAS credit covers a 1 GAS stake's 5.7 GAS exposure.
    expect(maxPayableStakeOf(1, 4.7)).toBe(1);
  });

  it("returns 0 for non-positive or non-finite liquidity (no quote, refuse all)", () => {
    expect(maxPayableStakeOf(0)).toBe(0);
    expect(maxPayableStakeOf(-5)).toBe(0);
    expect(maxPayableStakeOf(Number.NaN)).toBe(0);
  });

  it("never quotes a cap above the real payable amount (floors, not rounds)", () => {
    // 1.99 / 5.7 = 0.349… → floored to 0.34, not rounded to 0.35.
    expect(maxPayableStakeOf(1.99)).toBe(0.34);
  });
});

describe("bet-tracker seedSettled (reload hydration)", () => {
  it("seeds settled rows newest-first only when history is empty", () => {
    const tracker = createBetTracker();
    const seeded = tracker.seedSettled([
      { face: "6", stake: "", result: "Won · 🎲 6", payout: "0.57 GAS", outcome: "won", rolled: "6", at: "" },
      { face: "3", stake: "", result: "Lost", payout: "0 GAS", outcome: "lost", at: "" },
    ]);
    expect(seeded).toBe(2);
    const rows = tracker.rollHistory.get();
    expect(rows).toHaveLength(2);
    expect(rows[0].outcome).toBe("won");
    expect(rows[0].payout).toBe("0.57 GAS");
    expect(rows.every((r) => r.id.length > 0)).toBe(true);
    // Reveal state is untouched (these are historical, not the active bet).
    expect(tracker.isResolving.get()).toBe(false);
  });

  it("does NOT overwrite an existing in-memory history (live session wins)", () => {
    const tracker = createBetTracker();
    tracker.beginBet({ face: "5", stake: "1 GAS", result: "Rolling", payout: "5.7 GAS", outcome: "pending", at: "" });
    const seeded = tracker.seedSettled([
      { face: "1", stake: "", result: "Lost", payout: "0 GAS", outcome: "lost", at: "" },
    ]);
    expect(seeded).toBe(0);
    expect(tracker.rollHistory.get()).toHaveLength(1);
    expect(tracker.rollHistory.get()[0].face).toBe("5");
  });
});

describe("evmStatusToOutcome", () => {
  it("maps the Bet.status enum", () => {
    expect(evmStatusToOutcome(0)).toBe("pending"); // None
    expect(evmStatusToOutcome(1)).toBe("pending"); // Pending
    expect(evmStatusToOutcome(2)).toBe("won");
    expect(evmStatusToOutcome(3)).toBe("lost");
    expect(evmStatusToOutcome(4)).toBe("refunded");
  });
});

describe("decodeReturnWord (getBet decode)", () => {
  it("decodes the rolled (word 3) + status (word 4) from a getBet return", () => {
    // Bet tuple words: [player, stake, face, rolled, status, placedAt]
    const words = [
      "0".repeat(64), // player (ignored)
      (5n * 10n ** 16n).toString(16).padStart(64, "0"), // stake 0.05e18
      "6".padStart(64, "0"), // face 6
      "6".padStart(64, "0"), // rolled 6
      "2".padStart(64, "0"), // status Won
      "0".repeat(64), // placedAt
    ];
    const ret = "0x" + words.join("");
    expect(Number(decodeReturnWord(ret, 3))).toBe(6); // rolled
    expect(Number(decodeReturnWord(ret, 4))).toBe(2); // status = Won
    expect(evmStatusToOutcome(Number(decodeReturnWord(ret, 4)))).toBe("won");
  });
});
