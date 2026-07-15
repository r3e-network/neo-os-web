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
    gameAriaLabel: "Sheep Solitaire tile game",
    gameLoadingLabel: "Opening sheep board",
    gameLoadError: "The sheep board could not load",
    retryLoadAction: "Retry loading",
    keyboardControls: "Keyboard game controls",
    pickTileAction: "Pick exposed tile {index}, pattern {symbol}",
    undoAction: "Undo ({left} left)",
    shuffleAction: "Shuffle ({left} left)",
    remove3Action: "Remove 3 ({left} left)",
    dailyChallengeTitle: "Today's Challenge",
    dailyChallengeSub: "Level 1 easy, Level 2 devil",
    level1ClearedTitle: "Level 1 cleared!",
    level1ClearedSub: "On to the devil level",
    enterLevel2: "Enter Level 2",
    dailyFullyClearedTitle: "Daily clear!",
    dailyFullyClearedAny: "Fully cleared today",
    reviveSub: "Tray full, use your revive?",
    reviveAction: "Revive ({left} left)",
    retryLevel2Sub: "Out of revives",
    retryLevel2: "Retry Level 2",
    paidRunsUnavailable: "New paid boards are temporarily unavailable.",
    paidRunsUnavailableShort: "Paid boards paused",
    recoverAction: "Recover game",
    recoveryTitle: "Confirming your game",
    recoveryHint: "Read the exact game before retrying.",
    openRouteAction: "Open {route}",
    easyLabel: "Meadow Board",
    mediumLabel: "Festival Board",
    hardLabel: "Mountain Board",
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
    failureReason: "none",
    isMatching: false,
    isPicking: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    isTeeBusy: false,
    isRecovering: false,
    isFinancialAction: false,
    newPaidRunsEnabled: false,
    lastPayout: "",
    lastStatus: "",
    pileCards: [],
    poolFree: 25,
    remove3Left: 1,
    shuffleLeft: 1,
    slotCards: [],
    undosUsed: 0,
    level: 1,
    playMode: "practice",
    revivesLeft: 0,
    dailyDate: 0,
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
    // P2 rebuild (§9.4): the scene is a mobile-first full-screen field designed
    // at 390×844 logical (was 400×640), matching the original's portrait feel.
    expect(props.config?.width).toBe(390);
    expect(props.config?.height).toBe(844);
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
          appMode: "gamefi",
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

  it("keeps stale GameFi lobbies fail-closed while exposing an explicit recovery action", () => {
    const dispatch = vi.fn(async () => undefined);
    const { getAllByRole, getByRole, rerender } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "gamefi" })} dispatch={dispatch} />,
    );

    const routeButtons = getAllByRole("button", { name: /^Open /i });
    expect(routeButtons).toHaveLength(3);
    routeButtons.forEach((button) => expect(button.hasAttribute("disabled")).toBe(true));

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "gamefi",
          activeGameId: "77",
          gameStatus: "unknown",
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Recover game" }));
    expect(dispatch).toHaveBeenCalledWith("recoverGame");
  });

  it("announces tile patterns in the keyboard and screen-reader control layer", () => {
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() + 60_000,
          pileCards: [
            { id: 7, symbol: 4, layer: 0, exposed: true, picked: false },
          ],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByRole("button", { name: "Pick exposed tile 1, pattern 5" })).toBeTruthy();
  });

  it("bridges the daily-challenge state and every localized daily key into the scene", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          activeGameId: "guest",
          gameStatus: "dealt",
          playMode: "daily",
          level: 2,
          revivesLeft: 1,
          dailyDate: 20260714,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as { state: Record<string, unknown> };
    // The scene branches on these — without them the engine-complete daily
    // L1→L2 / revive loop was dead code (always practice defaults).
    expect(props.state.playMode).toBe("daily");
    expect(props.state.level).toBe(2);
    expect(props.state.revivesLeft).toBe(1);
    expect(props.state.dailyDate).toBe(20260714);
    // All 11 daily-mode keys must reach the canvas loc bag (zh parity).
    const loc = props.state.loc as Record<string, unknown>;
    for (const key of [
      "dailyChallengeTitle",
      "dailyChallengeSub",
      "level1ClearedTitle",
      "level1ClearedSub",
      "enterLevel2",
      "dailyFullyClearedTitle",
      "dailyFullyClearedAny",
      "reviveSub",
      "reviveAction",
      "retryLevel2Sub",
      "retryLevel2",
    ]) {
      expect(loc[key], `loc.${key}`).toBeTypeOf("string");
      expect(String(loc[key]).length, `loc.${key}`).toBeGreaterThan(0);
    }
    expect(loc.dailyChallengeTitle).toBe("Today's Challenge");
    expect(loc.enterLevel2).toBe("Enter Level 2");
  });

  it("exposes the daily challenge start and the solved-L1 advance in the a11y control layer", () => {
    const dispatch = vi.fn(async () => undefined);
    const { getByRole, rerender } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "guest" })} dispatch={dispatch} />,
    );

    // Idle lobby: the signature daily mode is reachable without a pointer.
    fireEvent.click(getByRole("button", { name: "Today's Challenge" }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { mode: "daily", level: 1 });

    // Solved daily L1: the advance-to-L2 action path is exposed in the DOM.
    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          activeGameId: "guest",
          gameStatus: "solved",
          playMode: "daily",
          level: 1,
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Enter Level 2" }));
    expect(dispatch).toHaveBeenCalledWith("advanceLevel");
  });

  it("keeps shuffle available with an empty tray and caps guest undo at one", () => {
    const dispatch = vi.fn(async () => undefined);
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          activeGameId: "guest",
          gameStatus: "dealt",
          pileCards: [{ id: 7, symbol: 4, layer: 0, exposed: true, picked: false }],
          slotCards: [{ id: 8, symbol: 2, layer: 0, exposed: true, picked: true }],
          undosUsed: 1,
        })}
        dispatch={dispatch}
      />,
    );

    // Shuffle reshuffles the BOARD (never drains the tray) — the empty-tray
    // gate is gone; here the tray has one tile but the gate must not depend on it.
    const shuffle = getByRole("button", { name: "Shuffle (1 left)" });
    expect(shuffle.hasAttribute("disabled")).toBe(false);
    fireEvent.click(shuffle);
    expect(dispatch).toHaveBeenCalledWith("useShuffle");

    // Guest undo economy: ONE per run — after it is spent the control locks.
    const undo = getByRole("button", { name: "Undo (0 left)" });
    expect(undo.hasAttribute("disabled")).toBe(true);
  });

  it("keeps shuffle enabled even when the tray is completely empty", () => {
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          activeGameId: "guest",
          gameStatus: "dealt",
          pileCards: [{ id: 7, symbol: 4, layer: 0, exposed: true, picked: false }],
          slotCards: [],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      getByRole("button", { name: "Shuffle (1 left)" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
