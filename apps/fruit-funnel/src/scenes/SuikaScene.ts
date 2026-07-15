import * as Phaser from "phaser";

import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

import {
  DANGER_Y,
  DROP_COOLDOWN_MS,
  FRICTION,
  FRUIT_RADII,
  GRACE_MS,
  GRAVITY_Y,
  RESTITUTION,
  SETTLE_SPEED,
} from "../logic/suika-engine";
import type { SuikaSnapshot } from "../logic/suika-engine";
import type { SuikaSceneCopy, SuikaSceneCopyKey } from "../suika-copy";

const DESIGN_W = 390;
const DESIGN_H = 844;
const WALL = 6;
const FLOOR_Y = 812;
const DROP_Y = 100;
const AIM_MIN = 34;
const AIM_MAX = 356;
const AIM_STEP = 20;
const FONT = "Inter, ui-rounded, system-ui, sans-serif";

/** 11 fruit colors, index = evolution level 0..10 (cherry → watermelon). */
const FRUIT_COLORS = [
  0xe5444e, // 0 cherry
  0xf06b5b, // 1 strawberry
  0x9b5de5, // 2 grape
  0xf6913d, // 3 orange (dekopon)
  0xf6c945, // 4 lemon
  0x9ccc65, // 5 kiwi
  0xe5543a, // 6 tomato
  0xf4a988, // 7 peach
  0xf2c14e, // 8 pineapple
  0x86d98a, // 9 melon
  0x4caf50, // 10 watermelon
] as const;

/**
 * Original illustrated art (see public/art/ATTRIBUTION.md): a real orchard
 * backdrop plus six hand-generated fruit sprites for the six smallest — and so
 * most frequently seen — evolution tiers. The five rare high tiers keep the
 * clean vector-fruit fallback so the physics circle and its view always agree.
 */
const BG_TEXTURE = "fruit-funnel-orchard-stage";
const FRUIT_TEXTURE_KEYS = [
  "fruit-funnel-fruit-0",
  "fruit-funnel-fruit-1",
  "fruit-funnel-fruit-2",
  "fruit-funnel-fruit-3",
  "fruit-funnel-fruit-4",
  "fruit-funnel-fruit-5",
] as const;
const FRUIT_TEXTURE_FILES = [
  "./art/fruit-berry.webp",
  "./art/fruit-apple.webp",
  "./art/fruit-grape.webp",
  "./art/fruit-orange.webp",
  "./art/fruit-lemon.webp",
  "./art/fruit-peach.webp",
] as const;

interface FruitMeta {
  id: string;
  level: number;
  merging: boolean;
}

interface FruitEntry {
  body: MatterJS.BodyType;
  view: Phaser.GameObjects.Container;
  level: number;
}

function darken(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  c.darken(amount * 100);
  return c.color;
}

function radiusOf(level: number): number {
  return FRUIT_RADII[level] ?? 16;
}

export class SuikaScene extends BaseScene {
  private sceneReady = false;
  private snapshot: SuikaSnapshot | null = null;
  private fruits = new Map<string, FruitEntry>();
  private bodyMeta = new Map<MatterJS.BodyType, FruitMeta>();

  private aimX = DESIGN_W / 2;
  private lastStateAim = DESIGN_W / 2;
  private lastDropAt = 0;
  private overLineSince = 0;
  private lastAimDispatch = 0;
  private previousActionNonce = -1;

  private hudScore!: Phaser.GameObjects.Text;
  private hudBest!: Phaser.GameObjects.Text;
  private hudNextLabel!: Phaser.GameObjects.Text;
  private nextPreview!: Phaser.GameObjects.Container;
  private aimView!: Phaser.GameObjects.Container;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private dangerLine!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayCopy!: Phaser.GameObjects.Text;
  private overlayPrimary!: Phaser.GameObjects.Container;
  private overlayPrimaryText!: Phaser.GameObjects.Text;
  private overlaySecondary!: Phaser.GameObjects.Container;
  private overlaySecondaryText!: Phaser.GameObjects.Text;

  constructor() {
    super("SuikaScene");
  }

  preload(): void {
    this.load.image(BG_TEXTURE, "./art/orchard-stage.webp");
    FRUIT_TEXTURE_KEYS.forEach((key, level) => {
      const file = FRUIT_TEXTURE_FILES[level];
      if (file) this.load.image(key, file);
    });
  }

