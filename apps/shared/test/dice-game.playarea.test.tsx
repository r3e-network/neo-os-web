import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../dice-game/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    currentRound: "Current round",
    faceTrayHint: "Tap a die to set the roll target",
    gameTableCaption: "Ready on the table",
    pickYourFace: "Pick your lucky face",
    stakeRackTitle: "Chip rack",
    diceCommitStep: "Commit stake",
    diceHeroSubtitle: "Pick a face and submit the GAS stake.",
    diceHeroTitle: "VRF game desk",
    diceHistoryEmpty: "No local roll history yet.",
    diceHistoryTitle: "Recent rolls",
    diceOracleStep: "Morpheus VRF",
    dicePayoutLabel: "Payout",
    dicePlayLoop: "Chip to payout play loop",
    diceBetSummary: "Bet summary",
    diceRoundSummary: "Round summary",
    diceRiskCopy: "A matching face pays 5.70x after the platform fee.",
    diceRiskTitle: "House model",
    diceRuleCallback: "VRF callback resolves the exact face.",
    diceRuleCommit: "Wallet signs the GAS-backed roll intent.",
    diceRuleRefund: "Pending rolls can be refunded by contract rules.",
    diceSettleStep: "Settle payout",
    diceStakeDeskTitle: "Selected face",
    diceVrfRouteCopy: "The oracle settles the pending roll.",
    diceVrfRouteTitle: "Settlement route",
    diceWalletLabel: "Current stake",
    feeLabel: "Platform fee",
    howItWorks: "How it works",
    customStakeHint: "Open for exact GAS",
    customStakeTitle: "Fine tune stake",
    invalidStake: "Enter a GAS stake from 0.05 to 20.",
    lastTx: "Transaction",
    netWinLabel: "Net win",
    oddsLabel: "Chance",
    pendingBody: "Waiting for oracle callback.",
    pendingTitle: "VRF request submitted",
    payoutPreview: "Win payout",
    rangeLabel: "Stake range",
    readyTitle: "Choose a face and roll",
    rollAction: "Roll with VRF",
    rollDice: "Roll Dice",
    safetyModel: "Safety model",
    selectedFace: "Face",
    stakeAmount: "Stake",
    stakeHelp: "Potential payout:",
    stakePresets: "Stake presets",
    statusFailed: "Roll failed",
    statusReady: "Ready",
    statusRolling: "Rolling...",
    statusSubmitting: "Submitting roll...",
    statusSubmitted: "Roll submitted",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    selectedFace: "6",
    stakeAmount: "0.10 GAS",
    payoutPreview: "0.57 GAS",
    lastTxid: "",
    lastStatus: "Ready",
    isSubmitting: false,
    lastRoll: "",
    lastOutcome: "",
    rollHistory: [],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Dice Game PlayArea", () => {
  it("submits a selected face and GAS stake from the play area", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.change(screen.getByLabelText("Stake"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll with VRF" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("placeDiceBet", {
        chosenNumber: "3",
        amount: "0.5",
      });
    });
  });

  it("turns a roll click into immediate dice motion instead of a static submit", async () => {
    let resolveRoll: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "placeDiceBet") {
        return new Promise<void>((resolve) => {
          resolveRoll = resolve;
        });
      }
      return Promise.resolve();
    });
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Roll with VRF" }));

    expect(dispatch).toHaveBeenCalledWith("placeDiceBet", {
      chosenNumber: "6",
      amount: "0.1",
    });
    await waitFor(() => {
      expect(container.querySelector(".dice-game-form")?.getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector(".dice-stage")?.getAttribute("data-state")).toBe("rolling");
      expect(container.querySelector(".dice-stage__visual--rolling")).toBeTruthy();
      expect(container.querySelectorAll(".dice-stage__trail-die").length).toBe(3);
      expect(container.querySelector(".dice-roll-button--rolling")?.getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector(".dice-play-loop.is-ready.is-rolling")).toBeTruthy();
    });

    resolveRoll?.();
  });

  it("blocks out-of-range stakes before dispatch", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Stake"), {
      target: { value: "0.01" },
    });

    const rollButton = screen.getByRole("button", { name: "Roll with VRF" }) as HTMLButtonElement;
    expect(rollButton.disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("applies stake presets and updates the payout summary", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "1.00 GAS" }));

    expect((screen.getByLabelText("Stake") as HTMLInputElement).value).toBe(
      "1.00",
    );
    expect(screen.getByText("Potential payout: 5.70 GAS")).toBeTruthy();
    const roundSummary = container.querySelector(".dice-current-round__stats");
    expect(roundSummary?.textContent).toContain("5.70 GAS");
    expect(roundSummary?.textContent).toContain("4.70 GAS");
  });

  it("renders a game table image and current-round controls", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector('.dice-stage__table source[srcset="./dice-stage.avif"]')).toBeTruthy();
    expect(container.querySelector('.dice-chip-rack__visual img[src="./dice-chip-rack.jpg"]')).toBeTruthy();
    expect(container.querySelector(".dice-table-console")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop.is-ready")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop--idle")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop__motion--chip svg")).toBeTruthy();
    expect(container.querySelector('.dice-play-loop__motion-die img[src="./dice-face-6.jpg"]')).toBeTruthy();
    expect(container.querySelector(".dice-play-loop__motion--spark svg")).toBeTruthy();
    expect(container.querySelector('.dice-play-loop__die img[src="./dice-face-6.jpg"]')).toBeTruthy();
    expect(container.querySelector(".dice-stake-drawer")).toBeTruthy();
    expect(container.querySelectorAll(".dice-face-grid__item").length).toBe(6);
    expect(screen.getByText("Ready on the table")).toBeTruthy();
    expect(screen.getAllByText("Current round").length).toBeGreaterThan(0);
    expect(screen.getByText("Pick your lucky face")).toBeTruthy();
    expect(screen.getAllByText("Chip rack").length).toBeGreaterThan(0);
    expect(screen.getByText("Fine tune stake")).toBeTruthy();
  });

  it("shows real dice motion elements while a roll is submitting", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ isSubmitting: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".dice-stage")?.getAttribute("data-state")).toBe("rolling");
    expect(container.querySelector(".dice-stage__visual--rolling")).toBeTruthy();
    expect(container.querySelector(".dice-stage__landing-zone--rolling")).toBeTruthy();
    expect(container.querySelectorAll(".dice-stage__trail-die").length).toBe(3);
    expect(container.querySelector(".dice-roll-button--rolling")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop.is-ready.is-rolling")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop--rolling")).toBeTruthy();
    expect(container.querySelectorAll(".dice-play-loop__motion").length).toBe(3);
    expect(screen.getAllByText("Rolling...").length).toBeGreaterThan(0);
  });

  it("shows a landed dice state after a resolved winning roll", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastOutcome: "won", lastRoll: "4" })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".dice-stage")?.getAttribute("data-state")).toBe("won");
    expect(container.querySelector(".dice-stage__visual--won")).toBeTruthy();
    expect(container.querySelector(".dice-stage__landing-zone--settled")).toBeTruthy();
    expect(container.querySelector(".dice-stage__die--won")).toBeTruthy();
    expect(container.querySelector(".dice-play-loop--won")).toBeTruthy();
  });

  it("renders real local roll history instead of placeholder rows", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          rollHistory: [
            {
              face: "4",
              stake: "0.5 GAS",
              result: "Roll submitted",
              payout: "2.85 GAS",
              txid: "0x1234567890abcdef1234567890abcdef",
              at: "2026-06-01T00:00:00.000Z",
            },
          ],
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("Roll submitted")).toBeTruthy();
    expect(screen.getByText("2.85 GAS")).toBeTruthy();
    expect(screen.queryByText("Refunded")).toBeNull();
  });

  it("keeps the game board motion and reduced-motion fallback covered", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../dice-game/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes dice-play-loop-sweep");
    expect(styles).toContain("@keyframes dice-play-loop-flow");
    expect(styles).toContain("@keyframes dice-play-loop-roll");
    expect(styles).toContain("@keyframes dice-play-loop-prize");
    expect(styles).toContain("@keyframes dice-play-loop-chip-route");
    expect(styles).toContain("@keyframes dice-play-loop-die-route");
    expect(styles).toContain("@keyframes dice-play-loop-spark-route");
    expect(styles).toContain("@keyframes dice-play-loop-result-hold");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dice-play-loop__route::after[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dice-play-loop__motion[\s\S]*animation:\s*none/,
    );
  });
});
