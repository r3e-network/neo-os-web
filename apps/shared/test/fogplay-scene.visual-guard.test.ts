import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CoinMotionGeneration,
  FOGPLAY_COIN_PHASES,
  landedSide,
} from "../../fogplay/src/logic/coin-motion";

const sceneSource = readFileSync(
  resolve(process.cwd(), "../fogplay/src/scenes/FogplayScene.ts"),
  "utf8",
);

describe("FogplayScene visual polish guard", () => {
  it("uses the authored coin faces and pedestal while keeping GAS as a separate currency marker", () => {
    expect(sceneSource).toContain("officialGasTokenPhaserUrl");
    expect(sceneSource).toContain("this.load.image(ASSET_GAS, officialGasTokenPhaserUrl)");
    expect(sceneSource).toContain('import coinHeadsUrl from "../static/coin_heads.webp"');
    expect(sceneSource).toContain('import coinTailsUrl from "../static/coin_tails.webp"');
    expect(sceneSource).toContain('import holoPedestalUrl from "../static/holo_pedestal-512.webp"');
    expect(sceneSource).toContain("this.load.image(ASSET_COIN_HEADS, coinHeadsUrl)");
    expect(sceneSource).toContain("this.load.image(ASSET_COIN_TAILS, coinTailsUrl)");
    expect(sceneSource).toContain("this.load.image(ASSET_HOLO_PEDESTAL, holoPedestalUrl)");
    expect(sceneSource).toContain("this.coinFaceImage.setTexture");
    expect(sceneSource).toContain("side === \"heads\" ? ASSET_COIN_HEADS : ASSET_COIN_TAILS");
    expect(sceneSource).toContain("Official GAS artwork is deliberately separate from the physical coin");
    expect(sceneSource).not.toContain("private coinBase");
    expect(sceneSource).not.toContain("private coinFace!: Phaser.GameObjects.Text");
    expect(sceneSource).toContain("FOGPLAY FLIP TABLE");
    expect(sceneSource).toContain("C.page");
    expect(sceneSource).toContain("C.felt");
    expect(sceneSource).toContain("C.table");

    expect(sceneSource).not.toContain("0x0d1117");
    expect(sceneSource).not.toContain("Subtle grid");
    expect(sceneSource).not.toContain("dark atmospheric arena");
  });

  it("keeps the Phaser layout responsive to framework-owned mobile canvas sizing", () => {
    expect(sceneSource).toContain("protected onResize");
    expect(sceneSource).toContain("rebuildScene");
    expect(sceneSource).toContain("this.children.removeAll(true)");
    expect(sceneSource).toContain("this.scale.width");
    expect(sceneSource).toContain("this.scale.height");
  });

  it("maps win/loss outcomes to the correct authored landed face", () => {
    expect(landedSide("heads", "won")).toBe("heads");
    expect(landedSide("heads", "lost")).toBe("tails");
    expect(landedSide("tails", "won")).toBe("tails");
    expect(landedSide("tails", "lost")).toBe("heads");
    expect(sceneSource).toContain("confirmedOutcome ?? landedSide");
    expect(sceneSource).toContain('this.str("displayOutcome", "")');
    expect(sceneSource).toContain("this.setCoinSide(side)");
  });

  it("keeps launch, flip, land, and result as ordered cancellable phases", () => {
    expect(FOGPLAY_COIN_PHASES).toEqual(["launch", "flip", "land", "result"]);
    expect(sceneSource).toContain('this.coinPhase = "launch"');
    expect(sceneSource).toContain('this.coinPhase = "flip"');
    expect(sceneSource).toContain('this.coinPhase = "land"');
    expect(sceneSource).toContain('this.coinPhase = "result"');
    expect(sceneSource).toContain("this.motionGeneration.isCurrent(generation)");
    expect(sceneSource).toContain("this.cancelCoinTweens()");
    expect(sceneSource).toContain("Phaser.Scenes.Events.SHUTDOWN, this.stopSceneMotion");
    expect(sceneSource).toContain("Phaser.Scenes.Events.DESTROY, this.stopSceneMotion");
  });

  it("invalidates callbacks from earlier animation generations", () => {
    const motion = new CoinMotionGeneration();
    const launch = motion.begin();
    expect(motion.isCurrent(launch)).toBe(true);
    const landing = motion.begin();
    expect(motion.isCurrent(launch)).toBe(false);
    expect(motion.isCurrent(landing)).toBe(true);
    motion.cancel();
    expect(motion.isCurrent(landing)).toBe(false);
  });

  it("settles directly on a readable physical face for reduced motion", () => {
    expect(sceneSource).toContain("if (this.reducedMotion)");
    expect(sceneSource).toContain("this.finishLanding(generation, side, result)");
    expect(sceneSource).toContain("this.setCoinSide(side)");
    expect(sceneSource).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(sceneSource).toContain("this.shuffleTimer?.remove(false)");
  });

  it("uses real coin or official GAS textures for the win burst", () => {
    expect(sceneSource).toContain("private emitWinBurst(side: CoinSide)");
    expect(sceneSource).toContain("ASSET_COIN_HEADS");
    expect(sceneSource).toContain("ASSET_COIN_TAILS");
    expect(sceneSource).toContain(": ASSET_GAS");
  });
});
