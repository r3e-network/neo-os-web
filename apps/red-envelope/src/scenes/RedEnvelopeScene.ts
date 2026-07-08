/**
 * RedEnvelopeScene - Phaser 3 red-envelope reward game.
 *
 * Contract and wallet behavior stays in useRedEnvelope/main.tsx. This scene owns
 * the playable surface: select a festive packet bundle, create it, share it, or
 * open a claimable envelope.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";

const REDENV_ASSETS = {
  stage: "redenv-stage",
  claimCard: "redenv-claim-card",
  gasIcon: "redenv-gas-icon",
} as const;

const C = {
  canvas: 0xfffbf1,
  surface: 0xffffff,
  stroke: 0xf0d6ad,
  strokeStrong: 0xf4b94d,
  ink: 0x2e2116,
  gold: 0xf5bd43,
  goldDeep: 0xb47618,
  danger: 0xc24132,
  disabled: 0xd9cbb7,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const MODE_BUTTON_W = 132;
const MODE_BUTTON_H = 34;
const DESIGN_W = 420;
const DESIGN_H = 580;

type Mode = "send" | "claim";

type EnvelopePreview = {
  id?: string | number;
  remainingPackets?: number;
  remainingAmount?: number;
  totalAmount?: number;
  amount?: number;
  canOpen?: boolean;
  active?: boolean;
  expired?: boolean;
  depleted?: boolean;
};

const ENVELOPE_PLANS = [
  { key: "lucky", title: "Lucky 8", amount: "1", count: "8", expiryHours: "24" },
  { key: "party", title: "Party 20", amount: "5", count: "20", expiryHours: "72" },
  { key: "festival", title: "Festival 50", amount: "10", count: "50", expiryHours: "168" },
] as const;

function fmtGas(value: unknown, decimals = 4): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

function asEnvelopeId(value: unknown): string {
  const id = String(value ?? "").trim();
  return id && id !== "0" ? id : "";
}

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

export class RedEnvelopeScene extends BaseScene {
  private heroContainer!: Phaser.GameObjects.Container;
  private heroImage!: Phaser.GameObjects.Image;
  private heroGlow!: Phaser.GameObjects.Ellipse;
  private sceneBackdrop!: Phaser.GameObjects.Rectangle;
  private sceneFrame!: Phaser.GameObjects.Graphics;
  private tallStageDock!: Phaser.GameObjects.Graphics;
  private tallStageCoins: Phaser.GameObjects.Container[] = [];
  private floatingCoins: Phaser.GameObjects.Container[] = [];

  private modeButtons = new Map<Mode, Phaser.GameObjects.Container>();
  private sendPanel!: Phaser.GameObjects.Container;
  private claimPanel!: Phaser.GameObjects.Container;
  private planCards: Phaser.GameObjects.Container[] = [];

  private resultPill!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private sendSummaryText!: Phaser.GameObjects.Text;
  private activeEnvelopeText!: Phaser.GameObjects.Text;
  private claimMetaText!: Phaser.GameObjects.Text;

  private createButton!: Phaser.GameObjects.Container;
  private createButtonBg!: Phaser.GameObjects.Graphics;
  private createButtonLabel!: Phaser.GameObjects.Text;
  private shareButton!: Phaser.GameObjects.Container;
  private shareButtonBg!: Phaser.GameObjects.Graphics;
  private shareButtonLabel!: Phaser.GameObjects.Text;
  private claimButton!: Phaser.GameObjects.Container;
  private claimButtonBg!: Phaser.GameObjects.Graphics;
  private claimButtonLabel!: Phaser.GameObjects.Text;

  private activeMode: Mode = "claim";
  private selectedPlanIndex = 0;
  private activeEnvelopeId = "";
  private lastCreatedEnvelopeId = "";
  private busy = false;
  private autoSelectedMode = false;
  private lastWinAmount = "";

  constructor() {
    super("RedEnvelopeScene");
  }

  preload(): void {
    this.load.image(REDENV_ASSETS.stage, "./red-envelope-stage.webp");
    this.load.image(REDENV_ASSETS.claimCard, "./red-envelope-claim-card.webp");
    this.load.image(REDENV_ASSETS.gasIcon, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();

    this.input.on("pointerdown", () => this.sfx.unlock());
    this.buildBackground(DESIGN_W, DESIGN_H);
    this.buildHero(DESIGN_W);
    this.buildResultPill(DESIGN_W);
    this.buildModeTabs(DESIGN_W);
    this.buildSendPanel(DESIGN_W);
    this.buildClaimPanel(DESIGN_W);
    this.buildStatus(DESIGN_W, DESIGN_H);
    this.switchMode("claim");
    this.fitCameraToHost();
    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onStateUpdate(_state: GameState): void {
    const openingId = asEnvelopeId(this.val<string | null>("openingId", null));
    const lucky = this.val<{ amount?: number; from?: string } | null>("luckyMessage", null);
    const envelopes = this.val<EnvelopePreview[]>("envelopes", []) ?? [];
    const pools = this.val<EnvelopePreview[]>("pools", []) ?? [];
    const lastCreated = asEnvelopeId(this.str("lastCreatedEnvelopeId", ""));
    const lastError = this.str("lastError", "");
    const serviceNotice = this.str("serviceNotice", "");
    const credit = this.num("prepaidCredit", 0);

    this.busy = this.bool("isLoading") || this.bool("isCreating") || Boolean(openingId);
    this.lastCreatedEnvelopeId = lastCreated;
    this.activeEnvelopeId = openingId || this.pickClaimEnvelopeId(pools, envelopes);

    if (!this.autoSelectedMode) {
      this.autoSelectedMode = true;
      this.switchMode("claim");
    }

    if (this.activeMode === "claim") this.heroImage.setTexture(REDENV_ASSETS.claimCard);
    else this.heroImage.setTexture(REDENV_ASSETS.stage);

    const wonAmount = lucky?.amount && lucky.amount > 0 ? fmtGas(lucky.amount) : "";
    this.updateResultPillCopy(lucky, lastCreated, lastError);

    this.activeEnvelopeText.setText(
      this.activeEnvelopeId ? `Envelope #${truncateMiddle(this.activeEnvelopeId, 8, 4)}` : "Open a claim link",
    );
    this.claimMetaText.setText(this.claimMeta(pools, envelopes));

    this.updateStatusCopy(lastError, serviceNotice, credit);

    this.updateButtons();
    this.updateHeroMotion(Boolean(openingId));

    if (wonAmount && wonAmount !== this.lastWinAmount) {
      this.lastWinAmount = wonAmount;
      this.sfx.play((lucky?.amount ?? 0) >= 1 ? "win" : "score");
      this.spawnRewardBurst();
    }
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.sfx.play("error");
    this.statusText.setText(compactError(error.message) || "The envelope action could not be completed.");
    this.setResultState(false, true);
  }

  private pickClaimEnvelopeId(...lists: EnvelopePreview[][]): string {
    const merged = lists.flat().filter(Boolean);
    const claimable = merged.find((item) => {
      const id = asEnvelopeId(item.id);
      if (!id) return false;
      if (item.canOpen === true) return true;
      return item.active !== false && item.expired !== true && item.depleted !== true;
    });
    return asEnvelopeId(claimable?.id ?? merged[0]?.id);
  }

  private claimMeta(...lists: EnvelopePreview[][]): string {
    const target = lists.flat().find((item) => asEnvelopeId(item.id) === this.activeEnvelopeId);
    if (!target) return this.activeEnvelopeId ? "Ready to open with your wallet" : "Use a shared envelope link to claim.";
    const packets = Number(target.remainingPackets ?? 0);
    const amount = Number(target.remainingAmount ?? target.totalAmount ?? target.amount ?? 0);
    const packetText = packets > 0 ? `${packets} packets left` : "Packet status ready";
    const amountText = amount > 0 ? `${fmtGas(amount)} GAS left` : "Random amount";
    return `${packetText} - ${amountText}`;
  }

  private buildBackground(W: number, H: number): void {
    this.sceneBackdrop = this.add.rectangle(W / 2, H / 2, W, H, C.canvas);
    const glowTop = this.add.ellipse(W / 2, 132, 390, 252, 0xffdf9e, 0.28);
    const glowBottom = this.add.ellipse(W / 2, 376, 360, 240, 0xfff2d3, 0.32);
    this.animate({
      targets: [glowTop, glowBottom],
      alpha: { from: 0.22, to: 0.4 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tallStageDock = this.add.graphics();
    for (let i = 0; i < 6; i += 1) {
      const coin = this.makeGasBadge(58 + i * 61, H + 34 + (i % 2) * 14, 22)
        .setAlpha(0.32);
      this.tallStageCoins.push(coin);
      if (!this.reducedMotion) {
        this.animate({
          targets: coin,
          y: coin.y - 5,
          angle: i % 2 === 0 ? 7 : -7,
          duration: 1500 + i * 90,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    this.sceneFrame = this.add.graphics();
    this.renderResponsiveStage(H, H / 2);
  }

  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.sceneBackdrop || !this.sceneFrame || !this.tallStageDock) return;

    const viewBottom = centerY + visibleWorldH / 2;
    const stageBottom = Math.max(DESIGN_H, Math.min(viewBottom + 10, DESIGN_H + 165));
    const dockTop = DESIGN_H - 8;
    const dockHeight = Math.max(0, stageBottom - dockTop);
    const hasTallDock = dockHeight > 24;

    this.sceneBackdrop
      .setPosition(DESIGN_W / 2, stageBottom / 2)
      .setDisplaySize(DESIGN_W, stageBottom);

    this.tallStageDock.clear();
    this.tallStageDock.setVisible(hasTallDock);
    for (const coin of this.tallStageCoins) coin.setVisible(hasTallDock);

    if (hasTallDock) {
      this.tallStageDock.fillStyle(0xfff4da, 0.78);
      this.tallStageDock.fillRoundedRect(18, dockTop, DESIGN_W - 36, dockHeight + 18, {
        tl: 22,
        tr: 22,
        bl: 0,
        br: 0,
      });
      this.tallStageDock.lineStyle(1, 0xf2d2a1, 0.7);
      this.tallStageDock.lineBetween(38, dockTop + 26, DESIGN_W - 38, dockTop + 26);
      this.tallStageDock.lineStyle(1, 0xf5ddb5, 0.46);
      for (let x = 54; x < DESIGN_W - 24; x += 46) {
        this.tallStageDock.lineBetween(x, dockTop + 50, x + 28, stageBottom - 18);
      }

      const coinY = Math.min(stageBottom - 34, dockTop + 46);
      this.tallStageCoins.forEach((coin, index) => {
        coin.setPosition(58 + index * 61, coinY + (index % 2) * 13);
      });
    }

    this.sceneFrame.clear();
    this.sceneFrame.lineStyle(2, C.stroke, 0.82);
    this.sceneFrame.strokeRoundedRect(10, 10, DESIGN_W - 20, stageBottom - 20, 26);
  }

  private buildHero(W: number): void {
    this.heroGlow = this.add.ellipse(W / 2, 132, 278, 166, C.gold, 0.2);
    this.heroContainer = this.add.container(W / 2, 138);
    this.heroImage = this.add.image(0, 0, REDENV_ASSETS.stage)
      .setDisplaySize(390, 220)
      .setOrigin(0.5);
    this.heroContainer.add(this.heroImage);

    this.animate({
      targets: this.heroContainer,
      y: 132,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    for (let i = 0; i < 5; i += 1) {
      const coin = this.makeGasBadge(W / 2 + (i - 2) * 35, 220 + (i % 2) * 8, 25)
        .setAlpha(0.88);
      this.floatingCoins.push(coin);
      this.animate({
        targets: coin,
        y: coin.y - 8,
        angle: i % 2 === 0 ? 8 : -8,
        duration: 1200 + i * 110,
        delay: i * 75,
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
    coin.fillStyle(0xffffff, 0.26);
    coin.fillCircle(-size * 0.14, -size * 0.16, size * 0.17);
    coin.lineStyle(Math.max(1.2, size * 0.08), C.goldDeep, 0.58);
    coin.strokeCircle(0, 0, size / 2 - 1);
    const mark = this.add.image(0, 0, REDENV_ASSETS.gasIcon)
      .setDisplaySize(size * 0.58, size * 0.58)
      .setOrigin(0.5);
    badge.add([coin, mark]);
    return badge;
  }

  private buildResultPill(W: number): void {
    this.resultPill = this.add.container(W / 2, 266);
    const bg = this.add.graphics();
    bg.fillStyle(C.surface, 0.96);
    bg.fillRoundedRect(-168, -23, 336, 46, 23);
    bg.lineStyle(1, C.stroke, 0.9);
    bg.strokeRoundedRect(-168, -23, 336, 46, 23);
    const icon = this.makeGasBadge(-143, 0, 28);
    this.resultText = this.add.text(-110, 0, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765230",
      fontStyle: "500",
      fixedWidth: 250,
    }).setOrigin(0, 0.5);
    this.resultPill.add([bg, icon, this.resultText]);
    this.resultPill.setData("bg", bg);
  }

  private setResultState(success: boolean, error: boolean): void {
    const bg = this.resultPill.getData("bg") as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(success ? 0xfff8e8 : error ? 0xfff0ec : C.surface, 0.97);
    bg.fillRoundedRect(-168, -23, 336, 46, 23);
    bg.lineStyle(1, success ? C.gold : error ? C.danger : C.stroke, 0.94);
    bg.strokeRoundedRect(-168, -23, 336, 46, 23);
    this.resultText.setColor(success ? "#8a5b06" : error ? "#a63a2d" : "#765230");
  }

  private buildModeTabs(W: number): void {
    this.makeModeButton(W / 2 - 72, 315, "send", "Send");
    this.makeModeButton(W / 2 + 72, 315, "claim", "Claim");
  }

  private makeModeButton(x: number, y: number, mode: Mode, label: string): void {
    const button = this.add.container(x, y);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765230",
      fontStyle: "600",
    }).setOrigin(0.5);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(bg, {
      targets: button,
      pressScale: 0.97,
      onPress: () => {
        this.sfx.play("tap");
        this.switchMode(mode);
      },
    });
    button.add([bg, text]);
    button.setData("bg", bg);
    button.setData("text", text);
    this.modeButtons.set(mode, button);
  }

  private switchMode(mode: Mode): void {
    this.activeMode = mode;
    this.sendPanel?.setVisible(mode === "send");
    this.claimPanel?.setVisible(mode === "claim");
    this.heroImage?.setTexture(mode === "claim" ? REDENV_ASSETS.claimCard : REDENV_ASSETS.stage);

    for (const [key, button] of this.modeButtons) {
      const active = key === mode;
      const bg = button.getData("bg") as Phaser.GameObjects.Graphics;
      const text = button.getData("text") as Phaser.GameObjects.Text;
      bg.clear();
      bg.fillStyle(active ? C.ink : C.surface, active ? 1 : 0.95);
      bg.fillRoundedRect(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H, 17);
      bg.lineStyle(1, active ? C.ink : C.stroke, 0.95);
      bg.strokeRoundedRect(-MODE_BUTTON_W / 2, -MODE_BUTTON_H / 2, MODE_BUTTON_W, MODE_BUTTON_H, 17);
      text.setColor(active ? "#fff6df" : "#765230");
    }
    this.updateResultPillCopy(
      this.val<{ amount?: number; from?: string } | null>("luckyMessage", null),
      this.lastCreatedEnvelopeId || asEnvelopeId(this.str("lastCreatedEnvelopeId", "")),
      this.str("lastError", ""),
    );
    this.updateStatusCopy(
      this.str("lastError", ""),
      this.str("serviceNotice", ""),
      this.num("prepaidCredit", 0),
    );
  }

  private updateResultPillCopy(
    lucky: { amount?: number; from?: string } | null | undefined,
    lastCreated: string,
    lastError: string,
  ): void {
    if (!this.resultText) return;
    const wonAmount = lucky?.amount && lucky.amount > 0 ? fmtGas(lucky.amount) : "";
    this.resultText.setText(
      wonAmount
        ? `+${wonAmount} GAS received`
        : lastCreated
          ? `Envelope #${lastCreated} is ready to share`
          : this.activeMode === "claim"
            ? this.activeEnvelopeId
              ? "Envelope ready. Open once for GAS."
              : "Open a shared link or active pool."
            : "Create packets. Share a link. Open for GAS.",
    );
    this.setResultState(Boolean(wonAmount || lastCreated), Boolean(lastError));
  }

  private defaultStatusCopy(): string {
    return this.activeMode === "claim"
      ? "Use a shared envelope link before opening."
      : "Random packet split is settled by the on-chain contract.";
  }

  private updateStatusCopy(lastError: string, serviceNotice: string, credit: number): void {
    if (!this.statusText) return;
    this.statusText.setText(
      compactError(lastError) ||
        serviceNotice ||
        (credit > 0 ? `Prepaid credit ${fmtGas(credit)} GAS available` : "") ||
        this.defaultStatusCopy(),
    );
  }

  private buildSendPanel(W: number): void {
    this.sendPanel = this.add.container(0, 0);
    this.sendPanel.add(
      this.add.text(W / 2, 355, "Pick a packet bundle", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#2e2116",
        fontStyle: "600",
      }).setOrigin(0.5),
    );

    ENVELOPE_PLANS.forEach((_, index) => {
      const card = this.makePlanCard(70 + index * 140, 415, index);
      this.planCards.push(card);
      this.sendPanel.add(card);
    });

    this.sendSummaryText = this.add.text(W / 2, 496, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765230",
      fixedWidth: 330,
      align: "center",
    }).setOrigin(0.5);
    this.sendPanel.add(this.sendSummaryText);

    this.createButton = this.makeActionButton(W / 2 - 62, 535, "Create", "primary", 138);
    this.createButtonBg = this.createButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.createButtonLabel = this.createButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.createButtonBg, {
      targets: this.createButton,
      enabled: () => !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchCreate(),
    });

    this.shareButton = this.makeActionButton(W / 2 + 92, 535, "Share", "secondary", 126);
    this.shareButtonBg = this.shareButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.shareButtonLabel = this.shareButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.shareButtonBg, {
      targets: this.shareButton,
      enabled: () => Boolean(this.lastCreatedEnvelopeId) && !this.busy,
      pressScale: 0.97,
      onPress: () => {
        this.sfx.play("tap");
        this.dispatch("shareEnvelope", { envelopeId: this.lastCreatedEnvelopeId });
      },
    });

    this.sendPanel.add([this.createButton, this.shareButton]);
    this.selectPlan(this.selectedPlanIndex, false);
  }

  private makePlanCard(x: number, y: number, index: number): Phaser.GameObjects.Container {
    const plan = ENVELOPE_PLANS[index]!;
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.setInteractive(new Phaser.Geom.Rectangle(-56, -48, 112, 96), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: card,
      pressScale: 0.96,
      onPress: () => {
        this.sfx.play("select");
        this.selectPlan(index, true);
      },
    });
    const title = this.add.text(0, -30, plan.title, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765230",
      fontStyle: "600",
    }).setOrigin(0.5);
    const amount = this.add.text(0, -5, plan.amount, {
      fontFamily: FONT,
      fontSize: "21px",
      color: "#2e2116",
      fontStyle: "600",
    }).setOrigin(0.5);
    const gas = this.add.text(0, 16, "GAS", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#a87943",
      fontStyle: "600",
      letterSpacing: 1,
    }).setOrigin(0.5);
    const count = this.add.text(0, 34, `${plan.count} packets`, {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#765230",
    }).setOrigin(0.5);
    card.add([bg, title, amount, gas, count]);
    card.setData("bg", bg);
    card.setData("title", title);
    card.setData("amount", amount);
    return card;
  }

  private selectPlan(index: number, animate: boolean): void {
    this.selectedPlanIndex = index;
    this.planCards.forEach((card, cardIndex) => this.renderPlanCard(card, cardIndex === index));
    const plan = ENVELOPE_PLANS[index]!;
    this.sendSummaryText?.setText(`${plan.count} random packets - ${plan.expiryHours}h expiry`);
    if (animate) {
      this.animate({
        targets: this.heroGlow,
        alpha: { from: 0.34, to: 0.2 },
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
    bg.fillStyle(active ? 0xfff0cf : C.surface, active ? 1 : 0.96);
    bg.fillRoundedRect(-56, -48, 112, 96, 18);
    bg.lineStyle(active ? 2 : 1, active ? C.strokeStrong : C.stroke, 0.96);
    bg.strokeRoundedRect(-56, -48, 112, 96, 18);
    title.setColor(active ? "#9a5b04" : "#765230");
    amount.setColor(active ? "#9a5b04" : "#2e2116");
  }

  private buildClaimPanel(W: number): void {
    this.claimPanel = this.add.container(0, 0);
    this.claimPanel.add(
      this.add.text(W / 2, 356, "Open a shared envelope", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#2e2116",
        fontStyle: "600",
      }).setOrigin(0.5),
    );

    const ticket = this.add.container(W / 2, 420);
    const ticketBg = this.add.graphics();
    ticketBg.fillStyle(C.surface, 0.97);
    ticketBg.fillRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.95);
    ticketBg.strokeRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.5);
    ticketBg.lineBetween(-118, -48, -118, 48);
    ticketBg.lineBetween(118, -48, 118, 48);
    const coin = this.makeGasBadge(-124, -15, 36);
    this.activeEnvelopeText = this.add.text(-78, -18, "", {
      fontFamily: FONT,
      fontSize: "17px",
      color: "#2e2116",
      fontStyle: "600",
      fixedWidth: 190,
    }).setOrigin(0, 0.5);
    this.claimMetaText = this.add.text(-78, 12, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765230",
      fixedWidth: 205,
    }).setOrigin(0, 0.5);
    ticket.add([ticketBg, coin, this.activeEnvelopeText, this.claimMetaText]);
    this.claimPanel.add(ticket);

    this.claimButton = this.makeActionButton(W / 2, 515, "Open envelope", "primary", 230);
    this.claimButtonBg = this.claimButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.claimButtonLabel = this.claimButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.claimButtonBg, {
      targets: this.claimButton,
      enabled: () => Boolean(this.activeEnvelopeId) && !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchClaim(),
    });
    this.claimPanel.add(this.claimButton);
    this.claimPanel.setVisible(false);
  }

  private makeActionButton(
    x: number,
    y: number,
    label: string,
    tone: "primary" | "secondary",
    width: number,
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: "13px",
      color: tone === "primary" ? "#2e2116" : "#765230",
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
      label.setColor("#8f806e");
      button.setAlpha(0.8);
      return;
    }
    if (tone === "primary") {
      bg.fillStyle(C.gold);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.fillStyle(C.white, 0.22);
      bg.fillRoundedRect(-width / 2 + 3, -18, width - 6, 17, 17);
      bg.lineStyle(1, C.goldDeep, 0.58);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#2e2116");
    } else {
      bg.fillStyle(C.surface, 0.98);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.lineStyle(1, C.strokeStrong, 0.72);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#765230");
    }
    button.setAlpha(1);
  }

  private updateButtons(): void {
    const canCreate = !this.busy;
    const canShare = Boolean(this.lastCreatedEnvelopeId) && !this.busy;
    const canClaim = Boolean(this.activeEnvelopeId) && !this.busy;
    this.createButtonLabel.setText(this.busy ? "Working..." : "Create");
    this.shareButtonLabel.setText("Share");
    this.claimButtonLabel.setText(this.busy ? "Opening..." : this.activeEnvelopeId ? "Open envelope" : "No envelope");
    this.renderActionButton(this.createButton, canCreate);
    this.renderActionButton(this.shareButton, canShare);
    this.renderActionButton(this.claimButton, canClaim);
  }

  private dispatchCreate(): void {
    const plan = ENVELOPE_PLANS[this.selectedPlanIndex]!;
    this.sfx.play("start");
    this.dispatch("createEnvelope", {
      amount: plan.amount,
      count: plan.count,
      expiryHours: plan.expiryHours,
    });
  }

  private dispatchClaim(): void {
    if (!this.activeEnvelopeId) return;
    this.sfx.play("reveal");
    this.dispatch("claimEnvelope", { envelopeId: this.activeEnvelopeId });
    this.playOpenAnimation();
  }

  private playOpenAnimation(): void {
    this.animate({
      targets: this.heroContainer,
      angle: { from: -3, to: 3 },
      duration: 70,
      repeat: 4,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
  }

  private updateHeroMotion(opening: boolean): void {
    this.heroContainer.setAlpha(opening ? 0.9 : 1);
    this.floatingCoins.forEach((coin, index) => {
      coin.setAlpha(opening || this.activeMode === "claim" ? 1 : 0.82);
      if (opening) {
        coin.setRotation(Phaser.Math.DegToRad((this.time.now / 20 + index * 38) % 360));
      }
    });
  }

  private spawnRewardBurst(): void {
    const W = DESIGN_W;
    for (let i = 0; i < 18; i += 1) {
      const coin = this.makeGasBadge(W / 2, 246, 24).setAlpha(0.95);
      this.animate({
        targets: coin,
        x: W / 2 + Phaser.Math.Between(-145, 145),
        y: 118 + Phaser.Math.Between(-18, 112),
        angle: Phaser.Math.Between(-240, 240),
        alpha: { from: 1, to: 0 },
        duration: 920 + i * 22,
        delay: i * 34,
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

  private buildStatus(W: number, H: number): void {
    this.statusText = this.add.text(W / 2, H - 22, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#765230",
      fixedWidth: 342,
      align: "center",
    }).setOrigin(0.5);
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.42;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
  }
}
