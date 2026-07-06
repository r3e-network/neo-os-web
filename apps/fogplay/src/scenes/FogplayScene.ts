/**
 * FogplayScene — Phaser 3 scene for the Fog Play coin-flip game.
 *
 * Renders:
 *  - A dark atmospheric arena background with orbit rings
 *  - A large 3D-style animated coin (heads / tails)
 *  - Heads / Tails choice buttons
 *  - 4 bet-amount preset buttons
 *  - A "Place Bet" button
 *  - Result overlay (WIN / LOSE) with payout
 *
 * State keys from React:
 *   choice, betAmount, isFlipping, revealing, result,
 *   displayOutcome, winAmount, canBet, validationError
 *
 * Dispatches:
 *   "setChoice"    { side: "heads"|"tails" }
 *   "setBetAmount" { amount: string }
 *   "placeBet"     {}
 */

import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

const BET_PRESETS = ["0.25", "0.50", "1.00", "2.00"];

const C = {
  bg:        0x0d1117,
  panel:     0x161b22,
  border:    0x30363d,
  gold:      0xd4a843,
  goldLight: 0xf0c866,
  teal:      0x16c784,
  red:       0xe25d4d,
  muted:     0x8b949e,
  white:     0xffffff,
};

export class FogplayScene extends BaseScene {
  private coinContainer!: Phaser.GameObjects.Container;
  private coinFace!: Phaser.GameObjects.Text;
  private orbitOuter!: Phaser.GameObjects.Ellipse;
  private orbitInner!: Phaser.GameObjects.Ellipse;

  private headsBtn!: Phaser.GameObjects.Container;
  private tailsBtn!: Phaser.GameObjects.Container;
  private betButtons: Phaser.GameObjects.Container[] = [];
  private placeBetBtn!: Phaser.GameObjects.Container;
  private placeBetLabel!: Phaser.GameObjects.Text;

  private payoutLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private resultOverlay!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private resultAmount!: Phaser.GameObjects.Text;

  private spinTween: Phaser.Tweens.Tween | null = null;
  private isAnimating = false;

