import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appsRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const gamifiedAppOverrides = new Set(["gas-lucky-pool", "red-envelope"]);
const LOCAL_ACTION_PREVIEW_PATTERN =
  /(ActionPreview|actionPreview|[A-Za-z]+Preview|preview[A-Za-z]*)/;
const PREVIEW_TIMEOUT_PATTERN =
  /setTimeout\([\s\S]{0,800}(?:set[A-Za-z]*Preview|setActionPreview)\(/;
const PREVIEW_START_PATTERN =
  /start[A-Za-z]*(?:Action)?Preview|set[A-Za-z]*Preview\(true\)|setActionPreview\(/;
const phaserGames = [
  "aim-master",
  "burn-league",
  "color-clash",
  "dice-game",
  "flappy-dash",
  "fogplay",
  "game-2048",
  "gas-lucky-pool",
  "jump-rush",
  "last-survivor",
  "merge-kingdom",
  "on-chain-tarot",
  "pet-potion",
  "red-envelope",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function isGameApp(app: string): boolean {
  const manifest = readIfExists(resolve(appsRoot, app, "src/manifest.ts"));
  const neoManifest = readIfExists(resolve(appsRoot, app, "neo-manifest.json"));
  const combined = `${manifest}\n${neoManifest}`;
  return (
    gamifiedAppOverrides.has(app) ||
    /category:\s*["']game["']/.test(combined) ||
    /"category"\s*:\s*"games"/.test(combined)
  );
}

function gameApps(): string[] {
  return readdirSync(appsRoot)
    .filter((app) => existsSync(resolve(appsRoot, app)))
    .filter(isGameApp)
    .sort();
}

describe("Game miniapp motion baseline", () => {
  it("routes every Phaser wrapper through the root framework Phaser SDK", () => {
    const frameworkPhaser = readIfExists(resolve(appsRoot, "..", "framework/phaser/index.ts"));

    expect(frameworkPhaser).toContain("PhaserGameComponent");

    for (const app of phaserGames) {
      const wrapper = readIfExists(resolve(appsRoot, app, "src/PhaserPlayArea.tsx"));

      expect(wrapper, `${app}: Phaser wrapper must exist`).not.toBe("");
      expect(wrapper, `${app}: wrapper should import the root framework Phaser SDK`).toContain(
        `from "@framework/phaser"`,
      );
      expect(wrapper, `${app}: wrapper should not depend on the old shared Phaser module`).not.toContain(
        `@shared/phaser`,
      );
    }
  });

  it("uses the Phaser renderer as the production play surface for every Phaser game", () => {
    for (const app of phaserGames) {
      const main = readIfExists(resolve(appsRoot, app, "src/main.tsx"));

      expect(main, `${app}: miniapp entry must exist`).not.toBe("");
      expect(main, `${app}: production entry should import the Phaser play area`).toContain(
        `import PhaserPlayArea from "./PhaserPlayArea";`,
      );
      expect(main, `${app}: production entry should mount the Phaser play area`).toContain(
        "playArea: PhaserPlayArea",
      );
      expect(main, `${app}: production entry should not mount the legacy React play area`).not.toMatch(
        /playArea:\s*(?:PlayArea|[A-Za-z]+Adapter)\b/,
      );
      expect(main, `${app}: production entry should not import the legacy play area`).not.toMatch(
        /from\s+["']\.\/PlayArea["']/,
      );
    }
  });

  it("keeps the root framework Phaser host accessible while scenes boot", () => {
    const phaserHost = readIfExists(
      resolve(appsRoot, "..", "framework/phaser/PhaserGameComponent.tsx"),
    );

    expect(phaserHost).toContain(`bridge.on("ready"`);
    expect(phaserHost).toContain("onReady");
    expect(phaserHost).toContain("aria-busy");
    expect(phaserHost).toContain(`role="application"`);
    expect(phaserHost).toContain("data-ready");
    expect(phaserHost).toContain("loadingLabel");
    expect(phaserHost).toContain("fits the available mobile");
    expect(phaserHost).toContain("window.visualViewport");
    expect(phaserHost).toContain(`window.matchMedia?.("(pointer: coarse)")`);
    expect(phaserHost).toContain("autoMobileSizeRef");
    expect(phaserHost).toContain("fallbackSizeRef");
    expect(phaserHost).toContain("scheduleGameSizeRefresh()");
    expect(phaserHost).toContain("MOBILE_VIEWPORT_WIDTH");
    expect(phaserHost).toContain("COARSE_POINTER_VIEWPORT_WIDTH");
    expect(phaserHost).toContain("isCompactViewport");
    expect(phaserHost).toContain("isCoarsePointerMobile");
    expect(phaserHost).toContain("viewportWidth <= COARSE_POINTER_VIEWPORT_WIDTH");
    expect(phaserHost).toContain("MIN_MOBILE_GAME_HEIGHT");
    expect(phaserHost).toContain("new ResizeObserver");
    expect(phaserHost).toContain("availableWidth");
    expect(phaserHost).toContain("availableViewportHeight");
    expect(phaserHost).toContain("const aspectHeight");
    expect(phaserHost).toContain("availableHeight");
    expect(phaserHost).toContain("Math.min(availableViewportHeight, aspectHeight)");
    expect(phaserHost).toContain("height: Math.round(availableHeight)");
    expect(phaserHost).toContain("viewportHeight - hostTop - bottomReserve");
    expect(phaserHost).toContain("data-auto-mobile-size");
    expect(phaserHost).toContain("const fallbackWidth = numericDimension(config.width, 400)");
    expect(phaserHost).toContain("const fallbackHeight = numericDimension(config.height, 560)");
    expect(phaserHost).toContain("const resolvedWidth = autoMobileSizePx?.width ?? fallbackWidth");
    expect(phaserHost).toContain("const resolvedHeight = autoMobileSizePx?.height ?? fallbackHeight");
    expect(phaserHost).toContain("preserveLogicalSize || !isMobileViewport");
    expect(phaserHost).toContain(`maxWidth: autoMobileSizePx ? undefined : "100%"`);
    expect(phaserHost).toContain("minHeight: autoMobileSizePx ? undefined");
    expect(phaserHost).toContain("gameRef.current?.scale.setGameSize(mobileSize.width, mobileSize.height)");
    expect(phaserHost).toContain("gameRef.current?.scale.setGameSize(fallbackSize.width, fallbackSize.height)");
    expect(phaserHost).toContain("gameRef.current?.scale.refresh()");
    expect(phaserHost).not.toContain("width = ");
    expect(phaserHost).not.toContain("height = 560");
    expect(phaserHost).not.toContain("autoMobileSize =");
    expect(phaserHost).not.toContain("|| isCoarsePointer;");
    expect(phaserHost).not.toContain("Math.max(aspectHeight, availableHeight)");
    expect(phaserHost).not.toContain("viewportHeight * 0.78");
    expect(phaserHost).not.toContain("viewportHeight * 0.86");

    const baseScene = readIfExists(resolve(appsRoot, "..", "framework/phaser/BaseScene.ts"));
    expect(baseScene.indexOf('this.scale.on("resize", this.onResize, this)')).toBeLessThan(
      baseScene.indexOf("this.bridge.notifyReady()"),
    );
  });

  it("does not hardcode mobile canvas heights in Phaser wrappers", () => {
    for (const app of phaserGames) {
      const wrapper = readIfExists(resolve(appsRoot, app, "src/PhaserPlayArea.tsx"));
      const phaserMounts = wrapper.match(/<PhaserGameComponent[\s\S]*?\/>/g) ?? [];

      expect(phaserMounts.length, `${app}: wrapper should mount Phaser`).toBeGreaterThan(0);

      for (const mount of phaserMounts) {
        expect(mount, `${app}: mobile height should be framework-owned`).not.toMatch(
          /\sheight=/,
        );
        expect(mount, `${app}: mobile width should be framework-owned`).not.toMatch(
          /\swidth=/,
        );
        expect(mount, `${app}: should not manually configure automatic mobile sizing`).not.toContain(
          "autoMobileSize",
        );
      }
    }
  });

  it("keeps Aim Master Phaser layout driven by the resized canvas", () => {
    const scene = readIfExists(
      resolve(appsRoot, "aim-master/src/scenes/AimMasterScene.ts"),
    );
    const main = readIfExists(
      resolve(appsRoot, "aim-master/src/main.tsx"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "aim-master/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "aim-master/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize");
    expect(scene).toContain("if (!this.sceneReady || this.isRebuildingScene || !this.poolText || !this.statusText)");
    expect(scene).toContain("this.scale.width");
    expect(scene).toContain("this.scale.height");
    expect(scene).toContain("rebuildResponsiveScene");
    expect(scene).toContain("gaugeXFromLogical");
    expect(scene).toContain("gaugeLogicalFromX");
    expect(scene).toContain("const compactCard = cardH <= 104 || cardW <= 110");
    expect(scene).toContain("const rewardY = compactCard ? 29 : 34");
    expect(scene).toContain("const entryY = compactCard ? cardH / 2 - 6 : cardH / 2 - 10");
    expect(main).toContain("const pattern = createObservable(\"\")");
    expect(main).toContain("pattern.set(String(started.view.pattern ?? \"\"))");
    expect(main).toContain("state: { ...obs, pattern, patternData: pattern");
    expect(wrapper).toContain("pattern:         str(\"pattern\", \"\")");
    expect(wrapper).toContain("className=\"aim-playstage\"");
    expect(wrapper).toContain("className=\"aim-phaser-canvas\"");
    expect(wrapper).toContain("aim-stage-hud");
    expect(wrapper).toContain("aim-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toContain(".aim-playarea .phaser-game-host");
    expect(styles).toContain(".aim-stage-shell");
    expect(styles).toContain(".aim-stage-hud");
    expect(styles).toContain(".aim-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("align-self: stretch");
    expect(main).not.toContain("const patternData = createObservable");
    expect(scene).not.toMatch(/const\s+W\s*=\s*400/);
    expect(scene).not.toMatch(/const\s+H\s*=\s*600/);
    expect(scene).not.toContain("GAUGE_Y");
    expect(scene).not.toContain("GAUGE_LEFT");
    expect(scene).not.toContain("GAUGE_RIGHT");
    expect(scene).not.toContain("TGT_CX");
    expect(scene).not.toContain("TGT_CY");
    expect(scene).not.toContain("scale: 1.04");
    expect(scene).not.toContain("scale: 1.12");
  });

  it("keeps Burn League Phaser arena centered and rebuilt on responsive canvas resize", () => {
    const scene = readIfExists(
      resolve(appsRoot, "burn-league/src/scenes/BurnLeagueScene.ts"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "burn-league/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize");
    expect(scene).toContain("private rebuildScene()");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.tweens.killAll()");
    expect(scene).toContain("this.gasTokens = []");
    expect(scene).toContain("this.presetBtns = []");
    expect(scene).toContain("this.scW = Math.max(1, Math.round(this.scale.width || 420))");
    expect(scene).toContain("this.scH = Math.max(1, Math.round(this.scale.height || 600))");
    expect(scene).toContain("if (!this.sceneReady || this.isRebuildingScene || !this.statusLabel)");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain("./burn-league-arena.webp");
    expect(scene).toContain("Fuel capsules");
    expect(scene).toContain("Ignite ${this.selectedAmount} GAS");
    expect(styles).toContain(".burn-league-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("display: flex");
    expect(styles).toContain("justify-content: center");
  });

  it("keeps Color Clash Phaser memory board centered, responsive, and canvas-owned", () => {
    const scene = readIfExists(
      resolve(appsRoot, "color-clash/src/scenes/ColorClashScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "color-clash/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "color-clash/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize");
    expect(scene).toContain("private rebuildScene()");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.tweens.killAll()");
    expect(scene).toContain("this.padGraphics = []");
    expect(scene).toContain("this.padGlows = []");
    expect(scene).toContain("this.padButtons = []");
    expect(scene).toContain("this.modeCards = []");
    expect(scene).toContain("protected onResize(gameSize: Phaser.Structs.Size)");
    expect(scene).toContain("this.syncSceneSize(gameSize)");
    expect(scene).toContain("gameSize?.width || this.scale.width || 420");
    expect(scene).toContain("gameSize?.height || this.scale.height || 580");
    expect(scene).toContain("const compact = W < 360");
    expect(scene).toContain("Math.min(92");
    expect(scene).toContain("drawModeCard(card.bg, active, card.width, card.height)");
    expect(scene).toContain("const compact = W < 400");
    expect(scene).toContain("compact ? 0.30 : 0.41");
    expect(scene).toContain("const gap = compact ? Math.max(52, W * 0.17) : 68");
    expect(scene).toContain("if (!this.sceneReady || this.isRebuildingScene || !this.statusBar || !this.phaseLabel)");
    expect(scene).toContain("this.flashTimer = this.time.delayedCall(300, playStep)");
    expect(scene).toContain("./art/memory-console.webp");
    expect(scene).toContain("./art/arcade-table.webp");
    expect(scene).toContain("./art/pad-red.webp");
    expect(scene).toContain("OPEN SEQUENCE");
    expect(wrapper).toContain("primary: canClaim");
    expect(wrapper).toContain("const canClaim = isPlaying && completedSequence");
    expect(wrapper).toContain(": undefined");
    expect(wrapper).not.toContain("dispatch(\"startGame\", val<number>(\"gameDifficulty\"");
    expect(styles).toContain(".cclash-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("box-sizing: border-box");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain("align-items: center");
  });

  it("keeps Flappy Dash Phaser flight canvas responsive, asset-led, and canvas-owned", () => {
    const scene = readIfExists(
      resolve(appsRoot, "flappy-dash/src/scenes/FlappyScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "flappy-dash/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "flappy-dash/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain("private fitCameraToHostIfNeeded()");
    expect(scene).toContain("this.fitCameraToHostIfNeeded();");
    expect(scene).toContain("const mobileZoomCorrection = viewW < W ? 0.82 : 1");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("const scrollX = (W - visibleW) / 2");
    expect(scene).toContain(".setScroll(scrollX, scrollY)");
    expect(scene).toContain("./flappy-sprites/background-day.webp");
    expect(scene).toContain("./flappy-sprites/bird-mid.webp");
    expect(scene).toContain("./flappy-sprites/pipe-top.webp");
    expect(scene).toContain(`this.dispatch("startGame", { difficulty: this.pickedDifficulty })`);
    expect(scene).toContain(`this.dispatch("recordFlap", { pipes: this.flappyState.score })`);
    expect(scene).toContain(`this.dispatch("submitSolution", { pipes: score })`);
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("AudioContext");
    expect(scene).toContain("private emitFlapBurst");
    expect(scene).toContain("private playPipePassFeedback");
    expect(scene).toContain("private playResultFeedback");
    expect(scene).toContain("this.playSfx(\"flap\")");
    expect(scene).toContain("this.playSfx(\"score\")");
    expect(scene).toContain("C.chipBorder");
    expect(scene).not.toContain("C.cardBorder");
    expect(wrapper).toContain("const pipesPassed");
    expect(wrapper).toContain("pipesPassed,");
    expect(wrapper).toContain("value: `${pipesPassed}/${rule.targetPipes}`");
    expect(wrapper).toContain("className=\"flappy-playstage\"");
    expect(wrapper).toContain("className=\"flappy-phaser-canvas\"");
    expect(wrapper).toContain("preserveLogicalSize");
    expect(wrapper).toContain("flappy-stage-hud");
    expect(wrapper).toContain("flappy-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("align-items: center");
    expect(styles).toContain(".flappy-stage-shell");
    expect(styles).toContain(".flappy-stage-hud");
    expect(styles).toContain(".flappy-ingame-drawer");
    expect(styles).toContain("height: calc(100dvh - 14px)");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.5");
  });

  it("keeps Gas Lucky Pool as a responsive Phaser vault instead of a form surface", () => {
    const scene = readIfExists(
      resolve(appsRoot, "gas-lucky-pool/src/scenes/GasLuckyPoolScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "gas-lucky-pool/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "gas-lucky-pool/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W = 420");
    expect(scene).toContain("const DESIGN_H = 580");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, DESIGN_H / 2)");
    expect(scene).toContain("./gas-vault-stage.webp");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain("Fund vault");
    expect(scene).toContain("Claim GAS");
    expect(scene).toContain(`this.dispatch("createPool"`);
    expect(scene).toContain(`this.dispatch("claimPool"`);
    expect(scene).not.toContain("lastStatus");
    expect(wrapper).toContain("className={hasClaimContext ? \"gas-pool-playstage--claim\" : \"gas-pool-playstage--creator\"}");
    expect(wrapper).toContain("className=\"gas-pool-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"OneGate GAS vault game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening vault\"");
    expect(wrapper).not.toContain("lastStatus:");
    expect(styles).toContain(".gas-pool-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".gas-pool-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("align-items: flex-start");
    expect(styles).toContain(".gas-pool-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain(".gas-pool-playstage--creator .mx2-action-rail__row");
  });

  it("keeps Jump Rush Phaser gameplay responsive and wired to the registered actions", () => {
    const scene = readIfExists(
      resolve(appsRoot, "jump-rush/src/scenes/JumpRushScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "jump-rush/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "jump-rush/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain(".centerOn(W / 2, H / 2)");
    expect(scene).not.toContain("this.scene.restart()");
    expect(scene).toContain("this.add.rectangle(W / 2, H * 0.32, W, H * 0.64, C.skyTop, 0.42)");
    expect(scene).toContain("this.add.rectangle(W / 2, H * 0.72, W, H * 0.2, C.skyBot, 0.72)");
    expect(scene).toContain("gfx.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1, 1, 1, 1)");
    expect(scene).toContain("./art/bunny-ready.webp");
    expect(scene).toContain("./art/bunny-jump.webp");
    expect(scene).toContain("./art/platform-grass.webp");
    expect(scene).toContain(`this.dispatch("startGame", { difficulty: this.selectedDifficulty })`);
    expect(scene).toContain(`this.dispatch("recordJump"`);
    expect(scene).toContain("chargeMs:");
    expect(scene).toContain("CHARGE_FULL_MS");
    expect(scene).toContain("private canSubmitRun()");
    expect(scene).toContain("private poolCanCoverSelectedRoute()");
    expect(scene).toContain("private onMissedLanding()");
    expect(scene).toContain("centreOffset <= platform.width / 2");
    expect(scene).toContain(`this.dispatch("useUndo", {})`);
    expect(scene).toContain(`this.dispatch("submitRun", {})`);
    expect(scene).not.toContain("submitSolution");
    expect(wrapper).toContain("const busy");
    expect(wrapper).toContain("jr-drawer__summary");
    expect(wrapper).toContain("leaderboard");
    expect(wrapper).toContain("myHistory");
    expect(wrapper).not.toContain("lastStatus,");
    expect(wrapper).toContain("className=\"jr-phaser-canvas\"");
    expect(wrapper).toContain("className=\"jr-playstage\"");
    expect(wrapper).toContain("ariaLabel=\"Jump Rush platform game\"");
    expect(wrapper).toContain("loadingLabel=\"Loading jump route\"");
    expect(wrapper).not.toMatch(/primary:\s*\{\s*label:\s*t\("startAction"/);
    expect(styles).toContain(".jr-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".jr-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".jr-drawer__summary");
    expect(styles).toContain(".jr-run-card");
    expect(styles).toContain(".jr-history");
    expect(styles).toContain(".jr-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
  });

  it("keeps Last Survivor as a responsive Phaser arena with in-canvas key buying", () => {
    const scene = readIfExists(
      resolve(appsRoot, "last-survivor/src/scenes/LastSurvivorScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "last-survivor/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "last-survivor/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W = 420");
    expect(scene).toContain("const DESIGN_H = 600");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, DESIGN_H / 2)");
    expect(scene).toContain("./last-survivor-arena.webp");
    expect(scene).toContain("./logo.webp");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain(`this.dispatch("buyKeys", this.selectedKeyCount)`);
    expect(scene).toContain(`this.dispatch("settleRound")`);
    expect(scene).toContain("Choose key pack");
    expect(scene).toContain("Arena service unavailable. Connect wallet and refresh.");
    expect(scene).toContain("Settle to pay the winner and open a fresh round.");
    expect(wrapper).toContain("className=\"survivor-playstage\"");
    expect(wrapper).toContain("className=\"survivor-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"Last Survivor arena game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening arena\"");
    expect(wrapper).toContain("totalKeysDisplay: totalKeys");
    expect(wrapper).toContain("survivor-drawer__summary");
    expect(wrapper).toContain("survivor-history");
    expect(wrapper).toContain(`dispatch("refreshRound"`);
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(styles).toContain(".survivor-play-area .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".survivor-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("align-items: flex-start");
    expect(styles).toContain(".survivor-drawer__summary");
    expect(styles).toContain(".survivor-state-card");
    expect(styles).toContain(".survivor-rules");
    expect(styles).toContain(".survivor-play-area .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
  });

  it("keeps Merge Kingdom as a responsive Phaser merge board with in-canvas start and moves", () => {
    const scene = readIfExists(
      resolve(appsRoot, "merge-kingdom/src/scenes/MergeKingdomScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "merge-kingdom/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "merge-kingdom/src/PlayArea.scss"),
    );

    expect(scene).toContain("export const SCENE_W = 400");
    expect(scene).toContain("export const SCENE_H = 600");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain(".centerOn(SCENE_W / 2, SCENE_H / 2)");
    expect(scene).not.toContain("this.scene.restart()");
    expect(scene).toContain("./art/tile-0002-grass-plot.webp");
    expect(scene).toContain("./art/tile-2048-crystal-citadel.webp");
    expect(scene).toContain("disabledBtn: 0xe8d5b0");
    expect(scene).toContain("btnBg.setFillStyle(canStart ? C.gold : C.disabledBtn)");
    expect(scene).toContain("btnText.setColor(canStart ? \"#2b261f\" : \"#8b7355\")");
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDiff)`);
    expect(scene).toContain(`this.dispatch("recordMove", sr, sc, row, col)`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain("Build Realm");
    expect(scene).toContain("Claim Reward");
    expect(wrapper).toContain("className=\"mk-playstage\"");
    expect(wrapper).toContain("className=\"mk-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"Merge Kingdom board game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening kingdom board\"");
    expect(wrapper).toContain("mk-drawer__summary");
    expect(wrapper).toContain("mk-drawer__fairness");
    expect(wrapper).toContain("mk-history");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(styles).toContain(".mk-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".mk-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".mk-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain(".mk-drawer__summary");
    expect(styles).toContain(".mk-drawer__credit");
    expect(styles).toContain(".mk-drawer__seed");
  });

  it("keeps Pet Potion as a responsive Phaser pet-care game with in-canvas care actions", () => {
    const scene = readIfExists(
      resolve(appsRoot, "pet-potion/src/scenes/PetPotionScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "pet-potion/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "pet-potion/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W = 420");
    expect(scene).toContain("const DESIGN_H = 580");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, DESIGN_H / 2)");
    expect(scene).toContain("./art/nursery-lab.webp");
    expect(scene).toContain("./art/pet-baby.webp");
    expect(scene).toContain("./art/action-feed.webp");
    expect(scene).toContain("./art/action-rest.webp");
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDifficulty)`);
    expect(scene).toContain(`this.dispatch("recordAction", { type: action.key })`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain("Nurture the pet");
    expect(scene).toContain("Claim reward");
    expect(wrapper).toContain("className=\"pp-playstage\"");
    expect(wrapper).toContain("className=\"pp-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"Pet Potion nursery game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening pet nursery\"");
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("activeGameId,");
    expect(wrapper).toContain("const deadline");
    expect(wrapper).toContain("deadline,");
    expect(wrapper).toContain("pp-drawer__summary");
    expect(wrapper).toContain("pp-drawer__fairness");
    expect(wrapper).toContain("pp-action-trail");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(wrapper).not.toMatch(/primary:\s*(?:isPlaying|\{)/);
    expect(styles).toContain(".pp-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".pp-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".pp-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain(".pp-playarea .mx2-drawer.mx2-drawer--open");
    expect(styles).toContain(".pp-drawer__summary");
    expect(styles).toContain(".pp-drawer__credit");
    expect(styles).toContain(".pp-drawer__seed");
  });

  it("keeps Sheep Solitaire as a responsive Phaser tile game with in-canvas route, claim, and withdraw actions", () => {
    const scene = readIfExists(
      resolve(appsRoot, "sheep-solitaire/src/scenes/SheepScene.ts"),
    );
    const main = readIfExists(
      resolve(appsRoot, "sheep-solitaire/src/main.tsx"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "sheep-solitaire/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "sheep-solitaire/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W = 400");
    expect(scene).toContain("const DESIGN_H = 640");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("visibleWorldH");
    expect(scene).toContain("tallViewportLift");
    expect(scene).toContain("renderResponsiveStage(visibleWorldH, centerY)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, centerY)");
    expect(scene).toContain("./art/meadow-table.webp");
    expect(scene).toContain("./art/slot-tray.webp");
    expect(scene).toContain("./art/mascot-sheep.webp");
    expect(scene).toContain("./art/tile-00-wool-flower.webp");
    expect(scene).toContain(`this.dispatch("startGame", { difficulty });`);
    expect(scene).toContain(`this.dispatch("pickCard", { cardId: card.id });`);
    expect(scene).toContain(`this.dispatch("submitRun");`);
    expect(scene).toContain(`this.dispatch("withdrawWinnings", {});`);
    expect(scene).toContain(`this.dispatch("returnToLobby");`);
    expect(scene).toContain("Match 3 tiles to clear the board");
    expect(scene).toContain("Claim Reward");
    expect(main).toContain(`status !== "dealt" && status !== "solved"`);
    expect(main).toContain(`register("returnToLobby"`);
    expect(wrapper).toContain("className=\"sheep-playstage\"");
    expect(wrapper).toContain("className=\"sheep-phaser-canvas\"");
    expect(wrapper).toContain("sheep-stage-hud");
    expect(wrapper).toContain("sheep-ingame-drawer");
    expect(wrapper).toContain("ariaLabel=\"Sheep Solitaire tile game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening sheep board\"");
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("activeGameId,");
    expect(wrapper).toContain("const deadline");
    expect(wrapper).toContain("deadline,");
    expect(wrapper).toContain("dealtAt:");
    expect(wrapper).toContain("isPicking:");
    expect(wrapper).not.toContain("LOBBY_CARD_BOUNDS");
    expect(wrapper).not.toContain("sheep-phaser-lobby-hitarea");
    expect(wrapper).not.toContain("primary: gameStatus === \"solved\"");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(styles).toContain(".sheep-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".sheep-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".sheep-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain(".sheep-stage-shell");
    expect(styles).toContain(".sheep-stage-hud");
    expect(styles).toContain(".sheep-ingame-drawer");
  });

  it("keeps Red Envelope as a responsive Phaser packet game with in-canvas send and claim actions", () => {
    const scene = readIfExists(
      resolve(appsRoot, "red-envelope/src/scenes/RedEnvelopeScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "red-envelope/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "red-envelope/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W = 420");
    expect(scene).toContain("const DESIGN_H = 580");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("visibleWorldH");
    expect(scene).toContain("tallViewportLift");
    expect(scene).toContain("renderResponsiveStage(visibleWorldH, centerY)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, centerY)");
    expect(scene).toContain("./red-envelope-stage.webp");
    expect(scene).toContain("./red-envelope-claim-card.webp");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain(`this.dispatch("createEnvelope", {`);
    expect(scene).toContain(`this.dispatch("claimEnvelope", { envelopeId: this.activeEnvelopeId })`);
    expect(scene).toContain(`this.dispatch("shareEnvelope", { envelopeId: this.lastCreatedEnvelopeId })`);
    expect(scene).toContain("Create packets. Share a link. Open for GAS.");
    expect(scene).toContain("Open envelope");
    expect(wrapper).toContain("className=\"redenv-playstage\"");
    expect(wrapper).toContain("className=\"redenv-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"Red Envelope packet game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening red envelope game\"");
    expect(wrapper).toContain("lastError:");
    expect(wrapper).toContain("serviceNotice:");
    expect(wrapper).toContain("redenv-stage-hud");
    expect(wrapper).toContain("redenv-ingame-drawer");
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(wrapper).not.toContain("score={score}");
    expect(styles).toContain(".redenv-play-area .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".redenv-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".redenv-play-area .mx2-playstage.mx2-cat-game");
    expect(styles).toContain(".redenv-stage-shell");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain(".redenv-stage-hud");
    expect(styles).toContain(".redenv-ingame-drawer");
  });

  it("keeps Dice Game Phaser table responsive, asset-led, and centered in the stage", () => {
    const scene = readIfExists(
      resolve(appsRoot, "dice-game/src/scenes/DiceScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "dice-game/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "dice-game/src/PlayArea.scss"),
    );

    expect(scene).toContain("protected onResize");
    expect(scene).toContain("private rebuildScene()");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.shuffleTimer?.remove(false)");
    expect(scene).toContain("this.faceButtons = []");
    expect(scene).toContain("this.chipButtons = []");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain("./art/die-white-1.webp");
    expect(scene).toContain("./art/chip-green.webp");
    expect(scene).toContain("Prediction rail");
    expect(scene).toContain("Chip rail");
    expect(scene).toContain("throwTrail");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("AudioContext");
    expect(scene).toContain("this.playSfx(\"select\")");
    expect(scene).toContain("this.playSfx(\"chip\")");
    expect(scene).toContain("this.playSfx(\"throw\")");
    expect(scene).toContain("this.playSfx(\"land\")");
    expect(scene).toContain("this.playSfx(\"win\")");
    expect(scene).not.toContain("ASSET_HERO_DIE");
    expect(scene).not.toContain("throwGhosts");
    expect(scene).not.toContain("Pick Your Number");
    expect(scene).not.toContain("Stake Amount");
    expect(scene).not.toContain("ROLL THE DICE");
    expect(wrapper).toContain("className=\"dice-playstage\"");
    expect(wrapper).toContain("className=\"dice-phaser-canvas\"");
    expect(wrapper).toContain("dice-stage-hud");
    expect(wrapper).toContain("dice-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toContain(".dice-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".dice-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".dice-stage-shell");
    expect(styles).toContain(".dice-stage-hud");
    expect(styles).toContain(".dice-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2");
    expect(styles).not.toContain(".dice-playarea .mx2-action-rail__row");
    expect(styles).not.toContain(".dice-playarea .mx2-score");
  });

  it("keeps 2048 Rush Phaser layout responsive instead of fixed to the base canvas", () => {
    const scene = readIfExists(
      resolve(appsRoot, "game-2048/src/scenes/Game2048Scene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "game-2048/src/PhaserPlayArea.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "game-2048/src/PlayArea.scss"),
    );

    expect(scene).toContain("type Game2048Layout");
    expect(scene).toContain("computeLayout(width: number, height: number)");
    expect(scene).toContain("this.layout = this.computeLayout(this.scale.width || CW, this.scale.height || CH)");
    expect(scene).toContain("private rebuildScene()");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.rebuildScene();");
    expect(scene).toContain("private cellXY(idx: number)");
    expect(scene).toContain("const { cellSize } = this.layout");
    expect(scene).toContain("tileFontSize(exp, cellSize)");
    expect(scene).toContain("this.add.rectangle(0, 0, l.width, l.height, 0x3b2d19, 0.42)");
    expect(scene).toContain("private canStartPicked()");
    expect(scene).toContain("poolFree >= Number(gasDisplay(rule.rewardFixed8))");
    expect(scene).toContain("private canMove(dir: number)");
    expect(scene).toContain("this.num(\"runMoveCount\", 0) >= MAX_MOVES");
    expect(scene).toContain("Date.now() >= deadline");
    expect(scene).toContain("return applyMove([...board], dir)");
    expect(wrapper).toContain("const canSubmit = isPlaying && targetReached && minSolveReached && !submitWindowClosed");
    expect(wrapper).toContain("rush-stage-shell");
    expect(wrapper).toContain("rush-stage-hud");
    expect(wrapper).toContain("rush-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).toContain("rush-drawer__summary");
    expect(wrapper).toContain("rush-history");
    expect(wrapper).toContain("refreshLeaderboard");
    expect(wrapper).toContain("className=\"rush-phaser-canvas\"");
    expect(wrapper).not.toContain("dispatch(\"startGame\"");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toContain(".rush-phaser-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain(".rush-stage-shell");
    expect(styles).toContain(".rush-stage-hud");
    expect(styles).toContain(".rush-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.78");
    expect(styles).toContain(".rush-history__item");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("AudioContext");
    expect(scene).toContain("this.playSfx(\"move\")");
    expect(scene).toContain("this.playSfx(\"merge\")");
    expect(scene).not.toContain("const GRID_TOP");
    expect(scene).not.toContain("const GRID_LEFT");
    expect(scene).not.toContain("const GRID_W");
    expect(scene).not.toContain("const CELL_SIZE");
    expect(scene).not.toContain("function cellXY");
    expect(scene).not.toContain("this.scene.restart()");
    expect(scene).not.toContain("CW / 2, CH / 2");
  });

  it("keeps On-Chain Tarot Phaser cards dealt from the deck with responsive rebuilds", () => {
    const scene = readIfExists(
      resolve(appsRoot, "on-chain-tarot/src/scenes/TarotScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "on-chain-tarot/src/PhaserPlayArea.tsx"),
    );
    const main = readIfExists(
      resolve(appsRoot, "on-chain-tarot/src/main.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "on-chain-tarot/src/PlayArea.scss"),
    );

    expect(scene).toContain("private rebuildScene()");
    expect(scene).toContain("protected onResize");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.intentButtons = []");
    expect(scene).toContain("this.cardViews = []");
    expect(scene).toContain("this.load.image(TAROT_ASSETS.back, TAROT_CARD_BACK)");
    expect(scene).toContain("TAROT_DECK.forEach");
    expect(scene).toContain("this.load.image(cardKey(card.id), card.image)");
    expect(scene).toContain("const deckX = this.deckStack.x + 18");
    expect(scene).toContain("const targetX = view.container.x");
    expect(scene).toContain("setPosition(deckX, deckY)");
    expect(scene).toContain("x: targetX");
    expect(scene).toContain("y: targetY");
    expect(scene).toContain("delay: index * 150");
    expect(scene).toContain("flipCardView");
    expect(wrapper).toContain("tarot-drawer__summary");
    expect(wrapper).toContain("tarot-spread-list");
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).toContain(`dispatch("refreshReadingState"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(main).toContain(`actions.register("refreshReadingState"`);
    expect(main).toContain("walletAddress: tarot.address");
    expect(styles).toContain(".tarot-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".tarot-play-area .mx2-drawer.mx2-drawer--open");
    expect(styles).toContain(".tarot-drawer__summary");
    expect(styles).toContain(".tarot-spread-list");
  });

  it("keeps Snake Bounty Phaser route cards synced with progression-gated starts", () => {
    const scene = readIfExists(
      resolve(appsRoot, "snake-bounty/src/scenes/SnakeScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "snake-bounty/src/PhaserPlayArea.tsx"),
    );
    const main = readIfExists(
      resolve(appsRoot, "snake-bounty/src/main.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "snake-bounty/src/PlayArea.scss"),
    );

    expect(scene).toContain(`this.dispatch("selectDifficulty", { difficulty })`);
    expect(scene).toContain(`this.dispatch("startGame", { difficulty })`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain("const DESIGN_W = 440");
    expect(scene).toContain("const DESIGN_H = 580");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("visibleWorldH");
    expect(scene).toContain("tallViewportLift");
    expect(scene).toContain("renderResponsiveStage(visibleWorldH, centerY)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, centerY)");
    expect(scene).toContain("isDifficultyLocked");
    expect(scene).toContain("progressionRequiredDifficulty");
    expect(scene).toContain("type SnakeLayout");
    expect(scene).toContain("computeLayout(width: number, height: number)");
    expect(scene).toContain("this.layout = this.computeLayout(DESIGN_W, DESIGN_H)");
    expect(scene).toContain("buildBountyTrail");
    expect(scene).toContain("canStartDifficulty(difficulty)");
    expect(scene).toContain("canSubmitTarget()");
    expect(scene).toContain("Target Reached");
    expect(scene).toContain("Submit Win");
    expect(scene).not.toContain("const CELL =");
    expect(scene).not.toContain("const GRID_TOP");
    expect(scene).not.toContain("const GRID_PX");
    expect(scene).not.toContain("this.scene.restart()");
    expect(wrapper).toContain("className=\"snake-playstage\"");
    expect(wrapper).toContain("className=\"snake-phaser-canvas\"");
    expect(wrapper).toContain("snake-stage-hud");
    expect(wrapper).toContain("snake-ingame-drawer");
    expect(wrapper).toContain("ariaLabel=\"Snake Bounty arcade game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening bounty trail\"");
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("credit:");
    expect(wrapper).toContain("progressionReady");
    expect(wrapper).toContain("progressionRequiredDifficulty");
    expect(wrapper).toContain("progressionUnavailableShort");
    expect(wrapper).toContain("progressionNextRoute");
    expect(wrapper).toContain("checkDealAgain");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={[");
    expect(styles).toContain(".snake-stage-shell");
    expect(styles).toContain(".snake-stage-hud");
    expect(styles).toContain(".snake-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).not.toContain(".snake-playstage > .mx2-score");
    expect(styles).not.toContain(".snake-playstage > .mx2-action-rail");
    expect(main).toContain(`app.actions.register("selectDifficulty"`);
    expect(main).toContain("refreshProgression");
    expect(main).toContain("obs.progressionRequiredDifficulty.set");
  });

  it("keeps Sudoku Arena as a responsive Phaser puzzle board with gated in-canvas settlement", () => {
    const scene = readIfExists(
      resolve(appsRoot, "sudoku/src/scenes/SudokuScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "sudoku/src/PhaserPlayArea.tsx"),
    );
    const main = readIfExists(
      resolve(appsRoot, "sudoku/src/main.tsx"),
    );
    const styles = readIfExists(
      resolve(appsRoot, "sudoku/src/PlayArea.scss"),
    );

    expect(scene).toContain("const DESIGN_W  = 400");
    expect(scene).toContain("const DESIGN_H  = 600");
    expect(scene).toContain("protected onResize(_gameSize: Phaser.Structs.Size)");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("visibleWorldH");
    expect(scene).toContain("tallViewportLift");
    expect(scene).toContain("this.renderResponsiveStage(visibleWorldW, visibleWorldH, centerY)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, centerY)");
    expect(scene).toContain(`this.dispatch("selectDifficulty", { difficulty })`);
    expect(scene).toContain(`this.dispatch("startGame", { difficulty: this.pickedDifficulty })`);
    expect(scene).toContain(`this.dispatch("submitSolution", { solution })`);
    expect(scene).toContain("canStartDifficulty(this.pickedDifficulty)");
    expect(scene).toContain("progressionRequiredDifficulty");
    expect(scene).toContain("walletConnected");
    expect(scene).toContain("SUBMIT_BUFFER_MS");
    expect(scene).toContain("MIN_SOLVE_BUFFER_MS");
    expect(scene).toContain("canSubmitSolution()");
    expect(scene).toContain("restoreBoard(activeGameId, clues)");
    expect(scene).toContain("persistBoard(activeGameId");
    expect(scene).not.toContain("this.scene.restart()");
    expect(wrapper).toContain("className=\"sudoku-playstage\"");
    expect(wrapper).toContain("className=\"sudoku-phaser-canvas\"");
    expect(wrapper).toContain("ariaLabel=\"Sudoku Arena puzzle game\"");
    expect(wrapper).toContain("loadingLabel=\"Opening sealed sudoku board\"");
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("const creditGas      = val<number>(\"credit\", 0)");
    expect(wrapper).toContain("walletConnected");
    expect(wrapper).toContain("progressionReady");
    expect(wrapper).toContain("progressionRequiredDifficulty");
    expect(wrapper).toContain("sudoku-stage-hud");
    expect(wrapper).toContain("sudoku-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("creditGas\"");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={[");
    expect(main).toContain(`app.actions.register("selectDifficulty"`);
    expect(main).toContain("refreshProgression");
    expect(main).toContain("obs.progressionRequiredDifficulty.set");
    expect(styles).toContain(".sudoku-playarea .phaser-game-host");
    expect(styles).toContain(".sudoku-stage-shell");
    expect(styles).toContain(".sudoku-stage-hud");
    expect(styles).toContain(".sudoku-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2.08");
    expect(styles).not.toContain(".sudoku-playstage > .mx2-score");
    expect(styles).not.toContain(".sudoku-playstage > .mx2-action-rail");
  });

  it("keeps game stages large and touchable on mobile", () => {
    const v2Styles = readIfExists(
      resolve(appsRoot, "shared/components-react/v2/v2.scss"),
    );

    expect(v2Styles).toContain("@media (max-width: 560px)");
    expect(v2Styles).toContain("min-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))");
    expect(v2Styles).toContain("flex-direction: column");
    expect(v2Styles).toContain(".mx2-cat-game.mx2-stage");
    expect(v2Styles).toContain("flex: 1 1 auto");
    expect(v2Styles).toContain("padding: 8px 6px 10px !important");
    expect(v2Styles).toContain(".mx2-cat-game .mx2-stage__subtitle");
    expect(v2Styles).toContain("display: none !important");
    expect(v2Styles).toContain(".mx2-cat-game .mx2-stage__scene");
    expect(v2Styles).toContain("min-height: 0 !important");
    expect(v2Styles).toContain("justify-content: stretch");
    expect(v2Styles).toContain("padding: 0 !important");
    expect(v2Styles).toContain('.mx2-cat-game .mx2-stage__scene [role="application"]');
    expect(v2Styles).toContain("width: 100% !important");
    expect(v2Styles).toContain("max-width: 100%");
  });

  it("keeps every game surface animated, asset-led, and reduced-motion safe", () => {
    const games = gameApps();

    expect(games.length).toBeGreaterThanOrEqual(11);

    const failures = games.flatMap((app) => {
      const appRoot = resolve(appsRoot, app);
      const playAreaScss = readIfExists(resolve(appRoot, "src/PlayArea.scss"));
      const playAreaTsx = readIfExists(resolve(appRoot, "src/PlayArea.tsx"));
      const publicAssets = existsSync(resolve(appRoot, "public"))
        ? readdirSync(resolve(appRoot, "public")).filter((file) =>
            /\.(?:avif|webp|jpe?g|png)$/i.test(file),
          )
        : [];
      // Redesigned (v2) apps source their motion from the shared v2 kit and
      // their art from the shared SVG atlas instead of declaring per-app
      // @keyframes + raster files. Either approach must still be rich and safe.
      const usesSharedMotion =
        /@use\s+["']@shared\/styles\/v2\/motion["']/.test(playAreaScss) ||
        /@use\s+["']@shared\/components-react\/v2\/v2["']/.test(playAreaScss);
      const usesSharedArt =
        /from\s+["']@shared\/art["']/.test(playAreaTsx) ||
        /from\s+["']@shared\/components-react\/v2["']/.test(playAreaTsx);

      const checks = [
        {
          ok:
            usesSharedMotion ||
            (playAreaScss.match(/@keyframes/g) ?? []).length >= 8,
          reason: "needs at least eight named keyframe sequences",
        },
        {
          ok:
            usesSharedMotion ||
            (playAreaScss.match(/animation:/g) ?? []).length >= 8,
          reason: "needs at least eight active animation rules",
        },
        {
          ok:
            usesSharedMotion ||
            /prefers-reduced-motion:\s*reduce/.test(playAreaScss),
          reason: "needs reduced-motion coverage",
        },
        {
          ok:
            usesSharedArt ||
            (publicAssets.length > 0 &&
              /\.(?:avif|webp|jpe?g|png)/i.test(`${playAreaScss}\n${playAreaTsx}`)),
          reason: "needs real assets referenced by the play surface",
        },
        {
          ok:
            LOCAL_ACTION_PREVIEW_PATTERN.test(playAreaTsx) &&
            PREVIEW_TIMEOUT_PATTERN.test(playAreaTsx) &&
            PREVIEW_START_PATTERN.test(playAreaTsx),
          reason:
            "needs immediate local action preview so taps animate before chain confirmation",
        },
        {
          ok:
            /aria-busy=/.test(playAreaTsx) ||
            // v2 apps inherit the busy state from the shared ActionRail
            // (which renders aria-busy on the primary action when loading).
            /from\s+["']@shared\/components-react\/v2["']/.test(playAreaTsx),
          reason:
            "needs a busy game surface so action animations are exposed to users and assistive tech",
        },
      ];

      return checks
        .filter((check) => !check.ok)
        .map((check) => `${app}: ${check.reason}`);
    });

    expect(failures).toEqual([]);
  });
});
