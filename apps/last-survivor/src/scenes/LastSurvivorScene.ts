/**
 * LastSurvivorScene — Countdown timer with key-buying mechanic in Phaser 3.
 *
 * Visual design: deep navy arena, large countdown clock with ring,
 * animated danger bar, key icon drawn with Graphics (not emoji),
 * gold buy button. The last buyer when the timer hits zero wins the pot.
 */
import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:       0x070d1a,
  bgPanel:  0x0a1628,
  panel:    0x0f2040,
  border:   0x1e3a5f,
  gold:     0xd4a843,
  goldLt:   0xf0c866,
  teal:     0x16c784,
  red:      0xe25d4d,
  orange:   0xf97316,
  white:    0xffffff,
  muted:    0x4a6080,
  mutedLt:  0x6b8aaa,
};

const KEY_PRESETS = ["1", "3", "5", "10"] as const;

export class LastSurvivorScene extends BaseScene {
  private clockLabel!: Phaser.GameObjects.Text;
  private clockRingG!: Phaser.GameObjects.Graphics;
  private potLabel!: Phaser.GameObjects.Text;
  private keysLabel!: Phaser.GameObjects.Text;
  private dangerFill!: Phaser.GameObjects.Rectangle;
  private dangerFillColor = C.teal;
  private leaderLabel!: Phaser.GameObjects.Text;
  private presetBtns: Phaser.GameObjects.Container[] = [];
  private buyBtn!: Phaser.GameObjects.Container;
  private buyBtnBg!: Phaser.GameObjects.Graphics;
  private buyBtnLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private keyIconG!: Phaser.GameObjects.Graphics;
  private keyCountInput = "1";
  private lastDangerPct = 0;

