/**
 * useCloudSaves - Cloud save data sync composable
 * Provides save/load functionality for MiniApp user data
 */
import { ref, onMounted } from "vue";
import { waitForSDK } from "../bridge";
import { apiGet, apiFetch } from "../api";
import { toError } from "../utils";

export interface CloudSave {
  slot_name: string;
  save_data: Record<string, unknown>;
  updated_at: string;
  version: number;
}

export interface CloudSaveOptions {
  /** Save slot name (default: 'default') */
  slot?: string;
  /** Auto-sync on mount */
  autoLoad?: boolean;
}

export function useCloudSaves(options: CloudSaveOptions = {}) {
  const { slot = "default", autoLoad = false } = options;

  const saves = ref<CloudSave[]>([]);
  const currentSave = ref<CloudSave | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDeleting = ref(false);
  const error = ref<Error | null>(null);
  const lastSyncedAt = ref<Date | null>(null);

  /**
   * Load saves from cloud
   */
  const load = async (slotName?: string): Promise<CloudSave | null> => {
    isLoading.value = true;
    error.value = null;

    try {
      const sdk = await waitForSDK();
      const appId = sdk.getConfig?.().appId || "unknown";

      const data = await apiGet<{ saves: CloudSave[] }>(`/api/miniapps/${appId}/cloud-saves`);
      saves.value = data?.saves || [];

      const targetSlot = slotName || slot;
      currentSave.value = saves.value.find((s) => s.slot_name === targetSlot) || null;
      lastSyncedAt.value = new Date();

      return currentSave.value;
    } catch (e: unknown) {
      error.value = toError(e);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Save data to cloud
   */
  const save = async (data: Record<string, unknown>, slotName?: string): Promise<boolean> => {
    isSaving.value = true;
    error.value = null;

    try {
      const sdk = await waitForSDK();
      const appId = sdk.getConfig?.().appId || "unknown";

      const result = await apiFetch<{ save: CloudSave }>(`/api/miniapps/${appId}/cloud-saves`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_name: slotName || slot,
          save_data: data,
          client_timestamp: new Date().toISOString(),
        }),
      });
      currentSave.value = result.save;
      lastSyncedAt.value = new Date();

      return true;
    } catch (e: unknown) {
      error.value = toError(e);
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * Delete a save slot
   */
  const deleteSave = async (slotName?: string): Promise<boolean> => {
    isDeleting.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      const appId = sdk.getConfig?.().appId || "unknown";

      await apiFetch(`/api/miniapps/${appId}/cloud-saves`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_name: slotName || slot }),
      });

      saves.value = saves.value.filter((s) => s.slot_name !== (slotName || slot));
      if (currentSave.value?.slot_name === (slotName || slot)) {
        currentSave.value = null;
      }

      return true;
    } catch (e: unknown) {
      error.value = toError(e);
      return false;
    } finally {
      isDeleting.value = false;
    }
  };

  // Auto-load on mount if enabled
  onMounted(() => {
    if (autoLoad) {
      load();
    }
  });

  return {
    saves,
    currentSave,
    isLoading,
    isSaving,
    isDeleting,
    error,
    lastSyncedAt,
    load,
    save,
    deleteSave,
  };
}
