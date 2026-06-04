import { describe, expect, it, vi } from "vitest";

import { useCheckin } from "../../daily-checkin/src/composables/useCheckin";
import type { CheckinProxy } from "../services/os/CheckinProxy";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    checkinRecorded: "Check-in recorded",
    checkinUnavailable: "Already checked in for this UTC day",
    days: "Days",
    rewardClaimed: "Reward claimed",
    rewardsUnavailable: "No rewards available to claim",
    statusLoaded: "Status loaded",
    tokenGas: "GAS",
    workflowCheckingIn: "Submitting check-in",
    workflowClaiming: "Claiming rewards",
    workflowFailed: "Action failed",
    workflowReady: "Ready",
    workflowRefreshing: "Refreshing check-in status",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function setup() {
  const seededStreak = {
    currentStreak: 6,
    highestStreak: 8,
    totalCheckins: 12,
    lastCheckinTime: 0,
    unclaimedRewards: "0",
    totalClaimed: "1.5",
    totalGlobalCheckins: 100,
    totalGlobalUsers: 20,
    totalGlobalRewarded: "10",
    checkInFee: "0.001",
  };
  const checkin = {
    getStreak: vi.fn(async () => seededStreak),
    checkIn: vi.fn(async () => ({ txid: "0xcheckin", intent: "checkin" })),
    claimRewards: vi.fn(async () => ({ txid: "0xclaim", intent: "checkin_claim" })),
  } as unknown as CheckinProxy & {
    getStreak: ReturnType<typeof vi.fn>;
    checkIn: ReturnType<typeof vi.fn>;
    claimRewards: ReturnType<typeof vi.fn>;
  };

  const app = useCheckin({ checkinService: checkin, t });
  return { app, checkin, seededStreak };
}

describe("useCheckin", () => {
  it("loads streak data, normalizes GAS amounts, and records refresh evidence", async () => {
    const { app, checkin } = setup();

    await app.refreshStatus();

    expect(checkin.getStreak).toHaveBeenCalled();
    expect(app.currentStreak.get()).toBe(6);
    expect(app.checkInFee.get()).toBe(100000);
    expect(app.totalClaimed.get()).toBe(150000000);
    expect(app.totalGlobalRewarded.get()).toBe(1000000000);
    expect(app.latestResult.get()?.summary).toBe("Status loaded");
  });

  it("submits check-in, applies local milestone reward, and claims it", async () => {
    const { app, checkin } = setup();
    await app.loadAll();

    await app.doCheckIn();

    expect(checkin.checkIn).toHaveBeenCalled();
    expect(app.currentStreak.get()).toBe(7);
    expect(app.unclaimedRewards.get()).toBe(100000000);
    expect(app.checkinHistory.get()[0]).toEqual(expect.objectContaining({
      action: "checkin",
      streak: 7,
      txid: "0xcheckin",
    }));

    await app.claimRewards();

    expect(checkin.claimRewards).toHaveBeenCalled();
    expect(app.unclaimedRewards.get()).toBe(0);
    expect(app.totalClaimed.get()).toBe(250000000);
    expect(app.latestResult.get()?.summary).toBe("Reward claimed");
  });

  it("locks check-in for the current UTC day when lastCheckinTime is a ms timestamp from today", async () => {
    const { app, checkin } = setup();
    // Contract emits Runtime.Time in MILLISECONDS; edge passes it through unchanged.
    checkin.getStreak.mockResolvedValueOnce({
      currentStreak: 3,
      highestStreak: 5,
      totalCheckins: 9,
      lastCheckinTime: Date.now(),
      unclaimedRewards: "0",
      totalClaimed: "0",
      totalGlobalCheckins: 0,
      totalGlobalUsers: 0,
      totalGlobalRewarded: "0",
    });

    await app.loadAll();

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    expect(app.lastCheckInDay.get()).toBe(Math.floor(Date.now() / MS_PER_DAY));
    expect(app.canCheckIn.get()).toBe(false);
  });

  it("unlocks check-in on a fresh UTC day when lastCheckinTime is a ms timestamp from a prior day", async () => {
    const { app, checkin } = setup();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const twoDaysAgoMs = Date.now() - 2 * MS_PER_DAY;
    checkin.getStreak.mockResolvedValueOnce({
      currentStreak: 3,
      highestStreak: 5,
      totalCheckins: 9,
      lastCheckinTime: twoDaysAgoMs,
      unclaimedRewards: "0",
      totalClaimed: "0",
      totalGlobalCheckins: 0,
      totalGlobalUsers: 0,
      totalGlobalRewarded: "0",
    });

    await app.loadAll();

    expect(app.lastCheckInDay.get()).toBe(Math.floor(twoDaysAgoMs / MS_PER_DAY));
    expect(app.canCheckIn.get()).toBe(true);
  });

  it("preserves optimistic claim totals when a public status refresh returns defaults", async () => {
    const { app, checkin, seededStreak } = setup();
    const publicDefaults = {
      currentStreak: 0,
      highestStreak: 0,
      totalCheckins: 0,
      lastCheckinTime: 0,
      unclaimedRewards: "0",
      totalClaimed: "0",
      totalGlobalCheckins: 0,
      totalGlobalUsers: 0,
      totalGlobalRewarded: "0",
    };
    checkin.getStreak
      .mockResolvedValueOnce(seededStreak)
      .mockResolvedValueOnce(publicDefaults)
      .mockResolvedValueOnce(publicDefaults);

    await app.loadAll();
    await app.doCheckIn();
    await app.claimRewards();

    expect(app.currentStreak.get()).toBe(7);
    expect(app.highestStreak.get()).toBe(8);
    expect(app.canCheckIn.get()).toBe(false);
    expect(app.totalClaimed.get()).toBe(250000000);
    expect(app.totalGlobalRewarded.get()).toBe(1100000000);
    expect(app.checkinHistory.get()[0]).toEqual(expect.objectContaining({
      action: "claim",
      streak: 7,
      txid: "0xclaim",
    }));
  });
});
