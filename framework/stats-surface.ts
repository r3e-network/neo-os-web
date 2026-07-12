/**
 * framework/stats-surface — app.stats OS-board stats/leaderboard glue +
 * app.achievements OS badge helpers (RFC P0-1 residual index.ts split, moved
 * verbatim from index.ts).
 *
 * - `stats.increment` (deprecated): non-atomic counter over `app.db`.
 * - `stats.leaderboard`: shared OS board with two-sided guest-namespace
 *   isolation (guest submits route to `app.mode.guestLeaderboard`; `top()`
 *   filters guest rows out).
 * - `achievements` (deprecated): award-once markers over `app.storage.local`
 *   plus the OS badge define/award/list lanes.
 */

import type { Observable } from "./reactive";
import type {
  AchievementDefinition,
  FrameworkAchievementsSurface,
  FrameworkDbSurface,
  FrameworkLocalStorageSurface,
  FrameworkModeSurface,
  FrameworkStatsSurface,
  MiniAppFrameworkOS,
} from "./types";

export interface StatsSurfaceDeps {
  /** The `app.db` surface backing the deprecated `stats.increment` lane. */
  db: FrameworkDbSurface;
  /** Wallet-address observable (user-scoped counter ids). */
  address: Observable<string | null>;
  /** chain.ensureWallet fallback when no address is connected yet. */
  ensureWallet(): Promise<string>;
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
 * const stats = createStatsSurface({ db, address, ensureWallet, leaderboard, mode, isGuestBoardRow });
 * await stats.leaderboard.submit(1200);
 * ```
 */
export function createStatsSurface(deps: StatsSurfaceDeps): FrameworkStatsSurface {
  return {
    async increment(key: string, by = 1, scope: "global" | "user" = "global"): Promise<number> {
      const id = scope === "user" ? `${deps.address.get() || await deps.ensureWallet()}:${key}` : key;
      const stats = deps.db.collection<{ value: number }>("stats");
      const current = await stats.get(id);
      const next = Number(current?.value ?? 0) + by;
      await stats.set(id, { value: next });
      return next;
    },
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

export interface AchievementsSurfaceDeps {
  /** Wallet-address observable (default award recipient). */
  address: Observable<string | null>;
  /** chain.ensureWallet fallback when no address is connected yet. */
  ensureWallet(): Promise<string>;
  /** The `app.storage.local` lane holding the award-once markers. */
  local: FrameworkLocalStorageSurface;
  /** Live accessor for the OS badge service (hosts can hydrate late). */
  badge: () => MiniAppFrameworkOS["badge"] | undefined;
}

/**
 * Build the `app.achievements` surface (see module doc).
 *
 * @example
 * ```ts
 * const achievements = createAchievementsSurface({ address, ensureWallet, local, badge });
 * await achievements.awardOnce({ id: "first-win", name: "First Win", criteria: "Win once" });
 * ```
 */
export function createAchievementsSurface(
  deps: AchievementsSurfaceDeps,
): FrameworkAchievementsSurface {
  return {
    async awardOnce(definition: AchievementDefinition, user?: string): Promise<{ awarded: boolean }> {
      const recipient = user || deps.address.get() || await deps.ensureWallet();
      const marker = `achievements/awarded/${recipient}/${definition.id}`;
      if (deps.local.get<boolean>(marker, false)) return { awarded: false };
      await deps.badge()?.define(definition.id, definition.name, definition.criteria);
      await deps.badge()?.award(definition.id, recipient);
      deps.local.set(marker, true);
      return { awarded: true };
    },
    async list(user?: string): Promise<unknown[]> {
      return deps.badge()?.list(user) ?? [];
    },
  };
}
