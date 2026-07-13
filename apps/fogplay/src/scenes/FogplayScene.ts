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
import coinHeadsUrl from "../static/coin_heads.webp";
import coinTailsUrl from "../static/coin_tails.webp";
import holoPedestalUrl from "../static/holo_pedestal-512.webp";
import {
  CoinMotionGeneration,
  landedSide,
} from "../logic/coin-motion";
import type { CoinMotionPhase, CoinSide } from "../logic/coin-motion";

const BET_PRESETS = ["0.25", "0.50", "1.00", "2.00"] as const;

const C = {
  page: 0xfff4dc,
  table: 0xf7c56c,
  tableEdge: 0xa96525,
  felt: 0x0b6b3a,
  feltDeep: 0x095a31,
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

// Graduated gold denominations so the four wager chips read as distinct poker
// chips (pale → deep) rather than four copies of the same token disc.
const CHIP_TIERS = [
  { fill: 0xfff4d2, ring: 0xe4c489 },
  { fill: 0xfce7b4, ring: 0xd3a955 },
  { fill: 0xf6d99b, ring: 0xc4923b },
  { fill: 0xefcb82, ring: 0xb37e26 },
] as const;

const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
const ASSET_GAS = "fogplay-official-gas-token";
const ASSET_COIN_HEADS = "fogplay-coin-heads";
const ASSET_COIN_TAILS = "fogplay-coin-tails";
const ASSET_HOLO_PEDESTAL = "fogplay-holo-pedestal";

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
  tier: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
};

type TableAction = "placeBet" | "revealResult" | "resetGame";

export class FogplayScene extends BaseScene {
  private coinContainer!: Phaser.GameObjects.Container;
  private coinFaceImage!: Phaser.GameObjects.Image;
  private coinPedestal!: Phaser.GameObjects.Image;
  private currencyMarker!: Phaser.GameObjects.Container;
  private coinShadow!: Phaser.GameObjects.Ellipse;
  private coinGlow!: Phaser.GameObjects.Ellipse;
  private orbitOuter!: Phaser.GameObjects.Ellipse;
  private orbitInner!: Phaser.GameObjects.Ellipse;
  private tableSparkles: Phaser.GameObjects.Arc[] = [];

  private choiceButtons: ChoiceButton[] = [];
  private betButtons: BetButton[] = [];
  private placeBetBtn!: Phaser.GameObjects.Container;
  private placeBetBg!: Phaser.GameObjects.Graphics;
  private placeBetLabel!: Phaser.GameObjects.Text;
  private payoutRow!: Phaser.GameObjects.Container;
  private payoutLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;

  private resultOverlay!: Phaser.GameObjects.Container;
  private resultBg!: Phaser.GameObjects.Graphics;
  private resultText!: Phaser.GameObjects.Text;
  private resultAmount!: Phaser.GameObjects.Text;

  private selectedChoice: CoinSide = "heads";
  private selectedBet = "0.50";
  private tableAction: TableAction = "placeBet";
  private tableActionEnabled = false;
  private spinTween: Phaser.Tweens.Tween | null = null;
  private shuffleTimer: Phaser.Time.TimerEvent | null = null;
  private isAnimating = false;
  private coinRestY = 0;
  private displayedSide: CoinSide = "heads";
  private coinPhase: CoinMotionPhase = "idle";
  private readonly motionGeneration = new CoinMotionGeneration();
  private resizeTimer: Phaser.Time.TimerEvent | null = null;
  // Last result a cue was played for, so win/lose fires once per reveal
  // instead of on every React state push.
  private lastResultCue = "";

  constructor() {
    super("FogplayScene");
  }

  preload(): void {
    this.load.image(ASSET_GAS, officialGasTokenPhaserUrl);
    this.load.image(ASSET_COIN_HEADS, coinHeadsUrl);
    this.load.image(ASSET_COIN_TAILS, coinTailsUrl);
    this.load.image(ASSET_HOLO_PEDESTAL, holoPedestalUrl);
  }

