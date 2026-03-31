<template>
  <div class="relay-play-area">
    <!-- Result Section -->
    <NeoCard variant="erobo" class="result-card">
      <div class="response-grid">
        <div><span class="label">{{ t("labelAA") }}</span><span class="value">{{ aaAddressDisplay }}</span></div>
        <div><span class="label">{{ t("paymasterLabel") }}</span><span class="value">{{ paymasterDisplay }}</span></div>
        <div><span class="label">{{ t("labelSponsor") }}</span><span class="value">{{ sponsorState }}</span></div>
        <div><span class="label">{{ t("relayLabel") }}</span><span class="value">{{ relayResponse }}</span></div>
      </div>
    </NeoCard>

    <!-- Operation Section -->
    <NeoCard variant="erobo" class="operation-card">
      <div class="stack">
        <NeoInput :modelValue="aaAddress" @update:modelValue="aaAddress = $event" :label="t('aaAddress')" :placeholder="t('aaAddressPlaceholder')" />
        <NeoInput :modelValue="dappIdLocal" @update:modelValue="dappIdLocal = $event" :label="t('dappId')" :placeholder="t('dappIdPlaceholder')" />
        <label for="payload-json" class="textarea-label">{{ t("payloadJson") }}</label>
        <textarea id="payload-json" v-model="payloadJsonLocal" class="json-box" rows="10" :aria-label="t('payloadJson')"></textarea>
        <div class="actions-row">
          <NeoButton variant="secondary" type="button" :loading="isCheckingSponsorship" @click="handleCheckSponsor" :aria-label="t('sponsorCheck')">{{ t("sponsorCheck") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="isCheckingSponsorship" @click="handleRequestSponsor" :aria-label="t('sponsorRequest')">{{ t("sponsorRequest") }}</NeoButton>
          <NeoButton variant="primary" type="button" :loading="isRelaying" @click="handleSubmitRelay" :aria-label="t('submitRelay')">{{ t("submitRelay") }}</NeoButton>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// -- State bindings --
const aaAddressDisplay = computed(() => String(props.state.aaAddressDisplay?.value ?? t("notAvailable")));
const paymasterDisplay = computed(() => String(props.state.paymasterDisplay?.value ?? t("unset")));
const sponsorState = computed(() => String(props.state.sponsorState?.value ?? "{}"));
const relayResponse = computed(() => String(props.state.relayResponse?.value ?? "{}"));
const isCheckingSponsorship = computed(() => Boolean(props.state.isCheckingSponsorship?.value));
const isRelaying = computed(() => Boolean(props.state.isRelaying?.value));

// -- Local form state --
const aaAddress = ref("");
const dappIdLocal = ref("");
const payloadJsonLocal = ref("{\n  \"metaInvocation\": {\n    \"scriptHash\": \"0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38\"\n  }\n}");

// -- Action handlers --
const handleCheckSponsor = async () => {
  const handler = actions.get("checkSponsor");
  if (handler) await handler(aaAddress.value, dappIdLocal.value);
};

const handleRequestSponsor = async () => {
  const handler = actions.get("requestSponsor");
  if (handler) await handler(aaAddress.value, dappIdLocal.value);
};

const handleSubmitRelay = async () => {
  const handler = actions.get("submitRelay");
  if (handler) await handler(aaAddress.value, dappIdLocal.value, payloadJsonLocal.value);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.relay-play-area { @include console.play-area; }

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.response-grid { @include console.single-column-grid; }
.actions-row { @include console.actions-row; }
</style>
