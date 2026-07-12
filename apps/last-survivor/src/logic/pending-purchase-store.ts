/**
 * Durable write journal for Last Survivor.
 *
 * Every signed operation is scoped to one network + contract + player. A
 * broadcast stays locked until the exact transaction event and an
 * authoritative contract readback agree. The legacy v1 purchase record is
 * still readable so an older unresolved purchase cannot be replayed after an
 * upgrade.
 */

export interface PendingPurchaseScope {
  network: string;
  contract: string;
  player: string;
}

interface PendingOperationBase extends PendingPurchaseScope {
  version: 2;
  txid: string;
  createdAt: number;
}

export interface PendingPurchase extends PendingOperationBase {
  kind: "purchase";
  roundId: string;
  count: string;
  cost: string;
}

export interface PendingDeposit extends PendingOperationBase {
  kind: "deposit";
  amount: string;
  expectedCredit: string;
}

export interface PendingSettlement extends PendingOperationBase {
  kind: "settle";
  roundId: string;
  winner: string;
  pot: string;
  nextRoundId: string;
}

export interface PendingWithdrawal extends PendingOperationBase {
  kind: "withdraw";
  beforeCredit: string;
}

export type PendingLastSurvivorOperation =
  | PendingPurchase
  | PendingDeposit
  | PendingSettlement
  | PendingWithdrawal;

export type PendingLastSurvivorOperationInput =
  | Pick<PendingPurchase, "kind" | "txid" | "roundId" | "count" | "cost">
  | Pick<PendingPurchase, "txid" | "roundId" | "count" | "cost">
  | Pick<PendingDeposit, "kind" | "txid" | "amount" | "expectedCredit">
  | Pick<PendingSettlement, "kind" | "txid" | "roundId" | "winner" | "pot" | "nextRoundId">
  | Pick<PendingWithdrawal, "kind" | "txid" | "beforeCredit">;

export interface PendingPurchaseStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const PREFIX = "pending-operation/v2";
const LEGACY_PREFIX = "pending-purchase/v1";
const PROBE_KEY = `${PREFIX}/storage-probe`;
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;
const TXID_PATTERN = /^0x[0-9a-f]{64}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

const clean = (value: unknown) => String(value ?? "").trim().toLowerCase();
const cleanTxid = (value: unknown) => {
  const raw = clean(value);
  return /^[0-9a-f]{64}$/.test(raw) ? `0x${raw}` : raw;
};

export function normalizePendingPurchaseScope(
  scope: PendingPurchaseScope,
): PendingPurchaseScope {
  return {
    network: clean(scope.network),
    contract: clean(scope.contract),
    player: clean(scope.player),
  };
}

export function pendingOperationKey(scope: PendingPurchaseScope): string {
  const normalized = normalizePendingPurchaseScope(scope);
  return [
    PREFIX,
    encodeURIComponent(normalized.network),
    encodeURIComponent(normalized.contract),
    encodeURIComponent(normalized.player),
  ].join("/");
}

/** Compatibility name retained for focused tests and older imports. */
export const pendingPurchaseKey = pendingOperationKey;

function legacyPendingPurchaseKey(scope: PendingPurchaseScope): string {
  const normalized = normalizePendingPurchaseScope(scope);
  return [
    LEGACY_PREFIX,
    encodeURIComponent(normalized.network),
    encodeURIComponent(normalized.contract),
    encodeURIComponent(normalized.player),
  ].join("/");
}

function validScope(scope: PendingPurchaseScope): boolean {
  return (
    /^(?:neo-n3-)?(?:mainnet|testnet)$/.test(scope.network) &&
    HASH160_PATTERN.test(scope.contract) &&
    HASH160_PATTERN.test(scope.player)
  );
}

