import { describe, it, expect } from "vitest";
import {
  chainLabelOf,
  maxStakeOf,
  evmStatusToOutcome,
  maxPayableStakeOf,
} from "../../dice-game/src/dice-logic";
import { createBetTracker } from "../../dice-game/src/bet-tracker";
import {
  fixed8ToStakeDisplay,
  parseStakeFixed8,
  sanitizeAmount,
} from "../../dice-game/src/main";
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
  it("returns the stake the house can cover a win on (bankroll / 4.7), floored to 2 decimals", () => {
    // The contract guard is bankroll >= stake * 47/10: a win returns the stake
    // and the house tops up the extra (5.7 - 1 = 4.7), so only the bankroll
    // covers a win. 4.7 GAS bankroll pays exactly a 1 GAS stake's win.
    expect(maxPayableStakeOf(4.7)).toBe(1);
    // 9.4 GAS → 2 GAS.
    expect(maxPayableStakeOf(9.4)).toBe(2);
    // The mainnet strand case: 1.4479 GAS bankroll → 0.30 GAS max stake.
    expect(maxPayableStakeOf(1.4479)).toBe(0.3);
  });

  it("derives the cap from the bankroll alone (a custom cover multiple is honoured)", () => {
    // The stake is held in the player's CREDIT (not the bankroll) and consumed
    // on the roll, so only the bankroll covers a win — there is no credit term.
    // The second argument is the cover multiple (defaults to 4.7), not credit.
    expect(maxPayableStakeOf(4.7)).toBe(1);
    expect(maxPayableStakeOf(10, 5)).toBe(2);
  });

  it("returns 0 for non-positive or non-finite liquidity (no quote, refuse all)", () => {
    expect(maxPayableStakeOf(0)).toBe(0);
    expect(maxPayableStakeOf(-5)).toBe(0);
    expect(maxPayableStakeOf(Number.NaN)).toBe(0);
  });

  it("never quotes a cap above the real payable amount (floors, not rounds)", () => {
    // 1.99 / 4.7 = 0.4234… → floored to 0.42, not rounded to 0.43.
    expect(maxPayableStakeOf(1.99)).toBe(0.42);
  });
});

describe("dice stake amount parsing", () => {
  it("rejects malformed or over-precision transaction amounts", () => {
    expect(parseStakeFixed8("1abc")).toBeNull();
    expect(parseStakeFixed8("1.000000001")).toBeNull();
    expect(parseStakeFixed8("0.04999999")).toBeNull();
    expect(parseStakeFixed8("20.00000001", 20)).toBeNull();
  });

  it("keeps valid Fixed8 stake precision instead of rounding to cents", () => {
    expect(parseStakeFixed8("0.05000001")).toBe("5000001");
    expect(fixed8ToStakeDisplay("5000001")).toBe("0.05000001");
    expect(sanitizeAmount("0.05000001")).toBe("0.05000001");
  });
});

describe("bet-tracker seedSettled (reload hydration)", () => {
  it("seeds settled rows newest-first only when history is empty", () => {
    const tracker = createBetTracker();
    const seeded = tracker.seedSettled([
      {
        face: "6",
        stake: "",
        result: "Won · 🎲 6",
        payout: "0.57 GAS",
        outcome: "won",
        rolled: "6",
        at: "",
      },
      {
        face: "3",
        stake: "",
        result: "Lost",
        payout: "0 GAS",
        outcome: "lost",
        at: "",
      },
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
    tracker.beginBet({
      face: "5",
      stake: "1 GAS",
      result: "Rolling",
      payout: "5.7 GAS",
      outcome: "pending",
      at: "",
    });
    const seeded = tracker.seedSettled([
      {
        face: "1",
        stake: "",
        result: "Lost",
        payout: "0 GAS",
        outcome: "lost",
        at: "",
      },
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
