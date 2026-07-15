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
// Bright mint felt keeps the table game-like without turning the entire mobile
// viewport into a dark slab. Warm gold rails and ivory dice stay foregrounded.
const FELT_GREEN   = 0x0b6b3a;
const FELT_DARK    = 0x095a31;
const FELT_SHADOW  = 0x2f8064;
const GOLD         = 0xd4a843;
const GOLD_LIGHT   = 0xf0c866;
const CREAM        = 0xfff8e8;
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const TEXT_RESOLUTION = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
const DIE_SIZE     = 112;

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

  /**
   * Currency word for the on-table / payout labels. GameFi stakes real GAS;
   * guest (local practice) plays with practice chips, so no GAS-at-stake framing
   * appears on the canvas. Reads the launcher-selected mode from bridge state.
   */
  private currencyUnit(): string {
    return this.str("mode", "gamefi") === "guest"
      ? this.copy("practiceChips", "chips")
      : "GAS";
  }

  private copy(key: string, fallback: string): string {
    const sceneText = this.val<Record<string, string>>("sceneText", {});
    return sceneText?.[key] || fallback;
  }

  /** Lock every wager control while a transaction or unresolved bet owns it. */
  private canEditBet(): boolean {
    return !this.bool("isSubmitting") &&
      !this.bool("isResolving") &&
      !this.bool("isUnresolved");
  }

  /**
   * Keep impossible transactions off the wallet prompt. Guest play is local;
   * GameFi requires a wallet, live house cover, and enough wallet/credit GAS.
   */
  private canRoll(): boolean {
    if (!this.canEditBet()) return false;
    if (this.str("mode", "gamefi") === "guest") return true;
    if (!this.bool("walletConnected")) return false;

    const stake = this.stakeAmount;
    const maxStake = this.num("maxStake", 0);
    if (!Number.isFinite(stake) || stake < 0.05 || maxStake <= 0 || stake > maxStake) {
      return false;
    }
    if (this.bool("isEvmChain")) return true;

    const maxPayableStake = this.num("maxPayableStake", 0);
    const walletGasBalance = this.num("walletGasBalance", 0);
    const directCredit = this.num("directCredit", 0);
    return maxPayableStake >= stake && directCredit + walletGasBalance >= stake;
  }

  private canUsePrimaryButton(): boolean {
    const busy = this.bool("isSubmitting") || this.bool("isResolving");
    if (busy) return false;
    if (this.bool("isUnresolved")) return true;
    if (this.str("mode", "gamefi") === "gamefi" && !this.bool("walletConnected")) {
      return true;
    }
    return this.canRoll();
  }

  private rollButtonLabel(): string {
    if (this.bool("isSubmitting") || this.bool("isResolving")) {
      return this.copy("rolling", "Rolling…");
    }
    if (this.bool("isUnresolved")) {
      return this.copy("revealPending", "Reveal result");
    }
    if (this.str("mode", "gamefi") === "gamefi" && !this.bool("walletConnected")) {
      return this.copy("connectWallet", "Connect wallet");
    }

    const stake = this.stakeAmount;
    const maxStake = this.num("maxStake", 0);
    if (!Number.isFinite(stake) || stake < 0.05 || maxStake <= 0 || stake > maxStake) {
      return this.copy("lowerStake", "Lower stake");
    }
    if (this.str("mode", "gamefi") === "gamefi" && !this.bool("isEvmChain")) {
      if (this.num("maxPayableStake", 0) < stake) {
        return this.copy("houseLimit", "House limit");
      }
      if (this.num("directCredit", 0) + this.num("walletGasBalance", 0) < stake) {
        return this.copy("insufficientGas", "Insufficient GAS");
      }
    }
    return this.copy("throwDice", "Throw dice");
  }

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
      diceY: tallTable ? H * 0.28 : H * 0.305,
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
    const unit = this.currencyUnit();
    this.stakeLabel.setText(`${this.copy("onTable", "On table")}: ${this.stakeAmount.toFixed(2)} ${unit}`);
    this.payoutLabel.setText(`${this.copy("hitPays", "Hit pays")}: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} ${unit}`);
    const normalizedStatus = status.trim();
    this.statusBar.setText(normalizedStatus === "Ready" || normalizedStatus === "就绪" ? "" : status);

    // Rolling animation
    if (rolling && !this.isRolling) {
      this.startRoll();
    } else if (!rolling && this.isRolling) {
      const faceToShow = lastRoll ? parseInt(lastRoll, 10) : this.selectedFace;
      this.stopRoll(faceToShow);
    }

    // Only terminal, chain/readback-backed or local guest outcomes get a result
    // card. A pending/unresolved wager keeps the die visible with recovery copy.
    const isTerminalOutcome =
      outcome === "won" || outcome === "lost" || outcome === "refunded";
    if (isTerminalOutcome && !rolling) {
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
    const canUsePrimaryButton = this.canUsePrimaryButton();
    this.drawRollBtnBg(canUsePrimaryButton);
    this.rollBtnLabel.setText(this.rollButtonLabel());
  }

  // ── Table construction ─────────────────────────────────────────────────────

  private buildTable(W: number, H: number): void {
    const layout = this.tableLayout(W, H);
    const rimDepth = 20;
    this.add.rectangle(W / 2, H / 2, W, H, 0xd8a85f);
    this.add.rectangle(W / 2, H / 2, W - rimDepth * 2, H - rimDepth * 2, FELT_GREEN);
    this.add.rectangle(W / 2, H / 2 + 2, W - 52, H - 72, 0x8bd9b9, 0.88)
      .setStrokeStyle(2, 0xeffff8, 0.72);

    // Main throw mat: a clean visual stage, not a configuration form.
    const matRx = (W * 0.78) / 2;
    const matRy = layout.matHeight / 2;
    this.add.ellipse(W / 2, layout.matY, W * 0.78, layout.matHeight, FELT_DARK, 0.9);

    // Felt weave: soft horizontal grain confined to the throw-mat oval only, so
    // the panels below sit on plain felt instead of lined-notebook rules.
    const grain = this.add.graphics();
    grain.lineStyle(1, 0x2f8064, 0.08);
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

    // Header legibility.
    //
    // Both lines used to be pinned at fixed y (68 / 88) while the throw mat's
    // top edge is layout-derived: `matY - matHeight / 2` puts it at 72.6 on the
    // 520x660 desktop canvas and 85.05 on the 376x756 mobile one. The mat
    // therefore rose *behind* the header, and the hint — dark teal #35685d at
    // 0.78 alpha — ended up drawn straight onto the dark FELT_DARK oval, where
    // it was all but invisible. The title straddled the gold trim on desktop
    // for the same reason.
    //
    // Fix the cause rather than the symptom: derive the title's y from the mat
    // so it always clears the rim, and caption the hint onto the mat with an
    // opaque light pill so it stays readable whichever surface the mat's top
    // edge leaves behind it (dark felt on desktop, part mint on mobile).
    const matTop = layout.matY - layout.matHeight / 2;
    const titleY = Math.max(24, Math.min(68, matTop - 12));

    this.add.text(W / 2, titleY, this.copy("tableTitle", "Lucky face table"), {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#174c40",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.82);

    const hint = this.add.text(W / 2, titleY + 26, this.copy("tableHint", "Pick a face, stack a chip, throw once."), {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "12px",
      color: "#174c40",
    }).setOrigin(0.5);

    const padX = 12;
    const padY = 5;
    const pillW = hint.width + padX * 2;
    const pillH = hint.height + padY * 2;
    const pill = this.add.graphics();
    pill.fillStyle(0xf3fbf6, 0.93);
    pill.fillRoundedRect(hint.x - pillW / 2, hint.y - pillH / 2, pillW, pillH, pillH / 2);
    pill.lineStyle(1, 0xffffff, 0.7);
    pill.strokeRoundedRect(hint.x - pillW / 2, hint.y - pillH / 2, pillW, pillH, pillH / 2);
    // The pill is added after the text, so lift the text back above it.
    this.children.bringToTop(hint);
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
    ).setDepth(7);

    // Die texture object
    this.dieFace1 = this.add.image(0, 0, this.dieAssetKey(this.selectedFace))
      .setDisplaySize(DIE_SIZE, DIE_SIZE);
    this.diceGroup = this.add.container(cx, cy, [this.dieFace1]).setDepth(10);
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
    this.add.text(W / 2, y - 33, this.copy("predictionRail", "Prediction rail"), {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#174c40",
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    const rail = this.add.rectangle(W / 2, y + 5, W - 58, 62, 0xffffff, 0.52)
      .setStrokeStyle(1, 0xffffff, 0.72)
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
      enabled: () => this.canEditBet(),
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
    this.add.rectangle(W / 2, y, W - 74, 72, 0xffffff, 0.46)
      .setStrokeStyle(1, 0xffffff, 0.72)
      .setOrigin(0.5);
    this.add.text(W / 2, y - 42, this.copy("chipRail", "Chip rail"), {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#174c40",
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
      enabled: () => this.canEditBet(),
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
    this.add.rectangle(W / 2, y, W - 88, 32, 0xfff8e8, 0.88)
      .setStrokeStyle(1, GOLD, 0.32)
      .setOrigin(0.5);
    this.stakeLabel = this.add.text(W / 2 - 76, y, `${this.copy("onTable", "On table")}: 0.10 GAS`, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#255c50",
    }).setOrigin(0.5);

    this.payoutLabel = this.add.text(W / 2 + 78, y, `${this.copy("hitPays", "Hit pays")}: 0.57 GAS`, {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      color: "#9a5b08",
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

    // A dedicated transparent hit target avoids Graphics-bounds drift after the
    // enabled/disabled background is cleared and redrawn. The full visible CTA
    // now responds, including its upper half on scaled mobile canvases.
    const hit = this.add.rectangle(0, 0, 188, 54, 0xffffff, 0);
    hit.setInteractive();
    this.bindGameButton(hit, {
      targets: c,
      enabled: () => this.canUsePrimaryButton(),
      pressScale: 0.95,
      pressDuration: 80,
      onPress: () => {
        this.sfx.unlock();
        if (this.bool("isUnresolved")) {
          this.dispatch("recheckSettlement", {});
          return;
        }
        if (this.str("mode", "gamefi") === "gamefi" && !this.bool("walletConnected")) {
          this.dispatch("connectWallet", {});
          return;
        }
        if (!this.canRoll()) return;
        this.playThrowSfx();
        this.emitThrowCharge();
        this.dispatch("placeDiceBet", {
          chosenNumber: String(this.selectedFace),
          amount: this.stakeAmount.toFixed(2),
        });
      },
    });

    c.add([this.rollBtnBg, label, hit]);
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
      color: "#245c50",
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
    const unit = this.currencyUnit();
    this.stakeLabel.setText(`${this.copy("onTable", "On table")}: ${this.stakeAmount.toFixed(2)} ${unit}`);
    this.payoutLabel.setText(`${this.copy("hitPays", "Hit pays")}: ${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} ${unit}`);
    if (!this.isRolling) this.setDieFace(this.selectedFace);
  }

  /** Quick spring-in on the hero die when the picked face changes (idle only). */
  private pulseHeroDie(): void {
    if (this.isRolling || this.reducedMotion || !this.diceGroup) return;
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
    // Frame the live die instead of painting copy directly behind it: the die
    // remains the result resource, while title and outcome sit above/below with
    // strong contrast on a spacious ivory card.
    bg.fillRoundedRect(-152, -86, 304, 172, 22);
    bg.lineStyle(3, GOLD);
    bg.strokeRoundedRect(-152, -86, 304, 172, 22);

    const title = this.add.text(0, -69, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#201811",
    }).setOrigin(0.5);

    const sub = this.add.text(0, 69, "", {
      fontFamily: FONT_FAMILY,
      resolution: TEXT_RESOLUTION,
      fontSize: "13px",
      color: "#6f4a1e",
    }).setOrigin(0.5);
    sub.setColor("#6f4a1e");

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
      if (this.reducedMotion) {
        this.resultBanner.setAlpha(1).setScale(1);
      } else {
        this.resultBanner.setAlpha(0).setScale(0.7);
        this.tweens.add({
          targets: this.resultBanner,
          alpha: 1, scale: 1,
          duration: 250,
          ease: "Back.easeOut",
        });
      }
    }

    switch (outcome) {
      case "won":
        title.setText(this.copy("youWin", "You win")).setColor("#9a5b08");
        sub.setText(
          `${this.copy("rolled", "Rolled")}: ${roll}  •  +${this.str(
            "lastPayout",
            `${(this.stakeAmount * PAYOUT_MULT).toFixed(2)} ${this.currencyUnit()}`,
          )}`,
        );
        if (firstShow) {
          this.playSfx("win");
          this.addGoldCoins();
        }
        break;
      case "lost":
        title.setText(this.copy("houseWins", "Missed")).setColor("#c4483e");
        sub.setText(`${this.copy("rolled", "Rolled")}: ${roll}  •  ${this.copy("betterLuck", "Try another throw")}`);
        if (firstShow) this.playSfx("lose");
        break;
      case "refunded":
        title.setText(this.copy("refunded", "Refunded")).setColor("#7b6852");
        sub.setText(this.copy("stakeReturned", "Your stake has been returned"));
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
    this.freezePredictionRailForThrow();
    this.dieShadow.setDepth(8);
    this.diceGroup.setDepth(11);
    this.playThrowSfx();

    if (this.reducedMotion) {
      const restingY = this.tableLayout(this.scale.width, this.scale.height).diceY;
      this.diceGroup
        .setPosition(this.scale.width / 2, restingY)
        .setAngle(0)
        .setScale(1);
      this.dieShadow.setScale(1).setAlpha(0.28);
      this.throwTrail.setAlpha(0.32);
      return;
    }

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
    this.restorePredictionRailAfterThrow();

    const restingY = this.tableLayout(this.scale.width, this.scale.height).diceY;
    if (this.reducedMotion) {
      this.dieShadow.setScale(1).setAlpha(0.32);
      this.diceGroup
        .setPosition(this.scale.width / 2, restingY)
        .setAngle(0)
        .setScale(1);
      this.setDieFace(face);
      this.playSfx("land");
      return;
    }

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
      y: restingY,
      angle: 0,
      duration: 200,
      ease: "Bounce.easeOut",
      onComplete: () => this.emitLandingRipple(),
    });
    this.setDieFace(face);
    this.playSfx("land");
  }

  private freezePredictionRailForThrow(): void {
    this.faceButtons.forEach((btn) => {
      this.tweens.killTweensOf(btn);
      btn.setAlpha(0.42).setAngle(0).setScale(1);
      const die = btn.getData("die") as Phaser.GameObjects.Image | undefined;
      die?.setAngle(0).setScale(1).setDisplaySize(34, 34);
    });
  }

  private restorePredictionRailAfterThrow(): void {
    this.faceButtons.forEach((btn, index) => {
      btn.setAlpha(1).setAngle(0).setScale(1);
      this.highlightFaceBtn(btn, index + 1 === this.selectedFace);
    });
  }

  private playThrowSfx(): void {
    const now = Date.now();
    if (now - this.lastThrowSoundAt < 240) return;
    this.lastThrowSoundAt = now;
    this.playSfx("throw");
  }

  private emitTapBurst(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
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
    if (this.reducedMotion) return;
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
    if (this.reducedMotion) return;
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
    if (this.reducedMotion) return;
    const { width: W, height: H } = this.scale;
    const isGuest = this.str("mode", "guest") === "guest";
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(W * 0.1, W * 0.9);
      const coin = this.add.container(x, H * 0.3);
      const halo = this.add.ellipse(0, 0, 24, 24, 0xffdf68, 0.94);
      const tokenAsset = isGuest
        ? CHIP_PRESETS[i % CHIP_PRESETS.length]!.asset
        : ASSET_GAS_ICON;
      const coinIcon = this.add.image(0, 0, tokenAsset)
        .setDisplaySize(isGuest ? 24 : 18, isGuest ? 24 : 18);
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

  protected onReducedMotionChange(enabled: boolean): void {
    if (!enabled || !this.isRolling || !this.diceGroup) return;
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = null;
    this.tweens.killTweensOf(this.diceGroup);
    this.tweens.killTweensOf(this.dieShadow);
    this.tweens.killTweensOf(this.throwTrail);
    const restingY = this.tableLayout(this.scale.width, this.scale.height).diceY;
    this.diceGroup
      .setPosition(this.scale.width / 2, restingY)
      .setAngle(0)
      .setScale(1);
    this.dieShadow.setScale(1).setAlpha(0.28);
    this.throwTrail.setAlpha(0.32);
    this.setDieFace(this.selectedFace);
  }
}
