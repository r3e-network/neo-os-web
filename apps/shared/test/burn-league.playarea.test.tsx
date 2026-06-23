import fs from "node:fs";
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
    arenaConsoleLabel: "Arena burn console",
    burn: "Burn Now",
    burnActionHint:
      "Burning deposits GAS to the on-chain pool, then records your season total.",
    burnBlockedSettle: "Burning is paused until the ended season is settled.",
    burnPresets: "Burn amount presets",
    burnRange: `Burn range: ${params?.min ?? 1}-${params?.max ?? 1000} GAS`,
    burnRangeError: `Enter a burn amount from ${params?.min ?? 1} to ${params?.max ?? 1000} GAS.`,
    burnReview: "Burn review checklist",
    burnServiceUnavailableTitle: "Burn league data unavailable",
    burnTokens: "Burn Tokens",
    chooseFuel: "Choose fuel",
    currentLeader: "Current leader",
    decreaseBurn: "Decrease burn amount",
    enterAmount: "Amount to burn",
    entryAmount: "Entry amount",
    fuelConsole: "Fuel console",
    fuelMeter: "Burn fuel meter",
    increaseBurn: "Increase burn amount",
    leaderboard: "Leaderboard",
    liveLeague: "Live league",
    localPreview: "Data pending",
    lastSubmitted: `Last submitted burn: ${params?.amount ?? ""}`,
    noEntries:
      "Burns appear here with rank and burned GAS as soon as they confirm on chain.",
    noEntriesTitle: "No leaderboard entries yet",
    noLeaderYet: "No burns yet",
    outOf: `of ${params?.total ?? 0} players`,
    prizePool: "Prize pool",
    projectedTotal: "Projected total",
    projectedRank: "Projected rank",
    readyToBurn: "Fuel loaded",
    resetBurn: "Reset",
    rewardPool: "Reward Pool",
    reviewAmount: "Confirm amount",
    reviewLeaderboard: "Review rank impact",
    reviewWallet: "Sign wallet intent",
    seasonActive: "Live now",
    seasonDormant: "Not started",
    seasonDormantHint:
      "No active season yet — the first burn starts a fresh season.",
    seasonEnded: "Ended — awaiting settle",
    seasonEndedHint: `The season has ended. Settle to award the ${params?.amount ?? ""} pool to the top burner.`,
    seasonEndsIn: "Ends in",
    seasonLabel: "Season",
    seasonStatus: "Season status",
    scoreboardEyebrow: "Next burn",
    settleSeason: "Settle season",
    subtitle: "Burn tokens, earn rewards",
    title: "Burn League",
    totalBurned: "Total Burned",
    yourBurns: "Your Burns",
    yourRank: "Your Rank",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  return {
    actionNotice: createObservable(""),
    burnAmount: createObservable("1"),
    burnCount: createObservable(0),
    burnValidationError: createObservable(null),
    countdown: createObservable("00:01:30"),
    formattedRank: createObservable("--"),
    formattedSeason: createObservable("#1"),
    isBurning: createObservable(false),
    isLoading: createObservable(false),
    isSettling: createObservable(false),
    lastSubmittedAmount: createObservable(""),
    leaderboard: createObservable([]),
    leaderboardPreview: createObservable([]),
    leaderboardSize: createObservable(0),
    leaderLabel: createObservable("--"),
    leagueDataAvailable: createObservable(false),
    needsSettle: createObservable(false),
    prizePoolDisplay: createObservable("0.00 GAS"),
    projectedTotalBurnedDisplay: createObservable("1.00 GAS"),
    rank: createObservable(0),
    rewardPool: createObservable(0),
    rewardPoolDisplay: createObservable("0.00 GAS"),
    seasonPhase: createObservable("active"),
    seasonStatusLabel: createObservable("Live now"),
    serviceNotice: createObservable(""),
    topBurnedDisplay: createObservable("0.00 GAS"),
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
  it("shows professional service copy and a burn preview with the whole-pool prize", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          serviceNotice:
            "Live burn stats could not be read from the chain right now.",
          prizePoolDisplay: "15.00 GAS",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("status")[0]).toBeTruthy();
    // The service notice was slimmed to a one-line title (the long body
    // sentence was dropped in the polish pass); assert the retained title.
    expect(screen.getByText(/Burn league data unavailable/)).toBeTruthy();
    expect(
      screen.queryByText(/OS service error|os-game-status|Not Found/i),
    ).toBeNull();
    expect(screen.getByText("Entry amount")).toBeTruthy();
    expect(screen.getByText("Projected total")).toBeTruthy();
    expect(screen.getAllByText("Projected rank").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirm amount")).toBeTruthy();
    // The prize model is the WHOLE pool, surfaced in the impact strip — no 0.1x.
    expect(screen.getAllByText("Prize pool").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15.00 GAS").length).toBeGreaterThan(0);
    expect(screen.queryByText("Est. Reward")).toBeNull();
    expect(screen.getByRole("button", { name: "Burn Now" })).toBeTruthy();
  });

  it("renders an active-season countdown banner with pool and leader", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          seasonPhase: "active",
          seasonStatusLabel: "Live now",
          countdown: "00:01:30",
          prizePoolDisplay: "8.00 GAS",
          leaderLabel: "NTop12...9zEs",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("Live now")).toBeTruthy();
    expect(screen.getByText("Ends in")).toBeTruthy();
    expect(screen.getByText("00:01:30")).toBeTruthy();
    expect(screen.getByText("NTop12...9zEs")).toBeTruthy();
    // No settle affordance while the season is live.
    expect(screen.queryByRole("button", { name: "Settle season" })).toBeNull();
  });

  it("surfaces the settle affordance and dispatches settle when a season has ended", () => {
    const dispatch = vi.fn();
    render(
      <PlayArea
        t={t}
        state={state({
          seasonPhase: "ended",
          needsSettle: true,
          seasonStatusLabel: "Ended — awaiting settle",
          prizePoolDisplay: "12.00 GAS",
        })}
        dispatch={dispatch}
      />,
    );

    const settleBtn = screen.getByRole("button", { name: "Settle season" });
    expect(settleBtn).toBeTruthy();
    fireEvent.click(settleBtn);
    expect(dispatch).toHaveBeenCalledWith("settle");

    // Burning is blocked until the ended season is settled.
    expect(
      (screen.getByRole("button", { name: "Burn Now" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("explains a dormant season needs a first burn", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          seasonPhase: "dormant",
          seasonStatusLabel: "Not started",
          formattedSeason: "--",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Not started").length).toBeGreaterThan(1);
    expect(screen.getByText(/No active season yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Settle season" })).toBeNull();
  });

  it("lets users choose a preset amount before submitting", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));

    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "5");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
      "5",
    );
    expect(screen.getByRole("button", { name: "5 GAS" }).className).toContain(
      "is-active",
    );
    expect(document.querySelector(".burn-league-ember-burst--active")).toBeTruthy();
    expect(document.querySelectorAll(".burn-league-ember-burst__spark")).toHaveLength(8);
  });

  it("keeps the arena amount controls wired to the burn amount", () => {
    const dispatch = vi.fn();
    render(
      <PlayArea t={t} state={state({ burnAmount: "5" })} dispatch={dispatch} />,
    );

    expect(screen.getByLabelText("Arena burn console")).toBeTruthy();
    expect(document.querySelector(".burn-league-fuel-chamber")).toBeTruthy();
    expect(document.querySelector(".burn-league-burn-trail")).toBeTruthy();
    expect(document.querySelectorAll(".burn-league-burn-trail__flame").length).toBe(5);
    expect(screen.getByText("Next burn")).toBeTruthy();
    expect(screen.getByText("Fuel loaded")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Increase burn amount" }),
    );
    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "6");

    fireEvent.click(
      screen.getByRole("button", { name: "Decrease burn amount" }),
    );
    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "5");
  });

  it("resets the burn amount to the minimum safe entry", () => {
    const dispatch = vi.fn();
    render(
      <PlayArea
        t={t}
        state={state({ burnAmount: "25" })}
        dispatch={dispatch}
      />,
    );

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

    expect(
      screen.getByText("Enter a burn amount from 1 to 1000 GAS."),
    ).toBeTruthy();
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
            {
              rank: 1,
              address: "NMockBurner111111111111111111111111",
              burned: 12,
            },
          ],
          leaderboardSize: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("#1")).toBeTruthy();
    // The burned amount is now rendered with consistent 2-decimal GAS
    // formatting (formatNumber(burned, 2) + " GAS"), and the value + unit are
    // split across text nodes inside the <strong>, so match on the element's
    // normalized text content.
    expect(
      screen.getByText((_, element) => {
        if (!element || element.tagName !== "STRONG") return false;
        return element.textContent?.replace(/\s+/g, " ").trim() === "12.00 GAS";
      }),
    ).toBeTruthy();
    expect(screen.queryByText("No leaderboard entries yet")).toBeNull();
  });

  it("exposes live arena motion states with reduced-motion fallbacks", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isBurning: true,
          userIsLeader: true,
          burnAmount: "10",
        })}
        dispatch={vi.fn()}
      />,
    );

    const rootClass = container.querySelector(
      ".burn-league-play-area",
    )?.className;
    expect(rootClass).toContain("burn-league-play-area--live");
    expect(rootClass).toContain("burn-league-play-area--armed");
    expect(rootClass).toContain("burn-league-play-area--burning");
    expect(rootClass).toContain("burn-league-play-area--leader");

    const styles = fs.readFileSync(
      `${process.cwd()}/../burn-league/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes burn-league-arena-drift");
    expect(styles).toContain("@keyframes burn-league-stage-heat");
    expect(styles).toContain("@keyframes burn-league-ember-burst-flight");
    expect(styles).toContain("@keyframes burn-league-fuel-flow");
    expect(styles).toContain("@keyframes burn-league-trail-flame");
    expect(styles).toContain("@keyframes burn-league-trail-launch");
    expect(styles).toContain("@keyframes burn-league-chamber-scan");
    expect(styles).toContain("@keyframes burn-league-chamber-burn");
    expect(styles).toContain("@keyframes burn-league-scoreboard-ready");
    expect(styles).toContain("@keyframes burn-league-cta-ready");
    expect(styles).toContain("@keyframes burn-league-row-in");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.burn-league-play-area--burning \.burn-league-stake-stage[\s\S]*animation:\s*burn-league-stage-burn/,
    );
    expect(styles).toMatch(
      /\.burn-league-play-area--armed \.burn-league-fuel-meter__fill[\s\S]*animation:\s*burn-league-fuel-flow/,
    );
    expect(styles).toMatch(
      /\.burn-league-play-area--armed \.burn-league-burn-trail__flame[\s\S]*animation:\s*burn-league-trail-flame/,
    );
    expect(styles).toMatch(
      /\.burn-league-play-area--armed \.burn-league-fuel-chamber::after[\s\S]*animation:\s*burn-league-chamber-scan/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.burn-league-burn-cta \.neo-btn--primary[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.burn-league-burn-trail__flame[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.burn-league-ember-burst__spark[\s\S]*animation:\s*none/,
    );
  });
});
