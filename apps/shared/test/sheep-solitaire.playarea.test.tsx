import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../sheep-solitaire/src/PlayArea";
import type { CardView } from "../../sheep-solitaire/src/logic/tee-session";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GAME_ID = "77";
const COMMITMENT = "ab".repeat(32);

/** Sample pile cards for a dealt game (6 cards across 3 layers). */
const SAMPLE_PILE: CardView[] = [
  { id: 0, symbol: 0, layer: 0, exposed: true, picked: false },
  { id: 1, symbol: 1, layer: 0, exposed: true, picked: false },
  { id: 2, symbol: 2, layer: 1, exposed: true, picked: false },
  { id: 3, symbol: 3, layer: 1, exposed: true, picked: false },
  { id: 4, symbol: 4, layer: 2, exposed: true, picked: false },
  { id: 5, symbol: 5, layer: 2, exposed: true, picked: false },
  { id: 6, symbol: 0, layer: 2, exposed: false, picked: false },
  { id: 7, symbol: 2, layer: 2, exposed: false, picked: false },
];

function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "sheep-solitaire/src/PlayArea.scss"), "utf8");
}

function styleBlock(styles: string, selector: string, fromIndex = 0): string {
  const selectorStart = styles.indexOf(selector, fromIndex);
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

function mobileStyleBlock(styles: string, selector: string): string {
  const mediaStart = styles.indexOf("@media (max-width: 560px)");
  expect(mediaStart).toBeGreaterThanOrEqual(0);
  return styleBlock(styles, selector, mediaStart);
}

function t(key: string, params?: Record<string, string | number>): string {
  const messages: Record<string, string> = {
    appEyebrow: "Sheep Solitaire",
    appSubtitle: "Match 3 cards to clear the board.",
    lobbyTitle: "Clear the meadow board",
    playingTitle: "Clearing the board",
    statusWonTitle: "Board cleared!",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    difficultyTitle: "Board route",
    easyLabel: "Meadow Board",
    mediumLabel: "Festival Board",
    hardLabel: "Mountain Board",
    routeEyebrow: "match-3 route",
    routeSummary: "Selected board reward, entry, and clock",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    timeAmount: "{minutes} min",
    easyDesc: "A friendly meadow with 8 symbol families.",
    mediumDesc: "A fuller festival spread.",
    hardDesc: "A dense mountain layout.",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    startAction: "Open board",
    startHint: "Entry {amount} GAS",
    submitAction: "Submit run",
    submitHint: "All cards cleared",
    statusShuffling: "Sealing your run\u2026",
    shufflingCopy: "Sealed inside the Morpheus enclave.",
    checkDealAgain: "Retry sealing",
    statusReady: "Choose a board route to open",
    statusPoolLow: "Pool needs refill",
    pileLabel: "Hidden card",
    cardsLeft: "{count} cards left",
    slotBarLabel: "{used}/{cap} slots filled",
    slotsFull: "No more moves available!",
    rewardNow: "Reward: {amount} GAS ({pct}%)",
    undoAction: "Undo ({left} left, -30%)",
    undoConfirm: "Confirm undo \u2014 reward drops to {pct}%",
    undoHint: "Reverts your last pick on-chain.",
    shuffleAction: "Shuffle ({left} left)",
    shuffleHint: "Reshuffles slot cards.",
    remove3Action: "Remove 3 ({left} left)",
    remove3Hint: "Removes 3 cards from slots.",
    gameOverBanner: "No more moves!",
    minSolveHint: "Submit in {clock}",
    deadlineBufferHint: "Closing soon, submit now!",
    timeUpHint: "Time is up!",
    timeUpAction: "Time is up",
    releaseAction: "Release game",
    releaseHint: "Frees the reservation.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls winnings back.",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your balance.",
    expiredBanner: "That run got away",
    expiredBannerHint: "Fresh cards, fresh chances.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreCards: "Cards left",
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
    rulesCopy:
      "Match 3 identical cards to clear them from the slots. Clear all cards to win.",
    fairnessTitle: "Provably fair cards",
    fairnessCopy: "Seeded by the beacon block.",
    commitmentLine: "Game #{gameId} \u00b7 sealed commitment {commitment}",
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
    pileCards: [],
    slotCards: [],
    isMatching: false,
    isGameOver: false,
    shuffleLeft: 1,
    remove3Left: 1,
    isPicking: false,
    dealtAt: 0,
    deadline: 0,
    undosUsed: 0,
    lastPayout: "",
    lastElapsedMs: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
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
    commitment: COMMITMENT,
    pileCards: SAMPLE_PILE,
    slotCards: [],
    dealtAt: Date.now() - 120_000,
    deadline: Date.now() + 100_000,
    ...overrides,
  });
}

