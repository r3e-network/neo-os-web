/**
 * framework/game/guest-kit — the shared guest-engine scaffold (RFC P1-1).
 *
 * 20 reward games ship a near-identical `src/logic/guest-engine.ts`; the
 * census (B2) found the SCAFFOLD portion redeclared per app: the structural
 * `Obs` / `GuestLeaderboardApi` aliases, the Web-Crypto rejection-sampling
 * RNG, the `guestLeaderboard.get(50)` → ranked-rows mapping,
 * `clampDifficulty`, and the try/catch local-storage persistence guards.
 * This module owns that scaffold once; per-game RULES (dealing, scoring,
 * session-restore validation) stay local.
 *
 * Everything here fails CLOSED for randomness (no `Math.random` fallback)
 * and OPEN for storage/leaderboard I/O (private browsing, a full quota, or
 * an unreachable off-chain board must never break a free run) — the exact
 * semantics the hand-rolled engines already implement.
 *
 * Migration: delete the scaffold sections of a guest-engine.ts and import
 * from here; the per-app guest-engine tests are the harness (game-logic
 * diff must be empty).
 */

import type { LeaderEntry } from "./types";
import type { FrameworkModeSurface } from "../types";

// ─── Structural aliases ─────────────────────────────────────────────────────

/** The structural observable shape guest engines annotate their locals with. */
export type { Observable as Obs } from "../reactive";

/** Off-chain guest leaderboard API (the alias guest engines redeclare). */
export type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "../types";

// ─── Difficulty clamp ───────────────────────────────────────────────────────

/**
 * Fleet-standard difficulty clamp: the nearest integer in [min, max], with
 * non-finite or absent input falling back to `min`. Accepts `unknown` and
 * coerces with `Number(...)`, so persisted/URL form values can be clamped
 * directly; plain-number inputs behave exactly like the game-rules 0..2
 * clamp (`clampDifficulty(value)` ≡ `createGameRules`'s fleet standard).
 *
 * @example
 * ```ts
 * clampDifficulty(1.6);          // 2
 * clampDifficulty(Number.NaN);   // 0
 * clampDifficulty(9, 1, 3);      // 3
 * ```
 */
export function clampDifficulty(value: unknown, min = 0, max = 2): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(parsed)));
}

// ─── Secure local RNG ───────────────────────────────────────────────────────

/** The slice of the Web Crypto API the guest RNG draws from. */
export interface GuestRngCrypto {
  getRandomValues(array: Uint32Array): ArrayBufferView;
}

export interface GuestRngOptions {
  /**
   * Deterministic test seam; production omits it and the RNG resolves
   * `globalThis.crypto` lazily PER DRAW — a CSPRNG that disappears after
   * construction still fails closed at draw time, exactly like the
   * hand-rolled engines.
   */
  crypto?: GuestRngCrypto;
}

/**
 * Secure local RNG for guest-mode board generation — the local analog of
 * the enclave spawn/seed stream. Every draw comes from Web Crypto with
 * rejection-sampling debias; there is deliberately NO `Math.random`
 * fallback. When no CSPRNG is reachable the draw throws
 * `Error("secureRandomUnavailable")` — the message guest engines already
 * map through `t("secureRandomUnavailable")`.
 */
export interface GuestRng {
  /** Uniform float in [0, 1) from one 32-bit Web-Crypto draw. */
  random(): number;
  /**
   * Uniform integer in [0, maxExclusive). Bounds ≤ 1 return 0 without
   * drawing; non-integer bounds are floored; bounds ≥ 2^32 degrade to one
   * raw 32-bit draw.
   */
  int(maxExclusive: number): number;
  /** Uniformly picked element. Callers guarantee a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle on a COPY of `items` (the input is not mutated). */
  shuffle<T>(items: readonly T[]): T[];
}

/**
 * Build the guest RNG (see {@link GuestRng}).
 *
 * @example
 * ```ts
 * const rng = createGuestRng();
 * const spawnCell = rng.pick(emptyCells);
 * const isFour = rng.int(10) === 0;
 * const deck = rng.shuffle(freshDeck);
 * ```
 */
