import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { clearCachedValue, readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";

export interface HistoryItem {
  id: string;
  scriptHash: string;
  status: "pending" | "ready" | "broadcasted" | "cancelled" | "expired";
  createdAt: string;
}

const STORAGE_KEY = "multisig_history";

export function useMultisigHistory() {
  const history = createObservable<HistoryItem[]>([]);

  const pendingCount = createDerived(() =>
    history.get().filter((h) => h.status === "pending" || h.status === "ready").length
  , []);

  const completedCount = createDerived(() =>
    history.get().filter((h) => h.status === "broadcasted").length
  , []);

  const loadHistory = () => {
    const saved = readCachedJSON<HistoryItem[]>(STORAGE_KEY);
    history.set(Array.isArray(saved) ? saved : []);
  };

  const saveHistory = () => {
    try {
      writeCachedJSON(STORAGE_KEY, history.get());
    } catch (err) {
      console.warn("[useMultisigHistory] saveHistory failed:", err instanceof Error ? err.message : String(err));
    }
  };

  const addToHistory = (item: HistoryItem) => {
    const exists = history.get().find((h) => h.id === item.id);
    if (!exists) {
      history.set([item, ...history.get()]);
      saveHistory();
    }
  };

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    const items = history.get();
    const index = items.findIndex((h) => h.id === id);
    if (index !== -1) {
      const updated = [...items];
      updated[index] = { ...updated[index], ...updates };
      history.set(updated);
      saveHistory();
    }
  };

  const removeFromHistory = (id: string) => {
    history.set(history.get().filter((h) => h.id !== id));
    saveHistory();
  };

  const clearHistory = () => {
    history.set([]);
    clearCachedValue(STORAGE_KEY);
  };

  // Caller is responsible for calling loadHistory() on mount

  return {
    history,
    pendingCount,
    completedCount,
    loadHistory,
    saveHistory,
    addToHistory,
    updateHistoryItem,
    removeFromHistory,
    clearHistory,
  };
}
