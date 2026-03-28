<template>
  <ConsoleMiniApp
    page-name="oracle-price-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="fetchPrice"
    hero-icon="chart_up"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestPrice')"
    :operation-title="t('fetchPrice')"
  >
    <template #result>
      <div class="result-card">
        <span class="result-symbol">{{ asset }}</span>
        <span class="result-price">{{ priceDisplay }}</span>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="asset" :label="t('asset')" :placeholder="t('assetPlaceholder')" />
        <NeoButton variant="primary" type="button" :loading="oracle.isRequesting" @click="fetchPrice" :aria-label="t('fetchPrice')">{{ t("fetchPrice") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildOracleHeroStats, buildOracleOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
import { formatErrorMessage } from "@shared/utils/errorHandling";
const oracle = useOracle({ appId: "miniapp-oracle-price-console" });
const asset = ref("NEO");
const latestPrice = ref<number | null>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-price-console", messages,
  tab: { key: "price", labelKey: "latestPrice", icon: "📈" },
  sidebarItems: [{ labelKey: "asset", value: () => asset.value }, { labelKey: "latestPrice", value: () => priceDisplay.value }],
});
async function fetchPrice() { try { latestPrice.value = await oracle.getPrice(asset.value); setStatus(t("priceLoaded"), "success"); } catch (e) { setStatus(formatErrorMessage(e, t("fetchFailed")), "error"); } }
const priceDisplay = computed(() => latestPrice.value == null ? t("notAvailable") : `$${latestPrice.value.toFixed(4)}`);
const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildOracleHeroStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    network: oracle.network,
    middleLabel: t("heroFeed"),
    middleValue: `${oracle.integration.contracts.morpheusDatafeed.slice(0, 10)}…`,
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildOracleOverviewStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    publicApiUrl: oracle.integration.morpheusPublicApiUrl,
    extra: { label: t("overviewDataFeed"), value: oracle.integration.contracts.morpheusDatafeed, variant: "erobo" },
  }),
);
const appState = computed(() => ({ asset: asset.value, latestPrice: latestPrice.value }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.result-card{display:flex;flex-direction:column;gap:8px;align-items:flex-start}.result-symbol{font-size:12px;opacity:.6;text-transform:uppercase;letter-spacing:.12em}.result-price{font-size:32px;font-weight:900}</style>
