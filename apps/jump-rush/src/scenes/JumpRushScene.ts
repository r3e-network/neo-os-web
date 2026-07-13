/**
 * JumpRushScene — Phaser 3 scene for the Jump Rush platform-jumper miniapp.
 *
 * Renders:
 *  - Bright sky background with real cloud sprites
 *  - Scrolling world container with grass platform sprites
 *  - Bunny character sprites for idle, charge, jump, and hurt states
 *  - Power charge bar at the bottom (fills while pointer/space is held)
 *  - Combo counter, round-progress dots, timer bar in the HUD
 *  - Lobby: playable route picker with one clear start action
 *
 * State received from React (via GameBridge / BaseScene):
 *  - gameStatus    : "idle"|"committed"|"dealt"|"solved"|"expired"
 *  - gameDifficulty: number (0=easy, 1=medium, 2=hard)
 *  - deadline      : number (unix ms, 0 if not started)
 *  - dealtAt       : number (unix ms, 0 if not started)
 *  - isStarting    : boolean
 *  - isDealing     : boolean
 *  - isSubmitting  : boolean
 *  - poolFree      : number
 *  - platformsView : Platform[] (authoritative x/width/gap route objects)
 *
 * Actions dispatched to React:
 *  - "startGame"      { difficulty: number }
 *  - "recordJump"     { chargeLevel: number, platformIndex: number, landed: boolean, perfect: boolean }
 *  - "submitRun"      {}
 *  - "expireGame"     {}
 *  - "retryDeal"      {}
 *  - "useUndo"        {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { DIFFICULTY_RULES, formatClock, gasDisplay } from "../logic/game-rules";
import { evaluateJumpLevel } from "../logic/jump-engine";
import type { Platform } from "../logic/jump-engine";

// ── Visual constants ────────────────────────────────────────────────────────

const W = 400;
const H = 580;

/** Vertical gap between consecutive platforms (world-space pixels). */
const VERT_GAP_MIN = 88;
const VERT_GAP_MAX = 140;

/** Platform width bounds; height follows each source asset's aspect ratio. */
const PLATFORM_MIN_W = 60;
const PLATFORM_RANGE_W = 80;

/** Bunny height; each pose keeps its source aspect ratio. */
const BUNNY_H = 62;

/** Charge fill duration (ms) for 0→100 %. */
const CHARGE_FULL_MS = 2000;
/** Ignore accidental taps shorter than roughly 120ms instead of forcing a miss. */
const MIN_CHARGE_LEVEL = 6;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

/** Jump arc height in world-space pixels above the direct line. */
const JUMP_ARC_H = 90;

/** Duration of the jump tween (ms). */
const JUMP_DURATION_MS = 520;

/** Screen Y that the current platform is kept at during play (approx). */
const BUNNY_SCREEN_Y = H * 0.72;

const C = {
  skyTop:        0x87ceeb,
  skyBot:        0xffffff,
  canvasWarm:    0xfaf9f7,
  surface:       0xffffff,
  surfaceTint:   0xf4f2ef,
  border:        0xe8e6e1,
  ink:           0x1a1a19,
  inkSoft:       0x5c5a56,
  bunnyGlow:     0xfacc15,
  chargeEmpty:   0xe8e6e1,
  chargeFill0:   0x22c55e, // low charge
  chargeFill50:  0xfacc15, // mid charge
  chargeFill100: 0xef4444, // full charge
  timerGreen:    0x22c55e,
  timerYellow:   0xfacc15,
  timerRed:      0xef4444,
  comboText:     0x7a3e00,
  perfectGold:   0xfacc15,
  uiPanel:       0xffffff,
  uiBorder:      0xe8e6e1,
  dotActive:     0xf59e0b,
  dotDone:       0x22c55e,
  dotFuture:     0xd4d0c9,
  cardBg:        0xffffff,
  cardBorder:    0xe8e6e1,
  cardSelected:  0xfffbeb,
  submitBtn:     0x08745b,
  submitBtnHov:  0x065e4b,
  overlay:       0x000000,
};

const JR_ASSETS = {
  bunnyHurt: "jr-bunny-hurt",
  bunnyJump: "jr-bunny-jump",
  bunnyReady: "jr-bunny-ready",
  bunnyStand: "jr-bunny-stand",
  carrotGold: "jr-carrot-gold",
  cloud: "jr-cloud",
  platform: "jr-platform-grass",
  platformSmall: "jr-platform-grass-small",
} as const;

const FONT_FAMILY = "Inter, Arial, sans-serif";

// ── Data structures ─────────────────────────────────────────────────────────

interface PlatformData {
  /** World-space centre X. */
  x: number;
  /** World-space top Y. */
  y: number;
  /** Width in pixels. */
  width: number;
  /** Horizontal distance from the previous platform. */
  gap: number;
  /** Index in the sequence (0 = starting platform). */
  index: number;
}

// ── Scene class ─────────────────────────────────────────────────────────────

export class JumpRushScene extends BaseScene {
  // ── Scene-object references ────────────────────────────────────────────────
  private worldContainer!: Phaser.GameObjects.Container;
  private platformObjects: Phaser.GameObjects.Container[] = [];

  private bunny!: Phaser.GameObjects.Container;
  private bunnySprite!: Phaser.GameObjects.Image;
  private bunnyIdleTween: Phaser.Tweens.Tween | null = null;
  private goalCarrot: Phaser.GameObjects.Image | null = null;

  private hudContainer!: Phaser.GameObjects.Container;
  private timerBarFill!: Phaser.GameObjects.Rectangle;
  private comboLabel!: Phaser.GameObjects.Text;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private perfectLabel!: Phaser.GameObjects.Text;
  private submitContainer!: Phaser.GameObjects.Container;
  private submitButtonBg!: Phaser.GameObjects.Graphics;
  private submitLabel!: Phaser.GameObjects.Text;
  private submitHint!: Phaser.GameObjects.Text;

  private chargeBarContainer!: Phaser.GameObjects.Container;
  private chargeFill!: Phaser.GameObjects.Rectangle;
  private chargeTargetBand!: Phaser.GameObjects.Rectangle;
  private chargeHint!: Phaser.GameObjects.Text;

  private lobbyContainer!: Phaser.GameObjects.Container;
  private lobbyStartButton!: Phaser.GameObjects.Container;
  private lobbyStartBg!: Phaser.GameObjects.Graphics;
  private lobbyStartLabel!: Phaser.GameObjects.Text;
  private lobbyStartHint!: Phaser.GameObjects.Text;
  private loadingOverlay!: Phaser.GameObjects.Container;
  private loadingTitle!: Phaser.GameObjects.Text;
  private loadingHint!: Phaser.GameObjects.Text;
  private loadingRetryBg!: Phaser.GameObjects.Graphics;
  private loadingRetryLabel!: Phaser.GameObjects.Text;
  private loadingRetryHint!: Phaser.GameObjects.Text;
  private missOverlay!: Phaser.GameObjects.Container;
  private missUndoBg!: Phaser.GameObjects.Graphics;
  private missUndoLabel!: Phaser.GameObjects.Text;

  // ── Local game state ───────────────────────────────────────────────────────
  private currentPlatformIndex = 0;
  private chargeLevel = 0;          // 0-100
  private isCharging = false;
  private isJumping = false;
  private comboCount = 0;
  private allCleared = false;
  private hasMissed = false;
  private platforms: PlatformData[] = [];

  private chargeStartTime = 0;
  private selectedDifficulty = 0;

  // ── Cached state for change-detection ─────────────────────────────────────
  private prevGameStatus = "";
  private prevGameDifficulty = -1;
  private prevDeadline = 0;
  private prevUndosUsed = 0;
  private prevPlatformsView: Platform[] = [];
  private prevA11yStartPulse = 0;
  private prevA11yJumpPulse = 0;
  private a11yPulsesReady = false;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private ambientTargets: Phaser.GameObjects.GameObject[] = [];

  // ── World dimensions ───────────────────────────────────────────────────────
  private worldHeight = 0;

  constructor() {
    super("JumpRushScene");
  }

  private trackAmbient(...targets: Phaser.GameObjects.GameObject[]): void {
    this.ambientTargets = this.ambientTargets.filter((target) => target.active);
    this.ambientTargets.push(...targets);
  }

  private fitImageHeight(image: Phaser.GameObjects.Image, height: number): Phaser.GameObjects.Image {
    const sourceHeight = Math.max(1, image.height);
    return image.setScale(height / sourceHeight);
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(JR_ASSETS.bunnyHurt, "./art/bunny-hurt.webp");
    this.load.image(JR_ASSETS.bunnyJump, "./art/bunny-jump.webp");
    this.load.image(JR_ASSETS.bunnyReady, "./art/bunny-ready.webp");
    this.load.image(JR_ASSETS.bunnyStand, "./art/bunny-stand.webp");
    this.load.image(JR_ASSETS.carrotGold, "./art/carrot-gold.webp");
    this.load.image(JR_ASSETS.cloud, "./art/cloud.webp");
    this.load.image(JR_ASSETS.platform, "./art/platform-grass.webp");
    this.load.image(JR_ASSETS.platformSmall, "./art/platform-grass-small.webp");
  }

