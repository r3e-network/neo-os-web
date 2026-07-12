/**
 * flappy-dash credits offer UI (platform Credits v2 reference integration).
 *
 * Same contract as the color-clash twin, against the flappy PhaserPlayArea:
 * GameFi + configured host + settled failed run ⇒ "instant relaunch" offer
 * (retryWithCredits), insufficient ⇒ fixed-rate 1 GAS = 50 credits buy prompt
 * (buyCredits), HUD chip refresh + stale flag, and nothing at all in guest
 * mode or on hosts without a credits config.
 */
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
    creditsChipLabel: "Credits",
    creditsChipRefresh: "Refresh credit balance",
    creditsStaleHint: "Showing the last settled on-chain balance",
    creditsStaleTag: "last settled",
    creditsOfferTitle: "Instant relaunch",
    creditsOfferBody: "Spend {cost} credits to relaunch the same route.",
    creditsOfferAction: "Fly again · {cost} credits",
    creditsBalanceLine: "Balance: {balance} credits",
    creditsInsufficientBody:
      "You need {cost} credits. Top up at the fixed rate: 1 GAS = {rate} credits.",
    creditsBuyAction: "Buy {credits} credits for {gas} GAS",
    appEyebrow: "Flappy Dash",
    expiredBanner: "That run got away",
    lobbyTitle: "Choose your flight",
    networkBadge: "Neo N3",
    scorePipes: "Pipes passed",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    routeSummary: "Flight route summary",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Sky Sprint",
    difficulty_hard: "Pipe Gauntlet",
    a11yDifficultyGroup: "Choose a flight route",
    a11yStartRoute: "Start selected route",
    gameAriaLabel: "Flappy Dash arcade game",
    gameLoadingLabel: "Opening flight deck",
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
    appMode: "gamefi",
    activeGameId: "0",
    commitment: "",
    credit: 0,
    dealtAt: 0,
    deadline: 0,
    gameDifficulty: 0,
    gameStatus: "expired",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    isRecovering: false,
    isConnectingWallet: false,
    inputSyncFailed: false,
    walletConnected: true,
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
    // Credits lane observables (what createGameCreditsLane exposes).
    creditsAvailable: true,
    creditsBalance: 40,
    creditsStale: false,
    creditsBusy: false,
    creditsNeedsTopUp: false,
    creditsReviveEnabled: true,
    creditsReviveCost: 5,
    creditsBuyGas: 1,
    creditsBuyCredits: 50,
    creditsRate: 50,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("flappy-dash credits offer", () => {
  it("offers a credits-priced instant relaunch on the settled fail state in GameFi mode", () => {
    const dispatch = vi.fn();
    const { getByText, getByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    expect(getByText("Instant relaunch")).toBeTruthy();
    expect(getByText("Balance: 40 credits")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Fly again · 5 credits" }));
    expect(dispatch).toHaveBeenCalledWith("retryWithCredits", {});
  });

  it("switches to the fixed-rate buy prompt when the balance cannot cover the relaunch", () => {
    const dispatch = vi.fn();
    const { getByText, getByRole, queryByRole } = render(
      <PhaserPlayArea t={t} state={state({ creditsBalance: 2 })} dispatch={dispatch} />,
    );
    expect(
      getByText("You need 5 credits. Top up at the fixed rate: 1 GAS = 50 credits."),
    ).toBeTruthy();
    expect(queryByRole("button", { name: "Fly again · 5 credits" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Buy 50 credits for 1 GAS" }));
    expect(dispatch).toHaveBeenCalledWith("buyCredits", {});
  });

  it("renders the HUD balance chip wired to refreshCredits and flags stale chain fallbacks", () => {
    const dispatch = vi.fn();
    const { getByRole, rerender, container } = render(
      <PhaserPlayArea t={t} state={state({ gameStatus: "idle" })} dispatch={dispatch} />,
    );
    fireEvent.click(getByRole("button", { name: /Credits: 40/ }));
    expect(dispatch).toHaveBeenCalledWith("refreshCredits", {});

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ gameStatus: "idle", creditsStale: true })}
        dispatch={dispatch}
      />,
    );
    expect(
      container.querySelector(".flappy-credits-chip")?.getAttribute("data-stale"),
    ).toBe("true");
  });

  it("disables the relaunch while a credit action is in flight", () => {
    const { getByRole } = render(
      <PhaserPlayArea t={t} state={state({ creditsBusy: true })} dispatch={vi.fn()} />,
    );
    const retry = getByRole("button", { name: "Fly again · 5 credits" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
  });

  it("never renders credits UI in guest mode", () => {
    const { container } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "guest" })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".flappy-credits-chip")).toBeNull();
    expect(container.querySelector(".flappy-credits-offer")).toBeNull();
  });

  it("degrades away entirely when the host has no credits config", () => {
    const { container } = render(
      <PhaserPlayArea t={t} state={state({ creditsAvailable: false })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".flappy-credits-chip")).toBeNull();
    expect(container.querySelector(".flappy-credits-offer")).toBeNull();
  });

  it("keeps the chip but withholds the offer while paid flights are fail-closed", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ creditsReviveEnabled: false })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".flappy-credits-chip")).toBeTruthy();
    expect(container.querySelector(".flappy-credits-offer")).toBeNull();
  });
});
