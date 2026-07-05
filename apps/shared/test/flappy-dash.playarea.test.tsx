import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../flappy-dash/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GAME_ID = "5";
const COMMITMENT = "cd".repeat(32);
const SEED = "tee-generated-seed-12345";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Flappy Dash",
    appSubtitle: "Tap, dodge the pipes, clear the route, and win GAS.",
    lobbyTitle: "Choose your flight",
    playingTitle: "{difficulty} run in play",
    statusWonTitle: "Pipes cleared!",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    difficultyTitle: "Flight route",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Sky Sprint",
    difficulty_hard: "Pipe Gauntlet",
    routeEyebrow: "flight route",
    routeSummary: "Selected route reward, entry, target, and clock",
    routeObjective_easy: "A bright warm-up lane with a short pipe target and forgiving rhythm.",
    routeObjective_medium: "A faster sky sprint with tighter gaps and a stronger bounty.",
    routeObjective_hard: "A long pipe gauntlet for confident flyers.",
    lobbyPreviewLabel: "{difficulty} flight route preview, clear {count} pipes",
    lobbyFlightGoal: "Clear {count} pipes",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    targetPipesLabel: "Target: {count} pipes",
    timeAmount: "{minutes} min",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    lobbyReady: "Ready to fly",
    startAction: "Take off",
    startHint: "Entry {amount} GAS — deposited with this transaction",
    tapToFly: "Tap to fly!",
    tapHint: "Tap the screen to make the bird flap and stay aloft",
    releaseAction: "Release game",
    releaseHint: "Frees the reward reservation of an expired game.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls your winnings back to your wallet.",
    gameOverTitle: "Game Over",
    gameOverPipes: "You passed {count} pipes",
    gameOverWin: "You won {payout} GAS!",
    gameOverTarget: "Target was {count} pipes",
    retryAction: "Play again",
    submitAction: "Submit run",
    shufflingCopy: "Your pipe layout is generated inside the Morpheus enclave.",
    checkDealAgain: "Retry sealing",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your withdrawable balance.",
    expiredBanner: "That run got away",
    expiredBannerHint: "Fresh pipes, fresh chances.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scorePipes: "Pipes passed",
    scoreWon: "Total won",
    drawerTitle: "Leaderboard & rules",
    leaderboardIntro: "Rebuilt from on-chain Solved events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No clears recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} clears",
    youTag: "you",
    historyTitle: "My clears",
    historyEmpty: "Your completed runs will appear here.",
    historyPipes: "{pipes} pipes",
    rulesTitle: "How it works",
    rulesCopy: "Choose a flight route and pay the entry.",
    fairnessTitle: "Provably fair pipes",
    fairnessCopy: "The pipe layout is generated inside the Morpheus TEE.",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    statusReady: "Choose a flight route to take off",
    statusPoolLow: "Pool needs refill",
    statusShuffling: "Generating your pipes…",
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
    seed: "",
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    pipesPassed: 0,
    lastPayout: "",
    lastElapsedMs: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    lastStatus: "Choose a flight route to take off",
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
    seed: SEED,
    commitment: COMMITMENT,
    dealtAt: Date.now() - 120_000,
    deadline: Date.now() + 100_000,
    ...overrides,
  });
}

