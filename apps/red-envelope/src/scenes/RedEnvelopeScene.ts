/**
 * RedEnvelopeScene — Festive red envelope (hongbao) game in Phaser 3.
 *
 * Visual design: traditional Chinese-style red envelope with vector art:
 * gold diamond seal, 福 character center, folded envelope flap,
 * gold confetti on win (Graphics, no emoji), send/receive panels.
 */
import Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:       0x8b0000,
  bgDark:   0x5c0000,
  panel:    0xa00000,
  gold:     0xd4a843,
  goldLt:   0xf0c866,
  goldDk:   0xb8860b,
  cream:    0xfff8e8,
  red:      0xdc143c,
  redDk:    0x9b0000,
  flap:     0xc0392b,
  flapLt:   0xe74c3c,
  shadow:   0x400000,
  white:    0xffffff,
};

const AMOUNT_PRESETS = ["0.5", "1", "3", "5"] as const;

export class RedEnvelopeScene extends BaseScene {
  private envelopeContainer!: Phaser.GameObjects.Container;
  private sealG!: Phaser.GameObjects.Graphics;
  private flapG!: Phaser.GameObjects.Graphics;
  private resultLabel!: Phaser.GameObjects.Text;
  private amountLabel!: Phaser.GameObjects.Text;
  private tabBtns: Phaser.GameObjects.Container[] = [];
  private sendPanel!: Phaser.GameObjects.Container;
  private receivePanel!: Phaser.GameObjects.Container;
  private statusLabel!: Phaser.GameObjects.Text;
  private isOpening = false;
  private flapOpen = false;
  private selectedAmount = "1";

