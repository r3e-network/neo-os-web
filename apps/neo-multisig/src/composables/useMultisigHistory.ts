import { createObservable, createDerived } from "@shared/react/context";
import { clearCachedValue, readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import type { RequestStatus } from "../utils/vault";

/**
 * A lightweight client-side activity log of on-chain vault actions so the user
 * can revisit vaults and spend requests they created. The contract is the
 * source of truth; these entries just record the ids + last-known status and
 * are reconciled against fresh getVault / getRequest reads on load.
 */
export interface HistoryItem {
  /** "vault" record (a custody vault) or "request" record (a spend proposal). */
  kind: "vault" | "request";
  /** On-chain id (vaultId or reqId). */
  id: number;
  /** For requests: the parent vault id. */
  vaultId?: number;
  /** For requests: last-known lifecycle status. */
  status?: RequestStatus;
  /** Human label (e.g. "12 GAS to N...") for quick recognition. */
  label: string;
  createdAt: string;
}

const STORAGE_KEY = "multisig_vault_history";

function historyKey(item: Pick<HistoryItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

export function useMultisigHistory() {
  const history = createObservable<HistoryItem[]>([]);

  const vaultCount = createDerived(
    () => history.get().filter((h) => h.kind === "vault").length,
    [],
  );

  const pendingCount = createDerived(
    () => history.get().filter((h) => h.kind === "request" && h.status === "pending").length,
    [],
  );

  const completedCount = createDerived(
    () => history.get().filter((h) => h.kind === "request" && h.status === "executed").length,
    [],
  );

  const loadHistory = () => {
    const saved = readCachedJSON<HistoryItem[]>(STORAGE_KEY);
    history.set(Array.isArray(saved) ? saved : []);
  };

  const saveHistory = () => {
    try {
      writeCachedJSON(STORAGE_KEY, history.get());
    } catch (err) {
      console.warn(
        "[useMultisigHistory] saveHistory failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  /** Insert or update an activity entry, keyed by kind + id. */
  const upsertHistory = (item: HistoryItem) => {
    const items = history.get();
    const key = historyKey(item);
    const index = items.findIndex((h) => historyKey(h) === key);
    if (index === -1) {
      history.set([item, ...items]);
    } else {
      const updated = [...items];
      updated[index] = { ...updated[index], ...item };
      history.set(updated);
    }
    saveHistory();
  };

  const updateHistoryStatus = (
    kind: HistoryItem["kind"],
    id: number,
    status: RequestStatus,
  ) => {
    const items = history.get();
    const key = historyKey({ kind, id });
    const index = items.findIndex((h) => historyKey(h) === key);
    if (index === -1) return;
    const current = items[index];
    if (!current || current.status === status) return;
    const updated = [...items];
    updated[index] = { ...current, status };
    history.set(updated);
    saveHistory();
  };

  const clearHistory = () => {
    history.set([]);
    clearCachedValue(STORAGE_KEY);
  };

  return {
    history,
    vaultCount,
    pendingCount,
    completedCount,
    loadHistory,
    saveHistory,
    upsertHistory,
    updateHistoryStatus,
    clearHistory,
  };
}
