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
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'OCR A Std', 'Courier New', monospace;
  background: linear-gradient(160deg, #1E293B 0%, #0F172A 50%, #1A1F35 100%);
  color: #CBD5E1;
  border-radius: 12px;
  border: 2px solid #334155;
  position: relative;
  overflow: hidden;
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.25);
}

.neodid-passport-play-area::before {
  content: "DIGITAL PASSPORT";
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  letter-spacing: 6px;
  color: rgba(212, 168, 83, 0.25);
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
}

.neodid-passport-play-area::after {
  content: "";
  position: absolute;
  top: 24px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 2px solid rgba(212, 168, 83, 0.2);
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, rgba(212, 168, 83, 0.08), transparent);
  pointer-events: none;
}

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }

.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 4px;
  font-family: 'OCR A Std', 'Courier New', monospace;
  font-size: 12px;
  color: #94A3B8;
}
</style>
