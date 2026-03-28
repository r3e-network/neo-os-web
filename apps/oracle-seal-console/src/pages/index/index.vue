<template>
  <ConsoleMiniApp
    page-name="oracle-seal-console"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="loadKey"
    hero-icon="locked"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('outputTitle')"
    :operation-title="t('payloadInputTitle')"
    :wrap-result-card="false"
  >
    <template #result>
      <NeoCard variant="erobo" :title="t('publicKeyTitle')" class="mb-6">
        <div class="details-grid">
          <div><span class="label">{{ t("algorithm") }}</span><span class="value">{{ keyMeta?.algorithm || t("notAvailable") }}</span></div>
          <div><span class="label">{{ t("network") }}</span><span class="value">{{ keyMeta?.network || oracle.network }}</span></div>
          <div><span class="label">{{ t("contract") }}</span><span class="value">{{ keyMeta?.contract || t("notAvailable") }}</span></div>
          <div><span class="label">{{ t("rpc") }}</span><span class="value">{{ keyMeta?.rpc_url || t("notAvailable") }}</span></div>
          <div><span class="label">{{ t("source") }}</span><span class="value">{{ keyMeta?.source || t("notAvailable") }}</span></div>
          <div><span class="label">{{ t("publicKeyLabel") }}</span><span class="value">{{ keyMeta?.public_key || t("notAvailable") }}</span></div>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('outputTitle')" class="mb-6">
        <div class="stack">
          <label for="ciphertext" class="label">{{ t("ciphertext") }}</label>
          <textarea id="ciphertext" :value="ciphertext" class="json-box" rows="7" readonly :aria-label="t('ciphertext')" />
          <NeoButton variant="secondary" type="button" :disabled="!ciphertext" :aria-label="t('copyCiphertext')" @click="copyText(ciphertext, 'cipher')">
            {{ copiedKey === "cipher" ? t("copied") : t("copyCiphertext") }}
          </NeoButton>

          <label for="wrapper-json" class="label">{{ t("wrapperJson") }}</label>
          <textarea id="wrapper-json" :value="wrapperJson" class="json-box" rows="7" readonly :aria-label="t('wrapperJson')" />
          <NeoButton variant="secondary" type="button" :disabled="!ciphertext" :aria-label="t('copyWrapper')" @click="copyText(wrapperJson, 'wrapper')">
            {{ copiedKey === "wrapper" ? t("copied") : t("copyWrapper") }}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('refTitle')" class="mb-6">
        <div class="stack">
          <div class="details-grid">
            <div><span class="label">{{ t("secretRef") }}</span><span class="value">{{ storedRef?.secret_ref || t("notAvailable") }}</span></div>
            <div><span class="label">{{ t("storageName") }}</span><span class="value">{{ storedRef?.name || storageName || t("notAvailable") }}</span></div>
          </div>

          <label for="ref-wrapper" class="label">{{ t("copyRefWrapper") }}</label>
          <textarea id="ref-wrapper" :value="refWrapperJson" class="json-box" rows="5" readonly :aria-label="t('copyRefWrapper')" />
          <NeoButton variant="secondary" type="button" :disabled="!storedRef?.secret_ref" :aria-label="t('copyRefWrapper')" @click="copyText(refWrapperJson, 'ref')">
            {{ copiedKey === "ref" ? t("copied") : t("copyRefWrapper") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>

    <template #operation>
      <div class="stack">
        <div class="button-row">
          <NeoButton :variant="inputMode === 'json' ? 'primary' : 'secondary'" type="button" :aria-label="t('jsonMode')" @click="inputMode = 'json'">{{ t("jsonMode") }}</NeoButton>
          <NeoButton :variant="inputMode === 'text' ? 'primary' : 'secondary'" type="button" :aria-label="t('textMode')" @click="inputMode = 'text'">{{ t("textMode") }}</NeoButton>
        </div>

        <div class="button-row button-row--three">
          <NeoButton :variant="fieldName === 'encrypted_payload' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedPayload')" @click="fieldName = 'encrypted_payload'">{{ t("encryptedPayload") }}</NeoButton>
          <NeoButton :variant="fieldName === 'encrypted_params' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedParams')" @click="fieldName = 'encrypted_params'">{{ t("encryptedParams") }}</NeoButton>
          <NeoButton :variant="fieldName === 'encrypted_token' ? 'primary' : 'secondary'" type="button" :aria-label="t('encryptedToken')" @click="fieldName = 'encrypted_token'">{{ t("encryptedToken") }}</NeoButton>
        </div>

        <NeoInput
          v-model="confidentialInput"
          type="textarea"
          :label="t('plaintextLabel')"
          :hint="t('helperNote')"
          :placeholder="t('confidentialJsonPlaceholder')"
        />

        <NeoInput v-model="storageName" :label="t('storageName')" :placeholder="t('storageNamePlaceholder')" />
        <NeoInput v-model="projectSlug" :label="t('projectSlug')" :placeholder="t('optional')" />
        <NeoInput v-model="boundRequester" :label="t('requesterScriptHash')" :placeholder="t('hexOptional')" />
        <NeoInput v-model="boundCallbackContract" :label="t('callbackContract')" :placeholder="t('hexOptional')" />

        <NeoButton variant="secondary" type="button" :loading="isLoadingKey" :aria-label="t('refreshKey')" @click="loadKey">{{ t("refreshKey") }}</NeoButton>
        <NeoButton variant="primary" type="button" :loading="isSealing" :disabled="!canSeal" :aria-label="t('sealNow')" @click="sealPayload">{{ t("sealNow") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isStoring" :disabled="!canStoreRef" :aria-label="t('storeRef')" @click="storeCiphertextRef">{{ t("storeRef") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ConsoleMiniApp, HeroStatsStrip, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { useOracle, type ConfidentialStoreResponse, type OraclePublicKeyResponse } from "@shared/composables/useOracle";
import { encryptJsonWithOraclePublicKey, encryptTextWithOraclePublicKey } from "../../utils/encryption";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const oracle = useOracle({ appId: "miniapp-oracle-seal-console" });
const keyMeta = ref<OraclePublicKeyResponse | null>(null);
const inputMode = ref<"json" | "text">("json");
const fieldName = ref<"encrypted_payload" | "encrypted_params" | "encrypted_token">("encrypted_payload");
const confidentialInput = ref(`{\n  "mode": "builtin",\n  "function": "math.modexp",\n  "input": {\n    "base": "2",\n    "exponent": "10",\n    "modulus": "17"\n  },\n  "target_chain": "neo_n3"\n}`);
const ciphertext = ref("");
const isLoadingKey = ref(false);
const isSealing = ref(false);
const isStoring = ref(false);
const copiedKey = ref<"cipher" | "wrapper" | "ref" | null>(null);
const storageName = ref("");
const projectSlug = ref("");
const boundRequester = ref("");
const boundCallbackContract = ref("");
const storedRef = ref<ConfidentialStoreResponse | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "oracle-seal-console",
  messages,
  tab: { key: "seal", labelKey: "outputTitle", icon: "🔐" },
  sidebarItems: [
    { labelKey: "modeLabel", value: () => t(inputMode.value === "json" ? "jsonMode" : "textMode") },
    { labelKey: "fieldTypeTitle", value: () => t(fieldName.value === "encrypted_payload" ? "encryptedPayload" : fieldName.value === "encrypted_params" ? "encryptedParams" : "encryptedToken") },
    { labelKey: "algorithm", value: () => keyMeta.value?.algorithm || t("notAvailable") },
  ],
});

const canSeal = computed(() => Boolean(keyMeta.value?.public_key && confidentialInput.value.trim()));
const wrapperJson = computed(() => ciphertext.value ? JSON.stringify({ [fieldName.value]: ciphertext.value }, null, 2) : "");
const refFieldName = computed(() => fieldName.value === "encrypted_payload" ? "encrypted_payload_ref" : fieldName.value === "encrypted_params" ? "encrypted_params_ref" : "");
const canStoreRef = computed(() => Boolean(ciphertext.value && refFieldName.value));
const refWrapperJson = computed(() => storedRef.value?.secret_ref && refFieldName.value
  ? JSON.stringify({ [refFieldName.value]: storedRef.value.secret_ref }, null, 2)
  : "");

async function loadKey() {
  try {
    isLoadingKey.value = true;
    keyMeta.value = await oracle.getOraclePublicKey();
    setStatus(t("loaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("loadKeyFailed")), "error");
  } finally {
    isLoadingKey.value = false;
  }
}

async function sealPayload() {
  try {
    if (!keyMeta.value?.public_key) {
      throw new Error(t("oracleKeyUnavailable"));
    }
    isSealing.value = true;
    ciphertext.value = inputMode.value === "json"
      ? await encryptJsonWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value)
      : await encryptTextWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value);
    storedRef.value = null;
    setStatus(t("sealed"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("sealFailed")), "error");
  } finally {
    isSealing.value = false;
  }
}

async function storeCiphertextRef() {
  try {
    if (!refFieldName.value) {
      throw new Error(t("refUnavailableForToken"));
    }
    if (!ciphertext.value) {
      throw new Error(t("ciphertextRequired"));
    }
    isStoring.value = true;
    storedRef.value = await oracle.storeConfidentialCiphertext({
      ciphertext: ciphertext.value,
      name: storageName.value || undefined,
      project_slug: projectSlug.value || undefined,
      requester_script_hash: boundRequester.value || undefined,
      callback_contract: boundCallbackContract.value || undefined,
      metadata: {
        app_id: "miniapp-oracle-seal-console",
        field: fieldName.value,
      },
    });
    setStatus(t("stored"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("storeRefFailed")), "error");
  } finally {
    isStoring.value = false;
  }
}

let copyTimer: ReturnType<typeof setTimeout> | undefined;

async function copyText(value: string, key: "cipher" | "wrapper" | "ref") {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    if (copyTimer !== undefined) {
      clearTimeout(copyTimer);
      copyTimer = undefined;
    }
    copiedKey.value = key;
    copyTimer = setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
      copyTimer = undefined;
    }, 1500);
  } catch (_e) {
    console.warn("[oracle-seal-console] clipboard copy failed:", _e instanceof Error ? _e.message : String(_e));
  }
}

