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
} from "../logic/snake-engine";
import type { SnakeState, Direction } from "../logic/snake-engine";
import {
  formatClock,
  gasDisplay,
  ruleOf,
} from "../logic/game-rules";
import type { Difficulty } from "../logic/game-rules";

// ── Layout constants ──────────────────────────────────────────────────────────

const DESIGN_W = 440;       // logical canvas width
const DESIGN_H = 580;       // logical canvas height
const GAME_TICK_MS = 200;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

type SnakeLayout = {
  cell: number;
  gridPx: number;
  gridLeft: number;
  gridTop: number;
  hudTop: number;
  controlsY: number;
  hintY: number;
  statusY: number;
  lobbyTitleY: number;
  lobbySubY: number;
  lobbyPanelX: number;
  lobbyPanelY: number;
  lobbyPanelW: number;
  lobbyPanelH: number;
  lobbyCardsY: number;
  lobbyCardW: number;
  lobbyCardH: number;
  lobbyCardGap: number;
  lobbyStatusY: number;
};

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  // Felt / background
	  felt:        0x3a7d5e,   // warm green felt
	  feltAlt:     0x367454,   // alternating cell tint
	  feltBorder:  0x1c5138,
	  feltInner:   0x47926f,

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
	  hudBg:       0x1f513b,
	  barBg:       0x17422f,
  timerFill:   0x00af92,
  timerLow:    0xf97066,
  lengthFill:  0x5af5d0,

  // Lobby cards
	  cardBg:      0x174d38,
	  cardBorder:  0x56a979,
  cardActive:  0x047857,
  cardActiveBg:0x0d5740,
  white:       0xffffff,
  cream:       0xfff8e8,
	  muted:       0xc7f9d4,
	  gold2:       0xffcf68,

  // Overlay
  overlay:     0x000000,
  win:         0x16a34a,
  lose:        0xe25d4d,
};

// ── Difficulty label table ────────────────────────────────────────────────────

const DIFF_LABELS = ["Easy", "Medium", "Hard"] as const;
const SNAKE_ASSETS = {
  head: "snake-head",
  body: "snake-body-straight",
  tail: "snake-tail",
  food: "food-bounty",
  reward: "reward-trophy",
  target: "target-badge",
  badges: ["badge-easy", "badge-medium", "badge-hard"],
} as const;


// ── Scene class ───────────────────────────────────────────────────────────────

export class SnakeScene extends BaseScene {

  // ── Layout dims (computed after scale is known) ──────────────────────────
  private scW = DESIGN_W;
  private scH = DESIGN_H;
  private layout = this.computeLayout(DESIGN_W, DESIGN_H);

  // ── Graphics layers ──────────────────────────────────────────────────────
  private backgroundGfx!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private snakeGfx!:     Phaser.GameObjects.Graphics;
  private foodGfx!:      Phaser.GameObjects.Graphics;
  private foodSprite!:   Phaser.GameObjects.Image;
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
  private overlayBtnBg!:     Phaser.GameObjects.Rectangle;
  private overlayBtnTxt!:    Phaser.GameObjects.Text;
  private overlayAction: (() => void) | null = null;

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

