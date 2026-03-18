<template>
  <OracleConsoleMiniApp
    page-name="oracle-compute-lab"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="runJob"
    hero-icon="🧠"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestJob')"
    :operation-title="t('execute')"
  >
    <template #result>
      <div class="result-grid">
        <div><span class="label">Status</span><span class="value">{{ latestJob?.status || "—" }}</span></div>
        <div><span class="label">Job</span><span class="value">{{ latestJob?.job_id || "—" }}</span></div>
        <div><span class="label">Attestation</span><span class="value">{{ latestJob?.attestation || "—" }}</span></div>
        <div><span class="label">Output</span><span class="value">{{ latestOutput }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="scriptName" :label="t('scriptName')" :placeholder="t('scriptNamePlaceholder')" />
        <label class="textarea-label">{{ t("inputJson") }}</label>
        <textarea v-model="inputJson" class="json-box" rows="8"></textarea>
        <NeoButton variant="primary" :loading="oracle.isRequesting" @click="runJob">{{ t("execute") }}</NeoButton>
      </div>
    </template>
  </OracleConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { HeroStatsStrip, NeoButton, NeoInput, OracleConsoleMiniApp } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
const oracle = useOracle({ appId: "miniapp-oracle-compute-lab" });
const scriptName = ref("health_check");
const inputJson = ref("{\n  \"message\": \"hello from miniapp\"\n}");
const latestJob = oracle.lastComputeResult;
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "oracle-compute-lab", messages,
  template: { tabs: [{ key: "compute", labelKey: "latestJob", icon: "🧠", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "latestJob", value: () => latestJob.value?.status || "—" }, { labelKey: "scriptName", value: () => scriptName.value }],
});
async function runJob() {
  try {
    await oracle.executeRegisteredScript({ scriptName: scriptName.value, input: JSON.parse(inputJson.value) });
    setStatus("compute job submitted", "success");
  } catch (e) {
    setStatus(String((e as Error)?.message || e), "error");
  }
}
const latestOutput = computed(() => JSON.stringify(latestJob.value?.output ?? latestJob.value?.result ?? {}, null, 2));
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Compute", value: "registered" },
  { label: "Network", value: oracle.network },
  { label: "Status", value: latestJob.value?.status || "idle" },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "Compute URL", value: oracle.edgeBaseUrl, variant: "erobo" },
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle, variant: "accent" },
]);
const appState = computed(() => ({ scriptName: scriptName.value, status: latestJob.value?.status || "" }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.json-box{width:100%;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,.08);padding:12px;color:inherit;font-family:var(--font-mono,monospace)}.textarea-label,.label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}.value{display:block;margin-top:6px;font-size:13px;word-break:break-all;white-space:pre-wrap}.result-grid{display:grid;grid-template-columns:1fr;gap:12px}</style>
