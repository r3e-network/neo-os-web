/**
 * R4 — Daily Challenge + Sign-in Streak (commitment device / loss aversion).
 *
 * Pure, render-free logic so it can be unit-tested without React/Three/storage.
 * Persistence lives behind `gameStorage` (sandbox-safe, same as progress/theme);
 * the daily record is intentionally kept OUT of `GooseProgress` (v3) so it never
 * disturbs that file's strict migration guards.
 *
 * Design pillars this serves: **long-term reason to return** (GDD §4). The
 * streak is a Cialdini commitment device — claiming yesterday's reward makes
 * today's claim feel "owed" — and a missed day resets it, which is the
 * loss-aversion hook. The daily bonus is a *per-day perk* (bounded by streak),
 * NOT a snowballing savings account: it is recomputed from the current streak
 * on each claim and overwritten, so it can never grow without bound.
 */

import { gameStorage } from "./game-storage";
import type { PowerupCounts } from "./guest-engine";

export const DAILY_STORAGE_KEY = "zhuada-e:daily";

export interface DailyState {
  v: 1;
  /** Local YYYY-MM-DD of the last claim; "" means never claimed. */
  lastClaimDate: string;
  /** Consecutive claim days (resets to 1 after any gap > 1 day). */
  streak: number;
  /** Best streak ever reached (drives the persistent badge tier). */
  bestStreak: number;
  /** Count of 7-day milestones reached — hooks a future cosmetic reward. */
  milestones: number;
  /** Today's granted bonus, added on top of the base per-run powerup grant. */
  dailyBonus: PowerupCounts;
}

export const EMPTY_DAILY: DailyState = {
  v: 1,
  lastClaimDate: "",
  streak: 0,
  bestStreak: 0,
  milestones: 0,
  dailyBonus: { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 },
};

// ── Tuning constants ([ACCEPTED-SIM] — daily economy solvency validated by balance-frenzy.mjs §3; values match GDD §9.1 Proposed defaults. Human feel-test still recommended.) ──
// These are hypotheses, not settled values. The daily bonus must feel like a
// welcome gift, not a balance-breaking drip; the cap exists precisely so a long
// streak can't turn powerups into a trivialized resource.
const DAILY_BASE: PowerupCounts = { shuffle: 1, hint: 1, remove: 1, undo: 1, addTime: 0 };
/** +1 of each powerup for every 2 streak days (day 1 = +0, day 3 = +1, …). */
const DAILY_STREAK_BONUS_PER_2 = 1;
/** Hard ceiling on the streak-scaled portion of the bonus. */
const DAILY_STREAK_BONUS_CAP = 5;
/** Extra powerups granted on every 7th-day milestone (the "限定" reward). */
const DAILY_MILESTONE_BONUS = 3;
/** Milestone cadence in days. */
const DAILY_MILESTONE_EVERY = 7;
/** Fixed level used for the date-seeded daily challenge. */
export const DAILY_CHALLENGE_LEVEL = 6;

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Local-time YYYY-MM-DD for `now` (defaults to Date.now()). */
export function todayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Previous local day as YYYY-MM-DD (for gap detection). */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1, d! - 1);
  return todayKey(date.getTime());
}

/** Whole-day difference between two YYYY-MM-DD keys (b - a); negative if a > b. */
export function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay!, am! - 1, ad!);
  const db = Date.UTC(by!, bm! - 1, bd!);
  return Math.round((db - da) / 86_400_000);
}

/**
 * Deterministic seed from a date key so every client playing on the same day
 * (and same build) gets the same daily-challenge layout. This is a SOFT
 * guarantee: without a server, we cannot prevent a modified client from
 * computing a different layout — but for a casual local game the date alone is
 * the shared anchor, exactly as the GDD's "everyone same layout" intends.
 */
export function dateSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ── Pure computation ──────────────────────────────────────────────────────────

function addPowerups(a: PowerupCounts, b: PowerupCounts): PowerupCounts {
  return {
    shuffle: a.shuffle + b.shuffle,
    hint: a.hint + b.hint,
    remove: a.remove + b.remove,
    undo: a.undo + b.undo,
    addTime: a.addTime + b.addTime,
  };
}

