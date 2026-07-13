import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameBridgeError, GameState } from "@framework/phaser";
import {
  BUFFER_CAPACITY,
  BOX_CAPACITY,
  MAX_UNDOS,
  SCREW_COLORS,
  allScrews,
  computeStars,
  currentBoxColor,
  isBoardCleared,
  isScrewUnlocked,
} from "../logic/screw-engine";
import type {
  BoardDefinition,
  MoveEvent,
  ScrewColor,
  ScrewDefinition,
  ScrewSession,
} from "../logic/screw-engine";

const DESIGN_W = 400;
const DESIGN_H = 680;
const FONT = "Inter, ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ASSETS = {
  workshop: "screw-workshop",
  plank: "screw-plank",
  screw: "screw-metal",
  toolbox: "screw-toolbox",
  tray: "screw-overflow-tray",
} as const;

type BoardVisual = {
  board: BoardDefinition;
  container: Phaser.GameObjects.Container;
  plank: Phaser.GameObjects.Image;
  screws: Map<string, Phaser.GameObjects.Image>;
  hitZones: Map<string, Phaser.GameObjects.Zone>;
};

type SceneLabels = {
  title: string;
  level: string;
  remaining: string;
  overflow: string;
  fiveSafe: string;
  moves: string;
  caseComplete: string;
  winTitle: string;
  winCopy: string;
  efficiencyCopy: string;
  bestStarsLabel: string;
  pausedTitle: string;
  pausedCopy: string;
  newPuzzle: string;
  restart: string;
  resume: string;
};

const FALLBACK_LABELS: SceneLabels = {
  title: "Screw Sort",
  level: "Level",
  remaining: "Remaining",
  overflow: "Overflow",
  fiveSafe: "5 safe · 6th loses",
  moves: "Moves",
  caseComplete: "Done",
  winTitle: "Workshop clear!",
  winCopy: "Every screw is home.",
  efficiencyCopy: "No undo, no overflow — a perfect clear.",
  bestStarsLabel: "Best",
  pausedTitle: "Take a workshop break",
  pausedCopy: "Your seeded puzzle is saved on this device.",
  newPuzzle: "New puzzle",
  restart: "Restart",
  resume: "Resume",
};

export class ScrewSortScene extends BaseScene {
  private sceneReady = false;
  private rebuilding = false;
  private widthPx = DESIGN_W;
  private heightPx = DESIGN_H;
  private currentSession: ScrewSession | null = null;
  private renderedSeed = "";
  private renderedRevision = -1;
  private inputLocked = false;
  private pendingScrewId: string | null = null;
  private pendingRevision = -1;
  private animatingRevision = -1;
  private moveUnlockTimer: Phaser.Time.TimerEvent | null = null;
  private moveEffectTimers = new Set<Phaser.Time.TimerEvent>();
  private moveEffectSprites = new Set<Phaser.GameObjects.Image>();

  private headerTitle!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private remainingText!: Phaser.GameObjects.Text;
  private overflowText!: Phaser.GameObjects.Text;
  private moveText!: Phaser.GameObjects.Text;
  private progressTrack!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private boxImages: Phaser.GameObjects.Image[] = [];
  private boxCounts: Phaser.GameObjects.Text[] = [];
  private boxMarkers: Phaser.GameObjects.Image[][] = [];
  private boardVisuals = new Map<string, BoardVisual>();
  private bufferSprites: Phaser.GameObjects.GameObject[] = [];
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayStars!: Phaser.GameObjects.Graphics;
  private overlayCopy!: Phaser.GameObjects.Text;
  private overlayButtonText!: Phaser.GameObjects.Text;
  private overlayAction: string | null = null;

  constructor() {
    super("ScrewSortScene");
  }

  preload(): void {
    BaseScene.preloadAssets(this, {
      [ASSETS.workshop]: "./art/workshop.webp",
      [ASSETS.plank]: "./art/plank.webp",
      [ASSETS.screw]: "./art/screw.webp",
      [ASSETS.toolbox]: "./art/toolbox.webp",
      [ASSETS.tray]: "./art/overflow-tray.webp",
    });
  }

  create(): void {
    super.create();
    this.syncSize();
    this.buildScene();
    this.sceneReady = true;
    this.onStateUpdate(this.state);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
  }

