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
    hero-icon="📈"
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
        <NeoButton variant="primary" :loading="oracle.isRequesting" @click="fetchPrice">{{ t("fetchPrice") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
const oracle = useOracle({ appId: "miniapp-oracle-price-console" });
const asset = ref("NEO");
const latestPrice = ref<number | null>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "oracle-price-console", messages,
  template: { tabs: [{ key: "price", labelKey: "latestPrice", icon: "📈", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "asset", value: () => asset.value }, { labelKey: "latestPrice", value: () => priceDisplay.value }],
});
async function fetchPrice() { try { latestPrice.value = await oracle.getPrice(asset.value); setStatus("price loaded", "success"); } catch (e) { setStatus(String((e as Error)?.message || e), "error"); } }
const priceDisplay = computed(() => latestPrice.value == null ? "—" : `$${latestPrice.value.toFixed(4)}`);
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle.slice(0, 10) + "…" },
  { label: "Feed", value: oracle.integration.contracts.morpheusDatafeed.slice(0, 10) + "…" },
  { label: "Network", value: oracle.network },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle, variant: "accent" },
  { label: "DataFeed", value: oracle.integration.contracts.morpheusDatafeed, variant: "erobo" },
  { label: "Public API", value: oracle.integration.morpheusPublicApiUrl, variant: "success" },
]);
const appState = computed(() => ({ asset: asset.value, latestPrice: latestPrice.value }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.result-card{display:flex;flex-direction:column;gap:8px;align-items:flex-start}.result-symbol{font-size:12px;opacity:.6;text-transform:uppercase;letter-spacing:.12em}.result-price{font-size:32px;font-weight:900}</style>
