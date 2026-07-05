/**
 * deriveSchedule — translate the PlayArea form (total amount + total duration in
 * days) into the contract's per-interval vesting model: a daily linear release
 * of total / duration per day. Returns the rate string and interval-days string
 * the composable expects, honouring each asset's divisibility:
 *
 *  - GAS is divisible to 8 dp, so a fractional per-day rate is always valid, but
 *    it MUST be quantised to 8 decimals before stringifying. String(total/days)
 *    can emit a 17-significant-digit JS float (e.g. 5 GAS / 30 days ->
 *    "0.16666666666666666"), which toBaseUnits' 8-decimal validator rejects,
 *    returning 0n and failing "Create Stream" before any deposit fires.
 *    `.toFixed(8)` keeps the rate representable.
 *  - NEO is indivisible. If total / duration truncates to < 1 NEO/day, a daily
 *    rate of 0 would be rejected, so we collapse the schedule into a single
 *    interval that spans the whole duration and releases the full total at the
 *    end (rate = total, intervalDays = duration). When total >= duration, the
 *    per-day integer NEO rate is used.
 *
 * Extracted from main.tsx so the rounding behaviour is unit-testable without
 * importing the React entry point (which mounts the app on import).
 */
export function deriveSchedule(
  amount: string,
  durationDays: string,
  asset: "NEO" | "GAS",
): { rate: string; intervalDays: string } {
  const total = Number.parseFloat(amount);
  const days = Number.parseInt(durationDays, 10);
  if (!Number.isFinite(total) || !Number.isFinite(days) || days <= 0) {
    return { rate: amount, intervalDays: "1" };
  }

  if (asset === "NEO") {
    if (!/^[1-9]\d*$/.test(String(amount ?? "").trim())) {
      return { rate: "0", intervalDays: "1" };
    }
    const totalNeo = Math.trunc(total);
    const perDay = Math.trunc(totalNeo / days);
    if (perDay >= 1) {
      return { rate: String(perDay), intervalDays: "1" };
    }
    // Sub-1-NEO/day: release everything in one interval at the horizon.
    return { rate: String(totalNeo), intervalDays: String(days) };
  }

  // GAS: linear per-day release; the composable scales by 1e8. Round to GAS's 8
  // decimals so the rate string is representable — String(0.7/7) would yield
  // "0.09999999999999999" which the 8-decimal amount validator rejects.
  const perDay = total / days;
  return { rate: perDay.toFixed(8), intervalDays: "1" };
}
