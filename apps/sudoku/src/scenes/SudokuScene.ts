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
  GAMEFI_NEW_ENTRIES_ENABLED,
  MAX_UNDOS,
  rewardPctAfterUndos,
  ruleOf,
  formatClock,
  gasDisplay,
} from "../logic/game-rules";
import {
  applyUndo,
  clearNotes,
  eraseLocalCell,
  persistBoard,
  placeDigit,
  restoreBoard,
  setLocalDigit,
  toggleNote,
  type BoardState,
} from "../logic/board-store";

// ── Layout constants ───────────────────────────────────────────────────────────
const DESIGN_W  = 400;
const DESIGN_H  = 600;
const W         = DESIGN_W;
const H         = DESIGN_H;
const CELL      = 36;                           // px per cell
const GRID_W    = 9 * CELL;                     // 324
const GRID_X    = (W - GRID_W) / 2;            // 38  — left edge of grid
const GRID_Y    = 64;                           // top edge of grid
const DIGIT_Y   = GRID_Y + GRID_W + 22;        // digit bar center y  (~398)
const TOOL_Y    = DIGIT_Y + 52;                 // notes/clear/undo/hint row (~450)
const ACTION_Y  = TOOL_Y + 54;                  // submit/start center (~504)
const STATUS_Y  = ACTION_Y + 34;               // status text         (~538)
const TIMER_Y   = 20;                           // timer bar center y

const FONT_FAMILY = "Inter, Arial, sans-serif";
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  appBg:         0xfff8ea,
  appBgWarm:     0xffefd0,
  paper:         0xffffff,   // crisp white grid paper (closer to classic Sudoku)
  paperEdge:     0xcccccc,   // neutral grey frame instead of gold
  gridLine:      0xcccccc,   // light-grey thin cell lines
  boxLine:       0x1a1a1a,   // near-black 3×3 box separators
  selRing:       0xf0b733,
  selRingInner:  0xffe9a6,
  digitGiven:    0x2d2114,
  digitPlayer:   0x175f91,
  digitConflict: 0x8f1d12,
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
  sealedEnvelope: "sudoku-sealed-envelope",
  solvedBadge: "sudoku-solved-badge",
  seals: ["sudoku-seal-easy", "sudoku-seal-medium", "sudoku-seal-hard"],
} as const;

// ── Localised canvas labels (pushed from the React shell via bridgeState) ──────
interface SudokuLabels {
  vaultTitle: string;
  vaultSub: string;
  diffNames: string[];
  diffCopy: string[];
  diffRewards: string[];
  sealing: string;
  undoTemplate: string;
  undoNone: string;
  undo: string;
  notes: string;
  notesOn: string;
  erase: string;
  hint: string;
  hintTemplate: string;
  pause: string;
  resume: string;
  restart: string;
  pausedTitle: string;
  pausedCopy: string;
  conflict: string;
  selectCell: string;
  givenLocked: string;
  placedLocked: string;
  eraseFirst: string;
  keyboardHelp: string;
  syncFailed: string;
  gameFiUnavailable: string;
  boardReady: string;
  poolTemplate: string;
  gateConnect: string;
  gateChecking: string;
  gateRouteLocked: string;
  gatePoolLow: string;
  gateChoose: string;
  act: {
    open: string;
    playAgain: string;
    tryAgain: string;
    starting: string;
    connect: string;
    maintenance: string;
    routeLocked: string;
    poolLow: string;
    submit: string;
    submitting: string;
    working: string;
    timeUp: string;
    tooLate: string;
    wait: string;
    solve: string;
    recover: string;
  };
  msg: {
    deadlinePassed: string;
    deadlineClose: string;
    submitUnlock: string;
  };
  resultSolved: string;
  resultExpired: string;
}

// English fallback — used before the React shell pushes its first snapshot and
// in standalone dev, so the scene always renders complete copy.
const DEFAULT_LABELS: SudokuLabels = {
  vaultTitle: "Sudoku Vault",
  vaultSub: "Pick a sealed puzzle route",
  diffNames: [...DIFF_LABELS],
  diffCopy: [...DIFF_COPY],
  diffRewards: [...DIFF_REWARDS],
  sealing: "Sealing your puzzle…",
  undoTemplate: "Undo ({left} left)",
  undoNone: "No undos left",
  undo: "Undo",
  notes: "Notes",
  notesOn: "Notes on",
  erase: "Clear",
  hint: "Hint",
  hintTemplate: "Hint {left}",
  pause: "Pause",
  resume: "Resume",
  restart: "New board",
  pausedTitle: "Puzzle paused",
  pausedCopy: "Your local clock is frozen.",
  conflict: "Conflict highlighted — undo the latest final digit.",
  selectCell: "Select an empty cell first",
  givenLocked: "This clue is fixed",
  placedLocked: "Placed digits are final; use undo",
  eraseFirst: "Erase this digit before adding candidates",
  keyboardHelp: "Arrows move · 1–9 enter · N notes · Backspace erase · U undo",
  syncFailed: "Move not sealed — restored safely. Check the session before continuing.",
  gameFiUnavailable: "Verified GAS entries are temporarily unavailable.",
  boardReady: "Board complete — submit to verify",
  poolTemplate: "Pool: {pool} GAS  ·  {min} min limit",
  gateConnect: "Connect wallet to open a sealed board",
  gateChecking: "Checking account route history",
  gateRouteLocked: "Clear {difficulty} before replaying this route",
  gatePoolLow: "Pool low ({have} / {need} GAS reward needed)",
  gateChoose: "Choose a route, then open the board",
  act: {
    open: "Open board",
    playAgain: "Play again",
    tryAgain: "Try again",
    starting: "Starting…",
    connect: "Connect wallet",
    maintenance: "GAS mode paused",
    routeLocked: "Route locked",
    poolLow: "Pool low",
    submit: "Submit solution",
    submitting: "Submitting…",
    working: "Working…",
    timeUp: "Time is up",
    tooLate: "Too late to submit",
    wait: "Wait to submit",
    solve: "Solve to unlock",
    recover: "Recover session",
  },
  msg: {
    deadlinePassed: "Deadline passed. Release this board to start a new one.",
    deadlineClose: "Too close to the deadline for settlement.",
    submitUnlock: "Submission unlocks in {clock}",
  },
  resultSolved: "Reward secured",
  resultExpired: "Board released",
};

// ── Move history entry ─────────────────────────────────────────────────────────
interface MoveEntry { cell: number; prev: number; }

interface A11yCommand {
  nonce: number;
  type: "select-cell" | "digit" | "toggle-notes" | "clear-notes" | "undo" | "submit";
  cell?: number;
  digit?: number;
}

interface SudokuBoardSnapshot {
  entries: number[];
  given: boolean[];
  notes: number[];
  selectedCell: number;
  notesMode: boolean;
  conflicts: number[];
  complete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
export class SudokuScene extends BaseScene {

  // ── Local game state ───────────────────────────────────────────────────────
  private board: number[]       = Array(81).fill(0);
  private given: boolean[]      = Array(81).fill(false);
  private notes: number[]       = Array(81).fill(0);
  private notesMode             = false;
  private selectedCell          = -1;
  private conflicts             = new Set<number>();
  private moveHistory: MoveEntry[] = [];
  private prevClues             = "";
  private prevStatus            = "";
  private pickedDifficulty      = 0;
  private deadline              = 0;
  private dealtAt               = 0;
  private boardComplete         = false;
  private boardReadyAnnounced   = false;
  private expireDispatched      = false;
  private L: SudokuLabels       = DEFAULT_LABELS;

  // ── Scene-level display objects ────────────────────────────────────────────

  // Responsive background plates
  private backgroundBase!: Phaser.GameObjects.Rectangle;
  private backgroundWarm!: Phaser.GameObjects.Rectangle;
  private backgroundPaper!: Phaser.GameObjects.Rectangle;

