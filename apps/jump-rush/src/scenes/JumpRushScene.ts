/**
 * JumpRushScene — Phaser 3 scene for the Jump Rush platform-jumper miniapp.
 *
 * Renders:
 *  - Sky gradient background (light blue → white)
 *  - Scrolling world container with grass platforms (3-4 visible at once)
 *  - Bunny character (rounded-rect body + ears, drawn with primitives)
 *  - Power charge bar at the bottom (fills while pointer/space is held)
 *  - Combo counter, round-progress dots, timer bar in the HUD
 *  - Lobby: 3 difficulty cards (Easy / Medium / Hard)
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
 *  - "recordJump"     { chargeLevel: number, platformIndex: number }
 *  - "submitSolution" {}
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
const BUNNY_W = 28;
const BUNNY_H = 30;
const EAR_W = 9;
const EAR_H = 18;

/** Charge fill duration (ms) for 0→100 %. */
const CHARGE_FULL_MS = 2000;

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
  groundGrass:   0x4ade80,
  groundDirt:    0x92400e,
  bunnyBody:     0xfef9c3,
  bunnyEar:      0xfda4af,
  bunnyEye:      0x1e293b,
  bunnyGlow:     0xfacc15,
  chargeEmpty:   0x334155,
  chargeFill0:   0x22c55e, // low charge
  chargeFill50:  0xfacc15, // mid charge
  chargeFill100: 0xef4444, // full charge
  timerGreen:    0x22c55e,
  timerYellow:   0xfacc15,
  timerRed:      0xef4444,
  comboText:     0xfacc15,
  perfectGold:   0xfacc15,
  uiPanel:       0x0f172a,
  uiBorder:      0x334155,
  dotActive:     0x6366f1,
  dotDone:       0x22c55e,
  dotFuture:     0x334155,
  cardBg:        0x1e293b,
  cardBorder:    0x334155,
  cardSelected:  0x4f46e5,
  submitBtn:     0x4f46e5,
  submitBtnHov:  0x6366f1,
  overlay:       0x000000,
};

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
  private bunnyBody!: Phaser.GameObjects.Graphics;
  private bunnyIdleTween: Phaser.Tweens.Tween | null = null;

  private hudContainer!: Phaser.GameObjects.Container;
  private timerBarFill!: Phaser.GameObjects.Rectangle;
  private comboLabel!: Phaser.GameObjects.Text;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private perfectLabel!: Phaser.GameObjects.Text;
  private submitContainer!: Phaser.GameObjects.Container;

  private chargeBarContainer!: Phaser.GameObjects.Container;
  private chargeFill!: Phaser.GameObjects.Rectangle;
  private chargeHint!: Phaser.GameObjects.Text;

  private lobbyContainer!: Phaser.GameObjects.Container;
  private loadingOverlay!: Phaser.GameObjects.Container;

  // ── Local game state ───────────────────────────────────────────────────────
  private currentPlatformIndex = 0;
  private chargeLevel = 0;          // 0-100
  private isCharging = false;
  private isJumping = false;
  private comboCount = 0;
  private allCleared = false;
  private platforms: PlatformData[] = [];

  private chargeStartTime = 0;
  private selectedDifficulty = 0;

  // ── Cached state for change-detection ─────────────────────────────────────
  private prevGameStatus = "";
  private prevDeadline = 0;
  private prevPlatformsView: number[] = [];

  // ── World dimensions ───────────────────────────────────────────────────────
  private worldHeight = 0;

  constructor() {
    super("JumpRushScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    // All visuals are drawn with Phaser primitives — no external assets needed.
  }

  create(): void {
    super.create(); // wire the GameBridge first

    this.buildBackground();
    this.worldContainer = this.add.container(0, 0);
    this.buildHUD();
    this.buildChargeBar();
    this.buildLobby();
    this.buildLoadingOverlay();

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
    const pView      = (this.val<number[]>("platformsView") ?? []) as number[];

    const statusChanged  = status !== this.prevGameStatus;
    const platformsChanged = pView.length !== this.prevPlatformsView.length;

    this.prevGameStatus    = status;
    this.prevDeadline      = deadline;

    // Loading overlay (committed / isDealing)
    const showLoading = status === "committed" || isDealing || isStarting;
    this.loadingOverlay.setVisible(showLoading);

    if (status === "idle" || status === "solved" || status === "expired") {
      this.lobbyContainer.setVisible(true);
      this.worldContainer.setVisible(false);
      this.hudContainer.setVisible(false);
      this.chargeBarContainer.setVisible(false);
      this.submitContainer.setVisible(false);
      if (statusChanged) this.refreshLobbyCards(difficulty);
      return;
    }

    this.lobbyContainer.setVisible(false);
    this.worldContainer.setVisible(true);
    this.hudContainer.setVisible(true);
    this.chargeBarContainer.setVisible(status === "dealt" && !this.allCleared);

    if (status === "dealt" && platformsChanged && pView.length > 0) {
      this.prevPlatformsView = pView.slice();
      this.buildGameWorld(pView, difficulty);
      this.allCleared = false;
      this.currentPlatformIndex = 0;
      this.comboCount = 0;
      this.chargeLevel = 0;
      this.isJumping = false;
      this.isCharging = false;
      this.refreshProgressDots();
      this.refreshCombo();
      this.scrollToPlatform(0, false);
    }

    if (status === "dealt") {
      this.submitContainer.setVisible(this.allCleared && !isSubmitting);
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Sky gradient: draw two rectangles and overlay with gradient graphics
    const gfx = this.add.graphics();
    // Tall gradient strip that covers full canvas
    gfx.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1);
    gfx.fillRect(0, 0, W, H);

    // Decorative cloud shapes (3 static clouds)
    const cloudGfx = this.add.graphics();
    cloudGfx.fillStyle(0xffffff, 0.55);
    const clouds = [
      { x: 60,  y: 60,  r: 22 },
      { x: 95,  y: 50,  r: 28 },
      { x: 130, y: 60,  r: 20 },
      { x: 240, y: 90,  r: 18 },
      { x: 270, y: 80,  r: 24 },
      { x: 300, y: 92,  r: 16 },
    ];
    for (const c of clouds) cloudGfx.fillCircle(c.x, c.y, c.r);
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
    const hw   = pd.width / 2;

    const gfx = this.add.graphics();
    // Dirt body
    gfx.fillStyle(C.groundDirt);
    gfx.fillRoundedRect(-hw, 0, pd.width, PLATFORM_H + 8, 4);
    // Grass strip
    gfx.fillStyle(C.groundGrass);
    gfx.fillRoundedRect(-hw, 0, pd.width, PLATFORM_H, { tl: 4, tr: 4, bl: 0, br: 0 });
    // Subtle highlight on grass top
    gfx.fillStyle(0xbbf7d0, 0.4);
    gfx.fillRect(-hw + 4, 2, pd.width - 8, 4);

    cont.add(gfx);
    return cont;
  }

  // ── Bunny ──────────────────────────────────────────────────────────────────

  private buildBunny(): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const gfx  = this.add.graphics();
    this.bunnyBody = gfx;

    this.drawBunnyIdle(gfx);
    cont.add(gfx);
    return cont;
  }

  private drawBunnyIdle(gfx: Phaser.GameObjects.Graphics): void {
    gfx.clear();
    const hw = BUNNY_W / 2;
    const hh = BUNNY_H / 2;

    // Left ear
    gfx.fillStyle(C.bunnyBody);
    gfx.fillRoundedRect(-hw + 2, -hh - EAR_H + 2, EAR_W, EAR_H, 4);
    // Inner left ear
    gfx.fillStyle(C.bunnyEar, 0.7);
    gfx.fillRoundedRect(-hw + 4, -hh - EAR_H + 5, EAR_W - 4, EAR_H - 6, 3);

    // Right ear
    gfx.fillStyle(C.bunnyBody);
    gfx.fillRoundedRect(hw - EAR_W - 2, -hh - EAR_H + 2, EAR_W, EAR_H, 4);
    // Inner right ear
    gfx.fillStyle(C.bunnyEar, 0.7);
    gfx.fillRoundedRect(hw - EAR_W, -hh - EAR_H + 5, EAR_W - 4, EAR_H - 6, 3);

    // Body
    gfx.fillStyle(C.bunnyBody);
    gfx.fillRoundedRect(-hw, -hh, BUNNY_W, BUNNY_H, 8);

    // Eyes
    gfx.fillStyle(C.bunnyEye);
    gfx.fillCircle(-6, -4, 3);
    gfx.fillCircle(6, -4, 3);

    // Nose
    gfx.fillStyle(0xfda4af);
    gfx.fillCircle(0, 2, 2);

    // Mouth
    gfx.lineStyle(1.5, C.bunnyEye, 0.6);
    gfx.beginPath();
    gfx.moveTo(-3, 5);
    gfx.lineTo(0, 7);
    gfx.lineTo(3, 5);
    gfx.strokePath();
  }

  private drawBunnyJump(gfx: Phaser.GameObjects.Graphics): void {
    gfx.clear();
    const hw = BUNNY_W / 2;
    const hh = BUNNY_H / 2;

    // Ears swept back when jumping
    gfx.fillStyle(C.bunnyBody);
    gfx.fillRoundedRect(-hw + 4, -hh - EAR_H + 6, EAR_W - 2, EAR_H - 4, 3);
    gfx.fillRoundedRect(hw - EAR_W, -hh - EAR_H + 6, EAR_W - 2, EAR_H - 4, 3);
    gfx.fillStyle(C.bunnyEar, 0.7);
    gfx.fillRoundedRect(-hw + 6, -hh - EAR_H + 9, EAR_W - 6, EAR_H - 10, 2);
    gfx.fillRoundedRect(hw - EAR_W + 2, -hh - EAR_H + 9, EAR_W - 6, EAR_H - 10, 2);

    // Body (slightly squished tall when jumping)
    gfx.fillStyle(C.bunnyBody);
    gfx.fillRoundedRect(-hw + 2, -hh - 4, BUNNY_W - 4, BUNNY_H + 4, 8);

    // Eyes (wide open)
    gfx.fillStyle(C.bunnyEye);
    gfx.fillCircle(-6, -6, 3.5);
    gfx.fillCircle(6, -6, 3.5);

    // Nose
    gfx.fillStyle(0xfda4af);
    gfx.fillCircle(0, 0, 2);
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
      .setStrokeStyle(2, 0x475569)
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
      color:     "#94a3b8",
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
    const timerTrack = this.add.rectangle(W / 2, 10, W - 24, 8, 0x1e293b)
      .setStrokeStyle(1, 0x334155);
    this.timerBarFill = this.add.rectangle(12, 10, W - 24, 6, C.timerGreen)
      .setOrigin(0, 0.5);

    // Combo label (top-left)
    this.comboLabel = this.add.text(16, 28, "", {
      fontSize:  "20px",
      fontStyle: "bold",
      color:     "#facc15",
      stroke:    "#0f172a",
      strokeThickness: 3,
    });

    // "PERFECT!" label (centre, hidden by default)
    this.perfectLabel = this.add.text(W / 2, H * 0.42, "PERFECT!", {
      fontSize:  "26px",
      fontStyle: "bold",
      color:     "#facc15",
      stroke:    "#92400e",
      strokeThickness: 4,
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

    const bg = this.add.rectangle(0, 0, 180, 50, C.submitBtn)
      .setStrokeStyle(2, C.submitBtnHov)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    bg.on("pointerover",  () => bg.setFillStyle(C.submitBtnHov));
    bg.on("pointerout",   () => bg.setFillStyle(C.submitBtn));
    bg.on("pointerdown",  () => {
      this.tweens.add({ targets: cont, scale: 0.94, duration: 60, yoyo: true });
      this.dispatch("submitSolution", {});
    });

    const txt = this.add.text(0, 0, "SUBMIT RUN", {
      fontSize:  "18px",
      fontStyle: "bold",
      color:     "#ffffff",
    }).setOrigin(0.5);

    cont.add([bg, txt]);
    return cont;
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
    this.lobbyContainer = this.add.container(0, 0);

    // Semi-transparent panel
    const panelBg = this.add.rectangle(W / 2, H / 2, W, H, C.overlay, 0.55);

    const title = this.add.text(W / 2, 60, "JUMP RUSH", {
      fontSize:        "30px",
      fontStyle:       "bold",
      color:           "#f8fafc",
      stroke:          "#1e293b",
      strokeThickness: 4,
    }).setOrigin(0.5);

    const subtitle = this.add.text(W / 2, 96, "Choose your difficulty", {
      fontSize: "14px",
      color:    "#94a3b8",
    }).setOrigin(0.5);

    this.lobbyContainer.add([panelBg, title, subtitle]);
    this.buildDifficultyCards();
    this.lobbyContainer.setVisible(true);
  }

  private buildDifficultyCards(): void {
    const cardW   = 110;
    const cardH   = 170;
    const spacing = 120;
    const startX  = W / 2 - spacing;
    const cardY   = H / 2 - 10;

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

    const bg = this.add.rectangle(0, 0, w, h,
      isSelected ? C.cardSelected : C.cardBg,
    ).setStrokeStyle(2, isSelected ? 0x818cf8 : C.cardBorder).setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover",  () => bg.setStrokeStyle(2, 0x818cf8));
    bg.on("pointerout",   () => bg.setStrokeStyle(2, isSelected ? 0x818cf8 : C.cardBorder));
    bg.on("pointerdown",  () => {
      this.selectedDifficulty = diffIdx;
      this.tweens.add({ targets: cont, scale: 0.95, duration: 60, yoyo: true });
      // Re-render all cards to reflect new selection
      this.lobbyContainer.destroy();
      this.buildLobby();
      this.lobbyContainer.setVisible(true);
    });

    // Difficulty tier icon (diamond count)
    const iconText = diffIdx === 0 ? "◆" : diffIdx === 1 ? "◆◆" : "◆◆◆";
    const iconColors = ["#4ade80", "#facc15", "#f87171"] as const;
    const icon = this.add.text(0, -h / 2 + 22, iconText, {
      fontSize: "16px",
      fontStyle: "bold",
      color: iconColors[diffIdx] ?? "#ffffff",
    }).setOrigin(0.5);

    // Difficulty name
    const nameColors = ["#4ade80", "#facc15", "#f87171"];
    const name = this.add.text(0, -h / 2 + 50, rule.key.toUpperCase(), {
      fontSize:  "13px",
      fontStyle: "bold",
      color:     nameColors[diffIdx] ?? "#ffffff",
    }).setOrigin(0.5);

    // Entry fee
    const entryLabel = this.add.text(0, -h / 2 + 72, `Entry: ${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "10px",
      color:    "#94a3b8",
    }).setOrigin(0.5);

    // Reward
    const rewardLabel = this.add.text(0, -h / 2 + 88, `Win: ${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize:  "11px",
      fontStyle: "bold",
      color:     "#f0c866",
    }).setOrigin(0.5);

    // Time limit
    const timeLabel = this.add.text(0, -h / 2 + 106, `${rule.limitMs / 1000}s`, {
      fontSize: "10px",
      color:    "#64748b",
    }).setOrigin(0.5);

    // Jumps required
    const jumpsLabel = this.add.text(0, -h / 2 + 122, `${rule.targetJumps} jumps`, {
      fontSize: "10px",
      color:    "#64748b",
    }).setOrigin(0.5);

    // Start button (only on selected card)
    if (isSelected) {
      const startBtnBg = this.add.rectangle(0, h / 2 - 24, w - 16, 30, 0x4f46e5)
        .setStrokeStyle(1, 0x818cf8)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const startBtnTxt = this.add.text(0, h / 2 - 24, "START", {
        fontSize:  "12px",
        fontStyle: "bold",
        color:     "#ffffff",
      }).setOrigin(0.5);
      startBtnBg.on("pointerover",  () => startBtnBg.setFillStyle(0x6366f1));
      startBtnBg.on("pointerout",   () => startBtnBg.setFillStyle(0x4f46e5));
      startBtnBg.on("pointerdown",  () => {
        this.tweens.add({ targets: [startBtnBg, startBtnTxt], scale: 0.93, duration: 60, yoyo: true });
        this.dispatch("startGame", { difficulty: diffIdx });
      });
      cont.add([bg, icon, name, entryLabel, rewardLabel, timeLabel, jumpsLabel, startBtnBg, startBtnTxt]);
    } else {
      cont.add([bg, icon, name, entryLabel, rewardLabel, timeLabel, jumpsLabel]);
    }

    return cont;
  }

  private refreshLobbyCards(currentDifficulty: number): void {
    this.selectedDifficulty = currentDifficulty;
  }

  // ── Loading overlay ────────────────────────────────────────────────────────

  private buildLoadingOverlay(): void {
    this.loadingOverlay = this.add.container(W / 2, H / 2);

    const bg = this.add.rectangle(0, 0, W, H, C.overlay, 0.75).setOrigin(0.5);

    const txt = this.add.text(0, -20, "Preparing platforms…", {
      fontSize: "18px",
      color:    "#e2e8f0",
    }).setOrigin(0.5);

    const dots = this.add.text(0, 18, "⋯", {
      fontSize:  "28px",
      color:     "#6366f1",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.tweens.add({
      targets:  dots,
      alpha:    0.2,
      duration: 500,
      ease:     "Sine.easeInOut",
      yoyo:     true,
      repeat:   -1,
    });

    this.loadingOverlay.add([bg, txt, dots]);
    this.loadingOverlay.setVisible(false);
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  private onChargeStart(): void {
    if (
      this.isJumping ||
      this.isCharging ||
      this.allCleared ||
      this.str("gameStatus") !== "dealt"
    ) return;

    this.isCharging     = true;
    this.chargeStartTime = this.time.now;
    this.chargeLevel    = 0;
    this.refreshChargeFill();
    this.chargeHint.setText("RELEASE TO JUMP");
    this.stopBunnyIdle();

    // Squish bunny slightly on charge start
    this.tweens.add({
      targets:  this.bunny,
      scaleY:   0.88,
      duration: 150,
      ease:     "Sine.easeOut",
    });
  }

  private onChargeRelease(): void {
    if (!this.isCharging || this.isJumping) return;
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
    this.drawBunnyJump(this.bunnyBody);

    // Restore bunny scale from charge squish
    this.tweens.add({
      targets:  this.bunny,
      scaleY:   1,
      duration: 80,
    });

    // Landing X: centre of target ± horizontal offset based on charge accuracy
    const idealCharge = 50; // 50% is "ideal" for a centred landing
    const chargeError = (chargeLevel - idealCharge) / 100; // -0.5 → +0.5
    const landingOffsetX = chargeError * (to.width * 0.8);
    const landingX = to.x + landingOffsetX;
    const landingY = to.y - BUNNY_H / 2 - 2;

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
    const isPerfect    = centreOffset <= platform.width * PERFECT_ZONE_HALF;

    if (isPerfect) {
      this.comboCount += 1;
      this.showPerfectLabel();
      this.addGoldGlow();
    } else {
      this.comboCount = 0;
    }

    this.refreshProgressDots();
    this.refreshCombo();
    this.drawBunnyIdle(this.bunnyBody);

    // Check if all platforms cleared
    if (this.currentPlatformIndex >= this.platforms.length - 1) {
      this.allCleared = true;
      this.submitContainer.setVisible(true);
      this.chargeBarContainer.setVisible(false);
      this.stopBunnyIdle();
      this.playVictoryCelebration();
    } else {
      this.scrollToPlatform(this.currentPlatformIndex, true);
      this.startBunnyIdle();
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
    const targetY = pd.y - BUNNY_H / 2 - 2;

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

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    // Restart scene to reflow at new dimensions (simplest correct approach)
    this.scene.restart();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.input.off("pointerdown", this.onChargeStart, this);
    this.input.off("pointerup",   this.onChargeRelease, this);
    super.destroy(fromScene);
  }
}
