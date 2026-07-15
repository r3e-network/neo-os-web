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
import type { MoveTransition } from "../logic/engine-2048";
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
  /**
   * Header chip fill. The chips reused `gridBg` (0xbbada0), which is the right
   * value for the board — a large field behind dark tiles — but wrong behind
   * the chips' own light text: #f9f6f2 caps on 0xbbada0 measure 2.03:1, and the
   * chip itself only reached 1.7:1 against the cream page, so the whole chip
   * read washed out. This is 2048's own dark warm brown (the same value as
   * `scoreText`), which carries the caption at 4.64:1, the value at 5.0:1, and
   * separates from the page at 4.75:1.
   */
  chipBg:     0x776e65,
};

interface TileColors { bg: number; text: string }

interface TileVisual {
  shadow: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  objects: Phaser.GameObjects.GameObject[];
  baseScales: Array<{ x: number; y: number }>;
  scaleFactor: number;
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
  lobbyStatusY: number;
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

/**
 * Horizontal space the shared shell's audio toggle occupies at the canvas's
 * top-right corner: 8px inset + 34px button + a 6px breathing gap. Kept in sync
 * with AUDIO_TOGGLE_BUTTON_STYLE in framework/phaser/PhaserGameComponent.tsx.
 */
const AUDIO_TOGGLE_CLEARANCE = 48;

// ── Swipe threshold ────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 30;
const SLIDE_DURATION_MS = 140;
const MERGE_EFFECT_MS = 170;
const SPAWN_EFFECT_MS = 150;

// ── Difficulty card layout ─────────────────────────────────────────────────────
const CARD_H = 132;

const FONT_FAMILY = "Inter, Arial, sans-serif";

const RUSH_ASSETS = {
  felt: "rush-tile-felt",
  tile: (exp: number) => `rush-building-e${Math.min(Math.max(exp, 1), 12)}`,
} as const;

const TILE_ART_FILES = [
  "./art/building-e1.webp",
  "./art/building-e2.webp",
  "./art/building-e3.webp",
  "./art/building-e4.webp",
  "./art/building-e5.webp",
  "./art/building-e6.webp",
  "./art/building-e7.webp",
  "./art/building-e8.webp",
  "./art/building-e9.webp",
  "./art/building-e10.webp",
  "./art/building-e11.webp",
  "./art/building-e12.webp",
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
  private statusLabel!:Phaser.GameObjects.Text;
  private scoreCaption!: Phaser.GameObjects.Text;
  private bestCaption!: Phaser.GameObjects.Text;
  private boardHint!: Phaser.GameObjects.Text;
  private lobbyHeading!: Phaser.GameObjects.Text;
  private lobbySubtitle!: Phaser.GameObjects.Text;
  private dealingLabel!: Phaser.GameObjects.Text;
  private celebrationTile!: Phaser.GameObjects.Image;
  private celebrationTitle!: Phaser.GameObjects.Text;
  private celebrationCopy!: Phaser.GameObjects.Text;
  private celebrationDismiss!: Phaser.GameObjects.Text;

  private gridContainer!:  Phaser.GameObjects.Container;
  private lobbyContainer!: Phaser.GameObjects.Container;
  private dealingContainer!: Phaser.GameObjects.Container;
  private celebContainer!: Phaser.GameObjects.Container;

  private diffCards: Phaser.GameObjects.Container[] = [];
  private diffRewardLabels: Phaser.GameObjects.Text[] = [];
  private diffNameLabels: Phaser.GameObjects.Text[] = [];
  private diffCopyLabels: Phaser.GameObjects.Text[] = [];
  private diffTimeLabels: Phaser.GameObjects.Text[] = [];
  private startBtn!: Phaser.GameObjects.Container;

  // ── Input state ───────────────────────────────────────────────────────────────
  private swipeStart: { x: number; y: number } | null = null;
  private inputLocked = false;
  private awaitingTransition = false;
  private animationInProgress = false;
  private moveAnimationTimer: Phaser.Time.TimerEvent | null = null;

  // ── Game state mirror ─────────────────────────────────────────────────────────
  private prevBoard:     number[] = Array(16).fill(0);
  private curBoard:      number[] = Array(16).fill(0);
  private pickedDiff     = 0;
  private prevStatus     = "";
  private prevAppMode    = "";
  private prevIsMoving   = false;
  private lastTransitionSequence = -1;
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
    /**
     * Right inset for the header chips.
     *
     * The shared Phaser shell paints a 34px circular audio toggle at top:8 /
     * right:8 of the canvas host (AUDIO_TOGGLE_BUTTON_STYLE in
     * framework/phaser/PhaserGameComponent.tsx), so the top-right 42px of the
     * scene is not ours to draw in. The chips were pinned flush at
     * `sceneW - sidePad`, which put the MOVES chip under that button — its value
     * was fully covered on mobile and its caption clipped. Scene units track the
     * canvas CSS size (sceneW comes from `this.scale.width`), so the button's
     * DOM footprint can be reserved directly here.
     */
    const headerRightPad = Math.max(sidePad, AUDIO_TOGGLE_CLEARANCE);
    const lobbyCardGap = sceneW < 380 ? 8 : 10;
    const lobbyCardW = Math.max(94, Math.min(108, Math.floor((sceneW - sidePad * 2 - lobbyCardGap * 2) / 3)));
    const lobbyCardH = sceneH < 620 ? 124 : 132;
    const lobbyHeadingY = Math.round(Phaser.Math.Clamp(sceneH * 0.15, 82, 116));
    const lobbyHeroY = Math.round(Phaser.Math.Clamp(sceneH * 0.36, 196, 280));
    const lobbyCardsY = Math.round(Phaser.Math.Clamp(sceneH * 0.62, 348, sceneH - 172));
    const lobbyStartY = Math.round(Phaser.Math.Clamp(sceneH * 0.87, lobbyCardsY + lobbyCardH / 2 + 48, sceneH - 60));
    // In-play status keeps its grid-anchored slot; the lobby tucks its hint just
    // under the Start button so the lower third no longer reads as empty.
    const gridStatusY = Math.min(sceneH - 38, gridTop + gridH + 52);
    const lobbyStatusY = Math.min(sceneH - 20, lobbyStartY + 46);
    const statusY = gridStatusY;

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
      lobbyStatusY,
      titleX: sidePad + 4,
      titleY: sceneW < 380 ? 12 : 14,
      titleFontSize: sceneW < 380 ? "30px" : "36px",
      scoreX: sceneW - headerRightPad - scoreBoxW / 2,
      bestX: sceneW - headerRightPad - scoreBoxW - 8 - bestBoxW / 2,
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
    this.moveAnimationTimer?.remove(false);
    this.moveAnimationTimer = null;
    this.children.removeAll(true);
    this.cellBgs = [];
    this.tileConts = Array(16).fill(null);
    this.diffCards = [];
    this.diffRewardLabels = [];
    this.diffNameLabels = [];
    this.diffCopyLabels = [];
    this.diffTimeLabels = [];
    this.prevBoard = Array(16).fill(0);
    this.curBoard = Array(16).fill(0);
    this.prevStatus = "";
    this.prevAppMode = "";
    this.prevIsMoving = false;
    this.inputLocked = false;
    this.awaitingTransition = false;
    this.animationInProgress = false;
    this.lastTransitionSequence = -1;
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
    const moveTransition = this.val<MoveTransition | null>("moveTransition") ?? null;
    const isMoving    = this.bool("isMoving");
    const isDealing   = this.bool("isDealing");
    const isStarting  = this.bool("isStarting");
    const lastStatus  = this.str("lastStatus", "");
    const isLobby = status === "idle" || status === "solved" || status === "expired";
    const selectedDifficulty = Phaser.Math.Clamp(
      Math.round(this.num("selectedDifficulty", this.pickedDiff)),
      0,
      2,
    );
    if (isLobby && selectedDifficulty !== this.pickedDiff) {
      this.pickedDiff = selectedDifficulty;
      this.highlightDiffCard(this.pickedDiff);
    }
    this.applyLocalizedCopy();

    // ── Play-mode copy (guest drops the GAS reward tier on the lobby cards) ─────
    const appMode = this.str("appMode", "gamefi");
    if (appMode !== this.prevAppMode) {
      this.prevAppMode = appMode;
      const guestMode = appMode === "guest";
      this.diffRewardLabels.forEach((rewardLabel, idx) => {
        const rule = DIFFICULTY_RULES[idx];
        if (!rule) return;
        rewardLabel.setText(
          guestMode ? this.str("guestLaneTag", "Free play") : `${gasDisplay(rule.rewardFixed8)} GAS`,
        );
      });
      this.updateStartBtn(this.bool("isStarting"));
    }

    // ── Phase transitions ──────────────────────────────────────────────────────
    const statusChanged = status !== this.prevStatus;

    if (statusChanged) {
      this.prevStatus = status;
      const isPlaying  = status === "dealt";

      this.setObjectActive(this.gridContainer, isPlaying && board.length === 16);
      this.setTilesActive(isPlaying && board.length === 16);
      this.setObjectActive(this.lobbyContainer, isLobby);
      this.setObjectActive(this.dealingContainer, status === "committed" || (isDealing && !isPlaying));

      // Lobby tucks the hint just under the Start CTA; play uses the grid slot.
      this.statusLabel.setY(isLobby ? this.layout.lobbyStatusY : this.layout.statusY);

      if (isLobby) {
        this.shown2048 = false;
        this.moveAnimationTimer?.remove(false);
        this.moveAnimationTimer = null;
        this.inputLocked = false;
        this.awaitingTransition = false;
        this.animationInProgress = false;
        this.lastTransitionSequence = -1;
        this.clearTiles();
        this.setObjectActive(this.celebContainer, false);
        this.highlightDiffCard(this.pickedDiff);
        this.updateStartBtn(isStarting);
      }
    }

    // ── Score area ─────────────────────────────────────────────────────────────
    this.scoreLabel.setText(`${moveCount}`);
    // A fresh session has reached no tile yet. That is a real zero, not a
    // missing value: the dash it used to render was a first-run void sitting
    // next to MOVES 0, and read as "unavailable" rather than "none yet".
    this.bestLabel.setText(maxExp > 0 ? `${tileValue(maxExp)}` : "0");
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

      let transitionConsumed = false;
      if (
        moveTransition &&
        moveTransition.sequence !== this.lastTransitionSequence
      ) {
        this.lastTransitionSequence = moveTransition.sequence;
        transitionConsumed = true;
        this.awaitingTransition = false;
        if (this.canAnimateTransition(moveTransition)) {
          this.animateMoveTransition(moveTransition);
        } else {
          // Reload/resize or malformed visual state: the logical final board is
          // still authoritative, but we deliberately do not invent trajectories.
          this.renderBoardImmediate(moveTransition.after);
          this.inputLocked = isMoving;
        }
      }

      if (!transitionConsumed && !this.animationInProgress) {
        const boardChanged = board.some((value, index) => value !== this.curBoard[index]);
        const expectedTileCount = board.filter((exp) => exp > 0).length;
        const renderedTileCount = this.tileConts.filter(Boolean).length;
        if (boardChanged || renderedTileCount !== expectedTileCount) {
          // Initial deal, undo, restore, and authoritative recovery snap here.
          this.renderBoardImmediate(board);
        }
      }
    }

