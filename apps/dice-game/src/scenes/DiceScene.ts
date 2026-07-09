/**
 * DiceScene — Professional casino dice game for Phaser 3.
 *
 * Visual design: classic casino table with green felt, white dice,
 * chip presets, payout display. Matches real-world dice/casino aesthetics.
 */
import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import { officialGasTokenPhaserUrl } from "@shared/art/token-assets";

// ── Casino color palette ─────────────────────────────────────────────────────
// Richer bottle-green felt (was a bright mint) reads closer to a real casino
// table while keeping the warm gold rail + cream dice popping for contrast.
const FELT_GREEN   = 0x2c8a56;
const FELT_DARK    = 0x18683d;
const FELT_SHADOW  = 0x123524;
const GOLD         = 0xd4a843;
const GOLD_LIGHT   = 0xf0c866;
const CREAM        = 0xfff8e8;
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
const DIE_SIZE     = 88;

const DIE_FACE_ASSETS = [
  "dice-die-white-1",
  "dice-die-white-2",
  "dice-die-white-3",
  "dice-die-white-4",
  "dice-die-white-5",
  "dice-die-white-6",
] as const;
const DIE_FACE_FILES = [
  "./art/die-white-1.webp",
  "./art/die-white-2.webp",
  "./art/die-white-3.webp",
  "./art/die-white-4.webp",
  "./art/die-white-5.webp",
  "./art/die-white-6.webp",
] as const;
const ASSET_GAS_ICON = "dice-gas-token-icon";

// Chip preset definitions
const CHIP_PRESETS = [
  { amount: "0.10", asset: "dice-chip-green", file: "./art/chip-green.webp", label: "0.10" },
  { amount: "0.50", asset: "dice-chip-blue",  file: "./art/chip-blue.webp",  label: "0.50" },
  { amount: "1.00", asset: "dice-chip-red",   file: "./art/chip-red.webp",   label: "1.00" },
  { amount: "5.00", asset: "dice-chip-black", file: "./art/chip-black.webp", label: "5.00" },
] as const;

const PAYOUT_MULT = 5.7;
type SfxKind = "select" | "chip" | "throw" | "tick" | "land" | "win" | "lose" | "refund";

export class DiceScene extends BaseScene {
  // ── Scene objects ──────────────────────────────────────────────────────────
  private diceGroup!: Phaser.GameObjects.Container;
  private dieFace1!: Phaser.GameObjects.Image;   // main die
  private dieShadow!: Phaser.GameObjects.Ellipse;
  private throwTrail!: Phaser.GameObjects.Graphics;

  private faceButtons: Phaser.GameObjects.Container[] = [];
  private chipButtons: Phaser.GameObjects.Container[] = [];
  private rollBtn!: Phaser.GameObjects.Container;
  private rollBtnBg!: Phaser.GameObjects.Graphics;
  private rollBtnLabel!: Phaser.GameObjects.Text;

  private payoutLabel!: Phaser.GameObjects.Text;
  private stakeLabel!: Phaser.GameObjects.Text;
  private statusBar!: Phaser.GameObjects.Text;
  private resultBanner!: Phaser.GameObjects.Container;

  // ── State ──────────────────────────────────────────────────────────────────
  private selectedFace   = 6;
  private stakeAmount    = 0.10;
  private isRolling      = false;
  private shuffleCounter = 0;
  private shuffleTimer: Phaser.Time.TimerEvent | null = null;
  private lastThrowSoundAt = 0;
  private lastResultKey = "";

