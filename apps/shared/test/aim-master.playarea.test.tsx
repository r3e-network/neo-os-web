import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aim-master/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
});

const GAME_ID = "42";
const COMMITMENT = "ab".repeat(32); // 64 hex chars
const SAMPLE_PATTERN = Array.from({ length: 312 }, (_, i) =>
  String(Math.round(150 + 50 * Math.sin(i * 0.1))),
).join(",");

function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "aim-master/src/PlayArea.scss"), "utf8");
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

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Aim Master",
    appSubtitle: "Stop the moving target at the bullseye to win GAS — each round is verified inside the Morpheus TEE.",
    lobbyTitle: "Open the target range",
    playingTitle: "{difficulty} run in play",
    statusWonTitle: "Bullseye!",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    difficultyTitle: "Target lane",
    difficulty_easy: "Warm-up Lane",
    difficulty_medium: "Arcade Range",
    difficulty_hard: "Pro Circuit",
    rangeEyebrow: "target range",
    rangeBrief: "Choose a target, enter the range, and stop the sweeping reticle on the bullseye.",
    lobbyPreviewLabel: "{lane} preview, {count} accuracy hits needed",
    laneGoal: "Land {count} clean hits",
    laneObjective_easy: "A warm range with a slower sweep and a short hit target.",
    laneObjective_medium: "A tighter arcade range with faster rhythm and a stronger bounty.",
    laneObjective_hard: "A pro circuit lane for confident aim.",
    routeSummary: "Selected lane reward, entry, target, and timer",
    winAmount: "Win {amount} GAS",
    entryAmount: "Entry {amount} GAS",
    accuracyCount: "{count} hits needed",
    timeAmount: "{seconds}s",
    poolLine: "Pool {pool} GAS",
    creditLine: "your credit {credit} GAS",
    startAction: "Enter range",
    startHint: "Entry {amount} GAS — deposited with this transaction",
    submitRound: "Submit round",
    submitHint: "Submit your accuracy score to the enclave",
    timeUpAction: "Time is up",
    releaseAction: "Release game",
    releaseHint: "Frees the reward reservation of an expired game.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls your winnings and unused entry credit back to your wallet.",
    statusReady: "Choose a target lane to enter",
    statusStarting: "Paying entry and starting…",
    statusShuffling: "Sealing your target pattern…",
    statusPoolLow: "Pool needs refill",
    statusBullseye: "Bullseye!",
    statusHit: "Hit! +{pts} pts",
    statusMiss: "Miss",
    shufflingCopy: "Your target pattern is seeded inside the Morpheus enclave.",
    checkDealAgain: "Retry sealing",
    solvedBanner: "You won {payout}!",
    solvedBannerHint: "Credited to your withdrawable balance.",
    expiredBanner: "That game expired",
    expiredBannerHint: "The entry stays in the reward pool.",
    gameOverBanner: "Game over",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreRings: "Accuracy hits",
    scoreWon: "Total won",
    drawerTitle: "Leaderboard & rules",
    leaderboardIntro: "The global ranking is rebuilt from on-chain Solved events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No solves recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My solves",
    historyEmpty: "Your solved games will appear here.",
    historyRings: "{rings} hits",
    rulesTitle: "How it works",
    rulesCopy: "1. Choose a target lane and pay the entry. 2. Tap to stop the moving target. 3. Hit the bullseye or accuracy zone enough times to win.",
    fairnessTitle: "Provably fair target",
    fairnessCopy: "The target pattern is generated inside the Morpheus TEE from a per-game secret.",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    rewardNow: "{amount} GAS",
    minSolveHint: "Anti-bot floor: submission unlocks in {clock}",
    timeUpHint: "The deadline passed.",
    deadlineBufferHint: "Too close to the deadline.",
    roundProgress: "Round progress",
    aimReady: "Tap to aim",
    tapToStop: "Tap to stop the target",
    hitCount: "{accuracies}/{total} accuracy hits",
    totalScore: "Total score: {points}",
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
    pattern: "",
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    ringsHit: 0,
    roundIndex: 0,
    roundResults: [],
    targetAccuracy: 3,
    lastPayout: "",
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    lastStatus: "Choose a target lane to enter",
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
    pattern: SAMPLE_PATTERN,
    commitment: COMMITMENT,
    dealtAt: Date.now() - 60_000,
    deadline: Date.now() + 60_000,
    targetAccuracy: 3,
    ...overrides,
  });
}

