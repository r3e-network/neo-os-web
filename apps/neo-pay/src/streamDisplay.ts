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

/**
 * Per-day release amount for a created stream, derived from the on-chain
 * rateAmount (base units) over its intervalDays — so the ongoing release rate
 * the creator committed to is visible on the stream cards, not only on the
 * create form. Returns null when there is no meaningful per-day figure (no
 * rate, or a sub-1-NEO/day cliff where a fractional NEO/day would mislead).
 *
 * intervalDays === 1 (the common linear case) means rateAmount IS the per-day
 * amount; a longer interval is divided to express an equivalent per-day value.
 */
export function releasePerDayDisplay(
  rateAmount: bigint | undefined,
  intervalDays: number | undefined,
  assetSymbol: "NEO" | "GAS",
): string | null {
  if (typeof rateAmount !== "bigint" || rateAmount <= 0n) return null;
  const days = typeof intervalDays === "number" && intervalDays > 0 ? intervalDays : 1;
  if (assetSymbol === "NEO") {
    const perDay = days === 1 ? rateAmount : rateAmount / BigInt(days);
    if (perDay < 1n) return null;
    return perDay.toString();
  }
  // GAS rateAmount is in 1e8 base units.
  const perDay = Number(rateAmount) / 100000000 / days;
  if (!(perDay > 0)) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(perDay);
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
