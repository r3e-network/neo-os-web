import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => ({
  LazyPhaserGameComponent: (props: unknown) => {
    mocks.phaserGame(props);
    return <div data-testid="sudoku-phaser-host" />;
  },
}));

import PhaserPlayArea from "../../sudoku/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    a11yBoardLabel: "Nine by nine Sudoku board",
    a11yCellConflict: "Conflict",
    a11yCellEmpty: "Row {row}, column {col}, empty",
    a11yCellGiven: "Row {row}, column {col}, fixed clue {digit}",
    a11yCellNotes: "Candidates {notes}",
    a11yCellPlaced: "Row {row}, column {col}, placed digit {digit}",
    a11yControlsLabel: "Accessible Sudoku controls",
    a11yDigitPadLabel: "Sudoku digit pad",
    a11ySelectedCell: "Selected row {row}, column {col}",
    a11yStartGuest: "Start {difficulty} local puzzle",
    appEyebrow: "Sudoku Arena",
    appSubtitle: "Solve locally with candidates and recovery.",
    boardReadyMessage: "Board complete — submit to verify",
    canvasAriaLabel: "Sudoku Arena interactive puzzle",
    canvasLoadingLabel: "Opening sealed Sudoku board",
    checkDealAgain: "Retry sealing",
    closeDrawer: "Close leaderboard and rules",
    conflictMessage: "Conflict highlighted",
    creditLabel: "Withdrawable credit",
    diffName_0: "Easy",
    diffName_1: "Medium",
    diffName_2: "Hard",
    difficulty_0: "Warm-up Grid",
    difficulty_1: "Ranked Grid",
    difficulty_2: "Master Grid",
    difficultyTitle: "Board route",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    eraseNotesShort: "Clear",
    expiredBanner: "That board got away",
    fairnessShort: "Local unique puzzle.",
    gameFiMaintenanceBody: "Verified GAS entry is paused.",
    gameFiMaintenanceShort: "GAS mode paused",
    guestFairnessShort: "Local unique puzzle.",
    guestLobbyTitle: "Start a local puzzle",
    guestModeLabel: "Mode",
    guestModeValue: "Local play",
    guestBestLabel: "Best score",
    guestResultExpired: "Run ended",
    guestRulesShort: "Fill the grid and beat the clock.",
    guestRunLabel: "Local run",
    guestRunValue: "Practice",
    guestSubtitle: "Local puzzle with no stakes.",
    hintLeftTemplate: "Hint {left}",
    lobbyTitle: "Open the sealed board",
    networkBadge: "Neo N3",
    notesOnShort: "Notes on",
    notesShort: "Notes",
    padNoteLabel: "Add note {digit}",
    padPlaceLabel: "Place {digit}",
    pauseShort: "Pause",
    playingTitle: "{difficulty} board in play",
    rankBadge: "Rank #{rank}",
    recoverAction: "Check settlement",
    releaseAction: "Release game",
    restartShort: "New board",
    resumeShort: "Resume",
    rewardMetric: "Reward",
    routeSummary: "Current board difficulty, clock, and tools",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    startAction: "Open board",
    statusInputSyncFailed: "Latest paid move restored safely.",
    statusReady: "Choose a board route to open",
    statusShuffling: "Sealing your puzzle...",
    statusWonTitle: "Puzzle solved!",
    submitAction: "Submit solution",
    submittingTitle: "Submitting solution",
    timeMetric: "Time",
    undosMetric: "Undos",
    undoLeftTemplate: "Undo ({left} left)",
    withdrawAction: "Withdraw {amount} GAS",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    activeGameId: "0",
    appMode: "guest",
    boardRecoveryNonce: 0,
    clues: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    hintCell: -1,
    hintDigit: 0,
    hintNonce: 0,
    hintsUsed: 0,
    inputSyncFailed: false,
    isActing: false,
    isConnectingWallet: false,
    isDealing: false,
    isPaused: false,
    isRecovering: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    lastStatus: "Choose a board route to open",
    myRank: 0,
    myTotalWon: 0,
    poolFree: 9999,
    progressionReady: true,
    progressionRequiredDifficulty: 0,
    rollbackNonce: 0,
    undoNonce: 0,
    undosUsed: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
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

