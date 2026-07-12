/**
 * framework/mode — app.mode two-mode surface + guest guard + guest
 * leaderboard (RFC P0-1 §2 step 4, moved verbatim from index.ts).
 *
 * GUEST mode disables every on-chain/oracle/reward WRITE lane (defense in
 * depth). Read-only lanes (chain.read/readRaw/readArray/events) stay allowed
 * so a guest can still read the reward pool for an upsell.
 */

import { createObservable } from "./reactive";
import { MiniAppError } from "./utils/errors";
import type {
  FrameworkAppMode,
  FrameworkGuestLeaderboard,
  FrameworkModeSurface,
  MiniAppFrameworkOS,
} from "./types";

export interface ModeModuleDeps {
  appId: string;
  /** Live accessor for the OS leaderboard (hosts can hydrate late). */
  leaderboard: () => MiniAppFrameworkOS["leaderboard"] | undefined;
}

export interface ModeModule {
  /** The app-facing `app.mode` surface. */
  mode: FrameworkModeSurface;
  /** Guest guard every write lane threads (throws GUEST_MODE_BLOCKED). */
  assertNotGuest(): void;
  /** True when an OS-board row belongs to the guest namespace. */
  isGuestBoardRow(row: { score?: unknown }): boolean;
}

const GUEST_BLOCKED_MESSAGE = "guest-mode: on-chain/oracle operations are disabled";

/**
 * Rows scanned from the OS board per guest read. The board can mix guest
 * and non-guest rows (stats.leaderboard shares it), so a `limit`-sized
 * window could miss every guest row; scan a defensive window instead
 * (same 500 cap chain.enumerate / events.listAll use) before filtering.
 */
const GUEST_BOARD_SCAN_LIMIT = 500;

/**
 * Build the app.mode module (see module doc).
 *
 * @example
 * ```ts
 * const { mode, assertNotGuest } = createModeModule({
 *   appId,
 *   leaderboard: () => os.leaderboard,
 * });
 * mode.set("guest");
 * assertNotGuest(); // throws MiniAppError("GUEST_MODE_BLOCKED")
 * ```
 */
export function createModeModule(deps: ModeModuleDeps): ModeModule {
  const modeObservable = createObservable<FrameworkAppMode>("gamefi");
  const assertNotGuest = (): void => {
    if (modeObservable.get() === "guest") {
      throw new MiniAppError(GUEST_BLOCKED_MESSAGE, "GUEST_MODE_BLOCKED");
    }
  };
  // Guest scores go to the off-chain OS leaderboard under an app+":guest"
  // namespace prefix so they never mix with any on-chain / gamefi result.
  const GUEST_BOARD_PREFIX = `${deps.appId}:guest:`;
  const isGuestBoardRow = (row: { score?: unknown }): boolean =>
    String(row?.score ?? "").startsWith(GUEST_BOARD_PREFIX);
  /** Numeric rank for a decoded guest score; non-numeric rows sink last. */
  const guestScoreRank = (score: string): number => {
    const value = Number(score);
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  };
  const guestLeaderboard: FrameworkGuestLeaderboard = {
    async submit(score: number | string): Promise<void> {
      await deps.leaderboard()?.submitScore(`${GUEST_BOARD_PREFIX}${score}`);
    },
    async get(limit = 100): Promise<Array<{ user: string; score: string }>> {
      const rows =
        (await deps.leaderboard()?.get(Math.max(limit, GUEST_BOARD_SCAN_LIMIT))) ?? [];
      // Re-rank numerically after decoding: the host board orders the RAW
      // prefixed strings ("app:guest:9" sorts above "app:guest:100"), so its
      // ordering is meaningless for guest rows.
      return rows
        .filter(isGuestBoardRow)
        .map((row) => ({
          user: row.user,
          score: String(row.score).slice(GUEST_BOARD_PREFIX.length),
        }))
        .sort((left, right) => guestScoreRank(right.score) - guestScoreRank(left.score))
        .slice(0, limit);
    },
  };
  const mode: FrameworkModeSurface = {
    current: modeObservable,
    set(value: FrameworkAppMode): void {
      modeObservable.set(value === "guest" ? "guest" : "gamefi");
    },
    get(): FrameworkAppMode {
      return modeObservable.get();
    },
    isGuest(): boolean {
      return modeObservable.get() === "guest";
    },
    isGameFi(): boolean {
      return modeObservable.get() !== "guest";
    },
    onChange(callback: (value: FrameworkAppMode) => void): () => void {
      return modeObservable.subscribe(() => callback(modeObservable.get()));
    },
    guestLeaderboard,
  };

  return { mode, assertNotGuest, isGuestBoardRow };
}
