/**
 * GasLuckyPoolScene - Phaser 3 OneGate Vault surface.
 *
 * Chain/backend behavior stays in useGasLuckyPool/main.tsx. This scene owns the
 * consumer-facing vault interaction: choose a reward pack, fund it, or claim an
 * existing OneGate reward link.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";
import { formatGas } from "@shared/utils/format";

const GAS_POOL_ASSETS = {
  vaultStage: "gas-pool-vault-stage",
  gasIcon: "gas-pool-gas-icon",
} as const;

const C = {
  canvas: 0xfffbef,
  surface: 0xffffff,
  stroke: 0xead7ad,
  strokeStrong: 0xeab84d,
  ink: 0x2a2117,
  green: 0x16a86b,
  gold: 0xf5b640,
  goldDeep: 0xb77915,
  red: 0xd84d3f,
  disabled: 0xd8cdb9,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const MODE_BUTTON_W = 134;
const MODE_BUTTON_H = 34;

type Mode = "create" | "claim";

const REWARD_PLANS = [
  {
    key: "small",
    title: "Starter",
    amount: "20",
    minClaim: "1",
    maxClaim: "3",
    maxClaims: "10",
    expiryHours: "24",
  },
  {
    key: "balanced",
    title: "Party",
    amount: "50",
    minClaim: "1",
    maxClaim: "5",
    maxClaims: "25",
    expiryHours: "72",
  },
  {
    key: "jackpot",
    title: "Jackpot",
    amount: "100",
    minClaim: "5",
    maxClaim: "20",
    maxClaims: "10",
    expiryHours: "168",
  },
] as const;

const PROGRESS_LABEL: Record<string, string> = {
  wallet: "Wallet ready",
  submitted: "Submitted",
  submitting: "Submitting claim",
  confirming: "Confirming on chain",
  paid: "GAS received",
  failed: "Needs retry",
};

function truncateMiddle(value: string, head = 7, tail = 4): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

function compactError(value: string): string {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > 58 ? `${firstLine.slice(0, 55)}...` : firstLine;
}

export class GasLuckyPoolScene extends BaseScene {
  private heroImage!: Phaser.GameObjects.Image;
  private vaultGlow!: Phaser.GameObjects.Ellipse;
  private coinStream: Phaser.GameObjects.Container[] = [];

  private createPanel!: Phaser.GameObjects.Container;
  private claimPanel!: Phaser.GameObjects.Container;
  private modeButtons = new Map<Mode, Phaser.GameObjects.Container>();
  private planCards: Phaser.GameObjects.Container[] = [];

  private resultPill!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private createSummaryText!: Phaser.GameObjects.Text;
  private claimKeyText!: Phaser.GameObjects.Text;
  private claimRangeText!: Phaser.GameObjects.Text;
  private claimProgressText!: Phaser.GameObjects.Text;

  private createButton!: Phaser.GameObjects.Container;
  private createButtonBg!: Phaser.GameObjects.Graphics;
  private createButtonLabel!: Phaser.GameObjects.Text;
  private claimButton!: Phaser.GameObjects.Container;
  private claimButtonBg!: Phaser.GameObjects.Graphics;
  private claimButtonLabel!: Phaser.GameObjects.Text;
  private checkButton!: Phaser.GameObjects.Container;
  private checkButtonBg!: Phaser.GameObjects.Graphics;
  private checkButtonLabel!: Phaser.GameObjects.Text;

  private activeMode: Mode = "create";
  private selectedPlanIndex = 1;
  private hasClaimContext = false;
  private hasClaimKey = false;
  private busy = false;
  private autoSelectedMode = false;
  private lastRewardText = "";

  constructor() {
    super("GasLuckyPoolScene");
  }

  preload(): void {
    this.load.image(GAS_POOL_ASSETS.vaultStage, "./gas-vault-stage.webp");
    this.load.image(GAS_POOL_ASSETS.gasIcon, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;

    this.buildBackground(W, H);
    this.buildHero(W);
    this.buildResultPill(W);
    this.buildModeTabs(W);
    this.buildCreatePanel(W);
    this.buildClaimPanel(W);
    this.buildStatus(W, H);
    this.switchMode("create");
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const claimKey = this.str("currentClaimKey", "");
    const poolId = this.str("currentPoolId", "");
    const range = this.str("currentRange", "1-5 GAS");
    const progress = this.str("claimProgress", "");
    const status = this.str("claimStatus", "");
    const lastStatus = this.str("lastStatus", "");
    const lastError = this.str("lastError", "");
    const lastTxid = this.str("lastTxid", "");
    const amount = this.str("lastClaimAmount", "0");
    const luck = this.str("lastClaimLuckPercent", "");

    this.hasClaimContext = Boolean(claimKey || poolId);
    this.hasClaimKey = Boolean(claimKey);
    this.busy = this.bool("isLoading") || this.bool("isCreating") || this.bool("isClaiming");

    if (!this.autoSelectedMode) {
      this.autoSelectedMode = true;
      this.switchMode(this.hasClaimContext ? "claim" : "create");
    }

    const rewardText = amount && amount !== "0" ? `+${formatGas(amount, 4)} GAS` : "";
    this.resultText.setText(
      rewardText ? `${rewardText}${luck ? `  ${luck}% luck` : ""}` : "Pack a vault. Share a claim. Let GAS land.",
    );
    this.setResultState(Boolean(rewardText), Boolean(lastError));

    this.claimKeyText.setText(
      claimKey
        ? truncateMiddle(claimKey)
        : poolId
          ? `Pool #${poolId}`
          : "Open a OneGate claim link",
    );
    this.claimRangeText.setText(range || "Reward range updates after loading");
    this.claimProgressText.setText(PROGRESS_LABEL[progress] ?? PROGRESS_LABEL[status] ?? "Ready to unwrap");

    this.statusText.setText(
      compactError(lastError) ||
        (lastTxid ? `Latest tx ${truncateMiddle(lastTxid, 8, 6)}` : "") ||
        lastStatus ||
        "OneGate-ready GAS reward vault",
    );

    this.updateButtons();
    this.updateCoinMotion();

    if (rewardText && rewardText !== this.lastRewardText) {
      this.lastRewardText = rewardText;
      this.spawnRewardBurst();
    }
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusText.setText(compactError(error.message) || "The vault action could not be completed.");
    this.setResultState(false, true);
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const topGlow = this.add.ellipse(W / 2, 112, 390, 250, 0xffe1a3, 0.34);
    const lowerGlow = this.add.ellipse(W / 2, 360, 380, 260, 0xd8f6df, 0.22);
    this.animate({
      targets: [topGlow, lowerGlow],
      alpha: { from: 0.24, to: 0.42 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const frame = this.add.graphics();
    frame.lineStyle(2, C.stroke, 0.72);
    frame.strokeRoundedRect(10, 10, W - 20, H - 20, 26);
  }

  private buildHero(W: number): void {
    this.vaultGlow = this.add.ellipse(W / 2, 142, 286, 170, C.gold, 0.18);
    this.heroImage = this.add.image(W / 2, 144, GAS_POOL_ASSETS.vaultStage)
      .setDisplaySize(360, 238)
      .setOrigin(0.5);

    this.animate({
      targets: this.vaultGlow,
      scaleX: { from: 1, to: 1.08 },
      scaleY: { from: 1, to: 1.08 },
      alpha: { from: 0.15, to: 0.26 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    for (let i = 0; i < 5; i += 1) {
      const coin = this.makeGasBadge(W / 2 + (i - 2) * 34, 206 + (i % 2) * 10, 26)
        .setAlpha(0.82);
      this.coinStream.push(coin);
      this.animate({
        targets: coin,
        y: coin.y - 8,
        angle: i % 2 === 0 ? 8 : -8,
        duration: 1200 + i * 90,
        delay: i * 80,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private makeGasBadge(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const badge = this.add.container(x, y);
    const coin = this.add.graphics();
    coin.fillStyle(0xffcf63, 0.98);
    coin.fillCircle(0, 0, size / 2);
    coin.fillStyle(0xffffff, 0.24);
    coin.fillCircle(-size * 0.14, -size * 0.16, size * 0.17);
    coin.lineStyle(Math.max(1.2, size * 0.08), 0xbf8220, 0.58);
    coin.strokeCircle(0, 0, size / 2 - 1);
    const mark = this.add.image(0, 0, GAS_POOL_ASSETS.gasIcon)
      .setDisplaySize(size * 0.58, size * 0.58)
      .setOrigin(0.5);
    badge.add([coin, mark]);
    return badge;
  }

  private buildResultPill(W: number): void {
    this.resultPill = this.add.container(W / 2, 268);
    const bg = this.add.graphics();
    bg.fillStyle(C.surface, 0.94);
    bg.fillRoundedRect(-165, -22, 330, 44, 22);
    bg.lineStyle(1, C.stroke, 0.86);
    bg.strokeRoundedRect(-165, -22, 330, 44, 22);

    const icon = this.makeGasBadge(-140, 0, 28);
    this.resultText = this.add.text(-108, 0, "", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#6f5a37",
      fontStyle: "500",
      fixedWidth: 242,
    }).setOrigin(0, 0.5);

    this.resultPill.add([bg, icon, this.resultText]);
    this.resultPill.setData("bg", bg);
  }

  private setResultState(success: boolean, error: boolean): void {
    const bg = this.resultPill.getData("bg") as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(success ? 0xf0fff3 : error ? 0xfff1ec : C.surface, 0.96);
    bg.fillRoundedRect(-165, -22, 330, 44, 22);
    bg.lineStyle(1, success ? C.green : error ? C.red : C.stroke, 0.9);
    bg.strokeRoundedRect(-165, -22, 330, 44, 22);
    this.resultText.setColor(success ? "#0f7d56" : error ? "#a83a2d" : "#6f5a37");
  }

  private buildModeTabs(W: number): void {
    const y = 315;
    this.makeModeButton(W / 2 - 72, y, "create", "Fund vault");
    this.makeModeButton(W / 2 + 72, y, "claim", "Claim GAS");
  }

  private makeModeButton(x: number, y: number, mode: Mode, label: string): void {
    const button = this.add.container(x, y);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#6f5a37",
      fontStyle: "600",
    }).setOrigin(0.5);

    bg.setInteractive(
      new Phaser.Geom.Rectangle(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(bg, {
      targets: button,
      pressScale: 0.97,
      onPress: () => this.switchMode(mode),
    });

    button.add([bg, text]);
    button.setData("bg", bg);
    button.setData("text", text);
    this.modeButtons.set(mode, button);
  }

  private switchMode(mode: Mode): void {
    this.activeMode = mode;
    this.createPanel?.setVisible(mode === "create");
    this.claimPanel?.setVisible(mode === "claim");

    for (const [key, button] of this.modeButtons) {
      const active = key === mode;
      const bg = button.getData("bg") as Phaser.GameObjects.Graphics;
      const text = button.getData("text") as Phaser.GameObjects.Text;
      bg.clear();
      bg.fillStyle(active ? C.ink : C.surface, active ? 1 : 0.94);
      bg.fillRoundedRect(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H, 17);
      bg.lineStyle(1, active ? C.ink : C.stroke, 0.95);
      bg.strokeRoundedRect(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H, 17);
      text.setColor(active ? "#fff6df" : "#6f5a37");
    }
  }

  private buildCreatePanel(W: number): void {
    this.createPanel = this.add.container(0, 0);
    this.createPanel.add(
      this.add.text(W / 2, 355, "Choose a reward pack", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#2a2117",
        fontStyle: "600",
      }).setOrigin(0.5),
    );

    REWARD_PLANS.forEach((_, index) => {
      const card = this.makePlanCard(70 + index * 140, 415, index);
      this.planCards.push(card);
      this.createPanel.add(card);
    });

    this.createSummaryText = this.add.text(W / 2, 496, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a623a",
      fixedWidth: 330,
      align: "center",
    }).setOrigin(0.5);
    this.createPanel.add(this.createSummaryText);

    this.createButton = this.makeActionButton(W / 2, 535, "Pack vault", "primary");
    this.createButtonBg = this.createButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.createButtonLabel = this.createButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.createButtonBg, {
      targets: this.createButton,
      enabled: () => !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchCreate(),
    });
    this.createPanel.add(this.createButton);

    this.selectPlan(this.selectedPlanIndex, false);
  }

  private makePlanCard(x: number, y: number, index: number): Phaser.GameObjects.Container {
    const plan = REWARD_PLANS[index]!;
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.setInteractive(new Phaser.Geom.Rectangle(-56, -48, 112, 96), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: card,
      pressScale: 0.96,
      onPress: () => this.selectPlan(index, true),
    });

    const title = this.add.text(0, -30, plan.title, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#6f5a37",
      fontStyle: "600",
    }).setOrigin(0.5);
    const amount = this.add.text(0, -4, `${plan.amount}`, {
      fontFamily: FONT,
      fontSize: "21px",
      color: "#2a2117",
      fontStyle: "600",
    }).setOrigin(0.5);
    const gas = this.add.text(0, 17, "GAS", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#a18455",
      fontStyle: "600",
      letterSpacing: 1,
    }).setOrigin(0.5);
    const detail = this.add.text(0, 34, `${plan.maxClaims} claims`, {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#7a623a",
    }).setOrigin(0.5);

    card.add([bg, title, amount, gas, detail]);
    card.setData("bg", bg);
    card.setData("title", title);
    card.setData("amount", amount);
    return card;
  }

  private selectPlan(index: number, animate: boolean): void {
    this.selectedPlanIndex = index;
    this.planCards.forEach((card, cardIndex) => this.renderPlanCard(card, cardIndex === index));

    const plan = REWARD_PLANS[index]!;
    this.createSummaryText?.setText(
      `${plan.maxClaims} claims - ${plan.minClaim}-${plan.maxClaim} GAS each - ${plan.expiryHours}h expiry`,
    );
    if (animate) {
      this.animate({
        targets: this.vaultGlow,
        alpha: { from: 0.3, to: 0.18 },
        duration: 180,
        ease: "Sine.easeOut",
      });
    }
  }

  private renderPlanCard(card: Phaser.GameObjects.Container, active: boolean): void {
    const bg = card.getData("bg") as Phaser.GameObjects.Graphics;
    const title = card.getData("title") as Phaser.GameObjects.Text;
    const amount = card.getData("amount") as Phaser.GameObjects.Text;

    bg.clear();
    bg.fillStyle(active ? 0xfff1c9 : C.surface, active ? 1 : 0.96);
    bg.fillRoundedRect(-56, -48, 112, 96, 18);
    bg.lineStyle(active ? 2 : 1, active ? C.strokeStrong : C.stroke, 0.96);
    bg.strokeRoundedRect(-56, -48, 112, 96, 18);
    title.setColor(active ? "#8a5b06" : "#6f5a37");
    amount.setColor(active ? "#8a5b06" : "#2a2117");
  }

  private dispatchCreate(): void {
    const plan = REWARD_PLANS[this.selectedPlanIndex]!;
    this.dispatch("createPool", {
      totalAmount: plan.amount,
      minClaim: plan.minClaim,
      maxClaim: plan.maxClaim,
      maxClaims: plan.maxClaims,
      expiryHours: plan.expiryHours,
    });
  }

  private buildClaimPanel(W: number): void {
    this.claimPanel = this.add.container(0, 0);
    this.claimPanel.add(
      this.add.text(W / 2, 356, "Unwrap your reward", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#2a2117",
        fontStyle: "600",
      }).setOrigin(0.5),
    );

    const ticket = this.add.container(W / 2, 421);
    const ticketBg = this.add.graphics();
    ticketBg.fillStyle(C.surface, 0.97);
    ticketBg.fillRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.95);
    ticketBg.strokeRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.5);
    ticketBg.lineBetween(-118, -48, -118, 48);
    ticketBg.lineBetween(118, -48, 118, 48);

    const coin = this.makeGasBadge(-124, -15, 36);
    this.claimKeyText = this.add.text(-78, -19, "", {
      fontFamily: FONT,
      fontSize: "17px",
      color: "#2a2117",
      fontStyle: "600",
      fixedWidth: 188,
    }).setOrigin(0, 0.5);
    this.claimRangeText = this.add.text(-78, 9, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a623a",
      fixedWidth: 205,
    }).setOrigin(0, 0.5);
    this.claimProgressText = this.add.text(-78, 30, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#0f7d56",
      fixedWidth: 205,
    }).setOrigin(0, 0.5);

    ticket.add([ticketBg, coin, this.claimKeyText, this.claimRangeText, this.claimProgressText]);
    this.claimPanel.add(ticket);

    this.checkButton = this.makeActionButton(W / 2 - 72, 515, "Check", "secondary", 122);
    this.checkButtonBg = this.checkButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.checkButtonLabel = this.checkButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.checkButtonBg, {
      targets: this.checkButton,
      enabled: () => this.hasClaimKey && !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchCheckClaim(),
    });

    this.claimButton = this.makeActionButton(W / 2 + 76, 515, "Claim", "primary", 154);
    this.claimButtonBg = this.claimButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.claimButtonLabel = this.claimButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.claimButtonBg, {
      targets: this.claimButton,
      enabled: () => this.hasClaimContext && !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchClaim(),
    });

    this.claimPanel.add([this.checkButton, this.claimButton]);
    this.claimPanel.setVisible(false);
  }

  private makeActionButton(
    x: number,
    y: number,
    label: string,
    tone: "primary" | "secondary",
    width = 224,
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: "13px",
      color: tone === "primary" ? "#2a2117" : "#6f5a37",
      fontStyle: "600",
    }).setOrigin(0.5);

    bg.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -21, width, 42), Phaser.Geom.Rectangle.Contains);
    button.add([bg, text]);
    button.setData("bg", bg);
    button.setData("label", text);
    button.setData("tone", tone);
    button.setData("width", width);
    this.renderActionButton(button, true);
    return button;
  }

  private renderActionButton(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = button.getData("bg") as Phaser.GameObjects.Graphics;
    const label = button.getData("label") as Phaser.GameObjects.Text;
    const tone = button.getData("tone") as "primary" | "secondary";
    const width = button.getData("width") as number;

    bg.clear();
    if (!enabled) {
      bg.fillStyle(C.disabled, 0.92);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.lineStyle(1, C.disabled, 1);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#8f826f");
      button.setAlpha(0.8);
      return;
    }

    if (tone === "primary") {
      bg.fillStyle(C.gold);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.fillStyle(C.white, 0.2);
      bg.fillRoundedRect(-width / 2 + 3, -18, width - 6, 17, 17);
      bg.lineStyle(1, C.goldDeep, 0.55);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#2a2117");
    } else {
      bg.fillStyle(C.surface, 0.98);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.lineStyle(1, C.strokeStrong, 0.72);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#6f5a37");
    }
    button.setAlpha(1);
  }

  private updateButtons(): void {
    const createEnabled = !this.busy;
    const claimEnabled = this.hasClaimContext && !this.busy;
    const checkEnabled = this.hasClaimKey && !this.busy;
    if (this.createButton) {
      this.createButtonLabel.setText(this.busy ? "Working..." : "Pack vault");
      this.renderActionButton(this.createButton, createEnabled);
    }
    if (this.claimButton) {
      this.claimButtonLabel.setText(this.busy ? "Claiming..." : this.hasClaimContext ? "Claim" : "No link");
      this.renderActionButton(this.claimButton, claimEnabled);
    }
    if (this.checkButton) {
      this.checkButtonLabel.setText(this.busy ? "Wait" : "Check");
      this.renderActionButton(this.checkButton, checkEnabled);
    }
  }

  private dispatchClaim(): void {
    const claimKey = this.str("currentClaimKey", "");
    const poolId = this.str("currentPoolId", "");
    if (!claimKey && !poolId) return;
    this.dispatch("claimPool", {
      claimKey: claimKey || undefined,
      poolId: poolId || undefined,
      appId: "miniapp-gas-lucky-pool",
    });
  }

  private dispatchCheckClaim(): void {
    const claimKey = this.str("currentClaimKey", "");
    if (!claimKey) return;
    this.dispatch("checkClaimStatus", { claimKey });
  }

  private buildStatus(W: number, H: number): void {
    this.statusText = this.add.text(W / 2, H - 22, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#7a623a",
      fixedWidth: 340,
      align: "center",
    }).setOrigin(0.5);
  }

  private updateCoinMotion(): void {
    this.coinStream.forEach((coin, index) => {
      const active = this.busy || this.activeMode === "claim";
      coin.setAlpha(active ? 1 : 0.76);
      if (!active) return;
      coin.setRotation(Phaser.Math.DegToRad((this.time.now / 28 + index * 36) % 360));
    });
  }

  private spawnRewardBurst(): void {
    const { width: W } = this.scale;
    for (let i = 0; i < 16; i += 1) {
      const coin = this.makeGasBadge(W / 2, 248, 24)
        .setAlpha(0.95);
      this.animate({
        targets: coin,
        x: W / 2 + Phaser.Math.Between(-145, 145),
        y: 118 + Phaser.Math.Between(-18, 110),
        angle: Phaser.Math.Between(-220, 220),
        alpha: { from: 1, to: 0 },
        duration: 900 + i * 22,
        delay: i * 35,
        ease: "Cubic.easeOut",
        onComplete: () => coin.destroy(),
      });
    }
    this.animate({
      targets: this.resultPill,
      scaleX: { from: 1.03, to: 1 },
      scaleY: { from: 1.03, to: 1 },
      duration: 260,
      ease: "Back.easeOut",
    });
  }
}