  create(): void {
    super.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.stopSceneMotion, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.stopSceneMotion, this);
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
    const outcomeValue = this.str("displayOutcome", "");
    const confirmedOutcome: CoinSide | null =
      outcomeValue === "heads" || outcomeValue === "tails" ? outcomeValue : null;
    const canBet = this.bool("canBet");
    const isGuest = this.bool("isGuest");
    const needsReveal = this.bool("hasPendingBet") || this.bool("revealFailed");
    const validationError = this.str("validationError", "");

    this.selectedChoice = choice;
    this.selectedBet = betAmount;

    this.choiceButtons.forEach((button) => {
      this.renderChoiceButton(button, button.side === choice);
    });
    this.betButtons.forEach((button) => {
      button.container.setVisible(!isGuest);
      this.renderBetButton(button, amountsEqual(button.amount, betAmount));
    });
    this.currencyMarker.setVisible(!isGuest);
    this.payoutRow.setY(this.scale.height * (isGuest ? 0.695 : 0.755));
    this.placeBetBtn.setY(this.scale.height * (isGuest ? 0.805 : 0.845));
    this.statusLabel.setY(this.scale.height * (isGuest ? 0.87 : 0.895));

    // GameFi renders the "N.NN GAS" 2x payout; guest supplies a local streak
    // value via bridgeState so the row never shows GAS at stake.
    this.payoutLabel.setText(this.str("payoutValue", `${formatPayout(betAmount)} GAS`));
    const settled = Boolean(result) && !flipping;
    if (needsReveal) {
      this.tableAction = "revealResult";
      this.tableActionEnabled = !flipping;
      this.renderPlaceBetButton(!flipping, flipping, this.str("revealCta", "REVEAL"));
    } else if (settled) {
      this.tableAction = "resetGame";
      this.tableActionEnabled = true;
      this.renderPlaceBetButton(true, false, this.str("playAgainCta", "AGAIN"));
    } else {
      this.tableAction = "placeBet";
      this.tableActionEnabled = canBet && !flipping;
      this.renderPlaceBetButton(canBet && !flipping, flipping, this.str("flipCta", "FLIP"));
    }

    const quietStatus = validationError.trim();
    this.statusLabel.setText(
      quietStatus ||
        (flipping
          ? this.str("statusFlipping", "Waiting for block reveal")
          : this.str("statusIdle", "50/50 · pays 2x")),
    );
    this.statusLabel.setColor(quietStatus ? "#8f2818" : "#173d2a");

    this.syncCoinMotion(choice, flipping, result, confirmedOutcome);
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
    this.motionGeneration.cancel();
    this.spinTween?.stop();
    this.spinTween = null;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.resizeTimer?.remove(false);
    this.resizeTimer = null;
    this.tweens.killAll();
    this.isAnimating = false;
    this.coinPhase = "idle";
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