  create(): void {
    super.create(); // wire the GameBridge first

    this.buildBackground();
    this.worldContainer = this.add.container(0, 0);
    this.buildHUD();
    this.buildChargeBar();
    this.buildLobby();
    this.buildLoadingOverlay();
    this.buildMissOverlay();
    this.fitCameraToHost();

    // Pointer / space charge mechanics
    this.input.on("pointerdown", this.onChargeStart, this);
    this.input.on("pointerup",   this.onChargeRelease, this);
    this.input.on("pointerupoutside", this.onChargeRelease, this);
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) ?? null;
    this.spaceKey
      ?.on("down", this.onChargeStart, this)
      .on("up",   this.onChargeRelease, this);
    window.addEventListener("blur", this.onChargeCancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);

    this.onStateUpdate(this.state);
  }

  update(_time: number, _delta: number): void {
    if (this.isCharging && !this.isJumping) {
      const elapsed = this.time.now - this.chargeStartTime;
      this.chargeLevel = Math.min(100, (elapsed / CHARGE_FULL_MS) * 100);
      this.refreshChargeFill();
    }
    this.refreshTimerBar();
  }

  // ── BaseScene abstract implementation ─────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const difficulty = this.num("gameDifficulty", 0);
    const deadline   = this.num("deadline", 0);
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");
    const isSubmitting = this.bool("isSubmitting");
    const undosUsed  = this.num("undosUsed", 0);
    const pView      = (this.val<Platform[]>("platformsView") ?? []) as Platform[];
    const startPulse = this.num("a11yStartPulse", 0);
    const jumpPulse = this.num("a11yJumpPulse", 0);

    if (this.bool("interactionPaused") && this.isCharging) {
      this.onChargeCancel();
    }

    const prevStatus     = this.prevGameStatus;
    const statusChanged  = status !== this.prevGameStatus;
    const difficultyChanged = difficulty !== this.prevGameDifficulty;
    const platformsChanged =
      pView.length !== this.prevPlatformsView.length ||
      pView.some((item, index) => {
        const prior = this.prevPlatformsView[index];
        return !prior || item.x !== prior.x || item.width !== prior.width || item.gap !== prior.gap;
      });
    const undoChanged = undosUsed !== this.prevUndosUsed;

    this.prevGameStatus    = status;
    this.prevGameDifficulty = difficulty;
    this.prevDeadline      = deadline;
    this.prevUndosUsed     = undosUsed;

    if (!this.a11yPulsesReady) {
      this.prevA11yStartPulse = startPulse;
      this.prevA11yJumpPulse = jumpPulse;
      this.a11yPulsesReady = true;
    } else {
      if (startPulse !== this.prevA11yStartPulse) {
        this.prevA11yStartPulse = startPulse;
        if (this.canStartRun()) {
          this.sfx.unlock();
          this.dispatch("startGame", { difficulty: this.selectedDifficulty });
        }
      }
      if (jumpPulse !== this.prevA11yJumpPulse) {
        this.prevA11yJumpPulse = jumpPulse;
        if (this.canAcceptJumpInput()) {
          this.sfx.unlock();
          this.executeJump(Phaser.Math.Clamp(this.num("a11yChargeLevel", 50), 0, 100));
        }
      }
    }

    // Crash-out cue: run expired mid-game (once per transition)
    if (statusChanged && status === "expired" && prevStatus === "dealt") {
      this.sfx.play("lose");
    }

    // Loading overlay (committed / isDealing)
    const showLoading = status === "committed" || isDealing || isStarting;
    this.loadingOverlay.setVisible(showLoading);
    this.refreshLoadingOverlay();
    this.refreshLobbyStartButton();

    if (status !== "dealt") {
      this.clearMissState(false);
    } else if (undoChanged && this.hasMissed) {
      this.clearMissState(true);
    }

    if (status === "idle" || status === "solved" || status === "expired" || status === "refunded") {
      if (pView.length === 0) this.prevPlatformsView = [];
      this.lobbyContainer.setVisible(true);
      this.worldContainer.setVisible(false);
      this.hudContainer.setVisible(false);
      this.chargeBarContainer.setVisible(false);
      this.submitContainer.setVisible(false);
      this.missOverlay.setVisible(false);
      if (statusChanged || difficultyChanged) this.refreshLobbyCards(difficulty);
      return;
    }

    this.lobbyContainer.setVisible(false);
    this.worldContainer.setVisible(true);
    this.hudContainer.setVisible(true);

    if (status === "dealt" && platformsChanged && pView.length > 0) {
      this.prevPlatformsView = pView.map((platform) => ({ ...platform }));
      this.buildGameWorld(pView, difficulty);
      this.currentPlatformIndex = Phaser.Math.Clamp(
        Math.round(this.num("currentPlatform", 0)),
        0,
        Math.max(0, this.platforms.length - 1),
      );
      this.comboCount = Phaser.Math.Clamp(
        Math.round(this.num("comboCount", 0)),
        0,
        this.currentPlatformIndex,
      );
      this.allCleared = this.currentPlatformIndex >= this.platforms.length - 1;
      this.hasMissed = this.bool("missedPlatform") && !this.allCleared;
      this.chargeLevel = 0;
      this.isJumping = false;
      this.isCharging = false;
      this.refreshProgressDots();
      this.refreshCombo();
      this.placeBunnyOnPlatform(this.currentPlatformIndex, false);
      this.refreshChargeTargetBand();
      if (this.hasMissed) {
        this.setBunnyPose("hurt");
        this.stopBunnyIdle();
      } else if (this.allCleared) {
        this.setBunnyPose("idle");
        this.stopBunnyIdle();
      } else {
        this.setBunnyPose("idle");
        this.startBunnyIdle();
      }
      this.refreshMissOverlay();
    }

    if (status === "dealt") {
      this.chargeBarContainer.setVisible(
        !this.allCleared &&
        !this.hasMissed &&
        !this.bool("timeUp") &&
        !this.bool("submitWindowClosed"),
      );
      this.submitContainer.setVisible(
        !this.hasMissed && !isSubmitting &&
        (this.allCleared || this.canReleaseRun() || this.bool("timeUp")),
      );
      this.refreshSubmitButton();
      this.refreshMissOverlay();
    }
  }

  // ── Localization ───────────────────────────────────────────────────────────

  /**
   * Resolve an in-canvas string from the localized `sceneText` map pushed
   * through bridgeState (built in PhaserPlayArea from messages.ts). Falls back
   * to a plain-English default only when no bridge state is present (standalone
   * dev); production and the capture harness always supply the localized map.
   */
  private tr(key: string, fallback = ""): string {
    const map = this.val<Record<string, string>>("sceneText") ?? {};
    const value = map[key];
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  /** Localized display copy for a difficulty card, sourced from bridgeState. */
  private cardText(diffIdx: number): { label: string; jumps: string; reward: string; entry: string } {
    const rules =
      this.val<Array<{
        difficulty: number;
        label?: string;
        jumpsText?: string;
        rewardText?: string;
        entryText?: string;
      }>>("difficultyRules") ?? [];
    const found = rules.find((r) => r.difficulty === diffIdx);
    const rule = DIFFICULTY_RULES[diffIdx];
    return {
      label:  found?.label      ?? (rule ? rule.key.toUpperCase() : ""),
      jumps:  found?.jumpsText   ?? (rule ? `${rule.targetJumps} jumps` : ""),
      reward: found?.rewardText  ?? (rule ? `${gasDisplay(rule.rewardFixed8)} GAS` : ""),
      entry:  found?.entryText   ?? (rule ? `Entry ${gasDisplay(rule.entryFixed8)}` : ""),
    };
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.canvasWarm);
    this.add.rectangle(W / 2, H * 0.32, W, H * 0.64, C.skyTop, 0.42);
    this.add.rectangle(W / 2, H * 0.72, W, H * 0.2, C.skyBot, 0.72);

    const gfx = this.add.graphics();
    gfx.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1, 1, 1, 1);
    gfx.fillRect(0, 0, W, H * 0.82);

    const clouds = [
      { x: 86, y: 58, scale: 0.34, alpha: 0.72, drift: 8 },
      { x: 296, y: 108, scale: 0.28, alpha: 0.58, drift: -10 },
      { x: 168, y: 164, scale: 0.22, alpha: 0.36, drift: 6 },
    ];
    for (const cloud of clouds) {
      const sprite = this.add.image(cloud.x, cloud.y, JR_ASSETS.cloud)
        .setScale(cloud.scale)
        .setAlpha(cloud.alpha);
      this.trackAmbient(sprite);
      // Ambient drift is pure decoration — skip entirely under reduced-motion.
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: sprite,
          x: cloud.x + cloud.drift,
          duration: 2400,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  // ── Platform world ─────────────────────────────────────────────────────────

  /**
   * Decode a platformsView byte array into visual PlatformData, then
   * instantiate all platform containers inside worldContainer.
   */
  private buildGameWorld(view: Platform[], difficulty: number): void {
    // Remove previous platform objects
    this.stopBunnyIdle();
    for (const obj of this.platformObjects) {
      this.tweens.killTweensOf(obj.getAll());
      obj.destroy();
    }
    this.platformObjects = [];
    if (this.bunny?.active) {
      this.tweens.killTweensOf(this.bunny.getAll());
      this.tweens.killTweensOf(this.bunny);
    }
    this.bunny?.destroy();
    this.goalCarrot = null;

    const platformCount = Math.max(2, view.length);
    this.platforms = this.decodePlatforms(view, platformCount, difficulty);
    this.worldHeight = (this.platforms[0]?.y ?? 0) + 80;

    // Build progress dots
    this.buildProgressDots(platformCount);

    // Create platform containers
    for (const pd of this.platforms) {
      const cont = this.buildPlatformTile(pd);
      this.platformObjects.push(cont);
      this.worldContainer.add(cont);
    }

    // Create bunny on first platform
    this.bunny = this.buildBunny();
    this.worldContainer.add(this.bunny);
    this.placeBunnyOnPlatform(0, false);

  }

  /** Decode raw view bytes into platform layout with world-space positions. */
  private decodePlatforms(view: Platform[], count: number, difficulty: number): PlatformData[] {
    const out: PlatformData[] = [];

    // Starting platform: centred horizontally, near "bottom" of world
    const startX = W / 2;
    const startY = 100 + (count - 1) * ((VERT_GAP_MIN + VERT_GAP_MAX) / 2);
    out.push({
      x: startX,
      y: startY,
      width: Phaser.Math.Clamp(view[0]?.width ?? 120, PLATFORM_MIN_W, PLATFORM_MIN_W + PLATFORM_RANGE_W),
      gap: 0,
      index: 0,
    });

    // Horizontal jitter seeds based on view bytes
    for (let i = 1; i < count; i++) {
      const raw = view[i];
      if (!raw) continue;
      const gap = Phaser.Math.Clamp(Number(raw.gap) || 1, 1, 260);
      const width = Phaser.Math.Clamp(Number(raw.width) || PLATFORM_MIN_W, PLATFORM_MIN_W, PLATFORM_MIN_W + PLATFORM_RANGE_W);

      // Vertical: higher difficulty → larger gaps
      const gapRange  = VERT_GAP_MAX - VERT_GAP_MIN;
      const diffScale = difficulty === 0 ? 0.3 : difficulty === 1 ? 0.6 : 1.0;
      const vertGap   = VERT_GAP_MIN + Math.floor(diffScale * (gap / 260) * gapRange);

      // Horizontal: alternating left/mid/right based on byte modulo
      const xPositions = [W * 0.2, W * 0.4, W * 0.5, W * 0.6, W * 0.8];
      const xIdx       = gap % xPositions.length;
      const x          = xPositions[xIdx] ?? W / 2;

      const prev = out[out.length - 1];
      if (!prev) continue;
      out.push({ x, y: prev.y - vertGap, width, gap, index: i });
    }
    return out;
  }

  /** Build a single grass-topped platform tile. */
  private buildPlatformTile(pd: PlatformData): Phaser.GameObjects.Container {
    const cont = this.add.container(pd.x, pd.y);
    const platformKey = pd.width < 92 ? JR_ASSETS.platformSmall : JR_ASSETS.platform;
    const platformAspect = platformKey === JR_ASSETS.platformSmall ? 100 / 201 : 94 / 380;
    const sprite = this.add.image(0, 0, platformKey)
      .setOrigin(0.5, 0)
      .setDisplaySize(pd.width, pd.width * platformAspect);
    cont.add(sprite);

    if (pd.index === this.platforms.length - 1) {
      const carrot = this.add.image(0, -24, JR_ASSETS.carrotGold);
      this.fitImageHeight(carrot, 28);
      this.trackAmbient(carrot);
      cont.add(carrot);
      this.goalCarrot = carrot;
      // Gentle hover on the goal reward — ambient loop, gated for reduced-motion.
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: carrot,
          y: -30,
          duration: 700,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
      }
    }

    return cont;
  }

  // ── Bunny ──────────────────────────────────────────────────────────────────

  private buildBunny(): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);

    const shadow = this.add.ellipse(0, 3, 38, 10, 0x1a1a19, 0.16);
    this.bunnySprite = this.add.image(0, 0, JR_ASSETS.bunnyStand)
      .setOrigin(0.5, 1);
    this.fitImageHeight(this.bunnySprite, BUNNY_H);
    cont.add([shadow, this.bunnySprite]);
    return cont;
  }

  private setBunnyPose(pose: "idle" | "ready" | "jump" | "hurt"): void {
    if (!this.bunnySprite) return;
    const texture = pose === "ready"
      ? JR_ASSETS.bunnyReady
      : pose === "jump"
        ? JR_ASSETS.bunnyJump
        : pose === "hurt"
          ? JR_ASSETS.bunnyHurt
          : JR_ASSETS.bunnyStand;
    this.bunnySprite.setTexture(texture);
    this.fitImageHeight(this.bunnySprite, BUNNY_H);
  }

  private startBunnyIdle(): void {
    this.bunnyIdleTween?.stop();
    this.bunnyIdleTween = null;
    if (!this.bunny || this.reducedMotion) return;
    this.bunnyIdleTween = this.tweens.add({
      targets:  this.bunny,
      y:        this.bunny.y - 6,
      duration: 700,
      ease:     "Sine.easeInOut",
      yoyo:     true,
      repeat:   -1,
    });
  }

  private stopBunnyIdle(): void {
    this.bunnyIdleTween?.stop();
    this.bunnyIdleTween = null;
  }

  /** Honor a live prefers-reduced-motion toggle: kill the idle loop at once. */
  protected onReducedMotionChange(enabled: boolean): void {
    if (enabled) {
      this.stopBunnyIdle();
      for (const target of this.ambientTargets) {
        if (target.active) this.tweens.killTweensOf(target);
      }
    } else if (
      this.bunny &&
      this.str("gameStatus") === "dealt" &&
      !this.allCleared &&
      !this.hasMissed
    ) {
      this.startBunnyIdle();
    }
  }

  // ── Charge bar ─────────────────────────────────────────────────────────────

  private buildChargeBar(): void {
    const barW  = W - 48;
    const barH  = 22;
    const barY  = H - 52;
    const barX  = W / 2;

    this.chargeBarContainer = this.add.container(barX, barY);

    // Background track
    const track = this.add.rectangle(0, 0, barW, barH, C.chargeEmpty, 1)
      .setStrokeStyle(2, C.border)
      .setOrigin(0.5);

    // Fill (starts at width=0, anchored to left edge)
    this.chargeFill = this.add.rectangle(
      -(barW / 2),
      0,
      0,
      barH - 4,
      C.chargeFill0,
    ).setOrigin(0, 0.5);

    // The gold band marks the perfect-landing window for the next platform.
    // It teaches distance through play without exposing numeric parameters.
    this.chargeTargetBand = this.add.rectangle(0, 0, 0, barH - 2, C.perfectGold, 0.34)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xffffff, 0.92)
      .setVisible(false);

    // Label — placed ABOVE the bar so it clears the progress-dot row that sits
    // just below the charge bar (avoids a text/dots collision during play).
    this.chargeHint = this.add.text(0, -(barH / 2 + 11), this.tr("chargeHold", "Hold to charge"), {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.chargeBarContainer.add([track, this.chargeFill, this.chargeTargetBand, this.chargeHint]);
  }

  private refreshChargeTargetBand(): void {
    if (!this.chargeTargetBand) return;
    const target = this.platforms[this.currentPlatformIndex + 1];
    if (!target) {
      this.chargeTargetBand.setVisible(false);
      return;
    }
    const barW = W - 48;
    const usableW = barW - 4;
    const distance = Math.max(1, target.gap + target.width);
    const startPct = Phaser.Math.Clamp((target.gap + target.width * 0.35) / distance, 0, 1);
    const endPct = Phaser.Math.Clamp((target.gap + target.width * 0.65) / distance, startPct, 1);
    this.chargeTargetBand
      .setPosition(-(barW / 2) + 2 + startPct * usableW, 0)
      .setSize(Math.max(4, (endPct - startPct) * usableW), 20)
      .setVisible(true);
  }

  private refreshChargeFill(): void {
    if (!this.chargeFill) return;
    const barW    = W - 48;
    const fillW   = (this.chargeLevel / 100) * (barW - 4);
    this.chargeFill.setSize(fillW, 18);

    // Colour interpolation: green → yellow → red
    let color: number;
    if (this.chargeLevel < 50) {
      color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(C.chargeFill0),
        Phaser.Display.Color.ValueToColor(C.chargeFill50),
        100,
        this.chargeLevel * 2,
      ).color;
    } else {
      color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(C.chargeFill50),
        Phaser.Display.Color.ValueToColor(C.chargeFill100),
        100,
        (this.chargeLevel - 50) * 2,
      ).color;
    }
    this.chargeFill.setFillStyle(color);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    this.hudContainer = this.add.container(0, 0);

    // Timer bar (top strip, full width)
    const timerTrack = this.add.rectangle(W / 2, 10, W - 24, 8, 0xffffff, 0.78)
      .setStrokeStyle(1, C.border);
    this.timerBarFill = this.add.rectangle(12, 10, W - 24, 6, C.timerGreen)
      .setOrigin(0, 0.5);

    // Combo label (top-left)
    this.comboLabel = this.add.text(16, 28, "", {
      fontSize:  "20px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#7a3e00",
      stroke:    "#fff7d6",
      strokeThickness: 2,
    });

    // Perfect-landing label (centre, hidden by default)
    this.perfectLabel = this.add.text(W / 2, H * 0.42, this.tr("perfect", "Perfect!"), {
      fontSize:  "26px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#7a3e00",
      stroke:    "#fff7d6",
      strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false);

    // Progress dots row (bottom-centre, above charge bar)
    this.buildProgressDots(10);

    // Submit button (centred, shown when all cleared)
    this.submitContainer = this.buildSubmitButton();

    this.hudContainer.add([
      timerTrack,
      this.timerBarFill,
      this.comboLabel,
      this.perfectLabel,
      this.submitContainer,
    ]);
    this.submitContainer.setVisible(false);
  }

  private buildProgressDots(count: number): void {
    // Remove old dots from HUD
    for (const d of this.progressDots) d.destroy();
    this.progressDots = [];

    const dotR    = 5;
    const spacing = 14;
    const visible = Math.min(count, 14);
    const totalW  = visible * spacing - spacing + dotR * 2;
    const startX  = W / 2 - totalW / 2 + dotR;
    const dotY    = H - 14;

    for (let i = 0; i < visible; i++) {
      const dot = this.add.circle(startX + i * spacing, dotY, dotR, C.dotFuture);
      this.progressDots.push(dot);
      this.hudContainer?.add(dot);
    }
  }

  private buildSubmitButton(): Phaser.GameObjects.Container {
    const cont = this.add.container(W / 2, H * 0.5);

    this.submitButtonBg = this.add.graphics();
    const hit = this.add.zone(0, 0, 198, 66)
      .setInteractive({ useHandCursor: true });

    hit.on("pointerover",  () => this.refreshSubmitButton(true));
    hit.on("pointerout",   () => this.refreshSubmitButton(false));
    hit.on("pointerdown",  () => {
      this.sfx.unlock();
      if (this.canReleaseRun()) {
        this.tween({ targets: cont, scale: 0.94, duration: 60, yoyo: true });
        this.dispatch("expireGame", {});
        return;
      }
      if (!this.canSubmitRun()) {
        this.tween({ targets: cont, x: W / 2 + 4, duration: 40, yoyo: true, repeat: 2 });
        return;
      }
      this.tween({ targets: cont, scale: 0.94, duration: 60, yoyo: true });
      this.dispatch("submitRun", {});
    });

    this.submitLabel = this.add.text(0, -7, this.tr("submitRun", "Submit run"), {
      fontSize:  "17px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#ffffff",
    }).setOrigin(0.5);

    this.submitHint = this.add.text(0, 15, this.tr("submitSettleHint", "TEE settlement"), {
      fontSize:  "10px",
      fontFamily: FONT_FAMILY,
      color:     "#ffffff",
    }).setOrigin(0.5).setAlpha(0.94);

    cont.add([this.submitButtonBg, hit, this.submitLabel, this.submitHint]);
    this.refreshSubmitButton();
    return cont;
  }

  private canSubmitRun(): boolean {
    return (
      this.str("gameStatus") === "dealt" &&
      this.allCleared &&
      !this.hasMissed &&
      this.bool("minSolveReached") &&
      !this.bool("timeUp") &&
      !this.bool("submitWindowClosed") &&
      !this.bool("isSubmitting")
    );
  }

  private canReleaseRun(): boolean {
    return (
      this.str("gameStatus") === "dealt" &&
      this.bool("canReleaseRun") &&
      !this.bool("isSubmitting")
    );
  }

  private refreshSubmitButton(hover = false): void {
    if (!this.submitButtonBg || !this.submitLabel || !this.submitHint) return;
    const canSubmit = this.canSubmitRun();
    const canRelease = this.canReleaseRun();
    const isActive = canSubmit || canRelease;
    const antiBotWaitMs = this.bool("minSolveReached")
      ? 0
      : this.minSolveRemainingMs();

    this.submitButtonBg.clear();
    this.submitButtonBg.fillStyle(
      canSubmit
        ? (hover ? C.submitBtnHov : C.submitBtn)
        : canRelease
          ? (hover ? 0xdc2626 : C.timerRed)
          : 0xd4d0c9,
      1,
    );
    this.submitButtonBg.fillRoundedRect(-104, -30, 208, 60, 12);
    this.submitButtonBg.lineStyle(
      2,
      canSubmit ? C.submitBtnHov : canRelease ? 0xdc2626 : 0xb8b1a6,
      1,
    );
    this.submitButtonBg.strokeRoundedRect(-104, -30, 208, 60, 12);
    this.submitLabel.setColor(isActive ? "#ffffff" : "#4b443c");
    this.submitHint.setColor(isActive ? "#ffffff" : "#6d645b");
    this.submitHint.setAlpha(isActive ? 0.82 : 1);

    if (canSubmit) {
      this.submitLabel.setText(this.tr("submitRun", "Submit run"));
      this.submitHint.setText(this.tr("submitVerifiedHint", "Verified payout"));
      return;
    }

    if (canRelease) {
      this.submitLabel.setText(this.tr("timeExpired", "Time expired"));
      this.submitHint.setText(this.tr("releaseThisRun", "Release this run"));
    } else if (this.bool("timeUp")) {
      this.submitLabel.setText(
        this.tr("waitLabel", "Wait {clock}").replace(
          "{clock}",
          formatClock(this.num("recoveryWaitMs", 0)),
        ),
      );
      this.submitHint.setText(this.tr("recoveryWindow", "Contract recovery window"));
    } else if (!this.bool("minSolveReached")) {
      const lockedMs = Math.max(0, antiBotWaitMs || SUBMIT_BUFFER_MS);
      this.submitLabel.setText(
        this.tr("waitLabel", "Wait {clock}").replace("{clock}", formatClock(lockedMs)),
      );
      this.submitHint.setText(this.tr("antiBotFloor", "Anti-bot floor"));
    } else {
      this.submitLabel.setText(this.tr("keepJumping", "Keep jumping"));
      this.submitHint.setText(this.tr("targetNotCleared", "Target not cleared"));
    }
  }

  private minSolveRemainingMs(): number {
    const difficulty = this.num("gameDifficulty", 0);
    const elapsed = this.num("elapsedMs", 0);
    const rules = (this.val<Array<{ difficulty: number; minSolveMs: number }>>("difficultyRules") ?? []);
    const rule = rules.find((item) => item.difficulty === difficulty);
    return Math.max(0, (rule?.minSolveMs ?? 0) + MIN_SOLVE_BUFFER_MS - elapsed);
  }

  private refreshTimerBar(): void {
    if (!this.timerBarFill) return;
    const deadline = this.num("deadline", 0);
    if (deadline <= 0) { this.timerBarFill.setSize(W - 24, 6); return; }
    const dealtAt = this.num("dealtAt", 0);
    const limitMs = deadline - dealtAt;
    if (limitMs <= 0) { this.timerBarFill.setSize(0, 6); return; }
    const remaining = Math.max(0, deadline - Date.now());
    const fraction  = remaining / limitMs;
    this.timerBarFill.setSize((W - 24) * fraction, 6);
    const color = fraction > 0.5 ? C.timerGreen : fraction > 0.25 ? C.timerYellow : C.timerRed;
    this.timerBarFill.setFillStyle(color);
  }

  private refreshProgressDots(): void {
    const total = this.platforms.length;
    const visible = this.progressDots.length;
    const windowStart = Math.max(
      0,
      Math.min(total - visible, this.currentPlatformIndex - Math.floor(visible / 2)),
    );
    for (let i = 0; i < visible && i < total; i++) {
      const dot = this.progressDots[i];
      if (!dot) continue;
      const logicalIndex = windowStart + i;
      if (logicalIndex < this.currentPlatformIndex) {
        dot.setFillStyle(C.dotDone);
      } else if (logicalIndex === this.currentPlatformIndex) {
        dot.setFillStyle(C.dotActive);
      } else {
        dot.setFillStyle(C.dotFuture);
      }
    }
  }

  private refreshCombo(): void {
    if (!this.comboLabel) return;
    this.comboLabel.setText(this.comboCount > 1 ? `x${this.comboCount}` : "");
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0).setDepth(20);

    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.12);
    const heroCloud = this.add.image(W - 76, 80, JR_ASSETS.cloud)
      .setScale(0.24)
      .setAlpha(0.72);
    const heroPlatform = this.add.image(W / 2, 214, JR_ASSETS.platform)
      .setDisplaySize(250, 250 * (94 / 380))
      .setAlpha(0.98);
    const heroBunny = this.add.image(W / 2, 204, JR_ASSETS.bunnyJump)
      .setOrigin(0.5, 1);
    this.fitImageHeight(heroBunny, 92);
    const carrot = this.add.image(W / 2 + 104, 186, JR_ASSETS.carrotGold);
    this.fitImageHeight(carrot, 30);
    this.trackAmbient(heroBunny, carrot);

    // Hero idle + carrot bob are ambient loops — only run them with motion on.
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: heroBunny,
        y: 190,
        duration: 760,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
      this.tweens.add({
        targets: carrot,
        angle: 8,
        y: 178,
        duration: 900,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    this.lobbyContainer.add([veil, heroCloud, heroPlatform, heroBunny, carrot]);
    this.buildDifficultyCards();
    this.lobbyContainer.add(this.buildLobbyHint());
    this.lobbyStartButton = this.buildLobbyStartButton();
    this.lobbyContainer.add(this.lobbyStartButton);
    this.lobbyContainer.setVisible(true);
  }

  /**
   * Fills the empty band between the difficulty cards and the start button with
   * a compact "how to play" hint, teaching the charge-and-release mechanic
   * before the player commits. Localized via bridgeState.
   */
  private buildLobbyHint(): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const y = 446;
    const pill = this.add.graphics();
    pill.fillStyle(0xffffff, 0.68);
    pill.fillRoundedRect(W / 2 - 132, y - 14, 264, 28, 14);
    pill.lineStyle(1, C.border, 1);
    pill.strokeRoundedRect(W / 2 - 132, y - 14, 264, 28, 14);

    // A tiny charge-bar glyph to visually anchor the mechanic.
    const glyph = this.add.graphics();
    glyph.fillStyle(C.chargeEmpty, 1);
    glyph.fillRoundedRect(W / 2 - 118, y - 4, 26, 8, 4);
    glyph.fillStyle(C.chargeFill50, 1);
    glyph.fillRoundedRect(W / 2 - 118, y - 4, 16, 8, 4);

    const hint = this.add.text(W / 2 + 6, y, this.tr("chargeTip", "Hold to charge, release to jump"), {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      fontStyle: "bold",
    }).setOrigin(0.5);

    cont.add([pill, glyph, hint]);
    return cont;
  }

  private buildDifficultyCards(): void {
    const cardW   = 112;
    const cardH   = 112;
    const spacing = 124;
    const startX  = W / 2 - spacing;
    const cardY   = 346;

    for (let i = 0; i < DIFFICULTY_RULES.length; i++) {
      const rule = DIFFICULTY_RULES[i];
      if (!rule) continue;
      const x    = startX + i * spacing;
      const card = this.buildDifficultyCard(x, cardY, cardW, cardH, rule, i);
      this.lobbyContainer.add(card);
    }
  }

  private buildDifficultyCard(
    x: number, y: number, w: number, h: number,
    _rule: (typeof DIFFICULTY_RULES)[number], diffIdx: number,
  ): Phaser.GameObjects.Container {
    const cont = this.add.container(x, y);
    const isSelected = diffIdx === this.selectedDifficulty;

    const bg = this.add.graphics();
    const drawCard = (fill: number, alpha: number, stroke: number): void => {
      bg.clear();
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(2, stroke, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawCard(isSelected ? C.cardSelected : C.cardBg, isSelected ? 0.98 : 0.92, isSelected ? 0xf59e0b : C.cardBorder);

    bg.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on("pointerover",  () => drawCard(0xfffbeb, 1, 0xf59e0b));
    bg.on("pointerout",   () =>
      drawCard(isSelected ? C.cardSelected : C.cardBg, isSelected ? 0.98 : 0.92, isSelected ? 0xf59e0b : C.cardBorder));
    bg.on("pointerdown",  () => {
      this.selectedDifficulty = diffIdx;
      this.dispatch("selectDifficulty", { difficulty: diffIdx });
      this.tween({ targets: cont, scale: 0.95, duration: 60, yoyo: true });
      // Re-render all cards to reflect new selection
      this.rebuildLobby();
      this.lobbyContainer.setVisible(true);
    });

    const copy = this.cardText(diffIdx);

    // Route-height motif: a rising staircase of grass platforms whose step count
    // encodes the difficulty (Meadow 1 · Cloud 2 · Summit 3) so the climb reads
    // at a glance even before reading the label.
    const steps = diffIdx + 1;
    const stepW = 20;
    const stepH = 6;
    const stepDX = 14;
    const stepDY = 9;
    // Bunny stands centred on the TOP step; lower steps trail down to the left,
    // so the climb reads at a glance while the focal bunny stays centred.
    const stairBaseX = -((steps - 1) * stepDX);
    const stairBaseY = -14;
    const stairs = this.add.graphics();
    for (let s = 0; s < steps; s++) {
      const cx = stairBaseX + s * stepDX;
      const cy = stairBaseY - s * stepDY;
      stairs.fillStyle(0x8a5a34, 0.9); // dirt band under the grass cap
      stairs.fillRoundedRect(cx - stepW / 2, cy - stepH / 2 + 2, stepW, stepH, 2);
      stairs.fillStyle(C.dotDone, 1);  // grass cap
      stairs.fillRoundedRect(cx - stepW / 2, cy - stepH / 2 - 1, stepW, stepH - 1, 2);
    }

    const iconKeys = [JR_ASSETS.bunnyStand, JR_ASSETS.bunnyReady, JR_ASSETS.bunnyJump] as const;
    const bunnyX = 0;
    const bunnyY = stairBaseY - (steps - 1) * stepDY - 3;
    const icon = this.add.image(bunnyX, bunnyY, iconKeys[diffIdx] ?? JR_ASSETS.bunnyStand)
      .setOrigin(0.5, 1);
    this.fitImageHeight(icon, 40);

    // Difficulty name
    const name = this.add.text(0, -h / 2 + 52, copy.label, {
      fontSize:  "13px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#1a1a19",
    }).setOrigin(0.5);

    const jumpsLabel = this.add.text(0, -h / 2 + 71, copy.jumps, {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color:    "#5c5a56",
    }).setOrigin(0.5);

    const rewardLabel = this.add.text(0, -h / 2 + 89, copy.reward, {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#08745b",
    }).setOrigin(0.5);

    const entryLabel = this.add.text(0, h / 2 - 14, copy.entry, {
      fontSize: "10px",
      fontFamily: FONT_FAMILY,
      color:    "#5c5a56",
    }).setOrigin(0.5);

    const selectedDot = this.add.circle(-w / 2 + 13, -h / 2 + 13, 5, 0xf59e0b, isSelected ? 1 : 0);
    cont.add([bg, stairs, icon, name, jumpsLabel, rewardLabel, entryLabel, selectedDot]);

    return cont;
  }

  private buildLobbyStartButton(): Phaser.GameObjects.Container {
    const cont = this.add.container(W / 2, H - 72);
    this.lobbyStartBg = this.add.graphics();
    this.lobbyStartBg.setInteractive(
      new Phaser.Geom.Rectangle(-106, -22, 212, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.lobbyStartLabel = this.add.text(0, -4, this.tr("startJump", "Start jump"), {
      fontSize: "15px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.lobbyStartHint = this.add.text(0, 14, "", {
      fontSize: "10px",
      fontFamily: FONT_FAMILY,
      color: "#ffffff",
    }).setOrigin(0.5).setAlpha(0.94);

    this.lobbyStartBg.on("pointerover", () => this.refreshLobbyStartButton(true));
    this.lobbyStartBg.on("pointerout", () => this.refreshLobbyStartButton(false));
    this.lobbyStartBg.on("pointerdown", () => {
      this.sfx.unlock();
      if (!this.canStartRun()) {
        this.tween({ targets: cont, x: W / 2 + 4, duration: 40, yoyo: true, repeat: 2 });
        return;
      }
      this.sfx.play("start");
      this.tween({ targets: cont, scale: 0.96, duration: 80, yoyo: true });
      this.dispatch("startGame", { difficulty: this.selectedDifficulty });
    });

    cont.add([this.lobbyStartBg, this.lobbyStartLabel, this.lobbyStartHint]);
    this.refreshLobbyStartButton();
    return cont;
  }

  private canStartRun(): boolean {
    const status = this.str("gameStatus", "idle");
    return (
      (status === "idle" || status === "solved" || status === "expired" || status === "refunded") &&
      !this.bool("isStarting") &&
      !this.bool("isDealing") &&
      !this.bool("isSubmitting") &&
      this.poolCanCoverSelectedRoute()
    );
  }

  private poolCanCoverSelectedRoute(): boolean {
    const poolFree = this.num("poolFree", 0);
    const rules = (this.val<Array<{ difficulty: number; rewardGas: number }>>("difficultyRules") ?? []);
    const rule = rules.find((item) => item.difficulty === this.selectedDifficulty);
    return poolFree >= (rule?.rewardGas ?? 0);
  }

  private refreshLobbyStartButton(hover = false): void {
    if (!this.lobbyStartBg || !this.lobbyStartLabel || !this.lobbyStartHint) return;
    const canStart = this.canStartRun();
    const isBusy = this.bool("isStarting") || this.bool("isDealing");

    this.lobbyStartBg.clear();
    if (canStart) {
      // Live brand-green CTA.
      this.lobbyStartBg.fillStyle(hover ? C.submitBtnHov : C.submitBtn, 1);
      this.lobbyStartBg.fillRoundedRect(-106, -24, 212, 48, 12);
      this.lobbyStartBg.lineStyle(2, C.submitBtnHov, 1);
      this.lobbyStartBg.strokeRoundedRect(-106, -24, 212, 48, 12);
      this.lobbyStartLabel.setColor("#ffffff");
      this.lobbyStartHint.setColor("#ffffff");
      this.lobbyStartHint.setAlpha(0.94);
      this.lobbyStartLabel.setText(this.tr("startJump", "Start jump"));
      this.lobbyStartHint.setText(this.tr("startSealHint", "Pay entry and seal route"));
      return;
    }

    // Disabled reads as PENDING, not broken: a warm, brand-tinted ghost fill
    // with a green outline instead of a heavy grey slab. Busy states surface a
    // "Loading route…" hint so the wait reads as progress.
    this.lobbyStartBg.fillStyle(isBusy ? 0xe7f4ec : 0xf1efe9, 1);
    this.lobbyStartBg.fillRoundedRect(-106, -24, 212, 48, 12);
    this.lobbyStartBg.lineStyle(2, C.submitBtn, isBusy ? 0.7 : 0.4);
    this.lobbyStartBg.strokeRoundedRect(-106, -24, 212, 48, 12);
    this.lobbyStartLabel.setColor(isBusy ? "#08745b" : "#5c5148");
    this.lobbyStartHint.setColor(isBusy ? "#08745b" : "#5c5a56");
    this.lobbyStartHint.setAlpha(isBusy ? 0.9 : 0.95);
    this.lobbyStartLabel.setText(isBusy ? this.tr("preparing", "Preparing…") : this.tr("startJump", "Start jump"));
    this.lobbyStartHint.setText(
      isBusy
        ? this.tr("loadingRouteHint", "Loading route…")
        : this.tr("poolRefilling", "Pool low — this paid route is unavailable"),
    );
  }

  private refreshLobbyCards(currentDifficulty: number): void {
    const changed = this.selectedDifficulty !== currentDifficulty;
    this.selectedDifficulty = currentDifficulty;
    if (changed && this.lobbyContainer?.active) {
      this.rebuildLobby();
      this.lobbyContainer.setVisible(true);
    }
  }

  private rebuildLobby(): void {
    if (this.lobbyContainer?.active) {
      this.tweens.killTweensOf(this.lobbyContainer.getAll());
      this.lobbyContainer.destroy();
    }
    this.buildLobby();
  }

  // ── Loading overlay ────────────────────────────────────────────────────────

  private buildLoadingOverlay(): void {
    this.loadingOverlay = this.add.container(W / 2, H / 2);

    const bg = this.add.rectangle(0, 0, W, H, 0xffffff, 0.68).setOrigin(0.5);
    const panel = this.add.rectangle(0, 0, 264, 208, C.surface, 0.96)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    const platform = this.add.image(0, 42, JR_ASSETS.platformSmall)
      .setDisplaySize(150, 150 * (100 / 201));
    const bunny = this.add.image(0, 26, JR_ASSETS.bunnyJump)
      .setOrigin(0.5, 1);
    this.fitImageHeight(bunny, 64);

    this.loadingTitle = this.add.text(0, -74, this.tr("preparingPlatforms", "Preparing platforms"), {
      fontSize: "16px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:    "#1a1a19",
    }).setOrigin(0.5);

    this.loadingHint = this.add.text(0, -50, this.tr("sealingFairRoute", "TEE is sealing a fair route"), {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
    }).setOrigin(0.5);

    this.loadingRetryBg = this.add.graphics();
    this.loadingRetryBg.setInteractive(
      new Phaser.Geom.Rectangle(-92, 63, 184, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.loadingRetryBg.on("pointerover", () => this.refreshLoadingOverlay(true));
    this.loadingRetryBg.on("pointerout", () => this.refreshLoadingOverlay(false));
    this.loadingRetryBg.on("pointerdown", () => {
      if (!this.canRetryDeal()) return;
      this.sfx.unlock();
      this.tween({ targets: this.loadingOverlay, scale: 0.98, duration: 60, yoyo: true });
      this.dispatch("retryDeal", {});
    });
    this.loadingRetryLabel = this.add.text(0, 85, this.tr("retryDeal", "Retry sealing"), {
      fontSize:  "12px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#ffffff",
    }).setOrigin(0.5);
    this.loadingRetryHint = this.add.text(0, 113, this.tr("retryDealHint", "Sealing is taking longer than usual"), {
      fontSize:  "10px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      align:     "center",
      wordWrap:  { width: 210 },
    }).setOrigin(0.5);

    // Hopping loader — ambient loop, gated for reduced-motion.
    if (!this.reducedMotion) {
      this.trackAmbient(bunny);
      this.tweens.add({
        targets:  bunny,
        y:        12,
        duration: 520,
        ease:     "Sine.easeInOut",
        yoyo:     true,
        repeat:   -1,
      });
    }

    this.loadingOverlay.add([
      bg,
      panel,
      this.loadingTitle,
      this.loadingHint,
      platform,
      bunny,
      this.loadingRetryBg,
      this.loadingRetryLabel,
      this.loadingRetryHint,
    ]);
    this.refreshLoadingOverlay();
    this.loadingOverlay.setVisible(false);
  }

  private canRetryDeal(): boolean {
    return (
      this.str("gameStatus") === "committed" &&
      !this.bool("isStarting") &&
      !this.bool("isDealing")
    );
  }

  private refreshLoadingOverlay(hover = false): void {
    if (!this.loadingRetryBg || !this.loadingRetryLabel || !this.loadingRetryHint) return;
    const status = this.str("gameStatus", "idle");
    const showRetry = status === "committed";
    const canRetry = this.canRetryDeal();

    this.loadingTitle?.setText(this.tr("preparingPlatforms", "Preparing platforms"));
    this.loadingHint?.setText(
      canRetry
        ? this.tr("retryDealHint", "Sealing is taking longer than usual")
        : this.tr("sealingFairRoute", "TEE is sealing a fair route"),
    );
    this.loadingRetryBg.clear();
    this.loadingRetryBg.setVisible(showRetry);
    this.loadingRetryLabel.setVisible(showRetry);
    this.loadingRetryHint.setVisible(showRetry);
    this.loadingRetryBg.fillStyle(canRetry ? (hover ? C.submitBtnHov : C.submitBtn) : 0xd4d0c9, 1);
    this.loadingRetryBg.fillRoundedRect(-92, 63, 184, 44, 10);
    this.loadingRetryBg.lineStyle(2, canRetry ? C.submitBtnHov : 0xb8b1a6, 1);
    this.loadingRetryBg.strokeRoundedRect(-92, 63, 184, 44, 10);
    this.loadingRetryLabel.setColor(canRetry ? "#ffffff" : "#4b443c");
    this.loadingRetryLabel.setText(this.tr("retryDeal", "Retry sealing"));
    this.loadingRetryHint.setText(this.tr("retryDealHint", "Sealing is taking longer than usual"));
  }

  private buildMissOverlay(): void {
    this.missOverlay = this.add.container(W / 2, H / 2).setDepth(40);

    const dim = this.add.rectangle(0, 0, W, H, C.overlay, 0.18).setOrigin(0.5);
    const panel = this.add.rectangle(0, 0, 260, 178, C.surface, 0.96)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    const bunny = this.add.image(0, -42, JR_ASSETS.bunnyHurt)
      .setOrigin(0.5, 1);
    this.fitImageHeight(bunny, 64);
    const title = this.add.text(0, -26, this.tr("missedTitle", "Missed the platform"), {
      fontSize:  "17px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#1a1a19",
    }).setOrigin(0.5);
    const copy = this.add.text(0, -2, this.tr("missedCopy", "Use an undo or wait for expiry."), {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      align:     "center",
      wordWrap:  { width: 206 },
    }).setOrigin(0.5);

    this.missUndoBg = this.add.graphics();
    this.missUndoBg.setInteractive(
      new Phaser.Geom.Rectangle(-88, 29, 176, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.missUndoBg.on("pointerover", () => this.refreshMissOverlay(true));
    this.missUndoBg.on("pointerout", () => this.refreshMissOverlay(false));
    this.missUndoBg.on("pointerdown", () => {
      if (this.canReleaseRun()) {
        this.dispatch("expireGame", {});
        return;
      }
      if (this.num("undosLeft", 0) <= 0 || this.bool("isUndoing") || this.bool("timeUp")) return;
      this.dispatch("useUndo", {});
    });
    this.missUndoLabel = this.add.text(0, 51, this.tr("undoJump", "Undo jump"), {
      fontSize:  "12px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#ffffff",
    }).setOrigin(0.5);

    this.missOverlay.add([dim, panel, bunny, title, copy, this.missUndoBg, this.missUndoLabel]);
    this.missOverlay.setVisible(false);
  }

  private refreshMissOverlay(hover = false): void {
    if (!this.missOverlay || !this.missUndoBg || !this.missUndoLabel) return;
    this.missOverlay.setVisible(this.hasMissed && this.str("gameStatus") === "dealt");
    const canRelease = this.canReleaseRun();
    const canUndo = !canRelease && this.num("undosLeft", 0) > 0 && !this.bool("isUndoing") && !this.bool("timeUp");
    this.missUndoBg.clear();
    this.missUndoBg.fillStyle(canUndo || canRelease ? (hover ? C.submitBtnHov : C.submitBtn) : 0xd4d0c9, 1);
    this.missUndoBg.fillRoundedRect(-88, 29, 176, 44, 10);
    this.missUndoBg.lineStyle(2, canUndo || canRelease ? C.submitBtnHov : 0xb8b1a6, 1);
    this.missUndoBg.strokeRoundedRect(-88, 29, 176, 44, 10);
    this.missUndoLabel.setText(
      canRelease
        ? this.tr("releaseThisRun", "Release this run")
        : canUndo
        ? this.tr("undoLeft", "Undo ({n} left)").replace("{n}", String(this.num("undosLeft", 0)))
        : this.bool("timeUp") && this.num("recoveryWaitMs", 0) > 0
          ? this.tr("waitLabel", "Wait {clock}").replace(
              "{clock}",
              formatClock(this.num("recoveryWaitMs", 0)),
            )
        : this.tr("noUndos", "No undos left"),
    );
  }

  private clearMissState(animated: boolean): void {
    if (!this.hasMissed) return;
    this.hasMissed = false;
    this.setBunnyPose("idle");
    this.bunny?.setAngle(0);
    this.missOverlay?.setVisible(false);
    this.chargeBarContainer?.setVisible(
      this.str("gameStatus") === "dealt" &&
      !this.allCleared &&
      !this.bool("timeUp") &&
      !this.bool("submitWindowClosed"),
    );
    this.placeBunnyOnPlatform(this.currentPlatformIndex, animated);
    this.startBunnyIdle();
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  private onChargeStart(): void {
    this.sfx.unlock();
    if (!this.canAcceptJumpInput() || this.isCharging) return;

    this.isCharging     = true;
    this.chargeStartTime = this.time.now;
    this.chargeLevel    = 0;
    this.refreshChargeFill();
    this.chargeHint.setText(this.tr("chargeRelease", "Release to jump"));
    this.stopBunnyIdle();
    this.setBunnyPose("ready");

    // Squish bunny slightly on charge start
    this.tween({
      targets:  this.bunny,
      scaleY:   0.88,
      duration: 150,
      ease:     "Sine.easeOut",
    });
  }

  private onChargeRelease(): void {
    if (!this.isCharging || this.isJumping || this.hasMissed) return;
    this.isCharging = false;
    const charge    = this.chargeLevel;
    this.chargeLevel = 0;
    this.refreshChargeFill();
    this.chargeHint.setText(this.tr("chargeHold", "Hold to charge"));
    if (charge < MIN_CHARGE_LEVEL) {
      this.bunny?.setScale(1);
      this.setBunnyPose("idle");
      this.startBunnyIdle();
      return;
    }
    this.executeJump(charge);
  }

  /** Cancel an in-progress hold when focus leaves the game or a modal opens. */
  private readonly onChargeCancel = (): void => {
    if (!this.isCharging || this.isJumping) return;
    this.isCharging = false;
    this.chargeLevel = 0;
    this.refreshChargeFill();
    this.chargeHint?.setText(this.tr("chargeHold", "Hold to charge"));
    this.bunny?.setScale(1);
    if (
      this.str("gameStatus") === "dealt" &&
      !this.allCleared &&
      !this.hasMissed
    ) {
      this.setBunnyPose("idle");
      if (this.canAcceptJumpInput()) this.startBunnyIdle();
    }
  };

  private canAcceptJumpInput(): boolean {
    return !this.isJumping &&
      !this.allCleared &&
      !this.hasMissed &&
      !this.bool("timeUp") &&
      !this.bool("submitWindowClosed") &&
      !this.bool("isSubmitting") &&
      !this.bool("isUndoing") &&
      !this.bool("inputSyncFailed") &&
      !this.bool("interactionPaused") &&
      this.str("gameStatus") === "dealt";
  }

  // ── Jump mechanics ─────────────────────────────────────────────────────────

  private executeJump(chargeLevel: number): void {
    const from = this.platforms[this.currentPlatformIndex];
    const to   = this.platforms[this.currentPlatformIndex + 1];
    if (!from || !to || !this.bunny) return;

    this.isJumping = true;
    this.setBunnyPose("jump");
    this.sfx.play("flap");
    if (!this.reducedMotion) {
      this.cameras.main.zoomTo(1.04, 160, "Sine.easeOut");
    }

    // Restore bunny scale from charge squish
    this.tween({
      targets:  this.bunny,
      scaleY:   1,
      duration: 80,
    });

    // Use the same gap/width/charge evaluation as deterministic replay. The
    // visual X is mapped from the authoritative offset on the target platform.
    const evaluation = evaluateJumpLevel(chargeLevel, to.gap, to.width);
    const landingOffsetX = evaluation.landingOffset - to.width / 2;
    const landingX = to.x + landingOffsetX;
    const landingY = to.y - 2;

    // Arc via a path using an intermediate waypoint
    const midX = (from.x + landingX) / 2;
    const midY = Math.min(from.y, to.y) - JUMP_ARC_H;

    // Use a manual tween pair: up then down
    const upDuration   = JUMP_DURATION_MS * 0.48;
    const downDuration = JUMP_DURATION_MS * 0.52;

    this.tween({
      targets:  this.bunny,
      x:        midX,
      y:        midY,
      duration: upDuration,
      ease:     "Sine.easeOut",
      onComplete: () => {
        this.tween({
          targets:  this.bunny,
          x:        landingX,
          y:        landingY,
          duration: downDuration,
          ease:     "Sine.easeIn",
          onComplete: () => this.onLanded(evaluation.landed, evaluation.perfect),
        });
      },
    });

    // Record jump with React
    this.dispatch("recordJump", {
      chargeMs:      Math.round((chargeLevel / 100) * CHARGE_FULL_MS),
      chargeLevel:   Math.round(chargeLevel),
      platformIndex: this.currentPlatformIndex + 1,
      landed:        evaluation.landed,
      perfect:       evaluation.perfect,
    });
  }

  private onLanded(
    landed: boolean,
    isPerfect: boolean,
  ): void {
    this.isJumping = false;

    if (!landed) {
      this.onMissedLanding();
      return;
    }
    this.currentPlatformIndex += 1;

    if (!this.reducedMotion) {
      this.cameras.main.zoomTo(1, 200, "Sine.easeOut");
    }

    if (isPerfect) {
      this.comboCount += 1;
      this.sfx.play("combo");
      this.showPerfectLabel();
      this.addGoldGlow();
      if (!this.reducedMotion) {
        this.cameras.main.flash(120, 255, 240, 180);
      }
    } else {
      this.comboCount = 0;
      this.sfx.play("land");
    }

    this.refreshProgressDots();
    this.refreshCombo();
    this.refreshChargeTargetBand();
    this.setBunnyPose("idle");

    // Check if all platforms cleared
    if (this.currentPlatformIndex >= this.platforms.length - 1) {
      this.allCleared = true;
      this.sfx.play("score");
      this.submitContainer.setVisible(true);
      this.chargeBarContainer.setVisible(false);
      this.stopBunnyIdle();
      this.playVictoryCelebration();
    } else {
      this.scrollToPlatform(this.currentPlatformIndex, true);
      this.startBunnyIdle();
    }
  }

  private onMissedLanding(): void {
    this.isJumping = false;
    this.isCharging = false;
    this.hasMissed = true;
    this.comboCount = 0;
    this.sfx.play("lose");
    if (!this.reducedMotion) {
      this.cameras.main.shake(180, 0.012);
    }
    this.chargeLevel = 0;
    this.refreshChargeFill();
    this.refreshCombo();
    this.setBunnyPose("hurt");
    this.stopBunnyIdle();
    this.chargeBarContainer.setVisible(false);
    this.submitContainer.setVisible(false);
    this.refreshMissOverlay();
    if (this.bunny) {
      this.tween({
        targets:  this.bunny,
        angle:    this.bunny.x < W / 2 ? -8 : 8,
        duration: 120,
        yoyo:     true,
        repeat:   1,
      });
    }
  }

  private showPerfectLabel(): void {
    this.perfectLabel
      .setText(this.tr("perfect", "Perfect!"))
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.6);

    // Reduced-motion: hold the label briefly then hide (no scale/slide juice).
    if (this.reducedMotion) {
      this.perfectLabel.setScale(1);
      this.time.delayedCall(700, () => {
        this.perfectLabel.setVisible(false).setAlpha(1).setScale(1).setY(H * 0.42);
      });
      return;
    }

    this.tweens.add({
      targets:  this.perfectLabel,
      scale:    1.2,
      duration: 220,
      ease:     "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets:  this.perfectLabel,
          alpha:    0,
          y:        this.perfectLabel.y - 30,
          duration: 500,
          delay:    300,
          ease:     "Sine.easeIn",
          onComplete: () => {
            this.perfectLabel
              .setVisible(false)
              .setAlpha(1)
              .setScale(1)
              .setY(H * 0.42);
          },
        });
      },
    });
  }

  private addGoldGlow(): void {
    if (!this.bunny) return;
    // Flash a gold circle behind the bunny
    const glow = this.add.circle(this.bunny.x, this.bunny.y, 36, C.bunnyGlow, 0.55);
    // Ensure glow sits behind the bunny in the world container
    this.worldContainer.addAt(glow, 0);
    if (this.reducedMotion) { glow.destroy(); return; }
    this.tweens.add({
      targets:  glow,
      alpha:    0,
      scale:    2,
      duration: 450,
      ease:     "Sine.easeOut",
      onComplete: () => glow.destroy(),
    });
  }

  /**
   * Radial burst of gold sparks behind the bunny for the route-clear payoff.
   * Skipped under reduced-motion (a single static glow stands in via caller).
   */
  private playGoldBurst(x: number, y: number): void {
    if (this.reducedMotion) return;
    const ring = this.add.circle(x, y, 20, C.perfectGold, 0.5);
    this.worldContainer.addAt(ring, 0);
    this.tweens.add({
      targets:  ring,
      scale:    3.4,
      alpha:    0,
      duration: 620,
      ease:     "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    const sparks = 10;
    for (let i = 0; i < sparks; i++) {
      const angle = (Math.PI * 2 * i) / sparks;
      const dist  = 46 + (i % 3) * 14;
      const spark = this.add.circle(x, y, 4 - (i % 2), C.perfectGold, 0.95);
      this.worldContainer.addAt(spark, 0);
      this.tweens.add({
        targets:  spark,
        x:        x + Math.cos(angle) * dist,
        y:        y + Math.sin(angle) * dist,
        alpha:    0,
        scale:    0.4,
        duration: 560,
        delay:    i * 12,
        ease:     "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private playVictoryCelebration(): void {
    if (!this.bunny) return;
    this.setBunnyPose("jump");

    const bunnyX = this.bunny.x;
    const bunnyY = this.bunny.y - 30;

    // Collect the goal carrot: fly it into the bunny, pop, then burst.
    const carrot = this.goalCarrot;
    const finishBurst = (): void => {
      this.addGoldGlow();
      this.playGoldBurst(bunnyX, bunnyY);
    };

    if (carrot && carrot.active) {
      // Carrot world position → target the bunny's chest.
      const startX = carrot.getWorldTransformMatrix().tx;
      const startY = carrot.getWorldTransformMatrix().ty;
      const flyer = this.add.image(startX, startY, JR_ASSETS.carrotGold).setDepth(60);
      this.fitImageHeight(flyer, 28);
      carrot.setVisible(false);
      const targetX = this.bunny.getWorldTransformMatrix().tx;
      const targetY = this.bunny.getWorldTransformMatrix().ty - 34;
      if (this.reducedMotion) {
        flyer.destroy();
        finishBurst();
      } else {
        this.tweens.add({
          targets:  flyer,
          x:        targetX,
          y:        targetY,
          scale:    1.35,
          duration: 340,
          ease:     "Back.easeIn",
          onComplete: () => {
            this.tweens.add({
              targets:  flyer,
              scale:    0,
              alpha:    0,
              duration: 160,
              ease:     "Back.easeIn",
              onComplete: () => flyer.destroy(),
            });
            finishBurst();
          },
        });
      }
    } else {
      finishBurst();
    }

    // Bunny celebration hop — reduced-motion snaps to rest.
    this.tween({
      targets:  this.bunny,
      y:        this.bunny.y - 40,
      duration: 250,
      ease:     "Sine.easeOut",
      yoyo:     true,
      repeat:   3,
    });
  }

  // ── World scroll ───────────────────────────────────────────────────────────

  /**
   * Translate worldContainer so that the target platform sits at BUNNY_SCREEN_Y.
   * When `animated` is true, tween the scroll; otherwise snap immediately.
   */
  private scrollToPlatform(platformIndex: number, animated: boolean): void {
    const pd = this.platforms[platformIndex];
    if (!pd) return;

    // We want pd.y (world) + worldContainer.y = BUNNY_SCREEN_Y
    const targetContainerY = BUNNY_SCREEN_Y - pd.y;
    const clampedY = Math.min(0, Math.max(-(this.worldHeight - H), targetContainerY));

    if (animated && !this.reducedMotion) {
      this.tweens.add({
        targets:  this.worldContainer,
        y:        clampedY,
        duration: 380,
        ease:     "Cubic.easeOut",
      });
    } else {
      this.worldContainer.y = clampedY;
    }
  }

  /**
   * Move the bunny container to sit on top of the given platform.
   */
  private placeBunnyOnPlatform(platformIndex: number, animated: boolean): void {
    const pd = this.platforms[platformIndex];
    if (!pd || !this.bunny) return;

    const targetX = pd.x;
    const targetY = pd.y - 2;

    if (animated && !this.reducedMotion) {
      this.tweens.add({
        targets:  this.bunny,
        x:        targetX,
        y:        targetY,
        duration: 200,
        ease:     "Back.easeOut",
      });
    } else {
      this.bunny.setPosition(targetX, targetY);
    }
    this.scrollToPlatform(platformIndex, animated);
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || W));
    const viewH = Math.max(1, Math.round(this.scale.height || H));
    const zoom = Math.min(viewW / W, viewH / H);

    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(W / 2, H / 2);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private cleanupScene(): void {
    this.input.off("pointerdown", this.onChargeStart, this);
    this.input.off("pointerup",   this.onChargeRelease, this);
    this.input.off("pointerupoutside", this.onChargeRelease, this);
    this.spaceKey?.off("down", this.onChargeStart, this);
    this.spaceKey?.off("up", this.onChargeRelease, this);
    this.spaceKey = null;
    window.removeEventListener("blur", this.onChargeCancel);
    this.stopBunnyIdle();
    this.ambientTargets = [];
  }

  destroy(fromScene = false): void {
    this.cleanupScene();
    super.destroy(fromScene);
  }
}
