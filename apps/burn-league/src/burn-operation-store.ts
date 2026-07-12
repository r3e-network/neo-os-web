/** Durable recovery record for an irreversible Burn League operation. */

export type BurnOperationPhase = "deposit" | "burn";

export interface BurnOperationScope {
  player: string;
  network: string;
  contract: string;
}

export interface PendingBurnOperation extends BurnOperationScope {
  version: 1;
  phase: BurnOperationPhase;
  txid: string;
  amount: string;
  /** Intended total burn in fixed8 base units. */
  amountBase: string;
  /** Amount carried by this exact deposit/burn transaction. */
  transactionAmountBase: string;
  createdAt: number;
  updatedAt: number;
}

export interface BurnOperationStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const STORAGE_PREFIX = "burn-operations/v1";

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedTxid(value: unknown): string {
  return normalized(value).replace(/^0x/, "");
}

function isPositiveDecimal(value: string): boolean {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && BigInt(value) > 0n;
}

export function normalizeBurnOperationScope(
  scope: BurnOperationScope,
): BurnOperationScope {
  return {
    player: normalized(scope.player),
    network: normalized(scope.network),
    contract: normalized(scope.contract),
  };
}

export function burnOperationStorageKey(scope: BurnOperationScope): string {
  const clean = normalizeBurnOperationScope(scope);
  return [
    STORAGE_PREFIX,
    encodeURIComponent(clean.network),
    encodeURIComponent(clean.contract),
    encodeURIComponent(clean.player),
  ].join("/");
}

export function createPendingBurnOperation(
  input: BurnOperationScope & {
    phase: BurnOperationPhase;
    txid: string;
    amount: string;
    amountBase: string;
    transactionAmountBase?: string;
    now?: number;
  },
): PendingBurnOperation {
  const scope = normalizeBurnOperationScope(input);
  const txid = normalized(input.txid);
  const amount = String(input.amount ?? "").trim();
  const amountBase = String(input.amountBase ?? "").trim();
  const transactionAmountBase = String(
    input.transactionAmountBase ?? input.amountBase ?? "",
  ).trim();
  if (!scope.player || !scope.network || !scope.contract || !txid) {
    throw new Error("Burn operation requires player, network, contract, and txid.");
  }
  if (
    !isPositiveDecimal(amount) ||
    !isPositiveInteger(amountBase) ||
    !isPositiveInteger(transactionAmountBase)
  ) {
    throw new Error("Burn operation requires a positive canonical amount.");
  }
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    version: 1,
    phase: input.phase,
    txid,
    amount,
    amountBase,
    transactionAmountBase,
    ...scope,
    createdAt: now,
    updatedAt: now,
  };
}

function parseStored(
  value: unknown,
  expectedScope: BurnOperationScope,
): PendingBurnOperation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PendingBurnOperation>;
  const scope = normalizeBurnOperationScope({
    player: raw.player ?? "",
    network: raw.network ?? "",
    contract: raw.contract ?? "",
  });
  const expected = normalizeBurnOperationScope(expectedScope);
  const txid = normalized(raw.txid);
  const amount = String(raw.amount ?? "").trim();
  const amountBase = String(raw.amountBase ?? "").trim();
  const transactionAmountBase = String(
    raw.transactionAmountBase ?? raw.amountBase ?? "",
  ).trim();
  if (
    raw.version !== 1 ||
    (raw.phase !== "deposit" && raw.phase !== "burn") ||
    scope.player !== expected.player ||
    scope.network !== expected.network ||
    scope.contract !== expected.contract ||
    !txid ||
    !isPositiveDecimal(amount) ||
    !isPositiveInteger(amountBase) ||
    !isPositiveInteger(transactionAmountBase)
  ) {
    return null;
  }
  const createdAt = Number(raw.createdAt);
  const updatedAt = Number(raw.updatedAt);
  return {
    version: 1,
    phase: raw.phase,
    txid,
    amount,
    amountBase,
    transactionAmountBase,
    ...scope,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export function createBurnOperationStore(storage: BurnOperationStorage) {
  // Keep same-session recovery working even when the host disables persistent
  // storage (private browsing / embedded sandbox). Persistent storage remains
  // the refresh-survival authority whenever it is available.
  const memory = new Map<string, PendingBurnOperation>();

  const get = (scope: BurnOperationScope): PendingBurnOperation | null => {
    const key = burnOperationStorageKey(scope);
    try {
      const parsed = parseStored(storage.get<unknown>(key, null), scope);
      if (parsed) {
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      // Fall through to the same-session copy.
    }
    return memory.get(key) ?? null;
  };

  const set = (operation: PendingBurnOperation): PendingBurnOperation => {
    const previous = get(operation);
    const next = {
      ...operation,
      createdAt: previous?.createdAt ?? operation.createdAt,
      updatedAt: Date.now(),
    };
    memory.set(burnOperationStorageKey(operation), next);
    try {
      storage.set(burnOperationStorageKey(operation), next);
    } catch {
      // Sandboxed/disabled localStorage must not change transaction semantics.
    }
    return next;
  };

  const clear = (scope: BurnOperationScope): void => {
    memory.delete(burnOperationStorageKey(scope));
    try {
      storage.delete(burnOperationStorageKey(scope));
    } catch {
      // Best-effort cleanup only.
    }
  };

  return { get, set, clear };
}

export function burnEventTransactionId(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const raw = event as Record<string, unknown>;
  return normalized(raw.tx_hash ?? raw.txid ?? raw.transaction_hash);
}

export function findBurnEventByExactTransaction(
  events: unknown[],
  txid: string,
): unknown | null {
  const expected = normalizedTxid(txid);
  if (!expected) return null;
  return (
    events.find(
      (event) => normalizedTxid(burnEventTransactionId(event)) === expected,
    ) ?? null
  );
}
