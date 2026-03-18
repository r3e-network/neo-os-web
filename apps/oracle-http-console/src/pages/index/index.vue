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
        <div><span class="label">Status</span><span class="value">{{ response?.status_code ?? "—" }}</span></div>
        <div><span class="label">Headers</span><span class="value">{{ responseHeaders }}</span></div>
        <div><span class="label">Body</span><span class="value">{{ responseBody }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="form.url" :label="t('url')" placeholder="https://api.binance.com/api/v3/ticker/price?symbol=NEOUSDT" />
        <NeoInput v-model="form.method" :label="t('method')" placeholder="GET" />
        <NeoInput v-model="form.secretName" :label="t('secretName')" placeholder="optional" />
        <NeoInput v-model="form.secretAsKey" :label="t('secretAsKey')" placeholder="Authorization / X-API-Key" />
        <label class="textarea-label">{{ t("body") }}</label>
        <textarea v-model="form.body" class="json-box" rows="6"></textarea>
        <NeoButton variant="primary" :loading="oracle.isRequesting" @click="runQuery">{{ t("runQuery") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";
const oracle = useOracle({ appId: "miniapp-oracle-http-console" });
const form = reactive({ url: "", method: "GET", secretName: "", secretAsKey: "", body: "" });
const response = ref<any>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-http-console", messages,
  tab: { key: "oracle", labelKey: "latestResponse", icon: "🌐" },
  sidebarItems: [{ labelKey: "method", value: () => form.method }, { labelKey: "latestResponse", value: () => String(response.value?.status_code ?? "—") }],
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
    setStatus("oracle query completed", "success");
  } catch (e) {
    setStatus(String((e as Error)?.message || e), "error");
  }
}
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle.slice(0, 10) + "…" },
  { label: "Mode", value: form.method || "GET" },
  { label: "Network", value: oracle.network },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "Oracle", value: oracle.integration.contracts.morpheusOracle, variant: "accent" },
  { label: "Public API", value: oracle.integration.morpheusPublicApiUrl, variant: "success" },
]);
const responseHeaders = computed(() => JSON.stringify(response.value?.headers ?? {}, null, 2));
const responseBody = computed(() => String(response.value?.body ?? "—"));
const appState = computed(() => ({ url: form.url, status: response.value?.status_code ?? null }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.json-box{width:100%;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,.08);padding:12px;color:inherit;font-family:var(--font-mono,monospace)}.textarea-label,.label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}.value{display:block;margin-top:6px;font-size:13px;word-break:break-all;white-space:pre-wrap}.response-grid{display:grid;grid-template-columns:1fr;gap:12px}</style>
