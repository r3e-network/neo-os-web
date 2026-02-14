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