  constructor() { super("LastSurvivorScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildClockArea(W, H);
    this.buildPotRow(W, H);
    this.buildDangerBar(W, H);
    this.buildKeySection(W, H);
    this.buildBuyButton(W, H);
    this.buildStatusLabel(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    const countdown     = this.str("countdown", "00:00:00");
    const pot           = this.str("totalPotDisplay", "0.00 GAS");
    const userKeys      = this.num("userKeys", 0);
    const dangerPct     = this.num("dangerProgress", 0);
    const leader        = this.str("lastBuyerLabel", "--");
    const isRoundActive = this.bool("isRoundActive");
    const isBuying      = this.bool("isBuyingKeys");

    this.clockLabel.setText(countdown);
    const clockColor = dangerPct > 0.7 ? "#e25d4d" : dangerPct > 0.4 ? "#f97316" : "#16c784";
    this.clockLabel.setColor(clockColor);

    this.potLabel.setText(pot);
    this.keysLabel.setText(`Keys: ${userKeys}`);
    this.leaderLabel.setText(leader !== "--" ? `Last buy: ${leader}` : "");

    // Danger bar
    const { width: W } = this.scale;
    this.dangerFill.setDisplaySize(Math.max(0, dangerPct) * (W - 48), 14);
    this.dangerFillColor = dangerPct > 0.7 ? C.red : dangerPct > 0.4 ? C.orange : C.teal;
    this.dangerFill.setFillStyle(this.dangerFillColor);

    // Pulse danger bar when critical
    if (dangerPct > 0.8 && dangerPct !== this.lastDangerPct) {
      this.tweens.add({ targets: this.dangerFill, scaleY: 1.4, duration: 80, yoyo: true });
    }
    this.lastDangerPct = dangerPct;

    // Clock ring
    this.drawClockRing(dangerPct);

    // Buy button
    const canBuy = isRoundActive && !isBuying;
    this.buyBtnBg.clear();
    this.drawBuyBtnBg(canBuy);
    this.buyBtnLabel.setText(isBuying ? "Buying…" : `Buy ${this.keyCountInput} Key${parseInt(this.keyCountInput, 10) > 1 ? "s" : ""}`);

    this.statusLabel.setText(this.str("serviceNotice", "") || this.str("dangerLevelText", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    const g = this.add.graphics();
    // Subtle scan-line grid
    g.lineStyle(1, 0x0d1f38, 0.65);
    for (let x = 0; x <= W; x += 36) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 36) g.lineBetween(0, y, W, y);

    // Corner accent lines
    g.lineStyle(2, C.border, 0.7);
    g.strokeRoundedRect(8, 8, W - 16, H - 16, 14);

    // Top / bottom accent stripes
    g.lineStyle(2, C.teal, 0.15);
    g.lineBetween(0, 0, W, 0);
    g.lineBetween(0, H, W, H);
  }

  // ── Clock area ─────────────────────────────────────────────────────────────

  private buildClockArea(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.25;

    // Ring behind clock
    this.clockRingG = this.add.graphics();
    this.drawClockRing(0);

    this.add.text(cx, cy - 74, "TIME REMAINING", {
      fontSize: "10px",
      color: "#4a6080",
      letterSpacing: 3,
    }).setOrigin(0.5);

    this.clockLabel = this.add.text(cx, cy, "00:00:00", {
      fontSize: "42px",
      fontStyle: "bold",
      color: "#16c784",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Leader label (below clock)
    this.leaderLabel = this.add.text(cx, cy + 54, "", {
      fontSize: "11px",
      color: "#4a6080",
    }).setOrigin(0.5);
  }

  private drawClockRing(dangerPct: number): void {
    const g = this.clockRingG;
    const { width: W, height: H } = this.scale;
    const cx = W / 2, cy = H * 0.25;
    const R = 72;
    g.clear();

    // Background ring
    g.lineStyle(4, C.panel, 1);
    g.strokeCircle(cx, cy, R);

    // Filled arc (danger progress, clockwise from top)
    const color = dangerPct > 0.7 ? C.red : dangerPct > 0.4 ? C.orange : C.teal;
    g.lineStyle(4, color, 0.6);
    const startAngle = Phaser.Math.DegToRad(-90);
    const endAngle   = Phaser.Math.DegToRad(-90 + dangerPct * 360);
    g.beginPath();
    g.arc(cx, cy, R, startAngle, endAngle, false);
    g.strokePath();

    // Glow dots at key positions
    if (dangerPct > 0) {
      g.fillStyle(color, 0.8);
      g.fillCircle(
        cx + Math.cos(endAngle) * R,
        cy + Math.sin(endAngle) * R,
        5,
      );
    }
  }

  // ── Pot row ─────────────────────────────────────────────────────────────────

  private buildPotRow(W: number, H: number): void {
    const y = H * 0.45;

    // Prize pool panel
    const panelG = this.add.graphics();
    panelG.fillStyle(C.panel, 0.8);
    panelG.fillRoundedRect(W / 2 - 140, y - 22, 280, 44, 10);
    panelG.lineStyle(1, C.border, 0.7);
    panelG.strokeRoundedRect(W / 2 - 140, y - 22, 280, 44, 10);

    this.add.text(W / 2 - 60, y, "PRIZE POOL", {
      fontSize: "10px", color: "#4a6080", letterSpacing: 2,
    }).setOrigin(0.5);

    this.potLabel = this.add.text(W / 2 + 50, y, "0.00 GAS", {
      fontSize: "16px", fontStyle: "bold", color: "#d4a843",
    }).setOrigin(0.5);

    // Key icon (drawn) + count
    this.keyIconG = this.add.graphics();
    this.drawKeyIcon(W - 28, 28);
    this.keysLabel = this.add.text(W - 28, 50, "Keys: 0", {
      fontSize: "11px", color: "#d4a843",
    }).setOrigin(0.5);
  }

  private drawKeyIcon(x: number, y: number): void {
    const g = this.keyIconG;
    g.clear();

    // Key ring (circle)
    g.lineStyle(3, C.gold);
    g.strokeCircle(x, y - 8, 8);

    // Key shaft
    g.lineStyle(3, C.gold);
    g.lineBetween(x + 6, y - 4, x + 18, y - 4);

    // Key teeth
    g.lineBetween(x + 12, y - 4, x + 12, y + 1);
    g.lineBetween(x + 16, y - 4, x + 16, y + 1);
  }

  // ── Danger bar ─────────────────────────────────────────────────────────────

  private buildDangerBar(W: number, H: number): void {
    const y = H * 0.52;

    this.add.text(24, y - 14, "DANGER LEVEL", {
      fontSize: "10px", color: "#4a6080", letterSpacing: 2,
    });

    // Track background
    this.add.rectangle(W / 2, y, W - 48, 14, C.panel).setOrigin(0.5);
    this.dangerFill = this.add.rectangle(24, y, 0, 14, C.teal).setOrigin(0, 0.5);

    // Track border
    const g = this.add.graphics();
    g.lineStyle(1, C.border, 0.5);
    g.strokeRect(24, y - 7, W - 48, 14);
  }

  // ── Key section ────────────────────────────────────────────────────────────

  private buildKeySection(W: number, H: number): void {
    this.add.text(W / 2, H * 0.6, "BUY KEYS", {
      fontSize: "11px", color: "#4a6080", letterSpacing: 3,
    }).setOrigin(0.5);

    const startX = W / 2 - (KEY_PRESETS.length / 2 - 0.5) * 72;
    KEY_PRESETS.forEach((preset, i) => {
      const btn = this.makePresetBtn(startX + i * 72, H * 0.67, preset);
      this.presetBtns.push(btn);
    });
  }

  private makePresetBtn(x: number, y: number, label: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    this.renderPresetBg(bg, label === this.keyCountInput);
    bg.setInteractive(new Phaser.Geom.Rectangle(-28, -20, 56, 40), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => {
      this.keyCountInput = label;
      this.presetBtns.forEach((btn, j) =>
        this.renderPresetBg(btn.getData("bg"), KEY_PRESETS[j] === label),
      );
      this.buyBtnLabel.setText(`Buy ${label} Key${parseInt(label, 10) > 1 ? "s" : ""}`);
    });
    const lbl = this.add.text(0, 0, label, {
      fontSize: "16px", fontStyle: "bold", color: label === this.keyCountInput ? "#d4a843" : "#6b8aaa",
    }).setOrigin(0.5);
    c.add([bg, lbl]);
    c.setData("bg", bg);
    c.setData("lbl", lbl);
    return c;
  }

  private renderPresetBg(g: Phaser.GameObjects.Graphics, active: boolean): void {
    g.clear();
    g.fillStyle(active ? 0x2a3a50 : C.panel);
    g.fillRoundedRect(-28, -20, 56, 40, 8);
    g.lineStyle(1, active ? C.gold : C.border);
    g.strokeRoundedRect(-28, -20, 56, 40, 8);
  }

  // ── Buy button ─────────────────────────────────────────────────────────────

  private buildBuyButton(W: number, H: number): void {
    this.buyBtn = this.add.container(W / 2, H * 0.82);
    this.buyBtnBg = this.add.graphics();
    this.drawBuyBtnBg(true);

    this.buyBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-110, -30, 220, 60),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.buyBtnBg, {
      targets: this.buyBtn,
      pressScale: 0.95,
      enabled: () => this.bool("isRoundActive") && !this.bool("isBuyingKeys"),
      onPress: () => this.dispatch("buyKeys", { count: parseInt(this.keyCountInput, 10) }),
    });

    this.buyBtnLabel = this.add.text(0, 0, "Buy 1 Key", {
      fontSize: "19px", fontStyle: "bold", color: "#35240f",
    }).setOrigin(0.5);

    this.buyBtn.add([this.buyBtnBg, this.buyBtnLabel]);
  }

  private drawBuyBtnBg(enabled: boolean): void {
    this.buyBtnBg.clear();
    const col = enabled ? C.gold : C.muted;
    this.buyBtnBg.fillStyle(col);
    this.buyBtnBg.fillRoundedRect(-110, -30, 220, 60, 16);
    if (enabled) {
      this.buyBtnBg.fillStyle(0xffffff, 0.1);
      this.buyBtnBg.fillRoundedRect(-110, -30, 220, 24, { tl: 16, tr: 16, bl: 0, br: 0 });
    }
    this.buyBtnBg.lineStyle(2, enabled ? C.goldLt : C.border, 0.8);
    this.buyBtnBg.strokeRoundedRect(-110, -30, 220, 60, 16);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.97, "", {
      fontSize: "11px", color: "#4a6080",
    }).setOrigin(0.5);
  }
}
