/**
 * @shared/game — Forwarding shim → @framework/game
 *
 * All game infrastructure (types, utilities, session factory, leaderboard)
 * has been migrated to framework/game/. This file re-exports everything from
 * there so existing @shared/game imports continue to work without changes.
 *
 * Prefer importing from @framework/game in new code.
 */
export * from "@framework/game";