  constructor() { super("DiceScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  preload(): void {
    DIE_FACE_ASSETS.forEach((key, index) => {
      this.load.image(key, DIE_FACE_FILES[index]!);
    });
    CHIP_PRESETS.forEach((chip) => {
      this.load.image(chip.asset, chip.file);
    });
    this.load.image(ASSET_GAS_ICON, officialGasTokenPhaserUrl);
  }

  create(): void {
    super.create();
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }

  private rebuildScene(): void {
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.tweens.killAll();
    this.children.removeAll(true);
    this.faceButtons = [];
    this.chipButtons = [];
    this.isRolling = false;

    const { width: W, height: H } = this.scale;
    this.buildTable(W, H);
    this.buildDice(W, H);
    this.buildBettingSpots(W, H);
    this.buildChipTray(W, H);
    this.buildPayoutRow(W, H);
    this.buildRollButton(W, H);
    this.buildStatusBar(W, H);
    this.buildResultBanner(W, H);
  }

  private tableLayout(W: number, H: number) {
    const tallTable = H / Math.max(W, 1) > 1.55;

    return {
      // Tighter felt oval centred on the hero die: the mat bottom now clears the
      // prediction rail (so the gold trim no longer bisects the lower panels) and
      // the die sits in the visual centre instead of floating in an empty void.
      matY: tallTable ? H * 0.275 : H * 0.30,
      matHeight: tallTable ? H * 0.325 : H * 0.38,
      trailStartY: tallTable ? H * 0.305 : H * 0.335,
      trailControlY: tallTable ? H * 0.15 : H * 0.17,
      heroDieY: tallTable ? H * 0.16 : H * 0.18,
      diceY: tallTable ? H * 0.28 : H * 0.305,
      ghostLeftY: tallTable ? H * 0.305 : H * 0.33,
      ghostTopY: tallTable ? H * 0.21 : H * 0.22,
      predictionY: tallTable ? H * 0.50 : H * 0.56,
      chipY: tallTable ? H * 0.625 : H * 0.705,
      payoutY: tallTable ? H * 0.74 : H * 0.815,
      statusY: tallTable ? H * 0.79 : H * 0.865,
      rollY: tallTable ? H * 0.84 : H * 0.915,
      resultY: tallTable ? H * 0.28 : H * 0.3,
    };
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.rollBtn || !this.resultBanner) return;

    const faceStr   = this.str("selectedFace",  "6");
    const stakeStr  = this.str("stakeAmount",   "0.10 GAS").replace(/\s*GAS$/i, "");
    const rolling   = this.bool("isSubmitting") || this.bool("isResolving");
    const outcome   = this.str("lastOutcome",   "");
    const lastRoll  = this.str("lastRoll",      "");
    const status    = this.str("lastStatus",    "");

    this.selectedFace = Math.max(1, Math.min(6, parseInt(faceStr, 10) || 6));
    this.stakeAmount  = parseFloat(stakeStr) || 0.10;

    // Face selection highlight
    this.faceButtons.forEach((btn, i) => {
      this.highlightFaceBtn(btn, i + 1 === this.selectedFace);
    });

    // Chip selection highlight
    this.chipButtons.forEach((btn, i) => {
      const presetAmt = parseFloat(CHIP_PRESETS[i]!.amount);
      this.highlightChipBtn(btn, i, Math.abs(presetAmt - this.stakeAmount) < 0.001);
    });

    // Labels
    this.stakeLabel.setText(`On table: ${this.stakeAmount.toFixed(2)} GAS`);
    this.payoutLabel.setText(`Hit pays: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
    const normalizedStatus = status.trim();
    this.statusBar.setText(normalizedStatus === "Ready" || normalizedStatus === "就绪" ? "" : status);

    // Rolling animation
    if (rolling && !this.isRolling) {
      this.startRoll();
    } else if (!rolling && this.isRolling) {
      const faceToShow = lastRoll ? parseInt(lastRoll, 10) : this.selectedFace;
      this.stopRoll(faceToShow);
    }

    // Result overlay
    if (outcome && !rolling) {
      this.showResult(outcome, lastRoll);
    } else {
      this.resultBanner.setVisible(false);
      this.lastResultKey = "";
    }

    // Refresh static die face when idle
    if (!rolling && !outcome) {
      this.setDieFace(this.selectedFace);
    }

    // Roll button state
    const canRoll = !rolling;
    this.rollBtnBg.clear();
    this.drawRollBtnBg(canRoll);
    this.rollBtnLabel.setText(rolling ? "ROLLING..." : "THROW DICE");
  }

  // ── Table construction ─────────────────────────────────────────────────────

  private buildTable(W: number, H: number): void {
    const layout = this.tableLayout(W, H);
    const rimDepth = 20;
    this.add.rectangle(W / 2, H / 2, W, H, 0xb77b39);
    this.add.rectangle(W / 2, H / 2, W - rimDepth * 2, H - rimDepth * 2, FELT_GREEN);
    this.add.rectangle(W / 2, H / 2 + 2, W - 52, H - 72, 0x1c6e42, 0.82)
      .setStrokeStyle(2, 0x4fbb82, 0.26);

    // Main throw mat: a clean visual stage, not a configuration form.
    const matRx = (W * 0.78) / 2;
    const matRy = layout.matHeight / 2;
    this.add.ellipse(W / 2, layout.matY, W * 0.78, layout.matHeight, FELT_DARK, 0.9);

    // Felt weave: soft horizontal grain confined to the throw-mat oval only, so
    // the panels below sit on plain felt instead of lined-notebook rules.
    const grain = this.add.graphics();
    grain.lineStyle(1, 0x0c4d2b, 0.08);
    for (let dy = -matRy + 8; dy < matRy; dy += 13) {
      const t = dy / matRy;
      const halfW = matRx * Math.sqrt(Math.max(0, 1 - t * t));
      const yy = layout.matY + dy;
      grain.lineBetween(W / 2 - halfW, yy, W / 2 + halfW, yy);
    }

    const trimG = this.add.graphics();
    trimG.lineStyle(3, GOLD, 0.62);
    trimG.strokeEllipse(W / 2, layout.matY, W * 0.78 + 8, layout.matHeight + 8);
    trimG.lineStyle(1, 0xffffff, 0.2);
    trimG.strokeEllipse(W / 2, layout.matY, W * 0.78 - 24, layout.matHeight - 24);

    this.throwTrail = this.add.graphics();
    this.throwTrail.lineStyle(3, GOLD_LIGHT, 0.18);
    const start = { x: W * 0.24, y: layout.trailStartY };
    const control = { x: W * 0.5, y: layout.trailControlY };
    const end = { x: W * 0.76, y: layout.trailStartY };
    let prev = start;
    for (let step = 1; step <= 18; step++) {
      const t = step / 18;
      const inv = 1 - t;
      const next = {
        x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
        y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
      };
      this.throwTrail.lineBetween(prev.x, prev.y, next.x, next.y);
      prev = next;
    }

    this.add.text(W / 2, 42, "LUCKY FACE TABLE", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.82);

    this.add.text(W / 2, 64, "Pick a face, stack a chip, throw once.", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#d9f8df",
    }).setOrigin(0.5).setAlpha(0.78);
  }

  private buildDice(W: number, H: number): void {
    const cx = W / 2;
    const cy = this.tableLayout(W, H).diceY;

    // Soft grounded contact shadow: a low-alpha ellipse pooled on the felt at the
    // base of the die (replaces the hard opaque square block that read as a
    // misplaced dark tile on the bright felt).
    this.dieShadow = this.add.ellipse(
      cx,
      cy + DIE_SIZE * 0.52,
      DIE_SIZE * 0.96,
      DIE_SIZE * 0.30,
      FELT_SHADOW,
      0.32,
    );

    // Die texture object
    this.dieFace1 = this.add.image(0, 0, this.dieAssetKey(this.selectedFace))
      .setDisplaySize(DIE_SIZE, DIE_SIZE);
    this.diceGroup = this.add.container(cx, cy, [this.dieFace1]);
    this.setDieFace(this.selectedFace);
  }

  private dieAssetKey(face: number): string {
    const index = Math.max(0, Math.min(5, Math.round(face) - 1));
    return DIE_FACE_ASSETS[index] ?? DIE_FACE_ASSETS[5];
  }

  private setDieFace(face: number): void {
    this.dieFace1.setTexture(this.dieAssetKey(face)).setDisplaySize(DIE_SIZE, DIE_SIZE);
  }

  // ── Betting spots (1–6 face targets) ───────────────────────────────────────

  private buildBettingSpots(W: number, H: number): void {
    const y = this.tableLayout(W, H).predictionY;
    this.add.text(W / 2, y - 33, "Prediction rail", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const rail = this.add.rectangle(W / 2, y + 5, W - 58, 62, 0xffffff, 0.12)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setOrigin(0.5);
    void rail;

    const totalW = 6 * 54;
    const startX = W / 2 - totalW / 2 + 27;

    for (let i = 1; i <= 6; i++) {
      const x = startX + (i - 1) * 54;
      const btn = this.buildFaceButton(x, y, i);
      this.faceButtons.push(btn);
    }
  }

  private buildFaceButton(x: number, y: number, face: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(CREAM, 0.95);
    bg.lineStyle(2, GOLD, 0.48);
    bg.fillRoundedRect(-23, -24, 46, 52, 14);
    bg.strokeRoundedRect(-23, -24, 46, 52, 14);
    bg.setInteractive(new Phaser.Geom.Rectangle(-23, -24, 46, 52), Phaser.Geom.Rectangle.Contains);
    this.bindGameButton(bg, {
      targets: c,
      hoverScale: 1.06,
      pressScale: 0.92,
      onPress: () => {
        this.sfx.unlock();
        this.playSfx("select");
        this.emitTapBurst(c.x, c.y, GOLD_LIGHT);
        this.selectedFace = face;
        this.refreshBettingState();
        this.pulseHeroDie();
        this.dispatch("setSelectedFace", { face: String(face) });
      },
      onHoverIn: () => bg.setAlpha(0.86),
      onHoverOut: () => bg.setAlpha(1.0),
    });

    const die = this.add.image(0, -4, this.dieAssetKey(face))
      .setDisplaySize(34, 34)
      .setAlpha(0.9);
    const odd = this.add.text(0, 18, `${PAYOUT_MULT.toFixed(1)}x`, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#5b3a12",
    }).setOrigin(0.5).setAlpha(0.72);

    c.add([bg, die, odd]);
    c.setData("bg", bg);
    c.setData("die", die);
    return c;
  }

  private highlightFaceBtn(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = btn.getData("bg") as Phaser.GameObjects.Graphics;
    const die = btn.getData("die") as Phaser.GameObjects.Image;
    bg.clear();
    bg.fillStyle(active ? 0xfff0bd : CREAM, active ? 1 : 0.95);
    bg.lineStyle(active ? 3 : 2, active ? GOLD_LIGHT : GOLD, active ? 1 : 0.48);
    bg.fillRoundedRect(-23, -24, 46, 52, 14);
    bg.strokeRoundedRect(-23, -24, 46, 52, 14);
    if (active) {
      bg.lineStyle(1, 0xffffff, 0.58);
      bg.strokeRoundedRect(-18, -19, 36, 42, 11);
    }
    die.setDisplaySize(active ? 39 : 34, active ? 39 : 34).setAlpha(active ? 1 : 0.82);
  }

  // ── Chip tray ──────────────────────────────────────────────────────────────

  private buildChipTray(W: number, H: number): void {
    const y = this.tableLayout(W, H).chipY;
    this.add.rectangle(W / 2, y, W - 74, 72, 0xffffff, 0.14)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setOrigin(0.5);
    this.add.text(W / 2, y - 42, "Chip rail", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#fff8e8",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const totalW = 4 * 70;
    const startX = W / 2 - totalW / 2 + 35;

    CHIP_PRESETS.forEach((chip, i) => {
      const x = startX + i * 70;
      const btn = this.buildChip(x, y, chip.asset, chip.label, () => {
        this.stakeAmount = Number(chip.amount);
        this.refreshBettingState();
        this.dispatch("setStakeAmount", { amount: chip.amount });
      });
      this.chipButtons.push(btn);
    });
  }

  private buildChip(
    x: number, y: number,
    asset: string, label: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    const shadow = this.add.ellipse(3, 5, 52, 18, 0x000000, 0.34);
    const activeRing = this.add.graphics();
    const chip = this.add.image(0, 0, asset).setDisplaySize(56, 56);

    const lbl = this.add.text(0, 0, label, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5).setStroke("#1b2a1b", 3);

    const hit = this.add.circle(0, 0, 30, 0xffffff, 0);
    hit.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
    this.bindGameButton(hit, {
      targets: c,
      hoverScale: null,
      pressScale: 0.9,
      pressDuration: 80,
      onPress: () => {
        this.sfx.unlock();
        this.playSfx("chip");
        this.emitTapBurst(c.x, c.y, GOLD_LIGHT);
        onPress();
      },
      onHoverIn: () => {
        chip.setDisplaySize(60, 60);
        lbl.setScale(1.06);
      },
      onHoverOut: () => {
        chip.setDisplaySize(56, 56);
        lbl.setScale(1);
      },
    });

    c.add([shadow, activeRing, chip, lbl, hit]);
    c.setData("ring", activeRing);
    c.setData("chip", chip);
    c.setData("label", lbl);
    return c;
  }

  private highlightChipBtn(btn: Phaser.GameObjects.Container, _index: number, active: boolean): void {
    btn.setScale(active ? 1.12 : 1.0);
    const ring = btn.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    if (active) {
      ring.lineStyle(3, GOLD_LIGHT, 0.92);
      ring.strokeCircle(0, 0, 31);
    }
  }

  // ── Payout row ─────────────────────────────────────────────────────────────

  private buildPayoutRow(W: number, H: number): void {
    const y = this.tableLayout(W, H).payoutY;
    this.add.rectangle(W / 2, y, W - 88, 32, 0x0f4b2b, 0.68)
      .setStrokeStyle(1, GOLD, 0.32)
      .setOrigin(0.5);
    this.stakeLabel = this.add.text(W / 2 - 76, y, "On table: 0.10 GAS", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#fff8e8",
    }).setOrigin(0.5);

    this.payoutLabel = this.add.text(W / 2 + 78, y, "Hit pays: 0.57 GAS", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      color: "#f0c866",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  // ── Roll button ────────────────────────────────────────────────────────────

  private buildRollButton(W: number, H: number): void {
    const c = this.add.container(W / 2, this.tableLayout(W, H).rollY);

    this.rollBtnBg = this.add.graphics();
    this.drawRollBtnBg(true);

    const label = this.add.text(0, 0, "THROW DICE", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#1a1a1a",
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.rollBtnBg.setInteractive(
      new Phaser.Geom.Rectangle(-88, -22, 176, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bindGameButton(this.rollBtnBg, {
      targets: c,
      enabled: () => !this.isRolling,
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () => {
        this.sfx.unlock();
        this.playThrowSfx();
        this.emitThrowCharge();
        this.dispatch("placeDiceBet", {
          chosenNumber: String(this.selectedFace),
          amount: this.stakeAmount.toFixed(2),
        });
      },
    });

    c.add([this.rollBtnBg, label]);
    this.rollBtn = c;
    this.rollBtnLabel = label;
  }

  private drawRollBtnBg(enabled: boolean): void {
    const color = enabled ? GOLD : 0x666666;
    this.rollBtnBg.clear();
    this.rollBtnBg.fillStyle(color);
    this.rollBtnBg.fillRoundedRect(-88, -22, 176, 44, 12);
    if (enabled) {
      // Shine effect
      this.rollBtnBg.fillStyle(0xffffff, 0.15);
      this.rollBtnBg.fillRoundedRect(-88, -22, 176, 18, { tl: 12, tr: 12, bl: 0, br: 0 });
    }
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private buildStatusBar(W: number, H: number): void {
    this.statusBar = this.add.text(W / 2, this.tableLayout(W, H).statusY, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#d9f8df",
    }).setOrigin(0.5).setDepth(2);
  }

  private refreshBettingState(): void {
    this.faceButtons.forEach((btn, i) => {
      this.highlightFaceBtn(btn, i + 1 === this.selectedFace);
    });
    this.chipButtons.forEach((btn, i) => {
      const presetAmt = parseFloat(CHIP_PRESETS[i]!.amount);
      this.highlightChipBtn(btn, i, Math.abs(presetAmt - this.stakeAmount) < 0.001);
    });
    this.stakeLabel.setText(`On table: ${this.stakeAmount.toFixed(2)} GAS`);
    this.payoutLabel.setText(`Hit pays: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
    if (!this.isRolling) this.setDieFace(this.selectedFace);
  }

  /** Quick spring-in on the hero die when the picked face changes (idle only). */
  private pulseHeroDie(): void {
    if (this.isRolling || !this.diceGroup) return;
    this.tween({
      targets: this.diceGroup,
      scale: { from: 0.82, to: 1 },
      duration: 240,
      ease: "Back.easeOut",
    });
  }

  // ── Result banner ──────────────────────────────────────────────────────────

  private buildResultBanner(W: number, H: number): void {
    const c = this.add.container(W / 2, this.tableLayout(W, H).resultY);

    const bg = this.add.graphics();
    bg.fillStyle(0xfff8e8, 0.94);
    bg.fillRoundedRect(-120, -48, 240, 96, 18);
    bg.lineStyle(3, GOLD);
    bg.strokeRoundedRect(-120, -48, 240, 96, 18);

    const title = this.add.text(0, -18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "28px",
      fontStyle: "bold",
      color: "#201811",
    }).setOrigin(0.5);

    const sub = this.add.text(0, 18, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "15px",
      color: GOLD_LIGHT.toString(16).padStart(6, "0"),
    }).setOrigin(0.5);
    sub.setColor("#f0c866");

