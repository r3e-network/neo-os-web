/**
 * SudokuScene — Phaser 3 scene for the Sudoku miniapp.
 *
 * Renders a full Sudoku game inside the Phaser canvas:
 *  - Lobby with three sealed puzzle routes
 *  - 9×9 grid on loaded paper/cell art with bold 3×3 box borders
 *  - Given cells, placed cells, selected cells, and conflict cells use real art
 *  - Digit picker 1–9 and Undo button below the grid
 *  - Timer bar + reward-percentage HUD
 *  - Submit / Start buttons
 *
 * State consumed from React bridge:
 *   gameStatus   "idle"|"committed"|"dealt"|"solved"|"expired"
 *   clues        81-char string "0"=empty, "1"-"9"=given digit
 *   undosUsed    number
 *   deadline     number  (Unix ms; 0 while idle)
 *   dealtAt      number  (Unix ms; 0 while idle)
 *   gameDifficulty number
 *   poolFree     number
 *   isStarting / isDealing / isSubmitting / isUndoing  boolean
 *   lastStatus   string
 *
 * Actions dispatched to React:
 *   startGame        { difficulty: 0|1|2 }
 *   recordMove       { cell: 0-80, digit: 1-9 }
 *   useUndo          {}
 *   submitSolution   { solution: "123..." }
 *   expireGame       {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  MAX_UNDOS,
  rewardPctAfterUndos,
  ruleOf,
  formatClock,
} from "../logic/game-rules";

// ── Layout constants ───────────────────────────────────────────────────────────
const W         = 400;
const H         = 600;
const CELL      = 36;                           // px per cell
const GRID_W    = 9 * CELL;                     // 324
const GRID_X    = (W - GRID_W) / 2;            // 38  — left edge of grid
const GRID_Y    = 64;                           // top edge of grid
const DIGIT_Y   = GRID_Y + GRID_W + 22;        // digit bar center y  (~398)
const UNDO_Y    = DIGIT_Y + 52;                 // undo button center  (~450)
const ACTION_Y  = UNDO_Y + 52;                  // submit/start center (~502)
const STATUS_Y  = ACTION_Y + 46;               // status text         (~548)
const TIMER_Y   = 20;                           // timer bar center y

const FONT_FAMILY = "Inter, Arial, sans-serif";

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  appBg:         0xfff8ea,
  appBgWarm:     0xffefd0,
  paper:         0xfffbf1,
  paperEdge:     0xe8c982,
  gridLine:      0xd7c4a2,
  boxLine:       0x6c5230,
  selRing:       0xf0b733,
  selRingInner:  0xffe9a6,
  digitGiven:    0x2d2114,
  digitPlayer:   0x175f91,
  digitConflict: 0xc83c21,
  gold:          0xd4a843,
  goldLight:     0xf0c866,
  goldDark:      0x8a6820,
  btnBg:         0xfffbf1,
  btnBorder:     0xd9bf85,
  btnActive:     0xffe3a8,
  btnText:       0x4b351c,
  timerFull:     0x4aaa55,
  timerMid:      0xd4a843,
  timerLow:      0xcc4422,
  white:         0xffffff,
  muted:         0xb38b55,
  red:           0xcc2200,
  green:         0x1a7a30,
  diffEasy:      0x6dbf7b,
  diffMedium:    0xdbab40,
  diffHard:      0xdd6958,
} as const;

// ── Difficulty display data ────────────────────────────────────────────────────
const DIFF_LABELS  = ["Easy", "Medium", "Hard"] as const;
const DIFF_COLORS  = [C.diffEasy, C.diffMedium, C.diffHard] as const;
const DIFF_REWARDS = ["0.1 GAS", "0.5 GAS", "1.0 GAS"] as const;
const DIFF_COPY    = ["Warm-up grid", "Ranked grid", "Master grid"] as const;

const SUDOKU_ASSETS = {
  paperGrid: "sudoku-paper-grid",
  cellGiven: "sudoku-cell-given",
  cellPlaced: "sudoku-cell-placed",
  cellSelected: "sudoku-cell-selected",
  cellConflict: "sudoku-cell-conflict",
  noteToken: "sudoku-note-token",
  pencil: "sudoku-pencil",
  rewardTrophy: "sudoku-reward-trophy",
  sealedEnvelope: "sudoku-sealed-envelope",
  solvedBadge: "sudoku-solved-badge",
  seals: ["sudoku-seal-easy", "sudoku-seal-medium", "sudoku-seal-hard"],
} as const;

// ── Move history entry ─────────────────────────────────────────────────────────
interface MoveEntry { cell: number; prev: number; }

// ─────────────────────────────────────────────────────────────────────────────
export class SudokuScene extends BaseScene {

  // ── Local game state ───────────────────────────────────────────────────────
  private board: number[]       = Array(81).fill(0);
  private given: boolean[]      = Array(81).fill(false);
  private selectedCell          = -1;
  private conflicts             = new Set<number>();
  private moveHistory: MoveEntry[] = [];
  private prevClues             = "";
  private prevStatus            = "";
  private pickedDifficulty      = 0;
  private deadline              = 0;
  private dealtAt               = 0;
  private boardComplete         = false;

  // ── Scene-level display objects ────────────────────────────────────────────

  // Grid
  private paperBoard!: Phaser.GameObjects.Image;
  private cellArt!:   Phaser.GameObjects.Image[];
  private cellHit!:   Phaser.GameObjects.Rectangle[];
  private cellText!: Phaser.GameObjects.Text[];
  private gridLines!: Phaser.GameObjects.Graphics;
  private selRing!:   Phaser.GameObjects.Rectangle;

  // HUD
  private timerBg!:    Phaser.GameObjects.Rectangle;
  private timerBar!:   Phaser.GameObjects.Rectangle;
  private timerLabel!: Phaser.GameObjects.Text;
  private rewardLabel!: Phaser.GameObjects.Text;

  // Digit picker
  private digitBtns!: Phaser.GameObjects.Container[];

  // Undo button
  private undoBtn!:     Phaser.GameObjects.Container;
  private undoBtnText!: Phaser.GameObjects.Text;
  private undoButtonEnabled = false;

  // Action button (Start / Submit)
  private actionBtn!:     Phaser.GameObjects.Container;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnBg!:   Phaser.GameObjects.Rectangle;
  private actionButtonEnabled = false;

  // Status
  private statusLabel!: Phaser.GameObjects.Text;

  // Lobby
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffBtns!: Phaser.GameObjects.Container[];
  private lobbyPoolText!: Phaser.GameObjects.Text;
  private lobbyTitleText!: Phaser.GameObjects.Text;
  private lobbySubText!: Phaser.GameObjects.Text;
  private lobbyRewardArt!: Phaser.GameObjects.Image;
  private lobbyResultBadge!: Phaser.GameObjects.Image;

  // Dealing overlay
  private dealingContainer!: Phaser.GameObjects.Container;
  private dealingDots: Phaser.GameObjects.Arc[] = [];

  // Game group (all non-lobby objects)
  private gameGroupObjects: Phaser.GameObjects.GameObject[] = [];

  // ── Constructor ────────────────────────────────────────────────────────────
  constructor() { super("SudokuScene"); }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildBackground(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.appBg);
    this.add.rectangle(W / 2, 118, W, 236, C.appBgWarm, 0.68);
    this.add.rectangle(W / 2, H - 82, W - 28, 150, C.paper, 0.62)
      .setStrokeStyle(1, C.paperEdge, 0.35);
  }

  private buildGrid(): void {
    this.cellArt  = [];
    this.cellHit  = [];
    this.cellText = [];

    this.paperBoard = this.add.image(W / 2, GRID_Y + GRID_W / 2, SUDOKU_ASSETS.paperGrid)
      .setDisplaySize(GRID_W + 28, GRID_W + 28)
      .setAlpha(0.98);
    this.gameGroupObjects.push(this.paperBoard);

    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const cx  = GRID_X + col * CELL + CELL / 2;
      const cy  = GRID_Y + row * CELL + CELL / 2;

      const art = this.add.image(cx, cy, SUDOKU_ASSETS.cellPlaced)
        .setDisplaySize(CELL - 3, CELL - 3)
        .setAlpha(0.32);

      const txt = this.add.text(cx, cy, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#2d2114",
      }).setOrigin(0.5).setAlpha(0).setDepth(8);

      const hit = this.add.rectangle(cx, cy, CELL, CELL, C.white, 0.001)
        .setDepth(9);
      hit.setInteractive({ useHandCursor: true });
      this.bindGameButton(hit, {
        targets: art,
        hoverScale: 1.035,
        pressScale: 0.94,
        onHoverIn: () => {
          if (i !== this.selectedCell) art.setAlpha(Math.min(1, art.alpha + 0.14));
        },
        onHoverOut: () => this.renderBoard(),
        onPress: () => this.handleCellTap(i),
      });

      this.cellArt.push(art);
      this.cellHit.push(hit);
      this.cellText.push(txt);
      this.gameGroupObjects.push(art, txt, hit);
    }

    // Grid line graphics (thin cell lines + thick box lines)
    this.gridLines = this.add.graphics();
    this.drawGridLines();
    this.gameGroupObjects.push(this.gridLines);

    // Selection ring (moved per selection; hidden by default)
    this.selRing = this.add.rectangle(-999, -999, CELL + 2, CELL + 2)
      .setStrokeStyle(3, C.selRing)
      .setFillStyle(C.selRingInner, 0.25)
      .setDepth(6);
    this.gameGroupObjects.push(this.selRing);
  }

  private drawGridLines(): void {
    const g = this.gridLines;
    g.clear();

    // Thin cell lines
    g.lineStyle(0.5, C.gridLine, 0.6);
    for (let i = 0; i <= 9; i++) {
      const x = GRID_X + i * CELL;
      const y = GRID_Y + i * CELL;
      g.strokeLineShape(new Phaser.Geom.Line(x, GRID_Y, x, GRID_Y + GRID_W));
      g.strokeLineShape(new Phaser.Geom.Line(GRID_X, y, GRID_X + GRID_W, y));
    }

    // Thick box lines (every 3 cells)
    g.lineStyle(2.5, C.boxLine, 1);
    for (let b = 0; b <= 3; b++) {
      const x = GRID_X + b * CELL * 3;
      const y = GRID_Y + b * CELL * 3;
      g.strokeLineShape(new Phaser.Geom.Line(x, GRID_Y, x, GRID_Y + GRID_W));
      g.strokeLineShape(new Phaser.Geom.Line(GRID_X, y, GRID_X + GRID_W, y));
    }
  }

  private buildTimerHUD(): void {
    // Timer track background
    this.timerBg = this.add.rectangle(
      GRID_X + GRID_W / 2, TIMER_Y, GRID_W, 12, C.white, 0.82,
    ).setStrokeStyle(1, C.paperEdge, 0.72);

    // Timer fill bar (starts at full width)
    this.timerBar = this.add.rectangle(
      GRID_X, TIMER_Y, GRID_W, 12, C.timerFull,
    ).setOrigin(0, 0.5);

    this.timerLabel = this.add.text(GRID_X + GRID_W / 2, TIMER_Y + 14, "00:00", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#4b351c",
    }).setOrigin(0.5, 0);

    this.rewardLabel = this.add.text(GRID_X + GRID_W - 2, TIMER_Y + 14, "100%", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#8a6820",
    }).setOrigin(1, 0);

    this.gameGroupObjects.push(
      this.timerBg, this.timerBar, this.timerLabel, this.rewardLabel,
    );
  }

  private buildDigitBar(): void {
    this.digitBtns = [];
    for (let d = 1; d <= 9; d++) {
      const x = GRID_X + (d - 1) * CELL + CELL / 2;
      const btn = this.makeSmallBtn(x, DIGIT_Y, CELL - 3, 38, String(d), () => {
        this.handleDigitTap(d);
      });
      this.digitBtns.push(btn);
      this.gameGroupObjects.push(btn);
    }
  }

  private buildUndoButton(): void {
    this.undoBtn = this.add.container(W / 2, UNDO_Y);

    const bg = this.add.rectangle(0, 0, 168, 38, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: this.undoBtn,
      enabled: () => this.undoButtonEnabled,
      onHoverIn: () => bg.setFillStyle(C.btnActive),
      onHoverOut: () => bg.setFillStyle(C.btnBg),
      onPress: () => this.handleUndo(),
    });

    const pencil = this.add.image(-58, 0, SUDOKU_ASSETS.pencil)
      .setDisplaySize(24, 24);

    this.undoBtnText = this.add.text(12, 0, "Undo (3 left)", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      color: "#4b351c",
    }).setOrigin(0.5);

    this.undoBtn.add([bg, pencil, this.undoBtnText]);
    this.gameGroupObjects.push(this.undoBtn);
  }

  private buildActionButton(): void {
    this.actionBtn = this.add.container(W / 2, ACTION_Y);

    this.actionBtnBg = this.add.rectangle(0, 0, 200, 42, C.gold)
      .setStrokeStyle(2, C.goldLight)
      .setOrigin(0.5);
    this.actionBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.actionBtnBg, {
      targets: this.actionBtn,
      enabled: () => this.actionButtonEnabled,
      onPress: () => this.handleActionButton(),
    });

    this.actionBtnText = this.add.text(0, 0, "Start game", {
      fontFamily: FONT_FAMILY,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    this.actionBtn.add([this.actionBtnBg, this.actionBtnText]);
    // Action button is part of both views — keep in game group but manage separately
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

    const envelope = this.add.image(W / 2, 72, SUDOKU_ASSETS.sealedEnvelope)
      .setDisplaySize(92, 74)
      .setAlpha(0.96);

    // Lobby title
    this.lobbyTitleText = this.add.text(W / 2, 132, "Sudoku Vault", {
      fontFamily: FONT_FAMILY,
      fontSize: "26px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    this.lobbySubText = this.add.text(W / 2, 162, "Pick a sealed puzzle route", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      color: "#7a5a28",
    }).setOrigin(0.5);

    this.lobbyContainer.add([envelope, this.lobbyTitleText, this.lobbySubText]);

    // 3 difficulty seal buttons
    const cardW  = 104;
    const cardH  = 130;
    const startX = (W - 3 * cardW - 2 * 10) / 2 + cardW / 2; // 10px gap

    for (let d = 0; d < 3; d++) {
      const x   = startX + d * (cardW + 10);
      const btn = this.makeDiffCard(x, 270, cardW, cardH, d);
      this.diffBtns.push(btn);
      this.lobbyContainer.add(btn);
    }

    // Pool info
    this.lobbyPoolText = this.add.text(W / 2, 364, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#7a5a28",
      align: "center",
    }).setOrigin(0.5);

    this.lobbyRewardArt = this.add.image(W / 2 - 38, 420, SUDOKU_ASSETS.rewardTrophy)
      .setDisplaySize(58, 58)
      .setAlpha(0.82);
    this.lobbyResultBadge = this.add.image(W / 2 + 38, 420, SUDOKU_ASSETS.solvedBadge)
      .setDisplaySize(58, 58)
      .setAlpha(0.42);

    this.lobbyContainer.add([
      this.lobbyPoolText,
      this.lobbyRewardArt,
      this.lobbyResultBadge,
    ]);
  }

  private makeDiffCard(
    x: number, y: number, cw: number, ch: number, difficulty: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, cw, ch, C.btnBg, 0.98)
      .setStrokeStyle(2, DIFF_COLORS[difficulty] ?? C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: container,
      hoverScale: 1.03,
      pressScale: 0.94,
      onPress: () => {
        this.pickedDifficulty = difficulty;
        this.updateDiffCards();
      },
    });

    const seal = this.add.image(0, -34, SUDOKU_ASSETS.seals[difficulty] ?? SUDOKU_ASSETS.seals[0])
      .setDisplaySize(58, 58);

    const name = this.add.text(0, 5, DIFF_LABELS[difficulty] ?? "Easy", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    const route = this.add.text(0, 25, DIFF_COPY[difficulty] ?? "Warm-up grid", {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#7a5a28",
    }).setOrigin(0.5);

    const reward = this.add.text(0, 44, DIFF_REWARDS[difficulty] ?? "0.1 GAS", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#8a6820",
    }).setOrigin(0.5);

    container.add([bg, seal, name, route, reward]);
    return container;
  }

  private buildDealingOverlay(): void {
    this.dealingContainer = this.add.container(W / 2, H / 2);
    this.dealingContainer.setDepth(20);

    const overlay = this.add.rectangle(0, 0, W, H, 0xfff4dd, 0.88).setOrigin(0.5);
    const envelope = this.add.image(0, -54, SUDOKU_ASSETS.sealedEnvelope)
      .setDisplaySize(112, 90);

    const title = this.add.text(0, 24, "Sealing puzzle...", {
      fontFamily: FONT_FAMILY,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    const dot1 = this.add.circle(-24, 62, 5, C.gold).setOrigin(0.5);
    const dot2 = this.add.circle(0,   62, 5, C.gold).setOrigin(0.5);
    const dot3 = this.add.circle(24,  62, 5, C.gold).setOrigin(0.5);
    this.dealingDots = [dot1, dot2, dot3];

    this.dealingContainer.add([overlay, envelope, title, dot1, dot2, dot3]);
    this.dealingContainer.setVisible(false);

    // Animate dots
    [dot1, dot2, dot3].forEach((dot, i) => {
      this.tweens.add({
        targets: dot,
        alpha: 0.2,
        duration: 400,
        delay: i * 150,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  /** Compact button helper for digit bar */
  private makeSmallBtn(
    x: number, y: number, bw: number, bh: number, label: string, cb: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.image(0, 0, SUDOKU_ASSETS.noteToken)
      .setDisplaySize(bw, bh)
      .setAlpha(0.92);
    const hit = this.add.rectangle(0, 0, bw, bh, C.white, 0.001);
    hit.setInteractive({ useHandCursor: true });
    this.bindGameButton(hit, {
      targets: c,
      hoverScale: 1.07,
      pressScale: 0.9,
      onHoverIn: () => bg.setAlpha(1),
      onHoverOut: () => bg.setAlpha(0.92),
      onPress: () => {
        cb();
      },
    });

    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#4b351c",
    }).setOrigin(0.5);
    c.add([bg, txt, hit]);
    return c;
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(SUDOKU_ASSETS.paperGrid, "./paper-grid.webp");
    this.load.image(SUDOKU_ASSETS.cellGiven, "./art/cell-given.webp");
    this.load.image(SUDOKU_ASSETS.cellPlaced, "./art/cell-placed.webp");
    this.load.image(SUDOKU_ASSETS.cellSelected, "./art/cell-selected.webp");
    this.load.image(SUDOKU_ASSETS.cellConflict, "./art/cell-conflict.webp");
    this.load.image(SUDOKU_ASSETS.noteToken, "./art/note-token.webp");
    this.load.image(SUDOKU_ASSETS.pencil, "./art/pencil.webp");
    this.load.image(SUDOKU_ASSETS.rewardTrophy, "./art/reward-trophy.webp");
    this.load.image(SUDOKU_ASSETS.sealedEnvelope, "./art/sealed-envelope.webp");
    this.load.image(SUDOKU_ASSETS.solvedBadge, "./art/solved-badge.webp");
    this.load.image(SUDOKU_ASSETS.seals[0], "./art/seal-easy.webp");
    this.load.image(SUDOKU_ASSETS.seals[1], "./art/seal-medium.webp");
    this.load.image(SUDOKU_ASSETS.seals[2], "./art/seal-hard.webp");
  }

  create(): void {
    super.create(); // wires bridge

    this.buildBackground();
    this.buildGrid();
    this.buildTimerHUD();
    this.buildDigitBar();
    this.buildUndoButton();
    this.buildActionButton();
    this.buildStatusLabel();
    this.buildLobby();
    this.buildDealingOverlay();

    // Seed from current bridge state
    this.onStateUpdate(this.state);
  }

  update(): void {
    if (this.prevStatus !== "dealt") return;
    if (this.deadline <= 0 || this.dealtAt <= 0) return;

    const now       = Date.now();
    const remaining = Math.max(0, this.deadline - now);
    const total     = this.deadline - this.dealtAt;
    const pct       = total > 0 ? remaining / total : 0;

    // Update timer bar width
    const fullW = GRID_W;
    this.timerBar.setSize(Math.round(fullW * pct), 12);
    this.timerBar.setFillStyle(
      pct > 0.4 ? C.timerFull : pct > 0.15 ? C.timerMid : C.timerLow,
    );

    this.timerLabel.setText(formatClock(remaining));

    // Auto-expire when time runs out
    if (remaining <= 0 && !this.bool("isSubmitting") && !this.bool("isUndoing")) {
      this.dispatch("expireGame", {});
    }
  }

  // ── View helpers ───────────────────────────────────────────────────────────

  private switchView(view: "lobby" | "game" | "dealing"): void {
    const isGame    = view === "game";
    const isLobby   = view === "lobby";
    const isDealing = view === "dealing";

    this.gameGroupObjects.forEach((o) => this.setObjectActive(o, isGame));

    // Action button participates in both lobby (start) and game (submit)
    this.setObjectActive(this.actionBtn, isGame || isLobby);
    this.statusLabel.setVisible(true);
    this.setObjectActive(this.lobbyContainer, isLobby);
    this.setObjectActive(this.dealingContainer, isDealing);
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

  private updateDiffCards(): void {
    this.diffBtns.forEach((btn, d) => {
      const bg     = btn.list[0] as Phaser.GameObjects.Rectangle;
      const seal   = btn.list[1] as Phaser.GameObjects.Image;
      const active = d === this.pickedDifficulty;
      bg.setFillStyle(active ? C.btnActive : C.btnBg, active ? 1 : 0.98);
      bg.setStrokeStyle(active ? 3 : 1.5, DIFF_COLORS[d] ?? C.btnBorder);
      seal.setAlpha(active ? 1 : 0.72);
      seal.setDisplaySize(active ? 64 : 58, active ? 64 : 58);
    });
  }

  // ── BaseScene: state handler ───────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const undosUsed  = this.num("undosUsed", 0);
    const deadline   = this.num("deadline", 0);
    const dealtAt    = this.num("dealtAt", 0);
    const poolFree   = this.num("poolFree", 0);
    const lastStatus = this.str("lastStatus", "");
    const busy       =
      this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isUndoing");

    this.deadline = deadline;
    this.dealtAt  = dealtAt;
    this.actionButtonEnabled = false;
    this.undoButtonEnabled = false;

    // ── View routing ──────────────────────────────────────────────────────
    const isDealing =
      gameStatus === "committed" || (gameStatus === "dealt" && !clues);
    const isGame =
      gameStatus === "dealt" && /^[0-9]{81}$/.test(clues);
    const isLobby = !isDealing && !isGame;

    if (isDealing) {
      this.switchView("dealing");
    } else if (isGame) {
      this.switchView("game");
    } else {
      this.switchView("lobby");
    }

    // ── Lobby view ────────────────────────────────────────────────────────
    if (isLobby) {
      const rule = ruleOf(this.pickedDifficulty);
      const limitMin = Math.round(rule.limitMs / 60_000);
      this.lobbyPoolText.setText(
        `Pool: ${poolFree.toFixed(2)} GAS  ·  ${limitMin} min limit`,
      );
      this.updateDiffCards();
      this.actionButtonEnabled = !busy;

      if (gameStatus === "solved") {
        this.actionBtnText.setText("Play again");
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.green);
        this.actionBtnBg.setStrokeStyle(2, 0x3cbf66);
        this.lobbyRewardArt.setAlpha(0.95);
        this.lobbyResultBadge.setAlpha(1);
      } else if (gameStatus === "expired") {
        this.actionBtnText.setText("Try again");
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.red);
        this.actionBtnBg.setStrokeStyle(2, 0xe27d66);
        this.lobbyRewardArt.setAlpha(0.58);
        this.lobbyResultBadge.setAlpha(0.34);
      } else {
        this.actionBtnText.setText(busy ? "Starting..." : "Start game");
        this.actionBtnText.setColor("#2d2114");
        this.actionBtnBg.setFillStyle(busy ? C.muted : C.gold);
        this.actionBtnBg.setStrokeStyle(2, C.goldLight);
        this.lobbyRewardArt.setAlpha(0.82);
        this.lobbyResultBadge.setAlpha(0.42);
      }
    }

    // ── Game view ─────────────────────────────────────────────────────────
    if (isGame) {
      // (Re)initialise when a new puzzle lands
      if (clues !== this.prevClues) {
        this.prevClues = clues;
        this.initBoard(clues);
      }

      const undosLeft = MAX_UNDOS - undosUsed;
      const rewardPct = rewardPctAfterUndos(undosUsed);
      this.rewardLabel.setText(`${rewardPct}%`);
      this.undoBtnText.setText(
        undosLeft > 0 ? `Undo (${undosLeft} left)` : "No undos left",
      );

      this.setUndoButtonState(undosLeft > 0 && !busy && this.moveHistory.length > 0);

      this.setGameActionState(busy);
    }

    this.prevStatus = gameStatus;
    this.statusLabel.setText(lastStatus);
  }

  // ── Board initialisation ───────────────────────────────────────────────────

  private initBoard(clues: string): void {
    this.board        = Array(81).fill(0);
    this.given        = Array(81).fill(false);
    this.moveHistory  = [];
    this.selectedCell = -1;
    this.conflicts    = new Set();
    this.boardComplete = false;

    for (let i = 0; i < 81; i++) {
      const d = parseInt(clues[i] ?? "0", 10);
      if (d >= 1 && d <= 9) {
        this.board[i] = d;
        this.given[i] = true;
      }
    }

    this.selRing.setPosition(-999, -999);
    this.renderBoard();
  }

  // ── Board rendering ────────────────────────────────────────────────────────

  private renderBoard(): void {
    this.conflicts = this.computeConflicts(this.board);
    this.boardComplete = this.checkBoardComplete();

    for (let i = 0; i < 81; i++) {
      const digit    = this.board[i] ?? 0;
      const isGiven  = this.given[i] ?? false;
      const isSelected  = i === this.selectedCell;
      const isConflict  = this.conflicts.has(i);

      const art = this.cellArt[i]!;
      const hit = this.cellHit[i]!;
      art.clearTint();

      let texture = SUDOKU_ASSETS.cellPlaced;
      let alpha = digit ? 0.9 : 0.28;
      if (isGiven) {
        texture = SUDOKU_ASSETS.cellGiven;
        alpha = 0.98;
      }
      if (isSelected) {
        texture = SUDOKU_ASSETS.cellSelected;
        alpha = 1;
      }
      if (isConflict) {
        texture = SUDOKU_ASSETS.cellConflict;
        alpha = 1;
      }

      // Highlight cells in the same row / col / box as selection
      if (this.selectedCell >= 0 && !isSelected && !isConflict) {
        const selRow = Math.floor(this.selectedCell / 9);
        const selCol = this.selectedCell % 9;
        const row    = Math.floor(i / 9);
        const col    = i % 9;
        const sameBox =
          Math.floor(row / 3) === Math.floor(selRow / 3) &&
          Math.floor(col / 3) === Math.floor(selCol / 3);
        if (row === selRow || col === selCol || sameBox) {
          alpha = Math.max(alpha, isGiven ? 0.86 : 0.46);
          art.setTint(0xffe8b5);
        }
      }

      art.setTexture(texture);
      art.setAlpha(alpha);
      hit.setAlpha(0.001);

      // ── Text ─────────────────────────────────────────────────────────
      const txt = this.cellText[i]!;
      if (digit > 0) {
        txt.setText(String(digit));
        txt.setColor(
          isConflict
            ? "#cc2200"
            : isGiven
              ? "#2a1a08"
              : "#1a4a8f",
        );
        txt.setAlpha(1);
      } else {
        txt.setAlpha(0);
      }
    }

    // ── Selection ring ────────────────────────────────────────────────────
    if (this.selectedCell >= 0) {
      const row = Math.floor(this.selectedCell / 9);
      const col = this.selectedCell % 9;
      const cx  = GRID_X + col * CELL + CELL / 2;
      const cy  = GRID_Y + row * CELL + CELL / 2;
      this.selRing.setPosition(cx, cy);
      this.selRing.setStrokeStyle(3, C.selRing);
      this.selRing.setFillStyle(C.selRingInner, 0.2);
    } else {
      this.selRing.setPosition(-999, -999);
    }
  }

  private setUndoButtonState(enabled: boolean): void {
    this.undoButtonEnabled = enabled;
    const undoBg = this.undoBtn.list[0] as Phaser.GameObjects.Rectangle;
    undoBg.setFillStyle(enabled ? C.btnBg : 0xf1e0be);
    undoBg.setAlpha(enabled ? 1 : 0.72);
  }

  private setGameActionState(busy: boolean): void {
    if (this.boardComplete && !busy) {
      this.actionButtonEnabled = true;
      this.actionBtnText.setText("Submit solution");
      this.actionBtnText.setColor("#ffffff");
      this.actionBtnBg.setFillStyle(C.green);
      this.actionBtnBg.setStrokeStyle(2, 0x3cbf66);
    } else if (busy) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText("Submitting...");
      this.actionBtnText.setColor("#ffffff");
      this.actionBtnBg.setFillStyle(C.muted);
      this.actionBtnBg.setStrokeStyle(2, C.btnBorder);
    } else {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText("Solve to unlock");
      this.actionBtnText.setColor("#7a5a28");
      this.actionBtnBg.setFillStyle(0xf1e0be);
      this.actionBtnBg.setStrokeStyle(1.5, C.btnBorder, 0.8);
    }
  }

  // ── Interaction handlers ───────────────────────────────────────────────────

  private handleCellTap(index: number): void {
    const gameStatus = this.str("gameStatus", "idle");
    if (gameStatus !== "dealt") return;

    if (this.selectedCell === index) {
      // Tap same cell → deselect
      this.selectedCell = -1;
    } else {
      this.selectedCell = index;
    }
    this.renderBoard();
  }

  private handleDigitTap(digit: number): void {
    const gameStatus = this.str("gameStatus", "idle");
    const busy =
      this.bool("isSubmitting") || this.bool("isUndoing") || this.bool("isDealing");

    if (gameStatus !== "dealt" || busy) return;
    if (this.selectedCell < 0) return;
    if (this.given[this.selectedCell]) return; // cannot overwrite given cells

    const prev = this.board[this.selectedCell] ?? 0;
    this.moveHistory.push({ cell: this.selectedCell, prev });

    this.board[this.selectedCell] = digit;
    this.renderBoard();
    this.setUndoButtonState(MAX_UNDOS - this.num("undosUsed", 0) > 0);
    this.setGameActionState(false);

    // Micro-bounce on the selected cell
    const art = this.cellArt[this.selectedCell];
    if (art) {
      this.pressFeedback(art, { scale: 1.12, duration: 60 });
    }

    // Fire-and-forget telemetry to the React/chain layer
    void this.bridge.dispatch("recordMove", { cell: this.selectedCell, digit });
  }

  private handleUndo(): void {
    const gameStatus = this.str("gameStatus", "idle");
    const busy = this.bool("isSubmitting") || this.bool("isUndoing");
    const undosLeft = MAX_UNDOS - this.num("undosUsed", 0);

    if (gameStatus !== "dealt" || busy || undosLeft <= 0) return;
    if (this.moveHistory.length === 0) return;

    // Optimistic local rollback — the on-chain ledger is updated via dispatch
    const last = this.moveHistory.pop()!;
    this.board[last.cell] = last.prev;
    this.selectedCell = last.cell;
    this.renderBoard();
    this.setUndoButtonState(
      MAX_UNDOS - this.num("undosUsed", 0) > 0 && this.moveHistory.length > 0,
    );
    this.setGameActionState(false);

    void this.bridge.dispatch("useUndo", {});
  }

  private handleActionButton(): void {
    const gameStatus = this.str("gameStatus", "idle");
    const busy =
      this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isUndoing");

    if (busy) return;

    if (gameStatus === "dealt") {
      if (!this.boardComplete) return;
      const solution = this.getBoardSolutionString();
      void this.bridge.dispatch("submitSolution", { solution });
    } else {
      // Lobby / idle / solved / expired
      void this.bridge.dispatch("startGame", { difficulty: this.pickedDifficulty });
    }
  }

  // ── Sudoku logic helpers ───────────────────────────────────────────────────

  private computeConflicts(board: number[]): Set<number> {
    const conflicts = new Set<number>();

    for (let i = 0; i < 81; i++) {
      const digit = board[i];
      if (!digit) continue;

      const row    = Math.floor(i / 9);
      const col    = i % 9;
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;

      // Same row
      for (let c = 0; c < 9; c++) {
        const j = row * 9 + c;
        if (j !== i && board[j] === digit) {
          conflicts.add(i);
          conflicts.add(j);
        }
      }

      // Same column
      for (let r = 0; r < 9; r++) {
        const j = r * 9 + col;
        if (j !== i && board[j] === digit) {
          conflicts.add(i);
          conflicts.add(j);
        }
      }

      // Same 3×3 box
      for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
          const j = (boxRow + br) * 9 + (boxCol + bc);
          if (j !== i && board[j] === digit) {
            conflicts.add(i);
            conflicts.add(j);
          }
        }
      }
    }

    return conflicts;
  }

  private checkBoardComplete(): boolean {
    return (
      this.board.every((d) => d > 0) &&
      this.computeConflicts(this.board).size === 0
    );
  }

  private getBoardSolutionString(): string {
    return this.board.map((d) => (d > 0 ? String(d) : "0")).join("");
  }

  // ── Responsive resize ──────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    // Restart the scene to rebuild layout at new dimensions
    this.scene.restart();
  }
}
