/**
 * AimMasterScene.ts — Phaser 3 scene for the Aim Master archery game.
 *
 * Renders:
 *  - Outdoorsy archery range background with warm sky gradient (#87ceeb → #f5e6c8)
 *  - Concentric-ring target board centered in the upper half
 *  - Oscillating crosshair / gauge reticle (pendulum mechanic)
 *  - Round progress dots at top (accuracy hits vs required)
 *  - Timer bar with clock
 *  - Score / accuracy label
 *  - Lobby: 3 difficulty cards + pool status
 *
 * State keys from React:
 *   gameStatus, pattern, targetAccuracy, isStarting, isDealing,
 *   isSubmitting, poolFree, gameDifficulty, lastStatus, deadline, dealtAt
 *
 * Dispatches:
 *   "startGame"      { difficulty: number }
 *   "recordMove"     { position: number }
 *   "submitSolution" {}
 *   "expireGame"     {}
 */

import Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  DIFFICULTY_RULES,
  ruleOf,
  formatClock,
  gasDisplay,
} from "../logic/game-rules";
import {
  DEFAULT_CONFIG,
  calculateHitResult,
  isAccuracyHit,
} from "../logic/aim-engine";

// ── Layout constants ────────────────────────────────────────────────────────

const W = 400;
const H = 600;

// Sky background gradient stops
const SKY_TOP_HEX    = 0x87ceeb;
const SKY_BOTTOM_HEX = 0xf5e6c8;

// Target board
const TGT_CX     = W / 2;
const TGT_CY     = 195;
const TGT_RADIUS = 88; // outer white ring outer edge (px)

// Ring visual radii (outer edge, px) — 5 rings + bullseye
const RING_OUTER_RADII = [14, 28, 42, 56, 70, TGT_RADIUS] as const;

// Ring fill colors: bullseye(0)…outer(5)
const RING_COLORS: readonly number[] = [
  0xffd700, // gold   — bullseye
  0xe03030, // red    — ring 1
  0xe03030, // red    — ring 2  (standard double red)
  0x2860c8, // blue   — ring 3
  0x000000, // black  — ring 4
  0xffffff, // white  — ring 5
];

// Gauge strip
const GAUGE_Y      = 435;
const GAUGE_LEFT   = 25;
const GAUGE_RIGHT  = 375;
const GAUGE_W      = GAUGE_RIGHT - GAUGE_LEFT; // 350
const GAUGE_HEIGHT = 16;

// ── Color palette ────────────────────────────────────────────────────────────

const C = {
  grass:       0x4a7c3f,
  grassLight:  0x5a9448,
  grassDark:   0x3a6330,
  fencePole:   0x8b6914,
  fenceRail:   0xa07830,
  panelBg:     0x1a1208,
  panelBorder: 0x6b4a20,
  accent:      0xe8b84b,
  accentDark:  0xb8891b,
  white:       0xffffff,
  black:       0x000000,
  textMuted:   0xc0a070,
  good:        0x48d890,
  danger:      0xe04040,
  timerFull:   0x48b0e0,
  timerLow:    0xe06030,
  dotHit:      0x48d890,
  dotCurrent:  0xe8b84b,
  dotPending:  0x50505a,
  dotMiss:     0xe04040,
  reticle:     0xffffff,
  reticleShadow: 0x000000,
};

// ── Difficulty speed config (pendulum period in ms) ──────────────────────────

const DIFFICULTY_PERIOD: Record<number, number> = {
  0: 2800, // easy   — slow sweep
  1: 1900, // medium
  2: 1200, // hard   — fast sweep
};

export class AimMasterScene extends BaseScene {
  // ── Lobby UI ───────────────────────────────────────────────────────────────
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffCards: Phaser.GameObjects.Container[] = [];
  private poolText!: Phaser.GameObjects.Text;
  private lobbyStartBtnBg!: Phaser.GameObjects.Rectangle;
  private lobbyStartBtnLabel!: Phaser.GameObjects.Text;
  private selectedDifficulty = 0;

  // ── Game UI ────────────────────────────────────────────────────────────────
  private gameContainer!: Phaser.GameObjects.Container;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private timerBarBg!: Phaser.GameObjects.Rectangle;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerClock!: Phaser.GameObjects.Text;
  private targetContainer!: Phaser.GameObjects.Container;
  private targetRings: Phaser.GameObjects.Arc[] = [];
  private gaugeTrack!: Phaser.GameObjects.Rectangle;
  private gaugeRingMarkers: Phaser.GameObjects.Rectangle[] = [];
  private gaugeReticle!: Phaser.GameObjects.Container;
  private gaugeTapZone!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private submitBtnBg!: Phaser.GameObjects.Rectangle;
  private submitBtnLabel!: Phaser.GameObjects.Text;
  private submitBtnContainer!: Phaser.GameObjects.Container;

