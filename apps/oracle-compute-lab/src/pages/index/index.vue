<template>
  <ConsoleMiniApp
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
        <div><span class="label">{{ t("labelStatus") }}</span><span class="value">{{ latestJob?.status || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelJob") }}</span><span class="value">{{ latestJob?.job_id || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelAttestation") }}</span><span class="value">{{ latestJob?.attestation || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelOutput") }}</span><span class="value">{{ latestOutput }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="scriptName" :label="t('scriptName')" :placeholder="t('scriptNamePlaceholder')" />
        <label for="input-json" class="textarea-label">{{ t("inputJson") }}</label>
        <textarea id="input-json" v-model="inputJson" class="json-box" rows="8" :aria-label="t('inputJson')"></textarea>
        <NeoButton type="button" variant="primary" :loading="oracle.isRequesting" @click="runJob">{{ t("execute") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput, AppIcon } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
import { formatErrorMessage } from "@shared/utils/errorHandling";
const oracle = useOracle({ appId: "miniapp-oracle-compute-lab" });
const scriptName = ref("health_check");
const inputJson = ref("{\n  \"message\": \"hello from miniapp\"\n}");
const latestJob = oracle.lastComputeResult;
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-compute-lab", messages,
  tab: { key: "compute", labelKey: "latestJob", icon: "🧠" },
  sidebarItems: [{ labelKey: "latestJob", value: () => latestJob.value?.status || t("notAvailable") }, { labelKey: "scriptName", value: () => scriptName.value }],
});
async function runJob() {
  try {
    await oracle.executeRegisteredScript({ scriptName: scriptName.value, input: JSON.parse(inputJson.value) });
    setStatus(t("computeSubmitted"), "success");
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("executeFailed")), "error");
  }
}
const latestOutput = computed(() => JSON.stringify(latestJob.value?.output ?? latestJob.value?.result ?? {}, null, 2));
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: t("heroCompute"), value: t("heroRegistered") },
  { label: t("network"), value: oracle.network },
  { label: t("labelStatus"), value: latestJob.value?.status || t("heroIdle") },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("overviewComputeUrl"), value: oracle.edgeBaseUrl, variant: "erobo" },
  { label: t("overviewOracle"), value: oracle.integration.contracts.morpheusOracle, variant: "accent" },
]);
const appState = computed(() => ({ scriptName: scriptName.value, status: latestJob.value?.status || "" }));
</script>
<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.result-grid { @include console.single-column-grid; }
</style>
