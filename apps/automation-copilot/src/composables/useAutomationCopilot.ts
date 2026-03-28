/**
 * useAutomationCopilot -- Domain logic for Automation Copilot
 *
 * Receives OracleService from PlatformServices instead of
 * using useOracle directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService } from "@shared/services";

export interface UseAutomationCopilotOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAutomationCopilot({ oracle, t }: UseAutomationCopilotOptions) {
  const asset = ref("NEO");
  const targetPrice = ref("20");
  const schedule = ref("0 */6 * * *");
  const actionName = ref("auto_repay_self_loan");
  const latestPayload = ref<Record<string, unknown> | null>(null);
  const latestPrice = ref<number | null>(null);

  const priceDisplay = computed(() =>
    latestPrice.value == null ? t("notAvailable") : `$${latestPrice.value.toFixed(4)}`,
  );

  const renderedPayload = computed(() =>
    JSON.stringify(latestPayload.value ?? {}, null, 2) || t("notAvailable"),
  );

  // State values for manifest bindings
  const oracleHash = computed(() => oracle.integration.contracts.morpheusOracle);
  const networkDisplay = computed(() => oracle.network);
  const datafeedHash = computed(() => oracle.integration.contracts.morpheusDatafeed);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);

  async function fetchCurrentPrice() {
    const price = await oracle.getPrice(asset.value);
    latestPrice.value = price.price;
    latestPayload.value = {
      kind: "price",
      asset: asset.value,
      current_price: latestPrice.value,
      target_price: Number(targetPrice.value || "0"),
      schedule: schedule.value,
      action_name: actionName.value,
      network: oracle.network,
    };
    return { success: true };
  }

  function previewRecipePayload() {
    latestPayload.value = {
      kind: "recipe_preview",
      trigger: {
        type: "price_threshold",
        asset: asset.value,
        target_price: Number(targetPrice.value || "0"),
      },
      schedule: schedule.value,
      execution: {
        action_name: actionName.value,
        target: "aa_or_morpheus_runtime",
      },
      protections: {
        datafeed_priority: "highest",
        request_response_isolation: true,
      },
      network: oracle.network,
    };
    return { success: true };
  }

  async function loadRandomness() {
    const result = await oracle.requestRandom("automation-jitter");
    latestPayload.value = {
      kind: "randomness",
      asset: asset.value,
      randomness: result.randomBytes,
      proof: result.proof,
      request_id: result.requestId,
    };
    return { success: true };
  }

  async function fetchOracleKey() {
    const keyData = await oracle.getOraclePublicKey();
    latestPayload.value = keyData as unknown as Record<string, unknown>;
    return { success: true };
  }

  const loadAll = async () => {
    // No initial data to load for automation copilot
  };

  return {
    // State
    asset,
    targetPrice,
    schedule,
    actionName,
    latestPayload,
    latestPrice,
    priceDisplay,
    renderedPayload,
    oracleHash,
    networkDisplay,
    datafeedHash,
    publicApiUrl,
    isRequesting: oracle.isRequesting,

    // Actions
    fetchCurrentPrice,
    previewRecipePayload,
    loadRandomness,
    fetchOracleKey,
    loadAll,
  };
}

export type UseAutomationCopilotReturn = ReturnType<typeof useAutomationCopilot>;