export function createGuestRng(options: GuestRngOptions = {}): GuestRng {
  /** One raw 32-bit draw; throws when no CSPRNG is reachable. */
  const drawWord = (): number => {
    const webCrypto = options.crypto ?? globalThis.crypto;
    if (!webCrypto?.getRandomValues) throw new Error("secureRandomUnavailable");
    const buffer = new Uint32Array(1);
    webCrypto.getRandomValues(buffer);
    return buffer[0] ?? 0;
  };

  const int = (maxExclusive: number): number => {
    const bound = Math.floor(maxExclusive);
    if (bound <= 1) return 0;
    if (bound >= 0x1_0000_0000) return drawWord();
    // Rejection sampling: accept only draws below the largest multiple of
    // `bound` that fits in 32 bits, so every outcome gets exactly
    // ceiling/bound source values (no modulo bias).
    const ceiling = Math.floor(0x1_0000_0000 / bound) * bound;
    let word = drawWord();
    while (word >= ceiling) word = drawWord();
    return word % bound;
  };

  return {
    random(): number {
      return drawWord() / 0x1_0000_0000;
    },
    int,
    pick<T>(items: readonly T[]): T {
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
  };
}

// ─── Guest leaderboard ──────────────────────────────────────────────────────

/** One ranked row of the off-chain guest board (decoded score, 1-based rank). */
export interface GuestLeaderboardEntry {
  user: string;
  score: string;
  rank: number;
}

export interface GuestLeaderboardAdapterOptions {
  /** Rows fetched per refresh; defaults to the fleet-standard guest window. */
  limit?: number;
}

/**
 * Thin adapter over `app.mode.guestLeaderboard` owning the two snippets
 * every guest engine redeclares: the ranked-refresh mapping (with its
 * fail-open `[]` fallback) and the best-effort score submit.
 */
export interface GuestLeaderboardAdapter {
  /**
   * Decoded guest rows re-ranked numerically (desc) with 1-based ranks;
   * resolves to [] when the off-chain board is unreachable.
   */
  refresh(): Promise<GuestLeaderboardEntry[]>;
  /**
   * The same rows projected onto the shared {@link LeaderEntry} shape the
   * session observables consume — the mapping the fleet redeclares
   * (`obs.leaderboard.set(await adapter.refreshLeaderEntries())`).
   */
  refreshLeaderEntries(): Promise<LeaderEntry[]>;
  /**
   * Best-effort score submit: non-positive (or non-numeric) scores are
   * skipped and board failures are swallowed — a wallet-less guest simply
   * gets no board row.
   */
  submit(score: number | string): Promise<void>;
}

/** Fleet-standard guest leaderboard window (the `get(50)` the engines use). */
export const DEFAULT_GUEST_BOARD_LIMIT = 50;

/** Numeric score of a decoded guest row; non-numeric rows sink last. */
const guestRowScore = (score: string): number => {
  const value = Number(score);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

/**
 * Project decoded guest rows onto the session {@link LeaderEntry} shape:
 * numeric scores, ranked descending, `solves: 1`, `isUser: false`.
 */
export function guestRowsToLeaderEntries(
  rows: ReadonlyArray<{ user: string; score: string }>,
): LeaderEntry[] {
  return rows
    .map((row) => ({ address: row.user, score: Number(row.score) || 0 }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      rank: index + 1,
      address: row.address,
      totalWon: row.score,
      solves: 1,
      isUser: false,
    }));
}

/**
 * Build the guest leaderboard adapter (see {@link GuestLeaderboardAdapter}).
 *
 * @example
 * ```ts
 * const board = createGuestLeaderboardAdapter(app.mode);
 * const refreshLeaderboard = async () => {
 *   obs.leaderboard.set(await board.refreshLeaderEntries());
 * };
 * await board.submit(score); // best-effort, never throws
 * ```
 */
export function createGuestLeaderboardAdapter(
  mode: FrameworkModeSurface,
  options: GuestLeaderboardAdapterOptions = {},
): GuestLeaderboardAdapter {
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_GUEST_BOARD_LIMIT));
  return {
    async refresh(): Promise<GuestLeaderboardEntry[]> {
      try {
        const rows = await mode.guestLeaderboard.get(limit);
        // mode.guestLeaderboard already ranks numerically; re-rank defensively
        // so the adapter is correct for any guest-board implementation.
        return rows
          .slice()
          .sort((left, right) => guestRowScore(right.score) - guestRowScore(left.score))
          .slice(0, limit)
          .map((row, index) => ({ user: row.user, score: row.score, rank: index + 1 }));
      } catch {
        return [];
      }
    },
    async refreshLeaderEntries(): Promise<LeaderEntry[]> {
      try {
        return guestRowsToLeaderEntries(await mode.guestLeaderboard.get(limit));
      } catch {
        return [];
      }
    },
    async submit(score: number | string): Promise<void> {
      if (!(Number(score) > 0)) return;
      try {
        await mode.guestLeaderboard.submit(score);
      } catch {
        /* off-chain board unreachable / no wallet — guest scores are best-effort */
      }
    },
  };
}

// ─── Guest persistence ──────────────────────────────────────────────────────

/**
 * Minimal keyed-storage contract every guest engine's local store already
 * satisfies (`delete` is the fleet idiom; `remove` is accepted for the RFC
 * storage shape; with neither, clear() degrades to writing null).
 */
export interface GuestStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete?(key: string): void;
  remove?(key: string): void;
}

/**
 * Version-stamped local record for guest profiles / active runs. Plain
 * object states are stamped with the configured `version` on save; load()
 * rejects records whose stamp differs (stale schema) and every operation
 * fails open — storage problems must never break local play. Deeper
 * per-game record validation stays in the game's own sanitizer.
 */
export interface GuestPersistence<TState> {
  /** The stored record, or null when absent, stale-versioned, or unreadable. */
  load(): TState | null;
  /** Stamp + write the record; quota/private-mode failures are swallowed. */
  save(state: TState): void;
  /** Drop the record (delete → remove → set-null); failures are ignored. */
  clear(): void;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Build a versioned guest persistence slot (see {@link GuestPersistence}).
 *
 * @example
 * ```ts
 * const profile = createGuestPersistence<GuestProfile>(storage, "guest:profile:v1", 1);
 * const saved = profile.load() ?? { bestScore: 0, solves: 0 };
 * profile.save({ ...saved, solves: saved.solves + 1 });
 * ```
 */
export function createGuestPersistence<TState>(
  storage: GuestStorage,
  key: string,
  version: number,
): GuestPersistence<TState> {
  return {
    load(): TState | null {
      try {
        const raw = storage.get<TState>(key, null);
        if (raw === null || raw === undefined) return null;
        if (isPlainRecord(raw) && "version" in raw && raw.version !== version) return null;
        return raw;
      } catch {
        return null;
      }
    },
    save(state: TState): void {
      try {
        storage.set(key, isPlainRecord(state) ? { ...state, version } : state);
      } catch {
        /* Private browsing or a full quota must not make an active run fail. */
      }
    },
    clear(): void {
      try {
        if (storage.delete) storage.delete(key);
        else if (storage.remove) storage.remove(key);
        else storage.set(key, null);
      } catch {
        /* Nothing else is required for an already terminal local record. */
      }
    },
  };
}
