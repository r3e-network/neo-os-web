/**
 * Shared test setup and mock infrastructure for the validation suite.
 *
 * The registry mock models the *admission rules* enforced by the on-chain
 * contract - witness check, engine whitelist, appId format, duplicate
 * rejection and AA-core configuration - rather than returning HALT
 * unconditionally. A mock that always succeeds makes assertions pass
 * vacuously: `expect(app).toBeDefined()` cannot fail if `getApp` answers
 * every input with a record. Each rule modelled here is covered by a test
 * that proves it is enforced, so dropping a rule turns a test red.
 *
 * All generated values are deterministic. Randomness, or an id derived from
 * the clock, turns "every app gets a distinct account" into a probabilistic
 * claim and collides when two ids are produced within one millisecond.
 */

/** Longest appId the registry accepts, matching the contract storage key budget. */
export const APP_ID_MAX_LENGTH = 64;

/** Characters permitted in an appId. Mirrors `boundary-string.test.ts`. */
export const APP_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** 20-byte hex form used for admin and signer addresses. */
export const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Engine ids the registry knows about unless a test overrides the list. */
export const DEFAULT_ENGINE_IDS: readonly string[] = ['game', 'reward', 'oracle'];

/** UnifiedSmartWallet hash the registry points at unless a test clears it. */
export const DEFAULT_AA_CORE_HASH = '0x00000000000000000000000000000000000000aa';

/** Registry contract hash the mock reports. */
export const MOCK_REGISTRY_HASH = '0x1234567890abcdef1234567890abcdef12345678';

/** Gas figure reported by a successful mock invocation. */
export const MOCK_GAS_CONSUMED = '1000000';

/** Shape returned by a successful contract invocation. */
export interface InvocationResult {
  state: 'HALT';
  gasconsumed: string;
  stack: unknown[];
}

/** Result of materializing an app's abstract account. */
export interface AccountResult extends InvocationResult {
  accountId: string;
}

/** Registry record describing a registered app. */
export interface AppRecord {
  appId: string;
  admin: string;
  engineId: string;
  /** Set once the abstract account has been materialized. */
  accountId: string | null;
}

/** Deployment-time configuration overrides for the registry mock. */
export interface MockRegistryOptions {
  /** Engine ids the registry accepts. Defaults to {@link DEFAULT_ENGINE_IDS}. */
  engineIds?: readonly string[];
  /** AA core hash, or `null` for a registry whose AA core is unconfigured. */
  aaCoreHash?: string | null;
}

/**
 * Deterministic stand-in for the contract's SHA256(registryHash || appId)
 * account derivation. Distinct appIds yield distinct ids and the same appId
 * always yields the same id, which is what the uniqueness and idempotency
 * assertions actually claim.
 */
function deriveAccountId(registryHash: string, appId: string): string {
  const seed = `${registryHash}:${appId}`;
  let low = 0x811c9dc5;
  let high = 0x9e3779b9;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high + code + index, 0x85ebca6b) >>> 0;
  }

  const block = low.toString(16).padStart(8, '0') + high.toString(16).padStart(8, '0');
  return `0x${block.repeat(3).slice(0, 40)}`;
}

function assertValidAppId(appId: string): void {
  if (typeof appId !== 'string' || appId.trim().length === 0) {
    throw new Error('FAULT: empty appId not allowed');
  }
  if (appId.length > APP_ID_MAX_LENGTH) {
    throw new Error(`FAULT: appId too long - maximum ${APP_ID_MAX_LENGTH} characters`);
  }
  if (!APP_ID_PATTERN.test(appId)) {
    throw new Error(`FAULT: invalid characters in appId '${appId}' - allowed: letters, digits, '-', '_'`);
  }
}

function assertValidAddress(label: string, address: string): void {
  if (typeof address !== 'string' || !ADDRESS_PATTERN.test(address)) {
    throw new Error(`FAULT: invalid ${label} address '${address}' - expected 0x-prefixed 20-byte hex`);
  }
}

/**
 * Registry mock enforcing the contract's admission rules.
 *
 * @param options - Deployment-time configuration. Omit for a registry with
 *   the default engines registered and an AA core configured.
 */
export function createMockRegistry(options: MockRegistryOptions = {}) {
  const engineIds = new Set(options.engineIds ?? DEFAULT_ENGINE_IDS);
  const aaCoreHash = options.aaCoreHash === undefined ? DEFAULT_AA_CORE_HASH : options.aaCoreHash;
  const apps = new Map<string, AppRecord>();

  return {
    contractHash: MOCK_REGISTRY_HASH,
    aaCoreHash,

    /**
     * @param signer - Address that signed the transaction. Defaults to the
     *   admin, so callers that do not exercise the witness check are
     *   unaffected; pass a different address to assert rejection.
     */
    registerApp: async (
      appId: string,
      admin: string,
      engineId: string,
      signer: string = admin
    ): Promise<InvocationResult> => {
      assertValidAppId(appId);
      assertValidAddress('admin', admin);
      assertValidAddress('signer', signer);

      if (signer !== admin) {
        throw new Error('FAULT: CheckWitness failed - registerApp must be signed by the app admin');
      }
      if (!engineIds.has(engineId)) {
        throw new Error(
          `FAULT: unknown engineId '${engineId}' - register the engine before registering an app`
        );
      }
      if (apps.has(appId)) {
        throw new Error(`FAULT: appId '${appId}' already registered`);
      }

      apps.set(appId, { appId, admin, engineId, accountId: null });
      return { state: 'HALT', gasconsumed: MOCK_GAS_CONSUMED, stack: [appId] };
    },

    /** @returns The app record, or `null` when the appId is not registered. */
    getApp: async (appId: string): Promise<AppRecord | null> => {
      const record = apps.get(appId);
      return record ? { ...record } : null;
    },

    materializeAccount: async (appId: string): Promise<AccountResult> => {
      const record = apps.get(appId);
      if (!record) {
        throw new Error(`FAULT: appId '${appId}' is not registered - call registerApp first`);
      }
      if (!aaCoreHash) {
        throw new Error(
          'FAULT: AA core not configured - set the UnifiedSmartWallet hash before materializing accounts'
        );
      }

      record.accountId ??= deriveAccountId(MOCK_REGISTRY_HASH, appId);
      return {
        state: 'HALT',
        gasconsumed: MOCK_GAS_CONSUMED,
        accountId: record.accountId,
        stack: [record.accountId],
      };
    },

    isRegistered: (appId: string): boolean => apps.has(appId),

    listApps: (): AppRecord[] => Array.from(apps.values(), record => ({ ...record })),
  };
}

let appIdSequence = 0;
let addressSequence = 0;

/** Fixtures shared across the validation suite. */
export const testUtils = {
  /**
   * Distinct, admission-valid appId. Counter-based rather than clock-based:
   * `Date.now()` repeats for every call inside the same millisecond, which
   * collides once duplicate registration is rejected.
   */
  generateAppId: (): string => {
    appIdSequence += 1;
    return `test-app-${appIdSequence.toString().padStart(6, '0')}`;
  },

  /** Distinct address matching {@link ADDRESS_PATTERN}. */
  generateAddress: (): string => {
    addressSequence += 1;
    return `0x${addressSequence.toString(16).padStart(40, '0')}`;
  },

  waitFor: (ms: number): Promise<void> =>
    new Promise(resolve => {
      setTimeout(resolve, ms);
    }),
};
