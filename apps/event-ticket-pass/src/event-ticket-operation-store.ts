import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";

export type EventTicketOperationPhase =
  | "event_create"
  | "event_toggle"
  | "ticket_issue"
  | "ticket_checkin"
  | "ticket_transfer";

export interface EventTicketOperationScope {
  account: string;
  network: string;
  contract: string;
}

export interface PendingEventTicketOperation extends EventTicketOperationScope {
  version: 1;
  phase: EventTicketOperationPhase;
  txid: string;
  eventName: string;
  eventId?: string;
  tokenId?: string;
  creator?: string;
  recipient?: string;
  name?: string;
  venue?: string;
  notes?: string;
  startTime?: number;
  endTime?: number;
  maxSupply?: string;
  seat?: string;
  memo?: string;
  active?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EventTicketOperationStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const PREFIX = "event-ticket-pass-operations/v1";

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
const text = (value: unknown) => String(value ?? "").trim();
const positiveInteger = (value: unknown) => {
  const raw = text(value);
  return /^\d+$/.test(raw) && BigInt(raw) > 0n;
};
const validAccount = (value: unknown) => {
  const raw = text(value);
  return Boolean(
    addressToScriptHash(raw) ||
    /^0x[0-9a-f]{40}$/i.test(raw) ||
    // Version-1 scope keys normalized Base58 addresses to lowercase. Accept
    // that legacy stored shape structurally so an already broadcast operation
    // remains recoverable; new wallet inputs still pass the checksum path.
    /^[nN][A-Za-z0-9]{33}$/.test(raw),
  );
};
const validTokenId = (value: unknown) => {
  const [eventId, serial, extra] = text(value).split("-");
  return extra === undefined && positiveInteger(eventId) && positiveInteger(serial);
};

const isPhase = (value: unknown): value is EventTicketOperationPhase =>
  value === "event_create" ||
  value === "event_toggle" ||
  value === "ticket_issue" ||
  value === "ticket_checkin" ||
  value === "ticket_transfer";

const eventNameFor = (phase: EventTicketOperationPhase): string => ({
  event_create: "EventCreated",
  event_toggle: "EventUpdated",
  ticket_issue: "TicketIssued",
  ticket_checkin: "TicketCheckedIn",
  ticket_transfer: "Transfer",
})[phase];

export function normalizeEventTicketOperationScope(
  scope: EventTicketOperationScope,
): EventTicketOperationScope {
  return {
    account: normalized(scope.account),
    network: normalized(scope.network),
    contract: normalized(scope.contract),
  };
}

export function eventTicketOperationStorageKey(
  scope: EventTicketOperationScope,
): string {
  const normalizedScope = normalizeEventTicketOperationScope(scope);
  return [
    PREFIX,
    encodeURIComponent(normalizedScope.network),
    encodeURIComponent(normalizedScope.contract),
    encodeURIComponent(normalizedScope.account),
  ].join("/");
}

type PendingInput = EventTicketOperationScope &
  Omit<
    PendingEventTicketOperation,
    keyof EventTicketOperationScope | "version" | "eventName" | "createdAt" | "updatedAt"
  > & { now?: number };

export function createPendingEventTicketOperation(
  input: PendingInput,
): PendingEventTicketOperation {
  const scope = normalizeEventTicketOperationScope(input);
  const txid = normalized(input.txid);
  if (
    !validAccount(scope.account) ||
    (scope.network !== "mainnet" && scope.network !== "testnet") ||
    !normalizeScriptHash(scope.contract) ||
    !/^0x[0-9a-f]{64}$/.test(txid) ||
    !isPhase(input.phase)
  ) {
    throw new Error("Event Ticket recovery record is incomplete.");
  }
  const tokenId = text(input.tokenId);
  const eventId = text(input.eventId);
  if (
    (input.phase === "event_toggle" || input.phase === "ticket_issue") && !eventId
  ) {
    throw new Error("Event Ticket recovery record requires an event id.");
  }
  if (
    (input.phase === "ticket_checkin" || input.phase === "ticket_transfer") && !tokenId
  ) {
    throw new Error("Event Ticket recovery record requires a token id.");
  }
  if (input.phase === "ticket_issue" && !text(input.recipient)) {
    throw new Error("Event Ticket issuance recovery requires a recipient.");
  }
  if (input.phase === "ticket_transfer" && !text(input.recipient)) {
    throw new Error("Event Ticket transfer recovery requires a recipient.");
  }
  const creator = text(input.creator);
  const recipient = text(input.recipient);
  if (!validAccount(creator)) {
    throw new Error("Event Ticket recovery requires the signing account.");
  }
  if (eventId && !positiveInteger(eventId)) {
    throw new Error("Event Ticket recovery event id is malformed.");
  }
  if (tokenId && !validTokenId(tokenId)) {
    throw new Error("Event Ticket recovery token id is malformed.");
  }
  if ((input.phase === "ticket_issue" || input.phase === "ticket_transfer") && !validAccount(recipient)) {
    throw new Error("Event Ticket recovery recipient is malformed.");
  }
  if (input.phase === "event_create") {
    const name = text(input.name);
    const venue = text(input.venue);
    const notes = text(input.notes);
    const startTime = Number(input.startTime);
    const endTime = Number(input.endTime);
    const maxSupply = text(input.maxSupply);
    if (
      !name || name.length > 60 || !venue || venue.length > 60 || notes.length > 240 ||
      !Number.isSafeInteger(startTime) || startTime <= 0 ||
      !Number.isSafeInteger(endTime) || endTime <= startTime ||
      !positiveInteger(maxSupply) || BigInt(maxSupply) > 100_000n
    ) {
      throw new Error("Event Ticket event recovery record is malformed.");
    }
  }
  if (input.phase === "event_toggle" && typeof input.active !== "boolean") {
    throw new Error("Event Ticket status recovery record is malformed.");
  }
  if (text(input.seat).length > 24 || text(input.memo).length > 160) {
    throw new Error("Event Ticket recovery metadata exceeds contract limits.");
  }
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    version: 1,
    ...scope,
    phase: input.phase,
    txid,
    eventName: eventNameFor(input.phase),
    ...(eventId ? { eventId } : {}),
    ...(tokenId ? { tokenId } : {}),
    ...(text(input.creator) ? { creator: text(input.creator) } : {}),
    ...(text(input.recipient) ? { recipient: text(input.recipient) } : {}),
    ...(text(input.name) ? { name: text(input.name) } : {}),
    ...(text(input.venue) ? { venue: text(input.venue) } : {}),
    ...(input.phase === "event_create" && input.notes !== undefined
      ? { notes: text(input.notes) }
      : text(input.notes)
        ? { notes: text(input.notes) }
        : {}),
    ...(Number.isFinite(input.startTime) ? { startTime: Number(input.startTime) } : {}),
    ...(Number.isFinite(input.endTime) ? { endTime: Number(input.endTime) } : {}),
    ...(text(input.maxSupply) ? { maxSupply: text(input.maxSupply) } : {}),
    ...(text(input.seat) ? { seat: text(input.seat) } : {}),
    ...(text(input.memo) ? { memo: text(input.memo) } : {}),
    ...(typeof input.active === "boolean" ? { active: input.active } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function parseStored(
  value: unknown,
  scope: EventTicketOperationScope,
): PendingEventTicketOperation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PendingEventTicketOperation>;
  if (raw.version !== 1 || !isPhase(raw.phase)) return null;
  try {
    const parsed = createPendingEventTicketOperation({
      account: String(raw.account ?? ""),
      network: String(raw.network ?? ""),
      contract: String(raw.contract ?? ""),
      phase: raw.phase,
      txid: String(raw.txid ?? ""),
      eventId: raw.eventId,
      tokenId: raw.tokenId,
      creator: raw.creator,
      recipient: raw.recipient,
      name: raw.name,
      venue: raw.venue,
      notes: raw.notes,
      startTime: raw.startTime,
      endTime: raw.endTime,
      maxSupply: raw.maxSupply,
      seat: raw.seat,
      memo: raw.memo,
      active: raw.active,
      now: Number(raw.createdAt),
    });
    const expected = normalizeEventTicketOperationScope(scope);
    if (
      parsed.account !== expected.account ||
      parsed.network !== expected.network ||
      parsed.contract !== expected.contract
    ) return null;
    const updatedAt = Number(raw.updatedAt);
    return {
      ...parsed,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function sameOperation(
  left: PendingEventTicketOperation | null,
  right: PendingEventTicketOperation,
): boolean {
  if (!left) return false;
  const leftRecord = left as unknown as Record<string, unknown>;
  const rightRecord = right as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  return [...keys].every((key) => leftRecord[key] === rightRecord[key]);
}

export function createEventTicketOperationStore(
  storage: EventTicketOperationStorage,
) {
  const memory = new Map<string, PendingEventTicketOperation>();

  const get = (scope: EventTicketOperationScope): PendingEventTicketOperation | null => {
    const key = eventTicketOperationStorageKey(scope);
    try {
      const parsed = parseStored(storage.get<unknown>(key, null), scope);
      if (parsed) {
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      // Same-session recovery still works when embedded storage is unavailable.
    }
    return memory.get(key) ?? null;
  };

  const set = (operation: PendingEventTicketOperation): PendingEventTicketOperation => {
    const key = eventTicketOperationStorageKey(operation);
    const previous = get(operation);
    const next = {
      ...operation,
      createdAt: previous?.createdAt ?? operation.createdAt,
      updatedAt: Date.now(),
    };
    memory.set(key, next);
    storage.set(key, next);
    const persisted = parseStored(storage.get<unknown>(key, null), operation);
    if (!sameOperation(persisted, next)) {
      throw new Error("Event Ticket recovery record could not be persisted.");
    }
    return next;
  };

  const canPersist = (scope: EventTicketOperationScope): boolean => {
    const key = `${eventTicketOperationStorageKey(scope)}/__probe`;
    // Probe with an operation-sized record, not a tiny string. Embedded hosts
    // sometimes accept small values but reject the real recovery payload.
    const marker = {
      version: 1,
      nonce: `probe:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      phase: "ticket_transfer",
      txid: `0x${"a".repeat(64)}`,
      account: normalized(scope.account),
      network: normalized(scope.network),
      contract: normalized(scope.contract),
      recipient: "N".repeat(34),
      tokenId: "100000-100000",
      memo: "m".repeat(160),
    };
    try {
      storage.set(key, marker);
      const persisted = storage.get<typeof marker>(key, null);
      storage.delete(key);
      const cleared = storage.get<unknown>(key, null) === null;
      return JSON.stringify(persisted) === JSON.stringify(marker) && cleared;
    } catch {
      try {
        storage.delete(key);
      } catch {
        // Best-effort cleanup.
      }
      return false;
    }
  };

  const clear = (scope: EventTicketOperationScope) => {
    const key = eventTicketOperationStorageKey(scope);
    if (!canPersist(scope)) {
      throw new Error("Event Ticket recovery storage is unavailable.");
    }
    try {
      storage.delete(key);
      if (storage.get<unknown>(key, null) !== null) {
        throw new Error("Event Ticket recovery record could not be cleared.");
      }
      memory.delete(key);
    } catch {
      // Keep the in-memory record so the verified transaction can retry cleanup
      // without reopening a wallet request or pretending recovery is finished.
      throw new Error("Event Ticket recovery record could not be cleared.");
    }
  };

  return { get, set, clear, canPersist };
}