function streakBonus(streak: number): PowerupCounts {
  const per = Math.min(
    DAILY_STREAK_BONUS_CAP,
    Math.floor((streak - 1) / 2) * DAILY_STREAK_BONUS_PER_2,
  );
  return { shuffle: per, hint: per, remove: per, undo: per, addTime: per };
}

function milestoneBonus(): PowerupCounts {
  return {
    shuffle: DAILY_MILESTONE_BONUS,
    hint: DAILY_MILESTONE_BONUS,
    remove: DAILY_MILESTONE_BONUS,
    undo: DAILY_MILESTONE_BONUS,
    addTime: DAILY_MILESTONE_BONUS,
  };
}

export interface DailyView {
  /** True when today has not yet been claimed — the claim card should show. */
  claimable: boolean;
  /** Current streak (as it stands for today, claimed or not). */
  streak: number;
  /** True when claiming today would land on a 7-day milestone. */
  milestone: boolean;
  /** Powerups the player would get (or already got) for today. */
  grants: PowerupCounts;
}

/**
 * Compute the daily view WITHOUT mutating state. When already claimed today,
 * `claimable` is false and `grants` mirrors the stored `dailyBonus`; otherwise
 * it previews what a claim right now would grant.
 */
export function computeDailyView(state: DailyState, now: number = Date.now()): DailyView {
  const today = todayKey(now);
  if (state.lastClaimDate === today) {
    return {
      claimable: false,
      streak: state.streak,
      milestone: state.streak % DAILY_MILESTONE_EVERY === 0,
      grants: { ...state.dailyBonus },
    };
  }
  const gap = state.lastClaimDate === "" ? 1 : dayDiff(state.lastClaimDate, today);
  const nextStreak = gap === 1 ? state.streak + 1 : 1;
  const milestone = nextStreak % DAILY_MILESTONE_EVERY === 0;
  const grants = addPowerups(
    addPowerups(DAILY_BASE, streakBonus(nextStreak)),
    milestone ? milestoneBonus() : EMPTY_DAILY.dailyBonus,
  );
  return { claimable: true, streak: nextStreak, milestone, grants };
}

export interface ClaimResult {
  next: DailyState;
  grants: PowerupCounts;
  streak: number;
  milestone: boolean;
}

/** Pure transition: produce the next DailyState for a claim at `now`. */
export function claimDailyReward(state: DailyState, now: number = Date.now()): ClaimResult {
  const view = computeDailyView(state, now);
  if (!view.claimable) {
    // Idempotent: claiming an already-claimed day is a no-op (no double grant).
    return { next: { ...state }, grants: { ...state.dailyBonus }, streak: state.streak, milestone: false };
  }
  const next: DailyState = {
    v: 1,
    lastClaimDate: todayKey(now),
    streak: view.streak,
    bestStreak: Math.max(state.bestStreak, view.streak),
    milestones: state.milestones + (view.milestone ? 1 : 0),
    dailyBonus: { ...view.grants },
  };
  return { next, grants: { ...view.grants }, streak: view.streak, milestone: view.milestone };
}

// ── Storage (sandbox-safe via gameStorage) ─────────────────────────────────────

function isPowerupCounts(value: unknown): value is PowerupCounts {
  if (value === null || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.shuffle === "number" &&
    typeof p.hint === "number" &&
    typeof p.remove === "number" &&
    typeof p.undo === "number" &&
    typeof p.addTime === "number"
  );
}

function normalizeState(value: unknown): DailyState {
  if (value === null || typeof value !== "object") return { ...EMPTY_DAILY };
  const s = value as Record<string, unknown>;
  const bonus = isPowerupCounts(s.dailyBonus) ? (s.dailyBonus as PowerupCounts) : EMPTY_DAILY.dailyBonus;
  const num = (v: unknown, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  return {
    v: 1,
    lastClaimDate: typeof s.lastClaimDate === "string" ? s.lastClaimDate : "",
    streak: num(s.streak, 0),
    bestStreak: num(s.bestStreak, 0),
    milestones: num(s.milestones, 0),
    dailyBonus: { ...bonus },
  };
}

export function loadDailyState(storage = gameStorage): DailyState {
  try {
    const raw = storage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DAILY };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_DAILY };
  }
}

export function saveDailyState(state: DailyState, storage = gameStorage): void {
  try {
    storage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* best-effort — daily rewards are a convenience, never block on storage */
  }
}