onMounted(() => {
  void loadKey();
});

onUnmounted(() => {
  if (copyTimer !== undefined) {
    clearTimeout(copyTimer);
    copyTimer = undefined;
  }
});

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: t("heroNetwork"), value: keyMeta.value?.network || oracle.network, icon: "🌐" },
  { label: t("heroField"), value: t(fieldName.value === "encrypted_payload" ? "encryptedPayload" : fieldName.value === "encrypted_params" ? "encryptedParams" : "encryptedToken"), icon: "🧩" },
  { label: t("heroMode"), value: t(inputMode.value === "json" ? "jsonMode" : "textMode"), icon: "📦" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("algorithm"), value: keyMeta.value?.algorithm || t("notLoaded"), variant: "accent" },
  { label: t("contract"), value: keyMeta.value?.contract || t("notLoaded"), variant: "default" },
  { label: t("source"), value: keyMeta.value?.source || t("notLoaded"), variant: "success" },
]);

const appState = computed(() => ({
  mode: inputMode.value,
  field: fieldName.value,
  hasCiphertext: Boolean(ciphertext.value),
  secretRef: storedRef.value?.secret_ref || null,
}));
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.details-grid { @include console.detail-grid-min; }
.label { @include console.label; }
.value { @include console.value; }
.json-box { @include console.json-box; }
.button-row { @include console.button-grid(2); }
.button-row--three { @include console.button-grid(3); }
</style>
