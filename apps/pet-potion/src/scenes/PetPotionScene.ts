/**
 * PetPotionScene - Phaser 3 virtual pet nursery.
 *
 * Chain, wallet, TEE, and settlement stay in main.tsx. This scene owns the
 * playable surface: pick a nursery path, start a paid run, nurture the pet with
 * real action assets, and claim once the happiness target is reached.
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
} as const;

const DESIGN_W = 420;
const DESIGN_H = 580;

// Shared vertical rhythm for the bottom content stack. Bands are tuned so the
// care goal, stat rows, and the difficulty/action cards never crowd or clip.
const GUTTER_L = 46;               // shared left edge for every label column
const GUTTER_R = DESIGN_W - 46;    // shared right edge for stat values
const STAT_BAR_L = 108;            // stat bars start after the label column
const STAT_BAR_W = GUTTER_R - 26 - STAT_BAR_L; // 240
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
const ACTIONS = [
  { key: "feed", label: "Feed", asset: PET_ASSETS.actions.feed, color: C.orange },
  { key: "play", label: "Play", asset: PET_ASSETS.actions.play, color: C.purple },
  { key: "pet", label: "Pet", asset: PET_ASSETS.actions.pet, color: C.rose },
  { key: "rest", label: "Rest", asset: PET_ASSETS.actions.rest, color: C.blue },
] as const;

const DIFFICULTIES = [
  { id: 0, key: "easy", label: "Sprout", target: 50, entry: "0.02", reward: "0.10", badge: PET_ASSETS.badges[0] },
  { id: 1, key: "medium", label: "Glow", target: 70, entry: "0.10", reward: "0.50", badge: PET_ASSETS.badges[1] },
  { id: 2, key: "hard", label: "Royal", target: 100, entry: "0.20", reward: "1.00", badge: PET_ASSETS.badges[2] },
] as const;

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

export class PetPotionScene extends BaseScene {
  private labImage!: Phaser.GameObjects.Image;
  private labOverlay!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private petGlow!: Phaser.GameObjects.Ellipse;
  private petShadow!: Phaser.GameObjects.Ellipse;
  private petImage!: Phaser.GameObjects.Image;
  private actionCue!: Phaser.GameObjects.Image;
  private stageBadge!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private careGoalText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private goalBox!: Phaser.GameObjects.Rectangle;
  private goalTrack!: Phaser.GameObjects.Rectangle;
  private goalFill!: Phaser.GameObjects.Rectangle;
  private brewBubbles: Phaser.GameObjects.Ellipse[] = [];
  private statBars: StatBar[] = [];
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private modeCards: ModeCard[] = [];
  private primaryButton!: Phaser.GameObjects.Container;
  private primaryButtonBg!: Phaser.GameObjects.Graphics;
  private primaryButtonLabel!: Phaser.GameObjects.Text;
  private selectedDifficulty = 0;
  private currentStage = -1;
  private lastActionCount = 0;
  private cueTimer?: Phaser.Time.TimerEvent;
  private lastGameStatus = "idle";
  private lastTargetReached = false;

  constructor() {
    super("PetPotionScene");
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
  }

  create(): void {
    super.create();

    this.input.on("pointerdown", () => this.sfx.unlock());
    this.fitCameraToHost();
    this.buildBackground(DESIGN_W, DESIGN_H);
    this.buildHeader(DESIGN_W);
    this.buildPetStage(DESIGN_W, DESIGN_H);
    this.buildGoalMeter(DESIGN_W, DESIGN_H);
    this.buildStats(DESIGN_W, DESIGN_H);
    this.buildModeCards(DESIGN_W, DESIGN_H);
    this.buildActionButtons(DESIGN_W, DESIGN_H);
    this.buildPrimaryButton(DESIGN_W, DESIGN_H);
    this.buildStatus(DESIGN_W, DESIGN_H);
    this.startAmbientMotion();
    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onStateUpdate(_state: GameState): void {
    const status = this.str("gameStatus", "idle");
    const isPlaying = isPlayingStatus(status);
    const isLoading = this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting");
    const stateDifficulty = Math.max(0, Math.min(2, this.num("gameDifficulty", this.selectedDifficulty)));
    if (!isPlaying && status !== "idle") this.selectedDifficulty = stateDifficulty;

    const happiness = this.num("petHappiness", 50);
    const hunger = this.num("petHunger", 50);
    const energy = this.num("petEnergy", 50);
    const achieved = this.num("happinessAchieved", 0);
    const actionsUsed = this.num("actionsUsed", 0);
    const stage = Math.max(0, Math.min(2, this.num("petStage", 0)));
    const activeMode = modeOf(isPlaying ? stateDifficulty : this.selectedDifficulty);
    const targetReached = Math.max(achieved, happiness) >= activeMode.target;

    this.modeCards.forEach((card) => card.container.setVisible(status === "idle" && !isLoading));
    this.updateModeCards();
    this.actionButtons.forEach((button) => button.setVisible(isPlaying && !this.bool("isSubmitting")));

    this.titleText.setText(
      isLoading
        ? "Sealing pet"
        : status === "solved"
          ? "Pet evolved"
          : status === "expired" || status === "refunded"
            ? "Run closed"
            : isPlaying
              ? "Nurture the pet"
              : "Open the nursery",
    );
    this.subtitleText.setText(
      isPlaying
        ? `${activeMode.label} path · target ${activeMode.target}`
        : `${activeMode.entry} GAS entry · ${activeMode.reward} GAS reward`,
    );

    const visibleStage = status === "idle" || status === "expired" || status === "refunded"
      ? -1
      : stage;
    this.updatePet(visibleStage, status);

    // Care band: live runs (and the solved recap) show the progress meter and
    // real stats; idle/expired states show a static goal line with sealed,
    // preview stats so the secret starting values never look known.
    const runLive = isPlaying || status === "solved";
    this.goalBox.setVisible(runLive);
    this.goalTrack.setVisible(runLive);
    this.goalFill.setVisible(runLive);
    this.targetText.setVisible(runLive);
    this.careGoalText.setVisible(!runLive);
    this.updateStats(happiness, hunger, energy, runLive);
    if (runLive) {
      this.updateGoal(Math.max(achieved, happiness), activeMode.target);
    }
    this.updatePrimaryButton(status, isPlaying, isLoading, targetReached);

    if (isPlaying && actionsUsed > this.lastActionCount) {
      this.pulsePet();
    }
    this.lastActionCount = actionsUsed;

    if (status !== this.lastGameStatus) {
      if (status === "solved") this.sfx.play("win");
      this.lastGameStatus = status;
    }
    const potionReady = isPlaying && targetReached;
    if (potionReady && !this.lastTargetReached) this.sfx.play("reveal");
    this.lastTargetReached = potionReady;

    this.targetText.setText(`Goal ${Math.round(Math.max(achieved, happiness))}/${activeMode.target}`);
    this.careGoalText.setText(`Raise happiness to ${activeMode.target}`);
    const statusCopy = this.statusCopy(status, isLoading, targetReached, actionsUsed);
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
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    this.labImage = this.add.image(W / 2, H / 2, PET_ASSETS.lab);
    this.coverImage(this.labImage, W, H);
    this.labImage.setAlpha(0.44).setDepth(0);

    this.labOverlay = this.add.rectangle(W / 2, H / 2, W, H, C.canvas, 0.52).setDepth(1);
    this.add.rectangle(W / 2, H - 42, W - 34, 116, C.warm, 0.88)
      .setStrokeStyle(1, C.stroke, 0.7)
      .setDepth(2);

    const frame = this.add.graphics().setDepth(3);
    frame.lineStyle(2, C.stroke, 0.65);
    frame.strokeRoundedRect(12, 12, W - 24, H - 24, 22);
  }

  private buildHeader(W: number): void {
    this.add.text(W / 2, 34, "PET POTION", {
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

    this.petGlow = this.add.ellipse(cx, cy + 8, 224, 168, C.jade, 0.12).setDepth(4);
    this.petShadow = this.add.ellipse(cx, cy + 92, 164, 34, 0x5c4b2c, 0.16).setDepth(4);
    this.buildBrewBubbles(cx, cy);
    this.petImage = this.add.image(cx, cy, PET_ASSETS.egg)
      .setDisplaySize(190, 190)
      .setDepth(6);
    this.actionCue = this.add.image(cx + 78, cy + 54, PET_ASSETS.actions.feed)
      .setDisplaySize(62, 62)
      .setAlpha(0)
      .setDepth(7);

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
      this.brewBubbles.push(bubble);
      // Ambient rise + sine-fade. Guarded above, so raw tweens here are safe.
      this.tweens.add({
        targets: bubble,
        y: baseY - 128,
        scale: 1.35,
        duration: 2300 + index * 220,
        delay: index * 130,
        repeat: -1,
        repeatDelay: 140,
        ease: "Sine.easeOut",
        onUpdate: (tween) => bubble.setAlpha(Math.sin(tween.progress * Math.PI) * spec.peak),
        onRepeat: () => {
          bubble.setPosition(cx + spec.dx, baseY);
          bubble.setScale(1);
        },
      });
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
      const label = this.add.text(GUTTER_L, y, def.label, {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#7b6d5a",
        fontStyle: "bold",
      }).setOrigin(0, 0.5).setDepth(6);
      this.add.rectangle(STAT_BAR_L, y, STAT_BAR_W, 8, 0xeadfc8, 0.88)
        .setOrigin(0, 0.5)
        .setDepth(6);
      const fill = this.add.rectangle(STAT_BAR_L, y, 1, 8, def.color, 0.95)
        .setOrigin(0, 0.5)
        .setDepth(7);
      const value = this.add.text(GUTTER_R, y, "--", {
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
      const label = this.add.text(0, 13, mode.label, {
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

      bg.setInteractive(new Phaser.Geom.Rectangle(-45, -43, 90, 84), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: container,
        hoverScale: 1.04,
        pressScale: 0.95,
        onPress: () => {
          this.sfx.play("select");
          this.selectedDifficulty = mode.id;
          this.updateModeCards();
          this.onStateUpdate(this.state);
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
        hoverScale: 1.05,
        pressScale: 0.91,
        onPress: () => {
          // Cute care chirp for every feed/play/pet/rest interaction.
          this.sfx.tones([{ frequency: 900, duration: 0.06, type: "triangle", gain: 0.022, endFrequency: 1400 }]);
          this.showActionCue(action.key);
          this.dispatch("recordAction", { type: action.key });
        },
        onHoverIn: () => this.renderActionButton(bg, action.color, true),
        onHoverOut: () => this.renderActionButton(bg, action.color, false),
      });

      const icon = this.add.image(0, -12, action.asset).setDisplaySize(50, 50);
      const label = this.add.text(0, 30, action.label, {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#2f291f",
        fontStyle: "bold",
      }).setOrigin(0.5);
      container.add([bg, icon, label]);
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
      ? status === "expired" || status === "refunded" ? "Pet resting" : "Sealed egg"
      : stage === 0 ? "Baby stage" : stage === 1 ? "Teen stage" : "Adult stage";
    this.stageBadge.setText(label);
    this.petGlow.setFillStyle(stage === 2 ? C.gold : C.jade, stage === 2 ? 0.18 : 0.12);
  }

  private updateStats(happiness: number, hunger: number, energy: number, live: boolean): void {
    [happiness, 100 - hunger, energy].forEach((value, index) => {
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
        // Sealed preview: empty, faded bar + dash so the enclave's secret
        // starting stats never read as live known values before the run.
        this.animate({
          targets: stat.fill,
          displayWidth: 0,
          duration: 200,
          ease: "Sine.easeOut",
        });
        stat.fill.setAlpha(0.35);
        stat.label.setAlpha(0.72);
        stat.value.setText("--");
        stat.value.setColor("#b6a68c");
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

  private updatePrimaryButton(status: string, isPlaying: boolean, isLoading: boolean, targetReached: boolean): void {
    const show = status === "idle" || status === "solved" || status === "expired" || status === "refunded" || (isPlaying && targetReached);
    this.primaryButton.setVisible(show);
    if (!show) return;

    const label = isLoading
      ? "Working..."
      : isPlaying
        ? "Claim reward"
        : status === "solved"
          ? "Raise another pet"
          : status === "expired" || status === "refunded"
            ? "Try again"
            : "Begin care";
    const enabled = !isLoading;
    this.primaryButtonLabel.setText(label);
    this.renderPrimaryButton(enabled, isPlaying);
  }

  private handlePrimaryAction(): void {
    const status = this.str("gameStatus", "idle");
    if (this.bool("isStarting") || this.bool("isSubmitting") || this.bool("isDealing")) return;
    if (isPlayingStatus(status)) {
      this.sfx.play("chip");
      this.dispatch("submitSolution");
      return;
    }
    this.sfx.play("throw");
    this.dispatch("startGame", this.selectedDifficulty);
  }

  private showActionCue(key: PetActionKey): void {
    this.cueTimer?.remove(false);
    this.actionCue.setTexture(PET_ASSETS.actions[key]);
    this.actionCue.setAlpha(0).setScale(0.72).setRotation(Phaser.Math.DegToRad(-6));
    this.animate({
      targets: this.actionCue,
      alpha: 1,
      scale: 1,
      y: this.petImage.y + 42,
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

  private startAmbientMotion(): void {
    // Reduced-motion aware: this.animate() no-ops (leaving a still pet, glow,
    // and overlay) when prefers-reduced-motion is on.
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
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.18,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.animate({
      targets: this.labOverlay,
      alpha: 0.6,
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private updateModeCards(): void {
    this.modeCards.forEach((card) => {
      const active = card.id === this.selectedDifficulty;
      this.renderModeCard(card.bg, active, false);
      card.label.setColor(active ? "#0c705d" : "#2f291f");
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

  private renderPrimaryButton(enabled: boolean, rewardTone: boolean): void {
    this.primaryButtonBg.clear();
    this.primaryButtonBg.fillStyle(enabled ? (rewardTone ? C.gold : C.jade) : 0xcdbf9c, enabled ? 0.96 : 0.72);
    this.primaryButtonBg.fillRoundedRect(-114, -23, 228, 46, 16);
    this.primaryButtonBg.fillStyle(C.white, 0.13);
    this.primaryButtonBg.fillRoundedRect(-114, -23, 228, 19, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.primaryButtonBg.lineStyle(1, enabled ? C.white : C.stroke, enabled ? 0.36 : 0.4);
    this.primaryButtonBg.strokeRoundedRect(-114, -23, 228, 46, 16);
    this.primaryButtonBg.setAlpha(enabled ? 1 : 0.72);
  }

  private statusCopy(status: string, isLoading: boolean, targetReached: boolean, actionsUsed: number): string {
    if (isLoading) return "Wallet and enclave are preparing the run.";
    if (status === "solved") return "Reward credited. Start another care run when ready.";
    if (status === "expired" || status === "refunded") return "This run is closed. Start a fresh pet when ready.";
    if (isPlayingStatus(status)) {
      if (targetReached) return "Target reached. Claim before the deadline.";
      return `${actionsUsed} / 40 care actions used`;
    }
    return "";
  }

  private coverImage(image: Phaser.GameObjects.Image, W: number, H: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceW = Number(source.width) || W;
    const sourceH = Number(source.height) || H;
    const scale = Math.max(W / sourceW, H / sourceH);
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
}
