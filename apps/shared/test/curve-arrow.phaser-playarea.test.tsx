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

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="curve-arrow-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../curve-arrow/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Curve Arrow",
    appSubtitle: "Shoot, then hold to curve the arrow over the walls and hit every target before time runs out.",
    checkDealAgain: "Retry sealing",
    difficulty_easy: "Meadow Range",
    difficulty_medium: "Forest Range",
    difficulty_hard: "Summit Range",
    diffEasyShort: "Meadow",
    diffMediumShort: "Forest",
    diffHardShort: "Summit",
    difficultyTitle: "Choose a range",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    expiredBanner: "That game expired",
    fairnessCopy: "TEE wall layouts stay private.",
    fairnessShort: "TEE wall layouts stay private.",
    lobbyTitle: "Open the archery range",
    lobbyPreviewLabel: "{difficulty} range preview, {target} targets to clear",
    networkBadge: "Neo N3",
    playingTitle: "{difficulty} game in play",
    progressionNextRoute: "Next: {difficulty}",
    progressionStatusLabel: "Range",
    progressionUnavailableShort: "History offline",
    rankBadge: "Rank #{rank}",
    releaseAction: "Release game",
    releaseHint: "Frees the reserved reward.",
    rulesCopy: "Shoot, curve over the walls, and submit before time runs out.",
    rulesShort: "Curve over the walls and clear every target.",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreWon: "Total won",
    rewardMetric: "Reward",
    timeMetric: "Time",
    wonMetric: "Won",
    startAction: "Start range",
    statusDealPending: "Retry shortly.",
    statusReady: "Choose an archery range to start",
    statusStarted: "Game started",
    statusWonTitle: "Range cleared!",
    submitAction: "Submit win",
    timeUpAction: "Time is up",
    timeUpHint: "Release this expired run.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Withdraw winnings.",
    creditLabel: "Withdrawable credit",
    routeSummary: "Selected range reward, entry, targets, and clock",
    gameAriaLabel: "Curve Arrow archery game",
    gameLoadingLabel: "Opening the sunlit archery range",
    closeDrawer: "Close rules",
    ovRecoverBtn: "Check run",
    ovEndRunBtn: "End run",
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
    lastStatus: "Choose an archery range to start",
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

describe("curve-arrow Phaser playarea", () => {
  it("mounts the production archery game in Phaser with range starts inside the canvas", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ credit: 1.5, gameDifficulty: 2, poolFree: 12, progressionRequiredDifficulty: 1 })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".curve-arrow-playstage")).toBeTruthy();
    expect(container.querySelector(".curve-arrow-stage-hud")).toBeTruthy();
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

    expect(props.className).toBe("curve-arrow-phaser-canvas");
    expect(props.ariaLabel).toBe("Curve Arrow archery game");
    expect(props.loadingLabel).toBe("Opening the sunlit archery range");
    expect(props.config?.width).toBe(440);
    expect(props.config?.height).toBe(580);
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.credit).toBe(1.5);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.progressionRequiredDifficulty).toBe(1);
    expect(props.state.walletConnected).toBe(true);
    expect(queryByText("Start range")).toBeNull();
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
    expect(container.querySelector(".curve-arrow-ingame-drawer")).toBeTruthy();
    expect(getByText("Retry sealing")).toBeTruthy();
    expect(queryByText("Release game")).toBeNull();
    expect(queryByText("Start range")).toBeNull();
  });

  it("hides GameFi withdrawal controls for guest play even if stale credit exists", () => {
    const { getByRole, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", credit: 1.5 })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.appMode).toBe("guest");
    fireEvent.click(getByRole("button", { name: /Rules/i }));
    expect(queryByText("Withdraw 1.50 GAS")).toBeNull();
  });

  it("exposes the illustrated range cards to touch and keyboard users", () => {
    const dispatch = vi.fn();
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", {
      name: "Forest range preview, 5 targets to clear",
    }));
    expect(dispatch).toHaveBeenNthCalledWith(1, "selectDifficulty", { difficulty: 1 });
    expect(dispatch).toHaveBeenNthCalledWith(2, "startGame", { difficulty: 1 });
  });

  it("keeps the score strip and secondary controls inside the centered stage shell", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(
      resolve(sharedRoot, "../curve-arrow/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain(".curve-arrow-stage-shell");
    expect(styles).toContain(".curve-arrow-stage-hud");
    expect(styles).toContain(".curve-arrow-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio");
    expect(styles).toContain("prefers-reduced-motion");
    expect(styles).not.toContain(".curve-arrow-playstage > .mx2-score");
    expect(styles).not.toContain(".curve-arrow-playstage > .mx2-action-rail");
  });
});
