import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

function read(relativePath: string): string {
  return readFileSync(path.join(appsRoot(), relativePath), "utf8");
}

describe("FogPlay Phaser production surface", () => {
  it("ships distinct, full-frame authored coin faces and an optimized pedestal", () => {
    const files = [
      "fogplay/src/static/coin_heads.png",
      "fogplay/src/static/coin_tails.png",
      "fogplay/src/static/coin_heads.webp",
      "fogplay/src/static/coin_tails.webp",
      "fogplay/src/static/holo_pedestal-512.webp",
    ];
    for (const file of files) {
      const absolute = path.join(appsRoot(), file);
      expect(existsSync(absolute), file).toBe(true);
      expect(statSync(absolute).size, file).toBeGreaterThan(20_000);
    }
    expect(
      readFileSync(path.join(appsRoot(), files[0]!)).equals(
        readFileSync(path.join(appsRoot(), files[1]!)),
      ),
    ).toBe(false);
  });

  it("routes the legacy entry directly to the Phaser wrapper", () => {
    expect(read("fogplay/src/PlayArea.tsx").trim()).toBe(
      'export { default } from "./PhaserPlayArea";',
    );
    expect(existsSync(path.join(appsRoot(), "fogplay/src/components/ThreeDCoin.tsx"))).toBe(false);
    expect(existsSync(path.join(appsRoot(), "fogplay/src/components/ThreeDCoin.scss"))).toBe(false);
  });

  it("uses the physical coin and pedestal resources for every motion phase", () => {
    const scene = read("fogplay/src/scenes/FogplayScene.ts");
    expect(scene).toContain('import coinHeadsUrl from "../static/coin_heads.webp"');
    expect(scene).toContain('import coinTailsUrl from "../static/coin_tails.webp"');
    expect(scene).toContain('import holoPedestalUrl from "../static/holo_pedestal-512.webp"');
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain('this.coinPhase = "launch"');
    expect(scene).toContain('this.coinPhase = "flip"');
    expect(scene).toContain('this.coinPhase = "land"');
    expect(scene).toContain('this.coinPhase = "result"');
    expect(scene).toContain("confirmedOutcome ?? landedSide");
    expect(scene).toContain("private emitWinBurst(side: CoinSide)");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(scene).not.toMatch(/Math\.random|Runtime\.GetRandom|ThreeDCoin/);
    expect(scene).not.toMatch(/[🎲🪙💰✨]/u);
  });

  it("keeps only responsive Phaser chrome in the app stylesheet", () => {
    const styles = read("fogplay/src/PlayArea.scss");
    expect(styles).toContain(".fogplay-stage-shell");
    expect(styles).toContain(".fogplay-stage-hud");
    expect(styles).toContain(".fogplay-ingame-drawer");
    expect(styles).toContain(".fogplay-a11y-controls:focus-within");
    expect(styles).toContain("@media (max-width: 680px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).not.toMatch(/fogplay-scene__|fogplay-controls__|coin-scene|fogplay-win-overlay/);
  });

  it("documents project asset history and reference-repository boundaries", () => {
    const provenance = read("fogplay/ASSET_PROVENANCE.md");
    expect(provenance).toContain("coin_heads.webp");
    expect(provenance).toContain("officialGasTokenPhaserUrl");
    expect(provenance).toContain("IcedSoul/minigame-everyday");
    expect(provenance).toContain("no clear root license file");
  });
});
