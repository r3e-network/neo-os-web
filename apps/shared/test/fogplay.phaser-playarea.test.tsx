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
      return <div data-testid="fogplay-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../fogplay/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "FogPlay",
    appSubtitle: "Pick a side, lock the wager, reveal the fair flip.",
    betHeader: "Bet",
    betPlacedRevealing: "Revealing on-chain...",
    betPrepaidNoFlip: "Credit is held on-chain until withdrawn or reused.",
    choiceHeader: "Pick",
    commitRevealTimeline: "Commit reveal timeline",
    creditWithdrawn: "Credit withdrawn",
    fairnessNote: "Commit first, reveal from later block randomness.",
    gameHistory: "Recent Games",
    heads: "Heads",
    losses: "Losses",
    maxPayableHint: "House can pay up to {max}",
    noHistory: "No games yet.",
    payoutPreviewLabel: "2x payout",
    playAgain: "Play again",
    prepaidCredit: "Prepaid credit",
    revealFailedRetry: "Reveal failed, retry safely.",
    revealResult: "Reveal result",
    revealStalled: "Bet placed but reveal has not landed.",
    tails: "Tails",
    timelineBlock: "Block",
    timelineCommit: "Commit",
    timelineReveal: "Reveal",
    timelineSettle: "Settle",
    title: "FogPlay",
    totalGames: "Total games",
    totalWon: "Total won",
    wager: "Wager",
    winAmount: "Win amount",
    wins: "Wins",
    withdrawCredit: "Withdraw",
    youLost: "You lost",
    youWon: "You won!",
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
    betAmount: "1",
    canBet: true,
    choice: "heads",
    displayOutcome: "",
    formattedCredit: "0.00 GAS",
    formattedMaxPayable: "50.00 GAS",
    formattedTotalWon: "0.00 GAS",
    gameHistory: [],
    hasCredit: false,
    hasPendingBet: false,
    isFlipping: false,
    losses: 0,
    result: null,
    revealFailed: false,
    revealing: false,
    showWinOverlay: false,
    totalGames: 0,
    validationError: "",
    winAmount: "",
    wins: 0,
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

describe("fogplay Phaser playarea", () => {
  it("normalizes composable result objects before they reach the Phaser scene", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          result: { won: true, outcome: "heads" },
          displayOutcome: "",
          winAmount: "2.00 GAS",
          totalGames: 7,
          wins: 4,
          losses: 3,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("fogplay-phaser-canvas");
    expect(props.ariaLabel).toBe("FogPlay coin flip game");
    expect(props.loadingLabel).toBe("Opening flip table");
    expect(props.state.result).toBe("won");
    expect(props.state.displayOutcome).toBe("heads");
    expect(container.textContent).toContain("You won!");
    expect(queryByText("[object Object]")).toBeNull();
  });

  it("surfaces pending reveal as the only primary recovery action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          canBet: false,
          hasPendingBet: true,
          revealFailed: true,
        })}
        dispatch={dispatch}
      />,
    );

    expect(queryByText("Flip Coin")).toBeNull();
    fireEvent.click(getByText("Reveal result"));
    expect(dispatch).toHaveBeenCalledWith("revealResult");
  });

  it("renders credit, history, and commit-reveal fairness in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          formattedCredit: "0.75 GAS",
          formattedMaxPayable: "12.50 GAS",
          formattedTotalWon: "3.25 GAS",
          gameHistory: [
            { betId: "7", choice: "heads", amount: 1, won: true, payout: 2 },
            { betId: "8", choice: "tails", amount: "5 GAS", won: false, payout: 0 },
          ],
          hasCredit: true,
          losses: 1,
          totalGames: 2,
          wins: 1,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Recent Games"));

    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelector(".fogplay-phaser-drawer__summary")?.textContent).toContain("3.25 GAS");
    expect(container.querySelector(".fogplay-phaser-drawer__credit")?.textContent).toContain("0.75 GAS");
    expect(container.querySelector(".fogplay-phaser-history")?.textContent).toContain("Heads");
    expect(container.querySelector(".fogplay-phaser-history")?.textContent).toContain("You lost");
    expect(container.querySelector(".fogplay-phaser-drawer__fairness")?.textContent).toContain("Commit first");
    expect(container.querySelector(".fogplay-phaser-drawer__fairness")?.textContent).toContain("12.50 GAS");

    fireEvent.click(container.querySelector(".fogplay-phaser-drawer__credit .mx2-btn") as Element);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("keeps FogPlay Phaser production code game-led and state-compatible", () => {
    const wrapper = fs.readFileSync(path.join(appsRoot(), "fogplay/src/PhaserPlayArea.tsx"), "utf8");
    const scene = fs.readFileSync(path.join(appsRoot(), "fogplay/src/scenes/FogplayScene.ts"), "utf8");

    expect(wrapper).toContain("normalizeResult");
    expect(wrapper).toContain("fogplay-phaser-drawer__summary");
    expect(wrapper).toContain("fogplay-phaser-history");
    expect(wrapper).toContain("formattedMaxPayable");
    expect(wrapper).not.toContain("drawer={{ children: <p>{t(\"fairnessNote\")}</p> }}");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain('this.dispatch("setBetAmount", amount)');
    expect(scene).not.toContain('this.dispatch("setBetAmount", { amount })');
  });
});
