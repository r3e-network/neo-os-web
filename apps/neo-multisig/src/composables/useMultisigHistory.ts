import { ref, computed, onMounted } from "vue";
import { clearCachedValue, readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";

export interface HistoryItem {
  id: string;
  scriptHash: string;
  status: "pending" | "ready" | "broadcasted" | "cancelled" | "expired";
  createdAt: string;
}

const STORAGE_KEY = "multisig_history";

export function useMultisigHistory() {
  const history = ref<HistoryItem[]>([]);

  const pendingCount = computed(() =>
    history.value.filter((h) => h.status === "pending" || h.status === "ready").length
  );

  const completedCount = computed(() =>
    history.value.filter((h) => h.status === "broadcasted").length
  );

  const loadHistory = () => {
    const saved = readCachedJSON<HistoryItem[]>(STORAGE_KEY);
    history.value = Array.isArray(saved) ? saved : [];
  };

  const saveHistory = () => {
    try {
      writeCachedJSON(STORAGE_KEY, history.value);
    } catch (err) {
      console.warn("[useMultisigHistory] saveHistory failed:", err instanceof Error ? err.message : String(err));
    }
  };

  const addToHistory = (item: HistoryItem) => {
    const exists = history.value.find((h) => h.id === item.id);
    if (!exists) {
      history.value.unshift(item);
      saveHistory();
    }
  };

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    const index = history.value.findIndex((h) => h.id === id);
    if (index !== -1) {
      history.value[index] = { ...history.value[index], ...updates };
      saveHistory();
    }
  };

  const removeFromHistory = (id: string) => {
    history.value = history.value.filter((h) => h.id !== id);
    saveHistory();
  };

  const clearHistory = () => {
    history.value = [];
    clearCachedValue(STORAGE_KEY);
  };

  onMounted(loadHistory);

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
