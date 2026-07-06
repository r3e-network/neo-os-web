/**
 * DiceScene — Professional casino dice game for Phaser 3.
 *
 * Visual design: classic casino table with green felt, white dice,
 * chip presets, payout display. Matches real-world dice/casino aesthetics.
 */
import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

// ── Casino color palette ─────────────────────────────────────────────────────
const FELT_GREEN   = 0x1a5c2e;
const FELT_DARK    = 0x0f3d1e;
const FELT_TRIM    = 0x276639;
const GOLD         = 0xd4a843;
const GOLD_LIGHT   = 0xf0c866;
const CHIP_GREEN   = 0x3fb950;
const CHIP_BLUE    = 0x58a6ff;
const CHIP_RED     = 0xe25d4d;
const CHIP_BLACK   = 0x444444;
const DIE_WHITE    = 0xfafafa;
const DIE_SHADOW   = 0xd0c8b8;
const DOT_COLOR    = 0x1a1a1a;
const TABLE_EDGE   = 0x8b4513;
const TEXT_CREAM   = 0xfff8e8;

// Chip preset definitions
const CHIP_PRESETS = [
  { amount: "0.10", color: CHIP_GREEN,  label: "0.10" },
  { amount: "0.50", color: CHIP_BLUE,   label: "0.50" },
  { amount: "1.00", color: CHIP_RED,    label: "1.00" },
  { amount: "5.00", color: CHIP_BLACK,  label: "5.00" },
];

const PAYOUT_MULT = 5.7;

export class DiceScene extends BaseScene {
  // ── Scene objects ──────────────────────────────────────────────────────────
  private diceGroup!: Phaser.GameObjects.Container;
  private dieFace1!: Phaser.GameObjects.Graphics;   // main die
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
      this.drawDieFace(this.dieFace1, this.selectedFace);
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

