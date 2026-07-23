import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSheepSessionView } from "../../sheep-solitaire/src/logic/session-view";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const main = fs.readFileSync(path.join(repoRoot, "apps/sheep-solitaire/src/main.tsx"), "utf8");

describe("sheep-solitaire shared kernel session", () => {
  it("uses the reviewed generic engine through app.game.reward", () => {
    expect(main).toContain("9faf4efb68f60a44783de900254c62da8ca3b0b724dcebec57b4707f14a364ef");
    expect(main).toContain("app.game.reward<SheepSessionOp>");
    expect(main).toContain("rewardGame.openSession");
    expect(main).toContain("rewardGame.recordOp");
    expect(main).toContain("rewardGame.replayOps");
    expect(main).toContain("rewardGame.finalize");
    expect(main).toContain("rewardGame.recoverActive");
  });

  it("contains no pre-kernel bind or signature settlement path", () => {
    expect(main).not.toContain("bindPuzzle");
    expect(main).not.toContain("settleVerified");
    expect(main).not.toContain("bindSignature");
    expect(main).not.toContain("settleSignature");
    expect(main).not.toContain("/api/morpheus/game/");
  });

  it("parses authoritative board, tray, flags, and tool counts", () => {
    const view = parseSheepSessionView({
      cards: [{ id: 0, symbol: 2, layer: 0, col: 1, row: 2, exposed: true, picked: false }],
      slots: [{ id: 8, symbol: 3, layer: 1, col: 2, row: 1, exposed: false, picked: true }],
      matched: true,
      won: false,
      gameOver: false,
      shuffleLeft: 0,
      remove3Left: 1,
    }, { requireResultFlags: true });

    expect(view.cards[0]).toMatchObject({ id: 0, col: 1, row: 2 });
    expect(view.slots[0]).toMatchObject({ id: 8, picked: true });
    expect(view.matched).toBe(true);
    expect(view.shuffleLeft).toBe(0);
  });

  it("rejects malformed or incomplete authoritative views", () => {
    expect(() => parseSheepSessionView({
      cards: [
        { id: 1, symbol: 0, layer: 0, exposed: true, picked: false },
        { id: 1, symbol: 15, layer: 3, exposed: true, picked: false },
      ],
      slots: [],
      shuffleLeft: 1,
      remove3Left: 1,
    })).toThrow(/malformed board card/);

    expect(() => parseSheepSessionView({
      cards: [],
      slots: [],
      shuffleLeft: 1,
      remove3Left: 1,
    }, { requireResultFlags: true })).toThrow(/result flags/);

    expect(() => parseSheepSessionView({
      cards: [],
      shuffleLeft: 1,
      remove3Left: 1,
    })).toThrow(/tray cards/);
  });
});
