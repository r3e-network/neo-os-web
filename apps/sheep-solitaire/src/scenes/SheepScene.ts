/**
 * SheepScene — Phaser 3 scene for Sheep Solitaire (羊了个羊 style tile-matching).
 *
 * P2 rebuild (docs/sheep-solitaire-redesign-2026.md §9): a full-screen game —
 * saturated grass field, mahjong-style white tiles positioned by the shared
 * §9.2 half-grid unit formula, left/right buried stacks, a wooden 7-slot tray
 * docked near the bottom with three round prop buttons underneath, and a HOME
 * view (wooden-sign logo + one-tap daily challenge + practice picker overlay)
 * replacing the old web-style route-card lobby. Zero cream panels in-scene.
 *
 * State received from React (via GameBridge):
 *   gameStatus:     "idle"|"committed"|"dealt"|"solved"|"expired"
 *   pileCards:      CardView[]   cards remaining on the board (grid + stacks)
 *   slotCards:      CardView[]   cards in the 7-slot tray (0–7 elements)
 *   shuffleLeft / remove3Left / undosUsed / level / playMode / revivesLeft
 *   isStarting / isDealing / isSubmitting / isMatching / isGameOver
 *   lastStatus / lastPayout / …
 *
 * Actions dispatched:
 *   "startGame"  { mode: "daily", level } | { difficulty }
 *   "pickCard"   { cardId } — dispatched IMMEDIATELY on pointerdown; the
 *                 engine is the validator, the ghost flight is pure cosmetics.
 *   "useUndo" / "useShuffle" / "useRemove3" / "advanceLevel" / "revive"
 *   "submitRun" / "expireGame" / "returnToLobby" / "withdrawWinnings"
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { ALL_SYMBOLS } from "../logic/sheep-engine";

// Themed board names (English fallback; localized copy arrives via bridgeState.loc).
const DIFFICULTY_LABELS = ["Meadow Board", "Festival Board", "Mountain Board"] as const;
const DIFFICULTY_TILE_TYPES = [8, 12, 15] as const;
const DIFFICULTY_PREVIEW_SYMBOL = [0, 5, 12] as const;

const SHEEP_ASSETS = {
  field: "sheep-field-meadow",
  tray: "sheep-tray-wood",
  sticker: "sheep-btn-sticker",
  // Die-cut sticker reframe of the in-house painted logo character
  // (public/logo.webp) — replaces the retired circle-composite SVG sheep.
  mascot: "sheep-mascot",
  props: {
    undo: "sheep-prop-undo",
    remove: "sheep-prop-remove",
    shuffle: "sheep-prop-shuffle",
  },
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

// §9.4 v2 sticker palette — flat fills, near-black outlines, hard shadows.
const C = {
  grass:        0xb7e389,  // FLAT light lime field (bleeds past the field art)
  ink:          0x26221e,  // near-black sticker outline / hard shadow
  overlayDark:  0x26221e,  // full-screen modal dim
  // Covered-tile treatment — whole tile tinted dark GRAY-GREEN (icon dimly
  // visible), exposed tiles stay bright cream. Harsh, one-glance contrast.
  coverTint:    0x7e8f6e,  // multiply tint on the cream tile face
  coverVeil:    0x39462f,  // gray-green veil laid over the tinted face
  stackBlock:   0x97a886,  // ribbed side-stack block (gray-green)
  stackRidge:   0x6f8060,  // ridge stripes on the stack block
  wood:         0xa9743e,
  woodDark:     0x54320f,
  woodLight:    0xc89a5f,
  btnGreen:     0x58c24f,
  btnAmber:     0xf0b03c,
  gold:         0xffd23e,
  slotWarn:     0xe0a13c,
  slotDanger:   0xe0663c,
} as const;
const INK = "#26221e";

interface CardView {
  id: number;
  symbol: number;
  layer: number;
  col?: number;
  row?: number;
  /** §9.1 v2 zone — absent on legacy cards ⇒ treated as "grid". */
  zone?: "grid" | "stackL" | "stackR" | string;
  /** §9.1 v2 burial depth in a stack — absent ⇒ 0. */
  stackIndex?: number;
  exposed: boolean;
  picked: boolean;
}

interface BoardMetrics {
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
}

// ── Layout constants (mobile-first 390×844 logical design) ──────────────────
const DESIGN_W = 390;
const DESIGN_H = 844;
const TILE_RATIO = 232 / 200;     // matches the generated tile art
const TILE_W_MAX = 66;
const SLOT_COUNT = 7;
const HUD_Y = 32;
const BOARD_TOP = 100;
const BOARD_BOTTOM = 556;
const STACK_Y = 592;
const STACK_TILE_W = 44;
const TRAY_Y = 664;
const TRAY_W = 380;
const TRAY_H = 120;               // trough + fence posts (760×240 art at 2×)
const TRAY_TILE_Y = TRAY_Y - 16;  // tile row sits inside the trough interior
const TRAY_SIDE_PAD = 15;         // trough interior padding (30px on 2× art)
const PROPS_Y = 766;
const TOAST_Y = 826;
const FONT = "Inter, Arial, sans-serif";

// ── SheepScene ────────────────────────────────────────────────────────────────

export class SheepScene extends BaseScene {
  // ── View containers (only one visible at a time; practice overlays home) ───
  private homeGroup!:     Phaser.GameObjects.Container;
  private practiceGroup!: Phaser.GameObjects.Container;
  private loadGroup!:     Phaser.GameObjects.Container;
  private gameGroup!:     Phaser.GameObjects.Container;
  private resultGroup!:   Phaser.GameObjects.Container;

  // ── Background (full-screen meadow) ────────────────────────────────────────
  private sceneBackdrop!: Phaser.GameObjects.Rectangle;
  private fieldImage!:    Phaser.GameObjects.Image;
  private stageFrame!:    Phaser.GameObjects.Graphics;

  // ── Game sub-elements ──────────────────────────────────────────────────────
  private pileContainer!:  Phaser.GameObjects.Container;
  private stackContainer!: Phaser.GameObjects.Container;
  private trayContainer!:  Phaser.GameObjects.Container;
  private statusLabel!:    Phaser.GameObjects.Text;
  private hudPillG!:       Phaser.GameObjects.Graphics;
  private hudLevelTxt!:    Phaser.GameObjects.Text;
  private hudRemainTxt!:   Phaser.GameObjects.Text;
  private trayBg?:         Phaser.GameObjects.Image;
  private slotBoxes:       Phaser.GameObjects.Rectangle[] = [];
  private trayShaking = false;

  // Prop buttons (undo / remove-3 / shuffle) — round icon buttons under the tray.
  private undoBtn!:    Phaser.GameObjects.Container;
  private remove3Btn!: Phaser.GameObjects.Container;
  private shuffleBtn!: Phaser.GameObjects.Container;
  private propCountTxts: Record<"undo" | "remove" | "shuffle", Phaser.GameObjects.Text | null> = {
    undo: null,
    remove: null,
    shuffle: null,
  };
  private propLabelTxts: Record<"undo" | "remove" | "shuffle", Phaser.GameObjects.Text | null> = {
    undo: null,
    remove: null,
    shuffle: null,
  };

  // ── Home view elements ─────────────────────────────────────────────────────
  private homeLogoTxts: Phaser.GameObjects.Text[] = [];
  private homeSubTxt?:   Phaser.GameObjects.Text;
  private homeDailyTxt?: Phaser.GameObjects.Text;
  private homeStartTxt?: Phaser.GameObjects.Text;
  private homePracticeTxt?: Phaser.GameObjects.Text;
  private homeStartBtn?: Phaser.GameObjects.Container;
  private homeStartHit?: Phaser.GameObjects.Rectangle;
  private practiceTitleTxt?: Phaser.GameObjects.Text;
  private practiceBackTxt?:  Phaser.GameObjects.Text;
  private practiceNameTxts: Phaser.GameObjects.Text[] = [];
  private practiceInfoTxts: Phaser.GameObjects.Text[] = [];
  private practiceOpen = false;

  // ── Load + result elements ─────────────────────────────────────────────────
  private loadTitleTxt?: Phaser.GameObjects.Text;
  private loadSubTxt?:   Phaser.GameObjects.Text;
  private spinner?:      Phaser.GameObjects.Container;
  private spinnerBaseY = 0;
  private spinnerBob: Phaser.Tweens.Tween | null = null;
  private resultTitleTxts: Phaser.GameObjects.Text[] = [];
  private resultSub!:      Phaser.GameObjects.Text;
  private resultActionBg!: Phaser.GameObjects.Rectangle;
  private resultActionFill!: Phaser.GameObjects.Graphics;
  private resultActionTxt!: Phaser.GameObjects.Text;
  private resultMascot?:   Phaser.GameObjects.Image;

