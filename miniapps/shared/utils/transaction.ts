import { pollForEvent } from "./errorHandling";

type TransactionResult = {
  txid?: unknown;
  txHash?: unknown;
};

export function extractTxid(tx: unknown): string {
  if (!tx || typeof tx !== "object") {
    return "";
  }

  const result = tx as TransactionResult;
  return String(result.txid || result.txHash || "");
}

export function isTxEventPendingError(error: unknown, eventName: string): boolean {
  return error instanceof Error && error.message.includes(`Event "${eventName}" not found`);
}

export async function waitForEventByTransaction<T>(
  tx: unknown,
  eventName: string,
  waitForEvent: (txid: string, eventName: string, timeoutMs?: number) => Promise<T>,
  timeoutMs?: number,
): Promise<T | null> {
  const txid = extractTxid(tx);
  if (!txid) {
    return null;
  }

  return waitForEvent(txid, eventName, timeoutMs);
}

export interface PollForTxEventParams<T extends { tx_hash?: string }> {
  listEvents: () => Promise<T[]>;
  txid: string;
  timeoutMs: number;
  pollIntervalMs?: number;
  errorMessage: string;
}

export async function pollForTxEvent<T extends { tx_hash?: string }>(
  params: PollForTxEventParams<T>,
): Promise<T | null> {
  const { listEvents, txid, timeoutMs, pollIntervalMs, errorMessage } = params;

  return pollForEvent(listEvents, (event: T) => event.tx_hash === txid, {
    timeoutMs,
    pollIntervalMs,
    errorMessage,
  });
}

export interface WaitForListedEventByTransactionParams<T extends { tx_hash?: string }> {
  listEvents: () => Promise<T[]>;
  timeoutMs: number;
  pollIntervalMs?: number;
  errorMessage: string;
}

export async function waitForListedEventByTransaction<T extends { tx_hash?: string }>(
  tx: unknown,
  params: WaitForListedEventByTransactionParams<T>,
): Promise<T | null> {
  const txid = extractTxid(tx);
  if (!txid) {
    return null;
  }

  return pollForTxEvent({ ...params, txid });
}
