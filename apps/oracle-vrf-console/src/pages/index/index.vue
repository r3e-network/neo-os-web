<template>
  <OracleConsoleMiniApp
    page-name="oracle-vrf-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="requestRandom"
    hero-icon="🎲"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestResult')"
    :operation-title="t('requestRandom')"
  >
    <template #result>
      <div class="result-grid">
        <div><span class="label">Request</span><span class="value">{{ lastRandom?.requestId || "—" }}</span></div>
        <div><span class="label">Value</span><span class="value">{{ lastRandom?.value || "—" }}</span></div>
        <div><span class="label">Proof</span><span class="value">{{ lastRandom?.proof || "—" }}</span></div>
      </div>
    </template>
    <template #operation>
      <NeoButton variant="primary" :loading="oracle.isRequesting" @click="requestRandom">{{ t("requestRandom") }}</NeoButton>
    </template>
  </OracleConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { HeroStatsStrip, NeoButton, OracleConsoleMiniApp } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
const oracle = useOracle({ appId: "miniapp-oracle-vrf-console" });
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "oracle-vrf-console", messages,
  template: { tabs: [{ key: "vrf", labelKey: "latestResult", icon: "🎲", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "latestResult", value: () => oracle.lastRandom.value?.requestId || "—" }],
});
const lastRandom = oracle.lastRandom;
async function requestRandom() { try { await oracle.requestRandomness(); setStatus("randomness requested", "success"); } catch (e) { setStatus(String((e as Error)?.message || e), "error"); } }
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle.slice(0, 10) + "…" },
  { label: "VRF", value: "direct" },
  { label: "Network", value: oracle.network },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle, variant: "accent" },
  { label: "Public API", value: oracle.integration.morpheusPublicApiUrl, variant: "success" },
]);
const appState = computed(() => ({ requestId: oracle.lastRandom.value?.requestId || "" }));
</script>
<style scoped>.result-grid{display:grid;grid-template-columns:1fr;gap:12px}.label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}.value{display:block;margin-top:6px;font-size:13px;word-break:break-all}</style>
