import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayArea } from "../../color-clash/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

// ---------------------------------------------------------------------------
// Mock useT — the component calls t() internally
// ---------------------------------------------------------------------------
const t = vi.fn((key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    lobbyTitle: "Enter the arcade",
    difficulty_easy: "Pulse Arcade",
    difficulty_medium: "Neon Rush",
    difficulty_hard: "Master Circuit",
    targetSeqLabel: "{count} cues",
    sequenceCueCount: "{count} cues",
    modeSummary: "Selected arcade mode entry and clock",
    modeObjective_easy: "Warm up on a short glowing pattern.",
    modeObjective_medium: "A faster neon lane.",
    modeObjective_hard: "A championship memory run.",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    poolLine: "Reward pool: {pool} GAS available",
    startAction: "Play sequence",
    practiceAction: "Free practice",
    rewardMode: "Reward run",
    practiceMode: "Practice mode",
    practiceBadge: "Practice",
    practiceModeLine: "Practice uses a local sequence and does not submit a transaction.",
    practiceHint: "Practice mode · pool refilling",
    practiceWon: "Clean run — sequence mastered",
    practiceLost: "Missed color — try the rhythm again",
    practiceExpired: "Practice timer ended",
    practiceResultHint: "No GAS moved in practice mode.",
    startHint: "Entry {amount} GAS",
    statusStarting: "Paying entry and starting…",
    statusShuffling: "Sealing your sequence…",
    statusPoolLow: "Reward pool cannot cover this arcade mode right now",
    checkDealAgain: "Retry",
    watchPhase: "Watch the sequence...",
    repeatPhase: "Repeat the sequence!",
    allCorrect: "All correct! +{n}",
    wrongPress: "Wrong! Game over",
    color_red: "Red",
    color_blue: "Blue",
    color_green: "Green",
    color_yellow: "Yellow",
    releaseAction: "Release game",
    submitAction: "Claim reward",
    statusSubmitting: "Enclave verifying — settling on-chain…",
    timeUpAction: "Time is up",
    solvedBanner: "Correct! {payout} GAS credited",
    solvedBannerHint: "Credited to your balance.",
    expiredBanner: "Game released",
    expiredBannerHint: "The sequence expired.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreSeqLen: "Sequence length",
    scoreWon: "Total won",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No solves recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My solves",
    historyEmpty: "Your completed sequences will appear here.",
    withdrawAction: "Withdraw {amount} GAS",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
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
const GAME_ID = "color-clash-1";
const COMMITMENT = "ab".repeat(32);

function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "color-clash/src/PlayArea.scss"), "utf8");
}

function mobileStyleBlock(styles: string, selector: string): string {
  const mediaStart = styles.indexOf("@media (max-width: 560px)");
  expect(mediaStart).toBeGreaterThanOrEqual(0);

  const selectorStart = styles.indexOf(selector, mediaStart);
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = styles.indexOf("{", selectorStart);
  expect(blockStart).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = blockStart; index < styles.length; index += 1) {
    const character = styles[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return styles.slice(blockStart + 1, index);
      }
    }
  }

  throw new Error(`Could not find style block for ${selector}`);
}

function makeActions() {
  return {
    startGame: vi.fn().mockResolvedValue(undefined),
    retryDeal: vi.fn().mockResolvedValue(undefined),
    recordPress: vi.fn().mockResolvedValue(undefined),
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
  sequence: string;
  playerSequence: string;
  commitment: string;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  lastPayout: number;
  lastElapsedMs: number;
  seqAchieved: number;
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
    seqAchieved: number;
  }>;
  isStarting: boolean;
  isDealing: boolean;
  isSubmitting: boolean;
  lastStatus: string;
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    credit: 0,
    poolFree: 25,
    activeGameId: null,
    gameStatus: "idle",
    gameDifficulty: 0,
    sequence: "",
    playerSequence: "",
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    undosUsed: 0,
    lastPayout: 0,
    lastElapsedMs: 0,
    seqAchieved: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    lastStatus: "",
    ...overrides,
  };
}