describe("sudoku Phaser playarea", () => {
  it("mounts the compact Phaser board and exposes a semantic guest start", () => {
    const dispatch = vi.fn();
    const { container, getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ gameDifficulty: 2 })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".sudoku-stage-shell")).toBeTruthy();
    expect(container.querySelector(".sudoku-stage-hud")).toBeTruthy();
    expect(container.querySelector(".sudoku-a11y-controls")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalled();

    const props = latestPhaserProps();
    expect(props.className).toBe("sudoku-phaser-canvas");
    expect(props.ariaLabel).toBe("Sudoku Arena interactive puzzle");
    expect(props.loadingLabel).toBe("Opening sealed Sudoku board");
    expect(props.config).toMatchObject({ width: 400, height: 600 });
    expect(props.state.appMode).toBe("guest");
    expect(props.state.gameFiNewEntriesEnabled).toBe(false);

    fireEvent.click(getByRole("button", { name: "Start Hard local puzzle" }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
  });

  it("keeps new paid entry fail-closed while preserving recovery controls", () => {
    const dispatch = vi.fn();
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi", gameStatus: "unknown", activeGameId: "88" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Check settlement" }));
    expect(dispatch).toHaveBeenCalledWith("recoverGame", {});
  });

  it("mirrors the Phaser board into readable cells and forwards note commands", () => {
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "guest",
          clues: "5" + "0".repeat(80),
          deadline: Date.now() + 900_000,
          dealtAt: Date.now(),
          gameStatus: "dealt",
        })}
        dispatch={vi.fn()}
      />,
    );

    const snapshot = {
      entries: [5, ...Array(80).fill(0)],
      given: [true, ...Array(80).fill(false)],
      notes: Array(81).fill(0),
      selectedCell: -1,
      notesMode: false,
      conflicts: [],
      complete: false,
    };
    act(() => {
      latestPhaserProps().dispatch("sudokuBoardState", snapshot);
    });

    const given = document.querySelector(
      'button[aria-label="Row 1, column 1, fixed clue 5"]',
    );
    const empty = document.querySelector(
      'button[aria-label="Row 1, column 2, empty"]',
    );
    expect(given).toBeTruthy();
    expect(empty).toBeTruthy();

    fireEvent.click(empty as HTMLButtonElement);
    expect(latestPhaserProps().state.a11yCommand).toMatchObject({
      type: "select-cell",
      cell: 1,
    });

    fireEvent.click(getByRole("button", { name: "Notes" }));
    expect(latestPhaserProps().state.a11yCommand).toMatchObject({ type: "toggle-notes" });
  });

  it("keeps correction and erase accessible in local practice", () => {
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "guest",
          clues: "5" + "0".repeat(80),
          deadline: Date.now() + 900_000,
          dealtAt: Date.now(),
          gameStatus: "dealt",
        })}
        dispatch={vi.fn()}
      />,
    );

    act(() => {
      latestPhaserProps().dispatch("sudokuBoardState", {
        entries: [5, 4, ...Array(79).fill(0)],
        given: [true, ...Array(80).fill(false)],
        notes: Array(81).fill(0),
        selectedCell: 1,
        notesMode: false,
        conflicts: [],
        complete: false,
      });
    });

    const selectedCell = getByRole("button", { name: "Row 1, column 2, placed digit 4" });
    selectedCell.focus();
    fireEvent.keyDown(selectedCell, { key: "ArrowRight" });
    expect(latestPhaserProps().state.a11yCommand).toMatchObject({
      type: "select-cell",
      cell: 2,
    });
    expect((document.activeElement as HTMLElement | null)?.dataset.sudokuCell).toBe("2");

    const replace = getByRole("button", { name: "Place 7" });
    expect((replace as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(replace);
    expect(latestPhaserProps().state.a11yCommand).toMatchObject({ type: "digit", digit: 7 });

    const erase = getByRole("button", { name: "Clear" });
    expect((erase as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(erase);
    expect(latestPhaserProps().state.a11yCommand).toMatchObject({ type: "clear-notes" });
  });

  it("keeps withdrawal and restart secondary inside a focus-managed drawer", () => {
    const { container, getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi", gameStatus: "solved", credit: 0.75 })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Rules" }));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(getByText("Withdraw 0.75 GAS")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Close leaderboard and rules" }));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("uses compact mobile canvas sizing instead of the old stretched lobby", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(resolve(sharedRoot, "../sudoku/src/PlayArea.scss"), "utf8");
    const scene = readFileSync(resolve(sharedRoot, "../sudoku/src/scenes/SudokuScene.ts"), "utf8");

    expect(styles).toContain("--phaser-mobile-height-ratio: 1.62");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 72px");
    expect(styles).toContain(".sudoku-a11y-controls:focus-within");
    expect(styles).not.toContain("--phaser-mobile-height-ratio: 2.08");
    expect(scene).toContain("toggleNotesMode");
    expect(scene).toContain("bindKeyboardControls");
    expect(scene).toContain("applyRollbackRequest");
    expect(scene).toContain("applyConfirmedUndoRequest");
    expect(scene).toContain("applyBoardRecoveryRequest");
    expect(scene).toContain("GAMEFI_NEW_ENTRIES_ENABLED");
  });
});
