/**
 * SheepScene — Phaser 3 scene for Sheep Solitaire (羊了个羊 style tile-matching).
 *
 * Renders a meadow-green board with a stacked card pile, a 7-slot tray,
 * tool buttons (Undo/Shuffle/Remove3), and progress & status indicators.
 * A lobby with 3 difficulty cards is shown while the game is idle.
 *
 * State received from React (via GameBridge):
 *   gameStatus:     "idle"|"committed"|"dealt"|"solved"|"expired"
 *   pileCards:      CardView[]   cards remaining in the pile
 *   slotCards:      CardView[]   cards in the 7-slot tray (0–7 elements)
 *   shuffleLeft:    number
 *   remove3Left:    number
 *   undosUsed:      number
 *   gameDifficulty: number  0=easy 1=medium 2=hard
 *   isStarting:     boolean
 *   isDealing:      boolean
 *   isSubmitting:   boolean
 *   isMatching:     boolean
 *   isGameOver:     boolean
 *   lastStatus:     string
 *   lastPayout:     string
 *
 * Actions dispatched:
 *   "startGame"  { difficulty: number }
 *   "pickCard"   { cardId: number }
 *   "useUndo"
 *   "useShuffle"
 *   "useRemove3"
 *   "submitRun"
 *   "expireGame"
 */

import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

// Symbol indices 0–14 are drawn via SheepScene.drawCardSymbol — no emoji table needed.

const DIFFICULTY_LABELS = ["Easy", "Medium", "Hard"] as const;
const DIFFICULTY_ENTRY   = ["0.02 GAS", "0.10 GAS", "0.20 GAS"] as const;
const DIFFICULTY_REWARD  = ["0.10 GAS", "0.50 GAS", "1.00 GAS"] as const;
const DIFFICULTY_TIMER   = ["5:00",     "8:00",     "12:00"] as const;

const C = {
  meadow:      0x3a7c47,
  meadowDark:  0x2a5c34,
  meadowLight: 0x5aaa65,
  card:        0xfff8e8,
  cardBlocked: 0xbdb09a,
  cardBorder:  0xd4a843,
  cardBorderB: 0x8a7050,
  gold:        0xd4a843,
  goldLight:   0xf0c866,
  tray:        0x6b4820,
  traySlot:    0x3a2808,
  traySlotBdr: 0x8b6030,
  btnBg:       0x2a5c34,
  btnBorder:   0x4a9c58,
  btnDisabled: 0x3a3a3a,
  btnText:     0xf0c866,
  white:       0xffffff,
  red:         0xe25d4d,
  green:       0x16a34a,
  muted:       0x7a9a7a,
  overlayDark: 0x000000,
  lobbyCard0:  0x2a7a3a,
  lobbyCard1:  0x7a6020,
  lobbyCard2:  0x7a2a2a,
} as const;

interface CardView {
  id: number;
  symbol: number;
  layer: number;
  exposed: boolean;
  picked: boolean;
}

// ── Layout constants ─────────────────────────────────────────────────────────
const CARD_W    = 48;
const CARD_H    = 58;
const CARD_STEP_X = 53;
const CARD_STEP_Y = 63;
const TRAY_Y_FRAC = 0.625;
const TOOLS_Y_FRAC = 0.745;
const STATUS_Y_FRAC = 0.835;
const SLOT_COUNT = 7;

// ── SheepScene ────────────────────────────────────────────────────────────────

export class SheepScene extends BaseScene {
  // ── Group containers (only one visible at a time) ──────────────────────────
  private lobbyGroup!:  Phaser.GameObjects.Container;
  private loadGroup!:   Phaser.GameObjects.Container;
  private gameGroup!:   Phaser.GameObjects.Container;
  private resultGroup!: Phaser.GameObjects.Container;

  // ── Game sub-elements ──────────────────────────────────────────────────────
  private pileContainer!:    Phaser.GameObjects.Container;
  private trayContainer!:    Phaser.GameObjects.Container;
  private toolsContainer!:   Phaser.GameObjects.Container;
  private progressLabel!:    Phaser.GameObjects.Text;
  private statusLabel!:      Phaser.GameObjects.Text;
  private matchedLabel!:     Phaser.GameObjects.Text;