  // Grid
  private paperBoard!: Phaser.GameObjects.Image;
  private cellArt!:   Phaser.GameObjects.Image[];
  private cellHit!:   Phaser.GameObjects.Rectangle[];
  private cellText!: Phaser.GameObjects.Text[];
  private cellNoteText!: Phaser.GameObjects.Text[];
  private gridLines!: Phaser.GameObjects.Graphics;
  private selRing!:   Phaser.GameObjects.Rectangle;

  // HUD
  private timerBg!:    Phaser.GameObjects.Rectangle;
  private timerBar!:   Phaser.GameObjects.Rectangle;
  private timerLabel!: Phaser.GameObjects.Text;
  private rewardLabel!: Phaser.GameObjects.Text;

  // Digit picker
  private digitBtns!: Phaser.GameObjects.Container[];

  // Tool row
  private notesBtn!:    Phaser.GameObjects.Container;
  private notesBtnBg!:  Phaser.GameObjects.Rectangle;
  private notesBtnText!: Phaser.GameObjects.Text;
  private clearBtn!:    Phaser.GameObjects.Container;
  private clearBtnBg!:  Phaser.GameObjects.Rectangle;
  private clearBtnText!: Phaser.GameObjects.Text;
  private hintBtn!:     Phaser.GameObjects.Container;
  private hintBtnBg!:   Phaser.GameObjects.Rectangle;
  private hintBtnText!: Phaser.GameObjects.Text;
  private undoBtn!:     Phaser.GameObjects.Container;
  private undoBtnBg!:   Phaser.GameObjects.Rectangle;
  private undoBtnText!: Phaser.GameObjects.Text;
  private undoButtonEnabled = false;

  // Action button (Start / Submit)
  private actionBtn!:     Phaser.GameObjects.Container;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnBg!:   Phaser.GameObjects.Rectangle;
  private actionButtonEnabled = false;

  private pausedOverlay!: Phaser.GameObjects.Container;
  private pausedTitle!: Phaser.GameObjects.Text;
  private pausedCopy!: Phaser.GameObjects.Text;
  private pausedResumeText!: Phaser.GameObjects.Text;

  // Status
  private statusLabel!: Phaser.GameObjects.Text;

  // Lobby
  private lobbyContainer!: Phaser.GameObjects.Container;
  private diffBtns!: Phaser.GameObjects.Container[];
  private diffNameTexts: Phaser.GameObjects.Text[] = [];
  private diffRouteTexts: Phaser.GameObjects.Text[] = [];
  private diffRewardTexts: Phaser.GameObjects.Text[] = [];
  private lobbyPoolText!: Phaser.GameObjects.Text;
  private lobbyTitleText!: Phaser.GameObjects.Text;
  private lobbySubText!: Phaser.GameObjects.Text;
  private lobbyMiniGrid!: Phaser.GameObjects.Container;
  private lobbyRewardArt!: Phaser.GameObjects.Image;
  private lobbyResultBadge!: Phaser.GameObjects.Image;
  private lobbyResultCaption!: Phaser.GameObjects.Text;

  // Dealing overlay
  private dealingContainer!: Phaser.GameObjects.Container;
  private dealingTitle!: Phaser.GameObjects.Text;
  private dealingDots: Phaser.GameObjects.Arc[] = [];
  private lastHintNonce = 0;
  private lastRollbackNonce = 0;
  private lastUndoNonce = 0;
  private lastBoardRecoveryNonce = 0;
  private lastA11yCommandNonce = 0;
  private lastClockSecond = -1;
  private keyHandler?: (event: KeyboardEvent) => void;

  // Game group (all non-lobby objects)
  private gameGroupObjects: Phaser.GameObjects.GameObject[] = [];

  // ── Constructor ────────────────────────────────────────────────────────────
  constructor() { super("SudokuScene"); }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildBackground(): void {
    this.backgroundBase = this.add.rectangle(W / 2, H / 2, W, H, C.appBg)
      .setDepth(-12);
    this.backgroundWarm = this.add.rectangle(W / 2, 118, W, 236, C.appBgWarm, 0.68)
      .setDepth(-11);
    this.backgroundPaper = this.add.rectangle(W / 2, H - 82, W - 28, 150, C.paper, 0.62)
      .setDepth(-10)
      .setStrokeStyle(1, C.paperEdge, 0.35);
  }

  private renderResponsiveStage(
    visibleWorldW: number,
    visibleWorldH: number,
    centerY: number,
  ): void {
    if (!this.backgroundBase || !this.backgroundWarm || !this.backgroundPaper) return;

    const viewTop = centerY - visibleWorldH / 2;
    const viewBottom = centerY + visibleWorldH / 2;
    const stageW = Math.max(W, visibleWorldW + 40);
    const stageH = Math.max(H, visibleWorldH + 34);
    const stageCenterY = viewTop + stageH / 2;
    // Warm header wash always ends on a fixed design line just above the
    // difficulty card row (cards top ≈ 212), so no colour seam ever cuts across
    // the cards regardless of viewport height.
    const WARM_BOTTOM = 202;
    const warmH = Math.max(140, WARM_BOTTOM - viewTop);
    const paperH = Math.max(150, Math.min(stageH * 0.22, 190));

    this.backgroundBase
      .setPosition(W / 2, stageCenterY)
      .setSize(stageW, stageH);
    this.backgroundWarm
      .setPosition(W / 2, viewTop + warmH / 2)
      .setSize(stageW, warmH);
    this.backgroundPaper
      .setPosition(W / 2, viewBottom - paperH / 2 - 8)
      .setSize(Math.max(W - 28, visibleWorldW + 10), paperH);
  }

  private buildGrid(): void {
    this.cellArt  = [];
    this.cellHit  = [];
    this.cellText = [];
    this.cellNoteText = [];

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
        .setAlpha(0.14);

      const txt = this.add.text(cx, cy, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#2d2114",
      }).setOrigin(0.5).setAlpha(0).setDepth(8);

      const noteTxt = this.add.text(cx, cy, "", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "7px",
        fontStyle: "bold",
        color: "#047857",
        align: "center",
        lineSpacing: -2,
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
      this.cellNoteText.push(noteTxt);
      this.gameGroupObjects.push(art, txt, noteTxt, hit);
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

  private makeToolButton(
    x: number,
    label: string,
    onPress: () => void,
    enabled: () => boolean,
    asset?: string,
  ): {
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  } {
    const container = this.add.container(x, TOOL_Y);
    const bg = this.add.rectangle(0, 0, 78, 42, C.btnBg)
      .setStrokeStyle(1.5, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: container,
      enabled,
      onHoverIn: () => bg.setFillStyle(C.btnActive),
      onHoverOut: () => this.refreshToolButtons(),
      onPress,
    });

    container.add(bg);
    const textX = asset ? 10 : 0;
    if (asset) {
      container.add(this.add.image(-23, 0, asset).setDisplaySize(22, 22));
    }
    const text = this.add.text(textX, 0, label, {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#4b351c",
      align: "center",
    }).setOrigin(0.5);
    container.add(text);
    return { container, bg, text };
  }

