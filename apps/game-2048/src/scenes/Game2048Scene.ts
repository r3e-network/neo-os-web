/**
 * Game2048Scene — Phaser 3 scene for the 2048 Rush miniapp.
 *
 * Renders a 4×4 tile grid with slide/merge animations, a lobby with
 * 3 difficulty cards, score display, and swipe + keyboard input.
 *
 * State received from React (via GameBridge):
 *   gameStatus:     "idle"|"committed"|"dealt"|"solved"|"expired"
 *   runBoard:       number[] (flat 16-element exponent array, 0=empty)
 *   runMoveCount:   number
 *   runMaxExp:      number  (highest tile exponent on the board)
 *   isStarting:     boolean
 *   isDealing:      boolean
 *   isSubmitting:   boolean
 *   isMoving:       boolean
 *   gameDifficulty: number  (0=sprint, 1=climb, 2=summit)
 *
 * Actions dispatched to React:
 *   "startGame"  { difficulty: number }
 *   "playMove"   { dir: 0|1|2|3 }     (0=up, 1=right, 2=down, 3=left)
 *   "useUndo"    {}
 *   "submitRun"  {}
 *   "expireGame" {}
 */

import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";
import { tileValue } from "../logic/engine-2048";
import { DIFFICULTY_RULES, gasDisplay } from "../logic/game-rules";

// ── Canvas dimensions ──────────────────────────────────────────────────────────
const CW = 400;
const CH = 580;

// ── Grid geometry ──────────────────────────────────────────────────────────────
const GRID_COLS   = 4;
const GRID_GAP    = 8;
const GRID_PAD    = 16;          // outer padding on each side
const GRID_LEFT   = GRID_PAD;
const GRID_TOP    = 130;
const GRID_W      = CW - GRID_PAD * 2;  // 368
const CELL_SIZE   = (GRID_W - GRID_GAP * (GRID_COLS + 1)) / GRID_COLS; // ~76
const CORNER_R    = 6;           // rounded corner radius for tiles

// ── Colors ─────────────────────────────────────────────────────────────────────
const C = {
  bg:         0xfaf9f7,
  gridBg:     0xbbada0,
  cellEmpty:  0xe2d4b4,
  white:      0xffffff,
  gold:       0xedc22e,
  scoreText:  "#776e65",
  headerText: "#35322e",
};

interface TileColors { bg: number; text: string }

/** Tile colour keyed by exponent value (1 = tile "2", 2 = tile "4", …). */
const TILE_PALETTE: TileColors[] = [
  { bg: 0xe2d4b4, text: "#776e65" }, // 0  – empty placeholder
  { bg: 0xeee4da, text: "#776e65" }, // 1  – 2     light tan
  { bg: 0xede0c8, text: "#776e65" }, // 2  – 4     wheat
  { bg: 0xf2b179, text: "#f9f6f2" }, // 3  – 8     orange
  { bg: 0xf59563, text: "#f9f6f2" }, // 4  – 16    red-orange
  { bg: 0xf67c5f, text: "#f9f6f2" }, // 5  – 32    red
  { bg: 0xf65e3b, text: "#f9f6f2" }, // 6  – 64    dark orange
  { bg: 0x7c5cbf, text: "#f9f6f2" }, // 7  – 128   purple
  { bg: 0x6c55c4, text: "#f9f6f2" }, // 8  – 256   deeper purple
  { bg: 0x5a4dcf, text: "#f9f6f2" }, // 9  – 512   purple-blue
  { bg: 0x4a6bdb, text: "#f9f6f2" }, // 10 – 1024  blue
  { bg: 0x3a7ce0, text: "#f9f6f2" }, // 11 – 2048  bright blue
];

function tileColors(exp: number): TileColors {
  if (exp <= 0) return TILE_PALETTE[0]!;
  if (exp < TILE_PALETTE.length) return TILE_PALETTE[exp]!;
  return { bg: 0x2a5daa, text: "#f9f6f2" }; // super tiles: deep blue
}

