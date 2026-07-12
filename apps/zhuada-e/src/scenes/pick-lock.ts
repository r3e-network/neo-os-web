/**
 * 3D scene rapid-pick contract.
 *
 * The rules engine settles immediately, while the React tray is allowed to
 * queue receipts and play the readable grouping/highlight/clear choreography.
 * Therefore input must not be globally blocked by the full tray animation:
 * only the same physical item needs a short in-flight guard against duplicate
 * taps before the authoritative receipt returns.
 */
export const PICK_DUPLICATE_GUARD_MS = 96;

export function duplicatePickGuardUntil(now: number): number {
  return now + PICK_DUPLICATE_GUARD_MS;
}

export function canStartDifferentPick(previousGuardUntil: number, now: number): boolean {
  return now < previousGuardUntil;
}
