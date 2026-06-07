import { describe, it, expect } from "vitest";
import { chainLabelOf, maxStakeOf, evmStatusToOutcome } from "../../dice-game/src/dice-logic";
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
