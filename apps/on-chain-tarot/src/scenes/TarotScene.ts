/**
 * TarotScene - Phaser 3 Neo tarot reading desk.
 *
 * Chain behavior stays in useTarot/main.tsx. This scene owns the playable
 * surface: choose a reading intent, draw the on-chain spread, deal three real
 * Neo tarot cards, reveal them one by one, or start a new reading.
 *
 * Layout is computed responsively from the live canvas size (the host shrinks
 * the game on mobile), so the intent chips, spread, action button and status
 * never collide at any viewport. Every user-visible string is localized: React
 * feeds a `sceneText` bridge field (see PhaserPlayArea) read with EN fallbacks.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import { TAROT_CARD_BACK, TAROT_DECK } from "../data/tarot-data";

const TAROT_ASSETS = {
  table: "tarot-reading-table",
  back: "tarot-card-back",
} as const;

const C = {
  canvas: 0xfffbef,
  surface: 0xffffff,
  surfaceWarm: 0xfff7e8,
  plate: 0xf6ead2,
  jade: 0x0b6257,
  jadeDeep: 0x06443d,
  gold: 0xdca84a,
  goldDeep: 0x9a681c,
  stroke: 0xead7ad,
  ink: 0x2b2418,
  muted: 0x7b6a54,
  disabled: 0xd9cbb7,
  vignette: 0x2a1c08,
  danger: 0xd84d3f,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
// Base card geometry — actual on-screen size is derived per rebuild to fit the
// available height (CARD_W/CARD_H only fix the aspect ratio).
const CARD_W = 88;
const CARD_H = 148;
const ACTION_W = 260;
const POSITIONS = ["Past", "Present", "Future"] as const;
const DEFAULT_INTENTS = [
  { label: "Clarity", question: "What needs clarity right now?" },
  { label: "Decision", question: "Which path should I choose?" },
  { label: "Momentum", question: "Where is momentum building?" },
] as const;

type CardData = {
  id?: number;
  name?: string;
  image?: string;
  backImage?: string;
  keywords?: string[];
  suitLabel?: string;
  arcana?: string;
  flipped?: boolean;
};

type IntentOption = {
  label: string;
  question: string;
};

type TarotLayout = {
  W: number;
  H: number;
  titleY: number;
  taglineY: number;
  deskTop: number;
  deskH: number;
  chipY: number;
  cardW: number;
  cardH: number;
  cardCenterY: number;
  startX: number;
  gap: number;
  creamTop: number;
  creamH: number;
  actionY: number;
  statusY: number;
};

type CardView = {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Graphics;
  emptyGroup: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  emptyIndex: Phaser.GameObjects.Text;
  flipped: boolean;
  cardKey: string;
};

function cardKey(id: number): string {
  return `tarot-card-${id}`;
}

function cardById(id: number | undefined): CardData | undefined {
  if (!Number.isInteger(id)) return undefined;
  return TAROT_DECK.find((card) => card.id === id);
}

function compactError(value: string): string {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > 66 ? `${firstLine.slice(0, 63)}...` : firstLine;
}

function keywordsFor(card: CardData): string {
  const keywords = card.keywords?.filter(Boolean).slice(0, 2) ?? [];
  if (keywords.length > 0) return keywords.join(" / ");
  return card.suitLabel || card.arcana || "Oracle";
}

function intentOptionsFromState(value: unknown): IntentOption[] {
  if (!Array.isArray(value)) return [...DEFAULT_INTENTS];
  const options = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const label = String(entry.label ?? "").trim();
      const question = String(entry.question ?? "").trim();
      return label && question ? { label, question } : null;
    })
    .filter((item): item is IntentOption => Boolean(item));
  return options.length ? options.slice(0, 3) : [...DEFAULT_INTENTS];
}

export class TarotScene extends BaseScene {
  private tableImage!: Phaser.GameObjects.Image;
  private deckStack!: Phaser.GameObjects.Container;
  private deckCaption!: Phaser.GameObjects.Text;
  private taglineLabel!: Phaser.GameObjects.Text;
  private focusLabel!: Phaser.GameObjects.Text;
  private titleLabel!: Phaser.GameObjects.Text;
  private questionText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Container;
  private actionButtonBg!: Phaser.GameObjects.Graphics;
  private actionButtonLabel!: Phaser.GameObjects.Text;
  private intentButtons: Phaser.GameObjects.Container[] = [];
  private cardViews: CardView[] = [];
  private layout!: TarotLayout;
  private dealtOnce = false;
  private ambientTweens: Phaser.Tweens.Tween[] = [];
  private readingChimed = false;
  private lastRevealAt = 0;

  constructor() {
    super("TarotScene");
  }

  preload(): void {
    this.load.image(TAROT_ASSETS.table, "./tarot-reading-table.webp");
    this.load.image(TAROT_ASSETS.back, TAROT_CARD_BACK);
    TAROT_DECK.forEach((card) => {
      this.load.image(cardKey(card.id), card.image);
    });
  }

  create(): void {
    super.create();
    this.input.on("pointerdown", () => this.sfx.unlock());
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }

  private computeLayout(W: number, H: number): TarotLayout {
    const deskTop = 66;
    const deskH = 148;
    const deskBottom = deskTop + deskH; // 214
    const chipY = deskBottom - 20; // 194 — intent chips sit in the desk's lower strip
    const cardZoneTop = deskBottom + 8; // 222

    const actionY = H - 54;
    const actionTop = actionY - 22;
    const statusY = H - 15;

    // Cards shrink on short (mobile) canvases so the spread + labels always
    // clear the bottom action band. Aspect ratio is preserved from CARD_W/CARD_H.
    const cardH = Math.round(Math.min(CARD_H, Math.max(112, H - 340)));
    const cardW = Math.round(cardH * (CARD_W / CARD_H));
    const gap = cardW + 24;

    const blockH = cardH + 37; // card + label + two-line meta
    const zoneBottom = actionTop - 5;
    const slack = Math.max(0, zoneBottom - cardZoneTop - blockH);
    const cardTop = cardZoneTop + slack / 2;
    const cardCenterY = cardTop + cardH / 2;

    const creamTop = cardZoneTop - 4;
    const creamH = actionTop - 4 - creamTop;

    return {
      W,
      H,
      titleY: 34,
      taglineY: 55,
      deskTop,
      deskH,
      chipY,
      cardW,
      cardH,
      cardCenterY,
      startX: W / 2 - gap,
      gap,
      creamTop,
      creamH,
      actionY,
      statusY,
    };
  }

  private rebuildScene(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.intentButtons = [];
    this.cardViews = [];
    this.ambientTweens = [];
    this.dealtOnce = false;

    const { width: W, height: H } = this.scale;
    this.layout = this.computeLayout(W, H);

    this.buildBackground(W, H);
    this.buildHeader(W);
    this.buildDesk(W);
    this.buildSpread(W);
    this.buildIntentButtons(W);
    this.buildActionButton(W, H);
    this.buildStatus(W, H);
    this.startAmbientMotion();
  }

  // ── Localized-string helpers (fed via the `sceneText` bridge field) ────────

  private sceneStr(key: string, fallback: string): string {
    const text = this.val<Record<string, unknown>>("sceneText", undefined);
    const value = text?.[key];
    return typeof value === "string" && value ? value : fallback;
  }

  private scenePositions(): readonly string[] {
    const text = this.val<Record<string, unknown>>("sceneText", undefined);
    const positions = text?.positions;
    if (
      Array.isArray(positions) &&
      positions.length === 3 &&
      positions.every((entry) => typeof entry === "string" && entry)
    ) {
      return positions as string[];
    }
    return POSITIONS;
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.titleLabel || !this.statusText || !this.actionButton) return;

    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");
    const isLoading = this.bool("isLoading");
    const question = this.str("question", "");
    const revealedCount = drawn.filter((card) => card.flipped).length;

    // Static localized chrome (may arrive after the first build) — refresh here.
    this.taglineLabel?.setText(
      this.sceneStr("tagline", "Neo N3 · 0.1 GAS verified draw"),
    );
    this.focusLabel?.setText(this.sceneStr("focusLabel", "Focus"));
    this.deckCaption?.setText(this.sceneStr("tapToDraw", "Tap to draw"));
    this.deckCaption?.setVisible(!hasDrawn && !isLoading);

    this.titleLabel.setText(
      isLoading
        ? this.sceneStr("drawing", "Drawing from Neo N3")
        : allFlipped
          ? this.sceneStr("verified", "On-chain verified")
          : hasDrawn
            ? this.sceneStr("tapToReveal", "Tap cards to reveal")
            : this.sceneStr("chooseIntent", "Choose an intent"),
    );
    this.questionText.setText(
      question || this.sceneStr("focusFallback", "Set the tone for this spread."),
    );
    this.statusText.setText(
      isLoading
        ? this.sceneStr(
            "drawingStatus",
            "Wallet confirms the draw, then the contract seals the spread.",
          )
        : !hasDrawn
          ? this.sceneStr(
              "idleStatus",
              "Pick an intent, then draw three cards on-chain.",
            )
          : allFlipped
            ? this.sceneStr(
                "revealedStatus",
                "All three cards are revealed from the contract reading.",
              )
            : this.sceneStr("revealCount", "{revealed} / 3 revealed").replace(
                "{revealed}",
                String(revealedCount),
              ),
    );
    this.statusText.setColor("#7b6a54");

    this.intentButtons.forEach((button) => button.setVisible(!hasDrawn && !isLoading));
    this.updateActionButton(hasDrawn, allFlipped, isLoading);
    this.updateCards(drawn, isLoading);

    if (allFlipped && hasDrawn) {
      if (!this.readingChimed) {
        this.readingChimed = true;
        // Gentle closing chord once the full reading is revealed.
        this.sfx.tones([
          { frequency: 523, duration: 0.22, delay: 0.3, type: "sine", gain: 0.018 },
          { frequency: 659, duration: 0.24, delay: 0.36, type: "sine", gain: 0.016 },
          { frequency: 784, duration: 0.3, delay: 0.42, type: "sine", gain: 0.014 },
        ]);
        this.playReadingCelebration();
      }
    } else {
      this.readingChimed = false;
    }
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusText?.setText(compactError(error.message));
    this.statusText?.setColor("#d84d3f");
  }

  private buildBackground(W: number, H: number): void {
    const L = this.layout;
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const shell = this.add.graphics();
    shell.fillStyle(0xfff6df, 1);
    shell.fillRoundedRect(14, 14, W - 28, H - 28, 24);
    shell.lineStyle(1, C.stroke, 1);
    shell.strokeRoundedRect(14, 14, W - 28, H - 28, 24);

    // Cream reading panel — the three-card spread sits cleanly on this, below
    // the desk photo, so no baked table silhouettes ghost behind the cards.
    shell.fillStyle(C.surface, 0.82);
    shell.fillRoundedRect(26, L.creamTop, W - 52, L.creamH, 22);
    shell.lineStyle(1, C.stroke, 0.9);
    shell.strokeRoundedRect(26, L.creamTop, W - 52, L.creamH, 22);
  }

  private buildHeader(W: number): void {
    const L = this.layout;
    this.titleLabel = this.add.text(W / 2, L.titleY, "Choose an intent", {
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    // Repurposed subtitle: an on-chain cue instead of a Past/Present/Future
    // line that would just repeat the labeled spread below.
    this.taglineLabel = this.add.text(W / 2, L.taglineY, "Neo N3 · 0.1 GAS verified draw", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "700",
      color: "#9a681c",
    }).setOrigin(0.5);
  }

  private buildDesk(W: number): void {
    const L = this.layout;
    const deskTop = L.deskTop;
    const deskH = L.deskH;

    const frame = this.add.graphics();
    frame.fillStyle(0xffffff, 0.7);
    frame.fillRoundedRect(24, deskTop, W - 48, deskH, 20);

    this.tableImage = this.add.image(W / 2, deskTop + deskH / 2, TAROT_ASSETS.table);
    this.tableImage.setDisplaySize(W - 48, deskH);
    this.tableImage.setAlpha(0.72);

    // Warm vignette + framing so the mystic desk feels deliberate and the green
    // card backs pop instead of floating over washed, low-contrast photo noise.
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(C.vignette, C.vignette, C.vignette, C.vignette, 0.36, 0.36, 0, 0);
    vignette.fillRoundedRect(24, deskTop, W - 48, deskH * 0.6, { tl: 20, tr: 20, bl: 0, br: 0 });
    vignette.fillGradientStyle(C.vignette, C.vignette, C.vignette, C.vignette, 0, 0, 0.34, 0.34);
    vignette.fillRoundedRect(24, deskTop + deskH * 0.4, W - 48, deskH * 0.6, { tl: 0, tr: 0, bl: 20, br: 20 });
    vignette.fillStyle(C.goldDeep, 0.05);
    vignette.fillRoundedRect(24, deskTop, W - 48, deskH, 20);

    frame.lineStyle(1.5, C.gold, 0.55);
    frame.strokeRoundedRect(24, deskTop, W - 48, deskH, 20);

    // Tappable deck stack (draws the spread) — upper-left of the desk.
    this.deckStack = this.add.container(70, deskTop + 42);
    for (let i = 0; i < 3; i++) {
      const card = this.add.image(i * 6, i * 4, TAROT_ASSETS.back);
      card.setDisplaySize(52, 86);
      card.setRotation(Phaser.Math.DegToRad(-4 + i * 4));
      this.deckStack.add(card);
    }
    const deckHit = this.add.rectangle(6, 4, 76, 104, 0xffffff, 0.001);
    deckHit.setInteractive();
    this.bindGameButton(deckHit, {
      targets: this.deckStack,
      hoverScale: 1.035,
      pressScale: 0.96,
      enabled: () => this.canDrawFromDeck(),
      onPress: () => {
        this.sfx.play("start");
        this.dispatch("draw");
      },
    });
    this.deckStack.add(deckHit);

    // Caption clarifying the deck is interactive.
    this.deckCaption = this.add.text(70, deskTop + 102, "Tap to draw", {
      fontFamily: FONT,
      fontSize: "9px",
      fontStyle: "700",
      color: "#0b6257",
    }).setOrigin(0.5);

    // Focus slip — right of the deck with a clear gap between the two.
    const slipX = 116;
    const slipW = W - slipX - 30;
    const slipTop = deskTop + 24;
    const slip = this.add.graphics();
    slip.fillStyle(C.surface, 0.95);
    slip.fillRoundedRect(slipX, slipTop, slipW, 60, 15);
    slip.lineStyle(1, C.stroke, 1);
    slip.strokeRoundedRect(slipX, slipTop, slipW, 60, 15);
    this.focusLabel = this.add.text(slipX + 16, slipTop + 10, "Focus", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "700",
      color: "#9a681c",
    });
    this.questionText = this.add.text(slipX + 16, slipTop + 26, "Set the tone for this spread.", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#2b2418",
      wordWrap: { width: slipW - 30 },
      lineSpacing: 1,
    });
  }

  private buildSpread(_W: number): void {
    const L = this.layout;
    for (let i = 0; i < 3; i++) {
      const x = L.startX + i * L.gap;
      const y = L.cardCenterY;
      const view = this.makeCardView(x, y, i);
      this.cardViews.push(view);
    }
  }

  private makeCardView(x: number, y: number, index: number): CardView {
    const cardW = this.layout.cardW;
    const cardH = this.layout.cardH;
    const container = this.add.container(x, y);

    const shadow = this.add.rectangle(4, 8, cardW, cardH, 0x8c713a, 0.18);
    shadow.setOrigin(0.5);
    shadow.setAngle(-1);

    // Opaque parchment slot plate — guarantees the card sits on a clean base
    // and never lets a background silhouette ghost through.
    const plate = this.add.graphics();
    plate.fillStyle(C.plate, 1);
    plate.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 11);
    plate.lineStyle(1, C.stroke, 1);
    plate.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 11);

    const frame = this.add.graphics();
    frame.lineStyle(2, C.gold, 0.44);
    frame.strokeRoundedRect(-cardW / 2 - 5, -cardH / 2 - 5, cardW + 10, cardH + 10, 13);

    // Distinct empty-slot treatment: a dimmed dashed inset + a small clean disc
    // holding the position index, clearly different from a drawn-but-sealed back.
    const discR = Math.round(cardW * 0.2);
    const emptyGroup = this.add.container(0, 0);
    const emptyGfx = this.add.graphics();
    emptyGfx.fillStyle(C.plate, 0.55);
    emptyGfx.fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 6, cardW - 12, cardH - 12, 9);
    this.drawDashedRect(emptyGfx, -cardW / 2 + 6, -cardH / 2 + 6, cardW - 12, cardH - 12, C.gold, 0.5);
    const disc = this.add.graphics();
    disc.fillStyle(C.white, 0.96);
    disc.fillCircle(0, -6, discR);
    disc.lineStyle(1.5, C.jade, 0.8);
    disc.strokeCircle(0, -6, discR);
    const emptyIndex = this.add.text(0, -6, String(index + 1), {
      fontFamily: FONT,
      fontSize: `${Math.round(cardW * 0.18)}px`,
      fontStyle: "800",
      color: "#0b6257",
    }).setOrigin(0.5);
    emptyGroup.add([emptyGfx, disc, emptyIndex]);

    const back = this.add.image(0, 0, TAROT_ASSETS.back);
    back.setDisplaySize(cardW, cardH);
    back.setAlpha(0);
    const face = this.add.image(0, 0, TAROT_ASSETS.back);
    face.setDisplaySize(cardW, cardH);
    face.setAlpha(0);

    const label = this.add.text(0, cardH / 2 + 12, POSITIONS[index]!, {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    const meta = this.add.text(0, cardH / 2 + 26, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: cardW + 22 },
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, cardW + 12, cardH + 12, 0xffffff, 0.001);
    hit.setInteractive();
    this.bindGameButton(hit, {
      targets: container,
      hoverScale: 1.035,
      pressScale: 0.96,
      enabled: () => this.canFlip(index),
      onPress: () => {
        this.sfx.play("tap");
        this.dispatch("flipCard", index);
      },
    });

    container.add([shadow, plate, frame, emptyGroup, back, face, label, meta, hit]);

    return {
      container,
      plate,
      emptyGroup,
      back,
      face,
      frame,
      label,
      meta,
      emptyIndex,
      flipped: false,
      cardKey: TAROT_ASSETS.back,
    };
  }

  private drawDashedRect(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha: number,
  ): void {
    gfx.lineStyle(1, color, alpha);
    const dash = 5;
    const gap = 4;
    const step = dash + gap;
    for (let px = x; px < x + w; px += step) {
      const end = Math.min(px + dash, x + w);
      gfx.lineBetween(px, y, end, y);
      gfx.lineBetween(px, y + h, end, y + h);
    }
    for (let py = y; py < y + h; py += step) {
      const end = Math.min(py + dash, y + h);
      gfx.lineBetween(x, py, x, end);
      gfx.lineBetween(x + w, py, x + w, end);
    }
  }

  private buildIntentButtons(W: number): void {
    const L = this.layout;
    const options = intentOptionsFromState(this.val("intentOptions", null));
    options.forEach((option, index) => {
      const x = W / 2 + (index - 1) * 108;
      const button = this.add.container(x, L.chipY);
      const bg = this.add.graphics();
      this.renderIntentButton(bg, false);
      bg.setInteractive(new Phaser.Geom.Rectangle(-48, -19, 96, 38), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: button,
        pressScale: 0.95,
        onPress: () => {
          this.sfx.play("select");
          this.dispatch("setQuestion", option.question);
        },
        onHoverIn: () => this.renderIntentButton(bg, true),
        onHoverOut: () => this.renderIntentButton(bg, false),
      });
      const label = this.add.text(0, 0, option.label, {
        fontFamily: FONT,
        fontSize: "12px",
        fontStyle: "800",
        color: "#0b6257",
      }).setOrigin(0.5);
      button.add([bg, label]);
      this.intentButtons.push(button);
    });
  }

  private renderIntentButton(bg: Phaser.GameObjects.Graphics, hover: boolean): void {
    bg.clear();
    bg.fillStyle(hover ? 0xf1fff7 : C.surface, 0.96);
    bg.fillRoundedRect(-48, -19, 96, 38, 12);
    bg.lineStyle(hover ? 2 : 1, hover ? C.jade : C.stroke, 1);
    bg.strokeRoundedRect(-48, -19, 96, 38, 12);
  }

  private buildActionButton(W: number, _H: number): void {
    this.actionButton = this.add.container(W / 2, this.layout.actionY);
    this.actionButtonBg = this.add.graphics();
    this.actionButtonLabel = this.add.text(0, 0, "Draw Cards", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "800",
      color: "#fff7dc",
    }).setOrigin(0.5);
    this.actionButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-ACTION_W / 2, -22, ACTION_W, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.actionButtonBg, {
      targets: this.actionButton,
      pressScale: 0.96,
      enabled: () => !this.bool("isLoading"),
      onPress: () => this.handleActionPress(),
    });
    this.actionButton.add([this.actionButtonBg, this.actionButtonLabel]);
  }

  private buildStatus(W: number, _H: number): void {
    this.statusText = this.add.text(W / 2, this.layout.statusY, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: W - 56 },
    }).setOrigin(0.5);
  }

  private updateActionButton(hasDrawn: boolean, allFlipped: boolean, isLoading: boolean): void {
    const label = isLoading
      ? this.sceneStr("actionDrawing", "Drawing...")
      : allFlipped
        ? this.sceneStr("actionNew", "New Reading")
        : hasDrawn
          ? this.sceneStr("actionReveal", "Reveal Spread")
          : this.sceneStr("actionDraw", "Draw Cards");

    this.actionButtonLabel.setText(label);
    this.actionButtonBg.clear();
    this.actionButtonBg.fillStyle(isLoading ? C.disabled : C.jade, 1);
    this.actionButtonBg.fillRoundedRect(-ACTION_W / 2, -22, ACTION_W, 44, 15);
    this.actionButtonBg.fillStyle(C.white, isLoading ? 0.08 : 0.16);
    this.actionButtonBg.fillRoundedRect(-ACTION_W / 2, -22, ACTION_W, 16, { tl: 15, tr: 15, bl: 0, br: 0 });
    this.actionButtonBg.lineStyle(2, isLoading ? C.stroke : C.gold, 0.9);
    this.actionButtonBg.strokeRoundedRect(-ACTION_W / 2, -22, ACTION_W, 44, 15);
    this.actionButtonLabel.setColor(isLoading ? "#7b6a54" : "#fff7dc");
  }

  private updateCards(drawn: CardData[], isLoading: boolean): void {
    const positions = this.scenePositions();
    const cardW = this.layout.cardW;
    const cardH = this.layout.cardH;

    if (!drawn.length) {
      this.dealtOnce = false;
      this.cardViews.forEach((view, index) => this.setEmptyCard(view, index));
      return;
    }

    drawn.slice(0, 3).forEach((rawCard, index) => {
      const view = this.cardViews[index];
      if (!view) return;
      const card = this.normalizeCard(rawCard);
      const key = this.cardTextureKey(card);

      if (view.cardKey !== key) {
        view.face.setTexture(key);
        view.face.setDisplaySize(cardW, cardH);
        view.cardKey = key;
      }
      view.emptyGroup.setVisible(false);
      view.label.setText(positions[index]!);
      view.meta.setText(
        card.flipped
          ? `${card.name ?? "Unknown"}\n${keywordsFor(card)}`
          : this.sceneStr("sealed", "Sealed card"),
      );

      if (card.flipped) {
        if (!view.flipped) this.flipCardView(view);
      } else {
        view.flipped = false;
        view.back.setAlpha(1);
        view.face.setAlpha(0);
      }
    });

    if (!this.dealtOnce && !isLoading) {
      this.dealtOnce = true;
      this.playDealMotion();
    }
  }

  private normalizeCard(card: CardData): CardData {
    const fromDeck = cardById(card.id);
    return {
      ...fromDeck,
      ...card,
      image: card.image || fromDeck?.image || TAROT_CARD_BACK,
      backImage: card.backImage || TAROT_CARD_BACK,
      keywords: card.keywords || fromDeck?.keywords || ["Oracle"],
      name: card.name || fromDeck?.name || "Unknown card",
    };
  }

  private cardTextureKey(card: CardData): string {
    if (Number.isInteger(card.id) && cardById(card.id)) return cardKey(card.id as number);
    return TAROT_ASSETS.back;
  }

  private setEmptyCard(view: CardView, index: number): void {
    const positions = this.scenePositions();
    const cardW = this.layout.cardW;
    const cardH = this.layout.cardH;
    view.flipped = false;
    view.cardKey = TAROT_ASSETS.back;
    view.back.setTexture(TAROT_ASSETS.back).setAlpha(0);
    view.back.setDisplaySize(cardW, cardH);
    view.face.setTexture(TAROT_ASSETS.back).setAlpha(0);
    view.face.setDisplaySize(cardW, cardH);
    view.emptyIndex.setText(String(index + 1));
    view.emptyGroup.setVisible(true);
    view.label.setText(positions[index]!);
    view.meta.setText(this.sceneStr("awaiting", "Awaiting draw"));
    view.container.setAlpha(1).setScale(1);
  }

  private canFlip(index: number): boolean {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const card = drawn[index];
    return Boolean(card && !card.flipped && !this.bool("isLoading"));
  }

  private canDrawFromDeck(): boolean {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    return drawn.length === 0 && !this.bool("hasDrawn") && !this.bool("isLoading");
  }

  private flipCardView(view: CardView): void {
    view.flipped = true;
    view.emptyGroup.setVisible(false);
    if (this.time.now - this.lastRevealAt > 120) {
      this.lastRevealAt = this.time.now;
      this.sfx.play("reveal");
    }
    if (this.reducedMotion) {
      view.back.setAlpha(0);
      view.face.setAlpha(1);
      return;
    }

    this.animate({
      targets: view.container,
      scaleX: 0,
      duration: 120,
      ease: "Sine.easeIn",
      onComplete: () => {
        view.back.setAlpha(0);
        view.face.setAlpha(1);
        this.animate({
          targets: view.container,
          scaleX: 1,
          duration: 170,
          ease: "Back.easeOut",
        });
      },
    });
  }

  private playDealMotion(): void {
    const deckX = this.deckStack.x + 18;
    const deckY = this.deckStack.y + 12;

    // One shuffle tick per dealt card, matching the 150ms deal stagger.
    this.sfx.tones([
      { frequency: 310, duration: 0.025, type: "square", gain: 0.012, endFrequency: 220 },
      { frequency: 310, duration: 0.025, delay: 0.15, type: "square", gain: 0.012, endFrequency: 220 },
      { frequency: 310, duration: 0.025, delay: 0.3, type: "square", gain: 0.012, endFrequency: 220 },
    ]);

    this.cardViews.forEach((view, index) => {
      const targetX = view.container.x;
      const targetY = view.container.y;
      const startAngle = -7 + index * 7;
      view.container
        .setAlpha(0)
        .setScale(0.7)
        .setPosition(deckX, deckY)
        .setAngle(startAngle);
      this.animate({
        targets: view.container,
        x: targetX,
        y: targetY,
        alpha: 1,
        scale: 1,
        angle: 0,
        delay: index * 150,
        duration: 430,
        ease: "Cubic.easeOut",
      });
    });
  }

  private playReadingCelebration(): void {
    if (this.reducedMotion) return;
    this.cardViews.forEach((view, index) => {
      // Gentle staggered pulse to celebrate the completed reading. Scale is used
      // (not y) because the ambient float already owns each container's y.
      this.animate({
        targets: view.container,
        scale: 1.06,
        delay: index * 90,
        duration: 240,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
      // A couple of rising gold motes per card.
      for (let s = 0; s < 3; s++) {
        const mote = this.add.circle(
          view.container.x + Phaser.Math.Between(-18, 18),
          view.container.y + Phaser.Math.Between(-30, 20),
          Phaser.Math.Between(2, 3),
          C.gold,
          0.9,
        );
        this.animate({
          targets: mote,
          y: mote.y - Phaser.Math.Between(30, 52),
          alpha: 0,
          delay: index * 90 + s * 70,
          duration: 720,
          ease: "Sine.easeOut",
          onComplete: () => mote.destroy(),
        });
      }
    });
  }

  private handleActionPress(): void {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");

    if (allFlipped) {
      this.sfx.play("tap");
      this.dispatch("reset");
      return;
    }

    if (hasDrawn) {
      this.sfx.play("tap");
      drawn.slice(0, 3).forEach((card, index) => {
        if (!card.flipped) this.dispatch("flipCard", index);
      });
      return;
    }

    this.sfx.play("start");
    this.dispatch("draw");
  }

  private startAmbientMotion(): void {
    if (this.reducedMotion) return;
    const deckTween = this.animate({
      targets: this.deckStack,
      y: this.deckStack.y - 4,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    if (deckTween) this.ambientTweens.push(deckTween);
    this.cardViews.forEach((view, index) => {
      const tween = this.animate({
        targets: view.container,
        y: view.container.y - 3,
        delay: index * 130,
        duration: 1900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      if (tween) this.ambientTweens.push(tween);
    });
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }
}
