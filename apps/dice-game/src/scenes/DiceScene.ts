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
const FELT_GREEN   = 0x1a5c2e;
const FELT_DARK    = 0x0f3d1e;
const FELT_TRIM    = 0x276639;
const GOLD         = 0xd4a843;
const GOLD_LIGHT   = 0xf0c866;
const TABLE_EDGE   = 0x8b4513;
const TEXT_CREAM   = 0xfff8e8;
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

  private faceButtons: Phaser.GameObjects.Container[] = [];
  private chipButtons: Phaser.GameObjects.Container[] = [];
  private rollBtn!: Phaser.GameObjects.Container;
  private rollBtnBg!: Phaser.GameObjects.Graphics;

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
    this.buildFacePicker(W, H);
    this.buildChipTray(W, H);
    this.buildPayoutRow(W, H);
    this.buildRollButton(W, H);
    this.buildStatusBar(W, H);
    this.buildResultBanner(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
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
    this.stakeLabel.setText(`Stake: ${this.stakeAmount.toFixed(2)} GAS`);
    this.payoutLabel.setText(`Win: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
    this.statusBar.setText(status);

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
  }

  // ── Table construction ─────────────────────────────────────────────────────

  private buildTable(W: number, H: number): void {
    // Outer wood rim
    const rimDepth = 20;
    this.add.rectangle(W / 2, H / 2, W, H, TABLE_EDGE);

    // Green felt area
    this.add.rectangle(W / 2, H / 2, W - rimDepth * 2, H - rimDepth * 2, FELT_GREEN);

    // Inner darker oval (betting area)
    const oval = this.add.ellipse(
      W / 2, H * 0.5,
      W * 0.8, H * 0.62,
      FELT_DARK,
    );
    // Gold trim ring
    const trimG = this.add.graphics();
    trimG.lineStyle(3, GOLD, 0.55);
    trimG.strokeEllipse(W / 2, H * 0.5, W * 0.8 + 8, H * 0.62 + 8);

    // Subtle felt grain lines
    const grain = this.add.graphics();
    grain.lineStyle(1, 0x186231, 0.18);
    for (let y = rimDepth; y < H - rimDepth; y += 22) {
      grain.lineBetween(rimDepth, y, W - rimDepth, y);
    }

    this.add.image(W * 0.78, H * 0.19, ASSET_HERO_DIE)
      .setDisplaySize(72, 82)
      .setAngle(10)
      .setAlpha(0.14);
  }

  private buildDice(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.3;

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
  }

  private dieAssetKey(face: number): string {
    const index = Math.max(0, Math.min(5, Math.round(face) - 1));
    return DIE_FACE_ASSETS[index] ?? DIE_FACE_ASSETS[5];
  }

  private setDieFace(face: number): void {
    this.dieFace1.setTexture(this.dieAssetKey(face)).setDisplaySize(DIE_SIZE, DIE_SIZE);
  }

  // ── Face picker (1–6 buttons) ──────────────────────────────────────────────

  private buildFacePicker(W: number, H: number): void {
    const y = H * 0.57;
    this.add.text(W / 2, y - 24, "Pick Your Number", {
      fontSize: "12px",
      color: "#d4a843",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const totalW = 6 * 48;
    const startX = W / 2 - totalW / 2 + 24;

    for (let i = 1; i <= 6; i++) {
      const x = startX + (i - 1) * 48;
      const btn = this.buildFaceButton(x, y, i);
      this.faceButtons.push(btn);
    }
  }

  private buildFaceButton(x: number, y: number, face: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(FELT_DARK, 1);
    bg.lineStyle(2, GOLD, 0.4);
    bg.fillRoundedRect(-18, -18, 36, 36, 8);
    bg.strokeRoundedRect(-18, -18, 36, 36, 8);
    bg.setInteractive(new Phaser.Geom.Rectangle(-18, -18, 36, 36), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: c,
      hoverScale: 1.06,
      pressScale: 0.92,
      onPress: () => this.dispatch("setSelectedFace", { face: String(face) }),
      onHoverIn: () => bg.setAlpha(0.86),
      onHoverOut: () => bg.setAlpha(1.0),
    });

    const die = this.add.image(0, 0, this.dieAssetKey(face))
      .setDisplaySize(28, 28)
      .setAlpha(0.86);

    c.add([bg, die]);
    c.setData("bg", bg);
    c.setData("die", die);
    return c;
  }

  private highlightFaceBtn(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = btn.getData("bg") as Phaser.GameObjects.Graphics;
    const die = btn.getData("die") as Phaser.GameObjects.Image;
    bg.clear();
    bg.fillStyle(active ? GOLD : FELT_DARK, 1);
    bg.lineStyle(2, active ? GOLD_LIGHT : GOLD, active ? 1 : 0.4);
    bg.fillRoundedRect(-18, -18, 36, 36, 8);
    bg.strokeRoundedRect(-18, -18, 36, 36, 8);
    die.setDisplaySize(active ? 32 : 28, active ? 32 : 28).setAlpha(active ? 1 : 0.72);
  }

  // ── Chip tray ──────────────────────────────────────────────────────────────

  private buildChipTray(W: number, H: number): void {
    const y = H * 0.705;
    this.add.text(W / 2, y - 44, "Stake Amount", {
      fontSize: "12px",
      color: "#d4a843",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const totalW = 4 * 70;
    const startX = W / 2 - totalW / 2 + 35;

    CHIP_PRESETS.forEach((chip, i) => {
      const x = startX + i * 70;
      const btn = this.buildChip(x, y, chip.asset, chip.label, () => {
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
        chip.setScale(1.06);
        lbl.setScale(1.06);
      },
      onHoverOut: () => {
        chip.setScale(1);
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
    this.stakeLabel = this.add.text(W / 2 - 70, H * 0.805, "Stake: 0.10 GAS", {
      fontSize: "14px",
      color: "#d4a843",
    }).setOrigin(0.5);

    this.payoutLabel = this.add.text(W / 2 + 70, H * 0.805, "Win: 0.57 GAS", {
      fontSize: "14px",
      color: "#f0c866",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  // ── Roll button ────────────────────────────────────────────────────────────

  private buildRollButton(W: number, H: number): void {
    const c = this.add.container(W / 2, H * 0.915);

    this.rollBtnBg = this.add.graphics();
    this.drawRollBtnBg(true);

    const label = this.add.text(0, 0, "ROLL THE DICE", {
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
      onPress: () => this.dispatch("placeDiceBet", {}),
    });

    c.add([this.rollBtnBg, label]);
    this.rollBtn = c;
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
    this.statusBar = this.add.text(W / 2, H * 0.96, "", {
      fontSize: "12px",
      color: "#a89070",
    }).setOrigin(0.5);
  }

  // ── Result banner ──────────────────────────────────────────────────────────

  private buildResultBanner(W: number, H: number): void {
    const c = this.add.container(W / 2, H * 0.3);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.82);
    bg.fillRoundedRect(-120, -48, 240, 96, 18);
    bg.lineStyle(3, GOLD);
    bg.strokeRoundedRect(-120, -48, 240, 96, 18);

    const title = this.add.text(0, -18, "", {
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    const sub = this.add.text(0, 18, "", {
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
          angle: Phaser.Math.Between(-12, 12),
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

    // Toss animation on the die
    this.tweens.add({
      targets: this.diceGroup,
      y: "-=30",
      duration: 200,
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

    // Settle animation
    this.tweens.add({
      targets: this.diceGroup,
      y: this.scale.height * 0.3,
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
