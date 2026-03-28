<template>
  <ConsoleMiniApp
    page-name="aa-relay-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="checkSponsor"
    hero-icon="signal"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestRelay')"
    :operation-title="t('submitRelay')"
  >
    <template #result>
      <div class="response-grid">
        <div><span class="label">{{ t("labelAA") }}</span><span class="value">{{ aa.aaAddress.value || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("paymasterLabel") }}</span><span class="value">{{ dappId || t("unset") }}</span></div>
        <div><span class="label">{{ t("labelSponsor") }}</span><span class="value">{{ sponsorState }}</span></div>
        <div><span class="label">{{ t("relayLabel") }}</span><span class="value">{{ relayResponse }}</span></div>
      </div>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="aaAddress" :label="t('aaAddress')" :placeholder="t('aaAddressPlaceholder')" />
        <NeoInput v-model="dappId" :label="t('dappId')" :placeholder="t('dappIdPlaceholder')" />
        <label for="payload-json" class="textarea-label">{{ t("payloadJson") }}</label>
        <textarea id="payload-json" v-model="payloadJson" class="json-box" rows="10" :aria-label="t('payloadJson')"></textarea>
        <div class="actions-row">
          <NeoButton variant="secondary" type="button" :loading="aa.isCheckingSponsorship.value" @click="checkSponsor" :aria-label="t('sponsorCheck')">{{ t("sponsorCheck") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="aa.isCheckingSponsorship.value" @click="requestSponsor" :aria-label="t('sponsorRequest')">{{ t("sponsorRequest") }}</NeoButton>
          <NeoButton variant="primary" type="button" :loading="aa.isRelaying.value" @click="submitRelay" :aria-label="t('submitRelay')">{{ t("submitRelay") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildAAHeroStats, buildAAOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";
import type { GasSponsorCheckResponse, GasSponsorRequestResponse, AARelayResponse } from "@shared/composables/useAbstractAccount";
import { formatErrorMessage } from "@shared/utils/errorHandling";
const aaAddress = ref("");
const dappId = ref("");
const payloadJson = ref("{\n  \"metaInvocation\": {\n    \"scriptHash\": \"0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38\"\n  }\n}");
type SponsorResult = GasSponsorCheckResponse | GasSponsorRequestResponse | AARelayResponse | null;
const sponsorResult = ref<SponsorResult>(null);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "aa-relay-console", messages,
  tab: { key: "relay", labelKey: "latestRelay", icon: "signal" },
  sidebarItems: [{ labelKey: "aaAddress", value: () => aaAddress.value || t("notAvailable") }, { labelKey: "latestRelay", value: () => relayResponse.value }],
});
const aa = useAbstractAccount({ network: "testnet", aaAddress: aaAddress.value, paymasterDappId: dappId.value || undefined });
const stopAddressWatch = watch(aaAddress, (next) => aa.setAAAddress(next));
onUnmounted(() => stopAddressWatch());
async function checkSponsor() { try { sponsorResult.value = await aa.checkGasSponsorship(); setStatus(t("sponsorCheckComplete"), "success"); } catch (e) { setStatus(formatErrorMessage(e, t("sponsorCheckError")), "error"); } }
async function requestSponsor() { try { sponsorResult.value = await aa.requestGasSponsorship("0.1"); setStatus(t("sponsorRequestComplete"), "success"); } catch (e) { setStatus(formatErrorMessage(e, t("sponsorRequestError")), "error"); } }
async function submitRelay() { try { const payload = JSON.parse(payloadJson.value); const response = await aa.submitRelayTransaction(payload); sponsorResult.value = response; setStatus(t("relaySubmitted"), "success"); } catch (e) { setStatus(formatErrorMessage(e, t("relayError")), "error"); } }
const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore: aa.AA_MASTER_CONTRACT_TESTNET,
    middleLabel: t("heroRelay"),
    middleValue: aa.relayUrl,
    trailingLabel: t("network"),
    trailingValue: aa.network,
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore: aa.AA_MASTER_CONTRACT_TESTNET,
    extra: { label: t("paymasterLabel"), value: dappId.value || t("unset"), variant: "erobo" },
  }).concat([{ label: t("relayLabel"), value: aa.relayUrl, variant: "success" }]),
);
const sponsorState = computed(() => JSON.stringify(sponsorResult.value ?? {}, null, 2));
const relayResponse = computed(() => JSON.stringify(aa.lastRelayResponse.value ?? {}, null, 2));
const appState = computed(() => ({ aaAddress: aaAddress.value }));
</script>
<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.response-grid { @include console.single-column-grid; }
.actions-row { @include console.actions-row; }
</style>