function parseOperation(
  raw: unknown,
  expectedScope: PendingPurchaseScope,
): PendingLastSurvivorOperation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const scope = normalizePendingPurchaseScope({
    network: String(value.network ?? ""),
    contract: String(value.contract ?? ""),
    player: String(value.player ?? ""),
  });
  const expected = normalizePendingPurchaseScope(expectedScope);
  const txid = cleanTxid(value.txid);
  const createdAt = Number(value.createdAt);
  const kind = String(value.kind ?? "");
  if (
    value.version !== 2 ||
    !validScope(scope) ||
    scope.network !== expected.network ||
    scope.contract !== expected.contract ||
    scope.player !== expected.player ||
    !TXID_PATTERN.test(txid) ||
    !Number.isFinite(createdAt) ||
    createdAt <= 0
  ) return null;

  const base = { version: 2 as const, ...scope, txid, createdAt };
  if (kind === "purchase") {
    const roundId = String(value.roundId ?? "").trim();
    const count = String(value.count ?? "").trim();
    const cost = String(value.cost ?? "").trim();
    if (
      !POSITIVE_INTEGER_PATTERN.test(roundId) ||
      !POSITIVE_INTEGER_PATTERN.test(count) ||
      !POSITIVE_INTEGER_PATTERN.test(cost)
    ) return null;
    return { ...base, kind, roundId, count, cost };
  }
  if (kind === "deposit") {
    const amount = String(value.amount ?? "").trim();
    const expectedCredit = String(value.expectedCredit ?? "").trim();
    if (
      !POSITIVE_INTEGER_PATTERN.test(amount) ||
      !POSITIVE_INTEGER_PATTERN.test(expectedCredit)
    ) return null;
    return { ...base, kind, amount, expectedCredit };
  }
  if (kind === "settle") {
    const roundId = String(value.roundId ?? "").trim();
    const winner = clean(value.winner);
    const pot = String(value.pot ?? "").trim();
    const nextRoundId = String(value.nextRoundId ?? "").trim();
    if (
      !POSITIVE_INTEGER_PATTERN.test(roundId) ||
      !HASH160_PATTERN.test(winner) ||
      !POSITIVE_INTEGER_PATTERN.test(pot) ||
      !POSITIVE_INTEGER_PATTERN.test(nextRoundId)
    ) return null;
    return { ...base, kind, roundId, winner, pot, nextRoundId };
  }
  if (kind === "withdraw") {
    const beforeCredit = String(value.beforeCredit ?? "").trim();
    if (!POSITIVE_INTEGER_PATTERN.test(beforeCredit)) return null;
    return { ...base, kind, beforeCredit };
  }
  return null;
}

function parseLegacyPurchase(
  raw: unknown,
  expectedScope: PendingPurchaseScope,
): PendingPurchase | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const scope = normalizePendingPurchaseScope({
    network: String(value.network ?? ""),
    contract: String(value.contract ?? ""),
    player: String(value.player ?? ""),
  });
  const expected = normalizePendingPurchaseScope(expectedScope);
  const txid = cleanTxid(value.txid);
  const roundId = String(value.roundId ?? "").trim();
  const count = String(value.count ?? "").trim();
  const cost = String(value.cost ?? "").trim();
  const createdAt = Number(value.createdAt);
  if (
    value.version !== 1 ||
    !validScope(scope) ||
    scope.network !== expected.network ||
    scope.contract !== expected.contract ||
    scope.player !== expected.player ||
    !TXID_PATTERN.test(txid) ||
    !POSITIVE_INTEGER_PATTERN.test(roundId) ||
    !POSITIVE_INTEGER_PATTERN.test(count) ||
    !POSITIVE_INTEGER_PATTERN.test(cost)
  ) return null;
  return {
    version: 2,
    kind: "purchase",
    ...scope,
    txid,
    roundId,
    count,
    cost,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 1,
  };
}

function sameOperation(
  left: PendingLastSurvivorOperation | null,
  right: PendingLastSurvivorOperation,
): boolean {
  return Boolean(left && JSON.stringify(left) === JSON.stringify(right));
}

