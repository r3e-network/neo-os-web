import { describe, expect, it } from "vitest";

import {
  BOARD_SIZE,
  DIFFICULTY_RULES,
  GAMEFI_NEW_ENTRIES_ENABLED,
  GUEST_DIFFICULTY_RULES,
  MAX_UNDOS,
  TILE_BG,
  TILE_COLOR,
  TILE_FONT_SIZE,
  TILE_VALUES,
  UNDO_PENALTY_PCT,
  canExpireAfterGrace,
  emptyBoard,
  formatClock,
  gasDisplay,
  guestRuleOf,
  isPowerOf2,
  payoutFixed8,
  rewardPctAfterUndos,
  ruleOf,
  statusOf,
} from "../../merge-kingdom/src/logic/game-rules";
import {
  applyMergeMove,
  boardFromSessionView,
  hasMergePotential,
  isValidBoard,
} from "../../merge-kingdom/src/logic/merge-engine";

/**
 * Merge Kingdom engine tests.
 *
 * The engine exports game rules (difficulty tiers, undo penalty, payout math),
 * tile display constants, board utilities, and display helpers.
 */

describe("merge-kingdom difficulty rules", () => {
  it("keeps new paid entries fail-closed until the live route is verified", () => {
    expect(GAMEFI_NEW_ENTRIES_ENABLED).toBe(false);
  });
  it("defines three difficulty tiers with correct targetTile and entry/reward", () => {
    expect(DIFFICULTY_RULES).toHaveLength(3);

    const [easy, medium, hard] = DIFFICULTY_RULES;

    expect(easy.difficulty).toBe(0);
    expect(easy.targetTile).toBe(64);
    expect(easy.entry).toBe(2_000_000);
    expect(easy.reward).toBe(10_000_000);
    expect(easy.limitMs).toBe(180_000);
    expect(easy.minSolveMs).toBe(30_000);

    expect(medium.difficulty).toBe(1);
    expect(medium.targetTile).toBe(256);
    expect(medium.entry).toBe(10_000_000);
    expect(medium.reward).toBe(50_000_000);
    expect(medium.limitMs).toBe(300_000);
    expect(medium.minSolveMs).toBe(60_000);

    expect(hard.difficulty).toBe(2);
    expect(hard.targetTile).toBe(1024);
    expect(hard.entry).toBe(20_000_000);
    expect(hard.reward).toBe(100_000_000);
    expect(hard.limitMs).toBe(600_000);
    expect(hard.minSolveMs).toBe(120_000);
  });

  it("keeps guest routes short and achievable without changing deployed contract rules", () => {
    expect(GUEST_DIFFICULTY_RULES.map((rule) => rule.targetTile)).toEqual([32, 64, 128]);
    expect(GUEST_DIFFICULTY_RULES.map((rule) => rule.limitMs)).toEqual([45_000, 60_000, 90_000]);
    expect(GUEST_DIFFICULTY_RULES.every((rule) => rule.entry === 0 && rule.reward === 0)).toBe(true);
    expect(guestRuleOf(2).targetTile).toBe(128);
    expect(DIFFICULTY_RULES.map((rule) => rule.targetTile)).toEqual([64, 256, 1024]);
  });

  it("ruleOf returns the correct rule for each difficulty", () => {
    expect(ruleOf(0).targetTile).toBe(64);
    expect(ruleOf(1).targetTile).toBe(256);
    expect(ruleOf(2).targetTile).toBe(1024);
  });

  it("ruleOf throws for an unknown difficulty", () => {
    expect(() => ruleOf(-1)).toThrow("unknown difficulty -1");
    expect(() => ruleOf(3)).toThrow("unknown difficulty 3");
  });
});

describe("merge-kingdom undo penalty and payout", () => {
  it("rewardPctAfterUndos returns 100% minus 30% per undo", () => {
    expect(rewardPctAfterUndos(0)).toBe(100);
    expect(rewardPctAfterUndos(1)).toBe(70);
    expect(rewardPctAfterUndos(2)).toBe(40);
    expect(rewardPctAfterUndos(3)).toBe(10);
  });

  it("payoutFixed8 returns full reward with no undos", () => {
    expect(payoutFixed8(10_000_000, 0)).toBe(10_000_000);
    expect(payoutFixed8(50_000_000, 0)).toBe(50_000_000);
    expect(payoutFixed8(100_000_000, 0)).toBe(100_000_000);
  });

  it("payoutFixed8 applies undo penalty correctly", () => {
    // 1 undo → 70%
    expect(payoutFixed8(10_000_000, 1)).toBe(7_000_000);
    // 2 undos → 40%
    expect(payoutFixed8(10_000_000, 2)).toBe(4_000_000);
    // 3 undos → 10%
    expect(payoutFixed8(10_000_000, 3)).toBe(1_000_000);
  });

  it("payoutFixed8 floors the result", () => {
    // 70% of 7 = 4.9 → floor to 4
    expect(payoutFixed8(7, 1)).toBe(4);
  });

  it("MAX_UNDOS and UNDO_PENALTY_PCT are as expected", () => {
    expect(MAX_UNDOS).toBe(3);
    expect(UNDO_PENALTY_PCT).toBe(30);
  });
});