  // ── Dealing UI ─────────────────────────────────────────────────────────────
  private dealingContainer!: Phaser.GameObjects.Container;
  private dealingDots: Phaser.GameObjects.Arc[] = [];
  private dealingTween: Phaser.Tweens.Tween | null = null;

  // ── Status bar (shared) ────────────────────────────────────────────────────
  private statusText!: Phaser.GameObjects.Text;

  // ── Previous pattern string (to detect changes) ──────────────────────────
  private prevPattern = "";
  private prevTargetAccuracy = 0;

  // ── Runtime tracking ───────────────────────────────────────────────────────
  private currentGameStatus = "idle";
  private patternPositions: number[] = [];
  private patternStartTime = 0;
  private isGameAnimating = false;
  private pendingSubmit = false;

  // Shot tracking (local — mirrors React's localRings)
  private shotRings: number[] = [];
  private accuracyHits = 0;
  private currentTargetAccuracy = 3;
  private currentDifficulty = 0;

  // Gauge position (0‥300 logical, maps to GAUGE_LEFT‥GAUGE_RIGHT visual)
  private currentGaugeLogical = DEFAULT_CONFIG.centre;

  // Pendulum tween (used when no TEE pattern is available yet)
  private pendulumTween: Phaser.Tweens.Tween | null = null;

  // timer
  private deadline = 0;
  private dealtAt  = 0;

