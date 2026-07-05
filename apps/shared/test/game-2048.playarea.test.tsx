import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../game-2048/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GAME_ID = "77";
const COMMITMENT = "ab".repeat(32);
const INIT_BOARD = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const WINNING_BOARD = [9, 5, 2, 1, 4, 3, 1, 0, 2, 1, 0, 0, 1, 0, 0, 0];

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "2048 Rush",
    appSubtitle: "Merge tiles, chase the target, and submit a verified run before time runs out.",
    lobbyTitle: "Build the target tile",
    playingTitle: "Racing to {tile}",
    statusWonTitle: "Target reached!",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    difficultyTitle: "Target lane",
    targetKicker: "Target tile",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    timeAmount: "{minutes} min",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    lobbyReady: "Ready to race",
    startAction: "Start run",
    startHint: "Entry {amount} GAS",
    submitAction: "Submit run",
    submitHint: "Target reached",
    chaseHint: "Reach the {tile} tile to unlock submission",
    timeUpAction: "Time is up",
    undoAction: "Undo ({left} left, -30%)",
    undoConfirm: "Confirm undo — reward drops to {pct}%",
    undoHint: "Recorded by the enclave session.",
    releaseAction: "Release game",
    releaseHint: "Frees the reservation.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls winnings back.",
    boardLabel: "2048 board",
    padLabel: "Move controls",
    moveUp: "Slide up",
    moveDown: "Slide down",
    moveLeft: "Slide left",
    moveRight: "Slide right",
    rewardNow: "{amount} GAS ({pct}%)",
    bestTile: "Best tile {tile}",
    targetTile: "target {tile}",
    moveCount: "{used}/{cap} moves",
    minSolveHint: "Submission unlocks in {clock}",
    deadBoardHint: "No moves left — this run is over.",
    deadlineBufferHint: "Too close to the deadline.",
    timeUpHint: "The deadline passed.",
    shufflingCopy: "Sealed inside the Morpheus enclave.",
    checkDealAgain: "Retry sealing",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your balance.",
    expiredBanner: "That run got away",
    expiredBannerHint: "Fresh board, fresh chances.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    drawerTitle: "Leaderboard & rules",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No verified runs yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} runs",
    youTag: "you",
    historyTitle: "My runs",
    historyEmpty: "Your verified runs will appear here.",
    historyUndos: "{undos} undos",
    rulesTitle: "How it works",
    rulesCopy: "Reach the target within the limit.",
    fairnessTitle: "Provably fair spawns",
    fairnessCopy: "Sealed in the enclave.",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    statusReady: "Pick a lane, then merge to the glowing tile",
    statusPoolLow: "Pool refilling for this target",
    statusShuffling: "Sealing your run…",
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
    commitment: "",
    runBoard: [],
    runMoveCount: 0,
    runMaxExp: 0,
    isMoving: false,
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
    lastStatus: "Pick a lane, then merge to the glowing tile",
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
    commitment: COMMITMENT,
    runBoard: [...INIT_BOARD],
    runMoveCount: 0,
    runMaxExp: 1,
    dealtAt: Date.now() - 120_000, // past the 60s sprint anti-bot floor + buffer
    deadline: Date.now() + 100_000,
    ...overrides,
  });
}

function tiles(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".rush-tile")];
}

