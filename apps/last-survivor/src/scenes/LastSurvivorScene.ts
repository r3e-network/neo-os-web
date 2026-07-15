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
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";
import {
  getLastSurvivorTransactionGate,
  type LastSurvivorGateReason,
  type LastSurvivorTransactionGate,
} from "../logic/transaction-gate";

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
  green: 0x0c8150,
  greenSoft: 0xdff7e8,
  orange: 0xf28a2e,
  red: 0xd84d3f,
  disabled: 0xd9cbb7,
  white: 0xffffff,
} as const;

const FONT = "Inter, Arial, sans-serif";
const DESIGN_W = 420;
const DESIGN_H = 600;
const KEY_PRESETS = ["1", "3", "5", "10"] as const;

// Timer console geometry — a floating HUD that overlaps the arena's lower third
// yet clears the controls card (top y=336). Kept as constants so the danger
// elements never poke above the panel edge.
const CONSOLE_TOP = 216;
const CONSOLE_H = 112;
const COUNTDOWN_Y = 250;
const SUBTEXT_Y = 285;
const LEADER_Y = 303;
const METER_Y = 317;

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
  private potIcon!: Phaser.GameObjects.Image;
  private roundBadgeIcon!: Phaser.GameObjects.Image;

  private potText!: Phaser.GameObjects.Text;
  private prizePoolText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private timerSubtext!: Phaser.GameObjects.Text;
  private dangerMeter!: Phaser.GameObjects.Graphics;
  private dangerHalo!: Phaser.GameObjects.Graphics;
  private leaderText!: Phaser.GameObjects.Text;
  private choosePackText!: Phaser.GameObjects.Text;
  private totalKeysText!: Phaser.GameObjects.Text;
  private userKeysText!: Phaser.GameObjects.Text;
  private costText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private noticeText!: Phaser.GameObjects.Text;
  private dangerPulse: Phaser.Tweens.Tween | null = null;

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
  private lastNeedsSync = false;
  private lastDangerTier = 0;
  private lastUserKeys = -1;
  private lastGuestLeader = "";

  constructor() {
    super("LastSurvivorScene");
  }

  preload(): void {
    this.load.image(SURVIVOR_ASSETS.arena, "./last-survivor-arena.webp");
    this.load.image(SURVIVOR_ASSETS.logo, "./logo.webp");
    this.load.image(SURVIVOR_ASSETS.gasIcon, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();

    this.buildBackground(DESIGN_W, DESIGN_H);
    this.buildHero(DESIGN_W);
    this.buildHud(DESIGN_W);
    this.buildTimerConsole(DESIGN_W);
    this.buildControls(DESIGN_W, DESIGN_H);
    this.buildStatus(DESIGN_W, DESIGN_H);
    this.fitCameraToHost();
    this.startAmbientMotion();
    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onStateUpdate(_state: GameState): void {
    const countdown = this.str("countdown", "00:00:00");
    const pot = this.str("totalPotDisplay", "0.00 GAS");
    const roundStatus = this.str("roundStatusDisplay", "");
    const dangerText = this.str("dangerLevelText", "");
    const leader = this.str("lastBuyerLabel", "--");
    const cost = this.str("estimatedCost", "0.00");
    const validation = this.str("keyValidationError", "");
    // Guest is a purely local drill — nothing is at stake, so the per-key GAS
    // cost is replaced by a neutral local label (all other copy arrives
    // pre-localized + mode-aware through the bridge from PhaserPlayArea).
    const guestMode = this.str("appMode", "gamefi") === "guest";
    const bridgeKeyCount = this.str("keyCount", this.selectedKeyCount);
    const dangerPct = clampPct(this.num("dangerProgress", 0));
    const totalKeys = this.num("totalKeys", this.num("totalKeysDisplay", 0));
    const userKeys = this.num("userKeys", 0);
    const isRoundActive = this.bool("isRoundActive");
    const isBuying = this.bool("isBuyingKeys");
    const isSettling = this.bool("isSettling");
    const needsLifecycleSync = this.bool("needsLifecycleSync");
    const guestLeader = this.str("guestLeaderLabel", "");

    if (KEY_PRESETS.includes(bridgeKeyCount as (typeof KEY_PRESETS)[number])) {
      this.selectedKeyCount = bridgeKeyCount;
    }

    this.prizePoolText.setText(this.str("scenePrizePool", "Prize pool"));
    this.potIcon.setTexture(guestMode ? SURVIVOR_ASSETS.logo : SURVIVOR_ASSETS.gasIcon);
    this.choosePackText.setText(this.str("sceneChoosePack", "Choose key pack"));
    this.potText.setText(pot);
    this.roundText.setText(
      needsLifecycleSync
        ? this.str("sceneRolloverReady", "Rollover ready")
        : roundStatus ||
        (isRoundActive
          ? this.str("sceneLiveRound", "Live round")
          : this.str("sceneWaitingRound", "Waiting for round")),
    );
    // Status width just changed — keep the badge clear of it.
    this.layoutRoundBadge();
    this.countdownText.setText(needsLifecycleSync ? this.str("sceneSettleWord", "Settle") : countdown);
    this.timerSubtext.setText(
      needsLifecycleSync
        ? this.str("sceneReadyToPay", "Last buyer can be paid now")
        : isRoundActive
          ? (dangerText || this.str("scenePressToStay", "Press to stay alive"))
          : this.str("sceneRoundAfterSync", "Round will open after sync"),
    );
    // Leader line arrives pre-formatted + localized from the shell; it already
    // resolves the no-buyer / N/A fallback, so an idle round reads friendly.
    this.leaderText.setText(this.str("sceneLeaderLine", leader && leader !== "--" ? leader : "No buyer yet"));
    this.totalKeysText.setText(this.str("sceneKeysSoldLine", `${totalKeys} keys sold`));
    this.userKeysText.setText(this.str("sceneYoursLine", `${userKeys} yours`));
    this.costText.setText(guestMode ? this.str("sceneGuestCost", "Local · no cost") : `${cost} GAS`);

    const gate = this.transactionGate();
    this.statusText.setText(
      validation
        ? compactError(validation)
        : this.gateStatus(gate.reason),
    );
    this.statusText.setColor(
      validation || gate.reason === "service-unavailable"
        ? "#b42318"
        : gate.reason === "insufficient-gas" || gate.reason === "settle-required"
          ? "#8a570f"
          : "#806f56",
    );
    this.noticeText.setText(
      isBuying
        ? this.str("sceneNoticeBuying", "Wallet confirmation in progress...")
        : isSettling
          ? this.str("sceneNoticeSettling", "Settling round...")
          : "",
    );

    this.renderDanger(dangerPct);
    this.renderPresets();
    this.renderButtons();

    // Doomsday escalation: the danger glow breathes once the clock is nearly
    // out (shell shouldPulse, or the danger meter is in the red band).
    const critical = dangerPct > 72;
    this.countdownText.setColor(!needsLifecycleSync && critical ? "#d84d3f" : "#2b2418");
    this.setDangerPulse(isRoundActive && !needsLifecycleSync && (this.bool("shouldPulse") || critical));

    if (isBuying && !this.lastBuying) this.playBuyMotion();
    if (isSettling && !this.lastSettling) this.playSettleMotion();
    if (!isSettling && this.lastSettling) this.sfx.play("win");
    if (needsLifecycleSync && !this.lastNeedsSync) this.sfx.play("lose");
    this.lastBuying = isBuying;
    this.lastSettling = isSettling;
    this.lastNeedsSync = needsLifecycleSync;

    // Survived another beat: your key count grew after a confirmed buy.
    if (this.lastUserKeys >= 0 && userKeys > this.lastUserKeys && isRoundActive) {
      this.sfx.play("score");
    }
    this.lastUserKeys = userKeys;

    // Local rivals make guest mode a real last-buyer duel. A rival takeover
    // gives a short arena jolt; reclaiming the seat gives a bright score beat.
    if (guestMode && guestLeader && this.lastGuestLeader && guestLeader !== this.lastGuestLeader) {
      this.playLeaderSwap(this.bool("guestLeaderIsPlayer"));
    }
    this.lastGuestLeader = guestMode ? guestLeader : "";

    // Elimination pressure: low warning tone once per danger-tier increase.
    const dangerTier = dangerPct > 72 ? 2 : dangerPct > 42 ? 1 : 0;
    if (dangerTier > this.lastDangerTier && isRoundActive) {
      this.sfx.tones([{ frequency: 196, duration: 0.1, type: "triangle", gain: 0.02, endFrequency: 147 }]);
    }
    this.lastDangerTier = dangerTier;
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.sfx.play("error");
    this.statusText?.setText(
      compactError(error.message) || this.str("sceneActionError", "Action failed. Try again."),
    );
    this.statusText?.setColor("#b42318");
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (!this.heroContainer || !this.heroImage) return;

    if (enabled) {
      this.dangerPulse?.stop();
      this.dangerPulse = null;
      this.tweens.killTweensOf([
        this.heroContainer,
        this.heroImage,
        ...this.orbitTokens,
        this.dangerHalo,
      ]);
      this.heroContainer.setY(176).setScale(1);
      this.heroImage.setDisplaySize(366, 236).setAlpha(1);
      this.orbitTokens.forEach((token) => token.setY(57).setScale(1));
      const active = this.bool("isRoundActive") &&
        !this.bool("needsLifecycleSync") &&
        this.bool("shouldPulse");
      this.dangerHalo?.setAlpha(active ? 0.14 : 0);
      return;
    }

    this.startAmbientMotion();
    const active = this.bool("isRoundActive") &&
      !this.bool("needsLifecycleSync") &&
      (this.bool("shouldPulse") || this.num("dangerProgress", 0) > 72);
    this.setDangerPulse(active);
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.canvas);

    const g = this.add.graphics();
    g.fillStyle(0xfff5dc, 1);
    g.fillRoundedRect(14, 14, W - 28, H - 28, 22);
    g.lineStyle(1, C.stroke, 1);
    g.strokeRoundedRect(14, 14, W - 28, H - 28, 22);

    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(26, 336, W - 52, 236, 20);
    g.lineStyle(1, C.stroke, 0.9);
    g.strokeRoundedRect(26, 336, W - 52, 236, 20);
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

  /**
   * Park the round badge immediately left of the round status.
   *
   * The status is right-aligned and its width varies with both state and
   * locale, so a fixed badge x-position can only ever be correct for one
   * string. Re-run this whenever the status text changes.
   */
  private layoutRoundBadge(): void {
    if (!this.roundBadgeIcon || !this.roundText) return;
    const GAP = 12;
    const badgeHalfWidth = this.roundBadgeIcon.displayWidth / 2;
    const statusLeftEdge = this.roundText.x - this.roundText.width;
    this.roundBadgeIcon.setX(statusLeftEdge - GAP - badgeHalfWidth);
  }

  private buildHud(W: number): void {
    const card = this.add.graphics();
    card.fillStyle(C.surface, 0.94);
    card.fillRoundedRect(30, 28, W - 60, 58, 18);
    card.lineStyle(1, C.stroke, 1);
    card.strokeRoundedRect(30, 28, W - 60, 58, 18);

    this.potIcon = this.add.image(58, 57, SURVIVOR_ASSETS.gasIcon).setDisplaySize(28, 28);
    this.potText = this.add.text(82, 45, "0.00 GAS", {
      fontFamily: FONT,
      fontSize: "20px",
      fontStyle: "700",
      color: "#2b2418",
    });
    this.prizePoolText = this.add.text(84, 67, this.str("scenePrizePool", "Prize pool"), {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#806f56",
    });

    this.roundBadgeIcon = this.add.image(W - 148, 57, SURVIVOR_ASSETS.logo).setDisplaySize(30, 30);

    this.roundText = this.add.text(W - 50, 57, "Live round", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "700",
      color: "#0c8150",
    }).setOrigin(1, 0.5);
    // The badge sat at a fixed W-148 while the status is right-aligned at W-50
    // and grows leftward. That fits "Active" but not a longer, localized status
    // ("Waiting for first key"), which then ran straight through the badge. Keep
    // the badge pinned to the left edge of whatever the status actually is.
    this.layoutRoundBadge();

    this.orbitTokens.push(this.potIcon);
  }

  private buildTimerConsole(W: number): void {
    const top = CONSOLE_TOP;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.96);
    panel.fillRoundedRect(48, top, W - 96, CONSOLE_H, 22);
    panel.lineStyle(1, C.stroke, 1);
    panel.strokeRoundedRect(48, top, W - 96, CONSOLE_H, 22);

    // Soft danger glow behind the countdown — invisible at idle, breathes as the
    // clock nears zero (see setDangerPulse). Sits above the panel, below the text.
    this.dangerHalo = this.add.graphics().setAlpha(0);

    // Horizontal doomsday meter along the console floor (track + fill).
    this.dangerMeter = this.add.graphics();

    this.countdownText = this.add.text(W / 2, COUNTDOWN_Y, "00:00:00", {
      fontFamily: FONT,
      fontSize: "34px",
      fontStyle: "800",
      color: "#2b2418",
    }).setOrigin(0.5);

    this.timerSubtext = this.add.text(W / 2, SUBTEXT_Y, this.str("scenePressToStay", "Press to stay alive"), {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#806f56",
    }).setOrigin(0.5);

    this.leaderText = this.add.text(W / 2, LEADER_Y, this.str("sceneLeaderLine", "No buyer yet"), {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#806f56",
    }).setOrigin(0.5);

    this.renderDanger(0);
  }

  private buildControls(W: number, H: number): void {
    this.choosePackText = this.add.text(50, 356, this.str("sceneChoosePack", "Choose key pack"), {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "700",
      color: "#2b2418",
    });

    this.costText = this.add.text(W - 50, 356, "0.00 GAS", {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "700",
      color: "#8a570f",
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
      enabled: () => this.transactionGate().primaryEnabled,
      onPress: () => {
        const gate = this.transactionGate();
        if (!gate.primaryEnabled) return;
        if (gate.primaryAction === "connect") {
          this.sfx.play("tap");
          this.dispatch("connectWallet");
          return;
        }
        if (gate.primaryAction === "buy") {
          this.sfx.play("start");
          this.dispatch("buyKeys", this.selectedKeyCount);
        }
      },
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
      onPress: () => {
        this.sfx.play("tap");
        this.dispatch("settleRound");
      },
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
      fixedWidth: W - 80,
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
    const hint = this.add.text(0, 17, this.presetUnit(value), {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#806f56",
    }).setOrigin(0.5);

    bg.setInteractive(new Phaser.Geom.Rectangle(-34, -30, 68, 60), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: container,
      pressScale: 0.94,
      enabled: () => this.transactionGate().presetsEnabled,
      onPress: () => {
        this.sfx.play("tap");
        this.selectKeyCount(value);
      },
    });

    container.add([bg, label, hint]);
    return { value, container, bg, label, hint };
  }

  private selectKeyCount(value: string): void {
    if (!this.transactionGate().presetsEnabled) return;
    if (this.selectedKeyCount === value) return;
    this.selectedKeyCount = value;
    this.renderPresets();
    this.renderButtons();
    this.dispatch("setKeyCount", value);
  }

  private presetUnit(value: string): string {
    return Number(value) === 1
      ? this.str("sceneKeyUnitOne", "key")
      : this.str("sceneKeyUnitMany", "keys");
  }

  private renderPresets(): void {
    const presetsEnabled = this.transactionGate().presetsEnabled;
    for (const view of this.presetViews) {
      const active = view.value === this.selectedKeyCount;
      view.container.setAlpha(presetsEnabled ? 1 : 0.56);
      view.bg.clear();
      view.bg.fillStyle(active ? C.surfaceWarm : C.surface, 1);
      view.bg.fillRoundedRect(-34, -30, 68, 60, 16);
      view.bg.lineStyle(active ? 2 : 1, active ? C.strokeStrong : C.stroke, 1);
      view.bg.strokeRoundedRect(-34, -30, 68, 60, 16);
      view.label.setColor(active ? "#2b2418" : "#604d35");
      view.hint.setText(this.presetUnit(view.value));
      view.hint.setColor(active ? "#8a570f" : "#806f56");
    }
  }

  private renderButtons(): void {
    const gate = this.transactionGate();
    const primaryEnabled = gate.primaryEnabled;
    const canSettle = gate.settleEnabled;
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
    this.buyButtonBg.fillStyle(primaryEnabled ? C.gold : C.disabled, 1);
    this.buyButtonBg.fillRoundedRect(-buyHalf, -25, buyWidth, 50, 16);
    this.buyButtonBg.lineStyle(2, primaryEnabled ? C.goldDeep : C.stroke, 0.8);
    this.buyButtonBg.strokeRoundedRect(-buyHalf, -25, buyWidth, 50, 16);
    if (primaryEnabled) {
      this.buyButtonBg.fillStyle(0xffffff, 0.18);
      this.buyButtonBg.fillRoundedRect(-buyHalf, -25, buyWidth, 18, { tl: 16, tr: 16, bl: 0, br: 0 });
    }
    this.buyButtonLabel.setText(this.primaryButtonLabel(gate));
    this.buyButtonLabel.setColor(primaryEnabled ? "#3a2609" : "#806f56");

    this.settleButton.setVisible(showSettle);
    this.settleButtonBg.clear();
    this.settleButtonBg.fillStyle(canSettle ? C.green : C.disabled, 1);
    this.settleButtonBg.fillRoundedRect(-61, -25, 122, 50, 16);
    this.settleButtonBg.lineStyle(2, canSettle ? 0x0c8150 : C.stroke, 0.8);
    this.settleButtonBg.strokeRoundedRect(-61, -25, 122, 50, 16);
    this.settleButtonLabel.setText(
      isSettling
        ? this.str("sceneSettling", "Settling...")
        : this.str("appMode", "gamefi") !== "guest" && !this.bool("walletConnected")
          ? this.str("sceneConnectFirst", "Connect first")
          : this.str("sceneSettleWord", "Settle"),
    );
    this.settleButtonLabel.setColor(canSettle ? "#ffffff" : "#806f56");
  }

  private renderDanger(dangerPct: number): void {
    if (!this.dangerMeter) return;
    const pct = Phaser.Math.Clamp(dangerPct / 100, 0, 1);
    const dangerColor = pct > 0.72 ? C.red : pct > 0.42 ? C.orange : C.green;

    const left = 72;
    const width = DESIGN_W - 144; // 276, centred inside the console
    const h = 7;
    const top = METER_Y - h / 2;

    // Clean horizontal doomsday meter: a faint full track plus a colored fill
    // that grows with danger. At idle only the track shows — a deliberate
    // element, not a stray arc.
    this.dangerMeter.clear();
    this.dangerMeter.fillStyle(0xf2e2c2, 1);
    this.dangerMeter.fillRoundedRect(left, top, width, h, h / 2);
    if (pct > 0) {
      const fillW = Math.max(h, width * pct);
      this.dangerMeter.fillStyle(dangerColor, 1);
      this.dangerMeter.fillRoundedRect(left, top, fillW, h, h / 2);
      this.dangerMeter.fillStyle(dangerColor, 0.32);
      this.dangerMeter.fillCircle(left + fillW, METER_Y, 5);
    }

    // The halo tint follows the danger band; its visibility is the pulse's job.
    if (this.dangerHalo) {
      this.dangerHalo.clear();
      this.dangerHalo.fillStyle(dangerColor, 1);
      this.dangerHalo.fillRoundedRect(DESIGN_W / 2 - 128, COUNTDOWN_Y - 30, 256, 60, 18);
    }
  }

  /**
   * Breathe the danger halo behind the countdown when the clock nears zero.
   * Reduced-motion falls back to a static faint tint (no infinite tween).
   */
  private setDangerPulse(active: boolean): void {
    if (!this.dangerHalo) return;
    if (this.reducedMotion) {
      this.dangerPulse?.stop();
      this.dangerPulse = null;
      this.dangerHalo.setAlpha(active ? 0.14 : 0);
      return;
    }
    if (active) {
      if (this.dangerPulse) return;
      this.dangerHalo.setAlpha(0.06);
      this.dangerPulse = this.tweens.add({
        targets: this.dangerHalo,
        alpha: 0.22,
        duration: 640,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (this.dangerPulse) {
      this.dangerPulse.stop();
      this.dangerPulse = null;
      this.dangerHalo.setAlpha(0);
    }
  }

  private transactionGate(): LastSurvivorTransactionGate {
    return getLastSurvivorTransactionGate({
      appMode: this.str("appMode", "gamefi"),
      walletConnected: this.bool("walletConnected"),
      selectedCount: Math.floor(Number(this.selectedKeyCount) || 0),
      estimatedCostGas: this.num("estimatedCostGas", Number(this.str("estimatedCost", "0")) || 0),
      prepaidCredit: this.num("prepaidCredit", 0),
      walletGasBalance: this.num("walletGasBalance", 0),
      roundDataAvailable: this.bool("roundDataAvailable"),
      writeDataAvailable: this.bool("writeDataAvailable"),
      storageHealthy: this.bool("storageHealthy"),
      isRoundActive: this.bool("isRoundActive"),
      needsLifecycleSync: this.bool("needsLifecycleSync"),
      newPaidRoundsEnabled:
        this.str("appMode", "gamefi") === "guest" || this.bool("paidActionsAvailable"),
      hasHistoricalPosition:
        this.bool("purchasePending") ||
        this.bool("needsLifecycleSync") ||
        this.num("prepaidCredit", 0) > 0 ||
        this.num("userKeys", 0) > 0,
      isBuyingKeys: this.bool("isBuyingKeys"),
      purchasePending: this.bool("purchasePending"),
      isSettling: this.bool("isSettling"),
      isLoading: this.bool("isLoading"),
      isConnectingWallet: this.bool("isConnectingWallet"),
      hasValidationError: Boolean(this.str("keyValidationError", "")),
      guestMoveReady: this.bool("guestMoveReady"),
    });
  }

  private canSettle(): boolean {
    return this.transactionGate().settleEnabled;
  }

  private primaryButtonLabel(gate: LastSurvivorTransactionGate): string {
    switch (gate.reason) {
      case "buying":
        return this.str("sceneBuying", "Buying...");
      case "confirming":
        return this.str("sceneConfirming", "Confirming...");
      case "settling":
        return this.str("sceneSettling", "Settling...");
      case "loading":
        return this.str("sceneSyncing", "Syncing...");
      case "connecting":
        return this.str("sceneConnecting", "Connecting...");
      case "connect-wallet":
        return this.str("sceneConnectWallet", "Connect wallet");
      case "service-unavailable":
        return this.str("sceneServiceShort", "Service unavailable");
      case "financial-state-unavailable":
        return this.str("sceneFinancialStateShort", "Wallet state unavailable");
      case "recovery-storage-unavailable":
        return this.str("sceneRecoveryStorageShort", "Recovery unavailable");
      case "settle-required":
        return this.str("sceneSettleFirst", "Settle first");
      case "round-waiting":
        return this.str("sceneWaitingShort", "Round syncing");
      case "paid-disabled":
        return this.str("scenePaidUnavailable", "GameFi validation in progress");
      case "await-rival":
        return this.str("sceneAwaitRival", "Hold the seat");
      case "invalid-selection":
        return this.str("sceneInvalidSelection", "Choose a valid pack");
      case "insufficient-gas":
        return this.str("sceneInsufficientGas", "Insufficient GAS");
      case "ready":
      default:
        return this.str(
          "sceneBuyQuote",
          `${this.str("sceneBuyVerb", "Buy")} ${this.selectedKeyCount} ${this.presetUnit(this.selectedKeyCount)}`,
        );
    }
  }

  private gateStatus(reason: LastSurvivorGateReason): string {
    switch (reason) {
      case "buying":
        return this.str("sceneNoticeBuying", "Wallet confirmation in progress...");
      case "confirming":
        return this.str("sceneStatusConfirming", "Confirming the submitted purchase...");
      case "settling":
        return this.str("sceneNoticeSettling", "Settling round...");
      case "loading":
        return this.str("sceneStatusLoading", "Syncing arena state...");
      case "connecting":
        return this.str("sceneStatusConnecting", "Connecting wallet and syncing the arena.");
      case "connect-wallet":
        return this.str("sceneStatusConnect", "Connect wallet and sync the arena.");
      case "service-unavailable":
        return this.str("sceneStatusServiceDown", "Arena service unavailable. Refresh shortly.");
      case "financial-state-unavailable":
        return this.str("sceneStatusFinancialStateDown", "Wallet state is unavailable. Refresh before playing.");
      case "recovery-storage-unavailable":
        return this.str("sceneStatusRecoveryStorageDown", "Recovery storage is unavailable. No transaction will be sent.");
      case "settle-required":
        return this.str("sceneStatusSettle", "Settle to pay the winner and open a fresh round.");
      case "round-waiting":
        return this.str("sceneStatusWaiting", "Waiting for the next live round.");
      case "paid-disabled":
        return this.str(
          "sceneStatusPaidUnavailable",
          "Free play is open while the paid flow completes validation.",
        );
      case "await-rival":
        return this.str("sceneStatusBuy", "You hold the final seat. Watch for a rival strike.");
      case "invalid-selection":
        return this.str("sceneInvalidSelection", "Choose a valid key pack.");
      case "insufficient-gas":
        return this.str("sceneStatusInsufficient", "Not enough wallet GAS and prepaid credit.");
      case "ready":
      default:
        return this.str("sceneStatusBuy", "Choose keys, then buy to extend the clock.");
    }
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

  private playLeaderSwap(playerLeads: boolean): void {
    if (playerLeads) {
      this.sfx.play("score");
      if (this.reducedMotion) return;
      this.animate({
        targets: this.countdownText,
        scale: 1.08,
        duration: 130,
        yoyo: true,
        ease: "Back.easeOut",
      });
      return;
    }

    this.sfx.play("lose");
    if (!this.reducedMotion) this.cameras.main.shake(100, 0.0022);
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
