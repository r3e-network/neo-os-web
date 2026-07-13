import * as Phaser from "phaser";
import { BaseScene } from "@framework/phaser";
import type { GameState } from "@framework/phaser";
import {
  BEAD_COLORS,
  BOARD_COLS,
  BOARD_ROWS,
  HOLDING_CAPACITY,
} from "../logic/config";
import type { BeadMoveEvent, BeadSnapshot, Position } from "../logic/types";

const DESIGN_W = 390;
const DESIGN_H = 720;
const BOARD_X = 45;
const BOARD_Y = 181;
const CELL_PITCH = 23;
const TRAY_X = 38;
const TRAY_Y = 570;
const TRAY_PITCH = 24.15;
const FONT = "Inter, ui-rounded, system-ui, sans-serif";

const C = {
  ink: 0x442b20,
  inkSoft: 0x765649,
  cream: 0xfffbef,
  creamStrong: 0xfff2d4,
  white: 0xffffff,
  coral: 0xff6f5c,
  coralDark: 0xc94136,
  yellow: 0xffcc4d,
  mint: 0x37bd83,
  border: 0xd8b27a,
  cocoa: 0x5a3420,
  scrim: 0x56392b,
  danger: 0xc43b37,
};

const BEAD_ASSET_NAMES = [
  "coral",
  "sunflower",
  "mint",
  "sky",
  "tangerine",
  "cocoa",
  "raspberry",
] as const;

type CellView = {
  target: Phaser.GameObjects.Image;
  bead: Phaser.GameObjects.Image;
  selection: Phaser.GameObjects.Arc;
  focus: Phaser.GameObjects.Arc;
  hit: Phaser.GameObjects.Zone;
};

type TrayView = {
  socket: Phaser.GameObjects.Arc;
  bead: Phaser.GameObjects.Image;
  selection: Phaser.GameObjects.Arc;
  focus: Phaser.GameObjects.Arc;
  hit: Phaser.GameObjects.Zone;
};

type ButtonView = {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
  enabled: boolean;
};

type SceneCopy = Record<string, string> & { colorNames?: string[] };

function beadTexture(color: number): string {
  return `bead-${BEAD_ASSET_NAMES[color] ?? "coral"}`;
}

function positionKey(position: Position): string {
  return `${position.row},${position.col}`;
}