export function createPendingPurchaseStore(storage: PendingPurchaseStorage) {
  let memoryFallback: PendingLastSurvivorOperation | null = null;

  const readStored = (key: string): unknown => storage.get<unknown>(key, null);

  const assertAvailable = () => {
    const marker = { version: 1, token: `${Date.now()}-${Math.random()}` };
    try {
      storage.set(PROBE_KEY, marker);
      const restored = storage.get<typeof marker | null>(PROBE_KEY, null);
      if (restored?.token !== marker.token) throw new Error("probe readback mismatch");
      storage.delete(PROBE_KEY);
      if (storage.get<unknown>(PROBE_KEY, null) !== null) {
        throw new Error("probe delete mismatch");
      }
    } catch {
      try { storage.delete(PROBE_KEY); } catch { /* best-effort cleanup */ }
      throw new Error("Last Survivor recovery storage is unavailable.");
    }
  };

  const load = (scope: PendingPurchaseScope): PendingLastSurvivorOperation | null => {
    const normalized = normalizePendingPurchaseScope(scope);
    try {
      const currentRaw = readStored(pendingOperationKey(normalized));
      if (currentRaw !== null && currentRaw !== undefined) {
        const parsed = parseOperation(currentRaw, normalized);
        if (!parsed) throw new Error("Invalid Last Survivor pending operation.");
        memoryFallback = parsed;
        return parsed;
      }
      const legacyRaw = readStored(legacyPendingPurchaseKey(normalized));
      if (legacyRaw !== null && legacyRaw !== undefined) {
        const parsed = parseLegacyPurchase(legacyRaw, normalized);
        if (!parsed) throw new Error("Invalid Last Survivor pending operation.");
        memoryFallback = parsed;
        return parsed;
      }
      return parseOperation(memoryFallback, normalized);
    } catch (error) {
      const memory = parseOperation(memoryFallback, normalized);
      if (memory) return memory;
      throw error;
    }
  };

  const save = (
    scope: PendingPurchaseScope,
    input: PendingLastSurvivorOperationInput,
  ): PendingLastSurvivorOperation => {
    const normalized = normalizePendingPurchaseScope(scope);
    const normalizedInput = "kind" in input ? input : { kind: "purchase" as const, ...input };
    const record = parseOperation(
      {
        version: 2,
        ...normalized,
        ...normalizedInput,
        txid: cleanTxid(input.txid),
        createdAt: Date.now(),
      },
      normalized,
    );
    if (!record) throw new Error("Invalid Last Survivor pending operation.");
    // save() is called only after a wallet has returned an exact transaction
    // hash. Keep that no-replay boundary in memory before touching durable
    // storage so a quota/sandbox change after preflight cannot make the current
    // session forget a transaction that may already be on-chain.
    memoryFallback = record;
    assertAvailable();
    storage.set(pendingOperationKey(normalized), record);
    const restored = parseOperation(readStored(pendingOperationKey(normalized)), normalized);
    if (!sameOperation(restored, record)) {
      throw new Error("Last Survivor recovery storage is unavailable.");
    }
    return record;
  };

  const isDurable = (
    scope: PendingPurchaseScope,
    record: PendingLastSurvivorOperation,
  ): boolean => {
    const normalized = normalizePendingPurchaseScope(scope);
    try {
      const current = parseOperation(readStored(pendingOperationKey(normalized)), normalized);
      if (sameOperation(current, record)) return true;
      const legacy = parseLegacyPurchase(readStored(legacyPendingPurchaseKey(normalized)), normalized);
      return sameOperation(legacy, record);
    } catch {
      return false;
    }
  };

  const clear = (scope: PendingPurchaseScope) => {
    const normalized = normalizePendingPurchaseScope(scope);
    storage.delete(pendingOperationKey(normalized));
    storage.delete(legacyPendingPurchaseKey(normalized));
    if (
      readStored(pendingOperationKey(normalized)) !== null ||
      readStored(legacyPendingPurchaseKey(normalized)) !== null
    ) {
      throw new Error("Last Survivor recovery storage is unavailable.");
    }
    if (parseOperation(memoryFallback, normalized)) memoryFallback = null;
  };

  return { load, save, clear, assertAvailable, isDurable };
}

export type PendingPurchaseStore = ReturnType<typeof createPendingPurchaseStore>;
