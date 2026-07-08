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
 *  - platformsView : number[]  (TEE-encoded platform layout, each byte 0-255)
 *
 * Actions dispatched to React:
 *  - "startGame"      { difficulty: number }
 *  - "recordJump"     { chargeMs: number, chargeLevel: number, platformIndex: number }
 *  - "submitRun"      {}
 *  - "expireGame"     {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { DIFFICULTY_RULES, formatClock, gasDisplay } from "../logic/game-rules";

// ── Visual constants ────────────────────────────────────────────────────────

const W = 400;
const H = 580;

/** How many platforms to show / generate per run. */
const MAX_PLATFORMS = 16;

/** Vertical gap between consecutive platforms (world-space pixels). */
const VERT_GAP_MIN = 88;
const VERT_GAP_MAX = 140;

/** Platform tile dimensions. */
const PLATFORM_H = 18;
const PLATFORM_MIN_W = 60;
const PLATFORM_RANGE_W = 80; // width = MIN + (byte/256)*RANGE

/** Bunny dimensions. */
const BUNNY_W = 46;
const BUNNY_H = 62;

/** Charge fill duration (ms) for 0→100 %. */
const CHARGE_FULL_MS = 2000;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

/** Jump arc height in world-space pixels above the direct line. */
const JUMP_ARC_H = 90;

/** Duration of the jump tween (ms). */
const JUMP_DURATION_MS = 520;

/** Perfect landing zone: fraction of platform width on each side that counts. */
const PERFECT_ZONE_HALF = 0.15; // centre ±15 % of platform width

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
  comboText:     0xfacc15,
  perfectGold:   0xfacc15,
  uiPanel:       0xffffff,
  uiBorder:      0xe8e6e1,
  dotActive:     0xf59e0b,
  dotDone:       0x22c55e,
  dotFuture:     0xd4d0c9,
  cardBg:        0xffffff,
  cardBorder:    0xe8e6e1,
  cardSelected:  0xfffbeb,
  submitBtn:     0x16c784,
  submitBtnHov:  0x0ea371,
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
  private chargeHint!: Phaser.GameObjects.Text;

  private lobbyContainer!: Phaser.GameObjects.Container;
  private lobbyStartButton!: Phaser.GameObjects.Container;
  private lobbyStartBg!: Phaser.GameObjects.Graphics;
  private lobbyStartLabel!: Phaser.GameObjects.Text;
  private lobbyStartHint!: Phaser.GameObjects.Text;
  private loadingOverlay!: Phaser.GameObjects.Container;
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
  private prevDeadline = 0;
  private prevUndosUsed = 0;
  private prevPlatformsView: number[] = [];

  // ── World dimensions ───────────────────────────────────────────────────────
  private worldHeight = 0;

  constructor() {
    super("JumpRushScene");
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
    this.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on("down", this.onChargeStart, this)
      .on("up",   this.onChargeRelease, this);

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

  protected onStateUpdate(state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const difficulty = this.num("gameDifficulty", 0);
    const deadline   = this.num("deadline", 0);
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");
    const isSubmitting = this.bool("isSubmitting");
    const undosUsed  = this.num("undosUsed", 0);
    const pView      = (this.val<number[]>("platformsView") ?? []) as number[];

    const prevStatus     = this.prevGameStatus;
    const statusChanged  = status !== this.prevGameStatus;
    const platformsChanged =
      pView.length !== this.prevPlatformsView.length ||
      pView.some((item, index) => item !== this.prevPlatformsView[index]);
    const undoChanged = undosUsed !== this.prevUndosUsed;

    this.prevGameStatus    = status;
    this.prevDeadline      = deadline;
    this.prevUndosUsed     = undosUsed;

    // Crash-out cue: run expired mid-game (once per transition)
    if (statusChanged && status === "expired" && prevStatus === "dealt") {
      this.sfx.play("lose");
    }

    // Loading overlay (committed / isDealing)
    const showLoading = status === "committed" || isDealing || isStarting;
    this.loadingOverlay.setVisible(showLoading);
    this.refreshLobbyStartButton();

    if (status !== "dealt") {
      this.clearMissState(false);
    } else if (undoChanged && this.hasMissed) {
      this.clearMissState(true);
    }

    if (status === "idle" || status === "solved" || status === "expired") {
      this.lobbyContainer.setVisible(true);
      this.worldContainer.setVisible(false);
      this.hudContainer.setVisible(false);
      this.chargeBarContainer.setVisible(false);
      this.submitContainer.setVisible(false);
      this.missOverlay.setVisible(false);
      if (statusChanged) this.refreshLobbyCards(difficulty);
      return;
    }

    this.lobbyContainer.setVisible(false);
    this.worldContainer.setVisible(true);
    this.hudContainer.setVisible(true);
    this.chargeBarContainer.setVisible(status === "dealt" && !this.allCleared && !this.hasMissed && !this.bool("timeUp"));

    if (status === "dealt" && platformsChanged && pView.length > 0) {
      this.prevPlatformsView = pView.slice();
      this.buildGameWorld(pView, difficulty);
      this.allCleared = false;
      this.hasMissed = false;
      this.currentPlatformIndex = 0;
      this.comboCount = 0;
      this.chargeLevel = 0;
      this.isJumping = false;
      this.isCharging = false;
      this.refreshProgressDots();
      this.refreshCombo();
      this.scrollToPlatform(0, false);
      this.refreshMissOverlay();
    }

    if (status === "dealt") {
      this.submitContainer.setVisible(this.allCleared && !this.hasMissed && !isSubmitting);
      this.refreshSubmitButton();
      this.refreshMissOverlay();
    }
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

  // ── Platform world ─────────────────────────────────────────────────────────

  /**
   * Decode a platformsView byte array into visual PlatformData, then
   * instantiate all platform containers inside worldContainer.
   */
  private buildGameWorld(view: number[], difficulty: number): void {
    // Remove previous platform objects
    for (const obj of this.platformObjects) obj.destroy();
    this.platformObjects = [];
    this.bunny?.destroy();

    const platformCount = Math.min(MAX_PLATFORMS, Math.max(5, view.length + 1));
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

    // Start idle bob
    this.startBunnyIdle();
  }

  /** Decode raw view bytes into platform layout with world-space positions. */
  private decodePlatforms(view: number[], count: number, difficulty: number): PlatformData[] {
    const out: PlatformData[] = [];

    // Starting platform: centred horizontally, near "bottom" of world
    const startX = W / 2;
    const startY = 100 + (count - 1) * ((VERT_GAP_MIN + VERT_GAP_MAX) / 2);
    out.push({ x: startX, y: startY, width: 120, index: 0 });

    // Horizontal jitter seeds based on view bytes
    for (let i = 1; i < count; i++) {
      const byte = view[i - 1] ?? (i * 73 & 0xff); // fallback deterministic
      const width = PLATFORM_MIN_W + Math.floor((byte / 256) * PLATFORM_RANGE_W);

      // Vertical: higher difficulty → larger gaps
      const gapRange  = VERT_GAP_MAX - VERT_GAP_MIN;
      const diffScale = difficulty === 0 ? 0.3 : difficulty === 1 ? 0.6 : 1.0;
      const vertGap   = VERT_GAP_MIN + Math.floor(diffScale * (byte / 256) * gapRange);

      // Horizontal: alternating left/mid/right based on byte modulo
      const xPositions = [W * 0.2, W * 0.4, W * 0.5, W * 0.6, W * 0.8];
      const xIdx       = byte % xPositions.length;
      const x          = xPositions[xIdx] ?? W / 2;

      const prev = out[out.length - 1];
      if (!prev) continue;
      out.push({ x, y: prev.y - vertGap, width, index: i });
    }
    return out;
  }

  /** Build a single grass-topped platform tile. */
  private buildPlatformTile(pd: PlatformData): Phaser.GameObjects.Container {
    const cont = this.add.container(pd.x, pd.y);
    const platformKey = pd.width < 92 ? JR_ASSETS.platformSmall : JR_ASSETS.platform;
    const sprite = this.add.image(0, 0, platformKey)
      .setOrigin(0.5, 0)
      .setDisplaySize(pd.width, PLATFORM_H + 26);
    cont.add(sprite);

    if (pd.index === this.platforms.length - 1) {
      const carrot = this.add.image(0, -24, JR_ASSETS.carrotGold)
        .setDisplaySize(30, 28);
      cont.add(carrot);
      this.tweens.add({
        targets: carrot,
        y: -30,
        duration: 700,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    return cont;
  }

  // ── Bunny ──────────────────────────────────────────────────────────────────

  private buildBunny(): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);

    const shadow = this.add.ellipse(0, 3, 38, 10, 0x1a1a19, 0.16);
    this.bunnySprite = this.add.image(0, 0, JR_ASSETS.bunnyStand)
      .setOrigin(0.5, 1)
      .setDisplaySize(BUNNY_W, BUNNY_H);
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
    this.bunnySprite.setTexture(texture).setDisplaySize(BUNNY_W, BUNNY_H);
  }

  private startBunnyIdle(): void {
    this.bunnyIdleTween?.stop();
    if (!this.bunny) return;
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

  // ── Charge bar ─────────────────────────────────────────────────────────────

  private buildChargeBar(): void {
    const barW  = W - 48;
    const barH  = 22;
    const barY  = H - 44;
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

    // Label
    this.chargeHint = this.add.text(0, barH / 2 + 10, "HOLD TO CHARGE", {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.chargeBarContainer.add([track, this.chargeFill, this.chargeHint]);
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
      color:     "#facc15",
      stroke:    "#ffffff",
      strokeThickness: 2,
    });

    // "PERFECT!" label (centre, hidden by default)
    this.perfectLabel = this.add.text(W / 2, H * 0.42, "PERFECT!", {
      fontSize:  "26px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#facc15",
      stroke:    "#ffffff",
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
      if (!this.canSubmitRun()) {
        this.tweens.add({ targets: cont, x: W / 2 + 4, duration: 40, yoyo: true, repeat: 2 });
        return;
      }
      this.tweens.add({ targets: cont, scale: 0.94, duration: 60, yoyo: true });
      this.dispatch("submitRun", {});
    });

    this.submitLabel = this.add.text(0, -7, "SUBMIT RUN", {
      fontSize:  "17px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#ffffff",
    }).setOrigin(0.5);

    this.submitHint = this.add.text(0, 15, "TEE settlement", {
      fontSize:  "10px",
      fontFamily: FONT_FAMILY,
      color:     "#ffffff",
    }).setOrigin(0.5).setAlpha(0.82);

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

  private refreshSubmitButton(hover = false): void {
    if (!this.submitButtonBg || !this.submitLabel || !this.submitHint) return;
    const canSubmit = this.canSubmitRun();
    const antiBotWaitMs = this.bool("minSolveReached")
      ? 0
      : this.minSolveRemainingMs();

    this.submitButtonBg.clear();
    this.submitButtonBg.fillStyle(canSubmit ? (hover ? C.submitBtnHov : C.submitBtn) : 0xd4d0c9, 1);
    this.submitButtonBg.fillRoundedRect(-104, -30, 208, 60, 12);
    this.submitButtonBg.lineStyle(2, canSubmit ? C.submitBtnHov : 0xb8b1a6, 1);
    this.submitButtonBg.strokeRoundedRect(-104, -30, 208, 60, 12);
    this.submitLabel.setColor(canSubmit ? "#ffffff" : "#4b443c");
    this.submitHint.setColor(canSubmit ? "#ffffff" : "#6d645b");
    this.submitHint.setAlpha(canSubmit ? 0.82 : 1);

    if (canSubmit) {
      this.submitLabel.setText("SUBMIT RUN");
      this.submitHint.setText("Verified payout");
      return;
    }

    if (this.bool("timeUp") || this.bool("submitWindowClosed")) {
      this.submitLabel.setText("TIME EXPIRED");
      this.submitHint.setText("Release this run");
    } else if (!this.bool("minSolveReached")) {
      const lockedMs = Math.max(0, antiBotWaitMs || SUBMIT_BUFFER_MS);
      this.submitLabel.setText(`WAIT ${formatClock(lockedMs)}`);
      this.submitHint.setText("Anti-bot floor");
    } else {
      this.submitLabel.setText("KEEP JUMPING");
      this.submitHint.setText("Target not cleared");
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
    for (let i = 0; i < this.progressDots.length && i < total; i++) {
      const dot = this.progressDots[i];
      if (!dot) continue;
      if (i < this.currentPlatformIndex) {
        dot.setFillStyle(C.dotDone);
      } else if (i === this.currentPlatformIndex) {
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
      .setDisplaySize(250, 62)
      .setAlpha(0.98);
    const heroBunny = this.add.image(W / 2, 204, JR_ASSETS.bunnyJump)
      .setOrigin(0.5, 1)
      .setDisplaySize(70, 92);
    const carrot = this.add.image(W / 2 + 104, 186, JR_ASSETS.carrotGold)
      .setDisplaySize(34, 30);

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

    this.lobbyContainer.add([veil, heroCloud, heroPlatform, heroBunny, carrot]);
    this.buildDifficultyCards();
    this.lobbyStartButton = this.buildLobbyStartButton();
    this.lobbyContainer.add(this.lobbyStartButton);
    this.lobbyContainer.setVisible(true);
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
    rule: (typeof DIFFICULTY_RULES)[number], diffIdx: number,
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
      this.tweens.add({ targets: cont, scale: 0.95, duration: 60, yoyo: true });
      // Re-render all cards to reflect new selection
      this.lobbyContainer.destroy();
      this.buildLobby();
      this.lobbyContainer.setVisible(true);
    });

    const iconKeys = [JR_ASSETS.bunnyStand, JR_ASSETS.bunnyReady, JR_ASSETS.bunnyJump] as const;
    const icon = this.add.image(0, -34, iconKeys[diffIdx] ?? JR_ASSETS.bunnyStand)
      .setDisplaySize(34, 46);

    // Difficulty name
    const name = this.add.text(0, -h / 2 + 50, rule.key.toUpperCase(), {
      fontSize:  "13px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#1a1a19",
    }).setOrigin(0.5);

    const jumpsLabel = this.add.text(0, -h / 2 + 70, `${rule.targetJumps} jumps`, {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color:    "#5c5a56",
    }).setOrigin(0.5);

    const rewardLabel = this.add.text(0, -h / 2 + 88, `${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#0ea371",
    }).setOrigin(0.5);

    const entryLabel = this.add.text(0, h / 2 - 14, `Entry ${gasDisplay(rule.entryFixed8)}`, {
      fontSize: "10px",
      fontFamily: FONT_FAMILY,
      color:    "#8b8984",
    }).setOrigin(0.5);

    const selectedDot = this.add.circle(-w / 2 + 13, -h / 2 + 13, 5, 0xf59e0b, isSelected ? 1 : 0);
    cont.add([bg, icon, name, jumpsLabel, rewardLabel, entryLabel, selectedDot]);

    return cont;
  }

  private buildLobbyStartButton(): Phaser.GameObjects.Container {
    const cont = this.add.container(W / 2, H - 72);
    this.lobbyStartBg = this.add.graphics();
    this.lobbyStartBg.setInteractive(
      new Phaser.Geom.Rectangle(-106, -22, 212, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.lobbyStartLabel = this.add.text(0, -4, "Start Jump", {
      fontSize: "15px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.lobbyStartHint = this.add.text(0, 14, "", {
      fontSize: "10px",
      fontFamily: FONT_FAMILY,
      color: "#ffffff",
    }).setOrigin(0.5).setAlpha(0.82);

    this.lobbyStartBg.on("pointerover", () => this.refreshLobbyStartButton(true));
    this.lobbyStartBg.on("pointerout", () => this.refreshLobbyStartButton(false));
    this.lobbyStartBg.on("pointerdown", () => {
      this.sfx.unlock();
      if (!this.canStartRun()) {
        this.tweens.add({ targets: cont, x: W / 2 + 4, duration: 40, yoyo: true, repeat: 2 });
        return;
      }
      this.sfx.play("start");
      this.tweens.add({ targets: cont, scale: 0.96, duration: 80, yoyo: true });
      this.dispatch("startGame", { difficulty: this.selectedDifficulty });
    });

    cont.add([this.lobbyStartBg, this.lobbyStartLabel, this.lobbyStartHint]);
    this.refreshLobbyStartButton();
    return cont;
  }

  private canStartRun(): boolean {
    const status = this.str("gameStatus", "idle");
    return (
      (status === "idle" || status === "solved" || status === "expired") &&
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
    this.lobbyStartBg.fillStyle(canStart ? (hover ? C.submitBtnHov : C.submitBtn) : 0xd4d0c9, 1);
    this.lobbyStartBg.fillRoundedRect(-106, -24, 212, 48, 12);
    this.lobbyStartBg.lineStyle(2, canStart ? C.submitBtnHov : 0xb8b1a6, 1);
    this.lobbyStartBg.strokeRoundedRect(-106, -24, 212, 48, 12);
    this.lobbyStartLabel.setColor(canStart ? "#ffffff" : "#4b443c");
    this.lobbyStartHint.setColor(canStart ? "#ffffff" : "#6d645b");
    this.lobbyStartHint.setAlpha(canStart ? 0.82 : 1);
    this.lobbyStartLabel.setText(isBusy ? "Preparing..." : "Start Jump");
    this.lobbyStartHint.setText(canStart ? "Pay entry and seal route" : "Pool refilling");
  }

  private refreshLobbyCards(currentDifficulty: number): void {
    this.selectedDifficulty = currentDifficulty;
  }

  // ── Loading overlay ────────────────────────────────────────────────────────

  private buildLoadingOverlay(): void {
    this.loadingOverlay = this.add.container(W / 2, H / 2);

    const bg = this.add.rectangle(0, 0, W, H, 0xffffff, 0.68).setOrigin(0.5);
    const panel = this.add.rectangle(0, 0, 250, 150, C.surface, 0.96)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    const platform = this.add.image(0, 46, JR_ASSETS.platformSmall)
      .setDisplaySize(150, 52);
    const bunny = this.add.image(0, 30, JR_ASSETS.bunnyJump)
      .setOrigin(0.5, 1)
      .setDisplaySize(48, 64);

    const txt = this.add.text(0, -46, "Preparing platforms", {
      fontSize: "16px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:    "#1a1a19",
    }).setOrigin(0.5);

    const hint = this.add.text(0, -22, "TEE is sealing a fair route", {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
    }).setOrigin(0.5);

    this.tweens.add({
      targets:  bunny,
      y:        12,
      duration: 520,
      ease:     "Sine.easeInOut",
      yoyo:     true,
      repeat:   -1,
    });

    this.loadingOverlay.add([bg, panel, txt, hint, platform, bunny]);
    this.loadingOverlay.setVisible(false);
  }

  private buildMissOverlay(): void {
    this.missOverlay = this.add.container(W / 2, H / 2).setDepth(40);

    const dim = this.add.rectangle(0, 0, W, H, C.overlay, 0.18).setOrigin(0.5);
    const panel = this.add.rectangle(0, 0, 260, 178, C.surface, 0.96)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    const bunny = this.add.image(0, -42, JR_ASSETS.bunnyHurt)
      .setOrigin(0.5, 1)
      .setDisplaySize(48, 64);
    const title = this.add.text(0, -26, "Missed the platform", {
      fontSize:  "17px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color:     "#1a1a19",
    }).setOrigin(0.5);
    const copy = this.add.text(0, -2, "Use an undo or wait for expiry.", {
      fontSize:  "11px",
      fontFamily: FONT_FAMILY,
      color:     "#5c5a56",
      align:     "center",
      wordWrap:  { width: 206 },
    }).setOrigin(0.5);

    this.missUndoBg = this.add.graphics();
    this.missUndoBg.setInteractive(
      new Phaser.Geom.Rectangle(-88, 32, 176, 38),
      Phaser.Geom.Rectangle.Contains,
    );
    this.missUndoBg.on("pointerover", () => this.refreshMissOverlay(true));
    this.missUndoBg.on("pointerout", () => this.refreshMissOverlay(false));
    this.missUndoBg.on("pointerdown", () => {
      if (this.num("undosLeft", 0) <= 0 || this.bool("isUndoing")) return;
      this.dispatch("useUndo", {});
    });
    this.missUndoLabel = this.add.text(0, 51, "UNDO JUMP", {
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
    const canUndo = this.num("undosLeft", 0) > 0 && !this.bool("isUndoing");
    this.missUndoBg.clear();
    this.missUndoBg.fillStyle(canUndo ? (hover ? C.submitBtnHov : C.submitBtn) : 0xd4d0c9, 1);
    this.missUndoBg.fillRoundedRect(-88, 32, 176, 38, 10);
    this.missUndoBg.lineStyle(2, canUndo ? C.submitBtnHov : 0xb8b1a6, 1);
    this.missUndoBg.strokeRoundedRect(-88, 32, 176, 38, 10);
    this.missUndoLabel.setText(canUndo ? `UNDO (${this.num("undosLeft", 0)} LEFT)` : "NO UNDOS LEFT");
  }

  private clearMissState(animated: boolean): void {
    if (!this.hasMissed) return;
    this.hasMissed = false;
    this.setBunnyPose("idle");
    this.bunny?.setAngle(0);
    this.missOverlay?.setVisible(false);
    this.chargeBarContainer?.setVisible(this.str("gameStatus") === "dealt" && !this.allCleared);
    this.placeBunnyOnPlatform(this.currentPlatformIndex, animated);
    this.startBunnyIdle();
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  private onChargeStart(): void {
    this.sfx.unlock();
    if (
      this.isJumping ||
      this.isCharging ||
      this.allCleared ||
      this.hasMissed ||
      this.bool("timeUp") ||
      this.bool("isSubmitting") ||
      this.bool("isUndoing") ||
      this.str("gameStatus") !== "dealt"
    ) return;

    this.isCharging     = true;
    this.chargeStartTime = this.time.now;
    this.chargeLevel    = 0;
    this.refreshChargeFill();
    this.chargeHint.setText("RELEASE TO JUMP");
    this.stopBunnyIdle();
    this.setBunnyPose("ready");

    // Squish bunny slightly on charge start
    this.tweens.add({
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
    this.chargeHint.setText("HOLD TO CHARGE");
    this.executeJump(charge);
  }

  // ── Jump mechanics ─────────────────────────────────────────────────────────

  private executeJump(chargeLevel: number): void {
    const from = this.platforms[this.currentPlatformIndex];
    const to   = this.platforms[this.currentPlatformIndex + 1];
    if (!from || !to || !this.bunny) return;

    this.isJumping = true;
    this.setBunnyPose("jump");
    this.sfx.play("flap");

    // Restore bunny scale from charge squish
    this.tweens.add({
      targets:  this.bunny,
      scaleY:   1,
      duration: 80,
    });

    // Landing X: centre of target ± horizontal offset based on charge accuracy.
    // Harder routes widen the possible miss band, so extreme charge values can
    // visibly overshoot instead of always landing somewhere on the platform.
    const idealCharge = 50; // 50% is "ideal" for a centred landing
    const chargeError = (chargeLevel - idealCharge) / 100; // -0.5 → +0.5
    const difficulty = this.num("gameDifficulty", 0);
    const missBand = to.width * (difficulty === 2 ? 1.24 : difficulty === 1 ? 1.12 : 1.0) + 18;
    const landingOffsetX = chargeError * missBand * 2;
    const landingX = to.x + landingOffsetX;
    const landingY = to.y - 2;

    // Arc via a path using an intermediate waypoint
    const midX = (from.x + landingX) / 2;
    const midY = Math.min(from.y, to.y) - JUMP_ARC_H;

    // Use a manual tween pair: up then down
    const upDuration   = JUMP_DURATION_MS * 0.48;
    const downDuration = JUMP_DURATION_MS * 0.52;

    this.tweens.add({
      targets:  this.bunny,
      x:        midX,
      y:        midY,
      duration: upDuration,
      ease:     "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets:  this.bunny,
          x:        landingX,
          y:        landingY,
          duration: downDuration,
          ease:     "Sine.easeIn",
          onComplete: () => this.onLanded(chargeLevel, landingOffsetX, to),
        });
      },
    });

    // Record jump with React
    this.dispatch("recordJump", {
      chargeMs:      Math.round((chargeLevel / 100) * CHARGE_FULL_MS),
      chargeLevel:   Math.round(chargeLevel),
      platformIndex: this.currentPlatformIndex + 1,
    });
  }

  private onLanded(
    chargeLevel: number,
    landingOffsetX: number,
    platform: PlatformData,
  ): void {
    this.isJumping = false;
    this.currentPlatformIndex += 1;

    // Perfect-landing detection: offset from platform centre
    const centreOffset = Math.abs(landingOffsetX);
    const landed = centreOffset <= platform.width / 2;
    if (!landed) {
      this.onMissedLanding();
      return;
    }

    const isPerfect    = centreOffset <= platform.width * PERFECT_ZONE_HALF;

    if (isPerfect) {
      this.comboCount += 1;
      this.sfx.play("combo");
      this.showPerfectLabel();
      this.addGoldGlow();
    } else {
      this.comboCount = 0;
      this.sfx.play("land");
    }

    this.refreshProgressDots();
    this.refreshCombo();
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
    this.chargeLevel = 0;
    this.refreshChargeFill();
    this.refreshCombo();
    this.setBunnyPose("hurt");
    this.stopBunnyIdle();
    this.chargeBarContainer.setVisible(false);
    this.submitContainer.setVisible(false);
    this.refreshMissOverlay();
    if (this.bunny) {
      this.tweens.add({
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
      .setText("PERFECT!")
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.6);

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
    this.tweens.add({
      targets:  glow,
      alpha:    0,
      scale:    2,
      duration: 450,
      ease:     "Sine.easeOut",
      onComplete: () => glow.destroy(),
    });
  }

  private playVictoryCelebration(): void {
    // Bounce bunny up and down in celebration
    if (!this.bunny) return;
    this.setBunnyPose("jump");
    this.tweens.add({
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

    if (animated) {
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

    if (animated) {
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

  destroy(fromScene = false): void {
    this.input.off("pointerdown", this.onChargeStart, this);
    this.input.off("pointerup",   this.onChargeRelease, this);
    super.destroy(fromScene);
  }
}
