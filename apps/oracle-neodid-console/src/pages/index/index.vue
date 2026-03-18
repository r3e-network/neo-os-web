<template>
  <ConsoleMiniApp
    page-name="oracle-neodid-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="resolveDid"
    hero-icon="🪪"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestDocument')"
    :operation-title="t('resolveDid')"
  >
    <template #result>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="did" :label="t('did')" placeholder="did:morpheus:neo_n3:service:neodid" />
        <NeoInput v-model="format" :label="t('format')" placeholder="resolution / document" />
        <div class="button-row">
          <NeoButton variant="secondary" @click="applyExample('service')">{{ t("serviceDid") }}</NeoButton>
          <NeoButton variant="secondary" @click="applyExample('vault')">{{ t("vaultDid") }}</NeoButton>
          <NeoButton variant="secondary" @click="applyExample('aa')">{{ t("aaDid") }}</NeoButton>
        </div>
        <NeoButton variant="primary" :loading="oracle.isRequesting" @click="resolveDid">{{ t("resolveDid") }}</NeoButton>
        <NeoButton variant="secondary" :loading="oracle.isRequesting" @click="loadProviders">{{ t("loadProviders") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { messages } from "@/locale/messages";
import { useOracle } from "@shared/composables/useOracle";

const oracle = useOracle({ appId: "miniapp-oracle-neodid-console" });
const did = ref("did:morpheus:neo_n3:service:neodid");
const format = ref("resolution");
const latestPayload = ref<Record<string, unknown> | null>(null);
const providersPayload = ref<Record<string, unknown> | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-neodid-console",
  messages,
  tab: { key: "neodid", labelKey: "latestDocument", icon: "🪪" },
  sidebarItems: [
    { labelKey: "did", value: () => did.value },
    { labelKey: "format", value: () => format.value },
    { labelKey: "providersLabel", value: () => providerCount.value },
  ],
});

function normalizeFormat(value: string): "resolution" | "document" {
  return String(value || "").trim().toLowerCase() === "document" ? "document" : "resolution";
}

function applyExample(kind: "service" | "vault" | "aa") {
  if (kind === "service") {
    did.value = "did:morpheus:neo_n3:service:neodid";
    format.value = "resolution";
    return;
  }
  if (kind === "vault") {
    did.value = "did:morpheus:neo_n3:vault:6d0656f6dd91469db1c90cc1e574380613f43738";
    format.value = "document";
    return;
  }
  did.value = "did:morpheus:neo_n3:aa:demo-account";
  format.value = "document";
}

async function resolveDid() {
  try {
    latestPayload.value = await oracle.resolveNeoDid(did.value, normalizeFormat(format.value));
    setStatus(t("resultLoaded"), "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  }
}

async function loadProviders() {
  try {
    providersPayload.value = await oracle.getNeoDidProviders();
    latestPayload.value = providersPayload.value;
    setStatus(t("resultLoaded"), "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  }
}

const providerCount = computed(() => {
  if (Array.isArray(providersPayload.value)) return providersPayload.value.length;
  if (providersPayload.value && typeof providersPayload.value === "object") return Object.keys(providersPayload.value).length;
  return 0;
});

const renderedPayload = computed(() => JSON.stringify(latestPayload.value ?? providersPayload.value ?? {}, null, 2) || "—");

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Network", value: oracle.network, icon: "🌐" },
  { label: "Format", value: normalizeFormat(format.value), icon: "📄" },
  { label: "Providers", value: providerCount.value, icon: "🧷" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("publicApi"), value: oracle.integration.morpheusPublicApiUrl, variant: "accent" },
  { label: t("neodidContract"), value: oracle.integration.contracts.morpheusNeoDid || "external resolver", variant: "default" },
  { label: t("neodidDomain"), value: oracle.integration.domains.neodid || "not published", variant: "success" },
]);

const appState = computed(() => ({
  did: did.value,
  format: normalizeFormat(format.value),
  providers: providerCount.value,
}));
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.button-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.json-box {
  width: 100%;
  max-height: 520px;
  overflow: auto;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
