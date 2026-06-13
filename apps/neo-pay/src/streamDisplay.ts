/**
 * streamDisplay — pure presentation helpers for the Neo Pay PlayArea.
 *
 * Extracted so the status-localization, claim-gating and create-form schedule
 * disclosure rules are a single source of truth shared by the component and the
 * unit tests (the per-app vitest runner has no DOM, so the rules live here as
 * pure functions rather than only inside JSX).
 */

export type StreamStatusKey = "statusActive" | "statusCompleted" | "statusCancelled";

/** Map a normalized stream status to its locale key (defaults to active). */
export function statusLabelKey(status: string | undefined): StreamStatusKey {
  switch (status) {
    case "completed":
      return "statusCompleted";
    case "cancelled":
      return "statusCancelled";
    default:
      return "statusActive";
  }
}

/** A stream in a terminal state can neither be claimed nor cancelled again. */
export function isFinalizedStatus(status: string | undefined): boolean {
  return status === "cancelled" || status === "completed";
}

/**
 * Whether the beneficiary Claim button should be enabled: an active (non-final)
 * stream with a strictly positive claimable balance. A claim with nothing
 * vested would revert on-chain after the wallet prompt, so the UI gates it.
 */
export function canClaim(status: string | undefined, claimablePositive: boolean): boolean {
  return !isFinalizedStatus(status) && claimablePositive;
}

export type SchedulePreview =
  | { kind: "linear"; amount: string; days: string }
  | { kind: "cliff"; amount: string; days: string }
  | null;

/**
 * Derive the create-form schedule disclosure from the typed total + duration,
 * mirroring deriveSchedule: GAS releases linearly per day; a sub-1-NEO/day total
 * collapses into a single end-of-term cliff (flagged so the user is warned).
 */
export function deriveSchedulePreview(
  amount: string,
  duration: string,
  token: "GAS" | "NEO",
): SchedulePreview {
  const total = Number.parseFloat(amount);
  const days = Number.parseInt(duration, 10);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  if (token === "NEO") {
    const totalNeo = Math.trunc(total);
    const perDay = Math.trunc(totalNeo / days);
    if (perDay < 1) {
      return { kind: "cliff", amount: String(totalNeo), days: String(days) };
    }
    return { kind: "linear", amount: String(perDay), days: String(days) };
  }
  const perDay = total / days;
  return {
    kind: "linear",
    amount: perDay.toFixed(perDay >= 1 ? 2 : 8).replace(/\.?0+$/, ""),
    days: String(days),
  };
}
