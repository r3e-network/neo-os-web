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
  ritual: "tarot-ritual-table",
  logo: "tarot-logo",
  back: "tarot-card-back",
  clarity: "tarot-intent-clarity",
  choice: "tarot-intent-choice",
  momentum: "tarot-intent-momentum",
} as const;

const C = {
  canvas: 0xfffbef,
  surface: 0xffffff,
  plate: 0xf6ead2,
  jade: 0x0b6257,
  gold: 0xdca84a,
  stroke: 0xead7ad,
  ink: 0x2b2418,
  muted: 0x7b6a54,
  disabled: 0xd9cbb7,
  white: 0xffffff,
} as const;

// Runtime-generated FX textures (no asset files). A soft radial bloom and a
// 4-point spark, both tinted per-use so one texture serves every element color.
const FX_GLOW_KEY = "tarot-fx-glow";
const FX_SPARK_KEY = "tarot-fx-spark";

// Element color for a card's suit — drives the tint of reveal bursts, sparks,
// and celebration motes so the spectacle reads as "this card's energy".
function elementColor(suit?: string): number {
  switch (suit) {
    case "wands": return 0xff7a3c; // Fire
    case "cups": return 0x4db8ff; // Water
    case "swords": return 0xbcd0ff; // Air
    case "pentacles": return 0x9ad47a; // Earth
    default: return 0xf3d27a; // Major Arcana (gold)
  }
}

const FONT = "Inter, Arial, sans-serif";
const TEXT_RESOLUTION =
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
// Base card geometry — actual on-screen size is derived per rebuild to fit the
// available height (CARD_W/CARD_H only fix the aspect ratio).
const CARD_W = 88;
const CARD_H = 148;
const ACTION_W = 304;
const POSITIONS = ["Past", "Present", "Future"] as const;
const DEFAULT_INTENTS = [
  { id: "clarity", label: "Clarity", question: "What needs clarity right now?" },
  { id: "decision", label: "Decision", question: "Which path should I choose?" },
  { id: "momentum", label: "Momentum", question: "Where is momentum building?" },
] as const;

const CRITICAL_ASSET_FILES = [
  { key: TAROT_ASSETS.ritual, url: "./ritual/ritual-table.webp" },
  { key: TAROT_ASSETS.logo, url: "./logo.webp" },
  { key: TAROT_ASSETS.back, url: TAROT_CARD_BACK },
  { key: TAROT_ASSETS.clarity, url: "./intentions/clarity-token.webp" },
  { key: TAROT_ASSETS.choice, url: "./intentions/choice-token.webp" },
  { key: TAROT_ASSETS.momentum, url: "./intentions/momentum-token.webp" },
] as const;
const CRITICAL_ASSET_KEYS = new Set<string>(
  CRITICAL_ASSET_FILES.map(({ key }) => key),
);
const CRITICAL_ASSET_RETRIES = 2;

type CardData = {
  id?: number;
  name?: string;
  image?: string;
  backImage?: string;
  keywords?: string[];
  suit?: string;
  suitLabel?: string;
  arcana?: string;
  flipped?: boolean;
  essence?: string;
  reading?: string;
};

type IntentOption = {
  id: string;
  label: string;
  question: string;
};

type TarotLayout = {
  W: number;
  H: number;
  micro: boolean;
  compact: boolean;
  titleY: number;
  taglineY: number;
  chipY: number;
  chipSize: number;
  chipLabelOffset: number;
  intentGap: number;
  cardW: number;
  cardH: number;
  cardCenterY: number;
  startX: number;
  gap: number;
  stepsY: number;
  progressW: number;
  progressH: number;
  actionY: number;
  actionW: number;
  actionH: number;
  statusY: number;
};

type IntentView = {
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  id: string;
};

type CardView = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Graphics;
  emptyGroup: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Graphics;
  hoverGlow: Phaser.GameObjects.Image;
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

function intentOptionsFromState(value: unknown): IntentOption[] {
  if (!Array.isArray(value)) return [...DEFAULT_INTENTS];
  const options = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const id = String(entry.id ?? "").trim();
      const label = String(entry.label ?? "").trim();
      const question = String(entry.question ?? "").trim();
      return id && label && question ? { id, label, question } : null;
    })
    .filter((item): item is IntentOption => Boolean(item));
  return options.length ? options.slice(0, 3) : [...DEFAULT_INTENTS];
}

export class TarotScene extends BaseScene {
  private tableImage!: Phaser.GameObjects.Image;
  private deckStack!: Phaser.GameObjects.Container;
  private appTitleLabel!: Phaser.GameObjects.Text;
  private networkLabel!: Phaser.GameObjects.Text;
  private taglineLabel!: Phaser.GameObjects.Text;
  private titleLabel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Container;
  private actionButtonBg!: Phaser.GameObjects.Graphics;
  private actionButtonLabel!: Phaser.GameObjects.Text;
  private intentButtons: Phaser.GameObjects.Container[] = [];
  private intentViews: IntentView[] = [];
  private intentPath!: Phaser.GameObjects.Graphics;
  private intentMasks: Phaser.Display.Masks.GeometryMask[] = [];
  private intentMaskSources: Phaser.GameObjects.Graphics[] = [];
  private stepLabels: Phaser.GameObjects.Text[] = [];
  private stepTrack!: Phaser.GameObjects.Graphics;
  private cardViews: CardView[] = [];
  private layout!: TarotLayout;
  private dealtOnce = false;
  private ambientTweens: Phaser.Tweens.Tween[] = [];
  private celebrationMotes = new Set<Phaser.GameObjects.Arc>();
  private criticalAssetFailures = new Set<string>();
  private assetRecoveryActive = false;
  private assetRetryInFlight = false;
  private lastAssetRetryNonce = 0;
  private readingChimed = false;
  private lastRevealAt = 0;
  private pendingCardTextures = new Set<string>();
  private failedCardTextures = new Map<string, number>();
  private restoringLayout = false;
  private detailOverlay?: Phaser.GameObjects.Container;
  private detailCardId = -1;
  private detailCardFlipped = false;
  private ambientField?: Phaser.GameObjects.Container;

  constructor() {
    super("TarotScene");
  }

