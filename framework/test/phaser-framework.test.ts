import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatBridgeError,
  GameBridge,
  type GameBridgeError,
} from "@framework/phaser";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const phaserSceneApps = [
  ["aim-master", "AimMasterScene"],
  ["burn-league", "BurnLeagueScene"],
  ["color-clash", "ColorClashScene"],
  ["dice-game", "DiceScene"],
  ["flappy-dash", "FlappyScene"],
  ["fogplay", "FogplayScene"],
  ["game-2048", "Game2048Scene"],
  ["gas-lucky-pool", "GasLuckyPoolScene"],
  ["jump-rush", "JumpRushScene"],
  ["last-survivor", "LastSurvivorScene"],
  ["merge-kingdom", "MergeKingdomScene"],
  ["on-chain-tarot", "TarotScene"],
  ["pet-potion", "PetPotionScene"],
  ["red-envelope", "RedEnvelopeScene"],
  ["sheep-solitaire", "SheepScene"],
  ["snake-bounty", "SnakeScene"],
  ["sudoku", "SudokuScene"],
] as const;

describe("root Phaser framework", () => {
  it("surfaces rejected game dispatches as bridge errors", async () => {
    const bridge = new GameBridge();
    const errors: GameBridgeError[] = [];

    bridge.setDispatch(async () => {
      throw new Error("wallet rejected");
    });
    bridge.on("error", (error) => errors.push(error));

    bridge.dispatch("placeBet", { amount: "1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      source: "dispatch",
      action: "placeBet",
      message: "wallet rejected",
    });
    expect(errors[0]?.args).toEqual([{ amount: "1" }]);
  });

  it("surfaces synchronous dispatch failures without throwing into Phaser", () => {
    const bridge = new GameBridge();
    const errors: GameBridgeError[] = [];

    bridge.setDispatch(() => {
      throw "bridge offline";
    });
    bridge.on("error", (error) => errors.push(error));

    expect(() => bridge.dispatch("draw")).not.toThrow();
    expect(errors[0]).toMatchObject({
      source: "dispatch",
      action: "draw",
      message: "bridge offline",
    });
  });

  it("normalizes unknown errors into a product-safe fallback", () => {
    expect(formatBridgeError({})).toBe("The game action could not be completed.");
  });

  it("keeps Phaser game scenes on the root framework public API", () => {
    const privatePhaserImport =
      /@framework\/phaser\/(?:BaseScene|types|GameBridge|PhaserGameComponent)/;

    for (const [app, scene] of phaserSceneApps) {
      const source = readFileSync(
        resolve(repoRoot, `apps/${app}/src/scenes/${scene}.ts`),
        "utf8",
      );

      expect(source, `${app}: scene should import the public Phaser SDK`).toContain(
        `from "@framework/phaser"`,
      );
      expect(source, `${app}: scene should not import private framework files`).not.toMatch(
        privatePhaserImport,
      );
      expect(source, `${app}: scene should not depend on the old shared Phaser module`).not.toContain(
        "@shared/phaser",
      );
    }
  });

  it("keeps Phaser scene text free of emoji placeholders", () => {
    const emojiPlaceholderPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    for (const [app, scene] of phaserSceneApps) {
      const source = readFileSync(
        resolve(repoRoot, `apps/${app}/src/scenes/${scene}.ts`),
        "utf8",
      );

      expect(
        source,
        `${app}: draw real game assets instead of emoji/text placeholders`,
      ).not.toMatch(emojiPlaceholderPattern);
    }
  });

  it("uses real game art assets for migrated Phaser scenes", () => {
    const migratedAssetScenes = [
      {
        app: "aim-master",
        scene: "AimMasterScene",
        assets: [
          "./art/range-backdrop.webp",
          "./art/target-board.webp",
          "./art/reticle.webp",
          "./art/badge-easy.webp",
          "./art/badge-medium.webp",
          "./art/badge-hard.webp",
        ],
        usage: ["AIM_ASSETS", "DIFFICULTY_BADGES", "dealingReticle", "buildTargetBoard"],
      },
      {
        app: "burn-league",
        scene: "BurnLeagueScene",
        assets: [
          "./burn-league-arena.webp",
          "./logo.webp",
          "gasIconUrl",
        ],
        usage: ["BURN_ASSETS", "gasTokens", "brazierImage", "dispatch(\"burn\""],
      },
      {
        app: "gas-lucky-pool",
        scene: "GasLuckyPoolScene",
        assets: [
          "./gas-vault-stage.webp",
          "@shared/assets/tokens/gas-icon.svg?url",
        ],
        usage: [
          "GAS_POOL_ASSETS",
          "REWARD_PLANS",
          "dispatch(\"createPool\"",
          "dispatch(\"claimPool\"",
          "dispatch(\"checkClaimStatus\"",
        ],
      },
      {
        app: "color-clash",
        scene: "ColorClashScene",
        assets: ["./art/memory-console.webp", "./art/arcade-table.webp"],
        usage: ["ASSET_MEMORY_CONSOLE", "ASSET_ARCADE_TABLE"],
      },
      {
        app: "snake-bounty",
        scene: "SnakeScene",
        assets: [
          "./art/snake-head.webp",
          "./art/snake-body-straight.webp",
          "./art/snake-tail.webp",
          "./art/food-bounty.webp",
          "./art/badge-easy.webp",
          "./art/badge-medium.webp",
          "./art/badge-hard.webp",
        ],
        usage: ["SNAKE_ASSETS.head", "SNAKE_ASSETS.food", "SNAKE_ASSETS.badges"],
      },
      {
        app: "dice-game",
        scene: "DiceScene",
        assets: [
          "./art/die-white-1.webp",
          "./art/die-white-2.webp",
          "./art/die-white-3.webp",
          "./art/die-white-4.webp",
          "./art/die-white-5.webp",
          "./art/die-white-6.webp",
          "./art/chip-green.webp",
          "./art/chip-blue.webp",
          "./art/chip-red.webp",
          "./art/chip-black.webp",
          "./art/hero-die.webp",
          "@shared/assets/tokens/gas-icon.svg?url",
        ],
        usage: ["DIE_FACE_ASSETS", "CHIP_PRESETS", "setDieFace", "ASSET_GAS_ICON"],
      },
      {
        app: "flappy-dash",
        scene: "FlappyScene",
        assets: [
          "./flappy-sprites/background-day.webp",
          "./flappy-sprites/base.webp",
          "./flappy-sprites/bird-up.webp",
          "./flappy-sprites/bird-mid.webp",
          "./flappy-sprites/bird-down.webp",
          "./flappy-sprites/pipe-top.webp",
          "./flappy-sprites/pipe-bottom.webp",
        ],
        usage: ["FLAPPY_ASSETS", "birdSprite", "pipeSprites", "drawPipes"],
      },
      {
        app: "jump-rush",
        scene: "JumpRushScene",
        assets: [
          "./art/bunny-hurt.webp",
          "./art/bunny-jump.webp",
          "./art/bunny-ready.webp",
          "./art/bunny-stand.webp",
          "./art/carrot-gold.webp",
          "./art/cloud.webp",
          "./art/platform-grass.webp",
          "./art/platform-grass-small.webp",
        ],
        usage: ["JR_ASSETS", "bunnySprite", "setBunnyPose", "buildPlatformTile"],
      },
    ] as const;

    for (const { app, scene, assets, usage } of migratedAssetScenes) {
      const source = readFileSync(
        resolve(repoRoot, `apps/${app}/src/scenes/${scene}.ts`),
        "utf8",
      );

      for (const asset of assets) {
        expect(source, `${app}: scene should preload ${asset}`).toContain(asset);
      }
      for (const token of usage) {
        expect(source, `${app}: scene should place loaded art through ${token}`).toContain(token);
      }
      expect(source, `${app}: scene should not draw dice pips by hand`).not.toContain(
        "DOT_POSITIONS",
      );
      expect(source, `${app}: scene should not use text-only coin placeholders`).not.toContain(
        'coinMark',
      );
      if (app === "flappy-dash") {
        expect(source, `${app}: bird should be a loaded sprite, not a Graphics drawing`).not.toContain(
          "birdGraphics",
        );
        expect(source, `${app}: pipes should be loaded sprites, not Graphics rectangles`).not.toContain(
          "pipeGraphics",
        );
      }
      if (app === "jump-rush") {
        expect(source, `${app}: bunny should be a loaded sprite, not a Graphics drawing`).not.toContain(
          "bunnyBody",
        );
        expect(source, `${app}: bunny poses should switch texture assets instead of hand drawing`).not.toContain(
          "drawBunny",
        );
      }
      if (app === "aim-master") {
        expect(source, `${app}: range background should use loaded art, not manual sky constants`).not.toContain(
          "SKY_TOP_HEX",
        );
        expect(source, `${app}: target board should use loaded art, not the old hand-drawn target note`).not.toContain(
          "Concentric-ring target board",
        );
      }
      if (app === "burn-league") {
        expect(source, `${app}: Phaser burn action should match the registered framework action`).not.toContain(
          "burnGas",
        );
        expect(source, `${app}: brazier should use loaded art, not the old hand-drawn body helper`).not.toContain(
          "drawBrazierBody",
        );
      }
      if (app === "gas-lucky-pool") {
        expect(source, `${app}: Phaser claim action should match the registered framework action`).not.toContain(
          "claimReward",
        );
        expect(source, `${app}: Phaser create action should send the validated pool form`).not.toContain(
          "selectFundAmount",
        );
        expect(source, `${app}: claim flow should not present a fake text-entry placeholder`).not.toContain(
          "paste claim key here",
        );
        expect(source, `${app}: vault art should be loaded from assets, not hand-drawn as primitives`).not.toContain(
          "drawVaultDoor",
        );
      }
    }
  });

  it("centralizes in-canvas game button motion in the root framework", () => {
    const baseScene = readFileSync(resolve(repoRoot, "framework/phaser/BaseScene.ts"), "utf8");
    const diceScene = readFileSync(
      resolve(repoRoot, "apps/dice-game/src/scenes/DiceScene.ts"),
      "utf8",
    );
    const tarotScene = readFileSync(
      resolve(repoRoot, "apps/on-chain-tarot/src/scenes/TarotScene.ts"),
      "utf8",
    );
    const migratedScenes = [
      "aim-master",
      "burn-league",
      "color-clash",
      "flappy-dash",
      "fogplay",
      "game-2048",
      "gas-lucky-pool",
      "last-survivor",
      "pet-potion",
      "red-envelope",
    ].map((app) =>
      readFileSync(
        resolve(repoRoot, `apps/${app}/src/scenes`, `${sceneNameForApp(app)}.ts`),
        "utf8",
      ),
    );

    expect(baseScene).toContain("protected bindGameButton");
    expect(baseScene).toContain("protected pressFeedback");
    expect(baseScene).toContain("prefers-reduced-motion");
    expect(baseScene).toContain("private queueStateUpdate");
    expect(baseScene).toContain("this.time.delayedCall(0");
    expect(baseScene).not.toContain("this.onStateUpdate(this.state);\n    });");
    expect(diceScene.match(/this\.bindGameButton/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(tarotScene.match(/this\.bindGameButton/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    for (const scene of migratedScenes) {
      expect(scene).toContain("this.bindGameButton");
    }
  });
});

function sceneNameForApp(app: string): string {
  const scene = phaserSceneApps.find(([candidate]) => candidate === app)?.[1];
  if (!scene) {
    throw new Error(`Unknown Phaser scene app: ${app}`);
  }
  return scene;
}