describe("2048 playarea (TEE mode)", () => {
  it("renders a board-first lobby with compact target choices and a start action", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(container.querySelector(".rush-scene__banner")).toBeNull();
    expect(container.querySelector(".rush-lobby__board-card")).toBeTruthy();
    expect(container.querySelector(".rush-lobby__board")).toBeTruthy();
    expect(container.querySelectorAll(".rush-lobby__tile")).toHaveLength(16);
    expect(container.querySelectorAll(".rush-lobby__tile img").length).toBeGreaterThan(10);
    expect(container.querySelector(".rush-lobby__targets-shell")).toBeTruthy();
    expect(container.querySelector(".rush-lobby__targets")).toBeTruthy();
    expect(container.querySelectorAll(".rush-target__tile img")).toHaveLength(3);
    expect(container.querySelector(".rush-lobby__cards")).toBeFalsy();
    expect(container.querySelector(".rush-lobby__pool")).toBeFalsy();
    expect(getByText("Target tile")).toBeTruthy();
    expect(getAllByText("512").length).toBeGreaterThan(0);
    expect(getAllByText("1024").length).toBeGreaterThan(0);
    expect(getAllByText("2048").length).toBeGreaterThan(0);
    expect(getByText("Win 0.1 GAS")).toBeTruthy();
    expect(getByText("Win 0.5 GAS")).toBeTruthy();
    expect(getByText("Win 1 GAS")).toBeTruthy();
    expect(getByText("Ready to race")).toBeTruthy();
    expect(getByText("Pool 25.00 GAS")).toBeTruthy();
    expect(getAllByText("Start run").length).toBeGreaterThan(0);
  });

  it("keeps low-pool messaging compact instead of making the lobby feel like an admin form", () => {
    const { container, getAllByText, getByText, queryByText } = render(
      <PlayArea t={t} state={state({ poolFree: 0 })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".rush-lobby__statusbar")).toBeTruthy();
    expect(getAllByText("Pool refilling for this target").length).toBeGreaterThan(0);
    expect(getByText("Pool 0.00 GAS")).toBeTruthy();
    expect(queryByText(/Reward pool:/)).toBeFalsy();
    expect(queryByText(/cannot cover/)).toBeFalsy();
  });

  it("starts a run at the picked target", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    fireEvent.click(getByRole("radio", { name: /target 2048/i }));
    fireEvent.click(getAllByText("Start run")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("renders the enclave-dealt board from the store observables", () => {
    const { container } = render(<PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />);
    const cells = tiles(container);
    expect(cells).toHaveLength(16);
    const values = cells.map((cell) => cell.textContent).filter(Boolean);
    expect(values).toEqual(["2", "2"]);
    expect(container.querySelectorAll(".rush-tile__art")).toHaveLength(2);
    expect(container.querySelector<HTMLImageElement>(".rush-tile__art")?.src).toContain(
      "/art/tile-e1.webp",
    );
  });

  it("dispatches playMove for keyboard input", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={dealtState()} dispatch={dispatch} />);
    const board = container.querySelector<HTMLElement>(".rush-board") as HTMLElement;
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("playMove", { dir: 3 });
    });
  });

  it("locks input while a move is in flight at the enclave", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={dealtState({ isMoving: true })} dispatch={dispatch} />,
    );
    const board = container.querySelector<HTMLElement>(".rush-board") as HTMLElement;
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    expect(dispatch).not.toHaveBeenCalledWith("playMove", { dir: 3 });
  });

  it("arms the paid undo and dispatches it on confirm", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea t={t} state={dealtState({ runMoveCount: 4 })} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Undo (3 left, -30%)"));
    fireEvent.click(getByText("Confirm undo — reward drops to 70%"));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("useUndo", {});
    });
  });

  it("submits once the target tile is on the board", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ runBoard: [...WINNING_BOARD], runMaxExp: 9, runMoveCount: 254 })}
        dispatch={dispatch}
      />,
    );
    const submit = getAllByText("Submit run")[0].closest("button");
    expect(submit?.disabled).toBe(false);
    fireEvent.click(submit as HTMLButtonElement);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("submitRun", {});
    });
  });

  it("keeps submission locked before the target tile exists", () => {
    const { getAllByText } = render(
      <PlayArea t={t} state={dealtState({ runMoveCount: 10 })} dispatch={vi.fn()} />,
    );
    const submit = getAllByText("Submit run")[0].closest("button");
    expect(submit?.disabled).toBe(true);
  });

  it("shows the global leaderboard with the player's row highlighted", () => {
    const { getByText, getAllByText, container } = render(
      <PlayArea
        t={t}
        state={state({
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 9.4, solves: 12, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 3.2, solves: 5, isUser: true },
          ],
          myRank: 2,
        })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    expect(getByText("9.40 GAS")).toBeTruthy();
    expect(getByText("3.20 GAS")).toBeTruthy();
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
    // "Submit run" should not appear when time is up
    expect(() => getByText("Submit run")).toThrow();
  });

  it("shows dead board hint when no moves remain", () => {
    // A dead board pattern where no adjacent tiles can merge (alternating 2,4)
    const deadBoard = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ runBoard: deadBoard, runMaxExp: 2 })}
        dispatch={vi.fn()}
      />,
    );
    // The dead board hint should be visible
    expect(getByText("No moves left — this run is over.")).toBeTruthy();
  });

  it("shows expired banner after game expiry", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          gameStatus: "expired",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("That run got away")).toBeTruthy();
    expect(getByText("Fresh board, fresh chances.")).toBeTruthy();
  });

  it("shows solved banner after a win", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          gameStatus: "solved",
          lastPayout: "0.5",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("You won 0.5!")).toBeTruthy();
    expect(getByText("Credited to your balance.")).toBeTruthy();
  });

  it("triggers withdraw on button click", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          credit: 10000000, // 0.1 GAS
          gameStatus: "won",
        })}
        dispatch={dispatch}
      />,
    );
    const withdraw = getByText("Withdraw 10000000.00 GAS");
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
    });
  });

  it("shows min-solve hint before the floor passes", () => {
    // Use a winning board (target reached) but dealtAt is very recent,
    // so minSolveReached is false and the hint should show
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
          dealtAt: Date.now() - 1000,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText(/Submission unlocks in/)).toBeTruthy();
  });
});
