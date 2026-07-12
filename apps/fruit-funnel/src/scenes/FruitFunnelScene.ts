import * as Phaser from "phaser";

import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";

import {
  CHANNEL_CAPACITY,
  FRUIT_COLORS,
  TOTAL_PAIRS,
} from "../logic/fruit-engine";
import type {
  FruitColor,
  FruitSnapshot,
} from "../logic/fruit-engine";
import type { FruitSceneCopy, FruitSceneCopyKey } from "../scene-copy";

const DESIGN_W = 390;
const DESIGN_H = 844;
const FONT = "Inter, ui-rounded, system-ui, sans-serif";
const VINE_X = [36, 100, 163, 227, 290, 354] as const;
const VINE_FRONT_Y = 472;
const VINE_STEP_Y = 39;
const CHANNEL_X = [64, 108, 151, 195, 239, 282, 326] as const;
const CHANNEL_Y = 642;

const ASSETS = {
  stage: "fruit-funnel-stage",
  rack: "fruit-funnel-vine-rack",
  funnel: "fruit-funnel-basket",
  fruit: {
    apple: "fruit-apple",
    orange: "fruit-orange",
    lemon: "fruit-lemon",
    grape: "fruit-grape",
    berry: "fruit-berry",
    peach: "fruit-peach",
  } satisfies Record<FruitColor, string>,
} as const;

const COLOR_HEX: Record<FruitColor, number> = {
  apple: 0xe94f3d,
  orange: 0xf18a32,
  lemon: 0xf4c947,
  grape: 0x7a55a5,
  berry: 0xe94968,
  peach: 0xf08f75,
};

type SceneButton = {
  root: Phaser.GameObjects.Container;
  surface: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  width: number;
  primary: boolean;
  enabled: boolean;
};

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function structuralKey(game: FruitSnapshot, hints: number[]): string {
  return `${game.phase};${game.lanes.map((lane) => lane.map((token) => token.id).join(",")).join("|")};${game.channel.map((token) => token.id).join(",")};${hints.join(",")}`;
}

