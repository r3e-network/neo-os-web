import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
      return <div data-testid="color-clash-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../color-clash/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Color Clash",
    appSubtitle: "Watch the colors, then replay the sequence.",
    checkDealAgain: "Retry deal",
    commitmentLine: "Game #{gameId} sealed #{commitment}",
    creditLabel: "Withdrawable credit",
    drawerTitle: "Leaderboard & rules",
    expiredBanner: "Game released",
    fairnessCopy: "TEE seals the sequence commitment before settlement.",
    fairnessTitle: "Provably fair sequences",
    historyEmpty: "Your completed sequences will appear here.",
    historyTitle: "My solves",
    leaderboardTitle: "Global leaderboard",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardEmpty: "No solves recorded yet.",
    lobbyTitle: "Enter the arcade",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    rankLabel: "Global rank",
    repeatPhase: "Repeat the sequence!",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release stuck or expired game.",
    rulesCopy: "Pick a mode, watch the colors, repeat the full sequence.",
    startAction: "Play sequence",
    scoreReward: "Reward at stake",
    scoreSeqLen: "Sequence length",
    scoreTime: "Time left",
    scoreWon: "Total won",
    sidebarTitle: "My memory record",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing your sequence...",
    statusSubmitting: "Enclave verifying...",
    statusWonTitle: "Correct!",
    submitAction: "Claim reward",
    submitHint: "Sequence completed.",
    timeUpAction: "Time is up",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pull credit back to your wallet.",
    withdrawTitle: "Withdraw winnings",
    youTag: "you",
    difficulty_easy: "Pulse Arcade",
    difficulty_medium: "Neon Rush",
    difficulty_hard: "Master Circuit",
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
    gameStatus: "idle",
    gameDifficulty: 2,
    sequence: "",
    playerSequence: "",
    activeGameId: "0",
    commitment: "",
    deadline: 0,
    dealtAt: 0,
    undosUsed: 0,
    seqAchieved: 0,
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    poolFree: 25,
    credit: 0,
    lastStatus: "",
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    leaderboard: [],
    myHistory: [],
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("color-clash Phaser playarea", () => {
  it("passes game state into the production Phaser memory board without a duplicate outer start action", () => {
    const { queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(25);
    expect(props.state.sequence).toBe("");
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.deadline).toBe(0);
    expect(props.state.undosUsed).toBe(0);
    expect(queryByText("Play sequence")).toBeNull();
  });

  it("shows the settlement action only after the sequence is completed", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, queryByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          sequence: "0123",
          playerSequence: "01",
          lastStatus: "",
        })}
        dispatch={dispatch}
      />,
    );

    expect(queryByText("Claim reward")).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          sequence: "0123",
          playerSequence: "",
          lastStatus: "all-correct",
        })}
        dispatch={dispatch}
      />,
    );

    getByText("Claim reward").click();

    expect(dispatch).toHaveBeenCalledWith("submitSolution");
  });

  it("exposes deal retry, release, and credit withdrawal as recovery actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "12",
          gameStatus: "committed",
          lastStatus: "deal-pending",
          credit: 0.5,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("More actions"));
    getByText("Retry deal").click();
    getByText("Release game").click();
    getByText("Withdraw 0.50 GAS").click();

    expect(dispatch).toHaveBeenCalledWith("retryDeal");
    expect(dispatch).toHaveBeenCalledWith("expireGame");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("renders leaderboard, history, fairness, and credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          commitment: "ab".repeat(32),
          credit: 0.25,
          myRank: 2,
          myTotalWon: 1.25,
          mySolves: 3,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5 },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "42", difficulty: 2, payout: 100_000_000, solveMs: 45000, undos: 0, seqAchieved: 16 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Global leaderboard"));

    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelector(".cclash-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".cclash-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".cclash-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".cclash-history")?.textContent).toContain("Master Circuit");
    expect(container.querySelector(".cclash-history")?.textContent).toContain("+1.00 GAS");
    expect(container.textContent).toContain("Provably fair sequences");
    expect(container.textContent).toContain("Game #42 sealed");
    expect(container.querySelector(".cclash-drawer__credit")?.textContent).toContain("0.25 GAS");

    getByText("Refresh ranking").click();
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
  });

  it("keeps the Phaser wrapper from regressing to a one-line rules drawer", () => {
    const source = fs.readFileSync(path.join(appsRoot(), "color-clash/src/PhaserPlayArea.tsx"), "utf8");

    expect(source).toContain("cclash-ranks");
    expect(source).toContain("cclash-history");
    expect(source).toContain("refreshLeaderboard");
    expect(source).not.toContain("drawer={{ children: <p>{t(\"rulesTitle\")}</p> }}");
  });
});