// ── Tile font size by exponent ─────────────────────────────────────────────────
function tileFontSize(exp: number): string {
  const v = tileValue(exp);
  if (v >= 1000) return "20px";
  if (v >= 100)  return "26px";
  return "32px";
}

// ── Cell index ↔ pixel position ────────────────────────────────────────────────
function cellXY(idx: number): { x: number; y: number } {
  const col = idx % GRID_COLS;
  const row = Math.floor(idx / GRID_COLS);
  return {
    x: GRID_LEFT + GRID_GAP + col * (CELL_SIZE + GRID_GAP) + CELL_SIZE / 2,
    y: GRID_TOP  + GRID_GAP + row * (CELL_SIZE + GRID_GAP) + CELL_SIZE / 2,
  };
}

// ── Swipe threshold ────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 30;

// ── Difficulty card layout ─────────────────────────────────────────────────────
const CARD_W = 340;
const CARD_H = 80;

// ── Scene ──────────────────────────────────────────────────────────────────────

export class Game2048Scene extends BaseScene {
  // ── Scene objects ────────────────────────────────────────────────────────────
  private cellBgs:     Phaser.GameObjects.Graphics[] = [];
  private tileConts:   (Phaser.GameObjects.Container | null)[] = Array(16).fill(null);

  private scoreLabel!: Phaser.GameObjects.Text;
  private bestLabel!:  Phaser.GameObjects.Text;
  private movesLabel!: Phaser.GameObjects.Text;
  private statusLabel!:Phaser.GameObjects.Text;

  private gridContainer!:  Phaser.GameObjects.Container;
  private lobbyContainer!: Phaser.GameObjects.Container;
  private dealingContainer!: Phaser.GameObjects.Container;
  private celebContainer!: Phaser.GameObjects.Container;

  private diffCards: Phaser.GameObjects.Container[] = [];
  private startBtn!: Phaser.GameObjects.Container;

  // ── Input state ───────────────────────────────────────────────────────────────
  private swipeStart: { x: number; y: number } | null = null;
  private lastDir = -1;

  // ── Game state mirror ─────────────────────────────────────────────────────────
  private prevBoard:     number[] = Array(16).fill(0);
  private curBoard:      number[] = Array(16).fill(0);
  private pickedDiff     = 0;
  private prevStatus     = "";
  private prevIsMoving   = false;
  private shown2048      = false;

