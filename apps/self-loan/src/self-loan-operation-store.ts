export type SelfLoanOperationPhase =
  | "collateral-deposit"
  | "borrow"
  | "collateral-add"
  | "repay-deposit"
  | "repay"
  | "reclaim-collateral"
  | "reclaim-repay";

export interface SelfLoanOperationScope {
  borrower: string;
  network: string;
  contract: string;
}

export interface PendingSelfLoanOperation extends SelfLoanOperationScope {
  version: 1;
  phase: SelfLoanOperationPhase;
  txid: string;
  eventName: string;
  eventAmountBase: string;
  expectedCreditBase?: string;
  expectedCollateralBase?: string;
  expectedDebtBase?: string;
  expectedLtvBps?: string;
  expectedDisbursedBase?: string;
  expectedLoanId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SelfLoanOperationStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export type PendingSelfLoanDraft = Omit<
  PendingSelfLoanOperation,
  "version" | "txid" | "createdAt" | "updatedAt"
>;

const STORAGE_PREFIX = "self-loan/operations/v1";

function clean(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function positiveOrZeroInteger(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

export function normalizeSelfLoanOperationScope(
  scope: SelfLoanOperationScope,
): SelfLoanOperationScope {
  return {
    borrower: clean(scope.borrower),
    network: clean(scope.network),
    contract: clean(scope.contract),
  };
}

export function selfLoanOperationStorageKey(scope: SelfLoanOperationScope): string {
  const normalized = normalizeSelfLoanOperationScope(scope);
  return [
    STORAGE_PREFIX,
    encodeURIComponent(normalized.network),
    encodeURIComponent(normalized.contract),
    encodeURIComponent(normalized.borrower),
  ].join("/");
}

export function createPendingSelfLoanOperation(
  draft: PendingSelfLoanDraft,
  txidValue: unknown,
  now = Date.now(),
): PendingSelfLoanOperation {
  const scope = normalizeSelfLoanOperationScope(draft);
  const txid = clean(txidValue);
  const eventAmountBase = positiveOrZeroInteger(draft.eventAmountBase);
  if (!scope.borrower || !scope.network || !scope.contract || !txid || !eventAmountBase) {
    throw new Error("SelfLoan operation requires an exact scope, txid, and amount.");
  }
  const optionalInteger = (value: unknown) => {
    if (value === undefined) return undefined;
    const parsed = positiveOrZeroInteger(value);
    if (parsed === null) throw new Error("SelfLoan operation contains an invalid readback value.");
    return parsed;
  };
  return {
    version: 1,
    phase: draft.phase,
    txid,
    eventName: String(draft.eventName ?? "").trim(),
    eventAmountBase,
    expectedCreditBase: optionalInteger(draft.expectedCreditBase),
    expectedCollateralBase: optionalInteger(draft.expectedCollateralBase),
    expectedDebtBase: optionalInteger(draft.expectedDebtBase),
    expectedLtvBps: optionalInteger(draft.expectedLtvBps),
    expectedDisbursedBase: optionalInteger(draft.expectedDisbursedBase),
    expectedLoanId: optionalInteger(draft.expectedLoanId),
    ...scope,
    createdAt: now,
    updatedAt: now,
  };
}

function parseStored(
  value: unknown,
  expectedScope: SelfLoanOperationScope,
): PendingSelfLoanOperation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PendingSelfLoanOperation>;
  const scope = normalizeSelfLoanOperationScope({
    borrower: raw.borrower ?? "",
    network: raw.network ?? "",
    contract: raw.contract ?? "",
  });
  const expected = normalizeSelfLoanOperationScope(expectedScope);
  if (
    raw.version !== 1
    || ![
      "collateral-deposit",
      "borrow",
      "collateral-add",
      "repay-deposit",
      "repay",
      "reclaim-collateral",
      "reclaim-repay",
    ].includes(String(raw.phase ?? ""))
    || scope.borrower !== expected.borrower
    || scope.network !== expected.network
    || scope.contract !== expected.contract
    || !clean(raw.txid)
    || !String(raw.eventName ?? "").trim()
    || positiveOrZeroInteger(raw.eventAmountBase) === null
  ) return null;
  try {
    return createPendingSelfLoanOperation(
      {
        ...scope,
        phase: raw.phase as SelfLoanOperationPhase,
        eventName: String(raw.eventName),
        eventAmountBase: String(raw.eventAmountBase),
        expectedCreditBase: raw.expectedCreditBase,
        expectedCollateralBase: raw.expectedCollateralBase,
        expectedDebtBase: raw.expectedDebtBase,
        expectedLtvBps: raw.expectedLtvBps,
        expectedDisbursedBase: raw.expectedDisbursedBase,
        expectedLoanId: raw.expectedLoanId,
      },
      raw.txid,
      Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0,
    );
  } catch {
    return null;
  }
}

export function createSelfLoanOperationStore(storage: SelfLoanOperationStorage) {
  const memory = new Map<string, PendingSelfLoanOperation>();

  const get = (scope: SelfLoanOperationScope): PendingSelfLoanOperation | null => {
    const key = selfLoanOperationStorageKey(scope);
    try {
      const parsed = parseStored(storage.get<unknown>(key, null), scope);
      if (parsed) {
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      // Same-session memory remains useful for an already-broadcast action.
    }
    return memory.get(key) ?? null;
  };

  const set = (operation: PendingSelfLoanOperation): { operation: PendingSelfLoanOperation; durable: boolean } => {
    const previous = get(operation);
    const next = {
      ...operation,
      createdAt: previous?.createdAt ?? operation.createdAt,
      updatedAt: Date.now(),
    };
    const key = selfLoanOperationStorageKey(next);
    memory.set(key, next);
    try {
      storage.set(key, next);
      const readback = parseStored(storage.get<unknown>(key, null), next);
      return { operation: next, durable: readback?.txid === next.txid };
    } catch {
      return { operation: next, durable: false };
    }
  };

  const clear = (scope: SelfLoanOperationScope): void => {
    const key = selfLoanOperationStorageKey(scope);
    memory.delete(key);
    try {
      storage.delete(key);
    } catch {
      // Best-effort cleanup after a confirmed readback.
    }
  };

  const canPersist = (scope: SelfLoanOperationScope): boolean => {
    const probeKey = `${selfLoanOperationStorageKey(scope)}/probe`;
    const probe = { nonce: `${Date.now()}:${Math.random()}` };
    try {
      storage.set(probeKey, probe);
      const readback = storage.get<{ nonce?: string }>(probeKey, null);
      storage.delete(probeKey);
      return readback?.nonce === probe.nonce;
    } catch {
      return false;
    }
  };

  return { get, set, clear, canPersist };
}
