import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sharedRoot(): string {
  return process.cwd().endsWith("/apps/shared")
    ? process.cwd()
    : resolve(process.cwd(), "apps/shared");
}

describe("sudoku production PlayArea compatibility", () => {
  it("routes every compatibility import to the Phaser surface", () => {
    const root = sharedRoot();
    const compatibility = readFileSync(resolve(root, "../sudoku/src/PlayArea.tsx"), "utf8").trim();
    const wrapper = readFileSync(resolve(root, "../sudoku/src/PhaserPlayArea.tsx"), "utf8");

    expect(compatibility).toBe('export { default } from "./PhaserPlayArea";');
    expect(wrapper).toContain("<PhaserGameComponent");
    expect(wrapper).toContain("sudoku-a11y-controls");
    expect(wrapper).not.toMatch(/<form\b|<select\b|type=["']text["']/i);
  });

  it("keeps candidates, conflict recovery, pause, and real art inside the Phaser scene", () => {
    const root = sharedRoot();
    const scene = readFileSync(resolve(root, "../sudoku/src/scenes/SudokuScene.ts"), "utf8");
    const main = readFileSync(resolve(root, "../sudoku/src/main.tsx"), "utf8");
    const guest = readFileSync(resolve(root, "../sudoku/src/logic/guest-engine.ts"), "utf8");

    expect(scene).toContain("./art/cell-conflict.webp");
    expect(scene).toContain("./art/note-token.webp");
    expect(scene).not.toContain("./art/reward-trophy.webp");
    expect(scene).toContain("toggleNote(");
    expect(scene).toContain("applyUndo(");
    expect(scene).toContain("setLocalDigit(");
    expect(scene).toContain("eraseLocalCell(");
    expect(scene).toContain("applyConfirmedUndoRequest");
    expect(scene).toContain("applyBoardRecoveryRequest");
    expect(scene).toContain("buildPausedOverlay");
    expect(scene).toContain("bindKeyboardControls");
    expect(scene).not.toMatch(/emoji|placeholder/i);
    expect(main).toContain("rewardGame.replayOps(started, ops)");
    expect(main).toContain("replayBoardOps(sealedClues, ops)");
    expect(main).toContain(
      'const ENGINE_HASH = "679aea4220667dec0e921eb364392f7983dae440a3aa9e43a215a4d054ab58c8"',
    );
    expect(main).toContain("undoNonce.set(undoNonce.get() + 1)");
    expect(main).toContain("boardRecoveryNonce.set(boardRecoveryNonce.get() + 1)");
    expect(main).toContain("storage: app.storage.local");
    expect(guest).toContain("webCrypto.getRandomValues(bytes)");
    expect(guest).toContain('const GUEST_SESSION_KEY = "guest-session:v1"');
    expect(guest).toContain('obs.lastStatus.set(t("guestRestored"))');
    expect(guest).not.toContain("Math.random");
  });

  it("ships the complete original WebP gameplay set with provenance", () => {
    const appRoot = resolve(sharedRoot(), "../sudoku");
    const assets = [
      "paper-grid.webp",
      "art/cell-given.webp",
      "art/cell-placed.webp",
      "art/cell-selected.webp",
      "art/cell-conflict.webp",
      "art/note-token.webp",
      "art/pencil.webp",
      "art/seal-easy.webp",
      "art/seal-medium.webp",
      "art/seal-hard.webp",
      "art/sealed-envelope.webp",
      "art/solved-badge.webp",
    ];

    for (const asset of assets) {
      const path = resolve(appRoot, "public", asset);
      expect(existsSync(path), asset).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.length, asset).toBeGreaterThan(2_000);
      expect(bytes.subarray(0, 4).toString("ascii"), asset).toBe("RIFF");
    }

    const provenance = readFileSync(
      resolve(appRoot, "public/art/ATTRIBUTION.md"),
      "utf8",
    );
    expect(provenance).toContain("OpenAI image generation");
    expect(provenance).toContain("not copied from a third-party game");
  });

  it("publishes local play only while retaining read-only contract provenance", () => {
    const appRoot = resolve(sharedRoot(), "../sudoku");
    const publicManifest = JSON.parse(
      readFileSync(resolve(appRoot, "neo-manifest.json"), "utf8"),
    ) as {
      contracts?: Record<string, string>;
      permissions?: string[];
      platform?: { transactions?: boolean };
      technologies?: Record<string, { enabled?: boolean }>;
    };
    const sourceManifest = readFileSync(resolve(appRoot, "src/manifest.ts"), "utf8");

    // Migrated to platform-game: contracts removed, engine/moduleId added
    expect(publicManifest.engine).toBe("0xc75b181b4561462903bb27d8d9e0b32b637bec12");
    expect(publicManifest.moduleId).toBe("platform-game");
    expect(publicManifest.mode).toBe("shared");
    expect(publicManifest.permissions).toEqual([]);
    expect(publicManifest.platform?.transactions).toBe(false);
    expect(publicManifest.technologies?.oracle?.enabled).toBe(false);
    expect(publicManifest.technologies?.tee?.enabled).toBe(false);
    expect(sourceManifest).toContain("modes: { guest: true, gamefi: false }");
    expect(sourceManifest).toContain("payments: false");
    expect(sourceManifest).toContain("oracle: false");
  });
});
