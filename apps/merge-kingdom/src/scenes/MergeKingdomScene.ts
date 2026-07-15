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
 *  "retryDeal"       {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import {
  BOARD_SIZE,
  DIFFICULTY_RULES,
  GUEST_DIFFICULTY_RULES,
  gasDisplay,
  formatClock,
} from "../logic/game-rules";
import {
  classifyMove,
  cloneBoard,
  type Cell,
  type MoveKind,
} from "../logic/merge-engine";

// ── Canvas & layout constants ───────────────────────────────────────────────

export const SCENE_W = 400;
export const SCENE_H = 600;
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

const TILE_SIZE = 72;
const TILE_GAP  = 8;
const BOARD_PAD = 10;
// Outer board dimensions: 2*pad + 4*tile + 3*gap = 332 × 332
const BOARD_W   = BOARD_PAD * 2 + BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP;
const BOARD_X   = (SCENE_W - BOARD_W) / 2; // 34
// Play-state board top. Nudged down from the old top-weighted 68 so the board +
// stats + action cluster reads as a vertically centered play field (the HUD
// bars stay pinned at the very top). The lobby preview uses its own coordinates
// and is unaffected.
const BOARD_Y   = 104;

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
  disabledBtn: 0xe8d5b0,
  successGreen:0x16a34a,
  dangerRed:   0xdc2626,
  timerLow:    0xdc2626,
  empty:       0xead9b8,
  // Lobby preview plots — open land reads light & buildable, occupied crests
  // get a warmer rim so they lift off the cream board panel.
  plotEmpty:       0xefe1c4,
  plotEmptyStroke: 0xdcc496,
  plotFilled:      0xfff8e6,
  plotFilledStroke:0xcaa35c,
};

const TILE_ASSETS: Record<number, string> = {
  2:    "mk-tile-grass",
  4:    "mk-tile-hut",
  8:    "mk-tile-cottage",
  16:   "mk-tile-house",
  32:   "mk-tile-tower",
  64:   "mk-tile-market",
  128:  "mk-tile-forge",
  256:  "mk-tile-gate",
  512:  "mk-tile-keep",
  1024: "mk-tile-castle",
  2048: "mk-tile-citadel",
  4096: "mk-tile-palace",
};

const TILE_FILES: Record<number, string> = {
  2:    "./art/tile-0002-grass-plot.webp",
  4:    "./art/tile-0004-wooden-hut.webp",
  8:    "./art/tile-0008-stone-cottage.webp",
  16:   "./art/tile-0016-village-house.webp",
  32:   "./art/tile-0032-watchtower.webp",
  64:   "./art/tile-0064-market-stall.webp",
  128:  "./art/tile-0128-forge.webp",
  256:  "./art/tile-0256-castle-gate.webp",
  512:  "./art/tile-0512-castle-keep.webp",
  1024: "./art/tile-1024-royal-castle.webp",
  2048: "./art/tile-2048-crystal-citadel.webp",
  4096: "./art/tile-4096-crown-palace.webp",
};

const GAMEFI_LOBBY_PREVIEWS: number[][][] = [
  [
    [2, 0, 4, 0],
    [0, 8, 0, 0],
    [0, 0, 16, 0],
    [0, 0, 0, 64],
  ],
  [
    [2, 4, 8, 0],
    [0, 16, 0, 32],
    [64, 0, 128, 0],
    [0, 0, 0, 256],
  ],
  [
    [4, 8, 16, 32],
    [0, 64, 0, 128],
    [256, 0, 512, 0],
    [0, 0, 0, 1024],
  ],
];

