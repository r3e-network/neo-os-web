/**
 * gomoku.phaser-playarea.test.tsx — DOM contract for the Gomoku Phaser wrapper.
 *
 * The canvas is mocked so the assertions target what the wrapper actually owns:
 * the props/state handed to the scene bridge, the HUD, the in-game drawer, and
 * the keyboard/screen-reader control surface that mirrors every canvas action
 * into real DOM buttons (a keyboard-only player must be able to pick a
 * difficulty, start, place a stone, undo, pause and restart without the canvas).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({ phaserGame: vi.fn() }));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => ({
  LazyPhaserGameComponent: (props: unknown) => {
    mocks.phaserGame(props);
    return <div data-testid="gomoku-phaser-host" />;
  },
}));

import PhaserPlayArea from "../../gomoku/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

const BOARD_SIZE = 15;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

const CATALOG: Record<string, string> = {
  appEyebrow: "Gomoku Arena",
  appSubtitle: "Play five-in-a-row against a local AI",
  lobbyTitle: "Start a game",
  lobbySub: "Five in a row wins",
  playingTitle: "{difficulty} game in play",
  statusWonTitle: "You win!",
  statusLostTitle: "AI wins",
  difficulty_easy: "Casual AI",
  difficulty_medium: "Sharp AI",
  difficulty_hard: "Ruthless AI",
  diffName_0: "Easy",
  diffName_1: "Medium",
  diffName_2: "Hard",
  routeSummary: "Run summary",
  startAction: "Start game",
  playAgainAction: "Play again",
  tryAgainAction: "Try again",
  startingShort: "Starting",
  yourTurn: "Your turn",
  aiThinking: "AI thinking",
  undoShort: "Undo",
  pauseShort: "Pause",
  resumeShort: "Resume",
  restartShort: "Restart",
  pausedTitle: "Paused",
  pausedCopy: "Resume when ready",
  resultWin: "You win",
  resultLose: "You lose",
  resultDraw: "Draw",
  timeMetric: "Time left",
  winsLabel: "Wins",
  drawerTitle: "Run details",
  drawerTitleShort: "Details",
  closeDrawer: "Close details",
  guestModeLabel: "Mode",
  guestModeValue: "Guest",
  guestBestLabel: "Best score",
  guestRunLabel: "Run",
  guestRunValue: "Practice",
  guestFairnessShort: "Local play, nothing at stake",
  guestRulesShort: "Five in a row wins the board",
  canvasAriaLabel: "Gomoku Arena interactive board",
  canvasLoadingLabel: "Loading Gomoku board",
  a11yControlsLabel: "Keyboard controls",
  a11yDifficultyLabel: "Choose AI difficulty",
  a11yBoardLabel: "Gomoku board, 15 rows by 15 columns",
  a11yBoardPending: "Board is syncing",
  a11yCellEmpty: "Row {row}, column {col}, empty",
  a11yCellBlack: "Row {row}, column {col}, your stone",
  a11yCellWhite: "Row {row}, column {col}, AI stone",
  a11yUndoLabel: "Undo last move, {left} remaining",
  a11yMovesPlayed: "{moves} moves played",
};

function t(key: string, params?: Record<string, string | number>): string {
  let value = CATALOG[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

const BASE_STATE: Record<string, unknown> = {
  gameStatus: "idle",
  gameDifficulty: 0,
  deadline: 0,
  dealtAt: 0,
  isStarting: false,
  isPaused: false,
  lastStatus: "",
  undosUsed: 0,
  myTotalWon: 0,
  mySolves: 0,
  appMode: "guest",
  walletConnected: false,
  leaderboard: [],
};

function state(overrides: Record<string, unknown> = {}): ObservableState {
  return Object.fromEntries(
    Object.entries({ ...BASE_STATE, ...overrides }).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  ) as unknown as ObservableState;
}

/** Build the `boardUpdate` frame the guest engine publishes through `lastStatus`. */
function boardFrame(
  stones: Record<number, 1 | 2> = {},
  extra: { currentTurn?: number; gameOver?: boolean; moves?: number } = {},
): string {
  const cells = Array.from({ length: CELL_COUNT }, (_, cell) => String(stones[cell] ?? 0));
  return JSON.stringify({
    type: "boardUpdate",
    board: cells.join(""),
    currentTurn: extra.currentTurn ?? 1,
    gameOver: extra.gameOver ?? false,
    moves: extra.moves ?? Object.keys(stones).length,
  });
}

