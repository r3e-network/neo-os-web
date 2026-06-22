import fs from "node:fs";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../fogplay/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    betAmount: "Bet amount",
    betLockedReassure:
      "Your bet is locked on-chain and can be revealed permissionlessly.",
    betPlacedRevealing: "Bet placed. Revealing on the next block.",
    choiceHeader: "Choice",
    committing: "Committing bet",
    customBet: "Custom bet",
    docSubtitle: "Flip an on-chain coin with commit/reveal settlement.",
    eyebrow: "Coin arena",
    firstRoundHint: "Choose a side and wager GAS to start.",
    firstRoundPrompt: "Ready for your first flip",
    flipCoin: "Flip coin",
    flipping: "Flipping",
    gameHistory: "Game history",
    heads: "Heads",
    losses: "Losses",
    maxPayableHint: `House can currently cover up to ${params?.max ?? ""}.`,
    noHistory: "No flips yet.",
    oddsChip: "2x payout",
    outcomeHeader: "Outcome",
    payoutHeader: "Payout",
    payoutPreviewLabel: "Potential payout",
    placeBet: "Place a bet",
    prepaidCredit: "Prepaid credit",
    revealResult: "Reveal result",
    revealStalled: "Reveal stalled. Try again.",
    revealingNextBlock: "Revealing next block",
    tails: "Tails",
    title: "FogPlay",
    tokenGas: "GAS",
    totalGames: "Games",
    totalWon: "Total won",
    wager: "Wager",
    wagerRange: "0.05 - 100",
    wins: "Wins",
    withdrawCredit: "Withdraw",
    youLost: "You lost",
    youPicked: "You picked",
    youWon: "You won",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values = {
    wins: 0,
    losses: 0,
    totalGames: 0,
    totalWon: 0,
    formattedTotalWon: "0 GAS",
    betAmount: "1",
    choice: "heads",
    isFlipping: false,
    revealing: false,
    hasPendingBet: false,
    revealFailed: false,
    result: null,
    displayOutcome: null,
    showWinOverlay: false,
    winAmount: "0",
    validationError: "",
    canBet: true,
    gameHistory: [],
    maxPayableBet: 10,
    formattedMaxPayable: "5 GAS",
    formattedCredit: "0 GAS",
    hasCredit: false,
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
  it("renders the real coin arena resources in the ready state", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".coinflip-game-table")).toBeTruthy();
    expect(container.querySelector(".coinflip-game-table__arena")).toBeTruthy();
    expect(container.querySelector(".coinflip-game-table__wager")).toBeTruthy();
    expect(container.querySelector(".coinflip-play-area--ready")).toBeTruthy();
    expect(
      container.querySelector(".coinflip-play-area--choice-heads"),
    ).toBeTruthy();
    expect(
      container.querySelector('.premium-arena[data-state="ready"]'),
    ).toBeTruthy();
    expect(
      container.querySelector(".arena-bg__vault")?.getAttribute("src"),
    ).toContain("bg_vault");
    expect(
      container.querySelector(".arena-stage__pedestal")?.getAttribute("src"),
    ).toContain("holo_pedestal");
    expect(container.querySelector(".coin-scene--settled-heads")).toBeTruthy();
    expect(
      container
        .querySelector(".coin-face--heads .coin-face__image")
        ?.getAttribute("src"),
    ).toContain("coin_heads");
    expect(
      container.querySelector(".symbol-ring--heads img")?.getAttribute("src"),
    ).toContain("coin_heads");
    expect(screen.getByText("Ready for your first flip")).toBeTruthy();
  });

  it("shows an animated toss stage while the bet is committing", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ isFlipping: true })} dispatch={vi.fn()} />,
    );

    expect(
      container.querySelector('.premium-arena[data-state="flipping"]'),
    ).toBeTruthy();
    expect(container.querySelector(".coin-scene--flipping")).toBeTruthy();
    expect(container.querySelectorAll(".coin-flight-trail span").length).toBe(
      3,
    );
    expect(
      container.querySelector(".coinflip-play-area--tossing"),
    ).toBeTruthy();
    expect(screen.getByText("Committing bet")).toBeTruthy();
  });

  it("keeps the toss alive while waiting for the reveal block", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ revealing: true, hasPendingBet: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      container.querySelector('.premium-arena[data-state="revealing"]'),
    ).toBeTruthy();
    expect(container.querySelector(".coin-scene--flipping")).toBeTruthy();
    expect(
      screen.getByText("Bet placed. Revealing on the next block."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your bet is locked on-chain and can be revealed permissionlessly.",
      ),
    ).toBeTruthy();
  });

  it("plays a result state with winner art after a winning flip", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          result: { won: true, outcome: "heads" },
          displayOutcome: "heads",
          totalGames: 1,
          wins: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      container.querySelector('.premium-arena[data-state="won"]'),
    ).toBeTruthy();
    expect(
      container.querySelector(".arena-stage__winner")?.getAttribute("src"),
    ).toContain("holo_winner");
    expect(container.querySelector(".result-banner.won")).toBeTruthy();
    expect(container.querySelector(".coinflip-play-area--won")).toBeTruthy();
    expect(screen.getAllByText("You won").length).toBeGreaterThan(0);
  });

  it("keeps the game-table layout and control motion accessible", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../fogplay/src/PlayArea.scss`,
      "utf8",
    );
    const wagerStyles = fs.readFileSync(
      `${process.cwd()}/../fogplay/src/components/WagerControls.scss`,
      "utf8",
    );

    expect(styles).toContain(".coinflip-game-table");
    expect(styles).toContain("grid-template-columns: minmax(0, 1.42fr)");
    expect(styles).toContain("@keyframes fogplay-vault-drift");
    expect(styles).toContain("@keyframes fogplay-table-glow");
    expect(styles).toContain("@keyframes fogplay-wager-in");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.coinflip-play-area--tossing \.coinflip-game-table::before[\s\S]*animation:\s*fogplay-table-glow/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 920px\)[\s\S]*\.coinflip-game-table[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );

    expect(wagerStyles).toContain("@keyframes fogplay-choice-lock");
    expect(wagerStyles).toContain("@keyframes fogplay-flip-ready");
    expect(wagerStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.flip-btn[\s\S]*animation:\s*none/,
    );
  });
});
