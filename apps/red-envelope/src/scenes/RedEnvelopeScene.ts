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

type Claimability = {
  envelopeId?: string;
  canClaim?: boolean;
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

function fillTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

/**
 * Every user-visible string the scene renders. Resolved from the locale system
 * in PhaserPlayArea and delivered through the `sceneCopy` bridge key; the
 * English literals below are the fallback defaults (also keeping the pinned
 * literals in-source for the guard tests).
 */
type SceneCopy = {
  modeSend: string;
  modeClaim: string;
  sendHeading: string;
  claimHeading: string;
  planLucky: string;
  planParty: string;
  planFestival: string;
  packetsTpl: string;
  create: string;
  createUnavailable: string;
  working: string;
  connectWallet: string;
  confirming: string;
  share: string;
  open: string;
  opening: string;
  noEnvelope: string;
  summaryTpl: string;
  resultReceivedTpl: string;
  resultShareReadyTpl: string;
  resultClaimReady: string;
  resultClaimIdle: string;
  resultSendIdle: string;
  ticketEnvelopeTpl: string;
  ticketEmpty: string;
  claimReadyMeta: string;
  claimEmptyMeta: string;
  packetsLeftTpl: string;
  packetStatusReady: string;
  gasLeftTpl: string;
  unitLabel: string;
  randomAmount: string;
  statusClaimIdle: string;
  statusSendIdle: string;
  prepaidTpl: string;
  gameFiUnavailable: string;
  errorFallback: string;
};

const DEFAULT_SCENE_COPY: SceneCopy = {
  modeSend: "Send",
  modeClaim: "Claim",
  sendHeading: "Pick a packet bundle",
  claimHeading: "Open a shared envelope",
  planLucky: "Lucky 8",
  planParty: "Party 20",
  planFestival: "Festival 50",
  packetsTpl: "{count} packets",
  create: "Create",
  createUnavailable: "Upgrade required",
  working: "Working...",
  connectWallet: "Connect wallet",
  confirming: "Confirming...",
  share: "Share",
  open: "Open envelope",
  opening: "Opening...",
  noEnvelope: "No envelope",
  summaryTpl: "{count} random packets - {hours}h expiry",
  resultReceivedTpl: "+{amount} GAS received",
  resultShareReadyTpl: "Envelope #{id} is ready to share",
  resultClaimReady: "Envelope ready. Open once for GAS.",
  resultClaimIdle: "Open a shared link or active pool.",
  resultSendIdle: "Create packets. Share a link. Open for GAS.",
  ticketEnvelopeTpl: "Envelope #{id}",
  ticketEmpty: "Open a claim link",
  claimReadyMeta: "Ready to open with your wallet",
  claimEmptyMeta: "Use a shared envelope link to claim.",
  packetsLeftTpl: "{count} packets left",
  packetStatusReady: "Packet status ready",
  gasLeftTpl: "{amount} GAS left",
  unitLabel: "GAS",
  randomAmount: "Random amount",
  statusClaimIdle: "Use a shared envelope link before opening.",
  statusSendIdle: "Random packet split is settled by the on-chain contract.",
  prepaidTpl: "Prepaid credit {amount} GAS available",
  gameFiUnavailable: "GameFi is temporarily unavailable",
  errorFallback: "The envelope action could not be completed.",
};

const PLAN_TITLE_KEYS: Array<keyof SceneCopy> = ["planLucky", "planParty", "planFestival"];

export class RedEnvelopeScene extends BaseScene {
  private heroContainer!: Phaser.GameObjects.Container;
  private heroImage!: Phaser.GameObjects.Image;
  private heroRevealImage!: Phaser.GameObjects.Image;
  private heroGlow!: Phaser.GameObjects.Ellipse;
  private sceneBackdrop!: Phaser.GameObjects.Rectangle;
  private sceneFrame!: Phaser.GameObjects.Graphics;
  private tallStageDock!: Phaser.GameObjects.Graphics;
  private floatingCoins: Phaser.GameObjects.Container[] = [];

  private modeButtons = new Map<Mode, Phaser.GameObjects.Container>();
  private sendPanel!: Phaser.GameObjects.Container;
  private claimPanel!: Phaser.GameObjects.Container;
  private planCards: Phaser.GameObjects.Container[] = [];
  private sendHeadingText!: Phaser.GameObjects.Text;
  private claimHeadingText!: Phaser.GameObjects.Text;
  private claimHintGlow!: Phaser.GameObjects.Ellipse;
  private copy: SceneCopy = DEFAULT_SCENE_COPY;

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
  private isGuest = false;
  private paidActionsEnabled = true;
  private walletConnected = false;
  private claimEnabled = false;
  private autoSelectedMode = false;
  private lastWinKey = "";
  private lastCreatedAnimationKey = "";
  private openingTween: Phaser.Tweens.Tween | null = null;

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

    this.copy = this.resolveSceneCopy();
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

  private resolveSceneCopy(): SceneCopy {
    return { ...DEFAULT_SCENE_COPY, ...(this.val<Partial<SceneCopy>>("sceneCopy", undefined) ?? {}) };
  }

  private applyStaticCopy(): void {
    this.modeButtons.get("send")?.getData("text")?.setText(this.copy.modeSend);
    this.modeButtons.get("claim")?.getData("text")?.setText(this.copy.modeClaim);
    this.sendHeadingText?.setText(this.copy.sendHeading);
    this.claimHeadingText?.setText(this.copy.claimHeading);
    this.planCards.forEach((card, index) => {
      const title = card.getData("title") as Phaser.GameObjects.Text | undefined;
      const count = card.getData("count") as Phaser.GameObjects.Text | undefined;
      const unit = card.getData("unit") as Phaser.GameObjects.Text | undefined;
      const plan = ENVELOPE_PLANS[index]!;
      title?.setText(this.copy[PLAN_TITLE_KEYS[index]!]);
      count?.setText(fillTemplate(this.copy.packetsTpl, { count: plan.count }));
      unit?.setText(this.copy.unitLabel);
    });
  }

  protected onStateUpdate(_state: GameState): void {
    this.copy = this.resolveSceneCopy();
    this.applyStaticCopy();
    const openingId = asEnvelopeId(this.val<string | null>("openingId", null));
    const lucky = this.val<{ amount?: number; from?: string } | null>("luckyMessage", null);
    const envelopes = this.val<EnvelopePreview[]>("envelopes", []) ?? [];
    const pools = this.val<EnvelopePreview[]>("pools", []) ?? [];
    const lastCreated = asEnvelopeId(this.str("lastCreatedEnvelopeId", ""));
    const lastError = this.str("lastError", "");
    const serviceNotice = this.str("serviceNotice", "");
    const credit = this.num("prepaidCredit", 0);
    const claimability = this.val<Claimability>("claimability", undefined);
    this.isGuest = this.str("appMode", "gamefi") === "guest";
    this.paidActionsEnabled = this.val<boolean>("paidActionsAvailable", true) !== false;
    this.walletConnected = this.isGuest || this.bool("walletConnected");
    const pendingOperation = this.val<Record<string, unknown> | null>("pendingOperation", null);

    this.busy =
      this.bool("isLoading") ||
      this.bool("isCreating") ||
      this.bool("isConnectingWallet") ||
      this.bool("isRecovering") ||
      Boolean(pendingOperation) ||
      Boolean(openingId);
    this.lastCreatedEnvelopeId = lastCreated;
    const fallbackClaimableId = this.pickClaimableEnvelopeId(pools, envelopes);
    const explicitClaimableId = asEnvelopeId(claimability?.envelopeId);
    this.activeEnvelopeId = openingId || explicitClaimableId || (claimability ? "" : fallbackClaimableId);
    this.claimEnabled = claimability
      ? Boolean(claimability.canClaim && explicitClaimableId && !openingId)
      : Boolean(fallbackClaimableId && !openingId);
    this.claimEnabled = this.claimEnabled && (this.isGuest || this.paidActionsEnabled);

    if (!this.autoSelectedMode) {
      this.autoSelectedMode = true;
      this.switchMode("claim");
    }

    this.showHeroState(Boolean(lucky?.amount && lucky.amount > 0));

    const wonAmount = lucky?.amount && lucky.amount > 0 ? fmtGas(lucky.amount) : "";
    this.updateResultPillCopy(lucky, lastCreated, lastError);

    this.activeEnvelopeText.setText(
      this.activeEnvelopeId
        ? fillTemplate(this.copy.ticketEnvelopeTpl, { id: truncateMiddle(this.activeEnvelopeId, 8, 4) })
        : this.copy.ticketEmpty,
    );
    this.claimMetaText.setText(this.claimMeta(pools, envelopes));
    this.claimHintGlow?.setVisible(this.activeMode === "claim" && !this.activeEnvelopeId);

    this.updateStatusCopy(lastError, serviceNotice, credit);

    this.updateButtons();
    this.updateHeroMotion(Boolean(openingId));

    const winKey = wonAmount ? `${wonAmount}:${String(lucky?.from ?? "")}` : "";
    if (!winKey) {
      // Allow a later packet with the same amount/sender to celebrate again
      // after the previous result overlay has been dismissed.
      this.lastWinKey = "";
    } else if (winKey !== this.lastWinKey) {
      this.lastWinKey = winKey;
      // `luckyMessage` is published only after claim() resolves its Claimed
      // event (or the guest engine completes its local draw), so the envelope
      // never tears open merely because a wallet request was submitted.
      this.playOpenAnimation();
      this.sfx.play((lucky?.amount ?? 0) >= 1 ? "win" : "score");
      this.spawnRewardBurst();
    }

    if (!lastCreated) {
      this.lastCreatedAnimationKey = "";
    } else if (!wonAmount && lastCreated !== this.lastCreatedAnimationKey) {
      this.lastCreatedAnimationKey = lastCreated;
      this.playCreateAnimation();
    }
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.sfx.play("error");
    this.statusText.setText(compactError(error.message) || this.copy.errorFallback);
    this.setResultState(false, true);
  }

  private pickClaimableEnvelopeId(...lists: EnvelopePreview[][]): string {
    const merged = lists.flat().filter(Boolean);
    const claimable = merged.find((item) => {
      const id = asEnvelopeId(item.id);
      if (!id) return false;
      if (item.canOpen !== undefined) return item.canOpen;
      return item.active !== false && item.expired !== true && item.depleted !== true;
    });
    return asEnvelopeId(claimable?.id);
  }

  private claimMeta(...lists: EnvelopePreview[][]): string {
    const target = lists.flat().find((item) => asEnvelopeId(item.id) === this.activeEnvelopeId);
    if (!target) return this.activeEnvelopeId ? this.copy.claimReadyMeta : this.copy.claimEmptyMeta;
    const packets = Number(target.remainingPackets ?? 0);
    const amount = Number(target.remainingAmount ?? target.totalAmount ?? target.amount ?? 0);
    const packetText =
      packets > 0 ? fillTemplate(this.copy.packetsLeftTpl, { count: packets }) : this.copy.packetStatusReady;
    const amountText =
      amount > 0 ? fillTemplate(this.copy.gasLeftTpl, { amount: fmtGas(amount) }) : this.copy.randomAmount;
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

    if (hasTallDock) {
      const g = this.tallStageDock;
      const left = 18;
      const width = DESIGN_W - 36;
      const totalHeight = dockHeight + 18;
      // Warm festive floor: a solid warm base with a lighter top band gives a
      // soft top-lit gradient feel without the broken hatch/ghost-coin look.
      g.fillStyle(0xffe6bd, 0.9);
      g.fillRoundedRect(left, dockTop, width, totalHeight, { tl: 22, tr: 22, bl: 0, br: 0 });
      g.fillStyle(0xfff6e2, 0.6);
      g.fillRoundedRect(left, dockTop, width, Math.min(52, totalHeight), { tl: 22, tr: 22, bl: 0, br: 0 });
      // Thin gold divider reads as the lip of the festive shelf.
      g.lineStyle(1, 0xf0c67a, 0.55);
      g.lineBetween(left + 24, dockTop + 24, DESIGN_W - left - 24, dockTop + 24);

      // A small centered coin-shelf medallion: three gold coins resting in a
      // shallow arc, echoing the spilling-coins hero as an intentional accent.
      const accentY = Math.min(stageBottom - 44, dockTop + 62);
      g.lineStyle(2, 0xefc47c, 0.34);
      g.lineBetween(DESIGN_W / 2 - 46, accentY + 15, DESIGN_W / 2 + 46, accentY + 15);
      const shelfCoins = [
        { x: DESIGN_W / 2 - 34, y: accentY + 2, r: 10 },
        { x: DESIGN_W / 2, y: accentY - 4, r: 12 },
        { x: DESIGN_W / 2 + 34, y: accentY + 2, r: 10 },
      ];
      for (const c of shelfCoins) {
        g.fillStyle(0xffcf63, 0.5);
        g.fillCircle(c.x, c.y, c.r);
        g.fillStyle(0xffffff, 0.16);
        g.fillCircle(c.x - c.r * 0.3, c.y - c.r * 0.32, c.r * 0.32);
        g.lineStyle(1.4, C.goldDeep, 0.32);
        g.strokeCircle(c.x, c.y, c.r);
      }
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
    this.heroRevealImage = this.add.image(0, 0, REDENV_ASSETS.claimCard)
      .setDisplaySize(390, 220)
      .setOrigin(0.5)
      .setAlpha(0);
    this.heroContainer.add([this.heroImage, this.heroRevealImage]);
    // Soft rounded frame drawn over the hero edge so the photo's corners read as
    // rounded (echoing the stage frame) without a camera-fighting geometry mask.
    const heroFrame = this.add.graphics();
    heroFrame.lineStyle(6, C.canvas, 1);
    heroFrame.strokeRoundedRect(-198, -113, 396, 226, 20);
    heroFrame.lineStyle(1.5, C.stroke, 0.9);
    heroFrame.strokeRoundedRect(-196, -111, 392, 222, 19);
    this.heroContainer.add(heroFrame);

    this.animate({
      targets: this.heroContainer,
      y: 132,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Three faint lucky coins scattered around the bowl spill (staggered x/y and
    // varied size) — reads as coins tumbling out of the photo, not a UI strip.
    const spill = [
      { x: 150, y: 234, size: 25, alpha: 0.62 },
      { x: 192, y: 246, size: 19, alpha: 0.52 },
      { x: 120, y: 248, size: 16, alpha: 0.5 },
    ];
    spill.forEach((c, i) => {
      const coin = this.makeGasBadge(c.x, c.y, c.size).setAlpha(c.alpha);
      coin.setData("baseAlpha", c.alpha);
      this.floatingCoins.push(coin);
      this.animate({
        targets: coin,
        y: coin.y - 6,
        angle: i % 2 === 0 ? 7 : -7,
        duration: 1300 + i * 140,
        delay: i * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
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
    this.resultPill = this.add.container(W / 2, 274);
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
    this.makeModeButton(W / 2 - 72, 315, "send", this.copy.modeSend);
    this.makeModeButton(W / 2 + 72, 315, "claim", this.copy.modeClaim);
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
    const lucky = this.val<{ amount?: number } | null>("luckyMessage", null);
    this.showHeroState(mode === "claim" && Boolean(lucky?.amount && lucky.amount > 0));

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
        ? fillTemplate(this.copy.resultReceivedTpl, { amount: wonAmount })
        : lastCreated
          ? fillTemplate(this.copy.resultShareReadyTpl, { id: lastCreated })
          : this.activeMode === "claim"
            ? this.activeEnvelopeId
              ? this.copy.resultClaimReady
              : this.copy.resultClaimIdle
            : this.copy.resultSendIdle,
    );
    this.setResultState(Boolean(wonAmount || lastCreated), Boolean(lastError));
  }

  private defaultStatusCopy(): string {
    // Same ordering as the button labels: a missing wallet is the expected
    // first paint, not the paid-action gate.
    if (!this.isGuest && !this.walletConnected) {
      return this.activeMode === "claim" ? this.copy.statusClaimIdle : this.copy.statusSendIdle;
    }
    if (!this.isGuest && !this.paidActionsEnabled) return this.copy.gameFiUnavailable;
    return this.activeMode === "claim" ? this.copy.statusClaimIdle : this.copy.statusSendIdle;
  }

  private updateStatusCopy(lastError: string, serviceNotice: string, credit: number): void {
    if (!this.statusText) return;
    this.statusText.setText(
      compactError(lastError) ||
        serviceNotice ||
        (credit > 0 ? fillTemplate(this.copy.prepaidTpl, { amount: fmtGas(credit) }) : "") ||
        this.defaultStatusCopy(),
    );
  }

  private buildSendPanel(W: number): void {
    this.sendPanel = this.add.container(0, 0);
    this.sendHeadingText = this.add.text(W / 2, 355, this.copy.sendHeading, {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#2e2116",
      fontStyle: "600",
    }).setOrigin(0.5);
    this.sendPanel.add(this.sendHeadingText);

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

    this.createButton = this.makeActionButton(W / 2 - 62, 535, this.copy.create, "primary", 138);
    this.createButtonBg = this.createButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.createButtonLabel = this.createButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.createButtonBg, {
      targets: this.createButton,
      enabled: () => !this.busy,
      pressScale: 0.97,
      onPress: () => this.dispatchCreate(),
    });

    this.shareButton = this.makeActionButton(W / 2 + 92, 535, this.copy.share, "secondary", 126);
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
    const title = this.add.text(0, -30, this.copy[PLAN_TITLE_KEYS[index]!], {
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
    const gas = this.add.text(0, 16, this.copy.unitLabel, {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#a87943",
      fontStyle: "600",
      letterSpacing: 1,
    }).setOrigin(0.5);
    const count = this.add.text(0, 34, fillTemplate(this.copy.packetsTpl, { count: plan.count }), {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#765230",
    }).setOrigin(0.5);
    card.add([bg, title, amount, gas, count]);
    card.setData("bg", bg);
    card.setData("title", title);
    card.setData("amount", amount);
    card.setData("unit", gas);
    card.setData("count", count);
    return card;
  }

  private selectPlan(index: number, animate: boolean): void {
    this.selectedPlanIndex = index;
    this.planCards.forEach((card, cardIndex) => this.renderPlanCard(card, cardIndex === index));
    const plan = ENVELOPE_PLANS[index]!;
    this.sendSummaryText?.setText(
      fillTemplate(this.copy.summaryTpl, { count: plan.count, hours: plan.expiryHours }),
    );
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
    this.claimHeadingText = this.add.text(W / 2, 356, this.copy.claimHeading, {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#2e2116",
      fontStyle: "600",
    }).setOrigin(0.5);
    this.claimPanel.add(this.claimHeadingText);

    const ticket = this.add.container(W / 2, 420);
    const ticketBg = this.add.graphics();
    ticketBg.fillStyle(C.surface, 0.97);
    ticketBg.fillRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.95);
    ticketBg.strokeRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.5);
    ticketBg.lineBetween(-118, -48, -118, 48);
    ticketBg.lineBetween(118, -48, 118, 48);
    // Soft pulsing halo behind the ticket seal — an idle hint that points the
    // user to paste/scan a link when no envelope is loaded.
    this.claimHintGlow = this.add.ellipse(-124, -15, 58, 58, C.gold, 0.3).setVisible(false);
    this.animate({
      targets: this.claimHintGlow,
      alpha: { from: 0.08, to: 0.34 },
      scale: { from: 0.92, to: 1.08 },
      duration: 940,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
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
    // Fill the right perforated stub with a small coin token so the tear-off
    // tab reads as a real ticket stub instead of blank padding.
    const stubCoin = this.makeGasBadge(134, 0, 22).setAlpha(0.85);
    ticket.add([ticketBg, this.claimHintGlow, coin, this.activeEnvelopeText, this.claimMetaText, stubCoin]);
    this.claimPanel.add(ticket);

    this.claimButton = this.makeActionButton(W / 2, 515, this.copy.open, "primary", 230);
    this.claimButtonBg = this.claimButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.claimButtonLabel = this.claimButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.claimButtonBg, {
      targets: this.claimButton,
      enabled: () => this.claimEnabled && Boolean(this.activeEnvelopeId) && !this.busy,
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
      // Warm "awaiting" state (soft gold + accent-ink) rather than a flat gray
      // pill, so an idle claim button reads as ready-and-waiting, not broken.
      bg.fillStyle(0xfdeccb, 0.96);
      bg.fillRoundedRect(-width / 2, -21, width, 42, 21);
      bg.lineStyle(1, 0xf0d29a, 0.92);
      bg.strokeRoundedRect(-width / 2, -21, width, 42, 21);
      label.setColor("#a87943");
      button.setAlpha(0.92);
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
    const guest = this.str("appMode", "gamefi") === "guest";
    const paidAvailable = guest || this.paidActionsEnabled;
    // Connecting a wallet is not itself a paid action, so the button stays live
    // for it. Every paid path beyond the connect is still gated on
    // paidActionsEnabled by both the checks below and dispatchCreate/Claim.
    const needsWallet = !guest && !this.walletConnected;
    const canCreate = !this.busy
      && (needsWallet || (paidAvailable && (guest || this.bool("createAvailable"))));
    const canShare = Boolean(this.lastCreatedEnvelopeId) && !this.busy;
    const canClaim = !this.busy
      && (needsWallet
        || (paidAvailable && this.claimEnabled && Boolean(this.activeEnvelopeId)));
    // A visitor with no wallet has not hit the paid-action gate — they have not
    // reached it yet. Asking them to connect comes FIRST, so the entry surface
    // invites instead of opening on "GameFi paused" over a dead button. The
    // gate copy still shows for a connected wallet whose contract really failed
    // verification, which is the only case where it says something true.
    this.createButtonLabel.setText(
      this.busy
        ? this.val("pendingOperation", null) || this.bool("isRecovering")
          ? this.copy.confirming
          : this.copy.working
        : !guest && !this.walletConnected
          ? this.copy.connectWallet
        : !paidAvailable
          ? this.copy.gameFiUnavailable
        : !guest && !this.bool("createAvailable")
          ? this.copy.createUnavailable
          : this.copy.create,
    );
    this.shareButtonLabel.setText(this.copy.share);
    this.claimButtonLabel.setText(
      this.busy
        ? this.val("pendingOperation", null) || this.bool("isRecovering")
          ? this.copy.confirming
          : this.copy.opening
        : !guest && !this.walletConnected
          ? this.copy.connectWallet
        : !paidAvailable
          ? this.copy.gameFiUnavailable
        : this.activeEnvelopeId
          ? this.copy.open
          : this.copy.noEnvelope,
    );
    this.renderActionButton(this.createButton, canCreate);
    this.renderActionButton(this.shareButton, canShare);
    this.renderActionButton(this.claimButton, canClaim);
  }

  private dispatchCreate(): void {
    if (this.busy) return;
    // Connect first: with no wallet there is no paid action to gate yet, and
    // the paid gates below still stand for every path that follows.
    if (!this.isGuest && !this.walletConnected) {
      this.sfx.play("tap");
      this.dispatch("connectWallet");
      return;
    }
    if (!this.isGuest && !this.paidActionsEnabled) return;
    if (
      this.str("appMode", "gamefi") !== "guest" &&
      !this.bool("createAvailable")
    ) return;
    if (!this.walletConnected) {
      this.sfx.play("tap");
      this.dispatch("connectWallet");
      return;
    }
    const plan = ENVELOPE_PLANS[this.selectedPlanIndex]!;
    this.sfx.play("start");
    this.dispatch("createEnvelope", {
      amount: plan.amount,
      count: plan.count,
      expiryHours: plan.expiryHours,
    });
  }

  private dispatchClaim(): void {
    if (!this.claimEnabled || !this.activeEnvelopeId || this.busy) return;
    if (!this.isGuest && !this.paidActionsEnabled) return;
    if (!this.walletConnected) {
      this.sfx.play("tap");
      this.dispatch("connectWallet");
      return;
    }
    // Submission feedback only. The reveal animation and reward burst wait for
    // the confirmed luckyMessage state in onStateUpdate().
    this.sfx.play("tap");
    this.dispatch("claimEnvelope", { envelopeId: this.activeEnvelopeId });
  }

  /** Swap authored closed/open artwork; no code-drawn envelope substitutes. */
  private showHeroState(open: boolean): void {
    if (!this.heroImage || !this.heroRevealImage) return;
    this.heroImage.setAlpha(open ? 0.12 : 1);
    this.heroRevealImage
      .setAlpha(open ? 1 : 0)
      .setScale(1)
      .setAngle(0);
  }

  private playOpenAnimation(): void {
    this.stopOpeningMotion();
    // The reveal is an authored state transition: the warm closed packet photo
    // crossfades into the open envelope / falling-coins artwork only after the
    // exact claim is confirmed.
    this.heroRevealImage.setAlpha(0).setScale(0.94).setAngle(-2);
    this.heroImage.setAlpha(1);
    this.animate({
      targets: this.heroImage,
      alpha: 0.12,
      duration: 320,
      ease: "Sine.easeOut",
    });
    this.animate({
      targets: this.heroRevealImage,
      alpha: 1,
      scale: 1,
      angle: 0,
      duration: 430,
      ease: "Back.easeOut",
    });
    this.tween({
      targets: this.heroContainer,
      scale: { from: 1, to: 1.12 },
      duration: 130,
      yoyo: true,
      ease: "Back.easeOut",
    });
    this.animate({
      targets: this.heroContainer,
      angle: { from: -3, to: 3 },
      duration: 70,
      repeat: 4,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
  }

  private playCreateAnimation(): void {
    this.showHeroState(false);
    this.sfx.play("score");
    this.animate({
      targets: this.heroContainer,
      scale: { from: 0.97, to: 1.04 },
      duration: 190,
      yoyo: true,
      ease: "Back.easeOut",
    });

    // Small authored packet images rise from the finished bundle, making the
    // send result feel packed and shareable rather than like a submitted form.
    for (let i = 0; i < 6; i += 1) {
      const packet = this.add.image(DESIGN_W / 2, 236, REDENV_ASSETS.stage)
        .setDisplaySize(58, 33)
        .setAlpha(0.88)
        .setAngle(Phaser.Math.Between(-14, 14));
      this.animate({
        targets: packet,
        x: DESIGN_W / 2 + Phaser.Math.Between(-136, 136),
        y: 110 + Phaser.Math.Between(-8, 96),
        angle: packet.angle + Phaser.Math.Between(-42, 42),
        alpha: 0,
        scale: { from: 0.72, to: 1.04 },
        duration: 700 + i * 38,
        delay: i * 44,
        ease: "Cubic.easeOut",
        onComplete: () => packet.destroy(),
      });
    }
  }

  private updateHeroMotion(opening: boolean): void {
    this.heroContainer.setAlpha(opening ? 0.9 : 1);
    this.floatingCoins.forEach((coin) => {
      const baseAlpha = (coin.getData("baseAlpha") as number | undefined) ?? 0.55;
      coin.setAlpha(opening ? Math.min(1, baseAlpha + 0.25) : baseAlpha);
      if (!opening) coin.setRotation(0);
    });

    if (opening && !this.openingTween && !this.reducedMotion) {
      this.openingTween = this.tweens.add({
        targets: this.heroContainer,
        angle: { from: -1.4, to: 1.4 },
        duration: 120,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (!opening) {
      this.stopOpeningMotion();
    }
  }

  private stopOpeningMotion(): void {
    this.openingTween?.stop();
    this.openingTween = null;
    this.heroContainer?.setAngle(0);
  }

  private spawnRewardBurst(): void {
    const W = DESIGN_W;

    // Authored open-envelope cards scatter first, followed by official GAS-logo
    // coins. The UI text remains code-native while all visible packet art comes
    // from the production image set.
    for (let i = 0; i < 7; i += 1) {
      const packet = this.add.image(W / 2, 232, REDENV_ASSETS.claimCard)
        .setDisplaySize(54, 41)
        .setAlpha(0.9)
        .setAngle(Phaser.Math.Between(-16, 16));
      this.animate({
        targets: packet,
        x: W / 2 + Phaser.Math.Between(-156, 156),
        y: 92 + Phaser.Math.Between(-8, 136),
        angle: packet.angle + Phaser.Math.Between(-90, 90),
        alpha: 0,
        scale: { from: 0.62, to: 1.08 },
        duration: 760 + i * 42,
        delay: 50 + i * 34,
        ease: "Cubic.easeOut",
        onComplete: () => packet.destroy(),
      });
    }
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

  protected onReducedMotionChange(enabled: boolean): void {
    if (!enabled) return;
    this.stopOpeningMotion();
    this.tweens.killTweensOf([this.heroContainer, this.heroGlow, ...this.floatingCoins]);
    this.heroContainer?.setPosition(DESIGN_W / 2, 138).setScale(1).setAlpha(1);
    this.heroGlow?.setAlpha(0.2);
    this.floatingCoins.forEach((coin) => coin.setRotation(0));
  }

  private buildStatus(W: number, H: number): void {
    this.statusText = this.add.text(W / 2, H - 22, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#765230",
      fixedWidth: 342,
      align: "center",
      // fixedWidth alone only reserves the box — Phaser still lays a long
      // status out as ONE line and lets it run past the edge, so a full
      // sentence was rendered cut mid-word ("...Paid actions are pau"). Wrap at
      // the same width so the whole sentence is readable. compactError already
      // clamps thrown-error text; service notices are full sentences by design
      // and need the extra line.
      wordWrap: { width: 342, useAdvancedWrap: true },
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
