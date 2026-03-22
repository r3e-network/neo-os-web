<template>
  <ConsoleMiniApp
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
    hero-icon="dice"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestResult')"
    :operation-title="t('requestRandom')"
  >
    <template #result>
      <div class="result-grid">
        <div><span class="label">{{ t("labelRequest") }}</span><span class="value">{{ lastRandom?.requestId || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelValue") }}</span><span class="value">{{ lastRandom?.value || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelProof") }}</span><span class="value">{{ lastRandom?.proof || t("notAvailable") }}</span></div>
      </div>
    </template>
    <template #operation>
      <NeoButton variant="primary" type="button" :loading="oracle.isRequesting" @click="requestRandom" :aria-label="t('requestRandom')">{{ t("requestRandom") }}</NeoButton>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, AppIcon } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildOracleHeroStats, buildOracleOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
import { formatErrorMessage } from "@shared/utils/errorHandling";
const oracle = useOracle({ appId: "miniapp-oracle-vrf-console" });
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-vrf-console", messages,
  tab: { key: "vrf", labelKey: "latestResult", icon: "🎲" },
  sidebarItems: [{ labelKey: "latestResult", value: () => oracle.lastRandom.value?.requestId || t("notAvailable") }],
});
const lastRandom = oracle.lastRandom;
async function requestRandom() { try { await oracle.requestRandomness(); setStatus(t("randomnessRequested"), "success"); } catch (e: unknown) { setStatus(formatErrorMessage(e, t("requestFailed")), "error"); } }
const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildOracleHeroStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    network: oracle.network,
    middleLabel: t("heroVrf"),
    middleValue: t("heroDirect"),
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildOracleOverviewStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    publicApiUrl: oracle.integration.morpheusPublicApiUrl,
  }),
);
const appState = computed(() => ({ requestId: oracle.lastRandom.value?.requestId || "" }));
</script>
<style scoped>.result-grid{display:grid;grid-template-columns:1fr;gap:12px}.label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}.value{display:block;margin-top:6px;font-size:13px;word-break:break-all}</style>