  constructor() { super("FogplayScene"); }

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.buildBackground(W, H);
    this.buildCoin(W, H);
    this.buildChoiceButtons(W, H);
    this.buildBetButtons(W, H);
    this.buildPayoutRow(W, H);
    this.buildPlaceBetButton(W, H);
    this.buildStatusLabel(W, H);
    this.buildResultOverlay(W, H);
    this.onStateUpdate(this.state);
    this.startIdleAnimation();
  }

  protected onStateUpdate(state: GameState): void {
    const choice    = this.str("choice", "heads");
    const betAmount = this.str("betAmount", "0.5");
    const flipping  = this.bool("isFlipping") || this.bool("revealing");
    const result    = this.str("result", "");
    const canBet    = this.bool("canBet");

    // Choice buttons
    this.setActive(this.headsBtn, choice === "heads");
    this.setActive(this.tailsBtn, choice === "tails");

    // Bet buttons
    this.betButtons.forEach((btn, i) => {
      this.setActive(btn, Math.abs(parseFloat(BET_PRESETS[i]!) - parseFloat(betAmount)) < 0.001);
    });

    // Payout preview
    const payout = parseFloat(betAmount) * 2;
    this.payoutLabel.setText(`Win: ${payout.toFixed(2)} GAS`);

    // Place Bet button
    (this.placeBetBtn.list[0] as Phaser.GameObjects.Rectangle)
      .setFillStyle(canBet && !flipping ? C.teal : C.border);
    this.placeBetLabel.setText(flipping ? "Flipping…" : "Place Bet");

    // Status
    this.statusLabel.setText(this.str("validationError") || "");

    // Animation
    if (flipping && !this.isAnimating) {
      this.startFlipAnimation();
    } else if (!flipping && this.isAnimating) {
      this.stopFlipAnimation(choice);
    }

    // Result
    if (result && !flipping) {
      this.showResult(result);
    } else {
      this.resultOverlay.setVisible(false);
    }

    // Coin face (idle)
    if (!flipping && !result) {
      this.coinFace.setText(choice === "heads" ? "H" : "T");
    }
  }

  // ── Build helpers ───────────────────────────────────────────────────────────

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    // Subtle grid
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x21262d, 0.6);
    for (let x = 0; x <= W; x += 40) graphics.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 40) graphics.lineBetween(0, y, W, y);
  }

  private buildCoin(W: number, H: number): void {
    const cx = W / 2, cy = H * 0.32;

    this.orbitOuter = this.add.ellipse(cx, cy, 180, 44, C.teal, 20)
      .setStrokeStyle(2, C.teal, 60);
    this.orbitInner = this.add.ellipse(cx, cy, 120, 28, C.gold, 10)
      .setStrokeStyle(1, C.gold, 40);

    this.coinContainer = this.add.container(cx, cy);

    const shadow = this.add.ellipse(4, 8, 110, 110, 0x000000, 80);
    const base = this.add.circle(0, 0, 54, C.gold)
      .setStrokeStyle(5, C.goldLight);
    const inner = this.add.circle(0, 0, 42, 0xb8860b);

    this.coinFace = this.add.text(0, 0, "H", {
      fontSize: "40px",
      fontStyle: "bold",
      color: "#fff8e8",
    }).setOrigin(0.5);

    this.coinContainer.add([shadow, base, inner, this.coinFace]);
  }

  private buildChoiceButtons(W: number, H: number): void {
    const y = H * 0.58;
    this.add.text(W / 2, y - 24, "Choose your side", {
      fontSize: "13px", color: "#8b949e",
    }).setOrigin(0.5);

    this.headsBtn = this.makeChoiceBtn(W / 2 - 58, y, "🪙 Heads", () => {
      this.dispatch("setChoice", "heads");
    });
    this.tailsBtn = this.makeChoiceBtn(W / 2 + 58, y, "🎭 Tails", () => {
      this.dispatch("setChoice", "tails");
    });
  }

  private buildBetButtons(W: number, H: number): void {
    const y = H * 0.7;
    this.add.text(W / 2, y - 24, "Bet amount (GAS)", {
      fontSize: "13px", color: "#8b949e",
    }).setOrigin(0.5);

    const startX = W / 2 - (BET_PRESETS.length / 2 - 0.5) * 70;
    BET_PRESETS.forEach((amount, i) => {
      const btn = this.makePresetBtn(startX + i * 70, y, amount, () => {
        this.dispatch("setBetAmount", { amount });
      });
      this.betButtons.push(btn);
    });
  }

  private buildPayoutRow(W: number, H: number): void {
    this.payoutLabel = this.add.text(W / 2, H * 0.78, "", {
      fontSize: "15px", color: "#f0c866", fontStyle: "bold",
    }).setOrigin(0.5);
  }

  private buildPlaceBetButton(W: number, H: number): void {
    this.placeBetBtn = this.add.container(W / 2, H * 0.88);
    const bg = this.add.rectangle(0, 0, 180, 50, C.teal)
      .setStrokeStyle(2, 0x20e897)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      if (this.bool("canBet") && !this.bool("isFlipping")) {
        this.dispatch("placeBet");
        this.tweens.add({ targets: this.placeBetBtn, scale: 0.95, duration: 60, yoyo: true });
      }
    });
    bg.on("pointerover",  () => this.tweens.add({ targets: this.placeBetBtn, scale: 1.04, duration: 80 }));
    bg.on("pointerout",   () => this.tweens.add({ targets: this.placeBetBtn, scale: 1.0,  duration: 80 }));
    this.placeBetLabel = this.add.text(0, 0, "Place Bet", {
      fontSize: "18px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    this.placeBetBtn.add([bg, this.placeBetLabel]);
  }

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.95, "", {
      fontSize: "12px", color: "#e25d4d",
    }).setOrigin(0.5);
  }

  private buildResultOverlay(W: number, H: number): void {
    this.resultOverlay = this.add.container(W / 2, H * 0.32);
    const bg = this.add.rectangle(0, 0, 160, 84, 0x0d1117, 220)
      .setStrokeStyle(3, C.gold).setOrigin(0.5);
    this.resultText = this.add.text(0, -16, "", {
      fontSize: "30px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    this.resultAmount = this.add.text(0, 18, "", {
      fontSize: "14px", color: "#f0c866",
    }).setOrigin(0.5);
    this.resultOverlay.add([bg, this.resultText, this.resultAmount]);
    this.resultOverlay.setVisible(false);
  }

  // ── Animation ───────────────────────────────────────────────────────────────

  private startIdleAnimation(): void {
    this.tweens.add({
      targets: this.coinContainer,
      y: this.coinContainer.y - 10,
      duration: 1400, ease: "Sine.easeInOut", yoyo: true, repeat: -1,
    });
    this.tweens.add({
      targets: this.orbitOuter,
      angle: 360, duration: 4000, repeat: -1,
    });
    this.tweens.add({
      targets: this.orbitInner,
      angle: -360, duration: 2800, repeat: -1,
    });
  }

  private startFlipAnimation(): void {
    this.isAnimating = true;
    this.tweens.killTweensOf(this.coinContainer);
    let i = 0;
    const faces = ["H", "T", "H", "T"];
    this.spinTween = this.tweens.addCounter({
      from: 0, to: 100, duration: 100, repeat: -1,
      onRepeat: () => {
        this.coinFace.setText(faces[i++ % 4] ?? "H");
        this.tweens.add({
          targets: this.coinContainer,
          scaleX: 0.1, duration: 50, ease: "Sine.easeIn",
          onComplete: () => {
            this.tweens.add({
              targets: this.coinContainer,
              scaleX: 1, duration: 50, ease: "Sine.easeOut",
            });
          },
        });
      },
    });
  }

  private stopFlipAnimation(choice: string): void {
    this.isAnimating = false;
    this.spinTween?.stop();
    this.spinTween = null;
    this.tweens.killTweensOf(this.coinContainer);
    this.coinFace.setText(choice === "heads" ? "H" : "T");
    this.coinContainer.setScale(1);
    this.startIdleAnimation();
  }

  private showResult(result: string): void {
    this.resultOverlay.setVisible(true);
    this.resultOverlay.setAlpha(0).setScale(0.7);
    this.tweens.add({
      targets: this.resultOverlay,
      alpha: 1, scale: 1, duration: 220, ease: "Back.easeOut",
    });
    if (result === "won") {
      this.resultText.setText("WIN!").setColor("#16c784");
      this.resultAmount.setText(this.str("winAmount", "") || this.str("displayOutcome", "")).setColor("#f0c866");
      this.coinFace.setText("H");
    } else {
      this.resultText.setText("LOSE").setColor("#e25d4d");
      this.resultAmount.setText(this.str("displayOutcome", "You lost")).setColor("#8b949e");
      this.coinFace.setText("T");
    }
  }

  // ── Button factories ────────────────────────────────────────────────────────

  private makeChoiceBtn(x: number, y: number, label: string, cb: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 108, 46, C.panel)
      .setStrokeStyle(2, C.border).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", cb);
    const txt = this.add.text(0, 0, label, { fontSize: "15px", color: "#8b949e" }).setOrigin(0.5);
    c.add([bg, txt]);
    return c;
  }

  private makePresetBtn(x: number, y: number, label: string, cb: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 62, 38, C.panel)
      .setStrokeStyle(2, C.border).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", cb);
    const txt = this.add.text(0, 0, label, { fontSize: "13px", color: "#8b949e" }).setOrigin(0.5);
    c.add([bg, txt]);
    return c;
  }

  private setActive(container: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = container.list[0] as Phaser.GameObjects.Rectangle;
    const txt = container.list[1] as Phaser.GameObjects.Text;
    bg.setFillStyle(active ? C.teal * 0.3 | 0 : C.panel)
      .setStrokeStyle(2, active ? C.teal : C.border);
    txt.setColor(active ? "#16c784" : "#8b949e");
  }
}