function formatClock(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export class BeadWorkshopScene extends BaseScene {
  private root!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Image;
  private backgroundWash!: Phaser.GameObjects.Rectangle;
  private boardViews = new Map<string, CellView>();
  private trayViews: TrayView[] = [];
  private validPositions: Position[] = [];
  private currentSnapshot: BeadSnapshot | null = null;
  private copyState: SceneCopy = {};
  private lastActionNonce = -1;
  private lastPhase = "";
  private keyboardMode: "board" | "tray" = "board";
  private boardFocusIndex = 0;
  private trayFocusIndex = 0;
  private restartConfirm = false;

  private timerText!: Phaser.GameObjects.Text;
  private timerLabelText!: Phaser.GameObjects.Text;
  private eyebrowText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private boardTitleText!: Phaser.GameObjects.Text;
  private boardRuleText!: Phaser.GameObjects.Text;
  private trayTitleText!: Phaser.GameObjects.Text;
  private stepsText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private trayCountText!: Phaser.GameObjects.Text;
  private primaryButton!: ButtonView;
  private undoButton!: ButtonView;
  private pauseButton!: ButtonView;
  private restartButton!: ButtonView;

  private modalObjects: Array<
    Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible
  > = [];
  private modalTitle!: Phaser.GameObjects.Text;
  private modalCopy!: Phaser.GameObjects.Text;
  private modalPrimary!: ButtonView;
  private modalSecondary!: ButtonView;

  constructor() {
    super("BeadWorkshopScene");
  }

  preload(): void {
    this.load.image("workshop-bg", "./art/workshop-bg.webp");
    this.load.image("workshop-logo", "./logo.webp");
    BEAD_ASSET_NAMES.forEach((name) => {
      this.load.image(`bead-${name}`, `./art/beads/${name}.webp`);
    });
  }

  create(): void {
    super.create();
    this.root = this.add.container(0, 0);
    this.buildBackdrop();
    this.buildHeader();
    this.buildBoard();
    this.buildTray();
    this.buildControls();
    this.buildModal();
    this.bindKeyboard();
    this.fitToHost();
    this.renderState();
  }

  protected onResize(): void {
    if (this.root) this.fitToHost();
  }

  protected onStateUpdate(state: GameState): void {
    this.copyState = this.val<SceneCopy>("sceneText", {}) ?? {};
    const snapshot = state.game as BeadSnapshot | undefined;
    if (!snapshot?.board || !Array.isArray(snapshot.board)) return;
    const previousNonce = this.lastActionNonce;
    this.currentSnapshot = snapshot;
    this.renderState();
    if (snapshot.lastAction.nonce !== previousNonce) {
      this.lastActionNonce = snapshot.lastAction.nonce;
      this.presentAction(snapshot.lastAction);
    }
    if (snapshot.phase !== this.lastPhase) {
      if (snapshot.phase === "won") this.celebrateWin();
      if (
        (snapshot.phase === "timeout" || snapshot.phase === "stuck") &&
        this.lastPhase
      ) {
        this.sfx.play("lose");
      }
      this.lastPhase = snapshot.phase;
    }
  }

  private copy(key: string, fallback: string): string {
    return this.copyState[key] || fallback;
  }

  private template(
    key: string,
    fallback: string,
    values: Record<string, string | number>,
  ): string {
    return this.copy(key, fallback).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values[name] ?? `{${name}}`),
    );
  }

  private buildBackdrop(): void {
    this.background = this.add
      .image(DESIGN_W / 2, DESIGN_H / 2, "workshop-bg")
      .setDisplaySize(DESIGN_W, DESIGN_H)
      .setDepth(-20);
    this.backgroundWash = this.add
      .rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0xfff4da, 0.22)
      .setDepth(-19);
  }

  private buildHeader(): void {
    const header = this.add
      .rectangle(195, 56, 358, 88, C.cream, 0.94)
      .setStrokeStyle(1.5, C.white, 0.9);
    const logo = this.add.image(45, 49, "workshop-logo").setDisplaySize(54, 54);
    this.eyebrowText = this.add.text(
      78,
      23,
      this.copy("appEyebrow", "SUNLIT PUZZLE STUDIO"),
      {
        fontFamily: FONT,
        fontSize: "8px",
        fontStyle: "bold",
        color: "#a65a42",
        letterSpacing: 1.1,
      },
    );
    this.titleText = this.add.text(
      78,
      37,
      this.copy("appTitle", "Bead Workshop"),
      {
        fontFamily: FONT,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#442b20",
      },
    );

    const timerPill = this.add
      .rectangle(283, 45, 82, 42, C.white, 0.93)
      .setStrokeStyle(1.5, C.border, 0.9);
    this.timerLabelText = this.add.text(
      254,
      29,
      this.copy("timerLabel", "Time"),
      {
        fontFamily: FONT,
        fontSize: "8px",
        fontStyle: "bold",
        color: "#765649",
      },
    );
    this.timerText = this.add.text(254, 39, "3:00", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#442b20",
    });

    this.stepsText = this.add.text(79, 65, "Moves 0", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#765649",
    });
    this.progressText = this.add.text(154, 65, "Matched 0/140", {
      fontFamily: FONT,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#765649",
    });
    const progressTrack = this.add
      .rectangle(196, 91, 320, 7, 0xf1ddbd, 1)
      .setOrigin(0.5);
    this.progressFill = this.add
      .rectangle(36, 91, 0, 7, C.mint, 1)
      .setOrigin(0, 0.5);
    this.root.add([
      header,
      logo,
      this.eyebrowText,
      this.titleText,
      timerPill,
      this.timerLabelText,
      this.timerText,
      this.stepsText,
      this.progressText,
      progressTrack,
      this.progressFill,
    ]);
  }

  private buildBoard(): void {
    const panel = this.add
      .rectangle(195, 318, 358, 414, C.cream, 0.96)
      .setStrokeStyle(2, C.white, 0.92);
    this.boardTitleText = this.add.text(
      31,
      119,
      this.copy("boardLabel", "Pattern board"),
      {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#442b20",
      },
    );
    this.boardRuleText = this.add.text(
      31,
      139,
      this.copy("selectPatch", "Select a bead patch"),
      {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#765649",
      },
    );
    this.root.add([panel, this.boardTitleText, this.boardRuleText]);
    this.restartButton = this.makeButton(
      323,
      128,
      58,
      27,
      this.copy("restartAction", "Restart"),
      () => {
        this.restartConfirm = true;
        this.updateModal();
      },
      false,
    );

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const x = BOARD_X + col * CELL_PITCH;
        const y = BOARD_Y + row * CELL_PITCH;
        const target = this.add
          .image(x, y, beadTexture(0))
          .setDisplaySize(18.5, 18.5)
          .setAlpha(0);
        const bead = this.add
          .image(x, y, beadTexture(0))
          .setDisplaySize(19.5, 19.5)
          .setVisible(false);
        const selection = this.add
          .circle(x, y, 10.7, C.white, 0)
          .setStrokeStyle(2.2, C.coralDark, 1)
          .setVisible(false);
        const focus = this.add
          .circle(x, y, 11.4, C.white, 0)
          .setStrokeStyle(2, C.ink, 1)
          .setVisible(false);
        const hit = this.add
          .zone(x, y, CELL_PITCH, CELL_PITCH)
          .setInteractive({ useHandCursor: true });
        const position = { row, col };
        hit.on("pointerdown", () => this.activateBoard(position));
        this.root.add([target, bead, selection, focus, hit]);
        this.boardViews.set(positionKey(position), {
          target,
          bead,
          selection,
          focus,
          hit,
        });
      }
    }
  }

  private buildTray(): void {
    const trayPanel = this.add
      .rectangle(195, 564, 358, 83, C.creamStrong, 0.98)
      .setStrokeStyle(2, C.white, 0.9);
    this.trayTitleText = this.add.text(
      31,
      529,
      this.copy("trayLabel", "14-slot tray"),
      {
        fontFamily: FONT,
        fontSize: "12px",
        fontStyle: "bold",
        color: "#442b20",
      },
    );
    this.trayCountText = this.add
      .text(348, 529, "0/14", {
        fontFamily: FONT,
        fontSize: "10px",
        fontStyle: "bold",
        color: "#765649",
      })
      .setOrigin(1, 0);
    this.root.add([trayPanel, this.trayTitleText, this.trayCountText]);

    for (let index = 0; index < HOLDING_CAPACITY; index += 1) {
      const x = TRAY_X + index * TRAY_PITCH;
      const socket = this.add
        .circle(x, TRAY_Y, 9.2, C.white, 0.66)
        .setStrokeStyle(1.3, C.border, 1);
      const bead = this.add
        .image(x, TRAY_Y, beadTexture(0))
        .setDisplaySize(19.5, 19.5)
        .setVisible(false);
      const selection = this.add
        .circle(x, TRAY_Y, 10.8, C.white, 0)
        .setStrokeStyle(2.3, C.coralDark, 1)
        .setVisible(false);
      const focus = this.add
        .circle(x, TRAY_Y, 11.5, C.white, 0)
        .setStrokeStyle(2, C.ink, 1)
        .setVisible(false);
      const hit = this.add
        .zone(x, TRAY_Y, 23, 31)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.activateTray(index));
      this.root.add([socket, bead, selection, focus, hit]);
      this.trayViews.push({ socket, bead, selection, focus, hit });
    }
  }

  private buildControls(): void {
    this.statusText = this.add
      .text(
        195,
        615,
        this.copy("statusReady", "Pick a mismatched patch to begin"),
        {
          fontFamily: FONT,
          fontSize: "11px",
          fontStyle: "bold",
          color: "#5e3d2f",
          align: "center",
          wordWrap: { width: 340 },
        },
      )
      .setOrigin(0.5);
    const statusPlate = this.add
      .rectangle(195, 615, 350, 31, C.white, 0.88)
      .setStrokeStyle(1, C.border, 0.65);
    this.root.add([statusPlate, this.statusText]);

    this.undoButton = this.makeButton(
      49,
      674,
      66,
      46,
      this.copy("undoAction", "Undo"),
      () => {
        this.dispatch("undoMove");
      },
    );
    this.primaryButton = this.makeButton(
      195,
      674,
      204,
      46,
      this.copy("selectPatch", "Select a patch"),
      () => {
        this.dispatch("moveSelectionToHolding");
      },
      true,
    );
    this.pauseButton = this.makeButton(
      341,
      674,
      66,
      46,
      this.copy("pauseAction", "Pause"),
      () => {
        this.dispatch("togglePause");
      },
    );
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onPress: () => void,
    primary = false,
  ): ButtonView {
    const bg = this.add
      .rectangle(x, y, width, height, primary ? C.coral : C.cream, 1)
      .setStrokeStyle(primary ? 0 : 1.5, primary ? C.coral : C.border, 1);
    const text = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: primary ? "12px" : "11px",
        fontStyle: "bold",
        color: primary ? "#ffffff" : "#5b3829",
        align: "center",
        wordWrap: { width: width - 10 },
      })
      .setOrigin(0.5);
    const hit = this.add
      .zone(x, y, width, height)
      .setInteractive({ useHandCursor: true });
    const button: ButtonView = { bg, label: text, hit, enabled: true };
    this.bindGameButton(hit, {
      targets: [bg, text],
      enabled: () => button.enabled,
      onPress,
      pressScale: 0.97,
      hoverScale: 1.02,
    });
    this.root.add([bg, text, hit]);
    return button;
  }

  private buildModal(): void {
    const scrim = this.add
      .rectangle(195, 360, DESIGN_W, DESIGN_H, C.scrim, 0.48)
      .setInteractive();
    const panel = this.add
      .rectangle(195, 350, 318, 252, C.cream, 1)
      .setStrokeStyle(3, C.white, 1);
    const logo = this.add
      .image(195, 259, "workshop-logo")
      .setDisplaySize(70, 70);
    this.modalTitle = this.add
      .text(195, 302, "", {
        fontFamily: FONT,
        fontSize: "22px",
        fontStyle: "bold",
        color: "#442b20",
        align: "center",
      })
      .setOrigin(0.5);
    this.modalCopy = this.add
      .text(195, 352, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#765649",
        align: "center",
        wordWrap: { width: 260 },
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    this.root.add([scrim, panel, logo, this.modalTitle, this.modalCopy]);
    this.modalPrimary = this.makeButton(
      195,
      415,
      238,
      44,
      "",
      () => this.activateModalPrimary(),
      true,
    );
    this.modalSecondary = this.makeButton(
      195,
      467,
      238,
      36,
      "",
      () => this.activateModalSecondary(),
      false,
    );
    this.modalObjects = [
      scrim,
      panel,
      logo,
      this.modalTitle,
      this.modalCopy,
      this.modalPrimary.bg,
      this.modalPrimary.label,
      this.modalPrimary.hit,
      this.modalSecondary.bg,
      this.modalSecondary.label,
      this.modalSecondary.hit,
    ];
    this.setModalVisible(false);
  }

  private renderState(): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot || !this.root) return;
    this.eyebrowText.setText(this.copy("appEyebrow", "SUNLIT PUZZLE STUDIO"));
    this.titleText.setText(this.copy("appTitle", "Bead Workshop"));
    this.timerLabelText.setText(this.copy("timerLabel", "Time"));
    this.boardTitleText.setText(this.copy("boardLabel", "Pattern board"));
    this.boardRuleText.setText(this.copy("selectPatch", "Select a bead patch"));
    this.trayTitleText.setText(this.copy("trayLabel", "14-slot tray"));
    this.restartButton.label.setText(this.copy("restartAction", "Restart"));
    this.undoButton.label.setText(this.copy("undoAction", "Undo"));
    this.validPositions = [];
    const selectedPositions =
      snapshot.selection?.source === "board"
        ? new Set(snapshot.selection.cells.map(positionKey))
        : new Set<string>();

    for (const row of snapshot.board) {
      for (const cell of row) {
        const view = this.boardViews.get(positionKey(cell));
        if (!view) continue;
        view.hit.setVisible(cell.valid).setActive(cell.valid);
        view.target.setVisible(cell.valid).setAlpha(cell.valid ? 0.29 : 0);
        view.selection.setVisible(
          cell.valid && selectedPositions.has(positionKey(cell)),
        );
        if (!cell.valid) {
          view.bead.setVisible(false);
          view.focus.setVisible(false);
          continue;
        }
        this.validPositions.push({ row: cell.row, col: cell.col });
        view.target.setTexture(beadTexture(cell.targetColor));
        if (cell.beadColor === null) {
          view.bead.setVisible(false);
        } else {
          const matched = cell.beadColor === cell.targetColor;
          view.bead
            .setTexture(beadTexture(cell.beadColor))
            .setVisible(true)
            .setAlpha(matched ? 0.95 : 1)
            .setScale(matched ? 0.19 : 0.203);
          view.target.setAlpha(matched ? 0.08 : 0.29);
        }
      }
    }

    this.trayViews.forEach((view, index) => {
      const bead = snapshot.holding[index];
      view.bead.setVisible(Boolean(bead));
      if (bead)
        view.bead
          .setTexture(beadTexture(bead.color))
          .setAlpha(1)
          .setScale(0.203);
      const selected = Boolean(
        bead &&
        snapshot.selection?.source === "holding" &&
        snapshot.selection.color === bead.color,
      );
      view.selection.setVisible(selected);
      view.socket.setFillStyle(bead ? C.white : C.cream, bead ? 0.35 : 0.66);
    });

    this.timerText.setText(formatClock(snapshot.remainingMs));
    this.timerText.setColor(
      snapshot.remainingMs < 30_000 ? "#c43b37" : "#442b20",
    );
    this.stepsText.setText(
      `${this.copy("stepsLabel", "Moves")} ${snapshot.steps}`,
    );
    this.progressText.setText(
      `${this.copy("progressLabel", "Matched")} ${snapshot.matched}/${snapshot.total}`,
    );
    this.progressFill.displayWidth =
      320 * Math.max(0, Math.min(1, snapshot.matched / snapshot.total));
    this.trayCountText.setText(
      `${snapshot.holding.length}/${HOLDING_CAPACITY}`,
    );
    const status = this.copy(snapshot.messageKey, snapshot.messageKey);
    this.statusText.setText(
      this.bool("storageHealthy")
        ? status
        : this.copy("storageWarning", "Progress cannot be saved"),
    );

    const boardSelection =
      snapshot.selection?.source === "board" ? snapshot.selection : null;
    this.primaryButton.enabled =
      snapshot.phase === "playing" && Boolean(boardSelection);
    this.primaryButton.label.setText(
      boardSelection
        ? this.template("moveToTray", "Move {count} to tray", {
            count: boardSelection.cells.length,
          })
        : this.copy("selectPatch", "Select a bead patch"),
    );
    this.setButtonEnabled(this.primaryButton, this.primaryButton.enabled);
    this.undoButton.enabled =
      snapshot.history.length > 0 &&
      !["won", "timeout"].includes(snapshot.phase);
    this.setButtonEnabled(this.undoButton, this.undoButton.enabled);
    this.pauseButton.enabled =
      snapshot.phase === "playing" || snapshot.phase === "paused";
    this.pauseButton.label.setText(
      snapshot.phase === "paused"
        ? this.copy("resumeAction", "Resume")
        : this.copy("pauseAction", "Pause"),
    );
    this.setButtonEnabled(this.pauseButton, this.pauseButton.enabled);
    this.updateFocus();
    this.updateModal();
  }

  private setButtonEnabled(button: ButtonView, enabled: boolean): void {
    button.enabled = enabled;
    button.bg.setAlpha(enabled ? 1 : 0.48);
    button.label.setAlpha(enabled ? 1 : 0.6);
    if (button.hit.input)
      button.hit.input.cursor = enabled ? "pointer" : "default";
  }

  private updateModal(): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot) return;
    const mode = this.restartConfirm ? "restart" : snapshot.phase;
    const visible =
      this.restartConfirm ||
      ["paused", "won", "timeout", "stuck"].includes(snapshot.phase);
    this.setModalVisible(visible);
    if (!visible) return;

    const config =
      mode === "restart"
        ? {
            title: this.copy("restartTitle", "Start over?"),
            copy: this.copy(
              "restartCopy",
              "Your current pattern will be replaced.",
            ),
            primary: this.copy("newPatternAction", "New pattern"),
            secondary: this.copy("cancelAction", "Keep playing"),
          }
        : mode === "paused"
          ? {
              title: this.copy("pauseTitle", "Workshop paused"),
              copy: this.copy("pauseCopy", "The clock is stopped."),
              primary: this.copy("resumeAction", "Resume"),
              secondary: this.copy("restartAction", "Restart"),
            }
          : mode === "won"
            ? {
                title: this.copy("winTitle", "Pattern complete!"),
                copy: this.copy("winCopy", "Every bead has found its socket."),
                primary: this.copy("newPatternAction", "New pattern"),
                secondary: "",
              }
            : mode === "timeout"
              ? {
                  title: this.copy("timeoutTitle", "Studio clock ended"),
                  copy: this.copy(
                    "timeoutCopy",
                    "Try again with a fresh pattern.",
                  ),
                  primary: this.copy("newPatternAction", "New pattern"),
                  secondary: "",
                }
              : {
                  title: this.copy("stuckTitle", "No safe move remains"),
                  copy: this.copy(
                    "stuckCopy",
                    "Undo a move or open a fresh pattern.",
                  ),
                  primary:
                    snapshot.history.length > 0
                      ? this.copy("undoAction", "Undo")
                      : this.copy("newPatternAction", "New pattern"),
                  secondary:
                    snapshot.history.length > 0
                      ? this.copy("newPatternAction", "New pattern")
                      : "",
                };
    this.modalTitle.setText(config.title);
    this.modalCopy.setText(config.copy);
    this.modalPrimary.label.setText(config.primary);
    this.modalSecondary.label.setText(config.secondary);
    const showSecondary = Boolean(config.secondary);
    [
      this.modalSecondary.bg,
      this.modalSecondary.label,
      this.modalSecondary.hit,
    ].forEach((object) => object.setVisible(showSecondary));
    this.modalPrimary.enabled = true;
    this.modalSecondary.enabled = showSecondary;
  }

  private setModalVisible(visible: boolean): void {
    this.modalObjects.forEach((object) => object.setVisible(visible));
  }

  private activateModalPrimary(): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot) return;
    if (
      this.restartConfirm ||
      snapshot.phase === "won" ||
      snapshot.phase === "timeout"
    ) {
      this.restartConfirm = false;
      this.dispatch("restartGame");
      this.sfx.play("start");
      return;
    }
    if (snapshot.phase === "paused") {
      this.dispatch("togglePause");
      return;
    }
    if (snapshot.phase === "stuck") {
      if (snapshot.history.length > 0) this.dispatch("undoMove");
      else this.dispatch("restartGame");
    }
  }

  private activateModalSecondary(): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot) return;
    if (this.restartConfirm) {
      this.restartConfirm = false;
      this.updateModal();
      return;
    }
    if (snapshot.phase === "paused") {
      this.restartConfirm = true;
      this.updateModal();
      return;
    }
    if (snapshot.phase === "stuck") this.dispatch("restartGame");
  }

  private activateBoard(position: Position): void {
    if (
      this.restartConfirm ||
      !this.currentSnapshot ||
      this.currentSnapshot.phase !== "playing"
    )
      return;
    this.keyboardMode = "board";
    const index = this.validPositions.findIndex(
      (item) => item.row === position.row && item.col === position.col,
    );
    if (index >= 0) this.boardFocusIndex = index;
    this.sfx.unlock();
    this.dispatch("tapBoard", position);
  }

  private activateTray(index: number): void {
    if (
      this.restartConfirm ||
      !this.currentSnapshot ||
      this.currentSnapshot.phase !== "playing"
    )
      return;
    this.keyboardMode = "tray";
    this.trayFocusIndex = index;
    this.sfx.unlock();
    this.dispatch("tapHolding", { index });
  }

  private presentAction(action: BeadMoveEvent): void {
    if (action.kind === "blocked") {
      this.sfx.play("error");
      this.cameras.main.shake(75, 0.0015);
      return;
    }
    if (action.kind === "selected") {
      this.sfx.play("select");
      return;
    }
    if (
      ["to-holding", "board-place", "holding-place", "won"].includes(
        action.kind,
      )
    ) {
      if (action.kind !== "won") this.sfx.play("move");
      this.animateMove(action);
    }
  }

  private animateMove(action: BeadMoveEvent): void {
    if (this.reducedMotion || action.color === undefined) return;
    let starts: Phaser.Math.Vector2[] = [];
    let ends: Phaser.Math.Vector2[] = [];
    if (action.holdingTo?.length && action.from?.length) {
      starts = action.from.map((position) => this.boardPoint(position));
      ends = action.holdingTo.map((index) => this.trayPoint(index));
    } else if (action.holdingFrom?.length && action.to?.length) {
      starts = action.holdingFrom.map((index) => this.trayPoint(index));
      ends = action.to.map((position) => this.boardPoint(position));
    } else if (action.from?.length && action.to?.length) {
      starts = action.from.map((position) => this.boardPoint(position));
      ends = action.to.map((position) => this.boardPoint(position));
    }
    const count = Math.min(starts.length, ends.length, 14);
    for (let index = 0; index < count; index += 1) {
      const start = starts[index];
      const end = ends[index];
      if (!start || !end) continue;
      const ghost = this.add
        .image(start.x, start.y, beadTexture(action.color))
        .setDisplaySize(20, 20);
      this.root.add(ghost);
      this.tweens.add({
        targets: ghost,
        x: end.x,
        y: end.y,
        scale: { from: 0.2, to: 0.225 },
        duration: 230,
        delay: index * 16,
        ease: "Cubic.easeInOut",
        onComplete: () => {
          this.tweens.add({
            targets: ghost,
            scale: 0.16,
            alpha: 0,
            duration: 85,
            onComplete: () => ghost.destroy(),
          });
        },
      });
    }
  }

  private celebrateWin(): void {
    if (this.reducedMotion) return;
    this.sfx.play("win");
    for (let index = 0; index < 28; index += 1) {
      const color = index % BEAD_COLORS.length;
      const bead = this.add
        .image(Phaser.Math.Between(20, 370), -20, beadTexture(color))
        .setDisplaySize(
          Phaser.Math.Between(12, 19),
          Phaser.Math.Between(12, 19),
        )
        .setAngle(Phaser.Math.Between(-120, 120));
      this.root.add(bead);
      this.tweens.add({
        targets: bead,
        y: Phaser.Math.Between(560, 740),
        x: `+=${Phaser.Math.Between(-60, 60)}`,
        angle: Phaser.Math.Between(240, 720),
        duration: Phaser.Math.Between(900, 1_500),
        delay: index * 24,
        ease: "Quad.easeIn",
        onComplete: () => bead.destroy(),
      });
    }
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on("keydown", (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "tab",
        ].includes(key)
      ) {
        event.preventDefault();
      }
      if (key === "escape") {
        if (this.restartConfirm) {
          this.restartConfirm = false;
          this.updateModal();
        } else if (
          this.currentSnapshot?.phase === "playing" ||
          this.currentSnapshot?.phase === "paused"
        ) {
          this.dispatch("togglePause");
        }
        return;
      }
      if (key === "r") {
        this.restartConfirm = true;
        this.updateModal();
        return;
      }
      if (key === "p") {
        this.dispatch("togglePause");
        return;
      }
      if (key === "u") {
        this.dispatch("undoMove");
        return;
      }
      if (key === "t") {
        this.dispatch("moveSelectionToHolding");
        return;
      }
      if (key === "tab") {
        if ((this.currentSnapshot?.holding.length ?? 0) > 0) {
          this.keyboardMode = this.keyboardMode === "board" ? "tray" : "board";
          this.updateFocus();
        }
        return;
      }
      if (key === "enter" || key === " ") {
        if (this.keyboardMode === "tray")
          this.activateTray(this.trayFocusIndex);
        else {
          const position = this.validPositions[this.boardFocusIndex];
          if (position) this.activateBoard(position);
        }
        return;
      }
      const delta =
        key === "arrowleft"
          ? -1
          : key === "arrowright"
            ? 1
            : key === "arrowup"
              ? -BOARD_COLS
              : key === "arrowdown"
                ? BOARD_COLS
                : 0;
      if (!delta) return;
      if (this.keyboardMode === "tray") {
        const last = Math.max(
          0,
          (this.currentSnapshot?.holding.length ?? 1) - 1,
        );
        this.trayFocusIndex = Phaser.Math.Clamp(
          this.trayFocusIndex + Math.sign(delta),
          0,
          last,
        );
      } else {
        this.boardFocusIndex = Phaser.Math.Wrap(
          this.boardFocusIndex + delta,
          0,
          this.validPositions.length,
        );
      }
      this.sfx.unlock();
      this.updateFocus();
    });
  }

  private updateFocus(): void {
    const focusedBoard = this.validPositions[this.boardFocusIndex];
    this.boardViews.forEach((view, key) => {
      view.focus.setVisible(
        this.keyboardMode === "board" &&
          focusedBoard !== undefined &&
          key === positionKey(focusedBoard),
      );
    });
    this.trayViews.forEach((view, index) => {
      view.focus.setVisible(
        this.keyboardMode === "tray" &&
          index === this.trayFocusIndex &&
          index < (this.currentSnapshot?.holding.length ?? 0),
      );
    });
  }

  private boardPoint(position: Position): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      BOARD_X + position.col * CELL_PITCH,
      BOARD_Y + position.row * CELL_PITCH,
    );
  }

  private trayPoint(index: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(TRAY_X + index * TRAY_PITCH, TRAY_Y);
  }

  private fitToHost(): void {
    const width = this.scale.width || DESIGN_W;
    const height = this.scale.height || DESIGN_H;
    const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
    this.root.setScale(scale);
    this.root.setPosition(
      (width - DESIGN_W * scale) / 2,
      (height - DESIGN_H * scale) / 2,
    );
    this.background
      .setPosition(width / 2, height / 2)
      .setDisplaySize(width, height);
    this.backgroundWash
      .setPosition(width / 2, height / 2)
      .setSize(width, height)
      .setDisplaySize(width, height);
  }
}