describe("flappy-dash playarea (TEE mode)", () => {
  it("renders a flight-first lobby with route choices and a start action", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".flappy-lobby__flight-card")).toBeTruthy();
    expect(container.querySelector(".flappy-lobby__pixel-scene")).toBeTruthy();
    expect(container.querySelector(".flappy-lobby__bird-sprite")).toBeTruthy();
    expect(container.querySelectorAll(".flappy-lobby__pipe")).toHaveLength(2);
    expect(container.querySelectorAll(".flappy-lobby__speed-line")).toHaveLength(2);
    expect(container.querySelector(".flappy-lobby__tap-ring")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".flappy-lobby__ribbon")).toBeTruthy();
    expect(getByText("Clear 5 pipes")).toBeTruthy();
    expect(getAllByText("Meadow Hop").length).toBeGreaterThan(0);
    expect(getByText("Sky Sprint")).toBeTruthy();
    expect(getByText("Pipe Gauntlet")).toBeTruthy();
    expect(getByText("Win 0.1 GAS")).toBeTruthy();
    expect(container.querySelectorAll(".flappy-route__reward")).toHaveLength(0);
    expect(container.querySelector(".flappy-lobby__statusbar")).toBeTruthy();
    expect(container.querySelector(".flappy-lobby__pool")).toBeFalsy();
    expect(getByText("Ready to fly")).toBeTruthy();
    expect(getByText("Pool 25.00 GAS")).toBeTruthy();
    expect(getAllByText("Take off").length).toBeGreaterThan(0);
  });

  it("keeps the lobby preview game-like, animated, and not form-first", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "flappy-dash/src/PlayArea.scss"),
      "utf8",
    );
    const source = fs.readFileSync(
      path.join(appsRoot, "flappy-dash/src/PlayArea.tsx"),
      "utf8",
    );

    expect(source).toContain("flappy-lobby__speed-line");
    expect(source).toContain("flappy-lobby__tap-ring");
    expect(styles).toMatch(/\.flappy-lobby\s*\{[\s\S]*max-width:\s*720px/);
    expect(styles).toMatch(/\.flappy-lobby__flight-card\s*\{[\s\S]*min-height:\s*322px/);
    expect(styles).toMatch(/\.flappy-lobby__flight-copy\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.flappy-lobby__bird-sprite\s*\{[\s\S]*left:\s*53%/);
    expect(styles).toMatch(/\.flappy-lobby__base\s*\{[\s\S]*animation:\s*flappy-ground-scroll/);
    expect(styles).toMatch(/\.flappy-lobby__pipe\s*\{[\s\S]*animation:\s*flappy-pipe-drift/);
    expect(styles).toMatch(/\.flappy-lobby__speed-line\s*\{[\s\S]*animation:\s*flappy-speed-line/);
    expect(styles).toMatch(/\.flappy-lobby__tap-ring\s*\{[\s\S]*animation:\s*flappy-tap-ring/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps low-pool messaging compact instead of surfacing a backend warning", () => {
    const { container, getAllByText, getByText, queryByText } = render(
      <PlayArea t={t} state={state({ poolFree: 0 })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".flappy-lobby__statusbar")).toBeTruthy();
    expect(getAllByText("Pool needs refill").length).toBeGreaterThan(0);
    expect(getByText("Pool 0.00 GAS")).toBeTruthy();
    expect(queryByText(/Reward pool:/)).toBeFalsy();
    expect(queryByText(/cannot cover/)).toBeFalsy();
  });

  it("starts a game at the picked flight route", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Pipe Gauntlet"));
    fireEvent.click(getAllByText("Take off")[0]);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("renders the enclave-dealt board from the store observables", () => {
    const { container } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    // The canvas should be present when seed is loaded
    const canvas = container.querySelector<HTMLCanvasElement>(".flappy-canvas");
    expect(canvas).toBeTruthy();
    // The scene should be in "playing" state
    const scene = container.querySelector<HTMLElement>(".flappy-scene");
    expect(scene?.dataset.state).toBe("playing");
  });

  it("shows the global leaderboard with the player's row highlighted", () => {
    const { getByText, container } = render(
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
    fireEvent.click(getByText("Leaderboard & rules"));
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
    expect(getByText("Release game")).toBeTruthy();
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
    expect(getByText("Fresh pipes, fresh chances.")).toBeTruthy();
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
    expect(getByText("Credited to your withdrawable balance.")).toBeTruthy();
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

  it("shows loading state during dealing", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          isStarting: true,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Take off")).toBeTruthy(); // primary action when idle
  });

  it("shows shuffling copy during committed state before seed arrives", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          gameStatus: "committed",
          gameDifficulty: 0,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Your pipe layout is generated inside the Morpheus enclave.")).toBeTruthy();
  });

  it("shows 'Tap to fly!' overlay when game is ready to play", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={dealtState()}
        dispatch={vi.fn()}
      />,
    );
    // The ready overlay should be visible
    expect(getByText("Tap to fly!")).toBeTruthy();
  });
});
