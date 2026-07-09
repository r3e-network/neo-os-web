/**
 * BurnLeagueScene - Phaser 3 arena view for the Burn League GameFi contest.
 *
 * The blockchain flow stays in useBurnLeague/main.tsx. This scene owns only the
 * playable surface: bright arena art, a lit ceremonial GAS brazier (drawn
 * in-scene with a layered green->gold flame and rising embers), a fuel/heat
 * gauge fed by the pool, GAS fuel capsules, the leaderboard preview, and the
 * burn action. The brazier + flame echo the arena backdrop (a golden bowl with
 * a green ceremonial flame and GAS coins streaming in) so the surface reads as a
 * furnace you feed fuel into rather than a pasted app icon.
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
  ink: 0x2a2018,
  inkSoft: 0x765c38,
  inkMuted: 0x9a825d,
  gold: 0xf5b640,
  goldLight: 0xfbd977,
  goldDeep: 0xb45309,
  green: 0x16a86b,
  greenDeep: 0x0f7d56,
  teal: 0x2fbf8f,
  flameGreen: 0x3ad39a,
  hot: 0xfff3c4,
  coal: 0x3a2411,
  coalDark: 0x271607,
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

type Pt = { x: number; y: number };

export class BurnLeagueScene extends BaseScene {
  private sceneReady = false;
  private isRebuildingScene = false;
  private scW = 420;
  private scH = 600;

  private coreContainer!: Phaser.GameObjects.Container;
  private coreArt!: Phaser.GameObjects.Container;
  private coreGlow!: Phaser.GameObjects.Ellipse;
  private coreGlowInner!: Phaser.GameObjects.Ellipse;
  private brazierBody!: Phaser.GameObjects.Container;
  private flameHolder!: Phaser.GameObjects.Container;
  private flame!: Phaser.GameObjects.Container;
  private gasTokens: Phaser.GameObjects.Image[] = [];

  private coreCX = 210;
  private coreCY = 208;
  private coreScale = 1;

  private heatGauge!: Phaser.GameObjects.Container;
  private heatFill!: Phaser.GameObjects.Graphics;
  private heatFlame!: Phaser.GameObjects.Container;
  private heatTrackTop = 0;
  private heatTrackH = 84;
  private heatTrackW = 12;

  private poolValue!: Phaser.GameObjects.Text;
  private phaseValue!: Phaser.GameObjects.Text;
  private burnedValue!: Phaser.GameObjects.Text;
  private rankValue!: Phaser.GameObjects.Text;
  private leaderList!: Phaser.GameObjects.Container;
  private ghostRows!: Phaser.GameObjects.Container;
  private emptyLeaderChip!: Phaser.GameObjects.Graphics;
  private emptyLeaderLabel!: Phaser.GameObjects.Text;

  private presetBtns: Phaser.GameObjects.Container[] = [];
  private burnBtn!: Phaser.GameObjects.Container;
  private burnBtnBg!: Phaser.GameObjects.Graphics;
  private burnBtnLabel!: Phaser.GameObjects.Text;
  private statusScrim!: Phaser.GameObjects.Graphics;
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

    this.applyHeat(this.poolHeat(), this.isBurning);
    const dim = phase === "ended" ? 0.82 : 1;
    this.brazierBody.setAlpha(dim);
    this.flameHolder.setAlpha(dim);

    this.statusLabel.setText(
      validationError ||
        actionNotice ||
        serviceNotice ||
        this.defaultStatus(phase, leaders.length),
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

    const labelText = this.add.text(textX, -12, label, {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#6b4a1f",
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
    bg.fillStyle(C.surface, 0.96);
    bg.fillRoundedRect(-70, -18, 140, 36, 12);
    bg.lineStyle(1.25, C.stroke, 0.85);
    bg.strokeRoundedRect(-70, -18, 140, 36, 12);
    const labelText = this.add.text(-54, 0, label, {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#8a7048",
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
    const cy = Math.round(height * 0.347);
    const scale = Phaser.Math.Clamp(Math.min(width / 420, height / 600), 0.8, 1.06);
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

    const pedestal = this.buildPedestal();
    this.brazierBody = this.buildBrazier();
    this.flameHolder = this.buildFlame();

    for (let i = 0; i < 8; i++) {
      const size = 17 + (i % 3) * 2;
      const token = this.add.image(0, 0, BURN_ASSETS.gas)
        .setDisplaySize(size, size)
        .setData("baseSize", size)
        .setAlpha(0.6);
      this.gasTokens.push(token);
    }

    const embers = this.buildEmbers();

    // Layer order: glow → pedestal → bowl → tokens (circling in front of the
    // bowl) → flame → embers.
    this.coreArt.add([
      this.coreGlow,
      this.coreGlowInner,
      pedestal,
      this.brazierBody,
      ...this.gasTokens,
      this.flameHolder,
      embers,
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

  /** Green-and-gold ceremonial pedestal echoing the arena backdrop. */
  private buildPedestal(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    // stem/foot under the bowl
    g.fillStyle(C.goldDeep, 1);
    g.fillRoundedRect(-22, 48, 44, 20, 6);
    g.fillStyle(C.gold, 1);
    g.fillRoundedRect(-19, 46, 38, 14, 5);
    // tiered disc: outer gold rim, green band, lit gold top
    g.fillStyle(C.goldDeep, 0.95);
    g.fillEllipse(0, 70, 196, 44);
    g.fillStyle(C.gold, 1);
    g.fillEllipse(0, 68, 190, 40);
    g.fillStyle(C.greenDeep, 1);
    g.fillEllipse(0, 68, 150, 30);
    g.fillStyle(C.green, 1);
    g.fillEllipse(0, 67, 132, 24);
    g.fillStyle(C.goldLight, 1);
    g.fillEllipse(0, 64, 92, 16);
    g.fillStyle(C.gold, 1);
    g.fillEllipse(0, 63, 74, 12);
    // League crest: the app logo embossed as a ceremonial seal on the pedestal
    // front (real art asset, tucked below the bowl so it never clips the HUD).
    const crestRing = this.add.circle(0, 78, 15, C.goldDeep, 1).setStrokeStyle(2, C.goldLight, 0.9);
    const crest = this.add.image(0, 78, BURN_ASSETS.logo).setDisplaySize(22, 22);
    return this.add.container(0, 0, [g, crestRing, crest]);
  }

  /** Wide golden brazier bowl with a dark cavity and a glowing coal bed. */
  private buildBrazier(): Phaser.GameObjects.Container {
    const g = this.add.graphics();

    // Gold rim/lip
    g.fillStyle(C.goldDeep, 1);
    g.fillEllipse(0, 15, 158, 36);
    g.fillStyle(C.gold, 1);
    g.fillEllipse(0, 14, 150, 30);
    g.fillStyle(C.goldLight, 0.85);
    g.fillEllipse(0, 11, 138, 20);

    // Dark interior cavity
    g.fillStyle(C.coalDark, 1);
    g.fillEllipse(0, 15, 118, 22);
    g.fillStyle(C.coal, 1);
    g.fillEllipse(0, 15, 104, 18);

    // Front wall of the bowl (covers the lower half of the cavity so the
    // opening reads as a top-lit rim).
    const wall: Pt[] = [
      { x: -74, y: 22 }, { x: 74, y: 22 }, { x: 60, y: 42 },
      { x: 34, y: 55 }, { x: -34, y: 55 }, { x: -60, y: 42 },
    ];
    g.fillStyle(C.gold, 1);
    g.fillPoints(wall, true);
    // bottom shade for volume
    g.fillStyle(C.goldDeep, 0.5);
    g.fillPoints(
      [{ x: -52, y: 44 }, { x: 52, y: 44 }, { x: 32, y: 55 }, { x: -32, y: 55 }],
      true,
    );
    // left highlight stripe
    g.fillStyle(C.goldLight, 0.55);
    g.fillPoints(
      [{ x: -70, y: 24 }, { x: -60, y: 24 }, { x: -50, y: 42 }, { x: -57, y: 43 }],
      true,
    );

    const bowl = this.add.container(0, 0, [g]);

    // Glowing coal bed (additive) at the rim.
    const coals = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    coals.fillStyle(C.emberDeep, 0.5);
    coals.fillEllipse(0, 16, 90, 16);
    coals.fillStyle(C.ember, 0.7);
    coals.fillEllipse(0, 17, 62, 12);
    coals.fillStyle(C.hot, 0.85);
    coals.fillEllipse(0, 18, 34, 8);
    bowl.add(coals);

    // GAS emblem gem on the bowl face — ties the object to the token/arena.
    const emblem = this.add.graphics();
    emblem.fillStyle(C.goldDeep, 1);
    emblem.fillEllipse(0, 41, 30, 30);
    emblem.fillStyle(C.gold, 1);
    emblem.fillEllipse(0, 41, 24, 24);
    emblem.fillStyle(C.teal, 1);
    emblem.fillEllipse(0, 41, 15, 15);
    emblem.fillStyle(C.hot, 0.85);
    emblem.fillEllipse(-3, 38, 5, 5);
    bowl.add(emblem);

    return bowl;
  }

  /** Layered green->gold->hot flame with a reduced-motion-safe flicker. */
  private buildFlame(): Phaser.GameObjects.Container {
    this.flame = this.add.container(0, 0);

    const outer = this.flameShape(1, C.flameGreen, 0.92);
    const mid = this.flameShape(0.68, C.gold, 0.95);
    const inner = this.flameShape(0.42, C.hot, 0.95, true);
    this.flame.add([outer, mid, inner]);

    // Flicker: subtle vertical breathe + sway, honored under reduced motion by
    // this.tween (which applies the end-state and skips the loop).
    this.tween({
      targets: this.flame,
      scaleY: 1.12,
      scaleX: 0.93,
      duration: 520,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tween({
      targets: this.flame,
      x: 3,
      duration: 700,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tween({
      targets: inner,
      alpha: 0.7,
      duration: 300,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    // Root the flame at the coal bed.
    const holder = this.add.container(0, 12, [this.flame]);
    return holder;
  }

  private flameShape(
    scale: number,
    color: number,
    alpha: number,
    additive = false,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    g.fillPoints(this.flamePoints(scale), true);
    if (additive) g.setBlendMode(Phaser.BlendModes.ADD);
    return g;
  }

  private flamePoints(scale: number): Pt[] {
    const raw = [
      -20, 8, -24, -10, -13, -26, -6, -44, 0, -58,
      6, -42, 13, -26, 22, -8, 18, 8,
    ];
    const pts: Pt[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      pts.push({ x: raw[i]! * scale, y: raw[i + 1]! * scale });
    }
    return pts;
  }

  private buildEmbers(): Phaser.GameObjects.Container {
    const embers = this.add.container(0, 0);
    for (let i = 0; i < 5; i++) {
      const e = this.add.ellipse(
        Phaser.Math.Between(-10, 10),
        12,
        5,
        6,
        i % 2 ? C.ember : C.gold,
        0.9,
      ).setBlendMode(Phaser.BlendModes.ADD);
      embers.add(e);
      this.tween({
        targets: e,
        y: -52 - Phaser.Math.Between(0, 18),
        x: e.x + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 1200 + i * 130,
        delay: i * 220,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(120, 420),
        ease: "Sine.easeOut",
      });
    }
    return embers;
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

    // small flame glyph crowning the gauge
    this.heatFlame = this.add.container(0, -50);
    const gf = this.add.graphics();
    gf.fillStyle(C.ember, 0.95);
    gf.fillPoints(this.flamePoints(0.3), true);
    gf.fillStyle(C.hot, 0.95);
    gf.fillPoints(this.flamePoints(0.16), true);
    this.heatFlame.add(gf);

    this.heatGauge.add([card, track, this.heatFill, ticks, this.heatFlame]);
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
    const panelCY = Math.round(height * 0.63);
    const panelH = 108;
    const panelTop = panelCY - 54;
    const panel = this.add.graphics();
    panel.fillStyle(C.surface, 0.95);
    panel.fillRoundedRect(28, panelTop, width - 56, panelH, 18);
    panel.lineStyle(1.25, C.stroke, 0.85);
    panel.strokeRoundedRect(28, panelTop, width - 56, panelH, 18);

    this.add.text(width / 2, panelTop + 15, "Live leaderboard", {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#6b4a1f",
    }).setOrigin(0.5);

    const rowsTop = panelTop + 40;
    const rowGap = 21;

    // Dim ghost rows keep the empty panel dense and legible about its structure.
    this.ghostRows = this.add.container(0, rowsTop);
    for (let i = 0; i < 3; i++) {
      this.ghostRows.add(this.buildGhostRow(width / 2, i * rowGap, i + 1));
    }

    // Real rows overlay the ghosts once burns land.
    this.leaderList = this.add.container(0, rowsTop);

    // Centered empty-state chip in front of the ghost structure.
    this.emptyLeaderChip = this.add.graphics();
    this.emptyLeaderLabel = this.add.text(width / 2, panelCY + 14, "No burns yet - ignite first", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#8a5a1a",
    }).setOrigin(0.5);
  }

  private buildGhostRow(x: number, y: number, rank: number): Phaser.GameObjects.Container {
    const row = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(C.surfaceWarm, 0.5);
    bg.fillRoundedRect(-166, -9, 332, 18, 8);
    row.add(bg);
    row.add(this.add.text(-150, 0, `#${rank}`, {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#c2ac82",
    }).setOrigin(0, 0.5));
    row.add(this.add.text(-92, 0, "— — — —", {
      fontFamily: FONT,
      fontSize: "10px",
      color: "#c2ac82",
    }).setOrigin(0, 0.5));
    row.add(this.add.text(150, 0, "-- GAS", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#c2ac82",
    }).setOrigin(1, 0.5));
    return row;
  }

  private buildPresets(width: number, height: number): void {
    this.add.text(width / 2, height * 0.772, "Fuel capsules", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#6b4a1f",
    }).setOrigin(0.5);

    const gap = 68;
    const startX = width / 2 - (BURN_PRESETS.length / 2 - 0.5) * gap;
    BURN_PRESETS.forEach((amount, index) => {
      const button = this.add.container(startX + index * gap, height * 0.817);
      const bg = this.add.graphics();
      const glyph = this.add.graphics();
      const label = this.add.text(9, 0, amount, {
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

      button.add([bg, glyph, label]);
      button.setData("bg", bg);
      button.setData("glyph", glyph);
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
    this.statusScrim = this.add.graphics().setDepth(6);
    this.statusLabel = this.add.text(width / 2, height * 0.962, "", {
      fontFamily: FONT,
      fontSize: "11px",
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
    const tall = (0.9 + heat * 0.42) * (burning ? 1.18 : 1);
    const wide = 0.94 + heat * 0.1;
    this.flameHolder.setScale(wide, tall);
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
      const glyph = button.getData("glyph") as Phaser.GameObjects.Graphics;
      const label = button.getData("label") as Phaser.GameObjects.Text;

      bg.clear();
      // Active capsule = filled ember chip; inactive = warm surface.
      bg.fillStyle(active ? C.ember : C.surface, active ? 1 : 0.96);
      bg.fillRoundedRect(-30, -18, 60, 36, 12);
      if (active) {
        bg.fillStyle(C.white, 0.18);
        bg.fillRoundedRect(-30, -18, 60, 15, { tl: 12, tr: 12, bl: 0, br: 0 });
      }
      bg.lineStyle(2, active ? C.emberDeep : C.stroke, active ? 1 : 0.9);
      bg.strokeRoundedRect(-30, -18, 60, 36, 12);

      // Small flame/capsule glyph reads as "fuel", not a bare token mark.
      glyph.clear();
      glyph.setPosition(-16, 1);
      glyph.fillStyle(active ? C.white : C.ember, active ? 0.95 : 0.85);
      glyph.fillPoints(this.flamePoints(0.2), true);
      glyph.fillStyle(active ? C.hot : C.gold, active ? 0.95 : 0.8);
      glyph.fillPoints(this.flamePoints(0.11), true);

      label.setColor(active ? "#ffffff" : "#8a5a1a");
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
    const empty = entries.length === 0;
    this.ghostRows.setVisible(empty);
    this.emptyLeaderLabel.setVisible(empty);
    this.layoutEmptyChip(empty);

    entries.slice(0, 4).forEach((entry, index) => {
      const y = index * 21;
      const row = this.add.container(this.scale.width / 2, y);
      const rankColor = entry.rank === 1 ? C.goldDeep : C.inkSoft;
      const bg = this.add.graphics();
      bg.fillStyle(entry.isUser ? 0xfff7df : 0xffffff, entry.isUser ? 0.95 : 0.72);
      bg.fillRoundedRect(-166, -9, 332, 18, 8);
      if (entry.rank === 1) {
        bg.lineStyle(1.25, C.strokeStrong, 0.85);
        bg.strokeRoundedRect(-166, -9, 332, 18, 8);
      }
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
    if (!this.canBurn()) return;
    this.sfx.play("throw");
    this.flashCore();
    this.emitFuelBurst();
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
