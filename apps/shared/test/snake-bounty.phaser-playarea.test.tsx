import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
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
      return <div data-testid="snake-bounty-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../snake-bounty/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Snake Bounty",
    appSubtitle: "Guide the snake, eat bounty fruit, and reach the target before time runs out.",
    checkDealAgain: "Retry sealing",
    difficulty_easy: "Garden Trail",
    difficulty_medium: "Market Trail",
    difficulty_hard: "Apex Trail",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    expiredBanner: "That game expired",
    fairnessCopy: "TEE food placements stay private.",
    fairnessShort: "TEE food placements stay private.",
    lobbyTitle: "Open the bounty trail",
    networkBadge: "Neo N3",
    playingTitle: "{difficulty} game in play",
    progressionNextRoute: "Next: {difficulty}",
    progressionStatusLabel: "Route",
    progressionUnavailableShort: "History offline",
    rankBadge: "Rank #{rank}",
    releaseAction: "Release game",
    releaseHint: "Frees the reserved reward.",
    rulesCopy: "Eat food, grow, and submit before time runs out.",
    rulesShort: "Eat fruit and reach the target.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreWon: "Total won",
    rewardMetric: "Reward",
    timeMetric: "Time",
    wonMetric: "Won",
    startAction: "Start hunt",
    statusDealPending: "Retry shortly.",
    statusReady: "Choose a bounty trail to start",
    statusStarted: "Game started",
    statusWonTitle: "Target reached!",
    submitAction: "Submit win",
    timeUpAction: "Time is up",
    timeUpHint: "Release this expired run.",
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
    clues: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastStatus: "Choose a bounty trail to start",
    myRank: 0,
    myTotalWon: 0,
    poolFree: 25,
    progressionReady: true,
    progressionRequiredDifficulty: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("snake-bounty Phaser playarea", () => {
  it("mounts the production arcade game in Phaser with route starts inside the canvas", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ credit: 1.5, gameDifficulty: 2, poolFree: 12, progressionRequiredDifficulty: 1 })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".snake-playstage")).toBeTruthy();
    expect(container.querySelector(".snake-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("snake-phaser-canvas");
    expect(props.ariaLabel).toBe("Snake Bounty arcade game");
    expect(props.loadingLabel).toBe("Opening bounty trail");
    expect(props.config?.width).toBe(440);
    expect(props.config?.height).toBe(580);
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.credit).toBe(1.5);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.progressionRequiredDifficulty).toBe(1);
    expect(props.state.walletConnected).toBe(true);
    expect(queryByText("Start hunt")).toBeNull();
    expect(queryByText("Submit win")).toBeNull();
  });

  it("passes active game timing and keeps recovery actions inside the in-stage drawer", () => {
    const { container, getByRole, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "8",
          deadline: Date.now() + 120_000,
          dealtAt: Date.now() - 10_000,
          gameStatus: "committed",
          isDealing: false,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("8");
    expect(props.state.credit).toBe(0);
    expect(props.state.deadline).toBeGreaterThan(0);
    expect(props.state.dealtAt).toBeGreaterThan(0);
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(queryByText("Retry sealing")).toBeNull();
    expect(queryByText("Release game")).toBeNull();
    fireEvent.click(getByRole("button", { name: /Rules/i }));
    expect(container.querySelector(".snake-ingame-drawer")).toBeTruthy();
    expect(getByText("Retry sealing")).toBeTruthy();
    expect(getByText("Release game")).toBeTruthy();
    expect(queryByText("Start hunt")).toBeNull();
  });

  it("keeps the score strip and secondary controls inside the centered stage shell", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(
      resolve(sharedRoot, "../snake-bounty/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain(".snake-stage-shell");
    expect(styles).toContain(".snake-stage-hud");
    expect(styles).toContain(".snake-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).not.toContain(".snake-playstage > .mx2-score");
    expect(styles).not.toContain(".snake-playstage > .mx2-action-rail");
  });
});
