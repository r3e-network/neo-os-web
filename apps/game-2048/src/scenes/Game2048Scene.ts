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

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { applyMove, hasAnyMove, tileValue } from "../logic/engine-2048";
import { DIFFICULTY_RULES, MAX_MOVES, gasDisplay } from "../logic/game-rules";

// ── Canvas dimensions ──────────────────────────────────────────────────────────
const CW = 400;
const CH = 580;

// ── Grid geometry ──────────────────────────────────────────────────────────────
const GRID_COLS   = 4;
const GRID_GAP    = 8;
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

interface TileVisual {
  shadow: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  objects: Phaser.GameObjects.GameObject[];
  x: number;
  y: number;
}

type Game2048Layout = {
  width: number;
  height: number;
  centerX: number;
  sidePad: number;
  gridGap: number;
  gridLeft: number;
  gridTop: number;
  gridW: number;
  gridH: number;
  cellSize: number;
  hintY: number;
  statusY: number;
  titleX: number;
  titleY: number;
  titleFontSize: string;
  scoreX: number;
  bestX: number;
  scoreBoxW: number;
  bestBoxW: number;
  headerBoxY: number;
  lobbyHeadingY: number;
  lobbySubY: number;
  lobbyHeroY: number;
  lobbyCardsY: number;
  lobbyStartY: number;
  lobbyCardW: number;
  lobbyCardH: number;
  lobbyCardGap: number;
};