    const title = this.add.text(W / 2, 52, this.str("tableTitle", "FOGPLAY FLIP TABLE"), {
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
    const cy = H * 0.29;
    this.coinRestY = cy;

    // The authored pedestal is a scene prop, not a coin face. It stays planted
    // while the physical heads/tails artwork launches and lands above it.
    this.coinPedestal = this.add.image(cx, cy + 72, ASSET_HOLO_PEDESTAL)
      .setDisplaySize(258, 258)
      .setAlpha(0.94);

    this.orbitOuter = this.add.ellipse(cx, cy + 28, 202, 46, C.cream, 0.07)
      .setStrokeStyle(2, C.cream, 0.32);
    this.orbitInner = this.add.ellipse(cx, cy + 32, 146, 29, C.gold, 0.09)
      .setStrokeStyle(2, C.gold, 0.4);

    this.coinGlow = this.add.ellipse(cx, cy + 30, 156, 54, C.gold, 0.24);
    this.coinShadow = this.add.ellipse(cx + 5, cy + 62, 112, 25, C.shadow, 0.22);

    this.coinContainer = this.add.container(cx, cy);
    this.coinFaceImage = this.add.image(0, 0, ASSET_COIN_HEADS).setDisplaySize(142, 142);
    this.coinContainer.add(this.coinFaceImage);

    // Official GAS artwork is deliberately separate from the physical coin: it
    // identifies the wager currency and never substitutes for heads or tails.
    const marker = this.add.container(cx + 104, cy + 65);
    this.currencyMarker = marker;
    const markerBg = this.add.graphics();
    markerBg.fillStyle(0xfffff3, 0.95);
    markerBg.fillRoundedRect(-27, -12, 54, 24, 12);
    markerBg.lineStyle(1, C.goldDeep, 0.5);
    markerBg.strokeRoundedRect(-27, -12, 54, 24, 12);
    const markerIcon = this.add.image(-14, 0, ASSET_GAS).setDisplaySize(17, 17);
    const markerLabel = this.add.text(8, 0, "GAS", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      fontStyle: "800",
      color: "#375444",
    }).setOrigin(0.5);
    marker.add([markerBg, markerIcon, markerLabel]);

    this.setCoinSide(this.selectedChoice);
  }

  private setCoinSide(side: CoinSide): void {
    this.displayedSide = side;
    this.coinFaceImage.setTexture(side === "heads" ? ASSET_COIN_HEADS : ASSET_COIN_TAILS);
  }

  private buildChoiceButtons(W: number, H: number): void {
    const y = H * 0.56;
    const gap = Math.min(150, W * 0.35);
    this.choiceButtons = [
      this.makeChoiceBtn(W / 2 - gap / 2, y, "heads", this.str("headsLabel", "Heads")),
      this.makeChoiceBtn(W / 2 + gap / 2, y, "tails", this.str("tailsLabel", "Tails")),
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
    const icon = this.add.image(
      -40,
      0,
      side === "heads" ? ASSET_COIN_HEADS : ASSET_COIN_TAILS,
    ).setDisplaySize(42, 42);
    const text = this.add.text(-16, -9, label, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      fontStyle: "800",
      color: "#253428",
    }).setOrigin(0, 0.5);
    const hint = this.add.text(
      -16,
      11,
      side === "heads" ? this.str("headsHint", "bright side") : this.str("tailsHint", "quiet side"),
      {
        fontFamily: FONT_FAMILY,
        resolution: TEXT_RESOLUTION,
        fontSize: "10px",
        color: "#6f765f",
      },
    ).setOrigin(0, 0.5);
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
    const y = H * 0.66;
    const gap = Math.min(76, Math.max(62, W * 0.18));
    const startX = W / 2 - ((BET_PRESETS.length - 1) * gap) / 2;
    this.betButtons = BET_PRESETS.map((amount, index) =>
      this.makeBetBtn(startX + index * gap, y, amount, index),
    );
  }

  private makeBetBtn(x: number, y: number, amount: string, tier: number): BetButton {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const hit = this.add.zone(0, 0, 58, 58).setInteractive({ useHandCursor: true });
    const icon = this.add.image(0, -8, ASSET_GAS).setDisplaySize(18, 18);
    const label = this.add.text(0, 12, amount, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
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
    const button = { amount, tier, container, bg, icon, label };
    this.renderBetButton(button, amountsEqual(amount, this.selectedBet));
    return button;
  }

  private renderBetButton(button: BetButton, active: boolean): void {
    const chip = CHIP_TIERS[button.tier] ?? CHIP_TIERS[0]!;
    button.bg.clear();
    button.bg.fillStyle(active ? C.gold : chip.fill, 1);
    button.bg.fillCircle(0, 0, active ? 30 : 28);
    button.bg.lineStyle(active ? 4 : 2, active ? C.goldDeep : chip.ring, active ? 0.72 : 0.5);
    button.bg.strokeCircle(0, 0, active ? 30 : 28);
    button.bg.lineStyle(1, C.cream, active ? 0.76 : 0.5);
    button.bg.strokeCircle(0, 0, 21);
    button.icon.setTint(active ? C.tealDeep : C.teal).setAlpha(active ? 0.95 : 0.6);
    button.label.setColor(active ? "#253428" : "#5f5230");
  }

  private buildPayoutRow(W: number, H: number): void {
    const y = H * 0.755;
    this.payoutRow = this.add.container(W / 2, y);
    const panel = this.add.graphics();
    panel.fillStyle(0xfff9e7, 0.96);
    panel.fillRoundedRect(-106, -20, 212, 40, 20);
    panel.lineStyle(1, 0xe8bf68, 0.58);
    panel.strokeRoundedRect(-106, -20, 212, 40, 20);
    const caption = this.add.text(-68, 0, this.str("payoutCaption", "2x payout"), {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "700",
      color: "#6f765f",
    }).setOrigin(0.5);
    this.payoutLabel = this.add.text(50, 0, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      fontStyle: "800",
      color: "#17442f",
    }).setOrigin(0.5);
    this.payoutRow.add([panel, caption, this.payoutLabel]);
  }

