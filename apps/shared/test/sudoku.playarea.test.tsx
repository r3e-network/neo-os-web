import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../sudoku/src/PlayArea";
import {
  dealPuzzle,
  hexToBytes,
} from "../../sudoku/src/logic/sudoku-engine";
import { createBoard } from "../../sudoku/src/logic/board-store";
import type { BoardState } from "../../sudoku/src/logic/board-store";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GOLDEN_SEED = "c5bc633d764c1b0e9e5d4ec75598810d199316b596ac5d092126f49bb3b65112";
const GAME_ID = "42";
const puzzle = dealPuzzle(hexToBytes(GOLDEN_SEED), 0);

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Sudoku Arena",
    appSubtitle: "Solve before the clock runs out.",
    lobbyTitle: "Open the sealed board",
    playingTitle: "{difficulty} board in play",
    statusWonTitle: "Puzzle solved!",
    networkBadge: "Neo N3",
    difficultyTitle: "Board route",
    difficulty_easy: "Warm-up Grid",
    difficulty_medium: "Ranked Grid",
    difficulty_hard: "Master Grid",
    routeEyebrow: "sealed puzzle route",
    routeSummary: "Selected board reward, entry, and clock",
    routeObjective_easy: "A fast board with generous clues.",
    routeObjective_medium: "A tighter ranked board.",
    routeObjective_hard: "A pressure board for expert solvers.",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    timeAmount: "{minutes} min",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    startAction: "Open board",
    startHint: "Entry {amount} GAS",
    submitAction: "Submit solution",
    submitHint: "Board complete",
    fillHint: "{left} cells to fill",
    timeUpAction: "Time is up",
    undoAction: "Undo ({left} left, -30%)",
    undoConfirm: "Confirm undo — reward drops to {pct}%",
    undoHint: "Reverts your latest digit on-chain.",
    releaseAction: "Release game",
    releaseHint: "Frees the reservation.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls winnings back.",
    boardLabel: "Sudoku board",
    cellLabel: "Row {row}, column {col}",
    notesToggle: "Notes",
    rewardNow: "{amount} GAS ({pct}%)",
    minSolveHint: "Submission unlocks in {clock}",
    timeUpHint: "The deadline passed.",
    shufflingCopy: "Sealing a fresh puzzle in Morpheus. The board opens when the commitment is ready.",
    checkDealAgain: "Check deal again",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your balance.",
    expiredBanner: "That board got away",
    expiredBannerHint: "Fresh puzzle, fresh chances.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    drawerTitle: "Leaderboard & rules",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No solves recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My solves",
    historyEmpty: "Your solved boards will appear here.",
    historyUndos: "{undos} undos",
    rulesTitle: "How it works",
    rulesCopy: "Solve within the limit.",
    fairnessTitle: "Provably fair deals",
    fairnessCopy: "Seeded by the beacon block.",
    seedLine: "Game #{gameId} · seed {seed}",
    statusReady: "Choose a board route to open",
    statusShuffling: "Dealing your puzzle…",
    statusPoolLow: "Pool needs refill",
    rankBadge: "Rank #{rank}",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    credit: 0,
    poolFree: 25,
    activeGameId: "0",
    gameStatus: "idle",
    gameDifficulty: 0,
    clues: "",
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    undosUsed: 0,
    lastPayout: "",
    lastElapsedMs: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    isUndoing: false,
    lastStatus: "Choose a board route to open",
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([k, v]) => [k, createObservable(v)]),
  );
}

function dealtState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return state({
    activeGameId: GAME_ID,
    gameStatus: "dealt",
    gameDifficulty: 0,
    clues: puzzle.puzzle,
    commitment: "ab".repeat(32),
    dealtAt: Date.now() - 200_000, // past the 90s easy anti-bot floor
    deadline: Date.now() + 600_000,
    ...overrides,
  });
}

function cellButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>(".sudoku-cell")];
}

