/**
 * PetPotionScene — Virtual pet care game in Phaser 3.
 *
 * Visual design: soft pastel garden background, pet drawn with Phaser.Graphics
 * progressing through 4 stages (Egg → Hatchling → Sprite → Bloom),
 * stat bars for Happiness / Hunger / Energy, 4 care action buttons.
 * No emoji — all art drawn programmatically.
 */
import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bgTop:    0xfff0e6,
  bgBot:    0xffeacc,
  grass:    0x9ecb6e,
  grassDk:  0x75a848,
  soil:     0xd4954e,
  teal:     0x16c784,
  tealDk:   0x0d8a56,
  tealLt:   0x20e897,
  pink:     0xf72585,
  orange:   0xe85d04,
  blue:     0x4361ee,
  gold:     0xd4a843,
  goldLt:   0xf0c866,
  eggWhite: 0xfef9ee,
  eggSpot:  0xe8d4b8,
  cream:    0xfff8e8,
  muted:    0x8b7355,
  border:   0xeadfc8,
  statBg:   0xeadfc8,
};

// ── Stage definitions ──────────────────────────────────────────────────────────
const STAGE_NAMES = ["Egg", "Hatchling", "Sprite", "Bloom"] as const;
const GLOW_COLORS = [0xa8d8a8, 0x16c784, 0xf72585, 0xffd700] as const;

// ── Action definitions (no emoji) ──────────────────────────────────────────────
const ACTIONS = [
  { key: "feed",  label: "FEED",  color: 0xe85d04 },
  { key: "play",  label: "PLAY",  color: 0x7209b7 },
  { key: "pet",   label: "PET",   color: 0xf72585 },
  { key: "rest",  label: "REST",  color: 0x4361ee },
] as const;

export class PetPotionScene extends BaseScene {
  // Pet display
  private petContainer!: Phaser.GameObjects.Container;
  private petG!: Phaser.GameObjects.Graphics;
  private stageGlow!: Phaser.GameObjects.Ellipse;
  private stageLabel!: Phaser.GameObjects.Text;
  private currentStage = -1;

  // Stat bars
  private barFills: Phaser.GameObjects.Rectangle[] = [];

  // Controls
  private actionBtns: Phaser.GameObjects.Container[] = [];
  private targetFill!: Phaser.GameObjects.Rectangle;
  private startBtn!: Phaser.GameObjects.Container;
  private statusLabel!: Phaser.GameObjects.Text;

