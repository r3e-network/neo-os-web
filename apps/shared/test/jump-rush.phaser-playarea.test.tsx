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
      return <div data-testid="jump-rush-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../jump-rush/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Jump Rush",
    appSubtitle: "Hold, jump, land clean, and clear the route for GAS.",
    activeRunTitle: "Active run",
    creditLabel: "Withdrawable credit",
    creditShort: "Credit",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Cloud Dash",
    difficulty_hard: "Summit Leap",
    drawerSummaryLabel: "Jump Rush account summary",
    drawerTitle: "Leaderboard & rules",
    fairnessCopy: "TEE seals the route.",
    fairnessTitle: "Fair route",
    historyEmpty: "Your verified runs will appear here.",
    historyTitle: "My runs",
    historyUndos: "{undos} undos",
    lastRunLine: "Last verified: {payout} in {time}",
    leaderboardEmpty: "No verified runs yet.",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Choose your route",
    moreActions: "More",
    nextRunTitle: "Next run",
    poolShort: "Pool",
    playingTitle: "Racing to {difficulty}",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Frees the reserved reward.",
    runEconomyLine: "Entry {entry} GAS · prize {reward} GAS",
    rulesCopy: "Clear all platforms before time runs out.",
    rulesTitle: "How it works",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    shufflingCopy: "Sealing inside the enclave.",
    solvesCount: "{count} runs",
    statusReady: "Choose a jump route to start",
    statusShuffling: "Sealing your run",
    statusPoolLow: "Pool refilling for this route",
    statusSubmitting: "Submitting run",
    statusWonTitle: "Target reached!",
    timeUpAction: "Time is up",
    undoAction: "Undo jump",
    undoHint: "Undo through the enclave.",
    youTag: "you",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Withdraw winnings.",
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
    commitment: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    lastPayout: "",
    lastElapsedMs: 0,
    lastStatus: "Choose a jump route to start",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    myTotalWon: 0,
    platformsView: [],
    poolFree: 25,
    undosUsed: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("jump-rush Phaser playarea", () => {
  it("mounts the production platform game in Phaser without an outer start action", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state({ gameDifficulty: 2, poolFree: 12 })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".jr-playstage")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("jr-phaser-canvas");
    expect(props.ariaLabel).toBe("Jump Rush platform game");
    expect(props.loadingLabel).toBe("Loading jump route");
    expect(props.config?.width).toBe(400);
    expect(props.config?.height).toBe(580);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.isUndoing).toBe(false);
    expect(queryByText("Start run")).toBeNull();
  });

  it("passes active run timing and payout state into the canvas", () => {
    const deadline = Date.now() + 100_000;
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "7",
          deadline,
          dealtAt: Date.now() - 20_000,
          gameDifficulty: 1,
          gameStatus: "dealt",
          platformsView: [10, 90, 180, 240],
          undosUsed: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("7");
    expect(props.state.gameStatus).toBe("dealt");
    expect(props.state.platformsView).toEqual([10, 90, 180, 240]);
    expect(props.state.undosUsed).toBe(1);
    expect(props.state.undosLeft).toBe(2);
    expect(props.state.remainingMs).toBeGreaterThan(0);
    expect(props.state.lastStatus).toBeUndefined();
  });

  it("keeps rankings, history, and recovery actions tucked into the support layer", () => {
    const dispatch = vi.fn();
    const { container, getAllByText, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "9",
          credit: 1.25,
          deadline: Date.now() - 1000,
          dealtAt: Date.now() - 80_000,
          gameStatus: "dealt",
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 6.5, runs: 4, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 2.75, runs: 2, isUser: true },
          ],
          myHistory: [
            { gameId: "8", difficulty: 1, elapsedMs: 42_000, undos: 1, jumps: 20, perfects: 7, payout: "0.35 GAS" },
          ],
          myRank: 2,
          myTotalWon: 2.75,
          platformsView: [10, 90, 180, 240],
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".jr-ranks--phaser")).toBeNull();

    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    expect(container.querySelector(".jr-drawer__summary")).toBeTruthy();
    expect(container.querySelector(".jr-run-card")).toBeTruthy();
    expect(container.querySelector(".jr-ranks--phaser")).toBeTruthy();
    expect(getByText("6.50 GAS")).toBeTruthy();
    expect(getByText("0.35 GAS")).toBeTruthy();
    expect(getByText("Time is up")).toBeTruthy();

    fireEvent.click(getByText("More"));
    expect(getByText("Undo jump")).toBeTruthy();
    expect(getByText("Release game")).toBeTruthy();

    fireEvent.click(getAllByText("Refresh ranking")[0].closest("button")!);
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});
  });

  it("guards the Phaser source against demo-only platform gameplay", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "jump-rush/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "jump-rush/src/scenes/JumpRushScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "jump-rush/src/PlayArea.scss"), "utf8");
    const main = readFileSync(resolve(root, "jump-rush/src/main.tsx"), "utf8");

    expect(wrapper).toContain("jr-drawer__summary");
    expect(wrapper).toContain("leaderboard");
    expect(wrapper).toContain("myHistory");
    expect(wrapper).toContain(`dispatch("useUndo"`);
    expect(wrapper).not.toContain("lastStatus,");
    expect(scene).toContain("private canSubmitRun()");
    expect(scene).toContain("private poolCanCoverSelectedRoute()");
    expect(scene).toContain("private onMissedLanding()");
    expect(scene).toContain("this.dispatch(\"useUndo\", {})");
    expect(scene).toContain("centreOffset <= platform.width / 2");
    expect(scene).toContain("this.minSolveRemainingMs()");
    expect(main).toContain("undosUsed.get() >= MAX_UNDOS");
    expect(styles).toContain(".jr-drawer__summary");
    expect(styles).toContain(".jr-run-card");
    expect(styles).toContain(".jr-history");
  });
});
