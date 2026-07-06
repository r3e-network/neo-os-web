/**
 * FlappyScene — Phaser 3 scene for the Flappy Dash miniapp.
 *
 * Renders:
 *  - Parallax sky background (blue gradient + scrolling clouds)
 *  - Scrolling ground strip at bottom
 *  - Pipes (green) generated deterministically from seed
 *  - Yellow bird with wing-flap animation
 *  - Score counter (pipes passed) as HUD pill
 *  - Lobby: 3 difficulty cards (idle / solved / expired states)
 *  - Overlays: "Tap to fly", crash, win, committed/dealing
 *
 * State received from React (via GameBridge):
 *  - gameStatus    "idle" | "committed" | "dealt" | "solved" | "expired"
 *  - seed          string  (RNG seed for pipe layout)
 *  - gameDifficulty number
 *  - deadline      number  (unix ms)
 *  - isStarting    boolean
 *  - isDealing     boolean
 *  - isSubmitting  boolean
 *  - poolFree      number
 *
 * Dispatches:
 *  - "startGame"       { difficulty }
 *  - "recordFlap"      { pipes }
 *  - "submitSolution"  { pipes }
 *  - "expireGame"      {}
 */

import Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState as BridgeState } from "@framework/phaser";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_X,
  PIPE_WIDTH,
  PIPE_GAP,
  createGameState,
  updateFrame,
  flap as engineFlap,
} from "../logic/flappy-engine";
import type { GameState as FlappyGameState } from "../logic/flappy-engine";
import { DIFFICULTY_RULES, ruleOf, gasDisplay } from "../logic/game-rules";

// ─── Layout constants ─────────────────────────────────────────────────────────

const W = CANVAS_WIDTH;   // 400
const H = CANVAS_HEIGHT;  // 600

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  skyTop:       0x4dc9f6,
  skyBot:       0xb8e6ff,
  cloud:        0xffffff,
  pipeBody:     0x2ecc71,
  pipeCap:      0x27ae60,
  pipeShine:    0x58d68d,
  ground:       0x8B4513,
  groundTop:    0x228B22,
  birdBody:     0xf5c842,
  birdWing:     0xe8a800,
  birdEye:      0x333333,
  birdBeak:     0xe74c3c,
  scoreText:    0xffffff,
  scorePill:    0x00000000,
  hudPanel:     0x000000,
  white:        0xffffff,
  black:        0x000000,
  cardBg:       0x162032,
  cardBorder:   0x2a4a6b,
  cardActive:   0x1a5c8a,
  cardAccent:   0x16c784,
  btnPrimary:   0x1e88e5,
  btnDisabled:  0x334455,
  muted:        0x7a9ab5,
  overlay:      0x000000,
  overlayWin:   0x0d2b1a,
  overlayCrash: 0x1a0a0a,
};