const GUEST_LOBBY_PREVIEWS: number[][][] = [
  [
    [2, 0, 4, 0],
    [0, 8, 0, 0],
    [0, 0, 16, 0],
    [0, 0, 0, 32],
  ],
  [
    [2, 4, 8, 0],
    [0, 16, 0, 32],
    [0, 0, 64, 0],
    [0, 0, 0, 0],
  ],
  [
    [4, 8, 16, 32],
    [0, 64, 0, 128],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
];

// Tile fill colours keyed by tile value
const TILE_FILL: Record<number, number> = {
  0:    0xead9b8,
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
  4096: "Crown Palace",
};

interface SceneLabels {
  eyebrow: string;
  title: string;
  tagline: string;
  difficultyNames: string[];
  routeTitle: string[];
  buildingNames: Record<string, string>;
  reachTarget: string;
  routeGoal: string;
  entryLabel: string;
  localRun: string;
  freePractice: string;
  buildRealm: string;
  connectWallet: string;
  connectingWallet: string;
  building: string;
  gameFiUnavailable: string;
  localPracticeStatus: string;
  connectStatus: string;
  poolLow: string;
  entryReward: string;
  timeLimit: string;
  timeLimitSeconds: string;
  preparing: string;
  sealing: string;
  opening: string;
  settlementTitle: string;
  settlementHint: string;
  retryDeal: string;
  checkSettlement: string;
  releaseGame: string;
  time: string;
  target: string;
  moves: string;
  best: string;
  bestUnset: string;
  selectTile: string;
  selectDestination: string;
  moving: string;
  syncFailed: string;
  targetReached: string;
  finishLocal: string;
  claimReward: string;
  proofWarming: string;
  playAgain: string;
  buildNext: string;
  guestVictory: string;
  victory: string;
  runOver: string;
  timeUp: string;
  localSaved: string;
  reward: string;
  bestTile: string;
}

const FALLBACK_LABELS: SceneLabels = {
  eyebrow: "VERIFIED MERGE QUEST",
  title: "Merge Kingdom",
  tagline: "Move, merge, and raise the target building.",
  difficultyNames: ["Easy", "Medium", "Hard"],
  routeTitle: ["Easy route", "Medium route", "Hard route"],
  buildingNames: Object.fromEntries(
    Object.entries(TILE_NAME).map(([value, name]) => [value, name]),
  ),
  reachTarget: "Reach {building} before the timer",
  routeGoal: "Target: {building}",
  entryLabel: "Entry",
  localRun: "Local run",
  freePractice: "Free practice",
  buildRealm: "Build Realm",
  connectWallet: "Connect Wallet",
  connectingWallet: "Connecting…",
  building: "Building…",
  gameFiUnavailable: "GameFi entry paused",
  localPracticeStatus: "Local practice — merge buildings, no GAS at stake",
  connectStatus: "Connect first; the next press confirms the quoted entry",
  poolLow: "Pool low ({pool} GAS available)",
  entryReward: "Entry {entry} GAS · Reward {reward} GAS",
  timeLimit: "{minutes} min limit",
  timeLimitSeconds: "{seconds} sec limit",
  preparing: "Preparing your kingdom…",
  sealing: "Sealing the realm board…",
  opening: "Opening the kingdom gate…",
  settlementTitle: "Settlement Pending…",
  settlementHint: "Waiting for the verified oracle callback",
  retryDeal: "Retry sealing",
  checkSettlement: "Check settlement",
  releaseGame: "Release game",
  time: "TIME",
  target: "Target: {current} / {target}",
  moves: "Moves: {count}",
  best: "Best: {tile}",
  bestUnset: "Best: —",
  selectTile: "Tap a building to select · arrows also work",
  selectDestination: "Tap, swipe, or press an arrow toward a neighbour",
  moving: "The enclave is revealing this move…",
  syncFailed: "Move sync paused — recover this run from the rules drawer",
  targetReached: "Target reached!",
  finishLocal: "Finish your local run",
  claimReward: "Claim Reward",
  proofWarming: "Verified claim unlocks in {time}",
  playAgain: "Play Again",
  buildNext: "Build Next Realm",
  guestVictory: "Kingdom raised!",
  victory: "Victory!",
  runOver: "Run over",
  timeUp: "Time's Up",
  localSaved: "Local run saved",
  reward: "Reward: {amount} GAS",
  bestTile: "Best building: {tile}",
};

interface PendingMove {
  from: Cell;
  to: Cell;
  kind: MoveKind;
  sourceValue: number;
}

// ── Tile object (holds the Phaser renderables for one board cell) ───────────

interface TileObj {
  container: Phaser.GameObjects.Container;
  bg:        Phaser.GameObjects.Rectangle;
  art:       Phaser.GameObjects.Image;
  nameText:  Phaser.GameObjects.Text;
  valBadge:  Phaser.GameObjects.Text;
  valBadgeBg:Phaser.GameObjects.Rectangle;
}

interface LobbyPreviewTile {
  bg: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Image;
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
  private timerLabelText!: Phaser.GameObjects.Text;
  private timerFill!:    Phaser.GameObjects.Rectangle;
  private timerTrack!:   Phaser.GameObjects.Rectangle;
  private targetText!:   Phaser.GameObjects.Text;
  private targetFill!:   Phaser.GameObjects.Rectangle;
  private movesText!:    Phaser.GameObjects.Text;
  private bestTileText!: Phaser.GameObjects.Text;
  private hintText!:     Phaser.GameObjects.Text;
  private submitBtn!:    Phaser.GameObjects.Container;
  private submitBtnText!: Phaser.GameObjects.Text;
  private expireBtn!:    Phaser.GameObjects.Container;
  private wonBanner!:    Phaser.GameObjects.Container;
  private wonBannerCrest!: Phaser.GameObjects.Image;
  private wonBannerTitle!: Phaser.GameObjects.Text;
  private wonBannerSub!: Phaser.GameObjects.Text;

  // ── Lobby ─────────────────────────────────────────────────────────────────
  private diffCards: Phaser.GameObjects.Container[]  = [];
  private selectedDiff = 0;
  private startBtn!:    Phaser.GameObjects.Container;
  private startBtnText!:Phaser.GameObjects.Text;
  private poolText!:    Phaser.GameObjects.Text;
  private lobbyPreviewTiles: LobbyPreviewTile[] = [];
  private routeTargetArt!: Phaser.GameObjects.Image;
  private routeTitleText!: Phaser.GameObjects.Text;
  private routeGoalText!: Phaser.GameObjects.Text;
  private routeRewardText!: Phaser.GameObjects.Text;
  private routeEntryText!: Phaser.GameObjects.Text;
  private routeTimeText!: Phaser.GameObjects.Text;
  private eyebrowText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;

  // ── Loading ───────────────────────────────────────────────────────────────
  private loadingTiles: Phaser.GameObjects.Container[] = [];
  private loadingTitle!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private retryBtn!: Phaser.GameObjects.Container;
  private refreshBtn!: Phaser.GameObjects.Container;
  private releaseBtn!: Phaser.GameObjects.Container;
  private loadTween:    Phaser.Tweens.Tween | null = null;

  // ── Result ────────────────────────────────────────────────────────────────
  private resultCard!: Phaser.GameObjects.Container;
  private resultTitle!:  Phaser.GameObjects.Text;
  private resultBody!:   Phaser.GameObjects.Text;
  private resultHint!: Phaser.GameObjects.Text;
  private resultStartBtn!: Phaser.GameObjects.Container;
  private resultStartBtnText!: Phaser.GameObjects.Text;

  // ── Runtime ───────────────────────────────────────────────────────────────
  private currentPhase: "lobby" | "loading" | "play" | "result" = "lobby";
  private clockTimer: Phaser.Time.TimerEvent | null = null;
  private nowMs = Date.now();
  private lastBestTile = 0;                  // for tier-up cue detection
  private pendingMove: PendingMove | null = null;
  private pendingMoveTarget: Cell | null = null;
  private moveInputLocked = false;
  private moveUnlockTimer: Phaser.Time.TimerEvent | null = null;
  private gestureStart: (Cell & { x: number; y: number }) | null = null;
  private gestureDragging = false;
  private dispatchCompleteUnsubscribe: (() => void) | null = null;
  private deadlineEndRequested = false;
  private lastResultStatus = "";
  private wonBannerActive = false;      // for one-shot celebration pop

  constructor() {
    super("MergeKingdomScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    for (const [value, path] of Object.entries(TILE_FILES)) {
      this.load.image(TILE_ASSETS[Number(value)]!, path);
    }
  }

  create(): void {
    super.create(); // wires GameBridge

    this.buildBackground();
    this.buildLobby();
    this.buildLoading();
    this.buildBoard();
    this.buildHUD();
    this.buildResult();
    this.fitCameraToHost();

    // Start 1-second clock for deadline countdown
    this.clockTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.nowMs = Date.now();
        if (this.currentPhase === "play") this.updateHUD();
      },
    });

    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.keyboard?.on("keydown-UP", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-DOWN", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-LEFT", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-RIGHT", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-W", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-A", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-S", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-D", this.handleKeyboardMove, this);
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this);
    this.dispatchCompleteUnsubscribe = this.bridge.on("dispatchComplete", ({ action }) => {
      if (action === "recordMove" && this.pendingMove) this.releaseMoveLock(false);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);

    this.setPhase("lobby");
    this.onStateUpdate(this.state);
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (enabled) {
      this.loadTween?.stop();
      this.loadTween = null;
      this.tweens.killAll();
      this.resetMotionState();
      return;
    }
    if (this.currentPhase === "loading") this.updateLoading();
  }

  protected onBridgeError(error: GameBridgeError): void {
    if (error.action !== "recordMove") return;
    this.releaseMoveLock(true);
    this.hintText?.setText(error.message || this.labels().syncFailed);
    this.sfx.play("error");
  }

  private resetMotionState(): void {
    this.loadingTiles.forEach((tile) => tile.setScale(1).setAlpha(0.74));
    this.diffCards.forEach((card) => card.setScale(1));
    [this.startBtn, this.retryBtn, this.refreshBtn, this.releaseBtn, this.submitBtn,
      this.expireBtn, this.resultStartBtn, this.wonBanner, this.resultCard]
      .filter(Boolean)
      .forEach((object) => object.setScale(1).setAlpha(1));
    for (let row = 0; row < this.tiles.length; row += 1) {
      for (let col = 0; col < (this.tiles[row]?.length ?? 0); col += 1) {
        this.tiles[row]?.[col]?.container
          .setPosition(tileX(col), tileY(row))
          .setScale(1)
          .setAlpha(1);
      }
    }
  }

  // ── BaseScene abstract ────────────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");

    // Determine phase
    if (status === "solved" || status === "expired") {
      if (this.currentPhase !== "result") {
        this.setPhase("result");
        if (status === "solved") this.sfx.play("win");
      }
      this.updateResult();
    } else if (isStarting || isDealing || status === "committed" || status === "unknown") {
      if (this.currentPhase !== "loading") this.setPhase("loading");
      this.updateLoading();
    } else if (status === "dealt") {
      if (this.currentPhase !== "play") {
        this.setPhase("play");
        this.lastResultStatus = "";
        this.selectedCell = null;
        this.selectionRing.setVisible(false);
        this.lastBestTile = this.num("tileAchieved", 0);
        this.pendingMove = null;
        this.moveInputLocked = false;
        this.deadlineEndRequested = false;
        this.wonBannerActive = false;
      }
      this.updateBoard();
      this.updateHUD();
    } else {
      // idle
      if (this.currentPhase !== "lobby") this.setPhase("lobby");
      this.selectedDiff = Math.max(0, Math.min(2, this.num("gameDifficulty", this.selectedDiff)));
      this.lastResultStatus = "";
      this.updateLobby();
    }
    this.applyStaticLabels();
  }

  // ── Phase switch ──────────────────────────────────────────────────────────

  private setPhase(phase: "lobby" | "loading" | "play" | "result"): void {
    if (phase !== "loading") {
      this.loadTween?.stop();
      this.loadTween = null;
      this.loadingTiles.forEach((tile) => tile.setScale(1).setAlpha(0.74));
    }
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

  private labels(): SceneLabels {
    const provided = this.val<Partial<SceneLabels>>("sceneLabels");
    if (!provided) return FALLBACK_LABELS;
    return {
      ...FALLBACK_LABELS,
      ...provided,
      difficultyNames:
        Array.isArray(provided.difficultyNames) && provided.difficultyNames.length === 3
          ? provided.difficultyNames
          : FALLBACK_LABELS.difficultyNames,
      routeTitle:
        Array.isArray(provided.routeTitle) && provided.routeTitle.length === 3
          ? provided.routeTitle
          : FALLBACK_LABELS.routeTitle,
      buildingNames: {
        ...FALLBACK_LABELS.buildingNames,
        ...(provided.buildingNames ?? {}),
      },
    };
  }

  private fmt(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = vars[key];
      return value === undefined ? "" : String(value);
    });
  }

  private applyStaticLabels(): void {
    const labels = this.labels();
    this.eyebrowText?.setText(labels.eyebrow);
    this.titleText?.setText(labels.title);
    this.taglineText?.setText(labels.tagline);
    this.timerLabelText?.setText(labels.time);
    this.wonBannerTitle?.setText(labels.targetReached);
    this.retryBtn?.getAt<Phaser.GameObjects.Text>(1)?.setText(labels.retryDeal);
    this.refreshBtn?.getAt<Phaser.GameObjects.Text>(1)?.setText(labels.checkSettlement);
    this.releaseBtn?.getAt<Phaser.GameObjects.Text>(1)?.setText(labels.releaseGame);
    this.diffCards.forEach((card, index) => {
      card.getAt<Phaser.GameObjects.Text>(2)?.setText(labels.difficultyNames[index] ?? "");
      const target = this.routeRule(index).targetTile;
      card.getAt<Phaser.GameObjects.Text>(3)?.setText(
        this.fmt(labels.routeGoal, { building: this.buildingName(target) }),
      );
    });
    this.updateRoutePanel();
  }

  // ── Build: background ────────────────────────────────────────────────────

  private buildBackground(): void {
    // Base parchment fill
    const bg = this.add.rectangle(SCENE_W / 2, SCENE_H / 2, SCENE_W, SCENE_H, C.bg);

    // Full-height soft vignette (no hard seam): a smooth top→bottom gradient of
    // the darker parchment tone, transparent at the top and gently deepening
    // toward the base so the board floats on seamless aged paper.
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(C.bgDark, C.bgDark, C.bgDark, C.bgDark, 0, 0, 0.5, 0.5);
    vignette.fillRect(0, 0, SCENE_W, SCENE_H);
    // Faint warm top glow to keep the header area luminous.
    const topGlow = this.add.graphics();
    topGlow.fillGradientStyle(C.cream, C.cream, C.cream, C.cream, 0.34, 0.34, 0, 0);
    topGlow.fillRect(0, 0, SCENE_W, SCENE_H * 0.42);

    // Decorative border frame
    const frame = this.add.rectangle(SCENE_W / 2, SCENE_H / 2, SCENE_W - 12, SCENE_H - 12);
    frame.setStrokeStyle(2, C.goldDim, 0.6);
    frame.setFillStyle(0, 0);
    // These are always visible, not in any phase group
    void bg; void vignette; void topGlow; void frame;
  }

  // ── Build: lobby ─────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.eyebrowText = this.add.text(SCENE_W / 2, 22, FALLBACK_LABELS.eyebrow, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#76551f",
    }).setOrigin(0.5);

    this.titleText = this.add.text(SCENE_W / 2, 44, FALLBACK_LABELS.title, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "26px",
      fontStyle: "bold",
      color: "#2b261f",
    }).setOrigin(0.5);

    this.taglineText = this.add.text(SCENE_W / 2, 70, FALLBACK_LABELS.tagline, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#765a32",
    }).setOrigin(0.5);

    // Even, centered soft shadow (halo) rather than a one-sided offset drop.
    const boardShadow = this.add.rectangle(SCENE_W / 2, 208, 226, 226, 0x8b5e24, 0.1)
      .setOrigin(0.5);
    const boardPanel = this.add.rectangle(SCENE_W / 2, 205, 214, 214, C.cream, 0.94)
      .setStrokeStyle(2, C.goldDim, 0.75)
      .setOrigin(0.5);
    this.lobbyObjects.push(boardShadow, boardPanel);
    this.buildLobbyPreviewBoard(SCENE_W / 2, 205);

    const routePanel = this.add.rectangle(SCENE_W / 2, 352, 338, 78, C.white, 0.92)
      .setStrokeStyle(1.5, C.cardBorder, 1)
      .setOrigin(0.5);
    this.routeTargetArt = this.add.image(67, 352, TILE_ASSETS[64]!)
      .setDisplaySize(58, 58);
    this.routeTitleText = this.add.text(106, 327, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      fontStyle: "bold",
      color: "#2b261f",
    }).setOrigin(0, 0);
    this.routeGoalText = this.add.text(106, 350, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      color: "#765a32",
      wordWrap: { width: 174, useAdvancedWrap: true },
    }).setOrigin(0, 0);
    this.routeRewardText = this.add.text(SCENE_W - 42, 327, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#047857",
    }).setOrigin(1, 0);
    this.routeEntryText = this.add.text(SCENE_W - 42, 351, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      color: "#765a32",
    }).setOrigin(1, 0);
    this.routeTimeText = this.add.text(SCENE_W - 42, 367, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      color: "#765a32",
    }).setOrigin(1, 0);
    this.lobbyObjects.push(
      routePanel,
      this.routeTargetArt,
      this.routeTitleText,
      this.routeGoalText,
      this.routeRewardText,
      this.routeEntryText,
      this.routeTimeText,
    );

    this.diffCards = [];
    const cardW = 104;
    // Tall enough for a two-line goal label. "Target: Watchtower" measures
    // ~94px at 10px Inter but the card only offers 80px between its insets, so
    // the longest target wraps rather than crossing the card border. The other
    // routes ("Market", "Forge") and the zh names still fit on one line.
    const cardH = 64;
    const startX = 76;

    this.routeRules().forEach((rule, i) => {
      const card = this.buildDiffCard(startX + i * 124, 430, cardW, cardH, i, rule);
      this.diffCards.push(card);
      this.lobbyObjects.push(card);
    });

    this.startBtn = this.buildActionButton(SCENE_W / 2, 502, 216, 48, "Build Realm", () => {
      if (!this.isGuestMode() && !this.bool("gameFiNewEntriesEnabled")) return;
      if (!this.isGuestMode() && this.bool("walletConnected") === false) return;
      this.dispatch("startGame", this.selectedDiff);
    });
    this.startBtnText = this.startBtn.list[1] as Phaser.GameObjects.Text;

    this.poolText = this.add.text(SCENE_W / 2, 554, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      color: "#765a32",
      align: "center",
      wordWrap: { width: 320 },
    }).setOrigin(0.5);

    this.lobbyObjects.push(
      this.eyebrowText,
      this.titleText,
      this.taglineText,
      this.startBtn,
      this.poolText,
    );
    this.updateRoutePanel();
    this.updateLobbyPreviewBoard();
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
      this.sfx.unlock();
      this.sfx.play("tap");
      this.selectedDiff = diffIdx;
      this.dispatch("selectDifficulty", diffIdx);
      this.refreshDiffCards();
      this.updateLobby();
      this.animate({ targets: card, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true });
    });

    const targetVal = rule.targetTile;
    // Sits a little higher than the card's mid-line so a wrapped two-line goal
    // label below it never runs under the crest art.
    const crest = this.add.image(-w / 2 + 22, -12, this.tileAssetKey(targetVal))
      .setDisplaySize(30, 30);

    const nameLabel = this.add.text(
      -w / 2 + 42,
      -14,
      FALLBACK_LABELS.difficultyNames[diffIdx] ?? "",
      {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#2b261f",
      },
    ).setOrigin(0, 0.5);
    const goalLabel = this.add.text(
      -w / 2 + 12,
      17,
      this.fmt(FALLBACK_LABELS.routeGoal, { building: targetVal }),
      {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      color: "#765a32",
      // Wrap inside the card's insets instead of bleeding over its right
      // border. Without this the longest honest target name overflows by ~2px.
      wordWrap: { width: w - 24, useAdvancedWrap: true },
      },
    ).setOrigin(0, 0.5);

    const dot = this.add.circle(w / 2 - 13, -h / 2 + 13, 5, C.gold, diffIdx === this.selectedDiff ? 1 : 0);

    card.add([bg, crest, nameLabel, goalLabel, dot]);
    return card;
  }

  private refreshDiffCards(): void {
    this.diffCards.forEach((card, i) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      const crest = card.list[1] as Phaser.GameObjects.Image;
      const goalLabel = card.list[3] as Phaser.GameObjects.Text;
      const dot = card.list[card.list.length - 1] as Phaser.GameObjects.Arc;
      const rule = this.routeRule(i);
      bg.setFillStyle(i === this.selectedDiff ? C.cardActive : C.cardBg);
      bg.setStrokeStyle(i === this.selectedDiff ? 2 : 1.5,
        i === this.selectedDiff ? C.gold : C.cardBorder);
      dot.setAlpha(i === this.selectedDiff ? 1 : 0);
      crest.setTexture(this.tileAssetKey(rule.targetTile));
      goalLabel.setText(this.fmt(this.labels().routeGoal, {
        building: this.buildingName(rule.targetTile),
      }));
    });
    this.updateRoutePanel();
    this.updateLobbyPreviewBoard();
  }

  private buildLobbyPreviewBoard(cx: number, cy: number): void {
    const tile = 42;
    const gap = 5;
    const boardW = BOARD_SIZE * tile + (BOARD_SIZE - 1) * gap;
    const startX = cx - boardW / 2 + tile / 2;
    const startY = cy - boardW / 2 + tile / 2;
    this.lobbyPreviewTiles = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = startX + c * (tile + gap);
        const y = startY + r * (tile + gap);
        const bg = this.add.rectangle(x, y, tile, tile, C.plotEmpty, 0.5)
          .setStrokeStyle(1.5, C.plotEmptyStroke, 0.6)
          .setOrigin(0.5);
        const art = this.add.image(x, y, this.tileAssetKey(2))
          .setDisplaySize(tile - 5, tile - 5)
          .setVisible(false);
        this.lobbyPreviewTiles.push({ bg, art });
        this.lobbyObjects.push(bg, art);
      }
    }
  }

  private updateLobbyPreviewBoard(): void {
    const previews = this.isGuestMode() ? GUEST_LOBBY_PREVIEWS : GAMEFI_LOBBY_PREVIEWS;
    const preview = previews[this.selectedDiff] ?? previews[0]!;
    this.lobbyPreviewTiles.forEach((tile, idx) => {
      const row = Math.floor(idx / BOARD_SIZE);
      const col = idx % BOARD_SIZE;
      const value = preview[row]?.[col] ?? 0;
      if (value > 0) {
        tile.bg.setFillStyle(C.plotFilled, 0.98).setStrokeStyle(1.5, C.plotFilledStroke, 0.9);
        tile.art.setTexture(this.tileAssetKey(value)).setVisible(true);
      } else {
        tile.bg.setFillStyle(C.plotEmpty, 0.5).setStrokeStyle(1.5, C.plotEmptyStroke, 0.6);
        tile.art.setVisible(false);
      }
    });
  }

  private updateRoutePanel(): void {
    if (!this.routeTitleText) return;
    const labels = this.labels();
    const rule = this.routeRule(this.selectedDiff);
    this.routeTargetArt.setTexture(this.tileAssetKey(rule.targetTile));
    this.routeTitleText.setText(labels.routeTitle[this.selectedDiff] ?? "");
    this.routeGoalText.setText(
      this.fmt(labels.reachTarget, { building: this.buildingName(rule.targetTile) }),
    );
    if (this.isGuestMode()) {
      // Guest carries no stake — drop the reward/entry GAS framing.
      this.routeRewardText.setText(labels.localRun);
      this.routeEntryText.setText(labels.freePractice);
    } else {
      this.routeRewardText.setText(`${gasDisplay(rule.reward)} GAS`);
      this.routeEntryText.setText(`${labels.entryLabel} ${gasDisplay(rule.entry)} GAS`);
    }
    this.routeTimeText.setText(rule.limitMs % 60_000 === 0
      ? this.fmt(labels.timeLimit, { minutes: rule.limitMs / 60_000 })
      : this.fmt(labels.timeLimitSeconds, { seconds: Math.round(rule.limitMs / 1000) }));
  }

  // ── Build: loading ────────────────────────────────────────────────────────

  private buildLoading(): void {
    this.loadingTitle = this.add.text(SCENE_W / 2, 220, FALLBACK_LABELS.preparing, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "16px", color: "#2b261f",
    }).setOrigin(0.5);

    this.loadingText = this.add.text(SCENE_W / 2, 248, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px", color: "#765a32",
    }).setOrigin(0.5);

    // 2×2 grid of building crests that pulse & climb the merge ladder
    // (grass → hut → cottage → house), reinforcing the build motif over
    // generic blocks.
    const cells: Array<{ ox: number; oy: number; value: number }> = [
      { ox: -30, oy: -30, value: 2 },
      { ox: 30, oy: -30, value: 4 },
      { ox: -30, oy: 30, value: 8 },
      { ox: 30, oy: 30, value: 16 },
    ];
    this.loadingTiles = cells.map(({ ox, oy, value }, i) => {
      const container = this.add.container(SCENE_W / 2 + ox, SCENE_H / 2 + 18 + oy);
      const plate = this.add.rectangle(0, 0, 52, 52, C.cream, 0.92)
        .setStrokeStyle(2, C.goldLight, 0.9)
        .setOrigin(0.5);
      const crest = this.add.image(0, -1, this.tileAssetKey(value))
        .setDisplaySize(42, 42);
      container.add([plate, crest]);
      container.setAlpha(0.5 + (i % 2) * 0.12);
      return container;
    });

    this.loadingObjects.push(this.loadingTitle, this.loadingText, ...this.loadingTiles);

    this.retryBtn = this.buildActionButton(
      SCENE_W / 2,
      404,
      204,
      42,
      "Retry sealing",
      () => {
        if (!this.canRetryDeal()) return;
        this.dispatch("retryDeal");
      },
    );
    this.refreshBtn = this.buildActionButton(
      SCENE_W / 2,
      404,
      204,
      42,
      FALLBACK_LABELS.checkSettlement,
      () => {
        if (this.str("gameStatus", "idle") !== "unknown" || this.bool("isRecovering")) return;
        this.dispatch("refreshGame");
      },
    );
    this.releaseBtn = this.buildActionButton(
      SCENE_W / 2,
      454,
      204,
      42,
      "Release game",
      () => {
        if (!this.canReleaseCommitted()) return;
        this.dispatch("expireGame");
      },
      true,
    );
    this.loadingObjects.push(this.retryBtn, this.refreshBtn, this.releaseBtn);
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

    const shadow = this.add.rectangle(3, 3, TILE_SIZE, TILE_SIZE, C.boardBorder, 0.3)
      .setOrigin(0.5);
    const fill = TILE_FILL[value] ?? C.empty;
    const bg   = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, fill)
      .setStrokeStyle(2, C.boardBorder)
      .setOrigin(0.5);
    const art = this.add.image(0, -2, this.tileAssetKey(2))
      .setDisplaySize(TILE_SIZE - 10, TILE_SIZE - 10)
      .setVisible(false);

    const nameText = this.add.text(0, -8, TILE_NAME[value] ?? "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: TILE_TEXT[value] ?? "#ffffff",
      stroke: "#fff8e6",
      strokeThickness: 2,
    }).setOrigin(0.5).setVisible(false);

    // Value badge (bottom-right)
    const valBadgeBg = this.add.rectangle(TILE_SIZE / 2 - 14, TILE_SIZE / 2 - 10, 26, 16, 0xfffdf5, 0.9)
      .setStrokeStyle(1, 0xc0a060, 0.55)
      .setOrigin(0.5);
    const valBadge = this.add.text(TILE_SIZE / 2 - 14, TILE_SIZE / 2 - 10, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      color: "#6e4a12",
    }).setOrigin(0.5);

    container.add([shadow, bg, art, nameText, valBadgeBg, valBadge]);
    this.setTileValue({ container, bg, art, nameText, valBadge, valBadgeBg }, value);
    return { container, bg, art, nameText, valBadge, valBadgeBg };
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
    t.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if (this.currentPhase !== "play") return;
      this.gestureStart = { row, col, x: pointer.worldX, y: pointer.worldY };
      this.gestureDragging = false;
      this.handleTileClick(row, col);
    });
  }

  private setTileValue(t: TileObj, value: number): void {
    const fill   = TILE_FILL[value] ?? C.empty;
    const txtCol = TILE_TEXT[value]  ?? "#ffffff";
    const name   = this.buildingName(value);
    t.bg.setFillStyle(value > 0 ? C.cream : fill, value > 0 ? 0.98 : 1);
    t.nameText.setText(name).setColor(txtCol);
    if (value > 0) {
      t.art.setTexture(this.tileAssetKey(value)).setVisible(true);
      t.valBadge.setText(String(value)).setVisible(true);
      t.valBadgeBg.setVisible(true);
    } else {
      t.art.setVisible(false);
      t.valBadge.setVisible(false);
      t.valBadgeBg.setVisible(false);
    }
  }

  private tileAssetKey(value: number): string {
    return TILE_ASSETS[value] ?? TILE_ASSETS[2]!;
  }

  private buildingName(value: number): string {
    return this.labels().buildingNames[String(value)] ?? TILE_NAME[value] ?? "";
  }

  private getTileVal(row: number, col: number): number {
    const board = this.val<number[][]>("board", []);
    return board?.[row]?.[col] ?? 0;
  }

  /** Guest is a free local game — no wallet, no pool, no reward/GAS framing. */
  private isGuestMode(): boolean {
    return this.str("appMode", "gamefi") === "guest";
  }

  private routeRules(): typeof DIFFICULTY_RULES {
    return this.isGuestMode() ? GUEST_DIFFICULTY_RULES : DIFFICULTY_RULES;
  }

  private routeRule(difficulty: number): typeof DIFFICULTY_RULES[number] {
    return this.routeRules()[difficulty] ?? this.routeRules()[0]!;
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
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(1, 0.5);
    this.timerLabelText = this.add.text(12, 20, FALLBACK_LABELS.time, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#76551f",
    }).setOrigin(0, 0.5);

    // ── Target progress bar ────────────────────────────────────────────────
    const targetBarW = SCENE_W - 32;
    this.targetFill = this.add.rectangle(16, 42, targetBarW, 10, C.goldLight)
      .setOrigin(0, 0.5);
    this.add.rectangle(SCENE_W / 2, 42, targetBarW, 10, 0xd5c5a0)
      .setDepth(-1)
      .setOrigin(0.5);
    this.targetText = this.add.text(SCENE_W / 2, 42, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px", color: "#76551f",
    }).setOrigin(0.5);

    // ── Stats row (below board) ────────────────────────────────────────────
    this.movesText = this.add.text(SCENE_W / 2 - 60, BOARD_BOTTOM + 18, "Moves: 0", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px", color: "#2b261f",
    }).setOrigin(0.5);
    this.bestTileText = this.add.text(SCENE_W / 2 + 60, BOARD_BOTTOM + 18, "Best: —", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px", color: "#76551f",
    }).setOrigin(0.5);

    // ── Hint / action text ─────────────────────────────────────────────────
    this.hintText = this.add.text(SCENE_W / 2, BOARD_BOTTOM + 44, "Tap a tile to select", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px", color: "#765a32", align: "center",
    }).setOrigin(0.5);

    // ── Submit button (shown when target reached) ──────────────────────────
    this.submitBtn = this.buildActionButton(
      SCENE_W / 2, BOARD_BOTTOM + 92, 188, 44, "Claim Reward",
      () => { this.dispatch("submitSolution"); },
    );
    this.submitBtnText = this.submitBtn.list[1] as Phaser.GameObjects.Text;
    this.submitBtn.setVisible(false);

    // ── Expire button (shown when time is up) ─────────────────────────────
    this.expireBtn = this.buildActionButton(
      SCENE_W / 2, BOARD_BOTTOM + 92, 188, 44, "End Game",
      () => { this.dispatch("expireGame"); }, true,
    );
    this.expireBtn.setVisible(false);

    // ── Target-reached celebration banner (non-interactive) ────────────────
    this.wonBanner = this.add.container(SCENE_W / 2, BOARD_BOTTOM + 46);
    const bannerBg = this.add.rectangle(0, 0, 236, 46, C.cardActive, 0.96)
      .setStrokeStyle(2, C.gold, 0.9)
      .setOrigin(0.5);
    this.wonBannerCrest = this.add.image(-92, 0, this.tileAssetKey(64))
      .setDisplaySize(34, 34);
    this.wonBannerTitle = this.add.text(-66, -8, FALLBACK_LABELS.targetReached, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "14px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0, 0.5);
    this.wonBannerSub = this.add.text(-66, 9, "Claim your reward below", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px", color: "#047857",
    }).setOrigin(0, 0.5);
    this.wonBanner.add([bannerBg, this.wonBannerCrest, this.wonBannerTitle, this.wonBannerSub]);
    this.wonBanner.setVisible(false);

    this.playObjects.push(
      this.timerTrack, this.timerFill, this.timerText, this.timerLabelText,
      this.targetFill, this.targetText,
      this.movesText, this.bestTileText,
      this.hintText, this.submitBtn, this.expireBtn, this.wonBanner,
    );
  }

  // ── Build: result ─────────────────────────────────────────────────────────

  private buildResult(): void {
    this.resultCard = this.add.container(SCENE_W / 2, SCENE_H / 2 - 20);

    const cardBg = this.add.rectangle(0, 0, 340, 200, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5);

    this.resultTitle = this.add.text(0, -60, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "30px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0.5);

    this.resultBody = this.add.text(0, -10, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px", color: "#765a32", align: "center", wordWrap: { width: 300 },
    }).setOrigin(0.5);

    this.resultHint = this.add.text(0, 66, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px", color: "#6f5a40",
    }).setOrigin(0.5);

    this.resultCard.add([cardBg, this.resultTitle, this.resultBody, this.resultHint]);

    this.resultStartBtn = this.buildActionButton(
      SCENE_W / 2,
      SCENE_H / 2 + 118,
      210,
      46,
      "Play Again",
      () => {
        if (!this.isGuestMode() && !this.bool("gameFiNewEntriesEnabled")) return;
        if (!this.isGuestMode() && this.bool("walletConnected") === false) return;
        this.dispatch("startGame", this.num("gameDifficulty", this.selectedDiff));
      },
    );
    this.resultStartBtnText = this.resultStartBtn.list[1] as Phaser.GameObjects.Text;

    this.resultObjects.push(this.resultCard, this.resultStartBtn);
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
      this.animate({ targets: btn, scale: 1.04, duration: 70, ease: "Sine.easeOut" });
    });
    bg.on("pointerout", () => {
      this.animate({ targets: btn, scale: 1.0, duration: 70 });
    });
    bg.on("pointerdown", () => {
      this.sfx.unlock();
      this.sfx.play("tap");
      this.animate({ targets: btn, scale: 0.96, duration: 60, yoyo: true });
      onPress();
    });
    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px", fontStyle: "bold", color: "#2b261f",
    }).setOrigin(0.5);
    btn.add([bg, txt]);
    return btn;
  }

  // ── Update: lobby ─────────────────────────────────────────────────────────

  private updateLobby(): void {
    this.refreshDiffCards();

    const labels     = this.labels();
    const rule       = this.routeRule(this.selectedDiff);
    const poolFree   = this.num("poolFree", 0);
    const walletConn = this.bool("walletConnected");
    const isStarting = this.bool("isStarting");
    const guestMode  = this.isGuestMode();
    const gameFiEnabled = this.bool("gameFiNewEntriesEnabled");
    const enough     = rule ? poolFree >= Number(gasDisplay(rule.reward)) : false;

    const btnBg = this.startBtn.list[0] as Phaser.GameObjects.Rectangle;
    const btnText = this.startBtn.list[1] as Phaser.GameObjects.Text;
    // Guest is a free local game — no wallet required to build the realm.
    const canStart = (guestMode || (gameFiEnabled && walletConn && enough)) && !isStarting;
    btnBg.setFillStyle(canStart ? C.gold : C.disabledBtn);
    btnBg.setStrokeStyle(2, canStart ? C.goldLight : C.cardBorder);
    btnText.setColor(canStart ? "#2b261f" : "#765a32");
    // A gated hero button reads as an intentional next step ("Connect wallet")
    // rather than a faded "Build Realm".
    this.startBtnText.setText(
      isStarting
        ? labels.building
        : !guestMode && !gameFiEnabled
          ? labels.gameFiUnavailable
        : (guestMode || walletConn)
          ? labels.buildRealm
          : labels.connectWallet,
    );

    const poolMsg = guestMode
      ? labels.localPracticeStatus
      : !gameFiEnabled
        ? labels.gameFiUnavailable
      : !walletConn
        ? labels.connectStatus
        : !enough
          ? this.fmt(labels.poolLow, { pool: poolFree.toFixed(2) })
          : rule
            ? this.fmt(labels.entryReward, {
                entry: gasDisplay(rule.entry),
                reward: gasDisplay(rule.reward),
              })
            : "";
    this.poolText.setText(poolMsg);
  }

  // ── Update: loading ───────────────────────────────────────────────────────

  private updateLoading(): void {
    const labels = this.labels();
    const status = this.str("lastStatus", "");
    const settlementPending = this.str("gameStatus", "idle") === "unknown";
    this.loadingTitle.setText(settlementPending ? labels.settlementTitle : labels.preparing);
    this.loadingText.setText(settlementPending
      ? labels.settlementHint
      : status === "shuffling" ? labels.sealing : labels.opening);
    this.retryBtn.setVisible(this.canRetryDeal());
    this.refreshBtn.setVisible(settlementPending && !this.bool("isRecovering"));
    this.releaseBtn.setVisible(this.canReleaseCommitted());

    // Kick off pulsing animation if not already running. Gated on reduced-motion
    // so the looping crest pulse never runs for motion-sensitive users.
    if (!this.loadTween && this.loadingTiles.length > 0 && !this.reducedMotion) {
      this.loadTween = this.tweens.add({
        targets: this.loadingTiles,
        scaleX: 1.12, scaleY: 1.12,
        alpha: { from: 0.55, to: 1 },
        duration: 480,
        ease: "Sine.easeInOut",
        yoyo: true, repeat: -1,
        delay: this.tweens.stagger(120, {}),
      });
    }
  }

  private canRetryDeal(): boolean {
    return (
      this.str("gameStatus", "idle") === "committed" &&
      !this.bool("isStarting") &&
      !this.bool("isDealing")
    );
  }

  private canReleaseCommitted(): boolean {
    return (
      this.bool("canReleaseStuck")
      && !this.bool("isRecovering")
      && this.str("activeGameId", "0") !== "0"
    );
  }

  // ── Update: board ─────────────────────────────────────────────────────────

  private updateBoard(): void {
    const board = this.val<number[][]>("board") ?? [];
    if (!Array.isArray(board) || board.length !== BOARD_SIZE) return;

    const pending = this.pendingMoveTarget;
    let boardChanged = false;
    let spawnedTile = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const newVal = board[r]?.[c] ?? 0;
        const oldVal = this.prevBoard[r]?.[c] ?? 0;
        const t = this.tiles[r]?.[c];
        if (!t) continue;

        if (newVal !== oldVal) boardChanged = true;
        if (pending && oldVal === 0 && newVal > 0 && !(pending.row === r && pending.col === c)) {
          spawnedTile = true;
        }

        this.setTileValue(t, newVal);

        // Scale-pop animation on newly merged tiles
        if (newVal > 0 && newVal !== oldVal && !this.reducedMotion) {
          this.animate({
            targets: t.container,
            scaleX: { from: 1.22, to: 1.0 },
            scaleY: { from: 1.22, to: 1.0 },
            duration: 250,
            ease: "Back.easeOut",
          });
        }
      }
    }

    // One spawn cue per confirmed move (never on the deal or idle pushes)
    if (pending && boardChanged) {
      if (spawnedTile) this.sfx.play("spawn");
      this.pendingMoveTarget = null;
    }

    // Deep-copy board for next diff
    this.prevBoard = board.map((row) => [...row]);
  }

  // ── Update: HUD ───────────────────────────────────────────────────────────

  private updateHUD(): void {
    const labels       = this.labels();
    const rule         = this.routeRule(this.num("gameDifficulty", 0));
    const deadline     = this.num("deadline", 0);
    const dealtAt      = this.num("dealtAt", 0);
    const moveCount    = this.num("moveCount", 0);
    const tileAchieved = this.num("tileAchieved", 0);
    const isSubmitting = this.bool("isSubmitting");
    const inputSyncFailed = this.bool("inputSyncFailed");

    // Timer
    const now      = this.nowMs;
    const timeLeft = deadline > 0 ? Math.max(0, deadline - now) : 0;
    const limitMs  = rule?.limitMs ?? 1;
    const timePct  = Math.min(1, timeLeft / limitMs);
    const isLow    = timeLeft > 0 && timeLeft < 30_000;

    this.timerText.setText(formatClock(timeLeft));
    if (isLow) {
      this.timerText.setColor("#b91c1c");
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
    this.targetText.setText(this.fmt(labels.target, {
      current: tileAchieved,
      target: targetTile,
    }));

    // Stats
    this.movesText.setText(this.fmt(labels.moves, { count: moveCount }));
    this.bestTileText.setText(
      tileAchieved > 0
        ? this.fmt(labels.best, { tile: tileAchieved })
        : labels.bestUnset,
    );

    // Tier-up cue: a new best building was raised (once per new best)
    if (tileAchieved > this.lastBestTile) {
      if (this.lastBestTile > 0) this.sfx.play("combo");
      this.lastBestTile = tileAchieved;
    }

    // Action area — primary game completion and recovery stay inside the canvas.
    const targetReached = tileAchieved >= targetTile;
    const timeUp        = timeLeft <= 0 && deadline > 0;

    // Guest carries no reward — reframe the claim affordances as a local finish.
    const guestMode = this.isGuestMode();
    const proofWaitMs = guestMode
      ? 0
      : Math.max(0, dealtAt + (rule?.minSolveMs ?? 0) - now);
    const proofReady = proofWaitMs <= 0;
    const showClaim = targetReached && !timeUp && !isSubmitting && proofReady;
    const showTargetBanner = targetReached && !timeUp;
    this.wonBannerSub.setText(
      proofReady
        ? guestMode ? labels.finishLocal : labels.claimReward
        : this.fmt(labels.proofWarming, { time: formatClock(proofWaitMs) }),
    );
    this.submitBtnText.setText(guestMode ? labels.finishLocal : labels.claimReward);
    if (showTargetBanner) this.wonBannerCrest.setTexture(this.tileAssetKey(targetTile));
    this.wonBanner.setVisible(showTargetBanner);
    this.submitBtn.setVisible(showClaim);
    const canRelease = guestMode ? timeUp : this.bool("canReleaseStuck");
    this.expireBtn.setVisible(canRelease);
    this.expireBtn.getAt<Phaser.GameObjects.Text>(1)?.setText(
      guestMode ? labels.timeUp : labels.releaseGame,
    );

    if (guestMode && timeUp && !this.deadlineEndRequested) {
      this.deadlineEndRequested = true;
      this.dispatch("expireGame");
    }

    // One-shot celebratory pop when the banner first appears.
    if (showTargetBanner && !this.wonBannerActive && !this.reducedMotion) {
      this.wonBanner.setScale(0.82);
      this.tween({ targets: this.wonBanner, scale: 1, duration: 260, ease: "Back.easeOut" });
    }
    this.wonBannerActive = showTargetBanner;

    if (inputSyncFailed) {
      this.hintText.setText(labels.syncFailed);
    } else if (this.selectedCell) {
      this.hintText.setText(labels.selectDestination);
    } else if (targetReached) {
      this.hintText.setText(
        proofReady
          ? `${labels.targetReached} ${guestMode ? labels.finishLocal : labels.claimReward}`
          : this.fmt(labels.proofWarming, { time: formatClock(proofWaitMs) }),
      );
    } else {
      this.hintText.setText(labels.selectTile);
    }
    this.hintText.setVisible(inputSyncFailed || !targetReached || timeUp || !proofReady);
  }

  // ── Update: result ────────────────────────────────────────────────────────

  private updateResult(): void {
    const labels       = this.labels();
    const status       = this.str("gameStatus", "");
    const tileAchieved = this.num("tileAchieved", 0);
    const lastPayout   = this.num("lastPayoutFixed8", 0);
    const elapsedMs    = this.num("lastElapsedMs", 0);
    const enteringResult = status !== this.lastResultStatus;

    if (status === "solved") {
      this.resultTitle
        .setText(this.isGuestMode() ? labels.guestVictory : labels.victory)
        .setColor("#047857");
      if (this.isGuestMode()) {
        // Guest run — no GAS payout; celebrate the local best tile instead.
        this.resultBody.setText(
          `${this.fmt(labels.bestTile, { tile: tileAchieved })}\n` +
          `${labels.time}: ${formatClock(elapsedMs)}\n${labels.localSaved}`,
        );
      } else {
        const payoutGas = (lastPayout / 1e8).toFixed(2);
        this.resultBody.setText(
          `${this.fmt(labels.bestTile, { tile: tileAchieved })}\n` +
          `${labels.time}: ${formatClock(elapsedMs)}\n` +
          this.fmt(labels.reward, { amount: payoutGas }),
        );
      }
    } else {
      this.resultTitle
        .setText(this.isGuestMode() ? labels.runOver : labels.timeUp)
        .setColor("#b91c1c");
      this.resultBody.setText(this.fmt(labels.bestTile, { tile: tileAchieved }));
    }
    const resultCanStart = this.isGuestMode()
      || (this.bool("gameFiNewEntriesEnabled") && this.bool("walletConnected"));
    const resultButtonBg = this.resultStartBtn.list[0] as Phaser.GameObjects.Rectangle;
    resultButtonBg.setFillStyle(resultCanStart ? C.gold : C.disabledBtn);
    this.resultStartBtnText
      .setText(
        this.isGuestMode()
          ? labels.playAgain
          : this.bool("gameFiNewEntriesEnabled")
            ? labels.buildNext
            : labels.gameFiUnavailable,
      )
      .setColor(resultCanStart ? "#2b261f" : "#765a32");

    // Entrance animation
    if (enteringResult && !this.reducedMotion) {
      this.resultCard.setScale(0.7).setAlpha(0);
      this.animate({
        targets: this.resultCard,
        scale: 1, alpha: 1,
        duration: 280,
        ease: "Back.easeOut",
      });
    }
    this.lastResultStatus = status;
  }

  // ── Tile interaction ──────────────────────────────────────────────────────

  private handleTileClick(row: number, col: number): void {
    if (!this.canAcceptMoveInput()) return;

    const board = this.boardSnapshot();
    const value = board[row]?.[col] ?? 0;

    if (!this.selectedCell) {
      // Select a tile that has a value
      if (value > 0) {
        this.sfx.play("select");
        this.selectCell(row, col);
      }
      return;
    }

    const { row: sr, col: sc } = this.selectedCell;

    // Clicking the same tile deselects
    if (sr === row && sc === col) {
      this.sfx.play("tap");
      this.clearSelection();
      return;
    }

    if (this.queueMove({ row: sr, col: sc }, { row, col })) return;

    // Clicked a different tile → re-select
    this.sfx.play("error");
    if (value > 0) {
      this.selectCell(row, col);
    } else {
      this.clearSelection();
    }
  }

  private canAcceptMoveInput(): boolean {
    const deadline = this.num("deadline", 0);
    return (
      this.currentPhase === "play" &&
      !this.moveInputLocked &&
      !this.bool("isMoving") &&
      !this.bool("isSubmitting") &&
      !this.bool("isRecovering") &&
      !this.bool("inputSyncFailed") &&
      (deadline <= 0 || Date.now() < deadline)
    );
  }

  private boardSnapshot(): number[][] {
    const board = this.val<number[][]>("board");
    return cloneBoard(Array.isArray(board) ? board : []);
  }

  private queueMove(from: Cell, to: Cell): boolean {
    if (!this.canAcceptMoveInput()) return false;

    const board = this.boardSnapshot();
    const kind = classifyMove(board, from, to);
    if (!kind) return false;

    const sourceValue = board[from.row]?.[from.col] ?? 0;
    this.pendingMove = { from: { ...from }, to: { ...to }, kind, sourceValue };
    this.pendingMoveTarget = { ...to };
    this.moveInputLocked = true;
    this.moveUnlockTimer?.remove(false);
    this.moveUnlockTimer = this.time.delayedCall(6_000, () => {
      if (!this.pendingMove) return;
      this.releaseMoveLock(true);
      this.hintText?.setText(this.labels().syncFailed);
    });

    this.clearSelection();
    this.hintText?.setText(this.labels().moving);
    this.sfx.play(kind === "merge" ? "merge" : "tap");
    this.animateSlide(from.row, from.col, to.row, to.col, () => {
      this.dispatch("recordMove", from.row, from.col, to.row, to.col);
    });
    return true;
  }

  private releaseMoveLock(failed: boolean): void {
    const pending = this.pendingMove;
    this.moveUnlockTimer?.remove(false);
    this.moveUnlockTimer = null;
    this.pendingMove = null;
    this.moveInputLocked = false;

    if (pending) {
      this.tiles[pending.from.row]?.[pending.from.col]?.container
        .setPosition(tileX(pending.from.col), tileY(pending.from.row))
        .setScale(1);
    }
    if (failed) this.pendingMoveTarget = null;
    this.updateHUD();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const start = this.gestureStart;
    this.gestureStart = null;
    if (!start) return;

    const source = this.tiles[start.row]?.[start.col]?.container;
    if (!this.canAcceptMoveInput()) {
      source?.setPosition(tileX(start.col), tileY(start.row));
      this.gestureDragging = false;
      return;
    }

    const dx = pointer.worldX - start.x;
    const dy = pointer.worldY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) {
      source?.setPosition(tileX(start.col), tileY(start.row));
      this.gestureDragging = false;
      return;
    }

    const to = Math.abs(dx) >= Math.abs(dy)
      ? { row: start.row, col: start.col + (dx > 0 ? 1 : -1) }
      : { row: start.row + (dy > 0 ? 1 : -1), col: start.col };

    if (!this.queueMove({ row: start.row, col: start.col }, to)) {
      source?.setPosition(tileX(start.col), tileY(start.row));
      this.sfx.play("error");
      this.hintText?.setText(this.labels().selectDestination);
    }
    this.gestureDragging = false;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const start = this.gestureStart;
    if (!start || !pointer.isDown || !this.canAcceptMoveInput()) return;
    if (this.getTileVal(start.row, start.col) <= 0) return;

    const dx = pointer.worldX - start.x;
    const dy = pointer.worldY - start.y;
    if (!this.gestureDragging && Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
    this.gestureDragging = true;
    const maxOffset = TILE_SIZE * 0.72;
    this.tiles[start.row]?.[start.col]?.container.setPosition(
      tileX(start.col) + Phaser.Math.Clamp(dx, -maxOffset, maxOffset),
      tileY(start.row) + Phaser.Math.Clamp(dy, -maxOffset, maxOffset),
    );
  }

  private handleKeyboardMove(event: KeyboardEvent): void {
    if (!this.canAcceptMoveInput()) return;

    const direction = new Map<string, Cell>([
      ["arrowup", { row: -1, col: 0 }],
      ["w", { row: -1, col: 0 }],
      ["arrowdown", { row: 1, col: 0 }],
      ["s", { row: 1, col: 0 }],
      ["arrowleft", { row: 0, col: -1 }],
      ["a", { row: 0, col: -1 }],
      ["arrowright", { row: 0, col: 1 }],
      ["d", { row: 0, col: 1 }],
    ]).get(event.key.toLowerCase());
    if (!direction) return;
    event.preventDefault();

    if (!this.selectedCell) {
      const board = this.boardSnapshot();
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          if ((board[row]?.[col] ?? 0) <= 0) continue;
          this.sfx.play("select");
          this.selectCell(row, col);
          return;
        }
      }
      return;
    }

    const from = { ...this.selectedCell };
    const to = { row: from.row + direction.row, col: from.col + direction.col };
    if (!this.queueMove(from, to)) {
      this.sfx.play("error");
      this.hintText?.setText(this.labels().selectDestination);
    }
  }

  private handleEscape(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.gestureStart) {
      this.tiles[this.gestureStart.row]?.[this.gestureStart.col]?.container
        .setPosition(tileX(this.gestureStart.col), tileY(this.gestureStart.row));
    }
    this.gestureStart = null;
    this.gestureDragging = false;
    this.clearSelection();
  }

  private selectCell(row: number, col: number): void {
    this.selectedCell = { row, col };
    this.selectionRing.setPosition(tileX(col), tileY(row));
    this.selectionRing.setVisible(true);

    if (!this.reducedMotion) {
      this.animate({
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

    this.animate({
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

  // ── Resize ────────────────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || SCENE_W));
    const viewH = Math.max(1, Math.round(this.scale.height || SCENE_H));
    const zoom = Math.min(viewW / SCENE_W, viewH / SCENE_H);

    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(SCENE_W / 2, SCENE_H / 2);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cleanupScene(): void {
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.keyboard?.off("keydown-UP", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-DOWN", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-LEFT", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-RIGHT", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-W", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-A", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-S", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-D", this.handleKeyboardMove, this);
    this.input.keyboard?.off("keydown-ESC", this.handleEscape, this);
    this.dispatchCompleteUnsubscribe?.();
    this.dispatchCompleteUnsubscribe = null;
    this.moveUnlockTimer?.remove(false);
    this.moveUnlockTimer = null;
    this.clockTimer?.remove(false);
    this.clockTimer = null;
    this.loadTween?.stop();
    this.loadTween = null;
    this.gestureStart = null;
    this.gestureDragging = false;
  }

  destroy(fromScene = false): void {
    this.cleanupScene();
    super.destroy(fromScene);
  }
}
