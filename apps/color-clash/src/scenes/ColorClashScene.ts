/**
 * ColorClashScene — Simon Says memory game in Phaser 3.
 *
 * Visual design: 4 large quadrant pads on a dark circular board,
 * bright saturated colors, hard-edge glow on flash, round counter,
 * beat-style scale pulse. Matches the original Simon electronic toy.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState, SceneAudioPreset } from "@framework/phaser";
import { DIFFICULTY_RULES } from "../logic/game-rules";

// ── Palette ────────────────────────────────────────────────────────────────────
const PAD_LIT   = [0xf87171, 0x60a5fa, 0x4ade80, 0xfcd34d] as const; // lit states
const PAD_GLOW  = [0xff9999, 0x93c5fd, 0x86efac, 0xfde68a] as const; // glow halos
const BOARD_BG  = 0xf4ead6;
const BOARD_RIM = 0xb9873c;
const CENTER_BG = 0x3a2f23;
const TEXT_MUTED = "#7c6a52";
const TEXT_MAIN  = "#fff8e8";
const FONT_FAMILY = "Inter, Arial, sans-serif";

const CLASH_ASSETS = {
  console: "color-clash-memory-console",
  table: "color-clash-arcade-table",
  pads: [
    "color-clash-pad-red",
    "color-clash-pad-blue",
    "color-clash-pad-green",
    "color-clash-pad-yellow",
  ],
  badges: [
    "color-clash-badge-easy",
    "color-clash-badge-medium",
    "color-clash-badge-hard",
  ],
} as const;

const PAD_FILES = [
  "./art/pad-red.webp",
  "./art/pad-blue.webp",
  "./art/pad-green.webp",
  "./art/pad-yellow.webp",
] as const;

const BADGE_FILES = [
  "./art/badge-easy.webp",
  "./art/badge-medium.webp",
  "./art/badge-hard.webp",
] as const;

const MODE_LABELS = ["Pulse", "Neon", "Master"] as const;
const MODE_COPY = ["8 cues", "12 cues", "16 cues"] as const;

// Classic Simon pad voices (Hz): red E4, blue C#4, green A3, yellow E3.
// Matches PAD_LIT order: 0=red, 1=blue, 2=green, 3=yellow.
const PAD_TONE_HZ = [329.6, 277.2, 220, 164.8] as const;

type ModeCard = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  width: number;
  height: number;
};

// Pad layout: 4 quadrants of the circle
// Top=0, Right=1, Bottom=2, Left=3  (matches classic Simon CCW order for colors)
export class ColorClashScene extends BaseScene {
  private sceneReady = false;
  private isRebuildingScene = false;
  private scW = 420;
  private scH = 580;

  private padGraphics: Phaser.GameObjects.Graphics[] = [];
  private padGlows: Phaser.GameObjects.Ellipse[] = [];
  private padButtons: Phaser.GameObjects.Container[] = [];
  private padButtonImages: Phaser.GameObjects.Image[] = [];

  private roundLabel!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private statusBar!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Container;
  private startBtnBg!: Phaser.GameObjects.Graphics;
  private startBtnLabel!: Phaser.GameObjects.Text;
  private modeCards: ModeCard[] = [];
  private progressRow!: Phaser.GameObjects.Container;
  private progressDots: Phaser.GameObjects.Arc[] = [];

  private flashIndex = -1;
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  private lastSequenceLen = 0;
  private selectedDifficulty = 0;
  private currentStatus = "idle";
  private currentSequence = "";
  private currentPlayer = "";
  private currentLastStatus = "";
  // Last phase-cue key so one-shot sounds fire once per transition,
  // not on every React state push.
  private lastPhaseCue = "";

  constructor() { super("ColorClashScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  preload(): void {
    this.load.image(CLASH_ASSETS.console, "./art/memory-console.webp");
    this.load.image(CLASH_ASSETS.table, "./art/arcade-table.webp");
    PAD_FILES.forEach((file, index) => this.load.image(CLASH_ASSETS.pads[index]!, file));
    BADGE_FILES.forEach((file, index) => this.load.image(CLASH_ASSETS.badges[index]!, file));
  }

  create(): void {
    super.create();
    this.syncSceneSize();
    this.rebuildScene();
    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  protected onResize(gameSize: Phaser.Structs.Size): void {
    const previousW = this.scW;
    const previousH = this.scH;
    this.syncSceneSize(gameSize);
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

  private syncSceneSize(gameSize?: Phaser.Structs.Size): void {
    this.scW = Math.max(1, Math.round(gameSize?.width || this.scale.width || 420));
    this.scH = Math.max(1, Math.round(gameSize?.height || this.scale.height || 580));
  }

  private rebuildScene(): void {
    this.isRebuildingScene = true;
    this.flashTimer?.destroy();
    this.flashTimer = null;
    this.tweens.killAll();
    this.children.removeAll(true);

    this.padGraphics = [];
    this.padGlows = [];
    this.padButtons = [];
    this.padButtonImages = [];
    this.modeCards = [];
    this.progressDots = [];
    this.flashIndex = -1;
    this.lastSequenceLen = 0;

    const W = this.scW;
    const H = this.scH;
    this.drawBackground(W, H);
    this.buildModeDock(W, H);
    this.buildBoard(W, H);
    this.buildCenterHub(W, H);
    this.buildPadButtons(W, H);
    this.buildHUD(W, H);
    this.buildStartButton(W, H);
    this.buildProgressRow(W, H);

    this.isRebuildingScene = false;
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady || this.isRebuildingScene || !this.statusBar || !this.phaseLabel) {
      return;
    }

    const status     = this.str("gameStatus", "idle");
    const lastSt     = this.str("lastStatus", "");
    const sequence   = this.str("sequence", "");
    const player     = this.str("playerSequence", "");
    const roundNum   = this.num("roundNumber", 0);
    const difficulty = this.num("gameDifficulty", this.selectedDifficulty);

    this.currentStatus = status;
    this.currentSequence = sequence;
    this.currentPlayer = player;
    this.currentLastStatus = lastSt;

    // Update round label
    this.roundLabel.setText(roundNum > 0 ? `Round ${roundNum}` : "");

    // Show/hide start button
    const showStart = status === "idle" || status === "solved" || status === "expired";
    this.startBtn.setVisible(showStart);
    this.progressRow.setVisible(!showStart);
    this.modeCards.forEach(({ container }) => container.setVisible(showStart));
    if (showStart && difficulty !== this.selectedDifficulty) {
      this.selectedDifficulty = Math.max(0, Math.min(DIFFICULTY_RULES.length - 1, difficulty));
    }
    this.updateModeCards();
    this.updateStartButton(status);

    // Status bar
    this.statusBar.setText(lastSt);

    // Phase label in center
    if (status === "dealt") {
      if (lastSt.includes("wrong") || lastSt === "wrong") {
        this.phaseLabel.setText("WRONG").setColor("#f87171");
        this.phaseCue("wrong", "error");
      } else if (lastSt.includes("correct") || sequence.length > 0 && player.length === sequence.length) {
        this.phaseLabel.setText("CORRECT").setColor("#4ade80");
        this.phaseCue("correct", "combo");
      } else if (player.length === 0 && sequence.length > 0) {
        this.phaseLabel.setText("WATCH").setColor("#fcd34d");
        this.phaseCue("watch");
        this.startFlashSequence(sequence);
      } else {
        this.phaseLabel.setText("REPEAT").setColor("#60a5fa");
        this.phaseCue("repeat");
      }
    } else if (status === "idle") {
      this.phaseLabel.setText("READY").setColor(TEXT_MAIN);
      this.phaseCue("idle");
    } else if (status === "solved") {
      this.phaseLabel.setText("WIN!").setColor("#4ade80");
      this.phaseCue("solved", "win");
    } else if (status === "expired") {
      this.phaseLabel.setText("END").setColor("#f87171");
      this.phaseCue("expired", "lose");
    }

    // Progress dots
    if (sequence.length !== this.lastSequenceLen) {
      this.rebuildProgressDots(sequence.length);
      this.lastSequenceLen = sequence.length;
    }
    this.progressDots.forEach((dot, i) => {
      dot.setFillStyle(i < player.length ? PAD_LIT[i % 4]! : 0x334155);
    });

    // Pad interactivity
    const canPress = this.canPressPads();
    this.padGraphics.forEach((_, i) => {
      const interactive = canPress;
      if (this.padGlows[i]) {
        this.padGlows[i]!.setVisible(!interactive ? false : this.flashIndex === i);
      }
    });
    this.padButtons.forEach((button, index) => {
      button.setAlpha(canPress ? 1 : 0.74);
      this.padButtonImages[index]?.setScale(this.flashIndex === index ? 0.96 : 0.9);
    });
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, BOARD_BG);
    this.add.image(W / 2, H * 0.50, CLASH_ASSETS.table)
      .setDisplaySize(W * 1.18, Math.min(156, H * 0.28))
      .setAlpha(0.72);
    const rim = this.add.graphics();
    rim.fillStyle(0xfffbef, 0.55);
    rim.fillRoundedRect(14, 14, W - 28, H - 28, 24);
    rim.lineStyle(2, 0xd8b46d, 0.42);
    rim.strokeRoundedRect(14, 14, W - 28, H - 28, 24);
  }

  // ── Mode dock ──────────────────────────────────────────────────────────────

  private buildModeDock(W: number, H: number): void {
    const compact = W < 360;
    const gap = compact ? 6 : 8;
    const sideInset = compact ? 30 : 28;
    const cardW = compact
      ? Math.min(92, Math.max(78, (W - sideInset * 2 - gap * 2) / 3))
      : 112;
    const cardH = compact ? 48 : 54;
    const badgeSize = compact ? 28 : 34;
    const badgeX = -cardW / 2 + badgeSize / 2 + (compact ? 3 : 4);
    const textX = -cardW / 2 + badgeSize + (compact ? 9 : 12);
    const total = cardW * 3 + gap * 2;
    const startX = W / 2 - total / 2 + cardW / 2;
    const y = H * 0.11;

    DIFFICULTY_RULES.forEach((rule, index) => {
      const container = this.add.container(startX + index * (cardW + gap), y);
      const bg = this.add.graphics();
      const hit = this.add.zone(0, 0, cardW, cardH).setInteractive({ useHandCursor: true });
      const badge = this.add.image(badgeX, 0, CLASH_ASSETS.badges[index]!)
        .setDisplaySize(badgeSize, badgeSize);
      const label = this.add.text(textX, compact ? -7 : -8, MODE_LABELS[index] ?? "Pulse", {
        fontFamily: FONT_FAMILY,
        fontSize: compact ? "11px" : "12px",
        fontStyle: "bold",
        color: "#4f4235",
      }).setOrigin(0, 0.5);
      const meta = this.add.text(textX, compact ? 8 : 9, MODE_COPY[index] ?? `${rule.targetSeq} cues`, {
        fontFamily: FONT_FAMILY,
        fontSize: compact ? "9px" : "10px",
        color: TEXT_MUTED,
      }).setOrigin(0, 0.5);

      this.bindGameButton(hit, {
        targets: container,
        pressScale: 0.97,
        hoverScale: 1.02,
        enabled: () => this.currentStatus === "idle" || this.currentStatus === "solved" || this.currentStatus === "expired",
        onPress: () => {
          this.selectedDifficulty = index;
          this.updateModeCards();
        },
      });

      container.add([bg, hit, badge, label, meta]);
      this.modeCards.push({ container, bg, label, width: cardW, height: cardH });
    });
  }

  private updateModeCards(): void {
    this.modeCards.forEach((card, index) => {
      const active = index === this.selectedDifficulty;
      this.drawModeCard(card.bg, active, card.width, card.height);
      card.label.setColor(active ? "#123c35" : "#4f4235");
    });
  }

  private drawModeCard(g: Phaser.GameObjects.Graphics, active: boolean, width: number, height: number): void {
    const radius = Math.min(14, height / 3.6);
    g.clear();
    g.fillStyle(active ? 0xf2fffb : 0xfffdf8, active ? 0.98 : 0.92);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    g.lineStyle(active ? 2 : 1, active ? 0x12a998 : 0xeadfc8, active ? 0.82 : 0.9);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }

  // ── Main board (4 quadrant pads) ───────────────────────────────────────────

  private buildBoard(W: number, H: number): void {
    const cx = W / 2;
    const compact = W < 400;
    const cy = H * (compact ? 0.38 : 0.44);
    const R  = Math.min(W, H) * (compact ? 0.30 : 0.41);
    const innerR = R * 0.18;  // center hub radius
    const gap    = 5;          // px gap between pads

    this.add.image(cx, cy, CLASH_ASSETS.console)
      .setDisplaySize(R * (compact ? 2.02 : 2.18), R * (compact ? 2.02 : 2.18))
      .setDepth(1);

    // Board outline
    const outline = this.add.graphics();
    outline.setDepth(2);
    outline.lineStyle(5, BOARD_RIM, 0.55);
    outline.strokeCircle(cx, cy, R + 5);

    // 4 pads: top, right, bottom, left
    for (let i = 0; i < 4; i++) {
      // Glow halo (behind pad)
      const glow = this.add.ellipse(cx, cy, R * 1.9, R * 1.9, PAD_LIT[i]!, 0.0);
      glow.setDepth(3);
      this.padGlows.push(glow);

      const g = this.add.graphics();
      g.setDepth(4);
      this.padGraphics.push(g);
      this.drawPad(g, cx, cy, R, innerR, gap, i, false);

      // Hit area: pie-slice zone via interactive region
      const hitZone = this.add.zone(cx, cy, R * 2, R * 2);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < innerR + 4 || dist > R + 10) return;
        // Determine which pad was clicked by angle
        const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const padIdx = ColorClashScene.angleToPad(angle);
        this.handlePress(padIdx);
      });
      hitZone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < innerR + 4 || dist > R + 10) return;
        const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const padIdx = ColorClashScene.angleToPad(angle);
        if (this.canPressPads() && this.flashIndex !== padIdx) this.lightPad(padIdx, true, 0.35);
      });
      hitZone.on("pointerout", () => {
        if (this.flashIndex === -1) {
          this.padGraphics.forEach((pg, idx) => this.drawPad(pg, cx, cy, R, innerR, gap, idx, false));
        }
      });

    }
  }

  /** Map 360° angle to pad index: top=0, right=1, bottom=2, left=3. */
  private static angleToPad(angleDeg: number): number {
    if (angleDeg >= 315 || angleDeg < 45)  return 1; // right
    if (angleDeg >= 45  && angleDeg < 135) return 2; // bottom
    if (angleDeg >= 135 && angleDeg < 225) return 3; // left
    return 0;                                          // top
  }

  /**
   * Draw one pie-slice pad using Graphics fillStyle + arc.
   * Each pad occupies 90° of the outer ring minus a small gap.
   */
  private drawPad(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    outerR: number, innerR: number,
    gap: number,
    index: number,
    lit: boolean,
  ): void {
    g.clear();
    if (!lit) {
      return;
    }
    const startDeg = index * 90 - 45 + (gap / outerR) * (180 / Math.PI);
    const endDeg   = startDeg + 90 - (gap / outerR) * 2 * (180 / Math.PI);
    const startRad = Phaser.Math.DegToRad(startDeg);
    const endRad   = Phaser.Math.DegToRad(endDeg);

    const color = PAD_LIT[index]!;
    g.fillStyle(color, 0.28);

    // Build the pie ring shape
    g.beginPath();
    g.arc(cx, cy, outerR, startRad, endRad, false);
    g.arc(cx, cy, innerR + gap, endRad, startRad, true);
    g.closePath();
    g.fillPath();

    g.lineStyle(4, PAD_GLOW[index]!, 0.82);
    g.beginPath();
    g.arc(cx, cy, outerR - 2, startRad, endRad, false);
    g.strokePath();
  }

  private lightPad(index: number, on: boolean, alpha = 1): void {
    const W = this.scW;
    const H = this.scH;
    const compact = W < 400;
    const cx = W / 2, cy = H * (compact ? 0.38 : 0.44);
    const R = Math.min(W, H) * (compact ? 0.30 : 0.41);
    const innerR = R * 0.18;
    this.drawPad(this.padGraphics[index]!, cx, cy, R, innerR, 5, index, on);
    this.padGlows[index]?.setAlpha(on ? alpha * 0.12 : 0);
  }

  // ── Center hub ─────────────────────────────────────────────────────────────

  private buildCenterHub(W: number, H: number): void {
    const cx = W / 2;
    const compact = W < 400;
    const cy = H * (compact ? 0.38 : 0.44);
    const R  = Math.min(W, H) * (compact ? 0.30 : 0.41) * 0.18;

    // Hub circle
    this.add.circle(cx, cy, R, CENTER_BG).setDepth(5);
    this.add.circle(cx, cy, R - 2, 0x0f172a).setDepth(5);

    this.phaseLabel = this.add.text(cx, cy, "SIMON", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: TEXT_MAIN,
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(6);
  }

  // ── Physical pad buttons ──────────────────────────────────────────────────

  private buildPadButtons(W: number, H: number): void {
    const compact = W < 400;
    const y = H * (compact ? 0.73 : 0.745);
    const gap = compact ? Math.max(52, W * 0.17) : 68;
    const startX = W / 2 - gap * 1.5;
    const glowSize = compact ? 48 : 58;
    const padSize = compact ? 46 : 54;
    const hitRadius = compact ? 26 : 30;
    const names = ["RED", "BLUE", "GREEN", "YELLOW"];

    for (let index = 0; index < 4; index++) {
      const container = this.add.container(startX + index * gap, y);
      const glow = this.add.ellipse(0, 0, glowSize, glowSize, PAD_LIT[index]!, 0.16);
      const pad = this.add.image(0, 0, CLASH_ASSETS.pads[index]!)
        .setDisplaySize(padSize, padSize)
        .setScale(0.9);
      const label = this.add.text(0, 35, names[index]!, {
        fontFamily: FONT_FAMILY,
        fontSize: compact ? "7px" : "8px",
        fontStyle: "bold",
        color: TEXT_MUTED,
      }).setOrigin(0.5);
      label.setY(compact ? 30 : 35);
      const hit = this.add.circle(0, 0, hitRadius, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      this.bindGameButton(hit, {
        targets: container,
        pressScale: 0.93,
        hoverScale: 1.04,
        onPress: () => this.handlePress(index),
      });

      container.add([glow, pad, label, hit]);
      this.padButtons.push(container);
      this.padButtonImages.push(pad);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(W: number, H: number): void {
    this.roundLabel = this.add.text(W / 2, H * 0.11, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      color: TEXT_MUTED,
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.statusBar = this.add.text(W / 2, H * 0.97, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: TEXT_MUTED,
    }).setOrigin(0.5);
  }

  // ── Start button ───────────────────────────────────────────────────────────

  private buildStartButton(W: number, H: number): void {
    this.startBtn = this.add.container(W / 2, H * 0.89);
    const bg = this.add.graphics();
    this.startBtnBg = bg;
    bg.fillStyle(0x1d4ed8);
    bg.fillRoundedRect(-92, -24, 184, 48, 14);
    bg.lineStyle(2, 0x3b82f6);
    bg.strokeRoundedRect(-92, -24, 184, 48, 14);
    bg.setInteractive(new Phaser.Geom.Rectangle(-92, -24, 184, 48), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: this.startBtn,
      pressScale: 0.94,
      pressDuration: 80,
      onPress: () => this.handleStart(),
    });

    const lbl = this.add.text(0, 0, "OPEN SEQUENCE", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#ffffff",
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.startBtnLabel = lbl;

    this.startBtn.add([bg, lbl]);
  }

  private updateStartButton(status: string): void {
    const isStarting = this.bool("isStarting") || this.bool("isDealing");
    const label = isStarting
      ? "SEALING..."
      : status === "solved"
        ? "PLAY AGAIN"
        : status === "expired"
          ? "TRY AGAIN"
          : "OPEN SEQUENCE";
    this.startBtnLabel.setText(label);
    this.startBtnBg.clear();
    this.startBtnBg.fillStyle(isStarting ? 0xbba989 : 0x12a998);
    this.startBtnBg.fillRoundedRect(-96, -24, 192, 48, 14);
    this.startBtnBg.lineStyle(2, isStarting ? 0xd8b46d : 0x4adecf, 0.9);
    this.startBtnBg.strokeRoundedRect(-96, -24, 192, 48, 14);
  }

  // ── Progress row ───────────────────────────────────────────────────────────

  private buildProgressRow(W: number, H: number): void {
    this.progressRow = this.add.container(W / 2, H * 0.88);
    this.progressRow.setVisible(false);
  }

  private rebuildProgressDots(count: number): void {
    this.progressDots.forEach((d) => d.destroy());
    this.progressDots = [];
    if (count === 0) return;

    const { width: W } = this.scale;
    const spacing = Math.min(18, (W * 0.8) / count);
    const startX  = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(startX + i * spacing, 0, 5, 0xd1c4af);
      this.progressRow.add(dot);
      this.progressDots.push(dot);
    }
  }

  // ── Audio ──────────────────────────────────────────────────────────────────

  /** Play the fixed classic-Simon voice for one pad. */
  private playPadTone(index: number): void {
    const frequency = PAD_TONE_HZ[index];
    if (frequency === undefined) return;
    this.sfx.tones([{ frequency, duration: 0.18, type: "sine", gain: 0.025 }]);
  }

  /** Fire a one-shot phase cue only when the phase key changes. */
  private phaseCue(key: string, preset?: SceneAudioPreset): void {
    if (key === this.lastPhaseCue) return;
    this.lastPhaseCue = key;
    if (preset) this.sfx.play(preset);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private handleStart(): void {
    this.sfx.play("start");
    this.dispatch("startGame", this.selectedDifficulty);
    this.flashTimer?.destroy();
    this.flashIndex = -1;
    this.applyFlash();
  }

  private handlePress(colorIdx: number): void {
    this.sfx.unlock();
    if (!this.canPressPads()) return;
    this.playPadTone(colorIdx);
    this.flashPad(colorIdx, 180);
    this.dispatch("recordPress", colorIdx);
  }

  private canPressPads(): boolean {
    return (
      this.currentStatus === "dealt" &&
      this.currentPlayer.length < this.currentSequence.length &&
      this.currentLastStatus !== "wrong"
    );
  }

  // ── Flash sequence playback ────────────────────────────────────────────────

  private startFlashSequence(sequence: string): void {
    this.flashTimer?.destroy();
    let step = 0;
    const totalSteps = sequence.length * 2;
    const playStep = () => {
      if (step >= totalSteps) {
        this.flashIndex = -1;
        this.applyFlash();
        return;
      }
      if (step % 2 === 0) {
        this.flashIndex = parseInt(sequence[Math.floor(step / 2)]!, 10);
        this.playPadTone(this.flashIndex);
      } else {
        this.flashIndex = -1;
      }
      this.applyFlash();
      step++;
      const delay = step % 2 === 0 ? 180 : 320;
      this.flashTimer = this.time.delayedCall(delay, playStep);
    };
    this.flashTimer = this.time.delayedCall(300, playStep);
  }

  private flashPad(index: number, duration: number): void {
    this.lightPad(index, true);
    const padG = this.padGraphics[index];
    const padButton = this.padButtonImages[index];
    if (padG) {
      this.tweens.add({
        targets: padG,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: duration / 2,
        yoyo: true,
      });
    }
    if (padButton) {
      this.tweens.add({
        targets: padButton,
        scale: 1.03,
        duration: duration / 2,
        yoyo: true,
      });
    }
    this.time.delayedCall(duration, () => {
      if (this.flashIndex !== index) this.lightPad(index, false);
    });
  }

  private applyFlash(): void {
    for (let i = 0; i < 4; i++) {
      this.lightPad(i, this.flashIndex === i);
    }
  }
}
