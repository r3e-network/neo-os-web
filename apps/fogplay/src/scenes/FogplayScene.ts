/**
 * FogplayScene — Phaser 3 scene for the FogPlay commit/reveal coin game.
 *
 * The scene keeps the chain flow simple: pick a side, pick a wager, flip.
 * Visual priority stays on the coin table and on immediate motion feedback,
 * with validation and fairness copy pushed into quieter secondary surfaces.
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";

const BET_PRESETS = ["0.25", "0.50", "1.00", "2.00"] as const;

const C = {
  page: 0xfff4dc,
  table: 0xf7c56c,
  tableEdge: 0xa96525,
  felt: 0x39a96b,
  feltDeep: 0x208253,
  feltLight: 0xb8f4cb,
  cream: 0xfffff3,
  ink: 0x253428,
  muted: 0x6f765f,
  gold: 0xe8b94f,
  goldDeep: 0x9f6a1e,
  teal: 0x16c784,
  tealDeep: 0x0b8061,
  red: 0xd95e4f,
  white: 0xffffff,
  shadow: 0x2a1508,
};

const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
const ASSET_GAS = "fogplay-official-gas-token";

type CoinSide = "heads" | "tails";

type ChoiceButton = {
  side: CoinSide;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
};

type BetButton = {
  amount: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
};

export class FogplayScene extends BaseScene {
  private coinContainer!: Phaser.GameObjects.Container;
  private coinBase!: Phaser.GameObjects.Graphics;
  private coinIcon!: Phaser.GameObjects.Image;
  private coinFace!: Phaser.GameObjects.Text;
  private coinGlow!: Phaser.GameObjects.Ellipse;
  private orbitOuter!: Phaser.GameObjects.Ellipse;
  private orbitInner!: Phaser.GameObjects.Ellipse;
  private tableSparkles: Phaser.GameObjects.Arc[] = [];

  private choiceButtons: ChoiceButton[] = [];
  private betButtons: BetButton[] = [];
  private placeBetBtn!: Phaser.GameObjects.Container;
  private placeBetBg!: Phaser.GameObjects.Graphics;
  private placeBetLabel!: Phaser.GameObjects.Text;
  private payoutLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;

  private resultOverlay!: Phaser.GameObjects.Container;
  private resultBg!: Phaser.GameObjects.Graphics;
  private resultText!: Phaser.GameObjects.Text;
  private resultAmount!: Phaser.GameObjects.Text;

  private selectedChoice: CoinSide = "heads";
  private selectedBet = "0.50";
  private canBet = false;
  private spinTween: Phaser.Tweens.Tween | null = null;
  private shuffleTimer: Phaser.Time.TimerEvent | null = null;
  private isAnimating = false;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;
  // Last result a cue was played for, so win/lose fires once per reveal
  // instead of on every React state push.
  private lastResultCue = "";

  constructor() {
    super("FogplayScene");
  }

  preload(): void {
    this.load.image(ASSET_GAS, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();
    this.rebuildScene();
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.resizeTimer?.remove(false);
    this.resizeTimer = this.time.delayedCall(0, () => {
      this.resizeTimer = null;
      this.rebuildScene();
    });
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.coinContainer) return;

    const choice = normalizeSide(this.str("choice", "heads"));
    const betAmount = this.str("betAmount", "0.50");
    const flipping = this.bool("isFlipping") || this.bool("revealing");
    const result = this.str("result", "");
    const canBet = this.bool("canBet");
    const validationError = this.str("validationError", "");

    this.selectedChoice = choice;
    this.selectedBet = betAmount;
    this.canBet = canBet;

    this.choiceButtons.forEach((button) => {
      this.renderChoiceButton(button, button.side === choice);
    });
    this.betButtons.forEach((button) => {
      this.renderBetButton(button, amountsEqual(button.amount, betAmount));
    });

    this.payoutLabel.setText(`${formatPayout(betAmount)} GAS`);
    this.renderPlaceBetButton(canBet && !flipping, flipping);

    const quietStatus = validationError.trim();
    this.statusLabel.setText(
      quietStatus || (flipping ? "Waiting for block reveal" : "50/50 · pays 2x"),
    );
    this.statusLabel.setColor(quietStatus ? "#9f321f" : "#5c634f");

    if (flipping && !this.isAnimating) {
      this.startFlipAnimation();
    } else if (!flipping && this.isAnimating) {
      this.stopFlipAnimation(result ? landedSide(choice, result) : choice);
    }

    if (result && !flipping) {
      if (this.lastResultCue !== result) {
        this.lastResultCue = result;
        this.sfx.play(result === "won" ? "win" : "lose");
      }
      this.showResult(result, landedSide(choice, result));
    } else {
      this.lastResultCue = "";
      this.resultOverlay.setVisible(false);
      if (!flipping) this.drawCoinFace(choice);
    }
  }

  private rebuildScene(): void {
    this.stopSceneMotion();
    this.children.removeAll(true);
    this.choiceButtons = [];
    this.betButtons = [];
    this.tableSparkles = [];

    const W = this.scale.width;
    const H = this.scale.height;

    this.buildBackground(W, H);
    this.buildCoin(W, H);
    this.buildChoiceButtons(W, H);
    this.buildBetButtons(W, H);
    this.buildPayoutRow(W, H);
    this.buildPlaceBetButton(W, H);
    this.buildStatusLabel(W, H);
    this.buildResultOverlay(W, H);
    this.startIdleAnimation();
    this.onStateUpdate(this.state);
  }

  private stopSceneMotion(): void {
    this.spinTween?.stop();
    this.spinTween = null;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.resizeTimer?.remove(false);
    this.resizeTimer = null;
    this.tweens.killAll();
    this.isAnimating = false;
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.page);

    const wood = this.add.graphics();
    wood.fillStyle(C.table, 1);
    wood.fillRoundedRect(12, 12, W - 24, H - 24, 28);
    wood.lineStyle(8, C.tableEdge, 0.5);
    wood.strokeRoundedRect(16, 16, W - 32, H - 32, 26);
    wood.lineStyle(1, 0xffe0a1, 0.36);
    for (let y = 38; y < H - 30; y += 34) {
      wood.lineBetween(28, y, W - 28, y + Math.sin(y) * 4);
    }

    const felt = this.add.graphics();
    felt.fillStyle(C.felt, 1);
    felt.fillRoundedRect(30, 34, W - 60, H - 74, 30);
    felt.lineStyle(3, C.feltLight, 0.42);
    felt.strokeRoundedRect(30, 34, W - 60, H - 74, 30);
    felt.fillStyle(C.feltDeep, 0.28);
    felt.fillEllipse(W / 2, H * 0.34, W * 0.78, H * 0.38);

    const title = this.add.text(W / 2, 52, "FOGPLAY FLIP TABLE", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "700",
      color: "#fffce9",
      letterSpacing: 0,
    }).setOrigin(0.5);
    title.setShadow(0, 1, "rgba(24, 72, 45, 0.24)", 3, true, true);

    const rail = this.add.graphics();
    rail.lineStyle(2, C.cream, 0.28);
    rail.strokeEllipse(W / 2, H * 0.33, W * 0.72, H * 0.24);
    rail.lineStyle(2, C.gold, 0.32);
    rail.strokeEllipse(W / 2, H * 0.33, W * 0.56, H * 0.16);

    for (let index = 0; index < 16; index += 1) {
      const angle = (Math.PI * 2 * index) / 16;
      const radiusX = W * 0.33;
      const radiusY = H * 0.12;
      const sparkle = this.add.circle(
        W / 2 + Math.cos(angle) * radiusX,
        H * 0.33 + Math.sin(angle) * radiusY,
        index % 3 === 0 ? 2.4 : 1.6,
        C.cream,
        index % 3 === 0 ? 0.54 : 0.32,
      );
      this.tableSparkles.push(sparkle);
    }
  }

  private buildCoin(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.31;

    this.orbitOuter = this.add.ellipse(cx, cy + 7, 202, 48, C.cream, 0.08)
      .setStrokeStyle(2, C.cream, 0.46);
    this.orbitInner = this.add.ellipse(cx, cy + 7, 146, 31, C.gold, 0.1)
      .setStrokeStyle(2, C.gold, 0.56);

    this.coinGlow = this.add.ellipse(cx, cy + 18, 156, 54, C.gold, 0.24);

    this.coinContainer = this.add.container(cx, cy);
    const shadow = this.add.ellipse(6, 58, 118, 31, C.shadow, 0.2);
    this.coinBase = this.add.graphics();
    this.coinIcon = this.add.image(0, -2, ASSET_GAS).setDisplaySize(54, 54);
    this.coinFace = this.add.text(0, 38, "H", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "18px",
      fontStyle: "800",
      color: "#fffdf1",
      letterSpacing: 0,
    }).setOrigin(0.5);

    this.coinContainer.add([shadow, this.coinBase, this.coinIcon, this.coinFace]);
    this.drawCoinFace(this.selectedChoice);
  }

  private drawCoinFace(side: CoinSide): void {
    const isHeads = side === "heads";
    this.coinBase.clear();
    this.coinBase.fillStyle(isHeads ? 0xf9d977 : 0xf3c65f, 1);
    this.coinBase.fillCircle(0, 0, 58);
    this.coinBase.lineStyle(7, C.goldDeep, 0.64);
    this.coinBase.strokeCircle(0, 0, 58);
    this.coinBase.lineStyle(2, C.cream, 0.72);
    this.coinBase.strokeCircle(0, 0, 46);
    this.coinBase.fillStyle(0xffffff, 0.2);
    this.coinBase.fillEllipse(-17, -20, 52, 22);
    this.coinIcon
      .setTint(isHeads ? C.teal : C.tealDeep)
      .setAlpha(isHeads ? 0.96 : 0.86)
      .setAngle(isHeads ? 0 : 180);
    this.coinFace
      .setText(isHeads ? "H" : "T")
      .setColor(isHeads ? "#fffdf1" : "#eefdf4");
  }

  private buildChoiceButtons(W: number, H: number): void {
    const y = H * 0.56;
    const gap = Math.min(150, W * 0.35);
    this.choiceButtons = [
      this.makeChoiceBtn(W / 2 - gap / 2, y, "heads", "Heads"),
      this.makeChoiceBtn(W / 2 + gap / 2, y, "tails", "Tails"),
    ];
  }

  private makeChoiceBtn(
    x: number,
    y: number,
    side: CoinSide,
    label: string,
  ): ChoiceButton {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const hit = this.add.zone(0, 0, 132, 62).setInteractive({ useHandCursor: true });
    const icon = this.add.image(-40, 0, ASSET_GAS).setDisplaySize(30, 30);
    const text = this.add.text(-16, -9, label, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      fontStyle: "800",
      color: "#253428",
    }).setOrigin(0, 0.5);
    const hint = this.add.text(-16, 11, side === "heads" ? "bright side" : "quiet side", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "10px",
      color: "#6f765f",
    }).setOrigin(0, 0.5);

    this.bindGameButton(hit, {
      targets: container,
      hoverScale: 1.03,
      pressScale: 0.94,
      enabled: () => !this.isAnimating,
      onPress: () => {
        this.sfx.play("select");
        this.dispatch("setChoice", side);
      },
    });

    container.add([bg, hit, icon, text, hint]);
    const button = { side, container, bg, icon, label: text, hint };
    this.renderChoiceButton(button, side === this.selectedChoice);
    return button;
  }

  private renderChoiceButton(button: ChoiceButton, active: boolean): void {
    button.bg.clear();
    button.bg.fillStyle(active ? C.cream : 0xfff8df, active ? 1 : 0.92);
    button.bg.fillRoundedRect(-66, -31, 132, 62, 16);
    button.bg.lineStyle(active ? 3 : 1, active ? C.gold : 0xe5c48c, active ? 0.9 : 0.8);
    button.bg.strokeRoundedRect(-66, -31, 132, 62, 16);
    button.bg.fillStyle(active ? C.teal : 0xe6f7de, active ? 0.16 : 0.08);
    button.bg.fillCircle(-40, 0, 22);
    button.icon.setTint(active ? C.teal : 0x6f9f79).setAlpha(active ? 1 : 0.76);
    button.label.setColor(active ? "#173226" : "#47513f");
    button.hint.setColor(active ? "#3e674d" : "#7d806f");
  }

  private buildBetButtons(W: number, H: number): void {
    const y = H * 0.69;
    const gap = Math.min(76, Math.max(62, W * 0.18));
    const startX = W / 2 - ((BET_PRESETS.length - 1) * gap) / 2;
    this.betButtons = BET_PRESETS.map((amount, index) =>
      this.makeBetBtn(startX + index * gap, y, amount),
    );
  }

  private makeBetBtn(x: number, y: number, amount: string): BetButton {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const hit = this.add.zone(0, 0, 58, 58).setInteractive({ useHandCursor: true });
    const icon = this.add.image(0, -7, ASSET_GAS).setDisplaySize(24, 24);
    const label = this.add.text(0, 14, amount, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "800",
      color: "#253428",
    }).setOrigin(0.5);

    this.bindGameButton(hit, {
      targets: container,
      hoverScale: 1.05,
      pressScale: 0.92,
      enabled: () => !this.isAnimating,
      onPress: () => {
        this.sfx.play("chip");
        this.dispatch("setBetAmount", amount);
      },
    });

    container.add([bg, hit, icon, label]);
    const button = { amount, container, bg, icon, label };
    this.renderBetButton(button, amountsEqual(amount, this.selectedBet));
    return button;
  }

  private renderBetButton(button: BetButton, active: boolean): void {
    button.bg.clear();
    button.bg.fillStyle(active ? C.gold : 0xfff6da, 1);
    button.bg.fillCircle(0, 0, active ? 30 : 28);
    button.bg.lineStyle(active ? 4 : 2, active ? C.goldDeep : 0xd8a34c, active ? 0.72 : 0.42);
    button.bg.strokeCircle(0, 0, active ? 30 : 28);
    button.bg.lineStyle(1, C.cream, active ? 0.76 : 0.48);
    button.bg.strokeCircle(0, 0, 21);
    button.icon.setTint(active ? C.tealDeep : C.teal).setAlpha(active ? 1 : 0.78);
    button.label.setColor(active ? "#253428" : "#667055");
  }

  private buildPayoutRow(W: number, H: number): void {
    const y = H * 0.79;
    const panel = this.add.graphics();
    panel.fillStyle(0xfff9e7, 0.96);
    panel.fillRoundedRect(W / 2 - 106, y - 20, 212, 40, 20);
    panel.lineStyle(1, 0xe8bf68, 0.58);
    panel.strokeRoundedRect(W / 2 - 106, y - 20, 212, 40, 20);
    this.add.text(W / 2 - 68, y, "2x payout", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "700",
      color: "#6f765f",
    }).setOrigin(0.5);
    this.payoutLabel = this.add.text(W / 2 + 50, y, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      fontStyle: "800",
      color: "#17442f",
    }).setOrigin(0.5);
  }

  private buildPlaceBetButton(W: number, H: number): void {
    this.placeBetBtn = this.add.container(W / 2, H * 0.88);
    this.placeBetBg = this.add.graphics();
    const hit = this.add.zone(0, 0, 208, 52).setInteractive({ useHandCursor: true });
    this.placeBetLabel = this.add.text(0, 0, "FLIP", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "18px",
      fontStyle: "900",
      color: "#ffffff",
      letterSpacing: 0,
    }).setOrigin(0.5);

    this.bindGameButton(hit, {
      targets: this.placeBetBtn,
      hoverScale: 1.03,
      pressScale: 0.94,
      enabled: () => this.canBet && !this.isAnimating,
      onPress: () => {
        this.sfx.play("throw");
        this.dispatch("placeBet");
      },
    });

    this.placeBetBtn.add([this.placeBetBg, hit, this.placeBetLabel]);
    this.renderPlaceBetButton(false, false);
  }

  private renderPlaceBetButton(enabled: boolean, flipping: boolean): void {
    this.placeBetBg.clear();
    this.placeBetBg.fillStyle(enabled ? C.teal : 0xd8d5bd, 1);
    this.placeBetBg.fillRoundedRect(-104, -26, 208, 52, 18);
    this.placeBetBg.lineStyle(2, enabled ? 0x83f5c0 : 0xf6edcf, enabled ? 0.72 : 0.8);
    this.placeBetBg.strokeRoundedRect(-104, -26, 208, 52, 18);
    this.placeBetBg.fillStyle(0xffffff, enabled ? 0.16 : 0.08);
    this.placeBetBg.fillRoundedRect(-98, -20, 196, 18, 12);
    this.placeBetLabel
      .setText(flipping ? "FLIPPING" : "FLIP")
      .setColor(enabled || flipping ? "#ffffff" : "#726f5e");
    this.placeBetBtn.setAlpha(enabled || flipping ? 1 : 0.78);
  }

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.955, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#5c634f",
    }).setOrigin(0.5);
  }

  private buildResultOverlay(W: number, H: number): void {
    this.resultOverlay = this.add.container(W / 2, H * 0.31).setVisible(false);
    this.resultBg = this.add.graphics();
    this.resultText = this.add.text(0, -18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "30px",
      fontStyle: "900",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.resultAmount = this.add.text(0, 18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "14px",
      fontStyle: "700",
      color: "#fff8d7",
    }).setOrigin(0.5);
    this.resultOverlay.add([this.resultBg, this.resultText, this.resultAmount]);
  }

  private startIdleAnimation(): void {
    this.animate({
      targets: this.coinContainer,
      y: this.coinContainer.y - 9,
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.animate({
      targets: this.coinGlow,
      scaleX: 1.12,
      alpha: 0.34,
      duration: 1600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.animate({
      targets: this.orbitOuter,
      angle: 360,
      duration: 5200,
      repeat: -1,
    });
    this.animate({
      targets: this.orbitInner,
      angle: -360,
      duration: 3600,
      repeat: -1,
    });
    this.tableSparkles.forEach((sparkle, index) => {
      this.animate({
        targets: sparkle,
        alpha: index % 3 === 0 ? 0.66 : 0.42,
        scale: 1.4,
        duration: 900 + index * 45,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private startFlipAnimation(): void {
    this.isAnimating = true;
    this.tweens.killTweensOf(this.coinContainer);
    this.tweens.killTweensOf(this.coinGlow);

    const faces: CoinSide[] = ["heads", "tails"];
    let faceIndex = 0;
    this.shuffleTimer = this.time.addEvent({
      delay: this.reducedMotion ? 240 : 90,
      loop: true,
      callback: () => {
        this.drawCoinFace(faces[faceIndex % faces.length]!);
        if (faceIndex % 3 === 0) this.sfx.play("tick");
        faceIndex += 1;
      },
    });

    this.spinTween = this.animate({
      targets: this.coinContainer,
      scaleX: 0.16,
      y: this.coinContainer.y - 34,
      angle: 360,
      duration: 420,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.animate({
      targets: this.coinGlow,
      scaleX: 1.38,
      alpha: 0.46,
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopFlipAnimation(side: CoinSide): void {
    this.isAnimating = false;
    this.sfx.play("land");
    this.spinTween?.stop();
    this.spinTween = null;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.tweens.killTweensOf(this.coinContainer);
    this.tweens.killTweensOf(this.coinGlow);
    this.coinContainer.setScale(1).setAngle(0);
    this.coinContainer.setY(this.scale.height * 0.31);
    this.drawCoinFace(side);
    this.startIdleAnimation();
  }

  private showResult(result: string, side: CoinSide): void {
    const won = result === "won";
    this.drawCoinFace(side);
    this.resultBg.clear();
    this.resultBg.fillStyle(won ? C.tealDeep : 0x874133, 0.92);
    this.resultBg.fillRoundedRect(-84, -44, 168, 88, 18);
    this.resultBg.lineStyle(2, won ? 0xa8f7c8 : 0xffc2a8, 0.72);
    this.resultBg.strokeRoundedRect(-84, -44, 168, 88, 18);
    this.resultText
      .setText(won ? "WIN" : "MISS")
      .setColor(won ? "#eafff4" : "#fff2e8");
    this.resultAmount
      .setText(won ? this.str("winAmount", "") || this.str("displayOutcome", "") : this.str("displayOutcome", "Try again"))
      .setColor(won ? "#dcffd9" : "#ffe2c9");

    this.resultOverlay.setVisible(true).setAlpha(0).setScale(0.76);
    this.animate({
      targets: this.resultOverlay,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: "Back.easeOut",
    });
  }
}

function normalizeSide(value: string): CoinSide {
  return value === "tails" ? "tails" : "heads";
}

function landedSide(choice: CoinSide, result: string): CoinSide {
  if (result === "lost") return choice === "heads" ? "tails" : "heads";
  return choice;
}

function amountsEqual(a: string, b: string): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

function formatPayout(amount: string): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? (numeric * 2).toFixed(2) : "0.00";
}