  // ── State mirrors ──────────────────────────────────────────────────────────
  private prevSlotLen = 0;
  private prevPileLen = 0;
  private currentStatus = "idle";
  private resultAnimationKey = "";
  private prevMatching = false;
  private lastResultCue = "";
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private renderedPileKey: string | null = null;
  private renderedTrayKey: string | null = null;
  private renderedDealKey = "";
  private boardMetrics: BoardMetrics | null = null;
  private prevTrayIds: number[] = [];
  private traySpritesById = new Map<number, Phaser.GameObjects.Container>();
  /** Cosmetic tray prediction — replicates the engine's same-symbol insert scan. */
  private predictedTraySymbols: number[] = [];
  /** Picks whose cosmetic ghost is still flying (tray sprite hidden meanwhile). */
  private inFlightPickIds = new Set<number>();
  private activeGhosts = new Set<Phaser.GameObjects.Container>();

  // ── FX state (juice) ───────────────────────────────────────────────────────
  private matchStreak = 0;
  private lastMatchAt = 0;

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
    this.load.image(SHEEP_ASSETS.field, "./art/field-meadow.webp");
    this.load.image(SHEEP_ASSETS.tray, "./art/tray-wood.webp");
    this.load.image(SHEEP_ASSETS.sticker, "./art/btn-sticker.webp");
    this.load.image(SHEEP_ASSETS.mascot, "./art/mascot-sheep.webp");
    this.load.image(SHEEP_ASSETS.props.undo, "./art/prop-undo.webp");
    this.load.image(SHEEP_ASSETS.props.remove, "./art/prop-remove.webp");
    this.load.image(SHEEP_ASSETS.props.shuffle, "./art/prop-shuffle.webp");
    // Sheep-themed tile set (generated by scripts/generate-sheep-tiles.mjs)
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
    this.buildHome(DESIGN_W, DESIGN_H);
    this.buildPracticeOverlay(DESIGN_W, DESIGN_H);
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

    const showHome   = (status === "idle" || status === "expired" || status === "refunded") && !isStarting && !isDealing;
    const deadlineExpired = this.bool("deadlineExpired");
    const showLoad   = isStarting || isDealing || status === "committed" || status === "unknown";
    const showResult = status === "solved" || (status === "dealt" && (isGameOver || deadlineExpired));
    const showGame   = status === "dealt" && !isGameOver && !deadlineExpired;

    // A new round can reuse the same Phaser scene. Off the board: reset the
    // transition sentinels (null ⇒ the next update rebuilds unconditionally,
    // which also clears stale tray/pile sprites from the previous run) and
    // sweep any in-flight cosmetic ghosts so they can't land on the home view.
    if (!showGame) {
      this.prevPileLen = 0;
      this.prevSlotLen = 0;
      this.prevMatching = false;
      this.renderedPileKey = null;
      this.renderedTrayKey = null;
      this.prevTrayIds = [];
      this.inFlightPickIds.clear();
      this.destroyActiveGhosts();
    }

    // The practice picker fully replaces the home view while open (the dim
    // alone left the sign/CTA bleeding through the overlay).
    this.setGroupActive(this.homeGroup, showHome && !showLoad && !this.practiceOpen);
    this.setGroupActive(this.practiceGroup, showHome && !showLoad && this.practiceOpen);
    this.setGroupActive(this.loadGroup, showLoad);
    this.setGroupActive(this.gameGroup, showGame);
    this.setGroupActive(this.resultGroup, showResult);
    if (showLoad) this.startSpinnerBob();
    else this.stopSpinnerBob();

    this.currentStatus = status;
    if (!showResult) this.resultAnimationKey = "";

    const resultCue: "" | "win" | "lose" = showResult ? (status === "solved" ? "win" : "lose") : "";
    if (resultCue && resultCue !== this.lastResultCue) this.sfx.play(resultCue);
    this.lastResultCue = resultCue;

    if (showGame)   this.updateGameScreen();
    if (showResult) this.updateResultScreen();

