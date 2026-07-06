/**
 * SnakeScene — Phaser 3 scene for the Snake Bounty miniapp.
 *
 * Renders a 20×20 grid arena with:
 *  - Warm green felt background with subtle grid lines
 *  - Snake: teal rounded-rect head, body squares, tail
 *  - Food: pulsing gold star at food position
 *  - Target badge (difficulty badge + target-length info) at top of grid
 *  - Timer bar + length progress bar in the HUD
 *  - Lobby: 3 difficulty route cards (idle state)
 *
 * State keys consumed (via BaseScene helpers):
 *  gameStatus   "idle"|"committed"|"dealt"|"solved"|"expired"
 *  clues        string — JSON: { body, direction, food, foodQueue }
 *  gameDifficulty number
 *  deadline     number (ms epoch)
 *  dealtAt      number (ms epoch)
 *  poolFree     number
 *  isStarting   boolean
 *  isDealing    boolean
 *  isSubmitting boolean
 *  lastStatus   string
 *
 * Actions dispatched to React:
 *  "startGame"       { difficulty: number }
 *  "recordMove"      { dir: number }
 *  "submitSolution"  {}
 *  "expireGame"      {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  GRID_SIZE,
  parseInitialState,
  step,
  snakeLength,
  hasReachedTarget,
  stateToSolutionString,
} from "../logic/snake-engine";
import type { SnakeState, Direction } from "../logic/snake-engine";
import {
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  ruleOf,
} from "../logic/game-rules";
import type { Difficulty } from "../logic/game-rules";

// ── Layout constants ──────────────────────────────────────────────────────────

const W = 440;              // canvas width
const H = 580;              // canvas height
const CELL = 20;            // px per grid cell (20×20 = 400px grid)
const GRID_PX = GRID_SIZE * CELL;   // 400
const GRID_LEFT = (W - GRID_PX) / 2; // 20 — left edge of grid
const GRID_TOP  = 78;       // y of grid top edge (below HUD)
const GAME_TICK_MS = 200;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  // Felt / background
  felt:        0x2d6a4f,   // warm deep green
  feltAlt:     0x2b6349,   // alternating cell tint
  feltBorder:  0x1a4531,
  feltInner:   0x3a7d5e,

  // Snake
  head:        0x00b4d8,   // teal
  headStroke:  0x0096b4,
  body:        0x00af92,   // jade-teal body
  bodyDark:    0x008f76,
  tail:        0x52d9c0,

  // Food / target
  gold:        0xf4a820,
  goldLight:   0xffe066,
  star:        0xffc107,

  // HUD
  hudBg:       0x1a3a2b,
  barBg:       0x113322,
  timerFill:   0x00af92,
  timerLow:    0xf97066,
  lengthFill:  0x5af5d0,

  // Lobby cards
  cardBg:      0x1e4232,
  cardBorder:  0x2e6650,
  cardActive:  0x047857,
  cardActiveBg:0x0d5740,
  white:       0xffffff,
  cream:       0xfff8e8,
  muted:       0x80b89a,
  gold2:       0xd4a843,

  // Overlay
  overlay:     0x000000,
  win:         0x16a34a,
  lose:        0xe25d4d,
};

// ── Difficulty label table ────────────────────────────────────────────────────

const DIFF_LABELS = ["Easy", "Medium", "Hard"] as const;
const DIFF_BADGES = [0x16a34a, 0xf4a820, 0xe25d4d] as const;


// ── Scene class ───────────────────────────────────────────────────────────────

export class SnakeScene extends BaseScene {

  // ── Layout dims (computed after scale is known) ──────────────────────────
  private scW = W;
  private scH = H;

  // ── Graphics layers ──────────────────────────────────────────────────────
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private snakeGfx!:     Phaser.GameObjects.Graphics;
  private foodGfx!:      Phaser.GameObjects.Graphics;
  private hudGfx!:       Phaser.GameObjects.Graphics;

  // ── HUD text ─────────────────────────────────────────────────────────────
  private timerLabel!:   Phaser.GameObjects.Text;
  private lengthLabel!:  Phaser.GameObjects.Text;
  private statusLabel!:  Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private hintLabel!:    Phaser.GameObjects.Text;
  private targetBadge!:  Phaser.GameObjects.Text;

  // ── Overlay (crash / won / submitting) ───────────────────────────────────
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!:        Phaser.GameObjects.Rectangle;
  private overlayTitle!:     Phaser.GameObjects.Text;
  private overlaySub!:       Phaser.GameObjects.Text;
  private overlayBtn!:       Phaser.GameObjects.Container;

  // ── Lobby layer ──────────────────────────────────────────────────────────
  private lobbyContainer!:   Phaser.GameObjects.Container;
  private lobbyCards:        Phaser.GameObjects.Container[] = [];
  private lobbyStatusText!:  Phaser.GameObjects.Text;
  private pickedDifficulty: Difficulty = 0;

  // ── Food pulse ───────────────────────────────────────────────────────────
  private foodPulse = 0;          // 0→1 oscillated by a timer
  private foodPulseTween: Phaser.Tweens.Tween | null = null;

  // ── Local snake simulation ───────────────────────────────────────────────
  private snake:           SnakeState | null = null;
  private localDir:        Direction = 1;
  private queuedDir:       Direction | null = null;
  private crashed          = false;
  private targetReached    = false;

  // ── Timers ───────────────────────────────────────────────────────────────
  private tickTimer:       Phaser.Time.TimerEvent | null = null;
  private clockTimer:      Phaser.Time.TimerEvent | null = null;
  private nowMs            = Date.now();

  // ── Swipe detection ──────────────────────────────────────────────────────
  private ptrDown: { x: number; y: number } | null = null;

  // ── State cache (to detect changes) ─────────────────────────────────────
  private prevGameStatus   = "";
  private prevClues        = "";

  constructor() {
    super("SnakeScene");
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    // All rendering uses Phaser primitives — no external assets required
  }

  create(): void {
    super.create(); // wires the bridge first

    const { width: ww, height: hh } = this.scale;
    this.scW = ww;
    this.scH = hh;

    this.buildBackground();
    this.buildGrid();
    this.buildHUD();
    this.buildSnakeLayer();
    this.buildFoodLayer();
    this.buildTargetBadge();
    this.buildOverlay();
    this.buildLobby();
    this.buildStatusRow();

    // Wire input (keyboard + pointer/swipe)
    this.setupInput();

    // Seed from current state
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract implementation ─────────────────────────────────────

  protected onStateUpdate(state: GameState): void {
    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const isDealing  = this.bool("isDealing");
    const isStarting = this.bool("isStarting");
    const isSubmitting = this.bool("isSubmitting");
    const lastStatus = this.str("lastStatus", "");

    // Status label always reflects latest
    this.statusLabel?.setText(lastStatus);

    const statusChanged = gameStatus !== this.prevGameStatus;
    const cluesChanged  = clues !== this.prevClues;

    // ── Phase transitions ──────────────────────────────────────────────────
    if (statusChanged || cluesChanged) {
      this.prevGameStatus = gameStatus;
      this.prevClues      = clues;

      if (gameStatus === "dealt" && clues) {
        this.enterPlayPhase(clues);
      } else if (gameStatus !== "dealt") {
        this.exitPlayPhase();
      }
    }

    // ── Lobby vs board visibility ──────────────────────────────────────────
    const inPlay = gameStatus === "dealt" && this.snake !== null;
    this.lobbyContainer.setVisible(!inPlay && gameStatus !== "committed");
    this.gridGraphics.setVisible(inPlay);
    this.snakeGfx.setVisible(inPlay);
    this.foodGfx.setVisible(inPlay);
    this.hudGfx.setVisible(inPlay);
    this.timerLabel.setVisible(inPlay);
    this.lengthLabel.setVisible(inPlay);
    this.controlsHint.setVisible(inPlay);
    this.targetBadge.setVisible(inPlay);
    this.hintLabel.setVisible(inPlay);

    if (inPlay) {
      this.updateHUD();
      this.drawSnake();
      this.drawFood();
    }

    // ── Overlay ───────────────────────────────────────────────────────────
    if (isDealing || (gameStatus === "committed" && !inPlay)) {
      this.showOverlay("Dealing", "Preparing your game", false);
    } else if (isSubmitting) {
      this.showOverlay("Submitting", "Verifying your solution", false);
    } else if (this.crashed && gameStatus === "dealt") {
      this.showOverlay("Game Over", "The snake crashed.", true);
    } else if (gameStatus === "solved") {
      this.showOverlay("Solved", "Congratulations, you won.", false);
    } else if (gameStatus === "expired") {
      this.showOverlay("Expired", "Time ran out.", false);
    } else {
      this.overlayContainer.setVisible(false);
    }

    // ── Lobby card highlights ──────────────────────────────────────────────
    if (!inPlay) {
      this.updateLobbyCards();
    }
  }

  // ── Phase helpers ─────────────────────────────────────────────────────────

  private enterPlayPhase(clues: string): void {
    try {
      this.snake = parseInitialState(clues);
      this.localDir = this.snake.direction;
      this.queuedDir = null;
      this.crashed = false;
      this.targetReached = false;
    } catch {
      this.snake = null;
      return;
    }
    this.startTickTimer();
    this.startClockTimer();
    this.startFoodPulse();
  }

  private exitPlayPhase(): void {
    this.stopTickTimer();
    this.stopClockTimer();
    this.stopFoodPulse();
    this.snake = null;
    this.crashed = false;
    this.targetReached = false;
  }

  // ── Tick timer ────────────────────────────────────────────────────────────

  private startTickTimer(): void {
    this.stopTickTimer();
    this.tickTimer = this.time.addEvent({
      delay: GAME_TICK_MS,
      loop: true,
      callback: this.onGameTick,
      callbackScope: this,
    });
  }

  private stopTickTimer(): void {
    if (this.tickTimer) {
      this.tickTimer.destroy();
      this.tickTimer = null;
    }
  }

  private onGameTick(): void {
    const gameStatus = this.str("gameStatus", "idle");
    if (
      gameStatus !== "dealt" ||
      !this.snake ||
      this.snake.dead ||
      this.targetReached ||
      this.bool("isSubmitting")
    ) {
      return;
    }

    const dir = this.queuedDir ?? this.localDir;
    this.snake = step(this.snake, dir);
    this.localDir = dir;
    this.queuedDir = null;

    if (this.snake.dead) {
      this.crashed = true;
      this.stopTickTimer();
      this.onStateUpdate(this.state);
      return;
    }

    const rule = ruleOf(this.num("gameDifficulty", 0));
    if (hasReachedTarget(this.snake, rule.targetLength)) {
      this.targetReached = true;
    }

    this.drawSnake();
    this.drawFood();
    this.updateHUD();
  }

  // ── Clock timer (drives HUD countdown each second) ────────────────────────

  private startClockTimer(): void {
    this.stopClockTimer();
    this.nowMs = Date.now();
    this.clockTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.nowMs = Date.now();
        if (this.str("gameStatus", "") === "dealt") {
          this.updateHUD();
        }
      },
      callbackScope: this,
    });
  }

  private stopClockTimer(): void {
    if (this.clockTimer) {
      this.clockTimer.destroy();
      this.clockTimer = null;
    }
  }

  // ── Food pulse tween ──────────────────────────────────────────────────────

  private startFoodPulse(): void {
    this.stopFoodPulse();
    this.foodPulse = 0;
    this.foodPulseTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 600,
      yoyo: true,
      loop: -1,
      onUpdate: (tween) => {
        this.foodPulse = (tween.getValue() as number) / 100;
      },
    });
  }

  private stopFoodPulse(): void {
    if (this.foodPulseTween) {
      this.foodPulseTween.stop();
      this.foodPulseTween = null;
    }
    this.foodPulse = 0;
  }

  // ── Build: background ────────────────────────────────────────────────────

  private buildBackground(): void {
    const gfx = this.add.graphics();
    // Full canvas fill — warm deep green felt
    gfx.fillStyle(C.felt);
    gfx.fillRect(0, 0, this.scW, this.scH);
    // Subtle inner rim for depth
    gfx.lineStyle(3, C.feltBorder, 0.6);
    gfx.strokeRoundedRect(6, 6, this.scW - 12, this.scH - 12, 14);
  }

  // ── Build: grid ───────────────────────────────────────────────────────────

  private buildGrid(): void {
    this.gridGraphics = this.add.graphics();
    const gfx = this.gridGraphics;

    // Grid background — lighter green
    gfx.fillStyle(C.feltInner, 1);
    gfx.fillRoundedRect(GRID_LEFT - 2, GRID_TOP - 2, GRID_PX + 4, GRID_PX + 4, 10);

    // Alternating cell checker pattern
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const even = (row + col) % 2 === 0;
        gfx.fillStyle(even ? 0x2b6349 : 0x2d6a4f, 1);
        gfx.fillRect(
          GRID_LEFT + col * CELL,
          GRID_TOP  + row * CELL,
          CELL,
          CELL,
        );
      }
    }

    // Grid border
    gfx.lineStyle(2, C.feltBorder, 0.8);
    gfx.strokeRoundedRect(GRID_LEFT - 2, GRID_TOP - 2, GRID_PX + 4, GRID_PX + 4, 10);

    this.gridGraphics.setVisible(false);
  }

  // ── Build: HUD ────────────────────────────────────────────────────────────

  private buildHUD(): void {
    this.hudGfx = this.add.graphics();
    // HUD panel background
    this.hudGfx.fillStyle(C.hudBg, 0.9);
    this.hudGfx.fillRoundedRect(GRID_LEFT, 8, GRID_PX, 60, 8);
    this.hudGfx.setVisible(false);

    // Timer bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(GRID_LEFT + 8, 18, GRID_PX - 16, 10, 5);

    // Length bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(GRID_LEFT + 8, 38, GRID_PX - 16, 8, 4);

    // Timer clock label
    this.timerLabel = this.add.text(GRID_LEFT + 10, 54, "00:00", {
      fontSize: "12px",
      color: "#5af5d0",
      fontStyle: "bold",
    }).setOrigin(0, 0.5).setVisible(false);

    // Length label
    this.lengthLabel = this.add.text(GRID_LEFT + GRID_PX / 2, 54, "0 / 10 cells", {
      fontSize: "12px",
      color: "#d4a843",
    }).setOrigin(0.5, 0.5).setVisible(false);
  }

  // ── Build: snake layer ───────────────────────────────────────────────────

  private buildSnakeLayer(): void {
    this.snakeGfx = this.add.graphics();
    this.snakeGfx.setVisible(false);
  }

  // ── Build: food layer ────────────────────────────────────────────────────

  private buildFoodLayer(): void {
    this.foodGfx = this.add.graphics();
    this.foodGfx.setVisible(false);
  }

  // ── Build: target badge ──────────────────────────────────────────────────

  private buildTargetBadge(): void {
    this.targetBadge = this.add.text(
      GRID_LEFT + GRID_PX - 8,
      54,
      "",
      {
        fontSize: "11px",
        color: "#ffe066",
        fontStyle: "bold",
      },
    ).setOrigin(1, 0.5).setVisible(false);
  }

  // ── Build: status row ────────────────────────────────────────────────────

  private buildStatusRow(): void {
    this.controlsHint = this.add.text(
      this.scW / 2,
      GRID_TOP + GRID_PX + 14,
      "Arrow keys / WASD / Swipe",
      {
        fontSize: "11px",
        color: "#80b89a",
      },
    ).setOrigin(0.5).setVisible(false);

    this.hintLabel = this.add.text(
      this.scW / 2,
      GRID_TOP + GRID_PX + 30,
      "",
      {
        fontSize: "11px",
        color: "#f97066",
        fontStyle: "bold",
        wordWrap: { width: GRID_PX },
      },
    ).setOrigin(0.5).setVisible(false);

    this.statusLabel = this.add.text(
      this.scW / 2,
      this.scH - 14,
      "",
      {
        fontSize: "10px",
        color: "#80b89a",
      },
    ).setOrigin(0.5);
  }

  // ── Build: overlay ────────────────────────────────────────────────────────

  private buildOverlay(): void {
    this.overlayContainer = this.add.container(this.scW / 2, this.scH / 2);

    this.overlayBg = this.add.rectangle(0, 0, 260, 110, C.overlay, 200)
      .setStrokeStyle(2, C.gold)
      .setOrigin(0.5);

    this.overlayTitle = this.add.text(0, -22, "", {
      fontSize: "24px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.overlaySub = this.add.text(0, 12, "", {
      fontSize: "13px",
      color: "#80b89a",
    }).setOrigin(0.5);

    // Action button (used for "Start Game" shortcut from overlay in lobby)
    const btnBg = this.add.rectangle(0, 44, 140, 32, C.gold)
      .setStrokeStyle(1, C.goldLight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(0, 44, "Play Again", {
      fontSize: "13px",
      color: "#1a3a2b",
      fontStyle: "bold",
    }).setOrigin(0.5);
    btnBg.on("pointerdown", () => {
      this.dispatch("startGame", { difficulty: this.pickedDifficulty });
    });
    this.overlayBtn = this.add.container(0, 0, [btnBg, btnTxt]);

    this.overlayContainer.add([
      this.overlayBg,
      this.overlayTitle,
      this.overlaySub,
      this.overlayBtn,
    ]);
    this.overlayContainer.setVisible(false);
  }

  private showOverlay(title: string, sub: string, showBtn: boolean): void {
    this.overlayTitle.setText(title);
    this.overlaySub.setText(sub);
    this.overlayBtn.setVisible(showBtn);
    this.overlayContainer.setVisible(true);
    this.overlayContainer.setScale(0.8);
    this.tweens.add({
      targets: this.overlayContainer,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  // ── Build: lobby ──────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0);

    const titleMark = this.add.graphics();
    this.drawSnakeMedallion(titleMark, this.scW / 2 - 92, 28, 0.58);

    const title = this.add.text(this.scW / 2 + 12, 28, "Snake Bounty", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#d4a843",
    }).setOrigin(0.5);

    const sub = this.add.text(this.scW / 2, 50, "Grow the snake to win GAS", {
      fontSize: "12px",
      color: "#80b89a",
    }).setOrigin(0.5);

    // Arena preview panel
    const arenaGfx = this.add.graphics();
    arenaGfx.fillStyle(C.cardBg, 1);
    arenaGfx.fillRoundedRect(GRID_LEFT, 66, GRID_PX, 160, 12);
    arenaGfx.lineStyle(1, C.cardBorder, 0.7);
    arenaGfx.strokeRoundedRect(GRID_LEFT, 66, GRID_PX, 160, 12);

    // Mini snake preview (decorative)
    const previewGfx = this.add.graphics();
    this.drawMiniSnakePreview(previewGfx);

    // Labels inside arena
    const arenaTitle = this.add.text(GRID_LEFT + 16, 86, "How to Play", {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffe066",
    });
    const arenaCopy = this.add.text(GRID_LEFT + 16, 106, [
      "• Navigate the snake to eat food",
      "• Grow to the target length",
      "• Don't hit walls or yourself",
      "• Submit before time runs out",
    ].join("\n"), {
      fontSize: "11px",
      color: "#80b89a",
      lineSpacing: 5,
    });

    // Difficulty cards row
    const cardsY = 250;
    const cardW  = 118;
    const cardH  = 100;
    const gap    = 8;
    const totalW = 3 * cardW + 2 * gap;
    const cardsX = (this.scW - totalW) / 2;

    this.lobbyCards = [];
    for (let i = 0; i < 3; i++) {
      const rule = ruleOf(i as Difficulty);
      const cx   = cardsX + i * (cardW + gap) + cardW / 2;
      const cy   = cardsY + cardH / 2;
      const card = this.makeCard(cx, cy, cardW, cardH, i as Difficulty, rule);
      this.lobbyCards.push(card);
    }

    // Pool info line
    const poolText = this.add.text(this.scW / 2, 366, "", {
      fontSize: "11px",
      color: "#80b89a",
    }).setOrigin(0.5);
    this.lobbyStatusText = poolText;

    // Start hint
    const startHint = this.add.text(this.scW / 2, 386, "Select a route, then press Play", {
      fontSize: "10px",
      color: "#5af5d0",
    }).setOrigin(0.5).setAlpha(0.7);

    this.lobbyContainer.add([
      titleMark,
      title,
      sub,
      arenaGfx,
      previewGfx,
      arenaTitle,
      arenaCopy,
      ...this.lobbyCards,
      poolText,
      startHint,
    ]);
  }

  private drawMiniSnakePreview(gfx: Phaser.GameObjects.Graphics): void {
    // Decorative mini snake path on the right side of the arena panel
    const body: Array<{ x: number; y: number }> = [
      { x: 340, y: 110 },
      { x: 320, y: 110 },
      { x: 300, y: 110 },
      { x: 280, y: 110 },
      { x: 260, y: 110 },
    ];
    // Body segments
    gfx.fillStyle(C.body, 0.7);
    for (let i = 1; i < body.length; i++) {
      gfx.fillRoundedRect(body[i]!.x - 7, body[i]!.y - 7, 14, 14, 4);
    }
    // Head
    gfx.fillStyle(C.head, 0.9);
    gfx.fillRoundedRect(body[0]!.x - 9, body[0]!.y - 9, 18, 18, 6);
    // Food dot
    gfx.fillStyle(C.gold, 1);
    gfx.fillCircle(365, 158, 6);
    gfx.fillStyle(C.goldLight, 0.6);
    gfx.fillCircle(365, 158, 9);
  }

  private drawSnakeMedallion(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    scale = 1,
  ): void {
    gfx.fillStyle(C.cardActiveBg, 1);
    gfx.fillCircle(x, y, 22 * scale);
    gfx.lineStyle(2 * scale, C.gold, 0.9);
    gfx.strokeCircle(x, y, 22 * scale);
    gfx.lineStyle(5 * scale, C.tail, 0.95);
    gfx.beginPath();
    gfx.moveTo(x - 13 * scale, y + 3 * scale);
    gfx.lineTo(x - 5 * scale, y - 6 * scale);
    gfx.lineTo(x + 6 * scale, y - 6 * scale);
    gfx.lineTo(x + 12 * scale, y + 1 * scale);
    gfx.strokePath();
    gfx.fillStyle(C.head, 1);
    gfx.fillRoundedRect(x + 8 * scale, y - 8 * scale, 10 * scale, 10 * scale, 3 * scale);
    gfx.fillStyle(C.goldLight, 1);
    gfx.fillCircle(x + 15 * scale, y - 5 * scale, 1.6 * scale);
  }

  private drawDifficultyBadge(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    difficulty: Difficulty,
  ): void {
    const color = DIFF_BADGES[difficulty];
    gfx.fillStyle(color, 0.28);
    gfx.fillCircle(x, y, 18);
    gfx.lineStyle(2, color, 0.95);
    gfx.strokeCircle(x, y, 18);
    gfx.fillStyle(color, 0.92);
    for (let i = 0; i <= difficulty; i++) {
      gfx.fillRoundedRect(x - 10 + i * 9, y + 7 - i * 6, 5, 8 + i * 6, 2);
    }
  }

  private makeCard(
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    difficulty: Difficulty,
    rule: ReturnType<typeof ruleOf>,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(cx, cy);

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const badge = this.add.graphics();
    this.drawDifficultyBadge(badge, 0, -28, difficulty);

    const label = this.add.text(0, -6, DIFF_LABELS[difficulty], {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#d4a843",
    }).setOrigin(0.5);

    const targetTxt = this.add.text(0, 12, `${rule.targetLength} cells`, {
      fontSize: "11px",
      color: "#80b89a",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(0, 28, `${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "10px",
      color: "#5af5d0",
    }).setOrigin(0.5);

    container.add([bg, badge, label, targetTxt, entryTxt]);

    bg.on("pointerdown", () => {
      this.pickedDifficulty = difficulty;
      this.updateLobbyCards();
      this.tweens.add({
        targets: container,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 80,
        yoyo: true,
      });
    });
    bg.on("pointerover", () => {
      if (difficulty !== this.pickedDifficulty) {
        bg.setStrokeStyle(2, C.muted);
      }
    });
    bg.on("pointerout", () => {
      this.updateLobbyCards();
    });

    return container;
  }

  private updateLobbyCards(): void {
    for (let i = 0; i < this.lobbyCards.length; i++) {
      const card     = this.lobbyCards[i]!;
      const bg       = card.list[0] as Phaser.GameObjects.Rectangle;
      const isActive = i === this.pickedDifficulty;
      bg.setFillStyle(isActive ? C.cardActiveBg : C.cardBg);
      bg.setStrokeStyle(2, isActive ? C.cardActive : C.cardBorder);
    }
    // Update pool text
    const poolFree = this.num("poolFree", 0);
    const rule     = ruleOf(this.pickedDifficulty);
    const needed   = Number(gasDisplay(rule.entryFixed8));
    const ready    = poolFree >= needed;
    if (this.lobbyStatusText) {
      const reward  = gasDisplay(rule.rewardFixed8);
      const time    = Math.round(rule.limitMs / 60000);
      this.lobbyStatusText.setText(
        ready
          ? `Pool: ${poolFree.toFixed(2)} GAS  ·  Win: ${reward} GAS  ·  ${time} min`
          : `Pool low (${poolFree.toFixed(2)} / ${needed} GAS needed)`,
      );
      this.lobbyStatusText.setColor(ready ? "#80b89a" : "#f97066");
    }
  }

  // ── Draw: snake ───────────────────────────────────────────────────────────

  private drawSnake(): void {
    if (!this.snake) return;
    const gfx = this.snakeGfx;
    gfx.clear();

    const body = this.snake.body;
    const len  = body.length;

    for (let i = len - 1; i >= 0; i--) {
      const seg = body[i]!;
      const px  = GRID_LEFT + seg.x * CELL;
      const py  = GRID_TOP  + seg.y * CELL;

      if (i === 0) {
        // Head — teal rounded rectangle, slightly larger
        const crashed = this.crashed || this.snake.dead;
        gfx.fillStyle(crashed ? C.lose : C.head, 1);
        gfx.fillRoundedRect(px + 1, py + 1, CELL - 2, CELL - 2, 5);
        gfx.lineStyle(1.5, crashed ? 0xf97066 : C.headStroke, 0.8);
        gfx.strokeRoundedRect(px + 1, py + 1, CELL - 2, CELL - 2, 5);
        // Eyes
        this.drawSnakeEyes(gfx, seg, px, py);
      } else if (i === len - 1 && len > 1) {
        // Tail — smaller, lighter
        const alpha = this.crashed ? 0.4 : 0.8;
        gfx.fillStyle(C.tail, alpha);
        gfx.fillRoundedRect(px + 4, py + 4, CELL - 8, CELL - 8, 3);
      } else {
        // Body — jade squares with stroke
        const alpha = this.crashed ? 0.5 : 1;
        gfx.fillStyle(C.body, alpha);
        gfx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        gfx.lineStyle(1, C.bodyDark, 0.4);
        gfx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      }
    }
  }

  private drawSnakeEyes(
    gfx: Phaser.GameObjects.Graphics,
    head: { x: number; y: number },
    px: number,
    py: number,
  ): void {
    // Draw two small white dots on the head, rotated toward direction
    const dir    = this.localDir;
    // Eye offsets relative to cell center — rotated by direction
    type Offset = { ex1: number; ey1: number; ex2: number; ey2: number };
    const offsets: Record<Direction, Offset> = {
      0: { ex1: -4, ey1: -2, ex2:  4, ey2: -2 }, // up
      1: { ex1:  2, ey1: -4, ex2:  2, ey2:  4 }, // right
      2: { ex1: -4, ey1:  2, ex2:  4, ey2:  2 }, // down
      3: { ex1: -2, ey1: -4, ex2: -2, ey2:  4 }, // left
    };
    const off = offsets[dir];
    const cx  = px + CELL / 2;
    const cy  = py + CELL / 2;
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(cx + off.ex1, cy + off.ey1, 2);
    gfx.fillCircle(cx + off.ex2, cy + off.ey2, 2);
    gfx.fillStyle(0x1a3a2b, 1);
    gfx.fillCircle(cx + off.ex1, cy + off.ey1, 1);
    gfx.fillCircle(cx + off.ex2, cy + off.ey2, 1);
  }

  // ── Draw: food ────────────────────────────────────────────────────────────

  private drawFood(): void {
    if (!this.snake) return;
    const gfx   = this.foodGfx;
    const food  = this.snake.food;
    const scale = 1 + this.foodPulse * 0.18;
    const px    = GRID_LEFT + food.x * CELL + CELL / 2;
    const py    = GRID_TOP  + food.y * CELL + CELL / 2;
    const r     = (CELL / 2 - 1) * scale;
    gfx.clear();
    // Outer glow
    gfx.fillStyle(C.goldLight, 0.25 + this.foodPulse * 0.15);
    gfx.fillCircle(px, py, r + 3);
    // Gold circle (apple-like)
    gfx.fillStyle(C.star, 1);
    gfx.fillCircle(px, py, r);
    // Highlight
    gfx.fillStyle(0xffffff, 0.35);
    gfx.fillCircle(px - r * 0.3, py - r * 0.3, r * 0.35);
    // Stem
    gfx.lineStyle(1.5, 0x2d6a4f, 0.8);
    gfx.beginPath();
    gfx.moveTo(px, py - r);
    gfx.lineTo(px + 2, py - r - 4);
    gfx.strokePath();
  }

  // ── HUD update ────────────────────────────────────────────────────────────

  private updateHUD(): void {
    const gameStatus   = this.str("gameStatus", "idle");
    const deadline     = this.num("deadline", 0);
    const dealtAt      = this.num("dealtAt", 0);
    const difficulty   = this.num("gameDifficulty", 0);
    const rule         = ruleOf(difficulty as Difficulty);

    const remainingMs  = deadline > 0 ? deadline - this.nowMs : 0;
    const totalMs      = deadline > 0 && dealtAt > 0 ? deadline - dealtAt : rule.limitMs;
    const timePct      = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
    const currentLen   = this.snake ? snakeLength(this.snake) : 0;
    const lengthPct    = Math.min(1, currentLen / rule.targetLength);
    const isLow        = remainingMs < 60_000 && remainingMs > 0;

    // Redraw HUD bars
    const hudGfx = this.hudGfx;
    hudGfx.clear();
    // Panel
    hudGfx.fillStyle(C.hudBg, 0.9);
    hudGfx.fillRoundedRect(GRID_LEFT, 8, GRID_PX, 60, 8);
    // Timer bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(GRID_LEFT + 8, 18, GRID_PX - 16, 10, 5);
    // Timer bar fill
    if (timePct > 0) {
      const fillW = Math.max(4, (GRID_PX - 16) * timePct);
      hudGfx.fillStyle(isLow ? C.timerLow : C.timerFill, 1);
      hudGfx.fillRoundedRect(GRID_LEFT + 8, 18, fillW, 10, 5);
    }
    // Length bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(GRID_LEFT + 8, 38, GRID_PX - 16, 8, 4);
    // Length bar fill
    if (lengthPct > 0) {
      const fillW = Math.max(4, (GRID_PX - 16) * lengthPct);
      hudGfx.fillStyle(this.targetReached ? C.win : C.lengthFill, 1);
      hudGfx.fillRoundedRect(GRID_LEFT + 8, 38, fillW, 8, 4);
    }

    // Timer label
    this.timerLabel.setText(formatClock(Math.max(0, remainingMs)));
    this.timerLabel.setColor(isLow ? "#f97066" : "#5af5d0");

    // Length label
    this.lengthLabel.setText(`${currentLen} / ${rule.targetLength} cells`);
    this.lengthLabel.setColor(this.targetReached ? "#5af5d0" : "#d4a843");

    // Target badge
    const reward = gasDisplay(rule.rewardFixed8);
    this.targetBadge.setText(`${reward} GAS reward`);

    // Hint label
    const elapsedMs = dealtAt > 0 ? this.nowMs - dealtAt : 0;
    const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
    const timeUp    = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
    const submitWindowClosed = gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;

    if (this.crashed || (this.snake && this.snake.dead)) {
      this.hintLabel.setText("Snake crashed.").setVisible(true);
    } else if (timeUp) {
      this.hintLabel.setText("Time's up.").setVisible(true);
    } else if (submitWindowClosed && !timeUp) {
      this.hintLabel.setText("Closing soon — submit now!").setVisible(true);
    } else if (this.targetReached && !minSolveReached) {
      const wait = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs;
      this.hintLabel.setText(`Wait ${formatClock(wait)} to submit`).setVisible(true);
    } else if (this.targetReached && minSolveReached) {
      this.hintLabel.setText("Target reached. Submit now.").setVisible(true);
    } else {
      this.hintLabel.setText("").setVisible(true);
    }
  }

  // ── Input: keyboard ───────────────────────────────────────────────────────

  private setupInput(): void {
    if (this.input.keyboard) {
      this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
        if (this.str("gameStatus", "") !== "dealt") return;
        const map: Record<string, Direction> = {
          ArrowUp: 0, w: 0, W: 0,
          ArrowRight: 1, d: 1, D: 1,
          ArrowDown: 2, s: 2, S: 2,
          ArrowLeft: 3, a: 3, A: 3,
        };
        const dir = map[event.key];
        if (dir !== undefined) {
          event.preventDefault?.();
          this.tryQueueDirection(dir);
        }
      });
    }

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.ptrDown = { x: ptr.x, y: ptr.y };
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (!this.ptrDown || this.str("gameStatus", "") !== "dealt") {
        this.ptrDown = null;
        return;
      }
      const dx     = ptr.x - this.ptrDown.x;
      const dy     = ptr.y - this.ptrDown.y;
      const absDx  = Math.abs(dx);
      const absDy  = Math.abs(dy);
      const THRESH = 24;
      if (Math.max(absDx, absDy) >= THRESH) {
        if (absDx > absDy) {
          this.tryQueueDirection(dx > 0 ? 1 : 3);
        } else {
          this.tryQueueDirection(dy > 0 ? 2 : 0);
        }
      }
      this.ptrDown = null;
    });
  }

  private tryQueueDirection(dir: Direction): void {
    if (!this.snake || this.snake.dead || this.targetReached) return;
    if (this.bool("isSubmitting")) return;

    // Prevent 180° reversal
    const opposite: Record<Direction, Direction> = { 0: 2, 1: 3, 2: 0, 3: 1 };
    if (dir === opposite[this.localDir] && snakeLength(this.snake) > 1) return;

    this.queuedDir = dir;
    this.dispatch("recordMove", { dir });
  }

  // ── Responsive resize ─────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.scene.restart();
  }

  // ── update (Phaser frame loop) ────────────────────────────────────────────

  update(_time: number, _delta: number): void {
    // Food pulse is driven by a tween counter; redraw food every frame
    // only when in play to keep the animation smooth.
    if (
      this.str("gameStatus", "") === "dealt" &&
      this.snake &&
      !this.snake.dead &&
      !this.crashed
    ) {
      this.drawFood();
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  override destroy(fromScene = false): void {
    this.stopTickTimer();
    this.stopClockTimer();
    this.stopFoodPulse();
    super.destroy(fromScene);
  }
}