  private buildToolRow(): void {
    const xs = [71, 157, 243, 329];

    const notes = this.makeToolButton(
      xs[0]!,
      DEFAULT_LABELS.notes,
      () => this.toggleNotesMode(),
      () => this.canEditBoard(),
      SUDOKU_ASSETS.pencil,
    );
    this.notesBtn = notes.container;
    this.notesBtnBg = notes.bg;
    this.notesBtnText = notes.text;

    const clear = this.makeToolButton(
      xs[1]!,
      DEFAULT_LABELS.erase,
      () => this.handleEraseSelection(),
      () => this.canEraseSelection(),
    );
    this.clearBtn = clear.container;
    this.clearBtnBg = clear.bg;
    this.clearBtnText = clear.text;

    const undo = this.makeToolButton(
      xs[2]!,
      DEFAULT_LABELS.undo,
      () => this.handleUndo(),
      () => this.undoButtonEnabled,
    );
    this.undoBtn = undo.container;
    this.undoBtnBg = undo.bg;
    this.undoBtnText = undo.text;

    const hint = this.makeToolButton(
      xs[3]!,
      DEFAULT_LABELS.hintTemplate.replace("{left}", "3"),
      () => this.handleHint(),
      () => this.canRequestHint(),
    );
    this.hintBtn = hint.container;
    this.hintBtnBg = hint.bg;
    this.hintBtnText = hint.text;

    this.gameGroupObjects.push(this.notesBtn, this.clearBtn, this.undoBtn, this.hintBtn);
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

    this.actionBtnText = this.add.text(0, 0, DEFAULT_LABELS.act.open, {
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

  private buildPausedOverlay(): void {
    this.pausedOverlay = this.add.container(W / 2, GRID_Y + GRID_W / 2)
      .setDepth(30)
      .setVisible(false);
    const scrim = this.add.rectangle(0, 0, GRID_W + 18, GRID_W + 18, 0xfff8e8, 0.965)
      .setStrokeStyle(2, C.paperEdge, 0.85);
    const art = this.add.image(0, -62, SUDOKU_ASSETS.sealedEnvelope)
      .setDisplaySize(72, 58);
    this.pausedTitle = this.add.text(0, -6, DEFAULT_LABELS.pausedTitle, {
      fontFamily: FONT_FAMILY,
      fontSize: "21px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);
    this.pausedCopy = this.add.text(0, 25, DEFAULT_LABELS.pausedCopy, {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#76551f",
      align: "center",
      wordWrap: { width: 250 },
    }).setOrigin(0.5);
    const resumeBg = this.add.rectangle(0, 78, 150, 42, C.gold)
      .setStrokeStyle(2, C.goldLight)
      .setInteractive({ useHandCursor: true });
    this.bindGameButton(resumeBg, {
      targets: resumeBg,
      onPress: () => this.dispatch("togglePause", {}),
    });
    this.pausedResumeText = this.add.text(0, 78, DEFAULT_LABELS.resume, {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);
    this.pausedOverlay.add([
      scrim, art, this.pausedTitle, this.pausedCopy, resumeBg, this.pausedResumeText,
    ]);
    this.gameGroupObjects.push(this.pausedOverlay);
  }

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0);
    this.diffBtns = [];
    this.diffNameTexts = [];
    this.diffRouteTexts = [];
    this.diffRewardTexts = [];

    const envelope = this.add.image(W / 2, 70, SUDOKU_ASSETS.sealedEnvelope)
      .setDisplaySize(88, 71)
      .setAlpha(0.96);

    // Lobby title
    this.lobbyTitleText = this.add.text(W / 2, 128, DEFAULT_LABELS.vaultTitle, {
      fontFamily: FONT_FAMILY,
      fontSize: "26px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    this.lobbySubText = this.add.text(W / 2, 158, DEFAULT_LABELS.vaultSub, {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      color: "#7a5a28",
    }).setOrigin(0.5);

    this.lobbyContainer.add([envelope, this.lobbyTitleText, this.lobbySubText]);

    // 3 difficulty seal buttons — tighter cards so the seal + text stack keeps a
    // clean vertical rhythm instead of a dead gap mid-card.
    const cardW  = 104;
    const cardH  = 112;
    const startX = (W - 3 * cardW - 2 * 10) / 2 + cardW / 2; // 10px gap

    for (let d = 0; d < 3; d++) {
      const x   = startX + d * (cardW + 10);
      const btn = this.makeDiffCard(x, 268, cardW, cardH, d);
      this.diffBtns.push(btn);
      this.lobbyContainer.add(btn);
    }

    // Pool info
    this.lobbyPoolText = this.add.text(W / 2, 336, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#7a5a28",
      align: "center",
    }).setOrigin(0.5);
    this.lobbyContainer.add(this.lobbyPoolText);

    // Idle-state genre signal: a small decorative Sudoku preview grid anchors
    // the lower lobby so the canvas reads as Sudoku before a board is dealt.
    this.lobbyMiniGrid = this.buildLobbyMiniGrid(W / 2, 410);
    this.lobbyContainer.add(this.lobbyMiniGrid);

    // Result art (difficulty seal + solved badge) — shown only after a solve/expiry, in
    // the same lower zone the preview grid occupies while idle.
    this.lobbyRewardArt = this.add.image(W / 2 - 40, 400, SUDOKU_ASSETS.seals[0])
      .setDisplaySize(58, 58)
      .setAlpha(0.95);
    this.lobbyResultBadge = this.add.image(W / 2 + 40, 400, SUDOKU_ASSETS.solvedBadge)
      .setDisplaySize(58, 58)
      .setAlpha(1);
    this.lobbyResultCaption = this.add.text(W / 2, 444, DEFAULT_LABELS.resultSolved, {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#8a6820",
    }).setOrigin(0.5);

    this.lobbyContainer.add([
      this.lobbyRewardArt,
      this.lobbyResultBadge,
      this.lobbyResultCaption,
    ]);
  }

  /** Small decorative 9×9 preview grid for the idle lobby (presentation only). */
  private buildLobbyMiniGrid(cx: number, cy: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const MG   = 108;            // grid pixel extent
    const cell = MG / 9;
    const half = MG / 2;

    const backing = this.add.image(0, 0, SUDOKU_ASSETS.paperGrid)
      .setDisplaySize(MG + 18, MG + 18)
      .setAlpha(0.96);

    const g = this.add.graphics();
    g.lineStyle(0.5, C.gridLine, 0.6);
    for (let i = 0; i <= 9; i++) {
      const p = -half + i * cell;
      g.strokeLineShape(new Phaser.Geom.Line(p, -half, p, half));
      g.strokeLineShape(new Phaser.Geom.Line(-half, p, half, p));
    }
    g.lineStyle(2.5, C.boxLine, 0.95);
    for (let b = 0; b <= 3; b++) {
      const p = -half + b * cell * 3;
      g.strokeLineShape(new Phaser.Geom.Line(p, -half, p, half));
      g.strokeLineShape(new Phaser.Geom.Line(-half, p, half, p));
    }

    c.add([backing, g]);

    // A handful of sample givens (decorative — not a solvable board).
    const sample: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0, 5], [0, 3, 8], [0, 7, 1], [1, 1, 3], [1, 4, 6], [1, 8, 7],
      [2, 2, 9], [2, 5, 2], [3, 0, 6], [3, 4, 4], [4, 3, 7], [4, 5, 3],
      [4, 8, 8], [5, 4, 1], [6, 1, 2], [6, 6, 5], [7, 0, 4], [7, 3, 9],
      [7, 7, 6], [8, 2, 8], [8, 5, 7], [8, 8, 3],
    ];
    for (const [r, col, d] of sample) {
      const x = -half + col * cell + cell / 2;
      const y = -half + r * cell + cell / 2;
      c.add(
        this.add.text(x, y, String(d), {
          fontFamily: FONT_FAMILY,
          fontSize: "9px",
          fontStyle: "bold",
          color: "#3a2c17",
        }).setOrigin(0.5).setAlpha(0.9),
      );
    }

    return c;
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
        this.sfx.play("select");
        this.pickedDifficulty = difficulty;
        this.dispatch("selectDifficulty", { difficulty });
        this.updateDiffCards();
      },
    });

    const seal = this.add.image(0, -30, SUDOKU_ASSETS.seals[difficulty] ?? SUDOKU_ASSETS.seals[0])
      .setDisplaySize(54, 54);

