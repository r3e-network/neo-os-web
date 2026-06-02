import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../burn-league/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    amount: "Amount",
    burn: "Burn Now",
    burnActionHint:
      "Burn submission creates an OS game-entry wallet intent.",
    burnPresets: "Burn amount presets",
    burnRange: `Burn range: ${params?.min ?? 1}-${params?.max ?? 1000} GAS`,
    burnRangeError: `Enter a burn amount from ${params?.min ?? 1} to ${params?.max ?? 1000} GAS.`,
    burnReview: "Burn review checklist",
    burnServiceUnavailableTitle: "Burn league data unavailable",
    burnTokens: "Burn Tokens",
    enterAmount: "Amount to burn",
    entryAmount: "Entry amount",
    estimatedReward: "Est. Reward",
    lastSubmitted: `Last submitted burn: ${params?.amount ?? ""}`,
    leaderboard: "Leaderboard",
    liveLeague: "Live league",
    localPreview: "Data pending",
    noEntries: "Submitted burns will appear here with rank and burned GAS.",
    noEntriesTitle: "No leaderboard entries yet",
    outOf: `of ${params?.total ?? 0} players`,
    projectedTotal: "Projected total",
    projectedRank: "Projected rank",
    projectedRankHint: "Estimated from the visible leaderboard preview.",
    resetBurn: "Reset",
    rewardModel: "Reward model",
    rewardModelHint: "Preview uses the league's current 10% reward estimate.",
    rewardPool: "Reward Pool",
    reviewAmount: "Confirm amount",
    reviewLeaderboard: "Review rank impact",
    reviewWallet: "Sign wallet intent",
    seasonStatus: "Season status",
    seasonStatusHint: "Stats refresh when the league service is available.",
    subtitle: "Burn tokens, earn rewards",
    title: "Burn League",
    totalBurned: "Total Burned",
    yourBurns: "Your Burns",
    yourRank: "Your Rank",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return {
    actionNotice: createObservable(""),
    burnAmount: createObservable("1"),
    burnCount: createObservable(0),
    burnValidationError: createObservable(null),
    estimatedReward: createObservable("0.10 GAS"),
    formattedRank: createObservable("--"),
    isBurning: createObservable(false),
    isLoading: createObservable(false),
    lastSubmittedAmount: createObservable(""),
    leaderboard: createObservable([]),
    leaderboardPreview: createObservable([]),
    leaderboardSize: createObservable(0),
    leagueDataAvailable: createObservable(false),
    projectedTotalBurnedDisplay: createObservable("1.00 GAS"),
    rank: createObservable(0),
    rewardPool: createObservable(0),
    rewardPoolDisplay: createObservable("0.00 GAS"),
    serviceNotice: createObservable(""),
    totalBurned: createObservable(0),
    totalBurnedDisplay: createObservable("0.00 GAS"),
    userBurned: createObservable(0),
    userBurnedDisplay: createObservable("0.00 GAS"),
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [
        key,
        createObservable(value),
      ]),
    ),
  };
}

describe("Burn League PlayArea", () => {
  it("shows professional service copy and a complete burn preview", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          serviceNotice:
            "Live burn stats are not available in this environment yet.",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Live burn stats are not available",
    );
    expect(screen.queryByText(/OS service error|os-game-status|Not Found/i)).toBeNull();
    expect(screen.getByText("Entry amount")).toBeTruthy();
    expect(screen.getByText("Projected total")).toBeTruthy();
    expect(screen.getAllByText("Projected rank").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirm amount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Burn Now" })).toBeTruthy();
  });

  it("lets users choose a preset amount before submitting", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));

    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "5");
    expect(
      (screen.getByLabelText("Amount") as HTMLInputElement).value,
    ).toBe("5");
    expect(screen.getByRole("button", { name: "5 GAS" }).className).toContain(
      "is-active",
    );
  });

  it("resets the burn amount to the minimum safe entry", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state({ burnAmount: "25" })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "1");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
      "1",
    );
  });

  it("blocks out-of-range burns before wallet intent submission", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1001" },
    });

    expect(screen.getByText("Enter a burn amount from 1 to 1000 GAS.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Burn Now" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("renders leaderboard entries with rank, address, and burned GAS", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          leaderboardPreview: [
            { rank: 1, address: "NMockBurner111111111111111111111111", burned: 12 },
          ],
          leaderboardSize: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("12 GAS")).toBeTruthy();
    expect(screen.queryByText("No leaderboard entries yet")).toBeNull();
  });
});
