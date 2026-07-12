/**
 * Durable, scope-isolated settlement intents for Dice.
 *
 * A pending wager is financial state, not UI state.  The record therefore
 * survives reloads and is isolated by player + network + contract.  Its local
 * id is derived from the exact placement transaction, while `betId` (Neo N3)
 * or `requestId` (Neo X) is the only identity accepted for settlement.
 */

export type DicePendingLane = "n3" | "evm";
export type DicePendingPhase = "broadcast" | "pending" | "unknown";
export type DicePendingTerminal = "confirmed" | "faulted";

export interface DicePendingScope {
  player: string;
  network: string;
  contract: string;
}

export interface DicePendingBet extends DicePendingScope {
  version: 1;
  localId: string;
  lane: DicePendingLane;
  /** Placement/commit transaction id (never the separate N3 GAS deposit tx). */
  txid: string;
  /** Neo N3 commit id. */
  betId: string;
  /** Neo X VRF request id. */
  requestId: string;
  /** User-facing decimal GAS amount plus its exact N3 base-unit representation. */
  amount: string;
  amountFixed8: string;
  selection: string;
  phase: DicePendingPhase;
  createdAt: number;
  updatedAt: number;
}

export interface DicePendingStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

type CreatePendingInput = DicePendingScope & {
  lane: DicePendingLane;
  txid: string;
  betId?: string;
  requestId?: string;
  amount: string;
  amountFixed8: string;
  selection: string;
  phase?: DicePendingPhase;
  now?: number;
};

const STORAGE_PREFIX = "pending-bets/v1";

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedId(value: unknown): string {
  return normalized(value);
}

export function normalizeDicePendingScope(
  scope: DicePendingScope,
): DicePendingScope {
  return {
    player: normalized(scope.player),
    network: normalized(scope.network),
    contract: normalized(scope.contract),
  };
}

export function dicePendingStorageKey(scope: DicePendingScope): string {
  const clean = normalizeDicePendingScope(scope);
  return [
    STORAGE_PREFIX,
    encodeURIComponent(clean.network),
    encodeURIComponent(clean.contract),
    encodeURIComponent(clean.player),
  ].join("/");
}

export function createDicePendingBet(input: CreatePendingInput): DicePendingBet {
  const scope = normalizeDicePendingScope(input);
  const txid = normalizedId(input.txid);
  const betId = String(input.betId ?? "").trim();
  const requestId = String(input.requestId ?? "").trim();
  const amount = String(input.amount ?? "").trim();
  const amountFixed8 = String(input.amountFixed8 ?? "").trim();
  const selection = String(input.selection ?? "").trim();
  if (!scope.player || !scope.network || !scope.contract) {
    throw new Error("Dice pending bet requires player, network, and contract scope.");
  }
  if (!txid) throw new Error("Dice pending bet requires a placement txid.");
  if (!/^\d+(?:\.\d+)?$/.test(amount) || !/^\d+$/.test(amountFixed8)) {
    throw new Error("Dice pending bet requires a valid amount.");
  }
  if (!/^[1-6]$/.test(selection)) {
    throw new Error("Dice pending bet requires a selection from 1 to 6.");
  }
  if (input.lane === "n3" && requestId) {
    throw new Error("Neo N3 pending bets cannot carry an EVM request id.");
  }
  if (input.lane === "evm" && betId) {
    throw new Error("Neo X pending bets cannot carry an N3 bet id.");
  }
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    version: 1,
    localId: `${input.lane}:${txid}`,
    lane: input.lane,
    ...scope,
    txid,
    betId,
    requestId,
    amount,
    amountFixed8,
    selection,
    phase: input.phase ?? (betId || requestId ? "pending" : "broadcast"),
    createdAt: now,
    updatedAt: now,
  };
}

function isPhase(value: unknown): value is DicePendingPhase {
  return value === "broadcast" || value === "pending" || value === "unknown";
}