  private computeLayout(width: number, height: number): SnakeLayout {
    const outerPad = width < 400 ? 12 : 20;
    const maxGridByWidth = width - outerPad * 2;
    const maxGridByHeight = Math.max(260, height - 178);
    const cell = Math.max(
      14,
      Math.floor(Math.min(20, maxGridByWidth / GRID_SIZE, maxGridByHeight / GRID_SIZE)),
    );
    const gridPx = cell * GRID_SIZE;
    const gridLeft = Math.round((width - gridPx) / 2);
    const hudTop = height < 620 ? 8 : 12;
    const gridTop = hudTop + 70;
    const controlsY = gridTop + gridPx + 18;
    const hintY = controlsY + 18;

    const lobbyTitleY = Math.max(26, Math.round(height * 0.05));
    const lobbySubY = lobbyTitleY + 24;
    const lobbyPanelX = outerPad;
    const lobbyPanelY = lobbySubY + 18;
    const lobbyCardW = Math.min(118, Math.floor((width - outerPad * 2 - 16) / 3));
    const lobbyCardH = height < 620 ? 92 : 104;
    const lobbyCardGap = Math.max(6, Math.floor((width - outerPad * 2 - lobbyCardW * 3) / 2));
    const lobbyPanelH = Math.max(178, Math.min(236, Math.round(height * 0.29)));
    const lobbyCardsY = Math.max(
      lobbyPanelY + lobbyPanelH + lobbyCardH / 2 + 34,
      height - (height < 620 ? 124 : 146),
    );
    const lobbyStatusY = lobbyCardsY - lobbyCardH / 2 - 20;
    const lobbyPanelW = width - outerPad * 2;

    return {
      cell,
      gridPx,
      gridLeft,
      gridTop,
      hudTop,
      controlsY,
      hintY,
      statusY: height - 14,
      lobbyTitleY,
      lobbySubY,
      lobbyPanelX,
      lobbyPanelY,
      lobbyPanelW,
      lobbyPanelH,
      lobbyCardsY,
      lobbyCardW,
      lobbyCardH,
      lobbyCardGap,
      lobbyStatusY,
    };
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    this.load.image(SNAKE_ASSETS.head, "./art/snake-head.webp");
    this.load.image(SNAKE_ASSETS.body, "./art/snake-body-straight.webp");
    this.load.image(SNAKE_ASSETS.tail, "./art/snake-tail.webp");
    this.load.image(SNAKE_ASSETS.food, "./art/food-bounty.webp");
    this.load.image(SNAKE_ASSETS.reward, "./art/reward-trophy.webp");
    this.load.image(SNAKE_ASSETS.target, "./art/target-badge.webp");
    this.load.image(SNAKE_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(SNAKE_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(SNAKE_ASSETS.badges[2], "./art/badge-hard.webp");
  }

  create(): void {
    super.create(); // wires the bridge first

    this.scW = DESIGN_W;
    this.scH = DESIGN_H;
    this.layout = this.computeLayout(DESIGN_W, DESIGN_H);

    this.buildBackground();
    this.buildGrid();
    this.buildHUD();
    this.buildSnakeLayer();
    this.buildFoodLayer();
    this.buildTargetBadge();
    this.buildOverlay();
    this.buildLobby();
    this.buildStatusRow();
    this.fitCameraToHost();

    // Wire input (keyboard + pointer/swipe)
    this.setupInput();

    // Seed from current state
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract implementation ─────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const isDealing  = this.bool("isDealing");
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

      if (statusChanged && gameStatus === "solved") {
        this.sfx.play("win");
      }

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
    this.foodSprite.setVisible(inPlay);
    this.hudGfx.setVisible(inPlay);
    this.timerLabel.setVisible(inPlay);
    this.lengthLabel.setVisible(inPlay);
    this.controlsHint.setVisible(inPlay);
    this.targetBadge.setVisible(inPlay);
    this.hintLabel.setVisible(inPlay);
    this.statusLabel.setVisible(inPlay);

    if (inPlay) {
      this.updateHUD();
      this.drawSnake();
      this.drawFood();
    }

    // ── Overlay ───────────────────────────────────────────────────────────
    if (isDealing || (gameStatus === "committed" && !inPlay)) {
      this.showOverlay("Dealing", "Preparing your game");
    } else if (isSubmitting) {
      this.showOverlay("Submitting", "Verifying your solution");
    } else if (this.crashed && gameStatus === "dealt") {
      this.showOverlay("Game Over", "The snake crashed.", {
        label: "Settle Run",
        onPress: () => this.dispatch("submitSolution"),
      });
    } else if (this.targetReached && gameStatus === "dealt") {
      const canSubmit = this.canSubmitTarget();
      this.showOverlay("Target Reached", this.submitGateMessage(canSubmit), {
        label: canSubmit ? "Submit Win" : "Waiting",
        disabled: !canSubmit,
        onPress: () => this.dispatch("submitSolution"),
      });
    } else if (gameStatus === "solved") {
      this.showOverlay("Solved", "Congratulations, you won.");
    } else if (gameStatus === "expired") {
      this.showOverlay("Expired", "Time ran out.");
    } else {
      this.overlayContainer.setVisible(false);
    }

    // ── Lobby card highlights ──────────────────────────────────────────────
    if (!inPlay) {
      this.ensureSelectableDifficulty();
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
    this.sfx.play("start");
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

    const prevEaten = this.snake.eaten;
    const dir = this.queuedDir ?? this.localDir;
    this.snake = step(this.snake, dir);
    this.localDir = dir;
    this.queuedDir = null;

    if (this.snake.dead) {
      this.crashed = true;
      this.sfx.play("lose");
      this.stopTickTimer();
      this.onStateUpdate(this.state);
      return;
    }

    const rule = ruleOf(this.num("gameDifficulty", 0));
    if (hasReachedTarget(this.snake, rule.targetLength)) {
      this.targetReached = true;
      this.sfx.play("combo");
      this.stopTickTimer();
      this.onStateUpdate(this.state);
    } else if (this.snake.eaten > prevEaten) {
      this.sfx.play("score");
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
          if (this.targetReached || this.crashed) {
            this.onStateUpdate(this.state);
          }
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
    this.backgroundGfx = this.add.graphics();
    this.renderResponsiveStage(DESIGN_H, DESIGN_H / 2);
  }

  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.backgroundGfx) return;
    const viewTop = centerY - visibleWorldH / 2;
    const viewBottom = centerY + visibleWorldH / 2;
    const stageTop = Math.min(0, viewTop - 10);
    const stageBottom = Math.max(DESIGN_H, Math.min(viewBottom + 10, DESIGN_H + 170));
    const stageHeight = stageBottom - stageTop;
    const gfx = this.backgroundGfx;
    gfx.clear();
    // Full canvas fill — warm deep green felt
    gfx.fillStyle(C.felt);
    gfx.fillRect(0, stageTop, this.scW, stageHeight);
    if (stageBottom > DESIGN_H + 20) {
      const trailTop = DESIGN_H - 8;
      const trailHeight = stageBottom - trailTop - 8;
      gfx.fillStyle(0x2f6f50, 0.82);
      gfx.fillRoundedRect(16, trailTop, this.scW - 32, trailHeight, {
        tl: 20,
        tr: 20,
        bl: 0,
        br: 0,
      });
      gfx.lineStyle(1, 0x79cfa4, 0.26);
      for (let x = 42; x < this.scW - 16; x += 44) {
        gfx.lineBetween(x, trailTop + 28, x + 22, stageBottom - 28);
      }
      gfx.fillStyle(C.gold, 0.46);
      gfx.fillCircle(this.scW * 0.5, trailTop + 58, 4);
      gfx.fillCircle(this.scW * 0.72, trailTop + 92, 3);
    }
    // Subtle inner rim for depth
    gfx.lineStyle(3, C.feltBorder, 0.6);
    gfx.strokeRoundedRect(6, 6, this.scW - 12, stageBottom - 12, 14);
  }

  // ── Build: grid ───────────────────────────────────────────────────────────

  private buildGrid(): void {
    this.gridGraphics = this.add.graphics();
    const gfx = this.gridGraphics;
    const { cell, gridLeft, gridTop, gridPx } = this.layout;

    // Grid background — lighter green
    gfx.fillStyle(C.feltInner, 1);
    gfx.fillRoundedRect(gridLeft - 2, gridTop - 2, gridPx + 4, gridPx + 4, 10);

    // Alternating cell checker pattern
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const even = (row + col) % 2 === 0;
        gfx.fillStyle(even ? C.feltAlt : C.felt, 1);
        gfx.fillRect(
          gridLeft + col * cell,
          gridTop  + row * cell,
          cell,
          cell,
        );
      }
    }

    // Grid border
    gfx.lineStyle(2, C.feltBorder, 0.8);
    gfx.strokeRoundedRect(gridLeft - 2, gridTop - 2, gridPx + 4, gridPx + 4, 10);

    this.gridGraphics.setVisible(false);
  }

