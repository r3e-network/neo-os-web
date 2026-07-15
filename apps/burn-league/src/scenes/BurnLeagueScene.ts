/**
 * BurnLeagueScene - Phaser 3 arena view for the Burn League GameFi contest.
 *
 * The blockchain flow stays in useBurnLeague/main.tsx. This scene owns only the
 * playable surface: bright arena art, the real league cauldron/trophy asset,
 * a fuel/heat gauge, official GAS fuel capsules, the leaderboard preview, and
 * the burn action. HUD and hit areas remain code-native; the game object itself
 * is repository artwork rather than a canvas-drawn placeholder.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState, GameBridgeError } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";

const BURN_ASSETS = {
  arena: "burn-league-arena",
  gas: "burn-league-gas-token",
  logo: "burn-league-logo",
} as const;

const C = {
  canvas: 0xfffbeb,
  surface: 0xffffff,
  surfaceWarm: 0xfff7df,
  stroke: 0xe7d8b8,
  strokeStrong: 0xf2b84b,
  inkSoft: 0x765c38,
  gold: 0xf5b640,
  goldDeep: 0xb45309,
  green: 0x16a86b,
  greenDeep: 0x0f7d56,
  hot: 0xfff3c4,
  ember: 0xf97316,
  emberDeep: 0xc2410c,
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

type SceneText = {
  poolLabel?: string;
  seasonLabel?: string;
  burnedLabel?: string;
  rankLabel?: string;
  /** Zero-state for an unranked wallet — replaces the former "--" rank void. */
  rankUnranked?: string;
  boardTitle?: string;
  emptyBoard?: string;
  fuelLabel?: string;
  phaseEnded?: string;
  phaseDormant?: string;
  ready?: string;
  walletBurning?: string;
  endedStatus?: string;
  dormantStatus?: string;
  emptyStatus?: string;
  activeStatus?: string;
  guestContinue?: string;
};

export class BurnLeagueScene extends BaseScene {
  private sceneReady = false;
  private isRebuildingScene = false;
  private scW = 420;
  private scH = 600;

  private coreContainer!: Phaser.GameObjects.Container;
  private coreArt!: Phaser.GameObjects.Container;
  private coreGlow!: Phaser.GameObjects.Ellipse;
  private coreGlowInner!: Phaser.GameObjects.Ellipse;
  private coreMachineHolder!: Phaser.GameObjects.Container;
  private coreMachine!: Phaser.GameObjects.Image;
  private gasTokens: Phaser.GameObjects.Image[] = [];

  private coreCX = 210;
  private coreCY = 208;
  private coreScale = 1;

  private heatGauge!: Phaser.GameObjects.Container;
  private heatFill!: Phaser.GameObjects.Graphics;
  private heatToken!: Phaser.GameObjects.Image;
  private heatTrackTop = 0;
  private heatTrackH = 84;
  private heatTrackW = 12;

  private poolValue!: Phaser.GameObjects.Text;
  private phaseValue!: Phaser.GameObjects.Text;
  private burnedValue!: Phaser.GameObjects.Text;
  private rankValue!: Phaser.GameObjects.Text;
  // HUD/board label handles so guest mode can swap the GAS-centric copy for
  // local (heat / streak) framing without rebuilding the scene.
  private poolLabel?: Phaser.GameObjects.Text;
  private seasonLabelText?: Phaser.GameObjects.Text;
  private burnedLabel?: Phaser.GameObjects.Text;
  private boardTitle?: Phaser.GameObjects.Text;
  private leaderList!: Phaser.GameObjects.Container;
  private emptyLeaderChip!: Phaser.GameObjects.Graphics;
  private emptyLeaderLabel!: Phaser.GameObjects.Text;
  private boardRowWidth = 332;
  private boardRankX = -150;
  private boardAddressX = -92;
  private boardValueX = 150;
  private boardRows = 4;
  private boardRowGap = 21;

  private presetBtns: Phaser.GameObjects.Container[] = [];
  private burnBtn!: Phaser.GameObjects.Container;
  private burnBtnBg!: Phaser.GameObjects.Graphics;
  private burnBtnLabel!: Phaser.GameObjects.Text;
  private burnButtonHeight = 52;
  private statusScrim!: Phaser.GameObjects.Graphics;
  private statusLabel!: Phaser.GameObjects.Text;