    // A failed backend request produces true→false without a transition. Release
    // the optimistic local lock so the player can retry.
    if (!isMoving && this.prevIsMoving && this.awaitingTransition && !this.animationInProgress) {
      this.awaitingTransition = false;
      this.inputLocked = false;
    } else if (!isMoving && !this.animationInProgress && !this.awaitingTransition) {
      this.inputLocked = false;
    }

    this.prevIsMoving = isMoving;

    // ── 2048 celebration ───────────────────────────────────────────────────────
    const targetExp = DIFFICULTY_RULES[this.num("gameDifficulty", 0)]?.targetExp ?? 9;
    if (!this.shown2048 && maxExp >= targetExp && status === "dealt") {
      this.shown2048 = true;
      this.playCelebration(targetExp);
    }
  }

  // ── Background ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const l = this.layout;

    this.add.rectangle(l.centerX, l.height / 2, l.width, l.height, C.bg);

    // Warm top wash that ends just above the difficulty lanes, so the hero board
    // sits fully inside one warm zone instead of straddling a seam.
    const washH = Math.max(238, l.lobbyCardsY - l.lobbyCardH / 2 - 10);
    this.add.rectangle(l.centerX, washH / 2, l.width, washH, 0xfff4df, 0.68);

    // Warm rounded footer panel that frames the Start CTA + status hint, so the
    // lower third reads as an intentional footer instead of an empty white void.
    const footerTop = l.lobbyStartY - 36;
    const footerBottom = Math.min(l.height - 8, l.lobbyStatusY + 20);
    const footerLeft = l.sidePad + 6;
    const footerW = l.width - footerLeft * 2;
    const footerH = Math.max(72, footerBottom - footerTop);
    const footer = this.add.graphics();
    footer.fillStyle(0xffffff, 0.5);
    footer.fillRoundedRect(footerLeft, footerTop, footerW, footerH, 16);
    footer.lineStyle(1, 0xe9dcc7, 0.7);
    footer.strokeRoundedRect(footerLeft, footerTop, footerW, footerH, 16);
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

    // Moves box (the run's move counter — the only "score" 2048 tracks)
    const scoreBox = this.add.container(l.scoreX, l.headerBoxY);
    const scoreBg = this.add.rectangle(0, 0, l.scoreBoxW, 52, C.chipBg).setOrigin(0.5);
    this.scoreCaption = this.add.text(0, -10, this.str("scoreMovesCaption", "MOVES"), {
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
    scoreBox.add([scoreBg, this.scoreCaption, this.scoreLabel]);

    // Best tile box
    const bestBox = this.add.container(l.bestX, l.headerBoxY);
    const bestBg = this.add.rectangle(0, 0, l.bestBoxW, 52, C.chipBg).setOrigin(0.5);
    this.bestCaption = this.add.text(0, -10, this.str("scoreBestCaption", "BEST"), {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#f9f6f2",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.bestLabel = this.add.text(0, 8, "0", {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    bestBox.add([bestBg, this.bestCaption, this.bestLabel]);
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
    this.boardHint = this.add.text(
      l.centerX,
      l.hintY,
      this.str("boardControlsHint", "Swipe or use arrow keys"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#9a8f82",
      },
    ).setOrigin(0.5);
    this.gridContainer.add(this.boardHint);

    this.gridContainer.setVisible(false);
  }

  // ── Lobby container ───────────────────────────────────────────────────────────

  private buildLobbyContainer(): void {
    const l = this.layout;
    this.diffRewardLabels = [];
    this.lobbyContainer = this.add.container(0, 0);

    this.lobbyHeading = this.add.text(
      l.centerX,
      l.lobbyHeadingY,
      this.str("lobbyHeading", "Build the next power tile"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "bold",
      color: C.headerText,
      },
    ).setOrigin(0.5);

    this.lobbySubtitle = this.add.text(
      l.centerX,
      l.lobbySubY,
      this.str("lobbySubtitle", "Slide, merge, and settle a verified run"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#776e65",
      },
    ).setOrigin(0.5);

    const heroBoard = this.buildLobbyHeroBoard(l.centerX, l.lobbyHeroY);

    this.lobbyContainer.add([this.lobbyHeading, this.lobbySubtitle, heroBoard]);

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
    const cols = 3;
    const rows = 2;
    const cell = compact ? 44 : 50;
    const gap = compact ? 7 : 8;
    const gridW = cols * cell + (cols + 1) * gap;
    const gridH = rows * cell + (rows + 1) * gap;

    const board = this.add.container(x, y);

    // Board frame — a felt tray with a soft drop shadow, echoing the 4x4 grid.
    const shadow = this.add.rectangle(3, 6, gridW + 12, gridH + 12, 0x8f7555, 0.16).setOrigin(0.5);
    const tray = this.add.graphics();
    tray.fillStyle(0xbbada0, 0.96);
    tray.fillRoundedRect(-gridW / 2, -gridH / 2, gridW, gridH, 10);
    const felt = this.add.image(0, 0, RUSH_ASSETS.felt)
      .setDisplaySize(gridW - 4, gridH - 4)
      .setAlpha(0.5);
    const frame = this.add.rectangle(0, 0, gridW + 8, gridH + 8, 0xffffff, 0)
      .setStrokeStyle(2, 0xe6d4b4, 0.6)
      .setOrigin(0.5);
    board.add([shadow, tray, felt, frame]);

    // 3x2 preview of ascending power tiles (2 → 2048), laid on an aligned grid
    // with numerals so the lobby reads unmistakably as 2048, not match-3.
    const preview = [1, 2, 4, 7, 9, 11]; // exponents → 2,4,16,128,512,2048
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const exp = preview[r * cols + c]!;
        const cx = -gridW / 2 + gap + cell / 2 + c * (cell + gap);
        const cy = -gridH / 2 + gap + cell / 2 + r * (cell + gap);

        // Recessed cell for edge separation behind the jewel art.
        const recess = this.add.graphics();
        recess.fillStyle(C.white, 0.4);
        recess.fillRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, CORNER_R);
        recess.lineStyle(1, 0xd8c8a9, 0.55);
        recess.strokeRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, CORNER_R);
        board.add(recess);

        const img = this.add.image(cx, cy, RUSH_ASSETS.tile(exp))
          .setDisplaySize(cell - 2, cell - 2);
        board.add(img);
        board.add(this.makeTileNumeral(cx, cy, exp, cell));
      }
    }

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

  /**
   * Bold tile numeral matching the gameplay treatment (createTileSprite): white
   * on dark tiles, warm brown on light ones, with an exp-based shadow so digits
   * stay legible over the jewel art.
   */
  private makeTileNumeral(x: number, y: number, exp: number, size: number): Phaser.GameObjects.Text {
    const value = tileValue(exp);
    const ratio = value >= 1000 ? 0.3 : value >= 100 ? 0.36 : 0.44;
    return this.add.text(x, y, `${value}`, {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.max(12, Math.round(size * ratio))}px`,
      fontStyle: "bold",
      color: "#2d261f",
      backgroundColor: "rgba(255, 253, 244, 0.9)",
    }).setOrigin(0.5)
      .setPadding(4, 2, 4, 2)
      .setShadow(0, 1, "rgba(255, 255, 255, 0.75)", 2);
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
      this.dispatch("setDifficulty", idx);
    });

    const targetExp = Math.max(1, Math.min(12, Math.round(Math.log2(rule.targetTile))));
    const tileSize = l.lobbyCardW < 104 ? 48 : 54;
    const targetY = l.lobbyCardH < CARD_H ? -32 : -34;
    const targetTile = this.add.image(0, -34, RUSH_ASSETS.tile(targetExp))
      .setY(targetY)
      .setDisplaySize(tileSize, tileSize);

    // Target value printed on the jewel so each lane names its 2048-style goal.
    const targetNum = this.add.text(0, targetY, `${rule.targetTile}`, {
      fontFamily: FONT_FAMILY,
      fontSize: rule.targetTile >= 1000 ? "16px" : "18px",
      fontStyle: "bold",
      color: "#2d261f",
      backgroundColor: "rgba(255, 253, 244, 0.9)",
    }).setOrigin(0.5)
      .setPadding(4, 2, 4, 2)
      .setShadow(0, 1, "rgba(255, 255, 255, 0.75)", 2);

    const difficultyLabels = this.val<string[]>("difficultyLabels") ?? [];
    const difficultyCopy = this.val<string[]>("difficultyCopy") ?? [];
    const difficultyTimes = this.val<string[]>("difficultyTimes") ?? [];
    const label = this.add.text(
      0,
      l.lobbyCardH < CARD_H ? 4 : 7,
      difficultyLabels[idx] ?? DIFF_LABELS[idx] ?? "Sprint",
      {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#35322e",
      },
    ).setOrigin(0.5);
    this.diffNameLabels.push(label);

    const tileTxt = this.add.text(
      0,
      l.lobbyCardH < CARD_H ? 22 : 26,
      difficultyCopy[idx] ?? DIFF_COPY[idx] ?? `Reach ${rule.targetTile}`,
      {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#776e65",
      },
    ).setOrigin(0.5);
    this.diffCopyLabels.push(tileTxt);

    const timeTxt = this.add.text(
      0,
      l.lobbyCardH < CARD_H ? 39 : 43,
      difficultyTimes[idx] ?? `${Math.round(rule.limitMs / 60000)} min`,
      {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: "#776e65",
      },
    ).setOrigin(0.5);
    this.diffTimeLabels.push(timeTxt);

    // Guest is a free local game — show a "Free play" tag instead of the GAS
    // reward tier so the lobby carries no reward framing in guest mode.
    const rewardStr = this.isGuestMode()
      ? this.str("guestLaneTag", "Free play")
      : `${gasDisplay(rule.rewardFixed8)} GAS`;
    const rewardTxt = this.add.text(0, l.lobbyCardH < CARD_H ? 53 : 57, rewardStr, {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#e05000",
    }).setOrigin(0.5);
    this.diffRewardLabels.push(rewardTxt);

    card.add([bg, targetTile, targetNum, label, tileTxt, timeTxt, rewardTxt]);
    return card;
  }

  private buildStartButton(x: number, y: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 220, 52, 0xf65e3b)
      .setStrokeStyle(2, 0xf2b179)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, this.str("startOpenRun", "Open run"), {
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
    const poolConfirmed = this.bool("balancesReady");

    // Only the label + fill are gated here — canStartPicked's enable logic (and
    // its test-pinned poolFree comparison) is untouched. While balances are
    // still unknown we show an inviting "checking pool" state instead of the
    // discouraging "pool low" copy; that hardens into "pool low" only once the
    // pool is confirmed insufficient.
    let label: string;
    let active: boolean;
    if (isStarting) {
      label = this.str("startOpening", "Opening…");
      active = false;
    } else if (canStart) {
      label = this.str("startOpenRun", "Open run");
      active = true;
    } else if (!poolConfirmed) {
      label = this.str("startCheckingPool", "Checking pool…");
      active = true;
    } else {
      label = this.str("startPoolLow", "Pool low");
      active = false;
    }
    txt.setText(label);
    bg.setFillStyle(active ? 0xf65e3b : 0xbbada0);
  }

  private applyLocalizedCopy(): void {
    this.scoreCaption?.setText(this.str("scoreMovesCaption", "MOVES"));
    this.bestCaption?.setText(this.str("scoreBestCaption", "BEST"));
    this.boardHint?.setText(this.str("boardControlsHint", "Swipe or use arrow keys"));
    this.lobbyHeading?.setText(this.str("lobbyHeading", "Build the next power tile"));
    this.lobbySubtitle?.setText(
      this.str("lobbySubtitle", "Slide, merge, and settle a verified run"),
    );
    this.dealingLabel?.setText(this.str("dealingLabel", "Preparing run..."));
    this.celebrationTitle?.setText(this.str("celebrationTitle", "Target unlocked"));
    this.celebrationCopy?.setText(
      this.str("celebrationCopy", "Keep merging or submit the run"),
    );
    this.celebrationDismiss?.setText(this.str("celebrationDismiss", "Tap to continue"));

    const names = this.val<string[]>("difficultyLabels") ?? [];
    const copy = this.val<string[]>("difficultyCopy") ?? [];
    const times = this.val<string[]>("difficultyTimes") ?? [];
    this.diffNameLabels.forEach((label, index) => {
      label.setText(names[index] ?? DIFF_LABELS[index] ?? "Sprint");
    });
    this.diffCopyLabels.forEach((label, index) => {
      const rule = DIFFICULTY_RULES[index];
      label.setText(copy[index] ?? DIFF_COPY[index] ?? `Reach ${rule?.targetTile ?? 512}`);
    });
    this.diffTimeLabels.forEach((label, index) => {
      const rule = DIFFICULTY_RULES[index];
      label.setText(times[index] ?? `${Math.round((rule?.limitMs ?? 240_000) / 60_000)} min`);
    });
  }

  private isGuestMode(): boolean {
    return this.str("appMode", "gamefi") === "guest";
  }

  private canStartPicked(): boolean {
    if (this.bool("isStarting") || this.bool("isDealing")) return false;
    // Guest is a free local game — there is no reward pool to gate on.
    if (this.isGuestMode()) return true;
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

    this.dealingLabel = this.add.text(0, 18, this.str("dealingLabel", "Preparing run..."), {
      fontFamily: FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#35322e",
    }).setOrigin(0.5);

    const dot1 = this.add.circle(-22, 50, 5, 0xf2b179);
    const dot2 = this.add.circle(0, 50, 5, 0xf2b179);
    const dot3 = this.add.circle(22, 50, 5, 0xf2b179);

    this.dealingContainer.add([
      bg,
      tileA,
      tileB,
      tileC,
      this.dealingLabel,
      dot1,
      dot2,
      dot3,
    ]);

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

    this.celebrationTile = this.add.image(0, -52, RUSH_ASSETS.tile(11))
      .setDisplaySize(86, 86);

    this.celebrationTitle = this.add.text(
      0,
      12,
      this.str("celebrationTitle", "Target unlocked"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#35322e",
      },
    ).setOrigin(0.5);

    this.celebrationCopy = this.add.text(
      0,
      42,
      this.str("celebrationCopy", "Keep merging or submit the run"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      color: "#5a4f45",
      },
    ).setOrigin(0.5);

    this.celebrationDismiss = this.add.text(
      0,
      76,
      this.str("celebrationDismiss", "Tap to continue"),
      {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#e05000",
      },
    ).setOrigin(0.5);

    this.celebContainer.add([
      overlay,
      banner,
      this.celebrationTile,
      this.celebrationTitle,
      this.celebrationCopy,
      this.celebrationDismiss,
    ]);
    this.celebContainer.setVisible(false);

    overlay.on("pointerdown", () => {
      this.playSfx("select");
      if (this.reducedMotion) {
        this.setObjectActive(this.celebContainer, false);
        return;
      }
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

  private playCelebration(targetExp: number): void {
    this.playSfx("win");
    this.celebrationTile.setTexture(RUSH_ASSETS.tile(targetExp)).setDisplaySize(86, 86);
    this.setObjectActive(this.celebContainer, true);
    if (this.reducedMotion) {
      this.celebContainer.setAlpha(1);
      return;
    }
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
    tile.scaleFactor = scale;
    tile.objects.forEach((object, index) => {
      const base = tile.baseScales[index] ?? { x: 1, y: 1 };
      (object as { setScale?: (x: number, y?: number) => void }).setScale?.(
        base.x * scale,
        base.y * scale,
      );
    });
  }

  /** Tween a visual multiplier without destroying each asset's display-size scale. */
  private tweenTileScale(
    tile: TileVisual,
    target: number,
    duration: number,
    ease: string,
    onComplete?: () => void,
  ): void {
    const factor = { value: tile.scaleFactor };
    this.tweens.add({
      targets: factor,
      value: target,
      duration,
      ease,
      onUpdate: () => this.setTileScale(tile, factor.value),
      onComplete: () => {
        this.setTileScale(tile, target);
        onComplete?.();
      },
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
    this.moveAnimationTimer?.remove(false);
    this.moveAnimationTimer = null;
    this.animationInProgress = false;
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
    this.curBoard = board.slice();
    this.prevBoard = board.slice();
  }

  /**
   * Require a complete source identity map and the exact board currently on
   * screen. Restores/resizes intentionally snap instead of guessing.
   */
  private canAnimateTransition(transition: MoveTransition): boolean {
    if (
      transition.before.length !== 16 ||
      transition.afterSlide.length !== 16 ||
      transition.after.length !== 16 ||
      transition.before.some((value, index) => value !== this.curBoard[index])
    ) {
      return false;
    }

    const expectedSources = transition.before
      .map((exponent, source) => ({ exponent, source }))
      .filter(({ exponent }) => exponent > 0);
    if (transition.motions.length !== expectedSources.length) return false;
    const seenSources = new Set<number>();

    for (const motion of transition.motions) {
      if (
        motion.source < 0 || motion.source > 15 ||
        motion.destination < 0 || motion.destination > 15 ||
        seenSources.has(motion.source) ||
        transition.before[motion.source] !== motion.exponent ||
        !this.tileConts[motion.source]
      ) {
        return false;
      }
      if (
        motion.merge !== null &&
        (motion.merge < 0 || motion.merge >= transition.merges.length)
      ) {
        return false;
      }
      seenSources.add(motion.source);
    }

    return (
      seenSources.size === expectedSources.length &&
      transition.afterSlide[transition.spawn.destination] === 0 &&
      transition.after[transition.spawn.destination] === transition.spawn.exponent
    );
  }

  /**
   * Play a confirmed move using the pure engine's identity map. Two merge
   * sources visibly converge before they are replaced by the elastic result;
   * the RNG spawn is born only after that slide settles.
   */
  private animateMoveTransition(transition: MoveTransition): void {
    this.moveAnimationTimer?.remove(false);
    this.moveAnimationTimer = null;
    this.animationInProgress = true;
    this.inputLocked = true;
    this.curBoard = transition.after.slice();
    this.prevBoard = transition.after.slice();
    this.playSfx("move");

    const sourceTiles = [...this.tileConts];
    const slide = (): void => {
      for (const motion of transition.motions) {
        const tile = sourceTiles[motion.source];
        if (!tile) continue;
        const { x, y } = this.cellXY(motion.destination);
        if (this.reducedMotion) this.setTilePosition(tile, x, y);
        else this.tweenTileTo(tile, x, y, SLIDE_DURATION_MS);
      }
    };

    const settle = (): void => {
      this.moveAnimationTimer = null;
      const nextTiles: (TileVisual | null)[] = Array(16).fill(null);

      for (const motion of transition.motions) {
        if (motion.merge !== null) continue;
        const tile = sourceTiles[motion.source];
        if (!tile) continue;
        const { x, y } = this.cellXY(motion.destination);
        this.setTilePosition(tile, x, y);
        this.updateTileSprite(tile, motion.exponent);
        nextTiles[motion.destination] = tile;
      }

      const mergeTiles: TileVisual[] = [];
      for (const merge of transition.merges) {
        for (const source of merge.sources) this.destroyTile(sourceTiles[source]);
        const { x, y } = this.cellXY(merge.destination);
        const result = this.createTileSprite(merge.resultExponent, x, y);
        this.setTileScale(result, this.reducedMotion ? 1 : 0.86);
        nextTiles[merge.destination] = result;
        mergeTiles.push(result);
      }

      const spawn = transition.spawn;
      const spawnXY = this.cellXY(spawn.destination);
      const spawnTile = this.createTileSprite(spawn.exponent, spawnXY.x, spawnXY.y);
      this.setTileScale(spawnTile, this.reducedMotion ? 1 : 0);
      nextTiles[spawn.destination] = spawnTile;
      this.tileConts = nextTiles;
      this.setTilesActive(true);

      if (mergeTiles.length > 0) this.playSfx("merge");
      this.playSfx("spawn");

      if (this.reducedMotion) {
        this.finishMoveAnimation(transition.after);
        return;
      }

      for (const tile of mergeTiles) {
        this.tweenTileScale(tile, 1.16, 80, "Back.easeOut", () => {
          this.tweenTileScale(tile, 1, 90, "Sine.easeInOut");
        });
      }
      this.tweenTileScale(spawnTile, 1, SPAWN_EFFECT_MS, "Back.easeOut");

      this.moveAnimationTimer = this.time.delayedCall(
        Math.max(MERGE_EFFECT_MS, SPAWN_EFFECT_MS) + 10,
        () => this.finishMoveAnimation(transition.after),
      );
    };

    slide();
    if (this.reducedMotion) settle();
    else this.moveAnimationTimer = this.time.delayedCall(SLIDE_DURATION_MS, settle);
  }

  private finishMoveAnimation(finalBoard: readonly number[]): void {
    this.moveAnimationTimer = null;
    for (let index = 0; index < 16; index += 1) {
      const tile = this.tileConts[index];
      if (!tile) continue;
      const { x, y } = this.cellXY(index);
      this.setTilePosition(tile, x, y);
      this.setTileScale(tile, 1);
      this.updateTileSprite(tile, finalBoard[index] ?? 0);
    }
    this.curBoard = [...finalBoard];
    this.prevBoard = [...finalBoard];
    this.animationInProgress = false;
    this.awaitingTransition = false;
    this.inputLocked = this.bool("isMoving");
  }

  /**
   * Build a single scene-level tile visual at (x, y) for the given exponent.
   */
  private createTileSprite(exp: number, x: number, y: number): TileVisual {
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

    // Tile value text — drawn directly on the tile (no box), using the
    // palette's own text colour so high tiles read white-on-colour like 2048.
    const label = this.add.text(x, y, `${tileValue(exp)}`, {
      fontFamily: FONT_FAMILY,
      fontSize: tileFontSize(exp, cellSize),
      fontStyle: "bold",
      color: tileColors(exp).text,
    }).setOrigin(0.5)
      .setPadding(5, 2, 5, 2);

    [shadow, art, label].forEach((object) => {
      if (!this.children.exists(object)) {
        this.children.add(object);
      }
    });

    const objects: Phaser.GameObjects.GameObject[] = [shadow, art, label];
    const baseScales = objects.map((object) => {
      const scaled = object as Phaser.GameObjects.GameObject & {
        scaleX?: number;
        scaleY?: number;
      };
      return { x: scaled.scaleX ?? 1, y: scaled.scaleY ?? 1 };
    });

    return { shadow, art, label, objects, baseScales, scaleFactor: 1, x, y };
  }

  /**
   * Update an existing tile sprite's value in place (for non-animated updates).
   */
  private updateTileSprite(tile: TileVisual, exp: number): void {
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
      .setColor(tileColors(exp).text)
      .setFontSize(tileFontSize(exp, cellSize))
      .setPadding(5, 2, 5, 2);
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
    if (this.inputLocked || this.bool("isMoving") || this.bool("isSubmitting")) return;
    if (!this.canMove(dir)) return;

    // Lock synchronously so two keyboard/swipe events in the same React frame
    // cannot dispatch duplicate moves before isMoving reaches the bridge.
    this.inputLocked = true;
    this.awaitingTransition = true;
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
