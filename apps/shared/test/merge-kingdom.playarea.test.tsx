import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayArea } from "../../merge-kingdom/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

// ---------------------------------------------------------------------------
// Mock useMessages from @shared/neo
// ---------------------------------------------------------------------------
const t = vi.fn((key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    lobbyTitle: "Build the kingdom",
    difficulty_easy: "Easy",
    difficulty_medium: "Medium",
    difficulty_hard: "Hard",
    difficultyTitle: "Kingdom route",
    lobbyPreviewLabel: "{difficulty} board preview",
    lobbyQuest: "Merge to {tile}; win {reward} GAS.",
    routeGoal: "Reach {tile}",
    entryAmount: "Entry {amount} GAS",
    entryLabel: "Entry",
    timeLimitLabel: "Time",
    tileTarget: "Reach {tile}",
    timeAmount: "{minutes} min",
    poolLine: "Reward pool: {pool} GAS available",
    creditLine: "your credit {credit} GAS",
    startAction: "Start game",
    startHint: "Entry {amount} GAS",
    walletRequiredStatus: "Connect wallet to start",
    statusPoolLow: "Reward pool cannot cover this difficulty right now",
    statusShuffling: "Sealing your board…",
    statusSolved: "Solved! {payout} GAS credited",
    statusWonTitle: "You reached the target tile!",
    statusExpired: "That game expired",
    releaseHint: "The entry stays in the reward pool.",
    movesCount: "{n} moves",
    tileScore: "Best tile",
    submitHint: "Target reached! Submitting…",
    selectedTile: "Tap destination cell",
    selectTile: "Tap a tile to move it",
    submitAction: "Submit",
    timeUpAction: "Time is up",
    releaseAction: "Release",
    withdrawAction: "Withdraw {amount} GAS",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreTile: "Best tile",
    leaderboardIntro: "The global ranking is rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No solves recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My solves",
    historyEmpty: "Your solved games will appear here.",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
});

