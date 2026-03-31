<template>
  <div class="seal-play-area">
    <!-- Public Key Details -->
    <NeoCard variant="erobo" :title="t('publicKeyTitle')" class="mb-6">
      <div class="details-grid">
        <div><span class="label">{{ t("algorithm") }}</span><span class="value">{{ keyMeta?.algorithm || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("network") }}</span><span class="value">{{ keyMeta?.network || networkDisplay }}</span></div>
        <div><span class="label">{{ t("contract") }}</span><span class="value">{{ keyMeta?.contract || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("rpc") }}</span><span class="value">{{ keyMeta?.rpc_url || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("source") }}</span><span class="value">{{ keyMeta?.source || t("notAvailable") }}</span></div>
        <div><span class="label">{{ t("publicKeyLabel") }}</span><span class="value">{{ keyMeta?.public_key || t("notAvailable") }}</span></div>
      </div>
    </NeoCard>

    <!-- Encrypted Output -->
    <NeoCard variant="erobo" :title="t('outputTitle')" class="mb-6">
      <div class="stack">
        <label for="ciphertext" class="label">{{ t("ciphertext") }}</label>
        <textarea id="ciphertext" :value="ciphertext" class="json-box" rows="7" readonly :aria-label="t('ciphertext')" />
        <NeoButton variant="secondary" type="button" :disabled="!ciphertext" :aria-label="t('copyCiphertext')" @click="handleCopy(ciphertext, 'cipher')">
          {{ copiedKey === "cipher" ? t("copied") : t("copyCiphertext") }}
        </NeoButton>

        <label for="wrapper-json" class="label">{{ t("wrapperJson") }}</label>
        <textarea id="wrapper-json" :value="wrapperJson" class="json-box" rows="7" readonly :aria-label="t('wrapperJson')" />
        <NeoButton variant="secondary" type="button" :disabled="!ciphertext" :aria-label="t('copyWrapper')" @click="handleCopy(wrapperJson, 'wrapper')">
          {{ copiedKey === "wrapper" ? t("copied") : t("copyWrapper") }}
        </NeoButton>
      </div>
    </NeoCard>

    <!-- Stored Reference -->
    <NeoCard variant="erobo" :title="t('refTitle')" class="mb-6">
      <div class="stack">
        <div class="details-grid">
          <div><span class="label">{{ t("secretRef") }}</span><span class="value">{{ storedRef?.secret_ref || t("notAvailable") }}</span></div>
          <div><span class="label">{{ t("storageName") }}</span><span class="value">{{ storedRef?.name || storageName || t("notAvailable") }}</span></div>
        </div>

        <label for="ref-wrapper" class="label">{{ t("copyRefWrapper") }}</label>
        <textarea id="ref-wrapper" :value="refWrapperJson" class="json-box" rows="5" readonly :aria-label="t('copyRefWrapper')" />
        <NeoButton variant="secondary" type="button" :disabled="!storedRef?.secret_ref" :aria-label="t('copyRefWrapper')" @click="handleCopy(refWrapperJson, 'ref')">
          {{ copiedKey === "ref" ? t("copied") : t("copyRefWrapper") }}
        </NeoButton>
      </div>
    </NeoCard>

    <!-- Operation Section -->
    <div class="stack">
      <div class="button-row">
        <NeoButton :variant="inputMode === 'json' ? 'primary' : 'secondary'" type="button" :aria-label="t('jsonMode')" @click="handleSetInputMode('json')">{{ t("jsonMode") }}</NeoButton>
        <NeoButton :variant="inputMode === 'text' ? 'primary' : 'secondary'" type="button" :aria-label="t('textMode')" @click="handleSetInputMode('text')">{{ t("textMode") }}</NeoButton>
      </div>

      <div class="button-row button-row--three">
        <NeoButton :variant="fieldName === 'encrypted_payload' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedPayload')" @click="handleSetFieldName('encrypted_payload')">{{ t("encryptedPayload") }}</NeoButton>
        <NeoButton :variant="fieldName === 'encrypted_params' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedParams')" @click="handleSetFieldName('encrypted_params')">{{ t("encryptedParams") }}</NeoButton>
        <NeoButton :variant="fieldName === 'encrypted_token' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedToken')" @click="handleSetFieldName('encrypted_token')">{{ t("encryptedToken") }}</NeoButton>
      </div>

      <NeoInput
        :modelValue="confidentialInput"
        type="textarea"
        :label="t('plaintextLabel')"
        :hint="t('helperNote')"
        :placeholder="t('confidentialJsonPlaceholder')"
        @update:modelValue="handleUpdateConfidentialInput($event)"
      />

      <NeoInput :modelValue="storageName" :label="t('storageName')" :placeholder="t('storageNamePlaceholder')" @update:modelValue="handleUpdateStorageName($event)" />
      <NeoInput :modelValue="projectSlug" :label="t('projectSlug')" :placeholder="t('optional')" @update:modelValue="handleUpdateProjectSlug($event)" />
      <NeoInput :modelValue="boundRequester" :label="t('requesterScriptHash')" :placeholder="t('hexOptional')" @update:modelValue="handleUpdateBoundRequester($event)" />
      <NeoInput :modelValue="boundCallbackContract" :label="t('callbackContract')" :placeholder="t('hexOptional')" @update:modelValue="handleUpdateBoundCallbackContract($event)" />

      <NeoButton variant="secondary" type="button" :loading="isLoadingKey" :aria-label="t('refreshKey')" @click="handleLoadKey">{{ t("refreshKey") }}</NeoButton>
      <NeoButton variant="primary" type="button" :loading="isSealing" :disabled="!canSeal" :aria-label="t('sealNow')" @click="handleSealPayload">{{ t("sealNow") }}</NeoButton>
      <NeoButton variant="secondary" type="button" :loading="isStoring" :disabled="!canStoreRef" :aria-label="t('storeRef')" @click="handleStoreRef">{{ t("storeRef") }}</NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