function latestPhaserProps() {
  return mocks.phaserGame.mock.calls.at(-1)?.[0] as {
    ariaLabel?: string;
    className?: string;
    config?: { width?: number; height?: number };
    dispatch: (action: string, ...args: unknown[]) => unknown;
    loadingLabel?: string;
    state: Record<string, unknown>;
  };
}

function renderPlayArea(overrides: Record<string, unknown> = {}) {
  const dispatch = vi.fn(async () => undefined);
  const view = render(
    <PhaserPlayArea t={t} state={state(overrides)} dispatch={dispatch} />,
  );
  return { ...view, dispatch };
}

function cellButton(container: HTMLElement, cell: number): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-gomoku-cell="${cell}"]`,
  );
  if (!button) throw new Error(`cell ${cell} button missing`);
  return button;
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) throw new Error(`button labelled "${label}" missing`);
  return button;
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );
  if (!match) throw new Error(`button with text "${text}" missing`);
  return match as HTMLButtonElement;
}

describe("gomoku PhaserPlayArea — scene bridge", () => {
  it("hands the canvas its config, labels and guest bridge state", () => {
    const { container } = renderPlayArea();

    expect(container.querySelector("[data-testid='gomoku-phaser-host']")).toBeTruthy();
    expect(container.querySelector(".gomoku-stage-shell")).toBeTruthy();

    const props = latestPhaserProps();
    expect(props.className).toBe("gomoku-phaser-canvas");
    expect(props.ariaLabel).toBe(t("canvasAriaLabel"));
    expect(props.loadingLabel).toBe(t("canvasLoadingLabel"));
    expect(props.config).toMatchObject({ width: 420, height: 620 });
    expect(props.state.appMode).toBe("guest");
    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.isPaused).toBe(false);
  });

  it("forwards every canvas label the scene renders", () => {
    renderPlayArea({ gameDifficulty: 2 });

    const labels = latestPhaserProps().state.labels as Record<string, unknown>;
    expect(labels.lobbyTitle).toBe(t("lobbyTitle"));
    expect(labels.diffNames).toEqual([t("diffName_0"), t("diffName_1"), t("diffName_2")]);
    expect(labels.diffCopy).toEqual([
      t("difficulty_easy"),
      t("difficulty_medium"),
      t("difficulty_hard"),
    ]);
    expect(labels.yourTurn).toBe(t("yourTurn"));
    expect(labels.aiThinking).toBe(t("aiThinking"));
    expect(labels.act).toMatchObject({
      open: t("startAction"),
      playAgain: t("playAgainAction"),
      tryAgain: t("tryAgainAction"),
      starting: t("startingShort"),
    });
    expect(labels.resultWin).toBe(t("resultWin"));
    expect(labels.resultLose).toBe(t("resultLose"));
    expect(labels.resultDraw).toBe(t("resultDraw"));
  });

  it("titles the stage from the run status and keeps guest framing", () => {
    const { container, unmount } = renderPlayArea();
    expect(container.textContent).toContain(t("lobbyTitle"));
    expect(container.textContent).toContain(t("guestModeValue"));
    expect(container.textContent).not.toMatch(/GAS|withdraw|deposit/i);
    unmount();

    const dealt = renderPlayArea({ gameStatus: "dealt", gameDifficulty: 1 });
    expect(dealt.container.textContent).toContain(
      t("playingTitle", { difficulty: t("difficulty_medium") }),
    );
    dealt.unmount();

    const solved = renderPlayArea({ gameStatus: "solved" });
    expect(solved.container.textContent).toContain(t("statusWonTitle"));
    solved.unmount();

    const expired = renderPlayArea({ gameStatus: "expired" });
    expect(expired.container.textContent).toContain(t("statusLostTitle"));
  });

  it("shows the guest HUD metrics and reflects the live deadline", () => {
    const now = Date.now();
    const { container } = renderPlayArea({
      gameStatus: "dealt",
      deadline: now + 65_000,
      dealtAt: now,
      mySolves: 4,
    });

    const metrics = Array.from(container.querySelectorAll(".gomoku-stage-hud__metric"));
    expect(metrics).toHaveLength(3);
    expect(metrics[0]?.textContent).toContain(t("guestRunValue"));
    expect(metrics[0]?.getAttribute("data-accent")).toBe("true");
    expect(metrics[1]?.textContent).toContain(t("timeMetric"));
    expect(metrics[1]?.textContent).toMatch(/1:0\d/);
    expect(metrics[2]?.textContent).toContain("4");
  });
});

describe("gomoku PhaserPlayArea — in-game drawer", () => {
  it("opens, exposes run details, and closes from its own button", () => {
    const { container } = renderPlayArea({ gameStatus: "dealt", myTotalWon: 1_280 });

    const toggle = container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.click(toggle!);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe(t("drawerTitle"));
    expect(dialog?.textContent).toContain(t("guestBestLabel"));
    expect(dialog?.textContent).toContain("1280");
    expect(dialog?.textContent).toContain(t("guestRulesShort"));
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(buttonByLabel(container, t("closeDrawer")));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes on Escape and returns focus to the toggle", () => {
    const { container } = renderPlayArea({ gameStatus: "dealt" });
    const toggle = container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer");

    fireEvent.click(toggle!);
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("offers pause and restart only while a board is live", () => {
    const idle = renderPlayArea();
    fireEvent.click(idle.container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer")!);
    expect(idle.container.querySelectorAll(".gomoku-ingame-drawer__actions button")).toHaveLength(0);
    idle.unmount();

    const { container, dispatch } = renderPlayArea({ gameStatus: "dealt", gameDifficulty: 2 });
    fireEvent.click(container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer")!);
    const actions = container.querySelectorAll(".gomoku-ingame-drawer__actions button");
    expect(actions).toHaveLength(2);

    fireEvent.click(actions[0] as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("togglePause", {});
    // Acting from the drawer closes it, so the run stays visible on the canvas.
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.click(container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer")!);
    const restart = container.querySelectorAll(".gomoku-ingame-drawer__actions button")[1];
    fireEvent.click(restart as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("restartGame", { difficulty: 2 });
  });

  it("labels the pause action as resume while the run is paused", () => {
    const { container } = renderPlayArea({ gameStatus: "dealt", isPaused: true });
    fireEvent.click(container.querySelector<HTMLButtonElement>(".gomoku-stage-hud__drawer")!);
    const actions = container.querySelectorAll(".gomoku-ingame-drawer__actions button");
    expect(actions[0]?.textContent).toContain(t("resumeShort"));
  });
});

describe("gomoku PhaserPlayArea — keyboard and screen-reader controls", () => {
  it("lets a keyboard player choose a difficulty and start without the canvas", () => {
    const { container, dispatch } = renderPlayArea();

    const controls = container.querySelector(".gomoku-a11y-controls");
    expect(controls?.getAttribute("aria-label")).toBe(t("a11yControlsLabel"));

    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("aria-label")).toBe(t("a11yDifficultyLabel"));
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios).toHaveLength(3);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    expect(radios[2]?.textContent).toContain(t("diffName_2"));

    fireEvent.click(radios[2] as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", { difficulty: 2 });

    fireEvent.click(buttonByText(container, t("startAction")));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 0 });
  });

  it("starts on the difficulty the shared state reports", () => {
    const { container, dispatch } = renderPlayArea({ gameDifficulty: 1 });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(buttonByText(container, t("startAction")));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 1 });
  });

  it("relabels the start button per outcome and blocks double starts", () => {
    const solved = renderPlayArea({ gameStatus: "solved" });
    expect(buttonByText(solved.container, t("playAgainAction"))).toBeTruthy();
    solved.unmount();

    const expired = renderPlayArea({ gameStatus: "expired" });
    expect(buttonByText(expired.container, t("tryAgainAction"))).toBeTruthy();
    expired.unmount();

    const starting = renderPlayArea({ isStarting: true });
    const button = buttonByText(starting.container, t("startingShort"));
    expect(button.disabled).toBe(true);
  });

  it("mirrors the scene board frame into a 225-cell button grid", () => {
    const { container } = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame({ 0: 1, 16: 2 }, { moves: 2 }),
    });

    const board = container.querySelector(".gomoku-a11y-board");
    expect(board?.getAttribute("role")).toBe("group");
    expect(board?.getAttribute("aria-label")).toBe(t("a11yBoardLabel"));
    expect(container.querySelectorAll("[data-gomoku-cell]")).toHaveLength(CELL_COUNT);

    expect(cellButton(container, 0).getAttribute("aria-label")).toBe(
      t("a11yCellBlack", { row: 1, col: 1 }),
    );
    expect(cellButton(container, 16).getAttribute("aria-label")).toBe(
      t("a11yCellWhite", { row: 2, col: 2 }),
    );
    expect(cellButton(container, 17).getAttribute("aria-label")).toBe(
      t("a11yCellEmpty", { row: 2, col: 3 }),
    );
    expect(cellButton(container, 0).disabled).toBe(true);
    expect(cellButton(container, 17).disabled).toBe(false);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      t("a11yMovesPlayed", { moves: 2 }),
    );
  });

  it("places a stone on the cell the player activates", () => {
    const { container, dispatch } = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame({ 112: 1 }, { moves: 1 }),
    });

    fireEvent.click(cellButton(container, 113));
    expect(dispatch).toHaveBeenCalledWith("placeStone", { cell: 113 });

    dispatch.mockClear();
    fireEvent.click(cellButton(container, 112));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("moves focus across the grid with the arrow keys", () => {
    const { container } = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame(),
    });

    const origin = cellButton(container, 0);
    expect(origin.tabIndex).toBe(0);
    expect(cellButton(container, 1).tabIndex).toBe(-1);

    fireEvent.keyDown(origin, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cellButton(container, 1));
    expect(cellButton(container, 1).tabIndex).toBe(0);
    expect(origin.tabIndex).toBe(-1);

    fireEvent.keyDown(cellButton(container, 1), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cellButton(container, 1 + BOARD_SIZE));

    fireEvent.keyDown(cellButton(container, 1 + BOARD_SIZE), { key: "ArrowUp" });
    expect(document.activeElement).toBe(cellButton(container, 1));

    fireEvent.keyDown(cellButton(container, 1), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cellButton(container, 0));

    // Edges clamp instead of wrapping to the far side of the board.
    fireEvent.keyDown(cellButton(container, 0), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cellButton(container, 0));

    fireEvent.keyDown(cellButton(container, 0), { key: "End" });
    expect(document.activeElement).toBe(cellButton(container, BOARD_SIZE - 1));

    fireEvent.keyDown(cellButton(container, BOARD_SIZE - 1), { key: "Home" });
    expect(document.activeElement).toBe(cellButton(container, 0));
  });

  it("keeps the board out of reach until the scene publishes a frame", () => {
    const { container } = renderPlayArea({ gameStatus: "dealt", lastStatus: "" });
    expect(container.querySelector(".gomoku-a11y-board")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      t("a11yBoardPending"),
    );
  });

  it("ignores malformed or short board frames instead of rendering a broken grid", () => {
    const short = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: JSON.stringify({ type: "boardUpdate", board: "0101" }),
    });
    expect(short.container.querySelector(".gomoku-a11y-board")).toBeNull();
    short.unmount();

    const wrongType = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: JSON.stringify({ type: "somethingElse", board: "0".repeat(CELL_COUNT) }),
    });
    expect(wrongType.container.querySelector(".gomoku-a11y-board")).toBeNull();
    wrongType.unmount();

    const broken = renderPlayArea({ gameStatus: "dealt", lastStatus: "{not json" });
    expect(broken.container.querySelector(".gomoku-a11y-board")).toBeNull();
    broken.unmount();

    const plain = renderPlayArea({ gameStatus: "dealt", lastStatus: t("guestPaused") });
    expect(plain.container.querySelector(".gomoku-a11y-board")).toBeNull();
  });

  it("exposes undo, pause and restart with the undo budget in the label", () => {
    const { container, dispatch } = renderPlayArea({
      gameStatus: "dealt",
      gameDifficulty: 1,
      undosUsed: 1,
      lastStatus: boardFrame({ 0: 1 }, { moves: 1 }),
    });

    const undo = buttonByLabel(container, t("a11yUndoLabel", { left: 2 }));
    fireEvent.click(undo);
    expect(dispatch).toHaveBeenCalledWith("useUndo", {});

    fireEvent.click(buttonByText(container, t("pauseShort")));
    expect(dispatch).toHaveBeenCalledWith("togglePause", {});

    fireEvent.click(buttonByText(container, t("restartShort")));
    expect(dispatch).toHaveBeenCalledWith("restartGame", { difficulty: 1 });
  });

  it("disables undo once the budget is spent", () => {
    const { container } = renderPlayArea({
      gameStatus: "dealt",
      undosUsed: 3,
      lastStatus: boardFrame({ 0: 1 }, { moves: 1 }),
    });
    expect(buttonByLabel(container, t("a11yUndoLabel", { left: 0 })).disabled).toBe(true);
  });

  it("locks the board while the run is paused and resumes from the DOM", () => {
    const { container, dispatch } = renderPlayArea({
      gameStatus: "dealt",
      isPaused: true,
      lastStatus: boardFrame(),
    });

    expect(cellButton(container, 5).disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(t("pausedTitle"));

    fireEvent.click(buttonByText(container, t("resumeShort")));
    expect(dispatch).toHaveBeenCalledWith("togglePause", {});
  });

  it("locks the board once the frame reports the game is over", () => {
    const { container, dispatch } = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame({ 0: 1 }, { gameOver: true, moves: 1 }),
    });

    fireEvent.click(cellButton(container, 40));
    expect(dispatch).not.toHaveBeenCalled();
    expect(cellButton(container, 40).disabled).toBe(true);
  });

  it("announces whose turn it is from the live frame", () => {
    const { container } = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame({ 0: 1 }, { currentTurn: 2, moves: 1 }),
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(t("aiThinking"));

    const mine = renderPlayArea({
      gameStatus: "dealt",
      lastStatus: boardFrame({ 0: 1, 16: 2 }, { currentTurn: 1, moves: 2 }),
    });
    expect(mine.container.querySelector('[role="status"]')?.textContent).toContain(
      t("yourTurn"),
    );
  });

  it("hides the lobby picker while a board is live and the board when idle", () => {
    const dealt = renderPlayArea({ gameStatus: "dealt", lastStatus: boardFrame() });
    expect(dealt.container.querySelector('[role="radiogroup"]')).toBeNull();
    expect(dealt.container.querySelector(".gomoku-a11y-board")).toBeTruthy();
    dealt.unmount();

    const idle = renderPlayArea();
    expect(idle.container.querySelector('[role="radiogroup"]')).toBeTruthy();
    expect(idle.container.querySelector(".gomoku-a11y-board")).toBeNull();
    expect(idle.container.querySelector("[data-gomoku-cell]")).toBeNull();
  });

  it("keeps the a11y layer visually hidden until it takes focus", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(resolve(sharedRoot, "../gomoku/src/PlayArea.scss"), "utf8");

    expect(styles).toContain(".gomoku-a11y-controls {");
    expect(styles).toContain(".gomoku-a11y-controls:focus-within");
    expect(styles).toContain("clip-path: inset(50%)");
    expect(styles).toContain(".gomoku-a11y-board");
    expect(styles).toContain(".gomoku-a11y-controls button:focus-visible");
  });
});


