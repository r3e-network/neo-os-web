/**
 * GasLuckyPoolScene — Vault funding and lucky-claim game in Phaser 3.
 *
 * Visual design: bank-vault door drawn with Phaser.Graphics (circular door,
 * dial, bolts), dark steel background, gold chip rain on win.
 * Create tab: fund amount pickers + create button.
 * Claim tab: claim key entry + claim button.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bgDark:   0x08111a,
  steel:    0x1c2b3a,
  steelLt:  0x2a3f52,
  teal:     0x16c784,
  tealDim:  0x0d7a50,
  gold:     0xd4a843,
  goldLt:   0xf0c866,
  muted:    0x3d566e,
  mutedLt:  0x5a7a94,
  white:    0xffffff,
  red:      0xe25d4d,
  vaultGray: 0x2c3e50,
  vaultRim:  0x3d5166,
  dialRing:  0x8a9ba8,
  boltColor: 0x4a6070,
};

export class GasLuckyPoolScene extends BaseScene {
  private vaultContainer!: Phaser.GameObjects.Container;
  private vaultDoorG!: Phaser.GameObjects.Graphics;
  private dialG!: Phaser.GameObjects.Graphics;
  private dialAngle = 0;

  private modeLabel!: Phaser.GameObjects.Text;
  private createPanel!: Phaser.GameObjects.Container;
  private claimPanel!: Phaser.GameObjects.Container;
  private resultLabel!: Phaser.GameObjects.Text;
  private statusBar!: Phaser.GameObjects.Text;
  private modeBtns: Phaser.GameObjects.Container[] = [];
  private activeMode = 0;

  constructor() { super("GasLuckyPoolScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildVault(W, H);
    this.buildModeTabs(W, H);
    this.buildCreatePanel(W, H);
    this.buildClaimPanel(W, H);
    this.buildResultArea(W, H);
    this.buildStatusBar(W, H);

    // Idle dial rotation
    this.tweens.add({
      targets: this,
      dialAngle: 360,
      duration: 8000,
      repeat: -1,
      onUpdate: () => this.redrawDial(),
    });

    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    const result   = this.str("lastClaimAmount", "");
    const luckPct  = this.str("lastClaimLuckPercent", "");
    const lastStatus = this.str("lastStatus", "");
    const isLoading  = this.bool("isLoading");

    this.resultLabel.setText(
      result && result !== "0"
        ? `+${result} GAS  (${luckPct} luck)`
        : "",
    );

    this.statusBar.setText(lastStatus);

    // Vault door pulses when loading
    if (isLoading) {
      this.tweens.add({
        targets: this.vaultDoorG,
        alpha: 0.6,
        duration: 300,
        yoyo: true,
        repeat: 3,
        onComplete: () => this.vaultDoorG.setAlpha(1),
      });
    }

    // Show result chips on win
    if (result && result !== "0") this.spawnChipRain();
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bgDark);

    // Steel panel border
    const g = this.add.graphics();
    g.lineStyle(1, C.steel, 0.6);
    for (let x = 0; x <= W; x += 36) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 36) g.lineBetween(0, y, W, y);

    // Outer frame
    g.lineStyle(3, C.steelLt, 0.7);
    g.strokeRoundedRect(6, 6, W - 12, H - 12, 18);
  }

  // ── Vault door ─────────────────────────────────────────────────────────────

  private buildVault(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.24;

    this.vaultContainer = this.add.container(cx, cy);

    // Ambient glow (pulsing)
    const glow = this.add.ellipse(cx, cy, 160, 160, C.teal, 0.07);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.07, to: 0.15 },
      scaleX: { from: 1, to: 1.1 },
      scaleY: { from: 1, to: 1.1 },
      duration: 2200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.vaultDoorG = this.add.graphics();
    this.vaultContainer.add(this.vaultDoorG);
    this.drawVaultDoor(this.vaultDoorG);

    this.dialG = this.add.graphics();
    this.vaultContainer.add(this.dialG);
    this.redrawDial();

    // Hover bob
    this.tweens.add({
      targets: this.vaultContainer,
      y: cy - 7,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // Title
    this.add.text(cx, cy + 72, "GAS LUCKY POOL", {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#d4a843",
      letterSpacing: 3,
    }).setOrigin(0.5);
  }

  private drawVaultDoor(g: Phaser.GameObjects.Graphics): void {
    const R   = 52;   // door radius
    const bR  = 3;    // bolt radius
    const bDist = 36;  // bolt ring distance

    // Door body (dark circle)
    g.fillStyle(C.vaultGray);
    g.fillCircle(0, 0, R);

    // Outer rim
    g.lineStyle(6, C.vaultRim);
    g.strokeCircle(0, 0, R);

    // Inner ring
    g.lineStyle(2, C.steelLt, 0.7);
    g.strokeCircle(0, 0, R * 0.72);

    // Spoke lines (4 spokes)
    g.lineStyle(2, C.muted, 0.5);
    for (let a = 0; a < 4; a++) {
      const rad = Phaser.Math.DegToRad(a * 90);
      g.lineBetween(
        Math.cos(rad) * (R * 0.2), Math.sin(rad) * (R * 0.2),
        Math.cos(rad) * (R * 0.7), Math.sin(rad) * (R * 0.7),
      );
    }

    // Bolts at cardinal positions
    g.fillStyle(C.boltColor);
    g.lineStyle(1, C.mutedLt, 0.5);
    for (let a = 0; a < 4; a++) {
      const rad = Phaser.Math.DegToRad(a * 90 + 45);
      const bx = Math.cos(rad) * bDist;
      const by = Math.sin(rad) * bDist;
      g.fillCircle(bx, by, bR);
      g.strokeCircle(bx, by, bR);
    }

    // Center hub
    g.fillStyle(C.steelLt);
    g.fillCircle(0, 0, R * 0.18);
    g.lineStyle(1, C.dialRing, 0.9);
    g.strokeCircle(0, 0, R * 0.18);
  }

  private redrawDial(): void {
    const g = this.dialG;
    g.clear();

    const R = 52;
    const dialR = R * 0.30;
    const angle = Phaser.Math.DegToRad(this.dialAngle);

    // Dial body
    g.fillStyle(C.steel);
    g.fillCircle(0, 0, dialR);
    g.lineStyle(2, C.dialRing);
    g.strokeCircle(0, 0, dialR);

    // Indicator dot
    g.fillStyle(C.teal);
    g.fillCircle(
      Math.cos(angle) * (dialR * 0.65),
      Math.sin(angle) * (dialR * 0.65),
      3,
    );

    // Tick marks
    g.lineStyle(1, C.mutedLt, 0.45);
    for (let t = 0; t < 12; t++) {
      const a = Phaser.Math.DegToRad(t * 30);
      const inner = dialR * 0.74;
      const outer = dialR * 0.9;
      g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
    }
  }

  // ── Mode tabs ──────────────────────────────────────────────────────────────

  private buildModeTabs(W: number, H: number): void {
    const y = H * 0.44;
    const labels = ["CREATE VAULT", "CLAIM REWARD"];

    labels.forEach((label, i) => {
      const x = W / 2 + (i === 0 ? -82 : 82);
      const c = this.add.container(x, y);
      const isActive = i === 0;
      const bg = this.add.graphics();
      bg.fillStyle(isActive ? C.teal : C.steel);
      bg.fillRoundedRect(-70, -18, 140, 36, 8);
      bg.lineStyle(1, isActive ? C.teal : C.muted);
      bg.strokeRoundedRect(-70, -18, 140, 36, 8);

      bg.setInteractive(new Phaser.Geom.Rectangle(-70, -18, 140, 36), Phaser.Geom.Rectangle.Contains);
      bg.on("pointerdown", () => this.switchMode(i));

      const lbl = this.add.text(0, 0, label, {
        fontSize: "11px",
        fontStyle: "bold",
        color: isActive ? "#0a1f30" : "#5a7a94",
        letterSpacing: 1,
      }).setOrigin(0.5);

      c.add([bg, lbl]);
      c.setData("bg", bg);
      c.setData("lbl", lbl);
      this.modeBtns.push(c);
    });
  }

  private switchMode(mode: number): void {
    this.activeMode = mode;
    this.modeBtns.forEach((btn, i) => {
      const bg  = btn.getData("bg") as Phaser.GameObjects.Graphics;
      const lbl = btn.getData("lbl") as Phaser.GameObjects.Text;
      const active = i === mode;
      bg.clear();
      bg.fillStyle(active ? C.teal : C.steel);
      bg.fillRoundedRect(-70, -18, 140, 36, 8);
      bg.lineStyle(1, active ? C.teal : C.muted);
      bg.strokeRoundedRect(-70, -18, 140, 36, 8);
      lbl.setColor(active ? "#0a1f30" : "#5a7a94");
    });
    this.createPanel.setVisible(mode === 0);
    this.claimPanel.setVisible(mode === 1);
  }

  // ── Create panel ───────────────────────────────────────────────────────────

  private buildCreatePanel(W: number, H: number): void {
    this.createPanel = this.add.container(0, 0);
    const y0 = H * 0.54;

    this.createPanel.add(
      this.add.text(W / 2, y0, "FUND AMOUNT (GAS)", {
        fontSize: "11px", color: "#5a7a94", letterSpacing: 2,
      }).setOrigin(0.5),
    );

    const amounts = ["20", "50", "100", "200"];
    let selectedAmount = "50";
    const amtBtns: Phaser.GameObjects.Container[] = [];

    amounts.forEach((a, i) => {
      const x = W / 2 + (i - 1.5) * 68;
      const btn = this.makeAmountButton(x, y0 + 34, a, a === selectedAmount);
      amtBtns.push(btn);
      this.createPanel.add(btn);
      btn.getData("bg").on("pointerdown", () => {
        selectedAmount = a;
        amtBtns.forEach((b, j) => this.highlightAmountBtn(b, amounts[j] === a));
        this.dispatch("selectFundAmount", { amount: a });
      });
    });

    // Slots and expiry summary
    this.createPanel.add(
      this.add.text(W / 2, y0 + 72, "10 claim slots  ·  24 h expiry", {
        fontSize: "11px", color: "#3d566e",
      }).setOrigin(0.5),
    );

    // Create button
    const createBtn = this.makeActionButton(W / 2, y0 + 102, "CREATE VAULT", C.teal, 0.06);
    this.bindGameButton(createBtn.getAt(0), {
      targets: createBtn,
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () => this.dispatch("createPool", { amount: selectedAmount, slots: "10", expiry: "24" }),
    });
    this.createPanel.add(createBtn);
  }

  private makeAmountButton(x: number, y: number, label: string, active: boolean): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    this.renderAmountBg(bg, active);
    bg.setInteractive(new Phaser.Geom.Rectangle(-28, -16, 56, 32), Phaser.Geom.Rectangle.Contains);
    const lbl = this.add.text(0, 0, label, {
      fontSize: "14px", fontStyle: "bold", color: active ? "#0a1f30" : "#16c784",
    }).setOrigin(0.5);
    c.add([bg, lbl]);
    c.setData("bg", bg);
    c.setData("lbl", lbl);
    return c;
  }

  private renderAmountBg(bg: Phaser.GameObjects.Graphics, active: boolean): void {
    bg.clear();
    bg.fillStyle(active ? C.teal : C.steel);
    bg.fillRoundedRect(-28, -16, 56, 32, 8);
    bg.lineStyle(1, active ? C.teal : C.muted);
    bg.strokeRoundedRect(-28, -16, 56, 32, 8);
  }

  private highlightAmountBtn(btn: Phaser.GameObjects.Container, active: boolean): void {
    this.renderAmountBg(btn.getData("bg"), active);
    (btn.getData("lbl") as Phaser.GameObjects.Text).setColor(active ? "#0a1f30" : "#16c784");
  }

  // ── Claim panel ────────────────────────────────────────────────────────────

  private buildClaimPanel(W: number, H: number): void {
    this.claimPanel = this.add.container(0, 0);
    const y0 = H * 0.54;

    this.claimPanel.add(
      this.add.text(W / 2, y0, "ENTER CLAIM KEY", {
        fontSize: "11px", color: "#5a7a94", letterSpacing: 2,
      }).setOrigin(0.5),
    );

    // Key input placeholder
    const inputBg = this.add.graphics();
    inputBg.lineStyle(2, C.muted);
    inputBg.strokeRoundedRect(W / 2 - 140, y0 + 22, 280, 42, 10);
    this.claimPanel.add(inputBg);

    this.claimPanel.add(
      this.add.text(W / 2, y0 + 43, "paste claim key here", {
        fontSize: "12px", color: "#3d566e",
      }).setOrigin(0.5),
    );

    // Claim button
    const claimBtn = this.makeActionButton(W / 2, y0 + 102, "CLAIM REWARD", C.gold, 0.0);
    this.bindGameButton(claimBtn.getAt(0), {
      targets: claimBtn,
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () => this.dispatch("claimReward", {}),
    });
    this.claimPanel.add(claimBtn);

    this.claimPanel.setVisible(false);
  }

  private makeActionButton(
    x: number, y: number,
    label: string,
    color: number,
    glowAlpha = 0,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(color);
    bg.fillRoundedRect(-110, -24, 220, 48, 14);
    if (glowAlpha > 0) {
      bg.fillStyle(0xffffff, glowAlpha);
      bg.fillRoundedRect(-110, -24, 220, 20, { tl: 14, tr: 14, bl: 0, br: 0 });
    }
    bg.setInteractive(new Phaser.Geom.Rectangle(-110, -24, 220, 48), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerover", () => bg.setAlpha(0.85));
    bg.on("pointerout",  () => bg.setAlpha(1.0));

    const lbl = this.add.text(0, 0, label, {
      fontSize: "14px", fontStyle: "bold", color: "#0a1f30", letterSpacing: 2,
    }).setOrigin(0.5);
    c.add([bg, lbl]);
    return c;
  }

  // ── Result area ────────────────────────────────────────────────────────────

  private buildResultArea(W: number, H: number): void {
    this.resultLabel = this.add.text(W / 2, H * 0.84, "", {
      fontSize: "18px", fontStyle: "bold", color: "#d4a843",
    }).setOrigin(0.5);
  }

  private buildStatusBar(W: number, H: number): void {
    this.statusBar = this.add.text(W / 2, H * 0.97, "", {
      fontSize: "11px", color: "#3d566e",
    }).setOrigin(0.5);
  }

  // ── Chip rain (win effect) ─────────────────────────────────────────────────

  private spawnChipRain(): void {
    const { width: W, height: H } = this.scale;
    const colors = [C.gold, C.teal, 0xffffff, C.goldLt];
    for (let i = 0; i < 18; i++) {
      const g = this.add.graphics();
      const col = colors[i % colors.length]!;
      g.fillStyle(col);
      g.fillCircle(0, 0, 7);
      g.lineStyle(2, 0x000000, 0.3);
      g.strokeCircle(0, 0, 7);
      g.x = Phaser.Math.Between(W * 0.05, W * 0.95);
      g.y = -20;

      this.tweens.add({
        targets: g,
        y: H + 30,
        x: g.x + Phaser.Math.Between(-80, 80),
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-360, 360),
        delay: i * 55,
        duration: 1200,
        ease: "Power2",
        onComplete: () => g.destroy(),
      });
    }
  }
}
