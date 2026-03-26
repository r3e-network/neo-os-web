<template>
  <ConsoleMiniApp
    page-name="automation-copilot"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="fetchCurrentPrice"
    hero-icon="brain"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestResult')"
    :operation-title="t('automationActions')"
  >
    <template #result>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="asset" :label="t('asset')" :placeholder="t('assetPlaceholder')" />
        <NeoInput v-model="targetPrice" :label="t('targetPrice')" :placeholder="t('targetPricePlaceholder')" />
        <NeoInput v-model="schedule" :label="t('schedule')" :placeholder="t('schedulePlaceholder')" />
        <NeoInput v-model="actionName" :label="t('actionName')" :placeholder="t('actionNamePlaceholder')" />
        <div class="button-row">
          <NeoButton variant="primary" type="button" :loading="oracle.isRequesting" @click="fetchCurrentPrice" :aria-label="t('fetchPrice')">{{ t("fetchPrice") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="previewRecipePayload" :aria-label="t('previewRecipe')">{{ t("previewRecipe") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="loadRandomness" :aria-label="t('requestRandomness')">{{ t("requestRandomness") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="fetchOracleKey" :aria-label="t('fetchOracleKey')">{{ t("fetchOracleKey") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildOracleHeroStats, buildOracleOverviewStats } from "@shared/utils/console-stats";
import { useOracle } from "@shared/composables/useOracle";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { messages } from "@/locale/messages";

const oracle = useOracle({ appId: "miniapp-automation-copilot" });
const asset = ref("NEO");
const targetPrice = ref("20");
const schedule = ref("0 */6 * * *");
const actionName = ref("auto_repay_self_loan");
const latestPayload = ref<Record<string, unknown> | null>(null);
const latestPrice = ref<number | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "automation-copilot",
  messages,
  tab: { key: "automation", labelKey: "latestResult", icon: "🤖" },
  sidebarItems: [
    { labelKey: "asset", value: () => asset.value },
    { labelKey: "currentPrice", value: () => priceDisplay.value },
    { labelKey: "targetPrice", value: () => targetPrice.value || t("notAvailable") },
    { labelKey: "schedule", value: () => schedule.value || t("notAvailable") },
  ],
});

async function fetchCurrentPrice() {
  try {
    latestPrice.value = await oracle.getPrice(asset.value);
    latestPayload.value = {
      kind: "price",
      asset: asset.value,
      current_price: latestPrice.value,
      target_price: Number(targetPrice.value || "0"),
      schedule: schedule.value,
      action_name: actionName.value,
      network: oracle.network,
    };
    setStatus(t("priceLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("fetchFailed")), "error");
  }
}

function previewRecipePayload() {
  try {
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
    setStatus(t("recipeBuilt"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("recipeFailed")), "error");
  }
}

async function loadRandomness() {
  try {
    const response = await oracle.requestRandomness("automation-jitter");
    latestPayload.value = {
      kind: "randomness",
      asset: asset.value,
      randomness: response.value,
      proof: response.proof,
      request_id: response.requestId,
      attestation_hash: response.attestationHash,
    };
    setStatus(t("randomnessReady"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("randomnessFailed")), "error");
  }
}

async function fetchOracleKey() {
  try {
    latestPayload.value = await oracle.getOraclePublicKey() as Record<string, unknown>;
    setStatus(t("keyLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("keyFailed")), "error");
  }
}

const priceDisplay = computed(() => latestPrice.value == null ? t("notAvailable") : `$${latestPrice.value.toFixed(4)}`);
const renderedPayload = computed(() => JSON.stringify(latestPayload.value ?? {}, null, 2) || t("notAvailable"));

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildOracleHeroStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    network: oracle.network,
    middleLabel: t("currentPrice"),
    middleValue: priceDisplay.value,
  }),
);

const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildOracleOverviewStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    publicApiUrl: oracle.integration.morpheusPublicApiUrl,
    extra: {
      label: t("feedContract"),
      value: oracle.integration.contracts.morpheusDatafeed,
      variant: "erobo",
    },
  }),
);

const appState = computed(() => ({
  asset: asset.value,
  targetPrice: targetPrice.value,
  schedule: schedule.value,
  actionName: actionName.value,
  currentPrice: latestPrice.value,
}));
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
