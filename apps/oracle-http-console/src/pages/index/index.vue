<template>
  <ConsoleMiniApp
    page-name="oracle-http-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="runQuery"
    hero-icon="🌐"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestResponse')"
    :operation-title="t('runQuery')"
  >
    <template #result>
      <div class="response-grid">
        <div><span class="label">{{ t("labelStatus") }}</span><span class="value">{{ response?.status_code ?? t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("labelHeaders") }}</span><span class="value">{{ responseHeaders }}</span></div>
        <div><span class="label">{{ t("labelBody") }}</span><span class="value">{{ responseBody }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="form.url" :label="t('url')" :placeholder="t('urlPlaceholder')" />
        <NeoInput v-model="form.method" :label="t('method')" :placeholder="t('methodPlaceholder')" />
        <NeoInput v-model="form.secretName" :label="t('secretName')" :placeholder="t('optional')" />
        <NeoInput v-model="form.secretAsKey" :label="t('secretAsKey')" :placeholder="t('secretAsKeyPlaceholder')" />
        <label for="request-body" class="textarea-label">{{ t("body") }}</label>
        <textarea id="request-body" v-model="form.body" class="json-box" rows="6" :aria-label="t('body')"></textarea>
        <NeoButton variant="primary" type="button" :loading="oracle.isRequesting" @click="runQuery" :aria-label="t('runQuery')">{{ t("runQuery") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildOracleHeroStats, buildOracleOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
import type { OracleQueryResponse } from "@shared/composables/useOracle";
import { formatErrorMessage } from "@shared/utils/errorHandling";
const oracle = useOracle({ appId: "miniapp-oracle-http-console" });
const form = reactive({ url: "", method: "GET", secretName: "", secretAsKey: "", body: "" });
const response = ref<OracleQueryResponse | null>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-http-console", messages,
  tab: { key: "oracle", labelKey: "latestResponse", icon: "🌐" },
  sidebarItems: [{ labelKey: "method", value: () => form.method }, { labelKey: "latestResponse", value: () => String(response.value?.status_code ?? t("notAvailable")) }],
});
async function runQuery() {
  try {
    response.value = await oracle.queryAllowlistedUrl({
      url: form.url,
      method: form.method || "GET",
      secret_name: form.secretName || undefined,
      secret_as_key: form.secretAsKey || undefined,
      body: form.body || undefined,
    });
    setStatus(t("queryCompleted"), "success");
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("queryFailed")), "error");
  }
}
const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildOracleHeroStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    network: oracle.network,
    middleLabel: t("heroMode"),
    middleValue: form.method || t("methodPlaceholder"),
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildOracleOverviewStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    publicApiUrl: oracle.integration.morpheusPublicApiUrl,
  }),
);
const responseHeaders = computed(() => JSON.stringify(response.value?.headers ?? {}, null, 2));
const responseBody = computed(() => String(response.value?.body ?? t("notAvailable")));
const appState = computed(() => ({ url: form.url, status: response.value?.status_code ?? null }));
</script>
<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.response-grid { @include console.single-column-grid; }
</style>
