/**
 * SnakeScene — Phaser 3 scene for the Snake Bounty miniapp.
 *
 * Renders a 20×20 grid arena with:
 *  - Warm green felt background with subtle grid lines
 *  - Snake: authored head/body/tail art with directional turns and interpolation
 *  - Food: pulsing gold star at food position
 *  - Target badge (difficulty badge + target-length info) at top of grid
 *  - Timer bar + length progress bar in the HUD
 *  - Lobby: 3 difficulty route cards (idle state)
 *
 * State keys consumed (via BaseScene helpers):
 *  gameStatus   "idle"|"committed"|"dealt"|"solved"|"expired"
 *  clues        string — JSON: { body, direction, food, foodQueue }
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
 *  "startGame"       { difficulty: number }
 *  "recordMove"      { dir: number }
 *  "submitSolution"  {}
 *  "expireGame"      {}
 */

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  GRID_SIZE,
  parseInitialState,
  step,
  snakeLength,
  hasReachedTarget,
} from "../logic/snake-engine";
import type { SnakeState, Direction } from "../logic/snake-engine";
import type { Point } from "../logic/snake-engine";
import {
  DIRECTION_DEGREES,
  interpolationSource,
  snakeSegmentPose,
} from "../logic/snake-visuals";
import {
  formatClock,
  gasDisplay,
  ruleOf,
  tickMsOf,
} from "../logic/game-rules";
import type { Difficulty } from "../logic/game-rules";

// ── Layout constants ──────────────────────────────────────────────────────────

const DESIGN_W = 440;       // logical canvas width
const DESIGN_H = 580;       // logical canvas height
const SNAKE_MOVE_MS = 130;
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

type SnakeLayout = {
  cell: number;
  gridPx: number;
  gridLeft: number;
  gridTop: number;
  hudTop: number;
  controlsY: number;
  hintY: number;
  statusY: number;
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
  lobbyHeadingY: number;
  lobbyTrailY: number;
};

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  // Sunlit garden board: quiet enough for the illustrated snake and fruit to
  // remain the unmistakable foreground.
  felt:        0xe9f7dc,
  feltAlt:     0xdff1ce,
  feltBorder:  0x76ad7c,
  feltInner:   0xf7f4cf,

  // Snake
  head:        0x00b4d8,   // teal
  headStroke:  0x0096b4,
  body:        0x00af92,   // jade-teal body
  bodyDark:    0x008f76,
  tail:        0x52d9c0,

  // Food / target
  gold:        0xf4a820,
  goldLight:   0xffe066,
  star:        0xffc107,

  // HUD
  hudBg:       0xfffdf4,
  barBg:       0xd8ead6,
  timerFill:   0x00af92,
  timerLow:    0xf97066,
  lengthFill:  0x5af5d0,

  // Lobby cards
  cardBg:      0xfffdf4,
  cardBorder:  0x91bea0,
  cardActive:  0x047857,
  cardActiveBg:0xe4f8ed,
  cardActiveBorder: 0x00af92,
  cardActiveGlow:   0x62d8ba,
  cardActiveFill:   0xe4f8ed,
  white:       0xffffff,
  cream:       0xfff8e8,
  muted:       0x47705e,
  gold2:       0x9a6411,

  // Overlay
  overlay:     0xfffdf4,
  win:         0x16a34a,
  lose:        0xe25d4d,
};

// ── Difficulty label table ────────────────────────────────────────────────────

const DIFF_LABELS = ["Easy", "Medium", "Hard"] as const;
const SNAKE_ASSETS = {
  head: "snake-head",
  body: "snake-body-straight",
  tail: "snake-tail",
  food: "food-bounty",
  reward: "reward-trophy",
  target: "target-badge",
  boundary: "boundary-wall",
  badges: ["badge-easy", "badge-medium", "badge-hard"],
} as const;

type SnakeSegmentView = {
  container: Phaser.GameObjects.Container;
  primary: Phaser.GameObjects.Image;
  secondary: Phaser.GameObjects.Image;
  eyeGfx: Phaser.GameObjects.Graphics;
};

// ── Scene class ───────────────────────────────────────────────────────────────

export class SnakeScene extends BaseScene {

  // ── Layout dims (computed after scale is known) ──────────────────────────
  private scW = DESIGN_W;
  private scH = DESIGN_H;
  private layout = this.computeLayout(DESIGN_W, DESIGN_H);

  // ── Graphics layers ──────────────────────────────────────────────────────
  private backgroundGfx!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private snakeSprites:  SnakeSegmentView[] = [];
  private foodGfx!:      Phaser.GameObjects.Graphics;
  private foodSprite!:   Phaser.GameObjects.Image;
  private hudGfx!:       Phaser.GameObjects.Graphics;

  // ── HUD text ─────────────────────────────────────────────────────────────
  private timerLabel!:   Phaser.GameObjects.Text;
  private lengthLabel!:  Phaser.GameObjects.Text;
  private statusLabel!:  Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private hintLabel!:    Phaser.GameObjects.Text;
  private targetBadge!:  Phaser.GameObjects.Text;
  private targetBadgeArt!: Phaser.GameObjects.Image;

  // ── Overlay (crash / won / submitting) ───────────────────────────────────
  private overlayContainer!: Phaser.GameObjects.Container;
  private overlayBg!:        Phaser.GameObjects.Rectangle;
  private overlayTitle!:     Phaser.GameObjects.Text;
  private overlaySub!:       Phaser.GameObjects.Text;
  private overlayBtn!:       Phaser.GameObjects.Container;
  private overlayBtnBg!:     Phaser.GameObjects.Rectangle;
  private overlayBtnTxt!:    Phaser.GameObjects.Text;
  private overlayAction: (() => void) | null = null;

  // ── Lobby layer ──────────────────────────────────────────────────────────
  private lobbyContainer!:   Phaser.GameObjects.Container;
  private lobbyCards:        Phaser.GameObjects.Container[] = [];
  private lobbyStatusText!:  Phaser.GameObjects.Text;
  private lobbyStatusPill!:  Phaser.GameObjects.Graphics;
  private lobbyTitleText!:   Phaser.GameObjects.Text;
  private lobbySubText!:     Phaser.GameObjects.Text;
  private howToTitleText!:   Phaser.GameObjects.Text;
  private howToCopyText!:    Phaser.GameObjects.Text;
  private lobbyHeadingText!: Phaser.GameObjects.Text;
  private pickedDifficulty: Difficulty = 0;

  // ── Food pulse ───────────────────────────────────────────────────────────
  private foodPulse = 0;          // 0→1 oscillated by a timer
  private foodPulseTween: Phaser.Tweens.Tween | null = null;

  // ── Local snake simulation ───────────────────────────────────────────────
  private snake:           SnakeState | null = null;
  private localDir:        Direction = 1;
  private queuedDir:       Direction | null = null;
  private crashed          = false;
  private targetReached    = false;
  private timeExpired      = false;
  private boardInvalid     = false;
  private hasStartedMoving = false;

  // ── Timers ───────────────────────────────────────────────────────────────
  private tickTimer:       Phaser.Time.TimerEvent | null = null;
  private clockTimer:      Phaser.Time.TimerEvent | null = null;
  private nowMs            = Date.now();

  // ── Swipe detection ──────────────────────────────────────────────────────
  private ptrDown: { x: number; y: number } | null = null;

  // ── State cache (to detect changes) ─────────────────────────────────────
  private prevGameStatus   = "";
  private prevClues        = "";
  private prevSteerNonce   = 0;

  constructor() {
    super("SnakeScene");
  }