  constructor() {
    super("AimMasterScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  create(): void {
    super.create();

    this.buildBackground();
    this.buildLobbyContainer();
    this.buildGameContainer();
    this.buildDealingContainer();
    this.buildStatusBar();

    this.onStateUpdate(this.state);
  }

  update(time: number, _delta: number): void {
    if (!this.isGameAnimating || this.patternPositions.length === 0) return;

    const elapsed   = time - this.patternStartTime;
    const tickIndex = Math.floor(elapsed / DEFAULT_CONFIG.tickMs);
    const wrapped   = tickIndex % this.patternPositions.length;
    const logicalPos = this.patternPositions[wrapped] ?? DEFAULT_CONFIG.centre;

    this.currentGaugeLogical = logicalPos;

    // Map logical 0‥300 → visual GAUGE_LEFT‥GAUGE_RIGHT
    const rx = GAUGE_LEFT + (logicalPos / DEFAULT_CONFIG.width) * GAUGE_W;
    this.gaugeReticle.setX(rx);
  }

  // ── BaseScene: state handler ───────────────────────────────────────────────

  protected onStateUpdate(state: GameState): void {
    const status       = this.str("gameStatus", "idle");
    const pattern      = this.str("pattern", "");
    const difficulty   = this.num("gameDifficulty", 0);
    const poolFree     = this.num("poolFree", 0);
    const isDealing    = this.bool("isDealing");
    const isStarting   = this.bool("isStarting");
    const isSubmitting = this.bool("isSubmitting");
    const targetAcc    = this.num("targetAccuracy", 3);
    const deadline     = this.num("deadline", 0);
    const dealtAt      = this.num("dealtAt", 0);
    const lastStatus   = this.str("lastStatus", "");

    this.deadline  = deadline;
    this.dealtAt   = dealtAt;
    this.currentDifficulty = difficulty;

    // Status bar
    if (lastStatus) this.statusText.setText(lastStatus);

    // Pool text in lobby
    this.poolText.setText(`Pool: ${poolFree.toFixed(2)} GAS`);

    // Determine which layer to show
    const showLobby   = (status === "idle" || status === "solved" || status === "expired") && !isStarting;
    const showDealing = isStarting || isDealing || status === "committed" || (status === "dealt" && !pattern);
    const showGame    = status === "dealt" && !!pattern;

    this.lobbyContainer.setVisible(showLobby);
    this.dealingContainer.setVisible(showDealing);
    this.gameContainer.setVisible(showGame);

    // Lobby sync
    if (showLobby) {
      this.syncLobbyCards(isStarting, poolFree);
    }

    // Game sync
    if (showGame) {
      this.syncGameUI(pattern, targetAcc, difficulty, isSubmitting);
    }

    // Dealing animation
    if (showDealing && !this.dealingTween) {
      this.startDealingAnimation();
    } else if (!showDealing && this.dealingTween) {
      this.stopDealingAnimation();
    }

    // Handle status transitions
    if (status !== this.currentGameStatus) {
      this.onStatusTransition(status, this.currentGameStatus);
      this.currentGameStatus = status;
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Sky gradient — drawn as stacked thin horizontal rectangles
    const gradientSteps = 40;
    const horizonY = H * 0.52;
    for (let i = 0; i < gradientSteps; i++) {
      const t   = i / (gradientSteps - 1);
      const y0  = (horizonY / gradientSteps) * i;
      const yH  = horizonY / gradientSteps + 1; // +1 to prevent seams
      // Lerp SKY_TOP_HEX → SKY_BOTTOM_HEX
      const r1 = (SKY_TOP_HEX >> 16) & 0xff;
      const g1 = (SKY_TOP_HEX >> 8)  & 0xff;
      const b1 =  SKY_TOP_HEX        & 0xff;
      const r2 = (SKY_BOTTOM_HEX >> 16) & 0xff;
      const g2 = (SKY_BOTTOM_HEX >> 8)  & 0xff;
      const b2 =  SKY_BOTTOM_HEX        & 0xff;
      const r  = Math.round(r1 + (r2 - r1) * t);
      const g  = Math.round(g1 + (g2 - g1) * t);
      const b  = Math.round(b1 + (b2 - b1) * t);
      const color = (r << 16) | (g << 8) | b;
      this.add.rectangle(W / 2, y0 + yH / 2, W, yH + 1, color);
    }

    // Ground / grass
    this.add.rectangle(W / 2, H * 0.73, W, H * 0.43, C.grass);
    // Grass highlight stripe
    this.add.rectangle(W / 2, horizonY + 4, W, 8, C.grassLight);
    // Distant dirt mound under target
    this.add.ellipse(TGT_CX, H * 0.52 - 4, 160, 32, C.grassDark);

    // Archery range lane markers (two parallel white lines)
    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0xffffff, 0.25);
    gfx.lineBetween(TGT_CX - 55, horizonY, TGT_CX - 70, H);
    gfx.lineBetween(TGT_CX + 55, horizonY, TGT_CX + 70, H);

    // Fence posts (simple wooden pillars on left/right)
    for (let i = 0; i < 4; i++) {
      const px = i * 105 + 15;
      this.add.rectangle(px, H * 0.68, 8, 80, C.fencePole);
      this.add.rectangle(px + 52, H * 0.68, 8, 80, C.fencePole);
    }
    // Fence rail
    this.add.rectangle(W / 2, H * 0.64, W, 7, C.fenceRail);
    this.add.rectangle(W / 2, H * 0.72, W, 5, C.fenceRail);
  }

  // ── Lobby container ────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    this.lobbyContainer = this.add.container(0, 0);

    // Title
    const titleBg = this.add.rectangle(W / 2, 32, 260, 40, C.panelBg, 200)
      .setStrokeStyle(1, C.panelBorder);
    const titleTxt = this.add.text(W / 2, 32, "Archery Range", {
      fontSize: "18px", fontStyle: "bold", color: "#e8b84b",
    }).setOrigin(0.5);
    this.lobbyContainer.add([titleBg, titleTxt]);

    // Pool status
    this.poolText = this.add.text(W / 2, H - 80, "Pool: 0.00 GAS", {
      fontSize: "14px", color: "#c0a070",
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.poolText);

    // Difficulty cards — horizontal row, each 118px wide, 10px gap
    const cardW = 116;
    const cardH = 180;
    const cardY = 290;
    const totalW = DIFFICULTY_RULES.length * cardW + (DIFFICULTY_RULES.length - 1) * 10;
    const startX = (W - totalW) / 2 + cardW / 2;

    DIFFICULTY_RULES.forEach((rule, i) => {
      const cx = startX + i * (cardW + 10);
      const card = this.buildDiffCard(cx, cardY, cardW, cardH, rule);
      this.diffCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Start button
    this.lobbyStartBtnBg = this.add.rectangle(W / 2, H - 40, 200, 46, C.accent)
      .setStrokeStyle(2, 0xffd700)
      .setOrigin(0.5);
    this.lobbyStartBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.lobbyStartBtnBg, {
      targets: this.lobbyStartBtnBg,
      pressScale: 0.96,
      onPress: () => this.dispatch("startGame", { difficulty: this.selectedDifficulty }),
    });

    this.lobbyStartBtnLabel = this.add.text(W / 2, H - 40, "Start Game", {
      fontSize: "18px", fontStyle: "bold", color: "#1a1208",
    }).setOrigin(0.5);

    this.lobbyContainer.add([this.lobbyStartBtnBg, this.lobbyStartBtnLabel]);
  }

  private buildDiffCard(
    cx: number, cy: number, cardW: number, cardH: number,
    rule: (typeof DIFFICULTY_RULES)[number],
  ): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.panelBg)
      .setStrokeStyle(2, C.panelBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.selectedDifficulty = rule.difficulty;
      this.syncLobbyCards(false, this.num("poolFree", 0));
    });

