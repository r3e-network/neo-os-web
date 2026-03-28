/**
 * usePriceConsole -- Domain logic for Oracle Price Console
 *
 * Receives OracleService from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService } from "@shared/services";

export interface UsePriceConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function usePriceConsole({ oracle, t }: UsePriceConsoleOptions) {
  const asset = ref("NEO");
  const latestPrice = ref<number | null>(null);

  const priceDisplay = computed(() =>
    latestPrice.value == null ? t("notAvailable") : `$${latestPrice.value.toFixed(4)}`,
  );

  // State values for manifest bindings
  const oracleHash = computed(() => oracle.integration.contracts.morpheusOracle);
  const networkDisplay = computed(() => oracle.network);
  const datafeedHash = computed(() => oracle.integration.contracts.morpheusDatafeed);
  const datafeedShort = computed(() => `${oracle.integration.contracts.morpheusDatafeed.slice(0, 10)}...`);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);

  async function fetchPrice() {
    const result = await oracle.getPrice(asset.value);
    latestPrice.value = result.price;
    return { success: true };
  }

  const loadAll = async () => {
    // No initial data to load for price console
  };

  return {
    // State
    asset,
    latestPrice,
    priceDisplay,
    oracleHash,
    networkDisplay,
    datafeedHash,
    datafeedShort,
    publicApiUrl,
    isRequesting: oracle.isRequesting,

    // Actions
    fetchPrice,
    loadAll,
  };
}

export type UsePriceConsoleReturn = ReturnType<typeof usePriceConsole>;
