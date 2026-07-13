import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  GRID_COLS,
  GRID_ROWS,
  type ArrowLevel,
  type ArrowPiece,
  type ArrowRunSnapshot,
} from "../logic/arrow-engine";

const LOGICAL_WIDTH = 390;
const LOGICAL_HEIGHT = 844;
const BOARD_LEFT = 27;
const BOARD_TOP = 205;
const BOARD_WIDTH = 336;
const BOARD_HEIGHT = 452;
const CELL_WIDTH = BOARD_WIDTH / GRID_COLS;
const CELL_HEIGHT = BOARD_HEIGHT / GRID_ROWS;
const CELL_SIZE = Math.min(CELL_WIDTH, CELL_HEIGHT);

const ASSETS = {
  background: "arrow-garden-board",
  jadeShaft: "arrow-jade-shaft",
  jadeTail: "arrow-jade-tail",
  jadeHead: "arrow-jade-head",
  coralShaft: "arrow-coral-shaft",
  coralTail: "arrow-coral-tail",
  coralHead: "arrow-coral-head",
} as const;

type MoveEvent = {
  nonce: number;
  arrowId: number;
  outcome: "escaped" | "blocked" | "ignored" | "won" | "lost";
  blockers: number[];
};

type DragState = {
  startX: number;
  startY: number;
  containerX: number;
  containerY: number;
  dragged: boolean;
};

export class ArrowEscapeScene extends BaseScene {
  private background!: Phaser.GameObjects.Image;
  private boardContainer!: Phaser.GameObjects.Container;
  private arrowContainers = new Map<number, Phaser.GameObjects.Container>();
  private currentLevel: ArrowLevel | null = null;
  private currentRun: ArrowRunSnapshot | null = null;
  private currentZoom = 1;
  private panX = 0;
  private panY = 0;
  private lastMoveNonce = 0;
  private inputLocked = false;
  private pendingArrowId = 0;
  private dragState: DragState | null = null;
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private pinching = false;

  constructor() {
    super("ArrowEscapeScene");
  }

  preload(): void {
    BaseScene.preloadAssets(this, {
      [ASSETS.background]: "./art/garden-board.webp",
      [ASSETS.jadeShaft]: "./art/jade-shaft.png",
      [ASSETS.jadeTail]: "./art/jade-tail.png",
      [ASSETS.jadeHead]: "./art/jade-head.png",
      [ASSETS.coralShaft]: "./art/coral-shaft.png",
      [ASSETS.coralTail]: "./art/coral-tail.png",
      [ASSETS.coralHead]: "./art/coral-head.png",
    });
  }

