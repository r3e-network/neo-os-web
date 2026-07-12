import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="flappy-dash-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../flappy-dash/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Flappy Dash",
    appSubtitle: "Tap, dodge pipes, and prove the run.",
    checkDealAgain: "Retry sealing",
    commitmentLine: "Game #{gameId} sealed #{commitment}",
    closeDrawer: "Close rules",
    creditLabel: "Withdrawable credit",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Sky Sprint",
    difficulty_hard: "Pipe Gauntlet",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    expiredBanner: "That run got away",
    fairnessCopy: "TEE seals the pipe commitment before settlement.",
    fairnessShort: "TEE seals pipes before takeoff.",
    fairnessTitle: "Provably fair pipes",
    gameAriaLabel: "Flappy Dash arcade game",
    gameActionFailed: "Flight control could not continue",
    gameLoadingLabel: "Opening flight deck",
    a11yDifficultyGroup: "Choose a flight route",
    a11yStartRoute: "Start selected route",
    a11yFlyContinue: "Flap or continue the run",
    enableGameSound: "Enable game sound",
    muteGameSound: "Mute game sound",
    retry: "Retry",
    continue: "Continue",
    leaderboardEmpty: "No clears recorded yet.",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    historyEmpty: "Your completed runs will appear here.",
    historyPipes: "{pipes} pipes",
    historyTitle: "My clears",
    lobbyTitle: "Choose your flight",
    networkBadge: "Neo N3",
    playingTitle: "{difficulty} run in play",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release stuck or expired game.",
    routeSummary: "Flight route summary",
    rulesShort: "Tap through the gates and submit the verified run.",
    rulesCopy: "Tap through the pipe gates.",
    rulesTitle: "How it works",
    scorePipes: "Pipes passed",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreWon: "Total won",
    sidebarTitle: "My flappy record",
    solvesCount: "{count} clears",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Generating your pipes...",
    statusSubmitting: "Enclave verifying...",
    statusWonTitle: "Pipes cleared!",
    timeUpAction: "Time is up",
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
    commitment: "",
    credit: 0,
    dealtAt: 0,
    deadline: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastPayout: "",
    lastStatus: "",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    pipesPassed: 0,
    poolFree: 25,
    seed: "",
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

