/**
 * useVrfConsole -- Domain logic for Oracle VRF Console
 *
 * Receives OracleService from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService } from "@shared/services";

export interface UseVrfConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface VrfRandomResult {
  requestId: string;
  value: string;
  proof: string;
}

export function useVrfConsole({ oracle, t }: UseVrfConsoleOptions) {
  const lastRandom = ref<VrfRandomResult | null>(null);

  // State values for manifest bindings
  const requestId = computed(() => lastRandom.value?.requestId || t("notAvailable"));
  const randomValue = computed(() => lastRandom.value?.value || t("notAvailable"));
  const proof = computed(() => lastRandom.value?.proof || t("notAvailable"));
  const oracleHash = computed(() => oracle.integration.contracts.morpheusOracle);
  const networkDisplay = computed(() => oracle.network);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);

  async function requestRandom() {
    const result = await oracle.requestRandom();
    lastRandom.value = {
      requestId: result.requestId,
      value: result.randomBytes,
      proof: result.proof,
    };
    return { success: true };
  }

  const loadAll = async () => {
    // No initial data to load for VRF console
  };

  return {
    // State
    lastRandom,
    requestId,
    randomValue,
    proof,
    oracleHash,
    networkDisplay,
    publicApiUrl,
    isRequesting: oracle.isRequesting,

    // Actions
    requestRandom,
    loadAll,
  };
}

export type UseVrfConsoleReturn = ReturnType<typeof useVrfConsole>;