/** Tile colour keyed by exponent value (1 = tile "2", 2 = tile "4", …). */
const TILE_PALETTE: TileColors[] = [
  { bg: 0xe2d4b4, text: "#776e65" }, // 0  – empty cell
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
function tileFontSize(exp: number, cellSize: number): string {
  const v = tileValue(exp);
  const scale = Math.min(1, cellSize / 76);
  const base = v >= 1000 ? 20 : v >= 100 ? 26 : 32;
  return `${Math.round(base * scale)}px`;
}

// ── Swipe threshold ────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 30;

// ── Difficulty card layout ─────────────────────────────────────────────────────
const CARD_W = 108;
const CARD_H = 132;

const FONT_FAMILY = "Inter, Arial, sans-serif";

const RUSH_ASSETS = {
  felt: "rush-tile-felt",
  tile: (exp: number) => `rush-tile-e${Math.min(Math.max(exp, 1), 12)}`,
} as const;

const TILE_ART_FILES = [
  "./art/tile-e1.webp",
  "./art/tile-e2.webp",
  "./art/tile-e3.webp",
  "./art/tile-e4.webp",
  "./art/tile-e5.webp",
  "./art/tile-e6.webp",
  "./art/tile-e7.webp",
  "./art/tile-e8.webp",
  "./art/tile-e9.webp",
  "./art/tile-e10.webp",
  "./art/tile-e11.webp",
  "./art/tile-e12.webp",
] as const;

const DIFF_LABELS = ["Sprint", "Climb", "Summit"] as const;
const DIFF_COPY = ["Fast 512", "Build 1024", "Reach 2048"] as const;
type SfxKind = "select" | "start" | "move" | "merge" | "spawn" | "win";

// ── Scene ──────────────────────────────────────────────────────────────────────

export class Game2048Scene extends BaseScene {
  private layout = this.computeLayout(CW, CH);

  // ── Scene objects ────────────────────────────────────────────────────────────
  private cellBgs:     Phaser.GameObjects.Graphics[] = [];
  private tileConts:   (TileVisual | null)[] = Array(16).fill(null);

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
    this.load.image(RUSH_ASSETS.felt, "./tile-felt.webp");
    TILE_ART_FILES.forEach((file, index) => {
      this.load.image(RUSH_ASSETS.tile(index + 1), file);
    });
  }

  create(): void {
    super.create();
    this.layout = this.computeLayout(this.scale.width || CW, this.scale.height || CH);

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

  private computeLayout(width: number, height: number): Game2048Layout {
    const sceneW = Math.max(320, Math.round(width || CW));
    const sceneH = Math.max(520, Math.round(height || CH));
    const centerX = Math.round(sceneW / 2);
    const sidePad = sceneW < 380 ? 12 : 16;
    const gridGap = sceneW < 380 ? 7 : GRID_GAP;
    const maxGridW = Math.min(368, sceneW - sidePad * 2);
    const maxGridH = Math.max(300, sceneH - 212);
    const gridW = Math.floor(Math.min(maxGridW, maxGridH));
    const cellSize = Math.floor((gridW - gridGap * (GRID_COLS + 1)) / GRID_COLS);
    const resolvedGridW = cellSize * GRID_COLS + gridGap * (GRID_COLS + 1);
    const gridH = resolvedGridW;
    const gridLeft = Math.round((sceneW - resolvedGridW) / 2);
    const gridTop = Math.round(
      Phaser.Math.Clamp(sceneH * 0.24, sceneH < 620 ? 120 : 142, Math.max(122, sceneH - gridH - 116)),
    );
    const scoreBoxW = sceneW < 380 ? 58 : 70;
    const bestBoxW = sceneW < 380 ? 56 : 60;
    const headerBoxY = sceneW < 380 ? 18 : 20;
    const lobbyCardGap = sceneW < 380 ? 8 : 10;
    const lobbyCardW = Math.max(94, Math.min(108, Math.floor((sceneW - sidePad * 2 - lobbyCardGap * 2) / 3)));
    const lobbyCardH = sceneH < 620 ? 124 : 132;
    const lobbyHeadingY = Math.round(Phaser.Math.Clamp(sceneH * 0.145, 82, 108));
    const lobbyHeroY = Math.round(Phaser.Math.Clamp(sceneH * 0.335, 184, 236));
    const lobbyCardsY = Math.round(Phaser.Math.Clamp(sceneH * 0.58, 326, sceneH - 204));
    const lobbyStartY = Math.round(Phaser.Math.Clamp(sceneH * 0.8, lobbyCardsY + lobbyCardH / 2 + 58, sceneH - 72));
    const gridStatusY = Math.min(sceneH - 38, gridTop + gridH + 52);
    const statusY = Math.min(sceneH - 38, Math.max(gridStatusY, lobbyStartY + 68));

    return {
      width: sceneW,
      height: sceneH,
      centerX,
      sidePad,
      gridGap,
      gridLeft,
      gridTop,
      gridW: resolvedGridW,
      gridH,
      cellSize,
      hintY: gridTop + gridH + 18,
      statusY,
      titleX: sidePad + 4,
      titleY: sceneW < 380 ? 12 : 14,
      titleFontSize: sceneW < 380 ? "30px" : "36px",
      scoreX: sceneW - sidePad - scoreBoxW / 2,
      bestX: sceneW - sidePad - scoreBoxW - 8 - bestBoxW / 2,
      scoreBoxW,
      bestBoxW,
      headerBoxY,
      lobbyHeadingY,
      lobbySubY: lobbyHeadingY + 24,
      lobbyHeroY,
      lobbyCardsY,
      lobbyStartY,
      lobbyCardW,
      lobbyCardH,
      lobbyCardGap,
    };
  }

  private rebuildScene(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.cellBgs = [];
    this.tileConts = Array(16).fill(null);
    this.diffCards = [];
    this.prevBoard = Array(16).fill(0);
    this.curBoard = Array(16).fill(0);
    this.prevStatus = "";
    this.prevIsMoving = false;
    this.layout = this.computeLayout(this.scale.width || CW, this.scale.height || CH);

    this.buildBackground();
    this.buildScoreArea();
    this.buildGridContainer();
    this.buildLobbyContainer();
    this.buildDealingContainer();
    this.buildCelebration();
    this.buildStatusLabel();
    this.onStateUpdate(this.state);
  }

  private cellXY(idx: number): { x: number; y: number } {
    const { gridLeft, gridTop, gridGap, cellSize } = this.layout;
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);
    return {
      x: gridLeft + gridGap + col * (cellSize + gridGap) + cellSize / 2,
      y: gridTop + gridGap + row * (cellSize + gridGap) + cellSize / 2,
    };
  }

  // ── BaseScene abstract ────────────────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    const status      = this.str("gameStatus", "idle");
    const board       = (this.val<number[]>("runBoard") ?? []).slice();
    const moveCount   = this.num("runMoveCount", 0);
    const maxExp      = this.num("runMaxExp", 0);
    const isMoving    = this.bool("isMoving");
    const isDealing   = this.bool("isDealing");
    const isStarting  = this.bool("isStarting");
    const lastStatus  = this.str("lastStatus", "");

    // ── Phase transitions ──────────────────────────────────────────────────────
    const statusChanged = status !== this.prevStatus;

    if (statusChanged) {
      this.prevStatus = status;
      const isLobby    = status === "idle" || status === "solved" || status === "expired";
      const isPlaying  = status === "dealt";

      this.setObjectActive(this.gridContainer, isPlaying && board.length === 16);
      this.setTilesActive(isPlaying && board.length === 16);
      this.setObjectActive(this.lobbyContainer, isLobby);
      this.setObjectActive(this.dealingContainer, status === "committed" || (isDealing && !isPlaying));

      if (isLobby) {
        this.shown2048 = false;
        this.clearTiles();
        this.setObjectActive(this.celebContainer, false);
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
      this.setObjectActive(this.gridContainer, true);
      this.setTilesActive(true);
      this.setObjectActive(this.lobbyContainer, false);
      this.setObjectActive(this.dealingContainer, false);

      const boardChanged = board.some((v, i) => v !== this.curBoard[i]);
      const expectedTileCount = board.filter((exp) => exp > 0).length;
      const renderedTileCount = this.tileConts.filter(Boolean).length;

      if (renderedTileCount !== expectedTileCount) {
        this.renderBoardImmediate(board);
        this.curBoard = board.slice();
      } else if (boardChanged) {
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
    const l = this.layout;

    this.add.rectangle(l.centerX, l.height / 2, l.width, l.height, C.bg);
    this.add.rectangle(l.centerX, Math.max(120, l.height * 0.22), l.width, Math.max(238, l.height * 0.38), 0xfff4df, 0.68);
    this.add.rectangle(l.centerX, l.height - 62, Math.max(280, l.width - 32), 110, 0xffffff, 0.54)
      .setStrokeStyle(1, 0xe9dcc7, 0.74);
  }

  private setObjectActive(object: Phaser.GameObjects.GameObject, active: boolean): void {
    (object as { setVisible?: (visible: boolean) => void }).setVisible?.(active);
    const input = (object as { input?: { enabled?: boolean } }).input;
    if (input) input.enabled = active;

    if (object instanceof Phaser.GameObjects.Container) {
      object.list.forEach((child) => {
        this.setObjectActive(child as Phaser.GameObjects.GameObject, active);
      });
    }
  }

  // ── Score area ────────────────────────────────────────────────────────────────

  private buildScoreArea(): void {
    const l = this.layout;

    // Title
    this.add.text(l.titleX, l.titleY, "2048 Rush", {
      fontFamily: FONT_FAMILY,
      fontSize: l.titleFontSize,
      fontStyle: "bold",
      color: C.headerText,
    });

    // Score box
    const scoreBox = this.add.container(l.scoreX, l.headerBoxY);
    const scoreBg = this.add.rectangle(0, 0, l.scoreBoxW, 52, 0xbbada0).setOrigin(0.5);
    const scoreCaption = this.add.text(0, -10, "SCORE", {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#f9f6f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.scoreLabel = this.add.text(0, 8, "0", {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    scoreBox.add([scoreBg, scoreCaption, this.scoreLabel]);

    // Best tile box
    const bestBox = this.add.container(l.bestX, l.headerBoxY);
    const bestBg = this.add.rectangle(0, 0, l.bestBoxW, 52, 0xbbada0).setOrigin(0.5);
    const bestCaption = this.add.text(0, -10, "BEST", {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#f9f6f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.bestLabel = this.add.text(0, 8, "–", {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    bestBox.add([bestBg, bestCaption, this.bestLabel]);

    // Moves label (smaller, below title)
    this.movesLabel = this.add.text(l.titleX, 56, "Moves: 0", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: C.scoreText,
    });
  }

  // ── Grid container ────────────────────────────────────────────────────────────

  private buildGridContainer(): void {
    const l = this.layout;
    this.gridContainer = this.add.container(0, 0);

    // Grid background
    const boardShadow = this.add.rectangle(l.centerX, l.gridTop + l.gridH / 2 + 6, l.gridW + 16, l.gridH + 16, 0xb5966e, 0.18)
      .setOrigin(0.5);
    const boardFelt = this.add.image(l.centerX, l.gridTop + l.gridH / 2, RUSH_ASSETS.felt)
      .setDisplaySize(l.gridW + 10, l.gridH + 10)
      .setAlpha(0.98);
    const gridBg = this.add.graphics();
    gridBg.fillStyle(0xd0b894, 0.22);
    gridBg.fillRoundedRect(l.gridLeft - 5, l.gridTop - 5, l.gridW + 10, l.gridH + 10, 12);
    this.gridContainer.add(boardShadow);
    this.gridContainer.add(boardFelt);
    this.gridContainer.add(gridBg);

    // Empty cell backgrounds
    for (let i = 0; i < 16; i++) {
      const { x, y } = this.cellXY(i);
      const g = this.add.graphics();
      g.fillStyle(C.white, 0.42);
      g.fillRoundedRect(x - l.cellSize / 2, y - l.cellSize / 2, l.cellSize, l.cellSize, CORNER_R);
      g.lineStyle(1, 0xd8c8a9, 0.58);
      g.strokeRoundedRect(x - l.cellSize / 2, y - l.cellSize / 2, l.cellSize, l.cellSize, CORNER_R);
      this.cellBgs.push(g);
      this.gridContainer.add(g);
    }

    // Controls hint
    const hint = this.add.text(l.centerX, l.hintY, "Swipe or use arrow keys", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#9a8f82",
    }).setOrigin(0.5);
    this.gridContainer.add(hint);

    this.gridContainer.setVisible(false);
  }

  // ── Lobby container ───────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    const l = this.layout;
    this.lobbyContainer = this.add.container(0, 0);

    const heading = this.add.text(l.centerX, l.lobbyHeadingY, "Build the next power tile", {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: C.headerText,
    }).setOrigin(0.5);

    const sub = this.add.text(l.centerX, l.lobbySubY, "Slide, merge, and settle a verified run", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#776e65",
    }).setOrigin(0.5);

    const heroBoard = this.buildLobbyHeroBoard(l.centerX, l.lobbyHeroY);

    this.lobbyContainer.add([heading, sub, heroBoard]);

    // Difficulty cards
    const totalCardsW = l.lobbyCardW * 3 + l.lobbyCardGap * 2;
    const firstCardX = l.centerX - totalCardsW / 2 + l.lobbyCardW / 2;
    DIFFICULTY_RULES.forEach((rule, idx) => {
      const cardX = firstCardX + idx * (l.lobbyCardW + l.lobbyCardGap);
      const card = this.buildDiffCard(rule, idx, cardX, l.lobbyCardsY);
      this.diffCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Start button
    this.startBtn = this.buildStartButton(l.centerX, l.lobbyStartY);
    this.lobbyContainer.add(this.startBtn);

    this.lobbyContainer.setVisible(true);
  }

  private buildLobbyHeroBoard(x: number, y: number): Phaser.GameObjects.Container {
    const compact = this.layout.width < 380 || this.layout.height < 620;
    const heroW = compact ? 166 : 184;
    const heroH = compact ? 112 : 126;
    const tileSmall = compact ? 42 : 48;
    const tileLarge = compact ? 48 : 54;
    const board = this.add.container(x, y);
    const panel = this.add.image(0, 0, RUSH_ASSETS.felt)
      .setDisplaySize(heroW, heroH)
      .setAlpha(0.92);
    const glow = this.add.rectangle(0, 0, heroW + 10, heroH + 10, 0xffffff, 0.32)
      .setStrokeStyle(1, 0xe6d4b4, 0.6)
      .setOrigin(0.5);

    const preview = [
      { exp: 1, x: -0.33, y: -0.29 },
      { exp: 2, x: -0.09, y: -0.29 },
      { exp: 4, x: 0.15, y: -0.29 },
      { exp: 7, x: 0.33, y: 0.06 },
      { exp: 9, x: 0.09, y: 0.29 },
      { exp: 11, x: -0.23, y: 0.22 },
    ];

    board.add([glow, panel]);
    preview.forEach((tile, idx) => {
      const size = idx >= 3 ? tileLarge : tileSmall;
      const img = this.add.image(tile.x * heroW, tile.y * heroH, RUSH_ASSETS.tile(tile.exp))
        .setDisplaySize(size, size)
        .setAngle(idx % 2 === 0 ? -4 : 4);
      board.add(img);
    });

    this.animate({
      targets: board,
      y: y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    return board;
  }

  private buildDiffCard(
    rule: typeof DIFFICULTY_RULES[number],
    idx: number,
    cardX: number,
    cardY: number,
  ): Phaser.GameObjects.Container {
    const l = this.layout;
    const card = this.add.container(cardX, cardY);

    const bg = this.add.rectangle(0, 0, l.lobbyCardW, l.lobbyCardH, 0xfff8ee)
      .setStrokeStyle(2, 0xbbada0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    bg.on("pointerover", () => bg.setStrokeStyle(3, 0xf2b179));
    bg.on("pointerout",  () => {
      bg.setStrokeStyle(this.pickedDiff === idx ? 3 : 2, this.pickedDiff === idx ? 0xf65e3b : 0xbbada0);
    });
    bg.on("pointerdown", () => {
      this.sfx.unlock();
      this.playSfx("select");
      this.pickedDiff = idx;
      this.highlightDiffCard(idx);
    });

    const targetExp = Math.max(1, Math.min(12, Math.round(Math.log2(rule.targetTile))));
    const tileSize = l.lobbyCardW < 104 ? 48 : 54;
    const targetY = l.lobbyCardH < CARD_H ? -32 : -34;
    const targetTile = this.add.image(0, -34, RUSH_ASSETS.tile(targetExp))
      .setY(targetY)
      .setDisplaySize(tileSize, tileSize);

    const label = this.add.text(0, l.lobbyCardH < CARD_H ? 4 : 7, DIFF_LABELS[idx] ?? "Sprint", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    const tileTxt = this.add.text(0, l.lobbyCardH < CARD_H ? 22 : 26, DIFF_COPY[idx] ?? `Reach ${rule.targetTile}`, {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#776e65",
    }).setOrigin(0.5);

    const timeTxt = this.add.text(0, l.lobbyCardH < CARD_H ? 39 : 43, `${Math.round(rule.limitMs / 60000)} min`, {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: "#776e65",
    }).setOrigin(0.5);

    const rewardTxt = this.add.text(0, l.lobbyCardH < CARD_H ? 53 : 57, `${gasDisplay(rule.rewardFixed8)} GAS`, {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#e05000",
    }).setOrigin(0.5);

    card.add([bg, targetTile, label, tileTxt, timeTxt, rewardTxt]);
    return card;
  }

  private buildStartButton(x: number, y: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 220, 52, 0xf65e3b)
      .setStrokeStyle(2, 0xf2b179)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, "Open run", {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.bindGameButton(bg, {
      targets: btn,
      pressScale: 0.95,
      enabled: () => this.canStartPicked(),
      onPress: () => {
        this.sfx.unlock();
        this.playSfx("start");
        this.dispatch("startGame", { difficulty: this.pickedDiff });
      },
      onHoverIn: () => {
        if (this.canStartPicked()) bg.setFillStyle(0xe04000);
      },
      onHoverOut: () => this.updateStartBtn(this.bool("isStarting")),
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
    const canStart = this.canStartPicked();
    txt.setText(isStarting ? "Opening..." : canStart ? "Open run" : "Pool refilling");
    bg.setFillStyle(isStarting || !canStart ? 0xbbada0 : 0xf65e3b);
  }

  private canStartPicked(): boolean {
    if (this.bool("isStarting") || this.bool("isDealing")) return false;
    const rule = DIFFICULTY_RULES[this.pickedDiff] ?? DIFFICULTY_RULES[0]!;
    const poolFree = this.num("poolFree", Number.POSITIVE_INFINITY);
    return poolFree >= Number(gasDisplay(rule.rewardFixed8));
  }

  // ── Dealing container ─────────────────────────────────────────────────────────

  private buildDealingContainer(): void {
    const l = this.layout;
    this.dealingContainer = this.add.container(l.centerX, l.height / 2);

    const bg = this.add.rectangle(0, 0, 280, 140, 0xfff8ee, 0.95)
      .setStrokeStyle(2, 0xbbada0)
      .setOrigin(0.5);

    const tileA = this.add.image(-38, -32, RUSH_ASSETS.tile(1))
      .setDisplaySize(48, 48)
      .setAngle(-8);
    const tileB = this.add.image(4, -34, RUSH_ASSETS.tile(2))
      .setDisplaySize(52, 52)
      .setAngle(5);
    const tileC = this.add.image(46, -30, RUSH_ASSETS.tile(3))
      .setDisplaySize(48, 48)
      .setAngle(9);

    const label = this.add.text(0, 18, "Preparing run...", {
      fontFamily: FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    const dot1 = this.add.circle(-22, 50, 5, 0xf2b179);
    const dot2 = this.add.circle(0, 50, 5, 0xf2b179);
    const dot3 = this.add.circle(22, 50, 5, 0xf2b179);

    this.dealingContainer.add([bg, tileA, tileB, tileC, label, dot1, dot2, dot3]);

    [tileA, tileB, tileC].forEach((tile, index) => {
      this.animate({
        targets: tile,
        y: tile.y - 8,
        duration: 620,
        delay: index * 110,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    });
    [dot1, dot2, dot3].forEach((dot, index) => {
      this.animate({
        targets: dot,
        alpha: 0.22,
        duration: 460,
        delay: index * 110,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    });

    this.dealingContainer.setVisible(false);
  }

  // ── 2048 celebration ──────────────────────────────────────────────────────────

  private buildCelebration(): void {
    const l = this.layout;
    this.celebContainer = this.add.container(l.centerX, l.height / 2);

    const overlay = this.add.rectangle(0, 0, l.width, l.height, 0x3b2d19, 0.42).setOrigin(0.5);
    overlay.setInteractive(); // capture clicks so they don't bleed through

    const banner = this.add.rectangle(0, -12, 282, 156, 0xfff7df, 0.98)
      .setStrokeStyle(3, 0xedc22e)
      .setOrigin(0.5);

    const trophyTile = this.add.image(0, -52, RUSH_ASSETS.tile(11))
      .setDisplaySize(86, 86);

    const titleTxt = this.add.text(0, 12, "2048 unlocked", {
      fontFamily: FONT_FAMILY,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    const subTxt = this.add.text(0, 42, "Keep merging or submit the run", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      color: "#5a4f45",
    }).setOrigin(0.5);

    const dismissBtn = this.add.text(0, 76, "Tap to continue", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#e05000",
    }).setOrigin(0.5);

    this.celebContainer.add([overlay, banner, trophyTile, titleTxt, subTxt, dismissBtn]);
    this.celebContainer.setVisible(false);

    overlay.on("pointerdown", () => {
      this.playSfx("select");
      this.tweens.add({
        targets: this.celebContainer,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.setObjectActive(this.celebContainer, false);
          this.celebContainer.setAlpha(1);
        },
      });
    });
  }

  private playCelebration(): void {
    this.playSfx("win");
    this.setObjectActive(this.celebContainer, true);
    this.celebContainer.setAlpha(0);
    this.tweens.add({
      targets: this.celebContainer,
      alpha: 1,
      duration: 300,
      ease: "Sine.easeOut",
    });
  }

  // ── Status label ──────────────────────────────────────────────────────────────

  private buildStatusLabel(): void {
    const l = this.layout;
    this.statusLabel = this.add.text(l.centerX, l.statusY, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#9a8f82",
    }).setOrigin(0.5).setDepth(2);
  }

  // ── Tile rendering ────────────────────────────────────────────────────────────

  private clearTiles(): void {
    for (let i = 0; i < 16; i++) {
      this.destroyTile(this.tileConts[i]);
      this.tileConts[i] = null;
    }
    this.curBoard = Array(16).fill(0);
    this.prevBoard = Array(16).fill(0);
  }

  private setTilesActive(active: boolean): void {
    for (const tile of this.tileConts) {
      tile?.objects.forEach((object) => {
        (object as { setVisible?: (visible: boolean) => void }).setVisible?.(active);
      });
    }
  }

  private destroyTile(tile: TileVisual | null | undefined): void {
    tile?.objects.forEach((object) => object.destroy());
  }

  private setTilePosition(tile: TileVisual, x: number, y: number): void {
    tile.x = x;
    tile.y = y;
    tile.shadow.setPosition(x + 4, y + 6);
    tile.art.setPosition(x, y);
    tile.label.setPosition(x, y);
  }

  private setTileScale(tile: TileVisual, scale: number): void {
    tile.objects.forEach((object) => {
      (object as { setScale?: (scale: number) => void }).setScale?.(scale);
    });
  }

  private tweenTileTo(tile: TileVisual, tx: number, ty: number, duration: number): void {
    const dx = tx - tile.x;
    const dy = ty - tile.y;
    tile.x = tx;
    tile.y = ty;
    this.tweens.add({
      targets: tile.objects,
      x: `+=${dx}`,
      y: `+=${dy}`,
      duration,
      ease: "Quad.easeOut",
      onComplete: () => this.setTilePosition(tile, tx, ty),
    });
  }

  /**
   * Instantly render every tile from the board — used for initial board draw
   * and undo snaps where no animation is needed.
   */
  private renderBoardImmediate(board: number[]): void {
    // Destroy old tiles
    this.clearTiles();
    // Spawn each non-empty tile without animation
    for (let i = 0; i < 16; i++) {
      const exp = board[i] ?? 0;
      if (exp > 0) {
        const { x, y } = this.cellXY(i);
        this.tileConts[i] = this.createTileSprite(exp, x, y);
      }
    }
    this.setTilesActive(true);
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

    if (mergedIndices.length > 0) {
      this.playSfx("merge");
    } else if (newBoard.some((exp, index) => exp !== (oldBoard[index] ?? 0))) {
      this.playSfx("move");
    }

    // Slide existing tiles to new positions
    // Strategy: move all tile visuals to match new board layout
    // First, snap all tiles to reflect the new non-spawn values
    const slideTargets: { tile: TileVisual; tx: number; ty: number }[] = [];

    // Destroy tiles no longer present, and queue slides for moved tiles
    for (let i = 0; i < 16; i++) {
      const nxt = newBoard[i] ?? 0;
      if (nxt === 0) {
        this.destroyTile(this.tileConts[i]);
        this.tileConts[i] = null;
      }
    }

    // For positions with tiles in newBoard (excluding spawn positions),
    // ensure we have a tile visual and slide it into place
    for (let i = 0; i < 16; i++) {
      const exp = newBoard[i] ?? 0;
      if (exp === 0) continue;
      const isSpawned = newTileIndices.includes(i);
      if (isSpawned) continue;

      const { x, y } = this.cellXY(i);
      if (!this.tileConts[i]) {
        // Create tile immediately at its position
        const tile = this.createTileSprite(exp, x, y);
        this.tileConts[i] = tile;
      } else {
        // Update existing tile's value and slide to new position
        this.updateTileSprite(this.tileConts[i]!, exp);
        slideTargets.push({ tile: this.tileConts[i]!, tx: x, ty: y });
      }
    }

    // Run slide tweens
    if (slideTargets.length > 0 && !this.reducedMotion) {
      for (const { tile, tx, ty } of slideTargets) {
        this.tweenTileTo(tile, tx, ty, SLIDE_DUR);
      }
    } else {
      for (const { tile, tx, ty } of slideTargets) {
        this.setTilePosition(tile, tx, ty);
      }
    }

    // Scale pop for merged tiles (delayed until slide completes)
    const popDelay = this.reducedMotion ? 0 : SLIDE_DUR;
    for (const idx of mergedIndices) {
      const tile = this.tileConts[idx];
      if (!tile) continue;
      if (this.reducedMotion) {
        // no-op
      } else {
        this.tweens.add({
          targets: tile.objects,
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
    if (newTileIndices.length > 0) {
      this.time.delayedCall(spawnDelay, () => this.playSfx("spawn"));
    }
    for (const idx of newTileIndices) {
      const exp = newBoard[idx] ?? 0;
      if (exp === 0) continue;
      const { x, y } = this.cellXY(idx);
      const tile = this.createTileSprite(exp, x, y);
      this.setTileScale(tile, 0);
      this.tileConts[idx] = tile;
      if (this.reducedMotion) {
        this.setTileScale(tile, 1);
      } else {
        this.tweens.add({
          targets: tile.objects,
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
   * Build a single scene-level tile visual at (x, y) for the given exponent.
   */
  private createTileSprite(exp: number, x: number, y: number): TileVisual {
    const { text } = tileColors(exp);
    const { cellSize } = this.layout;

    const shadow = this.add.rectangle(x + 4, y + 6, cellSize - 4, cellSize - 4, 0x8f7555, 0.18)
      .setOrigin(0.5);

    const artKey = RUSH_ASSETS.tile(exp);
    let art: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.textures.exists(artKey)) {
      art = this.add.image(x, y, artKey)
        .setDisplaySize(cellSize + 4, cellSize + 4)
        .setAlpha(0.98);
    } else {
      art = this.add.rectangle(x, y, cellSize, cellSize, tileColors(exp).bg)
        .setOrigin(0.5);
    }

    // Tile value text
    const label = this.add.text(x, y, `${tileValue(exp)}`, {
      fontFamily: FONT_FAMILY,
      fontSize: tileFontSize(exp, cellSize),
      fontStyle: "bold",
      color: text,
    }).setOrigin(0.5)
      .setShadow(0, exp >= 3 ? 2 : 1, exp >= 3 ? "#5c3517" : "#ffffff", 3);

    [shadow, art, label].forEach((object) => {
      if (!this.children.exists(object)) {
        this.children.add(object);
      }
    });

    return { shadow, art, label, objects: [shadow, art, label], x, y };
  }

  /**
   * Update an existing tile sprite's value in place (for non-animated updates).
   */
  private updateTileSprite(tile: TileVisual, exp: number): void {
    const { text } = tileColors(exp);
    const { cellSize } = this.layout;

    if (tile.art instanceof Phaser.GameObjects.Image) {
      tile.art.setTexture(RUSH_ASSETS.tile(exp));
      tile.art.setDisplaySize(cellSize + 4, cellSize + 4);
      tile.art.setAlpha(0.98);
    } else {
      tile.art.setSize(cellSize, cellSize);
      tile.art.setFillStyle(tileColors(exp).bg);
    }

    tile.label
      .setText(`${tileValue(exp)}`)
      .setColor(text)
      .setFontSize(tileFontSize(exp, cellSize))
      .setShadow(0, exp >= 3 ? 2 : 1, exp >= 3 ? "#5c3517" : "#ffffff", 3);
  }

  /** Visual "nudge" in the move direction while the server confirms the move. */
  private playSlideHint(dir: number): void {
    if (this.reducedMotion) return;

    const NUDGE = 6;
    const dx = dir === 1 ? NUDGE : dir === 3 ? -NUDGE : 0;
    const dy = dir === 2 ? NUDGE : dir === 0 ? -NUDGE : 0;

    for (let i = 0; i < 16; i++) {
      const tile = this.tileConts[i];
      if (!tile) continue;
      this.tweens.add({
        targets: tile.objects,
        x: `+=${dx}`,
        y: `+=${dy}`,
        duration: 60,
        ease: "Sine.easeOut",
        yoyo: true,
        onComplete: () => this.setTilePosition(tile, tile.x, tile.y),
      });
    }
  }

  private playSfx(kind: SfxKind): void {
    switch (kind) {
      case "select":
        this.sfx.play("tap");
        break;
      case "start":
        this.sfx.play("start");
        break;
      case "move":
        this.sfx.play("move");
        break;
      case "merge":
        this.sfx.play("merge");
        break;
      case "spawn":
        this.sfx.play("spawn");
        break;
      case "win":
        // Original fanfare holds every note for 0.12s (the shared "win" preset
        // lets the last note ring slightly longer).
        this.sfx.tones(
          [523, 659, 784, 1046].map((frequency, index) => ({
            frequency,
            duration: 0.12,
            delay: index * 0.065,
            type: "triangle" as const,
            gain: 0.026,
          })),
        );
        break;
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
    this.sfx.unlock();
    if (this.str("gameStatus", "idle") !== "dealt") return;
    if (this.bool("isMoving") || this.bool("isSubmitting")) return;
    if (!this.canMove(dir)) return;

    this.lastDir = dir;
    this.playSfx("move");
    this.dispatch("playMove", { dir });
  }

  private canMove(dir: number): boolean {
    if (!Number.isInteger(dir) || dir < 0 || dir > 3) return false;
    const board = this.val<number[]>("runBoard") ?? [];
    if (board.length !== 16) return false;
    if (this.num("runMoveCount", 0) >= MAX_MOVES) return false;
    const deadline = this.num("deadline", 0);
    if (deadline > 0 && Date.now() >= deadline) return false;
    if (!hasAnyMove(board)) return false;
    return applyMove([...board], dir);
  }

  // ── Resize ────────────────────────────────────────────────────────────────────

  protected onResize(gameSize: Phaser.Structs.Size): void {
    const nextW = Math.max(1, Math.round(gameSize.width || this.scale.width || CW));
    const nextH = Math.max(1, Math.round(gameSize.height || this.scale.height || CH));
    if (nextW === this.layout.width && nextH === this.layout.height) return;

    this.rebuildScene();
  }
}
