/**
 * LastSurvivorScene - Phaser 3 Last Survivor arena.
 *
 * Chain behavior stays in useLastSurvivor/main.tsx. This scene owns the
 * playable surface: a bright on-chain arena, key selection, buy action, and
 * settlement affordance when the countdown has ended.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import gasIconUrl from "@shared/assets/tokens/gas-icon.svg?url";

const SURVIVOR_ASSETS = {
  arena: "last-survivor-arena",
  logo: "last-survivor-logo",
  gasIcon: "last-survivor-gas-icon",
} as const;

const C = {
  canvas: 0xfffbef,
  surface: 0xffffff,
  surfaceWarm: 0xfff3d6,
  stroke: 0xead7ad,
  strokeStrong: 0xe8ac36,
  ink: 0x2b2418,
  muted: 0x806f56,
  gold: 0xf4b840,
  goldDeep: 0xb87917,
  green: 0x16a86b,
  greenSoft: 0xdff7e8,
  orange: 0xf28a2e,
  red: 0xd84d3f,
  disabled: 0xd9cbb7,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const KEY_PRESETS = ["1", "3", "5", "10"] as const;

type PresetView = {
  value: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
};

function compactError(value: string): string {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Phaser.Math.Clamp(value, 0, 100);
}

export class LastSurvivorScene extends BaseScene {
  private heroContainer!: Phaser.GameObjects.Container;
  private heroImage!: Phaser.GameObjects.Image;
  private heroFrame!: Phaser.GameObjects.Graphics;
  private orbitTokens: Phaser.GameObjects.Image[] = [];

  private potText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private timerSubtext!: Phaser.GameObjects.Text;
  private dangerRing!: Phaser.GameObjects.Graphics;
  private dangerFill!: Phaser.GameObjects.Rectangle;
  private leaderText!: Phaser.GameObjects.Text;
  private totalKeysText!: Phaser.GameObjects.Text;
  private userKeysText!: Phaser.GameObjects.Text;
  private costText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private noticeText!: Phaser.GameObjects.Text;

  private presetViews: PresetView[] = [];
  private buyButton!: Phaser.GameObjects.Container;
  private buyButtonBg!: Phaser.GameObjects.Graphics;
  private buyButtonLabel!: Phaser.GameObjects.Text;
  private settleButton!: Phaser.GameObjects.Container;
  private settleButtonBg!: Phaser.GameObjects.Graphics;
  private settleButtonLabel!: Phaser.GameObjects.Text;

  private selectedKeyCount = "1";
  private lastBuying = false;
  private lastSettling = false;

  constructor() {
    super("LastSurvivorScene");
  }

  preload(): void {
    this.load.image(SURVIVOR_ASSETS.arena, "./last-survivor-arena.webp");
    this.load.image(SURVIVOR_ASSETS.logo, "./logo.webp");
    this.load.image(SURVIVOR_ASSETS.gasIcon, gasIconUrl);
  }

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;

    this.buildBackground(W, H);
    this.buildHero(W);
    this.buildHud(W);
    this.buildTimerConsole(W);
    this.buildControls(W, H);
    this.buildStatus(W, H);
    this.startAmbientMotion();
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const countdown = this.str("countdown", "00:00:00");
    const pot = this.str("totalPotDisplay", "0.00 GAS");
    const roundStatus = this.str("roundStatusDisplay", "");
    const dangerText = this.str("dangerLevelText", "");
    const leader = this.str("lastBuyerLabel", "--");
    const cost = this.str("estimatedCost", "0.00");
    const validation = this.str("keyValidationError", "");
    const serviceNotice = this.str("serviceNotice", "");
    const bridgeKeyCount = this.str("keyCount", this.selectedKeyCount);
    const dangerPct = clampPct(this.num("dangerProgress", 0));
    const totalKeys = this.num("totalKeys", this.num("totalKeysDisplay", 0));
    const userKeys = this.num("userKeys", 0);
    const isRoundActive = this.bool("isRoundActive");
    const isBuying = this.bool("isBuyingKeys");
    const isSettling = this.bool("isSettling");
    const needsLifecycleSync = this.bool("needsLifecycleSync");
    const roundReady = this.bool("roundDataAvailable");

    if (KEY_PRESETS.includes(bridgeKeyCount as (typeof KEY_PRESETS)[number])) {
      this.selectedKeyCount = bridgeKeyCount;
    }

    this.potText.setText(pot);
    this.roundText.setText(roundStatus || (isRoundActive ? "Live round" : "Waiting for round"));
    this.countdownText.setText(needsLifecycleSync ? "Settle" : countdown);
    this.timerSubtext.setText(
      needsLifecycleSync
        ? "Last buyer can be paid now"
        : isRoundActive
          ? (dangerText || "Press to stay alive")
          : "Round will open after sync",
    );
    this.leaderText.setText(leader && leader !== "--" ? `Last buyer ${leader}` : "No buyer yet");
    this.totalKeysText.setText(`${totalKeys} keys sold`);
    this.userKeysText.setText(`${userKeys} yours`);
    this.costText.setText(`${cost} GAS`);

    this.statusText.setText(
      validation
        ? compactError(validation)
        : serviceNotice
          ? compactError(serviceNotice)
          : needsLifecycleSync
            ? "Settle to pay the winner and open a fresh round."
            : isRoundActive
              ? "Choose keys, then buy to extend the clock."
              : roundReady
                ? "Waiting for the next live round."
                : "Connect wallet and sync the arena.",
    );
    this.statusText.setColor(validation ? "#d84d3f" : "#806f56");
    this.noticeText.setText(isBuying ? "Wallet confirmation in progress..." : isSettling ? "Settling round..." : "");

    this.renderDanger(dangerPct);
    this.renderPresets();
    this.renderButtons();

    if (isBuying && !this.lastBuying) this.playBuyMotion();
    if (isSettling && !this.lastSettling) this.playSettleMotion();
    this.lastBuying = isBuying;
    this.lastSettling = isSettling;
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusText?.setText(compactError(error.message));
    this.statusText?.setColor("#d84d3f");
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const g = this.add.graphics();
    g.fillStyle(0xfff5dc, 1);
    g.fillRoundedRect(14, 14, W - 28, H - 28, 22);
    g.lineStyle(1, C.stroke, 1);
    g.strokeRoundedRect(14, 14, W - 28, H - 28, 22);

    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(26, 330, W - 52, 242, 20);
    g.lineStyle(1, C.stroke, 0.9);
    g.strokeRoundedRect(26, 330, W - 52, 242, 20);
  }

  private buildHero(W: number): void {
    this.heroContainer = this.add.container(W / 2, 176);

    const shadow = this.add.graphics();
    shadow.fillStyle(0xc78c22, 0.16);
    shadow.fillRoundedRect(-184, -126, 368, 252, 22);

    this.heroImage = this.add.image(0, -4, SURVIVOR_ASSETS.arena);
    this.heroImage.setDisplaySize(366, 236);

    this.heroFrame = this.add.graphics();
    this.heroFrame.lineStyle(2, C.strokeStrong, 0.9);
    this.heroFrame.strokeRoundedRect(-184, -126, 368, 252, 22);

    this.heroContainer.add([shadow, this.heroImage, this.heroFrame]);
  }

  private buildHud(W: number): void {
    const card = this.add.graphics();
    card.fillStyle(C.surface, 0.94);
    card.fillRoundedRect(30, 28, W - 60, 58, 18);
    card.lineStyle(1, C.stroke, 1);
    card.strokeRoundedRect(30, 28, W - 60, 58, 18);

    const gas = this.add.image(58, 57, SURVIVOR_ASSETS.gasIcon).setDisplaySize(28, 28);
    this.potText = this.add.text(82, 45, "0.00 GAS", {
      fontFamily: FONT,
      fontSize: "20px",
      fontStyle: "700",
      color: "#2b2418",
    });
    this.add.text(84, 67, "Prize pool", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#806f56",
    });

    this.add.image(W - 148, 57, SURVIVOR_ASSETS.logo).setDisplaySize(30, 30);

    this.roundText = this.add.text(W - 50, 57, "Live round", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "700",
      color: "#16a86b",
    }).setOrigin(1, 0.5);

    this.orbitTokens.push(gas);
  }

  private buildTimerConsole(W: number): void {
    const y = 285;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.96);
    panel.fillRoundedRect(48, y - 52, W - 96, 104, 22);
    panel.lineStyle(1, C.stroke, 1);
    panel.strokeRoundedRect(48, y - 52, W - 96, 104, 22);

    this.dangerRing = this.add.graphics();
    this.renderDanger(0);

    this.countdownText = this.add.text(W / 2, y - 11, "00:00:00", {
      fontFamily: FONT,
      fontSize: "34px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    this.timerSubtext = this.add.text(W / 2, y + 24, "Press to stay alive", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
    }).setOrigin(0.5);

    this.leaderText = this.add.text(W / 2, y + 38, "No buyer yet", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
    }).setOrigin(0.5);

    this.dangerFill = this.add.rectangle(64, y + 47, 0, 6, C.green).setOrigin(0, 0.5);
  }

  private buildControls(W: number, H: number): void {
    this.add.text(50, 356, "Choose key pack", {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "700",
      color: "#2b2418",
    });

    this.costText = this.add.text(W - 50, 356, "0.00 GAS", {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "700",
      color: "#b87917",
    }).setOrigin(1, 0);

    const startX = 76;
    KEY_PRESETS.forEach((value, index) => {
      const view = this.makePresetView(startX + index * 90, 407, value);
      this.presetViews.push(view);
    });

    this.totalKeysText = this.add.text(52, 466, "0 keys sold", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
    });
    this.userKeysText = this.add.text(W - 52, 466, "0 yours", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
    }).setOrigin(1, 0);

    this.buyButton = this.add.container(210, 535);
    this.buyButtonBg = this.add.graphics();
    this.buyButtonLabel = this.add.text(0, 0, "Buy 1 Key", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "800",
      color: "#3a2609",
    }).setOrigin(0.5);
    this.buyButton.add([this.buyButtonBg, this.buyButtonLabel]);
    this.buyButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-171, -25, 342, 50),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.buyButtonBg, {
      targets: this.buyButton,
      pressScale: 0.96,
      enabled: () => this.canBuy(),
      onPress: () => this.dispatch("buyKeys", this.selectedKeyCount),
    });

    this.settleButton = this.add.container(333, 535);
    this.settleButtonBg = this.add.graphics();
    this.settleButtonLabel = this.add.text(0, 0, "Settle", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "800",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.settleButton.add([this.settleButtonBg, this.settleButtonLabel]);
    this.settleButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-61, -25, 122, 50),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.settleButtonBg, {
      targets: this.settleButton,
      pressScale: 0.96,
      enabled: () => this.canSettle(),
      onPress: () => this.dispatch("settleRound"),
    });

    this.noticeText = this.add.text(W / 2, H - 14, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#806f56",
    }).setOrigin(0.5);
  }

  private buildStatus(W: number, _H: number): void {
    this.statusText = this.add.text(W / 2, 491, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
      align: "center",
      wordWrap: { width: W - 80 },
    }).setOrigin(0.5);
  }

  private makePresetView(x: number, y: number, value: string): PresetView {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const label = this.add.text(0, -5, value, {
      fontFamily: FONT,
      fontSize: "20px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);
    const hint = this.add.text(0, 17, Number(value) === 1 ? "key" : "keys", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#806f56",
    }).setOrigin(0.5);

    bg.setInteractive(new Phaser.Geom.Rectangle(-34, -30, 68, 60), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: container,
      pressScale: 0.94,
      onPress: () => this.selectKeyCount(value),
    });

    container.add([bg, label, hint]);
    return { value, container, bg, label, hint };
  }

  private selectKeyCount(value: string): void {
    if (this.selectedKeyCount === value) return;
    this.selectedKeyCount = value;
    this.renderPresets();
    this.renderButtons();
    this.dispatch("setKeyCount", value);
  }

  private renderPresets(): void {
    for (const view of this.presetViews) {
      const active = view.value === this.selectedKeyCount;
      view.bg.clear();
      view.bg.fillStyle(active ? C.surfaceWarm : C.surface, 1);
      view.bg.fillRoundedRect(-34, -30, 68, 60, 16);
      view.bg.lineStyle(active ? 2 : 1, active ? C.strokeStrong : C.stroke, 1);
      view.bg.strokeRoundedRect(-34, -30, 68, 60, 16);
      view.label.setColor(active ? "#2b2418" : "#604d35");
      view.hint.setColor(active ? "#b87917" : "#806f56");
    }
  }

  private renderButtons(): void {
    const canBuy = this.canBuy();
    const canSettle = this.canSettle();
    const isBuying = this.bool("isBuyingKeys");
    const isSettling = this.bool("isSettling");
    const showSettle = this.bool("needsLifecycleSync");
    const buyWidth = showSettle ? 236 : 342;
    const buyHalf = buyWidth / 2;

    this.buyButton.setPosition(showSettle ? 145 : 210, 535);
    this.buyButtonBg.setInteractive(
      new Phaser.Geom.Rectangle(-buyHalf, -25, buyWidth, 50),
      Phaser.Geom.Rectangle.Contains,
    );

    this.buyButtonBg.clear();
    this.buyButtonBg.fillStyle(canBuy ? C.gold : C.disabled, 1);
    this.buyButtonBg.fillRoundedRect(-buyHalf, -25, buyWidth, 50, 16);
    this.buyButtonBg.lineStyle(2, canBuy ? C.goldDeep : C.stroke, 0.8);
    this.buyButtonBg.strokeRoundedRect(-buyHalf, -25, buyWidth, 50, 16);
    if (canBuy) {
      this.buyButtonBg.fillStyle(0xffffff, 0.18);
      this.buyButtonBg.fillRoundedRect(-buyHalf, -25, buyWidth, 18, { tl: 16, tr: 16, bl: 0, br: 0 });
    }
    this.buyButtonLabel.setText(
      isBuying
        ? "Buying..."
        : `Buy ${this.selectedKeyCount} key${this.selectedKeyCount === "1" ? "" : "s"}`,
    );
    this.buyButtonLabel.setColor(canBuy ? "#3a2609" : "#806f56");

    this.settleButton.setVisible(showSettle);
    this.settleButtonBg.clear();
    this.settleButtonBg.fillStyle(canSettle ? C.green : C.disabled, 1);
    this.settleButtonBg.fillRoundedRect(-61, -25, 122, 50, 16);
    this.settleButtonBg.lineStyle(2, canSettle ? 0x0c8150 : C.stroke, 0.8);
    this.settleButtonBg.strokeRoundedRect(-61, -25, 122, 50, 16);
    this.settleButtonLabel.setText(isSettling ? "Settling..." : "Settle");
    this.settleButtonLabel.setColor(canSettle ? "#ffffff" : "#806f56");
  }

  private renderDanger(dangerPct: number): void {
    if (!this.dangerRing) return;
    const { width: W } = this.scale;
    const cx = W / 2;
    const cy = 285;
    const radius = 44;
    const pct = Phaser.Math.Clamp(dangerPct / 100, 0, 1);
    const dangerColor = pct > 0.72 ? C.red : pct > 0.42 ? C.orange : C.green;

    this.dangerRing.clear();
    this.dangerRing.lineStyle(9, 0xf2e2c2, 1);
    this.dangerRing.strokeCircle(cx, cy - 7, radius);
    this.dangerRing.lineStyle(9, dangerColor, 0.88);
    this.dangerRing.beginPath();
    this.dangerRing.arc(cx, cy - 7, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + pct * 360), false);
    this.dangerRing.strokePath();

    if (this.dangerFill) {
      this.dangerFill.setFillStyle(dangerColor);
      this.dangerFill.setDisplaySize((W - 128) * pct, 6);
    }
  }

  private canBuy(): boolean {
    return (
      this.bool("roundDataAvailable") &&
      this.bool("isRoundActive") &&
      !this.bool("needsLifecycleSync") &&
      !this.bool("isBuyingKeys") &&
      !this.bool("isSettling")
    );
  }

  private canSettle(): boolean {
    return this.bool("needsLifecycleSync") && !this.bool("isSettling") && !this.bool("isBuyingKeys");
  }

  private startAmbientMotion(): void {
    if (this.reducedMotion) return;
    this.animate({
      targets: this.heroContainer,
      y: this.heroContainer.y - 4,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.animate({
      targets: this.heroImage,
      scaleX: this.heroImage.scaleX * 1.025,
      scaleY: this.heroImage.scaleY * 1.025,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    for (const [index, token] of this.orbitTokens.entries()) {
      this.animate({
        targets: token,
        y: token.y - 3,
        duration: 1200 + index * 140,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private playBuyMotion(): void {
    this.pressFeedback(this.buyButton, { scale: 0.94, duration: 120 });
    this.animate({
      targets: this.countdownText,
      scale: 1.07,
      duration: 140,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  private playSettleMotion(): void {
    this.pressFeedback(this.settleButton, { scale: 0.94, duration: 120 });
    this.animate({
      targets: this.heroContainer,
      scale: 1.025,
      duration: 180,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }
}
