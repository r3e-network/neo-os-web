/**
 * AAService - Account Abstraction integration for miniapps.
 *
 * Wraps useAbstractAccount with a class-based API for gas sponsorship,
 * relay transaction submission, and future session key management.
 * Integrates with the platform EventBus for cross-component reactivity.
 *
 * @example
 * ```ts
 * // Check if the current user qualifies for gas sponsorship
 * const { eligible, remaining } = await services.aa.checkSponsorship();
 *
 * // Submit a relay transaction (AA user operation)
 * const { txid } = await services.aa.submitRelay({ metaInvocation: { ... } });
 * ```
 */

import { useAbstractAccount } from "../composables/useAbstractAccount";
import type {
  AAConfig,
  AARelayPayload,
  GasSponsorScope,
  GasSponsorCheckResponse,
  GasSponsorRequestResponse,
} from "../composables/useAbstractAccount";
import type { EventBus } from "./EventBus";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SponsorshipStatus {
  eligible: boolean;
  remaining?: number;
  dailyLimit?: string;
  usedToday?: string;
  resetsAt?: string;
  gasBalance?: string;
}

export interface SponsorshipResult {
  approved: boolean;
  txid?: string;
  requestId?: string;
  amount?: string;
}

export interface RelayResult {
  txid: string;
  status?: string;
  requestId?: string;
  networkFee?: string;
  systemFee?: string;
  raw?: Record<string, unknown>;
}

const ACCEPTED_RELAY_STATUSES = new Set(["accepted", "pending", "queued"]);

function cleanRelayString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRelayResult(
  result: Record<string, unknown>,
): RelayResult {
  const txid = cleanRelayString(
    result.txid ?? result.txHash ?? result.tx_hash,
  );
  const status = cleanRelayString(result.status).toLowerCase();
  const requestId = cleanRelayString(
    result.request_id ?? result.requestId ?? result.id,
  );
  const reason = cleanRelayString(
    result.reason ?? result.error ?? result.message,
  );

  if (txid) {
    return {
      txid,
      status: status || undefined,
      requestId: requestId || undefined,
      networkFee: cleanRelayString(result.networkFee) || undefined,
      systemFee: cleanRelayString(result.systemFee) || undefined,
      raw: result,
    };
  }

  if (status && ACCEPTED_RELAY_STATUSES.has(status)) {
    return {
      txid: "",
      status,
      requestId: requestId || undefined,
      networkFee: cleanRelayString(result.networkFee) || undefined,
      systemFee: cleanRelayString(result.systemFee) || undefined,
      raw: result,
    };
  }

  throw new Error(
    reason
      ? `AA relay not submitted: ${reason}`
      : "AA relay response did not include a transaction id or accepted status.",
  );
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class AAService {
  private aa: ReturnType<typeof useAbstractAccount>;
  private events: EventBus;
  private appId: string;

  constructor(appId: string, events: EventBus, aaConfig?: Partial<AAConfig>) {
    this.appId = appId;
    this.events = events;
    this.aa = useAbstractAccount({
      ...aaConfig,
    });
  }

  // -- Gas sponsorship ------------------------------------------------------

  /**
   * Check whether the connected user is eligible for gas sponsorship.
   * Returns eligibility status and remaining daily quota.
   */
  async checkSponsorship(
    scope?: GasSponsorScope,
  ): Promise<SponsorshipStatus> {
    const result: GasSponsorCheckResponse =
      await this.aa.checkGasSponsorship(scope);
    const remaining = parseFloat(result.remaining || "0");

    return {
      eligible: result.eligible,
      remaining: Number.isFinite(remaining) ? remaining : undefined,
      dailyLimit: result.daily_limit,
      usedToday: result.used_today,
      resetsAt: result.resets_at,
      gasBalance: result.gas_balance,
    };
  }

  /**
   * Request gas sponsorship for a specific amount.
   * The platform paymaster covers the gas cost on behalf of the user.
   *
   * @param amount - GAS amount to sponsor (in display units)
   */
  async requestSponsorship(
    amount: string,
    scope?: GasSponsorScope,
  ): Promise<SponsorshipResult> {
    const result: GasSponsorRequestResponse =
      await this.aa.requestGasSponsorship(amount, scope);
    return {
      approved: result.status === "approved" || result.status === "success",
      txid: result.tx_hash ?? undefined,
      requestId: result.request_id,
      amount: result.amount,
    };
  }

  // -- Relay ----------------------------------------------------------------

  /**
   * Submit a transaction via the AA relay.
   * The relay handles bundling and gas payment on behalf of the user.
   *
   * @param payload - The AA relay payload (meta-invocation, raw tx, etc.)
   */
  async submitRelay(payload: AARelayPayload): Promise<RelayResult> {
    const result = await this.aa.submitRelayTransaction(payload);
    return normalizeRelayResult(result as Record<string, unknown>);
  }

  // -- Session keys (future) ------------------------------------------------

  /**
   * Create a session key with scoped permissions.
   * Session keys allow limited contract interactions without per-tx wallet approval.
   *
   * Note: This is a forward-looking API. Session key management is currently
   * implemented in the AA miniapp itself. This will be promoted to the shared
   * layer once the verifier plugin API stabilizes.
   */
  async createSessionKey(permissions: unknown, expiresAt: number): Promise<unknown> {
    // Session key creation is an on-chain verifier-plugin mutation.
    // For now, return a placeholder that documents the intended interface.
    return {
      created: false,
      reason: "Session key creation is not yet available in the shared service layer",
      permissions,
      expiresAt,
    };
  }

  // -- AA address management ------------------------------------------------

  /**
   * Set the AA (Abstract Account) address for subsequent relay operations.
   */
  setAddress(address: string | null): void {
    this.aa.setAAAddress(address);
  }

  /**
   * Get the current AA address.
   */
  get address() {
    return this.aa.aaAddress;
  }

  // -- State accessors ------------------------------------------------------

  /** Whether a sponsorship check is in progress. */
  get isCheckingSponsorship() {
    return this.aa.isCheckingSponsorship;
  }

  /** Whether a relay submission is in progress. */
  get isRelaying() {
    return this.aa.isRelaying;
  }

  /** Last error message from AA operations. */
  get error() {
    return this.aa.error;
  }
}
