/**
 * Refresh-surviving recovery record for Red Envelope money-moving operations.
 *
 * One account can have at most one unresolved operation for a contract/network
 * scope. The exact transaction id is mandatory: recovery must never guess from
 * the newest event emitted by somebody else.
 */

export type RedEnvelopeOperationPhase =
  | "deposit"
  | "create"
  | "claim"
  | "reclaim"
  | "withdraw";

export interface RedEnvelopeOperationScope {
  account: string;
  network: string;
  contract: string;
}

export interface PendingRedEnvelopeOperation extends RedEnvelopeOperationScope {
  version: 1;
  phase: RedEnvelopeOperationPhase;
  txid: string;
  /** Envelope total, deposited shortfall, claimed/reclaimed share, or credit. */
  amountBase: string;
  envelopeId?: string;
  packetCount?: number;
  durationSeconds?: number;
  /** Creator list length immediately before createEnvelope was submitted. */
  creatorCountBefore?: number;
  /** Opened count captured before reclaim to distinguish it from a final claim. */
  openedCountBefore?: number;
  /** creditOf(account) immediately before a deposit. */
  creditBeforeBase?: string;
  /** Required creditOf(account) after a deposit. */
  targetCreditBase?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RedEnvelopeOperationStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const STORAGE_PREFIX = "red-envelope-operations/v1";

const normalized = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const isUnsignedInteger = (value: unknown): boolean => {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text);
};

const isPositiveInteger = (value: unknown): boolean =>
  isUnsignedInteger(value) && BigInt(String(value)) > 0n;

const isPositiveId = (value: unknown): boolean => isPositiveInteger(value);

const validPhase = (value: unknown): value is RedEnvelopeOperationPhase =>
  value === "deposit" ||
  value === "create" ||
  value === "claim" ||
  value === "reclaim" ||
  value === "withdraw";

export function normalizeRedEnvelopeOperationScope(
  scope: RedEnvelopeOperationScope,
): RedEnvelopeOperationScope {
  return {
    account: normalized(scope.account),
    network: normalized(scope.network),
    contract: normalized(scope.contract),
  };
}

export function redEnvelopeOperationStorageKey(
  scope: RedEnvelopeOperationScope,
): string {
  const clean = normalizeRedEnvelopeOperationScope(scope);
  return [
    STORAGE_PREFIX,
    encodeURIComponent(clean.network),
    encodeURIComponent(clean.contract),
    encodeURIComponent(clean.account),
  ].join("/");
}

type CreatePendingInput = RedEnvelopeOperationScope &
  Omit<
    PendingRedEnvelopeOperation,
    | keyof RedEnvelopeOperationScope
    | "version"
    | "createdAt"
    | "updatedAt"
  > & { now?: number };

export function createPendingRedEnvelopeOperation(
  input: CreatePendingInput,
): PendingRedEnvelopeOperation {
  const scope = normalizeRedEnvelopeOperationScope(input);
  const txid = normalized(input.txid);
  const amountBase = String(input.amountBase ?? "").trim();
  const envelopeId = input.envelopeId === undefined
    ? undefined
    : String(input.envelopeId).trim();
  if (!scope.account || !scope.network || !scope.contract || !txid) {
    throw new Error(
      "Red Envelope operation requires account, network, contract, and txid.",
    );
  }
  if (
    !validPhase(input.phase) ||
    (input.phase === "claim"
      ? !isUnsignedInteger(amountBase)
      : !isPositiveInteger(amountBase))
  ) {
    throw new Error("Red Envelope operation requires a valid phase and amount.");
  }
  if (
    (input.phase === "claim" || input.phase === "reclaim") &&
    !isPositiveId(envelopeId)
  ) {
    throw new Error("Red Envelope claim/reclaim requires an envelope id.");
  }
  if (
    input.phase === "create" &&
    (!Number.isInteger(input.packetCount) ||
      Number(input.packetCount) <= 0 ||
      !Number.isInteger(input.durationSeconds) ||
      Number(input.durationSeconds) <= 0 ||
      !Number.isInteger(input.creatorCountBefore) ||
      Number(input.creatorCountBefore) < 0)
  ) {
    throw new Error("Red Envelope create recovery metadata is incomplete.");
  }
  if (
    input.phase === "reclaim" &&
    (!Number.isInteger(input.openedCountBefore) ||
      Number(input.openedCountBefore) < 0 ||
      !Number.isInteger(input.packetCount) ||
      Number(input.packetCount) <= Number(input.openedCountBefore))
  ) {
    throw new Error("Red Envelope reclaim recovery metadata is incomplete.");
  }
  if (
    input.phase === "deposit" &&
    (!isUnsignedInteger(input.creditBeforeBase) ||
      !isPositiveInteger(input.targetCreditBase))
  ) {
    throw new Error("Red Envelope deposit recovery metadata is incomplete.");
  }

  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    version: 1,
    ...scope,
    phase: input.phase,
    txid,
    amountBase,
    ...(envelopeId ? { envelopeId } : {}),
    ...(input.packetCount === undefined ? {} : { packetCount: input.packetCount }),
    ...(input.durationSeconds === undefined
      ? {}
      : { durationSeconds: input.durationSeconds }),
    ...(input.creatorCountBefore === undefined
      ? {}
      : { creatorCountBefore: input.creatorCountBefore }),
    ...(input.openedCountBefore === undefined
      ? {}
      : { openedCountBefore: input.openedCountBefore }),
    ...(input.creditBeforeBase === undefined
      ? {}
      : { creditBeforeBase: String(input.creditBeforeBase) }),
    ...(input.targetCreditBase === undefined
      ? {}
      : { targetCreditBase: String(input.targetCreditBase) }),
    createdAt: now,
    updatedAt: now,
  };
}

