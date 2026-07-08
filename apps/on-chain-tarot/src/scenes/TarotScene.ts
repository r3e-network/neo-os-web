/**
 * TarotScene - Phaser 3 Neo tarot reading desk.
 *
 * Chain behavior stays in useTarot/main.tsx. This scene owns the playable
 * surface: choose a reading intent, draw the on-chain spread, deal three real
 * Neo tarot cards, reveal them one by one, or start a new reading.
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
  jade: 0x0b6257,
  jadeDeep: 0x06443d,
  gold: 0xdca84a,
  goldDeep: 0x9a681c,
  stroke: 0xead7ad,
  ink: 0x2b2418,
  muted: 0x7b6a54,
  disabled: 0xd9cbb7,
  danger: 0xd84d3f,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const CARD_W = 92;
const CARD_H = 159;
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

type CardView = {
  container: Phaser.GameObjects.Container;
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
  private titleLabel!: Phaser.GameObjects.Text;
  private questionText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Container;
  private actionButtonBg!: Phaser.GameObjects.Graphics;
  private actionButtonLabel!: Phaser.GameObjects.Text;
  private intentButtons: Phaser.GameObjects.Container[] = [];
  private cardViews: CardView[] = [];
  private dealtOnce = false;
  private ambientTweens: Phaser.Tweens.Tween[] = [];

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
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }

  private rebuildScene(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.intentButtons = [];
    this.cardViews = [];
    this.ambientTweens = [];
    this.dealtOnce = false;

    const { width: W, height: H } = this.scale;

    this.buildBackground(W, H);
    this.buildHeader(W);
    this.buildDesk(W);
    this.buildSpread(W);
    this.buildIntentButtons(W);
    this.buildActionButton(W, H);
    this.buildStatus(W, H);
    this.startAmbientMotion();
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.titleLabel || !this.statusText || !this.actionButton) return;

    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");
    const isLoading = this.bool("isLoading");
    const question = this.str("question", "");
    const revealedCount = drawn.filter((card) => card.flipped).length;

    this.titleLabel.setText(
      isLoading
        ? "Drawing from Neo N3"
        : allFlipped
          ? "On-chain verified"
          : hasDrawn
            ? "Tap cards to reveal"
            : "Choose an intent",
    );
    this.questionText.setText(question || "Set the tone for this spread.");
    this.statusText.setText(
      isLoading
        ? "Wallet confirms the draw, then the contract seals the spread."
        : !hasDrawn
          ? "Pick an intent, then draw three cards on-chain."
          : allFlipped
            ? "All three cards are revealed from the contract reading."
            : `${revealedCount} / 3 revealed`,
    );
    this.statusText.setColor("#7b6a54");

    this.intentButtons.forEach((button) => button.setVisible(!hasDrawn && !isLoading));
    this.updateActionButton(hasDrawn, allFlipped, isLoading);
    this.updateCards(drawn, isLoading);
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusText?.setText(compactError(error.message));
    this.statusText?.setColor("#d84d3f");
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const shell = this.add.graphics();
    shell.fillStyle(0xfff6df, 1);
    shell.fillRoundedRect(14, 14, W - 28, H - 28, 24);
    shell.lineStyle(1, C.stroke, 1);
    shell.strokeRoundedRect(14, 14, W - 28, H - 28, 24);

    shell.fillStyle(C.surface, 0.72);
    shell.fillRoundedRect(26, 302, W - 52, 214, 22);
    shell.lineStyle(1, C.stroke, 0.9);
    shell.strokeRoundedRect(26, 302, W - 52, 214, 22);
  }

  private buildHeader(W: number): void {
    this.titleLabel = this.add.text(W / 2, 43, "Choose an intent", {
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    this.add.text(W / 2, 67, "Past / Present / Future", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#7b6a54",
    }).setOrigin(0.5);
  }

  private buildDesk(W: number): void {
    const frame = this.add.graphics();
    frame.fillStyle(0xffffff, 0.7);
    frame.fillRoundedRect(24, 90, W - 48, 208, 22);
    frame.lineStyle(1, C.stroke, 1);
    frame.strokeRoundedRect(24, 90, W - 48, 208, 22);

    this.tableImage = this.add.image(W / 2, 194, TAROT_ASSETS.table);
    this.tableImage.setDisplaySize(372, 208);
    this.tableImage.setAlpha(0.58);

    this.add.rectangle(W / 2, 250, W - 52, 98, 0xffffff, 0.66);

    this.deckStack = this.add.container(76, 142);
    for (let i = 0; i < 3; i++) {
      const card = this.add.image(i * 6, i * 4, TAROT_ASSETS.back);
      card.setDisplaySize(58, 100);
      card.setRotation(Phaser.Math.DegToRad(-4 + i * 4));
      this.deckStack.add(card);
    }
    const deckHit = this.add.rectangle(8, 6, 86, 126, 0xffffff, 0.001);
    deckHit.setInteractive();
    this.bindGameButton(deckHit, {
      targets: this.deckStack,
      hoverScale: 1.035,
      pressScale: 0.96,
      enabled: () => this.canDrawFromDeck(),
      onPress: () => this.dispatch("draw"),
    });
    this.deckStack.add(deckHit);

    const slip = this.add.graphics();
    slip.fillStyle(C.surface, 0.94);
    slip.fillRoundedRect(134, 112, 238, 62, 16);
    slip.lineStyle(1, C.stroke, 1);
    slip.strokeRoundedRect(134, 112, 238, 62, 16);
    this.add.text(154, 126, "Focus", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "700",
      color: "#9a681c",
    });
    this.questionText = this.add.text(154, 143, "Set the tone for this spread.", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#2b2418",
      wordWrap: { width: 198 },
      lineSpacing: 1,
    });
  }

  private buildSpread(W: number): void {
    const startX = W / 2 - 118;
    for (let i = 0; i < 3; i++) {
      const x = startX + i * 118;
      const y = 292;
      const view = this.makeCardView(x, y, i);
      this.cardViews.push(view);
    }
  }

  private makeCardView(x: number, y: number, index: number): CardView {
    const container = this.add.container(x, y);

    const shadow = this.add.rectangle(4, 8, CARD_W, CARD_H, 0x8c713a, 0.18);
    shadow.setOrigin(0.5);
    shadow.setAngle(-1);

    const frame = this.add.graphics();
    frame.lineStyle(2, C.gold, 0.44);
    frame.strokeRoundedRect(-CARD_W / 2 - 5, -CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10, 13);

    const back = this.add.image(0, 0, TAROT_ASSETS.back);
    back.setDisplaySize(CARD_W, CARD_H);
    const face = this.add.image(0, 0, TAROT_ASSETS.back);
    face.setDisplaySize(CARD_W, CARD_H);
    face.setAlpha(0);

    const emptyIndex = this.add.text(0, 0, String(index + 1), {
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "800",
      color: "#fff7db",
    }).setOrigin(0.5);
    emptyIndex.setAlpha(0.8);

    const label = this.add.text(0, CARD_H / 2 + 18, POSITIONS[index]!, {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    const meta = this.add.text(0, CARD_H / 2 + 36, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: 108 },
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, CARD_W + 12, CARD_H + 12, 0xffffff, 0.001);
    hit.setInteractive();
    this.bindGameButton(hit, {
      targets: container,
      hoverScale: 1.035,
      pressScale: 0.96,
      enabled: () => this.canFlip(index),
      onPress: () => this.dispatch("flipCard", index),
    });

    container.add([shadow, frame, back, face, emptyIndex, label, meta, hit]);

    return {
      container,
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

  private buildIntentButtons(W: number): void {
    const options = intentOptionsFromState(this.val("intentOptions", null));
    options.forEach((option, index) => {
      const x = W / 2 + (index - 1) * 112;
      const button = this.add.container(x, 446);
      const bg = this.add.graphics();
      bg.fillStyle(C.surface, 0.94);
      bg.fillRoundedRect(-49, -22, 98, 44, 14);
      bg.lineStyle(1, C.stroke, 1);
      bg.strokeRoundedRect(-49, -22, 98, 44, 14);
      bg.setInteractive(new Phaser.Geom.Rectangle(-49, -22, 98, 44), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: button,
        pressScale: 0.95,
        onPress: () => this.dispatch("setQuestion", option.question),
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
    bg.fillRoundedRect(-49, -22, 98, 44, 14);
    bg.lineStyle(hover ? 2 : 1, hover ? C.jade : C.stroke, 1);
    bg.strokeRoundedRect(-49, -22, 98, 44, 14);
  }

  private buildActionButton(W: number, H: number): void {
    this.actionButton = this.add.container(W / 2, H - 64);
    this.actionButtonBg = this.add.graphics();
    this.actionButtonLabel = this.add.text(0, 0, "Draw Cards", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "800",
      color: "#fff7dc",
    }).setOrigin(0.5);
    this.actionButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-ACTION_W / 2, -25, ACTION_W, 50),
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

  private buildStatus(W: number, H: number): void {
    this.statusText = this.add.text(W / 2, H - 21, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: W - 56 },
    }).setOrigin(0.5);
  }

  private updateActionButton(hasDrawn: boolean, allFlipped: boolean, isLoading: boolean): void {
    const label = isLoading
      ? "Drawing..."
      : allFlipped
        ? "New Reading"
        : hasDrawn
          ? "Reveal Spread"
          : "Draw Cards";

    this.actionButtonLabel.setText(label);
    this.actionButtonBg.clear();
    this.actionButtonBg.fillStyle(isLoading ? C.disabled : C.jade, 1);
    this.actionButtonBg.fillRoundedRect(-ACTION_W / 2, -25, ACTION_W, 50, 16);
    this.actionButtonBg.fillStyle(C.white, isLoading ? 0.08 : 0.16);
    this.actionButtonBg.fillRoundedRect(-ACTION_W / 2, -25, ACTION_W, 18, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.actionButtonBg.lineStyle(2, isLoading ? C.stroke : C.gold, 0.9);
    this.actionButtonBg.strokeRoundedRect(-ACTION_W / 2, -25, ACTION_W, 50, 16);
    this.actionButtonLabel.setColor(isLoading ? "#7b6a54" : "#fff7dc");
  }

  private updateCards(drawn: CardData[], isLoading: boolean): void {
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
        view.face.setDisplaySize(CARD_W, CARD_H);
        view.cardKey = key;
      }
      view.emptyIndex.setVisible(false);
      view.label.setText(POSITIONS[index]!);
      view.meta.setText(card.flipped ? `${card.name ?? "Unknown"}\n${keywordsFor(card)}` : "Sealed card");

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
    view.flipped = false;
    view.cardKey = TAROT_ASSETS.back;
    view.back.setTexture(TAROT_ASSETS.back).setAlpha(1);
    view.back.setDisplaySize(CARD_W, CARD_H);
    view.face.setTexture(TAROT_ASSETS.back).setAlpha(0);
    view.face.setDisplaySize(CARD_W, CARD_H);
    view.emptyIndex.setText(String(index + 1)).setVisible(true);
    view.label.setText(POSITIONS[index]!);
    view.meta.setText("Awaiting draw");
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

  private handleActionPress(): void {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");

    if (allFlipped) {
      this.dispatch("reset");
      return;
    }

    if (hasDrawn) {
      drawn.slice(0, 3).forEach((card, index) => {
        if (!card.flipped) this.dispatch("flipCard", index);
      });
      return;
    }

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
