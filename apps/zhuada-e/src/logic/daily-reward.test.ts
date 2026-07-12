import { describe, expect, it } from "vitest";
import {
  claimDailyReward,
  computeDailyView,
  dateSeed,
  dayDiff,
  EMPTY_DAILY,
  loadDailyState,
  prevDayKey,
  saveDailyState,
  todayKey,
  type DailyState,
} from "./daily-reward";

function day(n: number): string {
  // Build a YYYY-MM-DD key n days after a fixed anchor (2026-01-01).
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  return todayKey(d.getTime());
}

function withStreak(streak: number, lastClaimDay: number): DailyState {
  return {
    v: 1,
    lastClaimDate: day(lastClaimDay),
    streak,
    bestStreak: streak,
    milestones: Math.floor(streak / 7),
    dailyBonus: { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 },
  };
}

describe("daily-reward: date helpers", () => {
  it("todayKey formats local YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 0, 9, 23, 0, 0).getTime())).toBe("2026-01-09");
  });

  it("dayDiff measures whole days between keys", () => {
    expect(dayDiff(day(0), day(0))).toBe(0);
    expect(dayDiff(day(0), day(6))).toBe(6);
    expect(dayDiff(day(6), day(0))).toBe(-6);
  });

  it("prevDayKey rolls back exactly one day", () => {
    expect(prevDayKey(day(5))).toBe(day(4));
  });

  it("dateSeed is deterministic and varies by day", () => {
    expect(dateSeed(day(3))).toBe(dateSeed(day(3)));
    expect(dateSeed(day(3))).not.toBe(dateSeed(day(4)));
  });
});

describe("daily-reward: computeDailyView", () => {
  it("marks not claimable and returns stored bonus on the same day", () => {
    const state = { ...withStreak(4, 10), dailyBonus: { shuffle: 1, hint: 2, remove: 1, undo: 1, addTime: 0 } };
    // Pretend "today" is day 10 (lastClaimDate === today).
    const view = computeDailyView(state, new Date(2026, 0, 11).getTime());
    // Anchor day(10) == 2026-01-11, so today matches lastClaimDate.
    expect(view.claimable).toBe(false);
    expect(view.streak).toBe(4);
    expect(view.grants).toEqual(state.dailyBonus);
  });

  it("increments streak on a consecutive day", () => {
    const state = withStreak(3, 9); // last claimed day 9
    // Today = day 10 (one day later) -> streak becomes 4.
    const now = new Date(2026, 0, 11).getTime(); // 2026-01-11 == day(10)
    const view = computeDailyView(state, now);
    expect(view.claimable).toBe(true);
    expect(view.streak).toBe(4);
  });

  it("resets streak to 1 after a gap > 1 day (loss-aversion hit)", () => {
    const state = withStreak(9, 5); // last claimed day 5
    const now = new Date(2026, 0, 13).getTime(); // day 12 -> gap 7
    const view = computeDailyView(state, now);
    expect(view.claimable).toBe(true);
    expect(view.streak).toBe(1);
  });

  it("first-ever claim starts at streak 1", () => {
    const view = computeDailyView(EMPTY_DAILY, new Date(2026, 0, 11).getTime());
    expect(view.claimable).toBe(true);
    expect(view.streak).toBe(1);
  });

  it("flags a 7-day milestone and adds the milestone bonus", () => {
    const state = withStreak(6, 9); // day 10 would be the 7th consecutive day
    const now = new Date(2026, 0, 11).getTime();
    const view = computeDailyView(state, now);
    expect(view.streak).toBe(7);
    expect(view.milestone).toBe(true);
    // base(1 each) + streakBonus(floor(6/2)=3 each) + milestone(+3 each)
    expect(view.grants).toEqual({ shuffle: 7, hint: 7, remove: 7, undo: 7, addTime: 7 });
  });

  it("scales the streak bonus with the streak (day 3 = +1 each)", () => {
    const state = withStreak(2, 9);
    const now = new Date(2026, 0, 11).getTime();
    const view = computeDailyView(state, now);
    expect(view.streak).toBe(3);
    // base(1) + streakBonus(floor(2/2)=1)
    expect(view.grants).toEqual({ shuffle: 2, hint: 2, remove: 2, undo: 2, addTime: 2 });
  });
});

describe("daily-reward: claimDailyReward", () => {
  it("advances streak, persists the bonus, and counts milestones", () => {
    const state = withStreak(6, 9);
    const now = new Date(2026, 0, 11).getTime();
    const result = claimDailyReward(state, now);
    expect(result.streak).toBe(7);
    expect(result.milestone).toBe(true);
    expect(result.next.streak).toBe(7);
    expect(result.next.bestStreak).toBe(7);
    expect(result.next.milestones).toBe(1);
    expect(result.next.lastClaimDate).toBe(day(10));
    expect(result.next.dailyBonus).toEqual(result.grants);
  });

  it("is idempotent within the same day (no double grant)", () => {
    const now = new Date(2026, 0, 11).getTime();
    const first = claimDailyReward(EMPTY_DAILY, now);
    const second = claimDailyReward(first.next, now);
    expect(second.next.streak).toBe(first.next.streak);
    expect(second.grants).toEqual(first.grants);
    expect(second.milestone).toBe(false);
  });

  it("resets streak on a gap so the bonus shrinks (loss realized)", () => {
    const state = withStreak(12, 2); // last claimed day 2
    const now = new Date(2026, 0, 13).getTime(); // day 12 -> gap 10
    const result = claimDailyReward(state, now);
    expect(result.streak).toBe(1);
    // base(1) + streakBonus(0) + no milestone
    expect(result.grants).toEqual({ shuffle: 1, hint: 1, remove: 1, undo: 1, addTime: 1 });
  });
});

describe("daily-reward: storage", () => {
  it("round-trips through save/load and tolerates corrupt data", () => {
    const memory = {
      values: new Map<string, string>(),
      getItem(k: string) { return this.values.get(k) ?? null; },
      setItem(k: string, v: string) { this.values.set(k, v); },
      removeItem(k: string) { this.values.delete(k); },
    };
    const claimed = claimDailyReward(EMPTY_DAILY, new Date(2026, 0, 11).getTime()).next;
    saveDailyState(claimed, memory);
    const loaded = loadDailyState(memory);
    expect(loaded.streak).toBe(claimed.streak);
    expect(loaded.lastClaimDate).toBe(claimed.lastClaimDate);

    memory.values.set("zhuada-e:daily", "{not json");
    expect(loadDailyState(memory)).toEqual(EMPTY_DAILY);
  });
});
