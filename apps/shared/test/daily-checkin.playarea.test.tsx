import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../daily-checkin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    almostGone: "Almost gone",
    bestStreak: "Best",
    checkInFee: "Check-in fee",
    checkInNow: "Check In Now",
    checkInReady: "Ready",
    checkClaimable: "Claimable balance",
    checkComplete: "Complete",
    checkFeeVisible: "Fee visible",
    checkReady: "Open",
    checkUtcWindow: "UTC window",
    checkedInToday: "Checked in today",
    checkinChecklist: "Check-in checklist",
    claimRewards: "Claim Rewards",
    claimPlan: "Claim plan",
    countdownDefault: "Countdown",
    currentStreak: "Current Streak",
    dailyWindow: "Daily window",
    day: "Day",
    dayCompleted: "Completed",
    dayPending: "Pending",
    dayPrefix: "D",
    days: "Days",
    daysToReward: "{days} days to reward",
    dayStreak: "Day Streak",
    docSubtitle: "Earn GAS by checking in daily",
    evidence: "Request and result evidence",
    globalStats: "Global Stats",
    highestStreak: "Highest Streak",
    hurryUp: "Hurry up",
    latestRequest: "Latest Request",
    latestResult: "Latest Result",
    loading: "Loading...",
    milestoneReached: "Milestone reached",
    milestoneImpact: "Milestone impact",
    milestoneImpactPending: "{days} more UTC days until the next milestone payout.",
    milestoneImpactReady: "This check-in reaches the day {day} reward.",
    milestoneDonePending: "{days} more UTC days until the next milestone payout after today's check-in.",
    milestones: "Milestones",
    milestoneSecured: "Day {day} secured",
    milestoneSecuredCopy: "This UTC day is recorded. {days} more UTC days until the next milestone payout.",
    noImmediateReward: "No instant GAS",
    nextCheckin: "Next Check-in",
    nextReward: "Next reward",
    noCheckins: "No check-ins yet",
    plentyOfTime: "Plenty of time",
    recentCheckins: "Recent Check-ins",
    refreshStatus: "Refresh Status",
    requestEmpty: "No action submitted yet",
    resultEmpty: "Response appears here",
    rewardPlanEmpty: "Nothing to claim",
    rewardPlanEmptyCopy: "Claim activates after a milestone reward is recorded.",
    rewardPlanReady: "Rewards claimable",
    rewardPlanReadyCopy: "{amount} is available through the claim wallet action.",
    rewardProgress: "Reward Progress",
    serviceRoute: "Service route",
    serviceRouteCopy: "Check-in deposits the GAS fee to the on-chain contract; rewards claim directly from it.",
    title: "Daily Check-in",
    todayPlan: "Today plan",
    todayPlanDone: "Secured today",
    todayPlanDoneCopy: "Your streak is already protected until the next UTC reset.",
    todayPlanReady: "Check-in available",
    todayPlanReadyCopy: "Submitting now records day {streak} for the current UTC cycle.",
    todayPlanSubtitle: "Review the UTC window, reward impact, and wallet route before acting.",
    tokenGas: "GAS",
    total: "total",
    totalCheckins: "Total Check-ins",
    totalClaimed: "Total Claimed",
    totalRewarded: "Total Rewarded",
    totalUsers: "Total Users",
    unclaimed: "Unclaimed",
    utcLabel: "UTC",
    waitForNext: "Wait for Next",
    workflowReady: "Ready",
    yourRewards: "Your Rewards",
    yourStats: "Your Stats",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    currentStreak: "6 Days",
    highestStreak: "8 Days",
    currentStreakRaw: 6,
    highestStreakRaw: 8,
    totalUserCheckins: 12,
    unclaimedRewards: 100000000,
    totalClaimed: 150000000,
    checkInFee: 100000,
    totalGlobalCheckins: 100,
    totalGlobalUsers: 20,
    totalGlobalRewarded: 1000000000,
    canCheckIn: true,
    hasLoadedStatus: true,
    isLoading: false,
    isClaiming: false,
    workflowStatus: "Ready",
    lastError: "",
    utcTimeDisplay: "11:15:36",
    nextUtcMidnight: Date.now() + 3600_000,
    checkinHistory: [
      {
        action: "checkin",
        streak: 6,
        time: "2026-06-01T00:00:00.000Z",
        reward: 0,
        txid: "0xhistory",
      },
    ],
    latestRequest: { action: "refreshStatus" },
    latestResult: { action: "refreshStatus", status: "success" },
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Daily Check-in PlayArea", () => {
  it("renders the full check-in, reward, history, and evidence workflow", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    expect(screen.getAllByText("6 Day Streak").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Check In Now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh Status" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Today plan" })).toBeTruthy();
    expect(screen.getByText("Check-in available")).toBeTruthy();
    expect(screen.getAllByText("+1 GAS").length).toBeGreaterThan(0);
    expect(screen.getByText("Rewards claimable")).toBeTruthy();
    expect(screen.getByText("Check-in deposits the GAS fee to the on-chain contract; rewards claim directly from it.")).toBeTruthy();
    expect(screen.getByText("Your Rewards")).toBeTruthy();
    expect(screen.getByText("Recent Check-ins")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Request and result evidence" })).toBeTruthy();
  });

  it("dispatches all visible business actions", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Check In Now" }));
    expect(dispatch).toHaveBeenCalledWith("doCheckIn");

    fireEvent.click(screen.getByRole("button", { name: "Claim Rewards" }));
    expect(dispatch).toHaveBeenCalledWith("claimRewards");

    fireEvent.click(screen.getByRole("button", { name: "Refresh Status" }));
    expect(dispatch).toHaveBeenCalledWith("refreshStatus");
  });

  it("uses the wait state as the check-in button accessible name", () => {
    render(<PlayArea t={t} state={state({ canCheckIn: false })} dispatch={vi.fn(async () => undefined)} />);

    expect((screen.getByRole("button", { name: "Wait for Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
