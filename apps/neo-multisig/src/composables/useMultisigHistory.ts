import { ref, computed, onMounted } from "vue";

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
    const saved = uni.getStorageSync(STORAGE_KEY);
    if (saved) {
      try {
        history.value = JSON.parse(saved);
      } catch {
        history.value = [];
      }
    }
  };

  const saveHistory = () => {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(history.value));
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
    uni.removeStorageSync(STORAGE_KEY);
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
