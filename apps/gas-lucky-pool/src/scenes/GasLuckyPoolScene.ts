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
import { formatGas, formatHash } from "@shared/utils/format";
import { GAS_LUCKY_REWARD_PLANS } from "../logic/game-rules";

const GAS_POOL_ASSETS = {
  vaultStage: "gas-pool-vault-stage",
  wheel: "gas-pool-wheel",
  gasIcon: "gas-pool-gas-icon",
  guestIcon: "gas-pool-guest-icon",
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
const FX_GLOW_KEY = "gas-pool-fx-glow";
const FX_SPARK_KEY = "gas-pool-fx-spark";
const DESIGN_W = 420;
const DESIGN_H = 580;
const MODE_BUTTON_W = 134;
const MODE_BUTTON_H = 34;

type Mode = "create" | "claim";

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

/** Middle-truncation for keys/txids (delegates to the shared formatter). */
function truncateMiddle(value: string, head = 7, tail = 4): string {
  return formatHash(value, head, tail);
}

function compactError(value: string): string {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > 58 ? `${firstLine.slice(0, 55)}...` : firstLine;
}

export class GasLuckyPoolScene extends BaseScene {
  private heroImage!: Phaser.GameObjects.Image;
  private vaultBg!: Phaser.GameObjects.Image;
  private vaultGlow!: Phaser.GameObjects.Ellipse;
  private backgroundGlows: Phaser.GameObjects.Ellipse[] = [];
  private coinStream: Phaser.GameObjects.Container[] = [];
  private coinMarks: Phaser.GameObjects.Image[] = [];

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
  private lastRewardEventKey = "";
  private lastProgressKey = "";
  private lastErrorCue = "";
  private rewardRolling = false;
  private rewardRevealSequence = 0;
  private rewardBurstCoins: Phaser.GameObjects.Container[] = [];
  private lastA11yPlanRevision = 0;

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
    const isGuest = this.str("appMode", "gamefi") === "guest";
    const fundText = this.modeButtons.get("create")?.getData("text") as Phaser.GameObjects.Text | undefined;
    const claimText = this.modeButtons.get("claim")?.getData("text") as Phaser.GameObjects.Text | undefined;
    fundText?.setText(this.txt("tabFund", "Fund vault"));
    claimText?.setText(this.txt("tabClaim", "Claim GAS"));

    this.createHeadingText?.setText(this.txt("choosePack", "Choose a reward pack"));
    this.claimHeadingText?.setText(this.txt("unwrapTitle", "Unwrap your reward"));

    const slotsTemplate = this.txt("slotsTemplate", "{count} claims");
    const gasUnit = this.txt("gasUnit", "GAS");
    this.planCards.forEach((card, index) => {
      const plan = GAS_LUCKY_REWARD_PLANS[index]!;
      (card.getData("title") as Phaser.GameObjects.Text | undefined)?.setText(
        this.txt(plan.sceneTitleKey, plan.fallbackTitle),
      );
      (card.getData("detail") as Phaser.GameObjects.Text | undefined)?.setText(
        this.fmt(slotsTemplate, { count: plan.maxClaims }),
      );
      (card.getData("gas") as Phaser.GameObjects.Text | undefined)?.setText(gasUnit);
      (card.getData("amount") as Phaser.GameObjects.Text | undefined)?.setText(
        isGuest ? plan.maxClaim : plan.amount,
      );
    });

    this.updatePlanSummary();
  }

  private updatePlanSummary(): void {
    const plan = GAS_LUCKY_REWARD_PLANS[this.selectedPlanIndex]!;
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
    this.load.image(GAS_POOL_ASSETS.wheel, "./wheel.webp");
    this.load.image(GAS_POOL_ASSETS.gasIcon, officialGasTokenPhaserUrl);
    this.load.image(GAS_POOL_ASSETS.guestIcon, "./onegate-logo.webp");
  }

  create(): void {
    super.create();

    this.buildBackground(DESIGN_W, DESIGN_H);
    this.ensureFxTextures();
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
    const range = this.str("currentRange", "") || this.txt("rangeDefault", "0–50 GAS");
    const progress = this.str("claimProgress", "");
    const status = this.str("claimStatus", "");
    const lastError = this.str("lastError", "");
    const lastTxid = this.str("lastTxid", "");
    const amount = this.str("lastClaimAmount", "0");
    const luck = this.str("lastClaimLuckPercent", "");
    const appMode = this.str("appMode", "gamefi");
    const isGuest = appMode === "guest";
    const guestDraws = this.num("guestDraws", 0);
    const a11yPlanRevision = this.num("a11yPlanRevision", 0);
    const coinTexture = appMode === "guest" ? GAS_POOL_ASSETS.guestIcon : GAS_POOL_ASSETS.gasIcon;
    this.coinMarks = this.coinMarks.filter((mark) => mark.active);
    this.coinMarks.forEach((mark) => mark.setTexture(coinTexture));

    for (const button of this.modeButtons.values()) button.setVisible(!isGuest);
    this.createPanel.setY(isGuest ? -18 : 0);
    if (isGuest && this.activeMode !== "create") this.switchMode("create");

    if (a11yPlanRevision > this.lastA11yPlanRevision) {
      this.lastA11yPlanRevision = a11yPlanRevision;
      const requestedIndex = Math.max(
        0,
        Math.min(
          GAS_LUCKY_REWARD_PLANS.length - 1,
          Math.round(this.num("a11yPlanIndex", this.selectedPlanIndex)),
        ),
      );
      this.selectPlan(requestedIndex, false, false);
    }

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
    const rewardEventKey = rewardStr
      ? appMode === "guest"
        ? `${rewardKey}:draw:${guestDraws}`
        : `${rewardKey}:claim:${lastTxid || claimKey || poolId}`
      : "";
    const isNewReward = Boolean(rewardEventKey) && rewardEventKey !== this.lastRewardEventKey;

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
      this.lastRewardEventKey = rewardEventKey;
      this.sfx.play("win");
      this.playVaultReveal();
      this.spawnRewardBurst();
      if (!this.reducedMotion) this.cameras.main.shake(180, 0.005);
      this.revealReward(rewardStr, luckSuffix);
    } else if (!this.rewardRolling) {
      this.resultText.setText(
        rewardStr
          ? `+${rewardStr} ${gasUnit}${luckSuffix}`
          : this.txt("tagline", "Pack a vault. Share a claim. Let GAS land."),
      );
      if (!rewardStr) this.lastRewardEventKey = "";
    }
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusText.setText(
      compactError(error.message) || this.txt("actionError", "The vault action could not be completed."),
    );
    this.setResultState(false, true);
  }

  private buildBackground(W: number, H: number): void {
    // Real vault stage art (mint-gold treasure chest) as background layer
    this.vaultBg = this.add.image(W / 2, H / 2, GAS_POOL_ASSETS.vaultStage)
      .setDisplaySize(W, H)
      .setDepth(-10);

    // Atmospheric glow overlays for depth (kept from original design)
    const topGlow = this.add.ellipse(W / 2, 112, 390, 250, 0xffe1a3, 0.34);
    const lowerGlow = this.add.ellipse(W / 2, 360, 380, 260, 0xd8f6df, 0.22);
    this.backgroundGlows = [topGlow, lowerGlow];
    this.startBackgroundMotion();
  }

  private startBackgroundMotion(): void {
    if (this.reducedMotion || this.backgroundGlows.length === 0) return;
    this.tweens.killTweensOf(this.backgroundGlows);
    this.animate({
      targets: this.backgroundGlows,
      alpha: { from: 0.24, to: 0.42 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

  }

  private buildHero(W: number): void {
    // Hero is scaled down a touch (aspect preserved — 330/360 ≈ 218/238) so a
    // clean gap opens between the photo's bottom rim and the result pill below.
    this.vaultGlow = this.add.ellipse(W / 2, 134, 232, 232, C.gold, 0.18);
    this.heroImage = this.add.image(W / 2, 134, GAS_POOL_ASSETS.wheel)
      .setDisplaySize(142, 142)
      .setOrigin(0.5);

    this.startVaultGlowMotion();

    // A restrained 3-coin foreground tray at the podium base. Fewer coins at
    // lower opacity read as a distinct front accent instead of competing with
    // the spilling coins already in the stock hero photo.
    for (let i = 0; i < 3; i += 1) {
      const coin = this.makeGasBadge(W / 2 + (i - 1) * 34, 220 + (i % 2 === 0 ? 6 : 0), 22)
        .setAlpha(0.5);
      coin.setData("restY", coin.y);
      this.coinStream.push(coin);
      this.startCoinIdleMotion(coin, i);
    }
  }

  private startVaultGlowMotion(): void {
    if (this.reducedMotion || !this.vaultGlow) return;
    this.tweens.killTweensOf(this.vaultGlow);
    this.vaultGlow.setScale(1).setAlpha(0.18);
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
  }

  private startCoinIdleMotion(coin: Phaser.GameObjects.Container, index: number): void {
    if (this.reducedMotion || !coin.active) return;
    this.tweens.killTweensOf(coin);
    const restY = Number(coin.getData("restY") ?? coin.y);
    coin.setY(restY);
    this.animate({
      targets: coin,
      y: restY - 7,
      angle: index % 2 === 0 ? 8 : -8,
      duration: 1200 + index * 110,
      delay: index * 90,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private makeGasBadge(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const badge = this.add.container(x, y);
    const texture = this.str("appMode", "guest") === "guest"
      ? GAS_POOL_ASSETS.guestIcon
      : GAS_POOL_ASSETS.gasIcon;
    const mark = this.add.image(0, 0, texture)
      .setDisplaySize(size, size)
      .setOrigin(0.5);
    this.coinMarks.push(mark);
    badge.add(mark);
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
    const nextMode = this.str("appMode", "gamefi") === "guest" ? "create" : mode;
    this.activeMode = nextMode;
    this.createPanel?.setVisible(nextMode === "create");
    this.claimPanel?.setVisible(nextMode === "claim");

    for (const [key, button] of this.modeButtons) {
      const active = key === nextMode;
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

    GAS_LUCKY_REWARD_PLANS.forEach((_, index) => {
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

    this.selectPlan(this.selectedPlanIndex, false, false);
  }

  private makePlanCard(x: number, y: number, index: number): Phaser.GameObjects.Container {
    const plan = GAS_LUCKY_REWARD_PLANS[index]!;
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.setInteractive(new Phaser.Geom.Rectangle(-56, -48, 112, 96), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: card,
      pressScale: 0.96,
      onPress: () => {
        this.sfx.play("select");
        this.selectPlan(index, true, true);
      },
    });

    const title = this.add.text(0, -33, plan.fallbackTitle, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#6f5a37",
      fontStyle: "600",
    }).setOrigin(0.5);
    const planCoin = this.makeGasBadge(-24, -7, 23);
    const amount = this.add.text(15, -8, `${plan.amount}`, {
      fontFamily: FONT,
      fontSize: "21px",
      color: "#2a2117",
      fontStyle: "600",
    }).setOrigin(0.5);
    const gas = this.add.text(15, 12, "GAS", {
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

    card.add([bg, title, planCoin, amount, gas, detail]);
    card.setData("bg", bg);
    card.setData("title", title);
    card.setData("amount", amount);
    card.setData("gas", gas);
    card.setData("detail", detail);
    return card;
  }

  private selectPlan(index: number, animate: boolean, syncSemanticControl: boolean): void {
    this.selectedPlanIndex = index;
    this.planCards.forEach((card, cardIndex) => this.renderPlanCard(card, cardIndex === index));

    this.updatePlanSummary();
    if (syncSemanticControl && this.str("appMode", "gamefi") === "guest") {
      this.dispatch("selectGuestPlan", { index });
    }
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
    const plan = GAS_LUCKY_REWARD_PLANS[this.selectedPlanIndex]!;
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
      if (!active || this.reducedMotion) {
        coin.setRotation(0);
        return;
      }
      coin.setRotation(Phaser.Math.DegToRad((this.time.now / 28 + index * 36) % 360));
    });
  }

  private playVaultReveal(): void {
    this.tweens.killTweensOf([this.heroImage, this.vaultGlow]);
    this.heroImage.setScale(1).setAngle(0);
    this.vaultGlow.setScale(1).setAlpha(0.22);
    if (this.reducedMotion) return;

    // NO scale pulse — the wheel must not appear to "grow" on reveal.
    // Suspenseful, clearly-decelerating spin: 2 turns over 3.2s.
    this.tween({
      targets: this.heroImage,
      angle: 720,
      duration: 3200,
      ease: "Cubic.easeOut",
      onComplete: () => this.heroImage.setAngle(0),
    });
    this.tween({
      targets: this.vaultGlow,
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      alpha: { from: 0.22, to: 0.34 },
      duration: 900,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => this.startVaultGlowMotion(),
    });
  }

  // ── FX primitives (runtime-generated textures, no asset files) ─────────────
  private ensureFxTextures(): void {
    if (!this.textures.exists(FX_GLOW_KEY)) {
      const size = 128;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const steps = 26;
      for (let i = steps; i >= 1; i--) {
        const r = (size / 2) * (i / steps);
        const a = 0.5 * (1 - i / steps) + 0.015;
        g.fillStyle(0xffffff, a);
        g.fillCircle(size / 2, size / 2, r);
      }
      g.generateTexture(FX_GLOW_KEY, size, size);
      g.destroy();
    }
    if (!this.textures.exists(FX_SPARK_KEY)) {
      const s = 16;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(s / 2, 0),
          new Phaser.Geom.Point(s * 0.62, s * 0.38),
          new Phaser.Geom.Point(s, s / 2),
          new Phaser.Geom.Point(s * 0.62, s * 0.62),
          new Phaser.Geom.Point(s / 2, s),
          new Phaser.Geom.Point(s * 0.38, s * 0.62),
          new Phaser.Geom.Point(0, s / 2),
          new Phaser.Geom.Point(s * 0.38, s * 0.38),
        ],
        true,
      );
      g.generateTexture(FX_SPARK_KEY, s, s);
      g.destroy();
    }
  }

  private emitSparkles(
    x: number,
    y: number,
    color: number,
    count: number,
    depth = 900,
  ): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(26, 66);
      const spark = this.add
        .image(x, y, FX_SPARK_KEY)
        .setTint(color)
        .setDepth(depth)
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1))
        .setAlpha(0.95);
      this.animate({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 10,
        alpha: 0,
        scale: 0.2,
        angle: Phaser.Math.Between(-120, 120),
        duration: Phaser.Math.Between(420, 720),
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private beamReveal(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
    const beam = this.add
      .image(x, y - 12, FX_GLOW_KEY)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(880)
      .setAlpha(0.85)
      .setScale(0.18, 0.55);
    this.animate({
      targets: beam,
      scaleX: 1.35,
      scaleY: 3.4,
      y: y - 76,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => beam.destroy(),
    });
  }

  private spawnRewardBurst(): void {
    this.rewardBurstCoins.forEach((coin) => coin.destroy());
    this.rewardBurstCoins = [];
    if (this.reducedMotion) {
      this.resultPill.setScale(1);
      return;
    }
    for (let i = 0; i < 16; i += 1) {
      const coin = this.makeGasBadge(DESIGN_W / 2, 248, 24)
        .setAlpha(0.95);
      this.rewardBurstCoins.push(coin);
      this.animate({
        targets: coin,
        x: DESIGN_W / 2 + Phaser.Math.Between(-145, 145),
        y: 118 + Phaser.Math.Between(-18, 110),
        angle: Phaser.Math.Between(-220, 220),
        alpha: { from: 1, to: 0 },
        duration: 900 + i * 22,
        delay: i * 35,
        ease: "Cubic.easeOut",
        onComplete: () => {
          coin.destroy();
          this.rewardBurstCoins = this.rewardBurstCoins.filter((item) => item !== coin);
        },
      });
    }
    this.animate({
      targets: this.resultPill,
      scaleX: { from: 1.03, to: 1 },
      scaleY: { from: 1.03, to: 1 },
      duration: 260,
      ease: "Back.easeOut",
    });
    // Golden sparkle crown + an upward light beam for extra win punch.
    this.emitSparkles(DESIGN_W / 2, 134, C.gold, 14, 900);
    this.beamReveal(DESIGN_W / 2, 134, C.gold);
  }

  /**
   * Lucky-draw reveal: roll the reward number up to its final value while the
   * ticket/result coins shimmer, then settle on the exact formatted amount.
   * animateCounter and this.tween both honor reduced-motion (they jump straight
   * to the end state), so no motion is forced on users who opted out.
   */
  private revealReward(finalStr: string, luckSuffix: string): void {
    const revealSequence = ++this.rewardRevealSequence;
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
        if (revealSequence !== this.rewardRevealSequence) return;
        const value = Number(tween.getValue());
        setLine(value >= finalNum ? finalStr : value.toFixed(value < 10 ? 2 : 1));
      },
      onComplete: () => {
        if (revealSequence !== this.rewardRevealSequence) return;
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

  protected onReducedMotionChange(enabled: boolean): void {
    if (!this.heroImage || !this.resultPill) return;

    if (!enabled) {
      this.startBackgroundMotion();
      this.startVaultGlowMotion();
      this.coinStream.forEach((coin, index) => this.startCoinIdleMotion(coin, index));
      return;
    }

    this.rewardRevealSequence += 1;
    this.rewardRolling = false;
    this.tweens.killTweensOf([
      this.heroImage,
      this.vaultGlow,
      this.resultPill,
      this.resultCoin,
      this.claimTicketCoin,
      ...this.backgroundGlows,
      ...this.coinStream,
      ...this.rewardBurstCoins,
    ]);
    this.rewardBurstCoins.forEach((coin) => coin.destroy());
    this.rewardBurstCoins = [];
    this.heroImage.setScale(1).setAngle(0);
    this.vaultGlow.setScale(1).setAlpha(0.22);
    this.backgroundGlows.forEach((glow) => glow.setScale(1).setAlpha(0.3));
    this.coinStream.forEach((coin) => {
      coin.setY(Number(coin.getData("restY") ?? coin.y)).setAngle(0);
    });
    this.resultPill.setScale(1);
    this.resultCoin.setScale(1).setAngle(0);
    this.claimTicketCoin?.setScale(1).setAngle(0);

    const amount = this.str("lastClaimAmount", "0");
    const reward = amount && amount !== "0" ? formatGas(amount, 4) : "";
    const luck = this.str("lastClaimLuckPercent", "");
    const suffix = luck
      ? `  ${this.fmt(this.txt("luckTemplate", "{percent}% luck"), { percent: luck })}`
      : "";
    this.resultText.setText(
      reward
        ? `+${reward} ${this.txt("gasUnit", "GAS")}${suffix}`
        : this.txt("tagline", "Pack a vault. Share a claim. Let GAS land."),
    );
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
