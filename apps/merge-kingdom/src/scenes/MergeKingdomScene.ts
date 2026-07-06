/**
 * MergeKingdomScene — Phaser 3 scene for the Merge Kingdom tile-merge puzzle.
 *
 * Renders a warm medieval parchment board with a 4×4 grid of kingdom tiles.
 * Tiles upgrade through: Grass → Hut → Cottage → House → Tower → Market →
 *   Forge → Gate → Keep → Castle → Citadel (values 2–2048).
 *
 * Interaction:
 *  - Click an occupied tile to select it (gold ring highlight).
 *  - Click an adjacent empty tile to move, or adjacent same-value tile to merge.
 *  - Merge animation: scale-pop on the destination tile.
 *
 * State received from React (via GameBridge):
 *  gameStatus     string   "idle"|"committed"|"dealt"|"solved"|"expired"
 *  board          number[][] 4×4 grid  (0 = empty)
 *  moveCount      number
 *  tileAchieved   number   highest tile value reached this session
 *  gameDifficulty number   0=Easy 1=Medium 2=Hard
 *  deadline       number   Unix-epoch ms when the game expires (0=none)
 *  isStarting     boolean
 *  isDealing      boolean
 *  isSubmitting   boolean
 *  walletConnected boolean
 *  poolFree       number   pool GAS available
 *
 * Actions dispatched:
 *  "startGame"       { difficulty: number }
 *  "recordMove"      fromRow, fromCol, toRow, toCol (positional args)
 *  "submitSolution"  {}
 *  "expireGame"      {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  BOARD_SIZE,
  DIFFICULTY_RULES,
  gasDisplay,
  formatClock,
} from "../logic/game-rules";

// ── Canvas & layout constants ───────────────────────────────────────────────

export const SCENE_W = 400;
export const SCENE_H = 600;

const TILE_SIZE = 72;
const TILE_GAP  = 8;
const BOARD_PAD = 10;
// Outer board dimensions: 2*pad + 4*tile + 3*gap = 332 × 332
const BOARD_W   = BOARD_PAD * 2 + BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP;
const BOARD_X   = (SCENE_W - BOARD_W) / 2; // 34
const BOARD_Y   = 68;

// Centers of each tile cell
function tileX(col: number): number {
  return BOARD_X + BOARD_PAD + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
}
function tileY(row: number): number {
  return BOARD_Y + BOARD_PAD + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
}

// ── Colour palette ──────────────────────────────────────────────────────────

const C = {
  bg:          0xf5ead2,
  bgDark:      0xeaddb8,
  boardBg:     0xc9a96e,
  boardBorder: 0x9a7040,
  gold:        0xd4a843,
  goldLight:   0xf0c866,
  goldDim:     0xa07030,
  cream:       0xfff8e6,
  white:       0xffffff,
  inkDark:     0x2b261f,
  muted:       0x8b7355,
  cardBg:      0xffffff,
  cardBorder:  0xe8d5b0,
  cardActive:  0xfff3d0,
  successGreen:0x16a34a,
  dangerRed:   0xdc2626,
  timerLow:    0xdc2626,
  empty:       0x9e7b50,
};

// Tile fill colours keyed by tile value
const TILE_FILL: Record<number, number> = {
  0:    0x9e7b50,
  2:    0xfff7d6,
  4:    0xf8e7bd,
  8:    0xefd28f,
  16:   0xe8bd67,
  32:   0xdba84f,
  64:   0xce933d,
  128:  0xbf7d31,
  256:  0xad6728,
  512:  0x9b5222,
  1024: 0x833f1d,
  2048: 0x6f3118,
};

// Tile text colours (CSS strings for Phaser Text)
const TILE_TEXT: Record<number, string> = {
  0:    "#705736",
  2:    "#6e4a12",
  4:    "#6e4a12",
  8:    "#5f3f10",
  16:   "#5a3710",
  32:   "#fff8e6",
  64:   "#fff8e6",
  128:  "#fff8e6",
  256:  "#fff8e6",
  512:  "#fff8e6",
  1024: "#fff8e6",
  2048: "#fff8e6",
};

// Short building names rendered on each tile
const TILE_NAME: Record<number, string> = {
  0:    "",
  2:    "Grass",
  4:    "Hut",
  8:    "Cottage",
  16:   "House",
  32:   "Tower",
  64:   "Market",
  128:  "Forge",
  256:  "Gate",
  512:  "Keep",
  1024: "Castle",
  2048: "Citadel",
};

const DIFF_LABELS = ["Easy", "Medium", "Hard"];

// ── Tile object (holds the Phaser renderables for one board cell) ───────────

interface TileObj {
  container: Phaser.GameObjects.Container;
  bg:        Phaser.GameObjects.Rectangle;
  nameText:  Phaser.GameObjects.Text;
  valBadge:  Phaser.GameObjects.Text;
  valBadgeBg:Phaser.GameObjects.Rectangle;
}

// ── Scene class ─────────────────────────────────────────────────────────────

export class MergeKingdomScene extends BaseScene {

  // ── Groups (visibility-toggled by phase) ──────────────────────────────────
  private lobbyObjects: Phaser.GameObjects.GameObject[]   = [];
  private loadingObjects: Phaser.GameObjects.GameObject[] = [];
  private playObjects: Phaser.GameObjects.GameObject[]    = [];
  private resultObjects: Phaser.GameObjects.GameObject[]  = [];

  // ── Board ─────────────────────────────────────────────────────────────────
  private tiles: TileObj[][] = [];           // [row][col]
  private prevBoard: number[][] = [];        // for merge-pop detection
  private selectionRing!: Phaser.GameObjects.Rectangle;
  private selectedCell: { row: number; col: number } | null = null;
  private boardBg!: Phaser.GameObjects.Rectangle;

  // ── HUD (play phase) ──────────────────────────────────────────────────────
  private timerText!:    Phaser.GameObjects.Text;
  private timerFill!:    Phaser.GameObjects.Rectangle;
  private timerTrack!:   Phaser.GameObjects.Rectangle;
  private targetText!:   Phaser.GameObjects.Text;
  private targetFill!:   Phaser.GameObjects.Rectangle;
  private movesText!:    Phaser.GameObjects.Text;
  private bestTileText!: Phaser.GameObjects.Text;
  private hintText!:     Phaser.GameObjects.Text;
  private submitBtn!:    Phaser.GameObjects.Container;
  private expireBtn!:    Phaser.GameObjects.Container;

  // ── Lobby ─────────────────────────────────────────────────────────────────
  private diffCards: Phaser.GameObjects.Container[]  = [];
  private selectedDiff = 0;
  private startBtn!:    Phaser.GameObjects.Container;
  private startBtnText!:Phaser.GameObjects.Text;
  private poolText!:    Phaser.GameObjects.Text;

  // ── Loading ───────────────────────────────────────────────────────────────
  private loadingTiles: Phaser.GameObjects.Rectangle[] = [];
  private loadingText!: Phaser.GameObjects.Text;
  private loadTween:    Phaser.Tweens.Tween | null = null;

  // ── Result ────────────────────────────────────────────────────────────────
  private resultCard!: Phaser.GameObjects.Container;
  private resultTitle!:  Phaser.GameObjects.Text;
  private resultBody!:   Phaser.GameObjects.Text;

  // ── Runtime ───────────────────────────────────────────────────────────────
  private currentPhase: "lobby" | "loading" | "play" | "result" = "lobby";
  private clockTimer: Phaser.Time.TimerEvent | null = null;
  private nowMs = Date.now();

  constructor() {
    super("MergeKingdomScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    // No external assets — everything rendered with Phaser primitives
  }

  create(): void {
    super.create(); // wires GameBridge

    this.buildBackground();
    this.buildLobby();
    this.buildLoading();
    this.buildBoard();
    this.buildHUD();
    this.buildResult();

    // Start 1-second clock for deadline countdown
    this.clockTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => { this.nowMs = Date.now(); },
    });

    this.setPhase("lobby");
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract ────────────────────────────────────────────────────

  protected onStateUpdate(state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");

    // Determine phase
    if (status === "solved" || status === "expired") {
      if (this.currentPhase !== "result") this.setPhase("result");
      this.updateResult();
    } else if (isStarting || isDealing || status === "committed") {
      if (this.currentPhase !== "loading") this.setPhase("loading");
      this.updateLoading();
    } else if (status === "dealt") {
      if (this.currentPhase !== "play") {
        this.setPhase("play");
        this.selectedCell = null;
        this.selectionRing.setVisible(false);
      }
      this.updateHUD();
      this.updateBoard();
    } else {
      // idle
      if (this.currentPhase !== "lobby") this.setPhase("lobby");
      this.updateLobby();
    }
  }

  // ── Phase switch ──────────────────────────────────────────────────────────

  private setPhase(phase: "lobby" | "loading" | "play" | "result"): void {
    this.currentPhase = phase;
    this.setGroupVisible(this.lobbyObjects,   phase === "lobby");
    this.setGroupVisible(this.loadingObjects, phase === "loading");
    this.setGroupVisible(this.playObjects,    phase === "play");
    this.selectionRing.setVisible(false);
    this.setGroupVisible(this.resultObjects,  phase === "result");
  }

  private setGroupVisible(
    objs: Phaser.GameObjects.GameObject[],
    visible: boolean,
  ): void {
    for (const obj of objs) {
      if ("setVisible" in obj) {
        (obj as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(visible);
      }
    }
  }

  // ── Build: background ────────────────────────────────────────────────────

  private buildBackground(): void {
    // Parchment gradient using two overlapping rectangles
    const bg = this.add.rectangle(SCENE_W / 2, SCENE_H / 2, SCENE_W, SCENE_H, C.bg);
    const overlay = this.add.rectangle(SCENE_W / 2, SCENE_H * 0.3, SCENE_W, SCENE_H * 0.6, C.bgDark, 80);
    // Decorative border frame
    const frame = this.add.rectangle(SCENE_W / 2, SCENE_H / 2, SCENE_W - 12, SCENE_H - 12);
    frame.setStrokeStyle(2, C.goldDim, 60);
    frame.setFillStyle(0, 0);
    // These are always visible, not in any phase group
    void bg; void overlay; void frame;
  }

  // ── Build: lobby ─────────────────────────────────────────────────────────

  private buildLobby(): void {
    // Title
    const title = this.add.text(SCENE_W / 2, 38, "Merge Kingdom", {
      fontSize: "22px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0.5);

    const sub = this.add.text(SCENE_W / 2, 64, "Build your realm, tile by tile", {
      fontSize: "13px", color: "#8b7355",
    }).setOrigin(0.5);

    // 3 difficulty cards
    this.diffCards = [];
    const cardW = 340;
    const cardH = 88;
    const cardX = SCENE_W / 2;
    const cardStartY = 130;
    const cardStep = 106;

    DIFFICULTY_RULES.forEach((rule, i) => {
      const cy = cardStartY + i * cardStep;
      const card = this.buildDiffCard(cardX, cy, cardW, cardH, i, rule);
      this.diffCards.push(card);
      this.lobbyObjects.push(card);
    });

    // Start button
    this.startBtn = this.buildActionButton(SCENE_W / 2, 470, 188, 50, "Start Kingdom", () => {
      if (this.bool("walletConnected") === false) return;
      this.dispatch("startGame", this.selectedDiff);
    });
    this.startBtnText = this.startBtn.list[1] as Phaser.GameObjects.Text;

    // Pool status
    this.poolText = this.add.text(SCENE_W / 2, 534, "", {
      fontSize: "11px", color: "#8b7355", align: "center", wordWrap: { width: 320 },
    }).setOrigin(0.5);

    this.lobbyObjects.push(title, sub, this.startBtn, this.poolText);
  }

  private buildDiffCard(
    cx: number, cy: number,
    w: number, h: number,
    diffIdx: number,
    rule: typeof DIFFICULTY_RULES[0],
  ): Phaser.GameObjects.Container {
    const card = this.add.container(cx, cy);

    const bg = this.add.rectangle(0, 0, w, h, C.cardBg)
      .setStrokeStyle(1.5, C.cardBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => {
      if (diffIdx !== this.selectedDiff) bg.setFillStyle(0xfff8ef);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(diffIdx === this.selectedDiff ? C.cardActive : C.cardBg);
    });
    bg.on("pointerdown", () => {
      this.selectedDiff = diffIdx;
      this.refreshDiffCards();
      this.tweens.add({ targets: card, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true });
    });

    // Tile crest (colored square for the target tile)
    const targetVal = rule.targetTile;
    const cresthex  = TILE_FILL[targetVal] ?? 0x9e7b50;
    const crest = this.add.rectangle(-w / 2 + 46, 0, 44, 44, cresthex)
      .setStrokeStyle(1, C.boardBorder)
      .setOrigin(0.5);
    const crestText = this.add.text(-w / 2 + 46, 0, TILE_NAME[targetVal] ?? "?", {
      fontSize: "9px", color: TILE_TEXT[targetVal] ?? "#ffffff",
    }).setOrigin(0.5);

    // Labels
    const nameLabel = this.add.text(-w / 2 + 78, -14, DIFF_LABELS[diffIdx] ?? "", {
      fontSize: "15px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0, 0.5);
    const goalLabel = this.add.text(-w / 2 + 78, 6, `Goal: merge to ${targetVal}`, {
      fontSize: "11px", color: "#8b7355",
    }).setOrigin(0, 0.5);

    // Reward badge
    const reward = this.add.text(w / 2 - 12, -12, `${gasDisplay(rule.reward)} GAS`, {
      fontSize: "12px", fontStyle: "bold", color: "#a07030",
    }).setOrigin(1, 0.5);
    const entry = this.add.text(w / 2 - 12, 10, `Entry: ${gasDisplay(rule.entry)} GAS`, {
      fontSize: "10px", color: "#8b7355",
    }).setOrigin(1, 0.5);
    const limitLabel = this.add.text(w / 2 - 12, 26, `${Math.round(rule.limitMs / 60000)} min`, {
      fontSize: "10px", color: "#8b7355",
    }).setOrigin(1, 0.5);

    card.add([bg, crest, crestText, nameLabel, goalLabel, reward, entry, limitLabel]);
    return card;
  }

  private refreshDiffCards(): void {
    this.diffCards.forEach((card, i) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(i === this.selectedDiff ? C.cardActive : C.cardBg);
      bg.setStrokeStyle(i === this.selectedDiff ? 2 : 1.5,
        i === this.selectedDiff ? C.gold : C.cardBorder);
    });
    this.updateLobby();
  }

  // ── Build: loading ────────────────────────────────────────────────────────

  private buildLoading(): void {
    const title = this.add.text(SCENE_W / 2, 220, "Preparing your kingdom…", {
      fontSize: "16px", color: "#2b261f",
    }).setOrigin(0.5);

    this.loadingText = this.add.text(SCENE_W / 2, 248, "", {
      fontSize: "12px", color: "#8b7355",
    }).setOrigin(0.5);

    // 2×2 animated tile grid
    const gridOffsets = [
      [-28, -28], [28, -28], [-28, 28], [28, 28],
    ];
    this.loadingTiles = gridOffsets.map((offset, i) => {
      const ox = offset[0] ?? 0;
      const oy = offset[1] ?? 0;
      const r = this.add.rectangle(
        SCENE_W / 2 + ox,
        SCENE_H / 2 - 30 + oy,
        46, 46, C.gold,
      ).setStrokeStyle(2, C.goldLight);
      r.setAlpha(0.3 + (i % 2) * 0.1);
      return r;
    });

    this.loadingObjects.push(title, this.loadingText, ...this.loadingTiles);
  }

  // ── Build: board ──────────────────────────────────────────────────────────

  private buildBoard(): void {
    // Board background plaque
    this.boardBg = this.add.rectangle(
      SCENE_W / 2, BOARD_Y + BOARD_W / 2,
      BOARD_W + 4, BOARD_W + 4,
      C.boardBg,
    ).setStrokeStyle(2, C.boardBorder);

    // Pre-create TileObj for every cell
    this.tiles = [];
    this.prevBoard = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: TileObj[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = tileX(c);
        const y = tileY(r);
        const t = this.makeTileObj(x, y, 0);
        this.setTileInteractive(t, r, c);
        row.push(t);
      }
      this.tiles.push(row);
    }

    // Gold selection ring (drawn on top of the selected tile)
    this.selectionRing = this.add.rectangle(0, 0, TILE_SIZE + 8, TILE_SIZE + 8, 0, 0)
      .setStrokeStyle(3, C.gold)
      .setVisible(false);

    this.playObjects.push(this.boardBg, this.selectionRing);
    for (const row of this.tiles) for (const t of row) this.playObjects.push(t.container);
  }

  private makeTileObj(x: number, y: number, value: number): TileObj {
    const container = this.add.container(x, y);

    const fill = TILE_FILL[value] ?? C.empty;
    const bg   = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, fill)
      .setStrokeStyle(1, C.boardBorder)
      .setOrigin(0.5);

    const nameText = this.add.text(0, -8, TILE_NAME[value] ?? "", {
      fontSize: "12px", fontStyle: "bold",
      color: TILE_TEXT[value] ?? "#ffffff",
    }).setOrigin(0.5);

    // Value badge (bottom-right)
    const valBadgeBg = this.add.rectangle(TILE_SIZE / 2 - 14, TILE_SIZE / 2 - 10, 26, 16, 0xfffdf5, 230)
      .setStrokeStyle(1, 0xc0a060, 100)
      .setOrigin(0.5);
    const valBadge = this.add.text(TILE_SIZE / 2 - 14, TILE_SIZE / 2 - 10, "", {
      fontSize: "9px", color: "#6e4a12",
    }).setOrigin(0.5);

    container.add([bg, nameText, valBadgeBg, valBadge]);
    this.setTileValue({ container, bg, nameText, valBadge, valBadgeBg }, value);
    return { container, bg, nameText, valBadge, valBadgeBg };
  }

  private setTileInteractive(t: TileObj, row: number, col: number): void {
    t.bg.setInteractive({ useHandCursor: true });
    t.bg.on("pointerover", () => {
      if (this.currentPhase !== "play") return;
      const val = this.getTileVal(row, col);
      if (val > 0) t.container.setScale(1.06);
    });
    t.bg.on("pointerout", () => {
      if (this.selectedCell?.row === row && this.selectedCell?.col === col) return;
      t.container.setScale(1.0);
    });
    t.bg.on("pointerdown", () => {
      if (this.currentPhase !== "play") return;
      this.handleTileClick(row, col);
    });
  }

  private setTileValue(t: TileObj, value: number): void {
    const fill   = TILE_FILL[value] ?? C.empty;
    const txtCol = TILE_TEXT[value]  ?? "#ffffff";
    const name   = TILE_NAME[value]  ?? "";
    t.bg.setFillStyle(fill);
    t.nameText.setText(name).setColor(txtCol);
    if (value > 0) {
      t.valBadge.setText(String(value)).setVisible(true);
      t.valBadgeBg.setVisible(true);
    } else {
      t.valBadge.setVisible(false);
      t.valBadgeBg.setVisible(false);
    }
  }

  private getTileVal(row: number, col: number): number {
    const board = this.val<number[][]>("board", []);
    return board?.[row]?.[col] ?? 0;
  }

  // ── Build: HUD ────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const BOARD_BOTTOM = BOARD_Y + BOARD_W;

    // ── Timer bar (top of canvas) ──────────────────────────────────────────
    const timerBarW = SCENE_W - 32;
    this.timerTrack = this.add.rectangle(SCENE_W / 2, 20, timerBarW, 10, 0xd5c5a0)
      .setOrigin(0.5);
    this.timerFill = this.add.rectangle(16, 20, timerBarW, 10, C.gold)
      .setOrigin(0, 0.5);
    this.timerText = this.add.text(SCENE_W - 12, 20, "0:00", {
      fontSize: "12px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(1, 0.5);
    const timerLabel = this.add.text(12, 20, "⏱", {
      fontSize: "12px",
    }).setOrigin(0, 0.5);

    // ── Target progress bar ────────────────────────────────────────────────
    const targetBarW = SCENE_W - 32;
    this.targetFill = this.add.rectangle(16, 42, targetBarW, 10, C.goldLight)
      .setOrigin(0, 0.5);
    this.add.rectangle(SCENE_W / 2, 42, targetBarW, 10, 0xd5c5a0)
      .setDepth(-1)
      .setOrigin(0.5);
    this.targetText = this.add.text(SCENE_W / 2, 42, "", {
      fontSize: "10px", color: "#a07030",
    }).setOrigin(0.5);

    // ── Stats row (below board) ────────────────────────────────────────────
    this.movesText = this.add.text(SCENE_W / 2 - 60, BOARD_BOTTOM + 18, "Moves: 0", {
      fontSize: "13px", color: "#2b261f",
    }).setOrigin(0.5);
    this.bestTileText = this.add.text(SCENE_W / 2 + 60, BOARD_BOTTOM + 18, "Best: —", {
      fontSize: "13px", color: "#a07030",
    }).setOrigin(0.5);

    // ── Hint / action text ─────────────────────────────────────────────────
    this.hintText = this.add.text(SCENE_W / 2, BOARD_BOTTOM + 44, "Tap a tile to select", {
      fontSize: "12px", color: "#8b7355", align: "center",
    }).setOrigin(0.5);

    // ── Submit button (shown when target reached) ──────────────────────────
    this.submitBtn = this.buildActionButton(
      SCENE_W / 2, BOARD_BOTTOM + 46, 188, 44, "Claim Reward",
      () => { this.dispatch("submitSolution"); },
    );
    this.submitBtn.setVisible(false);

    // ── Expire button (shown when time is up) ─────────────────────────────
    this.expireBtn = this.buildActionButton(
      SCENE_W / 2, BOARD_BOTTOM + 46, 188, 44, "End Game",
      () => { this.dispatch("expireGame"); }, true,
    );
    this.expireBtn.setVisible(false);

    this.playObjects.push(
      this.timerTrack, this.timerFill, this.timerText, timerLabel,
      this.targetFill, this.targetText,
      this.movesText, this.bestTileText,
      this.hintText, this.submitBtn, this.expireBtn,
    );
  }

  // ── Build: result ─────────────────────────────────────────────────────────

  private buildResult(): void {
    this.resultCard = this.add.container(SCENE_W / 2, SCENE_H / 2 - 20);

    const cardBg = this.add.rectangle(0, 0, 340, 200, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5);

    this.resultTitle = this.add.text(0, -60, "", {
      fontSize: "30px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0.5);

    this.resultBody = this.add.text(0, -10, "", {
      fontSize: "13px", color: "#8b7355", align: "center", wordWrap: { width: 300 },
    }).setOrigin(0.5);

    const hint = this.add.text(0, 66, "Use the Play Again button below", {
      fontSize: "11px", color: "#a89070",
    }).setOrigin(0.5);

    this.resultCard.add([cardBg, this.resultTitle, this.resultBody, hint]);
    this.resultObjects.push(this.resultCard);
  }

  // ── Build helper: generic action button ──────────────────────────────────

  private buildActionButton(
    x: number, y: number, w: number, h: number,
    label: string,
    onPress: () => void,
    muted = false,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const fillColor = muted ? C.muted : C.gold;
    const bg = this.add.rectangle(0, 0, w, h, fillColor)
      .setStrokeStyle(2, C.goldLight)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => {
      this.tweens.add({ targets: btn, scale: 1.04, duration: 70, ease: "Sine.easeOut" });
    });
    bg.on("pointerout", () => {
      this.tweens.add({ targets: btn, scale: 1.0, duration: 70 });
    });
    bg.on("pointerdown", () => {
      this.tweens.add({ targets: btn, scale: 0.96, duration: 60, yoyo: true });
      onPress();
    });
    const txt = this.add.text(0, 0, label, {
      fontSize: "15px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0.5);
    btn.add([bg, txt]);
    return btn;
  }

  // ── Update: lobby ─────────────────────────────────────────────────────────

  private updateLobby(): void {
    const diff       = this.num("gameDifficulty", 0);
    // Sync selectedDiff with state if it changed externally
    if (diff !== this.selectedDiff) {
      this.selectedDiff = diff;
      this.refreshDiffCards();
      return; // refreshDiffCards calls updateLobby again
    }
    this.refreshDiffCards();

    const rule       = DIFFICULTY_RULES[this.selectedDiff];
    const poolFree   = this.num("poolFree", 0);
    const walletConn = this.bool("walletConnected");
    const isStarting = this.bool("isStarting");
    const enough     = rule ? poolFree >= Number(gasDisplay(rule.reward)) : false;

    const btnBg = this.startBtn.list[0] as Phaser.GameObjects.Rectangle;
    const canStart = walletConn && !isStarting;
    btnBg.setFillStyle(canStart ? C.gold : C.muted);
    (this.startBtn.list[1] as Phaser.GameObjects.Text).setText(
      isStarting ? "Starting…" : "Start Kingdom",
    );

    const poolMsg = !walletConn
      ? "Connect wallet to play"
      : !enough
        ? `Pool low (${poolFree.toFixed(2)} GAS available)`
        : rule
          ? `Entry: ${gasDisplay(rule.entry)} GAS · Reward: ${gasDisplay(rule.reward)} GAS`
          : "";
    this.poolText.setText(poolMsg);
  }

  // ── Update: loading ───────────────────────────────────────────────────────

  private updateLoading(): void {
    const status = this.str("lastStatus", "");
    this.loadingText.setText(status === "shuffling" ? "Shuffling tiles…" : "Starting game…");

    // Kick off pulsing animation if not already running
    if (!this.loadTween && this.loadingTiles.length > 0) {
      this.loadTween = this.tweens.add({
        targets: this.loadingTiles,
        scaleX: 1.15, scaleY: 1.15,
        alpha: { from: 0.4, to: 0.9 },
        duration: 480,
        ease: "Sine.easeInOut",
        yoyo: true, repeat: -1,
        delay: this.tweens.stagger(120, {}),
      });
    }
  }

  // ── Update: board ─────────────────────────────────────────────────────────

  private updateBoard(): void {
    const board = this.val<number[][]>("board") ?? [];
    if (!Array.isArray(board) || board.length !== BOARD_SIZE) return;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const newVal = board[r]?.[c] ?? 0;
        const oldVal = this.prevBoard[r]?.[c] ?? 0;
        const t = this.tiles[r]?.[c];
        if (!t) continue;

        this.setTileValue(t, newVal);

        // Scale-pop animation on newly merged tiles
        if (newVal > 0 && newVal !== oldVal && !this.reducedMotion) {
          this.tweens.add({
            targets: t.container,
            scaleX: { from: 1.22, to: 1.0 },
            scaleY: { from: 1.22, to: 1.0 },
            duration: 250,
            ease: "Back.easeOut",
          });
        }
      }
    }

    // Deep-copy board for next diff
    this.prevBoard = board.map((row) => [...row]);
  }

  // ── Update: HUD ───────────────────────────────────────────────────────────

  private updateHUD(): void {
    const rule         = DIFFICULTY_RULES[this.num("gameDifficulty", 0)];
    const deadline     = this.num("deadline", 0);
    const moveCount    = this.num("moveCount", 0);
    const tileAchieved = this.num("tileAchieved", 0);
    const isSubmitting = this.bool("isSubmitting");

    // Timer
    const now      = this.nowMs;
    const timeLeft = deadline > 0 ? Math.max(0, deadline - now) : 0;
    const limitMs  = rule?.limitMs ?? 1;
    const timePct  = Math.min(1, timeLeft / limitMs);
    const isLow    = timeLeft > 0 && timeLeft < 30_000;

    this.timerText.setText(formatClock(timeLeft));
    if (isLow) {
      this.timerText.setColor("#dc2626");
      this.timerFill.setFillStyle(C.dangerRed);
    } else {
      this.timerText.setColor("#2b261f");
      this.timerFill.setFillStyle(C.gold);
    }
    const timerBarMaxW = SCENE_W - 32;
    this.timerFill.setDisplaySize(Math.max(2, timerBarMaxW * timePct), 10);

    // Target bar
    const targetTile = rule?.targetTile ?? 2048;
    const targetPct  = Math.min(1, tileAchieved / targetTile);
    this.targetFill.setDisplaySize(Math.max(2, (SCENE_W - 32) * targetPct), 10);
    this.targetText.setText(`Target: ${tileAchieved} / ${targetTile}`);

    // Stats
    this.movesText.setText(`Moves: ${moveCount}`);
    this.bestTileText.setText(tileAchieved > 0 ? `Best: ${tileAchieved}` : "Best: —");

    // Action area
    const targetReached = tileAchieved >= targetTile;
    const timeUp        = timeLeft <= 0 && deadline > 0;

    this.submitBtn.setVisible(targetReached && !timeUp && !isSubmitting);
    this.expireBtn.setVisible(timeUp);

    if (this.selectedCell) {
      this.hintText.setText("Tap adjacent tile to move or merge");
    } else if (targetReached) {
      this.hintText.setText("Target reached! Claim your reward");
    } else {
      this.hintText.setText("Tap a tile to select");
    }
    this.hintText.setVisible(!targetReached || timeUp);
  }

  // ── Update: result ────────────────────────────────────────────────────────

  private updateResult(): void {
    const status       = this.str("gameStatus", "");
    const tileAchieved = this.num("tileAchieved", 0);
    const lastPayout   = this.num("lastPayoutFixed8", 0);
    const elapsedMs    = this.num("lastElapsedMs", 0);

    if (status === "solved") {
      this.resultTitle.setText("Victory!").setColor("#16a34a");
      const payoutGas = (lastPayout / 1e8).toFixed(2);
      this.resultBody.setText(
        `Best tile: ${tileAchieved}\nTime: ${formatClock(elapsedMs)}\nReward: ${payoutGas} GAS`,
      );
    } else {
      this.resultTitle.setText("Time's Up").setColor("#dc2626");
      this.resultBody.setText(`Best tile: ${tileAchieved}`);
    }

    // Entrance animation
    if (!this.reducedMotion) {
      this.resultCard.setScale(0.7).setAlpha(0);
      this.tweens.add({
        targets: this.resultCard,
        scale: 1, alpha: 1,
        duration: 280,
        ease: "Back.easeOut",
      });
    }
  }

  // ── Tile interaction ──────────────────────────────────────────────────────

  private handleTileClick(row: number, col: number): void {
    if (this.currentPhase !== "play") return;
    if (this.bool("isSubmitting")) return;

    const board = this.val<number[][]>("board") ?? [];
    const val   = board[row]?.[col] ?? 0;

    if (!this.selectedCell) {
      // Select a tile that has a value
      if (val > 0) {
        this.selectCell(row, col);
      }
      return;
    }

    const { row: sr, col: sc } = this.selectedCell;

    // Clicking the same tile deselects
    if (sr === row && sc === col) {
      this.clearSelection();
      return;
    }

    // Only allow orthogonally adjacent moves
    const dr = Math.abs(row - sr);
    const dc = Math.abs(col - sc);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      const srcVal = board[sr]?.[sc] ?? 0;
      const dstVal = val;
      // Valid move: destination is empty OR same value (merge)
      if (dstVal === 0 || dstVal === srcVal) {
        this.clearSelection();
        // Slide animation on source tile (toward destination)
        this.animateSlide(sr, sc, row, col, () => {
          this.dispatch("recordMove", sr, sc, row, col);
        });
        return;
      }
    }

    // Clicked a different tile → re-select
    if (val > 0) {
      this.selectCell(row, col);
    } else {
      this.clearSelection();
    }
  }

  private selectCell(row: number, col: number): void {
    this.selectedCell = { row, col };
    this.selectionRing.setPosition(tileX(col), tileY(row));
    this.selectionRing.setVisible(true);

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: this.tiles[row]?.[col]?.container,
        scaleX: 1.08, scaleY: 1.08,
        duration: 140, ease: "Back.easeOut",
      });
    }
    this.updateHUD();
  }

  private clearSelection(): void {
    if (this.selectedCell) {
      const { row, col } = this.selectedCell;
      this.tiles[row]?.[col]?.container.setScale(1.0);
    }
    this.selectedCell = null;
    this.selectionRing.setVisible(false);
    this.updateHUD();
  }

  private animateSlide(
    sr: number, sc: number,
    dr: number, dc: number,
    onDone: () => void,
  ): void {
    const srcTile = this.tiles[sr]?.[sc];
    if (!srcTile || this.reducedMotion) { onDone(); return; }

    const targetX = tileX(dc);
    const targetY = tileY(dr);

    this.tweens.add({
      targets: srcTile.container,
      x: targetX, y: targetY,
      duration: 100,
      ease: "Sine.easeOut",
      onComplete: () => {
        // Snap back to original position (board update will re-render)
        srcTile.container.setPosition(tileX(sc), tileY(sr));
        onDone();
      },
    });
  }

  // ── update() loop ─────────────────────────────────────────────────────────

  update(_time: number, _delta: number): void {
    if (this.currentPhase === "play") {
      this.updateHUD();
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.scene.restart();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.clockTimer?.remove();
    this.clockTimer = null;
    this.loadTween?.stop();
    this.loadTween = null;
    super.destroy(fromScene);
  }
}
