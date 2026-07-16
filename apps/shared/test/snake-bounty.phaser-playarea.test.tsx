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
    directionUp: "Move up",
    directionLeft: "Move left",
    directionDown: "Move down",
    directionRight: "Move right",
    expiredBanner: "That game expired",
    fairnessCopy: "TEE food placements stay private.",
    fairnessShort: "TEE food placements stay private.",
    gameAriaLabel: "Snake Bounty arcade game",
    gameLoadingLabel: "Opening bounty trail",
    guestGameOverBtn: "Play again",
    guestModeLine: "Free local play",
    guestRewardBadge: "Local practice run",
    guestTargetMetric: "Target",
    guestBestMetric: "Best",
    guestBestLabel: "Best length",
    guestCells: "{count} cells",
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
    touchControlsLabel: "Snake direction controls",
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
    appMode: "gamefi",
    currentLength: 3,
    snakeDead: false,
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
    const scrim = container.querySelector<HTMLElement>(".snake-ingame-scrim");
    expect(scrim).toBeTruthy();
    const pausedProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as { state: Record<string, unknown> };
    expect(pausedProps.state.uiPaused).toBe(true);
    expect(getByText("Retry sealing")).toBeTruthy();
    expect(queryByText("Release game")).toBeNull();
    expect(queryByText("Start hunt")).toBeNull();
    fireEvent.mouseDown(scrim!);
    expect(container.querySelector(".snake-ingame-drawer")).toBeNull();
  });

  it("exposes semantic mobile steering and a keyboard-accessible guest restart", () => {
    const dispatch = vi.fn();
    const { getByRole, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() + 120_000,
          dealtAt: Date.now(),
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Move up" }));
    expect(dispatch).toHaveBeenCalledWith("steerSnake", { dir: 0 });

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() + 120_000,
          dealtAt: Date.now(),
          snakeDead: true,
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Play again" }));
    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
  });

  it("keeps the score strip and secondary controls inside the centered stage shell", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(
      resolve(sharedRoot, "../snake-bounty/src/PhaserPlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain(".snake-stage-shell");
    expect(styles).toContain(".snake-stage-hud");
    expect(styles).toContain(".snake-ingame-drawer");
    expect(styles).toContain(".snake-playarea .mx2-stage__head");
    expect(styles).toContain("display: none");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).not.toContain(".snake-playstage > .mx2-score");
    expect(styles).not.toContain(".snake-playstage > .mx2-action-rail");
  });

  it("renders the core snake from authored sprite resources with safe motion cleanup", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const scene = readFileSync(
      resolve(sharedRoot, "../snake-bounty/src/scenes/SnakeScene.ts"),
      "utf8",
    );
    const drawSnake = scene.slice(
      scene.indexOf("private drawSnake("),
      scene.indexOf("// ── Draw: food"),
    );

    expect(scene).toContain('this.load.image(SNAKE_ASSETS.head, "./art/snake-head.webp")');
    expect(scene).toContain('this.load.image(SNAKE_ASSETS.body, "./art/snake-body-straight.webp")');
    expect(scene).toContain('this.load.image(SNAKE_ASSETS.tail, "./art/snake-tail.webp")');
    expect(scene).toContain('this.load.image(SNAKE_ASSETS.boundary, "./art/boundary-wall.jpg")');
    expect(scene).toContain("SNAKE_ASSETS.reward");
    expect(scene).toContain("SNAKE_ASSETS.target");
    expect(scene).toContain(".setDepth(200)");
    expect(drawSnake).toContain("this.add.image(0, 0, SNAKE_ASSETS.body)");
    expect(drawSnake).toContain(".setTexture(SNAKE_ASSETS.head)");
    expect(drawSnake).toContain(".setTexture(SNAKE_ASSETS.tail)");
    expect(drawSnake).toContain("configureTurnBranch");
    expect(drawSnake).toContain("duration: SNAKE_MOVE_MS");
    expect(drawSnake).toContain("if (this.reducedMotion)");
    expect(drawSnake).toContain("!this.tweens.isTweening(view.container)");
    expect(drawSnake).not.toMatch(/fill(?:Rounded)?Rect\(/);
    expect(scene).toContain("Phaser.Scenes.Events.SHUTDOWN, this.destroySnakeSprites");
    expect(scene).toContain("Phaser.Scenes.Events.DESTROY, this.destroySnakeSprites");
    expect(scene).toContain("this.tweens?.killTweensOf(view.container)");
    expect(scene).toContain("view.container.destroy(true)");
  });

  it("offers withdrawal in the drawer once credit is available", () => {
    const dispatch = vi.fn();
    const { getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi", credit: 1.5, gameStatus: "idle" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: /Rules/i }));
    fireEvent.click(getByText("Withdraw 1.50 GAS"));

    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
  });

  // The suite only ever asserted that "Release game" is absent. canExpireAfterGrace
  // needs the deadline to be past by more than SETTLEMENT_GRACE_MS (600_000ms),
  // so a merely-past deadline would not surface it.
  it("offers release once the settlement grace has fully elapsed", () => {
    const dispatch = vi.fn();
    const { getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "gamefi",
          activeGameId: "8",
          deadline: Date.now() - 700_000,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: /Rules/i }));
    fireEvent.click(getByText("Release game"));

    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
  });

  it("titles the stage with the expired banner once the game has expired", () => {
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi", gameStatus: "expired" })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("That game expired")).toBeTruthy();
  });
});
