/**
 * framework/stats-surface — app.stats OS-board stats/leaderboard glue
 * (RFC P0-1 residual index.ts split, moved verbatim from index.ts).
 *
 * - `stats.leaderboard`: shared OS board with two-sided guest-namespace
 *   isolation (guest submits route to `app.mode.guestLeaderboard`; `top()`
 *   filters guest rows out).
 */

import type {
  FrameworkModeSurface,
  FrameworkStatsSurface,
  MiniAppFrameworkOS,
} from "./types";

export interface StatsSurfaceDeps {
  /** Live accessor for the OS leaderboard (hosts can hydrate late). */
  leaderboard: () => MiniAppFrameworkOS["leaderboard"] | undefined;
  /** app.mode — guest check + the guest-namespaced submit lane. */
  mode: Pick<FrameworkModeSurface, "isGuest" | "guestLeaderboard">;
  /** True when an OS-board row belongs to the guest namespace (mode module). */
  isGuestBoardRow(row: { score?: unknown }): boolean;
}

/**
 * Build the `app.stats` surface (see module doc).
 *
 * @example
 * ```ts
 * const stats = createStatsSurface({ leaderboard, mode, isGuestBoardRow });
 * await stats.leaderboard.submit(1200);
 * ```
 */
export function createStatsSurface(deps: StatsSurfaceDeps): FrameworkStatsSurface {
  return {
    leaderboard: {
      /**
       * Submit a score to the shared OS board.
       *
       * GUEST-MODE DESIGN (aligned with app.mode semantics): the OS board
       * is an off-chain lane guests ARE allowed to use — that is exactly
       * why app.mode.guestLeaderboard exists — so a guest submit is NOT a
       * guarded write like chain/oracle lanes. Instead it is routed through
       * the guest namespace (`<appId>:guest:<score>`, the same encoding as
       * mode.guestLeaderboard.submit) so a guest run can never place an
       * unprefixed score on the shared gamefi board. Cross-mode isolation
       * is two-sided: `top()` below filters the guest namespace out, and
       * mode.guestLeaderboard.get() is the guest read lane.
       */
      async submit(score: number | string): Promise<void> {
        if (deps.mode.isGuest()) {
          await deps.mode.guestLeaderboard.submit(score);
          return;
        }
        await deps.leaderboard()?.submitScore(String(score));
      },
      async top(limit = 100): Promise<Array<{ user: string; score: string }>> {
        const rows = (await deps.leaderboard()?.get(limit)) ?? [];
        // Guest rows are namespaced (`<appId>:guest:<score>`) on the same
        // OS board — never leak them into the non-guest board view
        // (cross-mode isolation of app.mode.guestLeaderboard).
        return rows.filter((row) => !deps.isGuestBoardRow(row));
      },
    },
  };
}
