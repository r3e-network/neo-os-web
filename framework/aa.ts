/**
 * app.aa — account-abstraction surface (framework-extraction plan §2/S10).
 *
 * Standalone factory wrapping the host's optional AA service (gas
 * sponsorship, relay submission, session keys). The service is injected
 * structurally so the framework stays independent from apps/shared: the
 * platform host passes its AAService instance, OneGate/standalone embeds
 * pass nothing.
 *
 * Degradation contract: unlike most framework surfaces (which no-op when a
 * service is absent), AA calls are meaningless without a host AA lane, so
 * every method throws a typed {@link FrameworkCapabilityError} when the host
 * lacks AA. Apps branch on `aa.available` (or catch the typed error) to show
 * "AA unavailable" copy instead of a raw failure.
 *
 * The pure derivation helpers formerly in apps/shared/utils/aa-account.ts
 * live in framework/utils/aa-account.ts and are re-exported here.
 */
import { MiniAppError } from "./utils/errors";

/**
 * Thrown when an app calls a framework surface the current host cannot
 * provide (e.g. app.aa on a host without an AA service). Identity-stable
 * exported class so apps can `instanceof`-branch to capability-specific UI.
 */
export class FrameworkCapabilityError extends MiniAppError {
  readonly capability: string;

  constructor(capability: string, message?: string) {
    super(
      message ?? `Host does not provide the "${capability}" capability`,
      "CAPABILITY_UNAVAILABLE",
      undefined,
      { capability },
    );
    this.name = "FrameworkCapabilityError";
    this.capability = capability;
  }
}

export interface FrameworkAaSponsorScope {
  aaAddress?: string;
  dappId?: string;
}

export interface FrameworkAaSponsorshipStatus {
  eligible: boolean;
  remaining?: number;
  dailyLimit?: string;
  usedToday?: string;
  resetsAt?: string;
  gasBalance?: string;
}

export interface FrameworkAaSponsorshipResult {
  approved: boolean;
  txid?: string;
  requestId?: string;
  amount?: string;
}

export interface FrameworkAaRelayPayload {
  metaInvocation?: Record<string, unknown>;
  rawTransaction?: string;
  paymaster?: Record<string, unknown>;
  simulate?: boolean;
  [key: string]: unknown;
}

export interface FrameworkAaRelayResult {
  txid: string;
  status?: string;
  requestId?: string;
  networkFee?: string;
  systemFee?: string;
  raw?: Record<string, unknown>;
}

/**
 * Structural view of the host AA service (apps/shared AAService satisfies
 * this without the framework importing it). `createSessionKey` is optional —
 * older hosts predate the session-key lane.
 */
export interface FrameworkAaService {
  checkSponsorship(scope?: FrameworkAaSponsorScope): Promise<FrameworkAaSponsorshipStatus>;
  requestSponsorship(
    amount: string,
    scope?: FrameworkAaSponsorScope,
  ): Promise<FrameworkAaSponsorshipResult>;
  submitRelay(payload: FrameworkAaRelayPayload): Promise<FrameworkAaRelayResult>;
  createSessionKey?(permissions: unknown, expiresAt: number): Promise<unknown>;
}

export interface FrameworkAaSurfaceDeps {
  /** Host AA service; absent on OneGate/standalone hosts without an AA lane. */
  aa?: FrameworkAaService | null;
}

export function createAaSurface(deps: FrameworkAaSurfaceDeps = {}) {
  const requireAa = (): FrameworkAaService => {
    if (!deps.aa) throw new FrameworkCapabilityError("aa");
    return deps.aa;
  };

  return {
    /** Whether the host provides an AA service (calls throw when false). */
    get available(): boolean {
      return Boolean(deps.aa);
    },

    sponsorship: {
      /** Check gas-sponsorship eligibility and remaining daily quota. */
      async check(scope?: FrameworkAaSponsorScope): Promise<FrameworkAaSponsorshipStatus> {
        return requireAa().checkSponsorship(scope);
      },
      /** Request paymaster gas sponsorship for `amount` GAS (display units). */
      async request(
        amount: string,
        scope?: FrameworkAaSponsorScope,
      ): Promise<FrameworkAaSponsorshipResult> {
        return requireAa().requestSponsorship(amount, scope);
      },
    },

    /** Submit an AA user operation through the host relay. */
    async relay(payload: FrameworkAaRelayPayload): Promise<FrameworkAaRelayResult> {
      return requireAa().submitRelay(payload);
    },

    sessionKey: {
      /** Create a scoped session key via the host verifier-plugin lane. */
      async create(permissions: unknown, expiresAt: number): Promise<unknown> {
        const aa = requireAa();
        if (typeof aa.createSessionKey !== "function") {
          throw new FrameworkCapabilityError("aa.sessionKey");
        }
        return aa.createSessionKey(permissions, expiresAt);
      },
    },
  };
}

export type FrameworkAaSurface = ReturnType<typeof createAaSurface>;

// Pure derivation helpers (canonical copies; shared re-exports these too).
export {
  AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS,
  deriveAAAccountIdHash,
  deriveRegistrationAccountIdHash,
  buildAnchorAgentVerifierParam,
  deriveAnchorAgentAccounts,
  generateAASessionKeyPair,
} from "./utils/aa-account";
export type {
  RegistrationAccountOptions,
  AnchorAgentDerivationOptions,
  AnchorAgentAccount,
} from "./utils/aa-account";
