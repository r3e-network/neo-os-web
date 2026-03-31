<template>
  <div class="aa-account-play-area">
    <!-- Inspector Section -->
    <NeoCard variant="erobo" :title="t('inspectorTitle')">
      <div class="field-stack">
        <NeoInput
          :modelValue="inspectAccountId"
          :label="t('accountId')"
          :placeholder="t('accountIdPlaceholder')"
          @update:modelValue="inspectAccountId = $event"
        />
        <div class="actions-row">
          <NeoButton variant="primary" type="button" :loading="isInspecting" @click="handleInspect" :aria-label="t('inspect')">
            {{ t("inspect") }}
          </NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleConnect" :aria-label="t('connectWallet')">
            {{ t("connectWallet") }}
          </NeoButton>
        </div>
      </div>

      <DetailCardGrid :items="detailItems" />
    </NeoCard>

    <!-- Register Section -->
    <NeoCard variant="erobo" :title="t('registerTitle')">
      <div class="field-stack">
        <NeoInput
          :modelValue="registerAccountId"
          :label="t('accountId')"
          :placeholder="t('accountIdPlaceholder')"
          @update:modelValue="registerAccountId = $event"
        />
        <NeoInput
          :modelValue="verifierHash"
          :label="t('verifier')"
          :placeholder="t('verifierPlaceholder')"
          @update:modelValue="verifierHash = $event"
        />
        <NeoInput
          :modelValue="verifierParamsHex"
          :label="t('verifierParams')"
          :placeholder="t('verifierParamsPlaceholder')"
          @update:modelValue="verifierParamsHex = $event"
        />
        <NeoInput
          :modelValue="hookHash"
          :label="t('hook')"
          :placeholder="t('hookPlaceholder')"
          @update:modelValue="hookHash = $event"
        />
        <NeoInput
          :modelValue="backupOwner"
          :label="t('backupOwner')"
          :placeholder="t('backupOwnerPlaceholder')"
          @update:modelValue="backupOwner = $event"
        />
        <NeoInput
          :modelValue="escapeTimelock"
          :label="t('timelock')"
          :placeholder="t('timelockPlaceholder')"
          @update:modelValue="escapeTimelock = $event"
        />
        <NeoButton variant="primary" type="button" :loading="isSubmitting" @click="handleRegister" :aria-label="t('register')">
          {{ t("register") }}
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
const inspectAccountId = ref("");
const registerAccountId = ref("");
const verifierHash = ref((props.state.defaultVerifierDisplay?.value as string) || "");
const verifierParamsHex = ref("");
const hookHash = ref("");
const backupOwner = ref("");
const escapeTimelock = ref("2592000");

// -- State bindings --
const isInspecting = computed(() => Boolean(props.state.isInspecting?.value));
const isSubmitting = computed(() => Boolean(props.state.isSubmitting?.value));
const currentVerifier = computed(() => String(props.state.currentVerifier?.value ?? t("notAvailable")));
const currentHook = computed(() => String(props.state.currentHook?.value ?? t("notAvailable")));
const currentBackupOwner = computed(() => String(props.state.currentBackupOwner?.value ?? t("notAvailable")));
const aaCore = computed(() => String(props.state.aaCoreDisplay?.value ?? ""));

const detailItems = computed(() => [
  { label: t("currentVerifier"), value: currentVerifier.value },
  { label: t("currentHook"), value: currentHook.value },
  { label: t("currentBackupOwner"), value: currentBackupOwner.value },
  { label: t("aaCore"), value: aaCore.value },
]);

// -- Action handlers --
const handleInspect = async () => {
  const handler = actions.get("inspect");
  if (handler) await handler(inspectAccountId.value);
};

const handleRegister = async () => {
  const handler = actions.get("register");
  if (handler) {
    await handler(
      registerAccountId.value,
      verifierHash.value,
      verifierParamsHex.value,
      hookHash.value,
      backupOwner.value,
      escapeTimelock.value,
    );
  }
};

const handleConnect = async () => {
  const handler = actions.get("connect");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.aa-account-play-area { @include console.play-area; }

.field-stack { @include console.stack; }
.actions-row { @include console.actions-row; }
</style>