  private computeLayout(width: number, height: number): SnakeLayout {
    const outerPad = width < 400 ? 12 : 20;
    const maxGridByWidth = width - outerPad * 2;
    const maxGridByHeight = Math.max(260, height - 178);
    const cell = Math.max(
      14,
      Math.floor(Math.min(20, maxGridByWidth / GRID_SIZE, maxGridByHeight / GRID_SIZE)),
    );
    const gridPx = cell * GRID_SIZE;
    const gridLeft = Math.round((width - gridPx) / 2);
    const hudTop = height < 620 ? 8 : 12;
    const gridTop = hudTop + 70;
    const controlsY = gridTop + gridPx + 18;
    const hintY = controlsY + 18;

    const lobbyTitleY = Math.max(30, Math.round(height * 0.058));
    const lobbySubY = lobbyTitleY + 24;
    const lobbyPanelX = outerPad;
    const lobbyPanelY = lobbySubY + 20;
    const lobbyPanelW = width - outerPad * 2;
    // Taller "How to Play" panel closes the mid-canvas void.
    const lobbyPanelH = Math.max(200, Math.min(262, Math.round(height * 0.44)));
    const lobbyCardW = Math.min(118, Math.floor((width - outerPad * 2 - 16) / 3));
    const lobbyCardH = height < 620 ? 118 : 126;
    const lobbyCardGap = Math.max(6, Math.floor((width - outerPad * 2 - lobbyCardW * 3) / 2));
    // Route band sits near the bottom of the canvas (arcade convention).
    const lobbyCardsY = Math.max(
      lobbyPanelY + lobbyPanelH + 26,
      height - (lobbyCardH + 22),
    );
    // Section heading + status pill fill the gap between panel and cards.
    const lobbyHeadingY = lobbyPanelY + lobbyPanelH + 24;
    const lobbyStatusY = lobbyCardsY - 22;
    const lobbyTrailY = Math.round((lobbyHeadingY + lobbyStatusY) / 2);

    return {
      cell,
      gridPx,
      gridLeft,
      gridTop,
      hudTop,
      controlsY,
      hintY,
      statusY: height - 14,
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
      lobbyHeadingY,
      lobbyTrailY,
    };
  }

  // ── Localization helpers ──────────────────────────────────────────────────
  // Localized canvas strings arrive via the `sceneText` bridge payload (built
  // from t(...) in PhaserPlayArea). Fallbacks keep the scene readable before the
  // first push and satisfy source-pinned literals.

  private sceneTextMap(): Record<string, unknown> {
    const raw = this.state.sceneText;
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  }

  private txt(
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
  ): string {
    const raw = this.sceneTextMap()[key];
    let value = typeof raw === "string" && raw.length > 0 ? raw : fallback;
    if (params) {
      for (const [param, replacement] of Object.entries(params)) {
        value = value.replaceAll(`{${param}}`, String(replacement));
      }
    }
    return value;
  }

  private txtList(key: string, fallback: readonly string[]): string[] {
    const raw = this.sceneTextMap()[key];
    return Array.isArray(raw) && raw.length > 0
      ? raw.map((entry) => String(entry))
      : [...fallback];
  }

  private diffLabel(difficulty: number): string {
    const labels = this.txtList("diffLabels", DIFF_LABELS);
    return labels[difficulty] ?? DIFF_LABELS[difficulty] ?? "";
  }

  private paceLabel(difficulty: number): string {
    const labels = this.txtList("paceLabels", ["Relaxed pace", "Quick pace", "Blitz pace"]);
    return labels[difficulty] ?? labels[0] ?? "";
  }

