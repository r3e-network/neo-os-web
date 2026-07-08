/**
 * BurnLeagueScene - Phaser 3 arena view for the Burn League GameFi contest.
 *
 * The blockchain flow stays in useBurnLeague/main.tsx. This scene owns only the
 * playable surface: bright arena art, GAS fuel capsules, leaderboard preview,
 * and the burn action.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState, GameBridgeError } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";

const BURN_ASSETS = {
  arena: "burn-league-arena",
  brazier: "burn-league-brazier",
  gas: "burn-league-gas-token",
} as const;

const C = {
  canvas: 0xfffbeb,
  surface: 0xffffff,
  surfaceWarm: 0xfff7df,
  stroke: 0xe7d8b8,
  strokeStrong: 0xf2b84b,
  ink: 0x2a2018,
  inkSoft: 0x765c38,
  inkMuted: 0x9a825d,
  gold: 0xf5b640,
  goldDeep: 0xb45309,
  green: 0x16a86b,
  greenDeep: 0x0f7d56,
  ember: 0xf97316,
  emberDeep: 0xc2410c,
  danger: 0xdc2626,
  disabled: 0xd5cec2,
  white: 0xffffff,
};

const BURN_PRESETS = ["1", "5", "10", "25"] as const;
const FONT = "Inter, Arial, sans-serif";

type LeaderEntry = {
  address: string;
  burned: number;
  rank: number;
  isUser?: boolean;
};

export class BurnLeagueScene extends BaseScene {
  private sceneReady = false;
  private isRebuildingScene = false;
  private scW = 420;
  private scH = 600;

  private coreContainer!: Phaser.GameObjects.Container;
  private coreGlow!: Phaser.GameObjects.Ellipse;
  private brazierImage!: Phaser.GameObjects.Image;
  private gasTokens: Phaser.GameObjects.Image[] = [];

  private poolValue!: Phaser.GameObjects.Text;
  private phaseValue!: Phaser.GameObjects.Text;
  private burnedValue!: Phaser.GameObjects.Text;
  private rankValue!: Phaser.GameObjects.Text;
  private leaderList!: Phaser.GameObjects.Container;
  private emptyLeaderLabel!: Phaser.GameObjects.Text;

  private presetBtns: Phaser.GameObjects.Container[] = [];
  private burnBtn!: Phaser.GameObjects.Container;
  private burnBtnBg!: Phaser.GameObjects.Graphics;
  private burnBtnLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;

  private selectedAmount = "1";
  private isBurning = false;
  private tokenPhase = 0;

  // Previous async-flow flags so result cues fire once per transition,
  // not on every React state push.
  private wasBurning = false;
  private wasSettling = false;
  private settleWasLeading = false;

  constructor() {
    super("BurnLeagueScene");
  }

  preload(): void {
    this.load.image(BURN_ASSETS.arena, "./burn-league-arena.webp");
    this.load.image(BURN_ASSETS.brazier, "./logo.webp");
    this.load.image(BURN_ASSETS.gas, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();
    this.syncSceneSize();
    this.rebuildScene();
    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  update(_time: number, delta: number): void {
    this.tokenPhase += delta * (this.isBurning ? 0.006 : 0.0028);
    this.updateGasOrbit();
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    const previousW = this.scW;
    const previousH = this.scH;
    this.syncSceneSize();
    if (
      !this.sceneReady ||
      this.isRebuildingScene ||
      (previousW === this.scW && previousH === this.scH)
    ) {
      return;
    }
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }

  private syncSceneSize(): void {
    this.scW = Math.max(1, Math.round(this.scale.width || 420));
    this.scH = Math.max(1, Math.round(this.scale.height || 600));
  }

  private rebuildScene(): void {
    this.isRebuildingScene = true;
    this.tweens.killAll();
    this.children.removeAll(true);
    this.gasTokens = [];
    this.presetBtns = [];

    const width = this.scW;
    const height = this.scH;
    this.buildBackground(width, height);
    this.buildHud(width);
    this.buildCore(width, height);
    this.buildLeaderboard(width, height);
    this.buildPresets(width, height);
    this.buildBurnButton(width, height);
    this.buildStatusLabel(width, height);

    this.isRebuildingScene = false;
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady || this.isRebuildingScene || !this.statusLabel) {
      return;
    }

    const phase = this.str("seasonPhase", "dormant");
    const pot = this.str("prizePoolDisplay", "0");
    const userBurned = this.str("userBurnedDisplay", "0");
    const rank = this.str("formattedRank", "--");
    const countdown = this.str("countdown", "00:00:00");
    const amount = this.str("burnAmount", this.selectedAmount);
    const serviceNotice = this.str("serviceNotice", "");
    const validationError = this.str("burnValidationError", "");
    const actionNotice = this.str("actionNotice", "");
    const leaders = this.val<LeaderEntry[]>("leaderboardPreview", []) ?? [];

    this.isBurning = this.bool("isBurning");
    const isSettling = this.bool("isSettling");
    this.syncSelectedAmount(amount);

    // One-shot result cues on async-flow transitions.
    if (this.wasBurning && !this.isBurning && !validationError) {
      this.sfx.play("reveal");
    }
    this.wasBurning = this.isBurning;
    if (isSettling && !this.wasSettling) {
      this.settleWasLeading = rank === "1";
    } else if (!isSettling && this.wasSettling) {
      this.sfx.play(this.settleWasLeading ? "win" : "refund");
    }
    this.wasSettling = isSettling;

    this.poolValue.setText(gasText(pot));
    this.burnedValue.setText(gasText(userBurned));
    this.rankValue.setText(rank === "--" ? "--" : `#${rank}`);
    this.phaseValue.setText(this.phaseCopy(phase, countdown));

    this.updatePresets();
    this.updateBurnButton();
    this.updateLeaderboard(leaders);

    this.coreGlow.setAlpha(this.isBurning ? 0.36 : 0.2);
    this.brazierImage.setAlpha(phase === "ended" ? 0.76 : 1);

    this.statusLabel.setText(
      validationError ||
        actionNotice ||
        serviceNotice ||
        this.defaultStatus(phase, leaders.length),
    );
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusLabel?.setText(error.message);
  }

  private buildBackground(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, C.canvas);
    this.addCoverImage(BURN_ASSETS.arena, width, height, 0.96);

    this.add.rectangle(width / 2, height / 2, width, height, C.white, 0.08);
    this.add.rectangle(width / 2, height * 0.8, width, height * 0.42, C.canvas, 0.78);
    this.add.ellipse(width * 0.58, height * 0.34, width * 0.82, height * 0.42, C.gold, 0.1);
    this.add.rectangle(width / 2, height / 2, width - 10, height - 10, C.white, 0)
      .setStrokeStyle(1, C.stroke, 0.7);
  }

  private buildHud(width: number): void {
    const left = this.buildStatCard(104, 48, 184, 58, "Prize pool", true);
    const right = this.buildStatCard(width - 96, 48, 164, 58, "Season", false);
    this.poolValue = left.value;
    this.phaseValue = right.value;

    const lowerLeft = this.buildTinyMetric(94, 108, "You burned");
    const lowerRight = this.buildTinyMetric(width - 94, 108, "Rank");
    this.burnedValue = lowerLeft.value;
    this.rankValue = lowerRight.value;
  }

  private buildStatCard(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    withIcon: boolean,
  ): { value: Phaser.GameObjects.Text } {
    const group = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(withIcon ? C.surfaceWarm : C.surface, 0.94);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(1.5, withIcon ? C.strokeStrong : C.stroke, 0.72);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    group.add(bg);

    const textX = withIcon ? 8 : 0;
    if (withIcon) {
      const icon = this.add.image(-w / 2 + 24, 0, BURN_ASSETS.gas).setDisplaySize(27, 27);
      group.add(icon);
    }

    const labelText = this.add.text(textX, -11, label, {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#765c38",
    }).setOrigin(withIcon ? 0 : 0.5, 0.5);
    const value = this.add.text(textX, 11, "--", {
      fontFamily: FONT,
      fontSize: withIcon ? "16px" : "14px",
      fontStyle: "bold",
      color: withIcon ? "#92400e" : "#2a2018",
    }).setOrigin(withIcon ? 0 : 0.5, 0.5);
    group.add([labelText, value]);
    return { value };
  }

  private buildTinyMetric(x: number, y: number, label: string): { value: Phaser.GameObjects.Text } {
    const group = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(C.surface, 0.9);
    bg.fillRoundedRect(-70, -18, 140, 36, 12);
    bg.lineStyle(1, C.stroke, 0.72);
    bg.strokeRoundedRect(-70, -18, 140, 36, 12);
    const labelText = this.add.text(-54, 0, label, {
      fontFamily: FONT,
      fontSize: "9px",
      color: "#9a825d",
    }).setOrigin(0, 0.5);
    const value = this.add.text(56, 0, "--", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#2a2018",
    }).setOrigin(1, 0.5);
    group.add([bg, labelText, value]);
    return { value };
  }

  private buildCore(width: number, height: number): void {
    const cx = width / 2;
    const cy = height * 0.335;
    this.coreContainer = this.add.container(cx, cy).setDepth(4);

    this.coreGlow = this.add.ellipse(0, 12, 238, 204, C.gold, 0.2);
    const pedestal = this.add.graphics();
    pedestal.fillStyle(C.surface, 0.72);
    pedestal.fillRoundedRect(-106, 74, 212, 42, 18);
    pedestal.lineStyle(1, C.strokeStrong, 0.6);
    pedestal.strokeRoundedRect(-106, 74, 212, 42, 18);

    this.brazierImage = this.add.image(0, 0, BURN_ASSETS.brazier)
      .setDisplaySize(172, 172);

    for (let i = 0; i < 8; i++) {
      const size = 18 + (i % 3) * 2;
      const token = this.add.image(0, 0, BURN_ASSETS.gas)
        .setDisplaySize(size, size)
        .setData("baseSize", size)
        .setAlpha(0.8);
      this.gasTokens.push(token);
    }

    this.coreContainer.add([this.coreGlow, pedestal, ...this.gasTokens, this.brazierImage]);

    const hitZone = this.add.zone(cx, cy, 210, 206).setInteractive({ useHandCursor: true });
    this.bindGameButton(hitZone, {
      targets: this.coreContainer,
      hoverScale: 1.025,
      pressScale: 0.965,
      enabled: () => this.canBurn(),
      onPress: () => this.handleBurn(),
    });

    this.tween({
      targets: this.coreContainer,
      y: cy - 4,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private buildLeaderboard(width: number, height: number): void {
    const panelY = height * 0.61;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.92);
    panel.fillRoundedRect(28, panelY - 48, width - 56, 112, 18);
    panel.lineStyle(1, C.stroke, 0.78);
    panel.strokeRoundedRect(28, panelY - 48, width - 56, 112, 18);

    this.add.text(width / 2, panelY - 28, "Live leaderboard", {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#765c38",
    }).setOrigin(0.5);

    this.leaderList = this.add.container(0, panelY - 4);
    this.emptyLeaderLabel = this.add.text(width / 2, panelY + 12, "No burns yet - ignite first", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#9a825d",
    }).setOrigin(0.5);
  }

  private buildPresets(width: number, height: number): void {
    this.add.text(width / 2, height * 0.775, "Fuel capsules", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#765c38",
    }).setOrigin(0.5);

    const gap = 68;
    const startX = width / 2 - (BURN_PRESETS.length / 2 - 0.5) * gap;
    BURN_PRESETS.forEach((amount, index) => {
      const button = this.add.container(startX + index * gap, height * 0.82);
      const bg = this.add.graphics();
      const icon = this.add.image(-18, 0, BURN_ASSETS.gas).setDisplaySize(18, 18);
      const label = this.add.text(8, 0, amount, {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#92400e",
      }).setOrigin(0.5);

      bg.setInteractive(
        new Phaser.Geom.Rectangle(-30, -18, 60, 36),
        Phaser.Geom.Rectangle.Contains,
      );
      this.bindGameButton(bg, {
        targets: button,
        hoverScale: 1.05,
        pressScale: 0.94,
        onPress: () => this.selectPreset(amount, true),
      });

      button.add([bg, icon, label]);
      button.setData("bg", bg);
      button.setData("label", label);
      this.presetBtns.push(button);
    });
  }

  private buildBurnButton(width: number, height: number): void {
    this.burnBtn = this.add.container(width / 2, height * 0.9);
    this.burnBtnBg = this.add.graphics();
    this.burnBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-116, -26, 232, 52),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.burnBtnBg, {
      targets: this.burnBtn,
      pressScale: 0.95,
      enabled: () => this.canBurn(),
      onPress: () => this.handleBurn(),
    });

    this.burnBtnLabel = this.add.text(0, 0, "", {
      fontFamily: FONT,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.burnBtn.add([this.burnBtnBg, this.burnBtnLabel]);
  }

  private buildStatusLabel(width: number, height: number): void {
    this.statusLabel = this.add.text(width / 2, height * 0.965, "", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#765c38",
      align: "center",
      wordWrap: { width: width - 52 },
    }).setOrigin(0.5);
  }

  private addCoverImage(key: string, width: number, height: number, alpha: number): Phaser.GameObjects.Image {
    const image = this.add.image(width / 2, height / 2, key).setAlpha(alpha);
    const frame = this.textures.getFrame(key);
    const sourceWidth = frame?.width ?? width;
    const sourceHeight = frame?.height ?? height;
    image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
    return image;
  }

  private updateGasOrbit(): void {
    const fast = this.isBurning ? 1.5 : 1;
    this.gasTokens.forEach((token, index) => {
      const offset = (Math.PI * 2 * index) / this.gasTokens.length;
      const t = this.tokenPhase * fast + offset;
      const radiusX = this.isBurning ? 104 : 88;
      const radiusY = this.isBurning ? 58 : 46;
      const x = Math.cos(t) * radiusX;
      const y = Math.sin(t * 1.12) * radiusY - 8;
      const depth = y > -8 ? 5 : 2;
      token.setPosition(x, y);
      token.setDepth(depth);
      token.setAlpha(this.isBurning ? 0.86 : 0.38 + Math.sin(t) * 0.1);
      token.setAngle((t * 80) % 360);
      const baseSize = Number(token.getData("baseSize") ?? 20);
      const size = baseSize + (this.isBurning ? 5 : 0);
      token.setDisplaySize(size, size);
    });
  }

  private updatePresets(): void {
    this.presetBtns.forEach((button, index) => {
      const amount = BURN_PRESETS[index]!;
      const active = amount === this.selectedAmount;
      const bg = button.getData("bg") as Phaser.GameObjects.Graphics;
      const label = button.getData("label") as Phaser.GameObjects.Text;
      bg.clear();
      bg.fillStyle(active ? C.surfaceWarm : C.surface, 0.96);
      bg.fillRoundedRect(-30, -18, 60, 36, 12);
      bg.lineStyle(2, active ? C.strokeStrong : C.stroke, 0.9);
      bg.strokeRoundedRect(-30, -18, 60, 36, 12);
      label.setColor(active ? "#92400e" : "#765c38");
    });
  }

  private updateBurnButton(): void {
    const enabled = this.canBurn();
    this.burnBtnBg.clear();
    this.burnBtnBg.fillStyle(enabled ? C.ember : C.disabled, 1);
    this.burnBtnBg.fillRoundedRect(-116, -26, 232, 52, 16);
    if (enabled) {
      this.burnBtnBg.fillStyle(C.white, 0.18);
      this.burnBtnBg.fillRoundedRect(-116, -26, 232, 21, { tl: 16, tr: 16, bl: 0, br: 0 });
    }
    this.burnBtnBg.lineStyle(2, enabled ? C.emberDeep : C.stroke, 1);
    this.burnBtnBg.strokeRoundedRect(-116, -26, 232, 52, 16);

    const phase = this.str("seasonPhase", "dormant");
    this.burnBtnLabel.setColor(enabled ? "#ffffff" : "#fffaf0");
    this.burnBtnLabel.setText(
      this.isBurning
        ? "Burning..."
        : phase === "ended"
          ? "Settle season first"
          : `Ignite ${this.selectedAmount} GAS`,
    );
  }

  private updateLeaderboard(entries: LeaderEntry[]): void {
    this.leaderList.removeAll(true);
    this.emptyLeaderLabel.setVisible(entries.length === 0);

    entries.slice(0, 4).forEach((entry, index) => {
      const y = index * 22;
      const row = this.add.container(this.scale.width / 2, y);
      const rankColor = entry.rank === 1 ? C.goldDeep : C.inkSoft;
      const bg = this.add.graphics();
      bg.fillStyle(entry.isUser ? 0xfff7df : 0xffffff, entry.isUser ? 0.95 : 0.62);
      bg.fillRoundedRect(-166, -9, 332, 18, 8);
      row.add(bg);
      row.add(this.add.text(-150, 0, `#${entry.rank}`, {
        fontFamily: FONT,
        fontSize: "10px",
        fontStyle: "bold",
        color: toHex(rankColor),
      }).setOrigin(0, 0.5));
      row.add(this.add.text(-92, 0, shortAddress(entry.address), {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#765c38",
      }).setOrigin(0, 0.5));
      row.add(this.add.text(150, 0, `${entry.burned.toFixed(1)} GAS`, {
        fontFamily: FONT,
        fontSize: "10px",
        fontStyle: "bold",
        color: entry.isUser ? "#0f7d56" : "#2a2018",
      }).setOrigin(1, 0.5));
      this.leaderList.add(row);
    });
  }

  private syncSelectedAmount(value: string): void {
    const normalized = String(value || this.selectedAmount).replace(/\s*GAS$/i, "");
    if (BURN_PRESETS.includes(normalized as (typeof BURN_PRESETS)[number])) {
      this.selectedAmount = normalized;
      return;
    }

    const numeric = Number(normalized);
    if (Number.isFinite(numeric) && numeric > 0) {
      this.selectedAmount = Number(numeric.toFixed(8)).toString();
    }
  }

  private selectPreset(amount: string, notify: boolean): void {
    this.selectedAmount = amount;
    this.updatePresets();
    this.updateBurnButton();
    if (notify) {
      this.sfx.play("tap");
      this.dispatch("setBurnAmount", amount);
    }
  }

  private handleBurn(): void {
    if (!this.canBurn()) return;
    this.sfx.play("throw");
    this.flashCore();
    this.dispatch("burn", this.selectedAmount);
  }

  private flashCore(): void {
    this.pressFeedback(this.coreContainer, { scale: 0.965, duration: 80 });
    this.tween({
      targets: this.coreGlow,
      alpha: 0.46,
      duration: 140,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private canBurn(): boolean {
    const phase = this.str("seasonPhase", "dormant");
    const amount = Number(this.selectedAmount);
    const min = this.num("minBurnGas", 1);
    const max = this.num("maxBurnGas", 1000);
    return (
      phase !== "ended" &&
      !this.bool("isBurning") &&
      !this.bool("isSettling") &&
      !this.str("burnValidationError", "") &&
      Number.isFinite(amount) &&
      amount >= min &&
      amount <= max
    );
  }

  private phaseCopy(phase: string, countdown: string): string {
    if (phase === "active") return countdown;
    if (phase === "ended") return "Ended";
    return "Open on first burn";
  }

  private defaultStatus(phase: string, entryCount: number): string {
    if (this.isBurning) return "Wallet burn in progress";
    if (phase === "ended") return "Season ended. Settle before the next burn";
    if (phase === "dormant") return "First burn opens a fresh season";
    if (entryCount === 0) return "Top burner wins the whole pool";
    return "Burn more GAS to climb the live board";
  }
}

function shortAddress(address: string): string {
  const clean = String(address || "").trim();
  if (clean.length <= 12) return clean || "--";
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function toHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function gasText(value: string): string {
  const text = String(value || "0").trim();
  if (!text || text === "--") return "--";
  return /\bGAS\b/i.test(text) ? text : `${text} GAS`;
}
