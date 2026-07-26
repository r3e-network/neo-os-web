/**
 * GomokuScene — Phaser 3 scene for the Gomoku (Five-in-a-Row) miniapp.
 *
 * Renders a full Gomoku game inside the Phaser canvas:
 *  - Lobby with three difficulty routes
 *  - 15×15 wooden board with grid lines and star points
 *  - Black (human) and white (AI) stones with subtle shadows
 *  - Last-move indicator, win-line highlight
 *  - Timer bar + move counter HUD
 *  - Undo / Pause / Restart buttons
 *
 * State consumed from React bridge:
 *   gameStatus   "idle"|"dealt"|"solved"|"expired"
 *   boardState   JSON string with board data
 *   isPaused     boolean
 *
 * Actions dispatched to React:
 *   startGame      { difficulty: 0|1|2 }
 *   placeStone     { cell: 0-224 }
 *   useUndo        {}
 *   togglePause    {}
 *   restartGame    { difficulty: 0|1|2 }
 *   expireGame     {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { formatClock } from "../logic/game-rules";
import { BOARD_SIZE, idx, rowOf, colOf } from "../logic/gomoku-engine";

// ── Layout constants ───────────────────────────────────────────────────────────
const DESIGN_W = 420;
const DESIGN_H = 620;
const W = DESIGN_W;
const H = DESIGN_H;

const BOARD_PADDING = 24;
const BOARD_SIZE_PX = W - BOARD_PADDING * 2;
const CELL_PX = BOARD_SIZE_PX / (BOARD_SIZE - 1);
const BOARD_X = BOARD_PADDING;
const BOARD_Y = 72;
const STONE_RADIUS = CELL_PX * 0.42;

const TOOL_Y = BOARD_Y + BOARD_SIZE_PX + 36;
const ACTION_Y = TOOL_Y + 50;
const STATUS_Y = ACTION_Y + 36;
const TIMER_Y = 22;

const FONT_FAMILY = "Inter, Arial, sans-serif";

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  appBg:        0xf5e6c8,
  boardWood:    0xdcb35c,
  boardEdge:    0x8b6914,
  gridLine:     0x4a3520,
  starPoint:    0x3a2810,
  blackStone:   0x1a1a1a,
  blackHighlight: 0x444444,
  whiteStone:   0xf8f8f0,
  whiteEdge:    0xcccccc,
  whiteHighlight: 0xffffff,
  lastMoveDot:  0xe63946,
  winLine:      0xff6b35,
  selRing:      0x2196f3,
  gold:         0xd4a843,
  goldLight:    0xf0c866,
  btnBg:        0xfff8ea,
  btnBorder:    0xc9a84c,
  btnActive:    0xffe3a8,
  btnText:      0x4b351c,
  timerFull:    0x4aaa55,
  timerMid:     0xd4a843,
  timerLow:     0xcc4422,
  white:        0xffffff,
  muted:        0xb38b55,
  red:          0xcc2200,
  green:        0x1a7a30,
  diffEasy:     0x6dbf7b,
  diffMedium:   0xdbab40,
  diffHard:     0xdd6958,
  textDark:     0x2d2114,
  textMuted:    0x7a5a28,
} as const;

// ── Difficulty display ─────────────────────────────────────────────────────────
const DIFF_LABELS = ["Easy", "Medium", "Hard"] as const;
const DIFF_COLORS = [C.diffEasy, C.diffMedium, C.diffHard] as const;
const DIFF_COPY = ["Casual AI", "Tactical AI", "Master AI"] as const;

// Star points on a 15×15 board (standard Gomoku)
const STAR_POINTS: ReadonlyArray<readonly [number, number]> = [
  [3, 3], [3, 7], [3, 11],
  [7, 3], [7, 7], [7, 11],
  [11, 3], [11, 7], [11, 11],
];

// ── Scene artwork ──────────────────────────────────────────────────────────────
// Files live in apps/gomoku/public/art and are produced by
// `node scripts/generate-gomoku-art.mjs` (deterministic SVG → webp).
// Every draw site guards on `this.textures.exists(...)` so the scene still
// renders with its vector primitives when a texture is unavailable (jsdom,
// offline first paint, or a failed fetch).
const ART = {
  tableLinen: "gomoku-table-linen",
  boardWood: "gomoku-board-wood",
  stoneBlack: "gomoku-stone-black",
  stoneWhite: "gomoku-stone-white",
  lastMove: "gomoku-last-move",
  winGlow: "gomoku-win-glow",
  resultSeal: "gomoku-result-seal",
  badges: ["gomoku-badge-easy", "gomoku-badge-medium", "gomoku-badge-hard"],
} as const;

interface GomokuLabels {
  lobbyTitle: string;
  lobbySub: string;
  diffNames: string[];
  diffCopy: string[];
  yourTurn: string;
  aiThinking: string;
  undo: string;
  pause: string;
  resume: string;
  restart: string;
  pausedTitle: string;
  pausedCopy: string;
  act: {
    open: string;
    playAgain: string;
    tryAgain: string;
    starting: string;
  };
  resultWin: string;
  resultLose: string;
  resultDraw: string;
}

const DEFAULT_LABELS: GomokuLabels = {
  lobbyTitle: "Gomoku Arena",
  lobbySub: "Five in a row wins",
  diffNames: [...DIFF_LABELS],
  diffCopy: [...DIFF_COPY],
  yourTurn: "Your turn — place a black stone",
  aiThinking: "AI is thinking…",
  undo: "Undo",
  pause: "Pause",
  resume: "Resume",
  restart: "New game",
  pausedTitle: "Game paused",
  pausedCopy: "Take your time. Resume when ready.",
  act: {
    open: "Start game",
    playAgain: "Play again",
    tryAgain: "Try again",
    starting: "Starting…",
  },
  resultWin: "You win!",
  resultLose: "AI wins",
  resultDraw: "Draw",
};

// ─────────────────────────────────────────────────────────────────────────────
export class GomokuScene extends BaseScene {

  // ── Local game state ───────────────────────────────────────────────────────
  private board: number[] = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  private currentTurn: 1 | 2 = 1;
  private gameOver = false;
  private winLine: number[] = [];
  private lastMove = -1;
  private moveCount = 0;
  private pickedDifficulty = 0;
  private deadline = 0;
  private dealtAt = 0;
  private prevStatus = "";
  private L: GomokuLabels = DEFAULT_LABELS;
  private lastClockSecond = -1;
  /** Cell index placed by the most recent board update; -1 once animated. */
  private pendingDropCell = -1;

  // ── Display objects ────────────────────────────────────────────────────────
  private backgroundBase!: Phaser.GameObjects.Rectangle;
  private backgroundArt: Phaser.GameObjects.Image | null = null;
  private boardBg!: Phaser.GameObjects.Rectangle;
  private boardFrame!: Phaser.GameObjects.Rectangle;
  private boardArt: Phaser.GameObjects.Image | null = null;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private cellHits!: Phaser.GameObjects.Rectangle[];
  private stones: (Phaser.GameObjects.GameObject | null)[] = [];
  private stoneHighlights: (Phaser.GameObjects.Arc | null)[] = [];
  private ghostStone!: Phaser.GameObjects.Arc;
  private lastMoveIndicator!: Phaser.GameObjects.Arc;
  private lastMoveArt: Phaser.GameObjects.Image | null = null;
  private lastMovePulse: Phaser.Tweens.Tween | null = null;
  private winLineGraphics!: Phaser.GameObjects.Graphics;
  private winGlow: Phaser.GameObjects.Image | null = null;
  private resultSeal: Phaser.GameObjects.Image | null = null;

  // HUD
  private timerBg!: Phaser.GameObjects.Rectangle;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerLabel!: Phaser.GameObjects.Text;
  private turnLabel!: Phaser.GameObjects.Text;
  private moveLabel!: Phaser.GameObjects.Text;

  // Tool buttons
  private undoBtn!: Phaser.GameObjects.Container;
  private undoBtnBg!: Phaser.GameObjects.Rectangle;
  private pauseBtn!: Phaser.GameObjects.Container;
  private pauseBtnBg!: Phaser.GameObjects.Rectangle;
  private pauseBtnText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Container;
  private restartBtnBg!: Phaser.GameObjects.Rectangle;

  // Action button
  private actionBtn!: Phaser.GameObjects.Container;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnBg!: Phaser.GameObjects.Rectangle;
  private actionButtonEnabled = false;

  // Status
  private statusLabel!: Phaser.GameObjects.Text;

  // Lobby
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffBtns!: Phaser.GameObjects.Container[];
  private lobbyTitleText!: Phaser.GameObjects.Text;
  private lobbySubText!: Phaser.GameObjects.Text;
  private lobbyPreview!: Phaser.GameObjects.Container;

  // Paused overlay
  private pausedOverlay!: Phaser.GameObjects.Container;
  private pausedTitleText!: Phaser.GameObjects.Text;
  private pausedCopyText!: Phaser.GameObjects.Text;
  private pausedResumeText!: Phaser.GameObjects.Text;

  // Game group
  private gameGroupObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() { super("GomokuScene"); }

  // ── Asset loading ──────────────────────────────────────────────────────────

  preload(): void {
    this.load.image(ART.tableLinen, "./art/table-linen.webp");
    this.load.image(ART.boardWood, "./art/board-wood.webp");
    this.load.image(ART.stoneBlack, "./art/stone-black.webp");
    this.load.image(ART.stoneWhite, "./art/stone-white.webp");
    this.load.image(ART.lastMove, "./art/last-move.webp");
    this.load.image(ART.winGlow, "./art/win-glow.webp");
    this.load.image(ART.resultSeal, "./art/result-seal.webp");
    this.load.image(ART.badges[0], "./art/badge-easy.webp");
    this.load.image(ART.badges[1], "./art/badge-medium.webp");
    this.load.image(ART.badges[2], "./art/badge-hard.webp");
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildBackground(): void {
    this.backgroundBase = this.add.rectangle(W / 2, H / 2, W, H, C.appBg).setDepth(-10);
    if (this.textures.exists(ART.tableLinen)) {
      this.backgroundArt = this.add.image(W / 2, H / 2, ART.tableLinen)
        .setDisplaySize(W, H)
        .setDepth(-9);
    }
  }

  private buildBoard(): void {
    // Board frame (wooden border)
    this.boardFrame = this.add.rectangle(
      W / 2, BOARD_Y + BOARD_SIZE_PX / 2,
      BOARD_SIZE_PX + 16, BOARD_SIZE_PX + 16,
      C.boardEdge,
    ).setDepth(0);

    // Board surface
    this.boardBg = this.add.rectangle(
      W / 2, BOARD_Y + BOARD_SIZE_PX / 2,
      BOARD_SIZE_PX, BOARD_SIZE_PX,
      C.boardWood,
    ).setDepth(1);

    // Painted board (frame + grain) drawn over the primitive base when loaded
    if (this.textures.exists(ART.boardWood)) {
      this.boardArt = this.add.image(W / 2, BOARD_Y + BOARD_SIZE_PX / 2, ART.boardWood)
        .setDisplaySize(BOARD_SIZE_PX + 16, BOARD_SIZE_PX + 16)
        .setDepth(1.5);
    }

    // Grid lines + star points
    this.gridGraphics = this.add.graphics().setDepth(2);
    this.drawGrid();

    // Placement preview stone (hover + tap feedback, hidden until needed)
    this.ghostStone = this.add.circle(-999, -999, STONE_RADIUS, C.blackStone, 0.28)
      .setDepth(7)
      .setVisible(false);

    // Cell hit areas
    this.cellHits = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const r = rowOf(i);
      const c = colOf(i);
      const x = BOARD_X + c * CELL_PX;
      const y = BOARD_Y + r * CELL_PX;
      const hit = this.add.rectangle(x, y, CELL_PX, CELL_PX, C.white, 0.001).setDepth(10);
      hit.setInteractive({ useHandCursor: true });
      this.bindGameButton(hit, {
        targets: hit,
        // Scaling an invisible hit rect would be meaningless; the ghost stone
        // carries the hover and press feedback instead.
        hoverScale: null,
        onHoverIn: () => this.previewCell(i),
        onHoverOut: () => this.hideGhost(),
        onPress: () => this.handleCellTap(i),
      });
      this.cellHits.push(hit);
      this.gameGroupObjects.push(hit);
    }

    // Last move indicator
    this.lastMoveIndicator = this.add.circle(-999, -999, 4, C.lastMoveDot).setDepth(8);
    if (this.textures.exists(ART.lastMove)) {
      this.lastMoveArt = this.add.image(-999, -999, ART.lastMove)
        .setDisplaySize(STONE_RADIUS * 2.2, STONE_RADIUS * 2.2)
        .setDepth(8);
    }

    // Win line graphics + glow
    this.winLineGraphics = this.add.graphics().setDepth(9);
    if (this.textures.exists(ART.winGlow)) {
      this.winGlow = this.add.image(-999, -999, ART.winGlow)
        .setDepth(8.5)
        .setVisible(false);
    }

    this.gameGroupObjects.push(
      this.boardFrame, this.boardBg, this.gridGraphics,
      this.ghostStone, this.lastMoveIndicator, this.winLineGraphics,
    );
    if (this.boardArt) this.gameGroupObjects.push(this.boardArt);
    if (this.lastMoveArt) this.gameGroupObjects.push(this.lastMoveArt);
    if (this.winGlow) this.gameGroupObjects.push(this.winGlow);
  }

  /** True when the human may legally place a stone on `index` right now. */
  private canPlace(index: number): boolean {
    if (this.str("gameStatus", "idle") !== "dealt") return false;
    if (this.bool("isPaused") || this.gameOver) return false;
    if (this.currentTurn !== 1) return false;
    return (this.board[index] ?? 0) === 0;
  }

  private previewCell(index: number): void {
    if (!this.canPlace(index)) return;
    this.showGhost(index, 0.28);
    this.animate({
      targets: this.ghostStone,
      scale: { from: 0.72, to: 1 },
      duration: 110,
      ease: "Back.easeOut",
    });
  }

  private showGhost(index: number, alpha: number): void {
    const x = BOARD_X + colOf(index) * CELL_PX;
    const y = BOARD_Y + rowOf(index) * CELL_PX;
    this.ghostStone
      .setPosition(x, y)
      .setFillStyle(this.currentTurn === 1 ? C.blackStone : C.whiteStone, alpha)
      .setScale(1)
      .setVisible(true);
  }

  private hideGhost(): void {
    this.ghostStone.setVisible(false).setPosition(-999, -999);
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    g.clear();

    // Grid lines
    g.lineStyle(1, C.gridLine, 0.8);
    for (let i = 0; i < BOARD_SIZE; i++) {
      const x = BOARD_X + i * CELL_PX;
      const y = BOARD_Y + i * CELL_PX;
      g.strokeLineShape(new Phaser.Geom.Line(
        x, BOARD_Y, x, BOARD_Y + (BOARD_SIZE - 1) * CELL_PX,
      ));
      g.strokeLineShape(new Phaser.Geom.Line(
        BOARD_X, y, BOARD_X + (BOARD_SIZE - 1) * CELL_PX, y,
      ));
    }

    // Star points
    g.fillStyle(C.starPoint, 1);
    for (const [r, c] of STAR_POINTS) {
      const x = BOARD_X + c * CELL_PX;
      const y = BOARD_Y + r * CELL_PX;
      g.fillCircle(x, y, 3.5);
    }
  }

  private buildTimerHUD(): void {
    const barW = BOARD_SIZE_PX;
    this.timerBg = this.add.rectangle(
      W / 2, TIMER_Y, barW, 10, C.white, 0.8,
    ).setStrokeStyle(1, C.boardEdge, 0.6);

    this.timerBar = this.add.rectangle(
      BOARD_X, TIMER_Y, barW, 10, C.timerFull,
    ).setOrigin(0, 0.5);

    this.timerLabel = this.add.text(BOARD_X, TIMER_Y + 12, "00:00", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#4b351c",
    }).setOrigin(0, 0);

    this.turnLabel = this.add.text(W / 2, TIMER_Y + 12, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5, 0);

    this.moveLabel = this.add.text(BOARD_X + barW, TIMER_Y + 12, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#7a5a28",
    }).setOrigin(1, 0);

    this.gameGroupObjects.push(this.timerBg, this.timerBar, this.timerLabel, this.turnLabel, this.moveLabel);
  }

  private buildToolRow(): void {
    const btnW = 90;
    const btnH = 38;
    const gap = 12;
    const totalW = btnW * 3 + gap * 2;
    const startX = (W - totalW) / 2 + btnW / 2;

    // Undo
    this.undoBtn = this.add.container(startX, TOOL_Y);
    this.undoBtnBg = this.add.rectangle(0, 0, btnW, btnH, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder);
    this.undoBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.undoBtnBg, {
      targets: this.undoBtn,
      onPress: () => this.dispatch("useUndo", {}),
    });
    const undoText = this.add.text(0, 0, DEFAULT_LABELS.undo, {
      fontFamily: FONT_FAMILY, fontSize: "12px", fontStyle: "bold", color: "#4b351c",
    }).setOrigin(0.5);
    this.undoBtn.add([this.undoBtnBg, undoText]);

    // Pause
    this.pauseBtn = this.add.container(startX + btnW + gap, TOOL_Y);
    this.pauseBtnBg = this.add.rectangle(0, 0, btnW, btnH, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder);
    this.pauseBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.pauseBtnBg, {
      targets: this.pauseBtn,
      onPress: () => this.dispatch("togglePause", {}),
    });
    this.pauseBtnText = this.add.text(0, 0, DEFAULT_LABELS.pause, {
      fontFamily: FONT_FAMILY, fontSize: "12px", fontStyle: "bold", color: "#4b351c",
    }).setOrigin(0.5);
    this.pauseBtn.add([this.pauseBtnBg, this.pauseBtnText]);

    // Restart
    this.restartBtn = this.add.container(startX + (btnW + gap) * 2, TOOL_Y);
    this.restartBtnBg = this.add.rectangle(0, 0, btnW, btnH, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder);
    this.restartBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.restartBtnBg, {
      targets: this.restartBtn,
      onPress: () => this.dispatch("restartGame", { difficulty: this.pickedDifficulty }),
    });
    const restartText = this.add.text(0, 0, DEFAULT_LABELS.restart, {
      fontFamily: FONT_FAMILY, fontSize: "12px", fontStyle: "bold", color: "#4b351c",
    }).setOrigin(0.5);
    this.restartBtn.add([this.restartBtnBg, restartText]);

    this.gameGroupObjects.push(this.undoBtn, this.pauseBtn, this.restartBtn);
  }

  private buildActionButton(): void {
    this.actionBtn = this.add.container(W / 2, ACTION_Y);
    this.actionBtnBg = this.add.rectangle(0, 0, 180, 42, C.gold)
      .setStrokeStyle(2, C.goldLight);
    this.actionBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.actionBtnBg, {
      targets: this.actionBtn,
      enabled: () => this.actionButtonEnabled,
      onPress: () => this.handleActionButton(),
    });
    this.actionBtnText = this.add.text(0, 0, DEFAULT_LABELS.act.open, {
      fontFamily: FONT_FAMILY, fontSize: "16px", fontStyle: "bold", color: "#2d2114",
    }).setOrigin(0.5);
    this.actionBtn.add([this.actionBtnBg, this.actionBtnText]);
  }

  private buildStatusLabel(): void {
    this.statusLabel = this.add.text(W / 2, STATUS_Y, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#7a5a28",
      wordWrap: { width: W - 40 },
      align: "center",
    }).setOrigin(0.5, 0);
  }

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0);
    this.diffBtns = [];

    // Title
    this.lobbyTitleText = this.add.text(W / 2, 80, DEFAULT_LABELS.lobbyTitle, {
      fontFamily: FONT_FAMILY, fontSize: "28px", fontStyle: "bold", color: "#2d2114",
    }).setOrigin(0.5);

    this.lobbySubText = this.add.text(W / 2, 114, DEFAULT_LABELS.lobbySub, {
      fontFamily: FONT_FAMILY, fontSize: "14px", color: "#7a5a28",
    }).setOrigin(0.5);

    this.lobbyContainer.add([this.lobbyTitleText, this.lobbySubText]);

    // Preview board (decorative)
    this.lobbyPreview = this.buildLobbyPreview(W / 2, 210);
    this.lobbyContainer.add(this.lobbyPreview);

    // Result seal stamped over the preview after a finished round. Kept out of
    // lobbyContainer so switchView's blanket visibility pass cannot reveal it.
    if (this.textures.exists(ART.resultSeal)) {
      this.resultSeal = this.add.image(W / 2, 210, ART.resultSeal)
        .setDisplaySize(112, 112)
        .setDepth(20)
        .setVisible(false);
    }

    // Difficulty cards
    const cardW = 110;
    const cardH = 100;
    const gap = 10;
    const startX = (W - 3 * cardW - 2 * gap) / 2 + cardW / 2;

    for (let d = 0; d < 3; d++) {
      const x = startX + d * (cardW + gap);
      const btn = this.makeDiffCard(x, 340, cardW, cardH, d);
      this.diffBtns.push(btn);
      this.lobbyContainer.add(btn);
    }
  }

  private buildLobbyPreview(cx: number, cy: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const size = 120;
    const cell = size / 8;
    const half = size / 2;

    const bg = this.add.rectangle(0, 0, size + 12, size + 12, C.boardWood)
      .setStrokeStyle(2, C.boardEdge);
    c.add(bg);

    const g = this.add.graphics();
    g.lineStyle(0.8, C.gridLine, 0.7);
    for (let i = 0; i <= 8; i++) {
      const p = -half + i * cell;
      g.strokeLineShape(new Phaser.Geom.Line(p, -half, p, half));
      g.strokeLineShape(new Phaser.Geom.Line(-half, p, half, p));
    }
    c.add(g);

    // Sample stones
    const sampleStones: Array<[number, number, number]> = [
      [3, 3, 1], [3, 4, 2], [4, 4, 1], [4, 3, 2],
      [5, 5, 1], [2, 2, 2], [5, 4, 1], [6, 6, 1],
    ];
    for (const [r, col, player] of sampleStones) {
      const x = -half + col * cell;
      const y = -half + r * cell;
      const stone = this.add.circle(x, y, cell * 0.38, player === 1 ? C.blackStone : C.whiteStone)
        .setStrokeStyle(1, player === 1 ? 0x000000 : C.whiteEdge);
      c.add(stone);
    }

    return c;
  }

  private makeDiffCard(
    x: number, y: number, cw: number, ch: number, difficulty: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, cw, ch, C.btnBg, 0.98)
      .setStrokeStyle(2, DIFF_COLORS[difficulty] ?? C.btnBorder);
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: container,
      hoverScale: 1.03,
      pressScale: 0.94,
      onPress: () => {
        this.sfx.play("select");
        this.pickedDifficulty = difficulty;
        this.dispatch("selectDifficulty", { difficulty });
        this.updateDiffCards();
      },
    });

    // Difficulty badge (painted crest, primitive stone as fallback)
    const badgeKey = ART.badges[difficulty];
    const stoneColor = difficulty === 0 ? C.diffEasy : difficulty === 1 ? C.diffMedium : C.diffHard;
    const icon = badgeKey && this.textures.exists(badgeKey)
      ? this.add.image(0, -24, badgeKey).setDisplaySize(34, 34)
      : this.add.circle(0, -24, 14, stoneColor).setStrokeStyle(2, 0xffffff, 0.6);

    const name = this.add.text(0, 4, DIFF_LABELS[difficulty] ?? "Easy", {
      fontFamily: FONT_FAMILY, fontSize: "14px", fontStyle: "bold", color: "#2d2114",
    }).setOrigin(0.5);

    const copy = this.add.text(0, 24, DIFF_COPY[difficulty] ?? "Casual AI", {
      fontFamily: FONT_FAMILY, fontSize: "10px", color: "#7a5a28",
    }).setOrigin(0.5);

    container.add([bg, icon, name, copy]);
    return container;
  }

  private buildPausedOverlay(): void {
    this.pausedOverlay = this.add.container(W / 2, BOARD_Y + BOARD_SIZE_PX / 2)
      .setDepth(30).setVisible(false);

    const scrim = this.add.rectangle(0, 0, BOARD_SIZE_PX + 20, BOARD_SIZE_PX + 20, 0xf5e6c8, 0.95)
      .setStrokeStyle(2, C.boardEdge, 0.8);

    this.pausedTitleText = this.add.text(0, -20, DEFAULT_LABELS.pausedTitle, {
      fontFamily: FONT_FAMILY, fontSize: "22px", fontStyle: "bold", color: "#2d2114",
    }).setOrigin(0.5);

    this.pausedCopyText = this.add.text(0, 12, DEFAULT_LABELS.pausedCopy, {
      fontFamily: FONT_FAMILY, fontSize: "12px", color: "#76551f", align: "center",
      wordWrap: { width: 240 },
    }).setOrigin(0.5);

    const resumeBg = this.add.rectangle(0, 60, 140, 40, C.gold)
      .setStrokeStyle(2, C.goldLight).setInteractive({ useHandCursor: true });
    this.bindGameButton(resumeBg, {
      targets: resumeBg,
      onPress: () => this.dispatch("togglePause", {}),
    });
    this.pausedResumeText = this.add.text(0, 60, DEFAULT_LABELS.resume, {
      fontFamily: FONT_FAMILY, fontSize: "14px", fontStyle: "bold", color: "#2d2114",
    }).setOrigin(0.5);

    this.pausedOverlay.add([scrim, this.pausedTitleText, this.pausedCopyText, resumeBg, this.pausedResumeText]);
    this.gameGroupObjects.push(this.pausedOverlay);
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  create(): void {
    super.create();
    this.buildBackground();
    this.fitCameraToHost();
    this.buildBoard();
    this.buildTimerHUD();
    this.buildToolRow();
    this.buildActionButton();
    this.buildStatusLabel();
    this.buildLobby();
    this.buildPausedOverlay();
    this.onStateUpdate(this.state);
  }

  update(): void {
    if (this.prevStatus !== "dealt") return;
    if (this.deadline <= 0 || this.dealtAt <= 0) return;
    if (this.bool("isPaused")) return;

    const now = Date.now();
    const second = Math.floor(now / 1_000);
    if (second === this.lastClockSecond) return;
    this.lastClockSecond = second;

    const remaining = Math.max(0, this.deadline - now);
    const total = this.deadline - this.dealtAt;
    const pct = total > 0 ? remaining / total : 0;

    this.timerBar.setSize(Math.round(BOARD_SIZE_PX * pct), 10);
    this.timerBar.setFillStyle(
      pct > 0.4 ? C.timerFull : pct > 0.15 ? C.timerMid : C.timerLow,
    );
    this.timerLabel.setText(formatClock(remaining));

    if (remaining <= 0 && !this.gameOver) {
      this.dispatch("expireGame", {});
    }
  }

  // ── View management ────────────────────────────────────────────────────────

  private switchView(view: "lobby" | "game"): void {
    const isGame = view === "game";
    this.gameGroupObjects.forEach((o) => this.setObjectActive(o, isGame));
    this.setObjectActive(this.actionBtn, true);
    this.statusLabel.setVisible(true);
    this.setObjectActive(this.lobbyContainer, !isGame);

    // Members of the game group whose visibility is conditional rather than
    // view-driven: the blanket pass above would otherwise reveal them.
    this.hideGhost();
    if (!isGame || this.winLine.length < 2) this.winGlow?.setVisible(false);
    if (!isGame || this.lastMove < 0 || this.gameOver) {
      this.lastMoveIndicator.setVisible(false);
      this.lastMoveArt?.setVisible(false);
    } else {
      this.lastMoveIndicator.setVisible(!this.lastMoveArt);
      this.lastMoveArt?.setVisible(true);
    }
  }

  private setObjectActive(object: Phaser.GameObjects.GameObject, active: boolean): void {
    (object as { setVisible?: (v: boolean) => void }).setVisible?.(active);
    const input = (object as { input?: { enabled?: boolean } }).input;
    if (input) input.enabled = active;
    if (object instanceof Phaser.GameObjects.Container) {
      object.list.forEach((child) => {
        this.setObjectActive(child as Phaser.GameObjects.GameObject, active);
      });
    }
  }

  private updateDiffCards(): void {
    this.diffBtns.forEach((btn, d) => {
      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      const active = d === this.pickedDifficulty;
      bg.setFillStyle(active ? C.btnActive : C.btnBg, active ? 1 : 0.98);
      bg.setStrokeStyle(active ? 3 : 1.5, DIFF_COLORS[d] ?? C.btnBorder);
    });
  }

  // ── Board rendering ────────────────────────────────────────────────────────

  private renderStones(): void {
    // Clear existing stones
    for (const stone of this.stones) stone?.destroy();
    for (const hl of this.stoneHighlights) hl?.destroy();
    this.stones = [];
    this.stoneHighlights = [];

    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const value = this.board[i] ?? 0;
      if (value === 0) {
        this.stones.push(null);
        this.stoneHighlights.push(null);
        continue;
      }

      const r = rowOf(i);
      const c = colOf(i);
      const x = BOARD_X + c * CELL_PX;
      const y = BOARD_Y + r * CELL_PX;

      const isBlack = value === 1;
      const artKey = isBlack ? ART.stoneBlack : ART.stoneWhite;

      let stone: Phaser.GameObjects.GameObject;
      let hl: Phaser.GameObjects.Arc | null = null;

      if (this.textures.exists(artKey)) {
        stone = this.add.image(x, y, artKey)
          .setDisplaySize(STONE_RADIUS * 2.1, STONE_RADIUS * 2.1)
          .setDepth(5);
      } else {
        stone = this.add.circle(x, y, STONE_RADIUS, isBlack ? C.blackStone : C.whiteStone)
          .setStrokeStyle(1.5, isBlack ? 0x000000 : C.whiteEdge)
          .setDepth(5);
        // Highlight (glossy effect) — the painted stones carry their own.
        hl = this.add.circle(
          x - STONE_RADIUS * 0.25, y - STONE_RADIUS * 0.25,
          STONE_RADIUS * 0.35,
          isBlack ? C.blackHighlight : C.whiteHighlight,
          isBlack ? 0.3 : 0.6,
        ).setDepth(6);
      }

      // Drop-in only for the stone that just landed. renderStones() rebuilds
      // every stone on each board update, so animating unconditionally would
      // replay the drop across the whole board.
      if (i === this.pendingDropCell) {
        this.animate({
          targets: hl ? [stone, hl] : stone,
          scale: { from: 1.55, to: 1 },
          alpha: { from: 0.35, to: 1 },
          duration: 200,
          ease: "Back.easeOut",
        });
      }

      this.stones.push(stone);
      this.stoneHighlights.push(hl);
      this.gameGroupObjects.push(stone);
      if (hl) this.gameGroupObjects.push(hl);
    }
    this.pendingDropCell = -1;

    // Last move indicator
    this.lastMovePulse?.remove();
    this.lastMovePulse = null;
    const showLastMove = this.lastMove >= 0 && !this.gameOver;
    if (showLastMove) {
      const mx = BOARD_X + colOf(this.lastMove) * CELL_PX;
      const my = BOARD_Y + rowOf(this.lastMove) * CELL_PX;
      const marker = this.lastMoveArt ?? this.lastMoveIndicator;
      marker.setPosition(mx, my).setVisible(true).setScale(1).setAlpha(1);
      this.lastMoveIndicator.setVisible(!this.lastMoveArt);
      this.lastMovePulse = this.animate({
        targets: marker,
        scale: { from: 1, to: 1.28 },
        alpha: { from: 1, to: 0.55 },
        duration: 720,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.lastMoveIndicator.setVisible(false);
      this.lastMoveArt?.setVisible(false);
    }

    // Win line
    this.winLineGraphics.clear();
    if (this.winLine.length >= 2) {
      const first = this.winLine[0]!;
      const last = this.winLine[this.winLine.length - 1]!;
      const x1 = BOARD_X + colOf(first) * CELL_PX;
      const y1 = BOARD_Y + rowOf(first) * CELL_PX;
      const x2 = BOARD_X + colOf(last) * CELL_PX;
      const y2 = BOARD_Y + rowOf(last) * CELL_PX;

      if (this.winGlow) {
        const len = Math.hypot(x2 - x1, y2 - y1) + STONE_RADIUS * 2.4;
        this.winGlow
          .setPosition((x1 + x2) / 2, (y1 + y2) / 2)
          .setDisplaySize(len, STONE_RADIUS * 2.6)
          .setRotation(Math.atan2(y2 - y1, x2 - x1))
          .setVisible(true);
        this.animate({
          targets: this.winGlow,
          alpha: { from: 0, to: 1 },
          duration: 260,
          ease: "Sine.easeOut",
        });
      }

      // Reveal the stroke by animating its end point out from the first stone.
      this.animateCounter({
        from: 0,
        to: 1,
        duration: 320,
        ease: "Cubic.easeOut",
        onUpdate: (tween) => {
          const t = Number(tween.getValue());
          this.winLineGraphics.clear();
          this.winLineGraphics.lineStyle(4, C.winLine, 0.9);
          this.winLineGraphics.strokeLineShape(new Phaser.Geom.Line(
            x1, y1, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
          ));
        },
      });
    } else {
      this.winGlow?.setVisible(false);
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  private handleCellTap(index: number): void {
    if (!this.canPlace(index)) return;

    // Commit the stone visually the moment it is tapped so the board responds
    // before the chain round-trip lands; renderStones() replaces it on update.
    this.showGhost(index, 0.72);
    this.pressFeedback(this.ghostStone, { scale: 0.82, duration: 90 });
    this.sfx.play("move");
    this.dispatch("placeStone", { cell: index });
  }

  private handleActionButton(): void {
    const gameStatus = this.str("gameStatus", "idle");
    if (this.bool("isStarting")) return;

    if (gameStatus === "dealt") return; // No action during game
    if (!this.actionButtonEnabled) return;
    this.dispatch("startGame", { difficulty: this.pickedDifficulty });
  }

  // ── State handler ──────────────────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    this.L = this.val<GomokuLabels>("labels") ?? DEFAULT_LABELS;

    const gameStatus = this.str("gameStatus", "idle");
    const isPaused = this.bool("isPaused");
    const busy = this.bool("isStarting") || this.bool("isDealing");

    this.deadline = this.num("deadline", 0);
    this.dealtAt = this.num("dealtAt", 0);
    this.pickedDifficulty = Math.max(0, Math.min(2, this.num("gameDifficulty", 0)));

    // Parse board state from lastStatus JSON
    const lastStatus = this.str("lastStatus", "");
    if (lastStatus.startsWith("{")) {
      try {
        const parsed = JSON.parse(lastStatus) as {
          type?: string;
          board?: string;
          currentTurn?: number;
          gameOver?: boolean;
          moves?: number;
        };
        if (parsed.type === "boardUpdate" && parsed.board) {
          const newBoard = parsed.board.split("").map(Number);
          if (newBoard.length === BOARD_SIZE * BOARD_SIZE) {
            // Find last move
            const prevBoard = this.board;
            let newLastMove = -1;
            for (let i = 0; i < newBoard.length; i++) {
              if (newBoard[i] !== 0 && (prevBoard[i] ?? 0) === 0) {
                newLastMove = i;
              }
            }
            this.board = newBoard;
            this.currentTurn = (parsed.currentTurn ?? 1) as 1 | 2;
            this.gameOver = parsed.gameOver ?? false;
            this.moveCount = parsed.moves ?? 0;
            if (newLastMove >= 0) {
              this.lastMove = newLastMove;
              // Hand the drop animation to renderStones() for this cell only.
              this.pendingDropCell = newLastMove;
              this.hideGhost();
            }

            // Check for win line
            if (this.gameOver && newLastMove >= 0) {
              const winner = this.board[newLastMove];
              if (winner) {
                this.winLine = this.findWinLine(newLastMove, winner as 1 | 2);
              }
            }
            this.renderStones();
          }
        }
      } catch {
        // Not JSON, treat as status message
      }
    }

    // View routing
    const isGame = gameStatus === "dealt";
    this.switchView(isGame ? "game" : "lobby");
    this.setObjectActive(this.pausedOverlay, isGame && isPaused);

    if (!isGame) {
      // Lobby
      this.updateDiffCards();
      this.actionButtonEnabled = !busy;
      this.showResultSeal(gameStatus);

      if (gameStatus === "solved") {
        this.actionBtnText.setText(this.L.act.playAgain);
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.green);
        this.actionBtnBg.setStrokeStyle(2, 0x3cbf66);
        this.statusLabel.setText(this.L.resultWin);
      } else if (gameStatus === "expired") {
        this.actionBtnText.setText(this.L.act.tryAgain);
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.red);
        this.actionBtnBg.setStrokeStyle(2, 0xe27d66);
        this.statusLabel.setText(this.L.resultLose);
      } else {
        this.actionBtnText.setText(busy ? this.L.act.starting : this.L.act.open);
        this.actionBtnText.setColor("#2d2114");
        this.actionBtnBg.setFillStyle(busy ? 0xf1e0be : C.gold);
        this.actionBtnBg.setStrokeStyle(2, C.goldLight);
        this.statusLabel.setText(this.L.lobbySub);
      }
    } else {
      // Game view
      this.actionButtonEnabled = false;
      this.turnLabel.setText(
        this.gameOver
          ? ""
          : this.currentTurn === 1
            ? this.L.yourTurn
            : this.L.aiThinking,
      );
      this.moveLabel.setText(`#${this.moveCount}`);
      this.pauseBtnText.setText(isPaused ? this.L.resume : this.L.pause);

      if (!isPaused && !this.gameOver) {
        this.statusLabel.setText(
          this.currentTurn === 1 ? this.L.yourTurn : this.L.aiThinking,
        );
      }
      this.resultSeal?.setVisible(false);
    }

    this.prevStatus = gameStatus;
  }

  /** Stamps the win seal over the lobby preview, once per transition. */
  private showResultSeal(gameStatus: string): void {
    const seal = this.resultSeal;
    if (!seal) return;
    if (gameStatus !== "solved") {
      seal.setVisible(false);
      return;
    }
    const alreadyShown = seal.visible;
    seal.setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    if (!alreadyShown) {
      this.animate({
        targets: seal,
        scale: { from: 1.5, to: 1 },
        alpha: { from: 0, to: 1 },
        angle: { from: -14, to: 0 },
        duration: 300,
        ease: "Back.easeOut",
      });
    }
  }

  private findWinLine(lastCell: number, player: 1 | 2): number[] {
    const directions: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const r = rowOf(lastCell);
    const c = colOf(lastCell);

    for (const [dr, dc] of directions) {
      const line: number[] = [lastCell];
      for (let step = 1; step < 5; step++) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        const ni = idx(nr, nc);
        if (this.board[ni] !== player) break;
        line.push(ni);
      }
      for (let step = 1; step < 5; step++) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        const ni = idx(nr, nc);
        if (this.board[ni] !== player) break;
        line.unshift(ni);
      }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return [];
  }

  // ── Responsive ─────────────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, DESIGN_H / 2);
  }
}