  constructor() {
    super("Game2048Scene");
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────────

  preload(): void {
    // Art tiles are optional – only load if they exist; missing ones fall back
    // to the coloured tile backgrounds. We attempt to load all 12 art levels.
    for (let e = 1; e <= 12; e++) {
      this.load.image(`tile-e${e}`, `./art/tile-e${e}.webp`);
    }
  }

  create(): void {
    super.create();

    this.buildBackground();
    this.buildScoreArea();
    this.buildGridContainer();
    this.buildLobbyContainer();
    this.buildDealingContainer();
    this.buildCelebration();
    this.buildStatusLabel();
    this.setupInput();

    // Initial render from bridge state (may already be populated)
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract ────────────────────────────────────────────────────────

  protected onStateUpdate(state: GameState): void {
    const status      = this.str("gameStatus", "idle");
    const board       = (this.val<number[]>("runBoard") ?? []).slice();
    const moveCount   = this.num("runMoveCount", 0);
    const maxExp      = this.num("runMaxExp", 0);
    const isMoving    = this.bool("isMoving");
    const isDealing   = this.bool("isDealing");
    const isStarting  = this.bool("isStarting");
    const diff        = this.num("gameDifficulty", 0);
    const lastStatus  = this.str("lastStatus", "");

    // ── Phase transitions ──────────────────────────────────────────────────────
    const statusChanged = status !== this.prevStatus;

    if (statusChanged) {
      this.prevStatus = status;
      const isLobby    = status === "idle" || status === "solved" || status === "expired";
      const isPlaying  = status === "dealt";
      const isDealt    = status === "committed" || (status === "dealt" && board.length < 16);

      this.gridContainer.setVisible(isPlaying && board.length === 16);
      this.lobbyContainer.setVisible(isLobby);
      this.dealingContainer.setVisible(status === "committed" || (isDealing && !isPlaying));

      if (isLobby) {
        this.shown2048 = false;
        this.celebContainer.setVisible(false);
        this.highlightDiffCard(this.pickedDiff);
        this.updateStartBtn(isStarting);
      }
    }

    // ── Score area ─────────────────────────────────────────────────────────────
    this.scoreLabel.setText(`${moveCount}`);
    this.bestLabel.setText(maxExp > 0 ? `${tileValue(maxExp)}` : "–");
    this.movesLabel.setText(`Moves: ${moveCount}`);
    this.statusLabel.setText(lastStatus);

    // ── Lobby buttons ──────────────────────────────────────────────────────────
    if (status === "idle" || status === "solved" || status === "expired") {
      this.updateStartBtn(isStarting);
    }

    // ── Board transitions ──────────────────────────────────────────────────────
    if (status === "dealt" && board.length === 16) {
      this.gridContainer.setVisible(true);
      this.dealingContainer.setVisible(false);

      const boardChanged = board.some((v, i) => v !== this.curBoard[i]);

      if (boardChanged) {
        // isMoving just settled: animate new state
        if (!isMoving && this.prevIsMoving) {
          this.animateBoardTransition(this.curBoard, board);
        } else if (!isMoving) {
          // Initial board or undo snap — render immediately
          this.renderBoardImmediate(board);
        }
        this.curBoard = board.slice();
      }
    }

    // ── Slide preview while moving ─────────────────────────────────────────────
    if (isMoving && !this.prevIsMoving && this.lastDir >= 0) {
      this.playSlideHint(this.lastDir);
    }

    this.prevIsMoving = isMoving;

    // ── 2048 celebration ───────────────────────────────────────────────────────
    if (!this.shown2048 && maxExp >= 11 && status === "dealt") {
      this.shown2048 = true;
      this.playCelebration();
    }
  }

  // ── Background ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    this.add.rectangle(CW / 2, CH / 2, CW, CH, C.bg);
  }

  // ── Score area ────────────────────────────────────────────────────────────────

  private buildScoreArea(): void {
    // Title
    this.add.text(20, 16, "2048", {
      fontSize: "36px",
      fontStyle: "bold",
      color: C.headerText,
    });

    // Score box
    const scoreBox = this.add.container(CW - 80, 20);
    const scoreBg = this.add.rectangle(0, 0, 70, 52, 0xbbada0).setOrigin(0.5);
    const scoreCaption = this.add.text(0, -10, "SCORE", {
      fontSize: "10px",
      color: "#f9f6f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.scoreLabel = this.add.text(0, 8, "0", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    scoreBox.add([scoreBg, scoreCaption, this.scoreLabel]);

    // Best tile box
    const bestBox = this.add.container(CW - 150, 20);
    const bestBg = this.add.rectangle(0, 0, 60, 52, 0xbbada0).setOrigin(0.5);
    const bestCaption = this.add.text(0, -10, "BEST", {
      fontSize: "10px",
      color: "#f9f6f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.bestLabel = this.add.text(0, 8, "–", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    bestBox.add([bestBg, bestCaption, this.bestLabel]);

    // Moves label (smaller, below title)
    this.movesLabel = this.add.text(20, 56, "Moves: 0", {
      fontSize: "12px",
      color: C.scoreText,
    });
  }

  // ── Grid container ────────────────────────────────────────────────────────────

  private buildGridContainer(): void {
    this.gridContainer = this.add.container(0, 0);

    // Grid background
    const gridBg = this.add.graphics();
    const gridH = GRID_GAP + GRID_COLS * (CELL_SIZE + GRID_GAP);
    gridBg.fillStyle(C.gridBg);
    gridBg.fillRoundedRect(GRID_LEFT, GRID_TOP, GRID_W, gridH, 6);
    this.gridContainer.add(gridBg);

    // Empty cell backgrounds
    for (let i = 0; i < 16; i++) {
      const { x, y } = cellXY(i);
      const g = this.add.graphics();
      g.fillStyle(C.cellEmpty);
      g.fillRoundedRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, CORNER_R);
      this.cellBgs.push(g);
      this.gridContainer.add(g);
    }

    // Controls hint
    const hint = this.add.text(CW / 2, GRID_TOP + GRID_COLS * (CELL_SIZE + GRID_GAP) + GRID_GAP + 14, "← → ↑ ↓  or swipe", {
      fontSize: "12px",
      color: "#9a8f82",
    }).setOrigin(0.5);
    this.gridContainer.add(hint);

    this.gridContainer.setVisible(false);
  }

  // ── Lobby container ───────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    this.lobbyContainer = this.add.container(0, 0);

    // Header copy
    const heading = this.add.text(CW / 2, 90, "Choose Difficulty", {
      fontSize: "18px",
      fontStyle: "bold",
      color: C.headerText,
    }).setOrigin(0.5);
    this.lobbyContainer.add(heading);

    // Difficulty cards
    DIFFICULTY_RULES.forEach((rule, idx) => {
      const cardY = 140 + idx * (CARD_H + 12);
      const card = this.buildDiffCard(rule, idx, cardY);
      this.diffCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Start button
    this.startBtn = this.buildStartButton(CW / 2, 420);
    this.lobbyContainer.add(this.startBtn);

    this.lobbyContainer.setVisible(true);
  }

  private buildDiffCard(
    rule: typeof DIFFICULTY_RULES[number],
    idx: number,
    cardY: number,
  ): Phaser.GameObjects.Container {
    const card = this.add.container(CW / 2, cardY);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0xfff8ee)
      .setStrokeStyle(2, 0xbbada0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    bg.on("pointerover", () => bg.setStrokeStyle(3, 0xf2b179));
    bg.on("pointerout",  () => {
      bg.setStrokeStyle(this.pickedDiff === idx ? 3 : 2, this.pickedDiff === idx ? 0xf65e3b : 0xbbada0);
    });
    bg.on("pointerdown", () => {
      this.pickedDiff = idx;
      this.highlightDiffCard(idx);
    });

    const label = this.add.text(-140, -14, ["Sprint", "Climb", "Summit"][idx] ?? "Sprint", {
      fontSize: "16px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0, 0.5);

    const tileTxt = this.add.text(-140, 10, `Reach ${rule.targetTile}`, {
      fontSize: "13px",
      color: "#776e65",
    }).setOrigin(0, 0.5);

    const timeTxt = this.add.text(40, -10, `${Math.round(rule.limitMs / 60000)} min`, {
      fontSize: "13px",
      color: "#776e65",
    }).setOrigin(0.5);

    const rewardTxt = this.add.text(130, -10, `${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#e05000",
    }).setOrigin(1, 0.5);

    const entryTxt = this.add.text(130, 12, `entry: ${gasDisplay(rule.entryFixed8)} GAS`, {
      fontSize: "11px",
      color: "#9a8f82",
    }).setOrigin(1, 0.5);

    card.add([bg, label, tileTxt, timeTxt, rewardTxt, entryTxt]);
    return card;
  }

  private buildStartButton(x: number, y: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 220, 52, 0xf65e3b)
      .setStrokeStyle(2, 0xf2b179)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, "Start Game", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.bindGameButton(bg, {
      targets: btn,
      pressScale: 0.95,
      enabled: () => !this.bool("isStarting") && !this.bool("isDealing"),
      onPress: () => this.dispatch("startGame", { difficulty: this.pickedDiff }),
      onHoverIn: () => bg.setFillStyle(0xe04000),
      onHoverOut: () => bg.setFillStyle(0xf65e3b),
    });

    btn.add([bg, txt]);
    return btn;
  }

  private highlightDiffCard(activeIdx: number): void {
    this.diffCards.forEach((card, idx) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      if (idx === activeIdx) {
        bg.setFillStyle(0xfff0e0);
        bg.setStrokeStyle(3, 0xf65e3b);
      } else {
        bg.setFillStyle(0xfff8ee);
        bg.setStrokeStyle(2, 0xbbada0);
      }
    });
  }

  private updateStartBtn(isStarting: boolean): void {
    const bg  = this.startBtn.list[0] as Phaser.GameObjects.Rectangle;
    const txt = this.startBtn.list[1] as Phaser.GameObjects.Text;
    txt.setText(isStarting ? "Starting…" : "Start Game");
    bg.setFillStyle(isStarting ? 0xbbada0 : 0xf65e3b);
  }

  // ── Dealing container ─────────────────────────────────────────────────────────

  private buildDealingContainer(): void {
    this.dealingContainer = this.add.container(CW / 2, CH / 2);

    const bg = this.add.rectangle(0, 0, 280, 140, 0xfff8ee, 0.95)
      .setStrokeStyle(2, 0xbbada0)
      .setOrigin(0.5);

    const label = this.add.text(0, -28, "Shuffling tiles…", {
      fontSize: "16px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    // Animated dots
    const dots = this.add.text(0, 12, "● ● ●", {
      fontSize: "20px",
      color: "#f2b179",
    }).setOrigin(0.5);

    this.dealingContainer.add([bg, label, dots]);

    // Pulsing animation
    this.tweens.add({
      targets: dots,
      alpha: 0.2,
      duration: 600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.dealingContainer.setVisible(false);
  }

  // ── 2048 celebration ──────────────────────────────────────────────────────────

  private buildCelebration(): void {
    this.celebContainer = this.add.container(CW / 2, CH / 2);

    const overlay = this.add.rectangle(0, 0, CW, CH, 0x000000, 100).setOrigin(0.5);
    overlay.setInteractive(); // capture clicks so they don't bleed through

    const banner = this.add.rectangle(0, -20, 280, 110, 0xedc22e)
      .setStrokeStyle(4, 0xffffff)
      .setOrigin(0.5);

    const titleTxt = this.add.text(0, -44, "2048!", {
      fontSize: "48px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    const subTxt = this.add.text(0, 10, "Keep going or submit!", {
      fontSize: "14px",
      color: "#5a4f45",
    }).setOrigin(0.5);

    const dismissBtn = this.add.text(0, 56, "Tap to continue", {
      fontSize: "13px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.celebContainer.add([overlay, banner, titleTxt, subTxt, dismissBtn]);
    this.celebContainer.setVisible(false);

    overlay.on("pointerdown", () => {
      this.tweens.add({
        targets: this.celebContainer,
        alpha: 0,
        duration: 200,
        onComplete: () => this.celebContainer.setVisible(false).setAlpha(1),
      });
    });
  }

  private playCelebration(): void {
    this.celebContainer.setAlpha(0).setVisible(true);
    this.tweens.add({
      targets: this.celebContainer,
      alpha: 1,
      duration: 300,
      ease: "Sine.easeOut",
    });
  }

  // ── Status label ──────────────────────────────────────────────────────────────

  private buildStatusLabel(): void {
    const gridH = GRID_GAP + GRID_COLS * (CELL_SIZE + GRID_GAP);
    const y = GRID_TOP + gridH + 52;
    this.statusLabel = this.add.text(CW / 2, y, "", {
      fontSize: "12px",
      color: "#9a8f82",
    }).setOrigin(0.5).setDepth(2);
  }

  // ── Tile rendering ────────────────────────────────────────────────────────────

  /**
   * Instantly render every tile from the board — used for initial board draw
   * and undo snaps where no animation is needed.
   */
  private renderBoardImmediate(board: number[]): void {
    // Destroy old tiles
    for (let i = 0; i < 16; i++) {
      this.tileConts[i]?.destroy();
      this.tileConts[i] = null;
    }
    // Spawn each non-empty tile without animation
    for (let i = 0; i < 16; i++) {
      const exp = board[i] ?? 0;
      if (exp > 0) {
        const { x, y } = cellXY(i);
        this.tileConts[i] = this.createTileSprite(exp, x, y);
        this.gridContainer.add(this.tileConts[i]!);
      }
    }
    this.prevBoard = board.slice();
  }

  /**
   * Animate the transition from oldBoard to newBoard:
   *  - slides existing tiles to their new positions
   *  - pops merged tiles
   *  - spawns new tiles with scale-up
   */
  private animateBoardTransition(oldBoard: number[], newBoard: number[]): void {
    const SLIDE_DUR = 120;
    const POP_DUR   = 100;
    const SPAWN_DUR = 130;

    // Identify positions where values appeared (possible spawned tiles)
    // After slides settle, spawn the new tile
    const newTileIndices: number[] = [];
    for (let i = 0; i < 16; i++) {
      const wasEmpty = (oldBoard[i] ?? 0) === 0;
      const nowFilled = (newBoard[i] ?? 0) > 0;
      // Positions that are new non-zero AND old was empty are spawned tiles
      if (wasEmpty && nowFilled) {
        newTileIndices.push(i);
      }
    }

    // Identify merged positions (value increased by 1 exponent in a non-empty→non-empty case)
    const mergedIndices: number[] = [];
    for (let i = 0; i < 16; i++) {
      const old = oldBoard[i] ?? 0;
      const nxt = newBoard[i] ?? 0;
      if (old > 0 && nxt === old + 1) {
        mergedIndices.push(i);
      }
    }

    // Slide existing tiles to new positions
    // Strategy: move all tile containers to match new board layout
    // First, snap all tiles to reflect the new non-spawn values
    const slideTargets: { cont: Phaser.GameObjects.Container; tx: number; ty: number }[] = [];

    // Destroy tiles no longer present, and queue slides for moved tiles
    for (let i = 0; i < 16; i++) {
      const nxt = newBoard[i] ?? 0;
      if (nxt === 0) {
        this.tileConts[i]?.destroy();
        this.tileConts[i] = null;
      }
    }

    // For positions with tiles in newBoard (excluding spawn positions),
    // ensure we have a tile container and slide it into place
    for (let i = 0; i < 16; i++) {
      const exp = newBoard[i] ?? 0;
      if (exp === 0) continue;
      const isSpawned = newTileIndices.includes(i);
      if (isSpawned) continue;

      const { x, y } = cellXY(i);
      if (!this.tileConts[i]) {
        // Create tile immediately at its position
        const cont = this.createTileSprite(exp, x, y);
        this.tileConts[i] = cont;
        this.gridContainer.add(cont);
      } else {
        // Update existing tile's value and slide to new position
        this.updateTileSprite(this.tileConts[i]!, exp);
        slideTargets.push({ cont: this.tileConts[i]!, tx: x, ty: y });
      }
    }

    // Run slide tweens
    if (slideTargets.length > 0 && !this.reducedMotion) {
      for (const { cont, tx, ty } of slideTargets) {
        this.tweens.add({
          targets: cont,
          x: tx,
          y: ty,
          duration: SLIDE_DUR,
          ease: "Quad.easeOut",
        });
      }
    } else {
      for (const { cont, tx, ty } of slideTargets) {
        cont.setPosition(tx, ty);
      }
    }

    // Scale pop for merged tiles (delayed until slide completes)
    const popDelay = this.reducedMotion ? 0 : SLIDE_DUR;
    for (const idx of mergedIndices) {
      const cont = this.tileConts[idx];
      if (!cont) continue;
      if (this.reducedMotion) {
        // no-op
      } else {
        this.tweens.add({
          targets: cont,
          scale: 1.15,
          duration: POP_DUR / 2,
          delay: popDelay,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
    }

    // Spawn new tiles after slide animation
    const spawnDelay = this.reducedMotion ? 0 : SLIDE_DUR + 10;
    for (const idx of newTileIndices) {
      const exp = newBoard[idx] ?? 0;
      if (exp === 0) continue;
      const { x, y } = cellXY(idx);
      const cont = this.createTileSprite(exp, x, y);
      cont.setScale(0);
      this.tileConts[idx] = cont;
      this.gridContainer.add(cont);
      if (this.reducedMotion) {
        cont.setScale(1);
      } else {
        this.tweens.add({
          targets: cont,
          scale: 1,
          duration: SPAWN_DUR,
          delay: spawnDelay,
          ease: "Back.easeOut",
        });
      }
    }

    this.prevBoard = newBoard.slice();
  }

  /**
   * Build a single tile Container at (x, y) for the given exponent.
   */
  private createTileSprite(exp: number, x: number, y: number): Phaser.GameObjects.Container {
    const { bg, text } = tileColors(exp);

    const cont = this.add.container(x, y);

    // Background rounded rectangle drawn via Graphics
    const g = this.add.graphics();
    g.fillStyle(bg);
    g.fillRoundedRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, CORNER_R);
    cont.add(g);

    // Art image (optional — silently skipped if not loaded)
    const artKey = `tile-e${Math.min(exp, 12)}`;
    if (this.textures.exists(artKey)) {
      const img = this.add.image(0, -6, artKey)
        .setDisplaySize(CELL_SIZE - 16, CELL_SIZE - 16)
        .setAlpha(0.55);
      cont.add(img);
    }

    // Tile value text
    const label = this.add.text(0, 0, `${tileValue(exp)}`, {
      fontSize: tileFontSize(exp),
      fontStyle: "bold",
      color: text,
    }).setOrigin(0.5);
    cont.add(label);

    return cont;
  }

  /**
   * Update an existing tile sprite's value in place (for non-animated updates).
   */
  private updateTileSprite(cont: Phaser.GameObjects.Container, exp: number): void {
    const { bg, text } = tileColors(exp);

    // item 0 is the Graphics bg; item last is the Text label
    const g = cont.list[0] as Phaser.GameObjects.Graphics;
    g.clear();
    g.fillStyle(bg);
    g.fillRoundedRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, CORNER_R);

    const lastItem = cont.list[cont.list.length - 1];
    if (lastItem instanceof Phaser.GameObjects.Text) {
      lastItem.setText(`${tileValue(exp)}`).setColor(text).setFontSize(tileFontSize(exp));
    }
  }

  /** Visual "nudge" in the move direction while the server confirms the move. */
  private playSlideHint(dir: number): void {
    if (this.reducedMotion) return;

    const NUDGE = 6;
    const dx = dir === 1 ? NUDGE : dir === 3 ? -NUDGE : 0;
    const dy = dir === 2 ? NUDGE : dir === 0 ? -NUDGE : 0;

    for (let i = 0; i < 16; i++) {
      const c = this.tileConts[i];
      if (!c) continue;
      const { x, y } = cellXY(i);
      this.tweens.add({
        targets: c,
        x: x + dx,
        y: y + dy,
        duration: 60,
        ease: "Sine.easeOut",
        yoyo: true,
      });
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    // Keyboard
    const kb = this.input.keyboard;
    if (kb) {
      kb.on("keydown-UP",    () => this.handleMove(0));
      kb.on("keydown-RIGHT", () => this.handleMove(1));
      kb.on("keydown-DOWN",  () => this.handleMove(2));
      kb.on("keydown-LEFT",  () => this.handleMove(3));
      kb.on("keydown-W", () => this.handleMove(0));
      kb.on("keydown-D", () => this.handleMove(1));
      kb.on("keydown-S", () => this.handleMove(2));
      kb.on("keydown-A", () => this.handleMove(3));
    }

    // Swipe — capture on the whole game canvas
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.swipeStart = { x: ptr.x, y: ptr.y };
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = ptr.x - this.swipeStart.x;
      const dy = ptr.y - this.swipeStart.y;
      this.swipeStart = null;

      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) >= Math.abs(dy)) {
        this.handleMove(dx > 0 ? 1 : 3); // right : left
      } else {
        this.handleMove(dy > 0 ? 2 : 0); // down  : up
      }
    });
  }

  private handleMove(dir: number): void {
    if (this.str("gameStatus", "idle") !== "dealt") return;
    if (this.bool("isMoving") || this.bool("isSubmitting")) return;

    this.lastDir = dir;
    this.dispatch("playMove", { dir });
  }

  // ── Resize ────────────────────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.scene.restart();
  }
}