  preload(): void {
    // Phaser copies this value into every File when it is queued. Two means
    // two real network retries after the initial request, not two attempts in
    // total. ImageFile does not currently expose maxRetries in its TS config.
    this.load.maxRetries = CRITICAL_ASSET_RETRIES;
    this.load.off(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      this.handleCriticalAssetLoadError,
      this,
    );
    this.load.off(
      Phaser.Loader.Events.FILE_COMPLETE,
      this.handleCriticalAssetLoadComplete,
      this,
    );
    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      this.handleCriticalAssetLoadError,
      this,
    );
    this.load.on(
      Phaser.Loader.Events.FILE_COMPLETE,
      this.handleCriticalAssetLoadComplete,
      this,
    );
    this.load.image(TAROT_ASSETS.ritual, "./ritual/ritual-table.webp");
    this.load.image(TAROT_ASSETS.logo, "./logo.webp");
    this.load.image(TAROT_ASSETS.back, TAROT_CARD_BACK);
    this.load.image(TAROT_ASSETS.clarity, "./intentions/clarity-token.webp");
    this.load.image(TAROT_ASSETS.choice, "./intentions/choice-token.webp");
    this.load.image(TAROT_ASSETS.momentum, "./intentions/momentum-token.webp");
  }

  create(): void {
    super.create();
    this.ensureFxTextures();
    this.input.on("pointerdown", () => this.sfx.unlock());
    this.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.unbindCriticalAssetLoader,
      this,
    );
    this.events.once(
      Phaser.Scenes.Events.DESTROY,
      this.unbindCriticalAssetLoader,
      this,
    );
    this.missingCriticalAssetKeys().forEach((key) =>
      this.criticalAssetFailures.add(key),
    );
    if (this.criticalAssetFailures.size > 0) {
      this.buildCriticalAssetRecovery();
      return;
    }
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }

  private handleCriticalAssetLoadError(file: Phaser.Loader.File): void {
    if (CRITICAL_ASSET_KEYS.has(file.key)) {
      this.criticalAssetFailures.add(file.key);
    }
  }

  private handleCriticalAssetLoadComplete(key: string): void {
    if (CRITICAL_ASSET_KEYS.has(key)) {
      this.criticalAssetFailures.delete(key);
    }
  }

  private unbindCriticalAssetLoader(): void {
    this.load.off(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      this.handleCriticalAssetLoadError,
      this,
    );
    this.load.off(
      Phaser.Loader.Events.FILE_COMPLETE,
      this.handleCriticalAssetLoadComplete,
      this,
    );
  }

  private missingCriticalAssetKeys(): string[] {
    return CRITICAL_ASSET_FILES
      .map(({ key }) => key)
      .filter((key) => !this.textures.exists(key));
  }

  /**
   * A critical texture failure is not papered over with generated geometry or
   * a missing-texture sprite. Keep the game fail-clear, explain what happened,
   * and let the player retry the real files when their connection recovers.
   */
  private buildCriticalAssetRecovery(): void {
    this.assetRecoveryActive = true;
    this.dispatch("setAssetRecoveryState", Math.max(
      this.criticalAssetFailures.size,
      this.missingCriticalAssetKeys().length,
    ));
    this.tweens.killAll();
    this.children.removeAll(true);

    const { width: W, height: H } = this.scale;
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const panelW = Math.min(340, W - 28);
    const panelH = Math.min(244, H - 32);
    const panelY = H / 2;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.98);
    panel.fillRoundedRect(
      W / 2 - panelW / 2,
      panelY - panelH / 2,
      panelW,
      panelH,
      22,
    );
    panel.lineStyle(2, C.gold, 0.72);
    panel.strokeRoundedRect(
      W / 2 - panelW / 2,
      panelY - panelH / 2,
      panelW,
      panelH,
      22,
    );

    this.add.text(
      W / 2,
      panelY - panelH / 2 + 42,
      this.sceneStr("assetErrorTitle", "Ritual artwork unavailable"),
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: H <= 440 ? "17px" : "20px",
        fontStyle: "800",
        color: "#2b2418",
        align: "center",
        wordWrap: { width: panelW - 36 },
      },
    ).setOrigin(0.5);

    this.add.text(
      W / 2,
      panelY - 22,
      this.assetRetryInFlight
        ? this.sceneStr("assetRetrying", "Retrying the original artwork...")
        : this.sceneStr(
            "assetErrorBody",
            "The game could not load its visual assets. Check your connection and try again.",
          ),
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: "12px",
        color: "#665d50",
        align: "center",
        wordWrap: { width: panelW - 42 },
        lineSpacing: 2,
      },
    ).setOrigin(0.5);

    const retryW = Math.min(240, panelW - 32);
    const retryY = panelY + panelH / 2 - 42;
    const retryButton = this.add.container(W / 2, retryY);
    const retryBg = this.add.graphics();
    retryBg.fillStyle(this.assetRetryInFlight ? C.disabled : C.jade, 1);
    retryBg.fillRoundedRect(-retryW / 2, -22, retryW, 44, 18);
    retryBg.lineStyle(2, this.assetRetryInFlight ? C.stroke : C.gold, 0.9);
    retryBg.strokeRoundedRect(-retryW / 2, -22, retryW, 44, 18);
    const retryLabel = this.add.text(
      0,
      0,
      this.assetRetryInFlight
        ? this.sceneStr("assetRetrying", "Retrying...")
        : this.sceneStr("assetRetry", "Retry artwork"),
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: "14px",
        fontStyle: "800",
        color: this.assetRetryInFlight ? "#7b6a54" : "#fff7dc",
      },
    ).setOrigin(0.5);
    retryButton.add([retryBg, retryLabel]);

    if (!this.assetRetryInFlight) {
      retryBg.setInteractive(
        new Phaser.Geom.Rectangle(-retryW / 2, -22, retryW, 44),
        Phaser.Geom.Rectangle.Contains,
      );
      this.bindGameButton(retryBg, {
        targets: retryButton,
        pressScale: 0.96,
        onPress: () => this.retryCriticalAssets(),
      });
    }
  }

  private retryCriticalAssets(): void {
    if (this.assetRetryInFlight) return;

    const missing = this.missingCriticalAssetKeys();
    if (missing.length === 0) {
      this.criticalAssetFailures.clear();
      this.assetRecoveryActive = false;
      this.dispatch("setAssetRecoveryState", 0);
      this.rebuildScene();
      this.onStateUpdate(this.state);
      return;
    }

    this.assetRetryInFlight = true;
    this.criticalAssetFailures.clear();
    this.buildCriticalAssetRecovery();

    const missingSet = new Set(missing);
    this.load.maxRetries = CRITICAL_ASSET_RETRIES;
    CRITICAL_ASSET_FILES.forEach(({ key, url }) => {
      if (missingSet.has(key)) {
        this.load.image({ key, url });
      }
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.assetRetryInFlight = false;
      this.missingCriticalAssetKeys().forEach((key) =>
        this.criticalAssetFailures.add(key),
      );
      if (this.criticalAssetFailures.size > 0) {
        this.buildCriticalAssetRecovery();
        return;
      }

      this.assetRecoveryActive = false;
      this.dispatch("setAssetRecoveryState", 0);
      this.rebuildScene();
      this.onStateUpdate(this.state);
    });
    this.load.start();
  }

  private computeLayout(W: number, H: number): TarotLayout {
    // 400-520px canvases need their own vertical rhythm. Treating them as a
    // slightly shorter phone layout makes the card captions collide with the
    // progress rail and CTA. The micro tier keeps every primary object while
    // reducing decorative spacing and physical-object size.
    const micro = H <= 520;
    // Include the boundary itself so 680px never switches to the roomy values
    // whose larger intent tokens and title need more vertical space.
    const compact = !micro && H <= 680;
    const titleY = micro
      ? 91
      : compact
        ? Math.max(96, Math.round(H * 0.165))
        : 124;
    const taglineY = micro
      ? 67
      : compact
        ? Math.max(70, Math.round(H * 0.125))
        : 92;
    const chipY = micro
      ? Math.round(150 + Math.max(0, Math.min(120, H - 400)) / 6)
      : compact
        ? Math.max(176, Math.min(190, Math.round(H * 0.29)))
        : 236;
    const widthLimitedChipSize = Math.max(56, Math.floor((W - 24) / 3));
    const heightLimitedChipSize = micro
      ? Math.round(64 + Math.max(0, Math.min(120, H - 400)) * 0.15)
      : compact
        ? 94
        : 118;
    const chipSize = Math.min(heightLimitedChipSize, widthLimitedChipSize);
    const chipLabelOffset = Math.round(chipSize / 2 - 4);
    const ringRadius = Math.max(38, chipSize * 0.45) + 4;
    const intentGap = Math.min(
      micro ? 92 : compact ? 94 : 108,
      Math.max(chipSize * 0.8, W / 2 - ringRadius - 8),
    );
    const cardZoneTop = micro
      ? chipY + chipLabelOffset + 18
      : compact
        ? chipY + chipLabelOffset + 38
        : 328;
    const stepsY = H - (micro ? 88 : compact ? 106 : 134);
    const actionY = H - (micro ? 44 : compact ? 53 : 72);
    const actionH = micro ? 44 : 52;
    const actionW = Math.min(ACTION_W, Math.max(180, W - 24));
    const actionTop = actionY - actionH / 2;
    const statusY = H - (micro ? 8 : compact ? 13 : 18);
    const progressW = Math.min(236, Math.max(180, W - 24));
    const progressH = micro ? 28 : 38;

    // Keep the cards large enough to feel tactile while preserving a clear
    // lower action lane. Short viewports use a smaller physical deck instead
    // of allowing captions to collide with the progress/action cluster.
    const idealCardH = micro
      ? Math.round(66 + Math.max(0, Math.min(120, H - 400)) * 0.2)
      : compact
        ? Math.min(126, Math.max(98, H * 0.18))
        : Math.min(CARD_H, Math.max(126, H * 0.205));
    const microCardLimit = Math.max(
      60,
      stepsY - progressH / 2 - cardZoneTop - 37,
    );
    const cardH = Math.round(
      micro ? Math.min(idealCardH, microCardLimit) : idealCardH,
    );
    const cardW = Math.round(cardH * (CARD_W / CARD_H));
    const maxFittingGap = (W - cardW - 24) / 2;
    const minimumReadableGap = Math.max(52, cardW * 0.86);
    const gap = Math.max(
      minimumReadableGap,
      Math.min(cardW + 25, maxFittingGap),
    );

    const blockH = cardH + 37; // card + label + two-line meta
    const zoneBottom = micro
      ? stepsY - progressH / 2
      : compact
        ? stepsY - 24
        : actionTop - 5;
    const slack = Math.max(0, zoneBottom - cardZoneTop - blockH);
    const cardTop = cardZoneTop + slack / 2;
    const cardCenterY = cardTop + cardH / 2;

    return {
      W,
      H,
      micro,
      compact,
      titleY,
      taglineY,
      chipY,
      chipSize,
      chipLabelOffset,
      intentGap,
      cardW,
      cardH,
      cardCenterY,
      startX: W / 2 - gap,
      gap,
      stepsY,
      progressW,
      progressH,
      actionY,
      actionW,
      actionH,
      statusY,
    };
  }

  private rebuildScene(restoringLayout = false): void {
    this.detailOverlay = undefined;
    this.detailCardId = -1;
    this.detailCardFlipped = false;
    this.restoringLayout = restoringLayout;
    this.tweens.killAll();
    this.intentMasks.forEach((mask) => mask.destroy());
    this.intentMaskSources.forEach((source) => source.destroy());
    this.children.removeAll(true);
    this.intentButtons = [];
    this.intentViews = [];
    this.cardViews = [];
    this.stepLabels = [];
    this.ambientTweens = [];
    this.celebrationMotes.clear();
    this.intentMasks = [];
    this.intentMaskSources = [];
    const currentDraw = this.val<CardData[]>("drawn", []) ?? [];
    this.dealtOnce = restoringLayout && currentDraw.length > 0;

    const { width: W, height: H } = this.scale;
    this.layout = this.computeLayout(W, H);

    this.buildBackground(W, H);
    this.buildAmbientField(W, H);
    this.buildHeader(W);
    this.buildDesk(W);
    this.buildIntentPath();
    this.buildSpread(W);
    this.buildIntentButtons(W);
    this.buildProgress(W);
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
    const retryNonce = this.num("assetRetryNonce");
    if (retryNonce !== this.lastAssetRetryNonce) {
      this.lastAssetRetryNonce = retryNonce;
      if (this.assetRecoveryActive) {
        this.retryCriticalAssets();
        return;
      }
    }
    if (this.assetRecoveryActive) return;
    if (!this.titleLabel || !this.statusText || !this.actionButton) return;

    const drawn = this.val<CardData[]>("drawn", []) ?? [];

    // Close the zoom detail if the underlying spread changed under it (new
    // reading, reset, or the open card was re-sealed), so it never shows stale
    // art or interpretation.
    if (this.detailOverlay) {
      const openCard =
        this.detailCardId >= 0
          ? drawn.find((c) => c.id === this.detailCardId)
          : undefined;
      const stale =
        !openCard ||
        openCard.flipped !== this.detailCardFlipped ||
        drawn.length !== 3;
      if (stale) this.closeCardDetail();
    }

    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");
    const isLoading = this.bool("isLoading");
    const hasPending = this.bool("hasPending");
    const pendingExpired = this.bool("pendingExpired");
    const intentId = this.str("intentId", "decision");
    const revealedCount = drawn.filter((card) => card.flipped).length;

    // Static localized chrome (may arrive after the first build) — refresh here.
    this.appTitleLabel.setText(this.sceneStr("appTitle", "On-Chain Tarot"));
    this.networkLabel.setText(this.sceneStr("networkStatus", "Neo N3 online"));
    const activeStep = allFlipped ? 2 : hasDrawn || hasPending || isLoading ? 1 : 0;
    this.taglineLabel.setText(
      activeStep === 0
        ? this.sceneStr("stepChooseIntent", "Step one · Choose an intention")
        : activeStep === 1
          ? hasPending
            ? this.sceneStr("oracleWaiting", "The oracle is shuffling")
            : this.sceneStr("drawing", "Drawing the spread")
          : this.sceneStr("verified", "Reading complete"),
    );
    this.titleLabel.setText(
      isLoading
        ? hasPending
          ? this.sceneStr("oracleWaiting", "The oracle is shuffling")
          : this.sceneStr("drawing", "Drawing the spread")
        : hasPending
          ? pendingExpired
            ? this.sceneStr("actionRecover", "Recover reading fee")
            : this.sceneStr("oracleWaiting", "The oracle is shuffling")
          : allFlipped
          ? this.sceneStr("verified", "Reading complete")
          : hasDrawn
            ? this.sceneStr("tapToReveal", "Tap cards to reveal")
            : this.sceneStr(
                "intentPrompt",
                "What do you most want to understand right now?",
              ),
    );
    this.statusText.setText(
      isLoading
        ? this.sceneStr(
            "drawingStatus",
            "Wallet confirms the draw, then the contract seals the spread.",
          )
        : hasPending
          ? this.sceneStr(
              "oracleWaitingStatus",
              "Your request is sealed on-chain. Check again when the oracle returns.",
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

    this.intentButtons.forEach((button) => button.setVisible(!hasDrawn && !hasPending && !isLoading));
    this.updateIntentPath(intentId, !hasDrawn && !hasPending && !isLoading);
    this.intentViews.forEach((view) => {
      const selected = view.id === intentId;
      this.renderIntentButton(view.ring, selected, false);
      view.image.setAlpha(selected ? 1 : 0.9);
      view.label.setColor(selected ? "#06443d" : "#5f5548");
    });
    const localizedSteps = this.val<Record<string, unknown>>(
      "sceneText",
      undefined,
    )?.steps;
    if (Array.isArray(localizedSteps) && localizedSteps.length === 3) {
      this.stepLabels.forEach((label, index) =>
        label.setText(String(localizedSteps[index] ?? label.text)),
      );
    }
    this.updateProgress(activeStep);
    this.updateActionButton(hasDrawn, allFlipped, isLoading, hasPending, pendingExpired);
    this.updateCards(drawn, isLoading, hasPending);

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
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);
    this.tableImage = this.add.image(W / 2, H / 2, TAROT_ASSETS.ritual);
    const source = this.tableImage.texture.getSourceImage() as {
      width: number;
      height: number;
    };
    const scale = Math.max(W / source.width, H / source.height);
    this.tableImage.setScale(scale);

    // The generated plate deliberately leaves a calm upper band. A quiet
    // translucent veil guarantees title contrast without dirtying the mat.
    this.add.rectangle(W / 2, 76, W, 152, C.surface, 0.44);
  }

  private buildHeader(W: number): void {
    const L = this.layout;
    const logoPlate = this.add.graphics();
    logoPlate.fillStyle(C.surface, 0.96);
    logoPlate.fillRoundedRect(14, 10, 50, 50, 14);
    logoPlate.lineStyle(1, C.stroke, 0.72);
    logoPlate.strokeRoundedRect(14, 10, 50, 50, 14);
    const logo = this.add.image(39, 35, TAROT_ASSETS.logo);
    logo.setDisplaySize(38, 38);

    this.appTitleLabel = this.add.text(72, 18, "On-Chain Tarot", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "17px",
      fontStyle: "800",
      color: "#1f241f",
    });

    const networkDot = this.add.graphics();
    networkDot.fillStyle(0x2bb673, 1);
    networkDot.fillCircle(76, 50, 4);
    this.networkLabel = this.add.text(86, 50, "Neo N3 online", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      fontStyle: "700",
      color: "#4c554e",
    }).setOrigin(0, 0.5);

    this.taglineLabel = this.add.text(
      W / 2,
      L.taglineY,
      "Step one · Choose an intention",
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: L.micro ? "10px" : "12px",
        fontStyle: "700",
        color: "#187565",
      },
    ).setOrigin(0.5);

    this.titleLabel = this.add.text(
      W / 2,
      L.titleY,
      "What do you most want to understand right now?",
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: L.micro ? "16px" : L.compact ? "17px" : "20px",
        fontStyle: "800",
        color: "#171a17",
        align: "center",
        wordWrap: { width: W - (L.micro ? 36 : 48) },
        lineSpacing: L.micro ? 0 : 2,
      },
    ).setOrigin(0.5);
  }

  private buildDesk(W: number): void {
    // An invisible physical origin for the staggered deal animation. The real
    // cards fly from the ritual centre; no fake deck illustration is needed.
    this.deckStack = this.add.container(W / 2 - 18, this.layout.cardCenterY + 18);
    const originCard = this.add.image(0, 0, TAROT_ASSETS.back);
    originCard.setDisplaySize(this.layout.cardW, this.layout.cardH).setAlpha(0);
    this.deckStack.add(originCard);
  }

  private buildIntentPath(): void {
    this.intentPath = this.add.graphics();
    this.updateIntentPath(this.str("intentId", "decision"), true);
  }

  /**
   * A restrained ritual path turns intent selection into spatial game input:
   * the chosen token visibly branches toward the three physical cards. It is
   * hidden as soon as dealing starts so it never competes with the spread.
   */
  private updateIntentPath(intentId: string, visible: boolean): void {
    if (!this.intentPath) return;
    // The 400-520px tier deliberately drops this secondary decoration: there
    // is not enough vertical runway for a readable curve between the tokens
    // and cards, while the selected ring still communicates the relationship.
    const pathVisible = visible && !this.layout.micro;
    this.intentPath.clear().setVisible(pathVisible);
    if (!pathVisible) return;

    const options = intentOptionsFromState(this.val("intentOptions", null));
    const selectedIndex = options.findIndex(
      (option) => option.id === intentId,
    );
    const resolvedIndex = selectedIndex >= 0 ? selectedIndex : 1;
    const startX =
      this.layout.W / 2 + (resolvedIndex - 1) * this.layout.intentGap;
    const startY =
      this.layout.chipY + this.layout.chipLabelOffset + 10;
    const endY = this.layout.cardCenterY - this.layout.cardH / 2 - 12;

    this.intentPath.lineStyle(1.5, C.jade, 0.48);
    for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
      const endX = this.layout.startX + cardIndex * this.layout.gap;
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(startX, startY),
        new Phaser.Math.Vector2((startX + endX) / 2, startY + 26),
        new Phaser.Math.Vector2(endX, endY),
      );
      const points = curve.getPoints(28);
      for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 2) {
        const from = points[pointIndex]!;
        const to = points[Math.min(pointIndex + 1, points.length - 1)]!;
        this.intentPath.lineBetween(from.x, from.y, to.x, to.y);
      }
      this.intentPath.fillStyle(C.gold, 0.72);
      this.intentPath.fillCircle(endX, endY, 2.3);
    }
    this.intentPath.fillStyle(C.surface, 0.96);
    this.intentPath.fillCircle(startX, startY, 5.5);
    this.intentPath.lineStyle(1.5, C.gold, 0.84);
    this.intentPath.strokeCircle(startX, startY, 5.5);
  }

  private buildSpread(_W: number): void {
    const L = this.layout;
    for (let i = 0; i < 3; i++) {
      // Round the resting render coords so cards sit on integer pixels and
      // stay pixel-crisp — the layout bounds math itself stays float.
      const x = Math.round(L.startX + i * L.gap);
      const y = Math.round(L.cardCenterY);
      const view = this.makeCardView(x, y, i);
      this.cardViews.push(view);
    }
  }

  private makeCardView(x: number, y: number, index: number): CardView {
    const cardW = this.layout.cardW;
    const cardH = this.layout.cardH;
    const container = this.add.container(x, y);
    // Keep the physical card body separate from its spread caption. Deal,
    // ambience and completion motion act on the outer container; the 3D flip
    // acts only on this inner body so simultaneous tweens cannot strand a card
    // at scaleX ~= 0 when the reading-complete celebration begins.
    const body = this.add.container(0, 0);

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
      resolution: TEXT_RESOLUTION,
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
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    const meta = this.add.text(0, cardH / 2 + 26, "", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: cardW + 22 },
      maxLines: 2,
      lineSpacing: -1,
    }).setOrigin(0.5);

    // Hover halo — an ADD-blended gold bloom that breathes behind the card
    // edge on hover, giving cards a "charged" golden rim (流光).
    const hoverGlow = this.add
      .image(0, 0, FX_GLOW_KEY)
      .setTint(C.gold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setScale((cardW + 46) / 128, (cardH + 46) / 128);

    const hit = this.add.rectangle(0, 0, cardW + 12, cardH + 12, 0xffffff, 0.001);
    hit.setInteractive();
    this.bindGameButton(hit, {
      targets: body,
      hoverScale: 1.035,
      pressScale: 0.96,
      enabled: () => this.cardTapEnabled(index),
      onPress: () => this.handleCardTap(index),
      onHoverIn: () => {
        if (this.reducedMotion) {
          hoverGlow.setAlpha(0.5);
          return;
        }
        hoverGlow.setAlpha(0.6);
        this.animate({
          targets: hoverGlow,
          alpha: 0.85,
          scaleX: (cardW + 58) / 128,
          scaleY: (cardH + 58) / 128,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      },
      onHoverOut: () => {
        this.tweens.killTweensOf(hoverGlow);
        hoverGlow.setScale((cardW + 46) / 128, (cardH + 46) / 128);
        this.animate({
          targets: hoverGlow,
          alpha: 0,
          duration: 160,
          ease: "Sine.easeOut",
        });
      },
    });

    body.add([hoverGlow, shadow, plate, frame, emptyGroup, back, face, hit]);
    container.add([body, label, meta]);

    return {
      container,
      body,
      plate,
      emptyGroup,
      back,
      face,
      frame,
      hoverGlow,
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
    const textures = [
      TAROT_ASSETS.clarity,
      TAROT_ASSETS.choice,
      TAROT_ASSETS.momentum,
    ] as const;
    options.forEach((option, index) => {
      const x = W / 2 + (index - 1) * L.intentGap;
      const button = this.add.container(x, L.chipY);
      const ring = this.add.graphics();
      this.renderIntentButton(ring, false, false);
      const token = this.add.image(0, -8, textures[index]!);
      token.setDisplaySize(L.chipSize, L.chipSize);
      // Generated source art uses a warm square canvas. A real circular mask
      // preserves the physical token while letting the ritual table and
      // selected ring remain visible around it.
      const maskSource = this.make.graphics({ x: 0, y: 0 }, false);
      maskSource.fillStyle(C.white, 1);
      maskSource.fillCircle(x, L.chipY - 8, L.chipSize * 0.44);
      const tokenMask = maskSource.createGeometryMask();
      token.setMask(tokenMask);
      this.intentMaskSources.push(maskSource);
      this.intentMasks.push(tokenMask);
      const hit = this.add.rectangle(
        0,
        8,
        L.chipSize,
        L.chipSize + 18,
        C.white,
        0.001,
      );
      hit.setInteractive();
      this.bindGameButton(hit, {
        targets: button,
        hoverScale: 1.035,
        pressScale: 0.95,
        onPress: () => {
          this.sfx.play("select");
          this.dispatch("setIntent", option.id);
        },
        onHoverIn: () =>
          this.renderIntentButton(
            ring,
            option.id === this.str("intentId", "decision"),
            true,
          ),
        onHoverOut: () =>
          this.renderIntentButton(
            ring,
            option.id === this.str("intentId", "decision"),
            false,
          ),
      });
      const label = this.add.text(0, L.chipLabelOffset, option.label, {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: "12px",
        fontStyle: "800",
        color: "#5f5548",
      }).setOrigin(0.5);
      button.add([ring, token, label, hit]);
      this.intentButtons.push(button);
      this.intentViews.push({
        container: button,
        ring,
        image: token,
        label,
        id: option.id,
      });
    });
  }

  private renderIntentButton(
    ring: Phaser.GameObjects.Graphics,
    selected: boolean,
    hover: boolean,
  ): void {
    ring.clear();
    const ringRadius = Math.max(38, this.layout.chipSize * 0.45);
    if (selected || hover) {
      ring.fillStyle(selected ? 0xfff7d9 : C.surface, selected ? 0.72 : 0.52);
      ring.fillCircle(0, -8, ringRadius + 2);
      ring.lineStyle(selected ? 3 : 2, selected ? C.gold : C.jade, 0.92);
      ring.strokeCircle(0, -8, ringRadius);
    }
    if (selected) {
      ring.lineStyle(1, C.jade, 0.72);
      ring.strokeCircle(0, -8, ringRadius + 4);
    }
  }

  private buildProgress(W: number): void {
    this.stepTrack = this.add.graphics();
    const L = this.layout;
    const y = L.stepsY;
    const x = W / 2 - L.progressW / 2;
    const halfH = L.progressH / 2;
    this.stepTrack.fillStyle(C.surface, 0.94);
    this.stepTrack.fillRoundedRect(x, y - halfH, L.progressW, L.progressH, halfH);
    this.stepTrack.lineStyle(1, C.stroke, 0.92);
    this.stepTrack.strokeRoundedRect(x, y - halfH, L.progressW, L.progressH, halfH);

    const labels = this.val<Record<string, unknown>>("sceneText", undefined)?.steps;
    const resolved =
      Array.isArray(labels) && labels.length === 3
        ? labels.map((label) => String(label))
        : ["Intention", "Draw", "Reading"];
    const stepGap = (L.progressW - (L.micro ? 70 : 84)) / 2;
    resolved.forEach((label, index) => {
      const labelX = W / 2 + (index - 1) * stepGap;
      const text = this.add.text(labelX, y, label, {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: L.micro ? "9px" : "11px",
        fontStyle: "800",
        color: "#867965",
      }).setOrigin(0.5);
      this.stepLabels.push(text);
      if (index < 2) {
        this.add.text(labelX + stepGap / 2, y, "→", {
          fontFamily: FONT,
          resolution: TEXT_RESOLUTION,
          fontSize: L.micro ? "10px" : "13px",
          fontStyle: "700",
          color: "#9a8c77",
        }).setOrigin(0.5);
      }
    });
  }

  private updateProgress(activeStep: number): void {
    this.stepLabels.forEach((label, index) => {
      label.setColor(index === activeStep ? "#0b6257" : "#665d50");
      label.setAlpha(index <= activeStep ? 1 : 0.84);
    });
  }

  private buildActionButton(W: number, _H: number): void {
    const { actionW, actionH } = this.layout;
    this.actionButton = this.add.container(W / 2, this.layout.actionY);
    this.actionButtonBg = this.add.graphics();
    this.actionButtonLabel = this.add.text(0, 0, "Draw Cards", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: actionW < 280 ? "13px" : this.layout.micro ? "14px" : "16px",
      fontStyle: "800",
      color: "#fff7dc",
      align: "center",
      wordWrap: { width: actionW - 24 },
      maxLines: 2,
      lineSpacing: -2,
    }).setOrigin(0.5);
    this.actionButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-actionW / 2, -actionH / 2, actionW, actionH),
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
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      color: "#7b6a54",
      align: "center",
      wordWrap: { width: W - 56 },
    }).setOrigin(0.5);
  }

  private updateActionButton(
    hasDrawn: boolean,
    allFlipped: boolean,
    isLoading: boolean,
    hasPending: boolean,
    pendingExpired: boolean,
  ): void {
    const { actionW, actionH } = this.layout;
    const halfH = actionH / 2;
    const radius = Math.min(20, halfH);
    const label = isLoading
      ? hasPending
        ? this.sceneStr("actionCheck", "Checking oracle...")
        : this.sceneStr("actionDrawing", "Drawing...")
      : pendingExpired
        ? this.sceneStr("actionRecover", "Recover reading fee")
        : hasPending
          ? this.sceneStr("actionCheck", "Check oracle result")
          : allFlipped
        ? this.sceneStr("actionNew", "New Reading")
        : hasDrawn
          ? this.sceneStr("actionReveal", "Reveal Spread")
          : this.sceneStr("actionConfirm", "Confirm intention · Draw 3 cards");

    this.actionButtonLabel.setText(label);
    this.actionButtonBg.clear();
    this.actionButtonBg.fillStyle(isLoading ? C.disabled : C.jade, 1);
    this.actionButtonBg.fillRoundedRect(-actionW / 2, -halfH, actionW, actionH, radius);
    this.actionButtonBg.fillStyle(C.white, isLoading ? 0.08 : 0.16);
    this.actionButtonBg.fillRoundedRect(-actionW / 2 + 3, -halfH + 3, actionW - 6, Math.min(18, actionH / 2 - 4), {
      tl: Math.min(17, radius - 2),
      tr: Math.min(17, radius - 2),
      bl: 0,
      br: 0,
    });
    this.actionButtonBg.lineStyle(2.5, isLoading ? C.stroke : C.gold, 0.92);
    this.actionButtonBg.strokeRoundedRect(-actionW / 2, -halfH, actionW, actionH, radius);
    this.actionButtonBg.lineStyle(1, isLoading ? C.stroke : C.white, 0.32);
    this.actionButtonBg.strokeRoundedRect(
      -actionW / 2 + 4,
      -halfH + 4,
      actionW - 8,
      actionH - 8,
      Math.max(10, radius - 4),
    );
    this.actionButtonLabel.setColor(isLoading ? "#7b6a54" : "#fff7dc");
  }

  private updateCards(drawn: CardData[], isLoading: boolean, hasPending = false): void {
    const positions = this.scenePositions();
    const cardW = this.layout.cardW;
    const cardH = this.layout.cardH;

    if (!drawn.length) {
      this.dealtOnce = false;
      // A new reading is also the explicit recovery boundary for an exhausted
      // image retry. The next spread may retry a previously unavailable face.
      this.failedCardTextures.clear();
      this.cardViews.forEach((view, index) => {
        this.setEmptyCard(view, index);
        if (hasPending) {
          view.body.setAngle(0);
          view.meta.setText(this.sceneStr("oracleWaiting", "Oracle shuffling"));
        }
      });
      return;
    }

    const normalizedCards = drawn.slice(0, 3).map((card) => this.normalizeCard(card));
    if (this.queueMissingCardTextures(normalizedCards)) {
      normalizedCards.forEach((_card, index) => {
        const view = this.cardViews[index];
        if (!view) return;
        view.emptyGroup.setVisible(false);
        view.label.setText(positions[index]!);
        view.meta.setText(this.sceneStr("loadingCard", "Loading card..."));
        view.flipped = false;
        view.back.setTexture(TAROT_ASSETS.back).setAlpha(1).setDisplaySize(cardW, cardH);
        view.face.setTexture(TAROT_ASSETS.back).setAlpha(0).setDisplaySize(cardW, cardH);
      });
      return;
    }

    normalizedCards.forEach((card, index) => {
      const view = this.cardViews[index];
      if (!view) return;
      const requestedKey = this.cardTextureKey(card);
      const hasRequestedTexture = this.textures.exists(requestedKey);
      const textureUnavailable =
        requestedKey !== TAROT_ASSETS.back &&
        !hasRequestedTexture &&
        (this.failedCardTextures.get(requestedKey) ?? 0) >= 2;
      const key = hasRequestedTexture ? requestedKey : TAROT_ASSETS.back;

      if (view.cardKey !== key) {
        view.face.setTexture(key);
        view.face.setDisplaySize(cardW, cardH);
        view.cardKey = key;
      }
      if (textureUnavailable) view.face.setTint(0xd8c9a7);
      else view.face.clearTint();
      view.emptyGroup.setVisible(false);
      view.label.setText(positions[index]!);
      view.meta.setText(
        card.flipped
          // The flip moment's payoff: the card name on line one, then its
          // one-line essence (the "解答" kernel) on line two. Suit/arcana
          // taxonomy stays in the How-to-play drawer, not here.
          ? textureUnavailable
            ? this.sceneStr("cardUnavailable", "Card art unavailable · try a new reading")
            : `${card.name ?? "Unknown"}\n${card.essence ?? ""}`.trim()
          : this.sceneStr("sealed", "Sealed card"),
      );

      if (card.flipped) {
        if (this.restoringLayout) {
          view.flipped = true;
          view.body.setScale(1);
          view.back.setAlpha(0);
          view.face.setAlpha(1);
        } else if (!view.flipped) {
          this.flipCardView(view, card.suit);
        }
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

  /**
   * Load only the three cards in the active spread. Preloading all 78 faces made
   * the first visit download roughly 19 MB before the player could even choose
   * an intent. The card back and table remain part of the initial preload; face
   * textures are fetched on demand and cached by Phaser for later readings.
   */
  private queueMissingCardTextures(cards: CardData[]): boolean {
    const queued: Array<{ key: string; url: string }> = [];
    let waiting = false;

    cards.forEach((card) => {
      const key = this.cardTextureKey(card);
      if (
        key === TAROT_ASSETS.back ||
        this.textures.exists(key) ||
        (this.failedCardTextures.get(key) ?? 0) >= 2
      ) return;
      if (this.pendingCardTextures.has(key)) {
        waiting = true;
        return;
      }

      const url = card.image || cardById(card.id)?.image;
      if (!url) {
        this.failedCardTextures.set(key, 2);
        return;
      }
      this.pendingCardTextures.add(key);
      queued.push({ key, url });
      this.load.image(key, url);
    });

    if (queued.length === 0) return waiting;

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      queued.forEach(({ key }) => {
        this.pendingCardTextures.delete(key);
        if (this.textures.exists(key)) {
          this.failedCardTextures.delete(key);
        } else {
          this.failedCardTextures.set(
            key,
            (this.failedCardTextures.get(key) ?? 0) + 1,
          );
        }
      });
      const current = this.val<CardData[]>("drawn", []) ?? [];
      this.updateCards(current, this.bool("isLoading"), this.bool("hasPending"));
    });
    this.load.start();
    return true;
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
    view.body.setScale(1).setAngle((index - 1) * 4);
    view.cardKey = TAROT_ASSETS.back;
    view.back.setTexture(TAROT_ASSETS.back).setAlpha(1);
    view.back.setDisplaySize(cardW, cardH);
    view.face.setTexture(TAROT_ASSETS.back).setAlpha(0);
    view.face.setDisplaySize(cardW, cardH);
    view.emptyIndex.setText(String(index + 1));
    // The selected direction treats the three physical cards as the idle game
    // objects. They remain face-down until a real spread is dealt, rather than
    // falling back to dashed form-like placeholders.
    view.emptyGroup.setVisible(false);
    view.label.setText(positions[index]!);
    view.meta.setText(this.sceneStr("awaiting", "Awaiting draw"));
    view.container.setAlpha(1).setScale(1);
  }

  private canFlip(index: number): boolean {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const card = drawn[index];
    return Boolean(card && !card.flipped && !this.bool("isLoading"));
  }

  /**
   * A dealt card is always tappable: a sealed card flips on tap (the core
   * reveal loop), a revealed card opens the zoom detail view so the player can
   * read the full interpretation and related content at a comfortable size.
   */
  private cardTapEnabled(index: number): boolean {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const card = drawn[index];
    return Boolean(card && !this.bool("isLoading"));
  }

  private handleCardTap(index: number): void {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const card = drawn[index];
    if (!card) return;
    if (card.flipped) {
      this.openCardDetail(index);
    } else if (this.canFlip(index)) {
      this.sfx.play("tap");
      this.dispatch("flipCard", index);
    }
  }

  private elementForSuit(suit?: string): string {
    const map: Record<string, string> = {
      wands: this.sceneStr("elementFire", "Fire"),
      cups: this.sceneStr("elementWater", "Water"),
      swords: this.sceneStr("elementAir", "Air"),
      pentacles: this.sceneStr("elementEarth", "Earth"),
    };
    return suit && map[suit] ? map[suit] : this.sceneStr("elementNone", "—");
  }

  private positionFrame(index: number, card: CardData): string {
    if (index === 0) return this.sceneStr("detailPastFrame", "It mirrors a path you have already walked — the origin now legible.");
    if (index === 1) return this.sceneStr("detailPresentFrame", "It mirrors the core challenge you stand within right now.");
    if (index === 2) return this.sceneStr("detailFutureFrame", "It mirrors what may unfold — a possibility, not a verdict.");
    return card.arcana ?? card.suitLabel ?? "";
  }

  /**
   * Tap a revealed card to open a calm zoom panel: the enlarged art plus the
   * full interpretation, position framing, element correspondence and keywords.
   * This is the "解答 + 关联内容" surface the small spread captions can't hold.
   * Closing via the X, the dimmed backdrop, or a state change that alters the
   * spread keeps the overlay from showing stale data.
   */
  private openCardDetail(index: number): void {
    if (this.detailOverlay) return;
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const raw = drawn[index];
    if (!raw || !raw.flipped) return;

    const { width: W, height: H } = this.scale;
    const positions = this.scenePositions();
    const card = this.normalizeCard(raw);
    const faceKey = this.cardTextureKey(card);
    const hasFace = this.textures.exists(faceKey);
    const artKey = hasFace ? faceKey : TAROT_ASSETS.back;

    const container = this.add.container(0, 0).setDepth(1000);
    const pad = 18;
    const panelW = Math.min(W - 24, 420);
    const panelH = Math.min(H - 24, Math.round(H * 0.92));
    const panelX = W / 2;
    const panelY = H / 2;
    const top = panelY - panelH / 2;
    const left = panelX - panelW / 2;
    const right = panelX + panelW / 2;
    const textW = panelW - pad * 2;

    // Dim backdrop (tap to close).
    const backdrop = this.add.rectangle(panelX, panelY, W, H, 0x14110b, 0.64);
    backdrop.setInteractive();
    backdrop.on("pointerup", () => this.closeCardDetail());
    container.add(backdrop);

    // Panel surface.
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.99);
    panel.fillRoundedRect(left, top, panelW, panelH, 22);
    panel.lineStyle(2, C.gold, 0.85);
    panel.strokeRoundedRect(left, top, panelW, panelH, 22);
    container.add(panel);

    // Close button (top-right).
    const closeX = right - 22;
    const closeY = top + 22;
    const closeBg = this.add.graphics();
    closeBg.fillStyle(C.canvas, 1);
    closeBg.fillCircle(closeX, closeY, 17);
    closeBg.lineStyle(2, C.stroke, 0.9);
    closeBg.strokeCircle(closeX, closeY, 17);
    // Drawn close "X": two crossing strokes centered in the closeBg circle
    // (radius 17). A vector glyph rather than a text-char mark keeps this scene
    // free of emoji/text placeholders per the framework guard "keeps Phaser
    // scene text free of emoji placeholders" (framework/test/phaser-framework.test.ts).
    const closeIcon = this.add.graphics();
    closeIcon.lineStyle(2.5, 0x5f5548, 1);
    const closeArm = 6;
    closeIcon.beginPath();
    closeIcon.moveTo(closeX - closeArm, closeY - closeArm);
    closeIcon.lineTo(closeX + closeArm, closeY + closeArm);
    closeIcon.moveTo(closeX + closeArm, closeY - closeArm);
    closeIcon.lineTo(closeX - closeArm, closeY + closeArm);
    closeIcon.strokePath();
    const closeHit = this.add.circle(closeX, closeY, 24, 0xffffff, 0.001).setInteractive();
    closeHit.on("pointerup", () => this.closeCardDetail());
    container.add([closeBg, closeIcon, closeHit]);

    // Enlarged card art — the dominant element of the overlay. It occupies up
    // to 60% of the panel height (or the full content width at the tarot
    // ratio, whichever is smaller), while reserving a text band below so the
    // reading never overflows on short / landscape screens.
    const maxArtW = panelW - pad * 2;
    const artH = Math.round(
      Math.min(panelH * 0.6, maxArtW * (CARD_H / CARD_W), panelH - 168),
    );
    const artW = Math.round(artH * (CARD_W / CARD_H));
    const artY = top + pad + artH / 2 + 6;
    // Halo behind the card art, blooming as the overlay opens.
    const artColor = elementColor(card.suit);
    const artGlow = this.add
      .image(panelX, artY, FX_GLOW_KEY)
      .setTint(artColor)
      .setAlpha(0)
      .setScale(0.6);
    container.add(artGlow);
    const art = this.add.image(panelX, artY, artKey);
    art.setDisplaySize(artW, artH);
    if (!hasFace) art.setTint(0xd8c9a7);
    container.add(art);

    // Stacked text column below the art.
    let cursorY = artY + artH / 2 + 14;
    const name = this.add.text(panelX, cursorY, card.name ?? "Unknown", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "21px",
      fontStyle: "800",
      color: "#1b1d1b",
      align: "center",
      wordWrap: { width: textW },
    }).setOrigin(0.5, 0);
    container.add(name);
    cursorY += name.height + 5;

    const essence = this.add.text(panelX, cursorY, card.essence ?? "", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "14px",
      fontStyle: "700",
      color: "#0b6257",
      align: "center",
      wordWrap: { width: textW },
    }).setOrigin(0.5, 0);
    container.add(essence);
    cursorY += essence.height + 10;

    const posLabel = positions[index] ?? "";
    const meta = this.add.text(
      panelX,
      cursorY,
      `${this.sceneStr("detailPosition", "Position")}: ${posLabel} · ${this.sceneStr("detailElement", "Element")}: ${this.elementForSuit(card.suit)}`,
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: "11px",
        fontStyle: "700",
        color: "#7b6a54",
        align: "center",
        wordWrap: { width: textW },
      },
    ).setOrigin(0.5, 0);
    container.add(meta);
    cursorY += meta.height + 4;

    const frame = this.add.text(panelX, cursorY, this.positionFrame(index, card), {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "italic",
      color: "#5f5548",
      align: "center",
      wordWrap: { width: textW },
    }).setOrigin(0.5, 0);
    container.add(frame);
    cursorY += frame.height + 12;

    const divider = this.add.graphics();
    divider.lineStyle(1, C.stroke, 0.8);
    divider.lineBetween(left + pad + 8, cursorY, right - pad - 8, cursorY);
    container.add(divider);
    cursorY += 12;

    const reading = this.add.text(panelX, cursorY, card.reading ?? "", {
      fontFamily: FONT,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      color: "#2b2418",
      align: "left",
      wordWrap: { width: textW },
      lineSpacing: 3,
    }).setOrigin(0.5, 0);
    container.add(reading);
    cursorY += reading.height + 10;

    const keywords = (card.keywords ?? []).join(" · ");
    const kw = this.add.text(
      panelX,
      cursorY,
      `${this.sceneStr("detailKeywords", "Keywords")}: ${keywords}`,
      {
        fontFamily: FONT,
        resolution: TEXT_RESOLUTION,
        fontSize: "11px",
        fontStyle: "700",
        color: "#7b6a54",
        align: "center",
        wordWrap: { width: textW },
      },
    ).setOrigin(0.5, 0);
    container.add(kw);

    // Entrance.
    if (this.reducedMotion) {
      container.setAlpha(1).setScale(1);
    } else {
      container.setAlpha(0).setScale(0.94);
      this.animate({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: 180,
        ease: "Cubic.easeOut",
      });
      // Halo behind the big card blooms, then a few sparkles settle the reveal.
      this.animate({
        targets: artGlow,
        alpha: { from: 0, to: 0.5 },
        scale: 1.4,
        duration: 360,
        yoyo: true,
        hold: 120,
        ease: "Sine.easeOut",
      });
      this.emitSparkles(panelX, artY, artColor, 12, 1001);
    }

    this.detailOverlay = container;
    this.detailCardId = card.id ?? -1;
    this.detailCardFlipped = true;
  }

  private closeCardDetail(): void {
    if (!this.detailOverlay) return;
    const overlay = this.detailOverlay;
    this.detailOverlay = undefined;
    this.detailCardId = -1;
    this.detailCardFlipped = false;
    if (this.reducedMotion) {
      overlay.destroy();
      return;
    }
    this.animate({
      targets: overlay,
      alpha: 0,
      scale: 0.96,
      duration: 150,
      ease: "Cubic.easeIn",
      onComplete: () => overlay.destroy(),
    });
  }

  private flipCardView(view: CardView, suit?: string): void {
    view.flipped = true;
    view.emptyGroup.setVisible(false);
    if (this.time.now - this.lastRevealAt > 120) {
      this.lastRevealAt = this.time.now;
      this.sfx.play("reveal");
    }
    const color = elementColor(suit);
    const cx = view.container.x;
    const cy = view.container.y;
    if (this.reducedMotion) {
      view.body.setScale(1);
      view.back.setAlpha(0);
      view.face.setAlpha(1);
      return;
    }

    // Element-colored reveal spectacle blooms as the card turns.
    this.burstReveal(cx, cy, color);
    // Extra punch: a light screen shake + an upward element-colored beam.
    this.cameras.main.shake(160, 0.006);
    this.beamReveal(cx, cy, color);

    this.animate({
      targets: view.body,
      scaleX: 0,
      duration: 120,
      ease: "Sine.easeIn",
      onComplete: () => {
        view.back.setAlpha(0);
        view.face.setAlpha(1);
        this.animate({
          targets: view.body,
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

    // The ambient float also owns container.y. Pause it during the physical
    // deal so a single tween controls each card's route, then resume after the
    // last card reaches the spread.
    this.stopAmbientMotion();

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
      // A small glow flashes at the deck as each card leaves its origin.
      if (!this.reducedMotion) {
        const puff = this.add
          .image(deckX, deckY, FX_GLOW_KEY)
          .setTint(C.gold)
          .setDepth(850)
          .setAlpha(0.55)
          .setScale(0.25);
        this.animate({
          targets: puff,
          scale: 1.1,
          alpha: 0,
          delay: index * 150,
          duration: 380,
          ease: "Cubic.easeOut",
          onComplete: () => puff.destroy(),
        });
      }
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
        onComplete:
          index === this.cardViews.length - 1
            ? () => this.startAmbientMotion()
            : undefined,
      });
    });
  }

  private playReadingCelebration(): void {
    if (this.reducedMotion) return;
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const { width: W, height: H } = this.scale;
    this.cardViews.forEach((view, index) => {
      // Gentle staggered pulse to celebrate the completed reading. Scale is used
      // (not y) so it never fights the ambient field's drifting embers.
      this.animate({
        targets: view.container,
        scale: 1.06,
        delay: index * 90,
        duration: 240,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
      // Rising motes tinted to each card's element color.
      const color = elementColor(drawn[index]?.suit);
      for (let s = 0; s < 3; s++) {
        const mote = this.add.circle(
          view.container.x + Phaser.Math.Between(-18, 18),
          view.container.y + Phaser.Math.Between(-30, 20),
          Phaser.Math.Between(2, 3),
          color,
          0.9,
        );
        this.celebrationMotes.add(mote);
        this.animate({
          targets: mote,
          y: mote.y - Phaser.Math.Between(30, 52),
          alpha: 0,
          delay: index * 90 + s * 70,
          duration: 720,
          ease: "Sine.easeOut",
          onComplete: () => {
            this.celebrationMotes.delete(mote);
            mote.destroy();
          },
        });
      }
      this.emitSparkles(view.container.x, view.container.y, color, 6, 900);
    });
    // A single light sweep across the spread to seal the "reading complete" beat.
    const sweep = this.add
      .image(W / 2 - 180, H / 2, FX_GLOW_KEY)
      .setTint(0xfff3d0)
      .setDepth(880)
      .setAlpha(0)
      .setScale(0.3, 1.6);
    this.animate({
      targets: sweep,
      x: W / 2 + 180,
      alpha: { from: 0, to: 0.5 },
      duration: 820,
      ease: "Sine.easeInOut",
      yoyo: true,
      onComplete: () => sweep.destroy(),
    });
  }

  private handleActionPress(): void {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];
    const hasDrawn = this.bool("hasDrawn") || drawn.length > 0;
    const allFlipped = this.bool("allFlipped");
    const hasPending = this.bool("hasPending");

    if (hasPending) {
      this.sfx.play("tap");
      this.dispatch(
        this.bool("pendingExpired")
          ? "recoverExpiredReading"
          : "refreshReadingState",
      );
      return;
    }

    if (allFlipped) {
      this.sfx.play("tap");
      this.dispatch("reset");
      return;
    }

    if (hasDrawn) {
      this.sfx.play("tap");
      // Reveal the spread through one registered action. Dispatching three
      // independent bridge actions in the same frame races their state writes
      // and can leave the final card sealed (especially after one manual flip).
      this.dispatch("flipTarotReading");
      return;
    }

    this.sfx.play("start");
    this.dispatch("draw");
  }

  private startAmbientMotion(): void {
    // The per-card idle float was removed: sub-pixel y motion made the card
    // art shimmer and read as frame drops. Tarot cards should sit placed and
    // crisp. The atmosphere now lives in a separate, non-blurring layer
    // (rotating sigil + drifting embers) plus a faint deck ritual float.
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

    const field = this.ambientField;
    if (!field) return;
    // Rebuild the field each call so a deal (which stops ambience) cleanly
    // restarts it without accumulating ember objects across readings.
    field.removeAll(true);
    const { width: W, height: H } = this.scale;
    const cx = W / 2;
    const cy = H / 2;

    // Rotating arcane sigil ring behind the spread — brighter, layered.
    const ringSize = Math.min(W, H) * 0.66;
    const ring = this.add.graphics();
    ring.lineStyle(2, C.gold, 0.3);
    ring.strokeCircle(0, 0, ringSize / 2);
    ring.lineStyle(1, C.jade, 0.24);
    ring.strokeCircle(0, 0, ringSize / 2 - 16);
    ring.lineStyle(1, C.gold, 0.16);
    ring.strokeCircle(0, 0, ringSize / 2 - 32);
    const ticks = 36;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const r1 = ringSize / 2 - 4;
      const r2 = ringSize / 2 + 8;
      ring.lineStyle(1, C.gold, 0.34);
      ring.lineBetween(
        Math.cos(a) * r1,
        Math.sin(a) * r1,
        Math.cos(a) * r2,
        Math.sin(a) * r2,
      );
    }
    ring.setPosition(cx, cy);
    field.add(ring);
    const ringTween = this.animate({
      targets: ring,
      angle: 360,
      duration: 72000,
      repeat: -1,
      ease: "Linear",
    });
    if (ringTween) this.ambientTweens.push(ringTween);

    // Soft central pulse — a breathing halo behind the spread (ADD blend).
    const minSide = Math.min(W, H);
    const halo = this.add
      .image(cx, cy, FX_GLOW_KEY)
      .setTint(C.gold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.1)
      .setScale(minSide / 360);
    field.add(halo);
    const haloTween = this.animate({
      targets: halo,
      alpha: { from: 0.08, to: 0.2 },
      scale: { from: minSide / 360, to: minSide / 280 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    if (haloTween) this.ambientTweens.push(haloTween);

    // Drifting embers — denser, brighter, longer float + alpha twinkle.
    const emberCount = Math.min(30, Math.round(W / 20));
    for (let i = 0; i < emberCount; i++) {
      const ex = Phaser.Math.Between(0, W);
      const ey = Phaser.Math.Between(Math.round(H * 0.2), H);
      const ember = this.add.circle(
        ex,
        ey,
        Phaser.Math.FloatBetween(1.4, 3.4),
        i % 4 === 0 ? C.jade : C.gold,
        Phaser.Math.FloatBetween(0.35, 0.7),
      );
      field.add(ember);
      const drift = this.animate({
        targets: ember,
        y: ey - Phaser.Math.Between(40, 130),
        x: ex + Phaser.Math.Between(-40, 40),
        alpha: { from: ember.alpha, to: 0.08 },
        duration: Phaser.Math.Between(2400, 4800),
        delay: Phaser.Math.Between(0, 2600),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      if (drift) this.ambientTweens.push(drift);
    }
  }

  private buildAmbientField(_W: number, _H: number): void {
    this.ambientField = this.add.container(0, 0).setDepth(0);
  }

  private stopAmbientMotion(): void {
    this.ambientTweens.forEach((tween) => tween.stop());
    this.ambientTweens = [];
    this.ambientField?.removeAll(true);
  }

  // ── FX primitives (runtime-generated textures, no asset files) ─────────────

  private ensureFxTextures(): void {
    if (!this.textures.exists(FX_GLOW_KEY)) {
      const size = 128;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const steps = 26;
      for (let i = steps; i >= 1; i--) {
        const r = (size / 2) * (i / steps);
        const a = 0.5 * (1 - i / steps) + 0.015;
        g.fillStyle(0xffffff, a);
        g.fillCircle(size / 2, size / 2, r);
      }
      g.generateTexture(FX_GLOW_KEY, size, size);
      g.destroy();
    }
    if (!this.textures.exists(FX_SPARK_KEY)) {
      const s = 16;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(s / 2, 0),
          new Phaser.Geom.Point(s * 0.62, s * 0.38),
          new Phaser.Geom.Point(s, s / 2),
          new Phaser.Geom.Point(s * 0.62, s * 0.62),
          new Phaser.Geom.Point(s / 2, s),
          new Phaser.Geom.Point(s * 0.38, s * 0.62),
          new Phaser.Geom.Point(0, s / 2),
          new Phaser.Geom.Point(s * 0.38, s * 0.38),
        ],
        true,
      );
      g.generateTexture(FX_SPARK_KEY, s, s);
      g.destroy();
    }
  }

  /** Radial bloom + white core flash + expanding shockwave ring + sparkles. */
  private burstReveal(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
    const glow = this.add
      .image(x, y, FX_GLOW_KEY)
      .setTint(color)
      .setDepth(900)
      .setAlpha(0.9)
      .setScale(0.35);
    this.animate({
      targets: glow,
      scale: 2.3,
      alpha: 0,
      duration: 540,
      ease: "Cubic.easeOut",
      onComplete: () => glow.destroy(),
    });
    const core = this.add
      .image(x, y, FX_GLOW_KEY)
      .setTint(0xffffff)
      .setDepth(900)
      .setAlpha(0.7)
      .setScale(0.2);
    this.animate({
      targets: core,
      scale: 1.2,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => core.destroy(),
    });
    const ring = this.add.circle(x, y, 8, 0x000000, 0);
    ring.setStrokeStyle(3, color, 0.9).setDepth(900).setScale(0.6);
    this.animate({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 480,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.emitSparkles(x, y, color, 10, 900);
  }

  /** A vertical element-colored light beam erupting upward from the card. */
  private beamReveal(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
    const beam = this.add
      .image(x, y - 12, FX_GLOW_KEY)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(880)
      .setAlpha(0.85)
      .setScale(0.18, 0.55);
    this.animate({
      targets: beam,
      scaleX: 1.35,
      scaleY: 3.4,
      y: y - 76,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => beam.destroy(),
    });
  }

  private emitSparkles(
    x: number,
    y: number,
    color: number,
    count: number,
    depth = 900,
  ): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(26, 66);
      const spark = this.add
        .image(x, y, FX_SPARK_KEY)
        .setTint(color)
        .setDepth(depth)
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1))
        .setAlpha(0.95);
      this.animate({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 10,
        alpha: 0,
        scale: 0.2,
        angle: Phaser.Math.Between(-120, 120),
        duration: Phaser.Math.Between(420, 720),
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * A live reduced-motion change can arrive halfway through a deal, card flip,
   * hover press, or completion pulse. Killing those tweens without restoring
   * their targets would strand cards between the deck and spread, or leave a
   * flip at scaleX=0. Settle every animated object from authoritative bridge
   * state so the visual endpoint is deterministic.
   */
  private settleMotionToState(): void {
    const drawn = this.val<CardData[]>("drawn", []) ?? [];

    this.deckStack
      .setY(this.layout.cardCenterY + 18)
      .setAlpha(1)
      .setScale(1)
      .setAngle(0);
    this.actionButton.setScale(1);
    this.intentViews.forEach((view) => view.container.setScale(1));

    this.cardViews.forEach((view, index) => {
      const card = drawn[index];
      view.container
        .setPosition(
          Math.round(this.layout.startX + index * this.layout.gap),
          Math.round(this.layout.cardCenterY),
        )
        .setAlpha(1)
        .setScale(1)
        .setAngle(0);
      view.body.setScale(1);

      if (!card) {
        this.setEmptyCard(view, index);
        return;
      }

      const flipped = Boolean(card.flipped);
      view.flipped = flipped;
      view.emptyGroup.setVisible(false);
      view.back.setAlpha(flipped ? 0 : 1);
      view.face.setAlpha(flipped ? 1 : 0);
    });

    if (drawn.length > 0) this.dealtOnce = true;
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (this.assetRecoveryActive) {
      // The recovery button also uses Phaser feedback tweens. Rebuilding the
      // small panel after killAll guarantees it cannot remain half-pressed.
      this.tweens.killAll();
      this.buildCriticalAssetRecovery();
      return;
    }
    if (!this.layout || !this.deckStack) return;
    this.stopAmbientMotion();

    if (enabled) {
      // This includes deal, flip, hover/press, celebration, and ambient tweens.
      // Phaser's killAll intentionally skips completion callbacks, so settle
      // the state explicitly immediately afterwards.
      this.tweens.killAll();
      this.celebrationMotes.forEach((mote) => mote.destroy());
      this.celebrationMotes.clear();
      this.settleMotionToState();
      return;
    }

    // Switching the preference back off resumes only the ambient layer. A deal
    // or reveal that was deliberately settled above must not replay.
    this.startAmbientMotion();
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    // BaseScene announces readiness after wiring resize but before this class's
    // create() resumes. A host can therefore synchronously deliver its first
    // mobile size here. Detect missing preload textures directly so that early
    // resize also lands on the recovery panel instead of constructing a scene
    // with Phaser's missing-texture placeholder.
    const missingCriticalAssets = this.missingCriticalAssetKeys();
    if (this.assetRecoveryActive || missingCriticalAssets.length > 0) {
      missingCriticalAssets.forEach((key) =>
        this.criticalAssetFailures.add(key),
      );
      this.buildCriticalAssetRecovery();
      return;
    }
    this.rebuildScene(true);
    this.onStateUpdate(this.state);
    this.restoringLayout = false;
  }
}
