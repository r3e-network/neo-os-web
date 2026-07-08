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
      return <div data-testid="merge-kingdom-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../merge-kingdom/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Merge Kingdom",
    appSubtitle: "Move, merge, and raise the kingdom target.",
    activeRouteLine: "{route} route · {moves} moves · target {target} · {time}",
    checkDealAgain: "Retry sealing",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    creditLabel: "Credit",
    drawerSummaryLabel: "Merge Kingdom player summary",
    drawerTitle: "Leaderboard & rules",
    difficulty_easy: "Easy",
    difficulty_medium: "Medium",
    difficulty_hard: "Hard",
    fairnessCopy: "The enclave validates every move before settlement.",
    fairnessTitle: "Provably fair boards",
    gameTitle: "Merge Kingdom",
    historyEmpty: "No solves yet.",
    historyTitle: "My solves",
    lastResultLine: "Last settlement: {payout} · {time}",
    leaderboardIntro: "Leaderboard is rebuilt from solved events.",
    leaderboardTitle: "Leaderboard & rules",
    leaderboardEmpty: "No leaderboard entries yet.",
    lobbyTitle: "Build the kingdom",
    moreActions: "More actions",
    networkBadge: "Neo N3",
    poolLabel: "Reward pool",
    rankLabel: "Rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release an expired or stalled game.",
    rulesCopy: "Pick a route, merge adjacent kingdom tiles, and claim before the deadline.",
    scoreReward: "Reward",
    scoreTile: "Best tile",
    scoreTime: "Time left",
    scoreWon: "Total won",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing board",
    startAction: "Play again",
    startHint: "Entry {amount} GAS",
    statusExpired: "That kingdom expired",
    statusWonTitle: "Realm complete",
    submitAction: "Claim reward",
    submitHint: "Target reached.",
    tileAchieved: "Tile {tile}",
    tileTarget: "Reach {tile}",
    withdrawHint: "Pull credit back to your wallet.",
    walletRequiredStatus: "Connect wallet to play",
    withdrawTitle: "Withdraw winnings",
    withdrawAction: "Withdraw {amount} GAS",
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
    board: [],
    credit: 0,
    deadline: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastElapsedMs: 0,
    lastPayoutFixed8: 0n,
    lastStatus: "",
    leaderboard: [],
    moveCount: 0,
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    poolFree: 25,
    tileAchieved: 0,
    undosUsed: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("merge-kingdom Phaser playarea", () => {
  it("mounts the production board in Phaser and keeps lobby start inside the canvas", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".mk-playstage")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("mk-phaser-canvas");
    expect(props.ariaLabel).toBe("Merge Kingdom board game");
    expect(props.loadingLabel).toBe("Opening kingdom board");
    expect(props.config?.width).toBe(400);
    expect(props.config?.height).toBe(600);
    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.poolFree).toBe(25);
    expect(props.state.credit).toBe(0);
    expect(queryByText("Build Realm")).toBeNull();
  });

  it("passes active board state and exposes submit only after target is reached", () => {
    const board = [
      [2, 4, 0, 0],
      [0, 8, 0, 0],
      [0, 0, 16, 0],
      [0, 0, 0, 64],
    ];
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "12",
          board,
          gameDifficulty: 0,
          gameStatus: "dealt",
          moveCount: 7,
          tileAchieved: 64,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.board).toEqual(board);
    expect(props.state.moveCount).toBe(7);
    expect(props.state.tileAchieved).toBe(64);
    expect(getByText("Claim reward")).toBeTruthy();
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
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Retry sealing"));
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

  it("opens a production drawer with ranking, history, fairness, and credit recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "77",
          commitment: "ab".repeat(32),
          credit: 0.25,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "77", difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0, tileAchieved: 1024 },
          ],
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          poolFree: 8,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".mk-drawer__summary")).toBeNull();
    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".mk-drawer__summary")?.textContent).toContain("#2");
    expect(container.querySelector(".mk-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".mk-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".mk-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".mk-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".mk-history")?.textContent).toContain("Tile 1024");
    expect(container.querySelector(".mk-history")?.textContent).toContain("1.00 GAS");
    expect(container.querySelector(".mk-drawer__fairness")?.textContent).toContain("Provably fair boards");
    expect(container.querySelector(".mk-drawer__seed")?.textContent).toContain("Game #77");

    fireEvent.click(container.querySelector(".mk-ranks__refresh") as Element);
    fireEvent.click(getByText("Withdraw winnings"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("guards the Phaser shell against a flat form-style Merge Kingdom UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "merge-kingdom/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "merge-kingdom/src/scenes/MergeKingdomScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "merge-kingdom/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("mk-drawer__summary");
    expect(wrapper).toContain("mk-drawer__fairness");
    expect(wrapper).toContain("mk-history");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDiff)`);
    expect(scene).toContain(`this.dispatch("recordMove", sr, sc, row, col)`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(styles).toContain(".mk-drawer__summary");
    expect(styles).toContain(".mk-drawer__credit");
    expect(styles).toContain(".mk-drawer__seed");
  });
});
