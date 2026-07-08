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
      return <div data-testid="sudoku-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../sudoku/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Sudoku Arena",
    appSubtitle: "Solve the sealed board, protect your reward, and settle the win on Neo.",
    checkDealAgain: "Retry sealing",
    creditLabel: "Withdrawable credit",
    difficulty_0: "Warm-up Grid",
    difficulty_1: "Ranked Grid",
    difficulty_2: "Master Grid",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    expiredBanner: "That board got away",
    fairnessCopy: "TEE puzzle generation stays private.",
    fairnessShort: "TEE settlement stays private until signed.",
    lobbyTitle: "Open the sealed board",
    networkBadge: "Neo N3",
    playingTitle: "{difficulty} board in play",
    rankBadge: "Rank #{rank}",
    releaseAction: "Release game",
    releaseHint: "Frees the reservation.",
    rewardMetric: "Reward",
    rulesCopy: "Solve within the limit.",
    rulesShort: "Fill the sealed board and submit before the deadline.",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    statusDealPending: "Retry shortly.",
    statusReady: "Choose a board route to open",
    statusShuffling: "Sealing your puzzle...",
    statusWonTitle: "Puzzle solved!",
    submittingTitle: "Submitting solution",
    timeMetric: "Time",
    undosMetric: "Undos",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pulls winnings back.",
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
    isUndoing: false,
    lastStatus: "Choose a board route to open",
    myRank: 0,
    myTotalWon: 0,
    poolFree: 25,
    progressionReady: true,
    progressionRequiredDifficulty: 0,
    undosUsed: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("sudoku Phaser playarea", () => {
  it("mounts the production puzzle game in Phaser with state required by canvas-owned starts", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ credit: 1.2, gameDifficulty: 2, poolFree: 12, progressionRequiredDifficulty: 1 })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".sudoku-playstage")).toBeTruthy();
    expect(container.querySelector(".sudoku-stage-shell")).toBeTruthy();
    expect(container.querySelector(".sudoku-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("sudoku-phaser-canvas");
    expect(props.ariaLabel).toBe("Sudoku Arena puzzle game");
    expect(props.loadingLabel).toBe("Opening sealed sudoku board");
    expect(props.config?.width).toBe(520);
    expect(props.config?.height).toBe(720);
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.credit).toBe(1.2);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.progressionReady).toBe(true);
    expect(props.state.progressionRequiredDifficulty).toBe(1);
    expect(props.state.walletConnected).toBe(true);
    expect(queryByText("Open board")).toBeNull();
    expect(queryByText("Submit solution")).toBeNull();
  });

  it("keeps recovery and withdraw actions inside the in-game drawer while passing active timing into Phaser", () => {
    const { container, getByRole, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "22",
          credit: 0.75,
          deadline: Date.now() - 1_000,
          dealtAt: Date.now() - 300_000,
          gameStatus: "solved",
          isDealing: false,
          undosUsed: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("22");
    expect(props.state.credit).toBe(0.75);
    expect(props.state.deadline).toBeGreaterThan(0);
    expect(props.state.dealtAt).toBeGreaterThan(0);
    expect(props.state.undosUsed).toBe(2);
    expect(queryByText("Withdraw 0.75 GAS")).toBeNull();
    fireEvent.click(getByRole("button", { name: /Rules/i }));
    expect(container.querySelector(".sudoku-ingame-drawer")).toBeTruthy();
    expect(getByText("Withdraw 0.75 GAS")).toBeTruthy();
    expect(queryByText("Submit solution")).toBeNull();
  });

  it("keeps Phaser canvas, HUD, and secondary controls inside the full-height game stage", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(
      resolve(sharedRoot, "../sudoku/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toMatch(
      /\.sudoku-playarea \.mx2-stage\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).toContain(".sudoku-stage-shell");
    expect(styles).toContain(".sudoku-stage-hud");
    expect(styles).toContain(".sudoku-ingame-drawer");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2.08");
    expect(styles).toMatch(
      /@media \(max-width:\s*560px\)[\s\S]*\.sudoku-playarea \.mx2-playstage\.mx2-cat-game\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).not.toContain(".sudoku-playstage > .mx2-score");
    expect(styles).not.toContain(".sudoku-playstage > .mx2-action-rail");
  });
});
