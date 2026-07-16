/**
 * PetPotionScene - Phaser 3 virtual pet nursery.
 *
 * Chain, wallet, TEE, and settlement stay in main.tsx. This scene owns the
 * playable surface: pick a nursery path, nurture the pet through illustrated
 * care tools, collect the recipe, brew a potion, and save the completed run.
 * Historical paid sessions can still recover through the same scene, while
 * new wallet-funded starts remain fail-closed in main.tsx.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";

const PET_ASSETS = {
  lab: "pet-potion-lab",
  egg: "pet-potion-egg",
  pets: ["pet-potion-baby", "pet-potion-teen", "pet-potion-adult"],
  actions: {
    feed: "pet-potion-action-feed",
    play: "pet-potion-action-play",
    pet: "pet-potion-action-pet",
    rest: "pet-potion-action-rest",
  },
  badges: ["pet-potion-badge-easy", "pet-potion-badge-medium", "pet-potion-badge-hard"],
  potion: "pet-potion-potion",
} as const;

const DESIGN_W = 420;
const DESIGN_H = 580;

// Shared vertical rhythm for the bottom content stack. Bands are tuned so the
// care goal, stat rows, and the difficulty/action cards never crowd or clip.
const GUTTER_L = 46;               // shared left edge for every label column
const GUTTER_R = DESIGN_W - 46;    // shared right edge for stat values
const STAT_BAR_L = 108;            // stat bars start after the label column
// Right gutter reserved for the stat value. It has to fit the widest thing that
// column ever prints: not a 3-digit number, but the sealed-state word ("Sealed"
// / "封存") that stands in before a run is dealt. The old 26px only ever fit the
// "--" it replaced.
const STAT_VALUE_W = 46;
const STAT_BAR_W = GUTTER_R - STAT_VALUE_W - STAT_BAR_L; // 220
const GOAL_BAR_W = GUTTER_R - GUTTER_L;        // 328
const STAGE_BADGE_DY = 94;         // stage pill offset below the pet centre
const GOAL_Y = 330;                // care-goal / progress-meter band centre
const STAT_Y0 = 358;               // first stat row centre
const STAT_ROW_DY = 20;            // stat row spacing

const C = {
  canvas: 0xfffbef,
  surface: 0xffffff,
  warm: 0xfff5dd,
  stroke: 0xead7ad,
  jade: 0x16a979,
  gold: 0xd8a742,
  orange: 0xf97316,
  rose: 0xef6f9b,
  blue: 0x5d7df0,
  purple: 0x9274d8,
  ink: 0x2f291f,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const FX_GLOW_KEY = "pet-potion-fx-glow";
const FX_SPARK_KEY = "pet-potion-fx-spark";
const ACTIONS = [
  { key: "feed", labelKey: "actionFeed", fallback: "Feed", asset: PET_ASSETS.actions.feed, color: C.orange },
  { key: "play", labelKey: "actionPlay", fallback: "Play", asset: PET_ASSETS.actions.play, color: C.purple },
  { key: "pet", labelKey: "actionPet", fallback: "Pet", asset: PET_ASSETS.actions.pet, color: C.rose },
  { key: "rest", labelKey: "actionRest", fallback: "Rest", asset: PET_ASSETS.actions.rest, color: C.blue },
] as const;

const DIFFICULTIES = [
  { id: 0, key: "easy", labelKey: "pathEasy", fallback: "Sprout", target: 50, entry: "0.02", reward: "0.10", badge: PET_ASSETS.badges[0] },
  { id: 1, key: "medium", labelKey: "pathMedium", fallback: "Glow", target: 70, entry: "0.10", reward: "0.50", badge: PET_ASSETS.badges[1] },
  { id: 2, key: "hard", labelKey: "pathHard", fallback: "Royal", target: 100, entry: "0.20", reward: "1.00", badge: PET_ASSETS.badges[2] },
] as const;

const MAX_CARE_ACTIONS = 40;

type PetActionKey = keyof typeof PET_ASSETS.actions;

type StatBar = {
  fill: Phaser.GameObjects.Rectangle;
  value: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
};

type ModeCard = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  id: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function compactError(value: string): string {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "Action failed.";
  return firstLine.length > 62 ? `${firstLine.slice(0, 59)}...` : firstLine;
}

function modeOf(id: number) {
  return DIFFICULTIES.find((mode) => mode.id === id) ?? DIFFICULTIES[0];
}

function isPlayingStatus(status: string): boolean {
  return status === "dealt" || status === "playing";
}

function fillTemplate(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export class PetPotionScene extends BaseScene {
  private labImage!: Phaser.GameObjects.Image;
  private labOverlay!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private petGlow!: Phaser.GameObjects.Ellipse;
  private petShadow!: Phaser.GameObjects.Ellipse;
  private sealRing!: Phaser.GameObjects.Graphics;
  private petImage!: Phaser.GameObjects.Image;
  private actionCue!: Phaser.GameObjects.Image;
  private potionHalo!: Phaser.GameObjects.Ellipse;
  private potionImage!: Phaser.GameObjects.Image;
  private potionText!: Phaser.GameObjects.Text;
  private stageBadge!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private careGoalText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private goalBox!: Phaser.GameObjects.Rectangle;
  private goalTrack!: Phaser.GameObjects.Rectangle;
  private goalFill!: Phaser.GameObjects.Rectangle;
  private brewBubbles: Phaser.GameObjects.Ellipse[] = [];
  private petMotes: Phaser.GameObjects.Image[] = [];
  private statBars: StatBar[] = [];
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private ingredientCountLabels: Phaser.GameObjects.Text[] = [];
  private modeCards: ModeCard[] = [];
  private modeCardRewards: Phaser.GameObjects.Text[] = [];
  private actionButtonLabels: Phaser.GameObjects.Text[] = [];
  private brandText!: Phaser.GameObjects.Text;
  private prevAppMode = "";
  private primaryButton!: Phaser.GameObjects.Container;
  private primaryButtonBg!: Phaser.GameObjects.Graphics;
  private primaryButtonLabel!: Phaser.GameObjects.Text;
  private retryButton!: Phaser.GameObjects.Container;
  private retryButtonBg!: Phaser.GameObjects.Graphics;
  private retryButtonLabel!: Phaser.GameObjects.Text;
  private releaseButton!: Phaser.GameObjects.Container;
  private releaseButtonBg!: Phaser.GameObjects.Graphics;
  private releaseButtonLabel!: Phaser.GameObjects.Text;
  private selectedDifficulty = 0;
  private currentStage = -1;
  private lastActionCount = 0;
  private cueTimer?: Phaser.Time.TimerEvent;
  private lastGameStatus = "idle";
  private lastTargetReached = false;
  private potionRevealed = false;

  constructor() {
    super("PetPotionScene");
  }

  private copy(key: string, fallback: string): string {
    return this.val<Record<string, string>>("sceneText", {})?.[key] || fallback;
  }

  private fmt(key: string, fallback: string, params: Record<string, string | number>): string {
    return fillTemplate(this.copy(key, fallback), params);
  }

  preload(): void {
    this.load.image(PET_ASSETS.lab, "./art/nursery-lab.webp");
    this.load.image(PET_ASSETS.egg, "./art/pet-egg.webp");
    this.load.image(PET_ASSETS.pets[0], "./art/pet-baby.webp");
    this.load.image(PET_ASSETS.pets[1], "./art/pet-teen.webp");
    this.load.image(PET_ASSETS.pets[2], "./art/pet-adult.webp");
    this.load.image(PET_ASSETS.actions.feed, "./art/action-feed.webp");
    this.load.image(PET_ASSETS.actions.play, "./art/action-play.webp");
    this.load.image(PET_ASSETS.actions.pet, "./art/action-pet.webp");
    this.load.image(PET_ASSETS.actions.rest, "./art/action-rest.webp");
    this.load.image(PET_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(PET_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(PET_ASSETS.badges[2], "./art/badge-hard.webp");
    this.load.image(PET_ASSETS.potion, "./art/potion-bottle.webp");
  }

  create(): void {
    super.create();

    this.input.on("pointerdown", this.unlockAudio, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
    this.fitCameraToHost();
    this.buildBackground(DESIGN_W, DESIGN_H);
    this.ensureFxTextures();
    this.buildHeader(DESIGN_W);
    this.buildPetStage(DESIGN_W, DESIGN_H);
    this.buildGoalMeter(DESIGN_W, DESIGN_H);
    this.buildStats(DESIGN_W, DESIGN_H);
    this.buildModeCards(DESIGN_W, DESIGN_H);
    this.buildActionButtons(DESIGN_W, DESIGN_H);
    this.buildPrimaryButton(DESIGN_W, DESIGN_H);
    this.buildRecoveryButtons(DESIGN_W, DESIGN_H);
    this.buildStatus(DESIGN_W, DESIGN_H);
    this.startAmbientMotion();
    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onStateUpdate(_state: GameState): void {
    const status = this.str("gameStatus", "idle");
    const appMode = this.str("appMode", "guest");
    const isGuest = appMode === "guest";
    if (appMode !== this.prevAppMode) {
      this.prevAppMode = appMode;
      this.applyRewardLabels(isGuest);
    }
    this.applyLocalizedLabels();
    const isPlaying = isPlayingStatus(status);
    const isLoading = this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isRecovering") ||
      this.bool("isConnectingWallet");
    const isActing = this.bool("isActing");
    const stateDifficulty = Math.max(0, Math.min(2, this.num("gameDifficulty", this.selectedDifficulty)));
    if (!isPlaying && this.selectedDifficulty !== stateDifficulty) {
      this.selectedDifficulty = stateDifficulty;
    }

    const happiness = this.num("petHappiness", 50);
    const hunger = this.num("petHunger", 50);
    const energy = this.num("petEnergy", 50);
    const achieved = this.num("happinessAchieved", 0);
    const actionsUsed = this.num("actionsUsed", 0);
    const stage = Math.max(0, Math.min(2, this.num("petStage", 0)));
    const activeMode = modeOf(isPlaying ? stateDifficulty : this.selectedDifficulty);
    const pathLabel = this.copy(activeMode.labelKey, activeMode.fallback);
    const targetReached = Math.max(achieved, happiness) >= activeMode.target;
    const timeUp = this.isRunTimedOut(status);
    const recipeComplete = !isGuest || this.bool("recipeReady");
    const potionBrewed = this.bool("potionBrewed");
    const careActionsOpen = isPlaying &&
      !timeUp &&
      !potionBrewed &&
      (!targetReached || !recipeComplete) &&
      actionsUsed < MAX_CARE_ACTIONS;

    this.modeCards.forEach((card) => card.container.setVisible(status === "idle" && !isLoading));
    this.updateModeCards();
    this.updateIngredientCounts();
    this.actionButtons.forEach((button) => button.setVisible(careActionsOpen).setAlpha(isLoading || isActing ? 0.52 : 1));

    this.titleText.setText(
      isLoading
        ? this.copy("titlePreparing", "Preparing pet")
        : status === "committed"
          ? this.copy("titleSealPending", "Seal pending")
          : status === "unknown"
            ? this.copy("titleSettlementPending", "Settlement pending")
            : status === "solved"
              ? this.copy("titleSolved", "Potion complete")
              : status === "expired" || status === "refunded"
                ? this.copy("titleClosed", "Run closed")
                : timeUp
                  ? this.copy("titleTimedOut", "Time is up")
                  : isPlaying
                    ? this.copy("titlePlaying", "Nurture the pet")
                    : this.copy("titleLobby", "Open the nursery"),
    );
    this.subtitleText.setText(
      status === "committed"
        ? this.copy("subtitleSealPending", "Retry the exact sealed run")
        : status === "unknown"
          ? this.copy("subtitleSettlementPending", "Recheck this exact game on-chain")
          : isPlaying
            ? this.fmt("subtitlePath", "{path} path · target {target}", { path: pathLabel, target: activeMode.target })
            : isGuest
              ? this.fmt("subtitleGuestPath", "{path} · goal {target}", { path: pathLabel, target: activeMode.target })
              : this.fmt("subtitleGameFiPath", "{entry} GAS entry · {reward} GAS reward", {
                  entry: activeMode.entry,
                  reward: activeMode.reward,
                }),
    );

    const visibleStage = status === "idle" || status === "expired" || status === "refunded"
      ? -1
      : stage;
    this.updatePet(visibleStage, status);

    // Care band: live runs (and the solved recap) show the progress meter and
    // real stats; idle/expired states show a static goal line with sealed,
    // preview stats so the secret starting values never look known.
    const runLive = isPlaying || status === "solved" || status === "unknown";
    this.goalBox.setVisible(runLive);
    this.goalTrack.setVisible(runLive);
    this.goalFill.setVisible(runLive);
    this.targetText.setVisible(runLive);
    this.careGoalText.setVisible(!runLive);
    this.updateStats(happiness, hunger, energy, runLive);
    if (runLive) {
      this.updateGoal(Math.max(achieved, happiness), activeMode.target);
    }
    this.updatePotion(PET_ASSETS.potion, potionBrewed || status === "solved");
    this.updatePrimaryButton(status, isPlaying, isLoading, targetReached, recipeComplete, potionBrewed, timeUp);
    this.updateRecoveryButtons();

    if (actionsUsed < this.lastActionCount) this.lastActionCount = actionsUsed;
    if (isPlaying && actionsUsed > this.lastActionCount) {
      this.pulsePet();
    }
    this.lastActionCount = actionsUsed;

    if (status !== this.lastGameStatus) {
      if (status === "solved") this.sfx.play("win");
      this.lastGameStatus = status;
    }
    const potionReady = potionBrewed || status === "solved";
    if (potionReady && !this.lastTargetReached) this.sfx.play("reveal");
    this.lastTargetReached = potionReady;

    this.targetText.setText(this.fmt("goalProgress", "Goal {current}/{target}", {
      current: Math.round(Math.max(achieved, happiness)),
      target: activeMode.target,
    }));
    this.careGoalText.setText(this.fmt("careGoal", "Raise happiness to {happiness}", {
      happiness: activeMode.target,
    }));
    const statusCopy = this.statusCopy(
      status,
      isLoading,
      targetReached,
      recipeComplete,
      potionBrewed,
      timeUp,
      actionsUsed,
    );
    this.statusText.setColor("#7b6d5a");
    this.statusText.setVisible(Boolean(statusCopy));
    this.statusText.setText(statusCopy);
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.sfx.play("error");
    this.statusText?.setText(compactError(error.message));
    this.statusText?.setColor("#d84d3f");
  }

  private buildBackground(W: number, H: number): void {
    // Branded warm base (Neo cream + soft mint tint).
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);
    this.add.rectangle(W / 2, H / 2, W, H, C.warm, 0.42).setDepth(0);

    // Landscape lab panorama shown CONTAINED as a sunlit window band behind
    // the pet — more prominent now (was 0.6 → 0.72).
    this.labImage = this.add.image(W / 2, 80, PET_ASSETS.lab);
    this.containImage(this.labImage, W - 24, Math.round((W - 24) * (430 / 1440)));
    this.labImage.setAlpha(0.72).setDepth(1);

    // Light veil — thinner than before so the lab shows through.
    this.labOverlay = this.add.rectangle(W / 2, H / 2, W, H, C.canvas, 0.14).setDepth(2);
    this.add.rectangle(W / 2, H - 42, W - 34, 116, C.warm, 0.88)
      .setStrokeStyle(1, C.stroke, 0.7)
      .setDepth(3);

    const frame = this.add.graphics().setDepth(4);
    frame.lineStyle(2, C.stroke, 0.65);
    frame.strokeRoundedRect(12, 12, W - 24, H - 24, 22);
  }

  private buildHeader(W: number): void {
    this.brandText = this.add.text(W / 2, 34, "PET POTION", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#0c705d",
      fontStyle: "bold",
      letterSpacing: 1.4,
    }).setOrigin(0.5).setDepth(5);

    this.titleText = this.add.text(W / 2, 60, "", {
      fontFamily: FONT,
      fontSize: "25px",
      color: "#2f291f",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(5);

    this.subtitleText = this.add.text(W / 2, 88, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7b6d5a",
      align: "center",
    }).setOrigin(0.5).setDepth(5);
  }

  private buildPetStage(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.34;
    const eggR = 100; // visual ring radius (egg is ~95px at 190 display)

    // ── Pedestal / ground shadow (grounds the egg visually) ──
    this.add.ellipse(cx, cy + 102, 180, 32, 0xc9b896, 0.35).setDepth(4);
    this.petShadow = this.add.ellipse(cx, cy + 92, 164, 34, 0x5c4b2c, 0.16).setDepth(4);

    // ── Magical seal ring (gold + jade glow) — makes the plain egg
    //   read as an "enchanted sealed artifact" not a bare circle ──
    this.sealRing = this.add.graphics().setDepth(5);
    this.sealRing.lineStyle(2.5, C.gold, 0.75);
    this.sealRing.strokeCircle(cx, cy, eggR + 8);
    // Inner thin ring for depth
    this.sealRing.lineStyle(1, C.jade, 0.45);
    this.sealRing.strokeCircle(cx, cy, eggR - 4);

    // Four rune markers on the seal ring (decorative dots)
    const runeAngle = [ -Math.PI/4, Math.PI/4, 3*Math.PI/4, 5*Math.PI/4 ];
    runeAngle.forEach((a, i) => {
      const rx = cx + (eggR + 8) * Math.cos(a);
      const ry = cy + (eggR + 8) * Math.sin(a);
      this.add.circle(rx, ry, 3.5, i % 2 === 0 ? C.gold : C.jade, 0.7).setDepth(6);
    });

    // ── Enhanced ambient glow behind egg ──
    this.petGlow = this.add.ellipse(cx, cy + 8, 224, 168, C.jade, 0.22).setDepth(4);

    this.buildBrewBubbles(cx, cy);
    this.petImage = this.add.image(cx, cy, PET_ASSETS.egg)
      .setDisplaySize(190, 190)
      .setDepth(6);
    this.actionCue = this.add.image(cx + 78, cy + 54, PET_ASSETS.actions.feed)
      .setDisplaySize(62, 62)
      .setAlpha(0)
      .setDepth(7);
    this.potionHalo = this.add.ellipse(cx + 104, cy + 26, 104, 124, C.gold, 0.14)
      .setStrokeStyle(1, C.white, 0.72)
      .setVisible(false)
      .setDepth(6);
    this.potionImage = this.add.image(cx + 104, cy + 24, PET_ASSETS.potion)
      .setDisplaySize(94, 94)
      .setVisible(false)
      .setDepth(8);
    this.potionText = this.add.text(cx + 104, cy - 44, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#7a5712",
      fontStyle: "bold",
      backgroundColor: "rgba(255,253,248,0.92)",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setVisible(false).setDepth(9);

    // Stage nameplate — tucked up near the pet/shadow so it reads as part of
    // the pet rather than crowding the care band beneath it.
    this.stageBadge = this.add.text(cx, cy + STAGE_BADGE_DY, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#0c705d",
      fontStyle: "bold",
      backgroundColor: "rgba(255,255,255,0.82)",
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setDepth(7);
  }

  /**
   * Alchemy brew effervescence around the egg/pet — leans the fixed nursery art
   * toward the "bubbling brew" potion anchor. Two layers:
   *  1. A few static motes resting at the vessel base — created unconditionally
   *     (no tween), so the potion cue reads in the idle first frame AND for
   *     prefers-reduced-motion users who never see the rising loop below.
   *  2. Rising, sine-fading bubbles — an ambient loop, so created only when
   *     reduced-motion is off (those users keep a calm, still brew surface).
   */
  private buildBrewBubbles(cx: number, cy: number): void {
    // Layer 1 — settled brew, always present, reduced-motion safe (no tween).
    // Each mote is a tinted bubble with a soft white rim + specular highlight so
    // it still reads as effervescence against the bright gold vessel.
    const restSpecs = [
      { dx: -70, dy: 66, r: 3.6, tint: C.jade, alpha: 0.5 },
      { dx: -44, dy: 58, r: 4.6, tint: 0xbfe8d6, alpha: 0.56 },
      { dx: -20, dy: 68, r: 3.0, tint: C.gold, alpha: 0.5 },
      { dx: 22, dy: 66, r: 4.4, tint: C.jade, alpha: 0.54 },
      { dx: 46, dy: 58, r: 3.4, tint: 0xbfe8d6, alpha: 0.5 },
      { dx: 70, dy: 66, r: 3.0, tint: C.gold, alpha: 0.5 },
    ];
    restSpecs.forEach((spec) => {
      this.add
        .ellipse(cx + spec.dx, cy + spec.dy, spec.r * 2, spec.r * 2, spec.tint, spec.alpha)
        .setStrokeStyle(1, C.white, 0.62)
        .setDepth(7);
      this.add
        .ellipse(cx + spec.dx - spec.r * 0.32, cy + spec.dy - spec.r * 0.32, spec.r * 0.7, spec.r * 0.7, C.white, 0.7)
        .setDepth(7);
    });

    // Layer 2 — rising loop, motion users only.
    if (this.reducedMotion) return;
    const specs = [
      { dx: -90, r: 6, tint: C.jade, peak: 0.62, depth: 7 },
      { dx: -60, r: 5, tint: 0xbfe8d6, peak: 0.5, depth: 5 },
      { dx: -30, r: 7, tint: C.gold, peak: 0.44, depth: 5 },
      { dx: 34, r: 6, tint: 0xbfe8d6, peak: 0.52, depth: 5 },
      { dx: 64, r: 5, tint: C.jade, peak: 0.6, depth: 7 },
      { dx: 92, r: 7, tint: C.gold, peak: 0.46, depth: 5 },
    ];
    specs.forEach((spec, index) => {
      const baseY = cy + 78 - (index % 3) * 6;
      const bubble = this.add
        .ellipse(cx + spec.dx, baseY, spec.r * 2, spec.r * 2, spec.tint, 0.92)
        .setAlpha(0)
        .setDepth(spec.depth);
      bubble.setData({ baseX: cx + spec.dx, baseY, peak: spec.peak, index });
      this.brewBubbles.push(bubble);
    });
  }

  private buildGoalMeter(W: number, H: number): void {
    void H;
    const y = GOAL_Y;
    // Progress meter — shown only while a run is live (or solved). Kept out of
    // idle so an empty track never reads as a stuck near-full progress bar.
    this.goalBox = this.add.rectangle(W / 2, y, W - 84, 34, C.surface, 0.9)
      .setStrokeStyle(1, C.stroke, 0.62)
      .setDepth(5);
    this.targetText = this.add.text(GUTTER_L, y - 9, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#2f291f",
      fontStyle: "bold",
    }).setOrigin(0, 0.5).setDepth(6);
    this.goalTrack = this.add.rectangle(GUTTER_L, y + 9, GOAL_BAR_W, 8, 0xeadfc8, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(6);
    this.goalFill = this.add.rectangle(GUTTER_L, y + 9, 0, 8, C.jade, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(7);

    // Idle care-goal — a single, static line (no track) that states the aim
    // without implying live progress. Occupies the same band as the meter.
    this.careGoalText = this.add.text(W / 2, y, "", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#3f7a5f",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5).setDepth(6);
  }

  private buildStats(W: number, H: number): void {
    void W;
    void H;
    const defs = [
      { label: "Happy", color: C.rose },
      { label: "Fed", color: C.orange },
      { label: "Energy", color: C.blue },
    ] as const;
    defs.forEach((def, index) => {
      const y = STAT_Y0 + index * STAT_ROW_DY;
      // 11px on the #fffbef canvas: #7b6d5a only cleared 4.86:1, and the sealed
      // branch below then knocked it back further with alpha, so the meter
      // names read as washed-out gray. #5f5340 is the same warm brown at 7.25:1
      // and stays plainly subordinate to the #2f291f live value (13.92:1).
      const label = this.add.text(GUTTER_L, y, def.label, {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#5f5340",
        fontStyle: "bold",
      }).setOrigin(0, 0.5).setDepth(6);
      // The empty track was 0xeadfc8 at 0.88 — 1.28:1 against the canvas, i.e.
      // very nearly invisible. With no fill drawn before the first run, this
      // groove IS the meter, so it has to be visible enough to read as one.
      this.add.rectangle(STAT_BAR_L, y, STAT_BAR_W, 8, 0xc9ac79, 1)
        .setOrigin(0, 0.5)
        .setDepth(6);
      const fill = this.add.rectangle(STAT_BAR_L, y, 1, 8, def.color, 0.95)
        .setOrigin(0, 0.5)
        .setDepth(7);
      const value = this.add.text(GUTTER_R, y, this.copy("statSealed", "Sealed"), {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#2f291f",
        fontStyle: "bold",
      }).setOrigin(1, 0.5).setDepth(6);
      this.statBars.push({ fill, value, label });
    });
  }

  private buildModeCards(W: number, H: number): void {
    const startX = W / 2 - 116;
    const y = H - 116;
    DIFFICULTIES.forEach((mode, index) => {
      const container = this.add.container(startX + index * 116, y).setDepth(8);
      const bg = this.add.graphics();
      const badge = this.add.image(0, -16, mode.badge).setDisplaySize(38, 38);
      const label = this.add.text(0, 13, mode.fallback, {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#2f291f",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const reward = this.add.text(0, 31, `${mode.reward} GAS`, {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#0c705d",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.modeCardRewards.push(reward);

      bg.setInteractive(new Phaser.Geom.Rectangle(-45, -43, 90, 84), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: container,
        hoverScale: 1.04,
        pressScale: 0.95,
        onPress: () => {
          this.sfx.play("select");
          this.selectedDifficulty = mode.id;
          this.dispatch("selectDifficulty", { difficulty: mode.id });
          this.updateModeCards();
        },
      });

      container.add([bg, badge, label, reward]);
      this.modeCards.push({ container, bg, label, id: mode.id });
    });
  }

  private buildActionButtons(W: number, H: number): void {
    const y = H - 104;
    const startX = W / 2 - 135;
    ACTIONS.forEach((action, index) => {
      const container = this.add.container(startX + index * 90, y).setDepth(9);
      const bg = this.add.graphics();
      this.renderActionButton(bg, action.color, false);
      bg.setInteractive(new Phaser.Geom.Rectangle(-37, -44, 74, 88), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: container,
        enabled: () => this.canRecordCareAction(),
        hoverScale: 1.05,
        pressScale: 0.91,
        onPress: () => {
          if (!this.canRecordCareAction()) return;
          // Cute care chirp for every feed/play/pet/rest interaction.
          this.sfx.tones([{ frequency: 900, duration: 0.06, type: "triangle", gain: 0.022, endFrequency: 1400 }]);
          this.showActionCue(action.key);
          this.dispatch("recordAction", { type: action.key });
        },
        onHoverIn: () => this.renderActionButton(bg, action.color, true),
        onHoverOut: () => this.renderActionButton(bg, action.color, false),
      });

      const icon = this.add.image(0, -12, action.asset).setDisplaySize(50, 50);
      const countBg = this.add.circle(26, -34, 11, C.jade, 0.96)
        .setStrokeStyle(2, C.white, 0.88);
      const count = this.add.text(26, -34, "0", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const label = this.add.text(0, 30, action.fallback, {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#2f291f",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.actionButtonLabels.push(label);
      this.ingredientCountLabels.push(count);
      container.add([bg, icon, countBg, count, label]);
      container.setVisible(false);
      this.actionButtons.push(container);
    });
  }

  private buildPrimaryButton(W: number, H: number): void {
    this.primaryButton = this.add.container(W / 2, H - 42).setDepth(10);
    this.primaryButtonBg = this.add.graphics();
    this.primaryButtonBg.setInteractive(new Phaser.Geom.Rectangle(-114, -23, 228, 46), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(this.primaryButtonBg, {
      targets: this.primaryButton,
      enabled: () => this.canUsePrimaryAction(),
      hoverScale: 1.03,
      pressScale: 0.95,
      onPress: () => this.handlePrimaryAction(),
    });

    this.primaryButtonLabel = this.add.text(0, 0, "Begin care", {
      fontFamily: FONT,
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.primaryButton.add([this.primaryButtonBg, this.primaryButtonLabel]);
  }

  private buildRecoveryButtons(W: number, H: number): void {
    this.retryButton = this.add.container(W / 2 - 76, H - 42).setDepth(10);
    this.retryButtonBg = this.add.graphics();
    this.retryButtonBg.setInteractive(new Phaser.Geom.Rectangle(-72, -21, 144, 42), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(this.retryButtonBg, {
      targets: this.retryButton,
      hoverScale: 1.03,
      pressScale: 0.95,
      onPress: () => {
        if (!this.canRecoverRun()) return;
        this.sfx.play("select");
        if (!this.isGuestMode() && !this.bool("walletConnected")) {
          this.dispatch("connectWallet");
          return;
        }
        this.dispatch(this.str("gameStatus", "idle") === "unknown" || this.bool("inputSyncFailed")
          ? "recoverGame"
          : "retryDeal");
      },
    });
    this.retryButtonLabel = this.add.text(0, 0, "Retry sealing", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.retryButton.add([this.retryButtonBg, this.retryButtonLabel]);

    this.releaseButton = this.add.container(W / 2 + 92, H - 42).setDepth(10);
    this.releaseButtonBg = this.add.graphics();
    this.releaseButtonBg.setInteractive(new Phaser.Geom.Rectangle(-62, -21, 124, 42), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(this.releaseButtonBg, {
      targets: this.releaseButton,
      hoverScale: 1.03,
      pressScale: 0.95,
      onPress: () => {
        if (!this.canReleaseAbandoned()) return;
        this.sfx.play("chip");
        this.dispatch("expireGame");
      },
    });
    this.releaseButtonLabel = this.add.text(0, 0, "Release run", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.releaseButton.add([this.releaseButtonBg, this.releaseButtonLabel]);

    this.retryButton.setVisible(false);
    this.releaseButton.setVisible(false);
    this.renderRecoveryButton(this.retryButtonBg, 144, C.jade, true);
    this.renderRecoveryButton(this.releaseButtonBg, 124, 0xd95e4f, true);
  }

  private buildStatus(W: number, H: number): void {
    this.statusText = this.add.text(W / 2, H - 15, "", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#7b6d5a",
      align: "center",
      wordWrap: { width: W - 64 },
    }).setOrigin(0.5).setDepth(10);
  }

  private updatePet(stage: number, status: string): void {
    const texture = stage < 0
      ? PET_ASSETS.egg
      : PET_ASSETS.pets[Math.max(0, Math.min(2, stage))]!;
    if (stage !== this.currentStage || this.petImage.texture.key !== texture) {
      if (stage > this.currentStage && stage >= 0) {
        this.sfx.play(this.currentStage < 0 ? "spawn" : "combo");
        this.evolveFx(stage);
      }
      this.currentStage = stage;
      this.petImage.setTexture(texture);
      const size = stage < 0 ? 178 : stage === 0 ? 182 : stage === 1 ? 202 : 218;
      this.petImage.setDisplaySize(size, size);
      this.animate({
        targets: this.petImage,
        scaleX: this.petImage.scaleX * 1.04,
        scaleY: this.petImage.scaleY * 1.04,
        duration: 160,
        ease: "Sine.easeOut",
        yoyo: true,
      });
    }

    const label = stage < 0
      ? status === "expired" || status === "refunded"
        ? this.copy("stageResting", "Pet resting")
        : this.copy("stageEgg", "Sealed egg")
      : stage === 0
        ? this.copy("stageBaby", "Baby")
        : stage === 1
          ? this.copy("stageTeen", "Teen")
          : this.copy("stageAdult", "Adult");
    this.stageBadge.setText(label);
    this.petGlow.setFillStyle(stage === 2 ? C.gold : C.jade, stage === 2 ? 0.18 : 0.12);
  }

  private updateStats(happiness: number, hunger: number, energy: number, live: boolean): void {
    // `hunger` is the Morpheus engine's satiety/fuel meter: feeding raises it.
    [happiness, hunger, energy].forEach((value, index) => {
      const stat = this.statBars[index];
      if (!stat) return;
      if (live) {
        const pct = clamp01(value / 100);
        this.animate({
          targets: stat.fill,
          displayWidth: pct * STAT_BAR_W,
          duration: 220,
          ease: "Sine.easeOut",
        });
        stat.fill.setAlpha(0.95);
        stat.label.setAlpha(1);
        stat.value.setText(String(Math.round(value)));
        stat.value.setColor("#2f291f");
      } else {
        // Sealed preview: empty, faded bar so the enclave's secret starting
        // stats never read as live known values before the run. That intent is
        // unchanged — printing "0" here would be fabricated data. What changed
        // is the placeholder: a bare "--" made three finished meters look
        // broken next to a "Raise happiness to 50" goal line. Naming the state
        // says the same thing honestly, and matches the "Sealed egg" badge.
        this.animate({
          targets: stat.fill,
          displayWidth: 0,
          duration: 200,
          ease: "Sine.easeOut",
        });
        stat.fill.setAlpha(0.35);
        // "Sealed" is an honest STATE, not a disabled control, and the meter
        // names are true whether or not a run has started. Dimming the label to
        // 0.72 alpha and the value to #b6a68c (2.3:1 — an AA failure at 11px)
        // rendered the whole block as greyed-out chrome on the first view, so a
        // visitor read three broken meters rather than three sealed ones. Keep
        // the label at full strength and give the value a legible muted brown
        // (5.06:1) that still sits clearly below the live #2f291f reading.
        stat.label.setAlpha(1);
        stat.value.setText(this.copy("statSealed", "Sealed"));
        stat.value.setColor("#7a6a52");
      }
    });
  }

  private updateGoal(value: number, target: number): void {
    const pct = target > 0 ? clamp01(value / target) : 0;
    this.animate({
      targets: this.goalFill,
      displayWidth: pct * GOAL_BAR_W,
      duration: 260,
      ease: "Sine.easeOut",
    });
    this.goalFill.setFillStyle(pct >= 1 ? C.gold : C.jade);
  }

  private updatePotion(texture: string, visible: boolean): void {
    this.potionImage.setTexture(texture);
    this.potionText.setText(this.copy("potionReady", "Potion ready!"));
    if (!visible) {
      this.potionHalo.setVisible(false);
      this.potionImage.setVisible(false);
      this.potionText.setVisible(false);
      this.potionRevealed = false;
      return;
    }

    this.potionHalo.setVisible(true);
    this.potionImage.setVisible(true);
    this.potionText.setVisible(true);
    if (this.potionRevealed) return;
    this.potionRevealed = true;

    const fxX = DESIGN_W / 2 + 104;
    const fxY = DESIGN_H * 0.34 + 24;
    this.emitSparkles(fxX, fxY, C.gold, 12, 900);
    this.beamReveal(fxX, fxY, C.gold);

    const targetY = DESIGN_H * 0.34 + 24;
    this.potionImage.setDisplaySize(58, 58).setAlpha(0).setY(targetY + 14);
    this.potionHalo.setScale(0.72).setAlpha(0);
    this.potionText.setAlpha(0).setY(DESIGN_H * 0.34 - 36);
    this.animate({
      targets: this.potionImage,
      displayWidth: 94,
      displayHeight: 94,
      alpha: 1,
      y: targetY,
      duration: 360,
      ease: "Back.easeOut",
    });
    this.animate({
      targets: this.potionHalo,
      scaleX: 1,
      scaleY: 1,
      alpha: 0.2,
      duration: 440,
      ease: "Sine.easeOut",
    });
    this.animate({
      targets: this.potionText,
      alpha: 1,
      y: DESIGN_H * 0.34 - 44,
      duration: 260,
      delay: 120,
      ease: "Sine.easeOut",
    });
  }

  private updatePrimaryButton(
    status: string,
    isPlaying: boolean,
    isLoading: boolean,
    targetReached: boolean,
    recipeComplete: boolean,
    potionBrewed: boolean,
    timeUp: boolean,
  ): void {
    const moveCapReached = this.num("actionsUsed", 0) >= MAX_CARE_ACTIONS;
    const show = status === "idle" ||
      status === "solved" ||
      status === "expired" ||
      status === "refunded" ||
      (isPlaying && ((targetReached && recipeComplete) || potionBrewed || timeUp || moveCapReached));
    this.primaryButton.setVisible(show);
    if (!show) return;

    const disconnected = !this.isGuestMode() && !this.bool("walletConnected");
    const label = this.bool("isConnectingWallet")
      ? this.copy("connectingWallet", "Connecting wallet…")
      : isLoading
        ? this.copy("working", "Working…")
      : isPlaying
        ? (timeUp || moveCapReached
            ? this.copy("settleRun", "Settle run")
            : !potionBrewed
              ? this.copy("brewPotion", "Brew potion")
              : this.isGuestMode()
                ? this.copy("saveScore", "Save score")
                : this.copy("claimReward", "Claim reward"))
        // Pool-low copy outranks the lobby launch labels (flappy-dash order):
        // the disabled start must say why instead of silently eating taps.
        : !this.rewardPoolReady()
          ? this.copy("statusPoolLow", "Pool refilling for this nursery path")
        : status === "solved"
          ? this.copy("raiseAnother", "Raise another pet")
          : status === "expired" || status === "refunded"
            ? this.copy("tryAgain", "Try again")
            : disconnected
              ? this.copy("connectWallet", "Connect wallet")
              : !this.isGuestMode() && !this.bool("newPaidRunsEnabled")
                ? this.copy("paidLocked", "Paid care unavailable")
                : this.copy("beginCare", "Begin care");
    const enabled = this.canUsePrimaryAction();
    this.primaryButtonLabel.setText(label);
    this.renderPrimaryButton(enabled, isPlaying ? "reward" : "start");
  }

  private updateRecoveryButtons(): void {
    const canRecover = this.canRecoverRun();
    const canRelease = this.canReleaseAbandoned();
    this.retryButton.setVisible(canRecover);
    this.releaseButton.setVisible(canRelease);
    this.retryButton.setX(canRelease ? DESIGN_W / 2 - 76 : DESIGN_W / 2);
    this.retryButtonLabel.setText(
      !this.isGuestMode() && !this.bool("walletConnected")
        ? this.copy("connectWallet", "Connect wallet")
        : this.str("gameStatus", "idle") === "unknown"
        ? this.copy("checkSettlement", "Check settlement")
        : this.copy("retrySealing", "Retry sealing"),
    );
    this.releaseButtonLabel.setText(this.copy("releaseRun", "Release run"));
    this.renderRecoveryButton(this.retryButtonBg, 144, C.jade, canRecover);
    this.renderRecoveryButton(this.releaseButtonBg, 124, 0xd95e4f, canRelease);
  }

  private handlePrimaryAction(): void {
    const status = this.str("gameStatus", "idle");
    if (!this.canUsePrimaryAction()) return;
    if (!this.isGuestMode() && !this.bool("walletConnected")) {
      this.sfx.play("select");
      this.dispatch("connectWallet");
      return;
    }
    if (isPlayingStatus(status)) {
      this.sfx.play("chip");
      const moveCapReached = this.num("actionsUsed", 0) >= MAX_CARE_ACTIONS;
      if (!this.isRunTimedOut(status) && !moveCapReached && !this.bool("potionBrewed")) {
        this.dispatch("brewPotion");
      } else {
        this.dispatch("submitSolution");
      }
      return;
    }
    this.sfx.play("throw");
    this.dispatch("startGame", this.selectedDifficulty);
  }

  private showActionCue(key: PetActionKey): void {
    this.cueTimer?.remove(false);
    this.tweens.killTweensOf(this.actionCue);
    this.actionCue.setTexture(PET_ASSETS.actions[key]);
    const targetY = this.petImage.y + 42;
    this.actionCue
      .setDisplaySize(this.reducedMotion ? 62 : 48, this.reducedMotion ? 62 : 48)
      .setAlpha(this.reducedMotion ? 1 : 0)
      .setY(targetY + (this.reducedMotion ? 0 : 8))
      .setRotation(Phaser.Math.DegToRad(-6));
    if (this.reducedMotion) {
      this.cueTimer = this.time.delayedCall(520, () => this.actionCue.setAlpha(0));
      this.pulsePet();
      return;
    }
    this.animate({
      targets: this.actionCue,
      alpha: 1,
      displayWidth: 62,
      displayHeight: 62,
      y: targetY,
      duration: 120,
      ease: "Back.easeOut",
      yoyo: true,
      hold: 360,
      onComplete: () => this.actionCue.setAlpha(0),
    });
    this.pulsePet();
  }

  private pulsePet(): void {
    this.animate({
      targets: this.petImage,
      scaleX: this.petImage.scaleX * 1.04,
      scaleY: this.petImage.scaleY * 1.04,
      duration: 140,
      ease: "Sine.easeOut",
      yoyo: true,
    });
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

  /** Light burst + sparkles + beam when the pet hatches or evolves. */
  private evolveFx(stage: number): void {
    if (this.reducedMotion) return;
    const cx = DESIGN_W / 2;
    const cy = DESIGN_H * 0.34;
    const color = stage === 0 ? C.jade : stage === 1 ? C.blue : C.gold;
    this.cameras.main.shake(160, 0.005);
    this.emitSparkles(cx, cy, color, 16, 900);
    this.beamReveal(cx, cy, color);
  }

  private startAmbientMotion(): void {
    // Reduced-motion aware: this.animate() no-ops (leaving a still pet, glow,
    // and overlay) when prefers-reduced-motion is on.
    this.stopAmbientMotion();
    this.animate({
      targets: this.petImage,
      y: this.petImage.y - 7,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.animate({
      targets: this.petGlow,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0.28,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // Seal ring gentle pulse — makes it feel alive/magical
    if (this.sealRing) {
      this.animate({
        targets: this.sealRing,
        alpha: { from: 0.6, to: 1 },
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    // Ambient floating sparkles around the pet area
    this.startPetMotes();
    this.animate({
      targets: this.labOverlay,
      alpha: 0.6,
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.startBrewBubbleMotion();
  }

  private startBrewBubbleMotion(): void {
    if (this.reducedMotion) return;
    this.brewBubbles.forEach((bubble) => {
      const baseX = Number(bubble.getData("baseX"));
      const baseY = Number(bubble.getData("baseY"));
      const peak = Number(bubble.getData("peak"));
      const index = Number(bubble.getData("index"));
      bubble.setPosition(baseX, baseY).setScale(1).setAlpha(0);
      this.tweens.add({
        targets: bubble,
        y: baseY - 128,
        scale: 1.35,
        duration: 2300 + index * 220,
        delay: index * 130,
        repeat: -1,
        repeatDelay: 140,
        ease: "Sine.easeOut",
        onUpdate: (tween) => bubble.setAlpha(Math.sin(tween.progress * Math.PI) * peak),
        onRepeat: () => bubble.setPosition(baseX, baseY).setScale(1),
      });
    });
  }

  private stopAmbientMotion(): void {
    if (!this.petImage || !this.petGlow || !this.labOverlay) return;
    this.tweens.killTweensOf([this.petImage, this.petGlow, this.labOverlay, ...this.brewBubbles, ...this.petMotes]);
  }

  // ── Floating ambient sparkles around the pet area (uses fx-spark texture) ──
  private startPetMotes(): void {
    if (this.reducedMotion) return;
    const cx = DESIGN_W / 2;
    const cy = DESIGN_H * 0.34;
    const COUNT = 8;

    for (let i = 0; i < COUNT; i++) {
      const angle = (Math.PI * 2 / COUNT) * i + Math.random() * 0.4;
      const dist = 110 + Math.random() * 40;
      const mx = cx + Math.cos(angle) * dist;
      const my = cy + Math.sin(angle) * dist;

      const mote = this.add.image(mx, my, FX_SPARK_KEY)
        .setTint(C.jade)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.5 + Math.random() * 0.6)
        .setAlpha(0)
        .setDepth(7);

      this.petMotes.push(mote);

      // Each mote drifts in a small orbit with staggered timing.
      this.animate({
        targets: mote,
        x: mx + (Math.random() - 0.5) * 30,
        y: my + (Math.random() - 0.5) * 24,
        alpha: { from: 0, to: 0.55 + Math.random() * 0.35 },
        scale: mote.scaleX * (1.15 + Math.random() * 0.35),
        duration: 2000 + Math.random() * 1800,
        yoyo: true,
        repeat: -1,
        delay: i * 180,
        ease: "Sine.easeInOut",
      });
    }
  }

  protected onReducedMotionChange(enabled: boolean): void {
    this.stopAmbientMotion();
    if (enabled) {
      this.brewBubbles.forEach((bubble) => bubble.setAlpha(0.18).setScale(1));
      return;
    }
    this.startAmbientMotion();
  }

  private updateModeCards(): void {
    this.modeCards.forEach((card) => {
      const active = card.id === this.selectedDifficulty;
      this.renderModeCard(card.bg, active, false);
      card.label.setColor(active ? "#0c705d" : "#2f291f");
    });
  }

  private updateIngredientCounts(): void {
    const counts = this.val<Record<string, number>>("ingredientCounts", {}) ?? {};
    this.ingredientCountLabels.forEach((label, index) => {
      const action = ACTIONS[index];
      const value = action ? Math.max(0, Math.floor(Number(counts[action.key]) || 0)) : 0;
      label.setText(String(value));
    });
  }

  private renderModeCard(bg: Phaser.GameObjects.Graphics, active: boolean, hover: boolean): void {
    bg.clear();
    bg.fillStyle(active ? 0xf2fffb : C.surface, hover || active ? 0.98 : 0.88);
    bg.fillRoundedRect(-45, -43, 90, 84, 13);
    bg.lineStyle(active ? 2 : 1, active ? C.jade : C.stroke, active ? 0.78 : 0.62);
    bg.strokeRoundedRect(-45, -43, 90, 84, 13);
  }

  private renderActionButton(bg: Phaser.GameObjects.Graphics, color: number, hover: boolean): void {
    bg.clear();
    bg.fillStyle(C.surface, hover ? 0.98 : 0.9);
    bg.fillRoundedRect(-37, -44, 74, 88, 14);
    bg.fillStyle(color, hover ? 0.16 : 0.1);
    bg.fillRoundedRect(-28, -38, 56, 56, 16);
    bg.lineStyle(1, color, hover ? 0.58 : 0.32);
    bg.strokeRoundedRect(-37, -44, 74, 88, 14);
  }

  private renderPrimaryButton(enabled: boolean, tone: "start" | "reward" | "danger"): void {
    this.primaryButtonBg.clear();
    const color = tone === "danger" ? 0xd95e4f : tone === "reward" ? C.gold : C.jade;
    this.primaryButtonBg.fillStyle(enabled ? color : 0xcdbf9c, enabled ? 0.96 : 0.72);
    this.primaryButtonBg.fillRoundedRect(-114, -23, 228, 46, 16);
    this.primaryButtonBg.fillStyle(C.white, 0.13);
    this.primaryButtonBg.fillRoundedRect(-114, -23, 228, 19, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.primaryButtonBg.lineStyle(1, enabled ? C.white : C.stroke, enabled ? 0.36 : 0.4);
    this.primaryButtonBg.strokeRoundedRect(-114, -23, 228, 46, 16);
    this.primaryButtonBg.setAlpha(enabled ? 1 : 0.72);
  }

  private renderRecoveryButton(bg: Phaser.GameObjects.Graphics, width: number, color: number, enabled: boolean): void {
    const half = width / 2;
    bg.clear();
    bg.fillStyle(enabled ? color : 0xcdbf9c, enabled ? 0.95 : 0.68);
    bg.fillRoundedRect(-half, -21, width, 42, 14);
    bg.fillStyle(C.white, 0.12);
    bg.fillRoundedRect(-half, -21, width, 17, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(1, C.white, enabled ? 0.32 : 0.2);
    bg.strokeRoundedRect(-half, -21, width, 42, 14);
    bg.setAlpha(enabled ? 1 : 0.72);
  }

  private statusCopy(
    status: string,
    isLoading: boolean,
    targetReached: boolean,
    recipeComplete: boolean,
    potionBrewed: boolean,
    timeUp: boolean,
    actionsUsed: number,
  ): string {
    const guest = this.isGuestMode();
    if (this.bool("inputSyncFailed")) {
      return !guest && !this.bool("walletConnected")
        ? this.copy("statusReconnectWallet", "Reconnect your wallet to recover this exact run.")
        : this.copy("statusInputSyncFailed", "Care verification paused. Recover this exact run.");
    }
    if (isLoading) {
      return guest
        ? this.copy("statusPreparingGuest", "Preparing your pet…")
        : this.copy("statusPreparingGameFi", "Wallet and enclave are preparing the run.");
    }
    if (status === "committed") {
      return this.copy("statusSealPending", "Sealing is taking longer than usual. Retry this run.");
    }
    if (status === "unknown") {
      const releaseIn = this.num("releaseInMs", 0);
      return releaseIn > 0
        ? this.fmt("statusReleaseCountdown", "Settlement pending · recovery unlocks in {time}", {
            time: formatCountdown(releaseIn),
          })
        : this.copy("statusReleaseReady", "Check settlement or release the abandoned run.");
    }
    if (status === "solved") {
      return guest
        ? this.copy("statusSolvedGuest", "Run saved. Raise another pet when ready.")
        : this.copy("statusSolvedGameFi", "Reward credited. Start another care run when ready.");
    }
    if (status === "expired" || status === "refunded") {
      return this.copy("statusClosed", "This run is closed. Start a fresh pet when ready.");
    }
    if (isPlayingStatus(status)) {
      if (timeUp) return this.copy("statusTimeUp", "Time is up. Settle this exact run.");
      if (potionBrewed) return this.copy("statusPotionBrewed", "Potion ready. Save this run.");
      if (targetReached && !recipeComplete) {
        return this.copy("statusRecipeMissing", "Happiness ready — collect one essence from every care tool.");
      }
      if (targetReached) {
        return guest
          ? this.copy("statusTargetGuest", "Recipe ready! Brew the potion.")
          : this.copy("statusTargetGameFi", "Care target ready. Brew before settlement.");
      }
      return this.fmt("statusActionCount", "{used} / {max} care actions used", {
        used: actionsUsed,
        max: MAX_CARE_ACTIONS,
      });
    }
    return "";
  }

  private canRecordCareAction(): boolean {
    const status = this.str("gameStatus", "idle");
    const mode = modeOf(this.num("gameDifficulty", this.selectedDifficulty));
    const happiness = Math.max(this.num("happinessAchieved", 0), this.num("petHappiness", 0));
    const targetReached = happiness >= mode.target;
    const recipeComplete = !this.isGuestMode() || this.bool("recipeReady");
    return (
      isPlayingStatus(status) &&
      !this.bool("isActing") &&
      !this.bool("isSubmitting") &&
      !this.bool("isRecovering") &&
      !this.bool("isDealing") &&
      !this.bool("inputSyncFailed") &&
      !this.isRunTimedOut(status) &&
      (!targetReached || !recipeComplete) &&
      this.num("actionsUsed", 0) < MAX_CARE_ACTIONS
    );
  }

  private canUsePrimaryAction(): boolean {
    const status = this.str("gameStatus", "idle");
    const busy = this.bool("isStarting") ||
      this.bool("isDealing") ||
      this.bool("isSubmitting") ||
      this.bool("isRecovering") ||
      this.bool("isConnectingWallet") ||
      this.bool("isActing");
    if (busy) return false;
    const lobby = status === "idle" || status === "solved" || status === "expired" || status === "refunded";
    // Fleet gate (restored from the deleted DOM PlayArea): a paid run must
    // never start while the reward pool cannot cover the payout. Guest play
    // is a free local game and stays exempt inside rewardPoolReady().
    if (lobby && !this.rewardPoolReady()) return false;
    if (!this.isGuestMode() && !this.bool("walletConnected")) return lobby;
    if (lobby) return this.isGuestMode() || this.bool("newPaidRunsEnabled");
    if (!isPlayingStatus(status)) return false;
    const mode = modeOf(this.num("gameDifficulty", this.selectedDifficulty));
    const targetReached = Math.max(this.num("happinessAchieved", 0), this.num("petHappiness", 0)) >= mode.target;
    const recipeComplete = !this.isGuestMode() || this.bool("recipeReady");
    const moveCapReached = this.num("actionsUsed", 0) >= MAX_CARE_ACTIONS;
    return (targetReached && recipeComplete) ||
      moveCapReached ||
      this.bool("potionBrewed") ||
      this.isRunTimedOut(status);
  }

  private canRecoverRun(): boolean {
    const status = this.str("gameStatus", "idle");
    return (
      (
        status === "committed" ||
        status === "unknown" ||
        this.str("lastStatus", "") === "deal-pending" ||
        this.bool("inputSyncFailed")
      ) &&
      this.str("activeGameId", "0") !== "0" &&
      !this.bool("isStarting") &&
      !this.bool("isDealing") &&
      !this.bool("isSubmitting") &&
      !this.bool("isRecovering")
    );
  }

  private canReleaseAbandoned(): boolean {
    const releaseAt = this.num("releaseAt", 0);
    const nowMs = this.num("nowMs", Date.now());
    return this.str("gameStatus", "idle") === "unknown" &&
      this.str("activeGameId", "0") !== "0" &&
      releaseAt > 0 &&
      nowMs > releaseAt &&
      !this.bool("isRecovering") &&
      !this.bool("isSubmitting");
  }

  private isRunTimedOut(status = this.str("gameStatus", "idle")): boolean {
    const deadline = this.num("deadline", 0);
    return isPlayingStatus(status) && deadline > 0 && deadline <= this.num("nowMs", Date.now());
  }

  private isGuestMode(): boolean {
    return this.str("appMode", "gamefi") === "guest";
  }

  /**
   * Paid (gamefi) starts are pool-gated: the free reward pool must cover the
   * selected path's payout before a run may open. Guest is a free local game
   * with no reward pool, so it is never gated. Mirrors flappy-dash/snake-bounty.
   */
  private rewardPoolReady(): boolean {
    if (this.isGuestMode()) return true;
    const mode = modeOf(this.selectedDifficulty);
    return this.num("poolFree", 0) >= Number(mode.reward);
  }

  /**
   * Refresh the lobby mode-card reward tier for the current play mode: guest is a
   * free local game, so it shows a "Free play" tag instead of the GAS reward.
   */
  private applyRewardLabels(isGuest: boolean): void {
    const tag = this.copy("freePlay", "Free play");
    const paidLocked = this.copy("paidLocked", "Unavailable");
    this.modeCardRewards.forEach((text, index) => {
      const mode = DIFFICULTIES[index];
      text.setText(
        isGuest
          ? tag
          : this.bool("newPaidRunsEnabled")
            ? `${mode?.reward ?? ""} GAS`
            : paidLocked,
      );
    });
  }

  private applyLocalizedLabels(): void {
    this.brandText?.setText(this.copy("brand", "PET POTION"));
    this.modeCards.forEach((card, index) => {
      const mode = DIFFICULTIES[index];
      if (mode) card.label.setText(this.copy(mode.labelKey, mode.fallback));
    });
    this.actionButtonLabels.forEach((label, index) => {
      const action = ACTIONS[index];
      if (action) label.setText(this.copy(action.labelKey, action.fallback));
    });
    const statKeys = [
      ["statHappy", "Happy"],
      ["statFed", "Fed"],
      ["statEnergy", "Energy"],
    ] as const;
    this.statBars.forEach((stat, index) => {
      const copy = statKeys[index];
      if (copy) stat.label.setText(this.copy(copy[0], copy[1]));
    });
  }

  private coverImage(image: Phaser.GameObjects.Image, W: number, H: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceW = Number(source.width) || W;
    const sourceH = Number(source.height) || H;
    const scale = Math.max(W / sourceW, H / sourceH);
    image.setScale(scale);
  }

  private containImage(image: Phaser.GameObjects.Image, W: number, H: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceW = Number(source.width) || W;
    const sourceH = Number(source.height) || H;
    const scale = Math.min(W / sourceW, H / sourceH);
    image.setScale(scale);
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, DESIGN_H / 2);
  }

  private unlockAudio(): void {
    this.sfx.unlock();
  }

  private cleanupScene(): void {
    this.input.off("pointerdown", this.unlockAudio, this);
    this.cueTimer?.remove(false);
    this.cueTimer = undefined;
    this.stopAmbientMotion();
  }

  destroy(fromScene = false): void {
    this.cleanupScene();
    super.destroy(fromScene);
  }
}
