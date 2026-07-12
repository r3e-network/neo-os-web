export const PENDING_DELIVERY_KEY = "pending-delivery:v1";
export const STALE_PENDING_DELIVERY_MS = 24 * 60 * 60 * 1000;
export const MAX_PENDING_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface PendingDelivery {
  version: 1;
  txid: string;
  sender: string;
  recipient: string;
  unlockTime: number;
  createdAt: number;
}

export interface PendingDeliveryStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface EvmReceiptView {
  status?: string;
  transactionHash?: string;
  from?: string;
  to?: string;
  logs?: Array<{ address?: string; topics?: string[] }>;
}

function isHexAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isNonZeroAddress(value: unknown): value is string {
  return isHexAddress(value) && !/^0x0{40}$/i.test(value);
}

function isTxid(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function isPendingDelivery(value: unknown): value is PendingDelivery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PendingDelivery>;
  return (
    candidate.version === 1 &&
    isTxid(candidate.txid) &&
    isNonZeroAddress(candidate.sender) &&
    isNonZeroAddress(candidate.recipient) &&
    Number.isSafeInteger(candidate.unlockTime) &&
    Number(candidate.unlockTime) >= 0 &&
    Number.isSafeInteger(candidate.createdAt) &&
    Number(candidate.createdAt) > 0 &&
    Number(candidate.createdAt) <= Date.now() + MAX_PENDING_CLOCK_SKEW_MS
  );
}

function pendingDeliveriesEqual(left: PendingDelivery, right: PendingDelivery): boolean {
  return (
    left.version === right.version &&
    left.txid.toLowerCase() === right.txid.toLowerCase() &&
    left.sender.toLowerCase() === right.sender.toLowerCase() &&
    left.recipient.toLowerCase() === right.recipient.toLowerCase() &&
    left.unlockTime === right.unlockTime &&
    left.createdAt === right.createdAt
  );
}

export function readPendingDelivery(store: PendingDeliveryStore): PendingDelivery | null {
  try {
    const value = store.get<PendingDelivery>(PENDING_DELIVERY_KEY, null);
    return isPendingDelivery(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePendingDelivery(
  store: PendingDeliveryStore,
  value: PendingDelivery,
): boolean {
  try {
    if (!isPendingDelivery(value)) return false;
    store.set(PENDING_DELIVERY_KEY, value);
    const stored = readPendingDelivery(store);
    return Boolean(stored && pendingDeliveriesEqual(stored, value));
  } catch {
    return false;
  }
}

export function clearPendingDelivery(store: PendingDeliveryStore): boolean {
  try {
    store.delete(PENDING_DELIVERY_KEY);
    return readPendingDelivery(store) === null;
  } catch {
    return false;
  }
}

export function pendingDeliveryIsStale(
  value: PendingDelivery,
  nowMs = Date.now(),
): boolean {
  return nowMs - value.createdAt >= STALE_PENDING_DELIVERY_MS;
}

export function receiptMessageId(
  receipt: EvmReceiptView,
  eventTopic: string,
  contractAddress: string,
): string | null {
  const topic = eventTopic.toLowerCase();
  const contract = contractAddress.toLowerCase();
  const logs = (receipt.logs ?? []).filter(
    (entry) =>
      String(entry.address ?? "").toLowerCase() === contract &&
      String(entry.topics?.[0] ?? "").toLowerCase() === topic,
  );
  if (logs.length !== 1) return null;
  const indexedId = logs[0]?.topics?.[1];
  if (!indexedId || !/^0x[0-9a-fA-F]{64}$/.test(indexedId)) return null;
  return BigInt(indexedId).toString();
}

export type PendingReceiptInspection =
  | { ok: true; messageId: string }
  | { ok: false; reason: "invalid" | "reverted" | "event-missing" };

/**
 * Bind a recovery receipt to the exact transaction, sender, contract and event
 * before the app accepts it as the pending delivery's confirmation.
 */
export function inspectPendingReceipt(
  receipt: EvmReceiptView,
  pending: PendingDelivery,
  eventTopic: string,
  contractAddress: string,
): PendingReceiptInspection {
  const status = String(receipt.status ?? "").trim();
  if (!/^0x[0-9a-fA-F]+$/.test(status)) return { ok: false, reason: "invalid" };
  const numericStatus = BigInt(status);
  if (numericStatus === 0n) return { ok: false, reason: "reverted" };
  if (numericStatus !== 1n) return { ok: false, reason: "invalid" };

  if (
    !isTxid(receipt.transactionHash) ||
    receipt.transactionHash.toLowerCase() !== pending.txid.toLowerCase() ||
    !isHexAddress(receipt.from) ||
    receipt.from.toLowerCase() !== pending.sender.toLowerCase() ||
    !isHexAddress(receipt.to) ||
    receipt.to.toLowerCase() !== contractAddress.toLowerCase()
  ) {
    return { ok: false, reason: "invalid" };
  }

  const messageId = receiptMessageId(receipt, eventTopic, contractAddress);
  return messageId
    ? { ok: true, messageId }
    : { ok: false, reason: "event-missing" };
}
