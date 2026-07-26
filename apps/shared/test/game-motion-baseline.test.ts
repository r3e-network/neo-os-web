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
  "arrow-escape",
  "bead-workshop",
  "burn-league",
  "color-clash",
  "curve-arrow",
  "dice-game",
  "flappy-dash",
  "fogplay",
  "fruit-funnel",
  "game-2048",
  "gas-lucky-pool",
  "gomoku",
  "jump-rush",
  "last-survivor",
  "merge-kingdom",
  "on-chain-tarot",
  "pet-potion",
  "red-envelope",
  "screw-sort",
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
      expect(wrapper, `${app}: wrapper should import the root framework Phaser SDK`).toMatch(
        /from "@framework\/phaser(?:\/LazyPhaserGameComponent)?"/,
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
    expect(main).toContain('const patternValue = String(started.view.pattern ?? "")');
    expect(main).toContain("parseTargetPattern(patternValue).length === 0");
    expect(main).toContain("pattern.set(patternValue)");
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
    expect(scene).toContain("this.flashTimer = this.scheduleGameplay(timing.leadInMs, showNextCue)");
    expect(scene).toContain("this.dispatch(\"sequencePlaybackComplete\")");
    expect(scene).toContain("cueTimingOf(this.currentDifficulty)");
    expect(scene).toContain("./art/memory-console.webp");
    expect(scene).toContain("./art/arcade-table.webp");
    expect(scene).toContain("./art/pad-red.webp");
    expect(scene).toContain("OPEN SEQUENCE");
    expect(scene).toContain("private primaryActionFor");
    expect(scene).toContain('action: "submitSolution"');
    expect(scene).toContain('action: "retryDeal"');
    expect(scene).toContain('action: "expireGame"');
    expect(scene).toContain("this.dispatch(this.primaryAction)");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("actionSubmit:");
    expect(wrapper).toContain("actionRetry:");
    expect(wrapper).not.toContain("primary: canClaim");
    expect(wrapper).not.toContain("secondaryActions");
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
    expect(scene).not.toContain("mobileZoomCorrection");
    expect(scene).toContain("const zoom = Math.min(viewW / W, viewH / H)");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("const scrollX = (W - visibleW) / 2");
    expect(scene).toContain(".setScroll(scrollX, scrollY)");
    expect(scene).toContain("./flappy-sprites/background-day.webp");
    expect(scene).toContain("./flappy-sprites/bird-mid.webp");
    expect(scene).toContain("./flappy-sprites/pipe-top.webp");
    expect(scene).toContain(`this.dispatch("startGame", { difficulty: this.pickedDifficulty })`);
    expect(scene).toContain(`this.dispatch("recordFlap", { pipes: this.flappyState.score })`);
    expect(scene).toContain(`this.dispatch("syncScore", { pipes: score })`);
    expect(scene).toContain(`this.dispatch("submitSolution", { pipes: score })`);
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("this.sfx.");
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
    expect(wrapper).not.toContain("preserveLogicalSize");
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
    expect(wrapper).toContain('ariaLabel={isGuest ? t("guestCanvasAria") : t("vaultCanvasAria")}');
    expect(wrapper).toContain('loadingLabel={t("vaultCanvasLoading")}');
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("gas-pool-stage-shell");
    expect(wrapper).toContain("gas-pool-stage-hud");
    expect(wrapper).toContain("gas-pool-ingame-drawer");
    expect(wrapper).toContain("gas-pool-drawer__actions");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("lastStatus:");
    expect(styles).toContain(".gas-pool-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain(".gas-pool-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain("align-items: stretch");
    expect(styles).toContain(".gas-pool-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain(".gas-pool-stage-shell");
    expect(styles).toContain(".gas-pool-stage-hud");
    expect(styles).toContain(".gas-pool-ingame-drawer");
    expect(styles).toContain("height: clamp(420px, calc(100dvh - 136px), 700px)");
    expect(styles).not.toContain("min-height: 626px");
    expect(styles).toContain(".gas-pool-drawer__actions");
    expect(styles).not.toContain(".gas-pool-playstage--creator .mx2-action-rail__drawer-toggle");
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
    expect(scene).toContain("private canReleaseRun()");
    expect(scene).toContain("private canRetryDeal()");
    expect(scene).toContain("private poolCanCoverSelectedRoute()");
    expect(scene).toContain("private onMissedLanding()");
    expect(scene).toContain("evaluateJumpLevel(chargeLevel, to.gap, to.width)");
    expect(scene).not.toContain("MAX_PLATFORMS");
    expect(scene).toContain(`this.dispatch("useUndo", {})`);
    expect(scene).toContain(`this.dispatch("retryDeal", {})`);
    expect(scene).toContain(`this.dispatch("expireGame", {})`);
    expect(scene).toContain(`this.dispatch("submitRun", {})`);
    expect(scene).not.toContain("submitSolution");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("jr-drawer__summary");
    expect(wrapper).toContain("jr-drawer__actions");
    expect(wrapper).toContain("leaderboard");
    expect(wrapper).toContain("myHistory");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain(`dispatch("useUndo"`);
    expect(wrapper).not.toContain(`dispatch("retryDeal"`);
    expect(wrapper).not.toContain(`dispatch("expireGame"`);
    expect(wrapper).not.toContain("lastStatus,");
    expect(wrapper).toContain("className=\"jr-phaser-canvas\"");
    expect(wrapper).toContain("className=\"jr-playstage\"");
    expect(wrapper).toContain('ariaLabel={t("gameAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("gameLoadingLabel")}');
    expect(wrapper).toContain("jr-a11y-layer");
    expect(wrapper).toContain('type="range"');
    expect(wrapper).not.toMatch(/primary:\s*\{\s*label:\s*t\("startAction"/);
    expect(styles).toContain(".jr-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".jr-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".jr-drawer__summary");
    expect(styles).toContain(".jr-drawer__actions");
    expect(styles).toContain(".jr-run-card");
    expect(styles).toContain(".jr-history");
    expect(styles).toContain(".jr-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 0 0 auto");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.45");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 112");
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
    expect(scene).toContain("Arena service unavailable. Refresh shortly.");
    expect(scene).toContain("Settle to pay the winner and open a fresh round.");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(wrapper).toContain("className=\"survivor-playstage\"");
    expect(wrapper).toContain("className=\"survivor-phaser-canvas\"");
    expect(wrapper).toContain('ariaLabel={t("arenaCanvasAria")}');
    expect(wrapper).toContain('loadingLabel={t("arenaCanvasLoading")}');
    expect(wrapper).toContain("survivor-a11y-controls");
    expect(wrapper).toContain("totalKeysDisplay: totalKeys");
    expect(wrapper).toContain("survivor-stage-shell");
    expect(wrapper).toContain("survivor-stage-hud");
    expect(wrapper).toContain("survivor-ingame-drawer");
    expect(wrapper).toContain("survivor-drawer__summary");
    expect(wrapper).toContain("survivor-history");
    expect(wrapper).toContain(`dispatch("refreshRound"`);
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(styles).toContain(".survivor-play-area .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain(".survivor-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".survivor-stage-shell");
    expect(styles).toContain(".survivor-stage-hud");
    expect(styles).toContain(".survivor-ingame-drawer");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 92px");
    expect(styles).toContain(".survivor-drawer__summary");
    expect(styles).toContain(".survivor-state-card");
    expect(styles).toContain(".survivor-rules");
    expect(styles).toContain(".survivor-play-area .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 1 1 auto");
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
    expect(scene).toContain("btnText.setColor(canStart ? \"#2b261f\" : \"#765a32\")");
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDiff)`);
    expect(scene).toContain(`this.dispatch("startGame", this.num("gameDifficulty", this.selectedDiff))`);
    expect(scene).toContain(`this.dispatch("recordMove", from.row, from.col, to.row, to.col)`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain(`this.dispatch("retryDeal")`);
    expect(scene).toContain(`this.dispatch("refreshGame")`);
    expect(scene).toContain(`this.dispatch("expireGame")`);
    expect(scene).toContain("private canRetryDeal()");
    expect(scene).toContain("private canReleaseCommitted()");
    expect(scene).toContain("private handlePointerMove(");
    expect(scene).toContain(`this.input.on("pointermove"`);
    expect(scene).toContain("this.reducedMotion");
    expect(scene).toContain("gameFiNewEntriesEnabled");
    expect(scene).toContain("Build Realm");
    expect(scene).toContain("Claim Reward");
    expect(scene).toContain("Build Next Realm");
    expect(wrapper).toContain("className=\"mk-playstage\"");
    expect(wrapper).toContain("className=\"mk-phaser-canvas\"");
    expect(wrapper).toContain('ariaLabel={t("gameAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("gameLoadingLabel")}');
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("mk-stage-shell");
    expect(wrapper).toContain("mk-stage-hud");
    expect(wrapper).toContain("mk-ingame-drawer");
    expect(wrapper).toContain("mk-drawer__summary");
    expect(wrapper).toContain("mk-drawer__fairness");
    expect(wrapper).toContain("mk-history");
    expect(wrapper).toContain("mk-a11y-controls");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("secondary:");
    expect(wrapper).toContain(`dispatch("submitSolution"`);
    expect(wrapper).toContain(`dispatch("retryDeal"`);
    expect(wrapper).toContain(`dispatch("expireGame"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(styles).toContain(".mk-playarea .mx2-stage");
    expect(styles).toContain("width: min(100%, 760px)");
    expect(styles).toContain("max-width: 760px");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain(".mk-playarea .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".mk-stage-shell");
    expect(styles).toContain(".mk-stage-hud");
    expect(styles).toContain(".mk-ingame-drawer");
    expect(styles).toContain(".mk-playarea .mx2-playstage.mx2-cat-game");
    expect(styles).toContain("min-height: 0");
    expect(styles).toContain("flex: 1 1 auto");
    expect(styles).toContain(".mk-drawer__summary");
    expect(styles).toContain(".mk-drawer__credit");
    expect(styles).toContain(".mk-drawer__seed");
    expect(styles).toContain(".mk-a11y-controls:focus-within");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 92px");
    expect(styles).not.toContain(".mk-playarea .mx2-drawer.mx2-drawer--open");
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
    expect(scene).toContain('this.dispatch(this.str("gameStatus", "idle") === "unknown" || this.bool("inputSyncFailed")');
    expect(scene).toContain(`this.dispatch("expireGame")`);
    expect(scene).toContain("private canRecoverRun()");
    expect(scene).toContain(`this.dispatch("brewPotion")`);
    expect(scene).toContain("private isRunTimedOut");
    expect(scene).toContain("Nurture the pet");
    expect(scene).toContain("Claim reward");
    expect(scene).toContain("Release run");
    expect(wrapper).toContain("className=\"pp-playstage\"");
    expect(wrapper).toContain("className=\"pp-phaser-canvas\"");
    expect(wrapper).toContain('ariaLabel={t("sceneAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("sceneLoadingLabel")}');
    expect(wrapper).toContain("pp-stage-shell");
    expect(wrapper).toContain("pp-stage-hud");
    expect(wrapper).toContain("pp-ingame-drawer");
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("activeGameId,");
    expect(wrapper).toContain("const deadline");
    expect(wrapper).toContain("deadline,");
    expect(wrapper).toContain("pp-drawer__summary");
    expect(wrapper).toContain("pp-drawer__fairness");
    expect(wrapper).toContain("pp-action-trail");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain(`runAction("refreshLeaderboard"`);
    expect(wrapper).toContain(`runAction("withdrawWinnings"`);
    expect(wrapper).toContain("pp-a11y-layer");
    expect(wrapper).toContain("pp-recipe-strip");
    expect(wrapper).not.toContain(`dispatch("retryDeal"`);
    expect(wrapper).not.toContain(`dispatch("expireGame"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("secondary:");
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
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain(".pp-stage-shell");
    expect(styles).toContain(".pp-stage-hud");
    expect(styles).toContain(".pp-ingame-drawer");
    expect(styles).toContain(".pp-drawer__summary");
    expect(styles).toContain(".pp-drawer__credit");
    expect(styles).toContain(".pp-drawer__seed");
    expect(styles).not.toContain(".pp-playarea .mx2-drawer.mx2-drawer--open");
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

    // P2 rebuild (docs/sheep-solitaire-redesign-2026.md §9.4, 2026-07-14 user
    // acceptance verdict): the scene moved from a 400×640 cream-panel stage to
    // a mobile-first 390×844 full-screen meadow, so the design pins and the
    // background/tray art pins track the new original asset set
    // (field-meadow/tray-wood replace meadow-table/slot-tray in the SCENE; the
    // old webps stay on disk for the legacy DOM PlayArea).
    expect(scene).toContain("const DESIGN_W = 390");
    expect(scene).toContain("const DESIGN_H = 844");
    expect(scene).toContain("protected onResize()");
    expect(scene).toContain("private fitCameraToHost()");
    expect(scene).toContain(".setViewport(0, 0, viewW, viewH)");
    expect(scene).toContain(".setZoom(zoom)");
    expect(scene).toContain("visibleWorldH");
    expect(scene).toContain("tallViewportLift");
    expect(scene).toContain("renderResponsiveStage(visibleWorldH, centerY)");
    expect(scene).toContain(".centerOn(DESIGN_W / 2, centerY)");
    expect(scene).toContain("./art/field-meadow.webp");
    expect(scene).toContain("./art/tray-wood.webp");
    expect(scene).toContain("./art/mascot-sheep.webp");
    // P1 redesign: tiles are the original sheep-themed set loaded via a dynamic
    // per-symbol loop (SheepScene.preload builds `./art/tile-NN-<sym>.webp` from
    // ALL_SYMBOLS) instead of hardcoded literal paths, so we assert the real
    // asset-led loader the scene now uses rather than a since-renamed tile file.
    expect(scene).toContain('`./art/tile-${String(i).padStart(2, "0")}-${sym}.webp`');
    expect(scene).toContain(`this.dispatch("startGame", { difficulty });`);
    expect(scene).toContain(`this.dispatch("pickCard", { cardId: card.id });`);
    expect(scene).toContain(`this.dispatch("submitRun");`);
    expect(scene).toContain(`this.dispatch("withdrawWinnings", {});`);
    expect(scene).toContain(`this.dispatch("returnToLobby");`);
    expect(scene).toContain("Match 3 tiles to clear the board");
    expect(scene).toContain("Claim Reward");
    expect(main).toContain(`status !== "dealt" && status !== "solved" && status !== "unknown"`);
    expect(main).toContain(`register("returnToLobby"`);
    expect(wrapper).toContain("className=\"sheep-playstage\"");
    expect(wrapper).toContain("className=\"sheep-phaser-canvas\"");
    expect(wrapper).toContain("sheep-stage-hud");
    expect(wrapper).toContain("sheep-ingame-drawer");
    expect(wrapper).toContain(`ariaLabel={t("gameAriaLabel")}`);
    expect(wrapper).toContain(`loadingLabel={t("gameLoadingLabel")}`);
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
    expect(wrapper).toContain('ariaLabel={t("sceneAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("sceneLoadingLabel")}');
    expect(wrapper).toContain('enableSoundLabel={t("sceneEnableSound")}');
    expect(wrapper).toContain('role="dialog"');
    expect(wrapper).toContain("redenv-canvas-access");
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
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("this.playSfx(\"select\")");
    expect(scene).toContain("this.playSfx(\"chip\")");
    expect(scene).toContain("this.playSfx(\"throw\")");
    expect(scene).toContain("this.playSfx(\"land\")");
    expect(scene).toContain("this.playSfx(\"win\")");
    expect(scene).not.toContain("ASSET_HERO_DIE");
    expect(scene).not.toContain("throwGhosts");
    expect(scene).not.toContain("heroDieY");
    expect(scene).not.toContain("ghostLeftY");
    expect(scene).not.toContain("ghostTopY");
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
    expect(wrapper).toContain("const runEnded = targetReached || boardDead || moveCapReached");
    expect(wrapper).toContain("const canSubmit = isPlaying");
    expect(wrapper).toContain("&& (isGuest || minSolveReached)");
    expect(wrapper).toContain("&& (isGuest || !submitWindowClosed)");
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
    expect(scene).toContain("this.sfx.");
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

    expect(scene).toContain("private rebuildScene(restoringLayout = false)");
    expect(scene).toContain("protected onResize");
    expect(scene).toContain("this.children.removeAll(true)");
    expect(scene).toContain("this.intentButtons = []");
    expect(scene).toContain("this.cardViews = []");
    expect(scene).toContain("this.load.image(TAROT_ASSETS.back, TAROT_CARD_BACK)");
    expect(scene).toContain("private queueMissingCardTextures(");
    expect(scene).toContain("this.pendingCardTextures.add(key)");
    expect(scene).toContain("this.load.image(key, url)");
    expect(scene).not.toContain("TAROT_DECK.forEach((card)");
    expect(scene).toContain("const deckX = this.deckStack.x + 18");
    expect(scene).toContain("const targetX = view.container.x");
    expect(scene).toContain("setPosition(deckX, deckY)");
    expect(scene).toContain("x: targetX");
    expect(scene).toContain("y: targetY");
    expect(scene).toContain("delay: index * 150");
    expect(scene).toContain("flipCardView");
    expect(scene).toContain(`this.dispatch("draw")`);
    expect(scene).toContain(`this.dispatch("flipCard", index)`);
    expect(scene).toContain(`this.dispatch("setIntent", option.id)`);
    expect(scene).toContain(`this.dispatch("reset")`);
    expect(wrapper).toContain("tarot-drawer__summary");
    expect(wrapper).toContain("tarot-spread-list");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("tarot-drawer__actions");
    expect(wrapper).toContain("tarot-stage-shell");
    expect(wrapper).toContain("tarot-stage-hud");
    expect(wrapper).toContain("tarot-ingame-drawer");
    expect(wrapper).toContain(`runAction("withdrawCredit"`);
    expect(wrapper).toContain(`runAction("refreshReadingState"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).toContain("tarot-a11y-layer");
    expect(wrapper).toContain(`runAction("draw"`);
    expect(wrapper).toContain(`runAction("flipCard"`);
    expect(wrapper).toContain("tarot-asset-recovery-a11y");
    expect(wrapper).not.toContain("primary,");
    expect(wrapper).not.toContain("secondary,");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(main).toContain(`actions.register("refreshReadingState"`);
    expect(main).toContain(`actions.register("setAssetRecoveryState"`);
    expect(main).toContain(`actions.register("retryTarotAssets"`);
    expect(main).toContain("walletAddress: tarot.address");
    expect(styles).toContain(".tarot-play-area .phaser-game-host");
    expect(styles).toContain("margin-inline: auto");
    expect(styles).toContain(".tarot-stage-shell");
    expect(styles).toContain(".tarot-stage-hud");
    expect(styles).toContain(".tarot-ingame-drawer");
    expect(styles).toContain(".tarot-drawer__summary");
    expect(styles).toContain(".tarot-drawer__actions");
    expect(styles).toContain(".tarot-spread-list");
    expect(styles).not.toContain(".tarot-play-area .mx2-drawer.mx2-drawer--open");
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
    // The stylesheet the live wrapper imports. This used to read PlayArea.scss,
    // which passed only because it carried a stale duplicate of these Phaser
    // selectors — it was imported solely by the unmounted DOM PlayArea.tsx, and
    // both are now deleted.
    const styles = readIfExists(
      resolve(appsRoot, "snake-bounty/src/PhaserPlayArea.scss"),
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
    expect(wrapper).toContain('ariaLabel={t("gameAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("gameLoadingLabel")}');
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
    expect(scene).toContain("toggleNotesMode");
    expect(scene).toContain("applyRollbackRequest");
    expect(scene).toContain("bindKeyboardControls");
    expect(scene).toContain("buildPausedOverlay");
    expect(scene).toContain("GAMEFI_NEW_ENTRIES_ENABLED");
    expect(scene).not.toContain("this.scene.restart()");
    expect(wrapper).toContain("className=\"sudoku-playstage\"");
    expect(wrapper).toContain("className=\"sudoku-phaser-canvas\"");
    expect(wrapper).toContain('ariaLabel={t("canvasAriaLabel")}');
    expect(wrapper).toContain('loadingLabel={t("canvasLoadingLabel")}');
    expect(wrapper).toContain("const activeGameId");
    expect(wrapper).toContain("const creditGas      = val<number>(\"credit\", 0)");
    expect(wrapper).toContain("walletConnected");
    expect(wrapper).toContain("progressionReady");
    expect(wrapper).toContain("progressionRequiredDifficulty");
    expect(wrapper).toContain("sudoku-stage-hud");
    expect(wrapper).toContain("sudoku-ingame-drawer");
    expect(wrapper).toContain("sudoku-a11y-controls");
    expect(wrapper).toContain("sudokuBoardState");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("creditGas\"");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={[");
    expect(main).toContain(`app.actions.register("selectDifficulty"`);
    expect(main).toContain("refreshProgression");
    expect(main).toContain("obs.progressionRequiredDifficulty.set");
    expect(main).toContain("GAMEFI_NEW_ENTRIES_ENABLED");
    expect(main).toContain("rollbackNonce");
    expect(styles).toContain(".sudoku-playarea .phaser-game-host");
    expect(styles).toContain(".sudoku-stage-shell");
    expect(styles).toContain(".sudoku-stage-hud");
    expect(styles).toContain(".sudoku-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.62");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 72px");
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
      const phaserWrapperTsx = readIfExists(resolve(appRoot, "src/PhaserPlayArea.tsx"));
      const mainTsx = readIfExists(resolve(appRoot, "src/main.tsx"));
      // Phaser-first games have no DOM PlayArea: the canvas scene IS the play
      // surface, so asset/feedback checks read the scene sources instead.
      const playAreaIsPhaserCompatibility =
        playAreaTsx.trim() === 'export { default } from "./PhaserPlayArea";';
      // Some Phaser-first games retain a legacy DOM PlayArea.tsx that is not
      // mounted anywhere ("uses the Phaser renderer as the production play
      // surface" above pins main.tsx to the Phaser wrapper). What users play
      // is the canvas, so those apps are audited through the scene checks;
      // their retained DOM file deliberately animates only from authoritative
      // state (see the per-app playarea tests) rather than a local preview.
      const phaserIsProductionSurface =
        phaserWrapperTsx !== "" && mainTsx.includes("playArea: PhaserPlayArea");
      const isPhaserOnly =
        (playAreaTsx === "" || playAreaIsPhaserCompatibility || phaserIsProductionSurface) &&
        phaserWrapperTsx !== "";
      const playSurfaceTsx = playAreaIsPhaserCompatibility
        ? phaserWrapperTsx
        : playAreaTsx || phaserWrapperTsx;
      const sceneSources = existsSync(resolve(appRoot, "src/scenes"))
        ? readdirSync(resolve(appRoot, "src/scenes"))
            .filter((file) => file.endsWith(".ts"))
            .map((file) => readIfExists(resolve(appRoot, "src/scenes", file)))
            .join("\n")
        : "";
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
        /from\s+["']@shared\/art["']/.test(playSurfaceTsx) ||
        /from\s+["']@shared\/components-react\/v2["']/.test(playSurfaceTsx);

      const checks = [
        {
          ok:
            isPhaserOnly ||
            usesSharedMotion ||
            (playAreaScss.match(/@keyframes/g) ?? []).length >= 8,
          reason: "needs at least eight named keyframe sequences",
        },
        {
          ok:
            isPhaserOnly ||
            usesSharedMotion ||
            (playAreaScss.match(/animation:/g) ?? []).length >= 8,
          reason: "needs at least eight active animation rules",
        },
        {
          ok:
            isPhaserOnly
              ? /reducedMotion|this\.(?:animate|tween)\(/.test(sceneSources)
              : usesSharedMotion ||
                /prefers-reduced-motion:\s*reduce/.test(playAreaScss),
          reason: "needs reduced-motion coverage",
        },
        {
          ok: isPhaserOnly
            ? publicAssets.length > 0 &&
              /(?:load\.image|preloadAssets)/.test(sceneSources) &&
              /\.(?:avif|webp|jpe?g|png)/i.test(sceneSources)
            : usesSharedArt ||
              (publicAssets.length > 0 &&
                /\.(?:avif|webp|jpe?g|png)/i.test(`${playAreaScss}\n${playAreaTsx}`)),
          reason: "needs real assets referenced by the play surface",
        },
        {
          // Phaser-first games give instant in-canvas feedback: pointer input
          // wired straight to tweens + sound, no DOM preview layer needed.
          ok: isPhaserOnly
            ? /pointerdown|bindGameButton/.test(sceneSources) &&
              /this\.(?:animate|tween|pressFeedback|tweens\.add)\(/.test(sceneSources) &&
              /this\.sfx\./.test(sceneSources)
            : LOCAL_ACTION_PREVIEW_PATTERN.test(playAreaTsx) &&
              PREVIEW_TIMEOUT_PATTERN.test(playAreaTsx) &&
              PREVIEW_START_PATTERN.test(playAreaTsx),
          reason:
            "needs immediate local action preview so taps animate before chain confirmation",
        },
        {
          ok:
            isPhaserOnly
              ? /ariaLabel=|aria-live=|aria-busy=/.test(phaserWrapperTsx)
              : /aria-busy=/.test(playSurfaceTsx) ||
            // v2 apps inherit the busy state from the shared ActionRail
            // (which renders aria-busy on the primary action when loading).
                /from\s+["']@shared\/components-react\/v2["']/.test(playSurfaceTsx),
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
