<template>
  <div class="guardian-play-area">
    <!-- ── Result Section ── -->
    <div class="result-section">
      <div v-if="hasPayload" class="note-box">
        <p class="note-title">{{ t("noteTitle") }}</p>
        <p class="note-text">{{ t("noteText") }}</p>
        <div v-if="previewUrl" class="link-box">
          <p class="link-label">{{ t("openRecoveryPreview") }}</p>
          <p class="link-value">{{ previewUrl }}</p>
          <div class="link-actions">
            <NeoButton variant="secondary" size="sm" type="button" @click="handleAction('copyRecoveryPreviewLink')" :aria-label="t('copyRecoveryLink')">{{ t("copyRecoveryLink") }}</NeoButton>
            <NeoButton variant="secondary" size="sm" type="button" @click="handleAction('shareRecoveryPreviewLink')" :aria-label="t('shareRecoveryLink')">{{ t("shareRecoveryLink") }}</NeoButton>
          </div>
        </div>
        <div v-if="credentialUrl" class="link-box">
          <p class="link-label">{{ t("openRecoveryCredential") }}</p>
          <p class="link-value">{{ credentialUrl }}</p>
          <div class="link-actions">
            <NeoButton variant="secondary" size="sm" type="button" @click="handleAction('copyRecoveryCredentialLink')" :aria-label="t('copyRecoveryCredential')">{{ t("copyRecoveryCredential") }}</NeoButton>
            <NeoButton variant="secondary" size="sm" type="button" @click="handleAction('shareRecoveryCredentialLink')" :aria-label="t('shareRecoveryCredential')">{{ t("shareRecoveryCredential") }}</NeoButton>
          </div>
        </div>
      </div>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </div>

    <!-- ── Operation Section ── -->
    <div class="operation-section">
      <div class="stack">
        <NeoInput :modelValue="accountAddress" @update:modelValue="setField('accountAddress', $event)" :label="t('accountAddress')" :placeholder="t('accountAddressPlaceholder')" />
        <NeoInput :modelValue="verifierHashOverride" @update:modelValue="setField('verifierHashOverride', $event)" :label="t('verifierHash')" :placeholder="t('verifierHashPlaceholder')" />
        <NeoInput :modelValue="recoveryNewOwner" @update:modelValue="setField('recoveryNewOwner', $event)" :label="t('newOwner')" :placeholder="t('newOwnerPlaceholder')" />
        <NeoInput :modelValue="recoveryExpiryMinutes" @update:modelValue="setField('recoveryExpiryMinutes', $event)" :label="t('recoveryExpiry')" :placeholder="t('recoveryExpiryPlaceholder')" />
        <NeoInput :modelValue="recoveryTemplateId" @update:modelValue="setField('recoveryTemplateId', $event)" :label="t('recoveryTemplateId')" :placeholder="t('recoveryTemplateIdPlaceholder')" />
        <div class="button-row">
          <NeoButton variant="primary" type="button" :loading="isQuerying" @click="handleAction('queryGuardianState')" :aria-label="t('queryState')">{{ t("queryState") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('openRecoveryPreviewLink')" :aria-label="t('openRecoveryPreview')">{{ t("openRecoveryPreview") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('copyRecoveryPreviewLink')" :aria-label="t('copyRecoveryLink')">{{ t("copyRecoveryLink") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('shareRecoveryPreviewLink')" :aria-label="t('shareRecoveryLink')">{{ t("shareRecoveryLink") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('openRecoveryCredentialLink')" :aria-label="t('openRecoveryCredential')">{{ t("openRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('copyRecoveryCredentialLink')" :aria-label="t('copyRecoveryCredential')">{{ t("copyRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('shareRecoveryCredentialLink')" :aria-label="t('shareRecoveryCredential')">{{ t("shareRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('openIdentityWorkspace')" :aria-label="t('openIdentityWorkspace')">{{ t("openIdentityWorkspace") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('openAaWorkspace')" :aria-label="t('openAaWorkspace')">{{ t("openAaWorkspace") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="handleAction('openRecoveryDocs')" :aria-label="t('openRecoveryDocs')">{{ t("openRecoveryDocs") }}</NeoButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Recovery Guardian
 *
 * Renders the guardian state result display (with recovery preview and
 * credential links) and the query operation form with all action buttons.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
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
const hasPayload = computed(() => Boolean(props.state.hasPayload?.value ?? false));
const renderedPayload = computed(() => String(props.state.renderedPayload?.value ?? t("noStateYet")));
const previewUrl = computed(() => String(props.state.previewUrl?.value ?? ""));
const credentialUrl = computed(() => String(props.state.credentialUrl?.value ?? ""));
const accountAddress = computed(() => String(props.state.accountAddress?.value ?? ""));
const verifierHashOverride = computed(() => String(props.state.verifierHashOverride?.value ?? ""));
const recoveryNewOwner = computed(() => String(props.state.recoveryNewOwner?.value ?? ""));
const recoveryExpiryMinutes = computed(() => String(props.state.recoveryExpiryMinutes?.value ?? "30"));
const recoveryTemplateId = computed(() => String(props.state.recoveryTemplateId?.value ?? ""));
const isQuerying = computed(() => Boolean(props.state.isQuerying?.value ?? false));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleAction = async (name: string) => {
  const handler = actions.get(name);
  if (handler) await handler();
};

const setField = (field: string, value: string) => {
  const handler = actions.get("setField");
  if (handler) handler(field, value);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&display=swap');

.guardian-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Exo 2', sans-serif;
  background: linear-gradient(160deg, #1E3A5F 0%, #172554 40%, #0F1D3A 100%);
  color: #CBD5E1;
  border-radius: 12px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.guardian-play-area::before {
  content: "";
  position: absolute;
  top: -60px;
  right: -60px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 60%);
  pointer-events: none;
}

.guardian-play-area::after {
  content: "";
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 44px;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  pointer-events: none;
}

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }

.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 8px;
  font-family: 'Exo 2', monospace;
  font-size: 12px;
}

.note-box {
  margin-bottom: 12px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(203, 213, 225, 0.03));
  position: relative;
  z-index: 1;
}

.note-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 6px;
  color: #60A5FA;
  font-family: 'Exo 2', sans-serif;
}

.note-text {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.8;
}

.link-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(37, 99, 235, 0.1);
}

.link-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 6px;
  color: #93C5FD;
  font-family: 'Exo 2', sans-serif;
}

.link-value {
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.88;
  word-break: break-all;
  color: #CBD5E1;
}

.link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.result-section,
.operation-section {
  position: relative;
  z-index: 1;
}
</style>
