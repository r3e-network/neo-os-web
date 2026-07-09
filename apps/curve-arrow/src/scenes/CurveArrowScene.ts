/**
 * CurveArrowScene — Phaser 3 scene for the Curve Arrow miniapp.
 *
 * Renders an archery range with:
 *  - Parallax sky/meadow backdrop over a letterboxed 1600x900 field strip
 *  - Wooden bow at the left that draws back and recoils on launch
 *  - Fletched arrow sprite rotating to its velocity heading during flight
 *  - Stone wall pillars dealt by the enclave, target board with ring guides
 *  - Dotted aim hint, fading arrow trail, ring-score popups, camera shake
 *  - In-canvas HUD: level dots, arrows-left quiver, countdown timer chip
 *  - Lobby: 3 difficulty range cards (idle state)
 *
 * The flight loop is a fixed 60 Hz accumulator that steps the EXACT integer
 * math of simulateShot (arrow-engine.ts) while sampling pointer state each
 * tick to build the `holds` list. When the flight ends the scene dispatches
 * one { type: "shot", holds } op and advances the local run via applyShot —
 * the same pure function the enclave replays — so the client outcome equals
 * the enclave outcome by construction.
 *
 * State keys consumed (via BaseScene helpers):
 *  gameStatus   "idle"|"committed"|"dealt"|"solved"|"expired"
 *  clues        string — JSON: { levels: [{ target, obstacles }] }
 *  gameDifficulty number
 *  deadline     number (ms epoch)
 *  dealtAt      number (ms epoch)
 *  poolFree     number
 *  isStarting   boolean
 *  isDealing    boolean
 *  isSubmitting boolean
 *  lastStatus   string
 *
 * Actions dispatched to React:
 *  "startGame"        { difficulty: number }
 *  "selectDifficulty" { difficulty: number }
 *  "recordShot"       { holds: number[] }
 *  "submitSolution"   {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  BOW,
  FIELD_H,
  FIELD_W,
  MAX_HOLD_PAIRS,
  SPEED_Q8,
  TARGET_RINGS,
  TICKS_MAX,
  TURN_COS,
  TURN_SIN,
  applyShot,
  createRun,
  parseInitialState,
} from "../logic/arrow-engine";
import type { LevelSpec, ObstacleSpec, RunState, ShotOutcome } from "../logic/arrow-engine";
import {
  formatClock,
  gasDisplay,
  ruleOf,
} from "../logic/game-rules";
import type { Difficulty } from "../logic/game-rules";

// ── Layout constants ──────────────────────────────────────────────────────────

const DESIGN_W = 440;       // logical canvas width fallback
const DESIGN_H = 580;       // logical canvas height fallback
const TICK_MS = 1000 / 60;  // fixed simulation tick (matches the TEE engine)
const MAX_STEPS_PER_FRAME = 6;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const TRAIL_LENGTH = 26;
const WHOOSH_TICK_GAP = 9;  // ~150ms between curve whooshes

type RangeLayout = {
  pad: number;
  hudTop: number;
  hudH: number;
  fieldX: number;
  fieldY: number;
  fieldW: number;
  fieldH: number;
  k: number;                // world→canvas scale (1600 → fieldW)
  shootY: number;
  hintY: number;
  statusY: number;
  lobbyHeaderY: number;
  lobbyHeaderH: number;
  lobbyTitleY: number;
  lobbySubY: number;
  lobbyPanelX: number;
  lobbyPanelY: number;
  lobbyPanelW: number;
  lobbyPanelH: number;
  lobbyCardsY: number;
  lobbyCardW: number;
  lobbyCardH: number;
  lobbyCardGap: number;
  lobbyStatusY: number;
  lobbyFooterY: number;
};

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  // Range / backdrop
  pine:        0x2f7d4e,   // deep pine green
  pineDark:    0x1f5636,
  pineDeep:    0x17402a,
  meadow:      0x3d8f5d,
  skyFallback: 0xbfe3d2,

  // Gold accents
  gold:        0xd9a441,
  goldLight:   0xf3cf7f,
  goldDeep:    0xa87722,

  // Arrow / trail
  trail:       0xf3cf7f,
  arrowGlow:   0xffe2a0,

  // Walls
  stone:       0x8f8a80,
  stoneDark:   0x5d594f,

  // Target rings
  ringGold:    0xf2c14e,
  ringRed:     0xd85c4a,
  ringBlue:    0x4a7bd8,

  // HUD
  hudBg:       0x1d4a30,
  chipBg:      0x163a25,
  timerFill:   0x59c98a,
  timerLow:    0xf97066,

  // Lobby cards
  cardBg:      0x1c4a2f,
  cardBorder:  0x66a97e,
  cardActive:  0xd9a441,
  cardActiveBg:0x235a39,
  white:       0xffffff,
  cream:       0xfff6e0,
  muted:       0xcdeed8,

  // Overlay
  overlay:     0x000000,
  win:         0x2f9e63,
  lose:        0xe25d4d,
};

// ── Difficulty label table ────────────────────────────────────────────────────

const DIFF_LABELS = ["Easy", "Medium", "Hard"] as const;

const ARROW_ASSETS = {
  sky: "range-sky",
  bow: "bow",
  arrow: "arrow",
  target: "target-board",
  wall: "wall-stone",
  medal: "reward-medal",
  badges: ["badge-easy", "badge-medium", "badge-hard"],
} as const;

const FONT_FAMILY = "Inter, Arial, sans-serif";

// ── Flight state (live twin of simulateShot's loop variables) ─────────────────

type FlightState = {
  posX: number;             // Q8
  posY: number;             // Q8
  vx: number;               // Q8
  vy: number;               // Q8
  tick: number;
  worldX: number;
  worldY: number;
  prevWorldX: number;
  holds: number[];
  holdOpen: boolean;
  acc: number;              // ms accumulator
  lastWhooshTick: number;
  trail: { x: number; y: number }[];
};

function rectContainsWorld(rect: ObstacleSpec, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function ringOfOffset(offset: number): number {
  const abs = offset < 0 ? -offset : offset;
  for (let ring = 0; ring < TARGET_RINGS.length; ring += 1) {
    if (abs <= TARGET_RINGS[ring]) return ring;
  }
  return -1;
}

// ── Scene class ───────────────────────────────────────────────────────────────

export class CurveArrowScene extends BaseScene {

  // ── Layout dims (computed after scale is known) ──────────────────────────
  private scW = DESIGN_W;
  private scH = DESIGN_H;
  private layout = this.computeLayout(DESIGN_W, DESIGN_H);
  private sceneReady = false;
  private isRebuildingScene = false;

  // ── Field layers ─────────────────────────────────────────────────────────
  private skyImage!:       Phaser.GameObjects.Image;
  private fieldFrameGfx!:  Phaser.GameObjects.Graphics;
  private wallsContainer!: Phaser.GameObjects.Container;
  private targetContainer!: Phaser.GameObjects.Container;
  private aimPreviewGfx!:  Phaser.GameObjects.Graphics;
  private trailGfx!:       Phaser.GameObjects.Graphics;
  private bowImage!:       Phaser.GameObjects.Image;
  private arrowSprite!:    Phaser.GameObjects.Image;
  private fieldLayers:     Phaser.GameObjects.GameObject[] = [];

  // ── HUD ──────────────────────────────────────────────────────────────────
  private hudGfx!:         Phaser.GameObjects.Graphics;
  private levelText!:      Phaser.GameObjects.Text;
  private arrowsText!:     Phaser.GameObjects.Text;
  private timerText!:      Phaser.GameObjects.Text;
  private hintLabel!:      Phaser.GameObjects.Text;
  private controlsHintText!: Phaser.GameObjects.Text;
  private statusLabel!:    Phaser.GameObjects.Text;

  // ── Shoot button ─────────────────────────────────────────────────────────
  private shootBtn!:       Phaser.GameObjects.Container;
  private shootBtnBg!:     Phaser.GameObjects.Rectangle;
  private shootBtnLabel!:  Phaser.GameObjects.Text;

  // ── Overlay (dealing / won / lost / submitting) ──────────────────────────
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!:        Phaser.GameObjects.Rectangle;
  private overlayIcon!:      Phaser.GameObjects.Image;
  private overlayTitle!:     Phaser.GameObjects.Text;
  private overlaySub!:       Phaser.GameObjects.Text;
  private overlayBtn!:       Phaser.GameObjects.Container;
  private overlayBtnBg!:     Phaser.GameObjects.Rectangle;
  private overlayBtnTxt!:    Phaser.GameObjects.Text;
  private overlayAction: (() => void) | null = null;

  // ── Lobby layer ──────────────────────────────────────────────────────────
  private lobbyContainer!:  Phaser.GameObjects.Container;
  private lobbyCards:       Phaser.GameObjects.Container[] = [];
  private lobbyStatusText!: Phaser.GameObjects.Text;
  private lobbyPreviewArrow: Phaser.GameObjects.Image | null = null;
  private pickedDifficulty: Difficulty = 0;

  // ── Local run simulation ─────────────────────────────────────────────────
  private levels: LevelSpec[] | null = null;
  private run: RunState | null = null;
  private flight: FlightState | null = null;

  // ── Input sampling ───────────────────────────────────────────────────────
  private pointerHeld = false;
  private spaceHeld = false;

  // ── Timers ───────────────────────────────────────────────────────────────
  private clockTimer: Phaser.Time.TimerEvent | null = null;
  private nowMs = Date.now();
  private previewTimer: number | null = null;

  // ── State cache (to detect changes) ─────────────────────────────────────
  private prevGameStatus = "";
  private prevClues = "";

  constructor() {
    super("CurveArrowScene");
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private computeLayout(width: number, height: number): RangeLayout {
    const pad = width < 400 ? 10 : 16;
    const hudTop = 10;
    const hudH = 48;
    const fieldW = width - pad * 2;
    const fieldH = Math.round((fieldW * FIELD_H) / FIELD_W);
    const k = fieldW / FIELD_W;

    // Center the field block in the space between HUD and the shoot controls.
    const controlsBlock = 118;
    const spare = Math.max(0, height - (hudTop + hudH + 10) - fieldH - controlsBlock - 24);
    const fieldY = hudTop + hudH + 10 + Math.round(spare * 0.3);
    const fieldX = pad;

    const shootY = fieldY + fieldH + 52 + Math.round(spare * 0.2);
    const hintY = shootY + 42;
    const statusY = height - 14;

    // ── Lobby: one connected, vertically-centred column ────────────────────
    // header band → how-to panel → status caption → difficulty cards →
    // footer status. The whole stack is measured, then centred, so there is
    // never a dead band floating between the panel and the cards.
    const lobbyPanelX = pad;
    const lobbyPanelW = width - pad * 2;
    const lobbyCardW = Math.min(118, Math.floor((width - pad * 2 - 16) / 3));
    const lobbyCardH = height < 620 ? 100 : 112;
    const lobbyCardGap = Math.max(6, Math.floor((width - pad * 2 - lobbyCardW * 3) / 2));
    const lobbyPanelH = Math.max(168, Math.min(214, Math.round(height * 0.3)));

    const lobbyHeaderH = 62;
    const gapHeaderPanel = 16;
    const gapPanelStatus = 16;
    const gapStatusCards = 14;
    const gapCardsFooter = 18;
    const statusRowH = 16;
    const footerRowH = 14;

    const clusterH =
      lobbyHeaderH + gapHeaderPanel + lobbyPanelH + gapPanelStatus + statusRowH +
      gapStatusCards + lobbyCardH + gapCardsFooter + footerRowH;
    const lobbyHeaderY = Math.max(18, Math.round((height - clusterH) / 2));

    const lobbyTitleY = lobbyHeaderY + 26;
    const lobbySubY = lobbyHeaderY + 46;
    const lobbyPanelY = lobbyHeaderY + lobbyHeaderH + gapHeaderPanel;
    const lobbyStatusY = lobbyPanelY + lobbyPanelH + gapPanelStatus + statusRowH / 2;
    const lobbyCardsY = lobbyStatusY + statusRowH / 2 + gapStatusCards;
    const lobbyFooterY = lobbyCardsY + lobbyCardH + gapCardsFooter + footerRowH / 2;

    return {
      pad,
      hudTop,
      hudH,
      fieldX,
      fieldY,
      fieldW,
      fieldH,
      k,
      shootY,
      hintY,
      statusY,
      lobbyHeaderY,
      lobbyHeaderH,
      lobbyTitleY,
      lobbySubY,
      lobbyPanelX,
      lobbyPanelY,
      lobbyPanelW,
      lobbyPanelH,
      lobbyCardsY,
      lobbyCardW,
      lobbyCardH,
      lobbyCardGap,
      lobbyStatusY,
      lobbyFooterY,
    };
  }

  /** World-x (0..1600) to canvas-x. */
  private wx(x: number): number {
    return this.layout.fieldX + x * this.layout.k;
  }

  /** World-y (0..900) to canvas-y. */
  private wy(y: number): number {
    return this.layout.fieldY + y * this.layout.k;
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    this.load.image(ARROW_ASSETS.sky, "./art/range-sky.webp");
    this.load.image(ARROW_ASSETS.bow, "./art/bow.webp");
    this.load.image(ARROW_ASSETS.arrow, "./art/arrow.webp");
    this.load.image(ARROW_ASSETS.target, "./art/target-board.webp");
    this.load.image(ARROW_ASSETS.wall, "./art/wall-stone.webp");
    this.load.image(ARROW_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(ARROW_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(ARROW_ASSETS.badges[2], "./art/badge-hard.webp");
    this.load.image(ARROW_ASSETS.medal, "./art/reward-medal.webp");
  }

  create(): void {
    super.create(); // wires the bridge first
    this.syncSceneSize();
    this.layout = this.computeLayout(this.scW, this.scH);

    this.buildScene();
    this.setupInput();

    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  private buildScene(): void {
    this.buildField();
    this.buildHUD();
    this.buildShootButton();
    this.buildStatusRow();
    this.buildOverlay();
    this.buildLobby();
  }

  // ── Responsive resize ─────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    const previousW = this.scW;
    const previousH = this.scH;
    this.syncSceneSize();

    if (
      !this.sceneReady ||
      this.isRebuildingScene ||
      !this.statusLabel ||
      (previousW === this.scW && previousH === this.scH)
    ) {
      return;
    }

    this.rebuildResponsiveScene();
  }

  private syncSceneSize(): void {
    this.scW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    this.scH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
  }

  private rebuildResponsiveScene(): void {
    this.isRebuildingScene = true;
    this.stopClockTimer();
    this.tweens.killAll();
    this.children.removeAll(true);

    // A resize aborts any in-flight arrow before it lands. No op was recorded
    // and no local arrow was consumed, so client and enclave stay in step.
    this.flight = null;
    this.lobbyCards = [];
    this.lobbyPreviewArrow = null;
    this.fieldLayers = [];
    this.overlayAction = null;

    this.layout = this.computeLayout(this.scW, this.scH);
    this.buildScene();

    if (this.run && this.levels) {
      this.buildLevelVisuals();
      this.startClockTimer();
    }

    this.isRebuildingScene = false;
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract implementation ─────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady || this.isRebuildingScene) return;

    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const isDealing  = this.bool("isDealing");
    const isSubmitting = this.bool("isSubmitting");
    const lastStatus = this.str("lastStatus", "");

    this.statusLabel?.setText(lastStatus);

    const statusChanged = gameStatus !== this.prevGameStatus;
    const cluesChanged  = clues !== this.prevClues;

    // ── Phase transitions ──────────────────────────────────────────────────
    if (statusChanged || cluesChanged) {
      this.prevGameStatus = gameStatus;
      this.prevClues      = clues;

      if (statusChanged && gameStatus === "solved") {
        this.sfx.play("win");
      }

      if (gameStatus === "dealt" && clues) {
        this.enterPlayPhase(clues);
      } else if (gameStatus !== "dealt") {
        this.exitPlayPhase();
      }
    }

    // ── Lobby vs range visibility ──────────────────────────────────────────
    const inPlay = gameStatus === "dealt" && this.run !== null;
    this.lobbyContainer.setVisible(!inPlay && gameStatus !== "committed");
    for (const layer of this.fieldLayers) {
      (layer as Phaser.GameObjects.Container).setVisible?.(inPlay);
    }
    this.hudGfx.setVisible(inPlay);
    this.levelText.setVisible(inPlay);
    this.arrowsText.setVisible(inPlay);
    this.timerText.setVisible(inPlay);
    this.controlsHintText.setVisible(inPlay);
    this.hintLabel.setVisible(inPlay);
    this.shootBtn.setVisible(inPlay);
    this.statusLabel.setVisible(true);
    // Footer status rides at the very bottom in play, but tucks directly under
    // the difficulty cards in the lobby so it reads as their caption.
    this.statusLabel.setY(inPlay ? this.layout.statusY : this.layout.lobbyFooterY);

    if (inPlay) {
      this.updateHUD();
      this.updateShootButton();
      this.updateAimPreview();
    }

    // ── Overlay ───────────────────────────────────────────────────────────
    if (isDealing || (gameStatus === "committed" && !inPlay)) {
      this.showOverlay("Dealing", "Sealing your wall layouts");
    } else if (isSubmitting) {
      this.showOverlay("Submitting", "Enclave verifying your shots");
    } else if (this.run?.done && !this.run.won && gameStatus === "dealt") {
      this.showOverlay("Out of Arrows", "Every arrow is spent.", {
        label: this.isGuest() ? "See Score" : "Settle Run",
        onPress: () => this.dispatch("submitSolution"),
      });
    } else if (this.run?.done && this.run.won && gameStatus === "dealt") {
      const canSubmit = this.canSubmitRun();
      this.showOverlay("Range Cleared", this.submitGateMessage(canSubmit), {
        label: canSubmit ? (this.isGuest() ? "Save Score" : "Submit Win") : "Waiting",
        disabled: !canSubmit,
        onPress: () => this.dispatch("submitSolution"),
        icon: true,
      });
    } else if (gameStatus === "solved") {
      this.showOverlay("Solved", "Congratulations, you won.", { icon: true });
    } else if (gameStatus === "expired") {
      this.showOverlay("Expired", "Time ran out.");
    } else {
      this.overlayContainer.setVisible(false);
    }

    // ── Lobby card highlights ──────────────────────────────────────────────
    if (!inPlay) {
      this.ensureSelectableDifficulty();
      this.updateLobbyCards();
    }
  }

  // ── Phase helpers ─────────────────────────────────────────────────────────

  private enterPlayPhase(clues: string): void {
    const parsed = parseInitialState(clues);
    if (!parsed) {
      this.levels = null;
      this.run = null;
      return;
    }
    this.levels = parsed.levels;
    this.run = createRun(parsed.levels, this.num("gameDifficulty", 0));
    this.flight = null;
    this.buildLevelVisuals();
    this.resetArrowToBow();
    this.startClockTimer();
    this.sfx.play("start");
  }

  private exitPlayPhase(): void {
    this.stopClockTimer();
    this.levels = null;
    this.run = null;
    this.flight = null;
    this.wallsContainer?.removeAll(true);
    this.targetContainer?.removeAll(true);
    this.trailGfx?.clear();
  }

  // ── Fixed-tick flight loop ────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this.flight || !this.run || !this.levels) return;

    this.flight.acc += delta;
    let steps = 0;
    while (this.flight && this.flight.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
      this.flight.acc -= TICK_MS;
      steps += 1;
      this.stepFlightTick();
    }
    if (this.flight) {
      this.renderFlight();
    }
  }

  private isHoldInputActive(): boolean {
    return this.pointerHeld || this.spaceHeld;
  }

  /**
   * One integer tick — byte-identical to simulateShot's loop body. The held
   * flag mirrors what the recorded `holds` list will replay: press-inclusive,
   * release-exclusive, at most MAX_HOLD_PAIRS pairs.
   */
  private stepFlightTick(): void {
    const flight = this.flight;
    const level = this.levels?.[this.run?.levelIndex ?? 0];
    if (!flight || !level || !this.run) return;

    const tick = flight.tick;

    // ── Record hold transitions from live input ───────────────────────────
    const rawHeld = this.isHoldInputActive();
    let held = false;
    if (flight.holdOpen) {
      if (rawHeld) {
        held = true;
      } else {
        flight.holds.push(tick);       // release (exclusive)
        flight.holdOpen = false;
      }
    } else if (
      rawHeld &&
      flight.holds.length < MAX_HOLD_PAIRS * 2 &&
      tick < TICKS_MAX - 1
    ) {
      flight.holds.push(tick);         // press (inclusive)
      flight.holdOpen = true;
      held = true;
    }

    // ── Integer physics (exact simulateShot math) ─────────────────────────
    if (held) {
      const nvx = (flight.vx * TURN_COS + flight.vy * TURN_SIN) >> 12;
      const nvy = (-flight.vx * TURN_SIN + flight.vy * TURN_COS) >> 12;
      flight.vx = nvx;
      flight.vy = nvy;
      if (tick - flight.lastWhooshTick >= WHOOSH_TICK_GAP) {
        flight.lastWhooshTick = tick;
        this.sfx.tones([
          { frequency: 300 + Math.min(200, tick), duration: 0.07, type: "triangle", gain: 0.014, endFrequency: 470 },
        ]);
      }
    } else if (flight.vy < 0) {
      const nvx = (flight.vx * TURN_COS - flight.vy * TURN_SIN) >> 12;
      const nvy = (flight.vx * TURN_SIN + flight.vy * TURN_COS) >> 12;
      if (nvy >= 0 && nvx > 0) {
        flight.vx = SPEED_Q8;
        flight.vy = 0;
        flight.posY = (flight.posY >> 8) << 8;
      } else {
        flight.vx = nvx;
        flight.vy = nvy;
      }
    }

    flight.posX += flight.vx;
    flight.posY += flight.vy;
    flight.prevWorldX = flight.worldX;
    flight.worldX = flight.posX >> 8;
    flight.worldY = flight.posY >> 8;
    flight.tick = tick + 1;

    flight.trail.push({ x: this.wx(flight.worldX), y: this.wy(flight.worldY) });
    if (flight.trail.length > TRAIL_LENGTH) flight.trail.shift();

    // ── End conditions (same order as the engine) ─────────────────────────
    if (
      flight.worldX < 0 || flight.worldX > FIELD_W ||
      flight.worldY < 0 || flight.worldY > FIELD_H
    ) {
      this.endFlight("bounds");
      return;
    }

    for (const obstacle of level.obstacles) {
      if (rectContainsWorld(obstacle, flight.worldX, flight.worldY)) {
        this.endFlight("wall", obstacle);
        return;
      }
    }

    const crossedForward = flight.prevWorldX < level.target.x && flight.worldX >= level.target.x;
    const crossedBackward = flight.prevWorldX > level.target.x && flight.worldX <= level.target.x;
    if (crossedForward || crossedBackward) {
      const ring = ringOfOffset(flight.worldY - level.target.y);
      if (ring >= 0) {
        this.endFlight("target");
        return;
      }
    }

    if (flight.tick >= TICKS_MAX) {
      this.endFlight("timeout");
    }
  }

  private endFlight(cause: "bounds" | "wall" | "target" | "timeout", wall?: ObstacleSpec): void {
    const flight = this.flight;
    if (!flight || !this.run || !this.levels) return;
    this.flight = null;

    // Close a dangling hold pair so the recorded list stays valid for the
    // engine's normalizeHolds (even length, strictly ascending, < TICKS_MAX).
    if (flight.holdOpen) {
      flight.holds.push(Math.min(flight.tick, TICKS_MAX - 1));
      flight.holdOpen = false;
    }
    const holds = [...flight.holds];

    // One TEE op per shot; the enclave replays it with the same engine.
    this.dispatch("recordShot", { holds });

    // Advance the authoritative local run with the pure engine function.
    const applied = applyShot(this.run, this.levels, holds);
    this.run = applied.run;

    const endX = this.wx(applied.outcome.end.x);
    const endY = this.wy(applied.outcome.end.y);

    if (applied.outcome.hit) {
      this.onTargetHit(applied.outcome, endX, endY);
    } else if (cause === "wall") {
      this.onWallHit(endX, endY, wall);
    } else {
      this.sfx.play("land");
      this.spawnImpactPuff(endX, endY, C.muted);
    }

    this.arrowSprite.clearTint();
    this.trailGfx.clear();

    if (this.run.done) {
      if (this.run.won) {
        this.sfx.play("win");
      } else {
        this.sfx.play("lose");
      }
      this.onStateUpdate(this.state);
    } else if (applied.outcome.hit) {
      // Next level: fresh walls slide in.
      this.time.delayedCall(this.reducedMotion ? 0 : 420, () => {
        if (!this.run || !this.levels || this.run.done) return;
        this.sfx.play("spawn");
        this.buildLevelVisuals();
        this.resetArrowToBow();
        this.updateHUD();
        this.updateShootButton();
        this.updateAimPreview();
      });
      this.updateHUD();
    } else {
      this.resetArrowToBow();
      this.updateHUD();
      this.updateShootButton();
      this.updateAimPreview();
    }
  }

  private onTargetHit(outcome: ShotOutcome, endX: number, endY: number): void {
    if (outcome.ring === 0) {
      this.sfx.play("combo");
      this.showRingPopup("BULLSEYE!", endX, endY, "#ffd97a");
    } else if (outcome.ring === 1) {
      this.sfx.play("score");
      this.showRingPopup("Inner ring!", endX, endY, "#ffe9b8");
    } else {
      this.sfx.play("score");
      this.showRingPopup("On target!", endX, endY, "#e9f5ee");
    }
    this.spawnImpactPuff(endX, endY, C.goldLight);
    this.animate({
      targets: this.targetContainer,
      scale: 1.06,
      duration: 110,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private onWallHit(endX: number, endY: number, wall?: ObstacleSpec): void {
    this.sfx.play("error");
    if (!this.reducedMotion) {
      this.cameras.main.shake(140, 0.006);
    }
    this.spawnImpactPuff(endX, endY, C.stone);
    if (wall) {
      const flash = this.add.rectangle(
        this.wx(wall.x + wall.w / 2),
        this.wy(wall.y + wall.h / 2),
        Math.max(2, wall.w * this.layout.k),
        Math.max(2, wall.h * this.layout.k),
        C.lose,
        0.32,
      );
      this.animate({
        targets: flash,
        alpha: 0,
        duration: 320,
        onComplete: () => flash.destroy(),
      });
    }
  }

  private showRingPopup(text: string, x: number, y: number, color: string): void {
    const popup = this.add.text(x, Math.max(this.layout.fieldY + 12, y - 10), text, {
      fontFamily: FONT_FAMILY,
      fontSize: "15px",
      fontStyle: "bold",
      color,
      stroke: "#17402a",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);

    if (this.reducedMotion) {
      this.time.delayedCall(900, () => popup.destroy());
      return;
    }
    this.tweens.add({
      targets: popup,
      y: popup.y - 26,
      alpha: 0,
      duration: 760,
      ease: "Sine.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  private spawnImpactPuff(x: number, y: number, color: number): void {
    const puff = this.add.circle(x, y, 5, color, 0.55).setDepth(28);
    if (this.reducedMotion) {
      this.time.delayedCall(400, () => puff.destroy());
      return;
    }
    this.tweens.add({
      targets: puff,
      radius: 16,
      alpha: 0,
      duration: 340,
      ease: "Sine.easeOut",
      onComplete: () => puff.destroy(),
    });
  }

  // ── Launch ────────────────────────────────────────────────────────────────

  private canShoot(): boolean {
    if (!this.sceneReady || this.flight || !this.run || !this.levels) return false;
    if (this.run.done) return false;
    if (this.str("gameStatus", "") !== "dealt") return false;
    if (this.bool("isSubmitting")) return false;
    const deadline = this.num("deadline", 0);
    if (deadline > 0 && deadline - this.nowMs <= 0) return false;
    return true;
  }

  private launchArrow(): void {
    if (!this.canShoot()) return;
    this.sfx.play("throw");

    this.flight = {
      posX: BOW.x << 8,
      posY: BOW.y << 8,
      vx: SPEED_Q8,
      vy: 0,
      tick: 0,
      worldX: BOW.x,
      worldY: BOW.y,
      prevWorldX: BOW.x,
      holds: [],
      holdOpen: false,
      acc: 0,
      lastWhooshTick: -WHOOSH_TICK_GAP,
      trail: [],
    };

    // Immediate local action preview: bow recoil + aim hint flash, released
    // on a timer so the range never sticks in its action state.
    this.setShotPreview(true);
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      if (this.sys && this.sys.isActive()) this.setShotPreview(false);
    }, 480);

    this.animate({
      targets: this.bowImage,
      x: this.wx(BOW.x) - 6,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    this.updateShootButton();
    this.updateHUD();
  }

  /** Toggles the launch pulse: hides the dotted aim hint while it plays. */
  private setShotPreview(active: boolean): void {
    if (!this.aimPreviewGfx) return;
    if (active) {
      this.aimPreviewGfx.setVisible(false);
      return;
    }
    this.updateAimPreview();
  }

  private resetArrowToBow(): void {
    if (!this.arrowSprite) return;
    this.arrowSprite
      .setPosition(this.wx(BOW.x) + 8, this.wy(BOW.y))
      .setRotation(0)
      .clearTint()
      .setVisible(true);
  }

  private renderFlight(): void {
    const flight = this.flight;
    if (!flight) return;

    const cx = this.wx(flight.worldX);
    const cy = this.wy(flight.worldY);
    this.arrowSprite
      .setPosition(cx, cy)
      .setRotation(Math.atan2(flight.vy, flight.vx))
      .setVisible(true);

    if (this.isHoldInputActive()) {
      this.arrowSprite.setTint(C.arrowGlow);
    } else {
      this.arrowSprite.clearTint();
    }

    // Fading trail
    const gfx = this.trailGfx;
    gfx.clear();
    const points = flight.trail;
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      if (!from || !to) continue;
      const alpha = (i / points.length) * 0.55;
      gfx.lineStyle(2, C.trail, alpha);
      gfx.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  // ── Build: field ──────────────────────────────────────────────────────────

  private buildField(): void {
    const { fieldX, fieldY, fieldW, fieldH } = this.layout;

    // Backdrop panel behind the letterboxed field strip.
    this.fieldFrameGfx = this.add.graphics();
    const frame = this.fieldFrameGfx;
    frame.fillStyle(C.pineDeep, 1);
    frame.fillRoundedRect(fieldX - 6, fieldY - 6, fieldW + 12, fieldH + 12, 12);

    this.skyImage = this.add.image(fieldX + fieldW / 2, fieldY + fieldH / 2, ARROW_ASSETS.sky)
      .setDisplaySize(fieldW, fieldH);

    // Meadow strip along the bottom of the field + frame rim.
    frame.fillStyle(C.meadow, 0.5);
    frame.fillRect(fieldX, fieldY + fieldH * 0.9, fieldW, fieldH * 0.1);
    frame.lineStyle(2, C.pineDark, 0.9);
    frame.strokeRoundedRect(fieldX - 6, fieldY - 6, fieldW + 12, fieldH + 12, 12);

    this.wallsContainer = this.add.container(0, 0);
    this.targetContainer = this.add.container(0, 0);
    this.aimPreviewGfx = this.add.graphics();
    this.trailGfx = this.add.graphics().setDepth(24);

    this.bowImage = this.add.image(this.wx(BOW.x), this.wy(BOW.y), ARROW_ASSETS.bow)
      .setDisplaySize(34 * this.layout.k * 4, 60 * this.layout.k * 4)
      .setDepth(26);

    this.arrowSprite = this.add.image(this.wx(BOW.x) + 8, this.wy(BOW.y), ARROW_ASSETS.arrow)
      .setDisplaySize(52 * this.layout.k * 3, 12 * this.layout.k * 3)
      .setDepth(27);

    this.fieldLayers = [
      this.fieldFrameGfx,
      this.skyImage,
      this.wallsContainer,
      this.targetContainer,
      this.aimPreviewGfx,
      this.trailGfx,
      this.bowImage,
      this.arrowSprite,
    ];
    for (const layer of this.fieldLayers) {
      (layer as Phaser.GameObjects.Container).setVisible?.(false);
    }
  }

  private buildLevelVisuals(): void {
    if (!this.run || !this.levels) return;
    const level = this.levels[Math.min(this.run.levelIndex, this.levels.length - 1)];
    if (!level) return;
    const k = this.layout.k;

    // ── Stone walls ────────────────────────────────────────────────────────
    this.wallsContainer.removeAll(true);
    const outlines = this.add.graphics();
    for (const obstacle of level.obstacles) {
      const wallImg = this.add.image(
        this.wx(obstacle.x + obstacle.w / 2),
        this.wy(obstacle.y + obstacle.h / 2),
        ARROW_ASSETS.wall,
      ).setDisplaySize(Math.max(2, obstacle.w * k), Math.max(2, obstacle.h * k));
      this.wallsContainer.add(wallImg);
      outlines.lineStyle(1, C.stoneDark, 0.8);
      outlines.strokeRect(
        this.wx(obstacle.x),
        this.wy(obstacle.y),
        obstacle.w * k,
        obstacle.h * k,
      );
    }
    this.wallsContainer.add(outlines);
    this.wallsContainer.setAlpha(1);
    if (!this.reducedMotion) {
      this.wallsContainer.setAlpha(0);
      this.tweens.add({ targets: this.wallsContainer, alpha: 1, duration: 300 });
    }

    // ── Target board ───────────────────────────────────────────────────────
    this.targetContainer.removeAll(true);
    const tx = this.wx(level.target.x);
    const ty = this.wy(level.target.y);
    const outerR = TARGET_RINGS[2] * k;

    const stand = this.add.graphics();
    stand.lineStyle(Math.max(2, 6 * k), C.goldDeep, 0.9);
    stand.lineBetween(tx, ty, tx, this.wy(FIELD_H) - 2);

    const board = this.add.image(tx, ty, ARROW_ASSETS.target)
      .setDisplaySize(outerR * 2.3, outerR * 2.3);

    // Ring guides at the exact engine radii so the visual score zones match.
    const rings = this.add.graphics();
    rings.lineStyle(1, C.ringBlue, 0.55);
    rings.strokeCircle(tx, ty, TARGET_RINGS[2] * k);
    rings.lineStyle(1, C.ringRed, 0.6);
    rings.strokeCircle(tx, ty, TARGET_RINGS[1] * k);
    rings.lineStyle(1.5, C.ringGold, 0.85);
    rings.strokeCircle(tx, ty, TARGET_RINGS[0] * k);
    rings.fillStyle(C.ringGold, 0.9);
    rings.fillCircle(tx, ty, Math.max(1.5, 4 * k));

    this.targetContainer.add([stand, board, rings]);
    this.targetContainer.setScale(1);

    this.updateAimPreview();
  }

  private updateAimPreview(): void {
    const gfx = this.aimPreviewGfx;
    if (!gfx) return;
    gfx.clear();
    if (!this.canShoot()) {
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    // Dotted level-flight hint from the bow.
    const y = this.wy(BOW.y);
    const startX = this.wx(BOW.x) + 16;
    const endX = this.wx(560);
    const step = 14;
    let index = 0;
    for (let x = startX; x <= endX; x += step) {
      const alpha = 0.55 * (1 - (x - startX) / (endX - startX));
      gfx.fillStyle(C.cream, Math.max(0.08, alpha));
      gfx.fillCircle(x, y, index % 4 === 0 ? 2.4 : 1.6);
      index += 1;
    }
    // A small upward arc suggesting the hold-to-curve control.
    gfx.lineStyle(1.5, C.goldLight, 0.5);
    gfx.beginPath();
    gfx.arc(this.wx(430), y, 26, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(320), false);
    gfx.strokePath();
  }

  // ── Build: HUD ────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const { fieldX, fieldW, hudTop, hudH } = this.layout;
    this.hudGfx = this.add.graphics().setVisible(false);

    this.levelText = this.add.text(fieldX + 10, hudTop + 12, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#f3cf7f",
    }).setOrigin(0, 0.5).setVisible(false);

    this.arrowsText = this.add.text(fieldX + 10, hudTop + 33, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: "#cdeed8",
    }).setOrigin(0, 0.5).setVisible(false);

    this.timerText = this.add.text(fieldX + fieldW - 12, hudTop + hudH / 2, "00:00", {
      fontFamily: FONT_FAMILY,
      fontSize: "15px",
      fontStyle: "bold",
      color: "#cdeed8",
    }).setOrigin(1, 0.5).setVisible(false);
  }

  private updateHUD(): void {
    if (!this.run || !this.levels || !this.hudGfx) return;

    const { fieldX, fieldW, hudTop, hudH } = this.layout;
    const gameStatus = this.str("gameStatus", "idle");
    const deadline   = this.num("deadline", 0);
    const dealtAt    = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule       = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : rule.limitMs;
    const isLow      = remainingMs < 60_000 && remainingMs > 0;

    const gfx = this.hudGfx;
    gfx.clear();
    gfx.fillStyle(C.hudBg, 0.92);
    gfx.fillRoundedRect(fieldX, hudTop, fieldW, hudH, 10);
    gfx.lineStyle(1, C.pineDark, 0.9);
    gfx.strokeRoundedRect(fieldX, hudTop, fieldW, hudH, 10);

    // Timer chip
    const chipW = 74;
    gfx.fillStyle(C.chipBg, 1);
    gfx.fillRoundedRect(fieldX + fieldW - chipW - 6, hudTop + 8, chipW, hudH - 16, 8);

    // Level dots (cleared = gold, current = cream, pending = faint)
    const dots = this.levels.length;
    const dotGap = 14;
    const dotsX = fieldX + fieldW / 2 - ((dots - 1) * dotGap) / 2;
    for (let i = 0; i < dots; i += 1) {
      const cleared = i < this.run.cleared;
      const current = i === this.run.levelIndex && !this.run.done;
      gfx.fillStyle(cleared ? C.gold : current ? C.cream : C.pineDark, cleared || current ? 1 : 0.9);
      gfx.fillCircle(dotsX + i * dotGap, hudTop + 15, current ? 5 : 4);
      if (current) {
        gfx.lineStyle(1, C.goldLight, 0.9);
        gfx.strokeCircle(dotsX + i * dotGap, hudTop + 15, 7);
      }
    }

    // Arrows-left quiver: one fletched tick per remaining arrow.
    const arrowsLeft = Math.max(0, this.run.budget - this.run.arrowsUsed);
    const quiverX = fieldX + fieldW / 2 - ((this.run.budget - 1) * 9) / 2;
    for (let i = 0; i < this.run.budget; i += 1) {
      const live = i < arrowsLeft;
      const x = quiverX + i * 9;
      gfx.lineStyle(2, live ? C.goldLight : C.pineDark, live ? 1 : 0.7);
      gfx.lineBetween(x, hudTop + 27, x, hudTop + 39);
      if (live) {
        gfx.fillStyle(C.gold, 1);
        gfx.fillTriangle(x - 2.4, hudTop + 30, x + 2.4, hudTop + 30, x, hudTop + 26);
      }
    }

    this.levelText.setText(
      `Target ${Math.min(this.run.cleared + 1, this.levels.length)} / ${this.levels.length}`,
    );
    this.arrowsText.setText(`Arrows ${arrowsLeft} / ${this.run.budget}`);
    this.timerText
      .setText(formatClock(Math.max(0, remainingMs)))
      .setColor(isLow ? "#ffd166" : "#cdeed8");

    // Hint label
    const elapsedMs = dealtAt > 0 ? this.nowMs - dealtAt : 0;
    const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
    const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
    const submitWindowClosed =
      gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;

    if (this.run.done && !this.run.won) {
      this.hintLabel.setText("Out of arrows.");
    } else if (timeUp) {
      this.hintLabel.setText("Time's up.");
    } else if (submitWindowClosed && !timeUp) {
      this.hintLabel.setText("Closing soon — submit now!");
    } else if (this.run.won && !minSolveReached) {
      const wait = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs;
      this.hintLabel.setText(`Wait ${formatClock(wait)} to submit`);
    } else if (this.run.won && minSolveReached) {
      this.hintLabel.setText("All targets cleared. Submit now.");
    } else if (this.flight) {
      this.hintLabel.setText("Hold to curve the arrow");
    } else {
      this.hintLabel.setText("");
    }
  }

  // ── Build: shoot button + status row ─────────────────────────────────────

  private buildShootButton(): void {
    const { shootY } = this.layout;

    this.shootBtnBg = this.add.rectangle(0, 0, 168, 42, C.gold)
      .setStrokeStyle(1, C.goldLight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.shootBtnLabel = this.add.text(0, 0, "SHOOT", {
      fontFamily: FONT_FAMILY,
      fontSize: "15px",
      fontStyle: "bold",
      color: "#17402a",
    }).setOrigin(0.5);

    this.shootBtn = this.add.container(this.scW / 2, shootY, [this.shootBtnBg, this.shootBtnLabel])
      .setVisible(false);

    this.bindGameButton(this.shootBtnBg, {
      targets: this.shootBtn,
      enabled: () => this.canShoot(),
      onPress: () => this.launchArrow(),
    });
  }

  private updateShootButton(): void {
    if (!this.shootBtnBg) return;
    const enabled = this.canShoot();
    this.shootBtnBg.setFillStyle(enabled ? C.gold : 0x627268);
    this.shootBtnBg.setStrokeStyle(1, enabled ? C.goldLight : 0x87938b);
    this.shootBtnLabel.setText(this.flight ? "HOLD TO CURVE" : "SHOOT");
    this.shootBtn.setAlpha(enabled || this.flight ? 1 : 0.68);
  }

  private buildStatusRow(): void {
    this.controlsHintText = this.add.text(
      this.scW / 2,
      this.layout.hintY,
      "Tap to shoot · hold anywhere to curve · release to level out",
      {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        color: "#cdeed8",
        align: "center",
        wordWrap: { width: this.layout.fieldW },
      },
    ).setOrigin(0.5).setVisible(false);

    this.hintLabel = this.add.text(
      this.scW / 2,
      this.layout.hintY + 20,
      "",
      {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        color: "#ffd166",
        fontStyle: "bold",
        wordWrap: { width: this.layout.fieldW },
      },
    ).setOrigin(0.5).setVisible(false);

    this.statusLabel = this.add.text(
      this.scW / 2,
      this.layout.statusY,
      "",
      {
        fontFamily: FONT_FAMILY,
        fontSize: "10px",
        // Sits on the pale shell (below the field in play, under the cards in
        // the lobby) — deep pine keeps it legible on light.
        color: "#1f5636",
      },
    ).setOrigin(0.5);
  }

  // ── Build: overlay ────────────────────────────────────────────────────────

  private buildOverlay(): void {
    this.overlayContainer = this.add.container(this.scW / 2, this.scH / 2).setDepth(40);

    this.overlayBg = this.add.rectangle(0, 0, 272, 150, C.overlay, 200)
      .setStrokeStyle(2, C.gold)
      .setOrigin(0.5);

    this.overlayIcon = this.add.image(0, -46, ARROW_ASSETS.medal)
      .setDisplaySize(44, 44)
      .setVisible(false);

    this.overlayTitle = this.add.text(0, -14, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.overlaySub = this.add.text(0, 16, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: "#d9f2e1",
      align: "center",
      wordWrap: { width: 240 },
    }).setOrigin(0.5);

    this.overlayBtnBg = this.add.rectangle(0, 52, 148, 32, C.gold)
      .setStrokeStyle(1, C.goldLight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayBtnTxt = this.add.text(0, 52, "Play Again", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      color: "#17402a",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.overlayBtnBg.on("pointerdown", () => {
      this.sfx.unlock();
      if (this.overlayAction) this.sfx.play("tap");
      this.overlayAction?.();
    });
    this.overlayBtn = this.add.container(0, 0, [this.overlayBtnBg, this.overlayBtnTxt]);

    this.overlayContainer.add([
      this.overlayBg,
      this.overlayIcon,
      this.overlayTitle,
      this.overlaySub,
      this.overlayBtn,
    ]);
    this.overlayContainer.setVisible(false);
  }

  private showOverlay(
    title: string,
    sub: string,
    button?: { label?: string; disabled?: boolean; onPress?: () => void; icon?: boolean },
  ): void {
    this.overlayTitle.setText(title);
    this.overlaySub.setText(sub);
    this.overlayIcon.setVisible(Boolean(button?.icon));
    const actionable = Boolean(button?.label && button.onPress);
    this.overlayAction = actionable && !button?.disabled ? button?.onPress ?? null : null;
    this.overlayBtn.setVisible(actionable);
    if (actionable && button) {
      this.overlayBtnTxt.setText(button.label ?? "");
      this.overlayBtnBg
        .setFillStyle(button.disabled ? 0x627268 : C.gold)
        .setStrokeStyle(1, button.disabled ? 0x87938b : C.goldLight);
      if (this.overlayBtnBg.input) this.overlayBtnBg.input.enabled = !button.disabled;
      this.overlayBtn.setAlpha(button.disabled ? 0.68 : 1);
    }
    this.overlayContainer.setVisible(true);
    this.overlayContainer.setScale(0.8);
    this.animate({
      targets: this.overlayContainer,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  // ── Build: lobby ──────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0);
    const layout = this.layout;

    // ── Header band ─────────────────────────────────────────────────────────
    // Seats the gold title + subtitle on deep green so both read crisply
    // instead of washing out against the pale shell backdrop.
    const headerBandW = Math.min(layout.lobbyPanelW, 306);
    const headerBandX = (this.scW - headerBandW) / 2;
    const headerGfx = this.add.graphics();
    headerGfx.fillStyle(C.cardBg, 1);
    headerGfx.fillRoundedRect(headerBandX, layout.lobbyHeaderY, headerBandW, layout.lobbyHeaderH, 14);
    headerGfx.lineStyle(1, C.cardBorder, 0.55);
    headerGfx.strokeRoundedRect(headerBandX, layout.lobbyHeaderY, headerBandW, layout.lobbyHeaderH, 14);

    const titleMark = this.add.image(this.scW / 2 - 82, layout.lobbyTitleY, ARROW_ASSETS.bow)
      .setDisplaySize(28, 38);

    const title = this.add.text(this.scW / 2 + 14, layout.lobbyTitleY, "Curve Arrow", {
      fontFamily: FONT_FAMILY,
      fontSize: "21px",
      fontStyle: "bold",
      color: "#f3cf7f",
    }).setOrigin(0.5);

    const sub = this.add.text(
      this.scW / 2,
      layout.lobbySubY,
      this.isGuest()
        ? "Curve arrows over the walls and clear every target"
        : "Curve arrows over the walls to win GAS",
      {
        fontFamily: FONT_FAMILY,
        fontSize: "12px",
        color: "#cdeed8",
      },
    ).setOrigin(0.5);

    // ── How-to-Play panel ────────────────────────────────────────────────────
    const arenaGfx = this.add.graphics();
    arenaGfx.fillStyle(C.cardBg, 1);
    arenaGfx.fillRoundedRect(
      layout.lobbyPanelX,
      layout.lobbyPanelY,
      layout.lobbyPanelW,
      layout.lobbyPanelH,
      12,
    );
    arenaGfx.lineStyle(1, C.cardBorder, 0.7);
    arenaGfx.strokeRoundedRect(
      layout.lobbyPanelX,
      layout.lobbyPanelY,
      layout.lobbyPanelW,
      layout.lobbyPanelH,
      12,
    );

    // Left column: heading + steps. Right column: framed range diorama.
    const copyX = layout.lobbyPanelX + 18;
    const copyW = Math.round(layout.lobbyPanelW * 0.5);
    const previewLeft = copyX + copyW + 6;
    const previewRight = layout.lobbyPanelX + layout.lobbyPanelW - 14;
    const previewCx = (previewLeft + previewRight) / 2;
    const previewCy = layout.lobbyPanelY + layout.lobbyPanelH / 2;
    const previewW = Math.max(120, previewRight - previewLeft);
    const previewH = layout.lobbyPanelH - 26;
    const preview = this.buildMiniRangePreview(previewCx, previewCy, previewW, previewH);

    const arenaTitle = this.add.text(copyX, layout.lobbyPanelY + 20, "How to Play", {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffe066",
    });
    const arenaCopy = this.add.text(copyX, layout.lobbyPanelY + 46, [
      "• Tap SHOOT to loose an arrow",
      "• Hold to curve the arrow up",
      "• Release to level it out",
      "• Clear every target to win",
    ].join("\n"), {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: "#d9f2e1",
      lineSpacing: 6,
      wordWrap: { width: copyW },
    });

    // ── Difficulty cards row ──────────────────────────────────────────────────
    const cardsY = layout.lobbyCardsY;
    const cardW  = layout.lobbyCardW;
    const cardH  = layout.lobbyCardH;
    const gap    = layout.lobbyCardGap;
    const totalW = 3 * cardW + 2 * gap;
    const cardsX = (this.scW - totalW) / 2;

    this.lobbyCards = [];
    for (let i = 0; i < 3; i++) {
      const rule = ruleOf(i as Difficulty);
      const cx   = cardsX + i * (cardW + gap) + cardW / 2;
      const cy   = cardsY + cardH / 2;
      const card = this.makeCard(cx, cy, cardW, cardH, i as Difficulty, rule);
      this.lobbyCards.push(card);
    }

    const poolText = this.add.text(this.scW / 2, layout.lobbyStatusY, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#a87722",
      align: "center",
      wordWrap: { width: this.scW - layout.pad * 2 },
    }).setOrigin(0.5);
    this.lobbyStatusText = poolText;

    this.lobbyContainer.add([
      headerGfx,
      titleMark,
      title,
      sub,
      arenaGfx,
      preview,
      arenaTitle,
      arenaCopy,
      ...this.lobbyCards,
      poolText,
    ]);

    // Idle cue: a slow, reduced-motion-gated bob on the diorama arrow so the
    // start screen feels alive instead of like a static screenshot.
    if (this.lobbyPreviewArrow) {
      this.tween({
        targets: this.lobbyPreviewArrow,
        y: this.lobbyPreviewArrow.y - 5,
        duration: 1500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private buildMiniRangePreview(
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): Phaser.GameObjects.Container {
    const preview = this.add.container(0, 0);

    // Framed inset so the right half of the panel reads as a little archery
    // range rather than a few icons floating in an empty quadrant.
    const insetX = cx - w / 2;
    const insetY = cy - h / 2;
    const frame = this.add.graphics();
    frame.fillStyle(C.pineDeep, 0.6);
    frame.fillRoundedRect(insetX, insetY, w, h, 10);
    frame.lineStyle(1, C.cardBorder, 0.5);
    frame.strokeRoundedRect(insetX, insetY, w, h, 10);

    const baseY = insetY + h * 0.72;
    const spanLeft = insetX + w * 0.16;
    const spanRight = insetX + w * 0.82;
    const span = spanRight - spanLeft;
    const arcH = h * 0.44;

    // Bow (left) → dotted parabola over a wall (mid) → ringed target (right).
    const bow = this.add.image(spanLeft, baseY, ARROW_ASSETS.bow).setDisplaySize(26, 38);
    const wall = this.add.image(spanLeft + span * 0.5, baseY - 6, ARROW_ASSETS.wall).setDisplaySize(16, 54);
    const board = this.add.image(spanRight, baseY, ARROW_ASSETS.target).setDisplaySize(38, 38);

    const arc = this.add.graphics();
    arc.fillStyle(C.goldLight, 0.9);
    const steps = 11;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = spanLeft + t * span;
      const y = baseY - Math.sin(t * Math.PI) * arcH;
      arc.fillCircle(x, y, i === steps ? 2.8 : 1.9);
    }

    const arrow = this.add.image(spanLeft + span * 0.5, baseY - arcH, ARROW_ASSETS.arrow)
      .setDisplaySize(28, 8)
      .setRotation(Phaser.Math.DegToRad(-6));
    this.lobbyPreviewArrow = arrow;

    preview.add([frame, arc, wall, bow, board, arrow]);
    return preview;
  }

  private makeCard(
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    difficulty: Difficulty,
    rule: ReturnType<typeof ruleOf>,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(cx, cy);

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const badge = this.add.image(0, -30, ARROW_ASSETS.badges[difficulty])
      .setDisplaySize(40, 40);

    const label = this.add.text(0, -6, DIFF_LABELS[difficulty], {
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#f3cf7f",
    }).setOrigin(0.5);

    const targetTxt = this.add.text(0, 12, `${rule.targetLevels} targets`, {
      fontFamily: FONT_FAMILY,
      fontSize: "11px",
      color: "#d9f2e1",
    }).setOrigin(0.5);

    const entryTxt = this.add.text(0, 28, this.isGuest() ? "Free play" : `${gasDisplay(rule.entryFixed8)} GAS`, {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#8fe6b6",
    }).setOrigin(0.5);

    const lockTxt = this.add.text(0, 42, "Cleared", {
      fontFamily: FONT_FAMILY,
      fontSize: "10px",
      color: "#f9d27a",
      fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);

    container.add([bg, badge, label, targetTxt, entryTxt, lockTxt]);
    container.setData("difficulty", difficulty);

    this.bindGameButton(bg, {
      targets: container,
      enabled: () => !this.isDifficultyLocked(difficulty),
      onPress: () => {
        if (this.isDifficultyLocked(difficulty)) return;
        this.sfx.play("select");
        this.pickedDifficulty = difficulty;
        this.dispatch("selectDifficulty", { difficulty });
        this.updateLobbyCards();
        if (this.canStartDifficulty(difficulty)) {
          this.dispatch("startGame", { difficulty });
        }
      },
      onHoverIn: () => {
        if (!this.isDifficultyLocked(difficulty) && difficulty !== this.pickedDifficulty) {
          bg.setStrokeStyle(2, C.muted);
        }
      },
      onHoverOut: () => {
        this.updateLobbyCards();
      },
    });

    return container;
  }

  private updateLobbyCards(): void {
    this.ensureSelectableDifficulty();
    for (let i = 0; i < this.lobbyCards.length; i++) {
      const card     = this.lobbyCards[i]!;
      const bg       = card.list[0] as Phaser.GameObjects.Rectangle;
      const label    = card.list[2] as Phaser.GameObjects.Text;
      const target   = card.list[3] as Phaser.GameObjects.Text;
      const entry    = card.list[4] as Phaser.GameObjects.Text;
      const lock     = card.list[5] as Phaser.GameObjects.Text;
      const locked   = this.isDifficultyLocked(i as Difficulty);
      const isActive = i === this.pickedDifficulty;
      bg.setFillStyle(locked ? 0x183226 : isActive ? C.cardActiveBg : C.cardBg);
      bg.setStrokeStyle(2, locked ? 0x425846 : isActive ? C.cardActive : C.cardBorder);
      label.setColor(locked ? "#9fb7a6" : "#f3cf7f");
      target.setColor(locked ? "#8aa493" : "#d9f2e1");
      entry.setText(
        this.isGuest()
          ? "Free play"
          : locked ? "Completed" : `${gasDisplay(ruleOf(i as Difficulty).entryFixed8)} GAS`,
      );
      entry.setColor(locked ? "#9fb7a6" : "#8fe6b6");
      lock.setVisible(locked);
      card.setAlpha(locked ? 0.58 : 1);
      if (bg.input) bg.input.enabled = !locked;
    }
    // Update pool text
    const poolFree = this.num("poolFree", 0);
    const rule     = ruleOf(this.pickedDifficulty);
    const needed   = Number(gasDisplay(rule.rewardFixed8));
    const progressionReady = this.bool("progressionReady");
    const locked   = this.isDifficultyLocked(this.pickedDifficulty);
    const walletConnected = this.bool("walletConnected");
    const busy     = this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting");
    const ready    = this.canStartDifficulty(this.pickedDifficulty);
    if (this.lobbyStatusText) {
      if (this.isGuest()) {
        // Local run: no GAS/pool/wallet framing — just an invitation to play.
        const time = Math.round(rule.limitMs / 60000);
        this.lobbyStatusText.setText(
          busy
            ? "Setting up your range"
            : `Tap a range to play  ·  ${rule.targetLevels} targets  ·  ${time} min`,
        );
        this.lobbyStatusText.setColor("#266542");
      } else {
        const reward  = gasDisplay(rule.rewardFixed8);
        const time    = Math.round(rule.limitMs / 60000);
        const statusText = busy
          ? "Preparing your archery range"
          : !walletConnected
            ? "Connect wallet to start a range"
            : !progressionReady
              ? "Checking account range history"
              : locked
                ? `Range cleared. Play ${this.routeName(this.requiredDifficulty())} next.`
                : ready
                  ? `Tap a range to start  ·  Win: ${reward} GAS  ·  ${time} min`
                  : `Pool low (${poolFree.toFixed(2)} / ${needed} GAS reward needed)`;
        this.lobbyStatusText.setText(statusText);
        // Caption sits on the pale shell just above the cards — use dark-on-light
        // tones (pine when ready, deep amber for a wait/warn state).
        this.lobbyStatusText.setColor(ready ? "#266542" : "#a87722");
      }
    }
  }

  /** Guest (free / local) mode surfaced from app.mode via the bridge state. */
  private isGuest(): boolean {
    return this.str("appMode", "gamefi") === "guest";
  }

  private requiredDifficulty(): Difficulty {
    return Math.max(0, Math.min(2, this.num("progressionRequiredDifficulty", 0))) as Difficulty;
  }

  private routeName(difficulty: Difficulty): string {
    return DIFF_LABELS[difficulty] ?? "next range";
  }

  private isDifficultyLocked(difficulty: Difficulty): boolean {
    return this.bool("progressionReady") && difficulty < this.requiredDifficulty();
  }

  private ensureSelectableDifficulty(): void {
    if (this.isDifficultyLocked(this.pickedDifficulty)) {
      this.pickedDifficulty = this.requiredDifficulty();
    }
  }

  private canStartDifficulty(difficulty: Difficulty): boolean {
    if (this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting")) return false;
    // Guest is a local run: no wallet, no reward pool, no progression gate.
    if (this.isGuest()) return !this.isDifficultyLocked(difficulty);
    if (!this.bool("walletConnected")) return false;
    if (!this.bool("progressionReady")) return false;
    if (this.isDifficultyLocked(difficulty)) return false;
    const poolFree = this.num("poolFree", 0);
    const rule = ruleOf(difficulty);
    return poolFree >= Number(gasDisplay(rule.rewardFixed8));
  }

  // ── Submit gating ─────────────────────────────────────────────────────────

  private canSubmitRun(): boolean {
    if (!this.run?.won || this.str("gameStatus", "") !== "dealt") return false;
    if (this.bool("isSubmitting")) return false;
    // Local runs settle instantly — no anti-bot floor or deadline buffer.
    if (this.isGuest()) return true;
    const deadline = this.num("deadline", 0);
    const dealtAt = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : Number.POSITIVE_INFINITY;
    if (remainingMs <= SUBMIT_BUFFER_MS) return false;
    if (dealtAt <= 0) return true;
    return this.nowMs - dealtAt >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  }

  private submitGateMessage(canSubmit: boolean): string {
    if (this.isGuest()) {
      return canSubmit
        ? "Save your local run score."
        : "Clear every target to finish the run.";
    }
    if (canSubmit) return "Submit for GAS before time runs out.";
    const deadline = this.num("deadline", 0);
    const dealtAt = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : Number.POSITIVE_INFINITY;
    if (remainingMs <= SUBMIT_BUFFER_MS) return "Too close to the deadline.";
    if (dealtAt <= 0) return "Settlement unlock is being checked.";
    const waitMs = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - (this.nowMs - dealtAt);
    return `Settlement unlocks in ${formatClock(waitMs)}.`;
  }

  // ── Clock timer (drives HUD countdown each second) ────────────────────────

  private startClockTimer(): void {
    this.stopClockTimer();
    this.nowMs = Date.now();
    this.clockTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.nowMs = Date.now();
        if (this.str("gameStatus", "") === "dealt") {
          this.updateHUD();
          this.updateShootButton();
          if (this.run?.done) {
            this.onStateUpdate(this.state);
          }
        }
      },
      callbackScope: this,
    });
  }

  private stopClockTimer(): void {
    if (this.clockTimer) {
      this.clockTimer.destroy();
      this.clockTimer = null;
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on("pointerdown", () => {
      this.sfx.unlock();
      this.pointerHeld = true;
      if (!this.flight && this.canShoot()) {
        this.launchArrow();
      }
    });
    this.input.on("pointerup", () => {
      this.pointerHeld = false;
    });
    this.input.on("pointerupoutside", () => {
      this.pointerHeld = false;
    });

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-SPACE", (event: KeyboardEvent) => {
        event.preventDefault?.();
        this.sfx.unlock();
        if (!this.spaceHeld) {
          this.spaceHeld = true;
          if (!this.flight && this.canShoot()) {
            this.launchArrow();
          }
        }
      });
      this.input.keyboard.on("keyup-SPACE", () => {
        this.spaceHeld = false;
      });
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  override destroy(fromScene = false): void {
    this.stopClockTimer();
    if (this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    super.destroy(fromScene);
  }
}
