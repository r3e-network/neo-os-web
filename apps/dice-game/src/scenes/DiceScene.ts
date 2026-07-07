/**
 * DiceScene — Professional casino dice game for Phaser 3.
 *
 * Visual design: classic casino table with green felt, white dice,
 * chip presets, payout display. Matches real-world dice/casino aesthetics.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import gasIconUrl from "@shared/assets/tokens/gas-icon.svg?url";

// ── Casino color palette ─────────────────────────────────────────────────────
const FELT_GREEN   = 0x2f8f58;
const FELT_DARK    = 0x176238;
const GOLD         = 0xd4a843;
const GOLD_LIGHT   = 0xf0c866;
const CREAM        = 0xfff8e8;
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
const DIE_SIZE     = 88;

const DIE_FACE_ASSETS = [
  "dice-die-white-1",
  "dice-die-white-2",
  "dice-die-white-3",
  "dice-die-white-4",
  "dice-die-white-5",
  "dice-die-white-6",
] as const;
const DIE_FACE_FILES = [
  "./art/die-white-1.webp",
  "./art/die-white-2.webp",
  "./art/die-white-3.webp",
  "./art/die-white-4.webp",
  "./art/die-white-5.webp",
  "./art/die-white-6.webp",
] as const;
const ASSET_HERO_DIE = "dice-hero-die";
const ASSET_GAS_ICON = "dice-gas-token-icon";

// Chip preset definitions
const CHIP_PRESETS = [
  { amount: "0.10", asset: "dice-chip-green", file: "./art/chip-green.webp", label: "0.10" },
  { amount: "0.50", asset: "dice-chip-blue",  file: "./art/chip-blue.webp",  label: "0.50" },
  { amount: "1.00", asset: "dice-chip-red",   file: "./art/chip-red.webp",   label: "1.00" },
  { amount: "5.00", asset: "dice-chip-black", file: "./art/chip-black.webp", label: "5.00" },
] as const;

const PAYOUT_MULT = 5.7;

export class DiceScene extends BaseScene {
  // ── Scene objects ──────────────────────────────────────────────────────────
  private diceGroup!: Phaser.GameObjects.Container;
  private dieFace1!: Phaser.GameObjects.Image;   // main die
  private dieShadowRect!: Phaser.GameObjects.Rectangle;
  private throwTrail!: Phaser.GameObjects.Graphics;
  private throwGhosts: Phaser.GameObjects.Image[] = [];

  private faceButtons: Phaser.GameObjects.Container[] = [];
  private chipButtons: Phaser.GameObjects.Container[] = [];
  private rollBtn!: Phaser.GameObjects.Container;
  private rollBtnBg!: Phaser.GameObjects.Graphics;
  private rollBtnLabel!: Phaser.GameObjects.Text;

  private payoutLabel!: Phaser.GameObjects.Text;
  private stakeLabel!: Phaser.GameObjects.Text;
  private statusBar!: Phaser.GameObjects.Text;
  private resultBanner!: Phaser.GameObjects.Container;

  // ── State ──────────────────────────────────────────────────────────────────
  private selectedFace   = 6;
  private stakeAmount    = 0.10;
  private isRolling      = false;
  private shuffleCounter = 0;
  private shuffleTimer!: Phaser.Time.TimerEvent;

  constructor() { super("DiceScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  preload(): void {
    DIE_FACE_ASSETS.forEach((key, index) => {
      this.load.image(key, DIE_FACE_FILES[index]!);
    });
    CHIP_PRESETS.forEach((chip) => {
      this.load.image(chip.asset, chip.file);
    });
    this.load.image(ASSET_HERO_DIE, "./art/hero-die.webp");
    this.load.image(ASSET_GAS_ICON, gasIconUrl);
  }

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.buildTable(W, H);
    this.buildDice(W, H);
    this.buildBettingSpots(W, H);
    this.buildChipTray(W, H);
    this.buildPayoutRow(W, H);
    this.buildRollButton(W, H);
    this.buildStatusBar(W, H);
    this.buildResultBanner(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const faceStr   = this.str("selectedFace",  "6");
    const stakeStr  = this.str("stakeAmount",   "0.10 GAS").replace(/\s*GAS$/i, "");
    const rolling   = this.bool("isSubmitting") || this.bool("isResolving");
    const outcome   = this.str("lastOutcome",   "");
    const lastRoll  = this.str("lastRoll",      "");
    const status    = this.str("lastStatus",    "");

    this.selectedFace = Math.max(1, Math.min(6, parseInt(faceStr, 10) || 6));
    this.stakeAmount  = parseFloat(stakeStr) || 0.10;

    // Face selection highlight
    this.faceButtons.forEach((btn, i) => {
      this.highlightFaceBtn(btn, i + 1 === this.selectedFace);
    });

    // Chip selection highlight
    this.chipButtons.forEach((btn, i) => {
      const presetAmt = parseFloat(CHIP_PRESETS[i]!.amount);
      this.highlightChipBtn(btn, i, Math.abs(presetAmt - this.stakeAmount) < 0.001);
    });

    // Labels
    this.stakeLabel.setText(`On table: ${this.stakeAmount.toFixed(2)} GAS`);
    this.payoutLabel.setText(`Hit pays: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
    const normalizedStatus = status.trim();
    this.statusBar.setText(normalizedStatus === "Ready" || normalizedStatus === "就绪" ? "" : status);

    // Rolling animation
    if (rolling && !this.isRolling) {
      this.startRoll();
    } else if (!rolling && this.isRolling) {
      const faceToShow = lastRoll ? parseInt(lastRoll, 10) : this.selectedFace;
      this.stopRoll(faceToShow);
    }

    // Result overlay
    if (outcome && !rolling) {
      this.showResult(outcome, lastRoll);
    } else {
      this.resultBanner.setVisible(false);
    }

    // Refresh static die face when idle
    if (!rolling && !outcome) {
      this.setDieFace(this.selectedFace);
    }

    // Roll button state
    const canRoll = !rolling;
    this.rollBtnBg.clear();
    this.drawRollBtnBg(canRoll);
    this.rollBtnLabel.setText(rolling ? "ROLLING..." : "THROW DICE");
  }

  // ── Table construction ─────────────────────────────────────────────────────

  private buildTable(W: number, H: number): void {
    const rimDepth = 20;
    this.add.rectangle(W / 2, H / 2, W, H, 0xb77b39);
    this.add.rectangle(W / 2, H / 2, W - rimDepth * 2, H - rimDepth * 2, FELT_GREEN);
    this.add.rectangle(W / 2, H / 2 + 2, W - 52, H - 72, 0x23824e, 0.82)
      .setStrokeStyle(2, 0x74d49a, 0.28);

    // Main throw mat: a clean visual stage, not a configuration form.
    this.add.ellipse(W / 2, H * 0.42, W * 0.78, H * 0.54, FELT_DARK, 0.86);
    const trimG = this.add.graphics();
    trimG.lineStyle(3, GOLD, 0.62);
    trimG.strokeEllipse(W / 2, H * 0.42, W * 0.78 + 8, H * 0.54 + 8);
    trimG.lineStyle(1, 0xffffff, 0.22);
    trimG.strokeEllipse(W / 2, H * 0.42, W * 0.78 - 24, H * 0.54 - 24);

    const grain = this.add.graphics();
    grain.lineStyle(1, 0x0d5a32, 0.16);
    for (let y = rimDepth; y < H - rimDepth; y += 22) {
      grain.lineBetween(rimDepth, y, W - rimDepth, y);
    }

    this.throwTrail = this.add.graphics();
    this.throwTrail.lineStyle(3, GOLD_LIGHT, 0.18);
    const start = { x: W * 0.24, y: H * 0.36 };
    const control = { x: W * 0.5, y: H * 0.18 };
    const end = { x: W * 0.76, y: H * 0.36 };
    let prev = start;
    for (let step = 1; step <= 18; step++) {
      const t = step / 18;
      const inv = 1 - t;
      const next = {
        x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
        y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
      };
      this.throwTrail.lineBetween(prev.x, prev.y, next.x, next.y);
      prev = next;
    }

    this.add.text(W / 2, 42, "LUCKY FACE TABLE", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.82);

    this.add.text(W / 2, 64, "Pick a face, stack a chip, throw once.", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#d9f8df",
    }).setOrigin(0.5).setAlpha(0.78);

    this.add.image(W * 0.78, H * 0.18, ASSET_HERO_DIE)
      .setDisplaySize(66, 74)
      .setAngle(10)
      .setAlpha(0.13);
  }

  private buildDice(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.28;

    // Shadow
    this.dieShadowRect = this.add.rectangle(
      cx + 6,
      cy + 10,
      DIE_SIZE,
      DIE_SIZE * 0.88,
      0x000000,
      0.28,
    );
    this.dieShadowRect.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Die texture object
    this.dieFace1 = this.add.image(0, 0, this.dieAssetKey(this.selectedFace))
      .setDisplaySize(DIE_SIZE, DIE_SIZE);
    this.diceGroup = this.add.container(cx, cy, [this.dieFace1]);
    this.setDieFace(this.selectedFace);

    this.throwGhosts = [
      this.add.image(W * 0.31, H * 0.33, ASSET_HERO_DIE),
      this.add.image(W * 0.50, H * 0.22, ASSET_HERO_DIE),
      this.add.image(W * 0.69, H * 0.33, ASSET_HERO_DIE),
    ].map((ghost, index) => {
      ghost
        .setDisplaySize(38 + index * 4, 42 + index * 4)
        .setAngle(index === 1 ? -10 : 14)
        .setAlpha(0);
      return ghost;
    });
  }

  private dieAssetKey(face: number): string {
    const index = Math.max(0, Math.min(5, Math.round(face) - 1));
    return DIE_FACE_ASSETS[index] ?? DIE_FACE_ASSETS[5];
  }

  private setDieFace(face: number): void {
    this.dieFace1.setTexture(this.dieAssetKey(face)).setDisplaySize(DIE_SIZE, DIE_SIZE);
  }

  // ── Betting spots (1–6 face targets) ───────────────────────────────────────

  private buildBettingSpots(W: number, H: number): void {
    const y = H * 0.56;
    this.add.text(W / 2, y - 33, "Prediction rail", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const rail = this.add.rectangle(W / 2, y + 5, W - 58, 62, 0xffffff, 0.12)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setOrigin(0.5);
    void rail;

    const totalW = 6 * 54;
    const startX = W / 2 - totalW / 2 + 27;

    for (let i = 1; i <= 6; i++) {
      const x = startX + (i - 1) * 54;
      const btn = this.buildFaceButton(x, y, i);
      this.faceButtons.push(btn);
    }
  }

  private buildFaceButton(x: number, y: number, face: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(CREAM, 0.95);
    bg.lineStyle(2, GOLD, 0.48);
    bg.fillRoundedRect(-23, -24, 46, 52, 14);
    bg.strokeRoundedRect(-23, -24, 46, 52, 14);
    bg.setInteractive(new Phaser.Geom.Rectangle(-23, -24, 46, 52), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: c,
      hoverScale: 1.06,
      pressScale: 0.92,
      onPress: () => {
        this.selectedFace = face;
        this.refreshBettingState();
        this.dispatch("setSelectedFace", { face: String(face) });
      },
      onHoverIn: () => bg.setAlpha(0.86),
      onHoverOut: () => bg.setAlpha(1.0),
    });

    const die = this.add.image(0, 0, this.dieAssetKey(face))
      .setDisplaySize(34, 34)
      .setAlpha(0.9);
    const odd = this.add.text(0, 22, "5.7x", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#5b3a12",
    }).setOrigin(0.5).setAlpha(0.72);

    c.add([bg, die, odd]);
    c.setData("bg", bg);
    c.setData("die", die);
    return c;
  }

  private highlightFaceBtn(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = btn.getData("bg") as Phaser.GameObjects.Graphics;
    const die = btn.getData("die") as Phaser.GameObjects.Image;
    bg.clear();
    bg.fillStyle(active ? 0xfff0bd : CREAM, active ? 1 : 0.95);
    bg.lineStyle(active ? 3 : 2, active ? GOLD_LIGHT : GOLD, active ? 1 : 0.48);
    bg.fillRoundedRect(-23, -24, 46, 52, 14);
    bg.strokeRoundedRect(-23, -24, 46, 52, 14);
    if (active) {
      bg.lineStyle(1, 0xffffff, 0.58);
      bg.strokeRoundedRect(-18, -19, 36, 42, 11);
    }
    die.setDisplaySize(active ? 39 : 34, active ? 39 : 34).setAlpha(active ? 1 : 0.82);
  }

  // ── Chip tray ──────────────────────────────────────────────────────────────

  private buildChipTray(W: number, H: number): void {
    const y = H * 0.705;
    this.add.rectangle(W / 2, y, W - 74, 72, 0xffffff, 0.14)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setOrigin(0.5);
    this.add.text(W / 2, y - 42, "Chip rail", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const totalW = 4 * 70;
    const startX = W / 2 - totalW / 2 + 35;

    CHIP_PRESETS.forEach((chip, i) => {
      const x = startX + i * 70;
      const btn = this.buildChip(x, y, chip.asset, chip.label, () => {
        this.stakeAmount = Number(chip.amount);
        this.refreshBettingState();
        this.dispatch("setStakeAmount", { amount: chip.amount });
      });
      this.chipButtons.push(btn);
    });
  }

  private buildChip(
    x: number, y: number,
    asset: string, label: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    const shadow = this.add.ellipse(3, 5, 52, 18, 0x000000, 0.34);
    const activeRing = this.add.graphics();
    const chip = this.add.image(0, 0, asset).setDisplaySize(56, 56);

    const lbl = this.add.text(0, 0, label, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke("#1b2a1b", 3);

    const hit = this.add.circle(0, 0, 30, 0xffffff, 0);
    hit.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
    this.bindGameButton(hit, {
      targets: c,
      hoverScale: null,
      pressScale: 0.9,
      pressDuration: 80,
      onPress,
      onHoverIn: () => {
        chip.setDisplaySize(60, 60);
        lbl.setScale(1.06);
      },
      onHoverOut: () => {
        chip.setDisplaySize(56, 56);
        lbl.setScale(1);
      },
    });

    c.add([shadow, activeRing, chip, lbl, hit]);
    c.setData("ring", activeRing);
    c.setData("chip", chip);
    c.setData("label", lbl);
    return c;
  }

  private highlightChipBtn(btn: Phaser.GameObjects.Container, _index: number, active: boolean): void {
    btn.setScale(active ? 1.12 : 1.0);
    const ring = btn.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    if (active) {
      ring.lineStyle(3, GOLD_LIGHT, 0.92);
      ring.strokeCircle(0, 0, 31);
    }
  }

  // ── Payout row ─────────────────────────────────────────────────────────────

  private buildPayoutRow(W: number, H: number): void {
    this.add.rectangle(W / 2, H * 0.815, W - 88, 32, 0x0f4b2b, 0.68)
      .setStrokeStyle(1, GOLD, 0.32)
      .setOrigin(0.5);
    this.stakeLabel = this.add.text(W / 2 - 76, H * 0.815, "On table: 0.10 GAS", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#fff8e8",
    }).setOrigin(0.5);

    this.payoutLabel = this.add.text(W / 2 + 78, H * 0.815, "Hit pays: 0.57 GAS", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      color: "#f0c866",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  // ── Roll button ────────────────────────────────────────────────────────────

  private buildRollButton(W: number, H: number): void {
    const c = this.add.container(W / 2, H * 0.915);

    this.rollBtnBg = this.add.graphics();
    this.drawRollBtnBg(true);

    const label = this.add.text(0, 0, "THROW DICE", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#1a1a1a",
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.rollBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-88, -22, 176, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.rollBtnBg, {
      targets: c,
      enabled: () => !this.isRolling,
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () => this.dispatch("placeDiceBet", {
        chosenNumber: String(this.selectedFace),
        amount: this.stakeAmount.toFixed(2),
      }),
    });

    c.add([this.rollBtnBg, label]);
    this.rollBtn = c;
    this.rollBtnLabel = label;
  }

  private drawRollBtnBg(enabled: boolean): void {
    const color = enabled ? GOLD : 0x666666;
    this.rollBtnBg.clear();
    this.rollBtnBg.fillStyle(color);
    this.rollBtnBg.fillRoundedRect(-88, -22, 176, 44, 12);
    if (enabled) {
      // Shine effect
      this.rollBtnBg.fillStyle(0xffffff, 0.15);
      this.rollBtnBg.fillRoundedRect(-88, -22, 176, 18, { tl: 12, tr: 12, bl: 0, br: 0 });
    }
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private buildStatusBar(W: number, H: number): void {
    this.statusBar = this.add.text(W / 2, H * 0.865, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#d9f8df",
    }).setOrigin(0.5).setDepth(2);
  }

  private refreshBettingState(): void {
    this.faceButtons.forEach((btn, i) => {
      this.highlightFaceBtn(btn, i + 1 === this.selectedFace);
    });
    this.chipButtons.forEach((btn, i) => {
      const presetAmt = parseFloat(CHIP_PRESETS[i]!.amount);
      this.highlightChipBtn(btn, i, Math.abs(presetAmt - this.stakeAmount) < 0.001);
    });
    this.stakeLabel.setText(`On table: ${this.stakeAmount.toFixed(2)} GAS`);
    this.payoutLabel.setText(`Hit pays: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
    if (!this.isRolling) this.setDieFace(this.selectedFace);
  }

  // ── Result banner ──────────────────────────────────────────────────────────

  private buildResultBanner(W: number, H: number): void {
    const c = this.add.container(W / 2, H * 0.3);

    const bg = this.add.graphics();
    bg.fillStyle(0xfff8e8, 0.94);
    bg.fillRoundedRect(-120, -48, 240, 96, 18);
    bg.lineStyle(3, GOLD);
    bg.strokeRoundedRect(-120, -48, 240, 96, 18);

    const title = this.add.text(0, -18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "28px",
      fontStyle: "bold",
      color: "#201811",
    }).setOrigin(0.5);

    const sub = this.add.text(0, 18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      color: GOLD_LIGHT.toString(16).padStart(6, "0"),
    }).setOrigin(0.5);
    sub.setColor("#f0c866");

    c.add([bg, title, sub]);
    c.setVisible(false);
    c.setData("title", title);
    c.setData("sub", sub);
    this.resultBanner = c;
  }

  private showResult(outcome: string, roll: string): void {
    const title = this.resultBanner.getData("title") as Phaser.GameObjects.Text;
    const sub   = this.resultBanner.getData("sub")   as Phaser.GameObjects.Text;

    this.resultBanner.setVisible(true);
    this.resultBanner.setAlpha(0).setScale(0.7);
    this.tweens.add({
      targets: this.resultBanner,
      alpha: 1, scale: 1,
      duration: 250,
      ease: "Back.easeOut",
    });

    switch (outcome) {
      case "won":
        title.setText("YOU WIN").setColor("#f0c866");
        sub.setText(`Rolled: ${roll}  •  +${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
        this.addGoldCoins();
        break;
      case "lost":
        title.setText("HOUSE WINS").setColor("#e25d4d");
        sub.setText(`Rolled: ${roll}  •  Better luck next time`);
        break;
      case "refunded":
        title.setText("REFUNDED").setColor("#a89070");
        sub.setText("Your stake has been returned");
        break;
    }

    if (roll) {
      const faceNum = parseInt(roll, 10);
      if (!isNaN(faceNum)) this.setDieFace(faceNum);
    }
  }

  // ── Rolling animation ──────────────────────────────────────────────────────

  private startRoll(): void {
    this.isRolling = true;
    this.resultBanner.setVisible(false);
    this.throwTrail.setAlpha(0.8);

    this.shuffleCounter = 0;
    this.shuffleTimer = this.time.addEvent({
      delay: 80,
      repeat: -1,
      callback: () => {
        this.shuffleCounter++;
        const face = (this.shuffleCounter % 6) + 1;
        this.setDieFace(face);
        this.tweens.add({
          targets: this.diceGroup,
          x: this.scale.width / 2 + Phaser.Math.Between(-18, 18),
          angle: Phaser.Math.Between(-24, 24),
          duration: 60,
          ease: "Power1",
        });
        // Bounce shadow
        this.tweens.add({
          targets: this.dieShadowRect,
          scaleX: { from: 1.1, to: 0.9 },
          scaleY: { from: 0.7, to: 1.1 },
          duration: 80,
          yoyo: true,
        });
      },
    });

    this.throwGhosts.forEach((ghost, index) => {
      ghost.setAlpha(0).setScale(0.9).setVisible(true);
      this.tweens.add({
        targets: ghost,
        alpha: { from: 0, to: 0.24 },
        scale: { from: 0.82, to: 1.1 },
        angle: ghost.angle + 60,
        delay: index * 90,
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    this.tweens.add({
      targets: this.throwTrail,
      alpha: { from: 0.18, to: 0.72 },
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.diceGroup,
      y: { from: this.scale.height * 0.28 + 18, to: this.scale.height * 0.28 - 34 },
      scaleX: { from: 0.96, to: 1.1 },
      scaleY: { from: 0.96, to: 1.1 },
      duration: 220,
      ease: "Sine.easeOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopRoll(face: number): void {
    this.isRolling = false;
    this.shuffleTimer?.remove();
    this.tweens.killTweensOf(this.diceGroup);
    this.tweens.killTweensOf(this.dieShadowRect);
    this.tweens.killTweensOf(this.throwTrail);
    this.throwTrail.setAlpha(1);
    for (const ghost of this.throwGhosts) {
      this.tweens.killTweensOf(ghost);
      ghost.setAlpha(0).setScale(1);
    }

    // Settle animation
    this.tweens.add({
      targets: this.diceGroup,
      x: this.scale.width / 2,
      y: this.scale.height * 0.28,
      angle: 0,
      duration: 200,
      ease: "Bounce.easeOut",
    });
    this.setDieFace(face);
  }

  // ── Particle effect (win coins) ────────────────────────────────────────────

  private addGoldCoins(): void {
    const { width: W, height: H } = this.scale;
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(W * 0.1, W * 0.9);
      const coin = this.add.container(x, H * 0.3);
      const halo = this.add.ellipse(0, 0, 24, 24, 0xffdf68, 0.94);
      const coinIcon = this.add.image(0, 0, ASSET_GAS_ICON).setDisplaySize(18, 18);
      coin.add([halo, coinIcon]);
      this.tweens.add({
        targets: coin,
        y: Phaser.Math.Between(H * 0.1, H * 0.6),
        x: x + Phaser.Math.Between(-60, 60),
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        delay: i * 50,
        duration: 900,
        ease: "Power2",
        onComplete: () => coin.destroy(),
      });
    }
  }
}