  constructor() { super("RedEnvelopeScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildEnvelope(W, H);
    this.buildTabs(W, H);
    this.buildSendPanel(W, H);
    this.buildReceivePanel(W, H);
    this.buildResultArea(W, H);
    this.buildStatusLabel(W, H);
    this.startIdleAnimation();
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const luckyMsg   = this.val<{ amount?: number; from?: string }>("luckyMessage");
    const openingId  = this.val<string>("openingId");

    if (luckyMsg?.amount && luckyMsg.amount > 0) {
      this.showWinResult(luckyMsg.amount);
    }
    if (openingId && !this.isOpening) {
      this.playOpenAnimation();
    }

    this.statusLabel.setText(this.str("lastStatus", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    // Subtle gold diamond grid
    const g = this.add.graphics();
    g.lineStyle(1, C.gold, 0.06);
    for (let x = 0; x <= W; x += 28) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 28) g.lineBetween(0, y, W, y);

    // Outer gold border
    g.lineStyle(3, C.gold, 0.65);
    g.strokeRoundedRect(8, 8, W - 16, H - 16, 20);

    // Top decoration
    const dec = this.add.graphics();
    dec.lineStyle(2, C.gold, 0.5);
    dec.strokeRect(20, 20, W - 40, 32);
    this.add.text(W / 2, 36, "◇  吉 祥 如 意  ◇", {
      fontSize: "12px", color: "#d4a843",
    }).setOrigin(0.5).setAlpha(0.75);
  }

  // ── Envelope ───────────────────────────────────────────────────────────────

  private buildEnvelope(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.3;
    const envW = 192, envH = 252;

    this.envelopeContainer = this.add.container(cx, cy);

    // Drop shadow
    const shadowEl = this.add.ellipse(6, 14, envW * 0.85, 28, 0x000000, 0.35);

    // Envelope body
    const bodyG = this.add.graphics();
    bodyG.fillStyle(C.red);
    bodyG.fillRoundedRect(-envW / 2, -envH / 2, envW, envH, 10);
    bodyG.lineStyle(4, C.gold, 0.8);
    bodyG.strokeRoundedRect(-envW / 2, -envH / 2, envW, envH, 10);

    // Body decorative lines
    const decG = this.add.graphics();
    decG.lineStyle(1, C.gold, 0.25);
    decG.strokeRoundedRect(-envW / 2 + 8, -envH / 2 + 8, envW - 16, envH - 16, 7);

    // Envelope flap (closed triangular fold)
    this.flapG = this.add.graphics();
    this.drawFlap(false);

    // Gold seal circle
    this.sealG = this.add.graphics();
    this.drawSeal();

    // Interactive hit area
    bodyG.setInteractive(
      new Phaser.Geom.Rectangle(-envW / 2, -envH / 2, envW, envH),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(bodyG, {
      targets: this.envelopeContainer,
      hoverDuration: 100,
      pressScale: 0.97,
      enabled: () => !this.isOpening,
      onPress: () => this.handleTap(),
    });

    // "TAP TO OPEN" hint
    const hint = this.add.text(0, 78, "TAP TO OPEN", {
      fontSize: "11px",
      fontStyle: "bold",
      color: "#f0c866",
      letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0.7);

    this.envelopeContainer.add([shadowEl, bodyG, decG, this.flapG, this.sealG, hint]);
  }

  private drawFlap(open: boolean): void {
    const g = this.flapG;
    g.clear();
    const envW = 192, envH = 252;
    const halfW = envW / 2;
    const top = -envH / 2;
    const flapH = open ? -30 : envH * 0.28;

    // Flap triangle (pointed bottom, open = folds up)
    g.fillStyle(C.flap);
    g.beginPath();
    if (!open) {
      g.moveTo(-halfW, top);
      g.lineTo(0, top + flapH);
      g.lineTo(halfW, top);
      g.closePath();
    } else {
      g.moveTo(-halfW, top);
      g.lineTo(0, top - 20);
      g.lineTo(halfW, top);
      g.closePath();
    }
    g.fillPath();

    // Flap edge highlight
    g.lineStyle(2, C.gold, 0.4);
    if (!open) {
      g.lineBetween(-halfW, top, 0, top + flapH);
      g.lineBetween(0, top + flapH, halfW, top);
    }
  }

  private drawSeal(): void {
    const g = this.sealG;
    g.clear();

    const R = 38;    // seal outer radius
    const r = 30;    // inner ring

    // Gold seal circle
    g.fillStyle(C.goldDk);
    g.fillCircle(0, -22, R);
    g.fillStyle(C.gold);
    g.fillCircle(0, -22, r);

    // Diamond ring
    g.lineStyle(2, C.goldDk, 0.6);
    g.strokeCircle(0, -22, R - 5);

    // 8-point star decoration
    g.lineStyle(1, C.redDk, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = Phaser.Math.DegToRad(i * 45);
      g.lineBetween(
        Math.cos(a) * 8, -22 + Math.sin(a) * 8,
        Math.cos(a) * r * 0.8, -22 + Math.sin(a) * r * 0.8,
      );
    }

    // 福 character center (rendered as text on top of container)
    // Drawn via a separate Text object added after this graphic
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  private buildTabs(W: number, H: number): void {
    const tabDefs = ["SEND", "RECEIVE"];
    const y = H * 0.57;
    tabDefs.forEach((label, i) => {
      const x = W / 2 + (i === 0 ? -72 : 72);
      const c = this.add.container(x, y);
      const isActive = i === 0;

      const bg = this.add.graphics();
      this.renderTabBg(bg, isActive);
      bg.setInteractive(new Phaser.Geom.Rectangle(-60, -18, 120, 36), Phaser.Geom.Rectangle.Contains);
      bg.on("pointerdown", () => {
        this.sendPanel.setVisible(i === 0);
        this.receivePanel.setVisible(i === 1);
        this.tabBtns.forEach((b, j) => {
          this.renderTabBg(b.getData("bg"), j === i);
          (b.getData("lbl") as Phaser.GameObjects.Text).setColor(j === i ? "#5c0000" : "#d4a843");
        });
      });

      const lbl = this.add.text(0, 0, label, {
        fontSize: "12px",
        fontStyle: "bold",
        color: isActive ? "#5c0000" : "#d4a843",
        letterSpacing: 2,
      }).setOrigin(0.5);

      c.add([bg, lbl]);
      c.setData("bg", bg);
      c.setData("lbl", lbl);
      this.tabBtns.push(c);
    });

    // 福 character on top of seal (positioned absolutely in scene, not in container)
    const { width: sceneW, height: sceneH } = this.scale;
    this.add.text(sceneW / 2, sceneH * 0.3 - 22, "福", {
      fontSize: "28px",
      fontStyle: "bold",
      color: "#5c0000",
    }).setOrigin(0.5).setDepth(5);
  }

  private renderTabBg(g: Phaser.GameObjects.Graphics, active: boolean): void {
    g.clear();
    g.fillStyle(active ? C.gold : C.shadow);
    g.fillRoundedRect(-60, -18, 120, 36, 8);
    g.lineStyle(1, active ? C.goldLt : C.gold, 0.6);
    g.strokeRoundedRect(-60, -18, 120, 36, 8);
  }

  // ── Send panel ─────────────────────────────────────────────────────────────

  private buildSendPanel(W: number, H: number): void {
    this.sendPanel = this.add.container(0, 0);
    const y0 = H * 0.645;

    this.sendPanel.add(
      this.add.text(W / 2, y0, "GAS PER PACKET", {
        fontSize: "10px", color: "#c89040", letterSpacing: 2,
      }).setOrigin(0.5),
    );

    const amtBtns: Phaser.GameObjects.Container[] = [];
    AMOUNT_PRESETS.forEach((a, i) => {
      const x = W / 2 + (i - 1.5) * 64;
      const btn = this.add.container(x, y0 + 30);
      const bg = this.add.graphics();
      this.renderAmtBg(bg, a === this.selectedAmount);
      bg.setInteractive(new Phaser.Geom.Rectangle(-26, -15, 52, 30), Phaser.Geom.Rectangle.Contains);
      bg.on("pointerdown", () => {
        this.selectedAmount = a;
        amtBtns.forEach((b, j) => {
          this.renderAmtBg(b.getData("bg"), AMOUNT_PRESETS[j] === a);
          (b.getData("lbl") as Phaser.GameObjects.Text).setColor(AMOUNT_PRESETS[j] === a ? "#5c0000" : "#d4a843");
        });
      });
      const lbl = this.add.text(0, 0, a, {
        fontSize: "13px", fontStyle: "bold",
        color: a === this.selectedAmount ? "#5c0000" : "#d4a843",
      }).setOrigin(0.5);
      btn.add([bg, lbl]);
      btn.setData("bg", bg);
      btn.setData("lbl", lbl);
      amtBtns.push(btn);
      this.sendPanel.add(btn);
    });

    // Send button
    const sendBtn = this.add.container(W / 2, y0 + 76);
    const sbg = this.add.graphics();
    sbg.fillStyle(C.gold);
    sbg.fillRoundedRect(-110, -24, 220, 48, 14);
    sbg.fillStyle(0xffffff, 0.1);
    sbg.fillRoundedRect(-110, -24, 220, 20, { tl: 14, tr: 14, bl: 0, br: 0 });
    sbg.setInteractive(new Phaser.Geom.Rectangle(-110, -24, 220, 48), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(sbg, {
      targets: sendBtn,
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () =>
        this.dispatch("sendEnvelopes", { amount: this.selectedAmount, count: "8", expiryHours: "24" }),
    });
    const slbl = this.add.text(0, 0, "SEND ENVELOPES", {
      fontSize: "14px", fontStyle: "bold", color: "#5c0000", letterSpacing: 2,
    }).setOrigin(0.5);
    sendBtn.add([sbg, slbl]);
    this.sendPanel.add(sendBtn);
  }

  private renderAmtBg(g: Phaser.GameObjects.Graphics, active: boolean): void {
    g.clear();
    g.fillStyle(active ? C.gold : C.shadow);
    g.fillRoundedRect(-26, -15, 52, 30, 7);
    g.lineStyle(1, C.gold, 0.6);
    g.strokeRoundedRect(-26, -15, 52, 30, 7);
  }

  // ── Receive panel ──────────────────────────────────────────────────────────

  private buildReceivePanel(W: number, H: number): void {
    this.receivePanel = this.add.container(0, 0);
    const y0 = H * 0.64;

    this.receivePanel.add(
      this.add.text(W / 2, y0, "Tap the envelope above to open\nor enter an ID in the drawer", {
        fontSize: "12px", color: "#c89040", align: "center",
      }).setOrigin(0.5),
    );
    this.receivePanel.setVisible(false);
  }

  // ── Result ─────────────────────────────────────────────────────────────────

  private buildResultArea(W: number, H: number): void {
    this.resultLabel = this.add.text(W / 2, H * 0.855, "", {
      fontSize: "22px", fontStyle: "bold", color: "#d4a843",
    }).setOrigin(0.5);
    this.amountLabel = this.add.text(W / 2, H * 0.905, "", {
      fontSize: "15px", color: "#f0c866",
    }).setOrigin(0.5);
  }

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.96, "", {
      fontSize: "11px", color: "#c89040",
    }).setOrigin(0.5);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private handleTap(): void {
    this.dispatch("openEnvelope", {});
    this.playOpenAnimation();
  }

  private playOpenAnimation(): void {
    if (this.isOpening) return;
    this.isOpening = true;

    // Shake
    this.tweens.add({
      targets: this.envelopeContainer,
      angle: { from: -6, to: 6 },
      duration: 75,
      repeat: 5,
      yoyo: true,
      ease: "Linear",
      onComplete: () => {
        // Open flap
        this.drawFlap(true);
        this.time.delayedCall(600, () => { this.isOpening = false; });
      },
    });
  }

  private showWinResult(amount: number): void {
    this.resultLabel.setText("LUCKY WIN!");
    this.amountLabel.setText(`+${amount.toFixed(4)} GAS`);

    // Gold & red confetti burst (Graphics, not emoji)
    const { width: W } = this.scale;
    const colors = [C.gold, C.goldLt, C.red, C.cream, C.flapLt];
    for (let i = 0; i < 20; i++) {
      const g = this.add.graphics();
      const col = colors[i % colors.length]!;
      g.fillStyle(col);
      const shape = i % 3;
      if (shape === 0) {
        g.fillRect(-4, -4, 8, 8);
      } else if (shape === 1) {
        g.fillTriangle(-5, 5, 5, 5, 0, -5);
      } else {
        g.fillCircle(0, 0, 4);
      }
      g.x = Phaser.Math.Between(30, W - 30);
      g.y = this.scale.height * 0.35;

      this.tweens.add({
        targets: g,
        y: Phaser.Math.Between(60, 400),
        x: g.x + Phaser.Math.Between(-100, 100),
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-300, 300),
        delay: i * 45,
        duration: 1300,
        ease: "Power2",
        onComplete: () => g.destroy(),
      });
    }
  }

  // ── Idle animation ─────────────────────────────────────────────────────────

  private startIdleAnimation(): void {
    this.tweens.add({
      targets: this.envelopeContainer,
      y: this.envelopeContainer.y - 8,
      duration: 1600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }
}
