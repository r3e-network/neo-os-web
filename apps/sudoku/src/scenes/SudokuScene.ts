/**
 * SudokuScene — Phaser 3 scene for the Sudoku miniapp.
 *
 * Renders a full Sudoku game inside the Phaser canvas:
 *  - Lobby with 3 difficulty seal badges
 *  - 9×9 grid with warm paper aesthetic, bold 3×3 box borders
 *  - Given cells (grey bg, bold dark digit), player cells (white bg, blue digit)
 *  - Gold selection ring, red-tint conflict highlight
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
const GRID_Y    = 52;                           // top edge of grid
const DIGIT_Y   = GRID_Y + GRID_W + 22;        // digit bar center y  (~398)
const UNDO_Y    = DIGIT_Y + 52;                 // undo button center  (~450)
const ACTION_Y  = UNDO_Y + 52;                  // submit/start center (~502)
const STATUS_Y  = ACTION_Y + 46;               // status text         (~548)
const TIMER_Y   = 20;                           // timer bar center y

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  paper:         0xf5e6c8,
  paperEdge:     0xe8d0a0,
  tableCloth:    0x3d2410,
  gridLine:      0xb09070,
  boxLine:       0x4a2c10,
  cellGiven:     0xd8c89a,
  cellPlayer:    0xfaf6ee,
  cellEmpty:     0xf0e4c0,
  cellConflict:  0xffddcc,
  selRing:       0xd4a843,
  selRingInner:  0xfce88a,
  digitGiven:    0x2a1a08,
  digitPlayer:   0x1a4a8f,
  digitConflict: 0xcc2200,
  gold:          0xd4a843,
  goldLight:     0xf0c866,
  goldDark:      0x8a6820,
  btnBg:         0x2a1a08,
  btnBorder:     0x7a5a28,
  btnActive:     0xb8860b,
  btnText:       0xd4a843,
  timerFull:     0x4aaa55,
  timerMid:      0xd4a843,
  timerLow:      0xcc4422,
  white:         0xffffff,
  muted:         0xa08060,
  red:           0xcc2200,
  green:         0x1a7a30,
  diffEasy:      0x2a7a3a,
  diffMedium:    0x8a6a10,
  diffHard:      0x7a1a10,
} as const;

// ── Difficulty display data ────────────────────────────────────────────────────
const DIFF_LABELS  = ["Easy", "Medium", "Hard"] as const;
const DIFF_ICONS   = ["◆", "◆◆", "◆◆◆"] as const;   // drawn text symbols, no emoji
const DIFF_COLORS  = [C.diffEasy, C.diffMedium, C.diffHard] as const;
const DIFF_REWARDS = ["0.1 GAS", "0.5 GAS", "1.0 GAS"] as const;

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
  private cellBg!:   Phaser.GameObjects.Rectangle[];
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

  // Action button (Start / Submit)
  private actionBtn!:     Phaser.GameObjects.Container;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnBg!:   Phaser.GameObjects.Rectangle;

  // Status
  private statusLabel!: Phaser.GameObjects.Text;

  // Lobby
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffBtns!: Phaser.GameObjects.Container[];
  private lobbyPoolText!: Phaser.GameObjects.Text;
  private lobbyTitleText!: Phaser.GameObjects.Text;
  private lobbySubText!: Phaser.GameObjects.Text;

  // Dealing overlay
  private dealingContainer!: Phaser.GameObjects.Container;
  private dealingDots: Phaser.GameObjects.Text[] = [];

  // Game group (all non-lobby objects)
  private gameGroupObjects: Phaser.GameObjects.GameObject[] = [];

  // ── Constructor ────────────────────────────────────────────────────────────
  constructor() { super("SudokuScene"); }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildBackground(): void {
    // Dark tablecloth surround
    this.add.rectangle(W / 2, H / 2, W, H, C.tableCloth);
    // Warm paper area
    this.add.rectangle(W / 2, H / 2, W - 8, H - 8, C.paper)
      .setStrokeStyle(3, C.paperEdge);
  }

  private buildGrid(): void {
    this.cellBg   = [];
    this.cellText = [];

    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const cx  = GRID_X + col * CELL + CELL / 2;
      const cy  = GRID_Y + row * CELL + CELL / 2;

      const bg = this.add.rectangle(cx, cy, CELL - 1, CELL - 1, C.cellEmpty)
        .setStrokeStyle(0.5, C.gridLine);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.handleCellTap(i));
      bg.on("pointerover", () => {
        if (i !== this.selectedCell) bg.setAlpha(0.85);
      });
      bg.on("pointerout", () => bg.setAlpha(1));

      const txt = this.add.text(cx, cy, "", {
        fontSize: "20px",
        fontStyle: "bold",
        color: "#2a1a08",
      }).setOrigin(0.5).setAlpha(0);

      this.cellBg.push(bg);
      this.cellText.push(txt);
      this.gameGroupObjects.push(bg, txt);
    }

    // Grid line graphics (thin cell lines + thick box lines)
    this.gridLines = this.add.graphics();
    this.drawGridLines();
    this.gameGroupObjects.push(this.gridLines);

    // Selection ring (moved per selection; hidden by default)
    this.selRing = this.add.rectangle(-999, -999, CELL + 2, CELL + 2)
      .setStrokeStyle(3, C.selRing)
      .setFillStyle(C.selRingInner, 0.25)
      .setDepth(10);
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
      GRID_X + GRID_W / 2, TIMER_Y, GRID_W, 12, 0x000000, 80,
    ).setStrokeStyle(1, C.boxLine);

    // Timer fill bar (starts at full width)
    this.timerBar = this.add.rectangle(
      GRID_X, TIMER_Y, GRID_W, 12, C.timerFull,
    ).setOrigin(0, 0.5);

    this.timerLabel = this.add.text(GRID_X + GRID_W / 2, TIMER_Y + 14, "00:00", {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#5a3e28",
    }).setOrigin(0.5, 0);

    this.rewardLabel = this.add.text(GRID_X + GRID_W - 2, TIMER_Y + 14, "100%", {
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

    const bg = this.add.rectangle(0, 0, 160, 36, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.handleUndo());
    bg.on("pointerover", () => bg.setFillStyle(0x3a2a10));
    bg.on("pointerout",  () => bg.setFillStyle(C.btnBg));

    this.undoBtnText = this.add.text(0, 0, "↩ Undo (3 left)", {
      fontSize: "13px",
      color: "#d4a843",
    }).setOrigin(0.5);

    this.undoBtn.add([bg, this.undoBtnText]);
    this.gameGroupObjects.push(this.undoBtn);
  }

  private buildActionButton(): void {
    this.actionBtn = this.add.container(W / 2, ACTION_Y);

    this.actionBtnBg = this.add.rectangle(0, 0, 200, 42, C.gold)
      .setStrokeStyle(2, C.goldLight)
      .setOrigin(0.5);
    this.actionBtnBg.setInteractive({ useHandCursor: true });
    this.actionBtnBg.on("pointerover", () =>
      this.tweens.add({ targets: this.actionBtn, scale: 1.04, duration: 80 }),
    );
    this.actionBtnBg.on("pointerout", () =>
      this.tweens.add({ targets: this.actionBtn, scale: 1.0, duration: 80 }),
    );
    this.actionBtnBg.on("pointerdown", () => this.handleActionButton());

    this.actionBtnText = this.add.text(0, 0, "▶ Start Game", {
      fontSize: "17px",
      fontStyle: "bold",
      color: "#2a1a08",
    }).setOrigin(0.5);

    this.actionBtn.add([this.actionBtnBg, this.actionBtnText]);
    // Action button is part of both views — keep in game group but manage separately
  }

  private buildStatusLabel(): void {
    this.statusLabel = this.add.text(W / 2, STATUS_Y, "", {
      fontSize: "12px",
      color: "#8a6820",
      wordWrap: { width: W - 40 },
    }).setOrigin(0.5, 0);
  }

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0);
    this.diffBtns = [];

    // Lobby title
    this.lobbyTitleText = this.add.text(W / 2, 68, "SUDOKU", {
      fontSize: "28px",
      fontStyle: "bold",
      color: "#2a1a08",
    }).setOrigin(0.5);

    this.lobbySubText = this.add.text(W / 2, 104, "Choose difficulty to begin", {
      fontSize: "13px",
      color: "#8a6820",
    }).setOrigin(0.5);

    this.lobbyContainer.add([this.lobbyTitleText, this.lobbySubText]);

    // 3 difficulty seal buttons
    const cardW  = 104;
    const cardH  = 130;
    const startX = (W - 3 * cardW - 2 * 10) / 2 + cardW / 2; // 10px gap

    for (let d = 0; d < 3; d++) {
      const x   = startX + d * (cardW + 10);
      const btn = this.makeDiffCard(x, 210, cardW, cardH, d);
      this.diffBtns.push(btn);
      this.lobbyContainer.add(btn);
    }

    // Pool info
    this.lobbyPoolText = this.add.text(W / 2, 300, "", {
      fontSize: "12px",
      color: "#8a6820",
      align: "center",
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.lobbyPoolText);
  }

  private makeDiffCard(
    x: number, y: number, cw: number, ch: number, difficulty: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, cw, ch, C.btnBg)
      .setStrokeStyle(2, DIFF_COLORS[difficulty] ?? C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.pickedDifficulty = difficulty;
      this.updateDiffCards();
      this.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 60, yoyo: true });
    });

    const iconLbl = this.add.text(0, -38, DIFF_ICONS[difficulty] ?? "◆", {
      fontSize: "18px",
      fontStyle: "bold",
      color: `#${DIFF_COLORS[difficulty]?.toString(16).padStart(6, "0") ?? "d4a843"}`,
    }).setOrigin(0.5);

    const name = this.add.text(0, -8, DIFF_LABELS[difficulty] ?? "Easy", {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#f0e4c0",
    }).setOrigin(0.5);

    const reward = this.add.text(0, 14, DIFF_REWARDS[difficulty] ?? "0.1 GAS", {
      fontSize: "12px",
      color: "#d4a843",
    }).setOrigin(0.5);

    const pick = this.add.text(0, 38, "tap to pick", {
      fontSize: "10px",
      color: "#a08060",
    }).setOrigin(0.5).setName("pick-hint");

    container.add([bg, iconLbl, name, reward, pick]);
    return container;
  }

  private buildDealingOverlay(): void {
    this.dealingContainer = this.add.container(W / 2, H / 2);
    this.dealingContainer.setDepth(20);

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 140).setOrigin(0.5);

    const title = this.add.text(0, -40, "Shuffling puzzle…", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#f5e6c8",
    }).setOrigin(0.5);

    const dot1 = this.add.text(-30, 10, "●", { fontSize: "16px", color: "#d4a843" }).setOrigin(0.5);
    const dot2 = this.add.text(0,   10, "●", { fontSize: "16px", color: "#d4a843" }).setOrigin(0.5);
    const dot3 = this.add.text(30,  10, "●", { fontSize: "16px", color: "#d4a843" }).setOrigin(0.5);
    this.dealingDots = [dot1, dot2, dot3];

    this.dealingContainer.add([overlay, title, dot1, dot2, dot3]);
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
    const bg = this.add.rectangle(0, 0, bw, bh, C.btnBg)
      .setStrokeStyle(1, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.tweens.add({ targets: c, scaleX: 0.88, scaleY: 0.88, duration: 55, yoyo: true });
      cb();
    });
    bg.on("pointerover", () => bg.setFillStyle(0x3a2a10));
    bg.on("pointerout",  () => bg.setFillStyle(C.btnBg));

    const txt = this.add.text(0, 0, label, {
      fontSize: "16px",
      fontStyle: "bold",
      color: "#d4a843",
    }).setOrigin(0.5);
    c.add([bg, txt]);
    return c;
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    // All rendering uses Phaser primitives — no external assets needed.
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

    this.gameGroupObjects.forEach((o) => {
      (o as { setVisible?: (v: boolean) => void }).setVisible?.(isGame);
    });

    // Action button participates in both lobby (start) and game (submit)
    this.actionBtn.setVisible(isGame || isLobby);
    this.statusLabel.setVisible(true);
    this.lobbyContainer.setVisible(isLobby);
    this.dealingContainer.setVisible(isDealing);
  }

  private updateDiffCards(): void {
    this.diffBtns.forEach((btn, d) => {
      const bg     = btn.list[0] as Phaser.GameObjects.Rectangle;
      const active = d === this.pickedDifficulty;
      bg.setFillStyle(active ? (DIFF_COLORS[d] ?? C.btnBg) : C.btnBg);
      bg.setStrokeStyle(active ? 3 : 1.5, DIFF_COLORS[d] ?? C.btnBorder);
    });
  }

  // ── BaseScene: state handler ───────────────────────────────────────────────

  protected onStateUpdate(state: GameState): void {
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

      if (gameStatus === "solved") {
        this.actionBtnText.setText("▶ Play Again");
        this.actionBtnBg.setFillStyle(C.green);
      } else if (gameStatus === "expired") {
        this.actionBtnText.setText("▶ Try Again");
        this.actionBtnBg.setFillStyle(C.red);
      } else {
        this.actionBtnText.setText(busy ? "Starting…" : "▶ Start Game");
        this.actionBtnBg.setFillStyle(busy ? C.muted : C.gold);
      }
      this.actionBtnBg.setInteractive(!busy ? { useHandCursor: true } : {});
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
        undosLeft > 0 ? `↩ Undo (${undosLeft} left)` : "↩ No undos left",
      );

      const undoBg = this.undoBtn.list[0] as Phaser.GameObjects.Rectangle;
      undoBg.setFillStyle(undosLeft > 0 && !busy ? C.btnBg : 0x1a1208);

      if (this.boardComplete && !busy) {
        this.actionBtnText.setText("✓ Submit Solution");
        this.actionBtnBg.setFillStyle(C.green);
      } else if (busy) {
        this.actionBtnText.setText("Submitting…");
        this.actionBtnBg.setFillStyle(C.muted);
      } else {
        this.actionBtnText.setText("Fill the grid…");
        this.actionBtnBg.setFillStyle(C.muted);
      }
      this.actionBtnBg.setInteractive(
        this.boardComplete && !busy ? { useHandCursor: true } : {},
      );
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

      // ── Background colour ──────────────────────────────────────────────
      let bgColor: number = C.cellEmpty;
      if (isGiven)    bgColor = C.cellGiven;
      else if (digit) bgColor = C.cellPlayer;

      if (isConflict) bgColor = C.cellConflict;

      const bg = this.cellBg[i]!;
      bg.setFillStyle(bgColor);

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
          // subtle warm tint on peers
          bg.setFillStyle(isGiven ? 0xcabf9a : 0xf8eedd);
        }
      }

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

    // Micro-bounce on the selected cell
    const bg = this.cellBg[this.selectedCell];
    if (bg) {
      this.tweens.add({ targets: bg, scaleX: 1.12, scaleY: 1.12, duration: 60, yoyo: true });
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
