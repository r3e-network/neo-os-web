<template>
  <ConsoleMiniApp
    page-name="aa-session-key-lab"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="checkSponsor"
    hero-icon="🔑"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestState')"
    :operation-title="t('createSession')"
  >
    <template #result>
      <div class="detail-grid">
        <div class="detail-card"><span class="detail-label">AA</span><span class="detail-value">{{ aa.aaAddress.value || "—" }}</span></div>
        <div class="detail-card"><span class="detail-label">Session</span><span class="detail-value">{{ aa.hasActiveSession.value ? "active" : "none" }}</span></div>
        <div class="detail-card"><span class="detail-label">Sponsorship</span><span class="detail-value">{{ sponsorshipState }}</span></div>
        <div class="detail-card"><span class="detail-label">Relay</span><span class="detail-value">{{ relayState }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="aaAddress" :label="t('aaAddress')" placeholder="N..." />
        <NeoInput v-model="scope.contractHash" :label="t('contractHash')" placeholder="0x..." />
        <NeoInput v-model="scope.methods" :label="t('methods')" placeholder="symbol,balanceOf" />
        <NeoInput v-model="scope.maxInvocations" :label="t('maxInvocations')" placeholder="100" />
        <div class="actions-row">
          <NeoButton variant="secondary" :loading="aa.isCheckingSponsorship.value" @click="checkSponsor">{{ t("checkSponsor") }}</NeoButton>
          <NeoButton variant="secondary" :loading="aa.isCheckingSponsorship.value" @click="requestSponsor">{{ t("requestSponsor") }}</NeoButton>
          <NeoButton variant="primary" @click="createSession">{{ t("createSession") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { messages } from "@/locale/messages";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";

const aaAddress = ref("");
const sponsorship = ref<any>(null);
const scope = reactive({
  contractHash: "",
  methods: "symbol,balanceOf",
  maxInvocations: "100",
});

const aa = useAbstractAccount({
  network: "testnet",
  aaAddress: aaAddress.value,
  paymasterDappId: "miniapp-aa-session-key-lab",
});
watch(aaAddress, (next) => aa.setAAAddress(next));

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "aa-session-key-lab",
  messages,
  tab: { key: "session", labelKey: "latestState", icon: "🔑" },
  sidebarItems: [
    { labelKey: "aaAddress", value: () => aaAddress.value || "—" },
    { labelKey: "latestState", value: () => (aa.hasActiveSession.value ? "active" : "none") },
  ],
});

async function checkSponsor() {
  try {
    sponsorship.value = await aa.checkGasSponsorship();
    setStatus("sponsor check complete", "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  }
}

async function requestSponsor() {
  try {
    sponsorship.value = await aa.requestGasSponsorship("0.1");
    setStatus("sponsor request complete", "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  }
}

async function createSession() {
  try {
    const methods = scope.methods.split(",").map((value) => value.trim()).filter(Boolean);
    await aa.createSessionKey(
      { contractHash: scope.contractHash, allowedMethods: methods },
      parseInt(scope.maxInvocations, 10) || 100,
    );
    setStatus("session key prepared", "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  }
}

const sponsorshipState = computed(() => JSON.stringify(sponsorship.value ?? {}, null, 2));
const relayState = computed(() => JSON.stringify(aa.lastRelayResponse.value ?? {}, null, 2));
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "AA Core", value: aa.AA_MASTER_CONTRACT_TESTNET.slice(0, 10) + "…" },
  { label: "Session", value: aa.hasActiveSession.value ? "active" : "none" },
  { label: "Relay", value: aa.relayUrl },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "AA Core", value: aa.AA_MASTER_CONTRACT_TESTNET, variant: "accent" },
  { label: "Relay", value: aa.relayUrl, variant: "success" },
  { label: "Session Verifier", value: aa.integration.contracts.aaSessionKeyVerifier || "unset", variant: "erobo" },
]);
const appState = computed(() => ({ aaAddress: aaAddress.value, session: aa.hasActiveSession.value }));
</script>

<style scoped>
.stack{display:flex;flex-direction:column;gap:14px}
.actions-row{display:flex;gap:12px;flex-wrap:wrap}
.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.detail-card{padding:14px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)}
.detail-label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}
.detail-value{display:block;margin-top:8px;font-size:13px;word-break:break-all;white-space:pre-wrap}
@media (max-width: 767px){.detail-grid{grid-template-columns:1fr}}
</style>
