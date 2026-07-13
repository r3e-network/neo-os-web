/**
 * SheepScene — Phaser 3 scene for Sheep Solitaire (羊了个羊 style tile-matching).
 *
 * Renders a meadow-green board with a stacked card pile, a 7-slot tray,
 * tool buttons (Undo/Shuffle/Remove3), and progress & status indicators.
 * A lobby with 3 difficulty cards is shown while the game is idle.
 *
 * State received from React (via GameBridge):
 *   gameStatus:     "idle"|"committed"|"dealt"|"solved"|"expired"
 *   pileCards:      CardView[]   cards remaining in the pile
 *   slotCards:      CardView[]   cards in the 7-slot tray (0–7 elements)
 *   shuffleLeft:    number
 *   remove3Left:    number
 *   undosUsed:      number
 *   gameDifficulty: number  0=easy 1=medium 2=hard
 *   isStarting:     boolean
 *   isDealing:      boolean
 *   isSubmitting:   boolean
 *   isMatching:     boolean
 *   isGameOver:     boolean
 *   lastStatus:     string
 *   lastPayout:     string
 *
 * Actions dispatched:
 *   "startGame"  { difficulty: number }
 *   "pickCard"   { cardId: number }
 *   "useUndo"
 *   "useShuffle"
 *   "useRemove3"
 *   "submitRun"
 *   "expireGame"
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { ALL_SYMBOLS } from "../logic/sheep-engine";

// Themed board names (English fallback; localized copy arrives via bridgeState.loc).
const DIFFICULTY_LABELS = ["Meadow Board", "Festival Board", "Mountain Board"] as const;
const DIFFICULTY_ENTRY   = ["Entry 0.02 GAS", "Entry 0.10 GAS", "Entry 0.20 GAS"] as const;
const DIFFICULTY_REWARD  = ["Win 0.10 GAS", "Win 0.50 GAS", "Win 1.00 GAS"] as const;
const DIFFICULTY_TIMER   = ["5:00",     "8:00",     "12:00"] as const;

const SHEEP_ASSETS = {
  table: "sheep-meadow-table",
  tray: "sheep-slot-tray",
  mascot: "sheep-mascot",
  badges: ["sheep-badge-easy", "sheep-badge-medium", "sheep-badge-hard"],
  tiles: [
    "sheep-tile-0",
    "sheep-tile-1",
    "sheep-tile-2",
    "sheep-tile-3",
    "sheep-tile-4",
    "sheep-tile-5",
    "sheep-tile-6",
    "sheep-tile-7",
    "sheep-tile-8",
    "sheep-tile-9",
    "sheep-tile-10",
    "sheep-tile-11",
    "sheep-tile-12",
    "sheep-tile-13",
    "sheep-tile-14",
  ],
} as const;

const C = {
  meadow:      0x3a7c47,
  meadowDark:  0x2a5c34,
  meadowLight: 0x5aaa65,
  card:        0xfff8e8,
  cardBlocked: 0xbdb09a,
  cardBorder:  0xd4a843,
  cardBorderB: 0x8a7050,
  gold:        0xd4a843,
  goldLight:   0xf0c866,
  tray:        0x6b4820,
  traySlot:    0x3a2808,
  traySlotBdr: 0x8b6030,
  btnBg:       0xeaf7d0,
  btnBorder:   0x84cc16,
  btnDisabled: 0xeee9dd,
  btnText:     0x365314,
  white:       0xffffff,
  red:         0xe25d4d,
  green:       0x16a34a,
  muted:       0x7a9a7a,
  overlayDark: 0x000000,
  lobbyCard0:  0x2a7a3a,
  lobbyCard1:  0x7a6020,
  lobbyCard2:  0x7a2a2a,
  panel:       0xfff8e8,
  ink:         0x2f281d,
  // ── Game-feel tones (羊了个羊 parity) ──
  cardShadow:  0x2a1c08,  // warm drop-shadow under each stacked tile
  occlusion:   0x3a2c18,  // warm veil laid over covered (locked) tiles
  occludedInk: 0xcfc6b4,  // muted tint on covered tile art
  slotWarn:    0xe0a13c,  // tray slot frame warms at the 5th fill
  slotDanger:  0xe0663c,  // tray slot frame reddens at the 6th/7th fill
  trayDanger:  0xffb59a,  // tray frame tint when the tray is nearly full
} as const;

interface CardView {
  id: number;
  symbol: number;
  layer: number;
  col?: number;
  row?: number;
  exposed: boolean;
  picked: boolean;
}

// ── Layout constants ─────────────────────────────────────────────────────────
const CARD_W    = 48;
const CARD_H    = 58;
const TILE_ART_SIZE = 54;
const CARD_STEP_X = 53;
const CARD_STEP_Y = 63;
const TRAY_Y_FRAC = 0.625;
const TOOLS_Y_FRAC = 0.745;
const STATUS_Y_FRAC = 0.835;
const SLOT_COUNT = 7;
const DESIGN_W = 400;
const DESIGN_H = 640;
const FONT = "Inter, Arial, sans-serif";

// ── SheepScene ────────────────────────────────────────────────────────────────

export class SheepScene extends BaseScene {
  // ── Group containers (only one visible at a time) ──────────────────────────
  private lobbyGroup!:  Phaser.GameObjects.Container;
  private loadGroup!:   Phaser.GameObjects.Container;
  private gameGroup!:   Phaser.GameObjects.Container;
  private resultGroup!: Phaser.GameObjects.Container;

  // ── Game sub-elements ──────────────────────────────────────────────────────
  private pileContainer!:    Phaser.GameObjects.Container;
  private trayContainer!:    Phaser.GameObjects.Container;
  private toolsContainer!:   Phaser.GameObjects.Container;
  private progressLabel!:    Phaser.GameObjects.Text;
  private statusLabel!:      Phaser.GameObjects.Text;
  private matchedLabel!:     Phaser.GameObjects.Text;
  private sceneBackdrop!:    Phaser.GameObjects.Rectangle;
  private stagePanel!:       Phaser.GameObjects.Rectangle;
  private stageFrame!:       Phaser.GameObjects.Graphics;
  private tallMeadow!:       Phaser.GameObjects.Graphics;

  // Tool button references
  private undoBtn!:    Phaser.GameObjects.Container;
  private shuffleBtn!: Phaser.GameObjects.Container;
  private remove3Btn!: Phaser.GameObjects.Container;
  private undoCountTxt!:    Phaser.GameObjects.Text;
  private shuffleCountTxt!: Phaser.GameObjects.Text;
  private remove3CountTxt!: Phaser.GameObjects.Text;
  private lobbyCards: Phaser.GameObjects.Container[] = [];
  private lobbyCardBgs: Phaser.GameObjects.Rectangle[] = [];

  // Result overlay elements
  private resultTitle!:   Phaser.GameObjects.Text;
  private resultSub!:     Phaser.GameObjects.Text;
  private resultActionBg!: Phaser.GameObjects.Rectangle;
  private resultActionTxt!: Phaser.GameObjects.Text;
  private resultMascot?:  Phaser.GameObjects.Image;

  // Tray references — used to escalate slot tension as the 7-slot tray fills.
  private trayBg?:       Phaser.GameObjects.Image;
  private slotBoxes:     Phaser.GameObjects.Rectangle[] = [];
  private trayShaking = false;

  // ── Localized text references (updated from React locale via applyLocale) ────
  private lobbyTitleTxt?:  Phaser.GameObjects.Text;
  private lobbySubTxt?:    Phaser.GameObjects.Text;
  private dailyTitleTxt?:  Phaser.GameObjects.Text;
  private dailySubTxt?:    Phaser.GameObjects.Text;
  private cardNameTxts:    Phaser.GameObjects.Text[] = [];
  private cardInfoTxts:    Phaser.GameObjects.Text[] = [];
  private cardEntryTxts:   Phaser.GameObjects.Text[] = [];
  private cardRewardTxts:  Phaser.GameObjects.Text[] = [];
  private undoLabelTxt?:   Phaser.GameObjects.Text;
  private shuffleLabelTxt?: Phaser.GameObjects.Text;
  private remove3LabelTxt?: Phaser.GameObjects.Text;
  private trayLabelTxt?:   Phaser.GameObjects.Text;
  private loadTitleTxt?:   Phaser.GameObjects.Text;
  private loadSubTxt?:     Phaser.GameObjects.Text;

  // Loading spinner bob (reduced-motion aware).
  private spinner?:        Phaser.GameObjects.Container;
  private spinnerBaseY = 0;
  private spinnerBob: Phaser.Tweens.Tween | null = null;

  // ── State mirrors ──────────────────────────────────────────────────────────
  private prevSlotLen = 0;
  private prevPileLen = 0;
  private currentStatus = "idle";
  private ghostInFlight = false;
  private resultAnimationKey = "";
  private prevMatching = false;
  private lastResultCue = "";
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private renderedPileKey = "";
  private renderedTrayKey = "";

  // ── FX state (juice) ───────────────────────────────────────────────────────
  private matchStreak = 0;
  private lastMatchAt = 0;
  private ambientGlow?: Phaser.GameObjects.Image;

  constructor() {
    super("SheepScene");
  }

  // ── Locale helpers (React resolves strings via bridgeState.loc) ─────────────
  private locBag(): Record<string, unknown> {
    return this.val<Record<string, unknown>>("loc") ?? {};
  }

  private locStr(key: string, fallback: string): string {
    const v = this.locBag()[key];
    return typeof v === "string" && v.length > 0 ? v : fallback;
  }

  private locArr(key: string, fallback: string[]): string[] {
    const v = this.locBag()[key];
    return Array.isArray(v) && v.length === fallback.length ? (v as string[]) : fallback;
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(SHEEP_ASSETS.table, "./art/meadow-table.webp");
    this.load.image(SHEEP_ASSETS.tray, "./art/slot-tray.webp");
    this.load.image(SHEEP_ASSETS.mascot, "./art/mascot-sheep.webp");
    this.load.image(SHEEP_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(SHEEP_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(SHEEP_ASSETS.badges[2], "./art/badge-hard.webp");
    // P1 Art — sheep-themed tile set (generated by scripts/generate-sheep-tiles.mjs)
    for (let i = 0; i < ALL_SYMBOLS.length; i++) {
      const sym = ALL_SYMBOLS[i];
      if (!sym) continue;
      this.load.image(
        SHEEP_ASSETS.tiles[i]!,
        `./art/tile-${String(i).padStart(2, "0")}-${sym}.webp`,
      );
    }
  }

  create(): void {
    super.create();

    // Raw pointer handlers below don't go through bindGameButton, so unlock
    // the mixer on any pointerdown.
    this.input.on("pointerdown", () => this.sfx.unlock());

    this.buildBackground(DESIGN_W, DESIGN_H);
    this.ensureFxTextures();
    this.buildAmbientField(DESIGN_W, DESIGN_H);
    this.buildLobby(DESIGN_W, DESIGN_H);
    this.buildLoadScreen(DESIGN_W, DESIGN_H);
    this.buildGameScreen(DESIGN_W, DESIGN_H);
    this.buildResultScreen(DESIGN_W, DESIGN_H);
    this.fitCameraToHost();
    this.bindKeyboardControls();

    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    this.applyLocale();

    const status     = this.str("gameStatus", "idle");
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");
    const isGameOver = this.bool("isGameOver");

    const showLobby  = (status === "idle" || status === "expired" || status === "refunded") && !isStarting && !isDealing;
    const deadlineExpired = this.bool("deadlineExpired");
    const showLoad   = isStarting || isDealing || status === "committed" || status === "unknown";
    const showResult = status === "solved" || (status === "dealt" && (isGameOver || deadlineExpired));
    const showGame   = status === "dealt" && !isGameOver && !deadlineExpired;

    // A new round can reuse the same Phaser scene. Reset the transition
    // sentinels while we are off the board so the next deal still cascades in
    // and an old tray/match state cannot trigger a phantom warning or effect.
    if (!showGame) {
      this.prevPileLen = 0;
      this.prevSlotLen = 0;
      this.prevMatching = false;
      this.renderedPileKey = "";
      this.renderedTrayKey = "";
    }

    this.setGroupActive(this.lobbyGroup, showLobby && !showLoad);
    this.setGroupActive(this.loadGroup, showLoad);
    this.setGroupActive(this.gameGroup, showGame);
    this.setGroupActive(this.resultGroup, showResult);
    if (showLoad) this.startSpinnerBob();
    else this.stopSpinnerBob();

    this.currentStatus = status;
    this.updateLobbyAvailability();
    if (!showResult) this.resultAnimationKey = "";

    const resultCue: "" | "win" | "lose" = showResult ? (status === "solved" ? "win" : "lose") : "";
    if (resultCue && resultCue !== this.lastResultCue) this.sfx.play(resultCue);
    this.lastResultCue = resultCue;

    if (showGame)   this.updateGameScreen();
    if (showResult) this.updateResultScreen();

    // Always keep status visible when game is shown
    this.statusLabel?.setText(this.str("lastStatus", ""));
  }

  /** Push the React-resolved locale strings onto every static scene label. */
  private applyLocale(): void {
    this.lobbyTitleTxt?.setText(this.locStr("title", "Sheep Solitaire"));
    this.lobbySubTxt?.setText(this.locStr("subtitle", "Match 3 tiles to clear the board"));

    const names = this.locArr("diffNames", [...DIFFICULTY_LABELS]);
    const infos = this.locArr("diffInfos", [
      `8 tile types · ${DIFFICULTY_TIMER[0]}`,
      `12 tile types · ${DIFFICULTY_TIMER[1]}`,
      `15 tile types · ${DIFFICULTY_TIMER[2]}`,
    ]);
    const entries = this.locArr("diffEntries", [...DIFFICULTY_ENTRY]);
    const rewards = this.locArr("diffRewards", [...DIFFICULTY_REWARD]);
    for (let d = 0; d < 3; d++) {
      this.cardNameTxts[d]?.setText(names[d] ?? "");
      this.cardInfoTxts[d]?.setText(infos[d] ?? "");
      this.cardEntryTxts[d]?.setText(entries[d] ?? "");
      this.cardRewardTxts[d]?.setText(rewards[d] ?? "");
    }

    this.undoLabelTxt?.setText(this.locStr("undo", "Undo"));
    this.shuffleLabelTxt?.setText(this.locStr("shuffle", "Shuffle"));
    this.remove3LabelTxt?.setText(this.locStr("remove3", "Remove 3"));
    this.trayLabelTxt?.setText(this.locStr("tray", "Tray"));
    this.loadTitleTxt?.setText(this.locStr("loadTitle", "Preparing your board…"));
    this.loadSubTxt?.setText(this.locStr("loadSub", "Securing puzzle on-chain"));

    this.dailyTitleTxt?.setText(this.locStr("dailyChallengeTitle", "Today's Challenge"));
    this.dailySubTxt?.setText(this.locStr("dailyChallengeSub", "Level 1 easy · Level 2 devil · refreshes daily"));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(W: number, H: number): void {
    this.sceneBackdrop = this.add.rectangle(W / 2, H / 2, W, H, 0xfffbef);
    this.stagePanel = this.add.rectangle(W / 2, H / 2, W - 18, H - 18, 0xf8f0dc)
      .setStrokeStyle(2, 0xe7d19b);

    const table = this.add.image(W / 2, H * 0.36, SHEEP_ASSETS.table)
      .setDisplaySize(W - 18, 148)
      .setAlpha(0.5);
    table.setDepth(0);

    // Soft cream sheen that lifts the meadow-table art into the light theme so
    // it reads as a faint pastoral wash behind the cards.
    // (Alpha must be 0–1; a stray `28` here rendered an opaque white slab that
    // showed as false "letterbox" bars in the strips flanking the route cards.)
    this.add.rectangle(W / 2, H * 0.36, W - 24, 150, 0xfffbef, 0.55)
      .setStrokeStyle(1, 0xffffff, 0.5);
    this.add.rectangle(W / 2, 78, W - 38, 74, C.panel, 0.95)
      .setStrokeStyle(1, 0xe7d19b);
    this.tallMeadow = this.add.graphics();
    this.stageFrame = this.add.graphics();
    this.renderResponsiveStage(H, H / 2);
  }

  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.sceneBackdrop || !this.stagePanel || !this.stageFrame || !this.tallMeadow) return;

    const viewTop = centerY - visibleWorldH / 2;
    const viewBottom = centerY + visibleWorldH / 2;
    const stageTop = Math.min(0, viewTop - 12);
    const stageBottom = Math.max(DESIGN_H, Math.min(viewBottom + 10, DESIGN_H + 170));
    const stageHeight = stageBottom - stageTop;
    const stageMidY = stageTop + stageHeight / 2;

    // Horizontal extension — mirror the vertical logic. When the host viewport
    // is wider than the 400:640 design ratio the camera reveals world beyond
    // DESIGN_W; without this the transparent canvas exposes the white React
    // shell + its green gradient as letterbox bars beside the cream stage. The
    // camera always centres on DESIGN_W / 2, so exposure is symmetric.
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H) || 1;
    const visibleWorldW = viewW / zoom;
    // When the host viewport is wider than the 400:640 design ratio (e.g. small
    // downscaled canvases) the camera reveals world beyond DESIGN_W; bleed the
    // cream backdrop + panel past it so no transparent letterbox exposes the
    // white/green React shell. The camera centres on DESIGN_W / 2, so exposure
    // is symmetric.
    const wide = visibleWorldW > DESIGN_W + 1;
    const backdropWidth = wide ? visibleWorldW + 48 : DESIGN_W;
    const panelWidth = wide ? visibleWorldW + 48 : DESIGN_W - 18;

    this.sceneBackdrop
      .setPosition(DESIGN_W / 2, stageMidY)
      .setDisplaySize(backdropWidth, stageHeight);
    this.stagePanel
      .setPosition(DESIGN_W / 2, stageMidY)
      .setDisplaySize(panelWidth, Math.max(1, stageHeight - 18));

    this.tallMeadow.clear();
    if (stageBottom > DESIGN_H + 20) {
      const meadowTop = DESIGN_H - 10;
      const meadowHeight = stageBottom - meadowTop - 8;
      this.tallMeadow.fillStyle(0xf4efdb, 0.98);
      this.tallMeadow.fillRoundedRect(18, meadowTop, DESIGN_W - 36, meadowHeight, {
        tl: 20,
        tr: 20,
        bl: 0,
        br: 0,
      });
      this.tallMeadow.fillStyle(0xd9edb7, 0.72);
      this.tallMeadow.fillEllipse(DESIGN_W * 0.32, meadowTop + 42, 150, 30);
      this.tallMeadow.fillEllipse(DESIGN_W * 0.68, meadowTop + 68, 170, 34);
      this.tallMeadow.lineStyle(1, 0xb5cc85, 0.42);
      for (let x = 42; x < DESIGN_W - 18; x += 44) {
        this.tallMeadow.lineBetween(x, meadowTop + 28, x - 18, stageBottom - 28);
      }
    }

    this.stageFrame.clear();
    this.stageFrame.lineStyle(2, 0xe7d19b, 0.9);
    this.stageFrame.strokeRoundedRect(9, 9, DESIGN_W - 18, stageBottom - 18, 18);
  }

  // ── FX helpers (juice) ───────────────────────────────────────────────────────

  /** Generate the two runtime FX textures once. No new asset files. */
  private ensureFxTextures(): void {
    const glowKey = "sheep-fx-glow";
    const sparkKey = "sheep-fx-spark";
    if (!this.textures.exists(glowKey)) {
      const size = 64;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const steps = 18;
      for (let i = steps; i > 0; i--) {
        const r = (size / 2) * (i / steps);
        const a = 0.015 + 0.05 * (1 - i / steps);
        g.fillStyle(0xffffff, a);
        g.fillCircle(size / 2, size / 2, r);
      }
      g.generateTexture(glowKey, size, size);
      g.destroy();
    }
    if (!this.textures.exists(sparkKey)) {
      const s = 24;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      const cx = s / 2, cy = s / 2, R = s / 2 - 1, r = s / 6;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? R : r;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fillPath();
      g.generateTexture(sparkKey, s, s);
      g.destroy();
    }

    // Soft card drop-shadow — a blurred warm rounded rect. Placed behind each
    // tile so the pile reads as a physically stacked pyramid instead of flat
    // icons floating on the cream stage (the core depth cue for occlusion).
    const shadowKey = "sheep-fx-cardshadow";
    if (!this.textures.exists(shadowKey)) {
      const w = 64, h = 72;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const layers = 9;
      for (let i = layers; i > 0; i--) {
        const t = i / layers;                 // 1 (outermost) → ~0 (core)
        const inset = 9 * (1 - t);
        const a = 0.018 + 0.05 * (1 - t);
        g.fillStyle(C.cardShadow, a);
        g.fillRoundedRect(inset, inset, w - inset * 2, h - inset * 2, 16 * t + 6);
      }
      g.generateTexture(shadowKey, w, h);
      g.destroy();
    }

    // White rounded-rect used two ways (tinted per use): a warm occlusion veil
    // over covered tiles, and a crisp lift-chip behind lobby preview tiles.
    const panelKey = "sheep-fx-panel";
    if (!this.textures.exists(panelKey)) {
      const s = 60;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(1, 1, s - 2, s - 2, 12);
      g.generateTexture(panelKey, s, s);
      g.destroy();
    }

    // Confetti chip — tiny rounded rect for the victory shower.
    const confKey = "sheep-fx-confetti";
    if (!this.textures.exists(confKey)) {
      const w = 14, h = 9;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 0, w, h, 3);
      g.generateTexture(confKey, w, h);
      g.destroy();
    }
  }

  /** Scatter ADD-blended sparkles outward from (x, y) and fade them. */
  private emitSparkles(x: number, y: number, count: number, tint: number, spread = 46): void {
    if (this.reducedMotion) return;
    const key = "sheep-fx-spark";
    if (!this.textures.exists(key)) return;
    for (let i = 0; i < count; i++) {
      const spark = this.add.image(x, y, key)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(120)
        .setScale(0.2 + Math.random() * 0.5);
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (0.5 + Math.random() * 0.8);
      this.tween({
        targets: spark,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.05,
        duration: 420 + Math.random() * 240,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Expanding additive ring + flash at a point. */
  private burstReveal(x: number, y: number, tint: number): void {
    if (this.reducedMotion) return;
    const key = "sheep-fx-glow";
    if (!this.textures.exists(key)) return;
    const ring = this.add.image(x, y, key)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(119)
      .setScale(0.2)
      .setAlpha(0.9);
    this.tween({
      targets: ring,
      scale: 1.4,
      alpha: 0,
      duration: 480,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** Ambient field: a breathing warm glow + drifting motes behind all UI. */
  private buildAmbientField(W: number, H: number): void {
    if (!this.textures.exists("sheep-fx-glow") || !this.textures.exists("sheep-fx-spark")) return;
    const glow = this.add.image(W / 2, H * 0.4, "sheep-fx-glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff0c0)
      .setScale(4)
      .setAlpha(0.12);
    this.ambientGlow = glow;
    if (!this.reducedMotion) {
      this.tween({
        targets: glow,
        alpha: 0.22,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    const moteTints = [0xfff0c0, 0xffffff, 0xcfe8b0];
    const count = this.reducedMotion ? 10 : 16;
    for (let i = 0; i < count; i++) {
      const mx = 30 + Math.random() * (W - 60);
      const my = 60 + Math.random() * (H - 120);
      const mote = this.add.image(mx, my, "sheep-fx-spark")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(moteTints[i % moteTints.length]!)
        .setScale(0.25 + Math.random() * 0.35)
        .setAlpha(this.reducedMotion ? 0.18 : 0.32);
      if (!this.reducedMotion) {
        this.tween({
          targets: mote,
          y: my - (18 + Math.random() * 30),
          x: mx + (Math.random() * 24 - 12),
          alpha: 0.12,
          duration: 3000 + Math.random() * 2600,
          delay: Math.random() * 2000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(W: number, H: number): void {
    this.lobbyGroup = this.add.container(0, 0);

    // Soft pastoral ground filling the band below the route stack so the lower
    // third reads as intentional meadow rather than dead cream space.
    this.buildLobbyGround(W, H);

    const mascot = this.add.image(W / 2 - 130, 57, SHEEP_ASSETS.mascot)
      .setDisplaySize(52, 52);

    const headerTextX = W / 2 + 38;
    this.lobbyTitleTxt = this.add.text(headerTextX, 52, "Sheep Solitaire", {
      fontFamily: FONT,
      fontSize: "21px",
      fontStyle: "700",
      color: "#2f281d",
    }).setOrigin(0.5);

    this.lobbySubTxt = this.add.text(headerTextX, 82, "Match 3 tiles to clear the board", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a6544",
      wordWrap: { width: 236 },
      align: "center",
    }).setOrigin(0.5);

    this.lobbyGroup.add([mascot, this.lobbyTitleTxt, this.lobbySubTxt]);

    this.buildDailyBanner(W, H);

    // 3 difficulty cards — a touch more breathing room lets the stack reach
    // lower into the tall canvas. firstCenterY is the centre of the top card.
    const firstCenterY = 268;
    const cardH    = 112;
    const gap      = 12;
    const cardW    = W - 60;
    const cx       = W / 2;

    const diffColors  = [0xfffbef, 0xfff7df, 0xffefe2];
    const diffBorders = [0x9aca76, 0xdab159, 0xe78b77];

    for (let d = 0; d < 3; d++) {
      const y = firstCenterY + d * (cardH + gap);
      this.buildLobbyCard(cx, y, cardW, cardH, d, diffColors[d]!, diffBorders[d]!);
    }
  }

  /** Subtle meadow ground (ellipses, grass blades, flower dots) in the lower band. */
  private buildLobbyGround(W: number, H: number): void {
    const g = this.add.graphics();
    const baseY = H - 72;

    g.fillStyle(0xd9edb7, 0.55);
    g.fillEllipse(W * 0.30, baseY, 168, 34);
    g.fillStyle(0xd9edb7, 0.42);
    g.fillEllipse(W * 0.70, baseY + 30, 190, 38);

    g.lineStyle(1, 0xa9c877, 0.45);
    for (let x = 34; x < W - 24; x += 26) {
      const sway = ((x / 26) % 2 === 0) ? 6 : -6;
      g.lineBetween(x, baseY + 20, x + sway, baseY - 12);
    }

    // A few tiny flower dots for warmth.
    const flowers: Array<[number, number, number]> = [
      [W * 0.22, baseY - 4, 0xf2b8c6],
      [W * 0.5, baseY + 20, 0xf6d98a],
      [W * 0.8, baseY + 8, 0xc7b6ea],
    ];
    for (const [fx, fy, color] of flowers) {
      g.fillStyle(color, 0.7);
      g.fillCircle(fx, fy, 3.2);
      g.fillStyle(0xfff8e8, 0.85);
      g.fillCircle(fx, fy, 1.2);
    }

    this.lobbyGroup.add(g);
  }

  /** P1 — "Today's Challenge" banner: a two-level daily board (L1 teaching, L2 devil). */
  private buildDailyBanner(W: number, _H: number): void {
    const bw = W - 56;
    const bh = 86;
    const card = this.add.container(W / 2, 152);
    const bg = this.add.rectangle(0, 0, bw, bh, 0xfff3d6).setStrokeStyle(2, 0xe78b77);
    const title = this.add.text(-bw / 2 + 18, -18, this.locStr("dailyChallengeTitle", "Today's Challenge"), {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "700",
      color: "#b8432a",
    }).setOrigin(0, 0.5);
    const sub = this.add.text(-bw / 2 + 18, 12, this.locStr("dailyChallengeSub", "Level 1 easy · Level 2 devil · refreshes daily"), {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#8f5a20",
      wordWrap: { width: bw - 36 },
    }).setOrigin(0, 0.5);
    card.add([bg, title, sub]);
    this.dailyTitleTxt = title;
    this.dailySubTxt = sub;
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: card,
      enabled: () => this.canStartNewRun(),
      hoverScale: 1.018,
      pressScale: 0.97,
      onHoverIn: () => bg.setStrokeStyle(3, C.goldLight),
      onHoverOut: () => bg.setStrokeStyle(2, 0xe78b77),
      onPress: () => {
        if (!this.canStartNewRun()) return;
        this.sfx.play("start");
        this.dispatch("startGame", { mode: "daily", level: 1 });
      },
    });
    this.lobbyGroup.add(card);
  }

  private buildLobbyCard(
    cx: number, cy: number,
    w: number, h: number,
    difficulty: number,
    bgColor: number,
    borderColor: number,
  ): void {
    // Card as a container centred on (cx, cy) so hover/press scale about the
    // card's own centre and children ride along.
    const card = this.add.container(cx, cy);

    const bg = this.add.rectangle(0, 0, w, h, bgColor)
      .setStrokeStyle(2, borderColor);

    const badge = this.add.image(-w / 2 + 44, -h / 2 + 42, SHEEP_ASSETS.badges[difficulty] ?? SHEEP_ASSETS.badges[0])
      .setDisplaySize(56, 56);

    // Left column: themed board name + tile-type / clock info, left-aligned
    // beside the badge.
    const textLeft = -w / 2 + 80;
    const label = this.add.text(textLeft, -30, DIFFICULTY_LABELS[difficulty]!, {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "700",
      color: "#2f281d",
    }).setOrigin(0, 0.5);

    const cardTypes = difficulty === 0 ? 8 : difficulty === 1 ? 12 : 15;
    const infoText  = `${cardTypes} tile types · ${DIFFICULTY_TIMER[difficulty]}`;
    const infoLabel = this.add.text(textLeft, -6, infoText, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a6544",
    }).setOrigin(0, 0.5);

    // Right column: reward + entry, right-aligned so the card reads as a
    // balanced two-column route card instead of a left-heavy block.
    const textRight = w / 2 - 16;
    const rewardLabel = this.add.text(textRight, -30, DIFFICULTY_REWARD[difficulty]!, {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "700",
      color: "#217d4d",
    }).setOrigin(1, 0.5);

    const entryLabel = this.add.text(textRight, -6, DIFFICULTY_ENTRY[difficulty]!, {
      fontFamily: FONT,
      fontSize: "11.5px",
      color: "#8f6a20",
    }).setOrigin(1, 0.5);

    // Preview real tile assets along the bottom row. Each preview tile sits on
    // a crisp white chip with a soft shadow so it reads as a distinct tile
    // rather than a faint cream-on-cream glyph.
    const tileCount = Math.min(cardTypes, 8);
    const tileStep = 32;
    const tileStartX = -(tileCount / 2 - 0.5) * tileStep;
    const previewY = h / 2 - 27;
    const previewLabels: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < tileCount; i++) {
      const px = tileStartX + i * tileStep;
      const shadow = this.add.image(px, previewY + 3, "sheep-fx-cardshadow")
        .setDisplaySize(32, 33)
        .setAlpha(0.2);
      const chip = this.add.image(px, previewY, "sheep-fx-panel")
        .setDisplaySize(31, 31)
        .setTint(0xffffff);
      const tile = this.add.image(px, previewY, this.tileAssetKey(i))
        .setDisplaySize(33, 33);
      previewLabels.push(shadow, chip, tile);
    }

    card.add([bg, badge, label, infoLabel, entryLabel, rewardLabel, ...previewLabels]);

    // Store refs so applyLocale can retranslate this card.
    this.cardNameTxts[difficulty]   = label;
    this.cardInfoTxts[difficulty]   = infoLabel;
    this.cardEntryTxts[difficulty]  = entryLabel;
    this.cardRewardTxts[difficulty] = rewardLabel;

    // Reduced-motion-aware hover/press via the framework helper; the whole card
    // scales, and hover repaints the border.
    bg.setInteractive({ useHandCursor: true });
    this.bindGameButton(bg, {
      targets: card,
      enabled: () => this.canStartNewRun(),
      hoverScale: 1.015,
      pressScale: 0.97,
      onHoverIn: () => bg.setStrokeStyle(3, C.goldLight),
      onHoverOut: () => bg.setStrokeStyle(2, borderColor),
      onPress: () => {
        if (!this.canStartNewRun()) return;
        this.sfx.play("start");
        this.dispatch("startGame", { difficulty });
      },
    });

    this.lobbyCards[difficulty] = card;
    this.lobbyCardBgs[difficulty] = bg;
    this.lobbyGroup.add(card);
  }

  private canStartNewRun(): boolean {
    return this.str("appMode", "guest") === "guest" || this.bool("newPaidRunsEnabled");
  }

  private updateLobbyAvailability(): void {
    const enabled = this.canStartNewRun() && !this.bool("isFinancialAction") && !this.bool("isRecovering");
    this.lobbyCards.forEach((card) => card.setAlpha(enabled ? 1 : 0.62));
    this.lobbyCardBgs.forEach((bg) => {
      if (bg.input) bg.input.enabled = enabled;
      bg.setStrokeStyle(2, enabled ? C.cardBorder : 0xc9bfae);
    });
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  private buildLoadScreen(W: number, H: number): void {
    this.loadGroup = this.add.container(0, 0);

    const bg = this.add.rectangle(W / 2, H / 2, W - 40, 140, C.panel)
      .setStrokeStyle(2, C.gold);

    const spinner = this.add.container(W / 2, H / 2 - 28);
    const spinnerArt = this.add.image(0, 0, SHEEP_ASSETS.mascot)
      .setDisplaySize(70, 70);
    spinner.add(spinnerArt);
    this.spinner = spinner;
    this.spinnerBaseY = spinner.y;

    this.loadTitleTxt = this.add.text(W / 2, H / 2 + 24, "Preparing your board…", {
      fontFamily: FONT,
      fontSize: "16px",
      color: "#2f281d",
    }).setOrigin(0.5);

    this.loadSubTxt = this.add.text(W / 2, H / 2 + 48, "Securing puzzle on-chain", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a6544",
    }).setOrigin(0.5);

    // Gentle bob — gated so prefers-reduced-motion users get a static mascot
    // (no unconditional infinite tween on a core object).
    this.startSpinnerBob();

    this.loadGroup.add([bg, spinner, this.loadTitleTxt, this.loadSubTxt]);
  }

  private startSpinnerBob(): void {
    if (this.reducedMotion || !this.spinner || this.spinnerBob) return;
    this.spinnerBob = this.tweens.add({
      targets: this.spinner,
      y: this.spinnerBaseY - 12,
      duration: 700,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopSpinnerBob(): void {
    this.spinnerBob?.stop();
    this.spinnerBob = null;
    if (this.spinner) this.spinner.y = this.spinnerBaseY;
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (enabled) this.stopSpinnerBob();
    else if (this.loadGroup?.visible) this.startSpinnerBob();
  }

  // ── Game screen scaffold ───────────────────────────────────────────────────

  private buildGameScreen(W: number, H: number): void {
    this.gameGroup = this.add.container(0, 0);

    // ── Pile container (cards rendered into it dynamically) ──────────────────
    this.pileContainer = this.add.container(0, 0);
    this.gameGroup.add(this.pileContainer);

    // ── Progress label ───────────────────────────────────────────────────────
    // Warm dark ink so it reads on the cream stage (retinted from the old
    // dark-felt pale greens).
    this.progressLabel = this.add.text(W / 2, 30, "", {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "600",
      color: "#5a4a37",
    }).setOrigin(0.5);
    this.gameGroup.add(this.progressLabel);

    // ── Tray background ──────────────────────────────────────────────────────
    const trayY = H * TRAY_Y_FRAC;
    const trayBg = this.add.image(W / 2, trayY, SHEEP_ASSETS.tray)
      .setDisplaySize(W - 12, 76);
    this.trayBg = trayBg;
    this.gameGroup.add(trayBg);

    // Tray label
    this.trayLabelTxt = this.add.text(16, trayY - 46, "Tray", {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "600",
      color: "#8f6a20",
    }).setAlpha(0.9);
    this.gameGroup.add(this.trayLabelTxt);

    // Slot outlines (7 static slots) — kept as references so the tray can warm
    // toward danger as it fills (tension escalation).
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;
    this.slotBoxes = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = slotStartX + i * slotStep;
      const slotBox = this.add.rectangle(sx, trayY, slotStep - 8, 56, 0xffffff, 8)
        .setStrokeStyle(1, 0xd8bd81, 0.35)
        .setAlpha(0.18);
      this.slotBoxes.push(slotBox);
      this.gameGroup.add(slotBox);
    }

    // ── Tray card container (filled dynamically) ─────────────────────────────
    this.trayContainer = this.add.container(0, 0);
    this.gameGroup.add(this.trayContainer);

    // ── Tools row ────────────────────────────────────────────────────────────
    const toolY = H * TOOLS_Y_FRAC;
    this.toolsContainer = this.add.container(0, 0);
    this.gameGroup.add(this.toolsContainer);
    this.buildToolButtons(W, toolY);

    // ── Status label ─────────────────────────────────────────────────────────
    this.statusLabel = this.add.text(W / 2, H * STATUS_Y_FRAC, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#5a4a37",
      wordWrap: { width: W - 40 },
      align: "center",
    }).setOrigin(0.5);
    this.gameGroup.add(this.statusLabel);

    // ── Matched counter ──────────────────────────────────────────────────────
    // Deep meadow green (matches the lobby reward ink) — legible on cream.
    // Centered just under the progress line so it never collides with the
    // framework mute / language buttons that overlay the canvas top corners.
    this.matchedLabel = this.add.text(W / 2, 50, "", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "700",
      color: "#217d4d",
      align: "center",
    }).setOrigin(0.5);
    this.gameGroup.add(this.matchedLabel);
  }

  // ── Tool buttons ───────────────────────────────────────────────────────────

  private buildToolButtons(W: number, toolY: number): void {
    const btnW = 96;
    const gap  = 12;
    const total = 3 * btnW + 2 * gap;
    const startX = (W - total) / 2 + btnW / 2;

    this.undoBtn    = this.makeToolBtn(startX,              toolY, "Undo",    "0", () => this.dispatch("useUndo"));
    this.shuffleBtn = this.makeToolBtn(startX + btnW + gap, toolY, "Shuffle", "1", () => this.dispatch("useShuffle"));
    this.remove3Btn = this.makeToolBtn(startX + 2*(btnW+gap), toolY, "Remove 3", "1", () => this.dispatch("useRemove3"));

    // Extract count text refs from last item in each container (index 2)
    this.undoCountTxt    = this.undoBtn.list[2]    as Phaser.GameObjects.Text;
    this.shuffleCountTxt = this.shuffleBtn.list[2] as Phaser.GameObjects.Text;
    this.remove3CountTxt = this.remove3Btn.list[2] as Phaser.GameObjects.Text;

    // Extract label text refs (index 1) so applyLocale can retranslate them.
    this.undoLabelTxt    = this.undoBtn.list[1]    as Phaser.GameObjects.Text;
    this.shuffleLabelTxt = this.shuffleBtn.list[1] as Phaser.GameObjects.Text;
    this.remove3LabelTxt = this.remove3Btn.list[1] as Phaser.GameObjects.Text;

    this.toolsContainer.add([this.undoBtn, this.shuffleBtn, this.remove3Btn]);
  }

  private makeToolBtn(
    x: number, y: number,
    label: string,
    countStr: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c  = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 96, 44, C.btnBg)
      .setStrokeStyle(2, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover",  () => bg.setStrokeStyle(2, C.goldLight));
    bg.on("pointerout",   () => bg.setStrokeStyle(2, C.btnBorder));
    bg.on("pointerdown",  () => {
      this.sfx.play("chip");
      onPress();
      this.pressFeedback(c, { scale: 0.93, duration: 60 });
    });

    const txt = this.add.text(0, -2, label, {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#365314",
    }).setOrigin(0.5);

    const countTxt = this.add.text(36, -18, countStr, {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#3f6212",
    }).setOrigin(0.5);

    c.add([bg, txt, countTxt]);
    return c;
  }

  // ── Result screen ──────────────────────────────────────────────────────────

  private buildResultScreen(W: number, H: number): void {
    this.resultGroup = this.add.container(0, 0);

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x385b2a, 0.18);
    const card    = this.add.rectangle(W / 2, H / 2, W - 60, 240, C.panel, 0.98)
      .setStrokeStyle(3, C.gold);

    // Celebration mascot — peeks over the result card and bounces on a win.
    // Hidden by default; shown/hidden per outcome in updateResultScreen.
    this.resultMascot = this.add.image(W / 2, H / 2 - 118, SHEEP_ASSETS.mascot)
      .setDisplaySize(74, 74)
      .setVisible(false);

    this.resultTitle = this.add.text(W / 2, H / 2 - 72, "", {
      fontFamily: FONT,
      fontSize: "32px",
      fontStyle: "700",
      color: "#365314",
    }).setOrigin(0.5);

    this.resultSub = this.add.text(W / 2, H / 2 - 18, "", {
      fontFamily: FONT,
      fontSize: "15px",
      color: "#5a4a37",
      align: "center",
      wordWrap: { width: W - 108 },
    }).setOrigin(0.5);

    // Action button
    this.resultActionBg = this.add.rectangle(W / 2, H / 2 + 52, 180, 46, C.green)
      .setStrokeStyle(2, 0x20d060)
      .setOrigin(0.5);
    this.resultActionBg.setInteractive({ useHandCursor: true });
    this.resultActionBg.on("pointerdown", () => this.triggerResultAction());

    this.resultActionTxt = this.add.text(W / 2, H / 2 + 52, "Play Again", {
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "700",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.resultGroup.add([overlay, card, this.resultMascot, this.resultTitle, this.resultSub, this.resultActionBg, this.resultActionTxt]);
  }

  /** Victory shower — falling meadow-colored confetti (reduced-motion gated). */
  private emitConfetti(): void {
    if (this.reducedMotion) return;
    const key = "sheep-fx-confetti";
    if (!this.textures.exists(key)) return;
    const tints = [0xffd54a, 0x84cc16, 0xff8a4c, 0x16c784, 0xff6f7d, 0xf0c866];
    for (let i = 0; i < 26; i++) {
      const x = DESIGN_W / 2 + (Math.random() * 250 - 125);
      const startY = DESIGN_H / 2 - 150;
      const conf = this.add.image(x, startY, key)
        .setTint(tints[i % tints.length]!)
        .setDepth(210)
        .setScale(0.7 + Math.random() * 0.7)
        .setAngle(Math.random() * 360);
      const fall = 210 + Math.random() * 190;
      this.tween({
        targets: conf,
        y: startY + fall,
        x: x + (Math.random() * 64 - 32),
        angle: conf.angle + (Math.random() * 360 - 180),
        alpha: 0,
        duration: 900 + Math.random() * 700,
        delay: Math.random() * 260,
        ease: "Quad.easeIn",
        onComplete: () => conf.destroy(),
      });
    }
  }

  /** Play the celebratory mascot bounce (or reveal statically). */
  private playResultMascot(win: boolean): void {
    const mascot = this.resultMascot;
    if (!mascot) return;
    if (!win) {
      mascot.setVisible(false);
      return;
    }
    const baseY = DESIGN_H / 2 - 118;
    mascot.setVisible(true).setY(baseY);
    this.tweens.killTweensOf(mascot);
    if (this.reducedMotion) return;
    this.tweens.add({
      targets: mascot,
      y: baseY - 15,
      duration: 440,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });
  }

  // ── Update methods (called from onStateUpdate) ─────────────────────────────

  private updateGameScreen(): void {
    const pileCards  = (this.val<CardView[]>("pileCards")  ?? []).filter((c) => !c.picked);
    const slotCards  = (this.val<CardView[]>("slotCards")  ?? []);
    const isMatching = this.bool("isMatching");

    const currentPileLen = pileCards.length;
    const currentSlotLen = slotCards.length;
    const initialDeal = this.prevPileLen === 0 && currentPileLen > 0;
    const pileKey = pileCards
      .map((card) => `${card.id}:${card.symbol}:${card.layer}:${card.col ?? ""}:${card.row ?? ""}:${card.exposed ? 1 : 0}`)
      .join("|");
    const trayKey = slotCards
      .map((card) => `${card.id}:${card.symbol}`)
      .join("|");

    // ── Detect match-3 elimination: slot count dropped by 3 ─────────────────
    if (isMatching && !this.prevMatching) {
      this.animateMatchClear();
    }

    // Match-3 dopamine hit — isMatching only rises when the TEE confirms a triple.
    if (isMatching && !this.prevMatching) this.sfx.play("merge");
    this.prevMatching = isMatching;

    // Soft warning the moment the 6th tray slot fills.
    if (currentSlotLen >= SLOT_COUNT - 1 && this.prevSlotLen < SLOT_COUNT - 1) {
      this.sfx.play("error");
    }

    if (pileKey !== this.renderedPileKey) {
      this.rebuildPile(pileCards, initialDeal);
      this.renderedPileKey = pileKey;
    }
    if (trayKey !== this.renderedTrayKey) {
      // Pop the freshly landed tile when the tray grows (settle cue).
      const settleIndex = currentSlotLen > this.prevSlotLen ? currentSlotLen - 1 : -1;
      this.rebuildTray(slotCards, settleIndex);
      this.renderedTrayKey = trayKey;
    }
    // Escalate slot tension as the tray fills toward the 7-slot ceiling.
    this.updateTrayTension(currentSlotLen);
    this.updateTools();
    this.updateProgress(pileCards, slotCards);
    this.prevPileLen = currentPileLen;
    this.prevSlotLen = currentSlotLen;
  }

  /** Warm the tray slots and shake the tray as it approaches the 7-slot loss. */
  private updateTrayTension(count: number): void {
    const danger = count >= SLOT_COUNT - 1; // 6 or 7 filled
    const warn   = count >= SLOT_COUNT - 2; // 5+ filled
    this.slotBoxes.forEach((box, i) => {
      const filled = i < count;
      if (!filled && danger) {
        // The last empty slot(s) glow hot — the shrinking runway is the read.
        box.setStrokeStyle(2.6, C.slotDanger, 0.95).setFillStyle(0xffdccf, 0.6).setAlpha(0.62);
      } else if (!filled && warn) {
        box.setStrokeStyle(2.2, C.slotWarn, 0.85).setFillStyle(0xffe9c8, 0.5).setAlpha(0.5);
      } else if (filled && danger) {
        box.setStrokeStyle(1.6, C.slotDanger, 0.5).setFillStyle(0xffffff, 0.08).setAlpha(0.28);
      } else if (filled && warn) {
        box.setStrokeStyle(1.6, C.slotWarn, 0.45).setFillStyle(0xffffff, 0.08).setAlpha(0.24);
      } else {
        box.setStrokeStyle(1, 0xd8bd81, 0.35).setFillStyle(0xffffff, 0.08).setAlpha(0.18);
      }
    });
    this.trayBg?.setTint(danger ? 0xff9e86 : warn ? 0xffe0b0 : 0xffffff);
    // A subtle shake the moment the tray crosses into the danger zone.
    if (danger && count > this.prevSlotLen) this.shakeTray();
  }

  private shakeTray(): void {
    if (this.reducedMotion || this.trayShaking) return;
    const targets = [this.trayBg, this.trayContainer, this.trayLabelTxt, ...this.slotBoxes]
      .filter(Boolean) as Phaser.GameObjects.GameObject[];
    if (targets.length === 0) return;
    this.trayShaking = true;
    this.tweens.add({
      targets,
      x: "+=4",
      duration: 44,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
      onComplete: () => { this.trayShaking = false; },
    });
  }

  private rebuildPile(pileCards: CardView[], animateDeal = false): void {
    // Clear existing pile sprites
    this.pileContainer.removeAll(true);

    if (pileCards.length === 0) return;

    const W = DESIGN_W;
    // Sort: render layer 2 first (back), then 1, then 0 (front)
    const byLayer: CardView[][] = [[], [], []];
    for (const card of pileCards) {
      const l = Math.min(2, Math.max(0, card.layer));
      byLayer[l]!.push(card);
    }

    const cx = W / 2;
    // pile base y — cards stack upward from here
    const pileBaseY = DESIGN_H * TRAY_Y_FRAC - 46;

    // Render order: layer 2 → 1 → 0
    for (let layerIdx = 2; layerIdx >= 0; layerIdx--) {
      const layerCards = byLayer[layerIdx] ?? [];
      if (layerCards.length === 0) continue;

      const numCols = layerIdx === 0 ? 4 : layerIdx === 1 ? 5 : 6;
      const numRows = layerIdx === 0 ? 3 : layerIdx === 1 ? 4 : 5;

      // Each layer is shifted slightly up and right for 3-D stacking
      const layerXShift = (2 - layerIdx) * 3;
      const layerYShift = (2 - layerIdx) * 16;

      const gridW = numCols * CARD_STEP_X;
      const gridLeft = cx - gridW / 2 + CARD_STEP_X / 2;

      layerCards.forEach((card, idx) => {
        const col = card.col ?? idx % numCols;
        const row = card.row ?? Math.floor(idx / numCols);

        // Cards in bottom row have larger y (lower on screen)
        const rowFromBottom = numRows - 1 - row;
        const x = gridLeft + col * CARD_STEP_X + layerXShift;
        const y = pileBaseY - rowFromBottom * (CARD_STEP_Y * 0.72) - layerYShift;

        const sprite = this.makeCardSprite(card);
        sprite.setPosition(x, y);
        this.pileContainer.add(sprite);
        if (animateDeal) {
          sprite.setAlpha(0).setScale(0.72).setY(y - 18);
          this.tween({
            targets: sprite,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            y,
            duration: 220,
            delay: Math.min(360, idx * 14 + (2 - layerIdx) * 55),
            ease: "Back.easeOut",
          });
        }
      });
    }
  }

  private makeCardSprite(card: CardView): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const isExposed = card.exposed;

    // Drop shadow — lifts the card off the cream stage. Exposed (tappable)
    // cards cast a deeper shadow so the top layer visibly rises above the
    // dimmed cards it covers.
    const shadow = this.add.image(1.5, 6, "sheep-fx-cardshadow")
      .setDisplaySize(CARD_W + 14, CARD_H + 10)
      .setAlpha(isExposed ? 0.36 : 0.2);
    c.add(shadow);

    const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
      .setDisplaySize(TILE_ART_SIZE, TILE_ART_SIZE);

    if (isExposed) {
      // Hover halo — sits behind the tile and breathes on pointer-over.
      const glow = this.add.image(0, 0, "sheep-fx-glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd98a)
        .setScale(0.95)
        .setAlpha(0);
      c.add([glow, tile]);

      tile.setInteractive({ useHandCursor: true });
      if (tile.input) {
        tile.input.enabled = !this.bool("isTeeBusy") &&
          !this.bool("isFinancialAction") &&
          !this.bool("deadlineExpired");
      }

      tile.on("pointerover", () => {
        this.animate({ targets: c, scaleX: 1.08, scaleY: 1.08, duration: 90, ease: "Back.easeOut" });
        this.tweens.killTweensOf(glow);
        if (!this.reducedMotion) {
          this.tween({ targets: glow, alpha: 0.55, duration: 220, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        } else {
          glow.setAlpha(0.34);
        }
      });
      tile.on("pointerout", () => {
        this.animate({ targets: c, scaleX: 1, scaleY: 1, duration: 90 });
        this.tweens.killTweensOf(glow);
        this.tween({ targets: glow, alpha: 0, duration: 120 });
      });
      tile.on("pointerdown", () => {
        if (this.ghostInFlight) return;
        this.handleCardClick(card, c);
      });
    } else {
      // Covered tiles stay fully opaque (so they never vanish into the cream
      // background) but are muted and sink under a warm occlusion veil — the
      // "which tiles are locked underneath" read at the heart of 羊了个羊. They
      // are non-interactive.
      tile.setTint(C.occludedInk);
      const veil = this.add.image(0, 0, "sheep-fx-panel")
        .setDisplaySize(TILE_ART_SIZE - 2, TILE_ART_SIZE - 2)
        .setTint(C.occlusion)
        .setAlpha(0.32);
      c.add([tile, veil]);
    }

    return c;
  }

  private handleCardClick(card: CardView, sprite: Phaser.GameObjects.Container): void {
    const slotCards = (this.val<CardView[]>("slotCards") ?? []);
    if (
      slotCards.length >= SLOT_COUNT ||
      this.bool("isTeeBusy") ||
      this.bool("isFinancialAction") ||
      this.bool("deadlineExpired")
    ) return;

    this.sfx.play("tap");

    // Calculate target slot position
    const W = DESIGN_W;
    const H = DESIGN_H;
    const trayY   = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;
    const targetX = slotStartX + slotCards.length * slotStep;
    const targetY = trayY;
    const slotScaleX = (slotStep - 6) / CARD_W;
    const slotScaleY = 58 / CARD_H;

    // Reduced motion: no flight — hand the pick to the engine immediately and
    // restore the source if the authoritative engine rejects a stale pick.
    if (this.reducedMotion) {
      this.sfx.play("select");
      this.dispatch("pickCard", { cardId: card.id });
      if (sprite.active) sprite.setAlpha(1);
      return;
    }

    // Source tile lifts (scale pop) as it is plucked from the pile.
    this.tweens.add({
      targets: sprite,
      scaleX: 1.16, scaleY: 1.16,
      duration: 90, yoyo: true, ease: "Sine.easeOut",
    });
    this.animate({ targets: sprite, alpha: 0.28, duration: 140 });

    // Ghost flies from the pile to its tray slot along a smooth arc, shrinking
    // to slot size and settling with a soft land squash.
    const worldPos = this.pileContainer.getWorldTransformMatrix().transformPoint(
      sprite.x, sprite.y,
    );
    const startX = worldPos.x, startY = worldPos.y;
    const ghost = this.makeCardSprite({ ...card, exposed: true });
    ghost.setPosition(startX, startY);
    this.add.existing(ghost);
    ghost.setDepth(100);
    this.ghostInFlight = true;

    const dx = targetX - startX;
    const dir = dx >= 0 ? 1 : -1;
    const apexLift = 44 + Math.random() * 12;
    this.tweens.addCounter({
      from: 0, to: 1,
      duration: 300,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const x = startX + dx * t;
        // Parabolic arc: rises off the pile, then drops cleanly into the slot.
        const y = startY + (targetY - startY) * t - apexLift * Math.sin(Math.PI * t);
        ghost.setPosition(x, y);
        ghost.setScale(1 + (slotScaleX - 1) * t, 1 + (slotScaleY - 1) * t);
        ghost.setAngle(dir * 7 * Math.sin(Math.PI * t));
      },
      onComplete: () => {
        ghost.setAngle(0);
        // Land squash → settle into the slot.
        this.tweens.add({
          targets: ghost,
          scaleX: slotScaleX * 1.14, scaleY: slotScaleY * 0.84,
          duration: 72, yoyo: true, ease: "Quad.easeOut",
          onComplete: () => {
            ghost.destroy();
            this.ghostInFlight = false;
            this.sfx.play("select");
            this.dispatch("pickCard", { cardId: card.id });
            // If the authoritative engine rejects a stale/covered pick, restore
            // the source tile instead of leaving a permanently faded false cue.
            if (sprite.active) {
              this.tween({ targets: sprite, alpha: 1, duration: 100, ease: "Quad.easeOut" });
            }
          },
        });
      },
    });
  }

  private rebuildTray(slotCards: CardView[], settleIndex = -1): void {
    this.trayContainer.removeAll(true);

    const W = DESIGN_W;
    const H = DESIGN_H;
    const trayY    = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;

    const slotW = slotStep - 6;

    slotCards.forEach((card, idx) => {
      if (idx >= SLOT_COUNT) return;
      const x = slotStartX + idx * slotStep;
      const c = this.add.container(x, trayY);

      const bg = this.add.ellipse(0, 25, slotW * 0.78, 8, 0x000000, 0.1);
      const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
        .setDisplaySize(48, 48);

      c.add([bg, tile]);
      this.trayContainer.add(c);

      // Settle bounce on the tile that just landed from the pile.
      if (idx === settleIndex && !this.reducedMotion) {
        c.setScale(0.55);
        this.tweens.add({
          targets: c,
          scaleX: 1, scaleY: 1,
          duration: 260,
          ease: "Back.easeOut",
        });
      }
    });
  }

  /** Juice on a match-3 clear: gold pop + star burst + micro shake + combo text. */
  private animateMatchClear(): void {
    const H = DESIGN_H;
    const W = DESIGN_W;
    const trayY    = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;

    const now = this.time.now;
    this.matchStreak = now - this.lastMatchAt < 2600 ? this.matchStreak + 1 : 1;
    this.lastMatchAt = now;

    // A quick green sweep across the tray confirms the triple cleared.
    if (!this.reducedMotion) {
      const flash = this.add.image(W / 2, trayY, "sheep-fx-panel")
        .setDisplaySize(W - 20, 62)
        .setTint(0x2fd08a)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(118)
        .setAlpha(0);
      this.tween({
        targets: flash,
        alpha: 0.28,
        yoyo: true,
        duration: 190,
        ease: "Quad.easeOut",
        onComplete: () => flash.destroy(),
      });
    }

    for (let i = 0; i < 3; i++) {
      const px = slotStartX + i * slotStep;
      const pop = this.add.graphics();
      pop.fillStyle(0xffd700, 0.9);
      pop.fillCircle(px, trayY, 10);
      pop.fillStyle(0xfff8e8, 0.8);
      pop.fillCircle(px, trayY, 4);
      this.tween({
        targets: pop,
        y: trayY - 40,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 500,
        ease: "Quad.easeOut",
        onComplete: () => pop.destroy(),
      });
      this.burstReveal(px, trayY, 0xffd98a);
      this.emitSparkles(px, trayY, 8, 0xffe9a8, 44);
    }

    // Escalating audio on a combo streak — the second cue stacks a brighter
    // arpeggio over the base merge chime played by updateGameScreen.
    if (this.matchStreak >= 2) this.sfx.play("combo");

    if (!this.reducedMotion) this.cameras.main.shake(140, 0.004);
    this.showMatchText(trayY, this.matchStreak);
  }

  /** Rising "Cleared!" / "Combo xN!" label on a match. */
  private showMatchText(trayY: number, streak: number): void {
    if (this.reducedMotion) return;
    const big = streak >= 2;
    const label = big
      ? this.locStr("matchCombo", "Combo x{n}!").replace("{n}", String(streak))
      : this.locStr("matchCleared", "Cleared!");
    const txt = this.add.text(DESIGN_W / 2, trayY - 30, label, {
      fontFamily: FONT,
      fontSize: big ? "20px" : "16px",
      fontStyle: "800",
      color: big ? "#ffcf4d" : "#f0c866",
    }).setOrigin(0.5).setDepth(130).setStroke("#7a4a12", 4);
    this.tween({
      targets: txt,
      y: trayY - 74,
      alpha: 0,
      scaleX: big ? 1.25 : 1.1,
      scaleY: big ? 1.25 : 1.1,
      duration: 720,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  private updateTools(): void {
    const undosUsed   = this.num("undosUsed", 0);
    const shuffleLeft = this.num("shuffleLeft", 1);
    const remove3Left = this.num("remove3Left", 1);
    const status      = this.str("gameStatus", "idle");
    const slotCount   = (this.val<CardView[]>("slotCards") ?? []).length;
    const isActive    = status === "dealt" &&
      !this.bool("isTeeBusy") &&
      !this.bool("isFinancialAction") &&
      !this.bool("deadlineExpired");

    const undoAvail    = isActive && slotCount > 0 && undosUsed < 3;
    const shuffleAvail = isActive && slotCount > 0 && shuffleLeft > 0;
    const remove3Avail = isActive && slotCount >= 3 && remove3Left > 0;

    this.setToolBtnActive(this.undoBtn,    undoAvail);
    this.setToolBtnActive(this.shuffleBtn, shuffleAvail);
    this.setToolBtnActive(this.remove3Btn, remove3Avail);

    // Update count labels
    const undosLeft = Math.max(0, 3 - undosUsed);
    this.undoCountTxt.setText(String(undosLeft)).setColor(undoAvail ? "#3f6212" : "#81796c");
    this.shuffleCountTxt.setText(String(shuffleLeft)).setColor(shuffleAvail ? "#3f6212" : "#81796c");
    this.remove3CountTxt.setText(String(remove3Left)).setColor(remove3Avail ? "#3f6212" : "#81796c");
  }

  private setToolBtnActive(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = btn.list[0] as Phaser.GameObjects.Rectangle;
    const txt = btn.list[1] as Phaser.GameObjects.Text;
    bg.setFillStyle(active ? C.btnBg : C.btnDisabled);
    bg.setStrokeStyle(2, active ? C.btnBorder : 0x555544);
    txt.setColor(active ? "#365314" : "#81796c");
    (bg as Phaser.GameObjects.Rectangle & { input: { enabled: boolean } }).input.enabled = active;
  }

  private updateProgress(pileCards: CardView[], slotCards: CardView[]): void {
    const difficulty  = this.num("gameDifficulty", 0);
    const cardTypes   = difficulty === 2 ? 15 : difficulty === 1 ? 12 : 8;
    const totalCards  = cardTypes * 3;
    const remaining   = pileCards.length + slotCards.length;
    const matched     = totalCards - remaining;
    const deadline    = this.num("deadline", 0);
    const clock       = deadline > 0 ? this.formatTimeLeft(deadline) : "--";

    const lvl = this.num("level", 1);
    const isDaily = this.str("playMode", "practice") === "daily";
    const levelTag = isDaily ? (lvl === 1 ? "L1 · " : "L2 · ") : "";
    this.progressLabel.setText(
      levelTag +
      this.locStr("progress", "Time {clock}  ·  Pile {pile}  ·  Tray {tray}/{cap}")
        .replace("{clock}", clock)
        .replace("{pile}", String(pileCards.length))
        .replace("{tray}", String(slotCards.length))
        .replace("{cap}", String(SLOT_COUNT)),
    );
    this.matchedLabel.setText(
      this.locStr("matched", "Matched {matched}/{total}")
        .replace("{matched}", String(matched))
        .replace("{total}", String(totalCards)),
    );
  }

  private updateResultScreen(): void {
    const status  = this.str("gameStatus", "idle");
    const payout  = this.str("lastPayout", "");
    const isGameOver = this.bool("isGameOver");
    const timedOut = this.bool("deadlineExpired") || this.str("failureReason", "none") === "timeout";
    const isGuest = this.str("appMode", "guest") === "guest";
    const canExpire = this.bool("canExpire");
    const activeGameId = this.str("activeGameId", "0");
    const credit = this.num("credit", 0);
    const canSettle = status === "solved" && activeGameId !== "0";

    // P1 — daily two-level structure
    const playMode = this.str("playMode", "practice");
    const lvl = this.num("level", 1);
    const revives = this.num("revivesLeft", 0);
    const isDaily = playMode === "daily";

    let title = "";
    let titleColor = "#365314";
    let sub = "";
    let actionTxt = "";
    let actionColor = "#ffffff";
    let actionBg: number = C.green;
    let active = true;

    if (status === "solved" && isDaily && lvl === 1) {
      title = this.locStr("level1ClearedTitle", "Level 1 cleared!");
      titleColor = "#f0c866";
      sub = this.locStr("level1ClearedSub", "On to the devil level — ready?");
      actionTxt = this.locStr("enterLevel2", "Enter Level 2");
      actionBg = C.green; actionColor = "#ffffff";
      active = !this.bool("isFinancialAction");
    } else if (status === "solved" && isDaily && lvl === 2) {
      title = this.locStr("dailyFullyClearedTitle", "Daily clear!");
      titleColor = "#f0c866";
      sub = this.locStr("dailyFullyClearedAny", "Fully cleared today — share your win!");
      actionTxt = this.locStr("backToRoutesAction", "Back to Routes");
      actionBg = C.green; actionColor = "#ffffff";
      active = !this.bool("isFinancialAction");
    } else if (status === "solved") {
      title = canSettle ? this.locStr("wonTitle", "You Won") : this.locStr("creditedTitle", "Reward Credited");
      titleColor = "#f0c866";
      const payoutSub = this.locStr("payoutSub", "Payout: {payout}").replace("{payout}", payout);
      const creditSub = this.locStr("creditReadySub", "{amount} GAS is ready to withdraw").replace("{amount}", credit.toFixed(2));
      sub = canSettle
        ? (payout ? payoutSub : this.locStr("boardClearedSub", "Board cleared!"))
        : credit > 0 ? creditSub : this.locStr("boardVerifiedSub", "Board verified on-chain");
      actionTxt = canSettle
        ? this.locStr("claim", "Claim Reward")
        : credit > 0 ? this.locStr("withdraw", "Withdraw")
        : this.locStr("backToRoutes", "Back to Routes");
      actionBg = C.green; actionColor = "#ffffff";
      active = !this.bool("isFinancialAction");
    } else if ((isGameOver || timedOut) && isDaily && lvl === 2 && revives > 0) {
      title = this.locStr("gameOverTitle", "Game Over");
      titleColor = "#b83f32";
      sub = this.locStr("reviveSub", "Tray full — use your revive to keep going?");
      actionTxt = this.locStr("reviveAction", "Revive ({left} left)").replace("{left}", String(revives));
      actionBg = C.green; actionColor = "#ffffff";
      active = !this.bool("isFinancialAction");
    } else if ((isGameOver || timedOut) && isDaily && lvl === 2) {
      title = this.locStr("gameOverTitle", "Game Over");
      titleColor = "#b83f32";
      sub = this.locStr("retryLevel2Sub", "Out of revives — retry the devil level?");
      actionTxt = this.locStr("retryLevel2", "Retry Level 2");
      actionBg = C.btnBg; actionColor = "#365314";
      active = !this.bool("isFinancialAction");
    } else if (isGameOver || timedOut) {
      title = timedOut ? this.locStr("timeUpTitle", "Time is up") : this.locStr("gameOverTitle", "Game Over");
      titleColor = timedOut ? "#8a5a16" : "#b83f32";
      sub = timedOut
        ? this.locStr("timeUpSub", "The board is locked until it can be released.")
        : this.locStr("trayFullSub", "Tray is full — no more moves!");
      const enabled = isGuest || canExpire;
      actionTxt = isGuest
        ? this.locStr("tryAgain", "Try Again")
        : canExpire ? this.locStr("releaseReady", "Release game")
        : this.locStr("releaseWait", "Release later");
      actionBg = enabled ? C.btnBg : C.btnDisabled;
      actionColor = enabled ? "#365314" : "#746756";
      active = enabled && !this.bool("isFinancialAction");
    }

    this.resultTitle.setText(title).setColor(titleColor);
    this.resultSub.setText(sub);
    this.resultActionTxt.setText(actionTxt).setColor(actionColor);
    this.resultActionBg.setFillStyle(actionBg);
    this.setResultButtonActive(active);

    const animationKey = `${status}:${isGameOver ? "gameover" : "ok"}:${activeGameId}:${credit > 0 ? "credit" : "no-credit"}:${lvl}:${revives}`;
    if (this.resultAnimationKey !== animationKey) {
      this.resultAnimationKey = animationKey;
      this.resultGroup.setAlpha(0).setScale(0.85);
      // Reduced-motion-aware pop (snaps to the end state when motion is off).
      this.tween({
        targets: this.resultGroup,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 280,
        ease: "Back.easeOut",
      });
      // Win/lose ceremony — mascot bounce + confetti shower + sparkle bloom on
      // victory; soft red pulse + shake with the mascot hidden on loss.
      if (status === "solved") {
        this.playResultMascot(true);
        this.emitConfetti();
        this.emitSparkles(DESIGN_W / 2, DESIGN_H / 2 - 30, 18, 0xffd98a, 120);
        this.burstReveal(DESIGN_W / 2, DESIGN_H / 2 - 30, 0xffd98a);
      } else if (isGameOver || timedOut) {
        this.playResultMascot(false);
        if (!this.reducedMotion) {
          this.cameras.main.shake(180, 0.004);
          const flash = this.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0xb83f32, 0)
            .setDepth(200);
          this.tween({ targets: flash, alpha: 0.18, yoyo: true, duration: 160, onComplete: () => flash.destroy() });
        }
      } else {
        this.playResultMascot(false);
      }
    }
  }

  private setResultButtonActive(active: boolean): void {
    if (this.resultActionBg.input) this.resultActionBg.input.enabled = active;
    this.resultActionBg.setAlpha(active ? 1 : 0.82);
  }

  private triggerResultAction(): void {
    if (!this.resultActionBg.input?.enabled || this.bool("isFinancialAction")) return;
    const status = this.str("gameStatus", "idle");
    const activeGameId = this.str("activeGameId", "0");
    const credit = this.num("credit", 0);
    const playMode = this.str("playMode", "practice");
    const lvl = this.num("level", 1);
    const revives = this.num("revivesLeft", 0);
    const isDaily = playMode === "daily";

    // P1 — daily two-level routing
    if (isDaily && status === "solved" && lvl === 1) {
      this.dispatch("advanceLevel");
      return;
    }
    if (isDaily && status === "solved" && lvl === 2) {
      this.dispatch("submitRun");
      return;
    }
    if (isDaily && (this.bool("isGameOver") || this.bool("deadlineExpired")) && lvl === 2) {
      if (revives > 0) this.dispatch("revive");
      else this.dispatch("startGame", { mode: "daily", level: 2 });
      return;
    }

    if (status === "solved" && activeGameId !== "0") {
      this.dispatch("submitRun");
    } else if (status === "solved" && credit > 0 && this.str("appMode", "guest") !== "guest") {
      this.dispatch("withdrawWinnings", {});
    } else if (status === "solved") {
      this.dispatch("returnToLobby");
    } else {
      this.dispatch("expireGame");
    }
  }

  private bindKeyboardControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard || this.keyboardHandler) return;
    this.keyboardHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.isContentEditable ||
        ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "")
      ) return;

      const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      const status = this.str("gameStatus", "idle");
      if ((status === "idle" || status === "expired" || status === "refunded") && digitMatch) {
        const difficulty = Number(digitMatch[1]) - 1;
        if (difficulty >= 0 && difficulty <= 2 && this.canStartNewRun()) {
          this.dispatch("startGame", { difficulty });
          event.preventDefault();
        }
        return;
      }

      if (status === "unknown" && event.code === "Enter") {
        this.dispatch("recoverGame");
        event.preventDefault();
        return;
      }

      if ((status === "solved" || this.bool("isGameOver") || this.bool("deadlineExpired")) && event.code === "Enter") {
        this.triggerResultAction();
        event.preventDefault();
        return;
      }

      if (
        status !== "dealt" ||
        this.bool("isGameOver") ||
        this.bool("deadlineExpired") ||
        this.bool("isTeeBusy") ||
        this.bool("isFinancialAction")
      ) return;

      if (digitMatch) {
        const exposed = (this.val<CardView[]>("pileCards") ?? [])
          .filter((card) => card.exposed && !card.picked)
          .slice(0, 9);
        const card = exposed[Number(digitMatch[1]) - 1];
        if (card) {
          this.dispatch("pickCard", { cardId: card.id });
          event.preventDefault();
        }
        return;
      }

      const action = event.code === "KeyU"
        ? "useUndo"
        : event.code === "KeyS"
        ? "useShuffle"
        : event.code === "KeyR"
        ? "useRemove3"
        : "";
      if (action) {
        this.dispatch(action);
        event.preventDefault();
      }
    };
    keyboard.on("keydown", this.keyboardHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.unbindKeyboardControls, this);
  }

  private unbindKeyboardControls(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off("keydown", this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.unbindKeyboardControls, this);
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private setGroupActive(group: Phaser.GameObjects.Container, active: boolean): void {
    this.setObjectActive(group, active);
  }

  private setObjectActive(target: Phaser.GameObjects.GameObject, active: boolean): void {
    (target as Phaser.GameObjects.GameObject & { setVisible(visible: boolean): Phaser.GameObjects.GameObject })
      .setVisible(active);
    const interactiveTarget = target as Phaser.GameObjects.GameObject & {
      input?: { enabled: boolean } | null;
    };
    if (interactiveTarget.input) {
      interactiveTarget.input.enabled = active;
    }
    if (target instanceof Phaser.GameObjects.Container) {
      target.list.forEach((child) => this.setObjectActive(child as Phaser.GameObjects.GameObject, active));
    }
  }

  private tileAssetKey(symbolIdx: number): string {
    return SHEEP_ASSETS.tiles[Math.abs(symbolIdx) % SHEEP_ASSETS.tiles.length] ?? SHEEP_ASSETS.tiles[0];
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.34;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
  }

  private formatTimeLeft(deadline: number): string {
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}
