/**
 * FlappyScene — Phaser 3 scene for the Flappy Dash miniapp.
 *
 * Renders:
 *  - Parallax Flappy-style sky background
 *  - Scrolling ground strip at bottom
 *  - Pipe sprites generated deterministically from seed
 *  - Bird sprite animation with up/mid/down wing frames
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

import * as Phaser from "phaser";
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
  type Pipe,
} from "../logic/flappy-engine";
import type { GameState as FlappyGameState } from "../logic/flappy-engine";
import { DIFFICULTY_RULES, ruleOf, gasDisplay } from "../logic/game-rules";

// ─── Layout constants ─────────────────────────────────────────────────────────

const W = CANVAS_WIDTH;   // 400
const H = CANVAS_HEIGHT;  // 600

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  white:        0xffffff,
  black:        0x000000,
  cardBg:       0xf5fbff,
  cardBorder:   0x7ccde8,
  cardActive:   0xe4fff5,
  cardAccent:   0x16c784,
  btnPrimary:   0x1e88e5,
  btnDisabled:  0x334455,
  overlayWin:   0x0d2b1a,
  overlayCrash: 0x1a0a0a,
};

// Frames between recordFlap reports to React
const REPORT_INTERVAL_FRAMES = 120; // ~2 s at 60 fps

const FLAPPY_ASSETS = {
  background: "flappy-background-day",
  ground: "flappy-ground-base",
  birdUp: "flappy-bird-up",
  birdMid: "flappy-bird-mid",
  birdDown: "flappy-bird-down",
  pipeTop: "flappy-pipe-top",
  pipeBottom: "flappy-pipe-bottom",
} as const;

const BACKGROUND_SCALE = (H - GROUND_HEIGHT) / 144;
const GROUND_TILE_SCALE = GROUND_HEIGHT / 24;

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "ready" | "playing" | "crashed" | "won";
type GameStatus = "idle" | "committed" | "dealt" | "solved" | "expired";

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FlappyScene extends BaseScene {
  // ── Sprite layers ─────────────────────────────────────────────────────────
  private backgroundSprite!: Phaser.GameObjects.TileSprite;
  private groundSprite!: Phaser.GameObjects.TileSprite;
  private pipeLayer!: Phaser.GameObjects.Container;
  private pipeSprites = new Map<
    Pipe,
    { top: Phaser.GameObjects.Image; bottom: Phaser.GameObjects.Image }
  >();
  private birdSprite!: Phaser.GameObjects.Image;
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

  constructor() {
    super("FlappyScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(FLAPPY_ASSETS.background, "./flappy-sprites/background-day.webp");
    this.load.image(FLAPPY_ASSETS.ground, "./flappy-sprites/base.webp");
    this.load.image(FLAPPY_ASSETS.birdUp, "./flappy-sprites/bird-up.webp");
    this.load.image(FLAPPY_ASSETS.birdMid, "./flappy-sprites/bird-mid.webp");
    this.load.image(FLAPPY_ASSETS.birdDown, "./flappy-sprites/bird-down.webp");
    this.load.image(FLAPPY_ASSETS.pipeTop, "./flappy-sprites/pipe-top.webp");
    this.load.image(FLAPPY_ASSETS.pipeBottom, "./flappy-sprites/pipe-bottom.webp");
  }

  create(): void {
    super.create();

    // Render layers (order matters: lowest depth first)
    this.backgroundSprite = this.add.tileSprite(
      0,
      0,
      W,
      H - GROUND_HEIGHT,
      FLAPPY_ASSETS.background,
    ).setOrigin(0).setDepth(0);
    this.backgroundSprite.setTileScale(BACKGROUND_SCALE, BACKGROUND_SCALE);

    this.pipeLayer = this.add.container(0, 0).setDepth(2);
    this.groundSprite = this.add.tileSprite(
      0,
      H - GROUND_HEIGHT,
      W,
      GROUND_HEIGHT,
      FLAPPY_ASSETS.ground,
    ).setOrigin(0).setDepth(3);
    this.groundSprite.setTileScale(GROUND_TILE_SCALE, GROUND_TILE_SCALE);

    this.birdSprite = this.add.image(
      BIRD_X + BIRD_WIDTH / 2,
      H / 2,
      FLAPPY_ASSETS.birdMid,
    ).setDisplaySize(BIRD_WIDTH, BIRD_HEIGHT).setDepth(4).setVisible(false);

    this.hudGraphics = this.add.graphics().setDepth(9);

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

    // Draw initial static scene so there's no blank frame.
    this.drawSky();
    this.drawGround(0);

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
    this.backgroundSprite.setVisible(true);
    this.backgroundSprite.setTilePosition(this.cloudOffset * 0.18, 0);
  }

  private drawGround(frame: number): void {
    this.groundSprite.setVisible(true);
    this.groundSprite.setTilePosition((this.groundOffset + frame * 2) / GROUND_TILE_SCALE, 0);
  }

  private drawPipes(gs: FlappyGameState): void {
    const livePipes = new Set(gs.pipes);
    for (const p of gs.pipes) {
      const topH    = p.gapY;
      const botY    = p.gapY + PIPE_GAP;
      const botH    = H - GROUND_HEIGHT - botY;
      const x       = p.x;

      let sprites = this.pipeSprites.get(p);
      if (!sprites) {
        sprites = {
          top: this.add.image(0, 0, FLAPPY_ASSETS.pipeTop).setOrigin(0, 0),
          bottom: this.add.image(0, 0, FLAPPY_ASSETS.pipeBottom).setOrigin(0, 0),
        };
        this.pipeLayer.add([sprites.top, sprites.bottom]);
        this.pipeSprites.set(p, sprites);
      }

      sprites.top
        .setPosition(x, 0)
        .setDisplaySize(PIPE_WIDTH, Math.max(1, topH));
      sprites.bottom
        .setPosition(x, botY)
        .setDisplaySize(PIPE_WIDTH, Math.max(1, botH));
    }

    for (const [pipe, sprites] of this.pipeSprites) {
      if (livePipes.has(pipe)) continue;
      sprites.top.destroy();
      sprites.bottom.destroy();
      this.pipeSprites.delete(pipe);
    }
  }

  private drawBird(gs: FlappyGameState): void {
    const bx  = BIRD_X;
    const by  = gs.bird.y;
    const cx  = bx + BIRD_WIDTH  / 2;
    const cy  = by + BIRD_HEIGHT / 2;
    const frame =
      gs.bird.vy < -1.4
        ? FLAPPY_ASSETS.birdUp
        : gs.bird.vy > 2.2
          ? FLAPPY_ASSETS.birdDown
          : FLAPPY_ASSETS.birdMid;

    this.birdSprite
      .setVisible(true)
      .setTexture(frame)
      .setDisplaySize(BIRD_WIDTH, BIRD_HEIGHT)
      .setPosition(cx, cy)
      .setAngle(gs.bird.rotation);
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
      const cardY = 126 + i * 96;
      const card  = this.buildDifficultyCard(cardX, cardY, rule);
      this.difficultyCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Pool status label
    this.poolLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 128, "", {
      fontSize: "12px",
      color: "#2e6686",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.poolLabel);

    // Lobby status (e.g. "Not enough GAS in pool")
    this.lobbyStatusLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 110, "", {
      fontSize: "11px",
      color: "#e25d4d",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.lobbyStatusLabel);

    // Start button
    this.startButton = this.add.container(W / 2, H - GROUND_HEIGHT - 66);
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
    const cardW = 322;
    const cardH = 88;

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.cardBg, 0.88)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.pickedDifficulty = rule.difficulty;
      this.updateCardHighlights();
    });
    bg.on("pointerover",  () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(0xeafcff, 0.94); });
    bg.on("pointerout",   () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(C.cardBg, 0.88); });

    const bird = this.add.image(-cardW / 2 + 26, -20, FLAPPY_ASSETS.birdMid)
      .setDisplaySize(28, 24);

    const diffLabel = this.add.text(-cardW / 2 + 52, -28, rule.key.toUpperCase(), {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#12364a",
    }).setOrigin(0, 0.5);

    const pipesLabel = this.add.text(-cardW / 2 + 52, -2, `${rule.targetPipes} pipes`, {
      fontSize: "12px",
      color: "#2e6686",
    }).setOrigin(0, 0.5);

    const timeLabel = this.add.text(-cardW / 2 + 52, 22, `${Math.round(rule.limitMs / 60000)} min`, {
      fontSize: "12px",
      color: "#2e6686",
    }).setOrigin(0, 0.5);

    const rewardLabel = this.add.text(cardW / 2 - 18, -14, `Win ${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#16c784",
    }).setOrigin(1, 0.5);

    const entryLabel = this.add.text(cardW / 2 - 18, 14, `Entry ${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "11px",
      color: "#2e6686",
    }).setOrigin(1, 0.5);

    // Active indicator dot (initially hidden)
    const dot = this.add.circle(-cardW / 2 + 7, -cardH / 2 + 7, 5, C.cardAccent, 0);

    c.add([bg, bird, diffLabel, pipesLabel, timeLabel, rewardLabel, entryLabel, dot]);
    return c;
  }

  private updateCardHighlights(): void {
    this.difficultyCards.forEach((card, i) => {
      const rule   = DIFFICULTY_RULES[i]!;
      const active = rule.difficulty === this.pickedDifficulty;
      const bg     = card.list[0] as Phaser.GameObjects.Rectangle;
      const dot    = card.list[card.list.length - 1] as Phaser.GameObjects.Arc;
      bg.setFillStyle(active ? C.cardActive : C.cardBg, active ? 0.96 : 0.88);
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

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.24);
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

    // Animated pipe sprites cycling while the verified pipe route is prepared.
    const pipeIcons: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 5; i++) {
      const pipe = this.add.image(
        W / 2 - 40 + i * 20,
        H / 2 + 40,
        i % 2 === 0 ? FLAPPY_ASSETS.pipeTop : FLAPPY_ASSETS.pipeBottom,
      ).setDisplaySize(14, 56).setAlpha(0.3);
      this.dealingContainer.add(pipe);
      pipeIcons.push(pipe);

      this.tweens.add({
        targets: pipe,
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
    this.birdSprite.setVisible(false);
    this.clearPipeSprites();
    // Draw static scene behind lobby.
    this.drawSky();
    this.drawGround(0);
  }

  private showDealingLayer(): void {
    this.lobbyContainer.setVisible(false);
    this.dealingContainer.setVisible(true);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(false);
    this.birdSprite.setVisible(false);
    this.clearPipeSprites();
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

  private clearPipeSprites(): void {
    for (const sprites of this.pipeSprites.values()) {
      sprites.top.destroy();
      sprites.bottom.destroy();
    }
    this.pipeSprites.clear();
  }
}