describe("sheep-solitaire playarea (TEE mode)", () => {
  it("renders the lobby as a playable board route selector", () => {
    const { container, getByRole, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(getByRole("radio", { name: /Meadow Board/ })).toBeTruthy();
    expect(getByRole("radio", { name: /Festival Board/ })).toBeTruthy();
    expect(getByRole("radio", { name: /Mountain Board/ })).toBeTruthy();
    // Win amounts (gasDisplay(rewardFixed8))
    expect(getAllByText("Win 0.1 GAS").length).toBeGreaterThan(0);
    expect(getByText("Win 0.5 GAS")).toBeTruthy();
    expect(getByText("Win 1 GAS")).toBeTruthy();
    expect(container.querySelectorAll(".sheep-route-card__icon")).toHaveLength(3);
    expect(container.querySelector(".sheep-lobby__playground")).toBeTruthy();
    expect(container.querySelector(".sheep-lobby__ribbon")).toBeTruthy();
    expect(container.querySelector(".sheep-lobby__tile-pile")).toBeTruthy();
    expect(container.querySelectorAll(".sheep-lobby__tile-pile img")).toHaveLength(5);
    expect(container.querySelector(".sheep-lobby__slot-preview")).toBeTruthy();
    expect(
      container.querySelector<HTMLImageElement>(".sheep-scene__banner")?.getAttribute("src"),
    ).toBe("./banner.webp");
    expect(
      container.querySelector<HTMLImageElement>(".sheep-scene__mascot")?.getAttribute("src"),
    ).toBe("./art/mascot-sheep.webp");
    // Primary action
    expect(getAllByText("Open board").length).toBeGreaterThan(0);
  });

  it("keeps the lobby as a compact game playground instead of stacked form cards", () => {
    const styles = playAreaStyles();
    const v2Start = styles.indexOf("/* ===== v2 class-name alignment");
    expect(v2Start).toBeGreaterThanOrEqual(0);
    const routeDockBlock = styleBlock(styles, ".sheep-lobby__cards", v2Start);

    expect(styles).toMatch(/\.sheep-lobby__playground\s*\{[\s\S]*min-height:\s*320px/);
    expect(styles).toMatch(/\.sheep-lobby__ribbon\s*\{[\s\S]*flex-wrap:\s*wrap/);
    expect(routeDockBlock).toMatch(/margin-top:\s*0/);
    expect(routeDockBlock).not.toMatch(/margin-top:\s*-/);
    expect(routeDockBlock).toMatch(/border-radius:\s*18px/);
    expect(routeDockBlock).toMatch(/backdrop-filter:\s*blur\(10px\)/);
    expect(styles).toMatch(/\.sheep-route-card\s*\{[\s\S]*min-height:\s*68px/);
    expect(styles).toMatch(/\.sheep-route-card\s*\{[\s\S]*grid-template-areas:[\s\S]*"icon name"[\s\S]*"icon reward"/);
    expect(styles).not.toMatch(/\.sheep-route-card__meta/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sheep-lobby__cards\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileStyleBlock(styles, ".sheep-lobby__cards")).toMatch(/margin-top:\s*0/);
    expect(mobileStyleBlock(styles, ".sheep-lobby__cards")).not.toMatch(/grid-template-columns:\s*1fr/);
  });

  it("starts a game at the picked difficulty", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    // Select the hardest board route
    fireEvent.click(getByRole("radio", { name: /Mountain Board/ }));
    // Click the primary start action
    fireEvent.click(getAllByText("Open board")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("does not start when the reward pool cannot cover the selected difficulty", () => {
    const dispatch = vi.fn();
    const { getAllByText, getByText } = render(
      <PlayArea t={t} state={state({ poolFree: 0 })} dispatch={dispatch} />,
    );
    expect(getByText(/Pool needs refill/)).toBeTruthy();
    const start = getAllByText("Open board")[0]?.closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders the dealt board with pile cards", () => {
    const { container } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    // The pile area should be visible when cards are dealt
    const pileArea = container.querySelector<HTMLElement>(".sheep-pile-area");
    expect(pileArea).toBeTruthy();
    // The scene should be in "playing" state
    const scene = container.querySelector<HTMLElement>(".sheep-scene");
    expect(scene?.dataset.state).toBe("playing");
    expect(
      container.querySelector<HTMLImageElement>(".sheep-pile__table-art")?.getAttribute("src"),
    ).toBe("./art/meadow-table.webp");
    expect(
      container.querySelector<HTMLImageElement>(".sheep-slots__tray-art")?.getAttribute("src"),
    ).toBe("./art/slot-tray.webp");
    expect(container.querySelectorAll(".sheep-card__art")).toHaveLength(6);
  });

  it("renders picked cards as tile sprites in the slot tray", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={dealtState({
          slotCards: [
            { ...SAMPLE_PILE[0], picked: true },
            { ...SAMPLE_PILE[1], picked: true },
          ],
        })}
        dispatch={vi.fn()}
      />,
    );

    const slotSprites = Array.from(
      container.querySelectorAll<HTMLImageElement>(".sheep-slot__art"),
    ).map((img) => img.getAttribute("src"));
    expect(slotSprites).toEqual([
      "./art/tile-00-wool-flower.webp",
      "./art/tile-01-apple.webp",
    ]);
  });

  it("arms the paid undo and dispatches it on confirm", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByText } = render(
      <PlayArea
        t={t}
        state={dealtState({
          slotCards: [{ ...SAMPLE_PILE[0], picked: true }],
        })}
        dispatch={dispatch}
      />,
    );
    // First click: arm undo (shows "Undo (3 left, -30%)")
    fireEvent.click(getAllByText("Undo (3 left, -30%)")[0]);
    // Second click: confirm undo (shows "Confirm undo — reward drops to 70%")
    fireEvent.click(getAllByText("Confirm undo \u2014 reward drops to 70%")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("useUndo", {});
    });
  });

  it("shows the global leaderboard with the player's row highlighted", () => {
    const { getByText, getAllByText, container } = render(
      <PlayArea
        t={t}
        state={state({
          leaderboard: [
            {
              rank: 1,
              address: "0xabcdef1234567890abcdef1234567890abcdef12",
              totalWon: 12.3,
              solves: 20,
              isUser: false,
            },
            {
              rank: 2,
              address: "0x1234567890abcdef1234567890abcdef12345678",
              totalWon: 8.1,
              solves: 11,
              isUser: true,
            },
          ],
          myRank: 2,
        })}
        dispatch={vi.fn()}
      />,
    );
    // Open the drawer
    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    // Check leaderboard values (totalWon.toFixed(2) + " GAS")
    expect(getByText("12.30 GAS")).toBeTruthy();
    expect(getByText("8.10 GAS")).toBeTruthy();
    // The current user's row should be highlighted
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
    expect(getByText("Time is up!")).toBeTruthy();
  });

  it("shows expired banner after game expiry", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({ gameStatus: "expired" })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("That run got away")).toBeTruthy();
    expect(getByText("Fresh cards, fresh chances.")).toBeTruthy();
  });

  it("shows solved banner after a win", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({ gameStatus: "solved", lastPayout: "0.5" })}
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
          credit: 10000000,
          gameStatus: "solved",
        })}
        dispatch={dispatch}
      />,
    );
    // creditGas.toFixed(2) gives "10000000.00"
    const withdraw = getByText("Withdraw 10000000.00 GAS");
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
    });
  });

  it("shows loading state during game start", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({ isStarting: true })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Sealed inside the Morpheus enclave.")).toBeTruthy();
  });

  it("shows min-solve hint before the floor passes", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ dealtAt: Date.now() - 1000 })}
        dispatch={vi.fn()}
      />,
    );
    // When minSolveReached is false, the min-solve hint is displayed
    expect(getByText(/Submit in/)).toBeTruthy();
  });
});
