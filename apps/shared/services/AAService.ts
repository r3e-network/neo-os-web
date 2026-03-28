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
  networkFee?: string;
  systemFee?: string;
  raw?: Record<string, unknown>;
}

export interface SessionKeyConfig {
  permissions: unknown;
  expiresAt: number;
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
  async checkSponsorship(): Promise<SponsorshipStatus> {
    const result: GasSponsorCheckResponse = await this.aa.checkGasSponsorship();
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
  async requestSponsorship(amount: string): Promise<SponsorshipResult> {
    const result: GasSponsorRequestResponse = await this.aa.requestGasSponsorship(amount);
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
    return {
      txid: result.txid ?? "",
      networkFee: result.networkFee,
      systemFee: result.systemFee,
      raw: result as Record<string, unknown>,
    };
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
