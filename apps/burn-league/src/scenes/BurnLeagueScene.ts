/**
 * BurnLeagueScene — GAS burning competition game in Phaser 3.
 *
 * Visual design: stone brazier drawn with Phaser.Graphics (bowl + pedestal),
 * animated flame layers using layered ellipses that oscillate, ember particle
 * system, leaderboard below. Dark ember-red atmosphere.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:        0x0c0600,
  bgGlow:    0x1a0600,
  panel:     0x1e0800,
  panelLt:   0x2d1000,
  ember:     0xf97316,
  emberDim:  0x7a3a08,
  flame1:    0xfde047,   // yellow-white core
  flame2:    0xf97316,   // orange middle
  flame3:    0xdc2626,   // red outer
  smoke:     0x3d2a1a,
  stone:     0x4a3728,
  stoneDark: 0x2e2018,
  stoneLt:   0x6b5040,
  gold:      0xd4a843,
  goldLt:    0xf0c866,
  muted:     0x7a5530,
  white:     0xffffff,
};

const BURN_PRESETS = ["1", "5", "10", "25"] as const;

export class BurnLeagueScene extends BaseScene {
  // Brazier graphics
  private brazierG!: Phaser.GameObjects.Graphics;
  private flameG!: Phaser.GameObjects.Graphics;
  private glowCircle!: Phaser.GameObjects.Ellipse;
  private brazierContainer!: Phaser.GameObjects.Container;
  private flameAnims: Phaser.Tweens.Tween[] = [];
  private flameTime = 0;

  // HUD
  private potLabel!: Phaser.GameObjects.Text;
  private burnedLabel!: Phaser.GameObjects.Text;
  private rankLabel!: Phaser.GameObjects.Text;
  private countdownLabel!: Phaser.GameObjects.Text;
  private leaderList!: Phaser.GameObjects.Container;
  private presetBtns: Phaser.GameObjects.Container[] = [];
  private burnBtn!: Phaser.GameObjects.Container;
  private burnBtnBg!: Phaser.GameObjects.Graphics;
  private burnBtnLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;

  private selectedAmount = "1";
  private isBurning = false;

  constructor() { super("BurnLeagueScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildBrazier(W, H);
    this.buildHUD(W, H);
    this.buildLeaderboard(W, H);
    this.buildPresets(W, H);
    this.buildBurnButton(W, H);
    this.buildStatusLabel(W, H);
    this.onStateUpdate(this.state);
  }

  update(_time: number, delta: number): void {
    this.flameTime += delta * 0.003;
    this.animateFlames();
  }

  protected onStateUpdate(state: GameState): void {
    const phase      = this.str("seasonPhase", "dormant");
    const pot        = this.str("prizePoolDisplay", "0");
    const userBurned = this.str("userBurnedDisplay", "0");
    const rank       = this.str("formattedRank", "--");
    const countdown  = this.str("countdown", "00:00:00");
    this.isBurning   = this.bool("isBurning");
    const leaders    = this.val<Array<{ address: string; burned: number; rank: number; isUser?: boolean }>>("leaderboardPreview") ?? [];

    this.potLabel.setText(`Prize Pool:  ${pot} GAS`);
    this.rankLabel.setText(`Rank #${rank}`);
    this.burnedLabel.setText(`Burned: ${userBurned} GAS`);
    this.countdownLabel.setText(
      phase === "active" ? countdown
        : phase === "ended" ? "Season Ended"
          : "Season Dormant",
    );
    this.countdownLabel.setColor(phase === "active" ? "#f97316" : "#7a5530");

    const canBurn = phase === "active" && !this.isBurning;
    this.burnBtnBg.clear();
    this.drawBurnBtnBg(canBurn);
    this.burnBtnLabel.setText(this.isBurning ? "Burning…" : `Burn ${this.selectedAmount} GAS`);

    // More intense flame when burning
    this.glowCircle.setAlpha(this.isBurning ? 0.22 : 0.12);

    this.updateLeaderboard(leaders);
    this.statusLabel.setText(this.str("serviceNotice", "") || this.str("seasonStatusLabel", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    // Ember-glow at brazier location
    const grad = this.add.graphics();
    grad.fillStyle(0x3d0a00, 0.5);
    grad.fillEllipse(W / 2, H * 0.3, W * 0.9, H * 0.55);

    // Subtle grid
    const g = this.add.graphics();
    g.lineStyle(1, 0x1a0800, 0.7);
    for (let x = 0; x <= W; x += 32) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 32) g.lineBetween(0, y, W, y);

    g.lineStyle(2, C.panelLt, 0.5);
    g.strokeRoundedRect(6, 6, W - 12, H - 12, 16);
  }

  // ── Brazier ────────────────────────────────────────────────────────────────

  private buildBrazier(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.28;

    // Ambient glow (behind everything)
    this.glowCircle = this.add.ellipse(cx, cy, 200, 160, 0xff4500, 0.12);

    this.brazierContainer = this.add.container(cx, cy);

    // Flame graphics (rendered each update)
    this.flameG = this.add.graphics();
    this.brazierContainer.add(this.flameG);

    // Stone brazier body
    this.brazierG = this.add.graphics();
    this.drawBrazierBody(this.brazierG);
    this.brazierContainer.add(this.brazierG);

    // Make brazier interactive (click to burn)
    const hitZone = this.add.zone(cx, cy, 120, 160).setInteractive({ useHandCursor: true });
    this.bindGameButton(hitZone, {
      targets: this.brazierContainer,
      hoverDuration: 100,
      pressScale: 0.97,
      enabled: () => this.str("seasonPhase", "dormant") === "active" && !this.isBurning,
      onPress: () => this.handleBurn(),
    });

    // Idle float
    this.tweens.add({
      targets: this.brazierContainer,
      y: cy - 5,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // Title
    this.add.text(cx, cy + 90, "BURN LEAGUE", {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#d4a843",
      letterSpacing: 4,
    }).setOrigin(0.5);
  }

  /**
   * Draw the stone brazier: pedestal pillar, bowl, inner fire bed.
   * Renders in local space (0,0 = center of the container).
   */
  private drawBrazierBody(g: Phaser.GameObjects.Graphics): void {
    g.clear();

    // Pedestal
    g.fillStyle(C.stoneDark);
    g.fillRect(-8, 20, 16, 52);

    // Base plate
    g.fillStyle(C.stone);
    g.fillRoundedRect(-36, 68, 72, 14, 4);
    g.fillStyle(C.stoneDark, 0.5);
    g.fillRect(-36, 74, 72, 8);

    // Bowl outer (trapezoid approximation via polygon)
    g.fillStyle(C.stone);
    g.fillPoints([
      { x: -52, y: 20 },
      { x: -38, y: -10 },
      { x:  38, y: -10 },
      { x:  52, y: 20 },
    ] as Phaser.Types.Math.Vector2Like[], true);

    // Bowl top rim
    g.fillStyle(C.stoneLt);
    g.fillEllipse(0, -10, 80, 18);

    // Inner fire bed
    g.fillStyle(C.stone);
    g.fillEllipse(0, -9, 62, 12);

    // Coal/ember base
    g.fillStyle(0x4a1a00);
    g.fillEllipse(0, -12, 50, 8);
    g.fillStyle(0x7a2a00, 0.7);
    g.fillEllipse(-10, -14, 20, 6);
    g.fillStyle(0xef4444, 0.5);
    g.fillEllipse(8, -15, 12, 4);

    // Bowl shadow/depth
    g.lineStyle(2, C.stoneDark, 0.6);
    g.strokePoints([
      { x: -52, y: 20 },
      { x: -38, y: -10 },
    ] as Phaser.Types.Math.Vector2Like[], false);
    g.strokePoints([
      { x: 52, y: 20 },
      { x: 38, y: -10 },
    ] as Phaser.Types.Math.Vector2Like[], false);
  }

  /**
   * Animate the flame using layered ellipses with sinusoidal oscillation.
   * Called every frame from update().
   */
  private animateFlames(): void {
    const g = this.flameG;
    g.clear();

    const t = this.flameTime;
    const bursting = this.isBurning;

    // Layer heights modulated by time
    const h1 = (bursting ? 70 : 52) + Math.sin(t * 2.1) * 8 + Math.sin(t * 3.7) * 4;
    const h2 = (bursting ? 50 : 38) + Math.sin(t * 1.8 + 1) * 6 + Math.sin(t * 4.2) * 3;
    const h3 = (bursting ? 32 : 22) + Math.sin(t * 2.5 + 2) * 4;

    const w1 = 46 + Math.sin(t * 2.3) * 5;
    const w2 = 32 + Math.sin(t * 1.9 + 0.5) * 4;
    const w3 = 18 + Math.sin(t * 3.1 + 1) * 3;

    const sway = Math.sin(t * 1.4) * 4;

    // Outer red flame
    g.fillStyle(C.flame3, bursting ? 0.85 : 0.7);
    g.fillEllipse(sway * 0.5, -16 - h1 * 0.35, w1, h1);

    // Middle orange flame
    g.fillStyle(C.flame2, bursting ? 0.9 : 0.8);
    g.fillEllipse(sway * 0.3, -20 - h2 * 0.4, w2, h2);

    // Inner yellow-white core
    g.fillStyle(C.flame1, bursting ? 1.0 : 0.9);
    g.fillEllipse(sway * 0.1, -24 - h3 * 0.4, w3, h3);

    // Embers (small bright dots rising)
    for (let i = 0; i < (bursting ? 5 : 2); i++) {
      const ei = i + Math.floor(t * 3) * 7;
      const ex = Math.sin(ei * 2.4) * 28;
      const ey = -16 - ((t * 60 + i * 40) % 80);
      const ea = 1 - ((t * 60 + i * 40) % 80) / 80;
      g.fillStyle(0xfde68a, ea * 0.8);
      g.fillCircle(ex, ey, 2);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(W: number, H: number): void {
    this.potLabel = this.add.text(W / 2, H * 0.45, "", {
      fontSize: "16px", fontStyle: "bold", color: "#d4a843",
    }).setOrigin(0.5);

    this.burnedLabel = this.add.text(W / 2 - 90, H * 0.51, "", {
      fontSize: "12px", color: "#f97316",
    }).setOrigin(0.5);

    this.rankLabel = this.add.text(W / 2 + 90, H * 0.51, "", {
      fontSize: "12px", color: "#f97316",
    }).setOrigin(0.5);

    this.countdownLabel = this.add.text(W / 2, H * 0.56, "", {
      fontSize: "13px", color: "#f97316",
    }).setOrigin(0.5);
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────

  private buildLeaderboard(W: number, H: number): void {
    this.add.text(W / 2, H * 0.60, "LEADERBOARD", {
      fontSize: "11px", color: "#7a5530", letterSpacing: 2,
    }).setOrigin(0.5);
    this.leaderList = this.add.container(0, H * 0.64);
  }

  private updateLeaderboard(
    entries: Array<{ address: string; burned: number; rank: number; isUser?: boolean }>,
  ): void {
    this.leaderList.removeAll(true);
    const { width: W } = this.scale;
    entries.slice(0, 4).forEach((e, i) => {
      const y = i * 22;
      const addr = e.address.length > 12
        ? `${e.address.slice(0, 6)}…${e.address.slice(-4)}`
        : e.address;
      const txt = this.add.text(W / 2, y, `#${e.rank}  ${addr}  —  ${e.burned.toFixed(1)} GAS`, {
        fontSize: "11px",
        color: e.isUser ? "#f97316" : "#7a5530",
      }).setOrigin(0.5);
      this.leaderList.add(txt);
    });
  }

  // ── Burn preset buttons ────────────────────────────────────────────────────

  private buildPresets(W: number, H: number): void {
    this.add.text(W / 2, H * 0.765, "BURN AMOUNT (GAS)", {
      fontSize: "10px", color: "#7a5530", letterSpacing: 2,
    }).setOrigin(0.5);

    const startX = W / 2 - (BURN_PRESETS.length / 2 - 0.5) * 68;
    BURN_PRESETS.forEach((amount, i) => {
      const btn = this.add.container(startX + i * 68, H * 0.81);
      const bg = this.add.graphics();
      this.renderPresetBg(bg, amount === this.selectedAmount);
      bg.setInteractive(new Phaser.Geom.Rectangle(-26, -16, 52, 32), Phaser.Geom.Rectangle.Contains);
      this.bindGameButton(bg, {
        targets: btn,
        hoverScale: 1.05,
        pressScale: 0.94,
        onPress: () => {
          this.selectedAmount = amount;
          this.presetBtns.forEach((b, j) => {
            this.renderPresetBg(b.getData("bg"), BURN_PRESETS[j] === amount);
            (b.getData("lbl") as Phaser.GameObjects.Text).setColor(BURN_PRESETS[j] === amount ? "#0c0600" : "#f97316");
          });
          this.burnBtnLabel.setText(`Burn ${amount} GAS`);
        },
      });
      const lbl = this.add.text(0, 0, amount, {
        fontSize: "15px", fontStyle: "bold", color: amount === this.selectedAmount ? "#0c0600" : "#f97316",
      }).setOrigin(0.5);
      btn.add([bg, lbl]);
      btn.setData("bg", bg);
      btn.setData("lbl", lbl);
      this.presetBtns.push(btn);
    });
  }

  private renderPresetBg(g: Phaser.GameObjects.Graphics, active: boolean): void {
    g.clear();
    g.fillStyle(active ? C.ember : C.panel);
    g.fillRoundedRect(-26, -16, 52, 32, 8);
    g.lineStyle(1, active ? 0xff7043 : C.emberDim);
    g.strokeRoundedRect(-26, -16, 52, 32, 8);
  }

  // ── Burn button ────────────────────────────────────────────────────────────

  private buildBurnButton(W: number, H: number): void {
    this.burnBtn = this.add.container(W / 2, H * 0.9);
    this.burnBtnBg = this.add.graphics();
    this.drawBurnBtnBg(true);

    this.burnBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-100, -26, 200, 52),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.burnBtnBg, {
      targets: this.burnBtn,
      pressScale: 0.95,
      pressDuration: 80,
      enabled: () => this.str("seasonPhase", "dormant") === "active" && !this.isBurning,
      onPress: () => this.handleBurn(),
    });

    this.burnBtnLabel = this.add.text(0, 0, `Burn ${this.selectedAmount} GAS`, {
      fontSize: "17px", fontStyle: "bold", color: "#0c0600", letterSpacing: 1,
    }).setOrigin(0.5);

    this.burnBtn.add([this.burnBtnBg, this.burnBtnLabel]);
  }

  private drawBurnBtnBg(enabled: boolean): void {
    this.burnBtnBg.clear();
    const col = enabled ? C.ember : C.emberDim;
    this.burnBtnBg.fillStyle(col);
    this.burnBtnBg.fillRoundedRect(-100, -26, 200, 52, 14);
    if (enabled) {
      this.burnBtnBg.fillStyle(0xffffff, 0.12);
      this.burnBtnBg.fillRoundedRect(-100, -26, 200, 22, { tl: 14, tr: 14, bl: 0, br: 0 });
    }
    this.burnBtnBg.lineStyle(2, enabled ? 0xff7043 : C.panelLt);
    this.burnBtnBg.strokeRoundedRect(-100, -26, 200, 52, 14);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.97, "", {
      fontSize: "11px", color: "#7a5530",
    }).setOrigin(0.5);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private handleBurn(): void {
    if (this.str("seasonPhase", "dormant") !== "active" || this.isBurning) return;
    this.dispatch("burnGas", { amount: this.selectedAmount });
  }
}
