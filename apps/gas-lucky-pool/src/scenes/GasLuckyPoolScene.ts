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
const DESIGN_W = 420;
const DESIGN_H = 580;
const MODE_BUTTON_W = 134;
const MODE_BUTTON_H = 34;

type Mode = "create" | "claim";

const REWARD_PLANS = [
  {
    key: "small",
    titleKey: "packStarter",
    title: "Starter",
    amount: "20",
    minClaim: "1",
    maxClaim: "3",
    maxClaims: "10",
    expiryHours: "24",
  },
  {
    key: "balanced",
    titleKey: "packParty",
    title: "Party",
    amount: "50",
    minClaim: "1",
    maxClaim: "5",
    maxClaims: "25",
    expiryHours: "72",
  },
  {
    key: "jackpot",
    titleKey: "packJackpot",
    title: "Jackpot",
    amount: "100",
    minClaim: "5",
    maxClaim: "20",
    maxClaims: "10",
    expiryHours: "168",
  },
] as const;

// English fallbacks used before the localized bridge bundle arrives.
const PROGRESS_LABEL: Record<string, string> = {
  wallet: "Wallet ready",
  submitted: "Submitted",
  submitting: "Submitting claim",
  confirming: "Confirming on chain",
  paid: "GAS received",
  failed: "Needs retry",
};

