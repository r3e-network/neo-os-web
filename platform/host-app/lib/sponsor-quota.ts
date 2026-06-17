import { getServerSupabaseClient } from "@/lib/server-supabase";
import { logger } from "@/lib/logger";

/**
 * Shared, persistent quota enforcement for the GAS sponsor endpoint.
 *
 * The sponsor endpoint runs on serverless, where module-level in-memory
 * counters are per-instance and reset on cold start. That made its global
 * daily budget and per-user hourly limits unenforceable across instances, so
 * the sponsor wallet could be drained by spreading requests across cold starts.
 *
 * This module replaces those counters with atomic Supabase RPCs backed by
 * shared tables:
 *   - sponsor_global_budget_bump  -> global daily GAS-amount budget (scope/date)
 *   - rate_limit_bump             -> per-user request count within a window
 *
 * Both checks FAIL CLOSED: if the shared store is unavailable or returns an
 * error, the reservation is denied rather than silently allowed.
 */

const GLOBAL_BUDGET_SCOPE = "rpc-sponsor:global";
const PER_USER_LIMIT_TYPE = "sponsor_user";

export type SponsorQuotaResult =
  | { allowed: true }
  | { allowed: false; status: number; reason: string };

type GlobalBudgetParams = {
  /** GAS amount being reserved by this request (in whole GAS). */
  amountGas: number;
  /** Maximum total GAS that may be sponsored globally per UTC day. */
  dailyLimitGas: number;
};

type PerUserLimitParams = {
  /** Stable per-user identity (the user's wallet address). */
  userAddress: string;
  /** Maximum number of sponsored transactions per user per window. */
  maxPerWindow: number;
  /** Rolling window length in seconds. */
  windowSeconds: number;
};

type BumpRow = {
  used_amount?: number | string | null;
  request_count?: number | string | null;
  window_start?: string | null;
};

function isQuotaExceededError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("budget_exceeded") || m.includes("quota") || m.includes("limit") || m.includes("exceeded");
}

/**
 * Reserve a slice of the shared global daily GAS budget. The DB function checks
 * `used + amount <= limit` and commits the increment atomically, raising
 * `budget_exceeded` when the ceiling would be crossed.
 *
 * Returns the reserved amount so callers can release it (negative bump) when a
 * later step fails. Fails closed when the store is unavailable.
 */
export async function reserveGlobalDailyBudget(
  params: GlobalBudgetParams,
): Promise<SponsorQuotaResult> {
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    logger.error("Sponsor quota store unavailable: service-role Supabase client not configured");
    return {
      allowed: false,
      status: 503,
      reason: "Sponsorship quota service unavailable",
    };
  }

  try {
    const { data, error } = await supabase.rpc("sponsor_global_budget_bump", {
      p_scope: GLOBAL_BUDGET_SCOPE,
      p_amount: params.amountGas,
      p_daily_limit: params.dailyLimitGas,
    });
    if (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (isQuotaExceededError(message)) {
        return {
          allowed: false,
          status: 429,
          reason: "Global daily sponsorship limit reached",
        };
      }
      logger.error("Sponsor global budget bump failed:", message);
      return {
        allowed: false,
        status: 503,
        reason: "Sponsorship quota service unavailable",
      };
    }

    const row: BumpRow | null = Array.isArray(data) ? data[0] : data;
    if (!row) {
      logger.error("Sponsor global budget bump returned no row");
      return {
        allowed: false,
        status: 503,
        reason: "Sponsorship quota service unavailable",
      };
    }
    return { allowed: true };
  } catch (e) {
    logger.error(
      "Sponsor global budget bump threw:",
      e instanceof Error ? e.message : "unknown",
    );
    return {
      allowed: false,
      status: 503,
      reason: "Sponsorship quota service unavailable",
    };
  }
}

/**
 * Release a previously reserved slice of the global daily budget. Best-effort:
 * a failed release only over-counts (more conservative), so it never blocks the
 * caller. Used to roll back the reservation when a later step fails.
 */
export async function releaseGlobalDailyBudget(amountGas: number): Promise<void> {
  if (!(amountGas > 0)) return;
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) return;
  try {
    const { error } = await supabase.rpc("sponsor_global_budget_bump", {
      p_scope: GLOBAL_BUDGET_SCOPE,
      p_amount: -amountGas,
      p_daily_limit: null,
    });
    if (error) {
      logger.warn(
        "Sponsor global budget release failed (will over-count):",
        error instanceof Error ? error.message : String(error),
      );
    }
  } catch (e) {
    logger.warn(
      "Sponsor global budget release threw (will over-count):",
      e instanceof Error ? e.message : "unknown",
    );
  }
}

/**
 * Atomically record one sponsored request for a user and enforce the per-user
 * rolling-window count. Reuses the shared `rate_limit_bump` RPC (the same one
 * the edge functions use), which upserts and returns the count for the window.
 * Fails closed when the store is unavailable.
 */
export async function enforcePerUserLimit(
  params: PerUserLimitParams,
): Promise<SponsorQuotaResult> {
  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    logger.error("Sponsor quota store unavailable: service-role Supabase client not configured");
    return {
      allowed: false,
      status: 503,
      reason: "Sponsorship quota service unavailable",
    };
  }

  const identifier = `${PER_USER_LIMIT_TYPE}:${params.userAddress}:rpc-sponsor`;

  let count: number;
  try {
    const { data, error } = await supabase.rpc("rate_limit_bump", {
      p_identifier: identifier,
      p_identifier_type: PER_USER_LIMIT_TYPE,
      p_window_seconds: params.windowSeconds,
    });
    if (error) {
      logger.error(
        "Sponsor per-user rate limit bump failed:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        allowed: false,
        status: 503,
        reason: "Sponsorship quota service unavailable",
      };
    }
    const row: BumpRow | null = Array.isArray(data) ? data[0] : data;
    count = Number(row?.request_count ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      logger.error("Sponsor per-user rate limit bump returned an invalid count");
      return {
        allowed: false,
        status: 503,
        reason: "Sponsorship quota service unavailable",
      };
    }
  } catch (e) {
    logger.error(
      "Sponsor per-user rate limit bump threw:",
      e instanceof Error ? e.message : "unknown",
    );
    return {
      allowed: false,
      status: 503,
      reason: "Sponsorship quota service unavailable",
    };
  }

  if (count > params.maxPerWindow) {
    return {
      allowed: false,
      status: 429,
      reason: "User sponsorship limit reached",
    };
  }
  return { allowed: true };
}
