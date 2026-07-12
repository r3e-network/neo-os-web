/**
 * color-clash credits offer UI (platform Credits v2 reference integration).
 *
 * Renders the real PhaserPlayArea against driven state (the same observables
 * the game-credits lane exposes from setup) and locks the render gates:
 * - GameFi + configured host + settled failed run ⇒ the "instant retry"
 *   offer with the credits-priced action wired to `retryWithCredits`;
 * - insufficient balance ⇒ the buy prompt quoting the fixed
 *   1 GAS = 50 credits rate, wired to `buyCredits`;
 * - the HUD balance chip refreshes via `refreshCredits` and flags the
 *   settled-chain fallback as stale;
 * - guest mode and unconfigured hosts render NO credits UI at all.
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
      return <div data-testid="color-clash-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../color-clash/src/PhaserPlayArea";

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
    creditsOfferTitle: "Instant retry",
    creditsOfferBody: "Spend {cost} credits to relight the console.",
    creditsOfferAction: "Retry · {cost} credits",
    creditsBalanceLine: "Balance: {balance} credits",
    creditsInsufficientBody:
      "You need {cost} credits. Top up at the fixed rate: 1 GAS = {rate} credits.",
    creditsBuyAction: "Buy {credits} credits for {gas} GAS",
    expiredBanner: "Game released",
    lobbyTitle: "Enter the arcade",
    startAction: "Play sequence",
    networkBadge: "Neo N3",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreWon: "Total won",
    rankLabel: "Global rank",
    leaderboardTitle: "Global leaderboard",
    drawerTitle: "Leaderboard & rules",
    difficulty_easy: "Pulse Arcade",
    difficulty_medium: "Neon Rush",
    difficulty_hard: "Master Circuit",
    difficultyTitle: "Arcade mode",
    targetSeqLabel: "{count} cues",
    guestBoardTitle: "Guest leaderboard",
    guestDrawerTitle: "Guest board & rules",
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
    gameStatus: "expired",
    gameDifficulty: 1,
    selectedDifficulty: 1,
    sequence: "",
    playerSequence: "",
    activeGameId: "0",
    commitment: "",
    deadline: 0,
    dealtAt: 0,
    undosUsed: 0,
    seqAchieved: 0,
    roundNumber: 0,
    roundPhase: "expired",
    poolFree: 25,
    credit: 0,
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    leaderboard: [],
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    isPressing: false,
    isRecovering: false,
    lastStatus: "",
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

describe("color-clash credits offer", () => {
  it("offers a credits-priced instant retry on the settled fail overlay in GameFi mode", () => {
    const dispatch = vi.fn();
    const { getByText, getByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    expect(getByText("Instant retry")).toBeTruthy();
    expect(getByText("Balance: 40 credits")).toBeTruthy();
    const retry = getByRole("button", { name: "Retry · 5 credits" });
    fireEvent.click(retry);
    expect(dispatch).toHaveBeenCalledWith("retryWithCredits");
  });

  it("switches to the fixed-rate buy prompt when the balance cannot cover the retry", () => {
    const dispatch = vi.fn();
    const { getByText, getByRole, queryByRole } = render(
      <PhaserPlayArea t={t} state={state({ creditsBalance: 2 })} dispatch={dispatch} />,
    );
    expect(
      getByText("You need 5 credits. Top up at the fixed rate: 1 GAS = 50 credits."),
    ).toBeTruthy();
    expect(queryByRole("button", { name: "Retry · 5 credits" })).toBeNull();
    const buy = getByRole("button", { name: "Buy 50 credits for 1 GAS" });
    fireEvent.click(buy);
    expect(dispatch).toHaveBeenCalledWith("buyCredits");
  });

  it("shows the buy prompt after a ledger 402 even when the cached balance looked sufficient", () => {
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ creditsBalance: 40, creditsNeedsTopUp: true })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByRole("button", { name: "Buy 50 credits for 1 GAS" })).toBeTruthy();
  });

  it("renders the HUD balance chip wired to refreshCredits and flags stale chain fallbacks", () => {
    const dispatch = vi.fn();
    const { getByRole, rerender, container } = render(
      <PhaserPlayArea t={t} state={state({ gameStatus: "idle" })} dispatch={dispatch} />,
    );
    const chip = getByRole("button", { name: /Credits: 40/ });
    fireEvent.click(chip);
    expect(dispatch).toHaveBeenCalledWith("refreshCredits");

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ gameStatus: "idle", creditsStale: true })}
        dispatch={dispatch}
      />,
    );
    const staleChip = container.querySelector(".cclash-credits-chip");
    expect(staleChip?.getAttribute("data-stale")).toBe("true");
  });

  it("disables the retry while a credit action is in flight", () => {
    const { getByRole } = render(
      <PhaserPlayArea t={t} state={state({ creditsBusy: true })} dispatch={vi.fn()} />,
    );
    const retry = getByRole("button", { name: "Retry · 5 credits" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
  });

  it("never renders credits UI in guest mode", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", gameStatus: "expired" })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".cclash-credits-chip")).toBeNull();
    expect(container.querySelector(".cclash-credits-offer")).toBeNull();
  });

  it("degrades away entirely when the host has no credits config", () => {
    const { container } = render(
      <PhaserPlayArea t={t} state={state({ creditsAvailable: false })} dispatch={vi.fn()} />,
    );
    expect(container.querySelector(".cclash-credits-chip")).toBeNull();
    expect(container.querySelector(".cclash-credits-offer")).toBeNull();
  });

  it("keeps the chip but withholds the offer while paid starts are fail-closed", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ creditsReviveEnabled: false })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".cclash-credits-chip")).toBeTruthy();
    expect(container.querySelector(".cclash-credits-offer")).toBeNull();
  });
});
