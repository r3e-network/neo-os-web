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
 *   "aimHit"         { ringsHit, totalRings, roundResults, totalPoints }
 *   "submitSolution" {}
 *   "expireGame"     {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import {
  DIFFICULTY_RULES,
  ruleOf,
  formatClock,
  gasDisplay,
} from "../logic/game-rules";
import {
  DEFAULT_CONFIG,
  EMPTY_AIM_RUN,
  calculateHitResult,
  difficultyProfile,
  evaluateHitResults,
  generateDifficultyPattern,
  isAccuracyHit,
  parseTargetPattern,
  scoreHit,
  type AimRunSummary,
  type ScoredHitResult,
} from "../logic/aim-engine";

// ── Layout constants ────────────────────────────────────────────────────────

const BASE_W = 400;
const BASE_H = 600;

// Target board
const BASE_TARGET_RADIUS = 88; // outer white ring outer edge at 400px baseline

// Ring visual radii (outer edge, px) — 5 rings + bullseye
const RING_OUTER_RADII = [14, 28, 42, 56, 70, BASE_TARGET_RADIUS] as const;

// Ring fill colors: bullseye(0)…outer(5).
// Tuned to the actual target-board.webp art (gold / coral / cream / teal) so a
// hit pulse blends with the board instead of flashing foreign archery colors.
const RING_COLORS: readonly number[] = [
  0xd93b3b, // red   — bullseye
  0xffffff, // white — ring 1
  0xd93b3b, // red   — ring 2
  0xffffff, // white — ring 3
  0xd93b3b, // red   — ring 4
  0xffffff, // white — ring 5
];

// Gauge strip
const GAUGE_HEIGHT = 16;
const SHOT_ACK_TIMEOUT_MS = 8_000;

// Lobby "how to play" hint fallback (localized value comes from messages.rulesShort).
const DEFAULT_HOWTO = "Tap the range when the moving reticle crosses the bullseye.";

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

const DIFFICULTY_LABEL_KEYS = [
  "difficultyEasyLabel",
  "difficultyMediumLabel",
  "difficultyHardLabel",
] as const;

const DIFFICULTY_TARGET_KEYS = [
  "difficultyEasyTarget",
  "difficultyMediumTarget",
  "difficultyHardTarget",
] as const;

const FONT_FAMILY = "Inter, Arial, sans-serif";

// ── Difficulty speed config (pendulum period in ms) ──────────────────────────

const DIFFICULTY_PERIOD: Record<number, number> = {
  0: 2800, // easy   — slow sweep
  1: 1900, // medium
  2: 1200, // hard   — fast sweep
};

export class AimMasterScene extends BaseScene {
  private scW = BASE_W;
  private scH = BASE_H;
  private sceneReady = false;
  private isRebuildingScene = false;

  // ── Lobby UI ───────────────────────────────────────────────────────────────
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffCards: Phaser.GameObjects.Container[] = [];
  private poolText!: Phaser.GameObjects.Text;
  private lobbyHintText!: Phaser.GameObjects.Text;
  private lobbyStartBtnBg!: Phaser.GameObjects.Graphics;
  private lobbyStartBtnLabel!: Phaser.GameObjects.Text;
  private selectedDifficulty = 0;
  private lobbyCardW = 112;
  private lobbyCardH = 116;
  private lobbyButtonY = BASE_H - 60;
  private dealingReticleSize = 72;

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
  private dealingLabel!: Phaser.GameObjects.Text;
  private dealingHint!: Phaser.GameObjects.Text;
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
  private inputLocked = false;
  private submitLocked = false;
  private expirationDispatched = false;
  private lastTimerPaintAt = Number.NEGATIVE_INFINITY;
  private lastReducedMotionStep = -1;
  private gameplayTimers = new Set<Phaser.Time.TimerEvent>();
  private awaitingShotAck = false;
  private lastA11yShotPulse = 0;
  private hasSeenA11yShotPulse = false;

  // Shot tracking (local — mirrors React's localRings)
  private shotRings: number[] = [];
  private shotResults: ScoredHitResult[] = [];
  private runSummary: AimRunSummary = { ...EMPTY_AIM_RUN };
  private accuracyHits = 0;
  private currentTargetAccuracy = 3;
  private currentDifficulty = 0;

  // Gauge position (0‥300 logical, maps to the responsive gauge lane)
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupGameplay, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupGameplay, this);
    this.syncSceneSize();

    this.buildBackground();
    this.buildLobbyContainer();
    this.buildGameContainer();
    this.buildDealingContainer();
    this.buildStatusBar();

    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  update(time: number, _delta: number): void {
    if (this.currentGameStatus === "dealt" && time - this.lastTimerPaintAt >= 100) {
      this.lastTimerPaintAt = time;
      this.updateTimerBar();
    }
    if (!this.isGameAnimating || this.patternPositions.length === 0 || this.expirationDispatched) return;

    // Keep the rendered reticle on the same wall-clock phase across reloads and
    // responsive rebuilds. Restarting from the center would hand out a free
    // bullseye whenever the viewport changed.
    const elapsed = this.dealtAt > 0
      ? Math.max(0, Date.now() - this.dealtAt)
      : Math.max(0, time - this.patternStartTime);
    let tickIndex = Math.floor(elapsed / DEFAULT_CONFIG.tickMs);
    if (this.reducedMotion) {
      const stepMs = difficultyProfile(this.currentDifficulty).reducedMotionStepMs;
      const step = Math.floor(elapsed / stepMs);
      if (step === this.lastReducedMotionStep) return;
      this.lastReducedMotionStep = step;
      tickIndex = Math.floor((step * stepMs) / DEFAULT_CONFIG.tickMs);
    }
    const wrapped   = tickIndex % this.patternPositions.length;
    const logicalPos = this.patternPositions[wrapped] ?? DEFAULT_CONFIG.centre;

    this.currentGaugeLogical = logicalPos;

    // Map logical 0‥300 → the current responsive gauge lane.
    this.gaugeReticle.setX(this.gaugeXFromLogical(logicalPos));
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    const previousW = this.scW;
    const previousH = this.scH;
    this.syncSceneSize();

    if (
      !this.sceneReady ||
      this.isRebuildingScene ||
      (previousW === this.scW && previousH === this.scH)
    ) {
      return;
    }

    this.rebuildResponsiveScene();
  }

  private syncSceneSize(): void {
    this.scW = Math.max(1, Math.round(this.scale.width || BASE_W));
    this.scH = Math.max(1, Math.round(this.scale.height || BASE_H));
  }

  private rebuildResponsiveScene(): void {
    this.isRebuildingScene = true;
    this.clearGameplayTimers();
    this.inputLocked = this.pendingSubmit || this.awaitingShotAck || this.expirationDispatched;
    this.submitLocked = this.bool("isSubmitting");
    this.stopPendulumTween();
    this.stopDealingAnimation();
    this.tweens.killAll();
    this.children.removeAll(true);

    this.diffCards = [];
    this.progressDots = [];
    this.targetRings = [];
    this.gaugeRingMarkers = [];
    this.prevTargetAccuracy = 0;

    this.buildBackground();
    this.buildLobbyContainer();
    this.buildGameContainer();
    this.buildDealingContainer();
    this.buildStatusBar();

    this.isRebuildingScene = false;
    this.onStateUpdate(this.state);
  }

  private gaugeLeft(): number {
    return Math.max(22, Math.round(this.scW * 0.065));
  }

  private gaugeRight(): number {
    return this.scW - this.gaugeLeft();
  }

  private gaugeWidth(): number {
    return Math.max(220, this.gaugeRight() - this.gaugeLeft());
  }

  private targetRadius(): number {
    return Math.round(Math.min(104, Math.max(76, Math.min(this.scW * 0.24, this.scH * 0.15))));
  }

  private targetY(): number {
    const maxY = Math.max(166, Math.min(258, this.scH - 360));
    return Math.round(Phaser.Math.Clamp(this.scH * 0.3, 166, maxY));
  }

  private gaugeY(): number {
    const targetBottom = this.targetY() + this.targetRadius();
    return Math.round(Phaser.Math.Clamp(this.scH - 180, targetBottom + 84, this.scH - 142));
  }

  private timerWidth(): number {
    return Math.max(220, this.scW - 44);
  }

  private gaugeXFromLogical(logicalPos: number): number {
    return this.gaugeLeft() + (logicalPos / DEFAULT_CONFIG.width) * this.gaugeWidth();
  }

  private gaugeLogicalFromX(x: number): number {
    return ((x - this.gaugeLeft()) / this.gaugeWidth()) * DEFAULT_CONFIG.width;
  }

  // ── BaseScene: state handler ───────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady || this.isRebuildingScene || !this.poolText || !this.statusText) {
      return;
    }

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
    const guest        = this.str("mode", "gamefi") === "guest";
    const selectedDifficulty = Phaser.Math.Clamp(
      Math.round(this.num("selectedDifficulty", this.selectedDifficulty)),
      0,
      2,
    );
    const a11yShotPulse = Math.max(0, Math.floor(this.num("a11yShotPulse", 0)));

    this.deadline  = deadline;
    this.dealtAt   = dealtAt;
    this.currentDifficulty = difficulty;
    this.selectedDifficulty = selectedDifficulty;

    // Pool text in lobby — guest has no reward pool, so show a local range label
    // instead of a "Pool … GAS" line.
    this.poolText.setText(
      guest
        ? this.str("guestPoolLabel", "Local practice range")
        : `${this.str("poolLabel", "Pool")}: ${poolFree.toFixed(2)} GAS`,
    );

    // Determine which layer to show
    const showLobby = (
      status === "idle"
      || status === "solved"
      || status === "expired"
      || status === "refunded"
    ) && !isStarting;
    const showDealing = isStarting
      || isDealing
      || status === "committed"
      || status === "unknown"
      || (status === "dealt" && !pattern);
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
    this.statusText.setPosition(
      this.scW / 2,
      showLobby ? Math.min(this.scH - 18, this.lobbyButtonY + 46) : this.scH - 18,
    );
    this.statusText.setText(forceFallback ? fallbackStatus : lastStatus || fallbackStatus);

    // Dealing animation
    this.dealingLabel.setText(
      status === "unknown"
        ? this.str("settlementPendingLabel", "Settlement pending")
        : this.str("preparingLabel", "Preparing round"),
    );
    this.dealingHint.setText(
      status === "unknown"
        ? this.str("settlementPendingLabel", "Waiting for the verified chain result")
        : guest
          ? this.str("localPreparingLabel", "Setting up your local run")
          : this.str("sealingLabel", "TEE is sealing the aim pattern"),
    );

    if (showDealing && status !== "unknown" && !this.dealingTween) {
      this.startDealingAnimation();
    } else if ((!showDealing || status === "unknown") && this.dealingTween) {
      this.stopDealingAnimation();
    }

    // Handle status transitions
    if (status !== this.currentGameStatus) {
      this.onStatusTransition(status, this.currentGameStatus);
      this.currentGameStatus = status;
    }

    if (!this.hasSeenA11yShotPulse) {
      this.hasSeenA11yShotPulse = true;
      this.lastA11yShotPulse = a11yShotPulse;
    } else if (a11yShotPulse !== this.lastA11yShotPulse) {
      this.lastA11yShotPulse = a11yShotPulse;
      if (showGame) this.handleTap();
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const w = this.scW;
    const h = this.scH;
    // The console is anchored to the foot of the board (buildLobbyContainer), so
    // the art has to reach it: a fixed 360 cap left a tall desktop board showing
    // bare fill between the range floor and the panel. Track the height instead.
    const rangeH = Math.min(Math.max(270, h * 0.52), 460);
    this.add.rectangle(w / 2, h / 2, w, h, C.canvas);
    this.add.image(w / 2, 0, AIM_ASSETS.range)
      .setOrigin(0.5, 0)
      .setDisplaySize(w, rangeH)
      .setAlpha(0.96);
    // Soft vertical fade blends the range floor into the warm canvas so the
    // backdrop reads as one continuous surface instead of a hard seam.
    const fade = this.add.graphics();
    fade.fillGradientStyle(0xffffff, 0xffffff, C.canvas, C.canvas, 0.5, 0.5, 0, 0);
    fade.fillRect(0, rangeH - 10, w, 92);
    this.add.rectangle(w / 2, h * 0.72, w, h * 0.56, 0xf4f2ef, 0.82);
  }

  // ── Lobby container ────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    this.lobbyContainer = this.add.container(0, 0).setDepth(20);
    const w = this.scW;
    const h = this.scH;
    const heroY = Math.round(Math.min(206, Math.max(140, h * 0.21)));
    const heroSize = Math.round(Math.min(132, Math.max(104, Math.min(w * 0.33, h * 0.18))));

    const veil = this.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.14);
    const heroGlow = this.add.ellipse(w / 2, heroY, heroSize * 1.5, heroSize * 1.5, 0xffffff, 0.24);
    const heroTarget = this.add.image(w / 2, heroY, AIM_ASSETS.target)
      .setDisplaySize(heroSize, heroSize);
    const reticleSize = heroSize * 0.58;
    const heroReticle = this.add.image(w / 2, heroY, AIM_ASSETS.reticle)
      .setDisplaySize(reticleSize, reticleSize)
      .setAlpha(0.72);
    const heroReticleScaleX = heroReticle.scaleX;
    const heroReticleScaleY = heroReticle.scaleY;
    // Ambient "breathing" reticle — gated so reduced-motion users get a calm,
    // static hero at rest (no unconditional infinite tween on a core object).
    if (!this.reducedMotion) {
      this.tween({
        targets: heroReticle,
        angle: 8,
        scaleX: heroReticleScaleX * 1.04,
        scaleY: heroReticleScaleY * 1.04,
        duration: 900,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
    this.lobbyContainer.add([veil, heroGlow, heroTarget, heroReticle]);

    // ── Vertical rhythm for the lower "range console" cluster ────────────────
    const cardW = Math.max(96, Math.floor((w - 38) / 3));
    const cardH = Math.round(Math.min(112, Math.max(100, h * 0.14)));
    this.lobbyCardW = cardW;
    this.lobbyCardH = cardH;
    const gap = Math.max(8, Math.floor((w - cardW * 3) / 4));
    const startX = gap + cardW / 2;

    // Center the cards→CTA group inside the region below the hero so the lobby
    // never leaves a hollow band between the pool line and the Start button.
    const gapCardsToPool = 28;
    const gapPoolToHint = 24;
    const gapHintToButton = 34;
    const btnHalf = 22;
    const panelPadTop = 18;
    const panelPadBottom = 14;
    const groupH = cardH + gapCardsToPool + gapPoolToHint + gapHintToButton + btnHalf + btnHalf;
    const heroBottom = heroY + heroSize / 2;
    const regionTop = heroBottom + 20;
    // Anchor the range console to the foot of the board rather than centring it
    // in the region below the hero. Centring split the region's slack evenly, so
    // half of it landed *under* the status caption with nothing to fill it — on
    // a tall desktop canvas that was a flat band about a quarter of the board
    // high. Anchored, the same slack sits above the panel, where the range
    // backdrop and its fade already paint. The max() keeps the panel clear of
    // the hero on short boards, where there is no slack to move.
    const statusReserve = 46;
    const groupTop = Math.round(Math.max(
      regionTop + panelPadTop,
      h - statusReserve - panelPadBottom - groupH,
    ));

    const cardY = groupTop + cardH / 2;
    const poolY = Math.round(cardY + cardH / 2 + gapCardsToPool);
    const hintY = Math.round(poolY + gapPoolToHint);
    this.lobbyButtonY = Math.round(hintY + gapHintToButton + btnHalf);

    // Grouping surface behind the console so the cards sit on a range panel
    // rather than floating on bare canvas.
    const panelPadX = Math.max(10, Math.min(20, gap));
    const lastCx = startX + 2 * (cardW + gap);
    const panelLeft = startX - cardW / 2 - panelPadX;
    const panelRight = lastCx + cardW / 2 + panelPadX;
    const panelW = panelRight - panelLeft;
    const panelTop = cardY - cardH / 2 - panelPadTop;
    const panelBottom = this.lobbyButtonY + btnHalf + panelPadBottom;
    const panel = this.add.graphics();
    panel.fillStyle(0x1a1a19, 0.06);
    panel.fillRoundedRect(panelLeft + 3, panelTop + 6, panelW, panelBottom - panelTop, 20);
    panel.fillStyle(C.white, 0.72);
    panel.fillRoundedRect(panelLeft, panelTop, panelW, panelBottom - panelTop, 20);
    panel.lineStyle(1.5, C.border, 0.9);
    panel.strokeRoundedRect(panelLeft, panelTop, panelW, panelBottom - panelTop, 20);
    this.lobbyContainer.add(panel);

    DIFFICULTY_RULES.forEach((rule, i) => {
      const cx = startX + i * (cardW + gap);
      const card = this.buildDiffCard(cx, cardY, cardW, cardH, rule);
      this.diffCards.push(card);
      this.lobbyContainer.add(card);
    });

    this.poolText = this.add.text(w / 2, poolY, "Pool: 0.00 GAS", {
      fontSize: "12px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#5c5a56",
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.poolText);

    // Genre "how to play" hint — fills the space between pool and CTA and comes
    // from messages.rulesShort (localized via the bridge).
    this.lobbyHintText = this.add.text(w / 2, hintY, this.str("rulesShort", DEFAULT_HOWTO), {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color: "#8b8984",
      align: "center",
      wordWrap: { width: panelW - 36 },
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.lobbyHintText);

    this.lobbyStartBtnBg = this.add.graphics();
    this.drawLobbyStartButton(false, false);
    this.lobbyStartBtnBg.setInteractive(
      this.lobbyButtonHitArea(),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.lobbyStartBtnBg, {
      targets: this.lobbyStartBtnBg,
      pressScale: 0.96,
      // Fleet pool gate: even if a press lands before syncLobbyCards toggles
      // interactivity, never dispatch a paid start the pool cannot pay out.
      // selectedPoolIsReady() exempts guest (free local) play.
      enabled: () => !this.bool("isStarting")
        && this.selectedPoolIsReady(this.num("poolFree", 0)),
      onPress: () => this.dispatch("startGame", { difficulty: this.selectedDifficulty }),
    });
    this.lobbyStartBtnBg.on("pointerover", () => this.drawLobbyStartButton(false, true));
    this.lobbyStartBtnBg.on("pointerout", () => this.drawLobbyStartButton(false, false));

    this.lobbyStartBtnLabel = this.add.text(w / 2, this.lobbyButtonY, "Start Aim", {
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
    const compactCard = cardH <= 104 || cardW <= 110;
    const badgeY = compactCard ? -31 : -32;
    const nameY = compactCard ? -5 : -2;
    const accY = compactCard ? 14 : 18;
    const rewardY = compactCard ? 29 : 34;
    const entryY = compactCard ? cardH / 2 - 6 : cardH / 2 - 10;

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
      this.sfx.unlock();
      this.sfx.play("select");
      this.selectedDifficulty = rule.difficulty;
      this.dispatch("selectDifficulty", { difficulty: rule.difficulty });
      this.syncLobbyCards(false, this.num("poolFree", 0));
    });

    const badgeKey = DIFFICULTY_BADGES[rule.difficulty] ?? AIM_ASSETS.badgeEasy;
    const badge = this.add.image(0, badgeY, badgeKey).setDisplaySize(44, 44);

    const difficultyLabelKey = DIFFICULTY_LABEL_KEYS[rule.difficulty] ?? DIFFICULTY_LABEL_KEYS[0];
    const difficultyTargetKey = DIFFICULTY_TARGET_KEYS[rule.difficulty] ?? DIFFICULTY_TARGET_KEYS[0];
    const nameTxt = this.add.text(0, nameY, this.str(difficultyLabelKey, rule.key.toUpperCase()), {
      fontSize: compactCard ? "11px" : "12px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#1a1a19",
    }).setOrigin(0.5);

    const accTxt = this.add.text(
      0,
      accY,
      this.str(difficultyTargetKey, `${rule.targetAccuracy} hits`),
      {
        fontSize: compactCard ? "10px" : "11px",
        fontFamily: FONT_FAMILY,
        color: "#5c5a56",
      },
    ).setOrigin(0.5);

    const rewardTxt = this.add.text(0, rewardY, `${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: compactCard ? "10px" : "11px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#0ea371",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(
      0,
      entryY,
      `${this.str("entryLabel", "Entry")} ${gasDisplay(rule.entryFixed8)}`,
      {
        fontSize: compactCard ? "9px" : "10px",
        fontFamily: FONT_FAMILY,
        color: "#8b8984",
      },
    ).setOrigin(0.5);

    // Selected-lane treatment: an accent check chip (top-left) plus an accent
    // underline beneath the lane name — an unambiguous "this lane is chosen".
    const sel = this.add.container(0, 0);
    const chipR = 8;
    const chip = this.add.circle(-cardW / 2 + chipR + 5, -cardH / 2 + chipR + 5, chipR, C.accent)
      .setStrokeStyle(1.5, C.white);
    // Drawn checkmark (vector, not a glyph) so the selected lane reads as real
    // game art rather than an emoji/text placeholder.
    const check = this.add.graphics();
    check.lineStyle(1.8, C.white, 1);
    check.beginPath();
    check.moveTo(chip.x - 3.4, chip.y + 0.2);
    check.lineTo(chip.x - 1.1, chip.y + 2.7);
    check.lineTo(chip.x + 3.6, chip.y - 2.9);
    check.strokePath();
    const underline = this.add.rectangle(0, nameY + (compactCard ? 11 : 12), 34, 3, C.accent)
      .setOrigin(0.5);
    sel.add([underline, chip, check]);
    sel.setAlpha(active ? 1 : 0);

    c.add([bg, badge, nameTxt, accTxt, rewardTxt, entryTxt, sel]);
    c.setData("bg", bg);
    c.setData("sel", sel);
    // Refs for mode-aware lane copy (guest hides the GAS reward/entry framing).
    c.setData("reward", rewardTxt);
    c.setData("entry", entryTxt);
    c.setData("rule", rule);
    return c;
  }

  private syncLobbyCards(isStarting: boolean, poolFree: number): void {
    const guest = this.str("mode", "gamefi") === "guest";
    const rule = ruleOf(this.selectedDifficulty);
    // Guest is a free local game — the reward pool never gates the start.
    const poolEnough = guest || poolFree >= Number(gasDisplay(rule.rewardFixed8));

    this.diffCards.forEach((card, i) => {
      const bg  = card.getData("bg") as Phaser.GameObjects.Graphics;
      const sel = card.getData("sel") as Phaser.GameObjects.Container;
      const active = i === this.selectedDifficulty;
      this.drawDiffCardBackground(bg, this.lobbyCardW, this.lobbyCardH, active, false);
      sel?.setAlpha(active ? 1 : 0);
      // Mode-aware lane copy: guest replaces "X GAS" / "Entry X" with local
      // framing so no reward/entry-fee text appears in the free game.
      const rewardTxt = card.getData("reward") as Phaser.GameObjects.Text | undefined;
      const entryTxt  = card.getData("entry") as Phaser.GameObjects.Text | undefined;
      const cardRule  = card.getData("rule") as (typeof DIFFICULTY_RULES)[number] | undefined;
      if (rewardTxt) {
        rewardTxt.setText(
          guest
            ? this.str("guestRewardLabel", "Local")
            : `${gasDisplay(cardRule?.rewardFixed8 ?? rule.rewardFixed8)} GAS`,
        );
      }
      if (entryTxt) {
        entryTxt.setText(
          guest
            ? this.str("guestEntryLabel", "Free")
            : `${this.str("entryLabel", "Entry")} ${gasDisplay(cardRule?.entryFixed8 ?? rule.entryFixed8)}`,
        );
      }
    });

    if (this.lobbyHintText) {
      this.lobbyHintText.setText(this.str("rulesShort", DEFAULT_HOWTO));
    }

    this.drawLobbyStartButton(isStarting || !poolEnough, false);
    this.lobbyStartBtnLabel.setText(
      isStarting ? this.str("startingActionLabel", "Starting…") : this.str("startActionLabel", "Start Aim"),
    );
    this.lobbyStartBtnBg.disableInteractive();
    if (!isStarting && poolEnough) {
      this.lobbyStartBtnBg.setInteractive(
        this.lobbyButtonHitArea(),
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
    // Disabled keeps a muted brand tint (not a dead grey slab) so it still reads
    // as the game's primary control while the low-pool status sits right beneath.
    const fill = disabled ? 0xb7e2d1 : hover ? C.brandHover : C.brand;
    const stroke = disabled ? 0x94ccb8 : C.brandHover;
    this.lobbyStartBtnBg.fillStyle(fill, 1);
    this.lobbyStartBtnBg.fillRoundedRect(this.scW / 2 - 112, this.lobbyButtonY - 22, 224, 44, 12);
    this.lobbyStartBtnBg.lineStyle(2, stroke, 1);
    this.lobbyStartBtnBg.strokeRoundedRect(this.scW / 2 - 112, this.lobbyButtonY - 22, 224, 44, 12);
    if (this.lobbyStartBtnLabel) {
      this.lobbyStartBtnLabel.setColor(disabled ? "#2f7a5f" : "#ffffff");
    }
  }

  private lobbyButtonHitArea(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.scW / 2 - 112, this.lobbyButtonY - 22, 224, 44);
  }

  // ── Game container ─────────────────────────────────────────────────────────

  private buildGameContainer(): void {
    this.gameContainer = this.add.container(0, 0);
    const centerX = this.scW / 2;
    const gaugeY = this.gaugeY();
    const gaugeLeft = this.gaugeLeft();
    const gaugeWidth = this.gaugeWidth();
    const timerW = this.timerWidth();
    const timerLeft = centerX - timerW / 2;

    // Progress dots row (built lazily in syncGameUI)
    // Timer bar
    const timerBgRect = this.add.rectangle(centerX, 22, timerW, 10, C.surface, 0.86)
      .setStrokeStyle(1, C.border)
      .setOrigin(0.5);
    this.timerBarBg = timerBgRect;
    this.timerBar = this.add.rectangle(timerLeft, 22, timerW, 10, C.timerFull)
      .setOrigin(0, 0.5);
    this.timerClock = this.add.text(centerX, 38, "00:00", {
      fontSize: "13px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);
    this.gameContainer.add([timerBgRect, this.timerBar, this.timerClock]);

    // Target board
    this.buildTargetBoard();

    // Gauge track
    const gaugeTrackBg = this.add.rectangle(
      centerX, gaugeY, gaugeWidth + 20, GAUGE_HEIGHT + 10, C.surface, 0.94,
    ).setStrokeStyle(2, C.border).setOrigin(0.5);
    this.gaugeTrack = this.add.rectangle(
      gaugeLeft, gaugeY, gaugeWidth, GAUGE_HEIGHT, 0xe8e6e1,
    ).setOrigin(0, 0.5);
    this.gameContainer.add([gaugeTrackBg, this.gaugeTrack]);

    // Ring zone markers on gauge (visual guides)
    this.buildGaugeMarkers();

    // Reticle (crosshair) — positioned at logical centre initially
    this.buildGaugeReticle();

    // The range itself is the control: tapping the target, lane, or gauge fires
    // at the current reticle position. This gives touch users a forgiving,
    // game-like interaction surface instead of a narrow invisible button.
    const shotZoneTop = Math.max(64, this.targetY() - this.targetRadius() - 18);
    const shotZoneBottom = Math.min(this.scH - 96, gaugeY + 54);
    this.gaugeTapZone = this.add.rectangle(
      centerX,
      (shotZoneTop + shotZoneBottom) / 2,
      Math.max(220, this.scW - 28),
      Math.max(72, shotZoneBottom - shotZoneTop),
      0x000000,
      0,
    )
      .setInteractive({ useHandCursor: true });
    this.gaugeTapZone.on("pointerdown", () => this.handleTap());
    this.gameContainer.add(this.gaugeTapZone);

    // Score row
    this.scoreText = this.add.text(centerX, gaugeY + 38, "0 / 0 hits", {
      fontSize: "15px",
      fontFamily: FONT_FAMILY,
      color: "#1a1a19",
    }).setOrigin(0.5);
    this.gameContainer.add(this.scoreText);

    // Feedback text (hit/miss overlay). A dark stroke + drop shadow keeps
    // BULLSEYE/HIT/MISS legible over the light cream range and target art.
    this.feedbackText = this.add.text(centerX, this.targetY() - 10, "", {
      fontSize: "22px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(10);
    this.feedbackText.setStroke("#241d16", 5);
    this.feedbackText.setShadow(0, 2, "rgba(26,21,16,0.45)", 4, true, true);
    this.gameContainer.add(this.feedbackText);

    // Submit button (shown when pendingSubmit)
    this.submitBtnContainer = this.add.container(centerX, Math.min(this.scH - 62, gaugeY + 76));
    this.submitBtnBg = this.add.rectangle(0, 0, 200, 44, C.good)
      .setStrokeStyle(2, 0x80ffa0)
      .setOrigin(0.5);
    this.submitBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.submitBtnBg, {
      targets: this.submitBtnContainer,
      pressScale: 0.96,
      onPress: () => this.handleSubmit(),
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
    const radius = this.targetRadius();
    this.targetContainer = this.add.container(this.scW / 2, this.targetY());

    const shadow = this.add.ellipse(4, 8, radius * 2 + 10, radius * 2 + 10, 0x1a1a19, 0.12);
    const target = this.add.image(0, 0, AIM_ASSETS.target)
      .setDisplaySize(radius * 2, radius * 2);
    this.targetContainer.add([shadow, target]);

    // Transparent feedback rings follow the real target art without replacing it.
    for (let r = RING_OUTER_RADII.length - 1; r >= 0; r--) {
      const radius = RING_OUTER_RADII[r]!;
      const color  = (RING_COLORS[r] as number) ?? C.white;
      const scaledRadius = radius * (this.targetRadius() / BASE_TARGET_RADIUS);
      const ring = this.add.circle(0, 0, scaledRadius, color)
        .setAlpha(0);
      this.targetRings.push(ring);
      this.targetContainer.add(ring);
    }

    this.gameContainer.add(this.targetContainer);
  }

  private buildGaugeMarkers(): void {
    const cfg = DEFAULT_CONFIG;
    const gaugeLeft = this.gaugeLeft();
    const gaugeRight = this.gaugeRight();
    const gaugeWidth = this.gaugeWidth();
    const gaugeY = this.gaugeY();
    // Draw ring boundary lines on gauge
    const zoneCount = 6;
    for (let r = 0; r <= zoneCount; r++) {
      const dist = cfg.bullseyeRadius + r * cfg.ringWidth;
      for (const side of [-1, 1]) {
        const logPos = cfg.centre + side * dist;
        const vx = gaugeLeft + (logPos / cfg.width) * gaugeWidth;
        if (vx < gaugeLeft || vx > gaugeRight) continue;
        const marker = this.add.rectangle(vx, gaugeY, 2, GAUGE_HEIGHT + 8, C.accent, 0.42)
          .setOrigin(0.5);
        this.gaugeRingMarkers.push(marker);
        this.gameContainer.add(marker);
      }
    }
    // Bullseye centre marker (thicker, gold)
    const cx = gaugeLeft + (cfg.centre / cfg.width) * gaugeWidth;
    const centreMarker = this.add.rectangle(cx, gaugeY, 3, GAUGE_HEIGHT + 12, 0xffd700)
      .setOrigin(0.5);
    this.gameContainer.add(centreMarker);
  }

  private buildGaugeReticle(): void {
    const initX = this.gaugeXFromLogical(DEFAULT_CONFIG.centre);
    this.gaugeReticle = this.add.container(initX, this.gaugeY());

    const reticle = this.add.image(0, 0, AIM_ASSETS.reticle)
      .setDisplaySize(Math.min(46, Math.max(38, this.scW * 0.11)), Math.min(46, Math.max(38, this.scW * 0.11)))
      .setAlpha(0.96);
    this.gaugeReticle.add(reticle);
    this.gameContainer.add(this.gaugeReticle);
  }

  // ── Dealing container ──────────────────────────────────────────────────────

  private buildDealingContainer(): void {
    this.dealingContainer = this.add.container(0, 0).setDepth(25);

    const cx = this.scW / 2;
    const cy = this.scH / 2;
    const bg = this.add.rectangle(cx, cy, this.scW, this.scH, 0xffffff, 0.66);
    const panel = this.add.rectangle(cx, cy, 244, 154, C.surface, 0.96)
      .setStrokeStyle(1, C.border);
    const target = this.add.image(cx, cy + 18, AIM_ASSETS.target)
      .setDisplaySize(82, 82)
      .setAlpha(0.86);
    this.dealingReticleSize = Math.min(78, Math.max(64, this.scW * 0.19));
    this.dealingReticle = this.add.image(cx, cy + 18, AIM_ASSETS.reticle)
      .setDisplaySize(this.dealingReticleSize, this.dealingReticleSize);
    this.dealingLabel = this.add.text(cx, cy - 48, "Preparing round", {
      fontSize: "16px",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      color: "#1a1a19",
    }).setOrigin(0.5);
    this.dealingHint = this.add.text(cx, cy - 26, "TEE is sealing the aim pattern", {
      fontSize: "11px",
      fontFamily: FONT_FAMILY,
      color: "#5c5a56",
    }).setOrigin(0.5);

    this.dealingContainer.add([
      bg,
      panel,
      this.dealingLabel,
      this.dealingHint,
      target,
      this.dealingReticle,
    ]);
    this.dealingContainer.setVisible(false);
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private buildStatusBar(): void {
    this.statusText = this.add.text(this.scW / 2, this.scH - 18, "", {
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
    } else {
      this.syncCanonicalShotLog();
    }

    // Update dots
    this.updateProgressDots();

    // Update timer
    this.updateTimerBar();

    // Score text
    this.updateScoreText();

    // Submit button visibility
    const showSubmit = this.pendingSubmit
      && !this.awaitingShotAck
      && !isSubmitting
      && this.canSubmitNow();
    this.submitBtnContainer.setVisible(showSubmit);
    if (isSubmitting) this.submitLocked = true;
    if (isSubmitting) {
      this.submitBtnLabel.setText(this.str("submittingActionLabel", "Submitting…"));
      this.submitBtnBg.setFillStyle(C.borderStrong);
    } else {
      this.submitBtnLabel.setText(this.str("submitActionLabel", "Submit Shots"));
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
        ? this.str("submitVerifiedLabel", "Submit your verified shot sequence")
        : this.str("tapCenterLabel", "Tap when the reticle crosses center");
    }
    const guest = this.str("mode", "gamefi") === "guest";
    if (this.str("gameStatus", this.currentGameStatus) === "unknown") {
      return this.str("settlementPendingLabel", "Settlement pending");
    }
    if (showDealing) {
      return guest
        ? this.str("localPreparingLabel", "Setting up your local run")
        : this.str("sealingLabel", "TEE is sealing the aim pattern");
    }
    if (showLobby) {
      if (guest) return this.str("chooseLaneLabel", "Pick a lane to start a local run");
      const rule = ruleOf(this.selectedDifficulty);
      const poolEnough = poolFree >= Number(gasDisplay(rule.rewardFixed8));
      if (isStarting) return this.str("startingSealedLabel", "Starting sealed round");
      return poolEnough
        ? this.str("chooseLaneLabel", "Choose a target lane to enter")
        : this.str("poolNeedsGasLabel", "Reward pool needs GAS before entry");
    }
    return "";
  }

  private selectedPoolIsReady(poolFree: number): boolean {
    // Guest never stakes a reward pool, so the lane is always "ready".
    if (this.str("mode", "gamefi") === "guest") return true;
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
    const startX  = this.scW / 2 - totalW / 2 + dotR;

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
    const barW      = this.timerWidth() * pct;

    this.timerBar.setSize(Math.max(0, barW), 10);
    this.timerBar.setFillStyle(pct > 0.33 ? C.timerFull : C.timerLow);
    this.timerClock.setText(formatClock(remaining));

    if (this.pendingSubmit && !this.awaitingShotAck && !this.bool("isSubmitting")) {
      const canSubmit = this.canSubmitNow();
      this.submitBtnContainer.setVisible(canSubmit);
      if (!canSubmit) {
        const unlockIn = Math.max(
          0,
          this.dealtAt + ruleOf(this.currentDifficulty).minSolveMs - now,
        );
        this.statusText.setText(
          this.str("minSolveHintTemplate", "Submission unlocks in {clock}")
            .replace("{clock}", formatClock(unlockIn)),
        );
      }
    }

    if (remaining <= 0) this.expireRoundOnce();
  }

  private canSubmitNow(now = Date.now()): boolean {
    if (!this.pendingSubmit && !(this.deadline > 0 && now >= this.deadline)) return false;
    if (this.deadline > 0 && now >= this.deadline) return true;
    if (this.str("mode", "gamefi") === "guest") return true;
    return this.dealtAt > 0
      && now >= this.dealtAt + ruleOf(this.currentDifficulty).minSolveMs;
  }

  private expireRoundOnce(): void {
    if (this.expirationDispatched || this.currentGameStatus !== "dealt") return;
    this.expirationDispatched = true;
    this.inputLocked = true;
    this.pendingSubmit = false;
    this.isGameAnimating = false;
    this.stopPendulumTween();
    this.submitBtnContainer?.setVisible(false);
    if (this.str("mode", "gamefi") === "guest") {
      this.dispatch("expireGame", {});
      return;
    }
    // Paid sessions must be finalized through the TEE/kernel. The contract's
    // expireGame recovery path is invalid until ten minutes after the deadline.
    this.pendingSubmit = true;
    this.submitLocked = true;
    this.dispatch("submitSolution", {});
  }

  private updateScoreText(): void {
    const shotsUnit = this.runSummary.totalShots === 1
      ? this.str("shotUnit", "shot")
      : this.str("shotsUnit", "shots");
    const combo = this.runSummary.combo > 1
      ? `  •  x${this.runSummary.combo} ${this.str("comboUnit", "combo")}`
      : "";
    this.scoreText.setText(
      `${this.accuracyHits}/${this.currentTargetAccuracy} ${this.str("hitsUnit", "hits")}`
      + `  •  ${this.runSummary.score} ${this.str("pointsUnit", "pts")}`
      + `  •  ${this.runSummary.totalShots} ${shotsUnit}${combo}`,
    );
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  private parseAndStartPattern(pattern: string, difficulty: number): void {
    this.resetRoundRuntime();
    // A resize/rebuild can happen mid-round. Rehydrate from the canonical shot
    // log in the bridge instead of silently erasing the live run.
    const restored = evaluateHitResults(this.val<unknown[]>("roundResults", []) ?? []);
    this.runSummary = restored.summary;
    this.shotResults = restored.results;
    this.shotRings = restored.results.map((result) => result.ring);
    this.accuracyHits = restored.summary.accuracyHits;
    this.pendingSubmit = this.accuracyHits >= this.currentTargetAccuracy;
    this.updateProgressDots();
    this.updateScoreText();

    if (!pattern) {
      this.startPendulumTween(difficulty);
      return;
    }

    const positions = parseTargetPattern(pattern);
    if (positions.length === 0) {
      // A corrupt TEE view must never fall back to a different client-only
      // trajectory: the player would see one target while settlement replays
      // another. Guest can safely regenerate locally; paid mode fails closed.
      if (this.str("mode", "gamefi") === "guest") {
        this.startPendulumTween(difficulty);
      } else {
        this.patternPositions = [];
        this.isGameAnimating = false;
        this.inputLocked = true;
        this.statusText.setText(
          this.str("patternInvalidLabel", "Target pattern unavailable — retry sealing"),
        );
      }
      return;
    }

    this.patternPositions = positions;
    this.patternStartTime = this.time.now;
    this.isGameAnimating  = !this.pendingSubmit;
    this.lastReducedMotionStep = -1;
    this.stopPendulumTween();
  }

  private syncCanonicalShotLog(force = false): void {
    const canonical = evaluateHitResults(this.val<unknown[]>("roundResults", []) ?? []);
    if (
      this.awaitingShotAck
      && !force
      && canonical.results.length < this.shotResults.length
    ) {
      return;
    }

    const sameLog = canonical.results.length === this.shotResults.length
      && canonical.results.every(
        (result, index) => result.offset === this.shotResults[index]?.offset,
      );
    if (!sameLog) {
      this.runSummary = canonical.summary;
      this.shotResults = canonical.results;
      this.shotRings = canonical.results.map((result) => result.ring);
      this.accuracyHits = canonical.summary.accuracyHits;
    }

    this.awaitingShotAck = false;
    this.pendingSubmit = this.accuracyHits >= this.currentTargetAccuracy;
    this.inputLocked = this.pendingSubmit || this.expirationDispatched;
    if (this.pendingSubmit) {
      this.isGameAnimating = false;
      this.stopPendulumTween();
    } else if (this.currentGameStatus === "dealt" && this.patternPositions.length > 0) {
      this.isGameAnimating = true;
    }
    this.updateProgressDots();
    this.updateScoreText();
  }

  private startPendulumTween(difficulty: number): void {
    this.stopPendulumTween();
    if (this.reducedMotion) {
      // Preserve the timing challenge without continuous movement: use a
      // deterministic path and reveal it in discrete, low-motion steps.
      this.patternPositions = generateDifficultyPattern("aim-master-fallback", difficulty);
      this.patternStartTime = this.time.now;
      this.lastReducedMotionStep = -1;
      this.isGameAnimating = true;
      return;
    }
    const period  = DIFFICULTY_PERIOD[difficulty] ?? 2000;
    const initX   = this.gaugeXFromLogical(DEFAULT_CONFIG.centre);
    this.pendulumTween = this.tweens.add({
      targets:   this.gaugeReticle,
      x:         { from: this.gaugeLeft(), to: this.gaugeRight() },
      duration:  period / 2,
      ease:      "Sine.easeInOut",
      yoyo:      true,
      repeat:    -1,
      onUpdate:  () => {
        const rx = this.gaugeReticle.x;
        // Map visual x back to logical 0‥300
        this.currentGaugeLogical = this.gaugeLogicalFromX(rx);
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
    // Reduced-motion: leave the dealing reticle static rather than spinning it
    // on an unconditional infinite tween.
    if (this.reducedMotion) return;
    const baseScaleX = this.dealingReticle.scaleX;
    const baseScaleY = this.dealingReticle.scaleY;
    this.dealingTween = this.tweens.add({
      targets: this.dealingReticle,
      angle: 360,
      scaleX: baseScaleX * 1.12,
      scaleY: baseScaleY * 1.12,
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
    this.dealingReticle?.setAngle(0).setDisplaySize(this.dealingReticleSize, this.dealingReticleSize);
  }

  private onStatusTransition(newStatus: string, _prevStatus: string): void {
    if (newStatus === "dealt") {
      this.sfx.play("start");
      this.expirationDispatched = false;
      this.lastTimerPaintAt = Number.NEGATIVE_INFINITY;
    } else if (newStatus === "unknown") {
      this.clearGameplayTimers();
      this.awaitingShotAck = false;
      this.inputLocked = true;
      this.isGameAnimating = false;
      this.stopPendulumTween();
    } else if (
      newStatus === "idle"
      || newStatus === "solved"
      || newStatus === "expired"
      || newStatus === "refunded"
    ) {
      if (newStatus === "solved")  this.sfx.play("win");
      if (newStatus === "expired") this.sfx.play("lose");
      this.clearGameplayTimers();
      this.awaitingShotAck = false;
      this.inputLocked = true;
      this.isGameAnimating = false;
      this.stopPendulumTween();
      this.patternPositions = [];
      this.prevPattern      = "";
      this.prevTargetAccuracy = 0;
    }
  }

  private resetRoundRuntime(): void {
    this.clearGameplayTimers();
    this.shotRings = [];
    this.shotResults = [];
    this.runSummary = { ...EMPTY_AIM_RUN };
    this.accuracyHits = 0;
    this.pendingSubmit = false;
    this.awaitingShotAck = false;
    this.inputLocked = false;
    this.submitLocked = false;
    this.expirationDispatched = false;
    this.lastTimerPaintAt = Number.NEGATIVE_INFINITY;
    this.lastReducedMotionStep = -1;
    this.feedbackText?.setText("").setAlpha(0).setY(this.targetY() - 10);
    this.submitBtnContainer?.setVisible(false).setScale(1).setAlpha(1);
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  private handleTap(): void {
    const status = this.currentGameStatus;
    if (status !== "dealt" || this.pendingSubmit || this.inputLocked || this.expirationDispatched) return;
    if (this.deadline > 0 && Date.now() >= this.deadline) {
      this.expireRoundOnce();
      return;
    }

    // Lock synchronously before audio/state work. Pointer events can arrive in
    // the same frame, so React's async observable update is too late to be the
    // duplicate-input guard.
    this.inputLocked = true;
    this.sfx.unlock();

    const pos = this.currentGaugeLogical;
    const scored = scoreHit(this.runSummary, calculateHitResult(pos));
    if (!scored) {
      this.inputLocked = false;
      return;
    }
    this.runSummary = scored.summary;
    const hit = scored.result;

    // Shot fired — short "pew", then a hit or miss tail.
    this.sfx.tones([{ frequency: 880, duration: 0.07, type: "sawtooth", gain: 0.025, endFrequency: 220 }]);
    this.sfx.play(isAccuracyHit(hit.ring) ? "score" : "error");

    // Update local state
    this.shotRings.push(hit.ring);
    this.shotResults.push(hit);
    this.accuracyHits = this.runSummary.accuracyHits;
    this.awaitingShotAck = true;
    const expectedShotCount = this.shotResults.length;
    this.scheduleGameplay(SHOT_ACK_TIMEOUT_MS, () => {
      if (this.awaitingShotAck && this.shotResults.length === expectedShotCount) {
        this.recoverRejectedShot();
      }
    });
    this.dispatch("aimHit", {
      ringsHit: this.accuracyHits,
      totalRings: this.shotRings.length,
      roundResults: this.shotResults.slice(),
      totalPoints: this.runSummary.score,
      combo: this.runSummary.combo,
      maxCombo: this.runSummary.maxCombo,
    });

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
      this.inputLocked = true;
      this.isGameAnimating = false;
      this.stopPendulumTween();
      // Park reticle at centre
      this.tween({
        targets: this.gaugeReticle,
        x: this.gaugeXFromLogical(DEFAULT_CONFIG.centre),
        duration: 300,
        ease: "Back.easeOut",
      });
      // Wait for the bridge/TEE acknowledgement before revealing settlement.
      this.submitBtnContainer.setVisible(false);
    }

    this.updateScoreText();
  }

  private handleSubmit(): void {
    if (
      !this.pendingSubmit
      || this.awaitingShotAck
      || this.submitLocked
      || (this.expirationDispatched && Date.now() < this.deadline)
      || !this.canSubmitNow()
    ) return;
    if (this.deadline > 0 && Date.now() >= this.deadline) {
      this.expireRoundOnce();
      return;
    }
    this.submitLocked = true;
    this.submitBtnContainer.setVisible(false);
    this.dispatch("submitSolution", {});
    // If settlement fails, the bridge returns to `dealt`; allow an explicit
    // retry after a short debounce instead of leaving the button dead forever.
    this.scheduleGameplay(800, () => {
      if (this.currentGameStatus === "dealt" && !this.bool("isSubmitting")) {
        this.submitLocked = false;
        this.submitBtnContainer.setVisible(this.pendingSubmit);
      }
    });
  }

  private recoverRejectedShot(): void {
    this.syncCanonicalShotLog(true);
    this.submitLocked = false;
    this.expirationDispatched = false;
    this.submitBtnContainer.setVisible(
      this.pendingSubmit && this.canSubmitNow() && !this.bool("isSubmitting"),
    );
    this.showSystemFeedback(
      this.str("shotFailedLabel", "Shot was not recorded — try again"),
      "#b42318",
    );
  }

  // ── Visual feedback ─────────────────────────────────────────────────────────

  private showHitFeedback(ring: number): void {
    let label  = "";
    let color  = "#ffffff";
    // Darker, saturated fills (paired with the dark stroke) so the most
    // rewarding hit is also the most readable on the light canvas.
    if (ring === 0)      { label = this.str("bullseyeLabel", "BULLSEYE!"); color = "#f59e0b"; }
    else if (ring <= 2)  { label = this.str("hitFeedbackLabel", "HIT!");  color = "#12a45f"; }
    else                 { label = this.str("missFeedbackLabel", "MISS"); color = "#e23b3b"; }

    this.tweens.killTweensOf(this.feedbackText);
    this.feedbackText
      .setText(label)
      .setColor(color)
      .setAlpha(1)
      .setScale(1.4)
      .setY(this.targetY() - 10);
    if (this.reducedMotion) {
      this.feedbackText.setScale(1);
      this.scheduleGameplay(420, () => this.feedbackText?.setAlpha(0));
      return;
    }
    this.tween({
      targets:  this.feedbackText,
      alpha:    0,
      scaleX:   1,
      scaleY:   1,
      y:        this.feedbackText.y - 20,
      duration: 700,
      ease:     "Sine.easeOut",
      onComplete: () => {
        this.feedbackText.setY(this.targetY() - 10);
      },
    });
  }

  private showSystemFeedback(label: string, color: string): void {
    this.tweens.killTweensOf(this.feedbackText);
    this.feedbackText
      .setText(label)
      .setColor(color)
      .setAlpha(1)
      .setScale(1)
      .setY(this.targetY() - 10);
    this.scheduleGameplay(1_200, () => this.feedbackText?.setAlpha(0));
  }

  private pulseTargetRing(ring: number): void {
    // ring 0 → targetRings array index is (RING_OUTER_RADII.length - 1 - 0) because drawn outer→inner
    const arrIdx = this.targetRings.length - 1 - ring;
    const ringObj = this.targetRings[arrIdx];
    if (!ringObj) return;

    this.tweens.killTweensOf(ringObj);
    const origScale = ringObj.scaleX;
    ringObj.setAlpha(0.32);
    const origColor = (RING_COLORS[ring] as number) ?? C.white;
    if (this.reducedMotion) {
      ringObj.setFillStyle(0xffffff);
      this.scheduleGameplay(120, () => ringObj?.setFillStyle(origColor).setAlpha(0));
      return;
    }
    this.tween({
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
    ringObj.setFillStyle(0xffffff);
    this.scheduleGameplay(100, () => ringObj?.setFillStyle(origColor));
  }

  private shakeGauge(): void {
    if (this.reducedMotion) return;
    const origX = this.scW / 2;
    this.tweens.killTweensOf(this.targetContainer);
    this.targetContainer.setX(origX);
    this.tween({
      targets: this.targetContainer,
      x: origX + 7,
      duration: 55,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 2,
      onComplete: () => this.targetContainer?.setX(origX),
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private scheduleGameplay(delayMs: number, callback: () => void): Phaser.Time.TimerEvent {
    let event!: Phaser.Time.TimerEvent;
    event = this.time.delayedCall(delayMs, () => {
      this.gameplayTimers.delete(event);
      callback();
    });
    this.gameplayTimers.add(event);
    return event;
  }

  private clearGameplayTimers(): void {
    for (const timer of this.gameplayTimers) timer.remove(false);
    this.gameplayTimers.clear();
  }

  protected onReducedMotionChange(enabled: boolean): void {
    this.lastReducedMotionStep = -1;
    if (enabled) {
      this.stopDealingAnimation();
      if (this.pendulumTween) this.startPendulumTween(this.currentDifficulty);
      return;
    }
    if (this.dealingContainer?.visible) this.startDealingAnimation();
  }

  protected onBridgeError(error: GameBridgeError): void {
    if (error.action === "aimHit" && this.awaitingShotAck) {
      this.recoverRejectedShot();
      return;
    }
    if (error.action === "submitSolution" && this.currentGameStatus === "dealt") {
      this.submitLocked = false;
      this.pendingSubmit = true;
      this.submitBtnContainer?.setVisible(this.canSubmitNow());
    }
  }

  private cleanupGameplay(): void {
    this.clearGameplayTimers();
    this.stopPendulumTween();
    this.stopDealingAnimation();
    this.tweens.killAll();
  }

  destroy(fromScene = false): void {
    this.cleanupGameplay();
    super.destroy(fromScene);
  }
}
