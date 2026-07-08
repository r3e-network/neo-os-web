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
      return <div data-testid="game-2048-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../game-2048/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

const GAME_ID = "88";
const COMMITMENT = "ab".repeat(32);
const INIT_BOARD = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const WINNING_BOARD = [9, 5, 2, 1, 4, 3, 1, 0, 2, 1, 0, 0, 1, 0, 0, 0];

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "2048 Rush",
    appSubtitle: "Merge tiles, chase the target, and submit a verified run before time runs out.",
    checkDealAgain: "Retry sealing",
    commitmentLine: "Game #{gameId} sealed #{commitment}",
    creditLabel: "Withdrawable credit",
    drawerTitle: "Leaderboard & rules",
    fairnessCopy: "TEE seals the tile stream before settlement.",
    fairnessTitle: "Provably fair spawns",
    historyEmpty: "Your verified runs will appear here.",
    historyTitle: "My runs",
    historyUndos: "{undos} undos",
    leaderboardEmpty: "No verified runs yet.",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Build the target tile",
    moreActions: "More actions",
    networkBadge: "Neo N3",
    playingTitle: "Racing to {tile}",
    rankBadge: "Rank #{rank}",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release stuck or expired game.",
    rulesCopy: "Reach the target within the limit.",
    rulesTitle: "How it works",
    scoreBest: "Best tile",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreWon: "Total won",
    sidebarTitle: "My rush record",
    solvesCount: "{count} runs",
    solvedBanner: "You won {payout}!",
    statusDealPending: "Sealing is taking longer than usual.",
    statusReady: "Pick a lane, then merge to the glowing tile",
    statusShuffling: "Sealing your run…",
    statusWonTitle: "Target reached!",
    submitAction: "Submit run",
    submitHint: "Target reached",
    timeUpHint: "The deadline passed.",
    undoHint: "Recorded by the enclave session.",
    useUndo: "Use undo",
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
    isMoving: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    lastElapsedMs: 0,
    lastPayout: "",
    lastStatus: "Pick a lane, then merge to the glowing tile",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    poolFree: 25,
    runBoard: [],
    runMaxExp: 0,
    runMoveCount: 0,
    undosUsed: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function dealtState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return state({
    activeGameId: GAME_ID,
    commitment: COMMITMENT,
    dealtAt: Date.now() - 90_000,
    deadline: Date.now() + 90_000,
    gameStatus: "dealt",
    runBoard: [...INIT_BOARD],
    runMaxExp: 1,
    runMoveCount: 0,
    ...overrides,
  });
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("game-2048 Phaser playarea", () => {
  it("passes production run state into the Phaser board without a duplicate outer start action", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "9",
          commitment: COMMITMENT,
          credit: 0.4,
          dealtAt: 123,
          deadline: 456,
          gameDifficulty: 2,
          myRank: 3,
          poolFree: 8,
          runBoard: [...INIT_BOARD],
          runMaxExp: 1,
          runMoveCount: 2,
          undosUsed: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".rush-stage-shell")).toBeTruthy();
    expect(container.querySelector(".rush-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("rush-phaser-canvas");
    expect(props.ariaLabel).toBe("2048 Rush tile merge game");
    expect(props.loadingLabel).toBe("Loading tile table");
    expect(props.state.activeGameId).toBe("9");
    expect(props.state.commitment).toBe(COMMITMENT);
    expect(props.state.credit).toBe(0.4);
    expect(props.state.deadline).toBe(456);
    expect(props.state.dealtAt).toBe(123);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(8);
    expect(props.state.runMoveCount).toBe(2);
    expect(props.state.undosUsed).toBe(1);
    expect(queryByText("Start run")).toBeNull();
  });

  it("only exposes settlement after the target tile and anti-bot floor are both satisfied", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, queryByText, rerender } = render(
      <PhaserPlayArea t={t} state={dealtState()} dispatch={dispatch} />,
    );

    expect(queryByText("Submit run")).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          dealtAt: Date.now() - 5_000,
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
        })}
        dispatch={dispatch}
      />,
    );
    expect(queryByText("Submit run")).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
          runMoveCount: 254,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Submit run"));
    expect(dispatch).toHaveBeenCalledWith("submitRun", {});
  });

  it("keeps deal retry, release, undo, and credit withdrawal inside the in-game drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          runMoveCount: 4,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));
    fireEvent.click(getByText("Use undo"));

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          deadline: Date.now() - 1_000,
          runMoveCount: 4,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Release game"));

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          credit: 0.5,
          gameStatus: "committed",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Retry sealing"));
    fireEvent.click(getByText("Withdraw winnings"));

    expect(dispatch).toHaveBeenCalledWith("useUndo", {});
    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
    expect(dispatch).toHaveBeenCalledWith("retryDeal", {});
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
  });

  it("renders leaderboard, history, fairness, and credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          commitment: COMMITMENT,
          credit: 0.25,
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: GAME_ID, difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".rush-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".rush-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".rush-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".rush-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".rush-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".rush-history")?.textContent).toContain("2048");
    expect(container.querySelector(".rush-history")?.textContent).toContain("1.00 GAS");
    expect(container.textContent).toContain("Provably fair spawns");
    expect(container.textContent).toContain("Game #88 sealed");

    fireEvent.click(getByText("Refresh ranking"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});
  });

  it("keeps 2048 Rush production Phaser code game-led and recovery-safe", () => {
    const wrapper = fs.readFileSync(path.join(appsRoot(), "game-2048/src/PhaserPlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "game-2048/src/PlayArea.scss"), "utf8");
    const scene = fs.readFileSync(path.join(appsRoot(), "game-2048/src/scenes/Game2048Scene.ts"), "utf8");

    expect(wrapper).toContain("rush-stage-shell");
    expect(wrapper).toContain("rush-stage-hud");
    expect(wrapper).toContain("rush-ingame-drawer");
    expect(wrapper).toContain("rush-drawer__summary");
    expect(wrapper).toContain("rush-history");
    expect(wrapper).toContain("const canSubmit");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).toContain("refreshLeaderboard");
    expect(wrapper).not.toContain("dispatch(\"startGame\"");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(styles).toContain(".rush-stage-shell");
    expect(styles).toContain(".rush-stage-hud");
    expect(styles).toContain(".rush-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.78");
    expect(scene).toContain("private canStartPicked()");
    expect(scene).toContain("private canMove(dir: number)");
    expect(scene).toContain("return applyMove([...board], dir)");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("this.playSfx(\"move\")");
    expect(scene).toContain("this.playSfx(\"merge\")");
  });
});