describe("flappy-dash Phaser playarea", () => {
  it("passes production run state into the Phaser flight scene without an outer start action", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "9",
          commitment: "ab".repeat(32),
          credit: 0.4,
          dealtAt: 123,
          gameDifficulty: 2,
          lastStatus: "Pipes sealed",
          pipesPassed: 3,
          seed: "tee-seed",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".flappy-playstage")).toBeTruthy();
    expect(container.querySelector(".flappy-stage-shell")).toBeTruthy();
    expect(container.querySelector(".flappy-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      loadingLabel?: string;
      preserveLogicalSize?: boolean;
      loadScene?: () => Promise<unknown>;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("flappy-phaser-canvas");
    expect(props.ariaLabel).toBe("Flappy Dash arcade game");
    expect(props.loadingLabel).toBe("Opening flight deck");
    expect(props.preserveLogicalSize).toBeUndefined();
    expect(props.loadScene).toEqual(expect.any(Function));
    expect(props.state.seed).toBe("tee-seed");
    expect(props.state.activeGameId).toBe("9");
    expect(props.state.commitment).toBe("ab".repeat(32));
    expect(props.state.credit).toBe(0.4);
    expect(props.state.dealtAt).toBe(123);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.lastStatus).toBe("Pipes sealed");
    expect(props.state.pipesPassed).toBe(3);
    expect(props.state.poolFree).toBe(25);
    expect(queryByText("Take off")).toBeNull();
  });

  it("renders the live pipes score inside the in-stage HUD", () => {
    const { container, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          deadline: Date.now() + 60_000,
          gameStatus: "dealt",
          pipesPassed: 4,
          seed: "tee-seed",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".flappy-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(getByText("4/5")).toBeTruthy();
    expect(queryByText("0/5")).toBeNull();
  });

  it("exposes deal retry, release, and credit withdrawal as recovery actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "12",
          appMode: "gamefi",
          credit: 0.5,
          gameStatus: "committed",
          deadline: Date.now() - 600_001,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Rules"));
    fireEvent.click(getByText("Retry sealing"));
    fireEvent.click(getByText("Release game"));
    fireEvent.click(getByText("Withdraw 0.50 GAS"));

    expect(dispatch).toHaveBeenCalledWith("retryDeal", {});
    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
  });

  it("renders leaderboard, history, fairness, and credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          appMode: "gamefi",
          commitment: "cd".repeat(32),
          credit: 0.25,
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "42", difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0, pipes: 20 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Rules"));

    expect(container.querySelector(".flappy-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".flappy-ingame-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".flappy-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".flappy-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".flappy-history")?.textContent).toContain("Pipe Gauntlet");
    expect(container.querySelector(".flappy-history")?.textContent).toContain("20 pipes");
    expect(container.querySelector(".flappy-history")?.textContent).toContain("1.00 GAS");
    expect(container.textContent).toContain("Provably fair pipes");
    expect(container.textContent).toContain("Game #42 sealed");
    expect(container.querySelector(".flappy-drawer__credit")?.textContent).toContain("0.25 GAS");

    fireEvent.click(getByText("Refresh ranking"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});
  });

  it("mirrors route selection and the primary flight action for keyboard users", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole, rerender } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "guest" })} dispatch={dispatch} />,
    );

    const initialProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      onReady?: () => void;
    };
    act(() => initialProps.onReady?.());

    const hardRoute = getByRole("radio", { name: /Pipe Gauntlet/ });
    fireEvent.click(hardRoute);
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", { difficulty: 2 });

    fireEvent.click(getByRole("button", { name: /Start selected route/ }));
    await waitFor(() => {
      const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
        state: { a11yPrimaryPulse?: number };
      };
      expect(props.state.a11yPrimaryPulse).toBe(1);
    });

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", gameStatus: "dealt", seed: "local-seed" })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Flap or continue the run" }));
    await waitFor(() => {
      const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
        state: { a11yPrimaryPulse?: number };
      };
      expect(props.state.a11yPrimaryPulse).toBe(2);
    });
  });

  it("restores focus to the drawer trigger after Escape", async () => {
    const { getByText, getByRole } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "guest" })} dispatch={vi.fn()} />,
    );

    const trigger = getByText("Rules").closest("button") as HTMLButtonElement;
    fireEvent.click(trigger);
    expect(getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps the Phaser wrapper from regressing to a flat form shell", () => {
    const source = fs.readFileSync(path.join(appsRoot(), "flappy-dash/src/PhaserPlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "flappy-dash/src/PlayArea.scss"), "utf8");
    const scene = fs.readFileSync(path.join(appsRoot(), "flappy-dash/src/scenes/FlappyScene.ts"), "utf8");

    expect(source).toContain("flappy-stage-hud");
    expect(source).toContain("flappy-ingame-drawer");
    expect(source).not.toContain("preserveLogicalSize");
    expect(source).toContain("flappy-ingame-drawer__summary");
    expect(source).toContain("flappy-history");
    expect(source).toContain("retryDeal");
    expect(source).toContain("refreshLeaderboard");
    expect(source).toContain("flappy-ingame-drawer__close");
    expect(source).toContain("flappy-a11y-layer");
    expect(source).toContain("a11yPrimaryPulse");
    expect(source).not.toContain("primary:");
    expect(source).not.toContain("secondaryActions");
    expect(source).not.toContain("drawerToggleLabel=");
    expect(source).not.toContain("score={");
    expect(source).not.toContain("dispatch(\"startGame\"");
    expect(styles).toContain(".flappy-stage-shell");
    expect(styles).toContain(".flappy-stage-hud");
    expect(styles).toContain(".flappy-ingame-drawer");
    expect(styles).toContain("position: absolute");
    expect(styles).toContain("height: calc(100dvh - 14px)");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.5");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("private emitFlapBurst");
    expect(scene).toContain("private playPipePassFeedback");
    expect(scene).toContain("private playResultFeedback");
    expect(scene).not.toContain("mobileZoomCorrection");
    expect(scene).toContain('this.dispatch("syncScore"');
    expect(scene).toContain("engineFlap(this.flappyState)");
    expect(scene).toContain("private restartLocalRun()");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(scene).toContain("const scrollX = (W - visibleW) / 2");
    expect(scene).toContain(".setScroll(scrollX, scrollY)");
    expect(scene).toContain("private fitCameraToHostIfNeeded()");
    expect(scene).toContain("this.fitCameraToHostIfNeeded();");
    expect(scene).toContain("MAX_CATCH_UP_STEPS");
    expect(scene).toContain("hasSeenA11yPrimaryPulse");
  });
});