    const nameColors: Record<string, string> = {
      easy:   "#48d890",
      medium: "#e8b84b",
      hard:   "#e04040",
    };
    const nameColor = nameColors[rule.key] ?? "#ffffff";

    const nameTxt = this.add.text(0, -62, rule.key.toUpperCase(), {
      fontSize: "13px", fontStyle: "bold", color: nameColor,
    }).setOrigin(0.5);

    const timeTxt = this.add.text(0, -40, `${Math.round(rule.limitMs / 1000)}s`, {
      fontSize: "20px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);

    const accTxt = this.add.text(0, -12, `${rule.targetAccuracy} hits`, {
      fontSize: "13px", color: "#c0a070",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(0, 12, `Entry: ${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "11px", color: "#a09070",
    }).setOrigin(0.5);

    const rewardTxt = this.add.text(0, 36, `Win: ${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: "12px", fontStyle: "bold", color: "#e8b84b",
    }).setOrigin(0.5);

    // Mini target decoration
    const miniTgt = this.add.container(0, 66);
    for (let r = 3; r >= 0; r--) {
      const radius = 6 + r * 5;
      const color  = (RING_COLORS[r] as number) ?? C.white;
      miniTgt.add(this.add.circle(0, 0, radius, color).setStrokeStyle(1, 0x333333));
    }
    c.add([bg, nameTxt, timeTxt, accTxt, entryTxt, rewardTxt, miniTgt]);
    return c;
  }

  private syncLobbyCards(isStarting: boolean, poolFree: number): void {
    const rule = ruleOf(this.selectedDifficulty);
    const poolEnough = poolFree >= Number(gasDisplay(rule.rewardFixed8));

    this.diffCards.forEach((card, i) => {
      const bg  = card.list[0] as Phaser.GameObjects.Rectangle;
      const active = i === this.selectedDifficulty;
      bg.setStrokeStyle(2, active ? C.accent : C.panelBorder);
      bg.setFillStyle(active ? 0x2a1a08 : C.panelBg);
    });

    this.lobbyStartBtnBg.setFillStyle(
      isStarting || !poolEnough ? C.panelBorder : C.accent,
    );
    this.lobbyStartBtnLabel.setText(isStarting ? "Starting…" : "Start Game");
    this.lobbyStartBtnBg.disableInteractive();
    if (!isStarting && poolEnough) {
      this.lobbyStartBtnBg.setInteractive({ useHandCursor: true });
    }
  }

  // ── Game container ─────────────────────────────────────────────────────────

  private buildGameContainer(): void {
    this.gameContainer = this.add.container(0, 0);

    // Progress dots row (built lazily in syncGameUI)
    // Timer bar
    const timerBgRect = this.add.rectangle(W / 2, 22, W - 40, 10, 0x333333)
      .setOrigin(0.5);
    this.timerBarBg = timerBgRect;
    this.timerBar = this.add.rectangle(GAUGE_LEFT + 10, 22, W - 40, 10, C.timerFull)
      .setOrigin(0, 0.5);
    this.timerClock = this.add.text(W / 2, 38, "00:00", {
      fontSize: "13px", color: "#c0b080",
    }).setOrigin(0.5);
    this.gameContainer.add([timerBgRect, this.timerBar, this.timerClock]);

    // Target board
    this.buildTargetBoard();

    // Gauge track
    const gaugeTrackBg = this.add.rectangle(
      W / 2, GAUGE_Y, GAUGE_W + 20, GAUGE_HEIGHT + 10, 0x1a1208,
    ).setStrokeStyle(2, C.panelBorder).setOrigin(0.5);
    this.gaugeTrack = this.add.rectangle(
      GAUGE_LEFT, GAUGE_Y, GAUGE_W, GAUGE_HEIGHT, 0x404030,
    ).setOrigin(0, 0.5);
    this.gameContainer.add([gaugeTrackBg, this.gaugeTrack]);

    // Ring zone markers on gauge (visual guides)
    this.buildGaugeMarkers();

    // Reticle (crosshair) — positioned at logical centre initially
    this.buildGaugeReticle();

    // Invisible tap zone over gauge area (wider for easier tap)
    this.gaugeTapZone = this.add.rectangle(W / 2, GAUGE_Y, GAUGE_W, 60, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.gaugeTapZone.on("pointerdown", () => this.handleTap());
    this.gameContainer.add(this.gaugeTapZone);

    // Score row
    this.scoreText = this.add.text(W / 2, GAUGE_Y + 36, "0 / 0 hits", {
      fontSize: "15px", color: "#e8b84b",
    }).setOrigin(0.5);
    this.gameContainer.add(this.scoreText);

    // Feedback text (hit/miss overlay)
    this.feedbackText = this.add.text(TGT_CX, TGT_CY - 10, "", {
      fontSize: "22px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5).setDepth(10);
    this.gameContainer.add(this.feedbackText);

    // Submit button (shown when pendingSubmit)
    this.submitBtnContainer = this.add.container(W / 2, GAUGE_Y + 70);
    this.submitBtnBg = this.add.rectangle(0, 0, 200, 44, C.good)
      .setStrokeStyle(2, 0x80ffa0)
      .setOrigin(0.5);
    this.submitBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.submitBtnBg, {
      targets: this.submitBtnContainer,
      pressScale: 0.96,
      onPress: () => this.dispatch("submitSolution", {}),
    });
    this.submitBtnLabel = this.add.text(0, 0, "Submit Shots", {
      fontSize: "17px", fontStyle: "bold", color: "#0a2010",
    }).setOrigin(0.5);
    this.submitBtnContainer.add([this.submitBtnBg, this.submitBtnLabel]);
    this.submitBtnContainer.setVisible(false);
    this.gameContainer.add(this.submitBtnContainer);

    this.gameContainer.setVisible(false);
  }

  private buildTargetBoard(): void {
    this.targetContainer = this.add.container(TGT_CX, TGT_CY);

    // Shadow
    this.targetContainer.add(
      this.add.ellipse(4, 8, TGT_RADIUS * 2 + 8, TGT_RADIUS * 2 + 8, 0x000000, 60),
    );

    // Rings from outside in (so inner draws on top)
    for (let r = RING_OUTER_RADII.length - 1; r >= 0; r--) {
      const radius = RING_OUTER_RADII[r]!;
      const color  = (RING_COLORS[r] as number) ?? C.white;
      const stroke = r === RING_OUTER_RADII.length - 1 ? 2 : 1;
      const strokeColor = 0x555555;
      const ring = this.add.circle(0, 0, radius, color)
        .setStrokeStyle(stroke, strokeColor);
      this.targetRings.push(ring);
      this.targetContainer.add(ring);
    }

    // Bullseye X crosshair
    const xGfx = this.add.graphics();
    xGfx.lineStyle(2, 0x000000, 0.5);
    const bs = RING_OUTER_RADII[0]!;
    xGfx.lineBetween(-bs, 0, bs, 0);
    xGfx.lineBetween(0, -bs, 0, bs);
    this.targetContainer.add(xGfx);

    // Target post (stick)
    this.add.rectangle(TGT_CX, H * 0.495, 10, 80, C.fencePole);

    this.gameContainer.add(this.targetContainer);
  }

  private buildGaugeMarkers(): void {
    const cfg = DEFAULT_CONFIG;
    // Draw ring boundary lines on gauge
    const zoneCount = 6;
    for (let r = 0; r <= zoneCount; r++) {
      const dist = cfg.bullseyeRadius + r * cfg.ringWidth;
      for (const side of [-1, 1]) {
        const logPos = cfg.centre + side * dist;
        const vx = GAUGE_LEFT + (logPos / cfg.width) * GAUGE_W;
        if (vx < GAUGE_LEFT || vx > GAUGE_RIGHT) continue;
        const marker = this.add.rectangle(vx, GAUGE_Y, 2, GAUGE_HEIGHT + 8, C.accent, 120)
          .setOrigin(0.5);
        this.gaugeRingMarkers.push(marker);
        this.gameContainer.add(marker);
      }
    }
    // Bullseye centre marker (thicker, gold)
    const cx = GAUGE_LEFT + (cfg.centre / cfg.width) * GAUGE_W;
    const centreMarker = this.add.rectangle(cx, GAUGE_Y, 3, GAUGE_HEIGHT + 12, 0xffd700)
      .setOrigin(0.5);
    this.gameContainer.add(centreMarker);
  }

  private buildGaugeReticle(): void {
    const initX = GAUGE_LEFT + (DEFAULT_CONFIG.centre / DEFAULT_CONFIG.width) * GAUGE_W;
    this.gaugeReticle = this.add.container(initX, GAUGE_Y);

    // Shadow
    const shadow = this.add.rectangle(2, 2, 4, GAUGE_HEIGHT + 16, C.reticleShadow, 80)
      .setOrigin(0.5);
    // Main bar
    const bar = this.add.rectangle(0, 0, 4, GAUGE_HEIGHT + 16, C.reticle)
      .setOrigin(0.5);
    // Crosshair arms
    const hArm = this.add.rectangle(0, 0, 20, 2, C.reticle, 200).setOrigin(0.5);
    // Arrow head triangle (top)
    const tri = this.add.triangle(0, -(GAUGE_HEIGHT / 2 + 12), -5, 0, 5, 0, 0, 10, C.reticle);

    this.gaugeReticle.add([shadow, bar, hArm, tri]);
    this.gameContainer.add(this.gaugeReticle);
  }

  // ── Dealing container ──────────────────────────────────────────────────────

  private buildDealingContainer(): void {
    this.dealingContainer = this.add.container(0, 0);

    const panel = this.add.rectangle(W / 2, H / 2, 240, 120, C.panelBg, 220)
      .setStrokeStyle(2, C.panelBorder);
    const label = this.add.text(W / 2, H / 2 - 24, "Preparing round…", {
      fontSize: "15px", color: "#c0a070",
    }).setOrigin(0.5);

    // 5 pulsing dots
    const dotRow = this.add.container(W / 2, H / 2 + 18);
    const dotSpacing = 24;
    const dotStart   = -(dotSpacing * 2);
    for (let i = 0; i < 5; i++) {
      const dot = this.add.circle(dotStart + i * dotSpacing, 0, 7, C.accent);
      this.dealingDots.push(dot);
      dotRow.add(dot);
    }
    this.dealingContainer.add([panel, label, dotRow]);
    this.dealingContainer.setVisible(false);
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private buildStatusBar(): void {
    this.statusText = this.add.text(W / 2, H - 12, "", {
      fontSize: "12px", color: "#c0a070",
    }).setOrigin(0.5).setDepth(5);
  }

  // ── Sync game UI ───────────────────────────────────────────────────────────

  private syncGameUI(
    pattern: string,
    targetAccuracy: number,
    difficulty: number,
    isSubmitting: boolean,
  ): void {
    // Rebuild progress dots when targetAccuracy changes
    if (targetAccuracy !== this.prevTargetAccuracy) {
      this.rebuildProgressDots(targetAccuracy);
      this.prevTargetAccuracy = targetAccuracy;
    }
    this.currentTargetAccuracy = targetAccuracy;

    // Parse and start animation when pattern changes
    if (pattern !== this.prevPattern) {
      this.prevPattern = pattern;
      this.parseAndStartPattern(pattern, difficulty);
    }

    // Update dots
    this.updateProgressDots();

    // Update timer
    this.updateTimerBar();

    // Score text
    const rule = ruleOf(difficulty);
    this.scoreText.setText(`${this.accuracyHits} / ${rule.targetAccuracy} accuracy hits`);

    // Submit button visibility
    const showSubmit = this.pendingSubmit && !isSubmitting;
    this.submitBtnContainer.setVisible(showSubmit);
    if (isSubmitting) {
      this.submitBtnLabel.setText("Submitting…");
      this.submitBtnBg.setFillStyle(C.panelBorder);
    } else {
      this.submitBtnLabel.setText("Submit Shots");
      this.submitBtnBg.setFillStyle(C.good);
    }
  }

  private rebuildProgressDots(count: number): void {
    // Remove old dots
    for (const dot of this.progressDots) {
      dot.destroy();
    }
    this.progressDots = [];

    const dotR    = 7;
    const spacing = 20;
    const totalW  = count * spacing - (spacing - dotR * 2);
    const startX  = W / 2 - totalW / 2 + dotR;

    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(startX + i * spacing, 60, dotR, C.dotPending)
        .setStrokeStyle(1.5, 0x333333);
      this.progressDots.push(dot);
      this.gameContainer.add(dot);
    }
  }

  private updateProgressDots(): void {
    this.progressDots.forEach((dot, i) => {
      if (i < this.accuracyHits) {
        dot.setFillStyle(C.dotHit).setStrokeStyle(2, 0x80ff80);
      } else if (i === this.accuracyHits) {
        dot.setFillStyle(C.dotCurrent).setStrokeStyle(2, C.accent);
      } else {
        dot.setFillStyle(C.dotPending).setStrokeStyle(1.5, 0x333333);
      }
    });
  }

  private updateTimerBar(): void {
    if (this.deadline <= 0 || this.dealtAt <= 0) return;
    const now       = Date.now();
    const total     = this.deadline - this.dealtAt;
    const remaining = Math.max(0, this.deadline - now);
    const pct       = total > 0 ? remaining / total : 1;
    const barW      = (W - 40) * pct;

    this.timerBar.setSize(Math.max(0, barW), 10);
    this.timerBar.setFillStyle(pct > 0.33 ? C.timerFull : C.timerLow);
    this.timerClock.setText(formatClock(remaining));

    if (remaining <= 0 && this.currentGameStatus === "dealt") {
      this.dispatch("expireGame", {});
    }
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  private parseAndStartPattern(pattern: string, difficulty: number): void {
    // Reset shot state for new round
    this.shotRings      = [];
    this.accuracyHits   = 0;
    this.pendingSubmit  = false;
    this.updateProgressDots();

    if (!pattern) {
      this.startPendulumTween(difficulty);
      return;
    }

    try {
      const positions = pattern
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (positions.length === 0) throw new Error("empty");
      this.patternPositions = positions;
      this.patternStartTime = this.time.now;
      this.isGameAnimating  = true;
      this.stopPendulumTween();
    } catch {
      this.startPendulumTween(difficulty);
    }
  }

  private startPendulumTween(difficulty: number): void {
    this.stopPendulumTween();
    if (this.reducedMotion) {
      this.currentGaugeLogical = DEFAULT_CONFIG.centre;
      return;
    }
    const period  = DIFFICULTY_PERIOD[difficulty] ?? 2000;
    const initX   = GAUGE_LEFT + (DEFAULT_CONFIG.centre / DEFAULT_CONFIG.width) * GAUGE_W;
    this.pendulumTween = this.tweens.add({
      targets:   this.gaugeReticle,
      x:         { from: GAUGE_LEFT, to: GAUGE_RIGHT },
      duration:  period / 2,
      ease:      "Sine.easeInOut",
      yoyo:      true,
      repeat:    -1,
      onUpdate:  () => {
        const rx = this.gaugeReticle.x;
        // Map visual x back to logical 0‥300
        this.currentGaugeLogical = ((rx - GAUGE_LEFT) / GAUGE_W) * DEFAULT_CONFIG.width;
      },
    });
    this.gaugeReticle.setX(initX);
    this.isGameAnimating = true;
  }

  private stopPendulumTween(): void {
    if (this.pendulumTween) {
      this.pendulumTween.stop();
      this.pendulumTween.destroy();
      this.pendulumTween = null;
    }
  }

  private startDealingAnimation(): void {
    if (this.dealingTween) return;
    this.dealingTween = this.tweens.addCounter({
      from: 0, to: 4,
      duration: 400,
      repeat: -1,
      onRepeat: (tween: Phaser.Tweens.Tween) => {
        const raw = tween.getValue();
        const idx = Math.round(raw ?? 0) % 5;
        this.dealingDots.forEach((dot, i) => {
          dot.setAlpha(i === idx ? 1 : 0.3);
          dot.setScale(i === idx ? 1.3 : 1);
        });
      },
    });
  }

  private stopDealingAnimation(): void {
    if (this.dealingTween) {
      this.dealingTween.stop();
      this.dealingTween.destroy();
      this.dealingTween = null;
    }
    this.dealingDots.forEach((dot) => dot.setAlpha(1).setScale(1));
  }

  private onStatusTransition(newStatus: string, _prevStatus: string): void {
    if (newStatus === "dealt") {
      // Fresh round — reset local shot tracking
      this.shotRings    = [];
      this.accuracyHits = 0;
      this.pendingSubmit = false;
      this.prevPattern  = ""; // force pattern re-parse on next sync
    } else if (newStatus === "idle" || newStatus === "solved" || newStatus === "expired") {
      this.isGameAnimating = false;
      this.stopPendulumTween();
      this.patternPositions = [];
      this.prevPattern      = "";
      this.prevTargetAccuracy = 0;
    }
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  private handleTap(): void {
    const status = this.currentGameStatus;
    if (status !== "dealt" || this.pendingSubmit) return;

    const pos = this.currentGaugeLogical;
    const hit = calculateHitResult(pos);

    // Record the shot in React layer
    this.dispatch("recordMove", { position: Math.round(pos) });

    // Update local state
    this.shotRings.push(hit.ring);
    if (isAccuracyHit(hit.ring)) {
      this.accuracyHits++;
    }

    // Visual feedback
    this.showHitFeedback(hit.ring);

    if (isAccuracyHit(hit.ring)) {
      this.pulseTargetRing(hit.ring);
    } else {
      this.shakeGauge();
    }

    // Update progress dots immediately
    this.updateProgressDots();

    // Check win condition
    if (this.accuracyHits >= this.currentTargetAccuracy) {
      this.pendingSubmit  = true;
      this.isGameAnimating = false;
      this.stopPendulumTween();
      // Park reticle at centre
      this.tweens.add({
        targets: this.gaugeReticle,
        x: GAUGE_LEFT + (DEFAULT_CONFIG.centre / DEFAULT_CONFIG.width) * GAUGE_W,
        duration: 300,
        ease: "Back.easeOut",
      });
      this.submitBtnContainer.setVisible(true);
      // Entrance animation for submit button
      this.submitBtnContainer.setScale(0.7).setAlpha(0);
      this.tweens.add({
        targets: this.submitBtnContainer,
        scale: 1, alpha: 1,
        duration: 260, ease: "Back.easeOut",
      });
    }

    this.scoreText.setText(
      `${this.accuracyHits} / ${this.currentTargetAccuracy} accuracy hits`,
    );
  }

  // ── Visual feedback ─────────────────────────────────────────────────────────

  private showHitFeedback(ring: number): void {
    let label  = "";
    let color  = "#ffffff";
    if (ring === 0)      { label = "BULLSEYE!"; color = "#ffd700"; }
    else if (ring <= 2)  { label = "HIT!";      color = "#48d890"; }
    else                 { label = "MISS";       color = "#e04040"; }

    this.feedbackText.setText(label).setColor(color).setAlpha(1).setScale(1.4);
    this.tweens.add({
      targets:  this.feedbackText,
      alpha:    0,
      scaleX:   1,
      scaleY:   1,
      y:        this.feedbackText.y - 20,
      duration: 700,
      ease:     "Sine.easeOut",
      onComplete: () => {
        this.feedbackText.setY(TGT_CY - 10);
      },
    });
  }

  private pulseTargetRing(ring: number): void {
    // ring 0 → targetRings array index is (RING_OUTER_RADII.length - 1 - 0) because drawn outer→inner
    const arrIdx = this.targetRings.length - 1 - ring;
    const ringObj = this.targetRings[arrIdx];
    if (!ringObj) return;

    const origScale = ringObj.scaleX;
    this.tweens.add({
      targets:   ringObj,
      scaleX:    1.25,
      scaleY:    1.25,
      duration:  120,
      ease:      "Sine.easeOut",
      yoyo:      true,
      onComplete: () => ringObj.setScale(origScale),
    });
    // Flash bright
    const origColor = (RING_COLORS[ring] as number) ?? C.white;
    ringObj.setFillStyle(0xffffff);
    this.time.delayedCall(100, () => ringObj.setFillStyle(origColor));
  }

  private shakeGauge(): void {
    const origX = this.gaugeReticle.x;
    let shakeCount = 0;
    const shakeStep = () => {
      if (shakeCount >= 4) {
        this.gaugeReticle.setX(origX);
        return;
      }
      const offset = shakeCount % 2 === 0 ? 8 : -8;
      this.tweens.add({
        targets:   this.gaugeReticle,
        x:         origX + offset,
        duration:  50,
        ease:      "Linear",
        onComplete: () => { shakeCount++; shakeStep(); },
      });
    };
    shakeStep();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.stopPendulumTween();
    this.stopDealingAnimation();
    super.destroy(fromScene);
  }
}
