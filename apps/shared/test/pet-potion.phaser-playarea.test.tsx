import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="pet-potion-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../pet-potion/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionFeed: "Feed",
    actionPet: "Pet",
    actionPlay: "Play",
    actionRest: "Rest",
    actionTrailTitle: "Care actions",
    activeRouteLine: "{actions}/{max} actions · {time}",
    activeRunTitle: "Active care run",
    appEyebrow: "Pet Potion",
    appSubtitle: "Raise a sealed pet and claim GAS when happiness reaches target.",
    checkDealAgain: "Retry",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    creditLabel: "Credit",
    difficulty_easy: "Sprout Hatch",
    difficulty_medium: "Glow Garden",
    difficulty_hard: "Royal Bloom",
    difficultyTitle: "Nursery path",
    drawerSummaryLabel: "Pet Potion player summary",
    drawerTitle: "Leaderboard & rules",
    expiredBanner: "Game expired",
    fairnessCopy: "The enclave validates every care action.",
    fairnessTitle: "Provably fair nurturing",
    happinessCurrent: "Happiness {happiness}",
    historyEmpty: "No care sessions yet.",
    historyTitle: "My solves",
    lastResultLine: "Last settlement: {payout} · {time}",
    leaderboardEmpty: "No solves yet.",
    leaderboardIntro: "Leaderboard is rebuilt from solved events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Open the nursery",
    moreActions: "More actions",
    networkBadge: "Neo N3",
    poolLabel: "Reward pool",
    playingTitle: "{difficulty} pet in care",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release an expired or stalled game.",
    rulesCopy: "Pick a path, care for the pet, and claim before the deadline.",
    scoreHappiness: "Happiness",
    scoreReward: "Reward",
    scoreTime: "Time left",
    scoreWon: "Total won",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing pet",
    statusSubmitting: "Settling care",
    statusWonTitle: "Pet happy!",
    targetReachedHint: "Target reached.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pull credit back to your wallet.",
    withdrawTitle: "Withdraw winnings",
    youTag: "you",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    activeGameId: "0",
    actionHistory: [],
    actionsUsed: 0,
    commitment: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    happinessAchieved: 0,
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastElapsedMs: 0,
    lastPayoutFixed8: 0n,
    lastStatus: "",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    petEnergy: 50,
    petHappiness: 50,
    petHunger: 50,
    petStage: 0,
    poolFree: 25,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("pet-potion Phaser playarea", () => {
  it("mounts the production pet nursery in Phaser without an outer start form", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state({ gameDifficulty: 2, poolFree: 12 })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".pp-playstage")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("pp-phaser-canvas");
    expect(props.ariaLabel).toBe("Pet Potion nursery game");
    expect(props.loadingLabel).toBe("Opening pet nursery");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(540);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.petHappiness).toBe(50);
    expect(queryByText("Begin care")).toBeNull();
    expect(container.querySelector("form,input,textarea,select")).toBeNull();
  });

  it("passes active pet state into the canvas while the Phaser scene owns care and claim", () => {
    const { getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "31",
          actionHistory: ["feed", "play", "pet"],
          actionsUsed: 11,
          credit: 1.25,
          deadline: Date.now() + 120_000,
          dealtAt: Date.now() - 30_000,
          gameDifficulty: 1,
          gameStatus: "dealt",
          happinessAchieved: 72,
          petEnergy: 64,
          petHappiness: 72,
          petHunger: 35,
          petStage: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("31");
    expect(props.state.gameStatus).toBe("dealt");
    expect(props.state.happinessAchieved).toBe(72);
    expect(props.state.actionsUsed).toBe(11);
    expect(props.state.petStage).toBe(2);
    expect(props.state.credit).toBe(1.25);
    expect(getByText("Refresh ranking")).toBeTruthy();
    expect(queryByText("Withdraw 1.25 GAS")).toBeNull();
    expect(queryByText("Claim reward")).toBeNull();
  });

  it("keeps sealing recovery, release, withdraw, and ranking refresh as secondary actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          credit: 0.5,
          gameStatus: "committed",
          lastStatus: "deal-pending",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Retry"));
    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Release game"));
    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Withdraw 0.50 GAS"));
    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Refresh ranking"));

    expect(dispatch).toHaveBeenCalledWith("retryDeal");
    expect(dispatch).toHaveBeenCalledWith("expireGame");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
  });

  it("opens a production drawer with run state, ranking, history, fairness, and credit recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "77",
          actionHistory: ["feed", "play", "rest", "pet"],
          commitment: "ab".repeat(32),
          credit: 0.25,
          gameDifficulty: 2,
          happinessAchieved: 96,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "77", difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0, happinessAchieved: 96 },
          ],
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          poolFree: 8,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".pp-drawer__summary")).toBeNull();
    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".pp-drawer__summary")?.textContent).toContain("#2");
    expect(container.querySelector(".pp-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".pp-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".pp-run-card")?.textContent).toContain("Royal Bloom");
    expect(container.querySelector(".pp-action-trail")?.textContent).toContain("Feed");
    expect(container.querySelector(".pp-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".pp-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".pp-history")?.textContent).toContain("Happiness 96");
    expect(container.querySelector(".pp-history")?.textContent).toContain("1.00 GAS");
    expect(container.querySelector(".pp-drawer__fairness")?.textContent).toContain("Provably fair nurturing");
    expect(container.querySelector(".pp-drawer__seed")?.textContent).toContain("Game #77");

    fireEvent.click(container.querySelector(".pp-ranks__refresh") as Element);
    fireEvent.click(getByText("Withdraw winnings"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("guards the Phaser shell against a flat form-style Pet Potion UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "pet-potion/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "pet-potion/src/scenes/PetPotionScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "pet-potion/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("pp-drawer__summary");
    expect(wrapper).toContain("pp-drawer__fairness");
    expect(wrapper).toContain("pp-action-trail");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDifficulty)`);
    expect(scene).toContain(`this.dispatch("recordAction", { type: action.key })`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(styles).toContain(".pp-drawer__summary");
    expect(styles).toContain(".pp-drawer__credit");
    expect(styles).toContain(".pp-drawer__seed");
  });
});