  constructor() { super("PetPotionScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildPetDisplay(W, H);
    this.buildStats(W, H);
    this.buildTargetBar(W, H);
    this.buildActions(W, H);
    this.buildStartButton(W, H);
    this.buildStatusLabel(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    const status      = this.str("gameStatus", "idle");
    const stage       = Math.min(3, this.num("petStage", 0));
    const happiness   = this.num("petHappiness", 50);
    const hunger      = this.num("petHunger", 50);
    const energy      = this.num("petEnergy", 50);
    const achieved    = this.num("happinessAchieved", 0);
    const isPlaying   = status === "dealt";

    // Pet stage
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.drawPetStage(stage);
      this.stageGlow.setFillStyle(GLOW_COLORS[stage]!, 0.18 + stage * 0.06);
      this.stageLabel.setText(STAGE_NAMES[stage]!);
    }

    // Stat bars
    this.updateStatBar(0, happiness);
    this.updateStatBar(1, 100 - hunger);  // lower hunger = better fed
    this.updateStatBar(2, energy);

    // Target bar
    const rule = this.getDiffRule();
    this.targetFill.setDisplaySize(Math.min(achieved / rule, 1) * 200, 10);

    // Show/hide buttons
    this.actionBtns.forEach((btn) => btn.setVisible(isPlaying));
    const showStart = status === "idle" || status === "solved" || status === "expired";
    this.startBtn.setVisible(showStart);

    this.statusLabel.setText(this.str("lastStatus", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    // Soft pastel background
    this.add.rectangle(W / 2, H / 2, W, H, C.bgTop);
    this.add.rectangle(W / 2, H * 0.75, W, H * 0.5, C.bgBot).setAlpha(0.5);

    // Ground strip
    this.add.rectangle(W / 2, H - 8, W, 16, C.grass);
    this.add.rectangle(W / 2, H, W, 8, C.grassDk);

    // Flower decorations
    const g = this.add.graphics();
    const flowerPositions = [30, 60, W - 60, W - 30];
    flowerPositions.forEach((fx, i) => {
      const fy = H - 22;
      const col = i % 2 === 0 ? C.pink : C.teal;
      g.fillStyle(col, 0.7);
      g.fillCircle(fx, fy - 10, 6);
      g.fillStyle(C.soil, 0.8);
      g.fillRect(fx - 1, fy - 4, 2, 14);
    });

    // Frame border
    g.lineStyle(2, C.border, 0.8);
    g.strokeRoundedRect(10, 10, W - 20, H - 20, 20);

    // Cloud accent
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(50, 50, 80, 32);
    g.fillEllipse(75, 40, 60, 28);
    g.fillEllipse(W - 50, 60, 70, 28);
    g.fillEllipse(W - 70, 48, 50, 24);
  }

  // ── Pet display ────────────────────────────────────────────────────────────

  private buildPetDisplay(W: number, H: number): void {
    const cx = W / 2, cy = H * 0.27;

    // Glow circle
    this.stageGlow = this.add.ellipse(cx, cy, 140, 100, GLOW_COLORS[0]!, 0.18);
    this.tweens.add({
      targets: this.stageGlow,
      scaleX: 1.1, scaleY: 1.1,
      duration: 1800, ease: "Sine.easeInOut", yoyo: true, repeat: -1,
    });

    this.petContainer = this.add.container(cx, cy);
    this.petG = this.add.graphics();
    this.petContainer.add(this.petG);

    // Stage name badge
    this.stageLabel = this.add.text(cx, cy + 58, "Egg", {
      fontSize: "12px", color: "#75685a", letterSpacing: 1,
    }).setOrigin(0.5);

    // Idle hover
    this.tweens.add({
      targets: this.petContainer,
      y: cy - 7,
      duration: 1500, ease: "Sine.easeInOut", yoyo: true, repeat: -1,
    });

    // Draw initial stage
    this.drawPetStage(0);
  }

  /**
   * Draw the pet for the given stage using Phaser.Graphics primitives.
   * Stage 0: Egg — speckled oval
   * Stage 1: Hatchling — small chick with cracked shell bottom
   * Stage 2: Sprite — round creature with limbs
   * Stage 3: Bloom — fairy/butterfly creature
   */
  private drawPetStage(stage: number): void {
    const g = this.petG;
    g.clear();

    switch (stage) {
      case 0: this.drawEgg(g); break;
      case 1: this.drawHatchling(g); break;
      case 2: this.drawSprite(g); break;
      case 3: this.drawBloom(g); break;
    }
  }

  private drawEgg(g: Phaser.GameObjects.Graphics): void {
    // Egg body (taller ellipse)
    g.fillStyle(C.eggWhite);
    g.fillEllipse(0, 0, 72, 88);
    g.lineStyle(2, C.eggSpot, 0.5);
    g.strokeEllipse(0, 0, 72, 88);

    // Speckles
    g.fillStyle(C.eggSpot, 0.6);
    const speckles = [[-14, -20], [10, -8], [-4, 12], [18, 8], [-20, 6], [2, -30]];
    speckles.forEach(([sx, sy]) => g.fillCircle(sx!, sy!, 4));

    // Shine
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(-14, -24, 18, 10);
  }

  private drawHatchling(g: Phaser.GameObjects.Graphics): void {
    // Broken shell base
    g.fillStyle(C.eggWhite);
    g.fillEllipse(0, 24, 68, 28);
    g.lineStyle(2, C.eggSpot, 0.5);
    g.strokeEllipse(0, 24, 68, 28);

    // Jagged crack line on shell
    g.lineStyle(2, C.eggSpot);
    g.lineBetween(-20, 14, -8, 8);
    g.lineBetween(-8, 8, 4, 14);
    g.lineBetween(4, 14, 16, 8);
    g.lineBetween(16, 8, 26, 14);

    // Body (chick)
    g.fillStyle(0xfef08a);  // yellow
    g.fillEllipse(0, -4, 52, 48);

    // Head
    g.fillStyle(0xfef08a);
    g.fillCircle(0, -28, 26);

    // Eye
    g.fillStyle(0x1e293b);
    g.fillCircle(10, -32, 5);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(12, -34, 2);

    // Beak
    g.fillStyle(0xf97316);
    g.fillTriangle(-2, -26, 10, -23, -2, -20);

    // Wing tufts
    g.fillStyle(0xfde68a);
    g.fillEllipse(-26, -4, 16, 24);
    g.fillEllipse(26, -4, 16, 24);
  }

  private drawSprite(g: Phaser.GameObjects.Graphics): void {
    // Body
    g.fillStyle(C.teal);
    g.fillEllipse(0, 4, 58, 52);

    // Belly spot
    g.fillStyle(C.tealLt, 0.5);
    g.fillEllipse(0, 10, 32, 26);

    // Head
    g.fillStyle(C.teal);
    g.fillCircle(0, -26, 28);

    // Eyes
    g.fillStyle(0xffffff);
    g.fillEllipse(-10, -30, 14, 16);
    g.fillEllipse(10, -30, 14, 16);
    g.fillStyle(0x1e293b);
    g.fillCircle(-9, -29, 5);
    g.fillCircle(11, -29, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-7, -31, 2);
    g.fillCircle(13, -31, 2);

    // Ears/antennae
    g.lineStyle(3, C.tealDk);
    g.lineBetween(-12, -50, -20, -70);
    g.lineBetween(12, -50, 20, -70);
    g.fillStyle(C.pink);
    g.fillCircle(-22, -70, 6);
    g.fillCircle(22, -70, 6);

    // Arms
    g.fillStyle(C.teal);
    g.fillEllipse(-32, 4, 14, 32);
    g.fillEllipse(32, 4, 14, 32);

    // Legs
    g.fillEllipse(-14, 32, 14, 22);
    g.fillEllipse(14, 32, 14, 22);
  }

  private drawBloom(g: Phaser.GameObjects.Graphics): void {
    // Fairy wings (back)
    g.fillStyle(C.pink, 0.35);
    g.fillEllipse(-38, -14, 40, 70);
    g.fillEllipse(38, -14, 40, 70);
    g.fillStyle(C.teal, 0.25);
    g.fillEllipse(-28, 10, 30, 44);
    g.fillEllipse(28, 10, 30, 44);

    // Body
    g.fillStyle(C.pink);
    g.fillEllipse(0, 6, 50, 44);

    // Belly
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(0, 12, 26, 22);

    // Head
    g.fillStyle(C.pink);
    g.fillCircle(0, -22, 26);

    // Hair/crown
    g.fillStyle(C.goldLt);
    g.fillEllipse(0, -44, 28, 12);
    g.fillStyle(C.gold);
    g.fillTriangle(-8, -40, 0, -56, 8, -40);
    g.fillCircle(0, -56, 5);

    // Eyes (happy)
    g.fillStyle(0x1e293b);
    g.fillCircle(-10, -24, 5);
    g.fillCircle(10, -24, 5);
    // Sparkle
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-8, -26, 2);
    g.fillCircle(12, -26, 2);

    // Smile
    g.lineStyle(2, 0x1e293b);
    g.beginPath();
    g.arc(0, -19, 6, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170), false);
    g.strokePath();

    // Arms
    g.fillStyle(C.pink);
    g.fillEllipse(-28, 6, 12, 28);
    g.fillEllipse(28, 6, 12, 28);

    // Wing shimmer lines
    g.lineStyle(1, 0xffffff, 0.5);
    g.lineBetween(-36, -20, -30, 0);
    g.lineBetween(36, -20, 30, 0);
  }

  // ── Stat bars ──────────────────────────────────────────────────────────────

  private buildStats(W: number, H: number): void {
    const statDefs = [
      { label: "Happiness", color: C.pink },
      { label: "Fed",       color: C.orange },
      { label: "Energy",    color: C.blue },
    ];
    const startY = H * 0.5;

    statDefs.forEach(({ label, color }, i) => {
      const y = startY + i * 36;
      // Colored dot indicator
      const g = this.add.graphics();
      g.fillStyle(color, 0.9);
      g.fillCircle(W / 2 - 116, y, 5);

      this.add.text(W / 2 - 108, y, label, {
        fontSize: "12px", color: "#75685a",
      }).setOrigin(0, 0.5);

      // Track
      this.add.rectangle(W / 2 + 16, y, 196, 12, C.statBg).setOrigin(0, 0.5);
      // Fill
      const fill = this.add.rectangle(W / 2 + 16, y, 98, 10, color).setOrigin(0, 0.5);
      this.barFills.push(fill);
    });
  }

  private updateStatBar(index: number, pct0to100: number): void {
    const fill = this.barFills[index];
    if (!fill) return;
    const w = Math.max(0, Math.min(1, pct0to100 / 100)) * 196;
    this.tweens.add({
      targets: fill,
      displayWidth: w,
      duration: 300,
      ease: "Power2",
    });
  }

  // ── Target bar ─────────────────────────────────────────────────────────────

  private buildTargetBar(W: number, H: number): void {
    this.add.text(W / 2, H * 0.69, "HAPPINESS GOAL", {
      fontSize: "10px", color: "#b8860b", letterSpacing: 2,
    }).setOrigin(0.5);

    const trackBg = this.add.rectangle(W / 2, H * 0.725, 200, 10, C.statBg).setOrigin(0.5);
    this.targetFill = this.add.rectangle(W / 2 - 100, H * 0.725, 0, 10, C.gold).setOrigin(0, 0.5);

    const g = this.add.graphics();
    g.lineStyle(1, C.gold, 0.5);
    g.strokeRect(W / 2 - 100, H * 0.725 - 5, 200, 10);
  }

  // ── Action buttons ─────────────────────────────────────────────────────────

  private buildActions(W: number, H: number): void {
    const positions = [
      { x: W / 2 - 78, y: H * 0.81 },
      { x: W / 2 + 78, y: H * 0.81 },
      { x: W / 2 - 78, y: H * 0.895 },
      { x: W / 2 + 78, y: H * 0.895 },
    ];

    ACTIONS.forEach(({ key, label, color }, i) => {
      const { x, y } = positions[i]!;
      const c = this.add.container(x, y);

      const bg = this.add.graphics();
      bg.fillStyle(color, 0.9);
      bg.fillRoundedRect(-56, -20, 112, 40, 10);
      bg.lineStyle(2, color);
      bg.strokeRoundedRect(-56, -20, 112, 40, 10);
      bg.setInteractive(new Phaser.Geom.Rectangle(-56, -20, 112, 40), Phaser.Geom.Rectangle.Contains);
      bg.on("pointerdown", () => {
        this.tweens.add({ targets: c, scale: 0.92, duration: 60, yoyo: true });
        this.dispatch("recordAction", { type: key });
      });
      bg.on("pointerover", () => bg.setAlpha(0.8));
      bg.on("pointerout",  () => bg.setAlpha(1.0));

      const lbl = this.add.text(0, 0, label, {
        fontSize: "13px", fontStyle: "bold", color: "#ffffff", letterSpacing: 1,
      }).setOrigin(0.5);

      c.add([bg, lbl]);
      c.setVisible(false);
      this.actionBtns.push(c);
    });
  }

  // ── Start button ───────────────────────────────────────────────────────────

  private buildStartButton(W: number, H: number): void {
    this.startBtn = this.add.container(W / 2, H * 0.87);
    const bg = this.add.graphics();
    bg.fillStyle(C.teal);
    bg.fillRoundedRect(-96, -26, 192, 52, 14);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(-96, -26, 192, 22, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(2, C.tealLt, 0.8);
    bg.strokeRoundedRect(-96, -26, 192, 52, 14);
    bg.setInteractive(new Phaser.Geom.Rectangle(-96, -26, 192, 52), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => {
      this.tweens.add({ targets: this.startBtn, scale: 0.95, duration: 80, yoyo: true });
      this.dispatch("startGame", this.num("gameDifficulty", 0));
    });
    bg.on("pointerover", () => this.tweens.add({ targets: this.startBtn, scale: 1.04, duration: 80 }));
    bg.on("pointerout",  () => this.tweens.add({ targets: this.startBtn, scale: 1.0, duration: 80 }));

    const lbl = this.add.text(0, 0, "START GAME", {
      fontSize: "17px", fontStyle: "bold", color: "#ffffff", letterSpacing: 2,
    }).setOrigin(0.5);

    this.startBtn.add([bg, lbl]);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.97, "", {
      fontSize: "11px", color: "#75685a",
    }).setOrigin(0.5);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getDiffRule(): number {
    const diff = this.num("gameDifficulty", 0);
    return [60, 75, 90][diff] ?? 60;
  }
}
