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

import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

const DIFFICULTY_LABELS = ["Easy", "Medium", "Hard"] as const;
const DIFFICULTY_ENTRY   = ["0.02 GAS", "0.10 GAS", "0.20 GAS"] as const;
const DIFFICULTY_REWARD  = ["0.10 GAS", "0.50 GAS", "1.00 GAS"] as const;
const DIFFICULTY_TIMER   = ["5:00",     "8:00",     "12:00"] as const;

const SHEEP_ASSETS = {
  table: "sheep-meadow-table",
  tray: "sheep-slot-tray",
  mascot: "sheep-mascot",
  badges: ["sheep-badge-easy", "sheep-badge-medium", "sheep-badge-hard"],
  tiles: [
    "sheep-tile-wool-flower",
    "sheep-tile-apple",
    "sheep-tile-orange",
    "sheep-tile-lemon",
    "sheep-tile-grape",
    "sheep-tile-strawberry",
    "sheep-tile-peach",
    "sheep-tile-cherry",
    "sheep-tile-star",
    "sheep-tile-bell",
    "sheep-tile-target",
    "sheep-tile-ribbon",
    "sheep-tile-crystal",
    "sheep-tile-tent",
    "sheep-tile-carousel",
  ],
} as const;

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
  panel:       0xfff8e8,
  ink:         0x2f281d,
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
const TILE_ART_SIZE = 54;
const CARD_STEP_X = 53;
const CARD_STEP_Y = 63;
const TRAY_Y_FRAC = 0.625;
const TOOLS_Y_FRAC = 0.745;
const STATUS_Y_FRAC = 0.835;
const SLOT_COUNT = 7;
const DESIGN_W = 400;
const DESIGN_H = 640;
const FONT = "Inter, Arial, sans-serif";

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
  private sceneBackdrop!:    Phaser.GameObjects.Rectangle;
  private stagePanel!:       Phaser.GameObjects.Rectangle;
  private stageFrame!:       Phaser.GameObjects.Graphics;
  private tallMeadow!:       Phaser.GameObjects.Graphics;

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
  private resultAnimationKey = "";

  constructor() {
    super("SheepScene");
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload(): void {
    this.load.image(SHEEP_ASSETS.table, "./art/meadow-table.webp");
    this.load.image(SHEEP_ASSETS.tray, "./art/slot-tray.webp");
    this.load.image(SHEEP_ASSETS.mascot, "./art/mascot-sheep.webp");
    this.load.image(SHEEP_ASSETS.badges[0], "./art/badge-easy.webp");
    this.load.image(SHEEP_ASSETS.badges[1], "./art/badge-medium.webp");
    this.load.image(SHEEP_ASSETS.badges[2], "./art/badge-hard.webp");
    this.load.image(SHEEP_ASSETS.tiles[0], "./art/tile-00-wool-flower.webp");
    this.load.image(SHEEP_ASSETS.tiles[1], "./art/tile-01-apple.webp");
    this.load.image(SHEEP_ASSETS.tiles[2], "./art/tile-02-orange.webp");
    this.load.image(SHEEP_ASSETS.tiles[3], "./art/tile-03-lemon.webp");
    this.load.image(SHEEP_ASSETS.tiles[4], "./art/tile-04-grape.webp");
    this.load.image(SHEEP_ASSETS.tiles[5], "./art/tile-05-strawberry.webp");
    this.load.image(SHEEP_ASSETS.tiles[6], "./art/tile-06-peach.webp");
    this.load.image(SHEEP_ASSETS.tiles[7], "./art/tile-07-cherry.webp");
    this.load.image(SHEEP_ASSETS.tiles[8], "./art/tile-08-star.webp");
    this.load.image(SHEEP_ASSETS.tiles[9], "./art/tile-09-bell.webp");
    this.load.image(SHEEP_ASSETS.tiles[10], "./art/tile-10-target.webp");
    this.load.image(SHEEP_ASSETS.tiles[11], "./art/tile-11-ribbon.webp");
    this.load.image(SHEEP_ASSETS.tiles[12], "./art/tile-12-crystal.webp");
    this.load.image(SHEEP_ASSETS.tiles[13], "./art/tile-13-tent.webp");
    this.load.image(SHEEP_ASSETS.tiles[14], "./art/tile-14-carousel.webp");
  }

  create(): void {
    super.create();

    this.buildBackground(DESIGN_W, DESIGN_H);
    this.buildLobby(DESIGN_W, DESIGN_H);
    this.buildLoadScreen(DESIGN_W, DESIGN_H);
    this.buildGameScreen(DESIGN_W, DESIGN_H);
    this.buildResultScreen(DESIGN_W, DESIGN_H);
    this.fitCameraToHost();

    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    const status     = this.str("gameStatus", "idle");
    const isStarting = this.bool("isStarting");
    const isDealing  = this.bool("isDealing");
    const isGameOver = this.bool("isGameOver");

    const showLobby  = (status === "idle" || status === "expired" || status === "refunded") && !isStarting && !isDealing;
    const showLoad   = isStarting || isDealing || status === "committed";
    const showResult = status === "solved" || (status === "dealt" && isGameOver);
    const showGame   = status === "dealt" && !isGameOver;

    this.setGroupActive(this.lobbyGroup, showLobby && !showLoad);
    this.setGroupActive(this.loadGroup, showLoad);
    this.setGroupActive(this.gameGroup, showGame);
    this.setGroupActive(this.resultGroup, showResult);

    this.currentStatus = status;
    if (!showResult) this.resultAnimationKey = "";

    if (showGame)   this.updateGameScreen();
    if (showResult) this.updateResultScreen();

    // Always keep status visible when game is shown
    this.statusLabel?.setText(this.str("lastStatus", ""));
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private buildBackground(W: number, H: number): void {
    this.sceneBackdrop = this.add.rectangle(W / 2, H / 2, W, H, 0xfffbef);
    this.stagePanel = this.add.rectangle(W / 2, H / 2, W - 18, H - 18, 0xf8f0dc)
      .setStrokeStyle(2, 0xe7d19b);

    const table = this.add.image(W / 2, H * 0.36, SHEEP_ASSETS.table)
      .setDisplaySize(W - 18, 148)
      .setAlpha(0.98);
    table.setDepth(0);

    this.add.rectangle(W / 2, H * 0.36, W - 24, 150, 0xffffff, 28)
      .setStrokeStyle(1, 0xffffff, 50);
    this.add.rectangle(W / 2, 78, W - 38, 74, C.panel, 235)
      .setStrokeStyle(1, 0xe7d19b);
    this.tallMeadow = this.add.graphics();
    this.stageFrame = this.add.graphics();
    this.renderResponsiveStage(H, H / 2);
  }

  private renderResponsiveStage(visibleWorldH: number, centerY: number): void {
    if (!this.sceneBackdrop || !this.stagePanel || !this.stageFrame || !this.tallMeadow) return;

    const viewTop = centerY - visibleWorldH / 2;
    const viewBottom = centerY + visibleWorldH / 2;
    const stageTop = Math.min(0, viewTop - 12);
    const stageBottom = Math.max(DESIGN_H, Math.min(viewBottom + 10, DESIGN_H + 170));
    const stageHeight = stageBottom - stageTop;

    this.sceneBackdrop
      .setPosition(DESIGN_W / 2, stageTop + stageHeight / 2)
      .setDisplaySize(DESIGN_W, stageHeight);
    this.stagePanel
      .setPosition(DESIGN_W / 2, stageTop + stageHeight / 2)
      .setDisplaySize(DESIGN_W - 18, Math.max(1, stageHeight - 18));

    this.tallMeadow.clear();
    if (stageBottom > DESIGN_H + 20) {
      const meadowTop = DESIGN_H - 10;
      const meadowHeight = stageBottom - meadowTop - 8;
      this.tallMeadow.fillStyle(0xf4efdb, 0.98);
      this.tallMeadow.fillRoundedRect(18, meadowTop, DESIGN_W - 36, meadowHeight, {
        tl: 20,
        tr: 20,
        bl: 0,
        br: 0,
      });
      this.tallMeadow.fillStyle(0xd9edb7, 0.72);
      this.tallMeadow.fillEllipse(DESIGN_W * 0.32, meadowTop + 42, 150, 30);
      this.tallMeadow.fillEllipse(DESIGN_W * 0.68, meadowTop + 68, 170, 34);
      this.tallMeadow.lineStyle(1, 0xb5cc85, 0.42);
      for (let x = 42; x < DESIGN_W - 18; x += 44) {
        this.tallMeadow.lineBetween(x, meadowTop + 28, x - 18, stageBottom - 28);
      }
    }

    this.stageFrame.clear();
    this.stageFrame.lineStyle(2, 0xe7d19b, 0.9);
    this.stageFrame.strokeRoundedRect(9, 9, DESIGN_W - 18, stageBottom - 18, 18);
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────

  private buildLobby(W: number, _H: number): void {
    this.lobbyGroup = this.add.container(0, 0);

    const mascot = this.add.image(W / 2 - 130, 57, SHEEP_ASSETS.mascot)
      .setDisplaySize(52, 52);

    const headerTextX = W / 2 + 38;
    const title = this.add.text(headerTextX, 52, "Sheep Solitaire", {
      fontFamily: FONT,
      fontSize: "21px",
      fontStyle: "700",
      color: "#2f281d",
    }).setOrigin(0.5);

    const sub = this.add.text(headerTextX, 82, "Match 3 tiles to clear the board", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a6544",
      wordWrap: { width: 230 },
      align: "center",
    }).setOrigin(0.5);

    this.lobbyGroup.add([mascot, title, sub]);

    // 3 difficulty cards
    const cardTopY = 184;
    const cardH    = 132;
    const gap      = 12;
    const cardW    = W - 60;
    const cx       = W / 2;

    const diffColors  = [0xfffbef, 0xfff7df, 0xffefe2];
    const diffBorders = [0x9aca76, 0xdab159, 0xe78b77];

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

    const badge = this.add.image(cx - w / 2 + 54, cy - 36, SHEEP_ASSETS.badges[difficulty] ?? SHEEP_ASSETS.badges[0])
      .setDisplaySize(58, 58);

    const label = this.add.text(cx - 4, cy - 48, DIFFICULTY_LABELS[difficulty]!, {
      fontFamily: FONT,
      fontSize: "20px",
      fontStyle: "700",
      color: "#2f281d",
    }).setOrigin(0.5);

    const cardTypes = difficulty === 0 ? 8 : difficulty === 1 ? 12 : 15;
    const infoText  = `${cardTypes} tile types  ·  ${DIFFICULTY_TIMER[difficulty]}`;
    const infoLabel = this.add.text(cx - 4, cy - 18, infoText, {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#7a6544",
    }).setOrigin(0.5);

    const entryLabel = this.add.text(cx - w / 2 + 112, cy + 12, `Entry ${DIFFICULTY_ENTRY[difficulty]}`, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#8f6a20",
    }).setOrigin(0, 0.5);

    const rewardLabel = this.add.text(cx + w / 2 - 22, cy + 12, `Win ${DIFFICULTY_REWARD[difficulty]}`, {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "700",
      color: "#217d4d",
    }).setOrigin(1, 0.5);

    // Preview real tile assets.
    const tileCount = Math.min(cardTypes, 8);
    const tileStartX = cx - (tileCount / 2 - 0.5) * 30;
    const previewLabels: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < tileCount; i++) {
      const tile = this.add.image(tileStartX + i * 30, cy + 46, this.tileAssetKey(i))
        .setDisplaySize(30, 30);
      previewLabels.push(tile);
    }

    const onHoverIn = () => {
      bg.setStrokeStyle(3, C.goldLight);
      this.tweens.add({ targets: bg, scaleX: 1.01, scaleY: 1.01, duration: 80 });
    };
    const onHoverOut = () => {
      bg.setStrokeStyle(2, borderColor);
      this.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 80 });
    };
    const onPress = () => {
      this.tweens.add({ targets: bg, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true });
      this.dispatch("startGame", { difficulty });
    };
    const bindStart = (target: Phaser.GameObjects.GameObject) => {
      target.setInteractive({ useHandCursor: true });
      target.on("pointerover", onHoverIn);
      target.on("pointerout", onHoverOut);
      target.on("pointerdown", onPress);
    };
    [bg, badge, label, infoLabel, entryLabel, rewardLabel, ...previewLabels].forEach(bindStart);

    this.lobbyGroup.add([bg, badge, label, infoLabel, entryLabel, rewardLabel, ...previewLabels]);
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  private buildLoadScreen(W: number, H: number): void {
    this.loadGroup = this.add.container(0, 0);

    const bg = this.add.rectangle(W / 2, H / 2, W - 40, 140, C.panel)
      .setStrokeStyle(2, C.gold);

    const spinner = this.add.container(W / 2, H / 2 - 28);
    const spinnerArt = this.add.image(0, 0, SHEEP_ASSETS.mascot)
      .setDisplaySize(70, 70);
    spinner.add(spinnerArt);

    const loadText = this.add.text(W / 2, H / 2 + 24, "Preparing your board…", {
      fontFamily: FONT,
      fontSize: "16px",
      color: "#2f281d",
    }).setOrigin(0.5);

    const subText = this.add.text(W / 2, H / 2 + 48, "Securing puzzle on-chain", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7a6544",
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
      fontFamily: FONT,
      fontSize: "13px",
      color: "#c8d8b0",
    }).setOrigin(0.5);
    this.gameGroup.add(this.progressLabel);

    // ── Tray background ──────────────────────────────────────────────────────
    const trayY = H * TRAY_Y_FRAC;
    const trayBg = this.add.image(W / 2, trayY, SHEEP_ASSETS.tray)
      .setDisplaySize(W - 12, 76);
    this.gameGroup.add(trayBg);

    // Tray label
    const trayLabel = this.add.text(16, trayY - 46, "Tray", {
      fontFamily: FONT,
      fontSize: "11px",
      color: "#8f6a20",
    }).setAlpha(0.8);
    this.gameGroup.add(trayLabel);

    // Slot outlines (7 static slots)
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = slotStartX + i * slotStep;
      const slotBox = this.add.rectangle(sx, trayY, slotStep - 8, 56, 0xffffff, 8)
        .setStrokeStyle(1, 0xd8bd81, 0.35)
        .setAlpha(0.18);
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
      fontFamily: FONT,
      fontSize: "12px",
      color: "#a0c090",
      wordWrap: { width: W - 40 },
      align: "center",
    }).setOrigin(0.5);
    this.gameGroup.add(this.statusLabel);

    // ── Matched counter ──────────────────────────────────────────────────────
    this.matchedLabel = this.add.text(W - 18, 30, "", {
      fontFamily: FONT,
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

    this.undoBtn    = this.makeToolBtn(startX,              toolY, "Undo",    "0", () => this.dispatch("useUndo"));
    this.shuffleBtn = this.makeToolBtn(startX + btnW + gap, toolY, "Shuffle", "1", () => this.dispatch("useShuffle"));
    this.remove3Btn = this.makeToolBtn(startX + 2*(btnW+gap), toolY, "Clear 3", "1", () => this.dispatch("useRemove3"));

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
      fontFamily: FONT,
      fontSize: "13px",
      color: "#f0c866",
    }).setOrigin(0.5);

    const countTxt = this.add.text(36, -16, countStr, {
      fontFamily: FONT,
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
      fontFamily: FONT,
      fontSize: "32px",
      fontStyle: "700",
      color: "#f0c866",
    }).setOrigin(0.5);

    this.resultSub = this.add.text(W / 2, H / 2 - 22, "", {
      fontFamily: FONT,
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
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "700",
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

    const W = DESIGN_W;
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
    const pileBaseY = DESIGN_H * TRAY_Y_FRAC - 46;

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

    const alpha = card.exposed ? 1 : 0.58;
    const shadow = this.add.ellipse(0, CARD_H / 2 - 3, CARD_W * 0.78, 8, 0x000000, 0.14);
    const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
      .setDisplaySize(TILE_ART_SIZE, TILE_ART_SIZE)
      .setAlpha(alpha);

    if (!card.exposed) {
      tile.setTint(0x9f927d);
    }

    c.add([shadow, tile]);

    if (card.exposed) {
      tile.setInteractive({ useHandCursor: true });

      tile.on("pointerover", () => {
        tile.clearTint();
        this.tweens.add({ targets: c, scaleX: 1.07, scaleY: 1.07, duration: 80 });
      });
      tile.on("pointerout", () => {
        this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 80 });
      });
      tile.on("pointerdown", () => {
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
    const W = DESIGN_W;
    const H = DESIGN_H;
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

    const W = DESIGN_W;
    const H = DESIGN_H;
    const trayY    = H * TRAY_Y_FRAC;
    const slotStep = (W - 32) / SLOT_COUNT;
    const slotStartX = 16 + slotStep / 2;

    const slotW = slotStep - 6;

    slotCards.forEach((card, idx) => {
      if (idx >= SLOT_COUNT) return;
      const x = slotStartX + idx * slotStep;
      const c = this.add.container(x, trayY);

      const bg = this.add.ellipse(0, 25, slotW * 0.78, 8, 0x000000, 0.1);
      const tile = this.add.image(0, 0, this.tileAssetKey(card.symbol))
        .setDisplaySize(48, 48);

      c.add([bg, tile]);
      this.trayContainer.add(c);
    });
  }

  /** Flash + scale-down animation for tray cards being removed on a match. */
  private animateMatchClear(): void {
    const H = DESIGN_H;
    const W = DESIGN_W;
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
    const deadline    = this.num("deadline", 0);
    const clock       = deadline > 0 ? `Time ${this.formatTimeLeft(deadline)}` : "Time --";

    this.progressLabel.setText(`${clock}  ·  Pile: ${pileCards.length}  ·  Tray: ${slotCards.length}/${SLOT_COUNT}`);
    this.matchedLabel.setText(`Matched ${matched}/${totalCards}`);
  }

  private updateResultScreen(): void {
    const status  = this.str("gameStatus", "idle");
    const payout  = this.str("lastPayout", "");
    const isGameOver = this.bool("isGameOver");
    const activeGameId = this.str("activeGameId", "0");
    const credit = this.num("credit", 0);
    const canSettle = status === "solved" && activeGameId !== "0";

    if (status === "solved") {
      this.resultTitle.setText(canSettle ? "You Won" : "Reward Credited").setColor("#f0c866");
      this.resultSub.setText(
        canSettle
          ? (payout ? `Payout: ${payout}` : "Board cleared!")
          : credit > 0
          ? `${credit.toFixed(2)} GAS is ready to withdraw`
          : "Board verified on-chain",
      );
      this.resultActionTxt.setText(canSettle ? "Claim Reward" : credit > 0 ? "Withdraw" : "Back to Routes");
      this.resultActionBg.setFillStyle(C.green);
      this.resultActionBg.off("pointerdown");
      this.resultActionBg.on("pointerdown", () => {
        if (canSettle) {
          this.dispatch("submitRun");
        } else if (credit > 0) {
          this.dispatch("withdrawWinnings", {});
        } else {
          this.dispatch("returnToLobby");
        }
      });
    } else if (isGameOver) {
      this.resultTitle.setText("Game Over").setColor("#e25d4d");
      this.resultSub.setText("Tray is full — no more moves!");
      this.resultActionTxt.setText("Try Again");
      this.resultActionBg.setFillStyle(C.btnBg);
      this.resultActionBg.off("pointerdown");
      this.resultActionBg.on("pointerdown", () => this.dispatch("expireGame"));
    }

    const animationKey = `${status}:${isGameOver ? "gameover" : "ok"}:${activeGameId}:${credit > 0 ? "credit" : "no-credit"}`;
    if (this.resultAnimationKey !== animationKey) {
      this.resultAnimationKey = animationKey;
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
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  protected onResize(): void {
    this.fitCameraToHost();
  }

  private setGroupActive(group: Phaser.GameObjects.Container, active: boolean): void {
    this.setObjectActive(group, active);
  }

  private setObjectActive(target: Phaser.GameObjects.GameObject, active: boolean): void {
    (target as Phaser.GameObjects.GameObject & { setVisible(visible: boolean): Phaser.GameObjects.GameObject })
      .setVisible(active);
    const interactiveTarget = target as Phaser.GameObjects.GameObject & {
      input?: { enabled: boolean } | null;
    };
    if (interactiveTarget.input) {
      interactiveTarget.input.enabled = active;
    }
    if (target instanceof Phaser.GameObjects.Container) {
      target.list.forEach((child) => this.setObjectActive(child as Phaser.GameObjects.GameObject, active));
    }
  }

  private tileAssetKey(symbolIdx: number): string {
    return SHEEP_ASSETS.tiles[Math.abs(symbolIdx) % SHEEP_ASSETS.tiles.length] ?? SHEEP_ASSETS.tiles[0];
  }

  private fitCameraToHost(): void {
    const viewW = Math.max(1, Math.round(this.scale.width || DESIGN_W));
    const viewH = Math.max(1, Math.round(this.scale.height || DESIGN_H));
    const zoom = Math.min(viewW / DESIGN_W, viewH / DESIGN_H);
    const visibleWorldH = viewH / zoom;
    const tallViewportLift = Math.max(0, visibleWorldH - DESIGN_H) * 0.34;
    const centerY = DESIGN_H / 2 + tallViewportLift;
    this.renderResponsiveStage(visibleWorldH, centerY);
    this.cameras.main
      .setViewport(0, 0, viewW, viewH)
      .setZoom(zoom)
      .centerOn(DESIGN_W / 2, centerY);
  }

  private formatTimeLeft(deadline: number): string {
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}