function parseStored(
  value: unknown,
  expectedScope: RedEnvelopeOperationScope,
): PendingRedEnvelopeOperation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PendingRedEnvelopeOperation>;
  if (raw.version !== 1 || !validPhase(raw.phase)) return null;
  try {
    const parsed = createPendingRedEnvelopeOperation({
      account: String(raw.account ?? ""),
      network: String(raw.network ?? ""),
      contract: String(raw.contract ?? ""),
      phase: raw.phase,
      txid: String(raw.txid ?? ""),
      amountBase: String(raw.amountBase ?? ""),
      envelopeId: raw.envelopeId,
      packetCount: raw.packetCount,
      durationSeconds: raw.durationSeconds,
      creatorCountBefore: raw.creatorCountBefore,
      openedCountBefore: raw.openedCountBefore,
      creditBeforeBase: raw.creditBeforeBase,
      targetCreditBase: raw.targetCreditBase,
      now: Number(raw.createdAt),
    });
    const expected = normalizeRedEnvelopeOperationScope(expectedScope);
    if (
      parsed.account !== expected.account ||
      parsed.network !== expected.network ||
      parsed.contract !== expected.contract
    ) {
      return null;
    }
    const updatedAt = Number(raw.updatedAt);
    return {
      ...parsed,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function createRedEnvelopeOperationStore(
  storage: RedEnvelopeOperationStorage,
) {
  // Embedded/private hosts can reject persistent storage. Keep same-session
  // safety in memory while treating durable storage as the refresh authority.
  const memory = new Map<string, PendingRedEnvelopeOperation>();

  const get = (
    scope: RedEnvelopeOperationScope,
  ): PendingRedEnvelopeOperation | null => {
    const key = redEnvelopeOperationStorageKey(scope);
    try {
      const parsed = parseStored(storage.get<unknown>(key, null), scope);
      if (parsed) {
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      // Fall through to the same-session record.
    }
    return memory.get(key) ?? null;
  };

  const set = (
    operation: PendingRedEnvelopeOperation,
  ): PendingRedEnvelopeOperation => {
    const key = redEnvelopeOperationStorageKey(operation);
    const previous = get(operation);
    const next = {
      ...operation,
      createdAt: previous?.createdAt ?? operation.createdAt,
      updatedAt: Date.now(),
    };
    memory.set(key, next);
    try {
      storage.set(key, next);
    } catch {
      // Transaction semantics cannot depend on localStorage availability.
    }
    return next;
  };

  const clear = (scope: RedEnvelopeOperationScope): void => {
    const key = redEnvelopeOperationStorageKey(scope);
    memory.delete(key);
    try {
      storage.delete(key);
    } catch {
      // Best-effort cleanup only.
    }
  };

  const canPersist = (scope: RedEnvelopeOperationScope): boolean => {
    const key = `${redEnvelopeOperationStorageKey(scope)}/__probe`;
    const token = `probe:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      storage.set(key, token);
      const persisted = storage.get<string>(key, null) === token;
      storage.delete(key);
      return persisted;
    } catch {
      try {
        storage.delete(key);
      } catch {
        // Best-effort cleanup only; the failed probe already blocks writes.
      }
      return false;
    }
  };

  return { get, set, clear, canPersist };
}
