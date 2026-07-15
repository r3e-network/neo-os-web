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
import {
  canReleaseExpiredGame,
  cueTimingOf,
  DIFFICULTY_RULES,
  formatClock,
  releaseAtOf,
  SETTLEMENT_GRACE_MS,
} from "../logic/game-rules";
import {
  hasColorDeadlinePassed,
  normalizeColorSequence,
  type ColorUiPhase,
} from "../logic/color-engine";

// ── Palette ────────────────────────────────────────────────────────────────────
const PAD_LIT   = [0xf87171, 0x60a5fa, 0x4ade80, 0xfcd34d] as const; // lit states
const PAD_GLOW  = [0xff9999, 0x93c5fd, 0x86efac, 0xfde68a] as const; // glow halos
const BOARD_BG  = 0xf4ead6;
const BOARD_RIM = 0xb9873c;
const CENTER_BG = 0x3a2f23;
const CENTER_CORE = 0x241a12; // warm near-black knob core (unlit hub center)
const DOT_UNLIT   = 0xcabfa8; // warm stone for unlit progress dots
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
const MODE_LABEL_KEYS = ["modeEasy", "modeMedium", "modeHard"] as const;
const MODE_TARGET_KEYS = ["modeEasyTarget", "modeMediumTarget", "modeHardTarget"] as const;
const COLOR_LABEL_KEYS = ["colorRed", "colorBlue", "colorGreen", "colorYellow"] as const;

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

type PrimaryAction = "startGame" | "retryDeal" | "submitSolution" | "checkSettlement" | "expireGame";
type PrimaryActionState = {
  action: PrimaryAction;
  busy?: boolean;
  enabled: boolean;
  label: string;
} | null;
type PrimaryActionContext = {
  completedSequence: boolean;
  dealPending: boolean;
  isDealing: boolean;
  isGuest: boolean;
  isLobby: boolean;
  isStarting: boolean;
  isSubmitting: boolean;
  isRecovering: boolean;
  releaseReady: boolean;
  settlementPending: boolean;
  timeUp: boolean;
  wrong: boolean;
};

// Authored cabinet layout: red=top-left, blue=top-right,
// green=bottom-left, yellow=bottom-right.
const PAD_CENTER_DEGREES = [225, 315, 135, 45] as const;
export class ColorClashScene extends BaseScene {
  private sceneReady = false;
  private isRebuildingScene = false;
  private scW = 420;
  private scH = 580;

  private padGraphics: Phaser.GameObjects.Graphics[] = [];
  private padGlows: Phaser.GameObjects.Ellipse[] = [];
  private padButtons: Phaser.GameObjects.Container[] = [];
  private padButtonImages: Phaser.GameObjects.Image[] = [];
  private padButtonGlows: Phaser.GameObjects.Ellipse[] = [];