  private buildPlaceBetButton(W: number, H: number): void {
    this.placeBetBtn = this.add.container(W / 2, H * 0.845);
    this.placeBetBg = this.add.graphics();
    const hit = this.add.zone(0, 0, 208, 52).setInteractive({ useHandCursor: true });
    this.placeBetLabel = this.add.text(0, 0, this.str("flipCta", "FLIP"), {
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
      enabled: () => this.tableActionEnabled && !this.isAnimating,
      onPress: () => {
        this.sfx.play(this.tableAction === "placeBet" ? "throw" : "select");
        this.dispatch(this.tableAction);
      },
    });

    this.placeBetBtn.add([this.placeBetBg, hit, this.placeBetLabel]);
    this.renderPlaceBetButton(false, false);
  }

  private renderPlaceBetButton(enabled: boolean, flipping: boolean, label?: string): void {
    this.placeBetBg.clear();
    this.placeBetBg.fillStyle(enabled ? C.teal : 0xd8d5bd, 1);
    this.placeBetBg.fillRoundedRect(-104, -26, 208, 52, 18);
    this.placeBetBg.lineStyle(2, enabled ? 0x83f5c0 : 0xf6edcf, enabled ? 0.72 : 0.8);
    this.placeBetBg.strokeRoundedRect(-104, -26, 208, 52, 18);
    this.placeBetBg.fillStyle(0xffffff, enabled ? 0.16 : 0.08);
    this.placeBetBg.fillRoundedRect(-98, -20, 196, 18, 12);
    this.placeBetLabel
      .setText(flipping ? this.str("flippingCta", "FLIPPING") : label ?? this.str("flipCta", "FLIP"))
      .setColor(enabled || flipping ? "#ffffff" : "#726f5e");
    this.placeBetBtn.setAlpha(enabled || flipping ? 1 : 0.78);
  }