  protected onResize(): void {
    if (!this.sceneReady || this.rebuilding) return;
    this.rebuilding = true;
    this.time.delayedCall(0, () => {
      this.cancelMovePresentation();
      this.syncSize();
      this.children.removeAll(true);
      this.boardVisuals.clear();
      this.bufferSprites = [];
      this.boxImages = [];
      this.boxCounts = [];
      this.boxMarkers = [];
      this.buildScene();
      if (this.currentSession) {
        // Resize destroys every Phaser child, including board containers.
        // Recreate the layered playfield before syncing state; otherwise the
        // mobile host's first measured resize leaves a blank board.
        this.rebuildBoards(this.currentSession);
        this.syncSession(this.currentSession, false);
      }
      this.rebuilding = false;
    });
  }

  protected onStateUpdate(state: GameState): void {
    if (!this.sceneReady || this.rebuilding) return;
    const raw = state.gameSession;
    if (!raw || typeof raw !== "object") return;
    const session = raw as ScrewSession;
    if (!session.level || !session.core) return;

    const previous = this.currentSession;
    const seedChanged = session.level.seed !== this.renderedSeed;
    if (seedChanged) {
      this.cancelMovePresentation();
      this.releaseMoveLock();
      this.currentSession = session;
      this.renderedSeed = session.level.seed;
      this.renderedRevision = session.core.revision;
      this.rebuildBoards(session);
      this.syncSession(session, false);
      return;
    }

    const revisionChanged = session.core.revision !== this.renderedRevision;
    this.currentSession = session;
    this.syncSession(session, revisionChanged);
    const event = session.core.lastEvent;
    if (
      revisionChanged
      && event?.kind === "move"
      && (this.pendingRevision < 0 || session.core.revision > this.pendingRevision)
      && (!this.pendingScrewId || event.screwId === this.pendingScrewId)
    ) {
      this.pendingScrewId = null;
      this.pendingRevision = -1;
      this.animatingRevision = session.core.revision;
      this.playMoveAnimation(event, previous, session);
    } else if (revisionChanged) {
      this.cancelMovePresentation();
      this.releaseMoveLock();
    } else {
      const requestActive = Number.isInteger(state.moveRequestRevision);
      if (this.inputLocked && this.animatingRevision < 0 && !requestActive) {
        this.releaseMoveLock();
      }
    }
    this.renderedRevision = session.core.revision;
  }

  protected onBridgeError(error: GameBridgeError): void {
    if (error.action !== "selectScrew") return;
    this.cancelMovePresentation();
    this.releaseMoveLock();
    this.sfx.play("error");
  }

  private syncSize(): void {
    this.widthPx = Number(this.scale.width) || DESIGN_W;
    this.heightPx = Number(this.scale.height) || DESIGN_H;
  }

  private x(value: number): number {
    return (value / DESIGN_W) * this.widthPx;
  }

  private y(value: number): number {
    return (value / DESIGN_H) * this.heightPx;
  }

  private scaleX(value: number): number {
    return (value / DESIGN_W) * this.widthPx;
  }

  private scaleY(value: number): number {
    return (value / DESIGN_H) * this.heightPx;
  }