function parseStoredRecord(
  value: unknown,
  expectedScope: DicePendingScope,
): DicePendingBet | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DicePendingBet>;
  const scope = normalizeDicePendingScope({
    player: raw.player ?? "",
    network: raw.network ?? "",
    contract: raw.contract ?? "",
  });
  const expected = normalizeDicePendingScope(expectedScope);
  if (
    scope.player !== expected.player ||
    scope.network !== expected.network ||
    scope.contract !== expected.contract
  ) {
    return null;
  }
  const lane = raw.lane === "n3" || raw.lane === "evm" ? raw.lane : null;
  const txid = normalizedId(raw.txid);
  const betId = String(raw.betId ?? "").trim();
  const requestId = String(raw.requestId ?? "").trim();
  const amount = String(raw.amount ?? "").trim();
  const amountFixed8 = String(raw.amountFixed8 ?? "").trim();
  const selection = String(raw.selection ?? "").trim();
  if (
    raw.version !== 1 ||
    !lane ||
    !txid ||
    !/^\d+(?:\.\d+)?$/.test(amount) ||
    !/^\d+$/.test(amountFixed8) ||
    !/^[1-6]$/.test(selection) ||
    (lane === "n3" && Boolean(requestId)) ||
    (lane === "evm" && Boolean(betId))
  ) {
    return null;
  }
  const localId = `${lane}:${txid}`;
  const createdAt = Number(raw.createdAt);
  const updatedAt = Number(raw.updatedAt);
  return {
    version: 1,
    localId,
    lane,
    ...scope,
    txid,
    betId,
    requestId,
    amount,
    amountFixed8,
    selection,
    phase: isPhase(raw.phase) ? raw.phase : "unknown",
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export function createDicePendingBetStore(storage: DicePendingStorage) {
  const list = (scope: DicePendingScope): DicePendingBet[] => {
    const key = dicePendingStorageKey(scope);
    let raw: unknown = [];
    try {
      raw = storage.get<unknown>(key, []);
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const unique = new Map<string, DicePendingBet>();
    for (const value of raw) {
      const parsed = parseStoredRecord(value, scope);
      if (parsed) unique.set(parsed.localId, parsed);
    }
    return [...unique.values()].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
  };

  const write = (scope: DicePendingScope, records: DicePendingBet[]) => {
    const key = dicePendingStorageKey(scope);
    try {
      if (records.length === 0) storage.delete(key);
      else storage.set(key, records);
    } catch {
      // Storage can be denied in sandboxed embeds. Runtime settlement continues;
      // the app simply cannot promise cross-refresh recovery in that environment.
    }
  };

  const upsert = (record: DicePendingBet): DicePendingBet => {
    const records = list(record);
    const index = records.findIndex((item) => item.localId === record.localId);
    if (index >= 0) {
      records[index] = {
        ...record,
        createdAt: records[index]?.createdAt ?? record.createdAt,
        updatedAt: Date.now(),
      };
    } else {
      records.push(record);
    }
    write(record, records);
    return record;
  };

  const updateIdentity = (
    record: DicePendingBet,
    identity: { betId?: string; requestId?: string },
    phase: DicePendingPhase = "pending",
  ): DicePendingBet => {
    const next: DicePendingBet = {
      ...record,
      betId:
        record.lane === "n3"
          ? String(identity.betId ?? record.betId).trim()
          : "",
      requestId:
        record.lane === "evm"
          ? String(identity.requestId ?? record.requestId).trim()
          : "",
      phase,
      updatedAt: Date.now(),
    };
    upsert(next);
    return next;
  };

  const markUnknown = (record: DicePendingBet): DicePendingBet =>
    updateIdentity(record, {}, "unknown");

  /** Pending records are removed only for a terminal, chain-backed outcome. */
  const clear = (
    record: DicePendingBet,
    _terminal: DicePendingTerminal,
  ): void => {
    write(
      record,
      list(record).filter((item) => item.localId !== record.localId),
    );
  };

  return { list, upsert, updateIdentity, markUnknown, clear };
}

export type DicePendingBetStore = ReturnType<typeof createDicePendingBetStore>;

export function eventTransactionId(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const raw = event as Record<string, unknown>;
  return normalizedId(
    raw.tx_hash ?? raw.txid ?? raw.transaction_hash ?? raw.transactionHash,
  );
}

/** Exact transaction match only. Never falls back to a player's newest event. */
export function findEventByExactTransaction(
  events: unknown[],
  txid: string,
): unknown | null {
  const expected = normalizedId(txid);
  if (!expected) return null;
  return events.find((event) => eventTransactionId(event) === expected) ?? null;
}
