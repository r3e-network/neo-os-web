import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayArea } from "../../pet-potion/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

// ---------------------------------------------------------------------------
// Mock useT — the component calls t() internally
// ---------------------------------------------------------------------------
const t = vi.fn((key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    lobbyTitle: "Open the nursery",
    difficulty_easy: "Sprout Hatch",
    difficulty_medium: "Glow Garden",
    difficulty_hard: "Royal Bloom",
    pathSummary: "Selected nursery path entry, reward, and clock",
    pathObjective_easy: "A gentle first hatch.",
    pathObjective_medium: "A brighter garden route.",
    pathObjective_hard: "A premium bloom run.",
    lobbyPreviewLabel: "{difficulty} care plan preview, target happiness {happiness}",
    lobbyCareGoal: "Raise happiness to {happiness}",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    poolLine: "Pool {pool} GAS",
    creditLine: "Credit {credit} GAS",
    lobbyReady: "Nursery ready",
    startAction: "Begin care",
    startHint: "Entry {amount} GAS",
    statusStarting: "Paying entry and starting…",
    statusShuffling: "Sealing your pet…",
    statusPoolLow: "Pool refilling for this path",
    checkDealAgain: "Retry",
    petStage: "{stage} stage",
    stage_baby: "Baby",
    stage_child: "Child",
    stage_adult: "Adult",
    playingTitle: "{difficulty} pet in care",
    happinessTarget: "❤️ {happiness}",
    statHappiness: "Happiness",
    statHunger: "Hunger",
    statEnergy: "Energy",
    actionFeed: "Feed",
    actionPlay: "Play",
    actionPet: "Pet",
    actionRest: "Rest",
    actionsCounter: "{used} / {max} actions used",
    submitAction: "Claim reward",
    statusSubmitting: "Enclave verifying…",
    timeUpAction: "Time is up",
    statusSolved: "{payout} GAS won!",
    scoreTime: "Time",
    scoreHappiness: "Happiness",
    expiredBanner: "Game expired",
    expiredBannerHint: "The pet ran away…",
    scoreReward: "Reward",
    scoreWon: "Total won",
    leaderboardIntro: "Top players",
    leaderboardTitle: "Leaderboard",
    leaderboardEmpty: "No players yet",
    refreshRanks: "Refresh",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My history",
    historyEmpty: "No games played yet.",
    withdrawAction: "Withdraw {amount} GAS",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
});

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual("@shared/react");
  return {
    ...actual,
    useT: () => ({ t }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GAME_ID = "pet-potion-1";
const COMMITMENT = "ab".repeat(32);

function makeActions() {
  return {
    startGame: vi.fn().mockResolvedValue(undefined),
    retryDeal: vi.fn().mockResolvedValue(undefined),
    recordAction: vi.fn().mockResolvedValue(undefined),
    submitSolution: vi.fn().mockResolvedValue(undefined),
    expireGame: vi.fn().mockResolvedValue(undefined),
    withdrawWinnings: vi.fn().mockResolvedValue(undefined),
    refreshLeaderboard: vi.fn().mockResolvedValue(undefined),
  };
}

interface AppState {
  credit: number;
  poolFree: number;
  activeGameId: string | null;
  gameStatus: string;
  gameDifficulty: number;
  commitment: string;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  actionsUsed: number;
  lastPayout: number;
  lastElapsedMs: number;
  happinessAchieved: number;
  petHappiness: number;
  petHunger: number;
  petEnergy: number;
  petStage: number;
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
    happinessAchieved: number;
  }>;
  isStarting: boolean;
  isDealing: boolean;
  isSubmitting: boolean;
  lastStatus: string;
  actionHistory: string[];
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    credit: 0,
    poolFree: 25,
    activeGameId: null,
    gameStatus: "idle",
    gameDifficulty: 0,
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    undosUsed: 0,
    actionsUsed: 0,
    lastPayout: 0,
    lastElapsedMs: 0,
    happinessAchieved: 0,
    petHappiness: 50,
    petHunger: 50,
    petEnergy: 50,
    petStage: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    lastStatus: "",
    actionHistory: [],
    ...overrides,
  };
}