  private labels(): SceneLabels {
    const raw = this.state.sceneText;
    if (!raw || typeof raw !== "object") return FALLBACK_LABELS;
    const source = raw as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(FALLBACK_LABELS).map(([key, fallback]) => [
        key,
        typeof source[key] === "string" && String(source[key]).length > 0
          ? String(source[key])
          : fallback,
      ]),
    ) as unknown as SceneLabels;
  }

  private colorHex(color: ScrewColor): number {
    return SCREW_COLORS.find((entry) => entry.id === color)?.hex ?? 0xffffff;
  }

  private sizeScrew(image: Phaser.GameObjects.Image, logicalWidth: number): number {
    const baseScale = this.scaleX(logicalWidth) / Math.max(1, image.width);
    image.setScale(baseScale);
    image.setData("screwBaseScale", baseScale);
    return baseScale;
  }

  private buildScene(): void {
    const background = this.add.image(this.widthPx / 2, this.heightPx / 2, ASSETS.workshop);
    background.setDisplaySize(this.widthPx, this.heightPx).setDepth(-100);

    const headerShade = this.add.rectangle(
      this.widthPx / 2,
      this.y(35),
      this.widthPx,
      this.scaleY(70),
      0xfffbf2,
      0.72,
    ).setDepth(150);
    headerShade.setStrokeStyle(Math.max(1, this.scaleX(1)), 0xd9ae73, 0.3);

    this.headerTitle = this.add.text(this.x(18), this.y(18), this.labels().title, {
      fontFamily: FONT,
      fontSize: `${Math.max(18, this.scaleX(24))}px`,
      color: "#5f321b",
      fontStyle: "bold",
    }).setDepth(151);
    this.levelText = this.add.text(this.x(200), this.y(24), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(13, this.scaleX(15))}px`,
      color: "#6d4528",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setDepth(151);

    this.buildBoxes();
    this.buildOverflowTray();
    this.buildProgressHud();
    this.buildOverlay();
  }

  private buildBoxes(): void {
    for (let lane = 0; lane < 4; lane += 1) {
      const centerX = this.x(51 + lane * 99.4);
      const image = this.add.image(centerX, this.y(112), ASSETS.toolbox)
        .setDisplaySize(this.scaleX(84), this.scaleY(91))
        .setDepth(155);
      this.boxImages.push(image);

      const count = this.add.text(centerX, this.y(147), "0/3", {
        fontFamily: FONT,
        fontSize: `${Math.max(10, this.scaleX(11))}px`,
        color: "#4c2e1a",
        fontStyle: "bold",
        backgroundColor: "rgba(255,250,237,0.86)",
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(158);
      this.boxCounts.push(count);

      const markers: Phaser.GameObjects.Image[] = [];
      for (let slot = 0; slot < BOX_CAPACITY; slot += 1) {
        markers.push(
          this.add.image(centerX + this.scaleX((slot - 1) * 16), this.y(124), ASSETS.screw)
            .setDisplaySize(this.scaleX(13), this.scaleY(18))
            .setDepth(157)
            .setVisible(false),
        );
      }
      this.boxMarkers.push(markers);
    }
  }

  private buildOverflowTray(): void {
    this.add.image(this.widthPx / 2, this.y(185), ASSETS.tray)
      .setDisplaySize(this.scaleX(348), this.scaleY(62))
      .setDepth(160);
    this.add.text(this.widthPx / 2, this.y(216), this.labels().fiveSafe, {
      fontFamily: FONT,
      fontSize: `${Math.max(10, this.scaleX(11))}px`,
      color: "#704326",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(161);
  }

  private buildProgressHud(): void {
    this.remainingText = this.add.text(this.x(18), this.y(575), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(11, this.scaleX(12))}px`,
      color: "#5d371f",
      fontStyle: "bold",
    }).setDepth(180);
    this.overflowText = this.add.text(this.x(200), this.y(575), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(11, this.scaleX(12))}px`,
      color: "#5d371f",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setDepth(180);
    this.moveText = this.add.text(this.x(382), this.y(575), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(11, this.scaleX(12))}px`,
      color: "#5d371f",
      fontStyle: "bold",
    }).setOrigin(1, 0).setDepth(180);
    this.progressTrack = this.add.rectangle(
      this.widthPx / 2,
      this.y(598),
      this.scaleX(364),
      this.scaleY(7),
      0x5e3b25,
      0.18,
    ).setOrigin(0.5).setDepth(180);
    this.progressFill = this.add.rectangle(
      this.x(18),
      this.y(598),
      1,
      this.scaleY(7),
      0xd76a35,
      1,
    ).setOrigin(0, 0.5).setDepth(181);
  }

  private buildOverlay(): void {
    const shade = this.add.rectangle(
      0,
      0,
      this.widthPx,
      this.heightPx,
      0x3f2618,
      0.42,
    ).setOrigin(0);
    const panel = this.add.rectangle(
      this.widthPx / 2,
      this.y(390),
      this.scaleX(328),
      this.scaleY(190),
      0xfffbef,
      0.98,
    ).setStrokeStyle(Math.max(1, this.scaleX(2)), 0xc68a51, 0.8);
    this.overlayTitle = this.add.text(this.widthPx / 2, this.y(342), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(20, this.scaleX(25))}px`,
      color: "#5b311a",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5);
    this.overlayCopy = this.add.text(this.widthPx / 2, this.y(382), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(12, this.scaleX(13))}px`,
      color: "#71482d",
      align: "center",
      wordWrap: { width: this.scaleX(270) },
      lineSpacing: this.scaleY(3),
    }).setOrigin(0.5, 0);
    this.overlayStars = this.add.graphics();
    const button = this.add.rectangle(
      this.widthPx / 2,
      this.y(456),
      this.scaleX(156),
      this.scaleY(42),
      0xd76a35,
      1,
    ).setStrokeStyle(Math.max(1, this.scaleX(2)), 0x9a4925, 0.8);
    this.overlayButtonText = this.add.text(this.widthPx / 2, this.y(456), "", {
      fontFamily: FONT,
      fontSize: `${Math.max(13, this.scaleX(14))}px`,
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const hit = this.add.zone(
      this.widthPx / 2,
      this.y(456),
      this.scaleX(176),
      this.scaleY(50),
    ).setInteractive({ useHandCursor: true });
    this.bindGameButton(hit, {
      targets: [button, this.overlayButtonText],
      onPress: () => {
        if (this.overlayAction) this.dispatch(this.overlayAction);
      },
    });
    this.overlay = this.add.container(0, 0, [
      shade,
      panel,
      this.overlayTitle,
      this.overlayStars,
      this.overlayCopy,
      button,
      this.overlayButtonText,
      hit,
    ]).setDepth(300).setVisible(false);
  }

  private rebuildBoards(session: ScrewSession): void {
    for (const visual of this.boardVisuals.values()) visual.container.destroy(true);
    this.boardVisuals.clear();

    for (const board of [...session.level.boards].sort((left, right) => left.z - right.z)) {
      const container = this.add.container(this.x(board.x), this.y(board.y))
        .setRotation(Phaser.Math.DegToRad(board.angle))
        .setDepth(board.z);
      const plank = this.add.image(0, 0, ASSETS.plank)
        .setDisplaySize(this.scaleX(board.width), this.scaleY(board.height))
        .setTint(board.woodTint);
      // 2.5D — board drop shadow for stacked depth.
      const plankShadow = this.add.ellipse(
        0,
        this.scaleY(board.height * 0.5 + 7),
        this.scaleX(board.width * 0.96),
        this.scaleY(board.height * 0.5),
        0x2a1606,
        0.18,
      );
      container.add(plankShadow);
      container.add(plank);

      const screws = new Map<string, Phaser.GameObjects.Image>();
      const hitZones = new Map<string, Phaser.GameObjects.Zone>();
      for (const screw of board.screws) {
        const localX = this.scaleX((screw.slot - 1) * board.width * 0.31);
        // 2.5D — per-screw drop shadow + metallic specular highlight.
        const shadow = this.add.ellipse(
          localX + this.scaleX(2),
          this.scaleY(7),
          this.scaleX(30),
          this.scaleY(14),
          0x2a1606,
          0.22,
        );
        const image = this.add.image(localX, 0, ASSETS.screw)
          .setTint(this.colorHex(screw.color));
        const baseScale = this.sizeScrew(image, 31);
        const spec = this.add.ellipse(
          localX - this.scaleX(5),
          this.scaleY(-6),
          this.scaleX(11),
          this.scaleY(8),
          0xffffff,
          0.5,
        );
        const hit = this.add.zone(localX, 0, this.scaleX(48), this.scaleY(52))
          .setInteractive({ useHandCursor: true });
        this.bindGameButton(hit, {
          targets: image,
          idleScale: baseScale,
          hoverScale: baseScale * 1.08,
          pressScale: baseScale * 0.9,
          onPress: () => this.onScrewPress(screw, image),
        });
        screws.set(screw.id, image);
        hitZones.set(screw.id, hit);
        container.add([shadow, image, spec, hit]);
      }
      this.boardVisuals.set(board.id, { board, container, plank, screws, hitZones });
    }
  }

  private onScrewPress(screw: ScrewDefinition, image: Phaser.GameObjects.Image): void {
    const session = this.currentSession;
    if (!session || this.inputLocked || session.core.status !== "playing" || session.core.paused) return;
    if (!isScrewUnlocked(session.level, session.core, screw)) {
      this.sfx.unlock();
      this.sfx.play("error");
      this.animate({
        targets: image,
        angle: { from: -5, to: 5 },
        yoyo: true,
        repeat: 1,
        duration: 55,
      });
      this.dispatch("selectScrew", screw.id);
      return;
    }
    if (!this.reducedMotion) {
      // 2.5D — quick "unscrew" prep wiggle before the screw flies out.
      this.animate({
        targets: image,
        angle: { from: -10, to: 10 },
        yoyo: true,
        repeat: 1,
        duration: 55,
        onComplete: () => image.setAngle(0),
      });
    }
    this.requestScrewMove(screw);
  }

  private requestScrewMove(screw: ScrewDefinition): void {
    this.inputLocked = true;
    this.pendingScrewId = screw.id;
    this.pendingRevision = this.currentSession?.core.revision ?? -1;
    this.sfx.unlock();
    this.sfx.play("select");
    // Dispatch immediately. The screw flight, case pulse, terminal overlay, and
    // input release are all driven by the next authoritative engine revision.
    this.dispatch("selectScrew", screw.id);
  }

  private releaseMoveLock(): void {
    this.inputLocked = false;
    this.pendingScrewId = null;
    this.pendingRevision = -1;
    this.animatingRevision = -1;
    this.moveUnlockTimer?.remove(false);
    if (this.moveUnlockTimer) this.moveEffectTimers.delete(this.moveUnlockTimer);
    this.moveUnlockTimer = null;
  }

  private trackMoveSprite(sprite: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    this.moveEffectSprites.add(sprite);
    return sprite;
  }

  private destroyMoveSprite(sprite: Phaser.GameObjects.Image): void {
    this.moveEffectSprites.delete(sprite);
    if (sprite.active) sprite.destroy();
  }

  private scheduleMoveEffect(delay: number, callback: () => void): Phaser.Time.TimerEvent {
    const timer = this.time.delayedCall(delay, () => {
      this.moveEffectTimers.delete(timer);
      callback();
    });
    this.moveEffectTimers.add(timer);
    return timer;
  }

  private cancelMovePresentation(): void {
    for (const timer of this.moveEffectTimers) timer.remove(false);
    this.moveEffectTimers.clear();
    this.moveUnlockTimer = null;
    for (const sprite of this.moveEffectSprites) {
      this.tweens.killTweensOf(sprite);
      if (sprite.active) sprite.destroy();
    }
    this.moveEffectSprites.clear();
    for (const image of this.boxImages) {
      this.tweens.killTweensOf(image);
      if (image.active) image.setDisplaySize(this.scaleX(84), this.scaleY(91));
    }
    this.animatingRevision = -1;
  }

  private syncSession(session: ScrewSession, animateProgress: boolean): void {
    const labels = this.labels();
    const total = allScrews(session.level).length;
    const remaining = total - session.core.removedScrewIds.length;
    const levelNumber = (this.val<{ wins?: number }>("stats", {})?.wins ?? 0) + 1;
    this.headerTitle.setText(labels.title);
    this.levelText.setText(`${labels.level} ${levelNumber}`);
    this.remainingText.setText(`${labels.remaining} ${remaining}`);
    this.overflowText.setText(`${labels.overflow} ${session.core.buffer.length}/${BUFFER_CAPACITY}`);
    this.moveText.setText(`${labels.moves} ${session.core.moves}`);

    const targetWidth = this.scaleX(364) * (session.core.removedScrewIds.length / total);
    if (animateProgress) {
      this.animate({ targets: this.progressFill, displayWidth: Math.max(1, targetWidth), duration: 220 });
    } else {
      this.progressFill.displayWidth = Math.max(1, targetWidth);
    }

    for (const box of session.core.boxes) {
      const color = currentBoxColor(session.level, box);
      const image = this.boxImages[box.lane]!;
      image.setAlpha(color ? 1 : 0.22);
      image.clearTint();
      if (color) image.setTint(this.colorHex(color));
      this.boxCounts[box.lane]!.setText(
        color ? `${box.count}/${BOX_CAPACITY}` : labels.caseComplete,
      );
      for (let slot = 0; slot < BOX_CAPACITY; slot += 1) {
        const marker = this.boxMarkers[box.lane]![slot]!;
        marker.setVisible(Boolean(color) && slot < box.count);
        if (color) marker.setTint(this.colorHex(color));
      }
    }

    const removed = new Set(session.core.removedScrewIds);
    for (const visual of this.boardVisuals.values()) {
      const cleared = isBoardCleared(session.level, session.core, visual.board.id);
      visual.container.setVisible(!cleared);
      for (const screw of visual.board.screws) {
        const image = visual.screws.get(screw.id);
        const hit = visual.hitZones.get(screw.id);
        if (!image || !hit) continue;
        const unlocked = isScrewUnlocked(session.level, session.core, screw);
        image.setVisible(!removed.has(screw.id));
        image.setAlpha(unlocked ? 1 : 0.42);
        image.setAngle(0);
        this.sizeScrew(image, 31);
        if (hit.input) hit.input.enabled = !removed.has(screw.id);
      }
    }

    this.syncBuffer(session);
    this.syncOverlay(session);
  }

  private syncBuffer(session: ScrewSession): void {
    for (const sprite of this.bufferSprites) sprite.destroy();
    this.bufferSprites = [];
    session.core.buffer.forEach((item, index) => {
      const position = this.bufferPosition(index);
      const sprite = this.add.image(position.x, position.y, ASSETS.screw)
        .setDisplaySize(this.scaleX(25), this.scaleY(34))
        .setTint(this.colorHex(item.color))
        .setDepth(170);
      const overflowing = index >= BUFFER_CAPACITY;
      if (overflowing) sprite.setAlpha(0.78);
      const spec = this.add.ellipse(
        position.x - this.scaleX(4),
        position.y - this.scaleY(6),
        this.scaleX(9),
        this.scaleY(7),
        0xffffff,
        0.5,
      ).setDepth(171).setAlpha(overflowing ? 0.4 : 1);
      this.bufferSprites.push(sprite, spec);
    });
  }

  private syncOverlay(session: ScrewSession): void {
    const labels = this.labels();
    if (session.core.paused) {
      this.overlayTitle.setText(labels.pausedTitle);
      this.overlayCopy.setText(labels.pausedCopy);
      this.overlayButtonText.setText(labels.resume);
      this.drawOverlayStars(0);
      this.overlayAction = "togglePause";
      this.overlay.setVisible(true);
      return;
    }
    if (session.core.status === "won") {
      const stars = computeStars(session.core);
      this.overlayTitle.setText(labels.winTitle);
      this.drawOverlayStars(stars);
      const demerits = session.core.undosUsed + session.core.overflows;
      this.overlayCopy.setText(demerits === 0 ? labels.efficiencyCopy : labels.winCopy);
      this.overlayButtonText.setText(labels.newPuzzle);
      this.overlayAction = "newPuzzle";
      this.overlay.setVisible(true);
      return;
    }
    this.overlayAction = null;
    this.overlay.setVisible(false);
  }

  // Star rating drawn as real vector polygons (not glyph text) so the win
  // overlay reads as crafted art and stays free of emoji/text placeholders.
  private drawOverlayStars(earned: number): void {
    const g = this.overlayStars;
    g.clear();
    const total = 3;
    const cy = this.y(364);
    const outer = Math.max(12, this.scaleX(15));
    const inner = outer * 0.44;
    const gap = outer * 2.35;
    const stroke = Math.max(1, this.scaleX(1.5));
    for (let i = 0; i < total; i++) {
      const cx = this.widthPx / 2 + (i - (total - 1) / 2) * gap;
      const pts = this.starPolygon(cx, cy, outer, inner);
      if (i < earned) {
        g.fillStyle(0xe7a51a, 1);
        g.fillPoints(pts, true);
        g.lineStyle(stroke, 0xb9791a, 1);
        g.strokePoints(pts, true, true);
      } else {
        g.lineStyle(stroke, 0xd8c39a, 1);
        g.strokePoints(pts, true, true);
      }
    }
  }

  private starPolygon(cx: number, cy: number, outer: number, inner: number): Phaser.Geom.Point[] {
    const pts: Phaser.Geom.Point[] = [];
    const spikes = 5;
    const step = Math.PI / spikes;
    let rot = -Math.PI / 2;
    for (let i = 0; i < spikes; i++) {
      pts.push(new Phaser.Geom.Point(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer));
      rot += step;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner));
      rot += step;
    }
    return pts;
  }

  private playMoveAnimation(
    event: Extract<MoveEvent, { kind: "move" }>,
    previous: ScrewSession | null,
    session: ScrewSession,
  ): void {
    const screw = allScrews(session.level).find(({ id }) => id === event.screwId);
    if (!screw) {
      this.releaseMoveLock();
      return;
    }
    const start = this.screwWorldPosition(session, screw);
    const flight = this.trackMoveSprite(this.add.image(start.x, start.y, ASSETS.screw)
      .setTint(this.colorHex(screw.color))
      .setDepth(260));
    const flightScale = this.sizeScrew(flight, 31);

    const overflowed = event.destination === "buffer"
      && previous !== null
      && session.core.overflows > previous.core.overflows;
    if (overflowed && !this.reducedMotion) {
      // Soft-fail feedback only: the tray overflowed, but the run continues.
      this.cameras.main.shake(80, 0.003);
      this.sfx.play("move");
    }

    const destination = event.destination === "box" && event.lane !== null
      ? this.boxPosition(event.lane)
      : this.bufferPosition(Math.max(0, session.core.buffer.findIndex(({ screwId }) => screwId === event.screwId)));
    this.sfx.play(event.destination === "box" ? "chip" : "move");
    this.animate({
      targets: flight,
      x: destination.x,
      y: destination.y,
      angle: 540,
      scaleX: flightScale * 0.64,
      scaleY: flightScale * 0.64,
      duration: 320,
      ease: "Cubic.easeInOut",
      onComplete: () => this.destroyMoveSprite(flight),
    });

    if (previous) {
      event.flushed.forEach((flushed, order) => {
        const bufferIndex = previous.core.buffer.findIndex(({ screwId }) => screwId === flushed.screwId);
        const flushedScrew = allScrews(session.level).find(({ id }) => id === flushed.screwId);
        if (bufferIndex < 0 || !flushedScrew) return;
        const from = this.bufferPosition(bufferIndex);
        const to = this.boxPosition(flushed.lane);
        const sprite = this.trackMoveSprite(this.add.image(from.x, from.y, ASSETS.screw)
          .setDisplaySize(this.scaleX(25), this.scaleY(34))
          .setTint(this.colorHex(flushedScrew.color))
          .setDepth(262));
        this.scheduleMoveEffect(this.reducedMotion ? 0 : 80 + order * 65, () => {
          this.animate({
            targets: sprite,
            x: to.x,
            y: to.y,
            angle: 360,
            alpha: 0.9,
            duration: 260,
            ease: "Cubic.easeIn",
            onComplete: () => this.destroyMoveSprite(sprite),
          });
        });
      });
    }

    for (const lane of event.completedLanes) {
      const image = this.boxImages[lane];
      if (!image || this.reducedMotion) continue;
      const targetScaleX = image.scaleX;
      const targetScaleY = image.scaleY;
      this.animate({
        targets: image,
        scaleX: { from: targetScaleX * 0.94, to: targetScaleX * 1.06 },
        scaleY: { from: targetScaleY * 0.94, to: targetScaleY * 1.06 },
        duration: 115,
        yoyo: true,
        ease: "Back.easeOut",
        onComplete: () => image.setScale(targetScaleX, targetScaleY),
      });
    }

    if (session.core.status === "won") {
      this.scheduleMoveEffect(this.reducedMotion ? 0 : 330, () => this.sfx.play("win"));
    }
    this.moveUnlockTimer = this.scheduleMoveEffect(
      this.reducedMotion ? 0 : 340,
      () => this.releaseMoveLock(),
    );
  }

  private screwWorldPosition(session: ScrewSession, screw: ScrewDefinition): { x: number; y: number } {
    const board = session.level.boards.find(({ id }) => id === screw.boardId);
    if (!board) return { x: this.widthPx / 2, y: this.heightPx / 2 };
    const localX = (screw.slot - 1) * board.width * 0.31;
    const angle = Phaser.Math.DegToRad(board.angle);
    return {
      x: this.x(board.x + Math.cos(angle) * localX),
      y: this.y(board.y + Math.sin(angle) * localX),
    };
  }

  private boxPosition(lane: number): { x: number; y: number } {
    return { x: this.x(51 + lane * 99.4), y: this.y(124) };
  }

  private bufferPosition(index: number): { x: number; y: number } {
    return { x: this.x(72 + index * 64), y: this.y(184) };
  }

  private cleanupScene(): void {
    this.cancelMovePresentation();
    this.releaseMoveLock();
  }
}
