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
  ["arrow-escape", "ArrowEscapeScene"],
  ["bead-workshop", "BeadWorkshopScene"],
  ["burn-league", "BurnLeagueScene"],
  ["color-clash", "ColorClashScene"],
  ["curve-arrow", "CurveArrowScene"],
  ["dice-game", "DiceScene"],
  ["flappy-dash", "FlappyScene"],
  ["fogplay", "FogplayScene"],
  // fruit-funnel was rebuilt into a real-physics fruit-merge game; its root
  // scene is now SuikaScene.ts (the deleted FruitFunnelScene.ts belonged to the
  // retired match-2 build). This cross-app registry must track the real scene.
  ["fruit-funnel", "SuikaScene"],
  ["game-2048", "Game2048Scene"],
  ["gas-lucky-pool", "GasLuckyPoolScene"],
  ["gomoku", "GomokuScene"],
  ["jump-rush", "JumpRushScene"],
  ["last-survivor", "LastSurvivorScene"],
  ["merge-kingdom", "MergeKingdomScene"],
  ["on-chain-tarot", "TarotScene"],
  ["pet-potion", "PetPotionScene"],
  ["red-envelope", "RedEnvelopeScene"],
  ["sheep-solitaire", "SheepScene"],
  ["snake-bounty", "SnakeScene"],
  ["screw-sort", "ScrewSortScene"],
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

  it("mounts Phaser canvases in a dedicated cleaned host layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "framework/phaser/PhaserGameComponent.tsx"),
      "utf8",
    );

    expect(source).toContain("const mountRef");
    expect(source).toContain("className=\"phaser-game-mount\"");
    expect(source).toContain("mount.replaceChildren()");
    expect(source).toContain("parent: mount");
    expect(source).not.toContain("parent: containerRef.current");
  });

  it("publishes scene readiness only after the child stage can finish building", () => {
    const source = readFileSync(
      resolve(repoRoot, "framework/phaser/BaseScene.ts"),
      "utf8",
    );

    expect(source).toContain("private readyTimer");
    expect(source).toContain("this.readyTimer = this.time.delayedCall(0");
    expect(source).toContain("!this.cleanedUp && this.sys.isActive()");
    expect(source.indexOf('this.scale.on("resize", this.onResize, this)')).toBeLessThan(
      source.indexOf("this.readyTimer = this.time.delayedCall(0"),
    );
    expect(source).toContain("this.readyTimer.remove(false)");
  });

  it("hosts the shared Phaser sound toggle inside the game surface", () => {
    const component = readFileSync(
      resolve(repoRoot, "framework/phaser/PhaserGameComponent.tsx"),
      "utf8",
    );
    const audio = readFileSync(
      resolve(repoRoot, "framework/phaser/SceneAudio.ts"),
      "utf8",
    );

    expect(component).toContain("data-phaser-audio-muted");
    expect(component).toContain(`import { Volume2, VolumeX } from "lucide-react"`);
    expect(component).toContain("setSceneAudioMuted(nextMuted)");
    expect(component).toContain("SCENE_AUDIO_MUTE_EVENT");
    expect(component).toContain("aria-pressed={!audioMuted}");
    expect(component).toContain("<AudioIcon aria-hidden=\"true\"");
    expect(component).toContain("zIndex: 2");
    expect(component).not.toContain("function AudioToggleIcon");
    expect(audio).toContain("SCENE_AUDIO_MUTE_STORAGE_KEY");
    expect(audio).toContain("if (this.muted) return;");
  });

  it("declares runtime icon dependencies used by the shared Phaser chrome", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(repoRoot, "framework/package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.["lucide-react"]).toBe("^0.562.0");
    expect(pkg.peerDependencies?.["lucide-react"]).toBeUndefined();
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

  it("gives every Phaser game scene sound effects through the shared mixer", () => {
    for (const [app, scene] of phaserSceneApps) {
      const source = readFileSync(
        resolve(repoRoot, `apps/${app}/src/scenes/${scene}.ts`),
        "utf8",
      );

      expect(source, `${app}: scene should play cues through BaseScene.sfx`).toContain(
        "this.sfx.",
      );
      expect(source, `${app}: scene should not hand-roll a WebAudio mixer`).not.toContain(
        "createOscillator",
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
          "officialGasTokenPhaserUrl",
        ],
        usage: ["BURN_ASSETS", "gasTokens", "coreMachine", "dispatch(\"burn\""],
      },
      {
        app: "gas-lucky-pool",
        scene: "GasLuckyPoolScene",
        assets: [
          "./gas-vault-stage.webp",
          "officialGasTokenPhaserUrl",
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
        app: "red-envelope",
        scene: "RedEnvelopeScene",
        assets: [
          "./red-envelope-stage.webp",
          "./red-envelope-claim-card.webp",
          "officialGasTokenPhaserUrl",
        ],
        usage: [
          "REDENV_ASSETS",
          "ENVELOPE_PLANS",
          "dispatch(\"createEnvelope\"",
          "dispatch(\"claimEnvelope\"",
          "dispatch(\"shareEnvelope\"",
        ],
      },
      {
        app: "last-survivor",
        scene: "LastSurvivorScene",
        assets: [
          "./last-survivor-arena.webp",
          "./logo.webp",
          "officialGasTokenPhaserUrl",
        ],
        usage: [
          "SURVIVOR_ASSETS",
          "KEY_PRESETS",
          "dispatch(\"setKeyCount\"",
          "dispatch(\"buyKeys\"",
          "dispatch(\"settleRound\"",
        ],
      },
      {
        app: "on-chain-tarot",
        scene: "TarotScene",
        assets: [
          "./ritual/ritual-table.webp",
          "./logo.webp",
          "./intentions/clarity-token.webp",
          "./intentions/choice-token.webp",
          "./intentions/momentum-token.webp",
          "TAROT_CARD_BACK",
        ],
        usage: [
          "TAROT_ASSETS",
          "this.load.image(key, url)",
          "dispatch(\"setIntent\"",
          "dispatch(\"draw\"",
          "dispatch(\"flipCard\"",
          "dispatch(\"flipTarotReading\"",
          "dispatch(\"reset\"",
        ],
      },
      {
        app: "color-clash",
        scene: "ColorClashScene",
        assets: [
          "./art/memory-console.webp",
          "./art/arcade-table.webp",
          "./art/pad-red.webp",
          "./art/pad-blue.webp",
          "./art/pad-green.webp",
          "./art/pad-yellow.webp",
          "./art/badge-easy.webp",
          "./art/badge-hard.webp",
        ],
        usage: [
          "CLASH_ASSETS",
          "PAD_FILES.forEach",
          "BADGE_FILES.forEach",
          "buildModeDock",
          "buildPadButtons",
          "dispatch(\"startGame\"",
          "dispatch(\"recordPress\"",
        ],
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
          "officialGasTokenPhaserUrl",
        ],
        usage: [
          "DIE_FACE_ASSETS",
          "CHIP_PRESETS",
          "setDieFace",
          "ASSET_GAS_ICON",
          "buildBettingSpots",
          "throwTrail",
          "dispatch(\"placeDiceBet\", {",
          "chosenNumber: String(this.selectedFace)",
          "amount: this.stakeAmount.toFixed(2)",
        ],
      },
      {
        app: "game-2048",
        scene: "Game2048Scene",
        assets: [
          "./tile-felt.webp",
          "./art/building-e1.webp",
          "./art/building-e11.webp",
          "./art/building-e12.webp",
        ],
        usage: [
          "RUSH_ASSETS",
          "this.load.image(RUSH_ASSETS.felt",
          "buildLobbyHeroBoard",
          "RUSH_ASSETS.tile",
          "this.add.image(l.centerX, l.gridTop + l.gridH / 2, RUSH_ASSETS.felt",
          "dispatch(\"startGame\"",
          "dispatch(\"playMove\"",
        ],
      },
      {
        app: "merge-kingdom",
        scene: "MergeKingdomScene",
        assets: [
          "./art/tile-0002-grass-plot.webp",
          "./art/tile-0064-market-stall.webp",
          "./art/tile-1024-royal-castle.webp",
          "./art/tile-2048-crystal-citadel.webp",
        ],
        usage: [
          "TILE_ASSETS",
          "TILE_FILES",
          "buildLobbyPreviewBoard",
          "updateLobbyPreviewBoard",
          "updateRoutePanel",
          "this.load.image",
          "this.add.image",
          "dispatch(\"startGame\"",
          "dispatch(\"recordMove\"",
        ],
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
      {
        app: "pet-potion",
        scene: "PetPotionScene",
        assets: [
          "./art/nursery-lab.webp",
          "./art/pet-egg.webp",
          "./art/pet-baby.webp",
          "./art/pet-teen.webp",
          "./art/pet-adult.webp",
          "./art/action-feed.webp",
          "./art/action-play.webp",
          "./art/action-pet.webp",
          "./art/action-rest.webp",
          "./art/badge-easy.webp",
          "./art/badge-medium.webp",
          "./art/badge-hard.webp",
        ],
        usage: [
          "PET_ASSETS",
          "this.load.image(PET_ASSETS.lab",
          "this.load.image(PET_ASSETS.actions.feed",
          "this.load.image(PET_ASSETS.badges[0]",
          "dispatch(\"recordAction\"",
          "dispatch(\"startGame\"",
          "dispatch(\"submitSolution\"",
        ],
      },
      {
        app: "sheep-solitaire",
        scene: "SheepScene",
        assets: [
          // P2 sticker rebuild (docs/sheep-solitaire-redesign-2026.md §9.4):
          // the lobby-era meadow-table/slot-tray/badge set was replaced by the
          // full-screen field, wooden fence tray, sticker CTA and prop-button
          // icons. Mascot pass (2026-07-14 user verdict — the circle-composite
          // sheep read as creepy): mascot-sheep.webp is now a die-cut sticker
          // reframe of the in-house public/logo.webp character, and the
          // grazing-sheep flock pose was retired with it (sheep-grazing.webp
          // deleted; the home shows one hero medallion instead).
          "./art/field-meadow.webp",
          "./art/tray-wood.webp",
          "./art/btn-sticker.webp",
          "./art/mascot-sheep.webp",
          "./art/prop-undo.webp",
          "./art/prop-remove.webp",
          "./art/prop-shuffle.webp",
          // P1 sheep redesign: the generic tile set was replaced by 15 sheep-
          // themed tiles loaded via a dynamic per-symbol loop, so the literal
          // old filenames no longer appear; assert the real asset-led loader
          // (the "./art/tile-" prefix built over ALL_SYMBOLS) instead.
          "./art/tile-",
          "ALL_SYMBOLS",
        ],
        usage: [
          "SHEEP_ASSETS",
          "this.load.image(SHEEP_ASSETS.field",
          "this.load.image(SHEEP_ASSETS.tray",
          "this.load.image(SHEEP_ASSETS.mascot",
          "SHEEP_ASSETS.tiles[i]",
          "this.tileAssetKey(card.symbol)",
          "dispatch(\"startGame\"",
          "dispatch(\"pickCard\"",
        ],
      },
      {
        app: "sudoku",
        scene: "SudokuScene",
        assets: [
          "./paper-grid.webp",
          "./art/cell-given.webp",
          "./art/cell-placed.webp",
          "./art/cell-selected.webp",
          "./art/cell-conflict.webp",
          "./art/note-token.webp",
          "./art/pencil.webp",
          "./art/seal-easy.webp",
          "./art/seal-medium.webp",
          "./art/seal-hard.webp",
          "./art/sealed-envelope.webp",
          "./art/solved-badge.webp",
        ],
        usage: [
          "SUDOKU_ASSETS",
          "this.load.image(SUDOKU_ASSETS.paperGrid",
          "this.paperBoard",
          "this.cellArt",
          "SUDOKU_ASSETS.seals",
          "SUDOKU_ASSETS.noteToken",
          "SUDOKU_ASSETS.solvedBadge",
          "dispatch(\"startGame\"",
          "dispatch(\"recordMove\"",
          "dispatch(\"submitSolution\"",
        ],
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
      // Forbids the historical `const coinMark = this.add.text(... "G" ...)`
      // glyph placeholder. Word-bounded so `coinMarks` — arrays of LOADED
      // image sprites (gas-lucky-pool) — stay allowed.
      expect(source, `${app}: scene should not use text-only coin placeholders`).not.toMatch(
        /coinMark\b/,
      );
      if (app === "flappy-dash") {
        expect(source, `${app}: bird should be a loaded sprite, not a Graphics drawing`).not.toContain(
          "birdGraphics",
        );
        expect(source, `${app}: pipes should be loaded sprites, not Graphics rectangles`).not.toContain(
          "pipeGraphics",
        );
        expect(source, `${app}: lobby should be a flight cockpit, not a generic picker prompt`).not.toContain(
          "Choose Difficulty",
        );
        expect(source, `${app}: primary CTA should use game-run language instead of generic demo copy`).not.toContain(
          "Start Game",
        );
        expect(source, `${app}: selected route details should be consolidated into the main flight panel`).toContain(
          "updateRoutePanel",
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
      if (app === "dice-game") {
        const mainSource = readFileSync(
          resolve(repoRoot, "apps/dice-game/src/main.tsx"),
          "utf8",
        );
        expect(source, `${app}: Phaser scene should use betting-table language instead of form labels`).not.toContain(
          "Pick Your Number",
        );
        expect(source, `${app}: Phaser scene should use chip-rail language instead of form labels`).not.toContain(
          "Stake Amount",
        );
        expect(source, `${app}: CTA should use table action language instead of old generic copy`).not.toContain(
          "ROLL THE DICE",
        );
        expect(source, `${app}: face selection should be table betting spots`).toContain(
          "Prediction rail",
        );
        expect(source, `${app}: stake selection should be a chip rail`).toContain(
          "Chip rail",
        );
        expect(source, `${app}: rolling state should animate a dice throw trail`).toContain(
          "throwTrail",
        );
        expect(source, `${app}: CTA should be a dice throw action`).toContain(
          "THROW DICE",
        );
        expect(mainSource, `${app}: production action registry should accept Phaser face selection`).toContain(
          'ctx.framework.actions.register("setSelectedFace"',
        );
        expect(mainSource, `${app}: production action registry should accept Phaser chip selection`).toContain(
          'ctx.framework.actions.register("setStakeAmount"',
        );
      }
      if (app === "game-2048") {
        expect(source, `${app}: lobby should be a board-first game surface, not a form prompt`).not.toContain(
          "Choose Difficulty",
        );
        expect(source, `${app}: primary CTA should use game-run language instead of generic demo copy`).not.toContain(
          "Start Game",
        );
        expect(source, `${app}: loading state should use tile assets, not old text-only shuffle copy`).not.toContain(
          "Shuffling tiles",
        );
        expect(source, `${app}: scene should not advertise empty cells as placeholders`).not.toContain(
          "empty placeholder",
        );
      }
      if (app === "merge-kingdom") {
        expect(source, `${app}: scene should use loaded tile art instead of primitive-only rendering`).not.toContain(
          "No external assets",
        );
        expect(source, `${app}: scene should not document primitive-only rendering`).not.toContain(
          "everything rendered with Phaser primitives",
        );
        expect(source, `${app}: lobby CTA should use kingdom gameplay language`).not.toContain(
          "Start Kingdom",
        );
        expect(source, `${app}: loading state should not keep old text-only shuffle copy`).not.toContain(
          "Shuffling tiles",
        );
        expect(source, `${app}: loading state should not keep old generic start copy`).not.toContain(
          "Starting game",
        );
        expect(source, `${app}: primary CTA should be a realm action, not generic demo copy`).toContain(
          "Build Realm",
        );
      }
      if (app === "color-clash") {
        expect(source, `${app}: Phaser start action should use arcade-run language instead of demo copy`).not.toContain(
          "START GAME",
        );
        expect(source, `${app}: Phaser scene should not keep the old generic start copy`).not.toContain(
          "Start Game",
        );
        expect(source, `${app}: pad input should be gated by live game state before dispatch`).toContain(
          "if (!this.canPressPads()) return;",
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
      if (app === "red-envelope") {
        expect(source, `${app}: Phaser create action should match the registered framework action`).not.toContain(
          "sendEnvelopes",
        );
        expect(source, `${app}: Phaser claim action should match the registered framework action`).not.toContain(
          "openEnvelope",
        );
        expect(source, `${app}: red envelope should use loaded art, not the old hand-drawn flap helper`).not.toContain(
          "drawFlap",
        );
        expect(source, `${app}: red envelope should use loaded art, not the old hand-drawn seal helper`).not.toContain(
          "drawSeal",
        );
        expect(source, `${app}: open affordance should be a real action button, not old placeholder copy`).not.toContain(
          "TAP TO OPEN",
        );
      }
      if (app === "last-survivor") {
        expect(source, `${app}: Phaser buy action should pass the selected count directly`).not.toContain(
          'dispatch("buyKeys", {',
        );
        expect(source, `${app}: Phaser settle action should match the registered framework action`).not.toContain(
          'dispatch("settle",',
        );
        expect(source, `${app}: keys should use loaded art and UI, not the old hand-drawn icon`).not.toContain(
          "drawKeyIcon",
        );
      }
      if (app === "on-chain-tarot") {
        expect(source, `${app}: Phaser scene should use real Neo tarot card images, not hand-drawn archetype symbols`).not.toContain(
          "drawCardSymbol",
        );
        expect(source, `${app}: Phaser scene should not hand-draw astral card art`).not.toContain(
          "drawAstralSymbol",
        );
        expect(source, `${app}: Phaser scene should not keep the old procedural card-face helper`).not.toContain(
          "drawCardFaceBlank",
        );
        expect(source, `${app}: intent chips should dispatch the stable registered intent action`).toContain(
          'dispatch("setIntent"',
        );
      }
      if (app === "pet-potion") {
        expect(source, `${app}: pet should use loaded pet images instead of the old hand-drawn egg helper`).not.toContain(
          "drawEgg",
        );
        expect(source, `${app}: pet should use loaded pet images instead of the old hand-drawn sprite helper`).not.toContain(
          "drawSprite",
        );
        expect(source, `${app}: scene should not advertise programmatic art as the visual system`).not.toContain(
          "all art drawn programmatically",
        );
      }
      if (app === "sheep-solitaire") {
        expect(source, `${app}: tile faces should use real tile images, not old geometric symbols`).not.toContain(
          "drawCardSymbol",
        );
        expect(source, `${app}: mascot should use loaded art, not an old graphics emblem`).not.toContain(
          "drawSheepEmblem",
        );
      }
      if (app === "sudoku") {
        expect(source, `${app}: difficulty cards should use seal art, not drawn text symbols`).not.toContain(
          "DIFF_ICONS",
        );
        expect(source, `${app}: Phaser scene should not be documented as primitive-only rendering`).not.toContain(
          "All rendering uses Phaser primitives",
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
      "sudoku",
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
    // Deck/card, intent-token loop, and primary action all use the shared
    // interaction helper. The intent loop represents three physical buttons.
    expect(tarotScene.match(/this\.bindGameButton/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const scene of migratedScenes) {
      expect(scene).toContain("this.bindGameButton");
    }
  });

  it("defers the Phaser runtime and root scene for production game miniapps", () => {
    const lazyHost = readFileSync(
      resolve(repoRoot, "framework/phaser/LazyPhaserGameComponent.tsx"),
      "utf8",
    );

    expect(lazyHost).toContain('import("./PhaserGameComponent")');
    expect(lazyHost).toContain("loadScene()");
    expect(lazyHost).toContain("data-runtime-error");
    expect(lazyHost).not.toContain('import * as Phaser from "phaser"');

    for (const [app, sceneName] of phaserSceneApps) {
      if (app === "curve-arrow") continue;
      const wrapper = readFileSync(
        resolve(repoRoot, `apps/${app}/src/PhaserPlayArea.tsx`),
        "utf8",
      );

      expect(wrapper, `${app}: game runtime should use the deferred host`).toContain(
        "LazyPhaserGameComponent as PhaserGameComponent",
      );
      expect(wrapper, `${app}: root scene should be dynamically imported`).toContain(
        `import("./scenes/${sceneName}")`,
      );
      expect(wrapper, `${app}: deferred scene loader should be passed to the host`).toMatch(
        /loadScene=\{load[A-Za-z0-9]+Scene\}/,
      );
      expect(wrapper, `${app}: root scene must not stay in the entry bundle`).not.toContain(
        `from "./scenes/${sceneName}"`,
      );
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