export class FruitFunnelScene extends BaseScene {
  private sceneReady = false;
  private orchardLayer!: Phaser.GameObjects.Container;
  private channelLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayCopy!: Phaser.GameObjects.Text;
  private overlayPrimary!: SceneButton;
  private overlaySecondary!: SceneButton;
  private eyebrowText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private timeLabelText!: Phaser.GameObjects.Text;
  private pairsLabelText!: Phaser.GameObjects.Text;
  private scoreLabelText!: Phaser.GameObjects.Text;
  private timeValue!: Phaser.GameObjects.Text;
  private pairsValue!: Phaser.GameObjects.Text;
  private scoreValue!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private chuteLabelText!: Phaser.GameObjects.Text;
  private chuteCount!: Phaser.GameObjects.Text;
  private undoButton!: SceneButton;
  private hintButton!: SceneButton;
  private pauseButton!: SceneButton;
  private channelSprites = new Map<string, Phaser.GameObjects.Image>();
  private previousGame: FruitSnapshot | null = null;
  private previousActionNonce = -1;
  private previousStructure = "";
  private copySignature = "";
  private keyboardHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("FruitFunnelScene");
  }

  preload(): void {
    this.load.image(ASSETS.stage, "./art/orchard-stage.webp");
    this.load.image(ASSETS.rack, "./art/vine-rack.webp");
    this.load.image(ASSETS.funnel, "./art/funnel-basket.webp");
    for (const color of FRUIT_COLORS) {
      this.load.image(ASSETS.fruit[color], `./art/fruit-${color}.webp`);
    }
  }

  create(): void {
    // BaseScene defers its bridge-ready signal until the next scene tick, so
    // this synchronous build completes before React can expose the canvas.
    super.create();
    this.input.on("pointerdown", () => this.sfx.unlock());
    this.buildStage();
    this.bindKeyboard();
    // Scene-owned clock events are destroyed with the Phaser scene. React
    // checkpoints only every five seconds so this does not hammer storage.
    this.time.addEvent({
      delay: 1_000,
      loop: true,
      callback: () => this.dispatch("tickClock"),
    });
    this.sceneReady = true;
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(_state: GameState): void {
    if (!this.sceneReady) return;
    const game = this.val<FruitSnapshot>("game");
    if (!game) return;
    this.updateCopy();
    const hints = this.val<number[]>("hintLanes", []) ?? [];
    const nextStructure = structuralKey(game, hints);
    if (nextStructure !== this.previousStructure) {
      this.renderOrchard(game, hints);
      this.renderChannel(game);
      this.previousStructure = nextStructure;
    }

    this.updateHud(game);
    this.updateControls(game);
    this.updateOverlay(game);

    if (game.lastAction.nonce !== this.previousActionNonce) {
      this.animateAction(this.previousGame, game);
      this.previousActionNonce = game.lastAction.nonce;
    }
    this.previousGame = game;
  }

  private loc(key: FruitSceneCopyKey, fallback: string): string {
    const bag = this.val<FruitSceneCopy>("sceneText");
    return bag?.[key] || fallback;
  }

  private buildStage(): void {
    this.add.image(DESIGN_W / 2, DESIGN_H / 2, ASSETS.stage)
      .setDisplaySize(DESIGN_W, DESIGN_H)
      .setName("fruit-funnel-stage")
      .setDepth(-30);

    const veil = this.add.graphics().setDepth(-20);
    veil.fillStyle(0xfff9e8, 0.2);
    veil.fillRect(0, 0, DESIGN_W, DESIGN_H);
    veil.fillStyle(0xfffdf2, 0.89);
    veil.fillRoundedRect(12, 10, 366, 82, 22);
    veil.lineStyle(1.5, 0xffffff, 0.92);
    veil.strokeRoundedRect(12, 10, 366, 82, 22);
    veil.fillStyle(0xfff9e9, 0.9);
    veil.fillRoundedRect(16, 696, 358, 54, 18);
    veil.lineStyle(1, 0x8c5a31, 0.14);
    veil.strokeRoundedRect(16, 696, 358, 54, 18);

    this.eyebrowText = this.add.text(22, 104, "", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#80502c",
      letterSpacing: 1.4,
    }).setDepth(10);
    this.titleText = this.add.text(22, 120, "", {
      fontFamily: FONT,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#3f2a1f",
    }).setDepth(10);

    this.timeLabelText = this.add.text(28, 20, "", {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#76533a",
    }).setDepth(10);
    this.timeValue = this.add.text(28, 38, "4:00", {
      fontFamily: FONT, fontSize: "23px", fontStyle: "bold", color: "#3f2a1f",
    }).setDepth(10);

    this.pairsLabelText = this.add.text(145, 20, "", {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#76533a",
    }).setDepth(10);
    this.pairsValue = this.add.text(145, 38, `0/${TOTAL_PAIRS}`, {
      fontFamily: FONT, fontSize: "23px", fontStyle: "bold", color: "#3f2a1f",
    }).setDepth(10);

    this.scoreLabelText = this.add.text(265, 20, "", {
      fontFamily: FONT, fontSize: "10px", fontStyle: "bold", color: "#76533a",
    }).setDepth(10);
    this.scoreValue = this.add.text(265, 38, "0", {
      fontFamily: FONT, fontSize: "23px", fontStyle: "bold", color: "#3f2a1f",
    }).setDepth(10);

    // The original generated rack is a functional play object: its six rope
    // centers align to the six selectable lane columns behind the fruit.
    this.add.image(DESIGN_W / 2, 215, ASSETS.rack)
      .setDisplaySize(380, 127)
      .setName("fruit-funnel-rack")
      .setDepth(-2);

    this.add.image(DESIGN_W / 2, 600, ASSETS.funnel)
      .setDisplaySize(370, 205)
      .setName("fruit-funnel-basket")
      .setDepth(0);

    this.chuteLabelText = this.add.text(28, 526, "", {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#5c3a25",
      backgroundColor: "rgba(255,250,232,0.82)",
      padding: { x: 8, y: 5 },
    }).setDepth(8);
    this.chuteCount = this.add.text(362, 526, `0/${CHANNEL_CAPACITY}`, {
      fontFamily: FONT,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#5c3a25",
      backgroundColor: "rgba(255,250,232,0.82)",
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(8);

    this.orchardLayer = this.add.container(0, 0).setName("fruit-funnel-orchard").setDepth(20);
    this.channelLayer = this.add.container(0, 0).setName("fruit-funnel-channel").setDepth(30);
    this.effectLayer = this.add.container(0, 0).setName("fruit-funnel-effects").setDepth(60);

    this.statusText = this.add.text(DESIGN_W / 2, 713, "", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#4d382a",
      align: "center",
      wordWrap: { width: 326 },
    }).setOrigin(0.5, 0).setDepth(50);

    this.undoButton = this.makeButton(66, 800, 100, "", false, () => this.dispatch("undoMove"));
    this.hintButton = this.makeButton(195, 800, 100, "", true, () => this.dispatch("requestHint"));
    this.pauseButton = this.makeButton(324, 800, 100, "", false, () => this.dispatch("togglePause"));
    this.buildOverlay();
  }

  private updateCopy(): void {
    const bag = this.val<FruitSceneCopy>("sceneText");
    if (!bag) return;
    const signature = JSON.stringify(bag);
    if (signature === this.copySignature) return;
    this.copySignature = signature;
    this.eyebrowText.setText(bag.appEyebrow);
    this.titleText.setText(bag.appTitle);
    this.timeLabelText.setText(bag.timeLabel.toUpperCase());
    this.pairsLabelText.setText(bag.pairsLabel.toUpperCase());
    this.scoreLabelText.setText(bag.scoreLabel.toUpperCase());
    this.chuteLabelText.setText(bag.chuteLabel.toUpperCase());
    this.undoButton.text.setText(bag.undoAction);
    this.hintButton.text.setText(bag.hintAction);
    this.pauseButton.text.setText(bag.pauseAction);
  }

  private renderOrchard(game: FruitSnapshot, hints: number[]): void {
    this.orchardLayer.removeAll(true);
    const hintSet = new Set(hints);
    for (let laneIndex = 0; laneIndex < game.lanes.length; laneIndex += 1) {
      const lane = game.lanes[laneIndex] ?? [];
      const x = VINE_X[laneIndex] ?? VINE_X[0];
      const chip = this.add.circle(x, 160, 12, 0xfff8de, 0.97)
        .setStrokeStyle(1.5, 0x8d5d35, 0.28);
      const chipText = this.add.text(x, 160, String(laneIndex + 1), {
        fontFamily: FONT, fontSize: "11px", fontStyle: "bold", color: "#67432d",
      }).setOrigin(0.5);
      this.orchardLayer.add([chip, chipText]);

      for (let depth = lane.length - 1; depth >= 0; depth -= 1) {
        const token = lane[depth];
        if (!token) continue;
        const y = VINE_FRONT_Y - depth * VINE_STEP_Y;
        if (depth === 0 && hintSet.has(laneIndex)) {
          const glow = this.add.circle(x, y, 27, COLOR_HEX[token.color], 0.2)
            .setStrokeStyle(3, 0xffffff, 0.96);
          this.orchardLayer.add(glow);
          this.animate({
            targets: glow,
            scale: 1.2,
            alpha: 0.48,
            duration: 540,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        const size = depth === 0 ? 51 : 45;
        const sprite = this.add.image(x, y, ASSETS.fruit[token.color])
          .setDisplaySize(size, size)
          .setAlpha(depth === 0 ? 1 : Math.max(0.72, 0.96 - depth * 0.025));
        sprite.setDepth(200 - depth);
        this.orchardLayer.add(sprite);
        if (depth === 0 && game.phase === "playing") {
          sprite.setInteractive({ useHandCursor: true });
          const baseScale = sprite.scaleX;
          this.bindGameButton(sprite, {
            targets: sprite,
            idleScale: baseScale,
            hoverScale: baseScale * 1.05,
            pressScale: baseScale * 0.94,
            onPress: () => {
              this.sfx.play("throw");
              this.dispatch("tapLane", laneIndex);
            },
          });
        }
      }
    }
  }

  private renderChannel(game: FruitSnapshot): void {
    this.channelLayer.removeAll(true);
    this.channelSprites.clear();
    for (let index = 0; index < game.channel.length; index += 1) {
      const token = game.channel[index];
      const x = CHANNEL_X[index];
      if (!token || x === undefined) continue;
      const sprite = this.add.image(x, CHANNEL_Y, ASSETS.fruit[token.color])
        .setDisplaySize(42, 42);
      this.channelLayer.add(sprite);
      this.channelSprites.set(token.id, sprite);
    }
  }

  private updateHud(game: FruitSnapshot): void {
    this.timeValue.setText(formatClock(game.remainingMs));
    this.timeValue.setColor(game.remainingMs <= 30_000 ? "#bd3f34" : "#3f2a1f");
    this.pairsValue.setText(`${game.matchedPairs}/${TOTAL_PAIRS}`);
    this.scoreValue.setText(game.score.toLocaleString());
    this.chuteCount.setText(`${game.channel.length}/${CHANNEL_CAPACITY}`);
    const hintMessageKey = this.val<FruitSceneCopyKey | null>("hintMessageKey", null);
    const status = hintMessageKey
      ? this.loc(hintMessageKey, this.loc("statusReady", "Choose a front fruit to begin"))
      : this.loc(game.messageKey, this.loc("statusReady", "Choose a front fruit to begin"));
    const storageWarning = this.bool("storageHealthy") === false
      ? ` · ${this.loc("storageWarning", "Progress cannot be saved")}`
      : "";
    this.statusText.setText(`${status}${storageWarning}`);
  }

  private updateControls(game: FruitSnapshot): void {
    this.setButtonEnabled(this.undoButton, game.history.length > 0 && game.phase !== "won" && game.phase !== "timeout");
    this.setButtonEnabled(this.hintButton, game.phase === "playing");
    this.setButtonEnabled(this.pauseButton, game.phase === "playing" || game.phase === "paused");
    this.pauseButton.text.setText(game.phase === "paused"
      ? this.loc("resumeAction", "Resume")
      : this.loc("pauseAction", "Pause"));
  }

  private updateOverlay(game: FruitSnapshot): void {
    const visible = game.phase !== "playing";
    this.overlay.setVisible(visible);
    if (!visible) return;
    const configs: Record<Exclude<typeof game.phase, "playing">, {
      title: string;
      copy: string;
      primary: string;
      secondary: string;
    }> = {
      paused: {
        title: this.loc("pauseTitle", "Orchard paused"),
        copy: this.loc("pauseCopy", "The fruit and clock are safely stopped."),
        primary: this.loc("resumeAction", "Resume"),
        secondary: this.loc("newOrchardAction", "New orchard"),
      },
      won: {
        title: this.loc("winTitle", "Basket cleared!"),
        copy: this.loc("winCopy", "All 24 fruit pairs found their match."),
        primary: this.loc("newOrchardAction", "New orchard"),
        secondary: this.loc("newOrchardAction", "New orchard"),
      },
      lost: {
        title: this.loc("lostTitle", "Chute full"),
        copy: this.loc("lostCopy", "Undo the last release or open a fresh orchard."),
        primary: game.history.length > 0
          ? this.loc("undoAction", "Undo")
          : this.loc("newOrchardAction", "New orchard"),
        secondary: this.loc("newOrchardAction", "New orchard"),
      },
      timeout: {
        title: this.loc("timeoutTitle", "Market bell rang"),
        copy: this.loc("timeoutCopy", "Try again with a fresh certified orchard."),
        primary: this.loc("newOrchardAction", "New orchard"),
        secondary: this.loc("newOrchardAction", "New orchard"),
      },
    };
    const config = configs[game.phase as Exclude<typeof game.phase, "playing">];
    this.overlayTitle.setText(config.title);
    this.overlayCopy.setText(config.copy);
    this.overlayPrimary.text.setText(config.primary);
    this.overlaySecondary.text.setText(config.secondary);
    this.overlaySecondary.root.setVisible(game.phase === "paused" || game.phase === "lost");
  }

  private animateAction(previous: FruitSnapshot | null, game: FruitSnapshot): void {
    const action = game.lastAction;
    if (!previous || action.kind === "recovered" || action.kind === "ready" || action.kind === "blocked") return;
    if (action.kind === "undo") {
      this.sfx.play("refund");
      if (!this.reducedMotion) this.cameras.main.flash(130, 255, 246, 196, false);
      return;
    }
    if (action.kind === "won") {
      this.sfx.play("win");
      if (!this.reducedMotion) this.cameras.main.flash(320, 255, 226, 112, false);
      return;
    }
    if (action.kind === "lost" || action.kind === "timeout") this.sfx.play("lose");
    if ((action.kind !== "released" && action.kind !== "matched" && action.kind !== "lost")
      || action.lane === undefined || !action.color) return;
    const actionColor = action.color;

    const startX = VINE_X[action.lane] ?? VINE_X[0];
    const ghost = this.add.image(startX, VINE_FRONT_Y, ASSETS.fruit[actionColor])
      .setDisplaySize(51, 51)
      .setDepth(1_000);
    this.effectLayer.add(ghost);
    const targetIndex = action.kind === "matched"
      ? Math.min(CHANNEL_CAPACITY - 1, previous.channel.length)
      : Math.min(CHANNEL_CAPACITY - 1, game.channel.length - 1);
    const targetX = CHANNEL_X[Math.max(0, targetIndex)] ?? CHANNEL_X[0];
    const liveSprite = action.tokenId ? this.channelSprites.get(action.tokenId) : undefined;
    liveSprite?.setAlpha(0);

    this.animate({
      targets: ghost,
      x: DESIGN_W / 2,
      y: 535,
      angle: 165,
      duration: 220,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.animate({
          targets: ghost,
          x: targetX,
          y: CHANNEL_Y,
          angle: 360,
          duration: 210,
          ease: "Back.easeOut",
          onComplete: () => {
            if (action.kind === "matched") {
              ghost.setDisplaySize(42, 42);
              this.playPairBurst(previous, actionColor, ghost, targetX);
            } else {
              ghost.destroy();
              liveSprite?.setAlpha(1);
              this.sfx.play("land");
            }
          },
        });
      },
    });
  }

  private playPairBurst(
    previous: FruitSnapshot,
    color: FruitColor,
    incoming: Phaser.GameObjects.Image,
    targetX: number,
  ): void {
    const partnerIndex = Math.max(0, previous.channel.length - 1);
    const partnerX = CHANNEL_X[partnerIndex] ?? targetX;
    const partner = this.add.image(partnerX, CHANNEL_Y, ASSETS.fruit[color])
      .setDisplaySize(42, 42)
      .setDepth(1_000);
    this.effectLayer.add(partner);
    this.sfx.play("combo");
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const sparkle = this.add.image(
        (partnerX + targetX) / 2,
        CHANNEL_Y,
        ASSETS.fruit[color],
      ).setDisplaySize(10, 10).setDepth(1_001);
      const sparkleScale = sparkle.scaleX;
      this.effectLayer.add(sparkle);
      this.animate({
        targets: sparkle,
        x: sparkle.x + Math.cos(angle) * 42,
        y: sparkle.y + Math.sin(angle) * 34,
        alpha: 0,
        scale: sparkleScale * 0.35,
        duration: 270,
        ease: "Quad.easeOut",
        onComplete: () => sparkle.destroy(),
      });
    }
    const pairScale = incoming.scaleX;
    this.animate({
      targets: [incoming, partner],
      scale: pairScale * 1.34,
      alpha: 0,
      duration: 250,
      ease: "Back.easeIn",
      onComplete: () => {
        incoming.destroy();
        partner.destroy();
      },
    });
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    label: string,
    primary: boolean,
    action: () => void,
  ): SceneButton {
    const root = this.add.container(x, y).setDepth(100);
    const surface = this.add.graphics();
    const hit = this.add.rectangle(0, 0, width, 48, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "bold",
      color: primary ? "#4b2d1d" : "#553726",
    }).setOrigin(0.5);
    root.add([surface, hit, text]);
    const button: SceneButton = {
      root,
      surface,
      hit,
      text,
      width,
      primary,
      enabled: true,
    };
    this.drawButton(button);
    this.bindGameButton(hit, {
      targets: root,
      enabled: () => button.enabled,
      onPress: () => {
        this.sfx.play("tap");
        action();
      },
    });
    return button;
  }

  private drawButton(button: SceneButton): void {
    const { surface, width, primary, enabled } = button;
    surface.clear();
    surface.fillStyle(
      enabled ? (primary ? 0xffc951 : 0xfffbeb) : 0xe3dac8,
      enabled ? 0.98 : 0.78,
    );
    surface.fillRoundedRect(-width / 2, -24, width, 48, 18);
    surface.lineStyle(1.5, primary ? 0xe69a2e : 0x9f6a3c, enabled ? 0.42 : 0.16);
    surface.strokeRoundedRect(-width / 2, -24, width, 48, 18);
  }

  private setButtonEnabled(button: SceneButton, enabled: boolean): void {
    button.enabled = enabled;
    button.root.setAlpha(enabled ? 1 : 0.48);
    this.drawButton(button);
  }

  private buildOverlay(): void {
    this.overlay = this.add.container(0, 0).setDepth(900).setVisible(false);
    const dim = this.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0x4e351f, 0.46)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0xfffdf2, 0.99);
    panel.fillRoundedRect(34, 264, 322, 330, 28);
    panel.lineStyle(2, 0xffffff, 0.9);
    panel.strokeRoundedRect(34, 264, 322, 330, 28);
    const fruit = this.add.image(DESIGN_W / 2, 315, ASSETS.fruit.peach).setDisplaySize(76, 76);
    this.overlayTitle = this.add.text(DESIGN_W / 2, 372, "", {
      fontFamily: FONT,
      fontSize: "27px",
      fontStyle: "bold",
      color: "#3f2a1f",
      align: "center",
    }).setOrigin(0.5);
    this.overlayCopy = this.add.text(DESIGN_W / 2, 414, "", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#6d5543",
      align: "center",
      wordWrap: { width: 260 },
    }).setOrigin(0.5, 0);
    this.overlay.add([dim, panel, fruit, this.overlayTitle, this.overlayCopy]);
    this.overlayPrimary = this.makeButton(DESIGN_W / 2, 500, 236, "", true, () => {
      const game = this.val<FruitSnapshot>("game");
      if (game?.phase === "paused") this.dispatch("togglePause");
      else if (game?.phase === "lost" && game.history.length > 0) this.dispatch("undoMove");
      else this.dispatch("restartGame");
    });
    this.overlaySecondary = this.makeButton(
      DESIGN_W / 2,
      556,
      236,
      "",
      false,
      () => this.dispatch("restartGame"),
    );
    this.overlay.add([this.overlayPrimary.root, this.overlaySecondary.root]);
  }

  private bindKeyboard(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (/^[1-6]$/.test(key)) {
        this.sfx.unlock();
        this.dispatch("tapLane", Number(key) - 1);
      } else if (key === "h") {
        this.dispatch("requestHint");
      } else if (key === "u") {
        this.dispatch("undoMove");
      } else if (key === "p" || key === " ") {
        this.dispatch("togglePause");
      } else if (key === "r") {
        this.dispatch("restartGame");
      } else {
        return;
      }
      event.preventDefault();
    };
    this.input.keyboard?.on("keydown", this.keyboardHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyboardHandler) this.input.keyboard?.off("keydown", this.keyboardHandler);
    });
  }
}