    const name = this.add.text(0, 8, DIFF_LABELS[difficulty] ?? "Easy", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    const route = this.add.text(0, 27, DIFF_COPY[difficulty] ?? "Warm-up grid", {
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

    this.diffNameTexts[difficulty] = name;
    this.diffRouteTexts[difficulty] = route;
    this.diffRewardTexts[difficulty] = reward;

    container.add([bg, seal, name, route, reward]);
    return container;
  }

  private buildDealingOverlay(): void {
    this.dealingContainer = this.add.container(W / 2, H / 2);
    this.dealingContainer.setDepth(20);

    const overlay = this.add.rectangle(0, 0, W, H, 0xfff4dd, 0.88).setOrigin(0.5);
    const envelope = this.add.image(0, -54, SUDOKU_ASSETS.sealedEnvelope)
      .setDisplaySize(112, 90);

    this.dealingTitle = this.add.text(0, 24, DEFAULT_LABELS.sealing, {
      fontFamily: FONT_FAMILY,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#2d2114",
    }).setOrigin(0.5);

    const dot1 = this.add.circle(-24, 62, 5, C.gold).setOrigin(0.5);
    const dot2 = this.add.circle(0,   62, 5, C.gold).setOrigin(0.5);
    const dot3 = this.add.circle(24,  62, 5, C.gold).setOrigin(0.5);
    this.dealingDots = [dot1, dot2, dot3];

    this.dealingContainer.add([overlay, envelope, this.dealingTitle, dot1, dot2, dot3]);
    this.dealingContainer.setVisible(false);

    // Animate the sealing dots through the reduced-motion-aware helper: when
    // reduced motion is on we render them as steady dots instead of an
    // unconditional infinite loop.
    if (!this.reducedMotion) {
      [dot1, dot2, dot3].forEach((dot, i) => {
        this.tween({
          targets: dot,
          alpha: 0.2,
          duration: 400,
          delay: i * 150,
          yoyo: true,
          repeat: -1,
        });
      });
    }
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
    this.load.image(SUDOKU_ASSETS.sealedEnvelope, "./art/sealed-envelope.webp");
    this.load.image(SUDOKU_ASSETS.solvedBadge, "./art/solved-badge.webp");
    this.load.image(SUDOKU_ASSETS.seals[0], "./art/seal-easy.webp");
    this.load.image(SUDOKU_ASSETS.seals[1], "./art/seal-medium.webp");
    this.load.image(SUDOKU_ASSETS.seals[2], "./art/seal-hard.webp");
  }

  create(): void {
    super.create(); // wires bridge

    this.buildBackground();
    this.fitCameraToHost();
    this.buildGrid();
    this.buildTimerHUD();
    this.buildDigitBar();
    this.buildToolRow();
    this.buildActionButton();
    this.buildStatusLabel();
    this.buildLobby();
    this.buildDealingOverlay();
    this.buildPausedOverlay();
    this.bindKeyboardControls();

    // Seed from current bridge state
    this.onStateUpdate(this.state);
  }

  update(): void {
    if (this.prevStatus !== "dealt") return;
    if (this.deadline <= 0 || this.dealtAt <= 0) return;
    if (this.bool("isPaused")) return;

    const now       = Date.now();
    const second = Math.floor(now / 1_000);
    if (second === this.lastClockSecond) return;
    this.lastClockSecond = second;
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

    this.refreshGameActionState();

    // Guest is purely local and may settle immediately. Paid historical games
    // remain recoverable and are only released through the explicit grace-safe
    // drawer action.
    if (
      this.str("appMode", "gamefi") === "guest" &&
      remaining <= 0 &&
      !this.expireDispatched &&
      !this.bool("isSubmitting") &&
      !this.bool("isUndoing")
    ) {
      this.expireDispatched = true;
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
      seal.setDisplaySize(active ? 60 : 54, active ? 60 : 54);
    });
  }

  /** Push the latest localized bundle onto the scene's static text objects. */
  private applyLabels(): void {
    this.lobbyTitleText.setText(this.L.vaultTitle);
    this.lobbySubText.setText(this.L.vaultSub);
    this.dealingTitle.setText(this.L.sealing);
    this.notesBtnText.setText(this.notesMode ? this.L.notesOn : this.L.notes);
    this.clearBtnText.setText(this.L.erase);
    this.pausedTitle.setText(this.L.pausedTitle);
    this.pausedCopy.setText(this.L.pausedCopy);
    this.pausedResumeText.setText(this.L.resume);
    for (let d = 0; d < 3; d++) {
      this.diffNameTexts[d]?.setText(this.L.diffNames[d] ?? DIFF_LABELS[d] ?? "");
      this.diffRouteTexts[d]?.setText(this.L.diffCopy[d] ?? DIFF_COPY[d] ?? "");
      this.diffRewardTexts[d]?.setText(this.L.diffRewards[d] ?? DIFF_REWARDS[d] ?? "");
    }
  }

  /** Short celebratory pop + sparkle on the dealt → solved transition. */
  private celebrateSolve(): void {
    if (this.reducedMotion) return;

    const pop = (img: Phaser.GameObjects.Image) => {
      const s = img.scaleX;
      img.setScale(s * 0.5);
      this.tween({
        targets: img,
        scaleX: s,
        scaleY: s,
        ease: "Back.easeOut",
        duration: 520,
      });
    };
    pop(this.lobbyRewardArt);
    pop(this.lobbyResultBadge);

    const cxs = this.lobbyRewardArt.x;
    const cys = this.lobbyRewardArt.y;
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8;
      const spark = this.add.circle(cxs, cys, 3, C.goldLight).setDepth(4);
      this.lobbyContainer.add(spark);
      this.tween({
        targets: spark,
        x: cxs + Math.cos(ang) * 54,
        y: cys + Math.sin(ang) * 54,
        alpha: 0,
        scale: 0.3,
        duration: 640,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ── BaseScene: state handler ───────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    this.L = this.val<SudokuLabels>("labels") ?? DEFAULT_LABELS;
    this.applyLabels();

    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const undosUsed  = this.num("undosUsed", 0);
    const deadline   = this.num("deadline", 0);
    const dealtAt    = this.num("dealtAt", 0);
    const poolFree   = this.num("poolFree", 0);
    const lastStatus = this.str("lastStatus", "");
    const isGuest    = this.str("appMode", "gamefi") === "guest";
    const isPaused   = isGuest && this.bool("isPaused");
    const inputSyncFailed = this.bool("inputSyncFailed");
    let displayStatus = lastStatus;
    const busy       =
      this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isUndoing") ||
      this.bool("isActing") ||
      this.bool("isRecovering");

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
    this.setObjectActive(this.pausedOverlay, isGame && isPaused);

    // ── Lobby view ────────────────────────────────────────────────────────
    if (isLobby) {
      if (gameStatus !== "dealt") this.prevClues = "";
      this.pickedDifficulty = Math.max(0, Math.min(2, this.num("gameDifficulty", 0)));
      const rule = ruleOf(this.pickedDifficulty);
      const limitMin = Math.round(rule.limitMs / 60_000);
      const rewardGas = Number(gasDisplay(rule.rewardFixed8));
      const walletConnected = this.bool("walletConnected");
      const progressionReady = this.bool("progressionReady");
      const routeLocked = progressionReady && this.pickedDifficulty < this.requiredDifficulty();
      const canStart = this.canStartDifficulty(this.pickedDifficulty);
      const gameFiUnavailable = !isGuest && !GAMEFI_NEW_ENTRIES_ENABLED;
      const gateLine = gameFiUnavailable
        ? this.L.gameFiUnavailable
        : !walletConnected
        ? this.L.gateConnect
        : !progressionReady
          ? this.L.gateChecking
          : routeLocked
            ? this.L.gateRouteLocked.replace(
                "{difficulty}",
                this.L.diffNames[this.requiredDifficulty()] ?? "",
              )
            : poolFree < rewardGas
              ? this.L.gatePoolLow
                  .replace("{have}", poolFree.toFixed(2))
                  .replace("{need}", rewardGas.toFixed(2))
              : this.L.gateChoose;
      displayStatus = gateLine;
      this.lobbyPoolText.setText(
        this.L.poolTemplate
          .replace("{pool}", poolFree.toFixed(2))
          .replace("{min}", String(limitMin)),
      );
      this.updateDiffCards();
      this.actionButtonEnabled = canStart;

      // The trophy + solved badge belong to a finished result; while idle the
      // preview grid holds the lower zone instead of two orphan icons.
      const showResult = gameStatus === "solved" || gameStatus === "expired";
      this.lobbyRewardArt.setTexture(
        SUDOKU_ASSETS.seals[this.pickedDifficulty] ?? SUDOKU_ASSETS.seals[0],
      );
      this.lobbyMiniGrid.setVisible(!showResult);
      this.lobbyRewardArt.setVisible(showResult);
      this.lobbyResultBadge.setVisible(showResult);
      this.lobbyResultCaption.setVisible(showResult);

      if (gameStatus === "solved") {
        this.actionBtnText.setText(this.L.act.playAgain);
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.green);
        this.actionBtnBg.setStrokeStyle(2, 0x3cbf66);
        this.lobbyRewardArt.setAlpha(0.95);
        this.lobbyResultBadge.setAlpha(1);
        this.lobbyResultCaption.setText(this.L.resultSolved);
        this.lobbyResultCaption.setColor("#1a7a30");
      } else if (gameStatus === "expired") {
        this.actionBtnText.setText(this.L.act.tryAgain);
        this.actionBtnText.setColor("#ffffff");
        this.actionBtnBg.setFillStyle(C.red);
        this.actionBtnBg.setStrokeStyle(2, 0xe27d66);
        this.lobbyRewardArt.setAlpha(0.7);
        this.lobbyResultBadge.setAlpha(0.5);
        this.lobbyResultCaption.setText(this.L.resultExpired);
        this.lobbyResultCaption.setColor("#a5502e");
      } else {
        this.actionBtnText.setText(
          busy
            ? this.L.act.starting
            : canStart
              ? this.L.act.open
              : gameFiUnavailable
                ? this.L.act.maintenance
              : !walletConnected
                ? this.L.act.connect
                : routeLocked
                  ? this.L.act.routeLocked
                  : this.L.act.poolLow,
        );
        this.actionBtnText.setColor(canStart && !busy ? "#2d2114" : "#7a5a28");
        this.actionBtnBg.setFillStyle(canStart && !busy ? C.gold : 0xf1e0be);
        this.actionBtnBg.setStrokeStyle(2, C.goldLight);
      }
    }

    // ── Game view ─────────────────────────────────────────────────────────
    if (isGame) {
      // (Re)initialise when a new puzzle lands
      if (clues !== this.prevClues) {
        this.prevClues = clues;
        this.initBoard(clues);
        this.sfx.play("start");
      }

      this.applyRollbackRequest();
      this.applyConfirmedUndoRequest();
      this.applyBoardRecoveryRequest();
      this.applyHintRequest();
      this.applyA11yCommand();

      const undosLeft = MAX_UNDOS - undosUsed;
      const rewardPct = rewardPctAfterUndos(undosUsed);
      this.rewardLabel.setVisible(!isGuest);
      this.rewardLabel.setText(`${rewardPct}%`);
      this.undoBtnText.setText(
        isGuest
          ? this.L.undo
          : undosLeft > 0
            ? this.L.undoTemplate.replace("{left}", String(undosLeft))
            : this.L.undoNone,
      );

      this.setUndoButtonState(!busy && this.hasUndoCapacity());
      this.refreshToolButtons();

      this.refreshGameActionState();
    }

    // Solved fanfare fires once, on the dealt → solved transition only
    if (gameStatus === "solved" && this.prevStatus === "dealt") {
      this.sfx.play("win");
      this.celebrateSolve();
    }

    this.prevStatus = gameStatus;
    this.statusLabel.setText(
      isGame
        ? inputSyncFailed
          ? this.L.syncFailed
          : isPaused
            ? this.L.pausedCopy
            : this.gameStatusMessage(lastStatus)
        : displayStatus,
    );
  }

  // ── Board initialisation ───────────────────────────────────────────────────

  private initBoard(clues: string): void {
    const activeGameId = this.str("activeGameId", "0");
    const restored = activeGameId !== "0" ? restoreBoard(activeGameId, clues) : null;
    this.board        = restored ? [...restored.entries] : Array(81).fill(0);
    this.given        = restored ? [...restored.given] : Array(81).fill(false);
    this.notes        = restored ? [...restored.notes] : Array(81).fill(0);
    this.moveHistory  = [];
    this.selectedCell = -1;
    this.notesMode = false;
    this.conflicts    = new Set();
    this.boardComplete = false;
    this.boardReadyAnnounced = false;
    this.expireDispatched = false;
    this.lastClockSecond = -1;
    this.lastHintNonce = this.num("hintNonce", 0);
    this.lastRollbackNonce = this.num("rollbackNonce", 0);
    this.lastUndoNonce = this.num("undoNonce", 0);
    this.lastBoardRecoveryNonce = this.num("boardRecoveryNonce", 0);

    if (restored) {
      this.moveHistory = restored.placedOrder.map((cell) => ({ cell, prev: 0 }));
    } else {
      for (let i = 0; i < 81; i++) {
        const d = parseInt(clues[i] ?? "0", 10);
        if (d >= 1 && d <= 9) {
          this.board[i] = d;
          this.given[i] = true;
        }
      }
    }

    this.selRing.setPosition(-999, -999);
    this.renderBoard();
    this.emitBoardState();
  }

  // ── Board rendering ────────────────────────────────────────────────────────

  private renderBoard(): void {
    this.conflicts = this.computeConflicts(this.board);
    this.boardComplete = this.checkBoardComplete();
    if (this.boardComplete && !this.boardReadyAnnounced) {
      this.boardReadyAnnounced = true;
      this.sfx.play("combo");
      this.pressFeedback(this.paperBoard, { scale: 1.018, duration: 130 });
    } else if (!this.boardComplete) {
      this.boardReadyAnnounced = false;
    }

    for (let i = 0; i < 81; i++) {
      const digit    = this.board[i] ?? 0;
      const isGiven  = this.given[i] ?? false;
      const noteMask = this.notes[i] ?? 0;
      const isSelected  = i === this.selectedCell;
      const isConflict  = this.conflicts.has(i);

      const art = this.cellArt[i]!;
      const hit = this.cellHit[i]!;
      art.clearTint();

      let texture: string = SUDOKU_ASSETS.cellPlaced;
      // Empty cells keep only a whisper of tile texture so the paper stays
      // clean; filled/given/selected/conflict cells carry full art.
      let alpha = digit ? 0.9 : 0.14;
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
        const selectedDigit = this.board[this.selectedCell] ?? 0;
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
        if (selectedDigit > 0 && digit === selectedDigit) {
          alpha = Math.max(alpha, 0.94);
          art.setTint(0xccefd5);
        }
      }

      art.setTexture(texture);
      art.setAlpha(alpha);
      hit.setAlpha(0.001);

      // ── Text ─────────────────────────────────────────────────────────
      const txt = this.cellText[i]!;
      const noteTxt = this.cellNoteText[i]!;
      if (digit > 0) {
        txt.setText(String(digit));
        txt.setColor(
          isConflict
            ? "#8f1d12"
            : isGiven
              ? "#2a1a08"
              : "#1a4a8f",
        );
        txt.setAlpha(1);
        noteTxt.setAlpha(0);
      } else {
        txt.setAlpha(0);
        noteTxt.setText(this.formatNotes(noteMask));
        noteTxt.setAlpha(noteMask > 0 ? 0.96 : 0);
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

  private formatNotes(mask: number): string {
    if (!mask) return "";
    const cells = Array.from({ length: 9 }, (_, index) => {
      const digit = index + 1;
      return (mask & (1 << digit)) !== 0 ? String(digit) : " ";
    });
    return [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)]
      .map((row) => row.join(" "))
      .join("\n");
  }

  private setUndoButtonState(enabled: boolean): void {
    this.undoButtonEnabled = enabled;
    this.undoBtnBg.setFillStyle(enabled ? C.btnBg : 0xf1e0be);
    this.undoBtnBg.setAlpha(enabled ? 1 : 0.72);
  }

  private hasUndoCapacity(): boolean {
    return this.moveHistory.length > 0 && (
      this.str("appMode", "gamefi") === "guest" ||
      this.num("undosUsed", 0) < MAX_UNDOS
    );
  }

  private canEditBoard(): boolean {
    return this.str("gameStatus", "idle") === "dealt" &&
      !this.bool("isPaused") &&
      !this.bool("inputSyncFailed") &&
      !this.bool("isSubmitting") &&
      !this.bool("isUndoing") &&
      !this.bool("isActing") &&
      !this.bool("isRecovering") &&
      !this.timeUp();
  }

  private canEraseSelection(): boolean {
    if (!this.canEditBoard() || this.selectedCell < 0) return false;
    if ((this.notes[this.selectedCell] ?? 0) > 0) return true;
    return this.str("appMode", "gamefi") === "guest" &&
      !this.given[this.selectedCell] &&
      (this.board[this.selectedCell] ?? 0) > 0;
  }

  private canRequestHint(): boolean {
    return this.str("appMode", "gamefi") === "guest" &&
      this.canEditBoard() &&
      this.selectedCell >= 0 &&
      !this.given[this.selectedCell] &&
      (this.board[this.selectedCell] ?? 0) === 0 &&
      this.num("hintsUsed", 0) < 3;
  }

  private refreshToolButtons(): void {
    const canEdit = this.canEditBoard();
    const canClear = this.canEraseSelection();
    const canHint = this.canRequestHint();
    const isGuest = this.str("appMode", "gamefi") === "guest";
    const undosLeft = Math.max(0, MAX_UNDOS - this.num("undosUsed", 0));
    const hintsLeft = Math.max(0, 3 - this.num("hintsUsed", 0));

    this.notesBtnText.setText(this.notesMode ? this.L.notesOn : this.L.notes);
    this.notesBtnBg
      .setFillStyle(this.notesMode && canEdit ? 0xdff7ea : canEdit ? C.btnBg : 0xf1e0be)
      .setStrokeStyle(1.5, this.notesMode && canEdit ? C.green : C.btnBorder)
      .setAlpha(canEdit ? 1 : 0.72);

    this.clearBtnBg
      .setFillStyle(canClear ? C.btnBg : 0xf1e0be)
      .setAlpha(canClear ? 1 : 0.72);

    this.undoBtnText.setText(isGuest ? this.L.undo : `${this.L.undo} ${undosLeft}`);
    this.undoBtnBg
      .setFillStyle(this.undoButtonEnabled ? C.btnBg : 0xf1e0be)
      .setAlpha(this.undoButtonEnabled ? 1 : 0.72);

    this.hintBtnText.setText(this.L.hintTemplate.replace("{left}", String(hintsLeft)));
    this.hintBtnBg
      .setFillStyle(canHint ? C.btnBg : 0xf1e0be)
      .setAlpha(canHint ? 1 : 0.72);
  }

  private currentBoardState(): BoardState {
    return {
      entries: [...this.board],
      given: [...this.given],
      notes: [...this.notes],
      placedOrder: this.moveHistory.map((move) => move.cell),
    };
  }

  private applyBoardState(board: BoardState): void {
    this.board = [...board.entries];
    this.given = [...board.given];
    this.notes = [...board.notes];
    this.moveHistory = board.placedOrder.map((cell) => ({ cell, prev: 0 }));
  }

  private emitBoardState(): void {
    const snapshot: SudokuBoardSnapshot = {
      entries: [...this.board],
      given: [...this.given],
      notes: [...this.notes],
      selectedCell: this.selectedCell,
      notesMode: this.notesMode,
      conflicts: [...this.conflicts],
      complete: this.boardComplete,
    };
    this.dispatch("sudokuBoardState", snapshot);
  }

  private toggleNotesMode(): void {
    if (!this.canEditBoard()) return;
    this.notesMode = !this.notesMode;
    this.sfx.play("select");
    this.refreshToolButtons();
    this.emitBoardState();
  }

  private handleEraseSelection(): void {
    if (!this.canEraseSelection()) return;
    const current = this.currentBoardState();
    const next =
      this.str("appMode", "gamefi") === "guest" &&
      (current.entries[this.selectedCell] ?? 0) > 0
        ? eraseLocalCell(current, this.selectedCell)
        : clearNotes(current, this.selectedCell);
    this.applyBoardState(next);
    this.persistCurrentBoard();
    this.renderBoard();
    this.setGameActionState(false);
    this.setUndoButtonState(this.hasUndoCapacity());
    this.refreshToolButtons();
    this.emitBoardState();
    this.sfx.play("tick");
  }

  private handleHint(): void {
    if (!this.canRequestHint()) {
      this.statusLabel.setText(this.L.selectCell);
      return;
    }
    this.dispatch("requestHint", { cell: this.selectedCell });
  }

  private applyHintRequest(): void {
    const nonce = this.num("hintNonce", 0);
    if (nonce <= this.lastHintNonce) return;
    this.lastHintNonce = nonce;
    const cell = this.num("hintCell", -1);
    const digit = this.num("hintDigit", 0);
    if (
      this.str("appMode", "gamefi") !== "guest" ||
      cell < 0 || cell >= 81 || digit < 1 || digit > 9 ||
      this.given[cell] || (this.board[cell] ?? 0) !== 0
    ) return;

    const placed = placeDigit(this.currentBoardState(), cell, digit);
    this.applyBoardState(placed.board);
    this.selectedCell = cell;
    this.persistCurrentBoard();
    this.renderBoard();
    this.setUndoButtonState(this.hasUndoCapacity());
    this.refreshToolButtons();
    this.emitBoardState();
    this.sfx.play(this.completesUnit(cell) ? "combo" : "move");
    const art = this.cellArt[cell];
    if (art) this.pressFeedback(art, { scale: 1.12, duration: 70 });
  }

  private applyRollbackRequest(): void {
    const nonce = this.num("rollbackNonce", 0);
    if (nonce <= this.lastRollbackNonce) return;
    this.lastRollbackNonce = nonce;
    const rolledBack = applyUndo(this.currentBoardState());
    if (rolledBack.reverted === null) return;
    this.applyBoardState(rolledBack.board);
    this.selectedCell = rolledBack.reverted;
    this.persistCurrentBoard();
    this.renderBoard();
    this.setUndoButtonState(false);
    this.refreshToolButtons();
    this.emitBoardState();
    this.sfx.play("error");
  }

  private applyConfirmedUndoRequest(): void {
    const nonce = this.num("undoNonce", 0);
    if (nonce <= this.lastUndoNonce) return;
    this.lastUndoNonce = nonce;
    const undone = applyUndo(this.currentBoardState());
    if (undone.reverted === null) return;
    this.applyBoardState(undone.board);
    this.selectedCell = undone.reverted;
    this.persistCurrentBoard();
    this.renderBoard();
    this.setUndoButtonState(this.hasUndoCapacity());
    this.setGameActionState(false);
    this.refreshToolButtons();
    this.emitBoardState();
    this.sfx.play("tick");
  }

  private applyBoardRecoveryRequest(): void {
    const nonce = this.num("boardRecoveryNonce", 0);
    if (nonce <= this.lastBoardRecoveryNonce) return;
    this.lastBoardRecoveryNonce = nonce;
    const activeGameId = this.str("activeGameId", "0");
    const clues = this.str("clues", "");
    if (activeGameId === "0" || !/^[0-9]{81}$/.test(clues)) return;
    this.applyBoardState(restoreBoard(activeGameId, clues));
    this.selectedCell = -1;
    this.notesMode = false;
    this.renderBoard();
    this.setUndoButtonState(this.hasUndoCapacity());
    this.setGameActionState(false);
    this.refreshToolButtons();
    this.emitBoardState();
  }

  private applyA11yCommand(): void {
    const command = this.val<A11yCommand>("a11yCommand");
    if (!command || command.nonce <= this.lastA11yCommandNonce) return;
    this.lastA11yCommandNonce = command.nonce;
    switch (command.type) {
      case "select-cell":
        if (Number.isInteger(command.cell)) this.handleCellTap(command.cell ?? -1);
        break;
      case "digit":
        if (Number.isInteger(command.digit)) this.handleDigitTap(command.digit ?? 0);
        break;
      case "toggle-notes":
        this.toggleNotesMode();
        break;
      case "clear-notes":
        this.handleEraseSelection();
        break;
      case "undo":
        this.handleUndo();
        break;
      case "submit":
        this.handleActionButton();
        break;
    }
  }

  private setGameActionState(busy: boolean): void {
    if (this.bool("inputSyncFailed")) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.L.act.recover);
      this.actionBtnText.setColor("#76551f");
      this.actionBtnBg.setFillStyle(0xffe3a8);
      this.actionBtnBg.setStrokeStyle(2, C.goldDark);
    } else if (busy) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.bool("isSubmitting") ? this.L.act.submitting : this.L.act.working);
      this.actionBtnText.setColor("#ffffff");
      this.actionBtnBg.setFillStyle(C.muted);
      this.actionBtnBg.setStrokeStyle(2, C.btnBorder);
    } else if (this.canSubmitSolution()) {
      this.actionButtonEnabled = true;
      this.actionBtnText.setText(this.L.act.submit);
      this.actionBtnText.setColor("#ffffff");
      this.actionBtnBg.setFillStyle(C.green);
      this.actionBtnBg.setStrokeStyle(2, 0x3cbf66);
    } else if (this.timeUp()) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.L.act.timeUp);
      this.actionBtnText.setColor("#ffffff");
      this.actionBtnBg.setFillStyle(C.red);
      this.actionBtnBg.setStrokeStyle(2, 0xe27d66);
    } else if (this.boardComplete && this.submitWindowClosed()) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.L.act.tooLate);
      this.actionBtnText.setColor("#7a5a28");
      this.actionBtnBg.setFillStyle(0xf1e0be);
      this.actionBtnBg.setStrokeStyle(1.5, C.btnBorder, 0.8);
    } else if (this.boardComplete && !this.minSolveReached()) {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.L.act.wait);
      this.actionBtnText.setColor("#7a5a28");
      this.actionBtnBg.setFillStyle(0xf1e0be);
      this.actionBtnBg.setStrokeStyle(1.5, C.btnBorder, 0.8);
    } else {
      this.actionButtonEnabled = false;
      this.actionBtnText.setText(this.L.act.solve);
      this.actionBtnText.setColor("#7a5a28");
      this.actionBtnBg.setFillStyle(0xf1e0be);
      this.actionBtnBg.setStrokeStyle(1.5, C.btnBorder, 0.8);
    }
  }

  private refreshGameActionState(): void {
    const busy =
      this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isUndoing") ||
      this.bool("isActing") ||
      this.bool("isRecovering");
    this.setGameActionState(busy);
    if (this.prevStatus === "dealt") {
      this.statusLabel.setText(this.gameStatusMessage(this.str("lastStatus", "")));
    }
  }

  // ── Interaction handlers ───────────────────────────────────────────────────

  private handleCellTap(index: number): void {
    const gameStatus = this.str("gameStatus", "idle");
    if (gameStatus !== "dealt" || this.bool("isPaused") || this.bool("inputSyncFailed")) return;
    if (!Number.isInteger(index) || index < 0 || index >= 81) return;

    this.sfx.play("tap");
    // Keep the cell selected on repeated taps, matching familiar Sudoku apps;
    // Escape remains the explicit keyboard deselect action.
    this.selectedCell = index;
    this.renderBoard();
    this.refreshToolButtons();
    this.emitBoardState();
  }

  private handleDigitTap(digit: number): void {
    const gameStatus = this.str("gameStatus", "idle");
    const busy =
      this.bool("isSubmitting") || this.bool("isUndoing") || this.bool("isDealing");

    if (gameStatus !== "dealt" || busy || !this.canEditBoard()) return;
    if (this.selectedCell < 0) {
      this.statusLabel.setText(this.L.selectCell);
      return;
    }
    if (this.given[this.selectedCell]) {
      this.sfx.play("error");
      this.statusLabel.setText(this.L.givenLocked);
      return; // cannot overwrite given cells
    }
    const isGuest = this.str("appMode", "gamefi") === "guest";
    if ((this.board[this.selectedCell] ?? 0) !== 0 && !isGuest) {
      this.sfx.play("error");
      this.statusLabel.setText(this.L.placedLocked);
      return; // paid sealed-op placements remain final
    }

    if (this.notesMode) {
      if ((this.board[this.selectedCell] ?? 0) !== 0) {
        this.statusLabel.setText(this.L.eraseFirst);
        return;
      }
      this.applyBoardState(toggleNote(this.currentBoardState(), this.selectedCell, digit));
      this.persistCurrentBoard();
      this.renderBoard();
      this.refreshToolButtons();
      this.emitBoardState();
      this.sfx.play("tick");
      return;
    }

    const current = this.currentBoardState();
    const placed = isGuest
      ? setLocalDigit(current, this.selectedCell, digit)
      : placeDigit(current, this.selectedCell, digit);
    if (placed.board === current) return;
    this.applyBoardState(placed.board);
    this.renderBoard();
    this.persistCurrentBoard();
    this.setUndoButtonState(this.hasUndoCapacity());
    this.setGameActionState(false);
    this.refreshToolButtons();

    // Placement cue: conflicting digit → error, completed row/col/box → combo
    const selectedArt = this.cellArt[this.selectedCell];
    if (this.conflicts.has(this.selectedCell)) {
      this.sfx.play("error");
      if (selectedArt && !this.reducedMotion) {
        const originX = selectedArt.x;
        this.tween({
          targets: selectedArt,
          x: originX + 3,
          duration: 42,
          yoyo: true,
          repeat: 2,
          onComplete: () => selectedArt.setX(originX),
        });
      }
    } else if (this.completesUnit(this.selectedCell)) {
      this.sfx.play("combo");
    } else {
      this.sfx.play("move");
    }

    // Micro-bounce on the selected cell
    if (selectedArt) {
      this.pressFeedback(selectedArt, { scale: 1.12, duration: 60 });
    }

    // Only paid play records an append-only sealed operation. Local practice
    // persists the corrected board directly and never calls chain/oracle code.
    if (!isGuest) this.dispatch("recordMove", { cell: this.selectedCell, digit });
    this.emitBoardState();
  }

  private handleUndo(): void {
    const gameStatus = this.str("gameStatus", "idle");
    const busy =
      this.bool("isSubmitting") ||
      this.bool("isUndoing") ||
      this.bool("isActing") ||
      this.bool("isRecovering");
    const undosLeft = MAX_UNDOS - this.num("undosUsed", 0);

    if (
      gameStatus !== "dealt" || busy ||
      (this.str("appMode", "gamefi") !== "guest" && undosLeft <= 0) ||
      this.bool("isPaused") || this.bool("inputSyncFailed")
    ) return;
    if (this.moveHistory.length === 0) return;

    // A paid undo mutates the sealed TEE op log. Keep the visible board frozen
    // until main.tsx confirms that operation and advances undoNonce; on any
    // ambiguous failure inputSyncFailed freezes input for authoritative replay.
    if (this.str("appMode", "gamefi") !== "guest") {
      this.dispatch("useUndo", {});
      return;
    }

    // Guest play has no remote ledger, so its local rollback is immediate.
    this.sfx.play("tick");
    const undone = applyUndo(this.currentBoardState());
    if (undone.reverted === null) return;
    this.applyBoardState(undone.board);
    this.selectedCell = undone.reverted;
    this.renderBoard();
    this.persistCurrentBoard();
    this.setUndoButtonState(this.hasUndoCapacity());
    this.setGameActionState(false);
    this.refreshToolButtons();
    this.emitBoardState();

    this.dispatch("useUndo", {});
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
      if (!this.canSubmitSolution()) return;
      const solution = this.getBoardSolutionString();
      this.dispatch("submitSolution", { solution });
    } else {
      // Lobby / idle / solved / expired
      if (!this.canStartDifficulty(this.pickedDifficulty)) return;
      this.dispatch("startGame", { difficulty: this.pickedDifficulty });
    }
  }

  private canStartDifficulty(difficulty: number): boolean {
    if (this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting")) return false;
    if (this.str("appMode", "gamefi") === "guest") return true;
    if (!GAMEFI_NEW_ENTRIES_ENABLED) return false;
    if (!this.bool("walletConnected")) return false;
    if (!this.bool("progressionReady")) return false;
    if (difficulty < this.requiredDifficulty()) return false;
    const rewardGas = Number(gasDisplay(ruleOf(difficulty).rewardFixed8));
    return this.num("poolFree", 0) >= rewardGas;
  }

  private requiredDifficulty(): number {
    return Math.max(0, Math.min(2, this.num("progressionRequiredDifficulty", 0)));
  }

  private elapsedMs(): number {
    return this.dealtAt > 0 ? Date.now() - this.dealtAt : 0;
  }

  private remainingMs(): number {
    return this.deadline > 0 ? this.deadline - Date.now() : 0;
  }

  private minSolveReached(): boolean {
    if (this.str("appMode", "gamefi") === "guest") return true;
    const rule = ruleOf(this.num("gameDifficulty", 0));
    return this.dealtAt > 0 && this.elapsedMs() >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  }

  private timeUp(): boolean {
    return this.str("gameStatus", "idle") === "dealt" && this.deadline > 0 && this.remainingMs() <= 0;
  }

  private submitWindowClosed(): boolean {
    return this.str("gameStatus", "idle") === "dealt" &&
      this.deadline > 0 &&
      this.remainingMs() <= SUBMIT_BUFFER_MS;
  }

  private canSubmitSolution(): boolean {
    return (
      this.str("gameStatus", "idle") === "dealt" &&
      this.boardComplete &&
      this.minSolveReached() &&
      !this.submitWindowClosed() &&
      !this.timeUp() &&
      !this.bool("isSubmitting") &&
      !this.bool("isUndoing") &&
      !this.bool("isPaused") &&
      !this.bool("inputSyncFailed")
    );
  }

  private gameStatusMessage(fallback: string): string {
    if (this.timeUp()) return this.L.msg.deadlinePassed;
    if (this.conflicts.size > 0) return this.L.conflict;
    if (this.submitWindowClosed()) return this.L.msg.deadlineClose;
    if (this.boardComplete && !this.minSolveReached()) {
      const rule = ruleOf(this.num("gameDifficulty", 0));
      const wait = Math.max(0, rule.minSolveMs + MIN_SOLVE_BUFFER_MS - this.elapsedMs());
      return this.L.msg.submitUnlock.replace("{clock}", formatClock(wait));
    }
    if (this.boardComplete) return this.L.boardReady;
    return fallback;
  }

  private persistCurrentBoard(): void {
    const activeGameId = this.str("activeGameId", "0");
    if (activeGameId === "0") return;
    persistBoard(activeGameId, {
      entries: [...this.board],
      given: [...this.given],
      notes: [...this.notes],
      placedOrder: this.moveHistory.map((move) => move.cell),
    });
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

  /**
   * True when the row, column, or 3×3 box containing `index` is fully filled
   * with no conflicts. Used only to pick the placement sound cue.
   */
  private completesUnit(index: number): boolean {
    const row    = Math.floor(index / 9);
    const col    = index % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    const clean = (cells: number[]): boolean =>
      cells.every((c) => (this.board[c] ?? 0) > 0 && !this.conflicts.has(c));

    const rowCells = Array.from({ length: 9 }, (_, c) => row * 9 + c);
    const colCells = Array.from({ length: 9 }, (_, r) => r * 9 + col);
    const boxCells: number[] = [];
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        boxCells.push((boxRow + br) * 9 + (boxCol + bc));
      }
    }

    return clean(rowCells) || clean(colCells) || clean(boxCells);
  }

  private getBoardSolutionString(): string {
    return this.board.map((d) => (d > 0 ? String(d) : "0")).join("");
  }

  private bindKeyboardControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.keyHandler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
      ) return;
      if (this.str("gameStatus", "idle") !== "dealt") return;

      const key = event.key;
      const digit = Number(key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
        event.preventDefault();
        this.handleDigitTap(digit);
        return;
      }
      if (key === "n" || key === "N") {
        event.preventDefault();
        this.toggleNotesMode();
        return;
      }
      if (key === "Backspace" || key === "Delete" || key === "0") {
        event.preventDefault();
        this.handleEraseSelection();
        return;
      }
      if (key === "u" || key === "U") {
        event.preventDefault();
        this.handleUndo();
        return;
      }
      if (key === "h" || key === "H") {
        event.preventDefault();
        this.handleHint();
        return;
      }
      if ((key === "p" || key === "P") && this.str("appMode", "gamefi") === "guest") {
        event.preventDefault();
        this.dispatch("togglePause", {});
        return;
      }
      if (key === "Enter") {
        event.preventDefault();
        this.handleActionButton();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        this.selectedCell = -1;
        this.renderBoard();
        this.refreshToolButtons();
        this.emitBoardState();
        return;
      }

      const row = this.selectedCell >= 0 ? Math.floor(this.selectedCell / 9) : -1;
      const col = this.selectedCell >= 0 ? this.selectedCell % 9 : -1;
      let next = this.selectedCell;
      if (key === "ArrowUp" && row > 0) next -= 9;
      else if (key === "ArrowDown" && row >= 0 && row < 8) next += 9;
      else if (key === "ArrowLeft" && col > 0) next -= 1;
      else if (key === "ArrowRight" && col >= 0 && col < 8) next += 1;
      else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        next = this.board.findIndex((value) => value === 0);
      } else return;

      event.preventDefault();
      if (next >= 0 && next < 81 && next !== this.selectedCell) {
        this.selectedCell = next;
        this.renderBoard();
        this.refreshToolButtons();
        this.emitBoardState();
        this.sfx.play("tap");
      }
    };
    keyboard.on("keydown", this.keyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.unbindKeyboardControls, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.unbindKeyboardControls, this);
  }

  private unbindKeyboardControls(): void {
    if (this.keyHandler) this.input.keyboard?.off("keydown", this.keyHandler);
    this.keyHandler = undefined;
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.unbindKeyboardControls, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.unbindKeyboardControls, this);
  }

  // ── Responsive resize ──────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldW = viewW / zoom;
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.08;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldW, visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
  }
}