describe("aim-master playarea", () => {
  it("renders the lobby as a target range with compact lane choices", () => {
    const { container, getByText, getAllByText } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".aim-lobby__range-card")).toBeTruthy();
    expect(container.querySelector(".aim-lobby__target")).toBeTruthy();
    expect(container.querySelector(".aim-lobby__reticle")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".aim-lobby__sweep")).toBeTruthy();
    expect(container.querySelector(".aim-lobby__ribbon")).toBeTruthy();
    expect(container.querySelectorAll(".aim-diff-card__badge").length).toBe(3);
    expect(getByText("Warm-up Lane")).toBeTruthy();
    expect(getByText("Arcade Range")).toBeTruthy();
    expect(getByText("Pro Circuit")).toBeTruthy();
    expect(getByText("Win 0.1 GAS")).toBeTruthy();
    expect(getAllByText("3 hits needed").length).toBeGreaterThanOrEqual(2);
    expect(getByText("5 hits needed")).toBeTruthy();
    expect(getByText("7 hits needed")).toBeTruthy();
    expect(container.querySelectorAll(".aim-diff-card__reward")).toHaveLength(0);
  });

  it("keeps target lane choice as compact target tokens instead of a stacked card form", () => {
    const styles = playAreaStyles();
    const routeDockBlock = styleBlock(styles, ".aim-lobby__cards");

    expect(routeDockBlock).toMatch(/margin-top:\s*0/);
    expect(routeDockBlock).not.toMatch(/margin-top:\s*-/);
    expect(routeDockBlock).toMatch(/border-radius:\s*18px/);
    expect(routeDockBlock).toMatch(/backdrop-filter:\s*blur\(10px\)/);
    expect(styles).toMatch(/\.aim-playarea \.mx2-stage__title\s*\{[\s\S]*font-weight:\s*560/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-playarea \.mx2-stage__subtitle\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.aim-lobby__sweep\s*\{[\s\S]*border-radius:\s*999px/);
    expect(styles).toMatch(/\.aim-lobby__ribbon\s*\{[\s\S]*flex-wrap:\s*wrap/);
    expect(styles).toMatch(/\.aim-diff-card\s*\{[\s\S]*grid-template-areas:[\s\S]*"badge name"[\s\S]*"badge accuracy"/);
    expect(styles).toMatch(/\.aim-diff-card\s*\{[\s\S]*min-height:\s*68px/);
    expect(styles).toMatch(/\.aim-diff-card__badge\s*\{[\s\S]*width:\s*40px/);
    expect(styles).toMatch(/\.aim-diff-card__meta\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-lobby__range-card\s*\{[\s\S]*min-height:\s*300px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-lobby__cards\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileStyleBlock(styles, ".aim-lobby__cards")).toMatch(/margin-top:\s*0/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-diff-card\s*\{[\s\S]*min-height:\s*70px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-diff-card__name\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.aim-diff-card__meta\s*\{[\s\S]*display:\s*none/);
    expect(mobileStyleBlock(styles, ".aim-lobby__cards")).not.toMatch(/grid-template-columns:\s*1fr/);
  });

  it("starts a game at the picked target lane", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    fireEvent.click(getByText("Pro Circuit"));
    fireEvent.click(getByText("Enter range"));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
    });
  });

  it("does not start when the reward pool cannot cover the selected target lane", () => {
    const dispatch = vi.fn();
    const { getByText, queryByText } = render(
      <PlayArea t={t} state={state({ poolFree: 0 })} dispatch={dispatch} />,
    );
    expect(queryByText(/Pool needs refill/)).toBeNull();
    const start = getByText("Enter range").closest("button");
    expect(start?.hasAttribute("disabled")).toBe(true);
    if (start) fireEvent.click(start);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders the gauge during a dealt game", () => {
    const { container } = render(
      <PlayArea t={t} state={dealtState()} dispatch={vi.fn()} />,
    );
    // The gauge wrap should be present
    const gauge = container.querySelector(".aim-gauge-wrap");
    expect(gauge).toBeTruthy();
    expect(container.querySelector(".aim-gauge__target-board")).toBeTruthy();
    expect(container.querySelector(".aim-gauge__reticle")).toBeTruthy();
    // Ring markers should be rendered
    const rings = container.querySelectorAll(".aim-gauge__ring");
    expect(rings.length).toBeGreaterThan(0);
    // The timer should be visible
    const timer = container.querySelector(".aim-timer");
    expect(timer).toBeTruthy();
    // Round indicator dots should appear
    const dots = container.querySelectorAll(".aim-rounds__dot");
    expect(dots.length).toBe(3); // targetAccuracy = 3
  });

  it("shows the solved banner with payout after a win", () => {
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

  it("shows the expired banner after game expiry", () => {
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          gameStatus: "expired",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("That game expired")).toBeTruthy();
    expect(getByText("The entry stays in the reward pool.")).toBeTruthy();
  });

  it("renders the leaderboard drawer with entries", () => {
    const { getByText } = render(
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
  });

  it("shows the shuffling stage during committed state", () => {
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
    expect(getByText("Sealing your target pattern…")).toBeTruthy();
    expect(getByText("Retry sealing")).toBeTruthy();
  });

  it("triggers withdraw on button click when credit is available", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PlayArea
        t={t}
        state={state({
          credit: 10_000_000,
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
});
