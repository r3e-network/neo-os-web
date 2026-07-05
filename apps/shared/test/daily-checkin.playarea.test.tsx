import React from "react";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../daily-checkin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params: Record<string, string | number> = {}) {
  const messages: Record<string, string> = {
    bestStreak: "Best",
    checkInNow: "Check In Now",
    checkInReady: "Ready",
    claimRewards: "Claim Rewards",
    currentStreak: "Current Streak",
    dayCompleted: "Completed",
    dayPending: "Pending",
    dayPrefix: "D",
    days: "Days",
    daysToReward: "{days} days to reward",
    highestStreak: "Highest Streak",
    milestoneReached: "Milestone reached",
    milestones: "Milestones",
    nextReward: "Next reward",
    notCheckedIn: "Not checked in today",
    recentCheckins: "Recent Check-ins",
    refreshStatus: "Refresh Status",
    rewardPlanEmpty: "Nothing to claim",
    rewardPlanEmptyCopy: "Claim activates after a milestone reward is recorded.",
    rewardPlanReady: "Rewards claimable",
    rewardPlanReadyCopy: "{amount} is available through the claim wallet action.",
    rewardPool: "Reward pool",
    statusReady: "Complete your daily check-in now!",
    streakStageCopy: "Today advances the chain-recorded path.",
    streakStageEyebrow: "Streak plaza",
    streakStageProgress: "Path progress",
    streakStageTitle: "Complete the seven-day path.",
    todayPlanReady: "Check-in available",
    totalClaimed: "Total Claimed",
    unclaimed: "Unclaimed",
    waitForNext: "Wait for Next",
    workflowCheckingIn: "Submitting check-in",
    workflowClaiming: "Claiming rewards",
    yourRewards: "Your Rewards",
    yourStats: "Your Stats",
  };
  let text = messages[key] ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    canCheckIn: false,
    checkinHistory: [],
    currentStreak: "0 Days",
    currentStreakRaw: 0,
    highestStreak: "0 Days",
    isCheckingIn: false,
    isClaiming: false,
    isPaused: false,
    rewardPoolBalance: "0 GAS",
    rewardsUnderfunded: false,
    totalClaimed: "0 GAS",
    unclaimedRewards: "0 GAS",
    ...o,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, createObservable(value)]),
  );
}

function appFile(app: string, ...segments: string[]): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, app, ...segments);
}

function playAreaStyles(app: string): string {
  return readFileSync(appFile(app, "src/PlayArea.scss"), "utf8");
}

function playAreaSource(app: string): string {
  return readFileSync(appFile(app, "src/PlayArea.tsx"), "utf8");
}

describe("daily-checkin PlayArea (v2)", () => {
  it("renders an asset-led seven-day reward board instead of a flat card grid", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ currentStreakRaw: 3, currentStreak: "3 Days" })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".dci-reward-board")).toBeTruthy();
    expect(container.querySelector(".dci-streak-card")).toBeTruthy();
    expect(container.querySelector(".dci-plaza-art")).toBeTruthy();
    expect(container.querySelector(".dci-plaza-art img")?.getAttribute("src")).toBe("streak-plaza.webp");
    expect(container.querySelector(".dci-plaza-art figcaption")).toBeTruthy();
    expect(container.querySelector(".dci-plaza-art__meter")).toBeTruthy();
    expect(container.querySelector(".dci-streak-card__summary")).toBeTruthy();
    expect(container.querySelectorAll(".dci-day-node")).toHaveLength(7);
    expect(container.querySelectorAll(".dci-day-node--complete")).toHaveLength(3);
    expect(container.querySelector(".dci-side-panel")).toBeNull();
    expect(container.querySelector(".dci-focus-card")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".dci-chest-card")).toBeNull();
    expect(container.querySelector(".dci-scene__backdrop")).toBeNull();
  });

  it("uses check-in as the primary action when today is available", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ canCheckIn: true })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Check In Now/ }));

    expect(dispatch).toHaveBeenCalledWith("doCheckIn");
  });

  it("uses claim as the primary action only when rewards are claimable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({ canCheckIn: false, unclaimedRewards: "0.01 GAS" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Claim Rewards/ }));

    expect(dispatch).toHaveBeenCalledWith("claimRewards");
  });

  it("keeps the scene foreground-led, clean, and motion-accessible", () => {
    const styles = playAreaStyles("daily-checkin");
    const source = playAreaSource("daily-checkin");
    const streakAsset = appFile("daily-checkin", "public/streak-plaza.webp");

    expect(existsSync(streakAsset)).toBe(true);
    expect(statSync(streakAsset).size).toBeGreaterThan(50_000);
    expect(source).toContain('const STREAK_IMAGE = "streak-plaza.webp";');
    expect(source).toContain('className="dci-plaza-art"');
    expect(source).not.toContain("checkin-scene-art.webp");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/\.daily-checkin-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.dci-reward-board\s*\{[\s\S]*max-width:\s*880px/);
    expect(styles).toMatch(/\.dci-reward-board\s*\{[\s\S]*background:\s*#fffdf8/);
    expect(styles).toMatch(/\.dci-reward-board\s*\{[\s\S]*box-shadow:\s*0 1px 3px/);
    expect(styles).toMatch(/\.dci-reward-board\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.dci-streak-card__summary\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.dci-plaza-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.dci-plaza-art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.dci-plaza-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.dci-plaza-art figcaption\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.dci-plaza-art__meter span\s*\{[\s\S]*transition:\s*width 220ms/);
    expect(styles).toMatch(/\.dci-path::before\s*\{[\s\S]*background:\s*rgba\(217,\s*119,\s*6,\s*0\.18\)/);
    expect(styles).toMatch(/\.dci-day-node\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.dci-day-node--complete\s*\{[\s\S]*color:\s*#0f766e/);
    expect(styles).toMatch(/\.dci-day-node--active\s*\{[\s\S]*color:\s*#92400e/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.daily-checkin-play-area \.mx2-action-rail\s*\{[\s\S]*padding:\s*0 14px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.daily-checkin-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.daily-checkin-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*width:\s*100%/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dci-plaza-art img\s*\{[\s\S]*height:\s*250px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dci-path\s*\{[\s\S]*grid-auto-columns:\s*66px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dci-path\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dci-day-node\s*\{[\s\S]*scroll-snap-align:\s*start/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*\.dci-day-node small\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.daily-checkin-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*max-width:\s*168px/);
    expect(styles).not.toMatch(/\.dci-chest-card/);
    expect(styles).toMatch(/\.dci-streak-card__badge\s*\{[\s\S]*background:\s*#ffffff/);
    expect(source).not.toMatch(/dci-side-panel|dci-focus-card|dci-reward-card/);
    expect(styles).not.toMatch(/dci-side-panel|dci-focus-card|dci-reward-card|mx2-score/);
    expect(styles).not.toMatch(/__backdrop/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/tool-scene/);
  });
});
