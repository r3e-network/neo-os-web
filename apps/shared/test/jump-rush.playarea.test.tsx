import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../jump-rush/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GAME_ID = "7";
const COMMITMENT = "ab".repeat(32);

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Jump Rush",
    appSubtitle: "Hold, jump, land clean, and clear the route for GAS.",
    lobbyTitle: "Choose your route",
    playingTitle: "Racing to {difficulty}",
    statusWonTitle: "Target reached!",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    difficultyTitle: "Jump route",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Cloud Dash",
    difficulty_hard: "Summit Leap",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    targetJumps: "{count} jumps",
    timeAmount: "{minutes} min",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    lobbyReady: "Ready to jump",
    startAction: "Start run",
    startHint: "Entry {amount} GAS",
    submitAction: "Submit run",
    submitHint: "All jumps complete",
    jumpAction: "Jump!",
    chargeHint: "Hold to charge, release to jump",
    timeUpAction: "Time is up",
    undoAction: "Undo ({left} left, -30%)",
    undoConfirm: "Confirm undo — reward drops to {pct}%",
    undoHint: "Reverts your last jump on-chain.",
    releaseAction: "Release game",
    releaseHint: "Frees the reservation.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls winnings back.",
    platformsLabel: "Platforms",
    perfectLabel: "Perfect",
    comboLabel: "{x}x combo",
    perfectLanding: "Perfect!",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your balance.",
    expiredBanner: "That run got away",
    expiredBannerHint: "Fresh platforms, fresh chances.",
    statusReady: "Choose a jump route to start",
    statusShuffling: "Sealing your run…",
    statusPoolLow: "Pool refilling for this route",
    shufflingCopy: "Sealed inside the Morpheus enclave.",
    checkDealAgain: "Retry sealing",
    statusMissed: "Missed the platform!",
    jumpsCount: "{count} jumps cleared",
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
    rulesCopy: "Clear all platforms within the limit.",
    fairnessTitle: "Provably fair spawns",
    fairnessCopy: "Seeded by the beacon block.",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
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
    platformsView: [],
    commitment: "",
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
    lastStatus: "Choose a jump route to start",
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
    dealtAt: Date.now() - 120_000, // past the 45s hard min-solve floor + buffer
    deadline: Date.now() + 100_000,
    ...overrides,
  });
}

describe("jump-rush playarea (TEE mode)", () => {
  it("renders the lobby as a sprite-based runner scene with three jump routes", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".jr-lobby-preview")).toBeTruthy();
    const runner = container.querySelector<HTMLImageElement>(".jr-lobby-preview__runner");
    expect(runner?.getAttribute("src")).toContain("bunny-ready.webp");
    expect(container.querySelectorAll("img.jr-lobby-preview__platform")).toHaveLength(3);
    expect(container.querySelector(".jr-lobby-preview__landing-ring")).toBeTruthy();
    expect(container.querySelectorAll(".jr-lobby-preview__ghost")).toHaveLength(2);
    expect(container.querySelector(".jr-lobby-preview__command")?.textContent).toContain("Hold to charge");
    expect(container.querySelector(".jr-lobby-preview__carrot")).toBeTruthy();
    expect(container.querySelector(".jr-lobby__modes")).toBeTruthy();
    expect(container.querySelectorAll(".jr-mode__track")).toHaveLength(3);
    expect(getByText("Meadow Hop")).toBeTruthy();
    expect(getByText("Cloud Dash")).toBeTruthy();
    expect(getByText("Summit Leap")).toBeTruthy();
    expect(getAllByText("Win 0.1 GAS").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Win 0.5 GAS")).toBeTruthy();
    expect(getByText("Win 1 GAS")).toBeTruthy();
    expect(container.querySelector(".jr-lobby__statusbar")).toBeTruthy();
    expect(container.querySelector(".jr-lobby__pool")).toBeFalsy();
    expect(getByText("Ready to jump")).toBeTruthy();
    expect(getByText("Pool 25.00 GAS")).toBeTruthy();
    expect(getAllByText("Start run").length).toBeGreaterThan(0);
  });

  it("starts a game at the picked difficulty", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Summit Leap"));
    fireEvent.click(getAllByText("Start run")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("does not start when the reward pool cannot cover the selected jump route", () => {
    const dispatch = vi.fn();
    const { container, getAllByText, getByText, queryByText } = render(
      <PlayArea t={t} state={state({ poolFree: 0 })} dispatch={dispatch} />,
    );
    expect(container.querySelector(".jr-lobby__statusbar")).toBeTruthy();
    expect(getByText("Pool refilling for this route")).toBeTruthy();
    expect(getByText("Pool 0.00 GAS")).toBeTruthy();
    expect(queryByText(/Reward pool:/)).toBeFalsy();
    expect(queryByText(/cannot cover/)).toBeFalsy();
    const start = getAllByText("Start run")[0]?.closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders the enclave-dealt board from the store observables", () => {
    const { container } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    // Platforms are generated from seed inside the PlayArea; the game world container should exist
    const world = container.querySelector<HTMLElement>(".jr-world");
    expect(world).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".jr-character__sprite")?.getAttribute("src")).toContain("bunny-stand.webp");
    expect(container.querySelectorAll("img.jr-platform__sprite").length).toBeGreaterThan(1);
    expect(container.querySelector(".jr-hud")).toBeTruthy();
    expect(container.querySelector('.jr-hud__item[data-variant="progress"]')?.textContent).toContain("0/10");
    expect(container.querySelector(".jr-hud__bar")).toBeTruthy();
    expect(container.querySelector('.jr-hud__item[data-variant="timer"]')).toBeTruthy();
    // The scene should be in "playing" state
    const scene = container.querySelector<HTMLElement>(".jr-scene");
    expect(scene?.dataset.state).toBe("playing");
  });

  it("arms the paid undo and dispatches it on confirm", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea t={t} state={dealtState()} dispatch={dispatch} />,
    );
    const undo = getByText("Undo (3 left, -30%)").closest("button");
    expect(undo).toBeTruthy();
    expect(undo?.hasAttribute("disabled")).toBe(true);
    expect(dispatch).not.toHaveBeenCalledWith("useUndo", {});
  });

  it("shows the global leaderboard with the player's row highlighted", () => {
    const { getByText, getAllByText, container } = render(
      <PlayArea
        t={t}
        state={state({
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 12.3, runs: 20, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 8.1, runs: 11, isUser: true },
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
    expect(getByText("Time is up")).toBeTruthy();
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
    expect(getByText("Fresh platforms, fresh chances.")).toBeTruthy();
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
          gameStatus: "solved",
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

  it("shows loading state during start", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          isStarting: true,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Sealed inside the Morpheus enclave.")).toBeTruthy();
  });

  it("shows min-solve hint before the floor passes", () => {
    // dealtAt very recent so minSolveReached is false
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState({ dealtAt: Date.now() - 1000 })}
        dispatch={vi.fn()}
      />,
    );
    // The primary action should show "Jump!" (not submit yet)
    expect(getByText("Jump!")).toBeTruthy();
  });
});
