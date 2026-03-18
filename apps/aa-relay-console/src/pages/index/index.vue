<template>
  <MiniAppPage name="aa-relay-console" :config="templateConfig" :state="appState" :t="t" :status-message="status"
    :sidebar-items="sidebarItems" :sidebar-title="sidebarTitle" :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError" :on-boundary-retry="checkSponsor">
    <template #content>
      <HeroSection variant="erobo" icon="📡" compact>
        <template #stats><HeroStatsStrip :items="heroStats" compact /></template>
      </HeroSection>
      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />
      <NeoCard variant="erobo" :title="t('latestRelay')" class="px-1">
        <div class="response-grid">
          <div><span class="label">AA</span><span class="value">{{ aa.aaAddress.value || "—" }}</span></div>
          <div><span class="label">Session</span><span class="value">{{ aa.hasActiveSession.value ? "active" : "none" }}</span></div>
          <div><span class="label">Sponsor</span><span class="value">{{ sponsorState }}</span></div>
          <div><span class="label">Relay</span><span class="value">{{ relayResponse }}</span></div>
        </div>
      </NeoCard>
    </template>
    <template #operation>
      <NeoCard variant="erobo" :title="t('submitRelay')" class="px-1">
        <div class="stack">
          <NeoInput v-model="aaAddress" :label="t('aaAddress')" placeholder="N..." />
          <NeoInput v-model="dappId" :label="t('dappId')" placeholder="optional dapp id" />
          <label class="textarea-label">{{ t("payloadJson") }}</label>
          <textarea v-model="payloadJson" class="json-box" rows="10"></textarea>
          <div class="actions-row">
            <NeoButton variant="secondary" :loading="aa.isCheckingSponsorship.value" @click="checkSponsor">{{ t("sponsorCheck") }}</NeoButton>
            <NeoButton variant="secondary" :loading="aa.isCheckingSponsorship.value" @click="requestSponsor">{{ t("sponsorRequest") }}</NeoButton>
            <NeoButton variant="primary" :loading="aa.isRelaying.value" @click="submitRelay">{{ t("submitRelay") }}</NeoButton>
          </div>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";
const aaAddress = ref("");
const dappId = ref("");
const payloadJson = ref("{\n  \"metaInvocation\": {\n    \"scriptHash\": \"0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38\"\n  }\n}");
const sponsorResult = ref<any>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "aa-relay-console", messages,
  template: { tabs: [{ key: "relay", labelKey: "latestRelay", icon: "📡", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "aaAddress", value: () => aaAddress.value || "—" }, { labelKey: "latestRelay", value: () => relayResponse.value }],
});
const aa = useAbstractAccount({ network: "testnet", aaAddress: aaAddress.value, paymasterDappId: dappId.value || undefined });
watch(aaAddress, (next) => aa.setAAAddress(next));
async function checkSponsor() { try { sponsorResult.value = await aa.checkGasSponsorship(); setStatus("sponsor check complete", "success"); } catch (e) { setStatus(String((e as Error)?.message || e), "error"); } }
async function requestSponsor() { try { sponsorResult.value = await aa.requestGasSponsorship("0.1"); setStatus("sponsor request submitted", "success"); } catch (e) { setStatus(String((e as Error)?.message || e), "error"); } }
async function submitRelay() { try { const payload = JSON.parse(payloadJson.value); const response = await aa.submitRelayTransaction(payload); sponsorResult.value = response; setStatus("relay submitted", "success"); } catch (e) { setStatus(String((e as Error)?.message || e), "error"); } }
const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "AA Core", value: aa.AA_MASTER_CONTRACT_TESTNET.slice(0, 10) + "…" },
  { label: "Relay", value: aa.relayUrl },
  { label: "Network", value: aa.network },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "AA Core", value: aa.AA_MASTER_CONTRACT_TESTNET, variant: "accent" },
  { label: "Relay", value: aa.relayUrl, variant: "success" },
  { label: "Paymaster", value: dappId.value || "unset", variant: "erobo" },
]);
const sponsorState = computed(() => JSON.stringify(sponsorResult.value ?? {}, null, 2));
const relayResponse = computed(() => JSON.stringify(aa.lastRelayResponse.value ?? {}, null, 2));
const appState = computed(() => ({ aaAddress: aaAddress.value }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.json-box{width:100%;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,.08);padding:12px;color:inherit;font-family:var(--font-mono,monospace)}.textarea-label,.label{display:block;font-size:11px;opacity:.6;text-transform:uppercase}.value{display:block;margin-top:6px;font-size:13px;word-break:break-all;white-space:pre-wrap}.response-grid{display:grid;grid-template-columns:1fr;gap:12px}.actions-row{display:flex;gap:12px;flex-wrap:wrap}</style>