describe("merge-kingdom display helpers", () => {
  it("unlocks contract expiry only after deadline plus grace", () => {
    const deadline = 1_000_000;
    expect(canExpireAfterGrace(deadline, deadline + 600_000)).toBe(false);
    expect(canExpireAfterGrace(deadline, deadline + 600_001)).toBe(true);
    expect(canExpireAfterGrace(0, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
  it("gasDisplay formats Fixed8 values with two decimal places", () => {
    expect(gasDisplay(0)).toBe("0.00");
    expect(gasDisplay(1)).toBe("0.00");
    expect(gasDisplay(100_000_000)).toBe("1.00");
    expect(gasDisplay(10_000_000)).toBe("0.10");
    expect(gasDisplay(50_000_000)).toBe("0.50");
    expect(gasDisplay(2_000_000)).toBe("0.02");
  });

  it("formatClock uses ceil-based conversion and M:SS format", () => {
    // 0 ms → "0:00"
    expect(formatClock(0)).toBe("0:00");
    // negative → "0:00"
    expect(formatClock(-100)).toBe("0:00");
    // 61_999 ms → ceil(61.999) = 62 → 1:02
    expect(formatClock(61_999)).toBe("1:02");
    // 60_000 ms → ceil(60) = 60 → 1:00
    expect(formatClock(60_000)).toBe("1:00");
    // 180_000 ms → 3:00
    expect(formatClock(180_000)).toBe("3:00");
    // 1_000 ms → 0:01
    expect(formatClock(1_000)).toBe("0:01");
    // 600_000 ms → 10:00
    expect(formatClock(600_000)).toBe("10:00");
  });

  it("statusOf maps numeric status to string", () => {
    expect(statusOf(0)).toBe("awaiting-bind");
    expect(statusOf(1)).toBe("playing");
    expect(statusOf(2)).toBe("solved");
    expect(statusOf(3)).toBe("expired");
    expect(statusOf(4)).toBe("refunded");
    expect(statusOf(99)).toBe("unknown");
  });
});

describe("merge-kingdom tile constants", () => {
  it("TILE_VALUES contains the complete building ladder through the crown palace", () => {
    expect(TILE_VALUES).toEqual([0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]);
  });

  it("TILE_BG has entries for all tile values", () => {
    for (const v of TILE_VALUES) {
      expect(TILE_BG).toHaveProperty(String(v));
    }
  });

  it("TILE_COLOR has entries for all tile values", () => {
    for (const v of TILE_VALUES) {
      expect(TILE_COLOR).toHaveProperty(String(v));
    }
  });

  it("TILE_FONT_SIZE has entries for all tile values", () => {
    for (const v of TILE_VALUES) {
      expect(TILE_FONT_SIZE).toHaveProperty(String(v));
    }
  });
});

describe("merge-kingdom board utilities", () => {
  it("BOARD_SIZE is 4", () => {
    expect(BOARD_SIZE).toBe(4);
  });

  it("emptyBoard returns a 4x4 array of zeros", () => {
    const board = emptyBoard();
    expect(board).toHaveLength(4);
    for (const row of board) {
      expect(row).toHaveLength(4);
      for (const cell of row) {
        expect(cell).toBe(0);
      }
    }
  });

  it("emptyBoard returns a new array each call (no shared mutation)", () => {
    const a = emptyBoard();
    const b = emptyBoard();
    a[0][0] = 2;
    expect(b[0][0]).toBe(0);
  });

  it("isPowerOf2 returns true for powers of two", () => {
    expect(isPowerOf2(2)).toBe(true);
    expect(isPowerOf2(4)).toBe(true);
    expect(isPowerOf2(16)).toBe(true);
    expect(isPowerOf2(1024)).toBe(true);
    expect(isPowerOf2(2048)).toBe(true);
  });

  it("isPowerOf2 returns false for non-powers of two", () => {
    expect(isPowerOf2(0)).toBe(false);
    expect(isPowerOf2(1)).toBe(false);
    expect(isPowerOf2(3)).toBe(false);
    expect(isPowerOf2(6)).toBe(false);
    expect(isPowerOf2(10)).toBe(false);
    expect(isPowerOf2(-4)).toBe(false);
  });
});

describe("merge-kingdom move engine", () => {
  it("moves a building without spawning and merges matching resources with one spawn", () => {
    const board = [
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const moved = applyMergeMove(board, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(moved?.kind).toBe("reposition");
    expect(moved?.spawn).toBeNull();

    const merged = applyMergeMove(
      moved!.board,
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      (empty) => ({ cell: empty[0]!, value: 2 }),
    );
    expect(merged?.kind).toBe("merge");
    expect(merged?.mergedValue).toBe(4);
    expect(merged?.spawn?.value).toBe(2);
    expect(merged?.highestTile).toBe(4);
  });

  it("accepts nested, flat, and JSON session boards but rejects malformed TEE state", () => {
    const nested = [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(boardFromSessionView({ board: nested })).toEqual(nested);
    expect(boardFromSessionView({ board: nested.flat() })).toEqual(nested);
    expect(boardFromSessionView({ board: JSON.stringify(nested) })).toEqual(nested);
    expect(isValidBoard(nested)).toBe(true);
    expect(boardFromSessionView({ board: [[3, 0, 0, 0], ...nested.slice(1)] })).toBeNull();
    expect(boardFromSessionView({ board: [[-2, 0, 0, 0], ...nested.slice(1)] })).toBeNull();
    expect(boardFromSessionView({ board: [["2", 0, 0, 0], ...nested.slice(1)] })).toBeNull();
  });

  it("marks a unique-building position as over while preserving duplicate merge potential", () => {
    expect(hasMergePotential([
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])).toBe(false);
    expect(hasMergePotential([
      [2, 4, 8, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])).toBe(true);
  });
});
