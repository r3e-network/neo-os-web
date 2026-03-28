<template>
  <div class="aa-permissions-play-area">
    <!-- Inspect Section -->
    <NeoCard variant="erobo" :title="t('inspect')">
      <div class="stack">
        <NeoInput
          :modelValue="accountIdHash"
          :label="t('accountId')"
          :placeholder="t('accountIdHashPlaceholder')"
          @update:modelValue="accountIdHash = $event"
        />
        <NeoButton variant="secondary" type="button" :loading="isRefreshing" @click="handleRefresh" :aria-label="t('inspect')">
          {{ t("inspect") }}
        </NeoButton>
      </div>
      <DetailCardGrid :items="detailItems" :columns="3" />
    </NeoCard>

    <!-- Update Verifier Section -->
    <NeoCard variant="erobo" :title="t('updateVerifier')">
      <div class="stack">
        <NeoInput
          :modelValue="verifierHash"
          :label="t('verifier')"
          :placeholder="t('verifierHashPlaceholder')"
          @update:modelValue="verifierHash = $event"
        />
        <NeoInput
          :modelValue="verifierParamsHex"
          :label="t('verifierParams')"
          :placeholder="t('verifierParamsPlaceholder')"
          @update:modelValue="verifierParamsHex = $event"
        />
        <NeoButton variant="primary" type="button" :loading="isVerifierBusy" @click="handleSubmitVerifier" :aria-label="t('updateVerifier')">
          {{ t("updateVerifier") }}
        </NeoButton>
      </div>
    </NeoCard>

    <!-- Update Hook Section -->
    <NeoCard variant="erobo" :title="t('updateHook')">
      <div class="stack">
        <NeoInput
          :modelValue="hookHash"
          :label="t('hook')"
          :placeholder="t('hookHashPlaceholder')"
          @update:modelValue="hookHash = $event"
        />
        <NeoButton variant="secondary" type="button" :loading="isHookBusy" @click="handleSubmitHook" :aria-label="t('updateHook')">
          {{ t("updateHook") }}
        </NeoButton>
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

// -- Local form state --
const accountIdHash = ref("");
const verifierHash = ref("");
const verifierParamsHex = ref("");
const hookHash = ref("");

// -- State bindings --
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value));
const isVerifierBusy = computed(() => Boolean(props.state.isVerifierBusy?.value));
const isHookBusy = computed(() => Boolean(props.state.isHookBusy?.value));

const detailItems = computed(() => [
  { label: t("currentVerifier"), value: String(props.state.currentVerifier?.value ?? t("notAvailable")) },
  { label: t("currentHook"), value: String(props.state.currentHook?.value ?? t("notAvailable")) },
  { label: t("currentBackupOwner"), value: String(props.state.currentBackupOwner?.value ?? t("notAvailable")) },
]);

// -- Action handlers --
const handleRefresh = async () => {
  const handler = actions.get("refresh");
  if (handler) await handler(accountIdHash.value);
};

const handleSubmitVerifier = async () => {
  const handler = actions.get("submitVerifier");
  if (handler) await handler(accountIdHash.value, verifierHash.value, verifierParamsHex.value);
};

const handleSubmitHook = async () => {
  const handler = actions.get("submitHook");
  if (handler) await handler(accountIdHash.value, hookHash.value);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.aa-permissions-play-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.stack { @include console.stack; }
</style>
