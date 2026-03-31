<template>
  <div class="neodid-passport-play-area">
    <!-- ── Result Panel ── -->
    <pre class="json-box">{{ renderedPayload }}</pre>

    <!-- ── Operation Panel ── -->
    <div class="stack">
      <NeoInput :modelValue="did" @update:modelValue="did = $event" :label="t('did')" :placeholder="t('didPlaceholder')" />
      <NeoInput :modelValue="format" @update:modelValue="format = $event" :label="t('format')" :placeholder="t('formatPlaceholder')" />
      <NeoInput :modelValue="secretName" @update:modelValue="secretName = $event" :label="t('secretName')" :placeholder="t('secretNamePlaceholder')" />
      <NeoInput :modelValue="credentialRecipient" @update:modelValue="credentialRecipient = $event" :label="t('credentialRecipient')" :placeholder="t('credentialRecipientPlaceholder')" />
      <NeoInput :modelValue="credentialTemplateId" @update:modelValue="credentialTemplateId = $event" :label="t('credentialTemplateId')" :placeholder="t('credentialTemplateIdPlaceholder')" />
      <NeoInput :modelValue="ciphertext" @update:modelValue="ciphertext = $event" type="textarea" :label="t('ciphertext')" :placeholder="t('ciphertextPlaceholder')" />
      <div class="button-row">
        <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleResolveDid" :aria-label="t('resolveDid')">{{ t("resolveDid") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleLoadProviders" :aria-label="t('loadProviders')">{{ t("loadProviders") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleFetchOracleKey" :aria-label="t('fetchOracleKey')">{{ t("fetchOracleKey") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleStoreRef" :aria-label="t('storeConfidentialRef')">{{ t("storeConfidentialRef") }}</NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleOpenIdentityCredential" :aria-label="t('openIdentityCredential')">{{ t("openIdentityCredential") }}</NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleCopyIdentityCredential" :aria-label="t('copyIdentityCredential')">{{ t("copyIdentityCredential") }}</NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleShareIdentityCredential" :aria-label="t('shareIdentityCredential')">{{ t("shareIdentityCredential") }}</NeoButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for NeoDID Passport
 *
 * Renders the JSON result panel and identity/DID action inputs/buttons.
 * Everything else (sidebar, stats, docs, shell chrome) is rendered
 * by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const did = computed({
  get: () => String(props.state.did?.value ?? "did:morpheus:neo_n3:service:neodid"),
  set: (val: string) => {
    if (props.state.did) {
      (props.state.did as Ref<string>).value = val;
    }
  },
});
const format = computed({
  get: () => String(props.state.format?.value ?? "resolution"),
  set: (val: string) => {
    if (props.state.format) {
      (props.state.format as Ref<string>).value = val;
    }
  },
});
const secretName = computed({
  get: () => String(props.state.secretName?.value ?? "passport-ref"),
  set: (val: string) => {
    if (props.state.secretName) {
      (props.state.secretName as Ref<string>).value = val;
    }
  },
});
const credentialRecipient = computed({
  get: () => String(props.state.credentialRecipient?.value ?? ""),
  set: (val: string) => {
    if (props.state.credentialRecipient) {
      (props.state.credentialRecipient as Ref<string>).value = val;
    }
  },
});
const credentialTemplateId = computed({
  get: () => String(props.state.credentialTemplateId?.value ?? ""),
  set: (val: string) => {
    if (props.state.credentialTemplateId) {
      (props.state.credentialTemplateId as Ref<string>).value = val;
    }
  },
});
const ciphertext = computed({
  get: () => String(props.state.ciphertext?.value ?? ""),
  set: (val: string) => {
    if (props.state.ciphertext) {
      (props.state.ciphertext as Ref<string>).value = val;
    }
  },
});
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));
const renderedPayload = computed(() => String(props.state.renderedPayload?.value ?? "{}"));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleResolveDid = async () => {
  const handler = actions.get("resolveDidDocument");
  if (handler) await handler();
};

const handleLoadProviders = async () => {
  const handler = actions.get("loadProviders");
  if (handler) await handler();
};

const handleFetchOracleKey = async () => {
  const handler = actions.get("fetchOracleKey");
  if (handler) await handler();
};

const handleStoreRef = async () => {
  const handler = actions.get("storeRef");
  if (handler) await handler();
};

const handleOpenIdentityCredential = async () => {
  const handler = actions.get("openIdentityCredentialDraft");
  if (handler) await handler();
};

const handleCopyIdentityCredential = async () => {
  const handler = actions.get("copyIdentityCredentialLink");
  if (handler) await handler();
};

const handleShareIdentityCredential = async () => {
  const handler = actions.get("shareIdentityCredentialLink");
  if (handler) await handler();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.neodid-passport-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
