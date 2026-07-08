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
      return <div data-testid="sheep-solitaire-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../sheep-solitaire/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    expireGame: "Expire game",
    fairnessNote: "TEE moves and chain settlement keep the route fair.",
    historyTitle: "My runs",
    poolMetric: "Pool",
    rollDescription: "Pick a route, match real tiles, and clear the tray.",
    rollTab: "Sheep Solitaire",
    routeSummary: "Board summary",
    statusDealt: "Clear the flock",
    statusReady: "Choose a board route",
    statusSealing: "Sealing board",
    statusSolved: "Verified {payout}",
    activeGameLine: "Game #{gameId} is live.",
    creditLabel: "Withdrawable credit",
    drawerTitle: "Leaderboard & rules",
    fairnessShort: "TEE-sealed cards and contract-verified payout.",
    submitSolution: "Submit win",
    scoreCards: "Cards left",
    scoreTime: "Time left",
    scoreUndos: "Tools",
    toolsMetric: "Tools",
    trayMetric: "Tray",
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
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isGameOver: false,
    isMatching: false,
    isPicking: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    lastPayout: "",
    lastStatus: "",
    pileCards: [],
    poolFree: 25,
    remove3Left: 1,
    shuffleLeft: 1,
    slotCards: [],
    undosUsed: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("sheep-solitaire Phaser playarea", () => {
  it("mounts the playable sheep board in Phaser with lobby actions inside the canvas", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state({ gameDifficulty: 2, poolFree: 18 })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".sheep-playstage")).toBeTruthy();
    expect(container.querySelector(".sheep-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(container.querySelector(".sheep-phaser-lobby-hitarea")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("sheep-phaser-canvas");
    expect(props.ariaLabel).toBe("Sheep Solitaire tile game");
    expect(props.loadingLabel).toBe("Opening sheep board");
    expect(props.config?.width).toBe(400);
    expect(props.config?.height).toBe(640);
    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(18);
    expect(queryByText("Submit win")).toBeNull();
  });

  it("passes active settlement state and keeps reward claim inside the in-stage drawer", () => {
    const pileCards = [{ id: 1, symbol: 2, layer: 0, exposed: true, picked: false }];
    const slotCards = [{ id: 2, symbol: 2, layer: 0, exposed: true, picked: false }];
    const { container, getByRole, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "91",
          credit: 1.25,
          deadline: Date.now() + 180_000,
          dealtAt: Date.now() - 20_000,
          gameStatus: "solved",
          isPicking: true,
          lastPayout: "0.50",
          pileCards,
          slotCards,
          undosUsed: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("91");
    expect(props.state.gameStatus).toBe("solved");
    expect(props.state.pileCards).toEqual(pileCards);
    expect(props.state.slotCards).toEqual(slotCards);
    expect(props.state.deadline).toBeGreaterThan(0);
    expect(props.state.isPicking).toBe(true);
    expect(props.state.undosUsed).toBe(2);
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(queryByText("Withdraw 1.25 GAS")).toBeNull();
    fireEvent.click(getByRole("button", { name: /My runs/i }));
    expect(container.querySelector(".sheep-ingame-drawer")).toBeTruthy();
    expect(getByText("Withdraw 1.25 GAS")).toBeTruthy();
    expect(queryByText("Submit win")).toBeNull();
  });
});