  // ── Build: HUD ────────────────────────────────────────────────────────────

  private buildHUD(): void {
    this.hudGfx = this.add.graphics();
    const { gridLeft, gridPx, hudTop } = this.layout;
    // HUD panel background
    this.hudGfx.fillStyle(C.hudBg, 0.9);
    this.hudGfx.fillRoundedRect(gridLeft, hudTop, gridPx, 60, 8);
    this.hudGfx.setVisible(false);

    // Timer bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, gridPx - 16, 10, 5);

    // Length bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, gridPx - 16, 8, 4);

    // Timer clock label
    this.timerLabel = this.add.text(gridLeft + 10, hudTop + 46, "00:00", {
      fontSize: "12px",
      color: "#5af5d0",
      fontStyle: "bold",
    }).setOrigin(0, 0.5).setVisible(false);

    // Length label
    this.lengthLabel = this.add.text(gridLeft + gridPx / 2, hudTop + 46, "0 / 10 cells", {
      fontSize: "12px",
      color: "#ffcf68",
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
    this.foodSprite = this.add.image(0, 0, SNAKE_ASSETS.food)
      .setDisplaySize(this.layout.cell + 8, this.layout.cell + 8)
      .setVisible(false);
  }

  // ── Build: target badge ──────────────────────────────────────────────────

  private buildTargetBadge(): void {
    this.targetBadge = this.add.text(
      this.layout.gridLeft + this.layout.gridPx - 8,
      this.layout.hudTop + 46,
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
      this.layout.controlsY,
      "Arrow keys / WASD / Swipe",
      {
        fontSize: "11px",
	        color: "#c7f9d4",
      },
    ).setOrigin(0.5).setVisible(false);

    this.hintLabel = this.add.text(
      this.scW / 2,
      this.layout.hintY,
      "",
      {
        fontSize: "11px",
	        color: "#ffd166",
        fontStyle: "bold",
        wordWrap: { width: this.layout.gridPx },
      },
    ).setOrigin(0.5).setVisible(false);

    this.statusLabel = this.add.text(
      this.scW / 2,
      this.layout.statusY,
      "",
      {
        fontSize: "10px",
	        color: "#c7f9d4",
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
	      color: "#d4f9df",
    }).setOrigin(0.5);

    this.overlayBtnBg = this.add.rectangle(0, 44, 140, 32, C.gold)
      .setStrokeStyle(1, C.goldLight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayBtnTxt = this.add.text(0, 44, "Play Again", {
      fontSize: "13px",
      color: "#1a3a2b",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.overlayBtnBg.on("pointerdown", () => {
      this.sfx.unlock();
      if (this.overlayAction) this.sfx.play("tap");
      this.overlayAction?.();
    });
    this.overlayBtn = this.add.container(0, 0, [this.overlayBtnBg, this.overlayBtnTxt]);

    this.overlayContainer.add([
      this.overlayBg,
      this.overlayTitle,
      this.overlaySub,
      this.overlayBtn,
    ]);
    this.overlayContainer.setVisible(false);
  }

  private showOverlay(
    title: string,
    sub: string,
    button?: { label: string; disabled?: boolean; onPress: () => void },
  ): void {
    this.overlayTitle.setText(title);
    this.overlaySub.setText(sub);
    this.overlayAction = button && !button.disabled ? button.onPress : null;
    this.overlayBtn.setVisible(Boolean(button));
    if (button) {
      this.overlayBtnTxt.setText(button.label);
      this.overlayBtnBg
        .setFillStyle(button.disabled ? 0x627268 : C.gold)
        .setStrokeStyle(1, button.disabled ? 0x87938b : C.goldLight);
      if (this.overlayBtnBg.input) this.overlayBtnBg.input.enabled = !button.disabled;
      this.overlayBtn.setAlpha(button.disabled ? 0.68 : 1);
    }
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
    const layout = this.layout;
    const panelMidY = layout.lobbyPanelY + layout.lobbyPanelH / 2;

    const titleMark = this.add.image(this.scW / 2 - 96, layout.lobbyTitleY, SNAKE_ASSETS.head)
      .setDisplaySize(40, 40);

    const title = this.add.text(this.scW / 2 + 12, layout.lobbyTitleY, "Snake Bounty", {
      fontSize: "20px",
      fontStyle: "bold",
	      color: "#ffcf68",
    }).setOrigin(0.5);

    const sub = this.add.text(this.scW / 2, layout.lobbySubY, "Grow the snake to win GAS", {
      fontSize: "12px",
	      color: "#c7f9d4",
    }).setOrigin(0.5);

    // Arena preview panel
    const arenaGfx = this.add.graphics();
    arenaGfx.fillStyle(C.cardBg, 1);
    arenaGfx.fillRoundedRect(
      layout.lobbyPanelX,
      layout.lobbyPanelY,
      layout.lobbyPanelW,
      layout.lobbyPanelH,
      12,
    );
    arenaGfx.lineStyle(1, C.cardBorder, 0.7);
    arenaGfx.strokeRoundedRect(
      layout.lobbyPanelX,
      layout.lobbyPanelY,
      layout.lobbyPanelW,
      layout.lobbyPanelH,
      12,
    );

    // Mini snake preview (decorative)
    const preview = this.buildMiniSnakePreview();
    const trail = this.buildBountyTrail();

    // Labels inside arena
    const arenaTitle = this.add.text(layout.lobbyPanelX + 18, panelMidY - 54, "How to Play", {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffe066",
    });
    const arenaCopy = this.add.text(layout.lobbyPanelX + 18, panelMidY - 28, [
      "• Navigate the snake to eat food",
      "• Grow to the target length",
      "• Don't hit walls or yourself",
      "• Submit before time runs out",
    ].join("\n"), {
      fontSize: "11px",
	      color: "#d4f9df",
      lineSpacing: 5,
      wordWrap: { width: Math.max(220, layout.lobbyPanelW - 36) },
    });

    // Difficulty cards row
    const cardsY = layout.lobbyCardsY;
    const cardW  = layout.lobbyCardW;
    const cardH  = layout.lobbyCardH;
    const gap    = layout.lobbyCardGap;
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
    const poolText = this.add.text(this.scW / 2, layout.lobbyStatusY, "", {
      fontSize: "11px",
	      color: "#ffd166",
    }).setOrigin(0.5);
    this.lobbyStatusText = poolText;

    this.lobbyContainer.add([
      titleMark,
      title,
      sub,
      arenaGfx,
      preview,
      trail,
      arenaTitle,
      arenaCopy,
      ...this.lobbyCards,
      poolText,
    ]);
  }

  private buildMiniSnakePreview(): Phaser.GameObjects.Container {
    const preview = this.add.container(0, 0);
    const { lobbyPanelX, lobbyPanelY, lobbyPanelW, lobbyPanelH } = this.layout;
    const right = lobbyPanelX + lobbyPanelW - 52;
    const midY = lobbyPanelY + Math.min(lobbyPanelH - 72, Math.max(78, lobbyPanelH * 0.48));
    const foodY = lobbyPanelY + lobbyPanelH - 42;
    const pieces: Array<{
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      angle?: number;
    }> = [
      { key: SNAKE_ASSETS.tail, x: right - 86, y: midY, width: 30, height: 22, angle: 180 },
      { key: SNAKE_ASSETS.body, x: right - 58, y: midY, width: 34, height: 22 },
      { key: SNAKE_ASSETS.body, x: right - 30, y: midY, width: 34, height: 22 },
      { key: SNAKE_ASSETS.head, x: right + 2, y: midY - 4, width: 42, height: 42 },
      { key: SNAKE_ASSETS.food, x: right + 22, y: foodY, width: 28, height: 28 },
    ];

    for (const piece of pieces) {
      preview.add(
        this.add.image(piece.x, piece.y, piece.key)
          .setDisplaySize(piece.width, piece.height)
          .setAngle(piece.angle ?? 0),
      );
    }

    return preview;
  }

  private buildBountyTrail(): Phaser.GameObjects.Graphics {
    const gfx = this.add.graphics();
    const {
      lobbyPanelY,
      lobbyPanelH,
      lobbyCardsY,
      lobbyCardH,
      lobbyStatusY,
    } = this.layout;
    const startY = lobbyPanelY + lobbyPanelH + 18;
    const endY = Math.min(lobbyStatusY - 20, lobbyCardsY - lobbyCardH / 2 - 28);
    if (endY <= startY) return gfx;

    const points = 8;
    gfx.lineStyle(2, C.cardBorder, 0.26);
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const x = this.scW / 2 + Math.sin(progress * Math.PI * 2) * 44;
      const y = startY + (endY - startY) * progress;
      gfx.fillStyle(i === points - 1 ? C.gold : C.cardBorder, i === points - 1 ? 0.46 : 0.32);
      gfx.fillCircle(x, y, i === points - 1 ? 5 : 3);
      if (i > 0) {
        const prev = (i - 1) / (points - 1);
        const px = this.scW / 2 + Math.sin(prev * Math.PI * 2) * 44;
        const py = startY + (endY - startY) * prev;
        gfx.beginPath();
        gfx.moveTo(px, py);
        gfx.lineTo(x, y);
        gfx.strokePath();
      }
    }
    return gfx;
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

    const badge = this.add.image(0, -28, SNAKE_ASSETS.badges[difficulty])
      .setDisplaySize(42, 42);

    const label = this.add.text(0, -6, DIFF_LABELS[difficulty], {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffcf68",
    }).setOrigin(0.5);

    const targetTxt = this.add.text(0, 12, `${rule.targetLength} cells`, {
      fontSize: "11px",
      color: "#d4f9df",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(0, 28, `${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "10px",
      color: "#66ffe0",
    }).setOrigin(0.5);

    const lockTxt = this.add.text(0, 42, "Cleared", {
      fontSize: "10px",
      color: "#f9d27a",
      fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);

    container.add([bg, badge, label, targetTxt, entryTxt, lockTxt]);
    container.setData("difficulty", difficulty);

    bg.on("pointerdown", () => {
      this.sfx.unlock();
      if (this.isDifficultyLocked(difficulty)) return;
      this.sfx.play("tap");
      this.pickedDifficulty = difficulty;
      this.dispatch("selectDifficulty", { difficulty });
      this.updateLobbyCards();
      this.tweens.add({
        targets: container,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 80,
        yoyo: true,
      });
      if (this.canStartDifficulty(difficulty)) {
        this.dispatch("startGame", { difficulty });
      }
    });
    bg.on("pointerover", () => {
      if (!this.isDifficultyLocked(difficulty) && difficulty !== this.pickedDifficulty) {
        bg.setStrokeStyle(2, C.muted);
      }
    });
    bg.on("pointerout", () => {
      this.updateLobbyCards();
    });

    return container;
  }

  private updateLobbyCards(): void {
    this.ensureSelectableDifficulty();
    for (let i = 0; i < this.lobbyCards.length; i++) {
      const card     = this.lobbyCards[i]!;
      const bg       = card.list[0] as Phaser.GameObjects.Rectangle;
      const label    = card.list[2] as Phaser.GameObjects.Text;
      const target   = card.list[3] as Phaser.GameObjects.Text;
      const entry    = card.list[4] as Phaser.GameObjects.Text;
      const lock     = card.list[5] as Phaser.GameObjects.Text;
      const locked   = this.isDifficultyLocked(i as Difficulty);
      const isActive = i === this.pickedDifficulty;
      bg.setFillStyle(locked ? 0x183226 : isActive ? C.cardActiveBg : C.cardBg);
      bg.setStrokeStyle(2, locked ? 0x425846 : isActive ? C.cardActive : C.cardBorder);
      label.setColor(locked ? "#9fb7a6" : "#ffcf68");
      target.setColor(locked ? "#8aa493" : "#d4f9df");
      entry.setText(locked ? "Completed" : `${gasDisplay(ruleOf(i as Difficulty).entryFixed8)} GAS`);
      entry.setColor(locked ? "#9fb7a6" : "#66ffe0");
      lock.setVisible(locked);
      card.setAlpha(locked ? 0.58 : 1);
      if (bg.input) bg.input.enabled = !locked;
    }
    // Update pool text
    const poolFree = this.num("poolFree", 0);
    const rule     = ruleOf(this.pickedDifficulty);
    const needed   = Number(gasDisplay(rule.rewardFixed8));
    const progressionReady = this.bool("progressionReady");
    const locked   = this.isDifficultyLocked(this.pickedDifficulty);
    const walletConnected = this.bool("walletConnected");
    const busy     = this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting");
    const ready    = this.canStartDifficulty(this.pickedDifficulty);
    if (this.lobbyStatusText) {
      const reward  = gasDisplay(rule.rewardFixed8);
      const time    = Math.round(rule.limitMs / 60000);
      const statusText = busy
        ? "Preparing your bounty route"
        : !walletConnected
          ? "Connect wallet to start a bounty route"
          : !progressionReady
        ? "Checking account route history"
        : locked
          ? `Route cleared. Play ${this.routeName(this.requiredDifficulty())} next.`
          : ready
            ? `Tap a route to start  ·  Win: ${reward} GAS  ·  ${time} min`
            : `Pool low (${poolFree.toFixed(2)} / ${needed} GAS reward needed)`;
      this.lobbyStatusText.setText(statusText);
      this.lobbyStatusText.setColor(ready ? "#d4f9df" : "#ffd166");
    }
  }

  private requiredDifficulty(): Difficulty {
    return Math.max(0, Math.min(2, this.num("progressionRequiredDifficulty", 0))) as Difficulty;
  }

  private routeName(difficulty: Difficulty): string {
    return DIFF_LABELS[difficulty] ?? "next route";
  }

  private isDifficultyLocked(difficulty: Difficulty): boolean {
    return this.bool("progressionReady") && difficulty < this.requiredDifficulty();
  }

  private ensureSelectableDifficulty(): void {
    if (this.isDifficultyLocked(this.pickedDifficulty)) {
      this.pickedDifficulty = this.requiredDifficulty();
    }
  }

  private canStartDifficulty(difficulty: Difficulty): boolean {
    if (this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting")) return false;
    if (!this.bool("walletConnected")) return false;
    if (!this.bool("progressionReady")) return false;
    if (this.isDifficultyLocked(difficulty)) return false;
    const poolFree = this.num("poolFree", 0);
    const rule = ruleOf(difficulty);
    return poolFree >= Number(gasDisplay(rule.rewardFixed8));
  }

  private canSubmitTarget(): boolean {
    if (!this.targetReached || this.str("gameStatus", "") !== "dealt") return false;
    if (this.bool("isSubmitting")) return false;
    const deadline = this.num("deadline", 0);
    const dealtAt = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : Number.POSITIVE_INFINITY;
    if (remainingMs <= SUBMIT_BUFFER_MS) return false;
    if (dealtAt <= 0) return true;
    return this.nowMs - dealtAt >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  }

  private submitGateMessage(canSubmit: boolean): string {
    if (canSubmit) return "Submit for GAS before time runs out.";
    const deadline = this.num("deadline", 0);
    const dealtAt = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : Number.POSITIVE_INFINITY;
    if (remainingMs <= SUBMIT_BUFFER_MS) return "Too close to the deadline.";
    if (dealtAt <= 0) return "Settlement unlock is being checked.";
    const waitMs = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - (this.nowMs - dealtAt);
    return `Settlement unlocks in ${formatClock(waitMs)}.`;
  }

  // ── Draw: snake ───────────────────────────────────────────────────────────

  private drawSnake(): void {
    if (!this.snake) return;
    const gfx = this.snakeGfx;
    const { cell, gridLeft, gridTop } = this.layout;
    gfx.clear();

    const body = this.snake.body;
    const len  = body.length;

    for (let i = len - 1; i >= 0; i--) {
      const seg = body[i]!;
      const px  = gridLeft + seg.x * cell;
      const py  = gridTop  + seg.y * cell;

      if (i === 0) {
        // Head — teal rounded rectangle, slightly larger
        const crashed = this.crashed || this.snake.dead;
        gfx.fillStyle(crashed ? C.lose : C.head, 1);
        gfx.fillRoundedRect(px + 1, py + 1, cell - 2, cell - 2, 5);
        gfx.lineStyle(1.5, crashed ? 0xf97066 : C.headStroke, 0.8);
        gfx.strokeRoundedRect(px + 1, py + 1, cell - 2, cell - 2, 5);
        // Eyes
        this.drawSnakeEyes(gfx, px, py);
      } else if (i === len - 1 && len > 1) {
        // Tail — smaller, lighter
        const alpha = this.crashed ? 0.4 : 0.8;
        gfx.fillStyle(C.tail, alpha);
        gfx.fillRoundedRect(px + 4, py + 4, cell - 8, cell - 8, 3);
      } else {
        // Body — jade squares with stroke
        const alpha = this.crashed ? 0.5 : 1;
        gfx.fillStyle(C.body, alpha);
        gfx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        gfx.lineStyle(1, C.bodyDark, 0.4);
        gfx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
      }
    }
  }

  private drawSnakeEyes(
    gfx: Phaser.GameObjects.Graphics,
    px: number,
    py: number,
  ): void {
    // Draw two small white dots on the head, rotated toward direction
    const dir    = this.localDir;
    // Eye offsets relative to cell center — rotated by direction
    type Offset = { ex1: number; ey1: number; ex2: number; ey2: number };
    const eye = Math.max(1, Math.round(this.layout.cell / 10));
    const offsets: Record<Direction, Offset> = {
      0: { ex1: -4, ey1: -2, ex2:  4, ey2: -2 }, // up
      1: { ex1:  2, ey1: -4, ex2:  2, ey2:  4 }, // right
      2: { ex1: -4, ey1:  2, ex2:  4, ey2:  2 }, // down
      3: { ex1: -2, ey1: -4, ex2: -2, ey2:  4 }, // left
    };
    const off = offsets[dir];
    const cx  = px + this.layout.cell / 2;
    const cy  = py + this.layout.cell / 2;
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(cx + off.ex1, cy + off.ey1, eye);
    gfx.fillCircle(cx + off.ex2, cy + off.ey2, eye);
    gfx.fillStyle(0x1a3a2b, 1);
    gfx.fillCircle(cx + off.ex1, cy + off.ey1, Math.max(1, eye - 1));
    gfx.fillCircle(cx + off.ex2, cy + off.ey2, Math.max(1, eye - 1));
  }

  // ── Draw: food ────────────────────────────────────────────────────────────

  private drawFood(): void {
    if (!this.snake) return;
    const gfx   = this.foodGfx;
    const food  = this.snake.food;
    const { cell, gridLeft, gridTop } = this.layout;
    const scale = 1 + this.foodPulse * 0.18;
    const px    = gridLeft + food.x * cell + cell / 2;
    const py    = gridTop  + food.y * cell + cell / 2;
    const r     = (cell / 2 - 1) * scale;
    gfx.clear();
    // Outer glow
    gfx.fillStyle(C.goldLight, 0.25 + this.foodPulse * 0.15);
    gfx.fillCircle(px, py, r + 3);
    this.foodSprite
      .setPosition(px, py)
      .setDisplaySize((cell + 8) * scale, (cell + 8) * scale)
      .setVisible(true);
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
    const { gridLeft, gridPx, hudTop } = this.layout;
    hudGfx.clear();
    // Panel
    hudGfx.fillStyle(C.hudBg, 0.9);
    hudGfx.fillRoundedRect(gridLeft, hudTop, gridPx, 60, 8);
    // Timer bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, gridPx - 16, 10, 5);
    // Timer bar fill
    if (timePct > 0) {
      const fillW = Math.max(4, (gridPx - 16) * timePct);
      hudGfx.fillStyle(isLow ? C.timerLow : C.timerFill, 1);
      hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, fillW, 10, 5);
    }
    // Length bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, gridPx - 16, 8, 4);
    // Length bar fill
    if (lengthPct > 0) {
      const fillW = Math.max(4, (gridPx - 16) * lengthPct);
      hudGfx.fillStyle(this.targetReached ? C.win : C.lengthFill, 1);
      hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, fillW, 8, 4);
    }

    // Timer label
    this.timerLabel.setText(formatClock(Math.max(0, remainingMs)));
    this.timerLabel.setColor(isLow ? "#ffd166" : "#66ffe0");

    // Length label
    this.lengthLabel.setText(`${currentLen} / ${rule.targetLength} cells`);
    this.lengthLabel.setColor(this.targetReached ? "#66ffe0" : "#ffcf68");

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
        this.sfx.unlock();
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
      this.sfx.unlock();
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

    // Short cue only on an actual direction change (not repeats of the current heading)
    if (dir !== (this.queuedDir ?? this.localDir)) {
      this.sfx.play("move");
    }
    this.queuedDir = dir;
    this.dispatch("recordMove", { dir });
  }

  // ── Responsive resize ─────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.42;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
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
