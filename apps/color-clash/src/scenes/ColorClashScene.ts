/**
 * ColorClashScene — Simon Says memory game in Phaser 3.
 *
 * Visual design: 4 large quadrant pads on a dark circular board,
 * bright saturated colors, hard-edge glow on flash, round counter,
 * beat-style scale pulse. Matches the original Simon electronic toy.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

// ── Palette ────────────────────────────────────────────────────────────────────
const PAD_DIM   = [0x991b1b, 0x1e3a8a, 0x14532d, 0x713f12] as const; // dim states
const PAD_LIT   = [0xf87171, 0x60a5fa, 0x4ade80, 0xfcd34d] as const; // lit states
const PAD_GLOW  = [0xff9999, 0x93c5fd, 0x86efac, 0xfde68a] as const; // glow halos
const BOARD_BG  = 0x0f172a;
const BOARD_RIM = 0x1e293b;
const CENTER_BG = 0x1e293b;
const TEXT_MUTED = "#64748b";
const TEXT_MAIN  = "#f1f5f9";

const PAD_LABELS = ["▲", "◀", "▼", "▶"] as const;   // Top / Left / Bottom / Right

// Pad layout: 4 quadrants of the circle
// Top=0, Right=1, Bottom=2, Left=3  (matches classic Simon CCW order for colors)
const PAD_ANGLES = [270, 0, 90, 180] as const;   // degrees from center

export class ColorClashScene extends BaseScene {
  private padGraphics: Phaser.GameObjects.Graphics[] = [];
  private padLabels: Phaser.GameObjects.Text[] = [];
  private padGlows: Phaser.GameObjects.Ellipse[] = [];

  private roundLabel!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private statusBar!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Container;
  private progressRow!: Phaser.GameObjects.Container;
  private progressDots: Phaser.GameObjects.Arc[] = [];

  private flashIndex = -1;
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  private lastSequenceLen = 0;

  constructor() { super("ColorClashScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildBoard(W, H);
    this.buildCenterHub(W, H);
    this.buildHUD(W, H);
    this.buildStartButton(W, H);
    this.buildProgressRow(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const lastSt     = this.str("lastStatus", "");
    const sequence   = this.str("sequence", "");
    const player     = this.str("playerSequence", "");
    const roundNum   = this.num("roundNumber", 0);

    // Update round label
    this.roundLabel.setText(roundNum > 0 ? `Round ${roundNum}` : "");

    // Show/hide start button
    const showStart = status === "idle" || status === "solved" || status === "expired";
    this.startBtn.setVisible(showStart);
    this.progressRow.setVisible(!showStart);

    // Status bar
    this.statusBar.setText(lastSt);

    // Phase label in center
    if (status === "dealt") {
      if (lastSt.includes("wrong") || lastSt === "wrong") {
        this.phaseLabel.setText("✗ Wrong!").setColor("#f87171");
      } else if (lastSt.includes("correct") || sequence.length > 0 && player.length === sequence.length) {
        this.phaseLabel.setText("✓ Correct!").setColor("#4ade80");
      } else if (player.length === 0 && sequence.length > 0) {
        this.phaseLabel.setText("WATCH").setColor("#fcd34d");
        this.startFlashSequence(sequence);
      } else {
        this.phaseLabel.setText("REPEAT").setColor("#60a5fa");
      }
    } else if (status === "idle") {
      this.phaseLabel.setText("SIMON").setColor(TEXT_MAIN);
    } else if (status === "solved") {
      this.phaseLabel.setText("WIN!").setColor("#4ade80");
    } else if (status === "expired") {
      this.phaseLabel.setText("END").setColor("#f87171");
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
    const canPress = status === "dealt" && player.length < sequence.length && lastSt !== "wrong";
    this.padGraphics.forEach((_, i) => {
      const interactive = canPress;
      if (this.padGlows[i]) {
        this.padGlows[i]!.setVisible(!interactive ? false : this.flashIndex === i);
      }
    });
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    // Dark slate background
    this.add.rectangle(W / 2, H / 2, W, H, BOARD_BG);
    // Subtle radial gradient ring
    const rim = this.add.graphics();
    rim.lineStyle(60, 0x1e293b, 0.5);
    rim.strokeCircle(W / 2, H * 0.46, W * 0.52);
  }

  // ── Main board (4 quadrant pads) ───────────────────────────────────────────

  private buildBoard(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.44;
    const R  = Math.min(W, H) * 0.41;
    const innerR = R * 0.18;  // center hub radius
    const gap    = 5;          // px gap between pads

    // Board outline
    const outline = this.add.graphics();
    outline.lineStyle(5, BOARD_RIM, 0.8);
    outline.strokeCircle(cx, cy, R + 5);

    // 4 pads: top, right, bottom, left
    for (let i = 0; i < 4; i++) {
      // Glow halo (behind pad)
      const glow = this.add.ellipse(cx, cy, R * 1.9, R * 1.9, PAD_LIT[i]!, 0.0);
      this.padGlows.push(glow);

      const g = this.add.graphics();
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
        if (this.flashIndex !== padIdx) this.lightPad(padIdx, true, 0.35);
      });
      hitZone.on("pointerout", () => {
        if (this.flashIndex === -1) {
          this.padGraphics.forEach((pg, idx) => this.drawPad(pg, cx, cy, R, innerR, gap, idx, false));
        }
      });

      // Pad label (positioned in center of quadrant)
      const labelAngle = Phaser.Math.DegToRad(PAD_ANGLES[i]!);
      const lx = cx + Math.cos(labelAngle) * R * 0.62;
      const ly = cy + Math.sin(labelAngle) * R * 0.62;
      const lbl = this.add.text(lx, ly, PAD_LABELS[i]!, {
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffffff",
      }).setOrigin(0.5).setAlpha(0.5);
      this.padLabels.push(lbl);
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
    const startDeg = index * 90 - 45 + (gap / outerR) * (180 / Math.PI);
    const endDeg   = startDeg + 90 - (gap / outerR) * 2 * (180 / Math.PI);
    const startRad = Phaser.Math.DegToRad(startDeg);
    const endRad   = Phaser.Math.DegToRad(endDeg);

    const color = lit ? PAD_LIT[index]! : PAD_DIM[index]!;
    g.fillStyle(color, lit ? 1.0 : 0.85);

    // Build the pie ring shape
    g.beginPath();
    g.arc(cx, cy, outerR, startRad, endRad, false);
    g.arc(cx, cy, innerR + gap, endRad, startRad, true);
    g.closePath();
    g.fillPath();

    // Lighter edge on lit pad
    if (lit) {
      g.lineStyle(3, PAD_GLOW[index]!, 0.7);
      g.beginPath();
      g.arc(cx, cy, outerR - 2, startRad, endRad, false);
      g.strokePath();
    }
  }

  private lightPad(index: number, on: boolean, alpha = 1): void {
    const { width: W, height: H } = this.scale;
    const cx = W / 2, cy = H * 0.44;
    const R = Math.min(W, H) * 0.41;
    const innerR = R * 0.18;
    this.drawPad(this.padGraphics[index]!, cx, cy, R, innerR, 5, index, on);
    this.padGlows[index]?.setAlpha(on ? alpha * 0.12 : 0);
    this.padLabels[index]?.setAlpha(on ? 0.95 : 0.5);
  }

  // ── Center hub ─────────────────────────────────────────────────────────────

  private buildCenterHub(W: number, H: number): void {
    const cx = W / 2;
    const cy = H * 0.44;
    const R  = Math.min(W, H) * 0.41 * 0.18;

    // Hub circle
    this.add.circle(cx, cy, R, CENTER_BG).setDepth(5);
    this.add.circle(cx, cy, R - 2, 0x0f172a).setDepth(5);

    this.phaseLabel = this.add.text(cx, cy, "SIMON", {
      fontSize: "13px",
      fontStyle: "bold",
      color: TEXT_MAIN,
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(6);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(W: number, H: number): void {
    this.roundLabel = this.add.text(W / 2, H * 0.11, "", {
      fontSize: "14px",
      color: TEXT_MUTED,
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.statusBar = this.add.text(W / 2, H * 0.97, "", {
      fontSize: "11px",
      color: TEXT_MUTED,
    }).setOrigin(0.5);
  }

  // ── Start button ───────────────────────────────────────────────────────────

  private buildStartButton(W: number, H: number): void {
    this.startBtn = this.add.container(W / 2, H * 0.86);
    const bg = this.add.graphics();
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

    const lbl = this.add.text(0, 0, "START GAME", {
      fontSize: "16px", fontStyle: "bold", color: "#ffffff", letterSpacing: 2,
    }).setOrigin(0.5);

    this.startBtn.add([bg, lbl]);
  }

  // ── Progress row ───────────────────────────────────────────────────────────

  private buildProgressRow(W: number, H: number): void {
    this.progressRow = this.add.container(W / 2, H * 0.84);
    this.progressRow.setVisible(false);
  }

  private rebuildProgressDots(count: number): void {
    this.progressDots.forEach((d) => d.destroy());
    this.progressDots = [];
    if (count === 0) return;

    const { width: W, height: H } = this.scale;
    const spacing = Math.min(18, (W * 0.8) / count);
    const startX  = W / 2 - ((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(startX + i * spacing, H * 0.84, 5, 0x334155);
      this.progressDots.push(dot);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private handleStart(): void {
    const diff = this.num("gameDifficulty", 0);
    this.dispatch("startGame", diff);
    this.flashTimer?.destroy();
    this.flashIndex = -1;
    this.applyFlash();
  }

  private handlePress(colorIdx: number): void {
    this.flashPad(colorIdx, 180);
    this.dispatch("recordPress", colorIdx);
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
      } else {
        this.flashIndex = -1;
      }
      this.applyFlash();
      step++;
      const delay = step % 2 === 0 ? 180 : 320;
      this.flashTimer = this.time.delayedCall(delay, playStep);
    };
    this.time.delayedCall(300, playStep);
  }

  private flashPad(index: number, duration: number): void {
    this.lightPad(index, true);
    const padG = this.padGraphics[index];
    if (padG) {
      this.tweens.add({
        targets: padG,
        scaleX: 1.04,
        scaleY: 1.04,
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
