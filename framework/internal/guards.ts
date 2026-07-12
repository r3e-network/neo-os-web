/**
 * framework/internal/guards — write-lane guard middleware (RFC P0-2).
 *
 * Every framework write lane enforces the same ordered stanza:
 *
 *   1. guest guard   — `assertNotGuest()` (app.mode two-mode contract)
 *   2. S11 gate      — `requirePermission(name)` (manifest permission)
 *   3. the write     — the wrapped `run`
 *
 * That ordering used to be maintained by convention across ~53 hand-inlined
 * sites; `guardedWrite` makes it true by construction. Deliberate exemptions
 * become NAMED policies instead of silent omissions:
 *
 * - `credits.spend`         → `{ permission: null }` (guest-guarded, off-chain
 *                              DB debit — deliberately NOT behind "payments")
 * - `oracle.seal.store`     → `{ permission: null }` (guest-guarded
 *                              confidential-store write, no "oracle:request")
 * - guest leaderboard submit → not a guarded lane at all (routes to the guest
 *                              namespace instead of throwing — see app.mode)
 *
 * This module is framework-internal: it is NOT exported from framework/index
 * and carries no app-facing surface.
 */

/** Declarative policy for one framework write lane. */
export interface FrameworkWritePolicy {
  /** S11 permission required, or `null` for the deliberate ungated lanes. */
  permission: string | null;
  /**
   * Guest-mode guard (default `true`). Named `false` only for documented
   * exemptions — a new lane that skips the guest guard is a review rejection.
   */
  guestGuard?: boolean;
}

/** The two guard dependencies every write lane threads (credits.ts pattern). */
export interface FrameworkGuardDeps {
  /** Throws the GUEST_MODE_BLOCKED MiniAppError while app.mode is "guest". */
  assertNotGuest(): void;
  /** Throws FrameworkPermissionError unless the S11 permission is granted. */
  requirePermission(name: string): void;
}

/**
 * Compose the guest→permission→write ordering around an async write lane.
 *
 * The returned function is `async`, so a guard denial REJECTS (it never
 * throws synchronously) — matching the existing framework write lanes, all
 * of which are `async` methods whose inline guards became rejections.
 *
 * @example
 * ```ts
 * const invoke = guardedWrite(
 *   { assertNotGuest, requirePermission: (name) => permissions.require(name) },
 *   { permission: "invoke:primary" },
 *   (operation: string, args: FrameworkContractArg[]) => chain.invoke(operation, args),
 * );
 * await invoke("mint", []); // guest guard, then S11 gate, then the broadcast
 * ```
 */
export function guardedWrite<A extends unknown[], R>(
  deps: FrameworkGuardDeps,
  policy: FrameworkWritePolicy,
  run: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    if (policy.guestGuard !== false) deps.assertNotGuest();
    if (policy.permission !== null) deps.requirePermission(policy.permission);
    return run(...args);
  };
}