  // Tool button references
  private undoBtn!:    Phaser.GameObjects.Container;
  private shuffleBtn!: Phaser.GameObjects.Container;
  private remove3Btn!: Phaser.GameObjects.Container;
  private undoCountTxt!:    Phaser.GameObjects.Text;
  private shuffleCountTxt!: Phaser.GameObjects.Text;
  private remove3CountTxt!: Phaser.GameObjects.Text;

  // Result overlay elements
  private resultTitle!:   Phaser.GameObjects.Text;
  private resultSub!:     Phaser.GameObjects.Text;
  private resultActionBg!: Phaser.GameObjects.Rectangle;
  private resultActionTxt!: Phaser.GameObjects.Text;

  // ── State mirrors ──────────────────────────────────────────────────────────
  private prevSlotLen = 0;
  private prevPileLen = 0;
  private currentStatus = "idle";
  private ghostInFlight = false;

  constructor() {
    super("SheepScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;

    this.buildBackground(W, H);
    this.buildLobby(W, H);
    this.buildLoadScreen(W, H);
    this.buildGameScreen(W, H);
    this.buildResultScreen(W, H);

    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");
    const isGameOver = this.bool("isGameOver");

    const showLobby  = (status === "idle" || status === "expired" || status === "refunded") && !isStarting && !isDealing;
    const showLoad   = isStarting || isDealing || status === "committed";
    const showResult = status === "solved" || (status === "dealt" && isGameOver);
    const showGame   = status === "dealt" && !isGameOver;

    this.lobbyGroup .setVisible(showLobby  && !showLoad);
    this.loadGroup  .setVisible(showLoad);
    this.gameGroup  .setVisible(showGame);
    this.resultGroup.setVisible(showResult);

    this.currentStatus = status;

    if (showGame)   this.updateGameScreen();
    if (showResult) this.updateResultScreen();

    // Always keep status visible when game is shown
    this.statusLabel?.setText(this.str("lastStatus", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.meadow);
    // Inner board border
    this.add.rectangle(W / 2, H / 2, W - 24, H - 24, C.meadowDark)
      .setStrokeStyle(3, C.goldLight);
    // Subtle grass lines
    const g = this.add.graphics();
    g.lineStyle(1, C.meadowLight, 0.15);
    for (let y = 20; y < H; y += 28) g.lineBetween(0, y, W, y);
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(W: number, H: number): void {
    this.lobbyGroup = this.add.container(0, 0);

    // Title
    const title = this.add.text(W / 2, 52, "🐑  Sheep Solitaire", {
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f0c866",
    }).setOrigin(0.5);

    const sub = this.add.text(W / 2, 82, "Match 3 tiles to clear the board", {
      fontSize: "13px",
      color: "#c8d8b0",
    }).setOrigin(0.5);

    this.lobbyGroup.add([title, sub]);

    // 3 difficulty cards
    const cardTopY = 122;
    const cardH    = 158;
    const gap      = 12;
    const cardW    = W - 60;
    const cx       = W / 2;

    const diffColors  = [C.lobbyCard0, C.lobbyCard1, C.lobbyCard2];
    const diffBorders = [0x40b060, 0xa07830, 0xa03830];

    for (let d = 0; d < 3; d++) {
      const y = cardTopY + d * (cardH + gap);
      this.buildLobbyCard(cx, y, cardW, cardH, d, diffColors[d]!, diffBorders[d]!);
    }
  }

  private buildLobbyCard(
    cx: number, cy: number,
    w: number, h: number,
    difficulty: number,
    bgColor: number,
    borderColor: number,
  ): void {
    const bg = this.add.rectangle(cx, cy, w, h, bgColor)
      .setStrokeStyle(2, borderColor);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add.text(cx, cy - 46, DIFFICULTY_LABELS[difficulty]!, {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    const cardTypes = difficulty === 0 ? 8 : difficulty === 1 ? 12 : 15;
    const infoText  = `${cardTypes} tile types  ·  ${DIFFICULTY_TIMER[difficulty]}`;
    const infoLabel = this.add.text(cx, cy - 18, infoText, {
      fontSize: "13px",
      color: "#d0d0a8",
    }).setOrigin(0.5);

    const entryLabel = this.add.text(cx, cy + 10, `Entry: ${DIFFICULTY_ENTRY[difficulty]}`, {
      fontSize: "14px",
      color: "#f0c866",
    }).setOrigin(0.5);

    const rewardLabel = this.add.text(cx, cy + 34, `Reward: ${DIFFICULTY_REWARD[difficulty]}`, {
      fontSize: "15px",
      fontStyle: "bold",
      color: "#7dd87d",
    }).setOrigin(0.5);

    // Preview tile symbols (drawn)
    const tileCount = Math.min(cardTypes, 8);
    const tileStartX = cx - (tileCount / 2 - 0.5) * 28;
    for (let i = 0; i < tileCount; i++) {
      const tg = this.add.graphics();
      SheepScene.drawCardSymbol(tg, i, tileStartX + i * 28, cy + 62, 8, 0.8);
    }

    // Hover effect
    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, C.goldLight);
      this.tweens.add({ targets: bg, scaleX: 1.01, scaleY: 1.01, duration: 80 });
    });
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, borderColor);
      this.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 80 });
    });
    bg.on("pointerdown", () => {
      this.tweens.add({ targets: bg, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true });
      this.dispatch("startGame", { difficulty });
    });

    this.lobbyGroup.add([bg, label, infoLabel, entryLabel, rewardLabel, ...previewLabels]);
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  private buildLoadScreen(W: number, H: number): void {
    this.loadGroup = this.add.container(0, 0);

    const bg = this.add.rectangle(W / 2, H / 2, W - 40, 140, C.meadowDark)
      .setStrokeStyle(2, C.gold);

    const spinner = this.add.text(W / 2, H / 2 - 28, "🐑", {
      fontSize: "44px",
    }).setOrigin(0.5);

    const loadText = this.add.text(W / 2, H / 2 + 24, "Preparing your board…", {
      fontSize: "16px",
      color: "#f0c866",
    }).setOrigin(0.5);

    const subText = this.add.text(W / 2, H / 2 + 48, "Securing puzzle on-chain", {
      fontSize: "12px",
      color: "#8aaa88",
    }).setOrigin(0.5);

    // Spin animation on spinner
    this.tweens.add({
      targets: spinner,
      y: spinner.y - 12,
      duration: 700,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.loadGroup.add([bg, spinner, loadText, subText]);
  }

  // ── Game screen scaffold ───────────────────────────────────────────────────

  private buildGameScreen(W: number, H: number): void {
    this.gameGroup = this.add.container(0, 0);

    // ── Pile container (cards rendered into it dynamically) ──────────────────
    this.pileContainer = this.add.container(0, 0);
    this.gameGroup.add(this.pileContainer);

    // ── Progress label ───────────────────────────────────────────────────────
    this.progressLabel = this.add.text(W / 2, 30, "", {
      fontSize: "13px",
      color: "#c8d8b0",
    }).setOrigin(0.5);
    this.gameGroup.add(this.progressLabel);

    // ── Tray background ──────────────────────────────────────────────────────
    const trayY = H * TRAY_Y_FRAC;
    const trayBg = this.add.rectangle(W / 2, trayY, W - 24, 76, C.tray)
      .setStrokeStyle(2, C.gold);
    this.gameGroup.add(trayBg);

    // Tray label
    const trayLabel = this.add.text(16, trayY - 46, "Tray", {
      fontSize: "11px",
      color: "#d4a843",
      alpha: 0.8,
    });
    this.gameGroup.add(trayLabel);

    // Slot outlines (7 static slots)
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = slotStartX + i * slotStep;
      const slotBox = this.add.rectangle(sx, trayY, slotStep - 4, 64, C.traySlot)
        .setStrokeStyle(1, C.traySlotBdr);
      this.gameGroup.add(slotBox);
    }

    // ── Tray card container (filled dynamically) ─────────────────────────────
    this.trayContainer = this.add.container(0, 0);
    this.gameGroup.add(this.trayContainer);

    // ── Tools row ────────────────────────────────────────────────────────────
    const toolY = H * TOOLS_Y_FRAC;
    this.toolsContainer = this.add.container(0, 0);
    this.gameGroup.add(this.toolsContainer);
    this.buildToolButtons(W, toolY);

    // ── Status label ─────────────────────────────────────────────────────────
    this.statusLabel = this.add.text(W / 2, H * STATUS_Y_FRAC, "", {
      fontSize: "12px",
      color: "#a0c090",
      wordWrap: { width: W - 40 },
      align: "center",
    }).setOrigin(0.5);
    this.gameGroup.add(this.statusLabel);

    // ── Matched counter ──────────────────────────────────────────────────────
    this.matchedLabel = this.add.text(W - 18, 30, "", {
      fontSize: "12px",
      color: "#7dd87d",
      align: "right",
    }).setOrigin(1, 0.5);
    this.gameGroup.add(this.matchedLabel);
  }

  // ── Tool buttons ───────────────────────────────────────────────────────────

  private buildToolButtons(W: number, toolY: number): void {
    const btnW = 96;
    const gap  = 12;
    const total = 3 * btnW + 2 * gap;
    const startX = (W - total) / 2 + btnW / 2;

    this.undoBtn    = this.makeToolBtn(startX,              toolY, "↩ Undo",     "0", () => this.dispatch("useUndo"));
    this.shuffleBtn = this.makeToolBtn(startX + btnW + gap, toolY, "🔀 Shuffle",  "1", () => this.dispatch("useShuffle"));
    this.remove3Btn = this.makeToolBtn(startX + 2*(btnW+gap), toolY, "✂ Remove3", "1", () => this.dispatch("useRemove3"));

    // Extract count text refs from last item in each container (index 2)
    this.undoCountTxt    = this.undoBtn.list[2]    as Phaser.GameObjects.Text;
    this.shuffleCountTxt = this.shuffleBtn.list[2] as Phaser.GameObjects.Text;
    this.remove3CountTxt = this.remove3Btn.list[2] as Phaser.GameObjects.Text;

    this.toolsContainer.add([this.undoBtn, this.shuffleBtn, this.remove3Btn]);
  }

  private makeToolBtn(
    x: number, y: number,
    label: string,
    countStr: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const c  = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 96, 38, C.btnBg)
      .setStrokeStyle(2, C.btnBorder)
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover",  () => bg.setStrokeStyle(2, C.goldLight));
    bg.on("pointerout",   () => bg.setStrokeStyle(2, C.btnBorder));
    bg.on("pointerdown",  () => {
      onPress();
      this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 60, yoyo: true });
    });

    const txt = this.add.text(0, -2, label, {
      fontSize: "13px",
      color: "#f0c866",
    }).setOrigin(0.5);

    const countTxt = this.add.text(36, -16, countStr, {
      fontSize: "10px",
      color: "#7dd87d",
    }).setOrigin(0.5);

    c.add([bg, txt, countTxt]);
    return c;
  }

  // ── Result screen ──────────────────────────────────────────────────────────

  private buildResultScreen(W: number, H: number): void {
    this.resultGroup = this.add.container(0, 0);

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, C.overlayDark, 140);
    const card    = this.add.rectangle(W / 2, H / 2, W - 60, 240, C.meadowDark)
      .setStrokeStyle(3, C.gold);

    this.resultTitle = this.add.text(W / 2, H / 2 - 72, "", {
      fontSize: "32px",
      fontStyle: "bold",
      color: "#f0c866",
    }).setOrigin(0.5);

    this.resultSub = this.add.text(W / 2, H / 2 - 22, "", {
      fontSize: "16px",
      color: "#c8d8b0",
    }).setOrigin(0.5);

    // Action button
    this.resultActionBg = this.add.rectangle(W / 2, H / 2 + 52, 180, 46, C.green)
      .setStrokeStyle(2, 0x20d060)
      .setOrigin(0.5);
    this.resultActionBg.setInteractive({ useHandCursor: true });
    this.resultActionBg.on("pointerdown", () => {
      const status = this.str("gameStatus", "idle");
      if (status === "solved") {
        this.dispatch("expireGame");
      } else {
        this.dispatch("expireGame");
      }
    });

    this.resultActionTxt = this.add.text(W / 2, H / 2 + 52, "Play Again", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.resultGroup.add([overlay, card, this.resultTitle, this.resultSub, this.resultActionBg, this.resultActionTxt]);
  }

  // ── Update methods (called from onStateUpdate) ─────────────────────────────

  private updateGameScreen(): void {
    const pileCards  = (this.val<CardView[]>("pileCards")  ?? []).filter((c) => !c.picked);
    const slotCards  = (this.val<CardView[]>("slotCards")  ?? []);
    const isMatching = this.bool("isMatching");

    const currentPileLen = pileCards.length;
    const currentSlotLen = slotCards.length;

    // ── Detect match-3 elimination: slot count dropped by 3 ─────────────────
    if (!isMatching && this.prevSlotLen === 3 && currentSlotLen === 0) {
      this.animateMatchClear();
    }

    this.prevPileLen = currentPileLen;
    this.prevSlotLen = currentSlotLen;

    this.rebuildPile(pileCards);
    this.rebuildTray(slotCards);
    this.updateTools();
    this.updateProgress(pileCards, slotCards);
  }

  private rebuildPile(pileCards: CardView[]): void {
    // Clear existing pile sprites
    this.pileContainer.removeAll(true);

    if (pileCards.length === 0) return;

    const W = this.scale.width;
    const difficulty = this.num("gameDifficulty", 0);

    // Columns per layer based on difficulty
    const numCols = difficulty === 2 ? 5 : 4;

    // Sort: render layer 2 first (back), then 1, then 0 (front)
    const byLayer: CardView[][] = [[], [], []];
    for (const card of pileCards) {
      const l = Math.min(2, Math.max(0, card.layer));
      byLayer[l]!.push(card);
    }

    const cx = W / 2;
    // pile base y — cards stack upward from here
    const pileBaseY = this.scale.height * TRAY_Y_FRAC - 46;

    // Render order: layer 2 → 1 → 0
    for (let layerIdx = 2; layerIdx >= 0; layerIdx--) {
      const layerCards = byLayer[layerIdx] ?? [];
      if (layerCards.length === 0) continue;

      // Each layer is shifted slightly up and right for 3-D stacking
      const layerXShift = (2 - layerIdx) * 3;
      const layerYShift = (2 - layerIdx) * 16;

      const gridW = numCols * CARD_STEP_X;
      const gridLeft = cx - gridW / 2 + CARD_STEP_X / 2;

      layerCards.forEach((card, idx) => {
        const col = idx % numCols;
        const row = Math.floor(idx / numCols);
        const nRows = Math.ceil(layerCards.length / numCols);

        // Cards in bottom row have larger y (lower on screen)
        const rowFromBottom = nRows - 1 - row;
        const x = gridLeft + col * CARD_STEP_X + layerXShift;
        const y = pileBaseY - rowFromBottom * (CARD_STEP_Y * 0.72) - layerYShift;

        const sprite = this.makeCardSprite(card);
        sprite.setPosition(x, y);
        this.pileContainer.add(sprite);
      });
    }
  }

  private makeCardSprite(card: CardView): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const bgColor     = card.exposed ? C.card     : C.cardBlocked;
    const borderColor = card.exposed ? C.cardBorder : C.cardBorderB;
    const alpha       = card.exposed ? 1 : 0.75;

    // Card body
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, bgColor)
      .setStrokeStyle(2, borderColor)
      .setAlpha(alpha)
      .setOrigin(0.5);

    // Symbol drawn with graphics
    const symG = this.add.graphics();
    SheepScene.drawCardSymbol(symG, card.symbol, 0, -2, 14, card.exposed ? 1 : 0.55);

    c.add([bg, symG]);

    if (card.exposed) {
      bg.setInteractive({ useHandCursor: true });

      bg.on("pointerover", () => {
        bg.setStrokeStyle(3, C.goldLight);
        this.tweens.add({ targets: c, scaleX: 1.07, scaleY: 1.07, duration: 80 });
      });
      bg.on("pointerout", () => {
        bg.setStrokeStyle(2, borderColor);
        this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 80 });
      });
      bg.on("pointerdown", () => {
        if (this.ghostInFlight) return;
        this.handleCardClick(card, c);
      });
    }

    return c;
  }

  private handleCardClick(card: CardView, sprite: Phaser.GameObjects.Container): void {
    const slotCards = (this.val<CardView[]>("slotCards") ?? []);
    if (slotCards.length >= SLOT_COUNT) return;

    // Calculate target slot position
    const W = this.scale.width;
    const H = this.scale.height;
    const trayY   = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;
    const targetX = slotStartX + slotCards.length * slotStep;
    const targetY = trayY;

    // Create ghost card at current position for slide animation
    const worldPos = this.pileContainer.getWorldTransformMatrix().transformPoint(
      sprite.x, sprite.y,
    );
    const ghost = this.makeCardSprite({ ...card, exposed: true });
    ghost.setPosition(worldPos.x, worldPos.y);
    this.add.existing(ghost);
    ghost.setDepth(100);

    this.ghostInFlight = true;

    this.tween({
      targets: ghost,
      x: targetX,
      y: targetY,
      scaleX: (slotStep - 6) / CARD_W,
      scaleY: 58 / CARD_H,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => {
        ghost.destroy();
        this.ghostInFlight = false;
        this.dispatch("pickCard", { cardId: card.id });
      },
    });

    // Visual press feedback on original sprite
    this.tweens.add({ targets: sprite, alpha: 0.3, duration: 120 });
  }

  private rebuildTray(slotCards: CardView[]): void {
    this.trayContainer.removeAll(true);

    const W = this.scale.width;
    const H = this.scale.height;
    const trayY    = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;

    const slotW = slotStep - 6;

    slotCards.forEach((card, idx) => {
      if (idx >= SLOT_COUNT) return;
      const x = slotStartX + idx * slotStep;
      const c = this.add.container(x, trayY);

      const bg = this.add.rectangle(0, 0, slotW, 58, C.card)
        .setStrokeStyle(2, C.cardBorder)
        .setOrigin(0.5);

      const symG = this.add.graphics();
      SheepScene.drawCardSymbol(symG, card.symbol, 0, -2, 12, 1);

      c.add([bg, symG]);
      this.trayContainer.add(c);
    });
  }

  /** Flash + scale-down animation for tray cards being removed on a match. */
  private animateMatchClear(): void {
    const H = this.scale.height;
    const W = this.scale.width;
    const trayY    = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;

    // Pop-burst the 3 slot cards (they're already rebuilt at this point)
    // So we create brief visual "pop" particles at each slot position
    for (let i = 0; i < 3; i++) {
      const px = slotStartX + i * slotStep;
      const pop = this.add.graphics();
      pop.fillStyle(0xffd700, 0.9);
      pop.fillCircle(px, trayY, 10);
      pop.fillStyle(0xfff8e8, 0.8);
      pop.fillCircle(px, trayY, 4);
      this.tween({
        targets: pop,
        y: trayY - 40,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 500,
        ease: "Quad.easeOut",
        onComplete: () => pop.destroy(),
      });
    }
  }

  private updateTools(): void {
    const undosUsed   = this.num("undosUsed", 0);
    const shuffleLeft = this.num("shuffleLeft", 1);
    const remove3Left = this.num("remove3Left", 1);
    const status      = this.str("gameStatus", "idle");
    const isActive    = status === "dealt";

    const undoAvail    = isActive && undosUsed < 3;
    const shuffleAvail = isActive && shuffleLeft > 0;
    const remove3Avail = isActive && remove3Left > 0;

    this.setToolBtnActive(this.undoBtn,    undoAvail);
    this.setToolBtnActive(this.shuffleBtn, shuffleAvail);
    this.setToolBtnActive(this.remove3Btn, remove3Avail);

    // Update count labels
    const undosLeft = Math.max(0, 3 - undosUsed);
    this.undoCountTxt.setText(String(undosLeft)).setColor(undoAvail ? "#7dd87d" : "#666655");
    this.shuffleCountTxt.setText(String(shuffleLeft)).setColor(shuffleAvail ? "#7dd87d" : "#666655");
    this.remove3CountTxt.setText(String(remove3Left)).setColor(remove3Avail ? "#7dd87d" : "#666655");
  }

  private setToolBtnActive(btn: Phaser.GameObjects.Container, active: boolean): void {
    const bg  = btn.list[0] as Phaser.GameObjects.Rectangle;
    const txt = btn.list[1] as Phaser.GameObjects.Text;
    bg.setFillStyle(active ? C.btnBg : C.btnDisabled);
    bg.setStrokeStyle(2, active ? C.btnBorder : 0x555544);
    txt.setColor(active ? "#f0c866" : "#666655");
    (bg as Phaser.GameObjects.Rectangle & { input: { enabled: boolean } }).input.enabled = active;
  }

  private updateProgress(pileCards: CardView[], slotCards: CardView[]): void {
    const difficulty  = this.num("gameDifficulty", 0);
    const cardTypes   = difficulty === 2 ? 15 : difficulty === 1 ? 12 : 8;
    const totalCards  = cardTypes * 3;
    const remaining   = pileCards.length + slotCards.length;
    const matched     = totalCards - remaining;

    this.progressLabel.setText(`Pile: ${pileCards.length}  ·  Tray: ${slotCards.length}/${SLOT_COUNT}`);
    this.matchedLabel.setText(`✓ ${matched}/${totalCards}`);
  }

  private updateResultScreen(): void {
    const status  = this.str("gameStatus", "idle");
    const payout  = this.str("lastPayout", "");
    const isGameOver = this.bool("isGameOver");

    if (status === "solved") {
      this.resultTitle.setText("🎉  You Won!").setColor("#f0c866");
      this.resultSub.setText(payout ? `Payout: ${payout}` : "Board cleared!");
      this.resultActionTxt.setText("Claim & Play Again");
      this.resultActionBg.setFillStyle(C.green);
      this.resultActionBg.off("pointerdown");
      this.resultActionBg.on("pointerdown", () => this.dispatch("submitRun"));
    } else if (isGameOver) {
      this.resultTitle.setText("😢  Game Over").setColor("#e25d4d");
      this.resultSub.setText("Tray is full — no more moves!");
      this.resultActionTxt.setText("Try Again");
      this.resultActionBg.setFillStyle(C.btnBg);
      this.resultActionBg.off("pointerdown");
      this.resultActionBg.on("pointerdown", () => this.dispatch("expireGame"));
    }

    // Entrance animation on first show
    this.resultGroup.setAlpha(0).setScale(0.85);
    this.tweens.add({
      targets: this.resultGroup,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      ease: "Back.easeOut",
    });
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  protected onResize(_gameSize: Phaser.Structs.Size): void {
    this.scene.restart();
  }

  /**
   * Draw a symbol for a given index (0–14) at absolute coordinates (cx, cy)
   * with a given radius `r`. Uses 15 distinct geometric shapes + colors.
   */
  static drawCardSymbol(
    g: Phaser.GameObjects.Graphics,
    symbolIdx: number,
    cx: number,
    cy: number,
    r: number,
    alpha = 1,
  ): void {
    g.clear();
    // 15 symbol types: each has a unique shape + color combination
    const DEFS: Array<{ color: number; shape: string }> = [
      { color: 0xf87171, shape: "circle"   },  // 0 red circle
      { color: 0xfbbf24, shape: "diamond"  },  // 1 amber diamond
      { color: 0x34d399, shape: "triangle" },  // 2 green triangle
      { color: 0x60a5fa, shape: "square"   },  // 3 blue square
      { color: 0xc084fc, shape: "star"     },  // 4 purple star
      { color: 0xf97316, shape: "cross"    },  // 5 orange cross
      { color: 0x38bdf8, shape: "hexagon"  },  // 6 sky hexagon
      { color: 0xfb7185, shape: "heart"    },  // 7 rose heart
      { color: 0xa3e635, shape: "ring"     },  // 8 lime ring
      { color: 0xe879f9, shape: "moon"     },  // 9 fuchsia crescent
      { color: 0xfde68a, shape: "sun"      },  // 10 yellow sun
      { color: 0x6ee7b7, shape: "leaf"     },  // 11 mint leaf
      { color: 0xf9a8d4, shape: "flower"   },  // 12 pink flower
      { color: 0x93c5fd, shape: "drop"     },  // 13 blue drop
      { color: 0xfcd34d, shape: "bolt"     },  // 14 yellow bolt
    ];
    const def = DEFS[symbolIdx % DEFS.length] ?? DEFS[0]!;
    g.fillStyle(def.color, alpha);
    g.lineStyle(1, 0xffffff, alpha * 0.4);

    switch (def.shape) {
      case "circle":
        g.fillCircle(cx, cy, r);
        g.strokeCircle(cx, cy, r);
        break;
      case "diamond":
        g.fillPoints([
          { x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy },
          { x: cx, y: cy + r }, { x: cx - r * 0.7, y: cy },
        ] as Phaser.Types.Math.Vector2Like[], true);
        break;
      case "triangle":
        g.fillTriangle(cx, cy - r, cx + r, cy + r * 0.6, cx - r, cy + r * 0.6);
        break;
      case "square":
        g.fillRect(cx - r * 0.78, cy - r * 0.78, r * 1.56, r * 1.56);
        break;
      case "star": {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let p = 0; p < 10; p++) {
          const a = Phaser.Math.DegToRad(p * 36 - 90);
          const rr = p % 2 === 0 ? r : r * 0.45;
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
        }
        g.fillPoints(pts, true);
        break;
      }
      case "cross":
        g.fillRect(cx - r * 0.3, cy - r, r * 0.6, r * 2);
        g.fillRect(cx - r, cy - r * 0.3, r * 2, r * 0.6);
        break;
      case "hexagon": {
        const hp: Phaser.Types.Math.Vector2Like[] = [];
        for (let h = 0; h < 6; h++) {
          const a = Phaser.Math.DegToRad(h * 60 - 30);
          hp.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        g.fillPoints(hp, true);
        break;
      }
      case "heart": {
        // Simple heart approximation
        const hr = r * 0.55;
        g.fillCircle(cx - hr, cy - r * 0.2, hr);
        g.fillCircle(cx + hr, cy - r * 0.2, hr);
        g.fillTriangle(cx - r, cy - r * 0.2, cx + r, cy - r * 0.2, cx, cy + r);
        break;
      }
      case "ring":
        g.strokeCircle(cx, cy, r);
        g.lineStyle(r * 0.4, def.color, alpha);
        g.strokeCircle(cx, cy, r * 0.7);
        break;
      case "moon":
        g.fillCircle(cx, cy, r);
        g.fillStyle(0xfff8e8, alpha);
        g.fillCircle(cx + r * 0.45, cy - r * 0.25, r * 0.72);
        break;
      case "sun":
        g.fillCircle(cx, cy, r * 0.55);
        g.lineStyle(r * 0.35, def.color, alpha);
        for (let s = 0; s < 8; s++) {
          const a = Phaser.Math.DegToRad(s * 45);
          g.lineBetween(
            cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65,
            cx + Math.cos(a) * r, cy + Math.sin(a) * r,
          );
        }
        break;
      case "leaf":
        g.fillEllipse(cx, cy, r * 1.2, r * 1.9);
        g.lineStyle(1, 0xffffff, alpha * 0.5);
        g.lineBetween(cx, cy - r * 0.85, cx, cy + r * 0.85);
        break;
      case "flower":
        for (let p = 0; p < 6; p++) {
          const fa = Phaser.Math.DegToRad(p * 60);
          g.fillEllipse(cx + Math.cos(fa) * r * 0.5, cy + Math.sin(fa) * r * 0.5, r * 0.7, r);
        }
        g.fillStyle(0xffffff, alpha * 0.8);
        g.fillCircle(cx, cy, r * 0.35);
        break;
      case "drop":
        g.fillEllipse(cx, cy + r * 0.2, r * 1.4, r * 1.2);
        g.fillTriangle(cx - r * 0.5, cy, cx + r * 0.5, cy, cx, cy - r);
        break;
      case "bolt":
        g.fillPoints([
          { x: cx + r * 0.2, y: cy - r }, { x: cx - r * 0.2, y: cy },
          { x: cx + r * 0.4, y: cy }, { x: cx - r * 0.2, y: cy + r },
          { x: cx + r * 0.2, y: cy + r * 0.1 }, { x: cx - r * 0.4, y: cy + r * 0.1 },
        ] as Phaser.Types.Math.Vector2Like[], true);
        break;
      default:
        g.fillCircle(cx, cy, r);
    }
  }
}