  create(): void {
    super.create();
    this.input.on("pointerdown", () => this.sfx.unlock());

    this.matter.world.setBounds(WALL, 0, DESIGN_W - 2 * WALL, FLOOR_Y, 100, true, true, false, true);
    this.matter.world.setGravity(0, GRAVITY_Y);

    this.buildStage();
    this.buildHud();
    this.buildOverlay();
    this.buildAim();
    this.bindInput();

    this.matter.world.on("collisionstart", this.handleCollision, this);

    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => this.syncToEngine(),
    });

    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  // ── Stage ────────────────────────────────────────────────────────────────

  private buildStage(): void {
    // Real illustrated orchard backdrop behind the play field. Kept subtle so
    // the falling fruit stay the most readable elements on the stage.
    if (this.textures.exists(BG_TEXTURE)) {
      this.add.image(DESIGN_W / 2, DESIGN_H / 2, BG_TEXTURE)
        .setDisplaySize(DESIGN_W, DESIGN_H)
        .setAlpha(0.42)
        .setDepth(-35);
    }

    const bg = this.add.graphics().setDepth(-30);
    bg.fillStyle(0xfdf3c9, 0.0); // transparent canvas; CSS supplies bg
    bg.fillRoundedRect(0, 0, DESIGN_W, DESIGN_H, 0);

    // play-field side walls (visual only; physics walls are the matter bounds)
    const frame = this.add.graphics().setDepth(-10);
    frame.fillStyle(0xfff7df, 0.34);
    frame.fillRoundedRect(2, 2, DESIGN_W - 4, FLOOR_Y, 14);
    frame.lineStyle(2, 0xe7b15a, 0.35);
    frame.strokeRoundedRect(2, 2, DESIGN_W - 4, FLOOR_Y, 14);

    this.dangerLine = this.add.graphics().setDepth(5);
    this.drawDangerLine(false);

    this.aimGuide = this.add.graphics().setDepth(4);
  }

  private drawDangerLine(close: boolean): void {
    const g = this.dangerLine;
    g.clear();
    g.lineStyle(2, close ? 0xd64545 : 0xe0a23c, close ? 0.9 : 0.6);
    const dash = 12;
    const gap = 9;
    for (let x = WALL + 4; x < DESIGN_W - WALL - 4; x += dash + gap) {
      g.lineBetween(x, DANGER_Y, Math.min(x + dash, DESIGN_W - WALL - 4), DANGER_Y);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHud(): void {
    this.hudScore = this.add.text(20, 16, "0", {
      fontFamily: FONT, fontSize: "30px", fontStyle: "bold", color: "#3f2a1f",
    }).setDepth(40);
    this.add.text(20, 50, this.loc("scoreLabel", "Score").toUpperCase(), {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#9a6a38",
    }).setDepth(40);

    this.hudBest = this.add.text(DESIGN_W - 20, 16, "0", {
      fontFamily: FONT, fontSize: "22px", fontStyle: "bold", color: "#6b4a2c",
    }).setOrigin(1, 0).setDepth(40);
    this.add.text(DESIGN_W - 20, 46, this.loc("bestLabel", "Best").toUpperCase(), {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#9a6a38",
    }).setOrigin(1, 0).setDepth(40);

    this.hudNextLabel = this.add.text(DESIGN_W / 2, 18, this.loc("nextLabel", "Next").toUpperCase(), {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#9a6a38",
    }).setOrigin(0.5, 0).setDepth(40);
    this.nextPreview = this.add.container(DESIGN_W / 2, 50).setDepth(41);

    // Anchored to the scene's bottom edge (origin y = 1) rather than to
    // FLOOR_Y + 22 with a top origin. Growing downward from y=834 meant a
    // single 12px line already ran to ~849 against a DESIGN_H of 844 and was
    // sliced mid-glyph; the moment the storage-warning suffix appended, the
    // line wrapped and the second row fell off the canvas entirely. Anchoring
    // the bottom pins the last line just inside the edge and lets extra lines
    // stack upward into the plank band, so the copy survives any suffix and
    // any locale.
    this.statusText = this.add.text(DESIGN_W / 2, DESIGN_H - 6, "", {
      fontFamily: FONT, fontSize: "11px", fontStyle: "bold", color: "#4d382a",
      align: "center", wordWrap: { width: DESIGN_W - 40 },
    }).setOrigin(0.5, 1).setDepth(50);
  }

  // ── Aim preview ─────────────────────────────────────────────────────────────

  private buildAim(): void {
    this.aimView = this.add.container(this.aimX, DROP_Y).setDepth(45);
    this.refreshAimView();
  }

  private refreshAimView(): void {
    const level = this.snapshot?.currentLevel ?? 0;
    const r = radiusOf(level);
    this.aimView.removeAll(true);
    const fruit = this.makeFruitView(level, r);
    this.aimView.add(fruit);
    this.aimView.setAlpha(this.snapshot?.phase === "playing" ? 0.92 : 0.25);
  }

  private makeFruitView(level: number, r: number): Phaser.GameObjects.Container {
    const textureKey = FRUIT_TEXTURE_KEYS[level];
    if (textureKey && this.textures.exists(textureKey)) {
      const sprite = this.add.image(0, 0, textureKey).setDisplaySize(r * 2, r * 2);
      return this.add.container(0, 0, [sprite]);
    }
    const color = FRUIT_COLORS[level] ?? 0x888888;
    const circle = this.add.circle(0, 0, r, color);
    circle.setStrokeStyle(Math.max(1.5, r * 0.05), darken(color, 0.2), 0.9);
    const hl = this.add.ellipse(-r * 0.3, -r * 0.34, r * 0.55, r * 0.34, 0xffffff, 0.32);
    return this.add.container(0, 0, [circle, hl]);
  }

  // ── Overlay (pause / game over) ─────────────────────────────────────────────

  private buildOverlay(): void {
    this.overlay = this.add.container(0, 0).setDepth(900).setVisible(false);
    const dim = this.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0x3a2a18, 0.5)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0xfffdf2, 0.99);
    panel.fillRoundedRect(40, 280, 310, 300, 26);
    panel.lineStyle(2, 0xffffff, 0.9);
    panel.strokeRoundedRect(40, 280, 310, 300, 26);
    this.overlayTitle = this.add.text(DESIGN_W / 2, 330, "", {
      fontFamily: FONT, fontSize: "26px", fontStyle: "bold", color: "#3f2a1f", align: "center",
    }).setOrigin(0.5).setDepth(1);
    this.overlayCopy = this.add.text(DESIGN_W / 2, 372, "", {
      fontFamily: FONT, fontSize: "14px", color: "#6d5543", align: "center", wordWrap: { width: 250 },
    }).setOrigin(0.5, 0).setDepth(1);
    const primary = this.makeOverlayButton(DESIGN_W / 2, 500, 240, true, () => {
      const phase = this.snapshot?.phase;
      if (phase === "paused") this.dispatch("togglePause");
      else this.dispatch("restartGame");
    });
    const secondary = this.makeOverlayButton(DESIGN_W / 2, 552, 240, false, () => {
      this.dispatch("restartGame");
    });
    this.overlayPrimary = primary.root;
    this.overlayPrimaryText = primary.text;
    this.overlaySecondary = secondary.root;
    this.overlaySecondaryText = secondary.text;
    this.overlay.add([
      dim, panel, this.overlayTitle, this.overlayCopy,
      this.overlayPrimary, this.overlaySecondary,
    ]);
  }

  private makeOverlayButton(
    x: number, y: number, width: number, primary: boolean, action: () => void,
  ): { root: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
    const root = this.add.container(x, y);
    const surface = this.add.graphics();
    surface.fillStyle(primary ? 0x16c784 : 0xfffbeb, primary ? 0.96 : 0.98);
    surface.fillRoundedRect(-width / 2, -24, width, 48, 18);
    surface.lineStyle(1.5, primary ? 0x0f9d68 : 0x9f6a3c, primary ? 0.5 : 0.42);
    surface.strokeRoundedRect(-width / 2, -24, width, 48, 18);
    const text = this.add.text(0, 0, "", {
      fontFamily: FONT, fontSize: "14px", fontStyle: "bold",
      color: primary ? "#ffffff" : "#553726",
    }).setOrigin(0.5);
    root.add([surface, text]);
    root.setSize(width, 48).setInteractive({ useHandCursor: true });
    this.bindGameButton(root, {
      targets: root,
      onPress: () => { this.sfx.play("tap"); action(); },
    });
    return { root, text };
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private bindInput(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.aimX = Phaser.Math.Clamp(pointer.worldX, AIM_MIN, AIM_MAX);
      this.maybeDispatchAim();
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.aimX = Phaser.Math.Clamp(pointer.worldX, AIM_MIN, AIM_MAX);
      this.tryDrop();
    });

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        this.aimX = Phaser.Math.Clamp(this.aimX - AIM_STEP, AIM_MIN, AIM_MAX);
        this.dispatch("setAim", this.aimX);
      } else if (key === "arrowright" || key === "d") {
        this.aimX = Phaser.Math.Clamp(this.aimX + AIM_STEP, AIM_MIN, AIM_MAX);
        this.dispatch("setAim", this.aimX);
      } else if (key === " " || key === "enter") {
        this.tryDrop();
        event.preventDefault();
      } else if (key === "p") {
        this.dispatch("togglePause");
      } else if (key === "r") {
        this.dispatch("restartGame");
      }
    });
  }

  private maybeDispatchAim(): void {
    const now = this.time.now;
    if (now - this.lastAimDispatch < 90) return;
    this.lastAimDispatch = now;
    this.dispatch("setAim", this.aimX);
  }

  private tryDrop(): void {
    if (!this.snapshot || this.snapshot.phase !== "playing") return;
    const now = this.time.now;
    if (now - this.lastDropAt < DROP_COOLDOWN_MS) return;
    this.lastDropAt = now;
    const level = this.snapshot.currentLevel;
    const r = radiusOf(level);
    const x = Phaser.Math.Clamp(this.aimX, WALL + r, DESIGN_W - WALL - r);
    this.dispatch("setAim", x);
    this.dispatch("dropCurrent", x, DROP_Y);
  }

  // ── Merge detection ──────────────────────────────────────────────────────────

  private handleCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (!this.snapshot || this.snapshot.phase !== "playing") return;
    for (const pair of event.pairs) {
      const a = pair.bodyA as MatterJS.BodyType;
      const b = pair.bodyB as MatterJS.BodyType;
      const ma = this.bodyMeta.get(a);
      const mb = this.bodyMeta.get(b);
      if (!ma || !mb) continue;
      if (ma.level !== mb.level) continue;
      if (ma.merging || mb.merging) continue;
      ma.merging = true;
      mb.merging = true;
      const newLevel = ma.level + 1;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;
      this.dispatch("mergeFruits", ma.id, mb.id, newLevel, mx, my);
    }
  }

  // ── State sync ────────────────────────────────────────────────────────────────

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady) return;
    const game = this.val<SuikaSnapshot>("game");
    if (!game) return;
    this.snapshot = game;

    const aim = this.val<number>("aimX", this.aimX) ?? this.aimX;
    if (aim !== this.lastStateAim) {
      this.aimX = aim;
      this.lastStateAim = aim;
    }

    this.reconcileBodies(game);
    this.updateHud(game);
    this.updateOverlay(game);

    const playing = game.phase === "playing";
    if (this.matter.world.enabled !== playing) this.matter.world.enabled = playing;

    if (game.lastAction.nonce !== this.previousActionNonce) {
      this.animateAction(game);
      this.previousActionNonce = game.lastAction.nonce;
    }
  }

  private reconcileBodies(game: SuikaSnapshot): void {
    const live = new Set(game.board.map((fruit) => fruit.id));
    for (const [id, entry] of [...this.fruits]) {
      if (!live.has(id)) {
        this.matter.world.remove(entry.body);
        this.bodyMeta.delete(entry.body);
        entry.view.destroy();
        this.fruits.delete(id);
      }
    }
    for (const fruit of game.board) {
      if (this.fruits.has(fruit.id)) continue;
      const r = radiusOf(fruit.level);
      const body = this.matter.add.circle(fruit.x, fruit.y, r, {
        restitution: RESTITUTION,
        friction: FRICTION,
        frictionStatic: 0.6,
        label: fruit.id,
      }) as MatterJS.BodyType;
      this.bodyMeta.set(body, { id: fruit.id, level: fruit.level, merging: false });
      const view = this.makeFruitView(fruit.level, r);
      view.setPosition(fruit.x, fruit.y);
      this.fruits.set(fruit.id, { body, view, level: fruit.level });
    }
    this.refreshAimView();
  }

  private syncToEngine(): void {
    if (!this.snapshot || this.snapshot.phase !== "playing") return;
    const positions = [...this.fruits.values()].map((entry) => ({
      id: this.bodyMeta.get(entry.body)?.id ?? "",
      x: entry.body.position.x,
      y: entry.body.position.y,
    }));
    if (positions.length === 0) return;
    this.dispatch("syncBoard", positions);
  }

  // ── Frame loop ────────────────────────────────────────────────────────────────

  update(): void {
    if (!this.snapshot) return;
    for (const entry of this.fruits.values()) {
      entry.view.setPosition(entry.body.position.x, entry.body.position.y);
      entry.view.setRotation(entry.body.angle);
    }

    // aim preview follows the pointer/keyboard aim
    this.aimView.setPosition(this.aimX, DROP_Y);
    this.aimGuide.clear();
    if (this.snapshot.phase === "playing") {
      this.aimGuide.lineStyle(1.5, 0xe0a23c, 0.35);
      this.aimGuide.lineBetween(this.aimX, DROP_Y + 18, this.aimX, FLOOR_Y - 8);
    }

    this.checkGameOver();
  }

  private checkGameOver(): void {
    if (!this.snapshot || this.snapshot.phase !== "playing") {
      this.overLineSince = 0;
      this.drawDangerLine(false);
      return;
    }
    let over = false;
    for (const entry of this.fruits.values()) {
      const r = (entry.body as MatterJS.BodyType & { circleRadius?: number }).circleRadius ?? radiusOf(entry.level);
      const top = entry.body.position.y - r;
      const speed = Math.hypot(entry.body.velocity.x, entry.body.velocity.y);
      if (top < DANGER_Y && speed < SETTLE_SPEED) {
        over = true;
        break;
      }
    }
    this.drawDangerLine(over);
    if (over) {
      if (this.overLineSince === 0) {
        this.overLineSince = this.time.now;
      } else if (this.time.now - this.overLineSince > GRACE_MS) {
        this.dispatch("setGameOver");
      }
    } else {
      this.overLineSince = 0;
    }
  }

  // ── HUD / overlay update ──────────────────────────────────────────────────────

  private updateHud(game: SuikaSnapshot): void {
    this.hudScore.setText(game.score.toLocaleString());
    this.hudBest.setText(game.best.toLocaleString());

    this.nextPreview.removeAll(true);
    const nextLevel = game.nextLevel;
    const r = radiusOf(nextLevel) * 0.62;
    const fruit = this.makeFruitView(nextLevel, r);
    this.nextPreview.add(fruit);

    const status = this.loc(game.messageKey, this.loc("statusReady", "Drop fruit to begin"));
    const storageWarning = this.bool("storageHealthy") === false
      ? ` · ${this.loc("storageWarning", "Progress cannot be saved")}`
      : "";
    this.statusText.setText(`${status}${storageWarning}`);
  }

  private updateOverlay(game: SuikaSnapshot): void {
    const visible = game.phase !== "playing";
    this.overlay.setVisible(visible);
    if (!visible) return;
    if (game.phase === "paused") {
      this.overlayTitle.setText(this.loc("pauseTitle", "Paused"));
      this.overlayCopy.setText(this.loc("pauseCopy", "Your orchard is safely stopped."));
      this.overlayPrimaryText.setText(this.loc("resumeAction", "Resume"));
      this.overlaySecondary.setVisible(true);
      this.overlaySecondaryText.setText(this.loc("newGameAction", "New game"));
    } else {
      this.overlayTitle.setText(this.loc("gameOverTitle", "Game over"));
      // Resolved run outcome: final score, local best, and a new-record note.
      const newRecord = game.score > 0 && game.score >= game.best;
      const outcome = newRecord
        ? this.loc("newRecordCopy", "New best!")
        : `${this.loc("bestLabel", "Best")}: ${game.best.toLocaleString()}`;
      this.overlayCopy.setText(
        `${this.loc("gameOverCopy", "The fruit piled past the line.")}\n${this.loc("scoreLabel", "Score")}: ${game.score.toLocaleString()} · ${outcome}`,
      );
      this.overlayPrimaryText.setText(this.loc("newGameAction", "New game"));
      this.overlaySecondary.setVisible(false);
    }
  }

  private animateAction(game: SuikaSnapshot): void {
    const action = game.lastAction;
    if (action.kind === "merged" && action.newId) {
      const entry = this.fruits.get(action.newId);
      if (entry && !this.reducedMotion) {
        this.tween({
          targets: entry.view,
          scale: 1.18,
          duration: 110,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
      this.sfx.play("combo");
    } else if (action.kind === "dropped") {
      this.sfx.play("land");
    } else if (action.kind === "gameover") {
      this.sfx.play("lose");
      if (!this.reducedMotion) this.cameras.main.flash(220, 255, 226, 112, false);
    } else if (action.kind === "pause" || action.kind === "resume") {
      this.sfx.play("tap");
    }
  }

  // ── i18n ──────────────────────────────────────────────────────────────────────

  private loc(key: SuikaSceneCopyKey, fallback: string): string {
    const bag = this.val<SuikaSceneCopy>("sceneText");
    return bag?.[key] || fallback;
  }
}