function dealtState(overrides: Partial<AppState> = {}): AppState {
  return state({
    activeGameId: GAME_ID,
    gameStatus: "playing",
    gameDifficulty: 0,
    sequence: "0123",
    playerSequence: "",
    commitment: COMMITMENT,
    dealtAt: Date.now() - 120_000,
    deadline: Date.now() + 100_000,
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

describe("color-clash playarea", () => {
  it("renders a color-pad lobby with arcade modes and a start action", () => {
    const { container, getAllByText, getByText } = render(
      <PlayArea state={state()} actions={makeActions()} />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".cclash-lobby__console")).toBeTruthy();
    expect(container.querySelector(".cclash-lobby__console-art")).toBeTruthy();
    expect(container.querySelectorAll(".cclash-lobby__pad")).toHaveLength(4);
    expect(container.querySelectorAll(".cclash-lobby__sequence span")).toHaveLength(8);
    expect(container.querySelector(".cclash-lobby__mission-ribbon")).toBeTruthy();
    expect(container.querySelector(".cclash-lobby__modes")).toBeTruthy();
    expect(container.querySelectorAll(".cclash-mode__badge")).toHaveLength(3);
    expect(container.querySelectorAll(".cclash-mode__lights")).toHaveLength(3);
    expect(container.querySelector(".cclash-lobby__cards")).toBeFalsy();
    expect(getAllByText("Pulse Arcade").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Neon Rush")).toBeTruthy();
    expect(getByText("Master Circuit")).toBeTruthy();
    expect(getAllByText("8 cues").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Win 0.10 GAS").length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain("Win 0.50 GAS");
    expect(container.textContent).toContain("Win 1.00 GAS");
    expect(getByText("Play sequence")).toBeTruthy();
  });

  it("keeps challenge selection compact instead of a stacked form list", () => {
    const styles = playAreaStyles();

    expect(styles).toMatch(/\.cclash-lobby__modes\s*\{[\s\S]*margin-top:\s*-38px/);
    expect(styles).toMatch(/\.cclash-mode\s*\{[\s\S]*grid-template-areas:[\s\S]*"badge name"[\s\S]*"badge seq"[\s\S]*"meta meta"[\s\S]*"lights lights"/);
    expect(styles).toMatch(/\.cclash-mode__lights\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.cclash-lobby__console\s*\{[\s\S]*min-height:\s*318px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.cclash-lobby__modes\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.cclash-mode__meta\s*\{[\s\S]*display:\s*none/);
    expect(mobileStyleBlock(styles, ".cclash-lobby__modes")).not.toMatch(/grid-template-columns:\s*1fr/);
  });

  it("starts a game at the picked difficulty", async () => {
    const actions = makeActions();
    const { getByRole, getByText } = render(
      <PlayArea state={state()} actions={actions} />,
    );
    fireEvent.click(getByRole("radio", { name: /Master Circuit.*16.*Win 1.00 GAS/ }));
    fireEvent.click(getByText("Play sequence"));
    await waitFor(() => {
      expect(actions.startGame).toHaveBeenCalledWith(2);
    });
  });

  it("opens a local practice round when the reward pool cannot cover a paid run", () => {
    const actions = makeActions();
    const { container, getByText } = render(
      <PlayArea state={state({ poolFree: 0 })} actions={actions} />,
    );
    expect(getByText(/Practice mode · pool refilling/)).toBeTruthy();
    const start = getByText("Free practice").closest("button");
    expect(start?.hasAttribute("disabled")).toBe(false);
    if (start) fireEvent.click(start);
    expect(actions.startGame).not.toHaveBeenCalled();
    expect(container.querySelector(".cclash-table")).toBeTruthy();
    expect(container.querySelectorAll(".cclash-btn")).toHaveLength(4);
    expect(getByText("Practice uses a local sequence and does not submit a transaction.")).toBeTruthy();
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
    expect(getByText("Sealing your sequence…")).toBeTruthy();
  });

  it("renders the playing state with colour buttons, timer and phase indicator", () => {
    const { container, getByText } = render(
      <PlayArea state={dealtState()} actions={makeActions()} />,
    );
    // Colour buttons should be rendered
    const buttons = container.querySelectorAll(".cclash-btn");
    expect(buttons.length).toBe(4);
    expect(container.querySelector(".cclash-machine__console")).toBeTruthy();
    expect(container.querySelectorAll(".cclash-btn img")).toHaveLength(4);
    // Timer should be visible
    expect(container.querySelector(".cclash-timer")).toBeTruthy();
    // Phase indicator should show watch phase initially
    expect(getByText("Watch the sequence...")).toBeTruthy();
    // Progress dots
    expect(container.querySelector(".cclash-progress")).toBeTruthy();
    expect(container.querySelectorAll(".cclash-dot").length).toBe(4);
  });

  it("displays the solved state with payout and stats", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "solved",
          lastPayout: 50_000_000,
          lastElapsedMs: 45_000,
          seqAchieved: 12,
          sequence: "0123456789ab",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Correct! 0.50 GAS credited")).toBeTruthy();
    expect(getByText("Credited to your balance.")).toBeTruthy();
    expect(getByText((content) => content.startsWith("Time left"))).toBeTruthy();
    expect(getByText((content) => content.includes("0:45"))).toBeTruthy();
    expect(getByText((content) => content.startsWith("Sequence length"))).toBeTruthy();
    expect(getByText((content) => content.includes("12/12"))).toBeTruthy();
  });

  it("shows the expired state with release message", () => {
    const { getByText } = render(
      <PlayArea
        state={state({
          gameStatus: "expired",
        })}
        actions={makeActions()}
      />,
    );
    expect(getByText("Game released")).toBeTruthy();
    expect(getByText("The sequence expired.")).toBeTruthy();
  });

  it("renders the leaderboard drawer with ranked entries", () => {
    const { getByText, getAllByText, container } = render(
      <PlayArea
        state={state({
          leaderboard: [
            {
              player: "0xabcdef1234567890abcdef1234567890abcdef12",
              totalWon: 12.3,
              solved: 20,
            },
            {
              player: "0x1234567890abcdef1234567890abcdef12345678",
              totalWon: 8.1,
              solved: 11,
            },
          ],
          myRank: 2,
        })}
        actions={makeActions()}
      />,
    );
    // Open drawer via the PlayStage drawer trigger
    fireEvent.click(getAllByText("Global leaderboard")[0]);
    expect(getByText("12.3 GAS")).toBeTruthy();
    expect(getByText("8.10 GAS")).toBeTruthy();
    expect(container.querySelector('[data-me="true"]')).toBeTruthy();
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
    expect(getByText("Game released")).toBeTruthy();
    expect(getByText("The sequence expired.")).toBeTruthy();
  });
});