vi.mock("@shared/neo", async () => {
  const actual = await vi.importActual("@shared/neo");
  return {
    ...actual,
    useMessages: () => ({ t }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GAME_ID = "merge-kingdom-1";

interface AppState {
  credit: number;
  poolFree: number;
  activeGameId: string | null;
  gameStatus: string;
  gameDifficulty: number;
  board: number[][];
  commitment: string;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  lastPayout: number;
  lastElapsedMs: number;
  tileAchieved: number;
  moveCount: number;
  leaderboard: Array<{ player: string; totalWon: number; solved: number }>;
  myRank: number;
  myTotalWon: number;
  mySolves: number;
  myHistory: Array<{
    gameId: string;
    difficulty: number;
    payout: number;
    solveMs: number;
    undos: number;
    tileAchieved: number;
  }>;
  isStarting: boolean;
  isDealing: boolean;
  isSubmitting: boolean;
  walletConnected: boolean;
  lastStatus: string;
}

function makeActions() {
  return {
    startGame: vi.fn().mockResolvedValue(undefined),
    retryDeal: vi.fn().mockResolvedValue(undefined),
    recordMove: vi.fn().mockResolvedValue(undefined),
    submitSolution: vi.fn().mockResolvedValue(undefined),
    expireGame: vi.fn().mockResolvedValue(undefined),
    withdrawWinnings: vi.fn().mockResolvedValue(undefined),
    refreshLeaderboard: vi.fn().mockResolvedValue(undefined),
  };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    credit: 0,
    poolFree: 25,
    activeGameId: null,
    gameStatus: "idle",
    gameDifficulty: 0,
    board: [],
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    undosUsed: 0,
    lastPayout: 0,
    lastElapsedMs: 0,
    tileAchieved: 0,
    moveCount: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    walletConnected: true,
    lastStatus: "",
    ...overrides,
  };
}

function dealtState(overrides: Partial<AppState> = {}): AppState {
  return state({
    activeGameId: GAME_ID,
    gameStatus: "playing",
    gameDifficulty: 0,
    board: [
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 0],
    ],
    commitment: "ab".repeat(32),
    dealtAt: Date.now() - 60_000,
    deadline: Date.now() + 120_000,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("merge-kingdom playarea", () => {
  it("renders the lobby with three kingdom routes instead of a form selector", () => {
    const { container, getAllByText, getByText } = render(
      <PlayArea state={state()} actions={makeActions()} />,
    );
    expect(getAllByText("Build the kingdom")).toHaveLength(1);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".mk-preview-board")).toBeTruthy();
    expect(container.querySelectorAll(".mk-preview-tile")).toHaveLength(16);
    expect(container.querySelector(".mk-lobby__target-art")).toBeTruthy();
    expect(container.querySelectorAll(".mk-preview-tile__art").length).toBeGreaterThan(0);
    expect(
      container.querySelector<HTMLImageElement>(".mk-preview-tile__art")?.getAttribute("src"),
    ).toBe("./art/tile-0002-grass-plot.webp");
    expect(container.querySelectorAll(".mk-route-card")).toHaveLength(3);
    expect(container.querySelectorAll(".mk-route-card__crest img")).toHaveLength(3);
    expect(container.querySelectorAll(".mk-difficulty-tab")).toHaveLength(0);
    expect(container.querySelector(".mk-lobby__cards")).toBeNull();
    expect(getAllByText("Easy").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Medium")).toBeTruthy();
    expect(getByText("Hard")).toBeTruthy();
    // Rewards displayed as gasDisplay + " GAS"
    expect(getAllByText("0.10 GAS").length).toBeGreaterThanOrEqual(1);
    expect(getByText("0.50 GAS")).toBeTruthy();
    expect(getByText("1.00 GAS")).toBeTruthy();
    // Entry amounts
    expect(getByText("Entry")).toBeTruthy();
    expect(getByText("0.02 GAS")).toBeTruthy();
    // Tile targets
    expect(container.querySelector(".mk-lobby__target")?.textContent).toBe("Reach 64");
    expect(container.textContent).toContain("Reach 256");
    expect(container.textContent).toContain("Reach 1024");
    // Time limits
    expect(getByText("3 min")).toBeTruthy();
    expect(getByText("Merge to 64; win 0.10 GAS.")).toBeTruthy();
    expect(getByText("Start game")).toBeTruthy();
  });

  it("keeps the lobby board-first instead of a two-column settings layout", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "merge-kingdom/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toMatch(/\.mk-lobby\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.mk-lobby__preview\s*\{[\s\S]*grid-template-areas:[\s\S]*"board head"[\s\S]*"board quest"/);
    expect(styles).toMatch(/\.mk-lobby__target-art\s*\{[\s\S]*opacity:\s*0\.2/);
    expect(styles).toMatch(/\.mk-preview-board\s*\{[\s\S]*width:\s*min\(100%,\s*342px\)/);
    expect(styles).toMatch(/\.mk-route-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.mk-route-card\s*\{[\s\S]*grid-template-areas:[\s\S]*"crest copy"[\s\S]*"reward reward"/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.mk-route-card\s*\{[\s\S]*grid-template-areas:\s*"crest copy reward"/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.mk-lobby__target-art\s*\{\s*display:\s*none/);
  });

  it("selects a kingdom route and starts from the primary action", async () => {
    const actions = makeActions();
    const { container, getByText } = render(
      <PlayArea state={state()} actions={actions} />,
    );
    fireEvent.click(getByText("Hard"));
    expect(container.querySelector(".mk-lobby__target")?.textContent).toBe("Reach 1024");
    expect(getByText("10 min")).toBeTruthy();
    expect(actions.startGame).not.toHaveBeenCalled();
    fireEvent.click(getByText("Start game"));
    await waitFor(() => {
      expect(actions.startGame).toHaveBeenCalledWith(2);
    });
  });

  it("does not start when the reward pool cannot cover the selected difficulty", () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea state={state({ poolFree: 0 })} actions={actions} />,
    );
    expect(getByText(/Reward pool cannot cover this difficulty right now/)).toBeTruthy();
    const start = getByText("Start game").closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(actions.startGame).not.toHaveBeenCalled();
  });

  it("shows wallet readiness before pool capacity when disconnected", () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea
        state={state({
          walletConnected: false,
          poolFree: 0,
        })}
        actions={actions}
      />,
    );
    expect(getByText("Connect wallet to start")).toBeTruthy();
    const start = getByText("Start game").closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(actions.startGame).not.toHaveBeenCalled();
  });

  it("renders the shuffling state during dealing", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          activeGameId: GAME_ID,
          gameStatus: "playing",
          isDealing: true,
          deadline: Date.now() + 120_000,
          board: [],
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Sealing your board…")).toBeTruthy();
  });

  it("renders the playing state with board tiles and timer", () => {
    const { container } = render(
      <PlayArea state={dealtState()} actions={makeActions()} />,
    );
    // Board tiles should be rendered
    const tiles = container.querySelectorAll(".mk-tile");
    expect(tiles.length).toBe(16); // 4x4 grid
    expect(container.querySelectorAll(".mk-tile__art")).toHaveLength(2);
    expect(
      container.querySelector<HTMLImageElement>(".mk-tile__art")?.getAttribute("src"),
    ).toBe("./art/tile-0002-grass-plot.webp");
    // Timer should be visible
    expect(container.querySelector(".mk-timer")).toBeTruthy();
    // Stats (moves, best tile)
    expect(container.querySelector(".mk-stats")).toBeTruthy();
    // Target banner
    expect(container.querySelector(".mk-target-banner")).toBeTruthy();
  });

  it("shows the won state with payout after a solved game", () => {
    const { getAllByText, getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "solved",
          lastPayout: 7_000_000,
          tileAchieved: 64,
          lastElapsedMs: 90_000,
        })}
        actions={makeActions()}
      />,
    );
    // Rendered in both the stage title and the result card.
    expect(getAllByText("You reached the target tile!").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Solved! 0.07 GAS credited")).toBeTruthy();
  });

  it("shows the expired state with release hint", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "expired",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("That game expired")).toBeTruthy();
    expect(getByText("The entry stays in the reward pool.")).toBeTruthy();
  });

  it("renders the leaderboard drawer with ranked entries", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          leaderboard: [
            { player: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 12_300_000, solved: 20 },
            { player: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 8_100_000, solved: 11 },
          ],
          myRank: 2,
        })}
        actions={makeActions()}
      />,
    );
    // Open drawer via the leaderboard title
    fireEvent.click(getByText("Global leaderboard"));
    expect(getByText("0.12 GAS")).toBeTruthy();
    expect(getByText("0.08 GAS")).toBeTruthy();
    expect(getByText("20 solves")).toBeTruthy();
    expect(getByText("11 solves")).toBeTruthy();
  });

  it("triggers withdraw when credit is available", async () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "solved",
          // credit is a GAS decimal (creditGas from the reward SDK), not fixed8.
          credit: 0.07,
          lastPayout: 7_000_000,
        })}
        actions={actions}
      />,
    );
    const withdraw = getByText("Withdraw 0.07 GAS");
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(actions.withdrawWinnings).toHaveBeenCalled();
    });
  });
});