interface KeyMeta {
  algorithm?: string;
  network?: string;
  contract?: string;
  rpc_url?: string;
  source?: string;
  public_key?: string;
}

interface StoredRefType {
  secret_ref?: string;
  name?: string;
}

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const keyMeta = computed(() => props.state.keyMeta?.value as KeyMeta | null);
const inputMode = computed(() => String(props.state.inputMode?.value ?? "json"));
const fieldName = computed(() => String(props.state.fieldName?.value ?? "encrypted_payload"));
const confidentialInput = computed(() => String(props.state.confidentialInput?.value ?? ""));
const ciphertext = computed(() => String(props.state.ciphertext?.value ?? ""));
const isLoadingKey = computed(() => Boolean(props.state.isLoadingKey?.value ?? false));
const isSealing = computed(() => Boolean(props.state.isSealing?.value ?? false));
const isStoring = computed(() => Boolean(props.state.isStoring?.value ?? false));
const copiedKey = computed(() => (props.state.copiedKey?.value ?? null) as string | null);
const storageName = computed(() => String(props.state.storageName?.value ?? ""));
const projectSlug = computed(() => String(props.state.projectSlug?.value ?? ""));
const boundRequester = computed(() => String(props.state.boundRequester?.value ?? ""));
const boundCallbackContract = computed(() => String(props.state.boundCallbackContract?.value ?? ""));
const storedRef = computed(() => props.state.storedRef?.value as StoredRefType | null);
const canSeal = computed(() => Boolean(props.state.canSeal?.value ?? false));
const canStoreRef = computed(() => Boolean(props.state.canStoreRef?.value ?? false));
const wrapperJson = computed(() => String(props.state.wrapperJson?.value ?? ""));
const refWrapperJson = computed(() => String(props.state.refWrapperJson?.value ?? ""));
const networkDisplay = computed(() => String(props.state.networkDisplay?.value ?? ""));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleLoadKey = async () => {
  const handler = actions.get("loadKey");
  if (handler) await handler();
};
const handleSealPayload = async () => {
  const handler = actions.get("sealPayload");
  if (handler) await handler();
};
const handleStoreRef = async () => {
  const handler = actions.get("storeCiphertextRef");
  if (handler) await handler();
};
const handleCopy = async (value: string, key: string) => {
  const handler = actions.get("copyText");
  if (handler) await handler(value, key);
};
const handleSetInputMode = (mode: string) => {
  const handler = actions.get("setInputMode");
  if (handler) handler(mode);
};
const handleSetFieldName = (name: string) => {
  const handler = actions.get("setFieldName");
  if (handler) handler(name);
};
const handleUpdateConfidentialInput = (val: string) => {
  const handler = actions.get("updateConfidentialInput");
  if (handler) handler(val);
};
const handleUpdateStorageName = (val: string) => {
  const handler = actions.get("updateStorageName");
  if (handler) handler(val);
};
const handleUpdateProjectSlug = (val: string) => {
  const handler = actions.get("updateProjectSlug");
  if (handler) handler(val);
};
const handleUpdateBoundRequester = (val: string) => {
  const handler = actions.get("updateBoundRequester");
  if (handler) handler(val);
};
const handleUpdateBoundCallbackContract = (val: string) => {
  const handler = actions.get("updateBoundCallbackContract");
  if (handler) handler(val);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.seal-play-area { @include console.play-area; }

.stack { @include console.stack; }
.details-grid { @include console.detail-grid-min; }
.label { @include console.label; }
.value { @include console.value; }
.json-box { @include console.json-box; }
.button-row { @include console.button-grid(2); }
.button-row--three { @include console.button-grid(3); }
.mb-6 { margin-bottom: 6px; }
</style>