    // Casino logo / text watermark
    this.add.text(W / 2, H * 0.5, "NEO CASINO", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
      letterSpacing: 8,
    }).setOrigin(0.5).setAlpha(0.04);
  }

  private buildDice(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.3;
    const sz = 80;

    // Shadow
    this.dieShadowRect = this.add.rectangle(cx + 6, cy + 8, sz, sz, 0x000000, 0.3);
    this.dieShadowRect.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Die graphics object
    this.dieFace1 = this.add.graphics();
    this.diceGroup = this.add.container(cx, cy, [this.dieFace1]);
    this.drawDieFace(this.dieFace1, this.selectedFace);
  }

  /** Draw a single die face with proper dot layout. */
  private drawDieFace(g: Phaser.GameObjects.Graphics, face: number): void {
    g.clear();
    const sz = 80;
    const half = sz / 2;
    const r = 14; // corner radius
    const dotR = 7;

    // Die body
    g.fillStyle(DIE_WHITE);
    g.fillRoundedRect(-half, -half, sz, sz, r);
    // Edge shading (left/top lighter, right/bottom darker)
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-half, -half, sz / 4, sz, r);
    g.fillStyle(DIE_SHADOW, 0.45);
    g.fillRoundedRect(half - sz / 4, -half, sz / 4, sz, r);

    // Die border
    g.lineStyle(2, DIE_SHADOW, 0.6);
    g.strokeRoundedRect(-half, -half, sz, sz, r);

    // Draw dots for the given face
    g.fillStyle(DOT_COLOR);
    const positions = DiceScene.DOT_POSITIONS[face - 1] ?? [];
    const spacing = sz * 0.28;
    positions.forEach(([px, py]) => {
      g.fillCircle(px * spacing, py * spacing, dotR);
    });
  }

  /** Classic die dot layout for faces 1–6. */
  private static readonly DOT_POSITIONS: [number, number][][] = [
    [[0, 0]],                                                     // 1
    [[-1, -1], [1, 1]],                                           // 2
    [[-1, -1], [0, 0], [1, 1]],                                   // 3
    [[-1, -1], [1, -1], [-1, 1], [1, 1]],                        // 4
    [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],                // 5
    [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],      // 6
  ];

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

    const label = this.add.text(0, 0, String(face), {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#d4a843",
    }).setOrigin(0.5);

    c.add([bg, label]);
    c.setData("bg", bg);
    c.setData("label", label);
    return c;
  }

  private highlightFaceBtn(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg    = btn.getData("bg") as Phaser.GameObjects.Graphics;
    const label = btn.getData("label") as Phaser.GameObjects.Text;
    bg.clear();
    bg.fillStyle(active ? GOLD : FELT_DARK, 1);
    bg.lineStyle(2, active ? GOLD_LIGHT : GOLD, active ? 1 : 0.4);
    bg.fillRoundedRect(-18, -18, 36, 36, 8);
    bg.strokeRoundedRect(-18, -18, 36, 36, 8);
    label.setColor(active ? "#1a1a1a" : "#d4a843");
  }

  // ── Chip tray ──────────────────────────────────────────────────────────────

  private buildChipTray(W: number, H: number): void {
    const y = H * 0.69;
    this.add.text(W / 2, y - 26, "Stake Amount", {
      fontSize: "12px",
      color: "#d4a843",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const totalW = 4 * 70;
    const startX = W / 2 - totalW / 2 + 35;

    CHIP_PRESETS.forEach((chip, i) => {
      const x = startX + i * 70;
      const btn = this.buildChip(x, y, chip.color, chip.label, () => {
        this.dispatch("setStakeAmount", { amount: chip.amount });
      });
      this.chipButtons.push(btn);
    });
  }

  private buildChip(
    x: number, y: number,
    color: number, label: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    // Chip body (stacked circles for 3D look)
    const shadow = this.add.ellipse(2, 3, 50, 50, 0x000000, 0.35);
    const body   = this.add.circle(0, 0, 24, color);
    const rim    = this.add.graphics();
    rim.lineStyle(4, 0xffffff, 0.25);
    rim.strokeCircle(0, 0, 22);
    const inner  = this.add.graphics();
    inner.lineStyle(2, 0xffffff, 0.15);
    inner.strokeCircle(0, 0, 16);

    const lbl = this.add.text(0, 0, label, {
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    body.setInteractive(new Phaser.Geom.Circle(0, 0, 26), Phaser.Geom.Circle.Contains);
    this.bindGameButton(body, {
      targets: c,
      hoverScale: null,
      pressScale: 0.9,
      pressDuration: 80,
      onPress,
      onHoverIn: () =>
        body.setFillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(20).color),
      onHoverOut: () => body.setFillStyle(color),
    });

    c.add([shadow, body, rim, inner, lbl]);
    c.setData("body", body);
    c.setData("color", color);
    return c;
  }

  private highlightChipBtn(btn: Phaser.GameObjects.Container, _index: number, active: boolean): void {
    btn.setScale(active ? 1.12 : 1.0);
  }

  // ── Payout row ─────────────────────────────────────────────────────────────

  private buildPayoutRow(W: number, H: number): void {
    this.stakeLabel = this.add.text(W / 2 - 70, H * 0.79, "Stake: 0.10 GAS", {
      fontSize: "14px",
      color: "#d4a843",
    }).setOrigin(0.5);

    this.payoutLabel = this.add.text(W / 2 + 70, H * 0.79, "Win: 0.57 GAS", {
      fontSize: "14px",
      color: "#f0c866",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  // ── Roll button ────────────────────────────────────────────────────────────

  private buildRollButton(W: number, H: number): void {
    const c = this.add.container(W / 2, H * 0.9);

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
        title.setText("🎉 YOU WIN!").setColor("#f0c866");
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
      if (!isNaN(faceNum)) this.drawDieFace(this.dieFace1, faceNum);
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
        this.drawDieFace(this.dieFace1, face);
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
    this.drawDieFace(this.dieFace1, face);
  }

  // ── Particle effect (win coins) ────────────────────────────────────────────

  private addGoldCoins(): void {
    const { width: W, height: H } = this.scale;
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(W * 0.1, W * 0.9);
      const txt = this.add.text(x, H * 0.3, "🪙", { fontSize: "20px" });
      this.tweens.add({
        targets: txt,
        y: Phaser.Math.Between(H * 0.1, H * 0.6),
        x: x + Phaser.Math.Between(-60, 60),
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        delay: i * 50,
        duration: 900,
        ease: "Power2",
        onComplete: () => txt.destroy(),
      });
    }
  }
}