// Frames between recordFlap reports to React
const REPORT_INTERVAL_FRAMES = 120; // ~2 s at 60 fps

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "ready" | "playing" | "crashed" | "won";
type GameStatus = "idle" | "committed" | "dealt" | "solved" | "expired";

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FlappyScene extends BaseScene {
  // ── Graphics layers ───────────────────────────────────────────────────────
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private cloudGraphics!: Phaser.GameObjects.Graphics;
  private groundGraphics!: Phaser.GameObjects.Graphics;
  private pipeGraphics!: Phaser.GameObjects.Graphics;
  private birdGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;

  // ── HUD text ──────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;

  // ── Lobby layer ───────────────────────────────────────────────────────────
  private lobbyContainer!: Phaser.GameObjects.Container;
  private difficultyCards: Phaser.GameObjects.Container[] = [];
  private startButton!: Phaser.GameObjects.Container;
  private startBtnBg!: Phaser.GameObjects.Rectangle;
  private startBtnLabel!: Phaser.GameObjects.Text;
  private poolLabel!: Phaser.GameObjects.Text;
  private lobbyStatusLabel!: Phaser.GameObjects.Text;

  // ── Overlay layer ─────────────────────────────────────────────────────────
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private overlayActionBtn!: Phaser.GameObjects.Container;
  private overlayActionLabel!: Phaser.GameObjects.Text;
  private overlaySecondBtn!: Phaser.GameObjects.Container;
  private overlaySecondLabel!: Phaser.GameObjects.Text;

  // ── Dealing/committed screen ──────────────────────────────────────────────
  private dealingContainer!: Phaser.GameObjects.Container;

  // ── Ready overlay ("Tap to fly") ──────────────────────────────────────────
  private readyContainer!: Phaser.GameObjects.Container;

  // ── Local game state ──────────────────────────────────────────────────────
  private flappyState: FlappyGameState | null = null;
  private localPhase: LocalPhase = "idle";
  private pickedDifficulty = 0;
  private gameStatus: GameStatus = "idle";
  private prevSeed = "";
  private prevActiveGameId = "";
  private cloudOffset = 0;
  private groundOffset = 0;
  private frameAccum = 0;       // ms carry for fixed-60-fps step
  private reportTimer = 0;      // frames since last recordFlap
  private deadlineMs = 0;
  private lastReportedScore = -1;
  private birdWingAngle = 0;
  private birdWingDir = 1;

  constructor() {
    super("FlappyScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  create(): void {
    super.create();

    // Render layers (order matters: lowest depth first)
    this.bgGraphics    = this.add.graphics();
    this.cloudGraphics = this.add.graphics();
    this.pipeGraphics  = this.add.graphics();
    this.groundGraphics = this.add.graphics();
    this.birdGraphics  = this.add.graphics();
    this.hudGraphics   = this.add.graphics();

    this.scoreText = this.add.text(W / 2, 18, "0", {
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      shadow: { color: "#000000", blur: 4, offsetY: 2, fill: true },
    }).setOrigin(0.5, 0).setDepth(10);

    this.buildLobby();
    this.buildDealingScreen();
    this.buildReadyOverlay();
    this.buildResultOverlay();

    // Pointer/keyboard input
    this.input.on("pointerdown", this.handleTap, this);
    this.input.keyboard?.on("keydown-SPACE",    this.handleTap, this);
    this.input.keyboard?.on("keydown-UP",        this.handleTap, this);
    this.input.keyboard?.on("keydown-W",         this.handleTap, this);

    // Draw initial static sky so there's no blank frame
    this.drawSky();

    this.onStateUpdate(this.state);
  }

  update(_time: number, delta: number): void {
    if (this.localPhase !== "playing" || !this.flappyState) return;

    // Accumulate delta and step at fixed ~60 fps increments
    this.frameAccum += delta;
    const STEP = 1000 / 60;
    while (this.frameAccum >= STEP) {
      this.frameAccum -= STEP;
      updateFrame(this.flappyState);

      // Check phase transitions set by the engine
      const phase = this.flappyState.phase;
      if (phase === "crashed") {
        this.localPhase = "crashed";
        this.frameAccum = 0;
        this.showResultOverlay("crashed");
        this.reportScoreToReact(this.flappyState.score);
        break;
      }

      const rule = ruleOf(this.num("gameDifficulty", 0));
      if (phase === "won" || this.flappyState.score >= rule.targetPipes) {
        this.flappyState.phase = "won";
        this.localPhase = "won";
        this.frameAccum = 0;
        this.showResultOverlay("won");
        this.reportScoreToReact(this.flappyState.score);
        break;
      }

      // Periodic score report
      this.reportTimer++;
      if (this.reportTimer >= REPORT_INTERVAL_FRAMES) {
        this.reportTimer = 0;
        this.reportScoreToReact(this.flappyState.score);
      }

      // Deadline check
      if (this.deadlineMs > 0 && Date.now() >= this.deadlineMs) {
        this.dispatch("expireGame");
        this.localPhase = "crashed";
        this.frameAccum = 0;
        this.showResultOverlay("expired");
        break;
      }
    }

    // Advance scrolling even while stepping physics
    this.cloudOffset += delta * 0.03;
    this.groundOffset += this.localPhase === "playing" ? delta * 0.12 : 0;

    // Animate bird wing
    this.birdWingAngle += 0.18 * this.birdWingDir;
    if (this.birdWingAngle > 0.5 || this.birdWingAngle < -0.3) this.birdWingDir *= -1;

    // Redraw game frame
    if (this.flappyState) {
      this.drawGameFrame();
    }
  }


  // ── BaseScene abstract implementation ──────────────────────────────────────

  protected onStateUpdate(bridgeState: BridgeState): void {
    const status      = this.str("gameStatus", "idle") as GameStatus;
    const seed        = this.str("seed", "");
    const activeGame  = this.str("activeGameId", "0");
    const difficulty  = this.num("gameDifficulty", 0);
    const deadline    = this.num("deadline", 0);
    const isDealing   = this.bool("isDealing");
    const isStarting  = this.bool("isStarting");
    const poolFree    = this.num("poolFree", 0);

    this.gameStatus  = status;
    this.deadlineMs  = deadline;

    // ── State machine transitions ─────────────────────────────────────────

    if (status === "dealt" && seed && seed !== this.prevSeed) {
      // New seed arrived — start a fresh local run
      this.prevSeed        = seed;
      this.prevActiveGameId = activeGame;
      this.flappyState     = createGameState(seed);
      this.flappyState.phase = "ready";
      this.localPhase      = "ready";
      this.frameAccum      = 0;
      this.reportTimer     = 0;
      this.lastReportedScore = -1;

      this.showGameLayer();
      this.showReadyOverlay();
      this.updateScoreHud(0);
    } else if (status !== "dealt") {
      // Not in an active game — reset to lobby
      if (this.localPhase !== "idle") {
        this.localPhase   = "idle";
        this.flappyState  = null;
        this.prevSeed     = "";
        this.frameAccum   = 0;
      }

      if (status === "committed" || isDealing) {
        this.showDealingLayer();
      } else {
        this.showLobbyLayer();
        this.updateLobbyUI(status, poolFree, isStarting, difficulty);
      }
    }

    // ── Difficulty selection in lobby ─────────────────────────────────────
    if (status === "idle" || status === "solved" || status === "expired") {
      this.updateCardHighlights();
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private handleTap(): void {
    if (this.gameStatus !== "dealt" || !this.flappyState) return;

    if (this.localPhase === "ready") {
      this.localPhase = "playing";
      this.flappyState.phase = "playing";
      this.hideReadyOverlay();
      return;
    }

    if (this.localPhase === "playing") {
      engineFlap(this.flappyState);
      this.birdWingAngle = -0.4; // snap wing down on flap
      this.dispatch("recordFlap", { pipes: this.flappyState.score });
    }
  }

  // ── Score reporting ────────────────────────────────────────────────────────

  private reportScoreToReact(score: number): void {
    if (score !== this.lastReportedScore) {
      this.lastReportedScore = score;
      this.dispatch("recordFlap", { pipes: score });
    }
  }


  // ── Drawing helpers ────────────────────────────────────────────────────────

  private drawSky(): void {
    const g = this.bgGraphics;
    g.clear();
    // Sky gradient approximated with two bands
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1);
    g.fillRect(0, 0, W, H - GROUND_HEIGHT);
    // Ground brown base
    g.fillStyle(C.ground, 1);
    g.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);
    // Green grass strip at top of ground
    g.fillStyle(C.groundTop, 1);
    g.fillRect(0, H - GROUND_HEIGHT, W, 8);
  }

  private drawClouds(frame: number): void {
    const g = this.cloudGraphics;
    g.clear();
    g.fillStyle(C.cloud, 0.65);
    const offX = (this.cloudOffset + frame * 0.15) % 500;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 170 - offX + 900) % 600) - 60;
      const cy = 35 + i * 22;
      g.fillEllipse(cx,      cy,      90, 38);
      g.fillEllipse(cx + 28, cy - 12, 68, 34);
      g.fillEllipse(cx + 55, cy,      78, 30);
    }
  }

  private drawGround(frame: number): void {
    const g = this.groundGraphics;
    g.clear();
    // Scrolling tick marks
    g.lineStyle(2, 0x2d8a2d, 0.8);
    const gOff = (this.groundOffset + frame * 2) % 40;
    for (let x = -gOff; x < W; x += 40) {
      g.lineBetween(x, H - GROUND_HEIGHT + 2, x + 15, H - GROUND_HEIGHT + 10);
    }
  }

  private drawPipes(gs: FlappyGameState): void {
    const g = this.pipeGraphics;
    g.clear();
    for (const p of gs.pipes) {
      const topH    = p.gapY;
      const botY    = p.gapY + PIPE_GAP;
      const botH    = H - GROUND_HEIGHT - botY;
      const x       = p.x;
      const pw      = PIPE_WIDTH;

      // Top pipe body
      g.fillStyle(C.pipeBody, 1);
      g.fillRect(x, 0, pw, topH);
      // Top pipe cap
      g.fillStyle(C.pipeCap, 1);
      g.fillRect(x - 4, topH - 20, pw + 8, 20);
      // Top pipe shine
      g.fillStyle(C.pipeShine, 0.7);
      g.fillRect(x + 4, 0, 6, Math.max(0, topH - 22));

      // Bottom pipe body
      g.fillStyle(C.pipeBody, 1);
      g.fillRect(x, botY, pw, botH);
      // Bottom pipe cap
      g.fillStyle(C.pipeCap, 1);
      g.fillRect(x - 4, botY, pw + 8, 20);
      // Bottom pipe shine
      g.fillStyle(C.pipeShine, 0.7);
      g.fillRect(x + 4, botY + 22, 6, Math.max(0, botH - 22));
    }
  }

  private drawBird(gs: FlappyGameState): void {
    const g  = this.birdGraphics;
    g.clear();
    const bx  = BIRD_X;
    const by  = gs.bird.y;
    const cx  = bx + BIRD_WIDTH  / 2;
    const cy  = by + BIRD_HEIGHT / 2;
    const rot = (gs.bird.rotation * Math.PI) / 180;

    g.save();

    // Translate to bird center, rotate, then draw
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Helper: transform local point to world
    const tx = (lx: number, ly: number) => cx + lx * cos - ly * sin;
    const ty = (lx: number, ly: number) => cy + lx * sin + ly * cos;

    // Wing (drawn behind body)
    const wFlap = this.birdWingAngle * 8;
    g.fillStyle(C.birdWing, 1);
    g.fillEllipse(
      tx(-4, wFlap),
      ty(-4, wFlap),
      BIRD_WIDTH * 0.65,
      BIRD_HEIGHT * 0.52,
    );

    // Body
    g.fillStyle(C.birdBody, 1);
    g.fillEllipse(cx, cy, BIRD_WIDTH, BIRD_HEIGHT);

    // Eye white
    g.fillStyle(C.white, 1);
    g.fillCircle(tx(7, -4), ty(7, -4), 5);

    // Eye pupil
    g.fillStyle(C.birdEye, 1);
    g.fillCircle(tx(8, -4), ty(8, -4), 2.5);

    // Beak
    g.fillStyle(C.birdBeak, 1);
    g.fillTriangle(
      tx(BIRD_WIDTH / 2 - 2, 0), ty(BIRD_WIDTH / 2 - 2, 0),
      tx(BIRD_WIDTH / 2 + 8, 2), ty(BIRD_WIDTH / 2 + 8, 2),
      tx(BIRD_WIDTH / 2 - 2, 6), ty(BIRD_WIDTH / 2 - 2, 6),
    );

    g.restore();
  }

  private drawScorePill(score: number): void {
    const label = String(score);
    this.scoreText.setText(label);
    // Simple drop-shadow pill drawn behind the text
    const metrics = this.scoreText.getBounds();
    const pillW   = metrics.width + 28;
    const pillH   = 36;
    const pillX   = W / 2 - pillW / 2;
    const pillY   = 14;

    const g = this.hudGraphics;
    g.clear();
    g.fillStyle(C.black, 0.3);
    g.fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
    g.lineStyle(1, C.white, 0.18);
    g.strokeRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
  }

  private drawGameFrame(): void {
    if (!this.flappyState) return;
    const gs = this.flappyState;
    this.drawSky();
    this.drawClouds(gs.frame);
    this.drawPipes(gs);
    this.drawGround(gs.frame);
    this.drawBird(gs);
    this.updateScoreHud(gs.score);
  }

  private updateScoreHud(score: number): void {
    this.scoreText.setVisible(true);
    this.drawScorePill(score);
  }


  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0).setDepth(20);

    // Background sky for lobby
    const lobbyBg = this.add.graphics();
    lobbyBg.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1);
    lobbyBg.fillRect(0, 0, W, H - GROUND_HEIGHT);
    lobbyBg.fillStyle(C.ground, 1);
    lobbyBg.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);
    lobbyBg.fillStyle(C.groundTop, 1);
    lobbyBg.fillRect(0, H - GROUND_HEIGHT, W, 8);
    this.lobbyContainer.add(lobbyBg);

    // Title eyebrow
    const eyebrow = this.add.text(W / 2, 28, "FLAPPY DASH", {
      fontSize: "12px",
      color: "#4dc9f6",
      fontStyle: "bold",
      letterSpacing: 4,
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(eyebrow);

    const titleTxt = this.add.text(W / 2, 48, "Choose Difficulty", {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(titleTxt);

    // Difficulty cards
    this.difficultyCards = [];
    DIFFICULTY_RULES.forEach((rule, i) => {
      const cardX = W / 2;
      const cardY = 118 + i * 118;
      const card  = this.buildDifficultyCard(cardX, cardY, rule);
      this.difficultyCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Pool status label
    this.poolLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 90, "", {
      fontSize: "12px",
      color: "#7a9ab5",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.poolLabel);

    // Lobby status (e.g. "Not enough GAS in pool")
    this.lobbyStatusLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 74, "", {
      fontSize: "11px",
      color: "#e25d4d",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.lobbyStatusLabel);

    // Start button
    this.startButton = this.add.container(W / 2, H - GROUND_HEIGHT - 44);
    this.startBtnBg  = this.add.rectangle(0, 0, 200, 44, C.btnPrimary)
      .setStrokeStyle(2, 0x42a5f5)
      .setOrigin(0.5);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.startBtnBg, {
      targets: this.startButton,
      pressScale: 0.95,
      onPress: () => this.onStartPressed(),
    });
    this.startBtnLabel = this.add.text(0, 0, "Start Game", {
      fontSize: "17px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.startButton.add([this.startBtnBg, this.startBtnLabel]);
    this.lobbyContainer.add(this.startButton);
  }

  private buildDifficultyCard(
    cx: number,
    cy: number,
    rule: typeof DIFFICULTY_RULES[number],
  ): Phaser.GameObjects.Container {
    const c     = this.add.container(cx, cy);
    const cardW = 340;
    const cardH = 104;

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.pickedDifficulty = rule.difficulty;
      this.updateCardHighlights();
    });
    bg.on("pointerover",  () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(0x1e2d3e); });
    bg.on("pointerout",   () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(C.cardBg); });

    const diffLabel = this.add.text(-cardW / 2 + 18, -36, rule.key.toUpperCase(), {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0, 0.5);

    const pipesLabel = this.add.text(-cardW / 2 + 18, -10, `${rule.targetPipes} pipes`, {
      fontSize: "12px",
      color: "#7a9ab5",
    }).setOrigin(0, 0.5);

    const timeLabel = this.add.text(-cardW / 2 + 18, 14, `${Math.round(rule.limitMs / 60000)} min`, {
      fontSize: "12px",
      color: "#7a9ab5",
    }).setOrigin(0, 0.5);

    const rewardLabel = this.add.text(cardW / 2 - 18, -10, `Win ${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#16c784",
    }).setOrigin(1, 0.5);

    const entryLabel = this.add.text(cardW / 2 - 18, 14, `Entry ${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "11px",
      color: "#7a9ab5",
    }).setOrigin(1, 0.5);

    // Active indicator dot (initially hidden)
    const dot = this.add.circle(-cardW / 2 + 7, -cardH / 2 + 7, 5, C.cardAccent, 0);

    c.add([bg, diffLabel, pipesLabel, timeLabel, rewardLabel, entryLabel, dot]);
    return c;
  }

  private updateCardHighlights(): void {
    this.difficultyCards.forEach((card, i) => {
      const rule   = DIFFICULTY_RULES[i]!;
      const active = rule.difficulty === this.pickedDifficulty;
      const bg     = card.list[0] as Phaser.GameObjects.Rectangle;
      const dot    = card.list[card.list.length - 1] as Phaser.GameObjects.Arc;
      bg.setFillStyle(active ? C.cardActive : C.cardBg);
      bg.setStrokeStyle(2, active ? C.cardAccent : C.cardBorder);
      dot.setAlpha(active ? 1 : 0);
    });
  }

  private updateLobbyUI(
    status: GameStatus,
    poolFree: number,
    isStarting: boolean,
    _difficulty: number,
  ): void {
    const rule           = ruleOf(this.pickedDifficulty);
    const rewardGas      = Number(gasDisplay(rule.rewardFixed8));
    const poolReady      = poolFree >= rewardGas;
    const busy           = isStarting;

    this.poolLabel.setText(`Pool: ${poolFree.toFixed(2)} GAS`);
    this.lobbyStatusLabel.setText(poolReady ? "" : "Pool too low to cover reward");

    this.startBtnBg.setFillStyle(busy || !poolReady ? C.btnDisabled : C.btnPrimary);
    this.startBtnLabel.setText(isStarting ? "Starting…" : "Start Game");

    // Show result banners by tinting the eyebrow area
    if (status === "solved") {
      this.startBtnLabel.setText("Play Again");
    } else if (status === "expired") {
      this.startBtnLabel.setText("Try Again");
    }

    // Update card highlights to match current difficulty from bridge
    this.updateCardHighlights();
  }

  private onStartPressed(): void {
    const isStarting  = this.bool("isStarting");
    const poolFree    = this.num("poolFree", 0);
    const rule        = ruleOf(this.pickedDifficulty);
    const rewardGas   = Number(gasDisplay(rule.rewardFixed8));
    if (isStarting || poolFree < rewardGas) return;
    this.dispatch("startGame", { difficulty: this.pickedDifficulty });
  }


  // ── Dealing / committed screen ─────────────────────────────────────────────

  private buildDealingScreen(): void {
    this.dealingContainer = this.add.container(0, 0).setDepth(20).setVisible(false);

    const bg = this.add.graphics();
    bg.fillGradientStyle(C.skyTop, C.skyTop, C.skyBot, C.skyBot, 1);
    bg.fillRect(0, 0, W, H);
    this.dealingContainer.add(bg);

    const title = this.add.text(W / 2, H / 2 - 60, "Sealing Pipes…", {
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.dealingContainer.add(title);

    const hint = this.add.text(W / 2, H / 2 - 20, "Waiting for on-chain randomness", {
      fontSize: "13px",
      color: "#7a9ab5",
    }).setOrigin(0.5);
    this.dealingContainer.add(hint);

    // Animated pipe icons cycling
    const pipeIcons: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 5; i++) {
      const dot = this.add.graphics();
      dot.fillStyle(C.pipeBody, 1);
      dot.fillRoundedRect(0, 0, 14, 40, 4);
      dot.setPosition(W / 2 - 40 + i * 20, H / 2 + 20);
      dot.setAlpha(0.3);
      this.dealingContainer.add(dot);
      pipeIcons.push(dot);

      this.tweens.add({
        targets: dot,
        alpha: 1,
        scaleY: 1.3,
        duration: 400,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        delay: i * 80,
      });
    }
  }

  // ── Ready overlay ──────────────────────────────────────────────────────────

  private buildReadyOverlay(): void {
    this.readyContainer = this.add.container(W / 2, H / 2 - 40).setDepth(30).setVisible(false);

    const bg = this.add.rectangle(0, 0, 260, 90, C.black, 0.55)
      .setStrokeStyle(1, C.white, 0.25)
      .setOrigin(0.5);

    const tapLabel = this.add.text(0, -14, "Tap to Fly!", {
      fontSize: "24px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    const hintLabel = this.add.text(0, 16, "Space / ↑ on desktop", {
      fontSize: "12px",
      color: "#7a9ab5",
    }).setOrigin(0.5);

    this.readyContainer.add([bg, tapLabel, hintLabel]);

    // Gentle pulse
    this.tweens.add({
      targets: this.readyContainer,
      alpha: 0.7,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  // ── Result overlay (crash / win / expired) ─────────────────────────────────

  private buildResultOverlay(): void {
    this.overlayContainer = this.add.container(W / 2, H / 2 - 20).setDepth(30).setVisible(false);

    this.overlayBg = this.add.rectangle(0, 0, 300, 200, C.black, 0.82)
      .setStrokeStyle(2, C.white, 0.2)
      .setOrigin(0.5);

    this.overlayTitle = this.add.text(0, -68, "", {
      fontSize: "32px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.overlayBody = this.add.text(0, -24, "", {
      fontSize: "14px",
      color: "#7a9ab5",
      align: "center",
    }).setOrigin(0.5);

    // Primary action button (Retry / Submit)
    this.overlayActionBtn = this.add.container(0, 24);
    const actionBg = this.add.rectangle(0, 0, 200, 40, C.btnPrimary)
      .setStrokeStyle(2, 0x42a5f5)
      .setOrigin(0.5);
    actionBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(actionBg, {
      targets: this.overlayActionBtn,
      onPress: () => this.onOverlayAction(),
    });
    this.overlayActionLabel = this.add.text(0, 0, "Try Again", {
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.overlayActionBtn.add([actionBg, this.overlayActionLabel]);

    // Secondary action button (Submit / Expire)
    this.overlaySecondBtn = this.add.container(0, 72).setVisible(false);
    const secondBg = this.add.rectangle(0, 0, 200, 36, 0x1a2a3a)
      .setStrokeStyle(1, C.cardBorder)
      .setOrigin(0.5);
    secondBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(secondBg, {
      targets: this.overlaySecondBtn,
      hoverScale: 1.03,
      pressScale: 0.96,
      onPress: () => this.onOverlaySecondAction(),
    });
    this.overlaySecondLabel = this.add.text(0, 0, "Submit Score", {
      fontSize: "13px",
      color: "#7a9ab5",
    }).setOrigin(0.5);
    this.overlaySecondBtn.add([secondBg, this.overlaySecondLabel]);

    this.overlayContainer.add([
      this.overlayBg,
      this.overlayTitle,
      this.overlayBody,
      this.overlayActionBtn,
      this.overlaySecondBtn,
    ]);
  }


  // ── Overlay actions ────────────────────────────────────────────────────────

  private showResultOverlay(outcome: "crashed" | "won" | "expired"): void {
    const score = this.flappyState?.score ?? 0;
    const rule  = ruleOf(this.num("gameDifficulty", 0));

    this.overlayContainer.setVisible(true).setAlpha(0).setScale(0.8);
    this.tweens.add({
      targets: this.overlayContainer,
      alpha: 1, scale: 1,
      duration: 220,
      ease: "Back.easeOut",
    });

    if (outcome === "won") {
      this.overlayTitle.setText("You Win!").setColor("#16c784");
      this.overlayBody.setText(
        `${score} pipes passed\nWin: ${gasDisplay(rule.rewardFixed8)} GAS`,
      );
      this.overlayBg.setFillStyle(C.overlayWin, 0.88);
      this.overlayActionLabel.setText("Submit Score");
      this.overlaySecondBtn.setVisible(true);
      this.overlaySecondLabel.setText("Play Again");
    } else if (outcome === "expired") {
      this.overlayTitle.setText("Time Up!").setColor("#e8a800");
      this.overlayBody.setText(`${score} pipes passed\nDeadline reached`);
      this.overlayBg.setFillStyle(C.overlayCrash, 0.88);
      this.overlayActionLabel.setText("Back to Lobby");
      this.overlaySecondBtn.setVisible(false);
    } else {
      this.overlayTitle.setText("Crashed!").setColor("#e25d4d");
      this.overlayBody.setText(`${score} pipes passed\nTarget: ${rule.targetPipes}`);
      this.overlayBg.setFillStyle(C.overlayCrash, 0.88);
      this.overlayActionLabel.setText("Try Again");
      this.overlaySecondBtn.setVisible(false);
    }
  }

  private onOverlayAction(): void {
    const phase  = this.localPhase;
    const status = this.gameStatus;
    const busy   = this.bool("isSubmitting");
    if (busy) return;

    if (phase === "won") {
      // Submit the solution to the contract
      const score = this.flappyState?.score ?? 0;
      this.dispatch("submitSolution", { pipes: score });
      this.overlayActionLabel.setText("Submitting…");
      return;
    }

    // Crashed / expired → retry locally or go back to lobby
    if (status === "dealt") {
      // Restart local run with the same seed
      const seed = this.str("seed", "");
      if (seed) {
        this.flappyState = createGameState(seed);
        this.flappyState.phase = "ready";
        this.localPhase = "ready";
        this.frameAccum = 0;
        this.reportTimer = 0;
        this.lastReportedScore = -1;
        this.overlayContainer.setVisible(false);
        this.showReadyOverlay();
        this.updateScoreHud(0);
      }
    } else {
      // Expired / solved — go back to lobby
      this.localPhase = "idle";
      this.flappyState = null;
      this.overlayContainer.setVisible(false);
      this.showLobbyLayer();
    }
  }

  private onOverlaySecondAction(): void {
    // "Play Again" after a win — retry locally (no new game started)
    const seed = this.str("seed", "");
    if (seed && this.gameStatus === "dealt") {
      this.flappyState = createGameState(seed);
      this.flappyState.phase = "ready";
      this.localPhase = "ready";
      this.frameAccum = 0;
      this.reportTimer = 0;
      this.lastReportedScore = -1;
      this.overlayContainer.setVisible(false);
      this.overlaySecondBtn.setVisible(false);
      this.showReadyOverlay();
      this.updateScoreHud(0);
    }
  }


  // ── Layer visibility helpers ───────────────────────────────────────────────

  private showLobbyLayer(): void {
    this.lobbyContainer.setVisible(true);
    this.dealingContainer.setVisible(false);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(false);
    this.hudGraphics.clear();
    // Draw static sky behind lobby
    this.drawSky();
    this.pipeGraphics.clear();
    this.birdGraphics.clear();
    this.groundGraphics.clear();
    this.cloudGraphics.clear();
  }

  private showDealingLayer(): void {
    this.lobbyContainer.setVisible(false);
    this.dealingContainer.setVisible(true);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(false);
    this.hudGraphics.clear();
  }

  private showGameLayer(): void {
    this.lobbyContainer.setVisible(false);
    this.dealingContainer.setVisible(false);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(true);
  }

  private showReadyOverlay(): void {
    this.readyContainer.setVisible(true);
    this.readyContainer.setAlpha(1);
    // Draw a static frame to show where the bird starts
    if (this.flappyState) {
      this.drawGameFrame();
    }
  }

  private hideReadyOverlay(): void {
    this.readyContainer.setVisible(false);
  }
}
