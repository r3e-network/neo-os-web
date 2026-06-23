import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../fogplay/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    betAmount: "Bet amount",
    betHeader: "Bet",
    betLockedReassure: "The commitment is already on-chain; wait for the reveal block.",
    betPlacedRevealing: "Bet placed. Revealing from the next block.",
    close: "Close",
    committing: "Committing bet",
    customBet: "Custom bet",
    docSubtitle: "Provably fair on-chain coin toss with a 2x payout",
    eyebrow: "On-chain coin toss",
    firstRoundHint: "Pick a side, set your wager, and flip.",
    firstRoundPrompt: "First toss is ready",
    flipCoin: "Flip Coin",
    flipping: "Flipping...",
    gameHistory: "Game history",
    heads: "Heads",
    losses: "Losses",
    maxPayableHint: "House can currently cover up to {max}.",
    noHistory: "No flips yet",
    oddsChip: "50 / 50 odds",
    outcomeHeader: "Outcome",
    overlayLoseLabel: "Bet was lost",
    overlayTapContinue: "Tap to continue",
    overlayUnlucky: "Unlucky",
    overlayWinLabel: "You won the flip",
    payoutHeader: "Payout",
    payoutPreviewLabel: "Payout",
    placeBet: "Ready to flip",
    prepaidCredit: "Prepaid credit",
    revealResult: "Reveal Result",
    revealStalled: "Reveal stalled. Retry settlement.",
    revealingNextBlock: "Revealing next block",
    tails: "Tails",
    title: "FogPlay",
    tokenGas: "GAS",
    totalGames: "Games",
    totalWon: "Total won",
    wager: "Wager",
    wagerRange: "Range",
    wins: "Wins",
    withdrawCredit: "Withdraw",
    youLost: "You lost",
    youPicked: "You picked",
    youWon: "You won",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    wins: 0,
    losses: 0,
    totalGames: 0,
    totalWon: 0,
    formattedTotalWon: "0 GAS",
    betAmount: "1",
    choice: "heads",
    canBet: true,
    validationError: "",
    maxPayableBet: 0,
    formattedMaxPayable: "",
    formattedCredit: "",
    hasCredit: false,
    isFlipping: false,
    revealing: false,
    hasPendingBet: false,
    revealFailed: false,
    result: null,
    displayOutcome: null,
    showWinOverlay: false,
    winAmount: "0",
    gameHistory: [],
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("FogPlay PlayArea", () => {
  it("renders a coin-toss arena with real assets, wager runway, and first-round prompt", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".premium-arena[data-state='ready']")).toBeTruthy();
    expect(container.querySelector(".arena-bg__vault")).toBeTruthy();
    expect(container.querySelector(".arena-stage__pedestal")).toBeTruthy();
    expect(container.querySelector(".coin-scene--settled-heads")).toBeTruthy();
    expect(container.querySelector(".wager-runway")).toBeTruthy();
    expect(container.querySelectorAll(".choice-card")).toHaveLength(2);
    expect(container.querySelector(".first-round-prompt")).toBeTruthy();
    expect(screen.getByText("First toss is ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Flip Coin" })).toBeTruthy();
  });

  it("dispatches side selection, wager selection, and flip actions without changing wallet logic", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Tails/ }));
    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));
    fireEvent.click(screen.getByRole("button", { name: "Flip Coin" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("setChoice", "tails");
      expect(dispatch).toHaveBeenCalledWith("setBetAmount", "5");
      expect(dispatch).toHaveBeenCalledWith("placeBet");
    });
  });

  it("turns a flip click into immediate toss motion instead of a static submit", async () => {
    let resolveFlip: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "placeBet") {
        return new Promise<void>((resolve) => {
          resolveFlip = resolve;
        });
      }
      return Promise.resolve();
    });
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Flip Coin" }));

    expect(dispatch).toHaveBeenCalledWith("placeBet");
    await waitFor(() => {
      expect(container.querySelector(".coinflip-play-area--tossing")).toBeTruthy();
      expect(container.querySelector(".premium-arena--flipping")).toBeTruthy();
      expect(container.querySelector(".coin-scene--flipping")).toBeTruthy();
      expect(container.querySelector(".bet-section--flipping")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Flipping..." }).getAttribute("aria-busy")).toBe("true");
    });

    resolveFlip?.();
  });

  it("shows visible toss motion through commit and reveal states", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ isFlipping: true, hasPendingBet: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".coinflip-play-area--tossing")).toBeTruthy();
    expect(container.querySelector(".premium-arena--flipping")).toBeTruthy();
    expect(container.querySelector(".coin-scene--flipping")).toBeTruthy();
    expect(container.querySelector(".coin-flight-trail")).toBeTruthy();
    expect(container.querySelectorAll(".coin-flight-trail span")).toHaveLength(3);
    expect(container.querySelector(".status-dot.flipping")).toBeTruthy();
    expect(container.querySelector(".bet-section--flipping")).toBeTruthy();
    expect(screen.getAllByText("Committing bet").length).toBeGreaterThan(0);
  });

  it("keeps the pending reveal visible and lets the user retry settlement", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          hasPendingBet: true,
          revealFailed: true,
          revealing: true,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".premium-arena--revealing")).toBeTruthy();
    expect(screen.getByText("Reveal stalled. Retry settlement.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Result" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("revealResult");
    });
  });

  it("renders the win state and dismisses the cinematic reward overlay", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          result: { won: true, outcome: "heads" },
          displayOutcome: "heads",
          showWinOverlay: true,
          winAmount: "2.00",
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".premium-arena--won")).toBeTruthy();
    expect(container.querySelector(".arena-stage__winner")).toBeTruthy();
    expect(container.querySelector(".coin-wrapper--won")).toBeTruthy();
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("You won the flip").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("dismissOverlay");
    });
  });

  it("keeps the coin-toss game motion and reduced-motion fallback covered", () => {
    const styles = [
      "../fogplay/src/PlayArea.scss",
      "../fogplay/src/components/ArenaHero.scss",
      "../fogplay/src/components/ThreeDCoin.scss",
      "../fogplay/src/components/WagerControls.scss",
      "../fogplay/src/pages/index/components/CoinArena.scss",
      "../fogplay/src/pages/index/components/ResultOverlay.scss",
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(styles).toContain("@keyframes coin-toss-arc");
    expect(styles).toContain("@keyframes flight-spark");
    expect(styles).toContain("@keyframes fogplay-runway-coin");
    expect(styles).toContain("@keyframes entry-pulse");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.coin-container\.flipping[\s\S]*animation:\s*none/,
    );
  });
});