    // Status toast lives on the board only — clear it when returning home so a
    // stale "reshuffled"/"revived" line never floats over the title screen.
    this.statusLabel?.setText(showGame ? this.str("lastStatus", "") : "");
  }

  /** Push the React-resolved locale strings onto every static scene label. */
  private applyLocale(): void {
    const title = this.locStr("title", "Sheep Solitaire");
    const logoSize = title.length > 6 ? 30 : 46;
    // The hard-shadow layer offset scales with the glyph size — a fixed 7px
    // drop reads as a detached echo under the smaller latin logo.
    const drop = logoSize >= 40 ? { dx: 5, dy: 7 } : { dx: 3, dy: 4 };
    this.homeLogoTxts.forEach((txt, i) => {
      txt.setText(title);
      txt.setFontSize(logoSize);
      const isShadow = i === 0 && this.homeLogoTxts.length > 1;
      txt.setPosition(
        DESIGN_W / 2 + (isShadow ? drop.dx : 0),
        218 + (isShadow ? drop.dy : 0),
      );
    });
    this.homeSubTxt?.setText(this.locStr("subtitle", "Match 3 tiles to clear the board"));
    this.homeDailyTxt?.setText(this.locStr("dailyChallengeSub", "Level 1 easy · Level 2 devil · refreshes daily"));
    this.homeStartTxt?.setText(this.locStr("homeStartDaily", "Start Today's Challenge"));
    this.homePracticeTxt?.setText(this.locStr("homePractice", "Free Practice"));
    this.practiceTitleTxt?.setText(this.locStr("practiceTitle", "Choose a practice board"));
    this.practiceBackTxt?.setText(this.locStr("practiceBack", "Back"));

    const names = this.locArr("diffNames", [...DIFFICULTY_LABELS]);
    const infos = this.locArr("diffInfos", DIFFICULTY_TILE_TYPES.map((count) => `${count} tile types`));
    for (let d = 0; d < 3; d++) {
      this.practiceNameTxts[d]?.setText(names[d] ?? "");
      this.practiceInfoTxts[d]?.setText(infos[d] ?? "");
    }

    this.propLabelTxts.undo?.setText(this.locStr("undo", "Undo"));
    this.propLabelTxts.shuffle?.setText(this.locStr("shuffle", "Shuffle"));
    this.propLabelTxts.remove?.setText(this.locStr("remove3", "Remove 3"));
    this.loadTitleTxt?.setText(this.locStr("loadTitle", "Preparing your board…"));
    this.loadSubTxt?.setText(this.locStr("loadSub", "Securing puzzle on-chain"));
  }

  // ── Background — full-screen saturated meadow ───────────────────────────────

  private buildBackground(W: number, H: number): void {
    this.sceneBackdrop = this.add.rectangle(W / 2, H / 2, W, H, C.grass);
    this.fieldImage = this.add.image(W / 2, H / 2, SHEEP_ASSETS.field)
      .setDisplaySize(W, H);
    this.stageFrame = this.add.graphics();
    this.renderResponsiveStage(H, H / 2);
  }

  /**
   * Bleed the grass past the 390×844 design so wider/taller host viewports
   * never expose the React shell as letterbox bars. The field art is scaled
   * to COVER the visible world; a solid grass rectangle sits underneath as
   * the final guard for extreme aspect ratios.
   */
  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.sceneBackdrop || !this.fieldImage || !this.stageFrame) return;

    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H) || 1;
    const visibleWorldW = Math.max(DESIGN_W, viewW / zoom);
    const worldH = Math.max(DESIGN_H, visibleWorldH);

    this.sceneBackdrop
      .setPosition(DESIGN_W / 2, centerY)
      .setDisplaySize(visibleWorldW + 48, worldH + 48);

    const cover = Math.max((visibleWorldW + 24) / DESIGN_W, (worldH + 24) / DESIGN_H);
    this.fieldImage
      .setPosition(DESIGN_W / 2, centerY)
      .setDisplaySize(DESIGN_W * cover, DESIGN_H * cover);

    // §9.4 v2: the field stays PLAIN — no vignette, no texture overlays.
    this.stageFrame.clear();
  }

  // ── FX helpers (juice) ───────────────────────────────────────────────────────

  /** Generate the runtime FX textures once. No new asset files. */
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

    // Soft card drop-shadow — a blurred dark-green rounded rect placed behind
    // each tile so the pile reads as physically stacked on the field.
    const shadowKey = "sheep-fx-cardshadow";
    if (!this.textures.exists(shadowKey)) {
      const w = 64, h = 72;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const layers = 9;
      for (let i = layers; i > 0; i--) {
        const t = i / layers;                 // 1 (outermost) → ~0 (core)
        const inset = 9 * (1 - t);
        const a = 0.02 + 0.055 * (1 - t);
        g.fillStyle(C.ink, a);
        g.fillRoundedRect(inset, inset, w - inset * 2, h - inset * 2, 16 * t + 6);
      }
      g.generateTexture(shadowKey, w, h);
      g.destroy();
    }

    // White rounded-rect, tinted per use (WebGL-only cosmetics).
    const panelKey = "sheep-fx-panel";
    if (!this.textures.exists(panelKey)) {
      const s = 60;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(1, 1, s - 2, s - 2, 12);
      g.generateTexture(panelKey, s, s);
      g.destroy();
    }

    // Covered-tile veil with the dark gray-green BAKED into the texture —
    // runtime setTint is silently ignored by Phaser's Canvas renderer
    // fallback, which turned the old white-texture+tint veil into a white
    // wash. Baking the color keeps the §9.4 "harsh cover" read on every
    // renderer.
    const coverKey = "sheep-fx-cover";
    if (!this.textures.exists(coverKey)) {
      const w = 60, h = 70;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(C.coverVeil, 1);
      g.fillRoundedRect(1, 1, w - 2, h - 2, 13);
      g.generateTexture(coverKey, w, h);
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

  // ── Home view (meadow title screen) ─────────────────────────────────────────

  private buildHome(W: number, _H: number): void {
    this.homeGroup = this.add.container(0, 0);

    // §9.4 v2 logo: big chunky WHITE lettering, near-black outline + HARD
    // offset black drop shadow (sticker style — no gold, no gradients).
    const logoY = 218;
    this.homeLogoTxts = [];
    const layerSpecs: Array<{ dx: number; dy: number; color: string }> = [
      { dx: 5, dy: 7, color: INK },
      { dx: 0, dy: 0, color: "#ffffff" },
    ];
    for (const spec of layerSpecs) {
      const txt = this.add.text(W / 2 + spec.dx, logoY + spec.dy, "Sheep Solitaire", {
        fontFamily: FONT,
        fontSize: "46px",
        fontStyle: "900",
        color: spec.color,
      }).setOrigin(0.5);
      txt.setStroke(INK, 10);
      this.homeLogoTxts.push(txt);
      this.homeGroup.add(txt);
    }

    this.homeSubTxt = this.add.text(W / 2, 292, "Match 3 tiles to clear the board", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "700",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 300 },
    }).setOrigin(0.5).setStroke(INK, 5);
    this.homeGroup.add(this.homeSubTxt);

    // Hero mascot — the in-house painted sheep (public/logo.webp, July 2026
    // refresh) reframed as one big die-cut sticker medallion by
    // scripts/generate-sheep-tiles.mjs. Replaces the retired circle-composite
    // flock (2026-07-14 user verdict: the procedural circle sheep read as
    // creepy, not cute). A gentle idle bob keeps the title screen alive.
    const heroY = 420;
    const hero = this.add.image(W / 2, heroY, SHEEP_ASSETS.mascot)
      .setDisplaySize(196, 196);
    this.homeGroup.add(hero);
    if (!this.reducedMotion) {
      this.tween({
        targets: hero,
        y: heroY - 6,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Big single-tap entry — WHITE sticker button with wavy black border.
    const startBtn = this.add.container(W / 2, 566);
    const stickerImg = this.add.image(0, 0, SHEEP_ASSETS.sticker).setDisplaySize(290, 88);
    this.homeStartTxt = this.add.text(-4, -6, "Start Game", {
      fontFamily: FONT,
      fontSize: "26px",
      fontStyle: "900",
      color: INK,
    }).setOrigin(0.5);
    const startHit = this.add.rectangle(0, 0, 294, 94, 0xffffff, 0.001);
    startBtn.add([stickerImg, this.homeStartTxt, startHit]);
    this.homeStartBtn = startBtn;
    this.homeStartHit = startHit;
    startHit.setInteractive({ useHandCursor: true });
    this.bindGameButton(startHit, {
      targets: startBtn,
      enabled: () => this.canStartNewRun(),
      hoverScale: 1.04,
      pressScale: 0.95,
      onPress: () => {
        if (!this.canStartNewRun()) return;
        this.sfx.play("start");
        this.dispatch("startGame", { mode: "daily", level: 1 });
      },
    });
    this.homeGroup.add(startBtn);

    this.homeDailyTxt = this.add.text(W / 2, 628, "Level 1 easy · Level 2 devil · refreshes daily", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "700",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 320 },
    }).setOrigin(0.5).setStroke(INK, 4);
    this.homeGroup.add(this.homeDailyTxt);

    // Secondary entry — free practice (opens the picker overlay).
    const practiceBtn = this.add.container(W / 2, 682);
    const practiceShadow = this.add.rectangle(3, 4, 176, 44, C.ink, 0.32);
    const practiceBg = this.add.rectangle(0, 0, 176, 44, 0xffffff, 1)
      .setStrokeStyle(4, C.ink, 1);
    this.homePracticeTxt = this.add.text(0, 0, "Free Practice", {
      fontFamily: FONT,
      fontSize: "15px",
      fontStyle: "800",
      color: INK,
    }).setOrigin(0.5);
    practiceBtn.add([practiceShadow, practiceBg, this.homePracticeTxt]);
    practiceBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(practiceBg, {
      targets: practiceBtn,
      hoverScale: 1.05,
      pressScale: 0.94,
      onPress: () => {
        this.sfx.play("chip");
        this.practiceOpen = true;
        this.onStateUpdate(this.state);
      },
    });
    this.homeGroup.add(practiceBtn);
  }

  // ── Practice picker overlay (secondary IA, tile-icon choices on the field) ──

  private buildPracticeOverlay(W: number, H: number): void {
    this.practiceGroup = this.add.container(0, 0);

    const dim = this.add.rectangle(W / 2, H / 2, W + 80, H + 80, C.overlayDark, 0.62);
    dim.setInteractive(); // swallow clicks under the overlay
    this.practiceGroup.add(dim);

    this.practiceTitleTxt = this.add.text(W / 2, 218, "Choose a practice board", {
      fontFamily: FONT,
      fontSize: "21px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke(INK, 5);
    this.practiceGroup.add(this.practiceTitleTxt);

    // Three tile-icon choices, one column per board (no web cards).
    const colX = [W / 2 - 122, W / 2, W / 2 + 122];
    for (let d = 0; d < 3; d++) {
      const col = this.add.container(colX[d]!, 372);
      const tile = this.add.image(0, -18, this.tileAssetKey(DIFFICULTY_PREVIEW_SYMBOL[d]!))
        .setDisplaySize(92, 92 * TILE_RATIO);
      const name = this.add.text(0, 58, DIFFICULTY_LABELS[d]!, {
        fontFamily: FONT,
        fontSize: "14px",
        fontStyle: "800",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 110 },
      }).setOrigin(0.5).setStroke(INK, 4);
      const info = this.add.text(0, 82, `${DIFFICULTY_TILE_TYPES[d]} tile types`, {
        fontFamily: FONT,
        fontSize: "11.5px",
        fontStyle: "600",
        color: "#d7f5cf",
        align: "center",
      }).setOrigin(0.5).setStroke(INK, 3);
      col.add([tile, name, info]);
      this.practiceNameTxts[d] = name;
      this.practiceInfoTxts[d] = info;

      tile.setInteractive({ useHandCursor: true });
      this.bindGameButton(tile, {
        targets: col,
        enabled: () => this.canStartNewRun(),
        hoverScale: 1.07,
        pressScale: 0.93,
        onPress: () => {
          if (!this.canStartNewRun()) return;
          this.practiceOpen = false;
          this.sfx.play("start");
          const difficulty = d;
          this.dispatch("startGame", { difficulty });
        },
      });
      this.practiceGroup.add(col);
    }

    // Back to the title screen.
    const backBtn = this.add.container(W / 2, 542);
    const backBg = this.add.rectangle(0, 0, 132, 42, 0xffffff, 0.14)
      .setStrokeStyle(2, 0xffffff, 0.6);
    this.practiceBackTxt = this.add.text(0, 0, "Back", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "700",
      color: "#ffffff",
    }).setOrigin(0.5);
    backBtn.add([backBg, this.practiceBackTxt]);
    backBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(backBg, {
      targets: backBtn,
      hoverScale: 1.05,
      pressScale: 0.94,
      onPress: () => {
        this.sfx.play("chip");
        this.practiceOpen = false;
        this.onStateUpdate(this.state);
      },
    });
    this.practiceGroup.add(backBtn);
  }

  private canStartNewRun(): boolean {
    return this.str("appMode", "guest") === "guest" || this.bool("newPaidRunsEnabled");
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  private buildLoadScreen(W: number, H: number): void {
    this.loadGroup = this.add.container(0, 0);

    const chip = this.add.rectangle(W / 2, H / 2 + 6, 300, 150, C.ink, 0.78)
      .setStrokeStyle(3, 0xffffff, 0.4);

    const spinner = this.add.container(W / 2, H / 2 - 36);
    const spinnerArt = this.add.image(0, 0, SHEEP_ASSETS.mascot)
      .setDisplaySize(74, 74);
    spinner.add(spinnerArt);
    this.spinner = spinner;
    this.spinnerBaseY = spinner.y;

    this.loadTitleTxt = this.add.text(W / 2, H / 2 + 26, "Preparing your board…", {
      fontFamily: FONT,
      fontSize: "16px",
      fontStyle: "700",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke(INK, 4);

    this.loadSubTxt = this.add.text(W / 2, H / 2 + 52, "Securing puzzle on-chain", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#d7f5cf",
    }).setOrigin(0.5);

    this.startSpinnerBob();

    this.loadGroup.add([chip, spinner, this.loadTitleTxt, this.loadSubTxt]);
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

  private buildGameScreen(W: number, _H: number): void {
    this.gameGroup = this.add.container(0, 0);

    // ── Top HUD (§9.4 v2): black rounded pill, top-center, white text — the
    // daily pill (每日挑战 · 第N关) with a smaller remaining-count pill below.
    this.hudPillG = this.add.graphics();
    this.gameGroup.add(this.hudPillG);
    this.hudLevelTxt = this.add.text(W / 2, HUD_Y, "", {
      fontFamily: FONT,
      fontSize: "15px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.gameGroup.add(this.hudLevelTxt);
    this.hudRemainTxt = this.add.text(W / 2, HUD_Y + 36, "", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.gameGroup.add(this.hudRemainTxt);

    // ── Board containers (grid pile + side stacks, filled dynamically) ────────
    this.pileContainer = this.add.container(0, 0);
    this.gameGroup.add(this.pileContainer);
    this.stackContainer = this.add.container(0, 0);
    this.gameGroup.add(this.stackContainer);

    // ── Wooden trough tray with fence posts (docked near screen bottom) ───────
    const trayBg = this.add.image(W / 2, TRAY_Y, SHEEP_ASSETS.tray)
      .setDisplaySize(TRAY_W, TRAY_H);
    this.trayBg = trayBg;
    this.gameGroup.add(trayBg);

    // Slot tension frames — INVISIBLE at rest (§9.4 v2: no slot dividers);
    // they only light up as warn/danger cues while the tray fills.
    this.slotBoxes = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = this.slotCenterX(i);
      const slotBox = this.add.rectangle(sx, TRAY_TILE_Y, 46, 60, 0xffffff, 0)
        .setStrokeStyle(0, 0xffffff, 0);
      slotBox.setAlpha(0);
      this.slotBoxes.push(slotBox);
      this.gameGroup.add(slotBox);
    }

    this.trayContainer = this.add.container(0, 0);
    this.gameGroup.add(this.trayContainer);

    // ── Prop buttons directly under the tray — original order: out-of-tray,
    // undo, shuffle (§9.4 v2).
    this.remove3Btn = this.makePropBtn(W / 2 - 96, PROPS_Y, SHEEP_ASSETS.props.remove, "remove", () => this.dispatch("useRemove3"));
    this.undoBtn    = this.makePropBtn(W / 2,      PROPS_Y, SHEEP_ASSETS.props.undo, "undo", () => this.dispatch("useUndo"));
    this.shuffleBtn = this.makePropBtn(W / 2 + 96, PROPS_Y, SHEEP_ASSETS.props.shuffle, "shuffle", () => this.dispatch("useShuffle"));
    this.gameGroup.add([this.undoBtn, this.remove3Btn, this.shuffleBtn]);

    // ── Status toast ──────────────────────────────────────────────────────────
    this.statusLabel = this.add.text(W / 2, TOAST_Y, "", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "700",
      color: "#ffffff",
      wordWrap: { width: W - 40 },
      align: "center",
    }).setOrigin(0.5).setStroke(INK, 4);
    this.gameGroup.add(this.statusLabel);
  }

  private slotCenterX(index: number): number {
    const innerW = TRAY_W - TRAY_SIDE_PAD * 2;
    const step = innerW / SLOT_COUNT;
    const left = DESIGN_W / 2 - TRAY_W / 2 + TRAY_SIDE_PAD;
    return left + step * index + step / 2;
  }

  // ── Prop buttons ───────────────────────────────────────────────────────────

  private makePropBtn(
    x: number, y: number,
    iconKey: string,
    slot: "undo" | "remove" | "shuffle",
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    // §9.4 v2: sky-blue sticker button with yellow glyph (baked into the art:
    // black outline + hard offset shadow). Greying is a tint when spent.
    const icon = this.add.image(0, 0, iconKey).setDisplaySize(62, 66);
    const countBg = this.add.circle(24, -24, 11, 0xe0663c).setStrokeStyle(3, C.ink, 1);
    const count = this.add.text(24, -24, "1", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5);
    const label = this.add.text(0, 44, "", {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke(INK, 4);
    const hit = this.add.rectangle(0, 4, 70, 92, 0xffffff, 0.001);
    c.add([icon, countBg, count, label, hit]);
    this.propCountTxts[slot] = count;
    this.propLabelTxts[slot] = label;

    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      if (!hit.input?.enabled) return;
      this.sfx.play("chip");
      onPress();
      this.pressFeedback(c, { scale: 0.9, duration: 70 });
    });

    return c;
  }

  private updateTools(): void {
    const undosUsed   = this.num("undosUsed", 0);
    const shuffleLeft = this.num("shuffleLeft", 1);
    const remove3Left = this.num("remove3Left", 1);
    const status      = this.str("gameStatus", "idle");
    const slotCount   = (this.val<CardView[]>("slotCards") ?? []).length;
    const isGuest     = this.str("appMode", "guest") === "guest";
    const maxUndos    = isGuest ? 1 : 3;
    const isActive    = status === "dealt" &&
      !this.bool("isTeeBusy") &&
      !this.bool("isFinancialAction") &&
      !this.bool("deadlineExpired");

    const undoAvail    = isActive && slotCount > 0 && undosUsed < maxUndos;
    // Shuffle re-randomizes the remaining BOARD tiles and leaves the tray
    // untouched, so it must stay available even with an empty tray.
    const shuffleAvail = isActive && shuffleLeft > 0;
    const remove3Avail = isActive && slotCount >= 3 && remove3Left > 0;

    this.setPropBtnActive(this.undoBtn, undoAvail);
    this.setPropBtnActive(this.shuffleBtn, shuffleAvail);
    this.setPropBtnActive(this.remove3Btn, remove3Avail);

    this.propCountTxts.undo?.setText(String(Math.max(0, maxUndos - undosUsed)));
    this.propCountTxts.shuffle?.setText(String(shuffleLeft));
    this.propCountTxts.remove?.setText(String(remove3Left));
  }

  private setPropBtnActive(btn: Phaser.GameObjects.Container, active: boolean): void {
    const icon = btn.list[0] as Phaser.GameObjects.Image;
    const hit = btn.list[4] as Phaser.GameObjects.Rectangle;
    // Grey-out via tint on WebGL, but ALSO via alpha so the spent state
    // survives the Canvas-renderer fallback (which ignores tints).
    if (active) icon.clearTint().setAlpha(1);
    else icon.setTint(0x8f8f8f).setAlpha(0.42);
    if (hit.input) hit.input.enabled = active;
    btn.setAlpha(active ? 1 : 0.75);
  }

  // ── Result / interstitial overlay ──────────────────────────────────────────

  private buildResultScreen(W: number, H: number): void {
    this.resultGroup = this.add.container(0, 0);

    const overlay = this.add.rectangle(W / 2, H / 2, W + 80, H + 80, C.overlayDark, 0.55);
    overlay.setInteractive(); // swallow board clicks under the overlay

    // Wooden result panel — sticker style: flat wood, black outline, hard
    // offset black shadow (not a cream web card).
    const panel = this.add.graphics();
    const pw = 316, ph = 288;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2 - 10;
    panel.fillStyle(C.ink, 0.32);
    panel.fillRoundedRect(px + 7, py + 9, pw, ph, 24);
    panel.fillStyle(C.wood, 1);
    panel.fillRoundedRect(px, py, pw, ph, 24);
    panel.lineStyle(6, C.ink, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 24);
    panel.fillStyle(C.woodLight, 0.8);
    panel.fillRoundedRect(px + 12, py + 10, pw - 24, 16, 8);

    // Celebration mascot — the logo-derived sticker medallion peeks over the
    // panel and bounces on a win only. 92px (up from 84) compensates for the
    // shadow margin baked into the die-cut sticker art.
    this.resultMascot = this.add.image(W / 2, py - 34, SHEEP_ASSETS.mascot)
      .setDisplaySize(92, 92)
      .setVisible(false);

    // Chunky white title over a hard black shadow (same language as the logo).
    this.resultTitleTxts = [];
    for (const spec of [
      { dx: 4, dy: 5, color: INK },
      { dx: 0, dy: 0, color: "#ffffff" },
    ]) {
      const txt = this.add.text(W / 2 + spec.dx, py + 66 + spec.dy, "", {
        fontFamily: FONT,
        fontSize: "30px",
        fontStyle: "900",
        color: spec.color,
        align: "center",
      }).setOrigin(0.5).setStroke(INK, 8);
      this.resultTitleTxts.push(txt);
    }

    this.resultSub = this.add.text(W / 2, py + 128, "", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "700",
      color: "#fff3dc",
      align: "center",
      wordWrap: { width: pw - 48 },
    }).setOrigin(0.5);

    // Action button — flat sticker: fill + black outline + hard shadow.
    const actionY = py + ph - 62;
    this.resultActionFill = this.add.graphics();
    this.paintResultAction(C.btnGreen, actionY);
    this.resultActionTxt = this.add.text(W / 2, actionY, "Play Again", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke(INK, 4);
    this.resultActionBg = this.add.rectangle(W / 2, actionY + 2, 228, 66, 0xffffff, 0.001);
    this.resultActionBg.setInteractive({ useHandCursor: true });
    this.resultActionBg.on("pointerdown", () => this.triggerResultAction());

    this.resultGroup.add([
      overlay, panel, this.resultMascot,
      ...this.resultTitleTxts, this.resultSub,
      this.resultActionFill, this.resultActionTxt, this.resultActionBg,
    ]);
  }

  private paintResultAction(fill: number, y: number): void {
    const g = this.resultActionFill;
    g.clear();
    g.fillStyle(C.ink, 0.32);
    g.fillRoundedRect(DESIGN_W / 2 - 112 + 5, y - 27 + 7, 224, 54, 20);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(DESIGN_W / 2 - 112, y - 27, 224, 54, 20);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(DESIGN_W / 2 - 112, y - 27, 224, 54, 20);
  }

  /** Victory shower — falling meadow-colored confetti (reduced-motion gated). */
  private emitConfetti(): void {
    if (this.reducedMotion) return;
    const key = "sheep-fx-confetti";
    if (!this.textures.exists(key)) return;
    const tints = [0xffd54a, 0x84cc16, 0xff8a4c, 0x16c784, 0xff6f7d, 0xf0c866];
    for (let i = 0; i < 26; i++) {
      const x = DESIGN_W / 2 + (Math.random() * 250 - 125);
      const startY = DESIGN_H / 2 - 190;
      const conf = this.add.image(x, startY, key)
        .setTint(tints[i % tints.length]!)
        .setDepth(210)
        .setScale(0.7 + Math.random() * 0.7)
        .setAngle(Math.random() * 360);
      const fall = 240 + Math.random() * 220;
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

  /**
   * Win/lose mascot policy: bounce over the panel on a win; on Game Over the
   * mascot stays HIDDEN (celebrating over a loss read as mockery in the audit).
   * Called on EVERY result update — setGroupActive force-shows all children of
   * an activated container, so visibility must be re-asserted afterwards.
   */
  private playResultMascot(win: boolean, animate: boolean): void {
    const mascot = this.resultMascot;
    if (!mascot) return;
    if (!win) {
      mascot.setVisible(false);
      return;
    }
    const baseY = DESIGN_H / 2 - 188;
    mascot.setVisible(true).setY(baseY);
    this.tweens.killTweensOf(mascot);
    if (this.reducedMotion || !animate) return;
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
    // A deal is identified by game id + deal timestamp + daily level — board
    // metrics (origin/tile size) are cached per deal so removing cards never
    // re-centres the remaining tower.
    const dealKey = `${this.str("activeGameId", "0")}:${this.num("dealtAt", 0)}:${this.num("level", 1)}`;
    const isNewDeal = dealKey !== this.renderedDealKey;
    const pileKey = pileCards
      .map((card) => `${card.id}:${card.symbol}:${card.layer}:${card.col ?? ""}:${card.row ?? ""}:${card.zone ?? "grid"}:${card.stackIndex ?? 0}:${card.exposed ? 1 : 0}`)
      .join("|");
    const trayKey = slotCards
      .map((card) => `${card.id}:${card.symbol}`)
      .join("|");

    // ── Match-3 elimination: squeeze + burst anchored at the cleared slots ───
    if (isMatching && !this.prevMatching) {
      this.animateMatchClear(slotCards);
      this.sfx.play("merge");
    }
    this.prevMatching = isMatching;

    // Soft warning the moment the 6th tray slot fills.
    if (currentSlotLen >= SLOT_COUNT - 1 && this.prevSlotLen < SLOT_COUNT - 1) {
      this.sfx.play("error");
    }

    if (isNewDeal) {
      this.renderedDealKey = dealKey;
      this.boardMetrics = null;
      this.inFlightPickIds.clear();
      this.destroyActiveGhosts();
    }

    if (pileKey !== this.renderedPileKey) {
      this.rebuildBoard(pileCards, isNewDeal || this.renderedPileKey === null);
      this.renderedPileKey = pileKey;
    }
    if (trayKey !== this.renderedTrayKey) {
      this.rebuildTray(slotCards);
      this.renderedTrayKey = trayKey;
    }
    this.updateTrayTension(currentSlotLen);
    this.updateTools();
    this.updateHud(pileCards, slotCards);
    this.prevPileLen = currentPileLen;
    this.prevSlotLen = currentSlotLen;
  }

  private updateHud(pileCards: CardView[], slotCards: CardView[]): void {
    const lvl = this.num("level", 1);
    const isDaily = this.str("playMode", "practice") === "daily";
    const levelName = this.locStr("hudLevelN", "Level {n}").replace("{n}", String(lvl));
    this.hudLevelTxt.setText(
      isDaily
        ? `${this.locStr("dailyChallengeTitle", "Today's Challenge")} · ${levelName}`
        : this.locStr("hudLevelPractice", "Practice"),
    );

    const remaining = pileCards.length + slotCards.length;
    const deadline = this.num("deadline", 0);
    const remainLabel = this.locStr("hudRemaining", "{count} left").replace("{count}", String(remaining));
    this.hudRemainTxt.setText(deadline > 0 ? `${remainLabel} · ${this.formatTimeLeft(deadline)}` : remainLabel);

    // Redraw the two black pills to fit their text.
    const g = this.hudPillG;
    g.clear();
    g.fillStyle(C.ink, 0.82);
    const mainW = this.hudLevelTxt.width + 40;
    g.fillRoundedRect(DESIGN_W / 2 - mainW / 2, HUD_Y - 17, mainW, 34, 17);
    const subW = this.hudRemainTxt.width + 26;
    g.fillStyle(C.ink, 0.66);
    g.fillRoundedRect(DESIGN_W / 2 - subW / 2, HUD_Y + 36 - 12, subW, 24, 12);
  }

  // ── Board rendering (§9.2 unified unit formula) ─────────────────────────────

  /**
   * §9.2 unified fine grid: `unit = col * 2 + (layer % 2)` (odd layers are
   * half-tile staggered) and `px = origin + unit * (tileW / 2)`. The engine
   * uses the SAME formula for occlusion, so "visually uncovered" and
   * "logically pickable" can never diverge. Inlined per the §9 contract until
   * the engine exports it — the math must stay identical.
   */
  private unitOf(card: CardView): { ux: number; uy: number } {
    const off = (card.layer ?? 0) % 2;
    return {
      ux: (card.col ?? 0) * 2 + off,
      uy: (card.row ?? 0) * 2 + off,
    };
  }

  private computeBoardMetrics(gridCards: CardView[]): BoardMetrics {
    if (gridCards.length === 0) {
      return { tileW: 54, tileH: 54 * TILE_RATIO, originX: DESIGN_W / 2, originY: (BOARD_TOP + BOARD_BOTTOM) / 2 };
    }
    let minUX = Infinity, maxUX = -Infinity, minUY = Infinity, maxUY = -Infinity;
    for (const card of gridCards) {
      const { ux, uy } = this.unitOf(card);
      if (ux < minUX) minUX = ux;
      if (ux > maxUX) maxUX = ux;
      if (uy < minUY) minUY = uy;
      if (uy > maxUY) maxUY = uy;
    }
    const availW = DESIGN_W - 26;
    const availH = BOARD_BOTTOM - BOARD_TOP;
    const spanX = (maxUX - minUX) / 2 + 1; // in tile widths
    const spanY = (maxUY - minUY) / 2 + 1; // in tile heights
    const tileW = Math.min(TILE_W_MAX, availW / spanX, availH / spanY / TILE_RATIO);
    const tileH = tileW * TILE_RATIO;
    return {
      tileW,
      tileH,
      originX: DESIGN_W / 2 - ((minUX + maxUX) / 2) * (tileW / 2),
      originY: BOARD_TOP + availH / 2 - ((minUY + maxUY) / 2) * (tileH / 2),
    };
  }

  private rebuildBoard(pileCards: CardView[], animateDeal = false): void {
    this.pileContainer.removeAll(true);
    this.stackContainer.removeAll(true);

    if (pileCards.length === 0) return;

    const gridCards: CardView[] = [];
    const stackL: CardView[] = [];
    const stackR: CardView[] = [];
    for (const card of pileCards) {
      // Legacy cards carry no zone — default zone "grid", stackIndex 0 (§9.1).
      if (card.zone === "stackL") stackL.push(card);
      else if (card.zone === "stackR") stackR.push(card);
      else gridCards.push(card);
    }

    if (!this.boardMetrics) this.boardMetrics = this.computeBoardMetrics(gridCards);
    const m = this.boardMetrics;

    // Render bottom layers first (§9.1: layer 0 = topmost) so the top of the
    // tower is drawn last and overlaps what it covers.
    const sorted = [...gridCards].sort((a, b) =>
      (b.layer - a.layer) || ((a.row ?? 0) - (b.row ?? 0)) || ((a.col ?? 0) - (b.col ?? 0)));

    sorted.forEach((card, idx) => {
      const { ux, uy } = this.unitOf(card);
      const x = m.originX + ux * (m.tileW / 2);
      const y = m.originY + uy * (m.tileH / 2);
      const sprite = this.makeCardSprite(card, m.tileW, m.tileH);
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
          delay: Math.min(420, idx * 10),
          ease: "Back.easeOut",
        });
      }
    });

    // §9.2 stack exposure: only the outermost card (max stackIndex) is
    // pickable; buried cards render face-up as ~22% edge slivers, darkened.
    this.renderStack(stackL, "L", animateDeal);
    this.renderStack(stackR, "R", animateDeal);
  }

  /**
   * §9.4 v2 side stacks: a RIBBED compressed block (vertical ridge stripes =
   * the edges of a stack of face-down-compressed cards, gray-green) with the
   * single topmost card (max stackIndex — the only pickable one, §9.2) fully
   * face-up at the inner end, plus a count badge for the buried depth.
   */
  private renderStack(cards: CardView[], side: "L" | "R", animateDeal: boolean): void {
    if (cards.length === 0) return;
    const sorted = [...cards].sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));
    const top = sorted[sorted.length - 1]!;
    const buried = sorted.length - 1;
    const tileW = STACK_TILE_W;
    const tileH = tileW * TILE_RATIO;
    const dir = side === "L" ? 1 : -1;
    const edge = side === "L" ? 20 : DESIGN_W - 20;

    const group = this.add.container(0, 0);

    // Ribbed block for the buried cards (width grows with depth).
    if (buried > 0) {
      const blockW = Math.min(96, 16 + buried * 9);
      const bx = edge + dir * (blockW / 2);
      const g = this.add.graphics();
      // hard sticker shadow
      g.fillStyle(C.ink, 0.3);
      g.fillRoundedRect(bx - blockW / 2 + 4, STACK_Y - tileH / 2 + 5, blockW, tileH, 10);
      g.fillStyle(C.stackBlock, 1);
      g.fillRoundedRect(bx - blockW / 2, STACK_Y - tileH / 2, blockW, tileH, 10);
      g.lineStyle(3.5, C.ink, 1);
      g.strokeRoundedRect(bx - blockW / 2, STACK_Y - tileH / 2, blockW, tileH, 10);
      // vertical ridges (card edges)
      g.lineStyle(2.5, C.stackRidge, 1);
      const ridges = Math.min(buried, 9);
      for (let r = 1; r <= ridges; r++) {
        const rx = bx - blockW / 2 + (blockW / (ridges + 1)) * r;
        g.lineBetween(rx, STACK_Y - tileH / 2 + 6, rx, STACK_Y + tileH / 2 - 6);
      }
      group.add(g);

      // Depth badge.
      const badge = this.add.circle(bx, STACK_Y - tileH / 2 - 2, 11, 0x26221e, 0.85)
        .setStrokeStyle(2, 0xffffff, 0.7);
      const badgeTxt = this.add.text(bx, STACK_Y - tileH / 2 - 2, String(buried), {
        fontFamily: FONT,
        fontSize: "11px",
        fontStyle: "800",
        color: "#ffffff",
      }).setOrigin(0.5);
      group.add([badge, badgeTxt]);
    }

    // Topmost card, fully face-up at the inner end of the block.
    const blockW = buried > 0 ? Math.min(96, 16 + buried * 9) : 0;
    const topX = edge + dir * (blockW + tileW / 2 - 2);
    const sprite = this.makeCardSprite(top, tileW, tileH);
    sprite.setPosition(topX, STACK_Y);
    group.add(sprite);

    this.stackContainer.add(group);
    if (animateDeal) {
      group.setAlpha(0);
      this.tween({
        targets: group,
        alpha: 1,
        duration: 220,
        delay: 340,
        ease: "Quad.easeOut",
      });
    }
  }

  private makeCardSprite(card: CardView, tileW: number, tileH: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const isExposed = card.exposed;

    // The hard offset sticker shadow is baked into the tile art (§9.4 v2) —
    // no per-sprite soft shadow.
    const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
      .setDisplaySize(tileW, tileH);

    if (isExposed) {
      const glow = this.add.image(0, 0, "sheep-fx-glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe9a8)
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
          this.tween({ targets: glow, alpha: 0.5, duration: 220, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        } else {
          glow.setAlpha(0.3);
        }
      });
      tile.on("pointerout", () => {
        this.animate({ targets: c, scaleX: 1, scaleY: 1, duration: 90 });
        this.tweens.killTweensOf(glow);
        this.tween({ targets: glow, alpha: 0, duration: 120 });
      });
      tile.on("pointerdown", () => {
        this.handleCardClick(card, c, tileW, tileH);
      });
    } else {
      // §9.4 v2 covered read: the WHOLE tile sinks under a dark gray-green
      // veil (icon dimly visible), fully opaque — harsh one-glance contrast
      // against the bright cream exposed tiles. The veil color is baked into
      // the texture (Canvas renderer ignores runtime tints).
      const veil = this.add.image(0, 1, "sheep-fx-cover")
        .setDisplaySize(tileW - 3, tileH - 8)
        .setAlpha(0.62);
      c.add([tile, veil]);
    }

    return c;
  }

  // ── Pick handling (engine-authoritative; ghost flight is pure cosmetics) ────

  /**
   * Replicate the engine's cluster-insert scan over the current tray: scan
   * from the tail for the same symbol and insert right after it, else append.
   * Purely cosmetic — used to aim the ghost flight at the slot where the
   * authoritative engine will actually put the card.
   */
  private predictInsertIndex(symbol: number): number {
    let insertAt = this.predictedTraySymbols.length;
    for (let i = this.predictedTraySymbols.length - 1; i >= 0; i -= 1) {
      if (this.predictedTraySymbols[i] === symbol) {
        insertAt = i + 1;
        break;
      }
    }
    this.predictedTraySymbols.splice(insertAt, 0, symbol);
    return insertAt;
  }

  private handleCardClick(
    card: CardView,
    sprite: Phaser.GameObjects.Container,
    tileW: number,
    tileH: number,
  ): void {
    const slotCards = (this.val<CardView[]>("slotCards") ?? []);
    if (
      slotCards.length >= SLOT_COUNT ||
      this.bool("isTeeBusy") ||
      this.bool("isFinancialAction") ||
      this.bool("deadlineExpired")
    ) return;

    this.sfx.play("tap");

    // The engine validates every pick — dispatch IMMEDIATELY so rapid taps are
    // never serialized behind an animation. Everything below is cosmetic.
    this.dispatch("pickCard", { cardId: card.id });

    if (this.reducedMotion) {
      this.sfx.play("select");
      return;
    }

    const insertIdx = Math.min(SLOT_COUNT - 1, this.predictInsertIndex(card.symbol));
    const targetX = this.slotCenterX(insertIdx);
    const targetY = TRAY_TILE_Y;
    const slotScaleX = 44 / tileW;
    const slotScaleY = 56 / tileH;

    // Source tile lifts, then dims while its ghost flies.
    this.inFlightPickIds.add(card.id);
    this.tweens.add({
      targets: sprite,
      scaleX: 1.16, scaleY: 1.16,
      duration: 90, yoyo: true, ease: "Sine.easeOut",
    });
    this.animate({ targets: sprite, alpha: 0.25, duration: 140 });

    const parent = sprite.parentContainer ?? this.pileContainer;
    const worldPos = parent.getWorldTransformMatrix().transformPoint(sprite.x, sprite.y);
    const startX = worldPos.x, startY = worldPos.y;
    const ghost = this.makeCardSprite({ ...card, exposed: true }, tileW, tileH);
    ghost.setPosition(startX, startY);
    this.add.existing(ghost);
    ghost.setDepth(100);
    this.activeGhosts.add(ghost);

    const dx = targetX - startX;
    const dir = dx >= 0 ? 1 : -1;
    const apexLift = 44 + Math.random() * 12;
    const finishPick = (): void => {
      this.activeGhosts.delete(ghost);
      ghost.destroy();
      this.sfx.play("select");
      this.revealLandedTraySprite(card.id);
      // If the authoritative engine rejected a stale pick, no tray sprite
      // exists — restore the source tile instead of leaving a false fade.
      if (!this.traySpritesById.has(card.id) && sprite.active) {
        this.tween({ targets: sprite, alpha: 1, duration: 100, ease: "Quad.easeOut" });
      }
    };
    this.tweens.addCounter({
      from: 0, to: 1,
      duration: 290,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        if (!ghost.active) return;
        const t = tw.getValue() ?? 0;
        const x = startX + dx * t;
        // Parabolic arc: rises off the pile, then drops cleanly into the slot.
        const y = startY + (targetY - startY) * t - apexLift * Math.sin(Math.PI * t);
        ghost.setPosition(x, y);
        ghost.setScale(1 + (slotScaleX - 1) * t, 1 + (slotScaleY - 1) * t);
        ghost.setAngle(dir * 7 * Math.sin(Math.PI * t));
      },
      onComplete: () => {
        if (!ghost.active) {
          this.inFlightPickIds.delete(card.id);
          return;
        }
        ghost.setAngle(0);
        // Land squash → settle into the cluster-insert slot.
        this.tweens.add({
          targets: ghost,
          scaleX: slotScaleX * 1.14, scaleY: slotScaleY * 0.84,
          duration: 72, yoyo: true, ease: "Quad.easeOut",
          onComplete: finishPick,
        });
      },
    });
    // Safety valve: if the ghost is swept (view change), reveal the tray tile.
    this.time.delayedCall(900, () => this.revealLandedTraySprite(card.id));
  }

  private revealLandedTraySprite(cardId: number): void {
    this.inFlightPickIds.delete(cardId);
    const traySprite = this.traySpritesById.get(cardId);
    if (traySprite?.active && traySprite.alpha < 1) {
      traySprite.setAlpha(1);
      if (!this.reducedMotion) {
        traySprite.setScale(0.6);
        this.tweens.add({
          targets: traySprite,
          scaleX: 1, scaleY: 1,
          duration: 240,
          ease: "Back.easeOut",
        });
      }
    }
  }

  private destroyActiveGhosts(): void {
    for (const ghost of this.activeGhosts) {
      if (ghost.active) ghost.destroy();
    }
    this.activeGhosts.clear();
  }

  // ── Tray rendering ─────────────────────────────────────────────────────────

  private rebuildTray(slotCards: CardView[]): void {
    this.trayContainer.removeAll(true);
    this.traySpritesById.clear();

    const prevIds = this.prevTrayIds;
    const newIds = slotCards.map((card) => card.id);

    slotCards.forEach((card, idx) => {
      if (idx >= SLOT_COUNT) return;
      const x = this.slotCenterX(idx);
      const c = this.add.container(x, TRAY_TILE_Y);

      const ground = this.add.ellipse(0, 27, 38, 8, 0x000000, 0.16);
      const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
        .setDisplaySize(44, 56);

      c.add([ground, tile]);
      this.trayContainer.add(c);
      this.traySpritesById.set(card.id, c);

      const isNew = !prevIds.includes(card.id);
      if (isNew && this.inFlightPickIds.has(card.id)) {
        // A cosmetic ghost is still flying toward this slot — keep the real
        // sprite hidden until the ghost lands (revealLandedTraySprite).
        c.setAlpha(0);
      } else if (isNew && !this.reducedMotion) {
        // Settle bounce at the actual insert slot (keyboard / DOM picks).
        c.setScale(0.55);
        this.tweens.add({
          targets: c,
          scaleX: 1, scaleY: 1,
          duration: 260,
          ease: "Back.easeOut",
        });
      }
    });

    this.prevTrayIds = newIds;
    // Re-seed the cosmetic prediction from the authoritative tray.
    this.predictedTraySymbols = slotCards.map((card) => card.symbol);
  }

  /** Warm the tray slots and shake the tray as it approaches the 7-slot loss. */
  private updateTrayTension(count: number): void {
    const danger = count >= SLOT_COUNT - 1; // 6 or 7 filled
    const warn   = count >= SLOT_COUNT - 2; // 5+ filled
    this.slotBoxes.forEach((box, i) => {
      const filled = i < count;
      if (!filled && danger) {
        // The last empty slot(s) glow hot — the shrinking runway is the read.
        box.setStrokeStyle(2.6, C.slotDanger, 0.95).setFillStyle(0xffdccf, 0.4).setAlpha(0.85);
      } else if (!filled && warn) {
        box.setStrokeStyle(2.2, C.slotWarn, 0.85).setFillStyle(0xffe9c8, 0.3).setAlpha(0.7);
      } else if (filled && danger) {
        box.setStrokeStyle(1.6, C.slotDanger, 0.5).setFillStyle(0xffffff, 0.04).setAlpha(0.4);
      } else if (filled && warn) {
        box.setStrokeStyle(1.6, C.slotWarn, 0.45).setFillStyle(0xffffff, 0.04).setAlpha(0.35);
      } else {
        // §9.4 v2: no visible slot frames at rest.
        box.setStrokeStyle(0, 0xffffff, 0).setFillStyle(0xffffff, 0).setAlpha(0);
      }
    });
    this.trayBg?.setTint(danger ? 0xff9e86 : warn ? 0xffe0b0 : 0xffffff);
    // A subtle shake the moment the tray crosses into the danger zone.
    if (danger && count > this.prevSlotLen) this.shakeTray();
  }

  private shakeTray(): void {
    if (this.reducedMotion || this.trayShaking) return;
    const targets = [this.trayBg, this.trayContainer, ...this.slotBoxes]
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

  /**
   * Match-3 juice, anchored at the ACTUAL cleared slots: the trio squeezes
   * toward its own centroid, then bursts. `slotCards` still contains the
   * matched triple at the isMatching rising edge (the engine removes it on a
   * short timer), so the cleared indices are read straight from it.
   */
  private animateMatchClear(slotCards: CardView[]): void {
    const now = this.time.now;
    this.matchStreak = now - this.lastMatchAt < 2600 ? this.matchStreak + 1 : 1;
    this.lastMatchAt = now;

    // Locate the completed trio (cluster-insertion keeps it adjacent).
    const counts = new Map<number, number[]>();
    let trioIdx: number[] = [];
    slotCards.forEach((card, idx) => {
      const arr = counts.get(card.symbol) ?? [];
      arr.push(idx);
      counts.set(card.symbol, arr);
      if (arr.length >= 3 && trioIdx.length === 0) trioIdx = arr.slice(-3);
    });
    if (trioIdx.length === 0) trioIdx = [0, 1, 2].filter((i) => i < Math.max(3, slotCards.length));

    const anchors = trioIdx.map((i) => ({ x: this.slotCenterX(i), y: TRAY_TILE_Y }));
    const cx = anchors.reduce((sum, a) => sum + a.x, 0) / Math.max(1, anchors.length);

    if (!this.reducedMotion) {
      // Squeeze the actual tray sprites toward the trio centre, then burst.
      for (const i of trioIdx) {
        const card = slotCards[i];
        const sprite = card ? this.traySpritesById.get(card.id) : undefined;
        if (sprite?.active) {
          this.tweens.add({
            targets: sprite,
            x: sprite.x + (cx - sprite.x) * 0.45,
            scaleX: 0.72,
            scaleY: 0.72,
            duration: 130,
            ease: "Quad.easeIn",
          });
        }
      }
    }

    this.time.delayedCall(this.reducedMotion ? 0 : 130, () => {
      for (const a of anchors) {
        this.burstReveal(a.x, a.y, 0xffd98a);
        this.emitSparkles(a.x, a.y, 7, 0xffe9a8, 40);
      }
      this.burstReveal(cx, TRAY_TILE_Y, 0xfff3b0);
      this.emitSparkles(cx, TRAY_TILE_Y - 8, 10, 0xffd98a, 60);
    });

    // Escalating audio on a combo streak.
    if (this.matchStreak >= 2) this.sfx.play("combo");
    if (!this.reducedMotion) this.cameras.main.shake(140, 0.004);
    this.showMatchText(TRAY_TILE_Y, this.matchStreak);
  }

  /** Rising "Cleared!" / "Combo xN!" label on a match. */
  private showMatchText(trayY: number, streak: number): void {
    if (this.reducedMotion) return;
    const big = streak >= 2;
    const label = big
      ? this.locStr("matchCombo", "Combo x{n}!").replace("{n}", String(streak))
      : this.locStr("matchCleared", "Cleared!");
    const txt = this.add.text(DESIGN_W / 2, trayY - 52, label, {
      fontFamily: FONT,
      fontSize: big ? "22px" : "17px",
      fontStyle: "800",
      color: big ? "#ffcf4d" : "#ffe08a",
    }).setOrigin(0.5).setDepth(130).setStroke("#7a4a12", 5);
    this.tween({
      targets: txt,
      y: trayY - 96,
      alpha: 0,
      scaleX: big ? 1.25 : 1.1,
      scaleY: big ? 1.25 : 1.1,
      duration: 720,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  // ── Result routing (unchanged contract, restyled surface) ──────────────────

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

    // Daily two-level structure
    const playMode = this.str("playMode", "practice");
    const lvl = this.num("level", 1);
    const revives = this.num("revivesLeft", 0);
    const isDaily = playMode === "daily";

    let title = "";
    let titleColor = "#ffffff";
    let sub = "";
    let actionTxt = "";
    let actionFill: number = C.btnGreen;
    let active = true;

    if (status === "solved" && isDaily && lvl === 1) {
      // L1→L2 interstitial: 「第1关通过！」 → 进入第2关 (one tap).
      title = this.locStr("level1ClearedTitle", "Level 1 cleared!");
      sub = this.locStr("level1ClearedSub", "On to the devil level — ready?");
      actionTxt = this.locStr("enterLevel2", "Enter Level 2");
      active = !this.bool("isFinancialAction");
    } else if (status === "solved" && isDaily && lvl === 2) {
      title = this.locStr("dailyFullyClearedTitle", "Daily clear!");
      sub = this.locStr("dailyFullyClearedAny", "Fully cleared today — share your win!");
      actionTxt = this.locStr("backToRoutesAction", "Back to Routes");
      active = !this.bool("isFinancialAction");
    } else if (status === "solved") {
      title = canSettle ? this.locStr("wonTitle", "You Won") : this.locStr("creditedTitle", "Reward Credited");
      const payoutSub = this.locStr("payoutSub", "Payout: {payout}").replace("{payout}", payout);
      const creditSub = this.locStr("creditReadySub", "{amount} GAS is ready to withdraw").replace("{amount}", credit.toFixed(2));
      sub = canSettle
        ? (payout ? payoutSub : this.locStr("boardClearedSub", "Board cleared!"))
        : credit > 0 ? creditSub : this.locStr("boardVerifiedSub", "Board verified on-chain");
      actionTxt = canSettle
        ? this.locStr("claim", "Claim Reward")
        : credit > 0 ? this.locStr("withdraw", "Withdraw")
        : this.locStr("backToRoutes", "Back to Routes");
      active = !this.bool("isFinancialAction");
    } else if ((isGameOver || timedOut) && isDaily && lvl === 2 && revives > 0) {
      title = this.locStr("gameOverTitle", "Game Over");
      titleColor = "#ffb0a0";
      sub = this.locStr("reviveSub", "Tray full — use your revive to keep going?");
      actionTxt = this.locStr("reviveAction", "Revive ({left} left)").replace("{left}", String(revives));
      active = !this.bool("isFinancialAction");
    } else if ((isGameOver || timedOut) && isDaily && lvl === 2) {
      title = this.locStr("gameOverTitle", "Game Over");
      titleColor = "#ffb0a0";
      sub = this.locStr("retryLevel2Sub", "Out of revives — retry the devil level?");
      actionTxt = this.locStr("retryLevel2", "Retry Level 2");
      actionFill = C.btnAmber;
      active = !this.bool("isFinancialAction");
    } else if (isGameOver || timedOut) {
      title = timedOut ? this.locStr("timeUpTitle", "Time is up") : this.locStr("gameOverTitle", "Game Over");
      titleColor = "#ffb0a0";
      sub = timedOut
        ? this.locStr("timeUpSub", "The board is locked until it can be released.")
        : this.locStr("trayFullSub", "Tray is full — no more moves!");
      const enabled = isGuest || canExpire;
      actionTxt = isGuest
        ? this.locStr("tryAgain", "Try Again")
        : canExpire ? this.locStr("releaseReady", "Release game")
        : this.locStr("releaseWait", "Release later");
      actionFill = enabled ? C.btnAmber : 0x8f8a7c;
      active = enabled && !this.bool("isFinancialAction");
    }

    const panelY = DESIGN_H / 2 - 288 / 2 - 10;
    this.resultTitleTxts.forEach((txt, i) => {
      txt.setText(title);
      if (i === this.resultTitleTxts.length - 1) txt.setColor(titleColor);
    });
    this.resultSub.setText(sub);
    this.resultActionTxt.setText(actionTxt);
    this.paintResultAction(actionFill, panelY + 288 - 62);
    this.setResultButtonActive(active);

    const win = status === "solved";
    const animationKey = `${status}:${isGameOver ? "gameover" : "ok"}:${activeGameId}:${credit > 0 ? "credit" : "no-credit"}:${lvl}:${revives}`;
    const isNewCeremony = this.resultAnimationKey !== animationKey;
    // Mascot policy re-asserted EVERY update (setGroupActive force-shows all
    // children): visible + bouncing on a win, hidden on Game Over.
    this.playResultMascot(win, isNewCeremony);

    if (isNewCeremony) {
      this.resultAnimationKey = animationKey;
      this.resultGroup.setAlpha(0).setScale(0.85);
      this.tween({
        targets: this.resultGroup,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 280,
        ease: "Back.easeOut",
      });
      if (win) {
        this.emitConfetti();
        this.emitSparkles(DESIGN_W / 2, DESIGN_H / 2 - 60, 18, 0xffd98a, 120);
        this.burstReveal(DESIGN_W / 2, DESIGN_H / 2 - 60, 0xffd98a);
      } else if (isGameOver || timedOut) {
        if (!this.reducedMotion) {
          this.cameras.main.shake(180, 0.004);
          const flash = this.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W + 80, DESIGN_H + 80, 0xb83f32, 0)
            .setDepth(200);
          this.tween({ targets: flash, alpha: 0.18, yoyo: true, duration: 160, onComplete: () => flash.destroy() });
        }
      }
    }
  }

  private setResultButtonActive(active: boolean): void {
    if (this.resultActionBg.input) this.resultActionBg.input.enabled = active;
    this.resultActionBg.setAlpha(active ? 1 : 0.82);
    this.resultActionTxt.setAlpha(active ? 1 : 0.7);
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

    // Daily two-level routing
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

  // ── Keyboard controls ──────────────────────────────────────────────────────

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
      const onHome = status === "idle" || status === "expired" || status === "refunded";
      if (onHome && event.code === "Enter") {
        if (this.canStartNewRun()) {
          this.dispatch("startGame", { mode: "daily", level: 1 });
          event.preventDefault();
        }
        return;
      }
      if (onHome && digitMatch) {
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