// Maps a claim-progress/status key to its localized bundle key (see PhaserPlayArea).
const PROGRESS_BUNDLE_KEY: Record<string, string> = {
  wallet: "progWallet",
  submitted: "progSubmitted",
  submitting: "progSubmitting",
  confirming: "progConfirming",
  paid: "progPaid",
  failed: "progFailed",
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
  private resultCoin!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private createHeadingText!: Phaser.GameObjects.Text;
  private createSummaryText!: Phaser.GameObjects.Text;
  private claimHeadingText!: Phaser.GameObjects.Text;
  private claimTicketCoin!: Phaser.GameObjects.Container;
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
  private lastProgressKey = "";
  private lastErrorCue = "";
  private rewardRolling = false;

  constructor() {
    super("GasLuckyPoolScene");
  }

  // ── Localized text bundle ──────────────────────────────────────────────────
  // The Phaser layer has no direct locale accessor, so the React shell hands the
  // scene a translated bundle through bridge state (`sceneText`). `txt` reads a
  // key with an English fallback; `fmt` interpolates {placeholder} templates.
  private txt(key: string, fallback = ""): string {
    const bundle = this.val<Record<string, string>>("sceneText");
    const value = bundle?.[key];
    return value === undefined || value === null || value === "" ? fallback : String(value);
  }

  private fmt(template: string, params: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, token: string) =>
      params[token] !== undefined ? params[token] : `{${token}}`,
    );
  }

  private applyLocale(): void {
    const fundText = this.modeButtons.get("create")?.getData("text") as Phaser.GameObjects.Text | undefined;
    const claimText = this.modeButtons.get("claim")?.getData("text") as Phaser.GameObjects.Text | undefined;
    fundText?.setText(this.txt("tabFund", "Fund vault"));
    claimText?.setText(this.txt("tabClaim", "Claim GAS"));

    this.createHeadingText?.setText(this.txt("choosePack", "Choose a reward pack"));
    this.claimHeadingText?.setText(this.txt("unwrapTitle", "Unwrap your reward"));

    const slotsTemplate = this.txt("slotsTemplate", "{count} claims");
    const gasUnit = this.txt("gasUnit", "GAS");
    this.planCards.forEach((card, index) => {
      const plan = REWARD_PLANS[index]!;
      (card.getData("title") as Phaser.GameObjects.Text | undefined)?.setText(
        this.txt(plan.titleKey, plan.title),
      );
      (card.getData("detail") as Phaser.GameObjects.Text | undefined)?.setText(
        this.fmt(slotsTemplate, { count: plan.maxClaims }),
      );
      (card.getData("gas") as Phaser.GameObjects.Text | undefined)?.setText(gasUnit);
    });

    this.updatePlanSummary();
  }

  private updatePlanSummary(): void {
    const plan = REWARD_PLANS[this.selectedPlanIndex]!;
    this.createSummaryText?.setText(
      this.fmt(this.txt("summaryTemplate", "{claims} claims · {min}-{max} GAS each · {hours}h expiry"), {
        claims: plan.maxClaims,
        min: plan.minClaim,
        max: plan.maxClaim,
        hours: plan.expiryHours,
      }),
    );
  }

  private progressLabel(progress: string, status: string): string {
    const bundleKey = PROGRESS_BUNDLE_KEY[progress] ?? PROGRESS_BUNDLE_KEY[status];
    if (bundleKey) {
      return this.txt(bundleKey, PROGRESS_LABEL[progress] ?? PROGRESS_LABEL[status] ?? "");
    }
    return this.txt("readyToUnwrap", "Ready to unwrap");
  }

  preload(): void {
    this.load.image(GAS_POOL_ASSETS.vaultStage, "./gas-vault-stage.webp");
    this.load.image(GAS_POOL_ASSETS.gasIcon, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();

    this.buildBackground(DESIGN_W, DESIGN_H);
    this.buildHero(DESIGN_W);
    this.buildResultPill(DESIGN_W);
    this.buildModeTabs(DESIGN_W);
    this.buildCreatePanel(DESIGN_W);
    this.buildClaimPanel(DESIGN_W);
    this.buildStatus(DESIGN_W, DESIGN_H);
    this.fitCameraToHost();
    this.switchMode("create");
    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onStateUpdate(_state: GameState): void {
    this.applyLocale();

    const claimKey = this.str("currentClaimKey", "");
    const poolId = this.str("currentPoolId", "");
    const range = this.str("currentRange", "") || this.txt("rangeDefault", "1-50 GAS");
    const progress = this.str("claimProgress", "");
    const status = this.str("claimStatus", "");
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

    const gasUnit = this.txt("gasUnit", "GAS");
    const rewardStr = amount && amount !== "0" ? formatGas(amount, 4) : "";
    const luckSuffix = luck
      ? `  ${this.fmt(this.txt("luckTemplate", "{percent}% luck"), { percent: luck })}`
      : "";
    const rewardKey = rewardStr ? `+${rewardStr} ${gasUnit}` : "";
    const isNewReward = Boolean(rewardStr) && rewardKey !== this.lastRewardText;

    this.setResultState(Boolean(rewardStr), Boolean(lastError));

    this.claimKeyText.setText(
      claimKey
        ? truncateMiddle(claimKey)
        : poolId
          ? this.fmt(this.txt("poolNumberTemplate", "Pool #{id}"), { id: poolId })
          : this.txt("openClaimLink", "Open a OneGate claim link"),
    );
    this.claimRangeText.setText(range || this.txt("rangePending", "Reward range updates after loading"));
    this.claimProgressText.setText(this.progressLabel(progress, status));

    this.statusText.setText(
      compactError(lastError) ||
        (lastTxid
          ? this.fmt(this.txt("latestTxTemplate", "Latest tx {tx}"), { tx: truncateMiddle(lastTxid, 8, 6) })
          : "") ||
        this.txt("statusIdle", "OneGate-ready GAS reward vault"),
    );

    this.updateButtons();
    this.updateCoinMotion();

    const progressKey = progress || status;
    if (progressKey !== this.lastProgressKey) {
      this.lastProgressKey = progressKey;
      if (progressKey === "submitting" || progressKey === "submitted" || progressKey === "confirming") {
        this.sfx.play("tick");
      }
    }

    if (lastError && lastError !== this.lastErrorCue) {
      this.sfx.play("error");
    }
    this.lastErrorCue = lastError;

    if (isNewReward) {
      // The signature lucky-draw beat: roll the reward number up and shimmer the
      // ticket coin before it settles (reduced-motion falls back to the final
      // value instantly via animateCounter / this.tween).
      this.lastRewardText = rewardKey;
      this.sfx.play("win");
      this.spawnRewardBurst();
      this.revealReward(rewardStr, luckSuffix);
    } else if (!this.rewardRolling) {
      this.resultText.setText(
        rewardStr
          ? `+${rewardStr} ${gasUnit}${luckSuffix}`
          : this.txt("tagline", "Pack a vault. Share a claim. Let GAS land."),
      );
      if (!rewardStr) this.lastRewardText = "";
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
    // Hero is scaled down a touch (aspect preserved — 330/360 ≈ 218/238) so a
    // clean gap opens between the photo's bottom rim and the result pill below.
    this.vaultGlow = this.add.ellipse(W / 2, 136, 268, 158, C.gold, 0.18);
    this.heroImage = this.add.image(W / 2, 138, GAS_POOL_ASSETS.vaultStage)
      .setDisplaySize(330, 218)
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

    // A restrained 3-coin foreground tray at the podium base. Fewer coins at
    // lower opacity read as a distinct front accent instead of competing with
    // the spilling coins already in the stock hero photo.
    for (let i = 0; i < 3; i += 1) {
      const coin = this.makeGasBadge(W / 2 + (i - 1) * 34, 220 + (i % 2 === 0 ? 6 : 0), 22)
        .setAlpha(0.5);
      this.coinStream.push(coin);
      this.animate({
        targets: coin,
        y: coin.y - 7,
        angle: i % 2 === 0 ? 8 : -8,
        duration: 1200 + i * 110,
        delay: i * 90,
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
    // Sits a few px lower than the shrunk hero so its top edge clears the photo.
    this.resultPill = this.add.container(W / 2, 272);
    const bg = this.add.graphics();
    bg.fillStyle(C.surface, 0.94);
    bg.fillRoundedRect(-165, -22, 330, 44, 22);
    bg.lineStyle(1, C.stroke, 0.86);
    bg.strokeRoundedRect(-165, -22, 330, 44, 22);

    this.resultCoin = this.makeGasBadge(-140, 0, 28);
    this.resultText = this.add.text(-108, 0, "", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#6f5a37",
      fontStyle: "500",
      fixedWidth: 242,
    }).setOrigin(0, 0.5);

    this.resultPill.add([bg, this.resultCoin, this.resultText]);
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
    this.createHeadingText = this.add.text(W / 2, 355, "Choose a reward pack", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#2a2117",
      fontStyle: "600",
    }).setOrigin(0.5);
    this.createPanel.add(this.createHeadingText);

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

    this.createButton = this.makeActionButton(W / 2, 528, "Pack vault", "primary");
    this.createButtonBg = this.createButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.createButtonLabel = this.createButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.createButtonBg, {
      targets: this.createButton,
      enabled: () => !this.busy,
      pressScale: 0.97,
      onPress: () => {
        this.sfx.play("start");
        this.dispatchCreate();
      },
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
      onPress: () => {
        this.sfx.play("select");
        this.selectPlan(index, true);
      },
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
      color: "#7a623a",
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
    card.setData("gas", gas);
    card.setData("detail", detail);
    return card;
  }

  private selectPlan(index: number, animate: boolean): void {
    this.selectedPlanIndex = index;
    this.planCards.forEach((card, cardIndex) => this.renderPlanCard(card, cardIndex === index));

    this.updatePlanSummary();
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
    this.claimHeadingText = this.add.text(W / 2, 356, "Unwrap your reward", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#2a2117",
      fontStyle: "600",
    }).setOrigin(0.5);
    this.claimPanel.add(this.claimHeadingText);

    const ticket = this.add.container(W / 2, 421);
    const ticketBg = this.add.graphics();
    ticketBg.fillStyle(C.surface, 0.97);
    ticketBg.fillRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.95);
    ticketBg.strokeRoundedRect(-150, -48, 300, 96, 22);
    ticketBg.lineStyle(1, C.stroke, 0.5);
    ticketBg.lineBetween(-118, -48, -118, 48);
    ticketBg.lineBetween(118, -48, 118, 48);

    this.claimTicketCoin = this.makeGasBadge(-124, -15, 36);
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

    ticket.add([ticketBg, this.claimTicketCoin, this.claimKeyText, this.claimRangeText, this.claimProgressText]);
    this.claimPanel.add(ticket);

    this.checkButton = this.makeActionButton(W / 2 - 72, 515, "Check", "secondary", 122);
    this.checkButtonBg = this.checkButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.checkButtonLabel = this.checkButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.checkButtonBg, {
      targets: this.checkButton,
      enabled: () => this.hasClaimKey && !this.busy,
      pressScale: 0.97,
      onPress: () => {
        this.sfx.play("tap");
        this.dispatchCheckClaim();
      },
    });

    this.claimButton = this.makeActionButton(W / 2 + 76, 515, "Claim", "primary", 154);
    this.claimButtonBg = this.claimButton.getData("bg") as Phaser.GameObjects.Graphics;
    this.claimButtonLabel = this.claimButton.getData("label") as Phaser.GameObjects.Text;
    this.bindGameButton(this.claimButtonBg, {
      targets: this.claimButton,
      enabled: () => this.hasClaimContext && !this.busy,
      pressScale: 0.97,
      onPress: () => {
        this.sfx.play("chip");
        this.dispatchClaim();
      },
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
      this.createButtonLabel.setText(
        this.busy ? this.txt("actionWorking", "Working...") : this.txt("actionPack", "Pack vault"),
      );
      this.renderActionButton(this.createButton, createEnabled);
    }
    if (this.claimButton) {
      this.claimButtonLabel.setText(
        this.busy
          ? this.txt("actionClaiming", "Claiming...")
          : this.hasClaimContext
            ? this.txt("actionClaim", "Claim")
            : this.txt("actionNoLink", "No link"),
      );
      this.renderActionButton(this.claimButton, claimEnabled);
    }
    if (this.checkButton) {
      this.checkButtonLabel.setText(this.busy ? this.txt("actionWait", "Wait") : this.txt("actionCheck", "Check"));
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
      coin.setAlpha(active ? 0.85 : 0.5);
      if (!active) return;
      coin.setRotation(Phaser.Math.DegToRad((this.time.now / 28 + index * 36) % 360));
    });
  }

  private spawnRewardBurst(): void {
    for (let i = 0; i < 16; i += 1) {
      const coin = this.makeGasBadge(DESIGN_W / 2, 248, 24)
        .setAlpha(0.95);
      this.animate({
        targets: coin,
        x: DESIGN_W / 2 + Phaser.Math.Between(-145, 145),
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

  /**
   * Lucky-draw reveal: roll the reward number up to its final value while the
   * ticket/result coins shimmer, then settle on the exact formatted amount.
   * animateCounter and this.tween both honor reduced-motion (they jump straight
   * to the end state), so no motion is forced on users who opted out.
   */
  private revealReward(finalStr: string, luckSuffix: string): void {
    const gasUnit = this.txt("gasUnit", "GAS");
    const finalNum = Number(finalStr);
    const setLine = (text: string): void => {
      this.resultText.setText(`+${text} ${gasUnit}${luckSuffix}`);
    };

    this.shimmerCoin(this.resultCoin);
    if (this.activeMode === "claim") this.shimmerCoin(this.claimTicketCoin);

    if (!Number.isFinite(finalNum) || finalNum <= 0) {
      this.rewardRolling = false;
      setLine(finalStr);
      return;
    }

    this.rewardRolling = true;
    this.animateCounter({
      from: 0,
      to: finalNum,
      duration: 720,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = Number(tween.getValue());
        setLine(value >= finalNum ? finalStr : value.toFixed(value < 10 ? 2 : 1));
      },
      onComplete: () => {
        this.rewardRolling = false;
        setLine(finalStr);
      },
    });
  }

  private shimmerCoin(coin?: Phaser.GameObjects.Container): void {
    if (!coin) return;
    this.tween({
      targets: coin,
      angle: { from: 0, to: 360 },
      duration: 640,
      ease: "Cubic.easeOut",
    });
    this.tween({
      targets: coin,
      scale: { from: 0.7, to: 1 },
      duration: 460,
      ease: "Back.easeOut",
    });
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);

    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, DESIGN_H / 2);
  }
}