  // Guest (free / local) mode: a plain local snake with no token, pool, wallet,
  // progression, or anti-bot gating. Reads the play-mode mirror pushed by the
  // PlayArea (bridgeState.appMode). GameFi is the default, so the frozen scene
  // contract is untouched whenever this is false.
  private isGuest(): boolean {
    return this.str("appMode", "gamefi") === "guest";
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    this.load.image(SNAKE_ASSETS.head, "./art/snake-head.webp");
    this.load.image(SNAKE_ASSETS.body, "./art/snake-body-straight.webp");
    this.load.image(SNAKE_ASSETS.tail, "./art/snake-tail.webp");
    this.load.image(SNAKE_ASSETS.food, "./art/food-bounty.webp");
    this.load.image(SNAKE_ASSETS.reward, "./art/reward-trophy.webp");
    this.load.image(SNAKE_ASSETS.target, "./art/target-badge.webp");
    this.load.image(SNAKE_ASSETS.boundary, "./art/boundary-wall.jpg");
    this.load.image(SNAKE_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(SNAKE_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(SNAKE_ASSETS.badges[2], "./art/badge-hard.webp");
  }

  create(): void {
    super.create(); // wires the bridge first

    this.scW = DESIGN_W;
    this.scH = DESIGN_H;
    this.layout = this.computeLayout(DESIGN_W, DESIGN_H);

    this.buildBackground();
    this.buildGrid();
    this.buildHUD();
    this.buildSnakeLayer();
    this.buildFoodLayer();
    this.buildTargetBadge();
    this.buildOverlay();
    this.buildLobby();
    this.buildStatusRow();
    this.fitCameraToHost();

    // Wire input (keyboard + pointer/swipe)
    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInput, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInput, this);

    // Seed from current state
    this.onStateUpdate(this.state);
  }

  // ── BaseScene abstract implementation ─────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    // Keep static localized labels in sync with the latest locale payload.
    this.refreshLocaleText();

    const gameStatus = this.str("gameStatus", "idle");
    const clues      = this.str("clues", "");
    const isDealing  = this.bool("isDealing");
    const isSubmitting = this.bool("isSubmitting");
    const lastStatus = this.str("lastStatus", "");
    const steerNonce = this.num("steerNonce", 0);

    // Status label always reflects latest
    this.statusLabel?.setText(lastStatus);

    if (steerNonce !== this.prevSteerNonce) {
      this.prevSteerNonce = steerNonce;
      const dir = this.num("steerDirection", -1);
      if (Number.isInteger(dir) && dir >= 0 && dir <= 3) this.tryQueueDirection(dir as Direction);
    }

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

    // ── Lobby vs board visibility ──────────────────────────────────────────
    const inPlay = gameStatus === "dealt" && this.snake !== null;
    this.lobbyContainer.setVisible(!inPlay && gameStatus !== "committed");
    this.gridGraphics.setVisible(inPlay);
    this.setSnakeSpritesVisible(inPlay);
    this.foodGfx.setVisible(inPlay);
    this.foodSprite.setVisible(inPlay);
    this.hudGfx.setVisible(inPlay);
    this.timerLabel.setVisible(inPlay);
    this.lengthLabel.setVisible(inPlay);
    this.controlsHint.setVisible(inPlay);
    this.targetBadge.setVisible(inPlay);
    this.targetBadgeArt.setVisible(inPlay);
    this.hintLabel.setVisible(inPlay);
    this.statusLabel.setVisible(inPlay);

    if (inPlay) {
      if (this.bool("uiPaused")) {
        this.stopTickTimer();
      } else if (
        !this.tickTimer &&
        !this.crashed &&
        !this.targetReached &&
        !this.timeExpired &&
        !this.bool("inputSyncFailed")
      ) {
        this.startTickTimer();
      }
      this.updateHUD();
      this.drawSnake();
      this.drawFood();
    }

    // ── Overlay ───────────────────────────────────────────────────────────
    if (this.bool("isRecovering")) {
      this.showOverlay(this.txt("ovRecoveringTitle", "Recovering run"), this.txt("ovRecoveringSub", "Checking the authoritative game state."));
    } else if (this.bool("inputSyncFailed") && gameStatus === "dealt") {
      this.stopTickTimer();
      this.showOverlay(this.txt("ovSyncTitle", "Run paused"), this.txt("ovSyncSub", "A move could not be verified. Recover before continuing."), {
        label: this.txt("ovRecoverBtn", "Recover run"),
        onPress: () => this.dispatch("recoverGame"),
      });
    } else if (this.boardInvalid && gameStatus === "dealt") {
      this.stopTickTimer();
      this.showOverlay(
        this.txt("ovBoardInvalidTitle", "Board unavailable"),
        this.txt("ovBoardInvalidSub", "The saved board could not be restored."),
        {
          label: this.isGuest() ? this.txt("ovPlayAgain", "Play again") : this.txt("ovRecoverBtn", "Recover run"),
          onPress: () => this.dispatch(this.isGuest() ? "expireGame" : "recoverGame"),
        },
      );
    } else if (isDealing || (gameStatus === "committed" && !inPlay)) {
      this.showOverlay(this.txt("ovDealingTitle", "Dealing"), this.txt("ovDealingSub", "Preparing your game"));
    } else if (isSubmitting) {
      this.showOverlay(this.txt("ovSubmittingTitle", "Submitting"), this.txt("ovSubmittingSub", "Verifying your solution"));
    } else if (this.timeExpired && gameStatus === "dealt") {
      this.showOverlay(this.txt("ovExpiredTitle", "Time up"), this.txt("ovExpiredSub", "This trail has ended."), {
        label: this.isGuest() ? this.txt("ovPlayAgain", "Play again") : this.txt("ovRecoverBtn", "Check run"),
        onPress: () => this.dispatch(this.isGuest() ? "expireGame" : "recoverGame"),
      });
    } else if (this.crashed && gameStatus === "dealt") {
      // Guest crashes have nothing to settle on-chain, so the button resets to a
      // local lobby (expireGame) instead of submitting a run.
      const guest = this.isGuest();
      this.showOverlay(this.txt("ovGameOverTitle", "Game Over"), this.txt("ovGameOverSub", "The snake crashed."), {
        label: guest ? this.txt("ovGameOverGuestBtn", "Play again") : this.txt("ovGameOverBtn", "Settle Run"),
        onPress: () => this.dispatch(guest ? "expireGame" : "submitSolution"),
      });
    } else if (this.targetReached && gameStatus === "dealt") {
      if (this.isGuest()) {
        this.showOverlay(
          this.txt("ovTargetTitle", "Target Reached"),
          this.txt("guestTargetResolving", "Saving your local best."),
        );
        return;
      }
      const canSubmit = this.canSubmitTarget();
      this.showOverlay(this.txt("ovTargetTitle", "Target Reached"), this.submitGateMessage(canSubmit), {
        label: canSubmit ? this.txt("ovSubmitBtn", "Submit Win") : this.txt("ovWaitingBtn", "Waiting"),
        disabled: !canSubmit,
        onPress: () => this.dispatch("submitSolution"),
      });
    } else if (gameStatus === "solved") {
      this.showOverlay(this.txt("ovSolvedTitle", "Solved"), this.txt("ovSolvedSub", "Congratulations, you won."), {
        label: this.txt("ovPlayAgain", "Play again"),
        onPress: () => this.dispatch("returnToLobby"),
      });
    } else if (gameStatus === "expired" || gameStatus === "refunded") {
      this.showOverlay(this.txt("ovExpiredTitle", "Expired"), this.txt("ovExpiredSub", "Time ran out."), {
        label: this.txt("ovPlayAgain", "Play again"),
        onPress: () => this.dispatch("returnToLobby"),
      });
    } else if (gameStatus === "unknown") {
      this.showOverlay(this.txt("ovPendingTitle", "Result pending"), this.txt("ovPendingSub", "The chain has not confirmed the final result yet."), {
        label: this.txt("ovRecoverBtn", "Check again"),
        onPress: () => this.dispatch("recoverGame"),
      });
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
    this.clearSnakeVisuals();
    try {
      this.snake = parseInitialState(clues);
      this.localDir = this.snake.direction;
      this.queuedDir = null;
      this.crashed = this.snake.dead;
      this.targetReached = hasReachedTarget(
        this.snake,
        ruleOf(this.num("gameDifficulty", 0)).targetLength,
      );
      const deadline = this.num("deadline", 0);
      this.timeExpired = deadline > 0 && Date.now() >= deadline;
      this.hasStartedMoving = false;
      this.boardInvalid = false;
    } catch {
      this.snake = null;
      this.boardInvalid = true;
      return;
    }
    if (!this.crashed && !this.targetReached && !this.timeExpired) this.startTickTimer();
    if (this.targetReached && this.isGuest()) {
      // A reload can land after the final move was persisted but before local
      // settlement cleared it. Finish that already-earned result automatically.
      this.time.delayedCall(0, () => {
        if (this.str("gameStatus", "") === "dealt" && this.targetReached) {
          this.dispatch("submitSolution");
        }
      });
    }
    this.startClockTimer();
    this.startFoodPulse();
    this.sfx.play("start");
  }

  private exitPlayPhase(): void {
    this.stopTickTimer();
    this.stopClockTimer();
    this.stopFoodPulse();
    this.clearSnakeVisuals();
    this.snake = null;
    this.crashed = false;
    this.targetReached = false;
    this.timeExpired = false;
    this.hasStartedMoving = false;
    this.boardInvalid = false;
  }

  // ── Tick timer ────────────────────────────────────────────────────────────

  private startTickTimer(): void {
    this.stopTickTimer();
    this.tickTimer = this.time.addEvent({
      delay: tickMsOf(this.num("gameDifficulty", 0)),
      loop: true,
      callback: this.onGameTick,
      callbackScope: this,
    });
  }

  private stopTickTimer(): void {
    if (this.tickTimer) {
      this.tickTimer.destroy();
      this.tickTimer = null;
    }
  }

  private onGameTick(): void {
    const gameStatus = this.str("gameStatus", "idle");
    if (
      gameStatus !== "dealt" ||
      !this.snake ||
      this.snake.dead ||
      this.targetReached ||
      this.bool("isSubmitting") ||
      this.bool("inputSyncFailed")
    ) {
      return;
    }
    // Do not let a fresh run drive itself into the wall while the player is
    // still orienting. The first keyboard, swipe, or semantic direction press
    // starts the classic continuous snake loop.
    if (!this.hasStartedMoving) return;

    if (this.num("deadline", 0) > 0 && Date.now() >= this.num("deadline", 0)) {
      this.timeExpired = true;
      this.stopTickTimer();
      this.onStateUpdate(this.state);
      return;
    }

    const previousBody = this.snake.body.map((segment) => ({ ...segment }));
    const prevEaten = this.snake.eaten;
    const dir = this.queuedDir ?? this.localDir;
    this.snake = step(this.snake, dir);
    this.localDir = dir;
    this.queuedDir = null;
    this.dispatch("recordMove", {
      dir,
      length: snakeLength(this.snake),
      dead: this.snake.dead,
    });

    if (this.snake.dead) {
      this.crashed = true;
      this.sfx.play("lose");
      this.stopTickTimer();
      this.onStateUpdate(this.state);
      this.drawSnake(previousBody);
      return;
    }

    const rule = ruleOf(this.num("gameDifficulty", 0));
    if (hasReachedTarget(this.snake, rule.targetLength)) {
      this.targetReached = true;
      this.sfx.play("combo");
      this.stopTickTimer();
      // A free arcade run resolves immediately at the target. Only paid
      // settlement needs an explicit wallet-facing confirmation step.
      if (this.isGuest()) this.dispatch("submitSolution");
      this.onStateUpdate(this.state);
    } else if (this.snake.eaten > prevEaten) {
      this.sfx.play("score");
    }

    this.drawSnake(previousBody);
    this.drawFood();
    this.updateHUD();
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
          if (this.num("deadline", 0) > 0 && this.nowMs >= this.num("deadline", 0)) {
            this.timeExpired = true;
            this.stopTickTimer();
          }
          if (this.targetReached || this.crashed || this.timeExpired) {
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

  // ── Food pulse tween ──────────────────────────────────────────────────────

  private startFoodPulse(): void {
    this.stopFoodPulse();
    this.foodPulse = 0;
    // Reduced-motion: render the food static (no infinite tween, no per-frame
    // redraw) so a core object never animates against the user's preference.
    if (this.reducedMotion) {
      this.drawFood();
      return;
    }
    this.foodPulseTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 600,
      yoyo: true,
      loop: -1,
      onUpdate: (tween) => {
        this.foodPulse = (tween.getValue() as number) / 100;
      },
    });
  }

  private stopFoodPulse(): void {
    if (this.foodPulseTween) {
      this.foodPulseTween.stop();
      this.foodPulseTween = null;
    }
    this.foodPulse = 0;
  }

  // ── Build: background ────────────────────────────────────────────────────

  private buildBackground(): void {
    this.backgroundGfx = this.add.graphics();
    this.renderResponsiveStage(DESIGN_H, DESIGN_H / 2);
  }

  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.backgroundGfx) return;
    const viewTop = centerY - visibleWorldH / 2;
    const viewBottom = centerY + visibleWorldH / 2;
    const stageTop = Math.min(0, viewTop - 10);
    const stageBottom = Math.max(DESIGN_H, Math.min(viewBottom + 10, DESIGN_H + 170));
    const stageHeight = stageBottom - stageTop;
    const gfx = this.backgroundGfx;
    gfx.clear();
    // Full canvas fill — warm, sunny garden felt.
    gfx.fillStyle(C.felt);
    gfx.fillRect(0, stageTop, this.scW, stageHeight);
    // On tall (mobile) viewports the world extends past the design height. Read
    // the overflow as more table: a plain felt continuation with a soft seam and
    // a faint alternating tint — no diagonal scratches, no stray dots.
    if (stageBottom > DESIGN_H + 20) {
      const seamY = DESIGN_H - 6;
      gfx.fillStyle(C.feltAlt, 0.35);
      gfx.fillRect(0, seamY, this.scW, stageBottom - seamY);
      gfx.lineStyle(1, C.feltInner, 0.22);
      gfx.lineBetween(14, seamY, this.scW - 14, seamY);
    }
    // Subtle inner rim for depth
    gfx.lineStyle(3, C.feltBorder, 0.6);
    gfx.strokeRoundedRect(6, 6, this.scW - 12, stageBottom - 12, 14);
  }

  // ── Build: grid ───────────────────────────────────────────────────────────

  private buildGrid(): void {
    this.gridGraphics = this.add.graphics();
    const gfx = this.gridGraphics;
    const { cell, gridLeft, gridTop, gridPx } = this.layout;

    // Grid background — lighter green
    gfx.fillStyle(C.feltInner, 1);
    gfx.fillRoundedRect(gridLeft - 2, gridTop - 2, gridPx + 4, gridPx + 4, 10);

    // Alternating cell checker pattern
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const even = (row + col) % 2 === 0;
        gfx.fillStyle(even ? C.feltAlt : C.felt, 1);
        gfx.fillRect(
          gridLeft + col * cell,
          gridTop  + row * cell,
          cell,
          cell,
        );
      }
    }

    // Grid border
    gfx.lineStyle(2, C.feltBorder, 0.8);
    gfx.strokeRoundedRect(gridLeft - 2, gridTop - 2, gridPx + 4, gridPx + 4, 10);

    this.gridGraphics.setVisible(false);
  }

  // ── Build: HUD ────────────────────────────────────────────────────────────

  private buildHUD(): void {
    this.hudGfx = this.add.graphics();
    const { gridLeft, gridPx, hudTop } = this.layout;
    // HUD panel background
    this.hudGfx.fillStyle(C.hudBg, 0.9);
    this.hudGfx.fillRoundedRect(gridLeft, hudTop, gridPx, 60, 8);
    this.hudGfx.setVisible(false);

    // Timer bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, gridPx - 16, 10, 5);

    // Length bar track
    this.hudGfx.fillStyle(C.barBg, 1);
    this.hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, gridPx - 16, 8, 4);

    // Timer clock label
    this.timerLabel = this.add.text(gridLeft + 10, hudTop + 46, "00:00", {
      fontSize: "12px",
      color: "#075f50",
      fontStyle: "bold",
    }).setOrigin(0, 0.5).setVisible(false);

    // Length label
    this.lengthLabel = this.add.text(gridLeft + gridPx / 2, hudTop + 46, "0 / 10 cells", {
      fontSize: "12px",
      color: "#86520a",
    }).setOrigin(0.5, 0.5).setVisible(false);
  }

  // ── Build: snake layer ───────────────────────────────────────────────────

  private buildSnakeLayer(): void {
    // Segment sprites are pooled lazily to match the live snake length. Clean
    // them explicitly because their movement tweens can outlive the final tick
    // when the host destroys or restarts the scene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySnakeSprites, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroySnakeSprites, this);
  }

  // ── Build: food layer ────────────────────────────────────────────────────

  private buildFoodLayer(): void {
    this.foodGfx = this.add.graphics();
    this.foodGfx.setVisible(false);
    this.foodSprite = this.add.image(0, 0, SNAKE_ASSETS.food)
      .setDisplaySize(this.layout.cell + 8, this.layout.cell + 8)
      .setVisible(false);
  }

  // ── Build: target badge ──────────────────────────────────────────────────

  private buildTargetBadge(): void {
    this.targetBadgeArt = this.add.image(
      this.layout.gridLeft + this.layout.gridPx - 102,
      this.layout.hudTop + 46,
      SNAKE_ASSETS.target,
    ).setDisplaySize(24, 24).setVisible(false);
    this.targetBadge = this.add.text(
      this.layout.gridLeft + this.layout.gridPx - 8,
      this.layout.hudTop + 46,
      "",
      {
        fontSize: "11px",
        color: "#86520a",
        fontStyle: "bold",
      },
    ).setOrigin(1, 0.5).setVisible(false);
  }

  // ── Build: status row ────────────────────────────────────────────────────

  private buildStatusRow(): void {
	    this.controlsHint = this.add.text(
      this.scW / 2,
      this.layout.controlsY,
      this.txt("controlsHint", "Arrow keys / WASD / Swipe"),
      {
        fontSize: "11px",
	        color: "#315c4b",
      },
    ).setOrigin(0.5).setVisible(false);

    this.hintLabel = this.add.text(
      this.scW / 2,
      this.layout.hintY,
      "",
      {
        fontSize: "11px",
	        color: "#9b5b0c",
        fontStyle: "bold",
        wordWrap: { width: this.layout.gridPx },
      },
    ).setOrigin(0.5).setVisible(false);

    this.statusLabel = this.add.text(
      this.scW / 2,
      this.layout.statusY,
      "",
      {
        fontSize: "10px",
	        color: "#315c4b",
      },
    ).setOrigin(0.5);
  }

  // ── Build: overlay ────────────────────────────────────────────────────────

  private buildOverlay(): void {
    this.overlayContainer = this.add.container(this.scW / 2, this.scH / 2).setDepth(200);

    this.overlayBg = this.add.rectangle(0, 0, 276, 122, C.overlay, 0.98)
      .setStrokeStyle(2, C.gold)
      .setOrigin(0.5);

    this.overlayTitle = this.add.text(0, -22, "", {
      fontSize: "24px",
      fontStyle: "bold",
      color: "#123b2d",
    }).setOrigin(0.5);

	    this.overlaySub = this.add.text(0, 12, "", {
	      fontSize: "13px",
	      color: "#47705e",
    }).setOrigin(0.5);

    this.overlayBtnBg = this.add.rectangle(0, 44, 140, 32, C.gold)
      .setStrokeStyle(1, C.goldLight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayBtnTxt = this.add.text(0, 44, this.txt("ovPlayAgain", "Play Again"), {
      fontSize: "13px",
      color: "#1a3a2b",
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
      this.overlayTitle,
      this.overlaySub,
      this.overlayBtn,
    ]);
    this.overlayContainer.setVisible(false);
  }

  private showOverlay(
    title: string,
    sub: string,
    button?: { label: string; disabled?: boolean; onPress: () => void },
  ): void {
    this.overlayTitle.setText(title);
    this.overlaySub.setText(sub);
    this.overlayAction = button && !button.disabled ? button.onPress : null;
    this.overlayBtn.setVisible(Boolean(button));
    if (button) {
      this.overlayBtnTxt.setText(button.label);
      this.overlayBtnBg
        .setFillStyle(button.disabled ? 0x627268 : C.gold)
        .setStrokeStyle(1, button.disabled ? 0x87938b : C.goldLight);
      if (this.overlayBtnBg.input) this.overlayBtnBg.input.enabled = !button.disabled;
      this.overlayBtn.setAlpha(button.disabled ? 0.68 : 1);
    }
    this.overlayContainer.setVisible(true);
    this.overlayContainer.setScale(0.8);
    // this.tween collapses to the end state instantly under reduced-motion.
    this.tween({
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

    const titleMark = this.add.image(this.scW / 2 - 96, layout.lobbyTitleY, SNAKE_ASSETS.head)
      .setDisplaySize(40, 40);

    const title = this.add.text(this.scW / 2 + 12, layout.lobbyTitleY, this.txt("title", "Snake Bounty"), {
      fontSize: "20px",
      fontStyle: "bold",
	      color: "#86520a",
    }).setOrigin(0.5);
    this.lobbyTitleText = title;

    const sub = this.add.text(this.scW / 2, layout.lobbySubY, this.txt("tagline", "Grow the snake to win GAS"), {
      fontSize: "12px",
	      color: "#315c4b",
    }).setOrigin(0.5);
    this.lobbySubText = sub;

    // "How to Play" panel — the arcade instruction board
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

    // Labels inside the panel — instructions column on the left
    const arenaTitle = this.add.text(layout.lobbyPanelX + 18, layout.lobbyPanelY + 20, this.txt("howToTitle", "How to Play"), {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#86520a",
    });
    this.howToTitleText = arenaTitle;

    const arenaCopy = this.add.text(
      layout.lobbyPanelX + 18,
      layout.lobbyPanelY + 46,
      this.txtList("howToSteps", [
        "Navigate the snake to eat food",
        "Grow to the target length",
        "Don't hit walls or yourself",
        "Submit before time runs out",
      ]).map((line) => `• ${line}`).join("\n"),
      {
        fontSize: "11px",
        color: "#315c4b",
        lineSpacing: 6,
        wordWrap: { width: Math.round(layout.lobbyPanelW * 0.54) },
      },
    );
    this.howToCopyText = arenaCopy;

    const boundaryMark = this.add.image(
      layout.lobbyPanelX + layout.lobbyPanelW - 82,
      layout.lobbyPanelY + 112,
      SNAKE_ASSETS.boundary,
    ).setDisplaySize(126, 126);

    const rewardMark = this.add.image(
      layout.lobbyPanelX + layout.lobbyPanelW - 42,
      layout.lobbyPanelY + 38,
      SNAKE_ASSETS.reward,
    ).setDisplaySize(58, 58);

    // Decorative connected mini snake chasing a bounty fruit (lower-right)
    const preview = this.buildMiniSnakePreview();
    // Section heading + trail rail bridging the panel and the route cards
    const trail = this.buildBountyTrail();

    // Difficulty cards row
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

    // Status pill — anchored just above the route cards it gates
    const statusPill = this.add.graphics();
    this.lobbyStatusPill = statusPill;
    const poolText = this.add.text(this.scW / 2, layout.lobbyStatusY, "", {
      fontSize: "11px",
	      color: "#9b5b0c",
    }).setOrigin(0.5);
    this.lobbyStatusText = poolText;

    this.lobbyContainer.add([
      titleMark,
      title,
      sub,
      arenaGfx,
      preview,
      arenaTitle,
      arenaCopy,
      boundaryMark,
      rewardMark,
      trail,
      ...this.lobbyCards,
      statusPill,
      poolText,
    ]);
  }

  // Refresh the static localized lobby labels whenever a state push arrives
  // (covers the initial empty push and any live locale change).
  private refreshLocaleText(): void {
    this.lobbyTitleText?.setText(this.txt("title", "Snake Bounty"));
    this.lobbySubText?.setText(this.txt("tagline", "Grow the snake to win GAS"));
    this.howToTitleText?.setText(this.txt("howToTitle", "How to Play"));
    this.howToCopyText?.setText(
      this.txtList("howToSteps", [
        "Navigate the snake to eat food",
        "Grow to the target length",
        "Don't hit walls or yourself",
        "Submit before time runs out",
      ]).map((line) => `• ${line}`).join("\n"),
    );
    this.lobbyHeadingText?.setText(this.txt("chooseRoute", "Choose your bounty route"));
    this.controlsHint?.setText(this.txt("controlsHint", "Arrow keys / WASD / Swipe"));
  }

  private buildMiniSnakePreview(): Phaser.GameObjects.Container {
    const preview = this.add.container(0, 0);
    const { lobbyPanelX, lobbyPanelY, lobbyPanelW, lobbyPanelH } = this.layout;
    // A single continuous snake (tail → body → body → head) chasing a gold
    // bounty fruit, seated in the lower-right of the instruction panel.
    const headX = lobbyPanelX + lobbyPanelW - 66;
    const midY  = lobbyPanelY + lobbyPanelH - 46;
    const pieces: Array<{
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      angle?: number;
    }> = [
      // Tail: rotated so its taper points left and the thick end butts the body.
      { key: SNAKE_ASSETS.tail, x: headX - 74, y: midY, width: 34, height: 30, angle: -45 },
      { key: SNAKE_ASSETS.body, x: headX - 48, y: midY, width: 30, height: 24 },
      { key: SNAKE_ASSETS.body, x: headX - 26, y: midY, width: 30, height: 24 },
      { key: SNAKE_ASSETS.head, x: headX,      y: midY - 3, width: 46, height: 46 },
      { key: SNAKE_ASSETS.food, x: headX + 34, y: midY,     width: 30, height: 30 },
    ];

    // Add body/tail first, then the head on top so overlaps read as one snake.
    for (const piece of pieces) {
      preview.add(
        this.add.image(piece.x, piece.y, piece.key)
          .setDisplaySize(piece.width, piece.height)
          .setAngle(piece.angle ?? 0),
      );
    }

    return preview;
  }

  private buildBountyTrail(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const { lobbyHeadingY, lobbyTrailY } = this.layout;

    const heading = this.add.text(
      this.scW / 2,
      lobbyHeadingY,
      this.txt("chooseRoute", "Choose your bounty route"),
      { fontSize: "13px", fontStyle: "bold", color: "#86520a" },
    ).setOrigin(0.5);
    this.lobbyHeadingText = heading;

    // A short bounty-trail rail: a teal snake node, a dashed path, and a gold
    // bounty node — an intentional bridge to the route cards below.
    const gfx = this.add.graphics();
    const laneW = Math.min(300, this.scW - 96);
    const laneX = (this.scW - laneW) / 2;
    const y = lobbyTrailY;
    gfx.fillStyle(C.cardBg, 0.55);
    gfx.fillRoundedRect(laneX, y - 5, laneW, 10, 5);
    gfx.lineStyle(1, C.cardBorder, 0.5);
    gfx.strokeRoundedRect(laneX, y - 5, laneW, 10, 5);
    const dashN = 7;
    gfx.fillStyle(C.lengthFill, 0.65);
    for (let i = 0; i < dashN; i++) {
      const dx = laneX + 18 + (laneW - 36) * (i / (dashN - 1));
      gfx.fillCircle(dx, y, 1.6);
    }
    // Real authored endpoints make the route read as game resources, not dots.
    const snakeNode = this.add.image(laneX + 10, y, SNAKE_ASSETS.head)
      .setDisplaySize(27, 27);
    const targetNode = this.add.image(laneX + laneW - 10, y, SNAKE_ASSETS.target)
      .setDisplaySize(25, 25);

    container.add([gfx, heading, snakeNode, targetNode]);
    return container;
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

    // Soft halo behind the card — only shown for the selected route.
    const glow = this.add.rectangle(0, 0, cardW + 12, cardH + 12, C.cardActiveGlow, 0.22)
      .setOrigin(0.5)
      .setVisible(false);

    const bg = this.add.rectangle(0, 0, cardW, cardH, C.cardBg)
      .setStrokeStyle(2, C.cardBorder)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const badge = this.add.image(0, -42, SNAKE_ASSETS.badges[difficulty])
      .setDisplaySize(40, 40);

    const label = this.add.text(0, -15, this.diffLabel(difficulty), {
      fontSize: "13px",
      fontStyle: "bold",
      color: "#86520a",
    }).setOrigin(0.5);

    const targetTxt = this.add.text(0, 3, this.txt("targetCells", "{target} cells", { target: rule.targetLength }), {
      fontSize: "10px",
      color: "#315c4b",
    }).setOrigin(0.5);

    // Win reward is the payoff anchor — bright gold, prominent.
    const winTxt = this.add.text(
      0,
      21,
      this.isGuest()
        ? this.paceLabel(difficulty)
        : this.txt("winLine", "Win {amount} GAS", { amount: gasDisplay(rule.rewardFixed8) }),
      {
      fontSize: "12px",
      fontStyle: "bold",
      color: "#86520a",
      },
    ).setOrigin(0.5);

    // Entry cost is secondary — muted so it never reads as the prize.
    const entryTxt = this.add.text(0, 39, this.txt("entryLine", "Entry {amount} GAS", { amount: gasDisplay(rule.entryFixed8) }), {
      fontSize: "10px",
      color: "#47705e",
    }).setOrigin(0.5);

    const lockTxt = this.add.text(0, 39, this.txt("cleared", "Cleared"), {
      fontSize: "10px",
      color: "#8a570d",
      fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);

    container.add([glow, bg, badge, label, targetTxt, winTxt, entryTxt, lockTxt]);
    container.setData("difficulty", difficulty);
    container.setData("glow", glow);
    container.setData("bg", bg);
    container.setData("badge", badge);
    container.setData("label", label);
    container.setData("target", targetTxt);
    container.setData("win", winTxt);
    container.setData("entry", entryTxt);
    container.setData("lock", lockTxt);

    bg.on("pointerdown", () => {
      this.sfx.unlock();
      if (this.isDifficultyLocked(difficulty)) return;
      this.sfx.play("tap");
      this.pickedDifficulty = difficulty;
      this.dispatch("selectDifficulty", { difficulty });
      this.updateLobbyCards();
      this.pressFeedback(container, { scale: 0.94, duration: 80 });
      if (this.canStartDifficulty(difficulty)) {
        this.dispatch("startGame", { difficulty });
      }
    });
    bg.on("pointerover", () => {
      if (!this.isDifficultyLocked(difficulty) && difficulty !== this.pickedDifficulty) {
        bg.setStrokeStyle(2, C.muted);
      }
    });
    bg.on("pointerout", () => {
      this.updateLobbyCards();
    });

    return container;
  }

  private updateLobbyCards(): void {
    this.ensureSelectableDifficulty();
    for (let i = 0; i < this.lobbyCards.length; i++) {
      const card     = this.lobbyCards[i]!;
      const glow     = card.getData("glow") as Phaser.GameObjects.Rectangle;
      const bg       = card.getData("bg") as Phaser.GameObjects.Rectangle;
      const badge    = card.getData("badge") as Phaser.GameObjects.Image;
      const label    = card.getData("label") as Phaser.GameObjects.Text;
      const target   = card.getData("target") as Phaser.GameObjects.Text;
      const win      = card.getData("win") as Phaser.GameObjects.Text;
      const entry    = card.getData("entry") as Phaser.GameObjects.Text;
      const lock     = card.getData("lock") as Phaser.GameObjects.Text;
      const rule     = ruleOf(i as Difficulty);
      const locked   = this.isDifficultyLocked(i as Difficulty);
      const isActive = i === this.pickedDifficulty && !locked;

      glow.setVisible(isActive);
      bg.setFillStyle(locked ? 0xedf2e8 : isActive ? C.cardActiveFill : C.cardBg);
      bg.setStrokeStyle(
        isActive ? 3 : 2,
        locked ? 0xaebbac : isActive ? C.cardActiveBorder : C.cardBorder,
      );
      // setDisplaySize (not setScale) — the badge textures are 384px; setScale
      // would discard the makeCard display sizing and render them full-size.
      badge.setDisplaySize(isActive ? 44 : 40, isActive ? 44 : 40);

      label.setText(this.diffLabel(i));
      label.setColor(locked ? "#718075" : "#86520a");
      target.setText(this.txt("targetCells", "{target} cells", { target: rule.targetLength }));
      target.setColor(locked ? "#718075" : "#315c4b");
      // Win reward stays the visual anchor; entry is demoted / hidden when locked.
      win.setText(
        this.isGuest()
          ? this.paceLabel(i)
          : this.txt("winLine", "Win {amount} GAS", { amount: gasDisplay(rule.rewardFixed8) }),
      );
      win.setColor(locked ? "#718075" : "#86520a");
      win.setVisible(!locked);
      entry.setText(this.txt("entryLine", "Entry {amount} GAS", { amount: gasDisplay(rule.entryFixed8) }));
      entry.setColor("#47705e");
      entry.setVisible(!locked);
      lock.setText(this.txt("completed", "Completed"));
      lock.setVisible(locked);
      card.setAlpha(locked ? 0.6 : 1);
      if (bg.input) bg.input.enabled = !locked && this.str("gameStatus", "idle") === "idle";
    }
    this.updateLobbyStatus();
  }

  private updateLobbyStatus(): void {
    // Guest has no wallet / pool / progression gating — one local-run status line.
    if (this.isGuest()) {
      if (!this.lobbyStatusText) return;
      this.lobbyStatusText.setText(this.txt("guestLobbyStatus", "Tap a trail to start a local run"));
      this.lobbyStatusText.setColor("#075f50");
      this.drawStatusPill();
      return;
    }
    const poolFree = this.num("poolFree", 0);
    const rule     = ruleOf(this.pickedDifficulty);
    const needed   = Number(gasDisplay(rule.rewardFixed8));
    const progressionReady = this.bool("progressionReady");
    const locked   = this.isDifficultyLocked(this.pickedDifficulty);
    const walletConnected = this.bool("walletConnected");
    const busy     = this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting");
    const ready    = this.canStartDifficulty(this.pickedDifficulty);
    if (!this.lobbyStatusText) return;

    const reward  = gasDisplay(rule.rewardFixed8);
    const time    = Math.round(rule.limitMs / 60000);
    const statusText = busy
      ? this.txt("lobbyPreparing", "Preparing your bounty route")
      : !this.bool("newPaidRunsEnabled")
        ? this.txt("paidModeLocked", "Free play is open while paid runs finish validation.")
      : !walletConnected
        ? this.txt("lobbyConnectWallet", "Connect wallet to start a bounty route")
        : !progressionReady
          ? this.txt("lobbyCheckingHistory", "Checking account route history")
          : locked
            ? this.txt("lobbyRouteCleared", "Route cleared. Play {difficulty} next.", {
                difficulty: this.routeName(this.requiredDifficulty()),
              })
            : ready
              ? this.txt("lobbyTapToStart", "Tap a route to start  ·  Win {amount} GAS  ·  {minutes} min", {
                  amount: reward,
                  minutes: time,
                })
              : this.txt("lobbyPoolLow", "Pool low ({pool} / {needed} GAS reward needed)", {
                  pool: poolFree.toFixed(2),
                  needed,
                });
    this.lobbyStatusText.setText(statusText);
    this.lobbyStatusText.setColor(ready ? "#075f50" : "#9b5b0c");
    this.drawStatusPill();
  }

  private drawStatusPill(): void {
    if (!this.lobbyStatusPill || !this.lobbyStatusText) return;
    const gfx = this.lobbyStatusPill;
    gfx.clear();
    const text = this.lobbyStatusText;
    if (!text.text) return;
    const w = Math.min(this.scW - 32, text.width + 30);
    const h = 24;
    const x = this.scW / 2 - w / 2;
    const y = this.layout.lobbyStatusY - h / 2;
    gfx.fillStyle(C.hudBg, 0.82);
    gfx.fillRoundedRect(x, y, w, h, h / 2);
    gfx.lineStyle(1, C.cardBorder, 0.55);
    gfx.strokeRoundedRect(x, y, w, h, h / 2);
  }

  private requiredDifficulty(): Difficulty {
    return Math.max(0, Math.min(2, this.num("progressionRequiredDifficulty", 0))) as Difficulty;
  }

  private routeName(difficulty: Difficulty): string {
    return this.diffLabel(difficulty) || DIFF_LABELS[difficulty] || "next route";
  }

  private isDifficultyLocked(difficulty: Difficulty): boolean {
    if (this.isGuest()) return false;   // no route progression in local play
    return this.bool("progressionReady") && difficulty < this.requiredDifficulty();
  }

  private ensureSelectableDifficulty(): void {
    if (this.isDifficultyLocked(this.pickedDifficulty)) {
      this.pickedDifficulty = this.requiredDifficulty();
    }
  }

  private canStartDifficulty(difficulty: Difficulty): boolean {
    if (this.bool("isStarting") || this.bool("isDealing") || this.bool("isSubmitting")) return false;
    if (this.str("gameStatus", "idle") !== "idle") return false;
    // Guest is a free local snake: no wallet, no reward pool, no progression gate.
    if (this.isGuest()) return true;
    if (!this.bool("newPaidRunsEnabled")) return false;
    if (!this.bool("walletConnected")) return false;
    if (!this.bool("progressionReady")) return false;
    if (this.isDifficultyLocked(difficulty)) return false;
    const poolFree = this.num("poolFree", 0);
    const rule = ruleOf(difficulty);
    return poolFree >= Number(gasDisplay(rule.rewardFixed8));
  }

  private canSubmitTarget(): boolean {
    if (!this.targetReached || this.str("gameStatus", "") !== "dealt") return false;
    if (this.bool("isSubmitting")) return false;
    // Guest has no reward at stake, so no anti-bot floor / deadline buffer gate.
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
    if (canSubmit) return this.txt("gateSubmitReady", "Submit for GAS before time runs out.");
    const deadline = this.num("deadline", 0);
    const dealtAt = this.num("dealtAt", 0);
    const difficulty = this.num("gameDifficulty", 0);
    const rule = ruleOf(difficulty as Difficulty);
    const remainingMs = deadline > 0 ? deadline - this.nowMs : Number.POSITIVE_INFINITY;
    if (remainingMs <= SUBMIT_BUFFER_MS) return this.txt("gateTooClose", "Too close to the deadline.");
    if (dealtAt <= 0) return this.txt("gateUnlockChecking", "Settlement unlock is being checked.");
    const waitMs = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - (this.nowMs - dealtAt);
    return this.txt("gateUnlockIn", "Settlement unlocks in {clock}.", { clock: formatClock(waitMs) });
  }

  // ── Draw: snake ───────────────────────────────────────────────────────────

  private drawSnake(previousBody: readonly Point[] = []): void {
    if (!this.snake) {
      this.setSnakeSpritesVisible(false);
      return;
    }

    const body = this.snake.body;
    const { cell, gridLeft, gridTop } = this.layout;
    this.ensureSnakeSpriteCount(body.length);

    body.forEach((segment, index) => {
      const view = this.snakeSprites[index]!;
      const pose = snakeSegmentPose(body, index, this.localDir);
      const targetX = gridLeft + segment.x * cell + cell / 2;
      const targetY = gridTop + segment.y * cell + cell / 2;
      const fromPoint = interpolationSource(previousBody, index);

      this.configureSnakeSegment(view, pose, cell, index, body.length);
      view.container.setVisible(true);

      if (this.reducedMotion) {
        this.tweens.killTweensOf(view.container);
        view.container.setPosition(targetX, targetY);
      } else if (fromPoint) {
        this.tweens.killTweensOf(view.container);
        view.container.setPosition(
          gridLeft + fromPoint.x * cell + cell / 2,
          gridTop + fromPoint.y * cell + cell / 2,
        );
        this.animate({
          targets: view.container,
          x: targetX,
          y: targetY,
          duration: SNAKE_MOVE_MS,
          ease: "Sine.easeOut",
        });
      } else if (!this.tweens.isTweening(view.container)) {
        // React state pushes can arrive between authoritative ticks. Keep an
        // in-flight render tween intact; otherwise place a fresh/static sprite
        // directly on the current logical cell.
        view.container.setPosition(targetX, targetY);
      }
    });

    for (let index = body.length; index < this.snakeSprites.length; index += 1) {
      const view = this.snakeSprites[index]!;
      this.tweens.killTweensOf(view.container);
      view.container.setVisible(false);
    }
  }

  private ensureSnakeSpriteCount(count: number): void {
    while (this.snakeSprites.length < count) {
      const primary = this.add.image(0, 0, SNAKE_ASSETS.body).setOrigin(0.5);
      const secondary = this.add.image(0, 0, SNAKE_ASSETS.body).setOrigin(0.5).setVisible(false);
      const eyeGfx = this.add.graphics().setVisible(false);
      const container = this.add.container(0, 0, [primary, secondary, eyeGfx]).setVisible(false);
      this.snakeSprites.push({ container, primary, secondary, eyeGfx });
    }
  }

  private configureSnakeSegment(
    view: SnakeSegmentView,
    pose: ReturnType<typeof snakeSegmentPose>,
    cell: number,
    index: number,
    bodyLength: number,
  ): void {
    const crashed = this.crashed || Boolean(this.snake?.dead);
    view.container.setDepth(30 + bodyLength - index).setAlpha(crashed ? 0.72 : 1);
    view.primary.clearTint().setPosition(0, 0).setVisible(true);
    view.secondary.clearTint().setPosition(0, 0).setVisible(false);
    view.eyeGfx.clear().setVisible(false);

    if (pose.role === "head") {
      view.primary
        .setTexture(SNAKE_ASSETS.head)
        .setDisplaySize(cell * 2.05, cell * 2.05)
        .setAngle(DIRECTION_DEGREES[this.localDir]);
      // Direction-aware eyes so the head reads clearly (audit P3: distinguish head).
      // eyeGfx is rotated with the head; local +x is the forward axis.
      view.eyeGfx.setAngle(DIRECTION_DEGREES[this.localDir] ?? 0).setVisible(true);
      const fwd = cell * 0.5, side = cell * 0.4, r = cell * 0.2;
      for (const s of [-1, 1]) {
        const ly = side * s;
        view.eyeGfx.fillStyle(0xffffff, 1).fillCircle(fwd, ly, r);
        view.eyeGfx.fillStyle(0x14241a, 1).fillCircle(fwd + r * 0.45, ly, r * 0.5);
      }
    } else if (pose.role === "tail") {
      view.primary
        .setTexture(SNAKE_ASSETS.tail)
        .setDisplaySize(cell * 1.9, cell * 1.9)
        .setAngle(pose.angle);
    } else if (pose.turnAngles) {
      // Two short body-art branches make a visible elbow and keep both joins
      // aligned to their neighbouring grid cells. The overlap is intentional:
      // transparent padding and scale artwork blend at the turn centre.
      const branchOffset = cell * 0.16;
      const branchSize = cell * 1.45;
      const [firstAngle, secondAngle] = pose.turnAngles;
      this.configureTurnBranch(view.primary, firstAngle, branchOffset, branchSize);
      this.configureTurnBranch(view.secondary, secondAngle, branchOffset, branchSize);
      view.secondary.setVisible(true);
    } else {
      view.primary
        .setTexture(SNAKE_ASSETS.body)
        .setDisplaySize(cell * 1.75, cell * 1.75)
        .setAngle(pose.angle);
    }

    if (crashed) {
      view.primary.setTint(0xff8b7a);
      view.secondary.setTint(0xff8b7a);
    }
  }

  private configureTurnBranch(
    image: Phaser.GameObjects.Image,
    angle: number,
    offset: number,
    size: number,
  ): void {
    const radians = Phaser.Math.DegToRad(angle);
    image
      .setTexture(SNAKE_ASSETS.body)
      .setDisplaySize(size, size)
      .setAngle(angle)
      .setPosition(Math.cos(radians) * offset, Math.sin(radians) * offset);
  }

  private setSnakeSpritesVisible(visible: boolean): void {
    this.snakeSprites.forEach((view) => view.container.setVisible(visible));
  }

  private clearSnakeVisuals(): void {
    this.snakeSprites.forEach((view) => {
      this.tweens.killTweensOf(view.container);
      view.container.setVisible(false).setAlpha(1);
    });
  }

  private destroySnakeSprites(): void {
    this.snakeSprites.forEach((view) => {
      this.tweens?.killTweensOf(view.container);
      if (view.container.active) view.container.destroy(true);
    });
    this.snakeSprites = [];
  }

  // ── Draw: food ────────────────────────────────────────────────────────────

  private drawFood(): void {
    if (!this.snake) return;
    const gfx   = this.foodGfx;
    const food  = this.snake.food;
    const { cell, gridLeft, gridTop } = this.layout;
    const scale = 1 + this.foodPulse * 0.18;
    const px    = gridLeft + food.x * cell + cell / 2;
    const py    = gridTop  + food.y * cell + cell / 2;
    const r     = (cell / 2 - 1) * scale;
    gfx.clear();
    // Outer glow
    gfx.fillStyle(C.goldLight, 0.25 + this.foodPulse * 0.15);
    gfx.fillCircle(px, py, r + 3);
    this.foodSprite
      .setPosition(px, py)
      .setDisplaySize((cell + 8) * scale, (cell + 8) * scale)
      .setVisible(true);
  }

  // ── HUD update ────────────────────────────────────────────────────────────

  private updateHUD(): void {
    const gameStatus   = this.str("gameStatus", "idle");
    const deadline     = this.num("deadline", 0);
    const dealtAt      = this.num("dealtAt", 0);
    const difficulty   = this.num("gameDifficulty", 0);
    const rule         = ruleOf(difficulty as Difficulty);

    const remainingMs  = deadline > 0 ? deadline - this.nowMs : 0;
    const totalMs      = deadline > 0 && dealtAt > 0 ? deadline - dealtAt : rule.limitMs;
    const timePct      = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
    const currentLen   = this.snake ? snakeLength(this.snake) : 0;
    const lengthPct    = Math.min(1, currentLen / rule.targetLength);
    const isLow        = remainingMs < 60_000 && remainingMs > 0;

    // Redraw HUD bars
    const hudGfx = this.hudGfx;
    const { gridLeft, gridPx, hudTop } = this.layout;
    hudGfx.clear();
    // Panel
    hudGfx.fillStyle(C.hudBg, 0.9);
    hudGfx.fillRoundedRect(gridLeft, hudTop, gridPx, 60, 8);
    // Timer bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, gridPx - 16, 10, 5);
    // Timer bar fill
    if (timePct > 0) {
      const fillW = Math.max(4, (gridPx - 16) * timePct);
      hudGfx.fillStyle(isLow ? C.timerLow : C.timerFill, 1);
      hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 10, fillW, 10, 5);
    }
    // Length bar track
    hudGfx.fillStyle(C.barBg, 1);
    hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, gridPx - 16, 8, 4);
    // Length bar fill
    if (lengthPct > 0) {
      const fillW = Math.max(4, (gridPx - 16) * lengthPct);
      hudGfx.fillStyle(this.targetReached ? C.win : C.lengthFill, 1);
      hudGfx.fillRoundedRect(gridLeft + 8, hudTop + 30, fillW, 8, 4);
    }

    // Timer label
    this.timerLabel.setText(formatClock(Math.max(0, remainingMs)));
    this.timerLabel.setColor(isLow ? "#b53b32" : "#075f50");

    // Length label
    this.lengthLabel.setText(this.txt("lengthReadout", "{len} / {target} cells", {
      len: currentLen,
      target: rule.targetLength,
    }));
    this.lengthLabel.setColor(this.targetReached ? "#075f50" : "#86520a");

    // Target badge
    const reward = gasDisplay(rule.rewardFixed8);
    this.targetBadge.setText(this.txt("rewardBadge", "{amount} GAS reward", { amount: reward }));

    // Hint label
    const elapsedMs = dealtAt > 0 ? this.nowMs - dealtAt : 0;
    // Guest has no anti-bot floor, so the settlement unlock is always reached.
    const minSolveReached = this.isGuest() || (dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS);
    const timeUp    = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
    const submitWindowClosed = gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;

    if (!this.hasStartedMoving) {
      this.hintLabel.setText(this.txt("hintStartMoving", "Choose a direction to begin.")).setVisible(true);
    } else if (this.crashed || (this.snake && this.snake.dead)) {
      this.hintLabel.setText(this.txt("hintCrashed", "Snake crashed.")).setVisible(true);
    } else if (timeUp) {
      this.hintLabel.setText(this.txt("hintTimeUp", "Time's up.")).setVisible(true);
    } else if (submitWindowClosed && !timeUp) {
      this.hintLabel.setText(this.txt("hintClosingSoon", "Closing soon — submit now!")).setVisible(true);
    } else if (this.targetReached && !minSolveReached) {
      const wait = rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs;
      this.hintLabel.setText(this.txt("hintWaitSubmit", "Wait {clock} to submit", { clock: formatClock(wait) })).setVisible(true);
    } else if (this.targetReached && minSolveReached) {
      this.hintLabel.setText(this.txt("hintTargetSubmit", "Target reached. Submit now.")).setVisible(true);
    } else {
      this.hintLabel.setText("").setVisible(true);
    }
  }

  // ── Input: keyboard ───────────────────────────────────────────────────────

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.sfx.unlock();
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("button, input, select, textarea, a[href], [role='dialog']")
    ) return;
    const gameStatus = this.str("gameStatus", "");
    if (gameStatus === "idle") {
      if (["ArrowLeft", "a", "A"].includes(event.key)) {
        event.preventDefault();
        const next = Math.max(0, this.pickedDifficulty - 1) as Difficulty;
        if (!this.isDifficultyLocked(next) && next !== this.pickedDifficulty) {
          this.pickedDifficulty = next;
          this.dispatch("selectDifficulty", { difficulty: this.pickedDifficulty });
          this.updateLobbyCards();
          this.sfx.play("move");
        }
      } else if (["ArrowRight", "d", "D"].includes(event.key)) {
        event.preventDefault();
        const next = Math.min(2, this.pickedDifficulty + 1) as Difficulty;
        if (!this.isDifficultyLocked(next) && next !== this.pickedDifficulty) {
          this.pickedDifficulty = next;
          this.dispatch("selectDifficulty", { difficulty: this.pickedDifficulty });
          this.updateLobbyCards();
          this.sfx.play("move");
        }
      } else if (["Enter", " "].includes(event.key) && this.canStartDifficulty(this.pickedDifficulty)) {
        event.preventDefault();
        this.sfx.play("tap");
        this.dispatch("startGame", { difficulty: this.pickedDifficulty });
      }
      return;
    }
    if (gameStatus !== "dealt") return;
    const map: Record<string, Direction> = {
      ArrowUp: 0, w: 0, W: 0,
      ArrowRight: 1, d: 1, D: 1,
      ArrowDown: 2, s: 2, S: 2,
      ArrowLeft: 3, a: 3, A: 3,
    };
    const dir = map[event.key];
    if (dir !== undefined) {
      event.preventDefault?.();
      this.tryQueueDirection(dir);
    }
  };

  private readonly onPointerDown = (ptr: Phaser.Input.Pointer): void => {
    this.sfx.unlock();
    this.ptrDown = { x: ptr.x, y: ptr.y };
  };

  private readonly onPointerUp = (ptr: Phaser.Input.Pointer): void => {
    if (!this.ptrDown || this.str("gameStatus", "") !== "dealt") {
      this.ptrDown = null;
      return;
    }
    const dx = ptr.x - this.ptrDown.x;
    const dy = ptr.y - this.ptrDown.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) >= 24) {
      this.tryQueueDirection(absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
    this.ptrDown = null;
  };

  private setupInput(): void {
    if (this.input.keyboard) {
      this.input.keyboard.on("keydown", this.onKeyDown);
    }
    this.input.on("pointerdown", this.onPointerDown);
    this.input.on("pointerup", this.onPointerUp);
  }

  private cleanupInput(): void {
    this.input.keyboard?.off("keydown", this.onKeyDown);
    this.input.off("pointerdown", this.onPointerDown);
    this.input.off("pointerup", this.onPointerUp);
    this.ptrDown = null;
  }

  protected onReducedMotionChange(enabled: boolean): void {
    this.snakeSprites.forEach((view) => this.tweens.killTweensOf(view.container));
    this.stopFoodPulse();
    if (enabled) {
      this.drawFood();
    } else if (this.str("gameStatus", "") === "dealt" && this.snake && !this.snake.dead) {
      this.startFoodPulse();
    }
  }

  private tryQueueDirection(dir: Direction): void {
    if (!this.snake || this.snake.dead || this.targetReached) return;
    if (this.bool("isSubmitting")) return;

    // Prevent 180° reversal
    const opposite: Record<Direction, Direction> = { 0: 2, 1: 3, 2: 0, 3: 1 };
    if (dir === opposite[this.localDir] && snakeLength(this.snake) > 1) return;

    // Short cue only on an actual direction change (not repeats of the current heading)
    if (dir !== (this.queuedDir ?? this.localDir)) {
      this.sfx.play("move");
    }
    this.hasStartedMoving = true;
    this.queuedDir = dir;
  }

  // ── Responsive resize ─────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.42;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
  }

  // ── update (Phaser frame loop) ────────────────────────────────────────────

  update(_time: number, _delta: number): void {
    // Food pulse is driven by a tween counter; redraw food every frame only when
    // in play to keep the animation smooth. Under reduced-motion the food is
    // static, so skip the per-frame redraw entirely.
    if (this.reducedMotion) return;
    if (
      this.str("gameStatus", "") === "dealt" &&
      this.snake &&
      !this.snake.dead &&
      !this.crashed
    ) {
      this.drawFood();
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  override destroy(fromScene = false): void {
    this.stopTickTimer();
    this.stopClockTimer();
    this.stopFoodPulse();
    this.cleanupInput();
    super.destroy(fromScene);
  }
}
