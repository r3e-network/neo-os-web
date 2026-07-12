import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({ phaserGame: vi.fn() }));
vi.mock("@framework/phaser/LazyPhaserGameComponent", () => ({
  LazyPhaserGameComponent: (props: unknown) => {
    mocks.phaserGame(props);
    return <div data-testid="fogplay-phaser-host" />;
  },
}));

import PlayArea from "../../fogplay/src/PlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string): string {
  const messages: Record<string, string> = {
    appEyebrow: "FogPlay",
    guestSubtitle: "Local coin streak",
    guestModeBadge: "Local play",
    choiceHeader: "Pick",
    heads: "Heads",
    tails: "Tails",
    guestStreak: "Streak",
    wins: "Wins",
    losses: "Losses",
    totalGames: "Games",
    gameHistory: "Recent games",
    flipCta: "Flip",
    playAgain: "Again",
    revealResult: "Reveal",
    title: "FogPlay",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    mode: "guest",
    streak: 0,
    wins: 0,
    losses: 0,
    totalGames: 0,
    formattedTotalWon: "0 GAS",
    betAmount: "1",
    choice: "heads",
    isFlipping: false,
    revealing: false,
    result: null,
    displayOutcome: "",
    showWinOverlay: false,
    winAmount: "",
    validationError: "",
    canBet: true,
    hasPendingBet: false,
    revealFailed: false,
    gameHistory: [],
    formattedCredit: "0 GAS",
    hasCredit: false,
    formattedMaxPayable: "0 GAS",
    bankrollAvailable: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("FogPlay Phaser integration", () => {
  it("dispatches the semantic heads/tails and primary controls", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("radio", { name: "Tails" }));
    fireEvent.click(getByRole("button", { name: "Flip" }));

    expect(dispatch).toHaveBeenCalledWith("setChoice", "tails");
    expect(dispatch).toHaveBeenCalledWith("placeBet");
  });

  it("routes settled and pending states to the correct recovery action", () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    const settled = render(
      <PlayArea t={t} state={state({ result: { won: true, outcome: "HEADS" }, displayOutcome: "heads" })} dispatch={reset} />,
    );
    fireEvent.click(settled.getByRole("button", { name: "Again" }));
    expect(reset).toHaveBeenCalledWith("resetGame");
    settled.unmount();

    const reveal = vi.fn().mockResolvedValue(undefined);
    const pending = render(
      <PlayArea t={t} state={state({ hasPendingBet: true, revealFailed: true, canBet: false })} dispatch={reveal} />,
    );
    fireEvent.click(pending.getByRole("button", { name: "Reveal" }));
    expect(reveal).toHaveBeenCalledWith("revealResult");
  });

  it("passes localized recovery and sound controls to the Phaser host", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.continueLabel).toBe("Continue");
    expect(props.enableSoundLabel).toBe("Enable game sound");
    expect(props.muteSoundLabel).toBe("Mute game sound");
    expect((props.state as Record<string, unknown>).isGuest).toBe(true);
  });
});