  private buildStatusLabel(W: number, H: number): void {
    this.statusLabel = this.add.text(W / 2, H * 0.895, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      fontStyle: "700",
      color: "#173d2a",
    }).setOrigin(0.5);
  }

  private buildResultOverlay(W: number, H: number): void {
    // Result copy sits below the pedestal so the landed physical face remains
    // fully visible and is never covered by a generic win/loss panel.
    this.resultOverlay = this.add.container(W / 2, H * 0.44).setVisible(false);
    this.resultBg = this.add.graphics();
    this.resultText = this.add.text(0, -12, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "30px",
      fontStyle: "900",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.resultAmount = this.add.text(0, 15, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "14px",
      fontStyle: "700",
      color: "#fff8d7",
    }).setOrigin(0.5);
    this.resultOverlay.add([this.resultBg, this.resultText, this.resultAmount]);
  }

  private startIdleAnimation(): void {
    this.startCoinIdleMotion();
    if (this.reducedMotion) return;
    this.animate({
      targets: this.coinPedestal,
      alpha: 0.82,
      duration: 1900,
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

  private startCoinIdleMotion(): void {
    this.tweens.killTweensOf(this.coinContainer);
    this.tweens.killTweensOf(this.coinGlow);
    this.tweens.killTweensOf(this.coinShadow);
    this.coinContainer.setPosition(this.scale.width / 2, this.coinRestY).setScale(1).setAngle(0);
    this.coinShadow.setAlpha(0.22).setScale(1);
    if (this.reducedMotion) return;
    this.animate({
      targets: this.coinContainer,
      y: this.coinRestY - 8,
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
      targets: this.coinShadow,
      scaleX: 0.84,
      alpha: 0.15,
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private syncCoinMotion(
    choice: CoinSide,
    flipping: boolean,
    result: string,
    confirmedOutcome: CoinSide | null,
  ): void {
    if (flipping) {
      this.resultOverlay.setVisible(false);
      this.lastResultCue = "";
      if (this.coinPhase !== "launch" && this.coinPhase !== "flip") {
        this.startFlipAnimation();
      }
      return;
    }

    // The visual face never invents a GameFi outcome. It consumes the exact
    // canonical outcome bridged from getPendingBet; landedSide is only a
    // defensive mapping for older guest state that lacks displayOutcome.
    const side = result ? confirmedOutcome ?? landedSide(choice, result) : choice;
    if (this.coinPhase === "launch" || this.coinPhase === "flip") {
      this.landCoin(side, result);
      return;
    }
    if (this.coinPhase === "land") return;

    if (result) {
      if (this.coinPhase !== "result") {
        this.showSettledResultImmediately(side, result);
      } else {
        this.setCoinSide(side);
        this.showResult(result, side, false);
      }
      return;
    }

    this.lastResultCue = "";
    this.resultOverlay.setVisible(false);
    if (this.coinPhase !== "idle") this.resetCoinToIdle(choice);
    else this.setCoinSide(choice);
  }

  private startFlipAnimation(): void {
    const generation = this.motionGeneration.begin();
    this.cancelCoinTweens();
    this.isAnimating = true;
    this.coinPhase = "launch";
    this.resultOverlay.setVisible(false);
    this.setCoinSide(this.selectedChoice);
    this.coinContainer.setPosition(this.scale.width / 2, this.coinRestY).setScale(1).setAngle(0);
    this.coinShadow.setAlpha(0.22).setScale(1);

    if (this.reducedMotion) {
      // The outcome is not known yet. Keep the selected face static until the
      // confirmed result arrives, then landCoin() jumps directly to that face.
      this.coinPhase = "flip";
      return;
    }

    this.spinTween = this.tweens.add({
      targets: this.coinContainer,
      y: this.coinRestY - 68,
      scaleX: 1.08,
      scaleY: 1.08,
      angle: -6,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (!this.motionGeneration.isCurrent(generation)) return;
        this.startFlipLoop(generation);
      },
    });
    this.tweens.add({
      targets: this.coinShadow,
      scaleX: 0.48,
      alpha: 0.08,
      duration: 280,
      ease: "Cubic.easeOut",
    });
  }

  private startFlipLoop(generation: number): void {
    if (!this.motionGeneration.isCurrent(generation)) return;
    this.coinPhase = "flip";
    this.shuffleTimer = this.time.addEvent({
      delay: 92,
      loop: true,
      callback: () => {
        if (!this.motionGeneration.isCurrent(generation)) return;
        this.setCoinSide(this.displayedSide === "heads" ? "tails" : "heads");
        this.sfx.play("tick");
      },
    });
    this.spinTween = this.tweens.add({
      targets: this.coinContainer,
      scaleX: 0.08,
      scaleY: 1.04,
      angle: 7,
      duration: 112,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: this.coinGlow,
      scaleX: 1.38,
      alpha: 0.46,
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
  }

  private landCoin(side: CoinSide, result: string): void {
    const generation = this.motionGeneration.begin();
    this.cancelCoinTweens();
    this.coinPhase = "land";
    this.isAnimating = true;
    this.setCoinSide(side);

    if (this.reducedMotion) {
      this.finishLanding(generation, side, result);
      return;
    }

    this.coinContainer.setScale(Math.max(0.22, Math.abs(this.coinContainer.scaleX)), 1.02);
    this.spinTween = this.tweens.add({
      targets: this.coinContainer,
      x: this.scale.width / 2,
      y: this.coinRestY,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      duration: 360,
      ease: "Bounce.easeOut",
      onComplete: () => this.finishLanding(generation, side, result),
    });
    this.tweens.add({
      targets: this.coinShadow,
      scaleX: 1,
      alpha: 0.22,
      duration: 320,
      ease: "Sine.easeOut",
    });
  }

  private finishLanding(generation: number, side: CoinSide, result: string): void {
    if (!this.motionGeneration.isCurrent(generation)) return;
    this.coinContainer
      .setPosition(this.scale.width / 2, this.coinRestY)
      .setScale(1)
      .setAngle(0);
    this.coinShadow.setAlpha(0.22).setScale(1);
    this.setCoinSide(side);
    this.isAnimating = false;
    this.sfx.play("land");

    if (result) {
      this.coinPhase = "result";
      this.showResult(result, side, true);
    } else {
      this.coinPhase = "idle";
      this.lastResultCue = "";
      this.resultOverlay.setVisible(false);
    }
    this.startCoinIdleMotion();
  }

  private showSettledResultImmediately(side: CoinSide, result: string): void {
    this.motionGeneration.begin();
    this.cancelCoinTweens();
    this.coinContainer
      .setPosition(this.scale.width / 2, this.coinRestY)
      .setScale(1)
      .setAngle(0);
    this.coinShadow.setAlpha(0.22).setScale(1);
    this.setCoinSide(side);
    this.isAnimating = false;
    this.coinPhase = "result";
    this.showResult(result, side, !this.reducedMotion);
    this.startCoinIdleMotion();
  }

  private resetCoinToIdle(side: CoinSide): void {
    this.motionGeneration.begin();
    this.cancelCoinTweens();
    this.coinPhase = "idle";
    this.isAnimating = false;
    this.lastResultCue = "";
    this.resultOverlay.setVisible(false);
    this.setCoinSide(side);
    this.startCoinIdleMotion();
  }

  private cancelCoinTweens(): void {
    this.spinTween?.stop();
    this.spinTween = null;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    if (this.coinContainer) this.tweens.killTweensOf(this.coinContainer);
    if (this.coinGlow) this.tweens.killTweensOf(this.coinGlow);
    if (this.coinShadow) this.tweens.killTweensOf(this.coinShadow);
  }

  private showResult(result: string, side: CoinSide, animateEntrance: boolean): void {
    const won = result === "won";
    const firstCue = this.lastResultCue !== result;
    this.setCoinSide(side);
    if (firstCue) {
      this.lastResultCue = result;
      this.sfx.play(won ? "win" : "lose");
      if (won) this.emitWinBurst(side);
    }
    this.resultBg.clear();
    this.resultBg.fillStyle(won ? C.tealDeep : 0x874133, 0.92);
    this.resultBg.fillRoundedRect(-82, -35, 164, 70, 18);
    this.resultBg.lineStyle(2, won ? 0xa8f7c8 : 0xffc2a8, 0.72);
    this.resultBg.strokeRoundedRect(-82, -35, 164, 70, 18);
    this.resultText
      .setText(won ? this.str("resultWin", "WIN") : this.str("resultMiss", "MISS"))
      .setColor(won ? "#eafff4" : "#fff2e8");
    this.resultAmount
      .setText(
        won
          ? this.str("winAmount", "") || this.str("landedLabel", "")
          : this.str("landedLabel", "") || this.str("tryAgainShort", "Try again"),
      )
      .setColor(won ? "#dcffd9" : "#ffe2c9");

    this.resultOverlay.setVisible(true);
    if (animateEntrance) {
      this.resultOverlay.setAlpha(0).setScale(0.76);
      this.animate({
        targets: this.resultOverlay,
        alpha: 1,
        scale: 1,
        duration: 220,
        ease: "Back.easeOut",
      });
    } else {
      this.resultOverlay.setAlpha(1).setScale(1);
    }
  }

  /** Celebrate with actual coin/GAS textures, never placeholder circles. */
  private emitWinBurst(side: CoinSide): void {
    if (this.reducedMotion) return;
    const isGuest = this.bool("isGuest");
    const texture = isGuest
      ? side === "heads" ? ASSET_COIN_HEADS : ASSET_COIN_TAILS
      : ASSET_GAS;
    const { width: W, height: H } = this.scale;
    for (let index = 0; index < 10; index += 1) {
      const token = this.add.image(
        W / 2 + Phaser.Math.Between(-88, 88),
        H * 0.42,
        texture,
      )
        .setDisplaySize(isGuest ? 28 : 22, isGuest ? 28 : 22)
        .setDepth(24)
        .setAlpha(0.96);
      this.tweens.add({
        targets: token,
        x: token.x + Phaser.Math.Between(-64, 64),
        y: Phaser.Math.Between(Math.round(H * 0.12), Math.round(H * 0.35)),
        angle: Phaser.Math.Between(-150, 150),
        alpha: 0,
        scale: 0.72,
        delay: index * 45,
        duration: 760,
        ease: "Cubic.easeOut",
        onComplete: () => token.destroy(),
      });
    }
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (!this.coinContainer) return;

    const flipping = this.bool("isFlipping") || this.bool("revealing");
    const result = this.str("result", "");
    const outcomeValue = this.str("displayOutcome", "");
    const confirmedOutcome: CoinSide | null =
      outcomeValue === "heads" || outcomeValue === "tails" ? outcomeValue : null;

    if (!enabled) {
      if (flipping) this.startFlipAnimation();
      else if (result) {
        this.showSettledResultImmediately(
          confirmedOutcome ?? landedSide(this.selectedChoice, result),
          result,
        );
      } else {
        this.startIdleAnimation();
      }
      return;
    }

    this.motionGeneration.cancel();
    this.cancelCoinTweens();
    this.tweens.killTweensOf(this.coinPedestal);
    this.tweens.killTweensOf(this.orbitOuter);
    this.tweens.killTweensOf(this.orbitInner);
    this.tableSparkles.forEach((sparkle) => this.tweens.killTweensOf(sparkle));
    this.coinPedestal.setAlpha(0.94);
    this.orbitOuter.setAngle(0);
    this.orbitInner.setAngle(0);
    this.tableSparkles.forEach((sparkle, index) => {
      sparkle.setScale(1).setAlpha(index % 3 === 0 ? 0.54 : 0.32);
    });
    this.coinContainer
      .setPosition(this.scale.width / 2, this.coinRestY)
      .setScale(1)
      .setAngle(0);
    this.coinShadow.setAlpha(0.22).setScale(1);

    if (flipping) {
      this.coinPhase = "flip";
      this.isAnimating = true;
      this.setCoinSide(this.selectedChoice);
      this.resultOverlay.setVisible(false);
      return;
    }

    this.isAnimating = false;
    const side = result
      ? confirmedOutcome ?? landedSide(this.selectedChoice, result)
      : this.selectedChoice;
    this.setCoinSide(side);
    if (result) {
      this.coinPhase = "result";
      this.showResult(result, side, false);
    } else {
      this.coinPhase = "idle";
      this.resultOverlay.setVisible(false);
    }
  }
}

function normalizeSide(value: string): CoinSide {
  return value === "tails" ? "tails" : "heads";
}

function amountsEqual(a: string, b: string): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

function formatPayout(amount: string): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? (numeric * 2).toFixed(2) : "0.00";
}