function padKey(container: HTMLElement, digit: number): HTMLButtonElement {
  const key = [...container.querySelectorAll<HTMLButtonElement>(".sudoku-pad__key")].find(
    (btn) => btn.textContent === String(digit),
  );
  if (!key) throw new Error(`numpad key ${digit} not found`);
  return key;
}

describe("sudoku playarea", () => {
  it("renders the lobby as a board route selector instead of a form", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(getAllByText("Warm-up Grid").length).toBeGreaterThan(0);
    expect(getByText("Ranked Grid")).toBeTruthy();
    expect(getByText("Master Grid")).toBeTruthy();
    expect(getAllByText("Win 0.1 GAS").length).toBeGreaterThan(0);
    expect(getByText("Win 0.5 GAS")).toBeTruthy();
    expect(getByText("Win 1 GAS")).toBeTruthy();
    expect(container.querySelector(".sudoku-lobby__mini-grid")).toBeTruthy();
    expect(container.querySelectorAll(".sudoku-lobby__mini-grid > span")).toHaveLength(81);
    expect(container.querySelector(".sudoku-scene__banner")).toBeNull();
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(container.querySelectorAll(".sudoku-route-card__seal")).toHaveLength(3);
    expect(container.querySelectorAll(".sudoku-route-card__reward img")).toHaveLength(3);
    expect(getAllByText("Open board").length).toBeGreaterThan(0);
  });

  it("starts a game at the picked difficulty", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Master Grid"));
    fireEvent.click(getAllByText("Open board")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("renders the dealt board with 81 cells and the puzzle's givens", () => {
    const { container } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    const cells = cellButtons(container);
    expect(cells).toHaveLength(81);
    const givens = container.querySelectorAll(".sudoku-cell--given");
    expect(givens).toHaveLength(puzzle.clues);
    expect(container.querySelectorAll(".sudoku-cell__tile")).toHaveLength(puzzle.clues);
  });

  it("places a digit into a selected empty cell and supports pencil notes", () => {
    const { container, getByText } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    const cells = cellButtons(container);
    const emptyIdx = puzzle.puzzle.indexOf("0");
    fireEvent.click(cells[emptyIdx]);
    fireEvent.click(padKey(container, 5));
    expect(cells[emptyIdx].querySelector(".sudoku-cell__digit")?.textContent).toBe("5");
    expect(cells[emptyIdx].querySelector(".sudoku-cell__tile")).toBeTruthy();
    // placements are final: a second digit does not overwrite
    fireEvent.click(cells[emptyIdx]);
    fireEvent.click(padKey(container, 7));
    expect(cells[emptyIdx].querySelector(".sudoku-cell__digit")?.textContent).toBe("5");
    // notes are free on another empty cell
    const secondEmpty = puzzle.puzzle.indexOf("0", emptyIdx + 1);
    fireEvent.click(getByText("Notes"));
    fireEvent.click(cells[secondEmpty]);
    fireEvent.click(padKey(container, 3));
    expect(cells[secondEmpty].querySelector(".sudoku-cell__notes")?.textContent).toContain("3");
  });

  it("arms the paid undo, dispatches it on confirm, and reverts the digit", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PlayArea t={t} state={dealtState()} dispatch={dispatch} />,
    );
    const cells = cellButtons(container);
    const emptyIdx = puzzle.puzzle.indexOf("0");
    fireEvent.click(cells[emptyIdx]);
    fireEvent.click(padKey(container, 5));
    const undoButton = getByText("Undo (3 left, -30%)");
    fireEvent.click(undoButton); // arm
    const confirm = getByText("Confirm undo — reward drops to 70%");
    fireEvent.click(confirm); // execute
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("useUndo", {});
    });
    await waitFor(() => {
      expect(cells[emptyIdx].querySelector(".sudoku-cell__digit")).toBeNull();
    });
  });

  it("blocks the undo after all three are spent", () => {
    window.localStorage.setItem(
      `miniapp-sudoku:board:${GAME_ID}`,
      JSON.stringify(withPlacements(1)),
    );
    const { getByText } = render(
      <PlayArea t={t} state={dealtState({ undosUsed: 3 })} dispatch={vi.fn()} />,
    );
    const undoButton = getByText("Undo (0 left, -30%)").closest("button");
    expect(undoButton?.disabled).toBe(true);
  });

  it("submits the completed board as an 81-digit solution string", async () => {
    window.localStorage.setItem(
      `miniapp-sudoku:board:${GAME_ID}`,
      JSON.stringify(withPlacements(81)),
    );
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByText } = render(
      <PlayArea t={t} state={dealtState()} dispatch={dispatch} />,
    );
    const submit = getAllByText("Submit solution")[0].closest("button");
    expect(submit?.disabled).toBe(false);
    fireEvent.click(submit as HTMLButtonElement);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("submitSolution", { solution: puzzle.solution });
    });
  });

  it("shows the global leaderboard with the player's row highlighted", () => {
    const { getByText, getAllByText, container } = render(
      <PlayArea
        t={t}
        state={state({
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 12.3, solves: 20, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 8.1, solves: 11, isUser: true },
          ],
          myRank: 2,
        })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    expect(getByText("12.30 GAS")).toBeTruthy();
    expect(getByText("8.10 GAS")).toBeTruthy();
    expect(container.querySelector('[data-me="true"]')).toBeTruthy();
  });

  it("shows time-up state when deadline is past", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ deadline: Date.now() - 1000 })}
        dispatch={vi.fn()}
      />,
    );
    // The primary action button label changes to "Time is up"
    expect(getByText("Time is up")).toBeTruthy();
    // The submit action should not appear — "Submit solution" should be absent
    expect(() => getByText("Submit solution")).toThrow();
  });

  it("shows expired banner after game expiry", () => {
    const { getAllByText, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          gameStatus: "expired",
          lastStatus: "That board got away",
        })}
        dispatch={vi.fn()}
      />,
    );
    // The banner and the status line both surface the expired copy.
    expect(getAllByText("That board got away").length).toBeGreaterThan(0);
    // The expiredBannerHint should also be visible
    expect(getByText("Fresh puzzle, fresh chances.")).toBeTruthy();
  });

  it("shows solved banner after a win", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          gameStatus: "solved",
          lastPayout: "0.1",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("You won 0.1!")).toBeTruthy();
    expect(getByText("Credited to your balance.")).toBeTruthy();
  });

  it("triggers withdraw on button click", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          credit: 5000000, // 0.05 GAS
          gameStatus: "solved",
        })}
        dispatch={dispatch}
      />,
    );
    // Withdraw button should be rendered with the credit amount
    const withdraw = getByText("Withdraw 5000000.00 GAS");
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
    });
  });

  it("shows loading state while the enclave session opens", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          // After startGame the game is active on-chain; the client shows the
          // sealing/dealing stage (committed) while the enclave session opens.
          gameStatus: "committed",
          isDealing: true,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Sealing a fresh puzzle in Morpheus. The board opens when the commitment is ready.")).toBeTruthy();
  });

  it("shows min-solve hint before the floor passes", () => {
    // Set dealtAt very recently so elapsedMs < minSolveMs + buffer
    // and use a fully-completed board so the hint condition triggers
    window.localStorage.setItem(
      `miniapp-sudoku:board:${GAME_ID}`,
      JSON.stringify(withPlacements(81)),
    );
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ dealtAt: Date.now() - 1000 })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText(/Submission unlocks in/)).toBeTruthy();
  });
});

/** Board with the first `count` empty cells already (correctly) placed. */
function withPlacements(count: number): BoardState {
  const board = createBoard(puzzle.puzzle);
  let placed = 0;
  for (let i = 0; i < 81 && placed < count; i += 1) {
    if (puzzle.puzzle[i] !== "0") continue;
    board.entries[i] = puzzle.solution.charCodeAt(i) - 48;
    board.placedOrder.push(i);
    placed += 1;
  }
  return board;
}
