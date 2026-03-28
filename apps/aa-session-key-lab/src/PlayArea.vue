<template>
  <div class="session-play-area">
    <!-- Result Section -->
    <NeoCard variant="erobo" class="result-card">
      <DetailCardGrid :items="detailItems" />
    </NeoCard>

    <!-- Operation Section -->
    <NeoCard variant="erobo" class="operation-card">
      <div class="stack">
        <NeoInput :modelValue="accountSeed" @update:modelValue="accountSeed = $event" :label="t('accountSeed')" :placeholder="t('accountSeedPlaceholder')" />
        <NeoInput :modelValue="sessionPublicKey" @update:modelValue="sessionPublicKey = $event" :label="t('sessionPublicKey')" :placeholder="t('sessionPublicKeyPlaceholder')" />
        <NeoInput :modelValue="targetContract" @update:modelValue="targetContract = $event" :label="t('targetContract')" :placeholder="t('targetContractPlaceholder')" />
        <NeoInput :modelValue="allowedMethod" @update:modelValue="allowedMethod = $event" :label="t('allowedMethod')" :placeholder="t('allowedMethodPlaceholder')" />
        <NeoInput :modelValue="expiresAt" @update:modelValue="expiresAt = $event" :label="t('expiresAt')" :placeholder="t('expiresAtPlaceholder')" />
        <div class="actions-row">
          <NeoButton variant="secondary" type="button" @click="handleGenerateKey" :aria-label="t('generateKey')">{{ t("generateKey") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="isCheckingSponsorship" @click="handleCheckSponsor" :aria-label="t('checkSponsor')">{{ t("checkSponsor") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="isCheckingSponsorship" @click="handleRequestSponsor" :aria-label="t('requestSponsor')">{{ t("requestSponsor") }}</NeoButton>
          <NeoButton variant="primary" type="button" :loading="isSubmitting" @click="handleConfigureSessionKey" :aria-label="t('configureSession')">{{ t("configureSession") }}</NeoButton>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { DetailCardGrid, NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// -- State bindings --
const isSubmitting = computed(() => Boolean(props.state.isSubmitting?.value));
const isCheckingSponsorship = computed(() => Boolean(props.state.isCheckingSponsorship?.value));
const detailItems = computed(() => (props.state.detailItems?.value ?? []) as Array<{ label: string; value: unknown }>);

// -- Local form state --
const accountSeed = ref("");
const sessionPublicKey = ref("");
const targetContract = ref("");
const allowedMethod = ref("*");
const expiresAt = ref(String(Math.floor(Date.now() / 1000) + 3600));

// -- Action handlers --
const handleGenerateKey = () => {
  const handler = actions.get("generateKey");
  if (handler) {
    const result = handler();
    if (result?.publicKey) {
      sessionPublicKey.value = result.publicKey;
    }
  }
};

const handleCheckSponsor = async () => {
  const handler = actions.get("checkSponsor");
  if (handler) await handler();
};

const handleRequestSponsor = async () => {
  const handler = actions.get("requestSponsor");
  if (handler) await handler();
};

const handleConfigureSessionKey = async () => {
  const handler = actions.get("configureSessionKey");
  if (handler) {
    await handler(
      accountSeed.value,
      sessionPublicKey.value,
      targetContract.value,
      allowedMethod.value,
      expiresAt.value,
    );
  }
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.session-play-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.stack { @include console.stack; }
.actions-row { @include console.actions-row; }
</style>
