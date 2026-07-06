import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../fogplay/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { const m: Record<string,string> = { title:"Coin Flip", heads:"Heads", tails:"Tails", wager:"Flip", tapToPlay:"Pull", totalMachines:"M", wins:"W", totalGames:"G", totalWon:"Won", choiceHeader:"Pick", betHeader:"Bet", committing:"Flipping", youWon:"Won", youLost:"Lost", timelineResultReady:"Reveal", commitPendingRetry:"Pending", displayOutcome:"Result", betPlacedRevealing:"Revealing", pull:"Pull", pulling:"Pulling", commitRevealTimeline:"Flow", timelineCommit:"Commit", timelineReveal:"Reveal", timelineNeedsRetry:"Retry", wagerRange:"Max", resetGame:"Reset", creditWithdrawn:"Withdrawn", withdrawCredit:"Withdraw" }; return m[k] ?? k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { wins:0, losses:0, totalGames:0, formattedTotalWon:"0", betAmount:"0.5", choice:"heads", isFlipping:false, revealing:false, result:"", displayOutcome:"", showWinOverlay:false, winAmount:"", validationError:"", canBet:true, hasPendingBet:false, revealFailed:false, gameHistory:[], formattedCredit:"0", hasCredit:false, formattedMaxPayable:"5", ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("fogplay integration: dispatch params + state", () => {
  it("dispatches placeBet when user flips with bet amount 0.5 and choice heads", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("placeBet"));
  });
  it("dispatches setChoice with 'tails' when tails selected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelectorAll(".fogplay-choice-btn")[1]);
    expect(dispatch).toHaveBeenCalledWith("setChoice", "tails");
  });
  it("dispatchs setBetAmount with preset value", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelectorAll(".fogplay-bet-chip")[3]); // "50"
    expect(dispatch).toHaveBeenCalledWith("setBetAmount", "50");
  });
  it("dispatchs revealResult when hasPendingBet is true", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ hasPendingBet:true, canBet:false })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("revealResult"));
  });
  it("dispatchs withdrawCredit when hasCredit", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ hasCredit:true, showResult:true, result:"won" })} dispatch={dispatch} />);
    const withdrawBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Withdraw"));
    expect(withdrawBtn).toBeTruthy();
    fireEvent.click(withdrawBtn!);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });
  it("disables bet when canBet is false", () => {
    const { container } = render(<PlayArea t={t} state={state({ canBet:false })} dispatch={vi.fn()} />);
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