  private roundLabel!: Phaser.GameObjects.Text;
  private timerLabel!: Phaser.GameObjects.Text;
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
  private gameplayTimers = new Set<Phaser.Time.TimerEvent>();
  private lastSequenceLen = 0;
  private lastPlaybackKey = "";
  private playbackActive = false;
  private pressLocked = false;
  private pressUnlockAt = 0;
  private actionLocked = false;
  private expirationDispatched = false;
  private lastTimerPaintAt = Number.NEGATIVE_INFINITY;
  private selectedDifficulty = 0;
  private currentDifficulty = 0;
  private currentStatus = "idle";
  private currentSequence = "";
  private currentPlayer = "";
  private currentLastStatus = "";
  private currentRoundPhase: ColorUiPhase = "lobby";
  private currentIsGuest = false;
  private deadline = 0;
  private dealtAt = 0;
  private settlementGraceMs = SETTLEMENT_GRACE_MS;
  private primaryAction: PrimaryAction = "startGame";
  private primaryActionEnabled = true;
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
    this.input.keyboard?.on("keydown", this.handleKeyboardInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupGameplay, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupGameplay, this);
    this.syncSceneSize();
    this.rebuildScene();
    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  update(time: number): void {
    if (this.currentStatus !== "dealt" || time - this.lastTimerPaintAt < 100) return;
    this.lastTimerPaintAt = time;
    this.updateTimer();
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
    this.clearGameplayTimers();
    this.playbackActive = false;
    this.pressLocked = this.bool("isPressing");
    this.pressUnlockAt = 0;
    this.actionLocked = this.bool("isStarting")
      || this.bool("isDealing")
      || this.bool("isSubmitting")
      || this.bool("isRecovering");
    this.tweens.killAll();
    this.children.removeAll(true);

    this.padGraphics = [];
    this.padGlows = [];
    this.padButtons = [];
    this.padButtonImages = [];
    this.padButtonGlows = [];
    this.modeCards = [];
    this.progressDots = [];
    this.flashIndex = -1;
    this.lastSequenceLen = 0;
    this.lastPlaybackKey = "";

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
    const roundNum   = Math.max(0, this.num("roundNumber", sequence.length));
    const difficulty = this.num("gameDifficulty", this.selectedDifficulty);
    const selectedDifficulty = this.num("selectedDifficulty", difficulty);
    const deadline   = this.num("deadline", 0);
    const dealtAt    = this.num("dealtAt", 0);
    const isDealing  = this.bool("isDealing");
    const isStarting = this.bool("isStarting");
    const isSubmitting = this.bool("isSubmitting");
    const isRecovering = this.bool("isRecovering");
    const isPressing = this.bool("isPressing");
    const isGuest    = this.str("appMode", "gamefi") === "guest";
    const settlementGraceMs = Math.max(
      0,
      this.num("settlementGraceMs", SETTLEMENT_GRACE_MS),
    );
    const rawPhase = this.str("roundPhase", "lobby");
    const roundPhase: ColorUiPhase = [
      "lobby", "watching", "input", "wrong", "complete", "expired",
    ].includes(rawPhase)
      ? rawPhase as ColorUiPhase
      : lastSt === "all-correct"
        ? "complete"
        : lastSt === "wrong"
          ? "wrong"
          : player.length === 0 && sequence.length > 0
            ? "watching"
            : "input";

    const statusChanged = status !== this.currentStatus;
    const sequenceChanged = sequence !== this.currentSequence;
    const playerChanged = player !== this.currentPlayer;
    const phaseChanged = roundPhase !== this.currentRoundPhase;
    const lastStatusChanged = lastSt !== this.currentLastStatus;

    this.currentStatus = status;
    this.currentSequence = sequence;
    this.currentPlayer = player;
    this.currentLastStatus = lastSt;
    this.currentRoundPhase = roundPhase;
    this.currentDifficulty = difficulty;
    this.currentIsGuest = isGuest;
    this.deadline = deadline;
    this.dealtAt = dealtAt;
    this.settlementGraceMs = settlementGraceMs;

    if (sequenceChanged && roundPhase === "watching" && sequence.length > 1) {
      this.playRoundAdvanceFeedback();
    }
    if (phaseChanged && roundPhase === "wrong") this.playTerminalFeedback("wrong");
    if (phaseChanged && roundPhase === "complete") this.playTerminalFeedback("clear");
    if (statusChanged && status === "solved") this.playTerminalFeedback("win");

    if (statusChanged && status === "dealt") {
      this.expirationDispatched = false;
      this.lastTimerPaintAt = Number.NEGATIVE_INFINITY;
    }
    if (isPressing) {
      this.pressLocked = true;
    } else if (playerChanged || phaseChanged || sequenceChanged) {
      this.pressLocked = Date.now() < this.pressUnlockAt;
    }
    if (statusChanged || lastStatusChanged) this.actionLocked = false;

    // Update round label
    this.roundLabel.setText(
      status === "dealt" && roundNum > 0
        ? `${this.str("roundLabel", "ROUND")} ${roundNum}`
        : "",
    );
    this.updateTimer();

    const isLobby = status === "idle" || status === "solved" || status === "expired" || status === "refunded";
    const completedSequence = roundPhase === "complete" || lastSt === "all-correct";
    const dealPending = status === "committed" || lastSt === "deal-pending";
    const timeUp = status === "dealt" && hasColorDeadlinePassed(deadline);
    const wrong = status === "dealt" && roundPhase === "wrong";
    const settlementPending = status === "unknown" || lastSt === "settlement-pending";
    const releaseReady = isGuest || canReleaseExpiredGame(deadline, settlementGraceMs);
    const action = this.primaryActionFor({
      completedSequence,
      dealPending,
      isDealing,
      isGuest,
      isLobby,
      isStarting,
      isSubmitting,
      isRecovering,
      releaseReady,
      settlementPending,
      timeUp,
      wrong,
    });

    this.startBtn.setVisible(Boolean(action));
    this.progressRow.setVisible(!isLobby && !action);
    this.modeCards.forEach(({ container }) => container.setVisible(isLobby));
    if (isLobby && selectedDifficulty !== this.selectedDifficulty) {
      this.selectedDifficulty = Math.max(
        0,
        Math.min(DIFFICULTY_RULES.length - 1, selectedDifficulty),
      );
    }
    this.updateModeCards();
    this.updateStartButton(action);

    this.statusBar.setText(this.statusMessage(status, roundPhase));

    if (status === "dealt") {
      if (timeUp) {
        this.cancelPlayback();
        this.pressLocked = true;
        this.phaseLabel.setText(this.str("phaseEnd", "END")).setColor("#f87171");
        this.statusBar.setText(
          releaseReady
            ? this.str("statusReleaseReady", "Recovery complete — release this run")
            : this.str("statusReleaseWait", "Recovery window in progress"),
        );
        this.phaseCue("time-up", "lose");
      } else if (roundPhase === "wrong") {
        this.cancelPlayback();
        this.phaseLabel.setText(this.str("phaseWrong", "WRONG")).setColor("#f87171");
        this.phaseCue("wrong", "error");
      } else if (roundPhase === "complete") {
        this.cancelPlayback();
        this.phaseLabel.setText(this.str("phaseCorrect", "CLEAR")).setColor("#4ade80");
        this.phaseCue("correct", "combo");
      } else if (roundPhase === "watching" && sequence.length > 0) {
        this.phaseLabel.setText(this.str("phaseWatch", "WATCH")).setColor("#fcd34d");
        this.phaseCue(`watch-${sequence.length}`);
        const playbackKey = `${this.str("activeGameId", "0")}:${sequence}`;
        if (!this.playbackActive && playbackKey !== this.lastPlaybackKey) {
          this.startFlashSequence(sequence, playbackKey);
        }
      } else {
        this.cancelPlayback(false);
        this.phaseLabel.setText(this.str("phaseRepeat", "YOUR TURN")).setColor("#60a5fa");
        this.phaseCue(`repeat-${sequence.length}`);
      }
    } else if (status === "idle" || status === "refunded") {
      this.cancelPlayback();
      this.phaseLabel.setText(this.str("phaseReady", "READY")).setColor(TEXT_MAIN);
      this.phaseCue("idle");
    } else if (status === "solved") {
      this.cancelPlayback();
      this.phaseLabel.setText(this.str("phaseWin", "WIN!")).setColor("#4ade80");
      this.phaseCue("solved", "win");
    } else if (status === "expired") {
      this.cancelPlayback();
      this.phaseLabel.setText(this.str("phaseEnd", "END")).setColor("#f87171");
      this.phaseCue("expired", "lose");
    } else if (status === "unknown") {
      this.cancelPlayback();
      this.phaseLabel.setText(this.str("phaseEnd", "END")).setColor("#f59e0b");
      this.phaseCue("settlement-pending");
    }

    // Progress dots
    if (sequence.length !== this.lastSequenceLen) {
      this.rebuildProgressDots(sequence.length);
      this.lastSequenceLen = sequence.length;
    }
    this.progressDots.forEach((dot, i) => {
      const colorIndex = Number(sequence[i]);
      dot.setFillStyle(
        i < player.length && colorIndex >= 0 && colorIndex < PAD_LIT.length
          ? PAD_LIT[colorIndex]!
          : DOT_UNLIT,
      );
    });

    // Pad interactivity
    const canPress = this.canPressPads();
    this.padGraphics.forEach((_, i) => {
      this.padGlows[i]?.setVisible(this.flashIndex === i);
    });
    this.padButtons.forEach((button, index) => {
      button.setAlpha(canPress ? 1 : 0.74);
      const active = this.flashIndex === index;
      this.padButtonImages[index]?.setAlpha(
        active ? 1 : this.flashIndex >= 0 ? 0.46 : canPress ? 1 : 0.82,
      );
      this.padButtonGlows[index]?.setAlpha(active ? 0.58 : 0.16);
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
    // Mode cards are sized from the space actually available, not a constant.
    //
    // cardW used to be a hard 112 on every non-compact canvas (both the 420px
    // desktop and the 376px mobile board), with a 34px badge and a left-anchored
    // label that had no wrap and no fitting. That left ~66px for a label that
    // needs ~92px, so "Pulse Arcade" was clipped mid-glyph by the card border
    // and "Master Circuit" ran out past the card edge. Widen the card into the
    // room the dock really has, buy a little more of it back from the badge on
    // the tightest boards, and let the label wrap (below) rather than truncating
    // honest copy.
    const cardW = compact
      ? Math.min(92, Math.max(78, (W - sideInset * 2 - gap * 2) / 3))
      : Math.min(132, Math.max(96, (W - sideInset * 2 - gap * 2) / 3));
    const cardH = compact ? 48 : 54;
    const roomy = cardW >= 110;
    const badgeSize = compact ? 28 : roomy ? 32 : 26;
    const textPad = compact ? 9 : roomy ? 10 : 7;
    const badgeX = -cardW / 2 + badgeSize / 2 + (compact ? 3 : 4);
    const textX = -cardW / 2 + badgeSize + textPad;
    // Width the label may occupy before it must wrap: card edge, less the text's
    // own start and a right-hand breathing margin.
    const labelMaxW = cardW / 2 - 6 - textX;
    const total = cardW * 3 + gap * 2;
    const startX = W / 2 - total / 2 + cardW / 2;
    const y = H * 0.11;

    DIFFICULTY_RULES.forEach((rule, index) => {
      const container = this.add.container(startX + index * (cardW + gap), y);
      const bg = this.add.graphics();
      const hit = this.add.zone(0, 0, cardW, cardH).setInteractive({ useHandCursor: true });
      const badge = this.add.image(badgeX, 0, CLASH_ASSETS.badges[index]!)
        .setDisplaySize(badgeSize, badgeSize);
      const labelKey = MODE_LABEL_KEYS[index] ?? MODE_LABEL_KEYS[0];
      const targetKey = MODE_TARGET_KEYS[index] ?? MODE_TARGET_KEYS[0];
      const label = this.add.text(
        textX,
        0,
        this.str(labelKey, MODE_LABELS[index] ?? "Pulse"),
        {
        fontFamily: FONT_FAMILY,
        fontSize: compact ? "11px" : "12px",
        fontStyle: "bold",
        color: "#4f4235",
        wordWrap: { width: labelMaxW },
        },
      ).setOrigin(0, 0.5);
      const meta = this.add.text(
        textX,
        0,
        this.str(targetKey, MODE_COPY[index] ?? `${rule.targetSeq} cues`),
        {
        fontFamily: FONT_FAMILY,
        fontSize: compact ? "9px" : "10px",
        color: TEXT_MUTED,
        },
      ).setOrigin(0, 0.5);

      // The label may now be one or two lines depending on the locale and the
      // board width, so centre the label+meta pair on the card rather than
      // pinning both to fixed offsets that only suited a single-line label.
      const stackGap = compact ? 1 : 2;
      const stackH = label.height + stackGap + meta.height;
      label.setY(-stackH / 2 + label.height / 2);
      meta.setY(stackH / 2 - meta.height / 2);

      this.bindGameButton(hit, {
        targets: container,
        pressScale: 0.97,
        hoverScale: 1.02,
        enabled: () => ["idle", "solved", "expired", "refunded"].includes(this.currentStatus),
        onPress: () => {
          this.sfx.unlock();
          this.sfx.play("select");
          this.selectedDifficulty = index;
          this.updateModeCards();
          this.dispatch("setDifficulty", index);
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

  /**
   * Pad-ring radius. The non-compact (desktop) disc is scaled down from the raw
   * ratio so the console art clears the mode dock above and the pad-button row
   * below inside the fixed 420×580 logical canvas.
   */
  private boardRadius(W: number, H: number): number {
    const compact = W < 400;
    const base = Math.min(W, H) * (compact ? 0.30 : 0.41);
    return compact ? base : base * 0.78;
  }

  /** Vertical center of the board disc (pushed down on desktop for dock clearance). */
  private boardCenterY(W: number, H: number): number {
    const compact = W < 400;
    return H * (compact ? 0.38 : 0.46);
  }

  private buildBoard(W: number, H: number): void {
    const cx = W / 2;
    const compact = W < 400;
    const cy = this.boardCenterY(W, H);
    const R  = this.boardRadius(W, H);
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

    // Four authored cabinet quadrants plus one shared annular hit area.
    for (let i = 0; i < 4; i++) {
      // Glow halo (behind pad)
      const glow = this.add.ellipse(cx, cy, R * 2.3, R * 2.3, PAD_LIT[i]!, 0.0);
      glow.setDepth(3);
      this.padGlows.push(glow);

      const g = this.add.graphics();
      g.setDepth(4);
      this.padGraphics.push(g);
      this.drawPad(g, cx, cy, R, innerR, gap, i, false);
    }

    const hitZone = this.add.zone(cx, cy, R * 2, R * 2);
    hitZone.setInteractive({ useHandCursor: true });
    const pointerPad = (pointer: Phaser.Input.Pointer): number | null => {
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < innerR + 4 || dist > R + 10) return null;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      return ColorClashScene.angleToPad(angle);
    };
    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const padIdx = pointerPad(pointer);
      if (padIdx !== null) this.handlePress(padIdx);
    });
    hitZone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const padIdx = pointerPad(pointer);
      if (padIdx !== null && this.canPressPads() && this.flashIndex !== padIdx) {
        this.applyFlash();
        this.lightPad(padIdx, true, 0.35);
      } else if (padIdx === null && this.flashIndex === -1) {
        this.applyFlash();
      }
    });
    hitZone.on("pointerout", () => {
      if (this.flashIndex === -1) this.applyFlash();
    });
  }

  /** Map 360° pointer angle to the matching authored cabinet quadrant. */
  private static angleToPad(angleDeg: number): number {
    if (angleDeg >= 0 && angleDeg < 90) return 3;   // bottom-right, yellow
    if (angleDeg >= 90 && angleDeg < 180) return 2; // bottom-left, green
    if (angleDeg >= 180 && angleDeg < 270) return 0; // top-left, red
    return 1;                                         // top-right, blue
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
    const centerDeg = PAD_CENTER_DEGREES[index] ?? PAD_CENTER_DEGREES[0];
    const startDeg = centerDeg - 45 + (gap / outerR) * (180 / Math.PI);
    const endDeg   = startDeg + 90 - (gap / outerR) * 2 * (180 / Math.PI);
    const startRad = Phaser.Math.DegToRad(startDeg);
    const endRad   = Phaser.Math.DegToRad(endDeg);

    const color = PAD_LIT[index]!;
    g.fillStyle(color, 0.7);

    // Build the pie ring shape
    g.beginPath();
    g.arc(cx, cy, outerR, startRad, endRad, false);
    g.arc(cx, cy, innerR + gap, endRad, startRad, true);
    g.closePath();
    g.fillPath();

    g.lineStyle(6, PAD_GLOW[index]!, 0.98);
    g.beginPath();
    g.arc(cx, cy, outerR - 2, startRad, endRad, false);
    g.strokePath();
  }

  private lightPad(index: number, on: boolean, alpha = 1): void {
    const W = this.scW;
    const H = this.scH;
    const cx = W / 2, cy = this.boardCenterY(W, H);
    const R = this.boardRadius(W, H);
    const innerR = R * 0.18;
    this.drawPad(this.padGraphics[index]!, cx, cy, R, innerR, 5, index, on);
    this.padGlows[index]?.setVisible(on).setAlpha(on ? alpha * 0.22 : 0);
  }

  // ── Center hub ─────────────────────────────────────────────────────────────

  private buildCenterHub(W: number, H: number): void {
    const cx = W / 2;
    const compact = W < 400;
    const cy = this.boardCenterY(W, H);
    // Knob is floored so the phase word always sits on a dark disc, but stays
    // inside the pad inner-hole so it never clips the coloured quadrants.
    const knobR = Math.max(this.boardRadius(W, H) * 0.18, compact ? 21 : 25);

    // Hub circle (warm dark core, echoing the console art hub)
    this.add.circle(cx, cy, knobR, CENTER_BG).setDepth(5);
    this.add.circle(cx, cy, knobR - 2, CENTER_CORE).setDepth(6);

    this.phaseLabel = this.add.text(cx, cy, "READY", {
      fontFamily: FONT_FAMILY,
      fontSize: compact ? "11px" : "12px",
      fontStyle: "bold",
      color: TEXT_MAIN,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(7);
    // Dark outline + shadow keep every phase word legible even where a long
    // label (CORRECT/REPEAT) overhangs the knob onto the light board.
    this.phaseLabel.setStroke("#241a12", compact ? 3 : 4);
    this.phaseLabel.setShadow(0, 1, "rgba(20,12,4,0.7)", 3, false, true);
  }

  // ── Physical pad buttons ──────────────────────────────────────────────────

  private buildPadButtons(W: number, H: number): void {
    const compact = W < 400;
    const y = H * (compact ? 0.73 : 0.78);
    const gap = compact ? Math.max(52, W * 0.17) : 68;
    const startX = W / 2 - gap * 1.5;
    const glowSize = compact ? 48 : 58;
    const padSize = compact ? 46 : 54;
    const hitRadius = compact ? 26 : 30;

    for (let index = 0; index < 4; index++) {
      const container = this.add.container(startX + index * gap, y);
      const glow = this.add.ellipse(0, 0, glowSize, glowSize, PAD_LIT[index]!, 0.34);
      // Use the authored pad resource so the tactile controls match the cabinet
      // artwork instead of approximating the material with vector circles.
      const chip = this.add.image(0, 0, CLASH_ASSETS.pads[index]!)
        .setDisplaySize(padSize, padSize);
      const hit = this.add.circle(0, 0, hitRadius, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      this.bindGameButton(hit, {
        targets: container,
        pressScale: 0.93,
        hoverScale: 1.04,
        onPress: () => this.handlePress(index),
      });

      container.add([glow, chip, hit]);
      this.padButtons.push(container);
      this.padButtonImages.push(chip);
      this.padButtonGlows.push(glow);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(W: number, H: number): void {
    this.roundLabel = this.add.text(W * 0.24, H * 0.11, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: TEXT_MUTED,
      letterSpacing: 1,
    }).setOrigin(0.5);

    this.timerLabel = this.add.text(W * 0.76, H * 0.11, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#4f4235",
      letterSpacing: 1,
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

  private primaryActionFor(ctx: PrimaryActionContext): PrimaryActionState {
    if (ctx.dealPending && ctx.timeUp) {
      return {
        action: "expireGame",
        enabled: ctx.isGuest || ctx.releaseReady,
        label: ctx.isGuest
          ? this.str("actionRestart", "RESTART")
          : ctx.releaseReady
            ? this.str("actionRelease", "RELEASE GAME")
            : this.str("actionReleaseWait", "RECOVERY COUNTDOWN"),
      };
    }
    if (ctx.dealPending) {
      return {
        action: "retryDeal",
        busy: ctx.isDealing,
        enabled: !ctx.isDealing,
        label: ctx.isDealing
          ? this.str("actionStarting", "SEALING...")
          : this.str("actionRetry", "RETRY"),
      };
    }
    // Solved/expired/refunded sessions are lobbies even when their last round
    // phase remains "complete" for the result presentation.
    if (ctx.isLobby) {
      const busy = ctx.isStarting || ctx.isDealing;
      return {
        action: "startGame",
        busy,
        enabled: !busy,
        label: busy ? this.str("actionStarting", "SEALING...") : this.str("actionStart", "OPEN SEQUENCE"),
      };
    }
    if (ctx.settlementPending) {
      if (ctx.releaseReady) {
        return {
          action: "expireGame",
          enabled: !ctx.isRecovering,
          label: this.str("actionRelease", "RELEASE GAME"),
        };
      }
      return {
        action: "checkSettlement",
        busy: ctx.isRecovering,
        enabled: !ctx.isRecovering,
        label: ctx.isRecovering
          ? this.str("actionStarting", "CHECKING...")
          : this.str("actionCheckSettlement", "CHECK SETTLEMENT"),
      };
    }
    if (ctx.completedSequence) {
      return {
        action: "submitSolution",
        busy: ctx.isSubmitting,
        enabled: !ctx.isSubmitting,
        label: ctx.isSubmitting
          ? this.str("actionSubmitting", "VERIFYING...")
          : this.str("actionSubmit", ctx.isGuest ? "SAVE SCORE" : "CLAIM REWARD"),
      };
    }
    if (ctx.wrong && ctx.isGuest) {
      return {
        action: "startGame",
        enabled: true,
        label: this.str("actionRestart", "RESTART"),
      };
    }
    if (ctx.wrong || ctx.timeUp) {
      return {
        action: "expireGame",
        enabled: ctx.isGuest || ctx.releaseReady,
        label: ctx.isGuest
          ? this.str("actionRestart", "RESTART")
          : ctx.releaseReady
            ? this.str("actionRelease", "RELEASE GAME")
            : this.str("actionReleaseWait", "RECOVERY COUNTDOWN"),
      };
    }
    return null;
  }

  private updateStartButton(status: PrimaryActionState): void {
    if (!status) return;
    const { action, enabled, label, busy } = status;
    this.primaryAction = action;
    this.primaryActionEnabled = enabled && !busy && !this.actionLocked;
    this.startBtnLabel.setText(label);
    this.startBtnBg.clear();
    const fill = busy ? 0xbba989 : action === "expireGame" ? 0xd95e4f : action === "submitSolution" ? 0x16a34a : 0x12a998;
    const stroke = busy ? 0xd8b46d : action === "expireGame" ? 0xfca5a5 : action === "submitSolution" ? 0x86efac : 0x4adecf;
    this.startBtnBg.fillStyle(fill);
    this.startBtnBg.fillRoundedRect(-96, -24, 192, 48, 14);
    this.startBtnBg.lineStyle(2, stroke, 0.9);
    this.startBtnBg.strokeRoundedRect(-96, -24, 192, 48, 14);
    this.startBtn.setAlpha(this.primaryActionEnabled || busy ? 1 : 0.68);
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

  /** Reward each completed Simon round without interrupting the next cue. */
  private playRoundAdvanceFeedback(): void {
    this.sfx.play("combo");
    if (this.reducedMotion) return;
    this.cameras.main.flash(110, 255, 244, 190, false, undefined, 0.12);
    this.tween({
      targets: this.padButtons,
      scale: 1.055,
      duration: 85,
      yoyo: true,
      stagger: 26,
      ease: "Sine.easeOut",
    });
  }

  /** Distinct physical feedback for a miss, a cleared pattern, and a saved win. */
  private playTerminalFeedback(kind: "wrong" | "clear" | "win"): void {
    if (this.reducedMotion) return;
    if (kind === "wrong") {
      this.cameras.main.shake(170, 0.006);
      this.cameras.main.flash(130, 255, 96, 82, false, undefined, 0.18);
      return;
    }
    this.cameras.main.flash(
      kind === "win" ? 260 : 150,
      kind === "win" ? 255 : 150,
      244,
      kind === "win" ? 181 : 206,
      false,
      undefined,
      kind === "win" ? 0.22 : 0.14,
    );
    this.tween({
      targets: [this.phaseLabel, ...this.padButtons],
      scale: kind === "win" ? 1.1 : 1.06,
      duration: kind === "win" ? 150 : 100,
      yoyo: true,
      stagger: 30,
      ease: "Back.easeOut",
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private handleStart(): void {
    if (!this.primaryActionEnabled) return;
    this.sfx.unlock();
    this.actionLocked = true;
    this.primaryActionEnabled = false;
    this.scheduleGameplay(1_000, () => {
      this.actionLocked = false;
      this.onStateUpdate(this.state);
    });
    if (this.primaryAction === "startGame") {
      this.sfx.play("start");
      this.dispatch("startGame", this.selectedDifficulty);
      this.flashTimer?.destroy();
      this.flashIndex = -1;
      this.applyFlash();
      return;
    }

    const cue: SceneAudioPreset =
      this.primaryAction === "submitSolution"
        ? "win"
        : this.primaryAction === "expireGame"
          ? "lose"
          : "select";
    this.sfx.play(cue);
    this.dispatch(this.primaryAction);
  }

  private handlePress(colorIdx: number): void {
    if (!this.canPressPads()) return;
    const unlockMs = cueTimingOf(this.currentDifficulty).pressLockMs;
    this.pressLocked = true;
    this.pressUnlockAt = Date.now() + unlockMs;
    this.sfx.unlock();
    this.playPadTone(colorIdx);
    this.flashPad(colorIdx, 180);
    this.dispatch("recordPress", colorIdx);
    this.scheduleGameplay(unlockMs, () => {
      if (
        this.currentStatus === "dealt"
        && this.currentRoundPhase === "input"
        && !this.bool("isPressing")
      ) {
        this.pressUnlockAt = 0;
        this.pressLocked = false;
        this.onStateUpdate(this.state);
      }
    });
  }

  private canPressPads(): boolean {
    return (
      this.currentStatus === "dealt" &&
      this.currentRoundPhase === "input" &&
      !this.playbackActive &&
      !this.pressLocked &&
      !this.bool("isPressing") &&
      Date.now() >= this.pressUnlockAt &&
      !this.expirationDispatched &&
      !hasColorDeadlinePassed(this.deadline) &&
      this.currentPlayer.length < this.currentSequence.length &&
      this.currentLastStatus !== "wrong"
    );
  }

  private handleKeyboardInput(event: KeyboardEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLElement
      && ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(target.tagName)
    ) return;
    const key = String(event.key || "").toLowerCase();
    const code = String(event.code || "");
    const index = ({
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      Numpad1: 0,
      Numpad2: 1,
      Numpad3: 2,
      Numpad4: 3,
    } as Record<string, number>)[code] ?? ({ r: 0, b: 1, g: 2, y: 3 } as Record<string, number>)[key];
    if (index === undefined || !this.canPressPads()) return;
    event.preventDefault();
    this.handlePress(index);
  }

  // ── Flash sequence playback ────────────────────────────────────────────────

  private startFlashSequence(sequence: string, playbackKey: string): void {
    const safeSequence = normalizeColorSequence(sequence);
    this.cancelPlayback(false);
    if (!safeSequence) return;

    const timing = cueTimingOf(this.currentDifficulty);
    this.playbackActive = true;
    this.pressLocked = true;
    let cueIndex = 0;

    const finish = () => {
      this.flashTimer = null;
      this.flashIndex = -1;
      this.applyFlash();
      this.playbackActive = false;
      this.lastPlaybackKey = playbackKey;
      this.phaseLabel.setText(this.str("phaseRepeat", "YOUR TURN")).setColor("#60a5fa");
      this.statusBar.setText(this.str("statusRepeat", "Repeat the sequence!"));
      this.dispatch("sequencePlaybackComplete");
    };

    const showNextCue = () => {
      if (cueIndex >= safeSequence.length) {
        finish();
        return;
      }
      this.flashIndex = Number(safeSequence[cueIndex]);
      this.playPadTone(this.flashIndex);
      const colorKey = COLOR_LABEL_KEYS[this.flashIndex] ?? COLOR_LABEL_KEYS[0];
      this.phaseLabel
        .setText(this.str(colorKey, "WATCH"))
        .setColor("#fff8e8");
      this.applyFlash();
      this.flashTimer = this.scheduleGameplay(timing.litMs, () => {
        this.flashIndex = -1;
        this.phaseLabel.setText(this.str("phaseWatch", "WATCH")).setColor("#fcd34d");
        this.applyFlash();
        cueIndex += 1;
        this.flashTimer = this.scheduleGameplay(timing.gapMs, showNextCue);
      });
    };

    this.flashTimer = this.scheduleGameplay(timing.leadInMs, showNextCue);
  }

  private flashPad(index: number, duration: number): void {
    this.lightPad(index, true);
    const padButton = this.padButtonImages[index];
    if (padButton && !this.reducedMotion) {
      const baseScaleX = padButton.scaleX;
      const baseScaleY = padButton.scaleY;
      this.tween({
        targets: padButton,
        scaleX: baseScaleX * 1.08,
        scaleY: baseScaleY * 1.08,
        duration: duration / 2,
        yoyo: true,
      });
    }
    this.scheduleGameplay(duration, () => {
      if (this.flashIndex !== index) this.lightPad(index, false);
    });
  }

  private applyFlash(): void {
    for (let i = 0; i < 4; i++) {
      const active = this.flashIndex === i;
      this.lightPad(i, active);
      this.padButtonImages[i]?.setAlpha(active ? 1 : this.flashIndex >= 0 ? 0.46 : 0.82);
      this.padButtonGlows[i]?.setAlpha(active ? 0.58 : 0.16);
    }
  }

  private statusMessage(status: string, phase: ColorUiPhase): string {
    if (status === "dealt") {
      if (phase === "watching") return this.str("statusWatch", "Watch the sequence...");
      if (phase === "input") return this.str("statusRepeat", "Repeat the sequence!");
      if (phase === "wrong") {
        if (this.currentIsGuest) return this.str("statusWrong", "Wrong — try again");
        return canReleaseExpiredGame(this.deadline, this.settlementGraceMs)
          ? this.str("statusReleaseReady", "Recovery complete — release this run")
          : this.str("statusReleaseWait", "Recovery window in progress");
      }
      if (phase === "complete") return this.str("statusComplete", "Sequence complete");
    }
    if (status === "expired") return this.str("actionRestart", "Restart run");
    if (status === "unknown") {
      return canReleaseExpiredGame(this.deadline, this.settlementGraceMs)
        ? this.str("statusReleaseReady", "Recovery complete — release this run")
        : this.str("statusReleaseWait", "Settlement pending — check again shortly");
    }
    return "";
  }

  private updateTimer(): void {
    if (!this.timerLabel) return;
    if (this.currentStatus === "unknown" && this.deadline > 0) {
      const recoveryRemaining = Math.max(
        0,
        releaseAtOf(this.deadline, this.settlementGraceMs) - Date.now(),
      );
      this.timerLabel
        .setText(formatClock(recoveryRemaining))
        .setColor(recoveryRemaining <= 0 ? "#147d69" : "#c24132");
      return;
    }
    if (this.currentStatus !== "dealt" || this.deadline <= 0 || this.dealtAt <= 0) {
      this.timerLabel.setText("");
      return;
    }
    const now = Date.now();
    const remaining = Math.max(0, this.deadline - now);
    const terminal = this.currentRoundPhase === "wrong" || remaining <= 0;
    if (terminal && !this.currentIsGuest) {
      const releaseRemaining = Math.max(
        0,
        releaseAtOf(this.deadline, this.settlementGraceMs) - now,
      );
      const releaseReady = canReleaseExpiredGame(
        this.deadline,
        this.settlementGraceMs,
        now,
      );
      this.timerLabel
        .setText(formatClock(releaseRemaining))
        .setColor(releaseReady ? "#147d69" : "#c24132");
      this.pressLocked = true;
      this.cancelPlayback();
      this.phaseLabel.setText(this.str("phaseEnd", "END")).setColor("#f87171");
      this.statusBar.setText(
        releaseReady
          ? this.str("statusReleaseReady", "Recovery complete — release this run")
          : this.str("statusReleaseWait", "Recovery window in progress"),
      );
      this.startBtn.setVisible(true);
      this.progressRow.setVisible(false);
      this.updateStartButton({
        action: "expireGame",
        enabled: releaseReady,
        label: releaseReady
          ? this.str("actionRelease", "RELEASE GAME")
          : this.str("actionReleaseWait", "RECOVERY COUNTDOWN"),
      });
      return;
    }
    const total = Math.max(1, this.deadline - this.dealtAt);
    const pct = remaining / total;
    this.timerLabel
      .setText(formatClock(remaining))
      .setColor(pct <= 0.2 ? "#c24132" : "#4f4235");
    if (remaining <= 0 && this.currentIsGuest) this.expireRoundOnce();
  }

  private expireRoundOnce(): void {
    if (this.expirationDispatched || this.currentStatus !== "dealt") return;
    this.expirationDispatched = true;
    this.pressLocked = true;
    this.cancelPlayback();
    this.dispatch("expireGame");
  }

  private scheduleGameplay(delayMs: number, callback: () => void): Phaser.Time.TimerEvent {
    let event!: Phaser.Time.TimerEvent;
    event = this.time.delayedCall(delayMs, () => {
      this.gameplayTimers.delete(event);
      callback();
    });
    this.gameplayTimers.add(event);
    return event;
  }

  private clearGameplayTimers(): void {
    for (const timer of this.gameplayTimers) timer.remove(false);
    this.gameplayTimers.clear();
    this.flashTimer = null;
  }

  private cancelPlayback(clearKey = true): void {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.gameplayTimers.delete(this.flashTimer);
      this.flashTimer = null;
    }
    this.playbackActive = false;
    this.flashIndex = -1;
    if (clearKey) this.lastPlaybackKey = "";
    if (this.padGraphics.length > 0) this.applyFlash();
  }

  private cleanupGameplay(): void {
    this.input.keyboard?.off("keydown", this.handleKeyboardInput, this);
    this.clearGameplayTimers();
    this.cancelPlayback();
    this.tweens.killAll();
  }

  destroy(fromScene = false): void {
    this.cleanupGameplay();
    super.destroy(fromScene);
  }
}
