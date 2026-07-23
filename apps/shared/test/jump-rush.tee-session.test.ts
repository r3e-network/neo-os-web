import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const main = fs.readFileSync(path.join(repoRoot, "apps/jump-rush/src/main.tsx"), "utf8");
const rules = fs.readFileSync(path.join(repoRoot, "apps/jump-rush/src/logic/game-rules.ts"), "utf8");

describe("jump-rush shared kernel session", () => {
  it("uses the reviewed generic engine through app.game.reward", () => {
    expect(main).toContain("a61fca9f6cfc3a88cde4230d6817d7fc84491f42b03815453775585a3d9c820f");
    expect(main).toContain("app.game.reward<TeeOp>");
    expect(main).toContain("rewardGame.openSession");
    expect(main).toContain("rewardGame.recordOp");
    expect(main).toContain("rewardGame.replayOps");
    expect(main).toContain("rewardGame.finalize");
    expect(main).toContain("rewardGame.recoverActive");
    expect(main).toContain("started.currentView");
    expect(main).toContain("started.opCount");
  });

  it("contains no pre-kernel bind or signature settlement path", () => {
    expect(main).not.toContain("bindPuzzle");
    expect(main).not.toContain("settleVerified");
    expect(main).not.toContain("bindSignature");
    expect(main).not.toContain("settleSignature");
    expect(main).not.toContain("/api/morpheus/game/");
  });

  it("matches the reviewed wrapper timing and target profile", () => {
    expect(rules).toContain("limitMs: 180_000");
    expect(rules).toContain("limitMs: 300_000");
    expect(rules).toContain("limitMs: 480_000");
    expect(rules).toContain("targetJumps: 15");
    expect(rules).toContain("targetJumps: 25");
    expect(rules).toContain("targetJumps: 35");
    expect(rules).toContain("GAMEFI_MAX_UNDOS = 0");
  });
});