  private selectedAmount = "1";
  private isBurning = false;
  private primaryAction: "connect" | "burn" | "settle" | "recheck" = "burn";
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
    this.load.image(BURN_ASSETS.gas, officialGasTokenPhaserUrl);
    this.load.image(BURN_ASSETS.logo, "./logo.webp");
  }

  create(): void {
    super.create();
    this.syncSceneSize();
    this.rebuildScene();
    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  update(_time: number, delta: number): void {
    // Reduced-motion honors the per-frame orbit: tokens are placed once during
    // buildCore and left static when the user opts out of motion.
    if (this.reducedMotion) return;
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

  protected onReducedMotionChange(_enabled: boolean): void {
    if (!this.sceneReady || this.isRebuildingScene) return;
    // Existing infinite tweens were created under the previous preference.
    // Rebuilding applies the new reduced-motion contract immediately and also
    // restores every animated object's canonical transform.
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
    this.buildHud(width, height);
    this.buildCore(width, height);
    this.buildHeatGauge();
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
    const rank = this.str("formattedRank", this.copy("rankUnranked", "Unranked"));
    const countdown = this.str("countdown", "00:00:00");
    const amount = this.str("burnAmount", this.selectedAmount);
    const serviceNotice = this.str("serviceNotice", "");
    const validationError = this.str("burnValidationError", "");
    const actionNotice = this.str("actionNotice", "");
    const leaders = this.val<LeaderEntry[]>("leaderboardPreview", []) ?? [];
    const needsSettle = this.bool("needsSettle");

    // Guest (local) mode swaps the GAS-at-stake / pool / season framing for a
    // local burn-streak read: "Best heat", "This run", a streak counter, and a
    // heat-unit leaderboard — no GAS anywhere.
    const guest = this.str("appMode", "gamefi") === "guest";
    const streak = this.num("guestStreak", 0);
    this.poolLabel?.setText(
      guest ? this.str("guestPoolLabel", "Best heat") : this.copy("poolLabel", "Prize pool"),
    );
    this.seasonLabelText?.setText(
      guest ? this.str("guestSeasonLabel", "Streak") : this.copy("seasonLabel", "Season"),
    );
    this.burnedLabel?.setText(
      guest ? this.str("guestRunLabel", "This run") : this.copy("burnedLabel", "You burned"),
    );
    this.boardTitle?.setText(
      guest ? this.str("guestBoardLabel", "Local runs") : this.copy("boardTitle", "Leaderboard"),
    );

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

    this.poolValue.setText(guest ? heatText(pot) : gasText(pot));
    this.burnedValue.setText(guest ? heatText(userBurned) : gasText(userBurned));
    // formattedRank already carries its own "#" once ranked. Rendering it
    // verbatim avoids the former "##2" GameFi label while still accepting plain
    // numeric mocks. When unranked it now carries honest zero-state copy
    // ("Unranked") rather than "--", so only a bare number needs the "#".
    this.rankValue.setText(/^\d+$/.test(rank) ? `#${rank}` : rank);
    this.phaseValue.setText(
      guest
        ? (streak > 0 ? `x${streak}` : this.copy("ready", "Ready"))
        : this.phaseCopy(phase, countdown),
    );

    this.updatePresets();
    this.updateBurnButton();
    this.updateLeaderboard(leaders);

    this.applyHeat(this.poolHeat(), this.isBurning);
    const dim = phase === "ended" ? 0.82 : 1;
    this.coreMachineHolder.setAlpha(dim);

    const insufficientFunding =
      !guest &&
      this.bool("walletConnected") &&
      !this.bool("hasUnknownBurn") &&
      !needsSettle &&
      !this.hasEnoughFunding();
    this.statusLabel.setText(
      validationError ||
        actionNotice ||
        serviceNotice ||
        (insufficientFunding ? this.str("burnInsufficientHint", "Insufficient GAS") : "") ||
        (guest ? this.guestDefaultStatus(streak) : this.defaultStatus(phase, leaders.length)),
    );
    this.layoutStatus();
  }

  protected onBridgeError(error: GameBridgeError): void {
    this.statusLabel?.setText(error.message);
    this.layoutStatus();
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

  private buildHud(width: number, height: number): void {
    const side = width < 340 ? 10 : 12;
    const gap = width < 340 ? 8 : 10;
    const cardW = Math.max(112, (width - side * 2 - gap) / 2);
    const topY = height < 450 ? 38 : 48;
    const cardH = height < 450 ? 50 : 58;
    const leftX = side + cardW / 2;
    const rightX = width - side - cardW / 2;
    const left = this.buildStatCard(
      leftX,
      topY,
      cardW,
      cardH,
      this.copy("poolLabel", "Prize pool"),
      cardW >= 150,
    );
    const right = this.buildStatCard(
      rightX,
      topY,
      cardW,
      cardH,
      this.copy("seasonLabel", "Season"),
      false,
    );
    this.poolValue = left.value;
    this.phaseValue = right.value;
    this.poolLabel = left.label;
    this.seasonLabelText = right.label;

    const tinyW = Math.max(112, (width - side * 2 - gap) / 2);
    const tinyY = height < 450 ? 94 : 108;
    const lowerLeft = this.buildTinyMetric(
      side + tinyW / 2,
      tinyY,
      tinyW,
      this.copy("burnedLabel", "You burned"),
    );
    const lowerRight = this.buildTinyMetric(
      width - side - tinyW / 2,
      tinyY,
      tinyW,
      this.copy("rankLabel", "Rank"),
    );
    // The outer semantic HUD already repeats these values. On micro-height
    // canvases, removing the second row gives the resource-led core breathing
    // room instead of stacking labels over the flame.
    const showTinyMetrics = height >= 420;
    lowerLeft.group.setVisible(showTinyMetrics);
    lowerRight.group.setVisible(showTinyMetrics);
    this.burnedValue = lowerLeft.value;
    this.rankValue = lowerRight.value;
    this.burnedLabel = lowerLeft.label;
  }

  private buildStatCard(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    withIcon: boolean,
  ): { value: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text } {
    const group = this.add.container(x, y).setDepth(8);
    const bg = this.add.graphics();
    bg.fillStyle(withIcon ? C.surfaceWarm : C.surface, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(1.75, withIcon ? C.strokeStrong : C.stroke, 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    group.add(bg);

    const textX = withIcon ? 8 : 0;
    if (withIcon) {
      const icon = this.add.image(-w / 2 + 24, 0, BURN_ASSETS.gas).setDisplaySize(27, 27);
      group.add(icon);
    }

    const compact = w < 150;
    const labelText = this.add.text(textX, -12, label, {
      fontFamily: FONT,
      fontSize: compact ? "9px" : "11px",
      fontStyle: "bold",
      color: "#6b4a1f",
    }).setOrigin(withIcon ? 0 : 0.5, 0.5);
    const value = this.add.text(textX, 11, "--", {
      fontFamily: FONT,
      fontSize: compact ? "12px" : withIcon ? "16px" : "14px",
      fontStyle: "bold",
      color: withIcon ? "#92400e" : "#2a2018",
    }).setOrigin(withIcon ? 0 : 0.5, 0.5);
    group.add([labelText, value]);
    return { value, label: labelText };
  }

  private buildTinyMetric(
    x: number,
    y: number,
    w: number,
    label: string,
  ): {
    value: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
    group: Phaser.GameObjects.Container;
  } {
    const group = this.add.container(x, y).setDepth(8);
    const half = w / 2;
    const bg = this.add.graphics();
    bg.fillStyle(C.surface, 0.96);
    bg.fillRoundedRect(-half, -18, w, 36, 12);
    bg.lineStyle(1.25, C.stroke, 0.85);
    bg.strokeRoundedRect(-half, -18, w, 36, 12);
    const labelText = this.add.text(-half + 12, 0, label, {
      fontFamily: FONT,
      fontSize: w < 135 ? "9px" : "10px",
      fontStyle: "bold",
      color: "#8a7048",
    }).setOrigin(0, 0.5);
    const value = this.add.text(half - 12, 0, "--", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#2a2018",
    }).setOrigin(1, 0.5);
    group.add([bg, labelText, value]);
    return { value, label: labelText, group };
  }

  private buildCore(width: number, height: number): void {
    const cx = width / 2;
    const micro = height < 450;
    const cy = Math.round(height * (micro ? 0.37 : 0.347));
    const minScale = micro || width < 340 ? 0.58 : 0.72;
    const scale = Phaser.Math.Clamp(Math.min(width / 420, height / 600), minScale, 1.06);
    this.coreCX = cx;
    this.coreCY = cy;
    this.coreScale = scale;

    this.coreContainer = this.add.container(cx, cy).setDepth(4);
    this.coreArt = this.add.container(0, 0).setScale(scale);
    this.coreContainer.add(this.coreArt);

    // Heat glow — two layers (outer wide + warmer inner) so it reads as furnace
    // heat rather than a flat disc.
    this.coreGlow = this.add.ellipse(0, 10, 246, 172, C.gold, 0.2);
    this.coreGlowInner = this.add.ellipse(0, 14, 150, 104, C.ember, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD);

    // The cauldron/trophy is real project artwork. A restrained code-native
    // frame provides hit-area contrast without redrawing the game object.
    const machineFrame = this.add.graphics();
    machineFrame.fillStyle(C.surface, 0.97);
    machineFrame.fillRoundedRect(-94, -82, 188, 188, 42);
    machineFrame.lineStyle(4, C.gold, 0.95);
    machineFrame.strokeRoundedRect(-94, -82, 188, 188, 42);
    machineFrame.lineStyle(1.5, C.greenDeep, 0.65);
    machineFrame.strokeRoundedRect(-87, -75, 174, 174, 36);
    this.coreMachine = this.add.image(0, 12, BURN_ASSETS.logo)
      .setDisplaySize(174, 174);
    this.coreMachineHolder = this.add.container(0, 0, [machineFrame, this.coreMachine]);

    for (let i = 0; i < 8; i++) {
      const size = 17 + (i % 3) * 2;
      const token = this.add.image(0, 0, BURN_ASSETS.gas)
        .setDisplaySize(size, size)
        .setData("baseSize", size)
        .setAlpha(0.6);
      this.gasTokens.push(token);
    }

    // Layer order: glow → real league machine → official GAS fuel orbit.
    this.coreArt.add([
      this.coreGlow,
      this.coreGlowInner,
      this.coreMachineHolder,
      ...this.gasTokens,
    ]);

    const hitZone = this.add.zone(cx, cy, 220 * scale, 210 * scale)
      .setInteractive({ useHandCursor: true });
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

    // Slow additive shimmer so the heat feels alive, not a static blob.
    this.tween({
      targets: this.coreGlowInner,
      scaleX: 1.12,
      scaleY: 1.16,
      duration: 2200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.updateGasOrbit();
  }

  /** Vertical fuel/heat gauge fed by the pool, beside the brazier. */
  private buildHeatGauge(): void {
    const scale = this.coreScale;
    const gaugeX = Phaser.Math.Clamp(
      Math.round(this.coreCX - 126 * scale),
      30,
      this.coreCX - 96,
    );
    this.heatGauge = this.add.container(gaugeX, this.coreCY + 4).setDepth(4).setScale(scale);

    const card = this.add.graphics();
    card.fillStyle(C.surface, 0.94);
    card.fillRoundedRect(-16, -66, 32, 134, 13);
    card.lineStyle(1.5, C.strokeStrong, 0.55);
    card.strokeRoundedRect(-16, -66, 32, 134, 13);

    // track
    this.heatTrackTop = -34;
    this.heatTrackH = 86;
    this.heatTrackW = 12;
    const track = this.add.graphics();
    track.fillStyle(C.surfaceWarm, 1);
    track.fillRoundedRect(-this.heatTrackW / 2, this.heatTrackTop, this.heatTrackW, this.heatTrackH, 6);
    track.lineStyle(1, C.stroke, 0.8);
    track.strokeRoundedRect(-this.heatTrackW / 2, this.heatTrackTop, this.heatTrackW, this.heatTrackH, 6);

    this.heatFill = this.add.graphics();

    // tick marks
    const ticks = this.add.graphics();
    ticks.lineStyle(1, C.goldDeep, 0.35);
    for (let i = 1; i <= 3; i++) {
      const ty = this.heatTrackTop + (this.heatTrackH * i) / 4;
      ticks.beginPath();
      ticks.moveTo(-this.heatTrackW / 2 - 3, ty);
      ticks.lineTo(-this.heatTrackW / 2, ty);
      ticks.strokePath();
    }

    // Official GAS token crowns the heat gauge; no hand-drawn token stand-in.
    this.heatToken = this.add.image(0, -50, BURN_ASSETS.gas)
      .setDisplaySize(22, 22);

    this.heatGauge.add([card, track, this.heatFill, ticks, this.heatToken]);
    this.drawHeatFill(0.08, false);
  }

  private drawHeatFill(heat: number, burning: boolean): void {
    if (!this.heatFill) return;
    const h = Math.max(4, this.heatTrackH * Phaser.Math.Clamp(heat, 0.06, 1));
    const y = this.heatTrackTop + this.heatTrackH - h;
    const color = burning || heat > 0.7 ? C.ember : heat > 0.34 ? C.gold : C.green;
    this.heatFill.clear();
    this.heatFill.fillStyle(color, 1);
    this.heatFill.fillRoundedRect(-this.heatTrackW / 2, y, this.heatTrackW, h, 6);
    this.heatFill.fillStyle(C.hot, 0.4);
    this.heatFill.fillRoundedRect(-this.heatTrackW / 2, y, this.heatTrackW, Math.min(10, h), 6);
  }

  private buildLeaderboard(width: number, height: number): void {
    const compact = height < 540;
    const panelCY = Math.round(height * (compact ? 0.6 : 0.63));
    const panelH = compact ? 76 : 108;
    const panelTop = panelCY - panelH / 2;
    const panelMargin = Phaser.Math.Clamp(Math.round(width * 0.067), 12, 28);
    const panelW = width - panelMargin * 2;
    this.boardRowWidth = Math.max(196, Math.min(332, panelW - 18));
    const halfRow = this.boardRowWidth / 2;
    this.boardRankX = -halfRow + 14;
    this.boardAddressX = -halfRow + (width < 330 ? 50 : 74);
    this.boardValueX = halfRow - 14;
    this.boardRows = compact ? 2 : 4;
    this.boardRowGap = compact ? 19 : 21;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.95);
    panel.fillRoundedRect(panelMargin, panelTop, panelW, panelH, 18);
    panel.lineStyle(1.25, C.stroke, 0.85);
    panel.strokeRoundedRect(panelMargin, panelTop, panelW, panelH, 18);

    this.boardTitle = this.add.text(
      width / 2,
      panelTop + (compact ? 11 : 15),
      this.copy("boardTitle", "Leaderboard"),
      {
      fontFamily: FONT,
      fontSize: compact ? "10px" : "11px",
      fontStyle: "bold",
      color: "#6b4a1f",
      },
    ).setOrigin(0.5);

    const rowsTop = panelTop + (compact ? 29 : 40);

    // An empty board renders its empty state and nothing else.
    //
    // This panel used to fill the pre-burn board with "ghost rows" — dim
    // "#1  — — —   -- GAS" plates meant to show the structure — and then draw
    // the "No burns yet" chip on top of them. The result was the first-run void
    // this codebase has been removing everywhere else: a grid of em-dashes on a
    // store-facing surface, made worse by the chip landing across row #2 with
    // the dashes poking out either side of it.
    //
    // The rows carry no information before the first burn, so there is nothing
    // to keep: the chip alone is the honest, complete empty state.
    this.leaderList = this.add.container(0, rowsTop);

    // Centered empty-state chip, shown in place of the rows while the board is
    // empty (see updateLeaderboard).
    this.emptyLeaderChip = this.add.graphics();
    this.emptyLeaderLabel = this.add.text(
      width / 2,
      panelCY + (compact ? 9 : 14),
      this.copy("emptyBoard", "No burns yet - ignite first"),
      {
      fontFamily: FONT,
      fontSize: compact ? "10px" : "12px",
      fontStyle: "bold",
      color: "#8a5a1a",
      align: "center",
      wordWrap: { width: this.boardRowWidth - 20 },
      },
    ).setOrigin(0.5);
  }

  private buildPresets(width: number, height: number): void {
    const compact = height < 540;
    this.add.text(
      width / 2,
      height * (compact ? 0.715 : 0.772),
      this.copy("fuelLabel", "Fuel capsules"),
      {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#6b4a1f",
      },
    ).setOrigin(0.5);

    const gap = Math.min(68, Math.max(52, (width - 76) / 3));
    const buttonW = Math.min(60, Math.max(48, gap - 8));
    const startX = width / 2 - (BURN_PRESETS.length / 2 - 0.5) * gap;
    BURN_PRESETS.forEach((amount, index) => {
      const button = this.add.container(
        startX + index * gap,
        height * (compact ? 0.762 : 0.817),
      );
      const bg = this.add.graphics();
      const glyph = this.add.image(-16, 0, BURN_ASSETS.gas)
        .setDisplaySize(20, 20);
      const label = this.add.text(9, 0, amount, {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#92400e",
      }).setOrigin(0.5);

      bg.setInteractive(
        new Phaser.Geom.Rectangle(-buttonW / 2, -22, buttonW, 44),
        Phaser.Geom.Rectangle.Contains,
      );
      this.bindGameButton(bg, {
        targets: button,
        hoverScale: 1.05,
        pressScale: 0.94,
        enabled: () => this.canSelectPreset(),
        onPress: () => this.selectPreset(amount, true),
      });

      button.add([bg, glyph, label]);
      button.setData("bg", bg);
      button.setData("glyph", glyph);
      button.setData("label", label);
      button.setData("buttonW", buttonW);
      this.presetBtns.push(button);
    });
  }

  private buildBurnButton(width: number, height: number): void {
    const compact = height < 540;
    this.burnButtonHeight = compact ? 44 : 52;
    const halfH = this.burnButtonHeight / 2;
    this.burnBtn = this.add.container(width / 2, height * (compact ? 0.88 : 0.9));
    this.burnBtnBg = this.add.graphics();
    this.burnBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-116, -halfH, 232, this.burnButtonHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.burnBtnBg, {
      targets: this.burnBtn,
      pressScale: 0.95,
      enabled: () => this.canPrimaryAction(),
      onPress: () => this.handleBurn(),
    });

    this.burnBtnLabel = this.add.text(0, 0, "", {
      fontFamily: FONT,
      fontSize: compact ? "14px" : "16px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.burnBtn.add([this.burnBtnBg, this.burnBtnLabel]);
  }

  private buildStatusLabel(width: number, height: number): void {
    this.statusScrim = this.add.graphics().setDepth(6);
    this.statusLabel = this.add.text(width / 2, height * (height < 540 ? 0.968 : 0.962), "", {
      fontFamily: FONT,
      fontSize: height < 450 ? "9px" : "11px",
      fontStyle: "bold",
      color: "#6b4a1f",
      align: "center",
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5).setDepth(7);
  }

  private layoutStatus(): void {
    if (!this.statusScrim || !this.statusLabel) return;
    this.statusScrim.clear();
    if (!this.statusLabel.text) return;
    const b = this.statusLabel.getBounds();
    const padX = 14;
    const padY = 6;
    this.statusScrim.fillStyle(C.canvas, 0.9);
    this.statusScrim.fillRoundedRect(b.x - padX, b.y - padY, b.width + padX * 2, b.height + padY * 2, 12);
    this.statusScrim.lineStyle(1, C.stroke, 0.6);
    this.statusScrim.strokeRoundedRect(b.x - padX, b.y - padY, b.width + padX * 2, b.height + padY * 2, 12);
  }

  private addCoverImage(key: string, width: number, height: number, alpha: number): Phaser.GameObjects.Image {
    const image = this.add.image(width / 2, height / 2, key).setAlpha(alpha);
    const frame = this.textures.getFrame(key);
    const sourceWidth = frame?.width ?? width;
    const sourceHeight = frame?.height ?? height;
    image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
    return image;
  }

  private poolHeat(): number {
    const parse = (s: string): number => {
      const n = Number(String(s).replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const pool = parse(this.str("prizePoolDisplay", "0"));
    const projected = parse(this.str("projectedTotalBurnedDisplay", "0"));
    const armed = Number(this.selectedAmount);
    const basis = Math.max(pool, projected * 0.5, Number.isFinite(armed) ? armed * 0.4 : 0);
    const heat = 1 - 1 / (1 + basis / 22);
    return Phaser.Math.Clamp(heat, 0.08, 1);
  }

  private applyHeat(heat: number, burning: boolean): void {
    if (!this.coreGlow) return;
    const glowBase = 0.13 + heat * 0.16;
    this.coreGlow.setAlpha(glowBase + (burning ? 0.16 : 0));
    this.coreGlowInner.setAlpha(glowBase + (burning ? 0.22 : 0.06));
    const machineScale = 0.98 + heat * 0.025 + (burning ? 0.035 : 0);
    this.coreMachineHolder.setScale(machineScale);
    this.drawHeatFill(heat, burning);
  }

  private updateGasOrbit(): void {
    const burning = this.isBurning;
    const rx = burning ? 96 : 84;
    const ry = burning ? 40 : 34;
    this.gasTokens.forEach((token, index) => {
      const offset = (Math.PI * 2 * index) / this.gasTokens.length;
      const t = this.tokenPhase * (burning ? 1.6 : 1) + offset;
      const x = Math.cos(t) * rx;
      const y = Math.sin(t * 1.05) * ry + 4;
      token.setPosition(x, y);
      token.setAlpha(burning ? 0.95 : 0.52 + Math.sin(t) * 0.16);
      token.setAngle((t * 70) % 360);
      const baseSize = Number(token.getData("baseSize") ?? 18);
      const size = baseSize + (burning ? 4 : 0);
      token.setDisplaySize(size, size);
    });
  }

  private updatePresets(): void {
    this.presetBtns.forEach((button, index) => {
      const amount = BURN_PRESETS[index]!;
      const active = amount === this.selectedAmount;
      const bg = button.getData("bg") as Phaser.GameObjects.Graphics;
      const glyph = button.getData("glyph") as Phaser.GameObjects.Image;
      const label = button.getData("label") as Phaser.GameObjects.Text;
      const buttonW = Number(button.getData("buttonW") ?? 60);
      const half = buttonW / 2;
      const selectable = this.canSelectPreset();

      bg.clear();
      // Active capsule = filled ember chip; inactive = warm surface.
      bg.fillStyle(active ? C.ember : C.surface, active ? 1 : 0.96);
      bg.fillRoundedRect(-half, -18, buttonW, 36, 12);
      if (active) {
        bg.fillStyle(C.white, 0.18);
        bg.fillRoundedRect(-half, -18, buttonW, 15, { tl: 12, tr: 12, bl: 0, br: 0 });
      }
      bg.lineStyle(2, active ? C.emberDeep : C.stroke, active ? 1 : 0.9);
      bg.strokeRoundedRect(-half, -18, buttonW, 36, 12);

      glyph.setPosition(-16, 0);
      glyph.setDisplaySize(active ? 21 : 19, active ? 21 : 19);
      glyph.setAlpha(active ? 1 : 0.78);

      label.setColor(active ? "#ffffff" : "#8a5a1a");
      button.setAlpha(selectable ? 1 : 0.58);
    });
  }

  private updateBurnButton(): void {
    const needsSettle = this.bool("needsSettle");
    const guest = this.str("appMode", "gamefi") === "guest";
    const connected = this.bool("walletConnected");
    const pending = this.bool("hasUnknownBurn");
    this.primaryAction = guest
      ? "burn"
      : !connected
        ? "connect"
        : pending
          ? "recheck"
          : needsSettle
            ? "settle"
            : "burn";
    const enabled = this.canPrimaryAction();
    const greenAction = this.primaryAction === "connect" || this.primaryAction === "settle";
    const recheckAction = this.primaryAction === "recheck";
    const halfH = this.burnButtonHeight / 2;
    this.burnBtnBg.clear();
    this.burnBtnBg.fillStyle(
      enabled ? (greenAction ? C.green : recheckAction ? C.goldDeep : C.ember) : C.disabled,
      1,
    );
    this.burnBtnBg.fillRoundedRect(-116, -halfH, 232, this.burnButtonHeight, 16);
    if (enabled) {
      this.burnBtnBg.fillStyle(C.white, 0.18);
      this.burnBtnBg.fillRoundedRect(
        -116,
        -halfH,
        232,
        Math.min(21, this.burnButtonHeight * 0.42),
        { tl: 16, tr: 16, bl: 0, br: 0 },
      );
    }
    this.burnBtnBg.lineStyle(
      2,
      enabled ? (greenAction ? C.greenDeep : recheckAction ? C.goldDeep : C.emberDeep) : C.stroke,
      1,
    );
    this.burnBtnBg.strokeRoundedRect(-116, -halfH, 232, this.burnButtonHeight, 16);

    const phase = this.str("seasonPhase", "dormant");
    const confirmingThisAmount =
      this.bool("burnConfirmArmed") &&
      this.str("burnConfirmAmount", "") === this.selectedAmount;
    this.burnBtnLabel.setColor(enabled ? "#ffffff" : "#fffaf0");
    this.burnBtnLabel.setText(
      this.primaryAction === "connect"
        ? this.bool("isConnectingWallet")
          ? this.str("connectingAction", "Connecting...")
          : this.str("connectAction", "Connect wallet")
        : this.primaryAction === "recheck"
          ? this.str("burnTransactionState", "unknown") === "broadcast"
            ? this.str("checkingBurnAction", "Checking...")
            : this.str("recheckBurnAction", "Check transaction")
          : this.primaryAction === "settle"
            ? this.str("settleAction", "Settle season")
            : this.isBurning
              ? this.str("burningAction", "Burning...")
              : phase === "ended"
                ? this.str("settleAction", "Settle season")
                : guest
                  ? `${this.str("guestBurnVerb", "Stoke")} ${this.selectedAmount}`
                  : confirmingThisAmount
                    ? this.str("confirmBurnAction", `Confirm ${this.selectedAmount} GAS`)
                    : this.str("igniteAction", `Ignite ${this.selectedAmount} GAS`),
    );
  }

  private updateLeaderboard(entries: LeaderEntry[]): void {
    this.leaderList.removeAll(true);
    const guest = this.str("appMode", "gamefi") === "guest";
    const unit = this.str("guestUnit", "heat");
    const empty = entries.length === 0;
    this.emptyLeaderLabel.setVisible(empty);
    this.emptyLeaderLabel.setText(
      guest
        ? this.str("guestEmptyLabel", "No runs yet - stoke to start")
        : this.copy("emptyBoard", "No burns yet - ignite first"),
    );
    this.layoutEmptyChip(empty);

    entries.slice(0, this.boardRows).forEach((entry, index) => {
      const y = index * this.boardRowGap;
      const row = this.add.container(this.scW / 2, y);
      const rankColor = entry.rank === 1 ? C.goldDeep : C.inkSoft;
      const bg = this.add.graphics();
      bg.fillStyle(entry.isUser ? 0xfff7df : 0xffffff, entry.isUser ? 0.95 : 0.72);
      bg.fillRoundedRect(-this.boardRowWidth / 2, -9, this.boardRowWidth, 18, 8);
      if (entry.rank === 1) {
        bg.lineStyle(1.25, C.strokeStrong, 0.85);
        bg.strokeRoundedRect(-this.boardRowWidth / 2, -9, this.boardRowWidth, 18, 8);
      }
      row.add(bg);
      row.add(this.add.text(this.boardRankX, 0, `#${entry.rank}`, {
        fontFamily: FONT,
        fontSize: "10px",
        fontStyle: "bold",
        color: toHex(rankColor),
      }).setOrigin(0, 0.5));
      row.add(this.add.text(this.boardAddressX, 0, shortAddress(entry.address, this.scW < 330), {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#765c38",
      }).setOrigin(0, 0.5));
      row.add(this.add.text(
        this.boardValueX,
        0,
        guest ? `${entry.burned.toFixed(0)} ${unit}` : `${entry.burned.toFixed(1)} GAS`,
        {
          fontFamily: FONT,
          fontSize: "10px",
          fontStyle: "bold",
          color: entry.isUser ? "#0f7d56" : "#2a2018",
        },
      ).setOrigin(1, 0.5));
      this.leaderList.add(row);
    });
  }

  private layoutEmptyChip(empty: boolean): void {
    if (!this.emptyLeaderChip) return;
    this.emptyLeaderChip.clear();
    if (!empty) return;
    const b = this.emptyLeaderLabel.getBounds();
    const padX = 12;
    const padY = 5;
    this.emptyLeaderChip.fillStyle(C.surfaceWarm, 0.94);
    this.emptyLeaderChip.fillRoundedRect(b.x - padX, b.y - padY, b.width + padX * 2, b.height + padY * 2, 10);
    this.emptyLeaderChip.lineStyle(1, C.strokeStrong, 0.5);
    this.emptyLeaderChip.strokeRoundedRect(b.x - padX, b.y - padY, b.width + padX * 2, b.height + padY * 2, 10);
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
    if (notify && !this.canSelectPreset()) return;
    this.selectedAmount = amount;
    this.updatePresets();
    this.updateBurnButton();
    this.applyHeat(this.poolHeat(), this.isBurning);
    if (notify) {
      this.sfx.play("tap");
      this.dispatch("setBurnAmount", amount);
    }
  }

  private handleBurn(): void {
    if (!this.canPrimaryAction()) return;
    if (this.primaryAction === "connect") {
      this.sfx.play("tap");
      this.dispatch("connectWallet");
      return;
    }
    if (this.primaryAction === "recheck") {
      this.sfx.play("tap");
      this.dispatch("recheckBurn");
      return;
    }
    if (this.primaryAction === "settle") {
      this.sfx.play("reveal");
      this.dispatch("settle");
      return;
    }
    const guest = this.str("appMode", "gamefi") === "guest";
    const confirmedGesture =
      this.bool("burnConfirmArmed") &&
      this.str("burnConfirmAmount", "") === this.selectedAmount;
    // The first GameFi press only arms an explicit irreversible-action review;
    // consume the fuel/throw animation only on the second, confirmed gesture.
    if (guest || confirmedGesture) {
      this.sfx.play("throw");
      this.flashCore();
      this.emitFuelBurst();
    } else {
      this.sfx.play("tap");
    }
    this.dispatch("burn", this.selectedAmount);
  }

  private flashCore(): void {
    this.pressFeedback(this.coreContainer, { scale: 0.965, duration: 80 });
    this.tween({
      targets: this.coreGlowInner,
      alpha: 0.5,
      duration: 150,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  /** Fuel capsules arc up into the flame and are consumed on a burn. */
  private emitFuelBurst(): void {
    if (!this.coreArt) return;
    for (let i = 0; i < 5; i++) {
      const token = this.add.image(Phaser.Math.Between(-72, 72), 44, BURN_ASSETS.gas)
        .setDisplaySize(16, 16)
        .setAlpha(0.92);
      this.coreArt.add(token);
      this.tween({
        targets: token,
        x: Phaser.Math.Between(-8, 8),
        y: 6,
        displayWidth: 5,
        displayHeight: 5,
        alpha: 0,
        duration: 460,
        delay: i * 60,
        ease: "Cubic.easeIn",
        onComplete: () => token.destroy(),
      });
    }
  }

  private canBurn(): boolean {
    const phase = this.str("seasonPhase", "dormant");
    const guest = this.str("appMode", "gamefi") === "guest";
    const amount = Number(this.selectedAmount);
    const min = this.num("minBurnGas", 1);
    const max = this.num("maxBurnGas", 1000);
    return (
      phase !== "ended" &&
      !this.bool("isBurning") &&
      !this.bool("isSettling") &&
      !this.bool("isLoading") &&
      !this.bool("isConnectingWallet") &&
      (guest || this.bool("walletConnected")) &&
      (guest || this.bool("leagueDataAvailable")) &&
      (guest || !this.str("serviceNotice", "")) &&
      (guest || !this.bool("hasUnknownBurn")) &&
      !this.str("burnValidationError", "") &&
      Number.isFinite(amount) &&
      amount >= min &&
      amount <= max &&
      (guest || this.hasEnoughFunding())
    );
  }

  private canSelectPreset(): boolean {
    return (
      !this.bool("isBurning") &&
      !this.bool("isSettling") &&
      !this.bool("isLoading") &&
      !this.bool("isConnectingWallet") &&
      !this.bool("hasUnknownBurn")
    );
  }

  private hasEnoughFunding(): boolean {
    const amount = Number(this.selectedAmount);
    const walletGas = this.num("walletGasBalance", 0);
    const prepaid = this.num("prepaidCredit", 0);
    return (
      Number.isFinite(amount) &&
      amount > 0 &&
      Number.isFinite(walletGas) &&
      Number.isFinite(prepaid) &&
      walletGas + prepaid >= amount
    );
  }

  private canConnect(): boolean {
    return (
      this.str("appMode", "gamefi") !== "guest" &&
      !this.bool("walletConnected") &&
      !this.bool("isConnectingWallet") &&
      !this.bool("isBurning") &&
      !this.bool("isSettling")
    );
  }

  private canRecheck(): boolean {
    return (
      this.str("appMode", "gamefi") !== "guest" &&
      this.bool("walletConnected") &&
      this.bool("hasUnknownBurn") &&
      !this.bool("isLoading") &&
      !this.bool("isBurning") &&
      !this.bool("isSettling")
    );
  }

  private canSettle(): boolean {
    return (
      this.str("appMode", "gamefi") !== "guest" &&
      this.bool("needsSettle") &&
      !this.bool("isBurning") &&
      !this.bool("isSettling") &&
      !this.bool("isLoading") &&
      this.bool("walletConnected") &&
      !this.bool("hasUnknownBurn")
    );
  }

  private canPrimaryAction(): boolean {
    switch (this.primaryAction) {
      case "connect": return this.canConnect();
      case "recheck": return this.canRecheck();
      case "settle": return this.canSettle();
      default: return this.canBurn();
    }
  }

  private phaseCopy(phase: string, countdown: string): string {
    if (phase === "active") return countdown;
    if (phase === "ended") return this.copy("phaseEnded", "Ended");
    return this.copy("phaseDormant", "Open on first burn");
  }

  private defaultStatus(phase: string, entryCount: number): string {
    if (this.isBurning) return this.copy("walletBurning", "Wallet burn in progress");
    if (phase === "ended") return this.copy("endedStatus", "Season ended. Settle before the next burn");
    if (phase === "dormant") return this.copy("dormantStatus", "First burn opens a fresh season");
    if (entryCount === 0) return this.copy("emptyStatus", "Top burner wins the whole pool");
    return this.copy("activeStatus", "Burn more GAS to climb the live board");
  }

  private guestDefaultStatus(streak: number): string {
    if (this.isBurning) return this.str("guestStokingAction", "Stoking the fire...");
    if (streak === 0) return this.str("guestIntroAction", "Stoke the fire and build a heat streak");
    return this.copy("guestContinue", "Keep stoking - a cooling fire can flare out");
  }

  private copy<K extends keyof SceneText>(key: K, fallback: string): string {
    const value = this.val<SceneText>("sceneText", {})?.[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  }
}

function shortAddress(address: string, compact = false): string {
  const clean = String(address || "").trim();
  const max = compact ? 9 : 12;
  if (clean.length <= max) return clean || "--";
  return compact
    ? `${clean.slice(0, 3)}...${clean.slice(-3)}`
    : `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function toHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function gasText(value: string): string {
  const text = String(value || "0").trim();
  if (!text || text === "--") return "--";
  return /\bGAS\b/i.test(text) ? text : `${text} GAS`;
}

/** Strip any GAS suffix so guest (local) mode shows a bare heat number. */
function heatText(value: string): string {
  const text = String(value ?? "0").replace(/\s*GAS\b/i, "").trim();
  return text || "0";
}