function dealtState(overrides: Partial<AppState> = {}): AppState {
  return state({
    activeGameId: GAME_ID,
    gameStatus: "playing",
    gameDifficulty: 0,
    commitment: COMMITMENT,
    dealtAt: Date.now() - 60_000,
    deadline: Date.now() + 100_000,
    petHappiness: 30,
    petHunger: 60,
    petEnergy: 40,
    petStage: 0,
    actionsUsed: 0,
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

describe("pet-potion playarea", () => {
  it("renders a pet-care lobby with plan choices", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea state={state()} actions={makeActions()} />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".pp-lobby__nursery")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__nursery-art")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__playpen")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__pet-art")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__dock")).toBeTruthy();
    expect(container.querySelectorAll(".pp-plan__bottle")).toHaveLength(3);
    expect(container.querySelector(".pp-lobby__care-ribbon")).toBeTruthy();
    expect(container.querySelectorAll(".pp-plan__sparkles")).toHaveLength(0);
    expect(container.querySelector(".pp-lobby__statusbar")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__pool")).toBeFalsy();
    expect(getByText("Nursery ready")).toBeTruthy();
    expect(getByText("Pool 25.00 GAS")).toBeTruthy();
    expect(container.textContent).not.toContain("Reward pool:");
    expect(container.textContent).not.toContain("cannot cover");
    expect(getByText("Raise happiness to 50")).toBeTruthy();
    expect(getAllByText("Sprout Hatch").length).toBeGreaterThan(0);
    expect(getByText("Glow Garden")).toBeTruthy();
    expect(getByText("Royal Bloom")).toBeTruthy();
    expect(getAllByText("Win 0.10 GAS").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Win 0.50 GAS")).toBeTruthy();
    expect(getByText("Win 1.00 GAS")).toBeTruthy();
    expect(container.querySelector(".pp-lobby__pool-hud")?.textContent).toContain("Entry 0.02 GAS");
  });

  it("keeps the lobby game-first instead of a survey-like launcher", () => {
    const styles = readFileSync("../pet-potion/src/PlayArea.scss", "utf8");
    expect(styles).toMatch(/\.pp-lobby__nursery\s*\{[\s\S]*min-height:\s*360px/);
    expect(styles).toMatch(/\.pp-lobby__playpen\s*\{[\s\S]*aspect-ratio:\s*1/);
    expect(styles).toMatch(
      /\.pp-lobby__dock\s*\{[\s\S]*grid-template-columns:\s*minmax\(126px,\s*0\.28fr\)\s*1fr/,
    );
    expect(styles).toMatch(
      /\.pp-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.pp-plan__name\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).not.toMatch(/pp-plan__sparkles/);
  });

  it("selects a difficulty and starts the game", async () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea state={state()} actions={actions} />,
    );
    fireEvent.click(getByText("Royal Bloom"));
    fireEvent.click(getByText("Begin care"));
    await waitFor(() => {
      expect(actions.startGame).toHaveBeenCalledWith(2);
    });
  });

  it("does not start when the reward pool cannot cover the selected nursery path", () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea state={state({ poolFree: 0 })} actions={actions} />,
    );
    expect(getByText(/Pool refilling for this path/)).toBeTruthy();
    expect(getByText("Pool 0.00 GAS")).toBeTruthy();
    const start = getByText("Begin care").closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(actions.startGame).not.toHaveBeenCalled();
  });

  it("renders the shuffling state during awaiting-bind", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "awaiting-bind",
          isDealing: true,
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Sealing your pet…")).toBeTruthy();
  });

  it("renders the playing state with pet, stat bars, and action buttons", () => {
    const { container, getByText } = render(
      <PlayArea state={dealtState()} actions={makeActions()} />,
    );
    // Pet sprite and stage label.
    expect(container.querySelector(".pp-pet__creature")).toBeTruthy();
    expect(container.querySelectorAll(".pp-action-btn__asset")).toHaveLength(4);
    expect(container.querySelector(".pp-table__lab-art")).toBeTruthy();
    expect(getByText("Baby stage")).toBeTruthy();
    // Stat bars
    expect(getByText("Happiness")).toBeTruthy();
    expect(getByText("Hunger")).toBeTruthy();
    expect(getByText("Energy")).toBeTruthy();
    // Action buttons
    expect(getByText("Feed")).toBeTruthy();
    expect(getByText("Play")).toBeTruthy();
    expect(getByText("Pet")).toBeTruthy();
    expect(getByText("Rest")).toBeTruthy();
    // Timer
    expect(container.querySelector(".pp-timer")).toBeTruthy();
    // Action counter
    expect(getByText("0 / 40 actions used")).toBeTruthy();
  });

  it("displays the solved state with payout and stats", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "solved",
          lastPayout: 7_000_000,
          lastElapsedMs: 45_000,
          happinessAchieved: 55,
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("0.07 GAS won!")).toBeTruthy();
    expect(getByText("Time: 0:45")).toBeTruthy();
    expect(getByText("Happiness: 55")).toBeTruthy();
  });

  it("shows the expired state with a message", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "expired",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Game expired")).toBeTruthy();
    expect(getByText("The pet ran away…")).toBeTruthy();
  });

  it("renders the leaderboard drawer with entries", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          leaderboard: [
            {
              player: "0xabcdef1234567890abcdef1234567890abcdef12",
              totalWon: 0.123,
              solved: 20,
            },
            {
              player: "0x1234567890abcdef1234567890abcdef12345678",
              totalWon: 0.081,
              solved: 11,
            },
          ],
          myRank: 2,
        })}
        actions={makeActions()}
      />,
    );
    // Open drawer via the PlayStage drawer trigger
    fireEvent.click(getByText("Leaderboard"));
    expect(getByText("0.12")).toBeTruthy();
    expect(getByText("0.08")).toBeTruthy();
    expect(getByText("you")).toBeTruthy();
  });

  it("triggers withdraw when credit is available", async () => {
    const actions = makeActions();
    const { getByText } = render(
      <PlayArea
        state={state({
          credit: 0.1,
          gameStatus: "solved",
        })}
        actions={actions}
      />,
    );
    const withdraw = getByText("Withdraw 0.10 GAS");
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(actions.withdrawWinnings).toHaveBeenCalled();
    });
  });

  it("shows the starting state during isStarting", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          isStarting: true,
          gameStatus: "idle",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Paying entry and starting…")).toBeTruthy();
  });

  it("shows expired state when gameStatus is refunded", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "refunded",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Game expired")).toBeTruthy();
    expect(getByText("The pet ran away…")).toBeTruthy();
  });
});