    c.add([bg, title, sub]);
    c.setVisible(false);
    c.setData("title", title);
    c.setData("sub", sub);
    this.resultBanner = c;
  }

  private showResult(outcome: string, roll: string): void {
    const title = this.resultBanner.getData("title") as Phaser.GameObjects.Text;
    const sub   = this.resultBanner.getData("sub")   as Phaser.GameObjects.Text;
    const resultKey = `${outcome}:${roll}`;
    const firstShow = this.lastResultKey !== resultKey;
    this.lastResultKey = resultKey;

    this.resultBanner.setVisible(true);
    if (firstShow) {
      this.resultBanner.setAlpha(0).setScale(0.7);
      this.tweens.add({
        targets: this.resultBanner,
        alpha: 1, scale: 1,
        duration: 250,
        ease: "Back.easeOut",
      });
    }

    switch (outcome) {
      case "won":
        title.setText("YOU WIN").setColor("#f0c866");
        sub.setText(`Rolled: ${roll}  •  +${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} GAS`);
        if (firstShow) {
          this.playSfx("win");
          this.addGoldCoins();
        }
        break;
      case "lost":
        title.setText("HOUSE WINS").setColor("#e25d4d");
        sub.setText(`Rolled: ${roll}  •  Better luck next time`);
        if (firstShow) this.playSfx("lose");
        break;
      case "refunded":
        title.setText("REFUNDED").setColor("#a89070");
        sub.setText("Your stake has been returned");
        if (firstShow) this.playSfx("refund");
        break;
    }

    if (roll) {
      const faceNum = parseInt(roll, 10);
      if (!isNaN(faceNum)) this.setDieFace(faceNum);
    }
  }

  // ── Rolling animation ──────────────────────────────────────────────────────

  private startRoll(): void {
    this.isRolling = true;
    this.lastResultKey = "";
    this.resultBanner.setVisible(false);
    this.throwTrail.setAlpha(0.8);
    this.playThrowSfx();

    this.shuffleCounter = 0;
    this.shuffleTimer = this.time.addEvent({
      delay: 80,
      repeat: -1,
      callback: () => {
        this.shuffleCounter++;
        const face = (this.shuffleCounter % 6) + 1;
        this.setDieFace(face);
        if (this.shuffleCounter % 3 === 0) this.playSfx("tick");
        this.tweens.add({
          targets: this.diceGroup,
          x: this.scale.width / 2 + Phaser.Math.Between(-18, 18),
          angle: Phaser.Math.Between(-24, 24),
          duration: 60,
          ease: "Power1",
        });
        // Grounded shadow reacts to the tumble: widens as the die drops,
        // pinches as it lifts, so it stays read as contact shadow.
        this.tweens.add({
          targets: this.dieShadow,
          scaleX: { from: 1.12, to: 0.78 },
          scaleY: { from: 1.1, to: 0.62 },
          alpha: { from: 0.34, to: 0.16 },
          duration: 80,
          yoyo: true,
        });
      },
    });

    this.tweens.add({
      targets: this.throwTrail,
      alpha: { from: 0.18, to: 0.72 },
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.diceGroup,
      y: {
        from: this.tableLayout(this.scale.width, this.scale.height).diceY + 18,
        to: this.tableLayout(this.scale.width, this.scale.height).diceY - 34,
      },
      scaleX: { from: 0.96, to: 1.1 },
      scaleY: { from: 0.96, to: 1.1 },
      duration: 220,
      ease: "Sine.easeOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopRoll(face: number): void {
    this.isRolling = false;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.tweens.killTweensOf(this.diceGroup);
    this.tweens.killTweensOf(this.dieShadow);
    this.tweens.killTweensOf(this.throwTrail);
    this.throwTrail.setAlpha(1);

    // Settle the grounded shadow: snap back wide + soft as the die lands.
    this.dieShadow.setScale(1);
    this.tweens.add({
      targets: this.dieShadow,
      scaleX: { from: 0.7, to: 1 },
      scaleY: { from: 0.7, to: 1 },
      alpha: { from: 0.16, to: 0.32 },
      duration: 220,
      ease: "Back.easeOut",
    });

    // Settle animation
    this.tweens.add({
      targets: this.diceGroup,
      x: this.scale.width / 2,
      y: this.tableLayout(this.scale.width, this.scale.height).diceY,
      angle: 0,
      duration: 200,
      ease: "Bounce.easeOut",
      onComplete: () => this.emitLandingRipple(),
    });
    this.setDieFace(face);
    this.playSfx("land");
  }

  private playThrowSfx(): void {
    const now = Date.now();
    if (now - this.lastThrowSoundAt < 240) return;
    this.lastThrowSoundAt = now;
    this.playSfx("throw");
  }

  private emitTapBurst(x: number, y: number, color: number): void {
    const ring = this.add.graphics();
    ring.setPosition(x, y).setDepth(12);
    ring.lineStyle(3, color, 0.72);
    ring.strokeCircle(0, 0, 22);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.85,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private emitThrowCharge(): void {
    this.throwTrail.setAlpha(1);
    this.tweens.add({
      targets: this.throwTrail,
      alpha: 0.3,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
    });
  }

  private emitLandingRipple(): void {
    const ripple = this.add.graphics();
    ripple.setPosition(this.diceGroup.x, this.diceGroup.y + 24).setDepth(8);
    ripple.lineStyle(4, GOLD_LIGHT, 0.6);
    ripple.strokeEllipse(0, 0, 116, 34);
    this.tweens.add({
      targets: ripple,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.8,
      duration: 360,
      ease: "Sine.easeOut",
      onComplete: () => ripple.destroy(),
    });
  }

  private playSfx(kind: SfxKind): void {
    switch (kind) {
      case "select":
        // Slightly brighter chirp than the shared "tap" preset (glides to 700 Hz).
        this.sfx.tones([
          { frequency: 520, duration: 0.045, type: "triangle", gain: 0.022, endFrequency: 700 },
        ]);
        break;
      case "chip":
        this.sfx.play("chip");
        break;
      case "throw":
        this.sfx.play("throw");
        break;
      case "tick":
        this.sfx.play("tick");
        break;
      case "land":
        this.sfx.tones([
          { frequency: 180, duration: 0.08, type: "triangle", gain: 0.032, endFrequency: 90 },
          { frequency: 420, duration: 0.04, delay: 0.04, type: "sine", gain: 0.016, endFrequency: 300 },
        ]);
        break;
      case "win":
        this.sfx.tones(
          [523, 659, 784, 1046].map((frequency, index) => ({
            frequency,
            duration: 0.12,
            delay: index * 0.055,
            type: "triangle" as const,
            gain: 0.026,
          })),
        );
        break;
      case "lose":
        this.sfx.tones([
          { frequency: 240, duration: 0.12, type: "sawtooth", gain: 0.026, endFrequency: 120 },
          { frequency: 120, duration: 0.16, delay: 0.06, type: "triangle", gain: 0.02, endFrequency: 70 },
        ]);
        break;
      case "refund":
        this.sfx.tones([
          { frequency: 320, duration: 0.08, type: "sine", gain: 0.018, endFrequency: 430 },
          { frequency: 430, duration: 0.08, delay: 0.055, type: "sine", gain: 0.018, endFrequency: 320 },
        ]);
        break;
    }
  }

  // ── Particle effect (win coins) ────────────────────────────────────────────

  private addGoldCoins(): void {
    const { width: W, height: H } = this.scale;
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(W * 0.1, W * 0.9);
      const coin = this.add.container(x, H * 0.3);
      const halo = this.add.ellipse(0, 0, 24, 24, 0xffdf68, 0.94);
      const coinIcon = this.add.image(0, 0, ASSET_GAS_ICON).setDisplaySize(18, 18);
      coin.add([halo, coinIcon]);
      this.tweens.add({
        targets: coin,
        y: Phaser.Math.Between(H * 0.1, H * 0.6),
        x: x + Phaser.Math.Between(-60, 60),
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        delay: i * 50,
        duration: 900,
        ease: "Power2",
        onComplete: () => coin.destroy(),
      });
    }
  }

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.rebuildScene();
    this.onStateUpdate(this.state);
  }
}
