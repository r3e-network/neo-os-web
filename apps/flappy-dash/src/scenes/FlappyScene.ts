/**
 * FlappyScene — Phaser 3 scene for the Flappy Dash miniapp.
 *
 * Renders:
 *  - Parallax Flappy-style sky background
 *  - Scrolling ground strip at bottom
 *  - Pipe sprites generated deterministically from seed
 *  - Bird sprite animation with up/mid/down wing frames
 *  - Score counter (pipes passed) as HUD pill
 *  - Lobby: arcade-style route selector (idle / solved / expired states)
 *  - Overlays: "Tap to fly", crash, win, committed/dealing
 *
 * State received from React (via GameBridge):
 *  - gameStatus    "idle" | "committed" | "dealt" | "unknown" | "solved" | "expired"
 *  - seed          string  (RNG seed for pipe layout)
 *  - gameDifficulty number
 *  - deadline      number  (unix ms)
 *  - isStarting    boolean
 *  - isDealing     boolean
 *  - isSubmitting  boolean
 *  - poolFree      number
 *
 * Dispatches:
 *  - "connectWallet"   {}
 *  - "startGame"       { difficulty }
 *  - "recordFlap"      { pipes }
 *  - "syncScore"       { pipes }
 *  - "submitSolution"  { pipes }
 *  - "expireGame"      {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState as BridgeState } from "@framework/phaser";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_X,
  PIPE_WIDTH,
  createGameState,
  updateFrame,
  flap as engineFlap,
  type Pipe,
} from "../logic/flappy-engine";
import type { GameState as FlappyGameState } from "../logic/flappy-engine";
import { DIFFICULTY_RULES, ruleOf, gasDisplay } from "../logic/game-rules";

// ─── Layout constants ─────────────────────────────────────────────────────────

const W = CANVAS_WIDTH;   // 400
const H = CANVAS_HEIGHT;  // 600
const UI_FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  white:        0xffffff,
  black:        0x000000,
  ink:          0x173247,
  inkSoft:      0x42677c,
  panelBg:      0xfffff7,
  panelStroke:  0xf2b25d,
  chipBg:       0xf6fdff,
  chipBorder:   0x8bd7ea,
  chipActive:   0xe7fff4,
  chipAccent:   0x16c784,
  btnPrimary:   0xffa83d,
  btnStroke:    0xffd076,
  btnDisabled:  0xf8e5bf,
  overlayWin:   0x0d2b1a,
  overlayCrash: 0x1a0a0a,
};

// Score synchronization is local UI state only. Real flap inputs use the
// separate recordFlap action so the TEE op-log never receives fake flaps.
const REPORT_INTERVAL_FRAMES = 60; // ~1 s at 60 fps
const INPUT_COOLDOWN_MS = 68;
const FIXED_STEP_MS = 1000 / 60;
const MAX_CATCH_UP_STEPS = 6;

const FLAPPY_ASSETS = {
  background: "flappy-background-day",
  ground: "flappy-ground-base",
  birdUp: "flappy-bird-up",
  birdMid: "flappy-bird-mid",
  birdDown: "flappy-bird-down",
  pipeTop: "flappy-pipe-top",
  pipeBottom: "flappy-pipe-bottom",
} as const;

// Show the playable skyline/sky portion of the 108x144 Flappy sprite sheet.
// Cropping out the lowest street band keeps foreground pipes/bird unambiguous.
const BACKGROUND_VISIBLE_SOURCE_HEIGHT = 120;
const BACKGROUND_SCALE = (H - GROUND_HEIGHT) / BACKGROUND_VISIBLE_SOURCE_HEIGHT;
const GROUND_TILE_SCALE = GROUND_HEIGHT / 24;

// ─── Localized labels (handed in via bridgeState.sceneLabels) ──────────────────

interface RouteLabel {
  title: string;      // "{name} route" (already resolved)
  meta: string;       // "5 gate run · 2 min timer"
  cardName: string;   // localized route name
  cardGates: string;  // "5 gates"
  entry: string;      // "Entry 0.02 GAS" (gamefi) / "No entry" (guest)
  reward: string;     // "0.1 GAS" (gamefi) / "5 pipes" (guest)
}

interface SceneLabels {
  eyebrow: string;
  heroTagline: string;
  title: string;
  poolChip: string;      // "Pool {pool} GAS"
  awaitingPool: string;
  launch: string;
  guestLaunch: string;
  payAndLaunch: string;
  connectWallet: string;
  connectingWallet: string;
  lobbyHint: string;
  launching: string;
  flyAgain: string;
  retryRun: string;
  tapTitle: string;
  tapHint: string;
  sealingTitle: string;
  sealingHint: string;
  settlementTitle: string;
  settlementHint: string;
  winTitle: string;
  crashTitle: string;
  timeUpTitle: string;
  winBody: string;       // "{score} pipes passed\nWin {reward} GAS"
  crashBody: string;     // "{score} pipes passed\nTarget {target}"
  timeUpBody: string;    // "{score} pipes passed\nDeadline reached"
  submitScore: string;
  saveScore: string;
  settleRun: string;
  submitting: string;
  playAgain: string;
  backToLobby: string;
  tryAgain: string;
  routes: RouteLabel[];
}

// English fallback so the scene renders even before the label map arrives (or
// when running standalone without the React shell). Live locales override this
// through bridgeState.sceneLabels.
const FALLBACK_LABELS: SceneLabels = {
  eyebrow: "Arcade flight deck",
  heroTagline: "Pass the gates, beat your best — free local practice.",
  title: "Flappy Dash",
  poolChip: "Free practice — no entry",
  awaitingPool: "Awaiting pool",
  launch: "Launch Run",
  guestLaunch: "Start Practice",
  payAndLaunch: "Pay {amount} GAS & Fly",
  connectWallet: "Connect Wallet",
  connectingWallet: "Connecting…",
  lobbyHint: "Free local flight · no wallet or transaction",
  launching: "Launching…",
  flyAgain: "Fly Again",
  retryRun: "Retry Run",
  tapTitle: "Tap to Fly!",
  tapHint: "Space / ↑ on desktop",
  sealingTitle: "Sealing Pipes…",
  sealingHint: "Preparing the verified flight session",
  settlementTitle: "Settlement Pending…",
  settlementHint: "Waiting for the verified callback. This run remains recoverable.",
  winTitle: "You Win!",
  crashTitle: "Crashed!",
  timeUpTitle: "Time Up!",
  winBody: "{score} pipes cleared\nRoute complete!",
  crashBody: "{score} pipes passed\nTarget {target}",
  timeUpBody: "{score} pipes passed\nDeadline reached",
  submitScore: "Submit Score",
  saveScore: "Save Score",
  settleRun: "Settle Run",
  submitting: "Submitting…",
  playAgain: "Play Again",
  backToLobby: "Back to Lobby",
  tryAgain: "Try Again",
  routes: DIFFICULTY_RULES.map((rule, index) => ({
    title: `${rule.key.charAt(0).toUpperCase() + rule.key.slice(1)} route`,
    meta: `${rule.targetPipes} gates · ${["roomy gaps", "faster rhythm", "tight gauntlet"][index]}`,
    cardName: rule.key.charAt(0).toUpperCase() + rule.key.slice(1),
    cardGates: `${rule.targetPipes} gates`,
    entry: "No entry — free",
    reward: `${rule.targetPipes} pipes`,
  })),
};

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "ready" | "playing" | "crashed" | "won";
type GameStatus = "idle" | "committed" | "dealt" | "solved" | "expired" | "refunded" | "unknown";
type SfxKind = "select" | "start" | "flap" | "score" | "crash" | "win";

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FlappyScene extends BaseScene {
  // ── Sprite layers ─────────────────────────────────────────────────────────
  private skyBackdrop!: Phaser.GameObjects.Rectangle;
  private backgroundSprite!: Phaser.GameObjects.TileSprite;
  private groundSprite!: Phaser.GameObjects.TileSprite;
  private pipeLayer!: Phaser.GameObjects.Container;
  private pipeSprites = new Map<
    Pipe,
    { top: Phaser.GameObjects.Image; bottom: Phaser.GameObjects.Image }
  >();
  private birdSprite!: Phaser.GameObjects.Image;
  private hudGraphics!: Phaser.GameObjects.Graphics;

  // ── HUD text ──────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;

  // ── Lobby layer ───────────────────────────────────────────────────────────
  private lobbyContainer!: Phaser.GameObjects.Container;
  private difficultyCards: Phaser.GameObjects.Container[] = [];
  private cardNameLabels: Phaser.GameObjects.Text[] = [];
  private cardGatesLabels: Phaser.GameObjects.Text[] = [];
  private startButton!: Phaser.GameObjects.Container;
  private startBtnBg!: Phaser.GameObjects.Rectangle;
  private startBtnLabel!: Phaser.GameObjects.Text;
  private poolLabel!: Phaser.GameObjects.Text;
  private lobbyStatusLabel!: Phaser.GameObjects.Text;
  private routeTitleLabel!: Phaser.GameObjects.Text;
  private routeTargetLabel!: Phaser.GameObjects.Text;
  private routeRewardLabel!: Phaser.GameObjects.Text;
  private routeEntryLabel!: Phaser.GameObjects.Text;
  private eyebrowLabel!: Phaser.GameObjects.Text;
  private titleLabel!: Phaser.GameObjects.Text;
  private heroTaglineLabel!: Phaser.GameObjects.Text;
  private heroBird!: Phaser.GameObjects.Image;
  private heroBirdShadow!: Phaser.GameObjects.Ellipse;

  // ── Dealing / ready overlay text refs (locale-refreshed) ───────────────────
  private sealingTitleLabel!: Phaser.GameObjects.Text;
  private sealingHintLabel!: Phaser.GameObjects.Text;
  private readyTitleLabel!: Phaser.GameObjects.Text;
  private readyHintLabel!: Phaser.GameObjects.Text;

  // ── Overlay layer ─────────────────────────────────────────────────────────
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private overlayActionBtn!: Phaser.GameObjects.Container;
  private overlayActionLabel!: Phaser.GameObjects.Text;
  private overlaySecondBtn!: Phaser.GameObjects.Container;
  private overlaySecondLabel!: Phaser.GameObjects.Text;

  // ── Dealing/committed screen ──────────────────────────────────────────────
  private dealingContainer!: Phaser.GameObjects.Container;
  private dealingPipes: Phaser.GameObjects.Image[] = [];

  // ── Ready overlay ("Tap to fly") ──────────────────────────────────────────
  private readyContainer!: Phaser.GameObjects.Container;

  // ── Local game state ──────────────────────────────────────────────────────
  private flappyState: FlappyGameState | null = null;
  private localPhase: LocalPhase = "idle";
  private pickedDifficulty = 0;
  private gameStatus: GameStatus = "idle";
  private prevSeed = "";
  private prevActiveGameId = "";
  private cloudOffset = 0;
  private groundOffset = 0;
  private fittedViewW = 0;
  private fittedViewH = 0;
  private frameAccum = 0;       // ms carry for fixed-60-fps step
  private reportTimer = 0;      // frames since last recordFlap
  private deadlineMs = 0;
  private lastReportedScore = -1;
  private lastScoreSfx = 0;
  private lastOverlayOutcome: "crashed" | "won" | "expired" | "" = "";
  private lastInputAt = -Infinity;
  private hasSeenA11yPrimaryPulse = false;
  private lastA11yPrimaryPulse = 0;

  constructor() {
    super("FlappyScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(FLAPPY_ASSETS.background, "./flappy-sprites/background-day.webp");
    this.load.image(FLAPPY_ASSETS.ground, "./flappy-sprites/base.webp");
    this.load.image(FLAPPY_ASSETS.birdUp, "./flappy-sprites/bird-up.webp");
    this.load.image(FLAPPY_ASSETS.birdMid, "./flappy-sprites/bird-mid.webp");
    this.load.image(FLAPPY_ASSETS.birdDown, "./flappy-sprites/bird-down.webp");
    this.load.image(FLAPPY_ASSETS.pipeTop, "./flappy-sprites/pipe-top.webp");
    this.load.image(FLAPPY_ASSETS.pipeBottom, "./flappy-sprites/pipe-bottom.webp");
  }

  create(): void {
    super.create();

    // Render layers (order matters: lowest depth first)
    this.skyBackdrop = this.add.rectangle(W / 2, H / 2, W + 260, H + 620, 0x87ceeb, 1)
      .setDepth(-2);

    this.backgroundSprite = this.add.tileSprite(
      0,
      0,
      W,
      H - GROUND_HEIGHT,
      FLAPPY_ASSETS.background,
    ).setOrigin(0).setDepth(0);
    this.backgroundSprite.setTileScale(BACKGROUND_SCALE, BACKGROUND_SCALE);

    this.pipeLayer = this.add.container(0, 0).setDepth(2);
    this.groundSprite = this.add.tileSprite(
      0,
      H - GROUND_HEIGHT,
      W,
      GROUND_HEIGHT,
      FLAPPY_ASSETS.ground,
    ).setOrigin(0).setDepth(3);
    this.groundSprite.setTileScale(GROUND_TILE_SCALE, GROUND_TILE_SCALE);

    this.birdSprite = this.add.image(
      BIRD_X + BIRD_WIDTH / 2,
      H / 2,
      FLAPPY_ASSETS.birdMid,
    ).setDisplaySize(BIRD_WIDTH, BIRD_HEIGHT).setDepth(4).setVisible(false);

    this.hudGraphics = this.add.graphics().setDepth(9);

    this.scoreText = this.add.text(W / 2, 18, "0", {
      fontFamily: UI_FONT,
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      shadow: { color: "#000000", blur: 4, offsetY: 2, fill: true },
    }).setOrigin(0.5, 0).setDepth(10);

    this.buildLobby();
    this.buildDealingScreen();
    this.buildReadyOverlay();
    this.buildResultOverlay();
    this.startAmbientMotion();

    // Pointer/keyboard input
    this.input.on("pointerdown", this.handleTap, this);
    this.input.keyboard?.on("keydown-SPACE",    this.handleTap, this);
    this.input.keyboard?.on("keydown-UP",        this.handleTap, this);
    this.input.keyboard?.on("keydown-W",         this.handleTap, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);

    // Draw initial static scene so there's no blank frame.
    this.drawSky();
    this.drawGround(0);
    this.fitCameraToHost();

    this.onStateUpdate(this.state);
  }

  protected onResize(): void {
    this.fitCameraToHost();
  }

  protected onReducedMotionChange(enabled: boolean): void {
    if (enabled) {
      this.stopAmbientMotion();
      return;
    }
    this.startAmbientMotion();
  }

  update(_time: number, delta: number): void {
    this.fitCameraToHostIfNeeded();
    // The deadline is session-wide, not flight-attempt-wide. Check it before
    // the phase guard so a bird resting on the crash overlay cannot keep an
    // expired practice run alive until the user presses Retry again.
    if (this.expireAtDeadlineIfNeeded()) return;
    if (this.localPhase !== "playing" || !this.flappyState) return;
    if (!this.isGuestMode() && this.bool("inputSyncFailed")) return;

    // Accumulate delta and step at fixed ~60 fps increments. Clamp a resumed
    // tab's first frame so it cannot trigger an unbounded catch-up loop.
    const safeDelta = Phaser.Math.Clamp(delta, 0, FIXED_STEP_MS * MAX_CATCH_UP_STEPS);
    this.frameAccum = Math.min(
      this.frameAccum + safeDelta,
      FIXED_STEP_MS * MAX_CATCH_UP_STEPS,
    );
    let catchUpSteps = 0;
    while (this.frameAccum >= FIXED_STEP_MS && catchUpSteps < MAX_CATCH_UP_STEPS) {
      this.frameAccum -= FIXED_STEP_MS;
      catchUpSteps++;
      const previousScore = this.flappyState.score;
      updateFrame(this.flappyState);
      if (this.flappyState.score > previousScore) {
        this.playPipePassFeedback(this.flappyState.score);
      }

      // Check phase transitions set by the engine
      const phase = this.flappyState.phase;
      if (phase === "crashed") {
        this.localPhase = "crashed";
        this.frameAccum = 0;
        this.showResultOverlay("crashed");
        this.reportScoreToReact(this.flappyState.score);
        break;
      }

      const rule = ruleOf(this.num("gameDifficulty", 0));
      if (phase === "won" || this.flappyState.score >= rule.targetPipes) {
        this.flappyState.phase = "won";
        this.localPhase = "won";
        this.frameAccum = 0;
        this.showResultOverlay("won");
        this.reportScoreToReact(this.flappyState.score);
        break;
      }

      // Periodic score report
      this.reportTimer++;
      if (this.reportTimer >= REPORT_INTERVAL_FRAMES) {
        this.reportTimer = 0;
        this.reportScoreToReact(this.flappyState.score);
      }

      if (this.expireAtDeadlineIfNeeded()) break;
    }

    // Advance scrolling even while stepping physics
    this.cloudOffset += safeDelta * 0.03;
    this.groundOffset += this.localPhase === "playing" ? safeDelta * 0.12 : 0;

    // Redraw game frame
    if (this.flappyState) {
      this.drawGameFrame();
    }
  }

  private expireAtDeadlineIfNeeded(): boolean {
    if (
      this.deadlineMs <= 0
      || Date.now() < this.deadlineMs
      || this.gameStatus !== "dealt"
      || this.localPhase === "won"
      || this.lastOverlayOutcome === "expired"
    ) return false;

    this.reportScoreToReact(this.flappyState?.score ?? 0);
    // Guest ends locally at the deadline. A paid session must be finalized
    // through the TEE/kernel; expireGame is only valid after the contract's
    // settlement grace period and must never be fired here prematurely.
    if (this.isGuestMode()) this.dispatch("expireGame");
    this.localPhase = "crashed";
    this.frameAccum = 0;
    this.showResultOverlay("expired");
    return true;
  }


  // ── BaseScene abstract implementation ──────────────────────────────────────

  protected onStateUpdate(_bridgeState: BridgeState): void {
    const status      = this.str("gameStatus", "idle") as GameStatus;
    const seed        = this.str("seed", "");
    const activeGame  = this.str("activeGameId", "0");
    const difficulty  = this.num("gameDifficulty", 0);
    const deadline    = this.num("deadline", 0);
    const isDealing   = this.bool("isDealing");
    const isStarting  = this.bool("isStarting");
    const poolFree    = this.num("poolFree", 0);
    const a11yPrimaryPulse = Math.max(0, Math.floor(this.num("a11yPrimaryPulse", 0)));

    this.gameStatus  = status;
    this.deadlineMs  = deadline;

    // ── State machine transitions ─────────────────────────────────────────

    if (status === "dealt" && seed && seed !== this.prevSeed) {
      // New seed arrived — start a fresh local run
      this.prevSeed        = seed;
      this.prevActiveGameId = activeGame;
      this.flappyState     = createGameState(seed, difficulty);
      this.flappyState.phase = "ready";
      this.localPhase      = "ready";
      this.frameAccum      = 0;
      this.reportTimer     = 0;
      this.lastReportedScore = -1;
      this.lastScoreSfx = 0;
      this.lastOverlayOutcome = "";

      this.showGameLayer();
      this.showReadyOverlay();
      this.updateScoreHud(0);
    } else if (
      status === "dealt"
      && this.overlayContainer?.visible
      && this.lastOverlayOutcome
    ) {
      // A failed/finished async settlement toggles isSubmitting without a new
      // seed. Refresh button copy in place instead of replaying result motion.
      this.applyResultOverlayCopy(this.lastOverlayOutcome);
    } else if (status !== "dealt") {
      // Not in an active game — reset to lobby
      if (this.localPhase !== "idle") {
        this.localPhase   = "idle";
        this.flappyState  = null;
        this.prevSeed     = "";
        this.frameAccum   = 0;
        this.lastOverlayOutcome = "";
      }

      if (status === "committed" || status === "unknown" || isDealing) {
        this.showDealingLayer();
      } else {
        this.showLobbyLayer();
        this.updateLobbyUI(status, poolFree, isStarting, difficulty);
      }
    }

    // ── Difficulty selection in lobby ─────────────────────────────────────
    if (status === "idle" || status === "solved" || status === "expired" || status === "refunded") {
      this.pickedDifficulty = Math.max(0, Math.min(2, Math.round(difficulty)));
      this.updateCardHighlights();
    }

    // Keep every static caption in sync with the active locale.
    this.applyStaticLabels();

    if (!this.hasSeenA11yPrimaryPulse) {
      this.hasSeenA11yPrimaryPulse = true;
      this.lastA11yPrimaryPulse = a11yPrimaryPulse;
    } else if (a11yPrimaryPulse !== this.lastA11yPrimaryPulse) {
      this.lastA11yPrimaryPulse = a11yPrimaryPulse;
      if (["idle", "solved", "expired", "refunded"].includes(status)) {
        this.onStartPressed();
      } else if (status === "dealt") {
        if (this.localPhase === "ready" || this.localPhase === "playing") {
          this.handleTap();
        } else if (this.localPhase === "crashed" || this.localPhase === "won") {
          this.onOverlayAction();
        }
      }
    }
  }

  // ── Localization ───────────────────────────────────────────────────────────

  /** Current locale label map, merged over the English fallback. */
  private labels(): SceneLabels {
    const provided = this.val<Partial<SceneLabels>>("sceneLabels");
    if (!provided) return FALLBACK_LABELS;
    return {
      ...FALLBACK_LABELS,
      ...provided,
      routes:
        Array.isArray(provided.routes) && provided.routes.length === FALLBACK_LABELS.routes.length
          ? provided.routes
          : FALLBACK_LABELS.routes,
    };
  }

  /** Guest (free / local) mode — supplied by the bridge; hides GAS/pool framing. */
  private isGuestMode(): boolean {
    return this.str("appMode", "guest") === "guest";
  }

  /** Substitute {token} placeholders in a localized template. */
  private fmt(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = vars[key];
      return value === undefined ? "" : String(value);
    });
  }

  /** Re-apply every persistent caption from the current label map. */
  private applyStaticLabels(): void {
    const L = this.labels();
    this.eyebrowLabel?.setText(L.eyebrow);
    this.titleLabel?.setText(L.title);
    this.heroTaglineLabel?.setText(L.heroTagline);
    const settlementPending = this.gameStatus === "unknown";
    this.sealingTitleLabel?.setText(settlementPending ? L.settlementTitle : L.sealingTitle);
    this.sealingHintLabel?.setText(settlementPending ? L.settlementHint : L.sealingHint);
    this.readyTitleLabel?.setText(L.tapTitle);
    this.readyHintLabel?.setText(L.tapHint);
    this.applyCardLabels(L);
    this.updateRoutePanel();
  }

  private applyCardLabels(L: SceneLabels): void {
    this.cardNameLabels.forEach((label, i) => label.setText(L.routes[i]?.cardName ?? ""));
    this.cardGatesLabels.forEach((label, i) => label.setText(L.routes[i]?.cardGates ?? ""));
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || W));
    const viewH = Math.max(1, Math.round(this.scale.height || H));
    const zoom = Math.min(viewW / W, viewH / H);
    const visibleW = viewW / Math.max(zoom, 0.001);
    const visibleH = viewH / Math.max(zoom, 0.001);
    const scrollX = (W - visibleW) / 2;
    const scrollY = (H - visibleH) / 2;
    this.fittedViewW = viewW;
    this.fittedViewH = viewH;

    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .setScroll(scrollX, scrollY);
  }

  private fitCameraToHostIfNeeded(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || W));
    const viewH = Math.max(1, Math.round(this.scale.height || H));
    if (viewW !== this.fittedViewW || viewH !== this.fittedViewH) {
      this.fitCameraToHost();
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private handleTap(): void {
    this.sfx.unlock();
    if (this.gameStatus !== "dealt" || !this.flappyState) return;
    if (this.bool("isSubmitting")) return;
    if (!this.isGuestMode() && this.bool("inputSyncFailed")) return;

    // Keyboard repeat and touch browsers can emit duplicate down events for a
    // single intent. A very short guard removes those without dulling rhythm.
    const now = this.time.now;
    if (now - this.lastInputAt < INPUT_COOLDOWN_MS) return;
    this.lastInputAt = now;

    if (this.localPhase === "ready") {
      this.playSfx("start");
      this.localPhase = "playing";
      this.flappyState.phase = "playing";
      engineFlap(this.flappyState);
      this.emitFlapBurst();
      this.hideReadyOverlay();
      this.dispatch("recordFlap", { pipes: this.flappyState.score });
      return;
    }

    if (this.localPhase === "playing") {
      engineFlap(this.flappyState);
      this.playSfx("flap");
      this.emitFlapBurst();
      this.dispatch("recordFlap", { pipes: this.flappyState.score });
    }
  }

  // ── Game feel: SFX and burst feedback ─────────────────────────────────────

  private playSfx(kind: SfxKind): void {
    // Historical behaviour: every cue also unlocked the mixer, so lobby taps
    // wired through raw pointerdown handlers produce sound on the first press.
    this.sfx.unlock();

    switch (kind) {
      case "select":
        this.sfx.play("tap");
        break;
      case "start":
        // Louder launch chord than the shared "start" preset.
        this.sfx.tones([
          { frequency: 392, duration: 0.07, type: "triangle", gain: 0.035, endFrequency: 587 },
          { frequency: 784, duration: 0.09, delay: 0.06, type: "sine", gain: 0.032, endFrequency: 988 },
        ]);
        break;
      case "flap":
        this.sfx.tones([
          { frequency: 740, duration: 0.07, type: "square", gain: 0.022, endFrequency: 1180 },
          { frequency: 420, duration: 0.05, delay: 0.018, type: "triangle", gain: 0.018, endFrequency: 520 },
        ]);
        break;
      case "score":
        this.sfx.tones([
          { frequency: 659, duration: 0.06, type: "sine", gain: 0.03, endFrequency: 880 },
          { frequency: 988, duration: 0.08, delay: 0.055, type: "triangle", gain: 0.026, endFrequency: 1175 },
        ]);
        break;
      case "crash":
        this.sfx.tones([
          { frequency: 180, duration: 0.18, type: "sawtooth", gain: 0.038, endFrequency: 64 },
          { frequency: 90, duration: 0.12, delay: 0.055, type: "square", gain: 0.018, endFrequency: 44 },
        ]);
        break;
      case "win":
        this.sfx.tones(
          [523, 659, 784, 1046].map((frequency, index) => ({
            frequency,
            duration: 0.12,
            delay: index * 0.07,
            type: "triangle" as const,
            gain: 0.028,
          })),
        );
        break;
    }
  }

  private emitFlapBurst(): void {
    if (this.reducedMotion || !this.birdSprite.visible) return;
    const originX = this.birdSprite.x - 16;
    const originY = this.birdSprite.y + 8;

    for (let index = 0; index < 3; index++) {
      const puff = this.add.ellipse(
        originX - index * 5,
        originY + Phaser.Math.Between(-4, 5),
        18 - index * 3,
        8,
        0xffffff,
        0.48 - index * 0.1,
      ).setDepth(5);

      this.tweens.add({
        targets: puff,
        x: puff.x - 28 - index * 6,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 0.45,
        duration: 260 + index * 35,
        ease: "Sine.easeOut",
        onComplete: () => puff.destroy(),
      });
    }
  }

  private playPipePassFeedback(score: number): void {
    if (score <= this.lastScoreSfx) return;
    this.lastScoreSfx = score;
    this.playSfx("score");
    if (this.reducedMotion) return;

    this.tweens.add({
      targets: this.scoreText,
      scale: 1.28,
      duration: 90,
      ease: "Sine.easeOut",
      yoyo: true,
    });

    const pop = this.add.text(W / 2 + 42, 54, `+${score}`, {
      fontFamily: UI_FONT,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#fff8b8",
      stroke: "#173247",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12);

    this.tweens.add({
      targets: pop,
      y: pop.y - 24,
      alpha: 0,
      scale: 1.18,
      duration: 460,
      ease: "Sine.easeOut",
      onComplete: () => pop.destroy(),
    });
  }

  private playResultFeedback(outcome: "crashed" | "won" | "expired"): void {
    const won = outcome === "won";
    this.playSfx(won ? "win" : "crash");
    if (this.reducedMotion) return;

    if (won) {
      this.cameras.main.flash(220, 255, 244, 181, false, undefined, 0.24);
      this.emitWinBurst();
      return;
    }

    this.cameras.main.shake(170, 0.006);
    this.cameras.main.flash(120, 255, 90, 70, false, undefined, 0.18);
    this.emitCrashBurst();
  }

  private emitWinBurst(): void {
    const colors = [0xffd166, 0x16c784, 0x4dc9f6, 0xffffff];
    for (let index = 0; index < 18; index++) {
      const spark = this.add.circle(
        W / 2 + Phaser.Math.Between(-92, 92),
        H / 2 - 48 + Phaser.Math.Between(-28, 30),
        Phaser.Math.Between(3, 6),
        colors[index % colors.length]!,
        0.92,
      ).setDepth(34);

      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-42, 42),
        y: spark.y + Phaser.Math.Between(-76, 34),
        alpha: 0,
        scale: 0.4,
        duration: 680 + index * 18,
        ease: "Sine.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private emitCrashBurst(): void {
    const x = this.birdSprite.visible ? this.birdSprite.x : W / 2;
    const y = this.birdSprite.visible ? this.birdSprite.y : H / 2;
    for (let index = 0; index < 8; index++) {
      const shard = this.add.rectangle(
        x,
        y,
        Phaser.Math.Between(10, 18),
        4,
        index % 2 === 0 ? 0x5ec43f : 0x3a9e2a,
        0.72,
      ).setAngle(Phaser.Math.Between(-38, 38)).setDepth(34);

      this.tweens.add({
        targets: shard,
        x: shard.x + Phaser.Math.Between(-52, 52),
        y: shard.y + Phaser.Math.Between(-34, 52),
        alpha: 0,
        angle: shard.angle + Phaser.Math.Between(-90, 90),
        duration: 420 + index * 18,
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
  }

  // ── Score reporting ────────────────────────────────────────────────────────

  private reportScoreToReact(score: number): void {
    if (score !== this.lastReportedScore) {
      this.lastReportedScore = score;
      this.dispatch("syncScore", { pipes: score });
    }
  }


  // ── Drawing helpers ────────────────────────────────────────────────────────

  private drawSky(): void {
    this.backgroundSprite.setVisible(true);
    this.backgroundSprite.setTilePosition(this.cloudOffset * 0.18, 0);
  }

  private drawGround(frame: number): void {
    this.groundSprite.setVisible(true);
    this.groundSprite.setTilePosition((this.groundOffset + frame * 2) / GROUND_TILE_SCALE, 0);
  }

  private drawPipes(gs: FlappyGameState): void {
    const livePipes = new Set(gs.pipes);
    for (const p of gs.pipes) {
      const topH    = p.gapY;
      const botY    = p.gapY + gs.tuning.pipeGap;
      const botH    = H - GROUND_HEIGHT - botY;
      const x       = p.x;

      let sprites = this.pipeSprites.get(p);
      if (!sprites) {
        sprites = {
          top: this.add.image(0, 0, FLAPPY_ASSETS.pipeTop).setOrigin(0, 0),
          bottom: this.add.image(0, 0, FLAPPY_ASSETS.pipeBottom).setOrigin(0, 0),
        };
        this.pipeLayer.add([sprites.top, sprites.bottom]);
        this.pipeSprites.set(p, sprites);
      }

      sprites.top
        .setPosition(x, 0)
        .setDisplaySize(PIPE_WIDTH, Math.max(1, topH));
      sprites.bottom
        .setPosition(x, botY)
        .setDisplaySize(PIPE_WIDTH, Math.max(1, botH));
    }

    for (const [pipe, sprites] of this.pipeSprites) {
      if (livePipes.has(pipe)) continue;
      sprites.top.destroy();
      sprites.bottom.destroy();
      this.pipeSprites.delete(pipe);
    }
  }

  private drawBird(gs: FlappyGameState): void {
    const bx  = BIRD_X;
    const by  = gs.bird.y;
    const cx  = bx + BIRD_WIDTH  / 2;
    const cy  = by + BIRD_HEIGHT / 2;
    const frame =
      gs.bird.vy < -1.4
        ? FLAPPY_ASSETS.birdUp
        : gs.bird.vy > 2.2
          ? FLAPPY_ASSETS.birdDown
          : FLAPPY_ASSETS.birdMid;

    this.birdSprite
      .setVisible(true)
      .setTexture(frame)
      .setDisplaySize(BIRD_WIDTH, BIRD_HEIGHT)
      .setPosition(cx, cy)
      .setAngle(gs.bird.rotation);
  }

  private drawScorePill(score: number): void {
    const label = String(score);
    this.scoreText.setText(label);
    // Simple drop-shadow pill drawn behind the text
    const metrics = this.scoreText.getBounds();
    const pillW   = metrics.width + 28;
    const pillH   = 36;
    const pillX   = W / 2 - pillW / 2;
    const pillY   = 14;

    const g = this.hudGraphics;
    g.clear();
    g.fillStyle(C.black, 0.3);
    g.fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
    g.lineStyle(1, C.white, 0.18);
    g.strokeRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
  }

  private drawGameFrame(): void {
    if (!this.flappyState) return;
    const gs = this.flappyState;
    this.drawSky();
    this.drawPipes(gs);
    this.drawGround(gs.frame);
    this.drawBird(gs);
    this.updateScoreHud(gs.score);
  }

  private updateScoreHud(score: number): void {
    this.scoreText.setVisible(true);
    this.drawScorePill(score);
  }


  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(): void {
    this.lobbyContainer = this.add.container(0, 0).setDepth(20);

    // Eyebrow: near-white with a dark stroke + shadow so it reads on the dark
    // sky band; raised well clear of the title cap-height.
    this.eyebrowLabel = this.add.text(W / 2, 15, FALLBACK_LABELS.eyebrow, {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: "#eaf6ff",
      fontStyle: "bold",
      stroke: "#0b2f45",
      strokeThickness: 3,
      shadow: { color: "#0b2f45", blur: 4, offsetY: 1, fill: true },
    }).setOrigin(0.5, 0);
    this.eyebrowLabel.setLetterSpacing?.(1.5);
    this.lobbyContainer.add(this.eyebrowLabel);

    this.titleLabel = this.add.text(W / 2, 47, FALLBACK_LABELS.title, {
      fontFamily: UI_FONT,
      fontSize: "31px",
      color: "#173247",
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: 5,
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.titleLabel);

    // Soft radial-style vignette (stacked low-alpha ellipses) instead of a
    // bordered box, so the hero region reads as ambient depth behind the bird.
    for (const [w, h, a] of [
      [318, 214, 0.1],
      [244, 168, 0.12],
      [168, 122, 0.14],
    ] as const) {
      this.lobbyContainer.add(
        this.add.ellipse(W / 2, 176, w, h, C.white, a).setOrigin(0.5),
      );
    }

    const heroPipeTopLeft = this.add.image(70, 130, FLAPPY_ASSETS.pipeTop)
      .setDisplaySize(58, 166)
      .setAlpha(0.92);
    const heroPipeBottomLeft = this.add.image(70, 286, FLAPPY_ASSETS.pipeBottom)
      .setDisplaySize(58, 166)
      .setAlpha(0.92);
    const heroPipeTopRight = this.add.image(W - 70, 116, FLAPPY_ASSETS.pipeTop)
      .setDisplaySize(58, 150)
      .setAlpha(0.82);
    const heroPipeBottomRight = this.add.image(W - 70, 274, FLAPPY_ASSETS.pipeBottom)
      .setDisplaySize(58, 150)
      .setAlpha(0.82);
    this.lobbyContainer.add([
      heroPipeTopLeft,
      heroPipeBottomLeft,
      heroPipeTopRight,
      heroPipeBottomRight,
    ]);

    // Shadow tucked just under the bird's resting position so the two read as a
    // connected pair, well clear of the tagline below.
    this.heroBirdShadow = this.add.ellipse(W / 2, 214, 78, 16, 0x0f3a50, 0.16);
    this.heroBird = this.add.image(W / 2, 176, FLAPPY_ASSETS.birdMid)
      .setDisplaySize(76, 64)
      .setAngle(-6);
    this.heroTaglineLabel = this.add.text(W / 2, 262, FALLBACK_LABELS.heroTagline, {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#173247",
      stroke: "#ffffff",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.lobbyContainer.add([this.heroBirdShadow, this.heroBird, this.heroTaglineLabel]);

    const routePanel = this.add.rectangle(W / 2, 334, 330, 74, C.panelBg, 0.96)
      .setStrokeStyle(2, C.panelStroke, 0.86)
      .setOrigin(0.5);
    this.lobbyContainer.add(routePanel);

    this.routeTitleLabel = this.add.text(54, 306, "", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#173247",
    }).setOrigin(0, 0);
    this.routeTargetLabel = this.add.text(54, 330, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#42677c",
    }).setOrigin(0, 0);
    this.routeRewardLabel = this.add.text(W - 54, 305, "", {
      fontFamily: UI_FONT,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#16a873",
    }).setOrigin(1, 0);
    this.routeEntryLabel = this.add.text(W - 54, 333, "", {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: "#6b8190",
    }).setOrigin(1, 0);
    this.lobbyContainer.add([
      this.routeTitleLabel,
      this.routeTargetLabel,
      this.routeRewardLabel,
      this.routeEntryLabel,
    ]);

    this.difficultyCards = [];
    this.cardNameLabels = [];
    this.cardGatesLabels = [];
    DIFFICULTY_RULES.forEach((rule, i) => {
      const cardX = 75 + i * 125;
      const cardY = 408;
      const card  = this.buildDifficultyCard(cardX, cardY, rule, i);
      this.difficultyCards.push(card);
      this.lobbyContainer.add(card);
    });

    const controlPanel = this.add.rectangle(W / 2, H - GROUND_HEIGHT - 42, 330, 88, C.white, 0.82)
      .setStrokeStyle(1, 0xffffff, 0.62)
      .setOrigin(0.5);
    this.lobbyContainer.add(controlPanel);

    this.poolLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 78, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#315f74",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.poolLabel);

    this.lobbyStatusLabel = this.add.text(W / 2, H - GROUND_HEIGHT - 60, "", {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: "#7b6b5c",
    }).setOrigin(0.5, 0);
    this.lobbyContainer.add(this.lobbyStatusLabel);

    this.startButton = this.add.container(W / 2, H - GROUND_HEIGHT - 24);
    this.startBtnBg  = this.add.rectangle(0, 0, 224, 44, C.btnPrimary)
      .setStrokeStyle(2, C.btnStroke)
      .setOrigin(0.5);
    this.startBtnBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(this.startBtnBg, {
      targets: this.startButton,
      pressScale: 0.95,
      onPress: () => this.onStartPressed(),
    });
    this.startBtnLabel = this.add.text(0, 0, FALLBACK_LABELS.launch, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#173247",
    }).setOrigin(0.5);
    this.startButton.add([this.startBtnBg, this.startBtnLabel]);
    this.lobbyContainer.add(this.startButton);
  }

  private buildDifficultyCard(
    cx: number,
    cy: number,
    rule: typeof DIFFICULTY_RULES[number],
    index: number,
  ): Phaser.GameObjects.Container {
    const c     = this.add.container(cx, cy);
    const cardW = 110;
    const cardH = 58;
    const route = this.labels().routes[index] ?? FALLBACK_LABELS.routes[index]!;

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.chipBg, 0.92)
      .setStrokeStyle(2, C.chipBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.playSfx("select");
      this.pickedDifficulty = rule.difficulty;
      this.updateCardHighlights();
      this.dispatch("selectDifficulty", { difficulty: rule.difficulty });
      this.pressFeedback(c, { scale: 0.96, duration: 70 });
    });
    bg.on("pointerover",  () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(0xffffff, 0.98); });
    bg.on("pointerout",   () => { if (this.pickedDifficulty !== rule.difficulty) bg.setFillStyle(C.chipBg, 0.92); });

    // Small genre bird tucked in the top-left corner as an accent; the route
    // name is centred so localized names have the full card width.
    const bird = this.add.image(-cardW / 2 + 14, -cardH / 2 + 13, FLAPPY_ASSETS.birdMid)
      .setDisplaySize(18, 15)
      .setAngle(-8)
      .setAlpha(0.9);

    const nameLabel = this.add.text(0, -4, route.cardName, {
      fontFamily: UI_FONT,
      fontSize: "12.5px",
      fontStyle: "bold",
      color: "#173247",
      align: "center",
    }).setOrigin(0.5);

    const gatesLabel = this.add.text(0, 16, route.cardGates, {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: "#42677c",
      align: "center",
    }).setOrigin(0.5);

    const dot = this.add.circle(cardW / 2 - 13, -cardH / 2 + 13, 4.5, C.chipAccent, 0);

    this.cardNameLabels[index] = nameLabel;
    this.cardGatesLabels[index] = gatesLabel;

    c.add([bg, bird, nameLabel, gatesLabel, dot]);
    return c;
  }

  private updateCardHighlights(): void {
    this.difficultyCards.forEach((card, i) => {
      const rule   = DIFFICULTY_RULES[i]!;
      const active = rule.difficulty === this.pickedDifficulty;
      const bg     = card.list[0] as Phaser.GameObjects.Rectangle;
      const dot    = card.list[card.list.length - 1] as Phaser.GameObjects.Arc;
      bg.setFillStyle(active ? C.chipActive : C.chipBg, active ? 0.98 : 0.92);
      bg.setStrokeStyle(2, active ? C.chipAccent : C.chipBorder);
      dot.setAlpha(active ? 1 : 0);
    });
    this.updateRoutePanel();
  }

  private updateRoutePanel(): void {
    if (!this.routeTitleLabel) return;
    const L     = this.labels();
    const route = L.routes[this.pickedDifficulty] ?? L.routes[0]!;
    this.routeTitleLabel.setText(route.title);
    this.routeTargetLabel.setText(route.meta);
    this.routeRewardLabel.setText(route.reward);
    this.routeEntryLabel.setText(route.entry);
  }

  private updateLobbyUI(
    status: GameStatus,
    poolFree: number,
    isStarting: boolean,
    _difficulty: number,
  ): void {
    const L          = this.labels();
    const rule       = ruleOf(this.pickedDifficulty);
    const rewardGas  = Number(gasDisplay(rule.rewardFixed8));
    const guest      = this.isGuestMode();
    const walletConnected = this.bool("walletConnected");
    const isConnectingWallet = this.bool("isConnectingWallet");
    // Guest (local) play has no reward pool, so it is never pool-gated — the
    // launch button stays live regardless of the (zeroed) pool value.
    const poolReady  = guest ? true : poolFree >= rewardGas;

    // Pool stays informative (neutral chip), never an alarm — an unfunded pool
    // is a waiting state, not an error. In guest the chip carries local framing.
    this.poolLabel.setText(this.fmt(L.poolChip, { pool: poolFree.toFixed(2) }));
    this.lobbyStatusLabel.setText(L.lobbyHint);

    // Connecting and spending are deliberately separate gestures. The first
    // disconnected press only opens the wallet; the next clearly quotes entry.
    let label = guest
      ? L.guestLaunch
      : walletConnected
        ? this.fmt(L.payAndLaunch, { amount: gasDisplay(rule.entryFixed8) })
        : L.connectWallet;
    if (isConnectingWallet)                         label = L.connectingWallet;
    else if (isStarting)                            label = L.launching;
    else if (!poolReady)                            label = L.awaitingPool;
    else if (!guest && !walletConnected)            label = L.connectWallet;
    else if (status === "solved")                   label = L.flyAgain;
    else if (status === "expired")                  label = L.retryRun;
    this.startBtnLabel.setText(label);

    this.startBtnBg.setFillStyle(
      isStarting || isConnectingWallet || !poolReady ? C.btnDisabled : C.btnPrimary,
    );

    // Update card highlights to match current difficulty from bridge
    this.updateCardHighlights();
  }

  private onStartPressed(): void {
    const isStarting  = this.bool("isStarting");
    const isConnectingWallet = this.bool("isConnectingWallet");
    const poolFree    = this.num("poolFree", 0);
    const rule        = ruleOf(this.pickedDifficulty);
    const rewardGas   = Number(gasDisplay(rule.rewardFixed8));
    // Guest (local) play has no reward pool, so it is never pool-gated.
    if (isStarting || isConnectingWallet || (!this.isGuestMode() && poolFree < rewardGas)) return;
    if (!this.isGuestMode() && !this.bool("walletConnected")) {
      this.playSfx("select");
      this.dispatch("connectWallet");
      return;
    }
    this.playSfx("start");
    this.dispatch("startGame", { difficulty: this.pickedDifficulty });
  }


  // ── Dealing / committed screen ─────────────────────────────────────────────

  private buildDealingScreen(): void {
    this.dealingContainer = this.add.container(0, 0).setDepth(20).setVisible(false);

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.24);
    this.dealingContainer.add(bg);

    this.sealingTitleLabel = this.add.text(W / 2, H / 2 - 60, FALLBACK_LABELS.sealingTitle, {
      fontFamily: UI_FONT,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.dealingContainer.add(this.sealingTitleLabel);

    this.sealingHintLabel = this.add.text(W / 2, H / 2 - 20, FALLBACK_LABELS.sealingHint, {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#173247",
      stroke: "#ffffff",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.dealingContainer.add(this.sealingHintLabel);

    // Animated pipe sprites cycling while the verified pipe route is prepared.
    this.dealingPipes = [];
    for (let i = 0; i < 5; i++) {
      const pipe = this.add.image(
        W / 2 - 40 + i * 20,
        H / 2 + 40,
        i % 2 === 0 ? FLAPPY_ASSETS.pipeTop : FLAPPY_ASSETS.pipeBottom,
      ).setDisplaySize(14, 56).setAlpha(0.3);
      this.dealingContainer.add(pipe);
      this.dealingPipes.push(pipe);

    }
  }

  // ── Ready overlay ──────────────────────────────────────────────────────────

  private buildReadyOverlay(): void {
    this.readyContainer = this.add.container(W / 2, H / 2 - 40).setDepth(30).setVisible(false);

    const bg = this.add.rectangle(0, 0, 260, 90, C.black, 0.55)
      .setStrokeStyle(1, C.white, 0.25)
      .setOrigin(0.5);

    this.readyTitleLabel = this.add.text(0, -14, FALLBACK_LABELS.tapTitle, {
      fontFamily: UI_FONT,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.readyHintLabel = this.add.text(0, 16, FALLBACK_LABELS.tapHint, {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#dff9ff",
    }).setOrigin(0.5);

    this.readyContainer.add([bg, this.readyTitleLabel, this.readyHintLabel]);

  }

  // ── Result overlay (crash / win / expired) ─────────────────────────────────

  private buildResultOverlay(): void {
    this.overlayContainer = this.add.container(W / 2, H / 2 - 20).setDepth(30).setVisible(false);

    this.overlayBg = this.add.rectangle(0, 0, 300, 200, C.black, 0.82)
      .setStrokeStyle(2, C.white, 0.2)
      .setOrigin(0.5);

    this.overlayTitle = this.add.text(0, -68, "", {
      fontFamily: UI_FONT,
      fontSize: "32px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.overlayBody = this.add.text(0, -24, "", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#dff9ff",
      align: "center",
    }).setOrigin(0.5);

    // Primary action button (Retry / Submit)
    this.overlayActionBtn = this.add.container(0, 24);
    const actionBg = this.add.rectangle(0, 0, 200, 44, C.btnPrimary)
      .setStrokeStyle(2, 0x42a5f5)
      .setOrigin(0.5);
    actionBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(actionBg, {
      targets: this.overlayActionBtn,
      onPress: () => this.onOverlayAction(),
    });
    this.overlayActionLabel = this.add.text(0, 0, FALLBACK_LABELS.tryAgain, {
      fontFamily: UI_FONT,
      fontSize: "15px",
      fontStyle: "bold",
      color: "#173247",
    }).setOrigin(0.5);
    this.overlayActionBtn.add([actionBg, this.overlayActionLabel]);

    // Secondary action button (Submit / Expire)
    this.overlaySecondBtn = this.add.container(0, 72).setVisible(false);
    const secondBg = this.add.rectangle(0, 0, 200, 44, 0x1a2a3a)
      .setStrokeStyle(1, C.chipBorder)
      .setOrigin(0.5);
    secondBg.setInteractive({ useHandCursor: true });
    this.bindGameButton(secondBg, {
      targets: this.overlaySecondBtn,
      hoverScale: 1.03,
      pressScale: 0.96,
      onPress: () => this.onOverlaySecondAction(),
    });
    this.overlaySecondLabel = this.add.text(0, 0, FALLBACK_LABELS.submitScore, {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#dff9ff",
    }).setOrigin(0.5);
    this.overlaySecondBtn.add([secondBg, this.overlaySecondLabel]);

    this.overlayContainer.add([
      this.overlayBg,
      this.overlayTitle,
      this.overlayBody,
      this.overlayActionBtn,
      this.overlaySecondBtn,
    ]);
  }


  // ── Overlay actions ────────────────────────────────────────────────────────

  private showResultOverlay(outcome: "crashed" | "won" | "expired"): void {
    this.overlayContainer.setVisible(true).setAlpha(0).setScale(0.8);
    this.tween({
      targets: this.overlayContainer,
      alpha: 1, scale: 1,
      duration: 220,
      ease: "Back.easeOut",
    });

    if (this.lastOverlayOutcome !== outcome) {
      this.lastOverlayOutcome = outcome;
      this.playResultFeedback(outcome);
    }

    this.applyResultOverlayCopy(outcome);
  }

  private applyResultOverlayCopy(outcome: "crashed" | "won" | "expired"): void {
    const score = this.flappyState?.score ?? 0;
    const rule  = ruleOf(this.num("gameDifficulty", 0));
    const guest = this.isGuestMode();
    const busy = this.bool("isSubmitting");

    const L = this.labels();
    if (outcome === "won") {
      this.overlayTitle.setText(L.winTitle).setColor("#16c784");
      this.overlayBody.setText(
        this.fmt(L.winBody, { score, reward: gasDisplay(rule.rewardFixed8) }),
      );
      this.overlayBg.setFillStyle(C.overlayWin, 0.88);
      this.overlayActionLabel.setText(busy ? L.submitting : guest ? L.saveScore : L.submitScore);
      this.overlaySecondBtn.setVisible(guest);
      this.overlaySecondLabel.setText(L.playAgain);
    } else if (outcome === "expired") {
      this.overlayTitle.setText(L.timeUpTitle).setColor("#e8a800");
      this.overlayBody.setText(this.fmt(L.timeUpBody, { score }));
      this.overlayBg.setFillStyle(C.overlayCrash, 0.88);
      this.overlayActionLabel.setText(
        busy ? L.submitting : guest || this.gameStatus !== "dealt" ? L.backToLobby : L.settleRun,
      );
      this.overlaySecondBtn.setVisible(false);
    } else {
      this.overlayTitle.setText(L.crashTitle).setColor("#e25d4d");
      this.overlayBody.setText(this.fmt(L.crashBody, { score, target: rule.targetPipes }));
      this.overlayBg.setFillStyle(C.overlayCrash, 0.88);
      this.overlayActionLabel.setText(busy ? L.submitting : guest ? L.tryAgain : L.settleRun);
      this.overlaySecondBtn.setVisible(guest && score > 0);
      this.overlaySecondLabel.setText(L.saveScore);
    }
  }

  private onOverlayAction(): void {
    const phase  = this.localPhase;
    const status = this.gameStatus;
    const busy   = this.bool("isSubmitting");
    if (busy) return;

    if (this.lastOverlayOutcome === "expired") {
      if (status === "dealt") {
        this.playSfx("select");
        this.dispatch(this.isGuestMode() ? "expireGame" : "submitSolution", {
          pipes: this.flappyState?.score ?? 0,
        });
        this.overlayActionLabel.setText(this.labels().submitting);
      } else {
        this.showLobbyLayer();
      }
      return;
    }

    if (phase === "won") {
      // Submit the solution to the contract
      const score = this.flappyState?.score ?? 0;
      this.playSfx("select");
      this.dispatch("submitSolution", { pipes: score });
      this.overlayActionLabel.setText(this.labels().submitting);
      return;
    }

    if (phase === "crashed" && status === "dealt" && !this.isGuestMode()) {
      // A paid route is one attested run. Crashing settles that run as-is;
      // retrying the same paid session would make the local reset diverge from
      // the enclave op-log.
      const score = this.flappyState?.score ?? 0;
      this.playSfx("select");
      this.dispatch("submitSolution", { pipes: score });
      this.overlayActionLabel.setText(this.labels().submitting);
      return;
    }

    // Free practice can restart instantly with the same deterministic route.
    if (status === "dealt" && this.isGuestMode()) {
      this.restartLocalRun();
    } else {
      // Expired / solved — go back to lobby
      this.localPhase = "idle";
      this.flappyState = null;
      this.overlayContainer.setVisible(false);
      this.lastOverlayOutcome = "";
      this.showLobbyLayer();
    }
  }

  private onOverlaySecondAction(): void {
    if (!this.isGuestMode() || this.gameStatus !== "dealt" || this.bool("isSubmitting")) return;

    if (this.lastOverlayOutcome === "crashed") {
      const score = this.flappyState?.score ?? 0;
      this.playSfx("select");
      this.dispatch("submitSolution", { pipes: score });
      this.overlaySecondLabel.setText(this.labels().submitting);
      return;
    }

    // "Play Again" after a guest win — retry locally with no chain action.
    this.restartLocalRun();
  }

  private restartLocalRun(): void {
    const seed = this.str("seed", "");
    if (!seed) return;
    this.playSfx("start");
    this.flappyState = createGameState(seed, this.num("gameDifficulty", 0));
    this.flappyState.phase = "ready";
    this.localPhase = "ready";
    this.frameAccum = 0;
    this.reportTimer = 0;
    this.lastReportedScore = -1;
    this.lastScoreSfx = 0;
    this.lastOverlayOutcome = "";
    this.lastInputAt = -Infinity;
    this.overlayContainer.setVisible(false);
    this.overlaySecondBtn.setVisible(false);
    this.showReadyOverlay();
    this.updateScoreHud(0);
    this.dispatch("syncScore", { pipes: 0 });
  }


  // ── Layer visibility helpers ───────────────────────────────────────────────

  private showLobbyLayer(): void {
    this.lobbyContainer.setVisible(true);
    this.dealingContainer.setVisible(false);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(false);
    this.hudGraphics.clear();
    this.birdSprite.setVisible(false);
    this.clearPipeSprites();
    // Draw static scene behind lobby.
    this.drawSky();
    this.drawGround(0);
  }

  private showDealingLayer(): void {
    this.lobbyContainer.setVisible(false);
    this.dealingContainer.setVisible(true);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(false);
    this.birdSprite.setVisible(false);
    this.clearPipeSprites();
    this.hudGraphics.clear();
  }

  private showGameLayer(): void {
    this.lobbyContainer.setVisible(false);
    this.dealingContainer.setVisible(false);
    this.overlayContainer.setVisible(false);
    this.readyContainer.setVisible(false);
    this.scoreText.setVisible(true);
  }

  private showReadyOverlay(): void {
    this.readyContainer.setVisible(true);
    this.readyContainer.setAlpha(1);
    // Draw a static frame to show where the bird starts
    if (this.flappyState) {
      this.drawGameFrame();
    }
  }

  private hideReadyOverlay(): void {
    this.readyContainer.setVisible(false);
  }

  private startAmbientMotion(): void {
    if (!this.heroBird || !this.readyContainer) return;
    if (this.reducedMotion) {
      this.stopAmbientMotion();
      return;
    }
    this.stopAmbientMotion();

    this.tween({
      targets: this.heroBird,
      y: 166,
      angle: 5,
      duration: 760,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tween({
      targets: this.heroBirdShadow,
      scaleX: 0.82,
      alpha: 0.09,
      duration: 760,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.dealingPipes.forEach((pipe, index) => {
      this.tween({
        targets: pipe,
        alpha: 1,
        scaleY: pipe.scaleY * 1.22,
        duration: 400,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        delay: index * 80,
      });
    });
    this.tween({
      targets: this.readyContainer,
      alpha: 0.7,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopAmbientMotion(): void {
    const targets = [
      this.heroBird,
      this.heroBirdShadow,
      this.readyContainer,
      ...this.dealingPipes,
    ].filter(Boolean);
    if (targets.length > 0) this.tweens.killTweensOf(targets);

    this.heroBird?.setPosition(W / 2, 176).setAngle(-6);
    this.heroBirdShadow?.setPosition(W / 2, 214).setScale(1).setAlpha(0.16);
    this.readyContainer?.setAlpha(1).setScale(1);
    this.dealingPipes.forEach((pipe) => pipe.setDisplaySize(14, 56).setAlpha(0.62));
  }

  private cleanupScene(): void {
    this.input.off("pointerdown", this.handleTap, this);
    this.input.keyboard?.off("keydown-SPACE", this.handleTap, this);
    this.input.keyboard?.off("keydown-UP", this.handleTap, this);
    this.input.keyboard?.off("keydown-W", this.handleTap, this);
    this.stopAmbientMotion();
    this.clearPipeSprites();
  }

  private clearPipeSprites(): void {
    for (const sprites of this.pipeSprites.values()) {
      sprites.top.destroy();
      sprites.bottom.destroy();
    }
    this.pipeSprites.clear();
  }
}
