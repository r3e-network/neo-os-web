/**
 * AimMasterScene.ts — Phaser 3 scene for the Aim Master archery game.
 *
 * Renders:
 *  - Real archery range backdrop
 *  - Target board sprite centered in the upper half
 *  - Oscillating reticle sprite / gauge mechanic
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

import * as Phaser from "phaser";
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
  canvas:      0xfaf9f7,
  surface:     0xffffff,
  surfaceAlt:  0xfffbeb,
  border:      0xe8e6e1,
  borderStrong: 0xd4d0c9,
  ink:         0x1a1a19,
  inkSoft:     0x5c5a56,
  inkTertiary: 0x8b8984,
  brand:       0x16c784,
  brandHover:  0x0ea371,
  accent:      0xf59e0b,
  white:       0xffffff,
  black:       0x000000,
  good:        0x48d890,
  danger:      0xe04040,
  timerFull:   0x16c784,
  timerLow:    0xe06030,
  dotHit:      0x48d890,
  dotCurrent:  0xf59e0b,
  dotPending:  0xd4d0c9,
  dotMiss:     0xe04040,
};

const AIM_ASSETS = {
  range: "aim-range-backdrop",
  target: "aim-target-board",
  reticle: "aim-reticle",
  badgeEasy: "aim-badge-easy",
  badgeMedium: "aim-badge-medium",
  badgeHard: "aim-badge-hard",
} as const;

const DIFFICULTY_BADGES = [
  AIM_ASSETS.badgeEasy,
  AIM_ASSETS.badgeMedium,
  AIM_ASSETS.badgeHard,
] as const;

const FONT_FAMILY = "Inter, Arial, sans-serif";

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
  private lobbyStartBtnBg!: Phaser.GameObjects.Graphics;
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
  private dealingReticle!: Phaser.GameObjects.Image;
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

  preload(): void {
    this.load.image(AIM_ASSETS.range, "./art/range-backdrop.webp");
    this.load.image(AIM_ASSETS.target, "./art/target-board.webp");
    this.load.image(AIM_ASSETS.reticle, "./art/reticle.webp");
    this.load.image(AIM_ASSETS.badgeEasy, "./art/badge-easy.webp");
    this.load.image(AIM_ASSETS.badgeMedium, "./art/badge-medium.webp");
    this.load.image(AIM_ASSETS.badgeHard, "./art/badge-hard.webp");
  }

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

    const fallbackStatus = this.defaultStatusText(showLobby, showDealing, showGame, isStarting, isSubmitting, poolFree);
    const forceFallback = showLobby && !this.selectedPoolIsReady(poolFree);
    this.statusText.setText(forceFallback ? fallbackStatus : lastStatus || fallbackStatus);

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
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);
    this.add.image(W / 2, 0, AIM_ASSETS.range)
      .setOrigin(0.5, 0)
      .setDisplaySize(W, 240)
      .setAlpha(0.96);
    this.add.rectangle(W / 2, 250, W, 70, 0xffffff, 0.42);
    this.add.rectangle(W / 2, 390, W, 300, 0xf4f2ef, 0.82);
  }

  // ── Lobby container ────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    this.lobbyContainer = this.add.container(0, 0).setDepth(20);

    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.14);
    const heroTarget = this.add.image(W / 2, 168, AIM_ASSETS.target)
      .setDisplaySize(184, 184);
    const heroReticle = this.add.image(W / 2, 168, AIM_ASSETS.reticle)
      .setDisplaySize(126, 126)
      .setAlpha(0.92);
    this.tweens.add({
      targets: heroReticle,
      angle: 8,
      scale: 1.04,
      duration: 900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.lobbyContainer.add([veil, heroTarget, heroReticle]);

    const cardW = 112;
    const cardH = 116;
    const cardY = 360;
    const totalW = DIFFICULTY_RULES.length * cardW + (DIFFICULTY_RULES.length - 1) * 12;
    const startX = (W - totalW) / 2 + cardW / 2;

    DIFFICULTY_RULES.forEach((rule, i) => {
      const cx = startX + i * (cardW + 12);
      const card = this.buildDiffCard(cx, cardY, cardW, cardH, rule);
      this.diffCards.push(card);
      this.lobbyContainer.add(card);
    });

    this.poolText = this.add.text(W / 2, H - 108, "Pool: 0.00 GAS", {
      fontSize: "12px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.poolText);

    this.lobbyStartBtnBg = this.add.graphics();
    this.drawLobbyStartButton(false, false);
    this.lobbyStartBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(W / 2 - 106, H - 82, 212, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.lobbyStartBtnBg, {
      targets: this.lobbyStartBtnBg,
      pressScale: 0.96,
      onPress: () => this.dispatch("startGame", { difficulty: this.selectedDifficulty }),
    });
    this.lobbyStartBtnBg.on("pointerover", () => this.drawLobbyStartButton(false, true));
    this.lobbyStartBtnBg.on("pointerout", () => this.drawLobbyStartButton(false, false));

    this.lobbyStartBtnLabel = this.add.text(W / 2, H - 60, "Start Aim", {
      fontSize: "15px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.lobbyContainer.add([this.lobbyStartBtnBg, this.lobbyStartBtnLabel]);
  }

  private buildDiffCard(
    cx: number, cy: number, cardW: number, cardH: number,
    rule: (typeof DIFFICULTY_RULES)[number],
  ): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const active = rule.difficulty === this.selectedDifficulty;

    const bg = this.add.graphics();
    this.drawDiffCardBackground(bg, cardW, cardH, active, false);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on("pointerover", () => this.drawDiffCardBackground(bg, cardW, cardH, true, true));
    bg.on("pointerout", () =>
      this.drawDiffCardBackground(bg, cardW, cardH, rule.difficulty === this.selectedDifficulty, false));
    bg.on("pointerdown", () => {
      this.selectedDifficulty = rule.difficulty;
      this.syncLobbyCards(false, this.num("poolFree", 0));
    });

    const badgeKey = DIFFICULTY_BADGES[rule.difficulty] ?? AIM_ASSETS.badgeEasy;
    const badge = this.add.image(0, -32, badgeKey).setDisplaySize(44, 44);

    const nameTxt = this.add.text(0, -2, rule.key.toUpperCase(), {
      fontSize: "12px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#1a1a19",
    }).setOrigin(0.5);

    const accTxt = this.add.text(0, 18, `${rule.targetAccuracy} hits`, {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);

    const rewardTxt = this.add.text(0, 38, `${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#0ea371",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(0, cardH / 2 - 10, `Entry ${gasDisplay(rule.entryFixed8)}`, {
      fontSize: "10px",
      fontFamily: FONT_FAMILY,
      color: "#8b8984",
    }).setOrigin(0.5);

    const dot = this.add.circle(-cardW / 2 + 12, -cardH / 2 + 12, 5, C.accent, active ? 1 : 0);
    c.add([bg, badge, nameTxt, accTxt, rewardTxt, entryTxt, dot]);
    return c;
  }

  private syncLobbyCards(isStarting: boolean, poolFree: number): void {
    const rule = ruleOf(this.selectedDifficulty);
    const poolEnough = poolFree >= Number(gasDisplay(rule.rewardFixed8));

    this.diffCards.forEach((card, i) => {
      const bg  = card.list[0] as Phaser.GameObjects.Graphics;
      const dot = card.list[card.list.length - 1] as Phaser.GameObjects.Arc;
      const active = i === this.selectedDifficulty;
      this.drawDiffCardBackground(bg, 112, 116, active, false);
      dot.setAlpha(active ? 1 : 0);
    });

    this.drawLobbyStartButton(isStarting || !poolEnough, false);
    this.lobbyStartBtnLabel.setText(isStarting ? "Starting…" : "Start Aim");
    this.lobbyStartBtnBg.disableInteractive();
    if (!isStarting && poolEnough) {
      this.lobbyStartBtnBg.setInteractive(
        new Phaser.Geom.Rectangle(W / 2 - 106, H - 82, 212, 44),
        Phaser.Geom.Rectangle.Contains,
      );
    }
  }

  private drawDiffCardBackground(
    bg: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    active: boolean,
    hover: boolean,
  ): void {
    bg.clear();
    bg.fillStyle(active || hover ? C.surfaceAlt : C.surface, active ? 0.98 : 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, active || hover ? C.accent : C.border, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  private drawLobbyStartButton(disabled: boolean, hover: boolean): void {
    this.lobbyStartBtnBg.clear();
    const fill = disabled ? C.borderStrong : hover ? C.brandHover : C.brand;
    this.lobbyStartBtnBg.fillStyle(fill, 1);
    this.lobbyStartBtnBg.fillRoundedRect(W / 2 - 106, H - 82, 212, 44, 12);
    this.lobbyStartBtnBg.lineStyle(2, disabled ? C.borderStrong : C.brandHover, 1);
    this.lobbyStartBtnBg.strokeRoundedRect(W / 2 - 106, H - 82, 212, 44, 12);
  }

  // ── Game container ─────────────────────────────────────────────────────────

  private buildGameContainer(): void {
    this.gameContainer = this.add.container(0, 0);

    // Progress dots row (built lazily in syncGameUI)
    // Timer bar
    const timerBgRect = this.add.rectangle(W / 2, 22, W - 40, 10, C.surface, 0.86)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    this.timerBarBg = timerBgRect;
    this.timerBar = this.add.rectangle(GAUGE_LEFT + 10, 22, W - 40, 10, C.timerFull)
      .setOrigin(0, 0.5);
    this.timerClock = this.add.text(W / 2, 38, "00:00", {
      fontSize: "13px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);
    this.gameContainer.add([timerBgRect, this.timerBar, this.timerClock]);

    // Target board
    this.buildTargetBoard();

    // Gauge track
    const gaugeTrackBg = this.add.rectangle(
      W / 2, GAUGE_Y, GAUGE_W + 20, GAUGE_HEIGHT + 10, C.surface, 0.94,
    ).setStrokeStyle(2, C.border).setOrigin(0.5);
    this.gaugeTrack = this.add.rectangle(
      GAUGE_LEFT, GAUGE_Y, GAUGE_W, GAUGE_HEIGHT, 0xe8e6e1,
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
      fontSize: "15px",
      fontFamily: FONT_FAMILY,
      color: "#1a1a19",
    }).setOrigin(0.5);
    this.gameContainer.add(this.scoreText);

    // Feedback text (hit/miss overlay)
    this.feedbackText = this.add.text(TGT_CX, TGT_CY - 10, "", {
      fontSize: "22px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#ffffff",
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
      fontSize: "17px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#0a2010",
    }).setOrigin(0.5);
    this.submitBtnContainer.add([this.submitBtnBg, this.submitBtnLabel]);
    this.submitBtnContainer.setVisible(false);
    this.gameContainer.add(this.submitBtnContainer);

    this.gameContainer.setVisible(false);
  }

  private buildTargetBoard(): void {
    this.targetContainer = this.add.container(TGT_CX, TGT_CY);

    const shadow = this.add.ellipse(4, 8, TGT_RADIUS * 2 + 10, TGT_RADIUS * 2 + 10, 0x1a1a19, 0.12);
    const target = this.add.image(0, 0, AIM_ASSETS.target)
      .setDisplaySize(TGT_RADIUS * 2, TGT_RADIUS * 2);
    this.targetContainer.add([shadow, target]);

    // Transparent feedback rings follow the real target art without replacing it.
    for (let r = RING_OUTER_RADII.length - 1; r >= 0; r--) {
      const radius = RING_OUTER_RADII[r]!;
      const color  = (RING_COLORS[r] as number) ?? C.white;
      const ring = this.add.circle(0, 0, radius, color)
        .setAlpha(0);
      this.targetRings.push(ring);
      this.targetContainer.add(ring);
    }

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
        const marker = this.add.rectangle(vx, GAUGE_Y, 2, GAUGE_HEIGHT + 8, C.accent, 0.42)
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

    const reticle = this.add.image(0, 0, AIM_ASSETS.reticle)
      .setDisplaySize(42, 42)
      .setAlpha(0.96);
    this.gaugeReticle.add(reticle);
    this.gameContainer.add(this.gaugeReticle);
  }

  // ── Dealing container ──────────────────────────────────────────────────────

  private buildDealingContainer(): void {
    this.dealingContainer = this.add.container(0, 0).setDepth(25);

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.66);
    const panel = this.add.rectangle(W / 2, H / 2, 244, 154, C.surface, 0.96)
      .setStrokeStyle(1, C.border);
    const target = this.add.image(W / 2, H / 2 + 18, AIM_ASSETS.target)
      .setDisplaySize(82, 82)
      .setAlpha(0.86);
    this.dealingReticle = this.add.image(W / 2, H / 2 + 18, AIM_ASSETS.reticle)
      .setDisplaySize(72, 72);
    const label = this.add.text(W / 2, H / 2 - 48, "Preparing round", {
      fontSize: "16px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#1a1a19",
    }).setOrigin(0.5);
    const hint = this.add.text(W / 2, H / 2 - 26, "TEE is sealing the aim pattern", {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);

    this.dealingContainer.add([bg, panel, label, hint, target, this.dealingReticle]);
    this.dealingContainer.setVisible(false);
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private buildStatusBar(): void {
    this.statusText = this.add.text(W / 2, H - 12, "", {
      fontSize: "12px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
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
      this.submitBtnBg.setFillStyle(C.borderStrong);
    } else {
      this.submitBtnLabel.setText("Submit Shots");
      this.submitBtnBg.setFillStyle(C.good);
    }
  }

  private defaultStatusText(
    showLobby: boolean,
    showDealing: boolean,
    showGame: boolean,
    isStarting: boolean,
    isSubmitting: boolean,
    poolFree: number,
  ): string {
    if (showGame) {
      return this.pendingSubmit || isSubmitting
        ? "Submit your verified shot sequence"
        : "Tap the gauge when the reticle crosses center";
    }
    if (showDealing) return "TEE is sealing the aim pattern";
    if (showLobby) {
      const rule = ruleOf(this.selectedDifficulty);
      const poolEnough = poolFree >= Number(gasDisplay(rule.rewardFixed8));
      if (isStarting) return "Starting sealed round";
      return poolEnough
        ? "Choose a target lane to enter"
        : "Reward pool needs GAS before entry";
    }
    return "";
  }

  private selectedPoolIsReady(poolFree: number): boolean {
    const rule = ruleOf(this.selectedDifficulty);
    return poolFree >= Number(gasDisplay(rule.rewardFixed8));
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
        .setStrokeStyle(1.5, C.borderStrong);
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
        dot.setFillStyle(C.dotPending).setStrokeStyle(1.5, C.borderStrong);
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
    this.dealingTween = this.tweens.add({
      targets: this.dealingReticle,
      angle: 360,
      scale: 1.12,
      duration: 900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopDealingAnimation(): void {
    if (this.dealingTween) {
      this.dealingTween.stop();
      this.dealingTween.destroy();
      this.dealingTween = null;
    }
    this.dealingReticle?.setAngle(0).setScale(1);
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
    ringObj.setAlpha(0.32);
    this.tweens.add({
      targets:   ringObj,
      scaleX:    1.25,
      scaleY:    1.25,
      alpha:     0,
      duration:  120,
      ease:      "Sine.easeOut",
      yoyo:      true,
      onComplete: () => ringObj.setScale(origScale).setAlpha(0),
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