  create(): void {
    super.create();
    this.background = this.add.image(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, ASSETS.background)
      .setDisplaySize(LOGICAL_WIDTH, LOGICAL_HEIGHT)
      .setDepth(0);
    this.boardContainer = this.add.container(0, 0).setDepth(10);
    this.input.addPointer(1);
    this.input.topOnly = true;
    this.bindGestures();
    this.applyState(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    this.applyState(state);
  }

  protected onResize(): void {
    // PhaserGameComponent keeps the 390×844 logical surface and scales the
    // canvas. Re-assert asset framing after host resizes/HMR scene restarts.
    this.background?.setPosition(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2)
      .setDisplaySize(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.applyBoardTransform();
  }

  private applyState(state: GameState): void {
    const level = state.level as ArrowLevel | undefined;
    const run = state.run as ArrowRunSnapshot | undefined;
    if (!level || !run || !this.boardContainer) return;

    const levelChanged = this.currentLevel?.checksum !== level.checksum;
    // A same-seed replay has the same level checksum, but its legal removal
    // history rewinds. Rebuild in that case so containers destroyed by escape
    // animations are restored instead of leaving a visually incomplete board.
    const runRewound = this.currentRun !== null
      && this.currentRun.seed === run.seed
      && run.removed.length < this.currentRun.removed.length;
    this.currentLevel = level;
    this.currentRun = run;
    this.input.enabled = run.status === "playing";

    if (levelChanged || runRewound) {
      this.lastMoveNonce = 0;
      this.inputLocked = false;
      this.pendingArrowId = 0;
      this.dragState = null;
      this.panX = 0;
      this.panY = 0;
      this.rebuildBoard(level, new Set(run.removed));
    }

    const requestedZoom = Math.max(0.85, Math.min(1.55, Number(state.zoom) || 1));
    if (!this.pinching && Math.abs(requestedZoom - this.currentZoom) > 0.001) {
      this.currentZoom = requestedZoom;
      this.clampPan();
      this.applyBoardTransform();
    }

    const move = state.moveEvent as MoveEvent | null | undefined;
    if (move && move.nonce > this.lastMoveNonce) {
      this.lastMoveNonce = move.nonce;
      this.playMoveFeedback(move, new Set(run.removed));
      return;
    }
    this.syncRemoved(new Set(run.removed));
  }

  private rebuildBoard(level: ArrowLevel, removed: ReadonlySet<number>): void {
    this.tweens.killTweensOf([...this.arrowContainers.values()]);
    this.boardContainer.removeAll(true);
    this.arrowContainers.clear();
    for (const arrow of level.arrows) {
      if (removed.has(arrow.id)) continue;
      const container = this.createArrow(arrow);
      this.arrowContainers.set(arrow.id, container);
      this.boardContainer.add(container);
    }
    this.applyBoardTransform();
  }

  private createArrow(arrow: ArrowPiece): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setData("arrowId", arrow.id);
    const shaftKey = arrow.tone === "jade" ? ASSETS.jadeShaft : ASSETS.coralShaft;
    const tailKey = arrow.tone === "jade" ? ASSETS.jadeTail : ASSETS.coralTail;
    const headKey = arrow.tone === "jade" ? ASSETS.jadeHead : ASSETS.coralHead;

    for (let index = 0; index < arrow.segments.length - 1; index += 1) {
      const start = this.gridPoint(arrow.segments[index]!);
      const end = this.gridPoint(arrow.segments[index + 1]!);
      const shaft = this.add.image((start.x + end.x) / 2, (start.y + end.y) / 2, shaftKey);
      const horizontal = start.y === end.y;
      shaft.setDisplaySize(CELL_SIZE * 1.15, CELL_SIZE * 0.29);
      shaft.setRotation(horizontal ? 0 : Math.PI / 2);
      container.add(shaft);

      // Brass collar at the joint — mechanical "pipe" flavour (audit P3)
      container.add(
        this.add.circle(start.x, start.y, CELL_SIZE * 0.22).setStrokeStyle(2.5, 0xc8973f, 0.9),
      );

      if (index > 0) {
        const previous = arrow.segments[index - 1]!;
        const current = arrow.segments[index]!;
        const next = arrow.segments[index + 1]!;
        const isTurn = previous.x !== next.x && previous.y !== next.y;
        if (isTurn) {
          const joint = this.add.image(
            BOARD_LEFT + (current.x + 0.5) * CELL_WIDTH,
            BOARD_TOP + (current.y + 0.5) * CELL_HEIGHT,
            tailKey,
          ).setDisplaySize(CELL_SIZE * 0.42, CELL_SIZE * 0.42);
          container.add(joint);
        }
      }
    }

    const tailPoint = this.gridPoint(arrow.segments[0]!);
    const tail = this.add.image(tailPoint.x, tailPoint.y, tailKey)
      .setDisplaySize(CELL_SIZE * 0.56, CELL_SIZE * 0.56);
    container.add(tail);

    const headPoint = this.gridPoint(arrow.segments[arrow.segments.length - 1]!);
    const head = this.add.image(
      headPoint.x + arrow.direction.dx * CELL_SIZE * 0.2,
      headPoint.y + arrow.direction.dy * CELL_SIZE * 0.2,
      headKey,
    ).setDisplaySize(CELL_SIZE * 0.72, CELL_SIZE * 0.58)
      .setRotation(this.directionAngle(arrow.direction.name));
    container.add(head);

    for (const segment of arrow.segments) {
      const point = this.gridPoint(segment);
      const hitZone = this.add.zone(point.x, point.y, CELL_WIDTH * 0.95, CELL_HEIGHT * 0.95)
        .setInteractive({ useHandCursor: true })
        .setData("arrowId", arrow.id)
        .setData("arrowContainer", container);
      container.add(hitZone);
    }
    return container;
  }

  private gridPoint(point: { x: number; y: number }): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      BOARD_LEFT + (point.x + 0.5) * CELL_WIDTH,
      BOARD_TOP + (point.y + 0.5) * CELL_HEIGHT,
    );
  }

  private directionAngle(name: ArrowPiece["direction"]["name"]): number {
    if (name === "down") return Math.PI / 2;
    if (name === "left") return Math.PI;
    if (name === "up") return -Math.PI / 2;
    return 0;
  }

  private playMoveFeedback(move: MoveEvent, removed: ReadonlySet<number>): void {
    if (move.arrowId <= 0) {
      if (move.outcome === "lost") this.sfx.play("lose");
      this.syncRemoved(removed);
      return;
    }
    const container = this.arrowContainers.get(move.arrowId);
    const arrow = this.currentLevel?.arrows.find((item) => item.id === move.arrowId);
    if (!container || !arrow) {
      this.syncRemoved(removed);
      return;
    }

    if (move.outcome === "escaped" || move.outcome === "won") {
      this.animateEscape(container, arrow, move.outcome === "won", removed);
    } else if (move.outcome === "blocked" || move.outcome === "lost") {
      this.animateBlocked(container, arrow, move.outcome === "lost", removed);
    } else {
      this.syncRemoved(removed);
    }
  }

  private animateEscape(
    container: Phaser.GameObjects.Container,
    arrow: ArrowPiece,
    won: boolean,
    removed: ReadonlySet<number>,
  ): void {
    this.inputLocked = true;
    this.sfx.unlock();
    this.sfx.play(won ? "win" : "score");
    this.spawnBrassTrail(arrow);
    this.animate({
      targets: container,
      x: container.x + arrow.direction.dx * 470,
      y: container.y + arrow.direction.dy * 470,
      alpha: 0,
      angle: arrow.direction.dx * 4 - arrow.direction.dy * 4,
      duration: won ? 360 : 300,
      ease: "Cubic.easeIn",
      onComplete: () => {
        container.destroy(true);
        this.arrowContainers.delete(arrow.id);
        this.inputLocked = false;
        this.syncRemoved(removed);
      },
    });
  }

  private animateBlocked(
    container: Phaser.GameObjects.Container,
    arrow: ArrowPiece,
    lost: boolean,
    removed: ReadonlySet<number>,
  ): void {
    this.inputLocked = true;
    this.sfx.unlock();
    this.sfx.play(lost ? "lose" : "error");
    const images = container.list.filter(
      (child): child is Phaser.GameObjects.Image => child instanceof Phaser.GameObjects.Image,
    );
    images.forEach((image) => image.setTint(0xff8b76));
    this.animate({
      targets: container,
      x: container.x + arrow.direction.dx * 11,
      y: container.y + arrow.direction.dy * 11,
      duration: 90,
      yoyo: true,
      repeat: lost ? 1 : 0,
      ease: "Sine.easeInOut",
      onComplete: () => {
        images.forEach((image) => image.clearTint());
        this.inputLocked = false;
        this.syncRemoved(removed);
      },
    });
  }

  private spawnBrassTrail(arrow: ArrowPiece): void {
    const head = this.gridPoint(arrow.segments[arrow.segments.length - 1]!);
    const texture = arrow.tone === "jade" ? ASSETS.jadeTail : ASSETS.coralTail;
    for (let index = 0; index < 4; index += 1) {
      const mote = this.add.image(head.x, head.y, texture)
        .setDisplaySize(6, 6)
        .setDepth(30)
        .setAlpha(0.8);
      this.animate({
        targets: mote,
        x: head.x - arrow.direction.dx * (18 + index * 7) + (index % 2 ? 5 : -5),
        y: head.y - arrow.direction.dy * (18 + index * 7) + (index % 2 ? -5 : 5),
        alpha: 0,
        scale: 0.3,
        duration: 260 + index * 30,
        ease: "Quad.easeOut",
        onComplete: () => mote.destroy(),
      });
    }
  }

  private syncRemoved(removed: ReadonlySet<number>): void {
    for (const [arrowId, container] of this.arrowContainers) {
      if (removed.has(arrowId) && container.active) {
        container.destroy(true);
        this.arrowContainers.delete(arrowId);
      }
    }
  }

  private bindGestures(): void {
    this.input.on("gameobjectdown", (
      pointer: Phaser.Input.Pointer,
      object: Phaser.GameObjects.GameObject,
    ) => {
      if (this.inputLocked || this.currentRun?.status !== "playing") return;
      this.sfx.unlock();
      this.pendingArrowId = Number(object.getData("arrowId")) || 0;
      this.dragState = {
        startX: pointer.x,
        startY: pointer.y,
        containerX: this.panX,
        containerY: this.panY,
        dragged: false,
      };
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.inputLocked) return;
      if (!this.dragState) {
        this.dragState = {
          startX: pointer.x,
          startY: pointer.y,
          containerX: this.panX,
          containerY: this.panY,
          dragged: false,
        };
      }
      const active = this.activePointers();
      if (active.length >= 2) this.beginPinch(active[0]!, active[1]!);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const active = this.activePointers();
      if (active.length >= 2) {
        if (!this.pinching) this.beginPinch(active[0]!, active[1]!);
        this.updatePinch(active[0]!, active[1]!);
        return;
      }
      if (!this.dragState || !pointer.isDown || this.currentZoom <= 1.01) return;
      const dx = pointer.x - this.dragState.startX;
      const dy = pointer.y - this.dragState.startY;
      if (Math.hypot(dx, dy) > 8) this.dragState.dragged = true;
      if (!this.dragState.dragged) return;
      this.panX = this.dragState.containerX + dx;
      this.panY = this.dragState.containerY + dy;
      this.clampPan();
      this.applyBoardTransform();
    });

    this.input.on("pointerup", () => {
      if (this.pinching) {
        if (this.activePointers().length < 2) {
          this.pinching = false;
          this.dispatch("setZoom", this.currentZoom);
        }
      } else if (
        this.pendingArrowId > 0
        && !this.dragState?.dragged
        && !this.inputLocked
        && this.currentRun?.status === "playing"
      ) {
        this.dispatch("tapArrow", this.pendingArrowId);
      }
      this.pendingArrowId = 0;
      this.dragState = null;
    });

    this.input.on("wheel", (
      _pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const next = Math.max(0.85, Math.min(1.55, this.currentZoom + (deltaY > 0 ? -0.1 : 0.1)));
      this.currentZoom = Math.round(next * 20) / 20;
      this.clampPan();
      this.applyBoardTransform();
      this.dispatch("setZoom", this.currentZoom);
    });
  }

  private activePointers(): Phaser.Input.Pointer[] {
    return this.input.manager.pointers.filter((pointer) => pointer.isDown);
  }

  private beginPinch(first: Phaser.Input.Pointer, second: Phaser.Input.Pointer): void {
    this.pinching = true;
    this.pendingArrowId = 0;
    this.pinchStartDistance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
    this.pinchStartZoom = this.currentZoom;
  }

  private updatePinch(first: Phaser.Input.Pointer, second: Phaser.Input.Pointer): void {
    const distance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
    if (this.pinchStartDistance <= 0) return;
    this.currentZoom = Math.max(0.85, Math.min(1.55, this.pinchStartZoom * distance / this.pinchStartDistance));
    this.clampPan();
    this.applyBoardTransform();
  }

  private clampPan(): void {
    const maxX = Math.max(0, (LOGICAL_WIDTH * this.currentZoom - LOGICAL_WIDTH) / 2);
    const maxY = Math.max(0, (BOARD_HEIGHT * this.currentZoom - BOARD_HEIGHT) / 2 + 36);
    this.panX = Phaser.Math.Clamp(this.panX, -maxX, maxX);
    this.panY = Phaser.Math.Clamp(this.panY, -maxY, maxY);
  }

  private applyBoardTransform(): void {
    if (!this.boardContainer) return;
    const centeredX = (LOGICAL_WIDTH - LOGICAL_WIDTH * this.currentZoom) / 2;
    const centeredY = (BOARD_TOP + BOARD_HEIGHT / 2) * (1 - this.currentZoom);
    this.boardContainer.setScale(this.currentZoom);
    this.boardContainer.setPosition(centeredX + this.panX, centeredY + this.panY);
  }
}
