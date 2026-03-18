<template>
  <MiniAppPage
    name="oracle-seal-console"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadKey"
  >
    <template #content>
      <HeroSection variant="erobo" icon="🔐" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStats" compact />
        </template>
      </HeroSection>

      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

      <NeoCard variant="erobo" :title="t('publicKeyTitle')" class="mb-6">
        <div class="details-grid">
          <div><span class="label">{{ t("algorithm") }}</span><span class="value">{{ keyMeta?.algorithm || "—" }}</span></div>
          <div><span class="label">{{ t("network") }}</span><span class="value">{{ keyMeta?.network || oracle.network }}</span></div>
          <div><span class="label">{{ t("contract") }}</span><span class="value">{{ keyMeta?.contract || "—" }}</span></div>
          <div><span class="label">{{ t("rpc") }}</span><span class="value">{{ keyMeta?.rpc_url || "—" }}</span></div>
          <div><span class="label">{{ t("source") }}</span><span class="value">{{ keyMeta?.source || "—" }}</span></div>
          <div><span class="label">Public Key</span><span class="value">{{ keyMeta?.public_key || "—" }}</span></div>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('outputTitle')" class="mb-6">
        <div class="stack">
          <label class="label">{{ t("ciphertext") }}</label>
          <textarea :value="ciphertext" class="json-box" rows="7" readonly />
          <NeoButton variant="secondary" :disabled="!ciphertext" @click="copyText(ciphertext, 'cipher')">
            {{ copiedKey === "cipher" ? t("copied") : t("copyCiphertext") }}
          </NeoButton>

          <label class="label">{{ t("wrapperJson") }}</label>
          <textarea :value="wrapperJson" class="json-box" rows="7" readonly />
          <NeoButton variant="secondary" :disabled="!ciphertext" @click="copyText(wrapperJson, 'wrapper')">
            {{ copiedKey === "wrapper" ? t("copied") : t("copyWrapper") }}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('refTitle')" class="mb-6">
        <div class="stack">
          <div class="details-grid">
            <div><span class="label">{{ t("secretRef") }}</span><span class="value">{{ storedRef?.secret_ref || "—" }}</span></div>
            <div><span class="label">{{ t("storageName") }}</span><span class="value">{{ storedRef?.name || storageName || "—" }}</span></div>
          </div>

          <label class="label">{{ t("copyRefWrapper") }}</label>
          <textarea :value="refWrapperJson" class="json-box" rows="5" readonly />
          <NeoButton variant="secondary" :disabled="!storedRef?.secret_ref" @click="copyText(refWrapperJson, 'ref')">
            {{ copiedKey === "ref" ? t("copied") : t("copyRefWrapper") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('payloadInputTitle')" class="px-1">
        <div class="stack">
          <div class="button-row">
            <NeoButton :variant="inputMode === 'json' ? 'primary' : 'secondary'" @click="inputMode = 'json'">{{ t("jsonMode") }}</NeoButton>
            <NeoButton :variant="inputMode === 'text' ? 'primary' : 'secondary'" @click="inputMode = 'text'">{{ t("textMode") }}</NeoButton>
          </div>

          <div class="button-row button-row--three">
            <NeoButton :variant="fieldName === 'encrypted_payload' ? 'primary' : 'secondary'" @click="fieldName = 'encrypted_payload'">{{ t("encryptedPayload") }}</NeoButton>
            <NeoButton :variant="fieldName === 'encrypted_params' ? 'primary' : 'secondary'" @click="fieldName = 'encrypted_params'">{{ t("encryptedParams") }}</NeoButton>
            <NeoButton :variant="fieldName === 'encrypted_token' ? 'primary' : 'secondary'" @click="fieldName = 'encrypted_token'">{{ t("encryptedToken") }}</NeoButton>
          </div>

          <NeoInput
            v-model="confidentialInput"
            type="textarea"
            :label="t('plaintextLabel')"
            :hint="t('helperNote')"
            placeholder="{&#10;  &quot;mode&quot;: &quot;builtin&quot;,&#10;  &quot;function&quot;: &quot;math.modexp&quot;,&#10;  &quot;input&quot;: { &quot;base&quot;: &quot;2&quot;, &quot;exponent&quot;: &quot;10&quot;, &quot;modulus&quot;: &quot;17&quot; }&#10;}"
          />

          <NeoInput v-model="storageName" :label="t('storageName')" placeholder="oracle-compute-demo" />
          <NeoInput v-model="projectSlug" :label="t('projectSlug')" placeholder="optional" />
          <NeoInput v-model="boundRequester" :label="t('requesterScriptHash')" placeholder="0x... optional" />
          <NeoInput v-model="boundCallbackContract" :label="t('callbackContract')" placeholder="0x... optional" />

          <NeoButton variant="secondary" :loading="isLoadingKey" @click="loadKey">{{ t("refreshKey") }}</NeoButton>
          <NeoButton variant="primary" :loading="isSealing" :disabled="!canSeal" @click="sealPayload">{{ t("sealNow") }}</NeoButton>
          <NeoButton variant="secondary" :loading="isStoring" :disabled="!canStoreRef" @click="storeCiphertextRef">{{ t("storeRef") }}</NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useOracle, type ConfidentialStoreResponse, type OraclePublicKeyResponse } from "@shared/composables/useOracle";
import { encryptJsonWithOraclePublicKey, encryptTextWithOraclePublicKey } from "@shared/utils/morpheus-encryption";
import { messages } from "@/locale/messages";

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

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "oracle-seal-console",
  messages,
  template: { tabs: [{ key: "seal", labelKey: "outputTitle", icon: "🔐", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [
    { labelKey: "modeLabel", value: () => inputMode.value },
    { labelKey: "fieldTypeTitle", value: () => fieldName.value },
    { labelKey: "algorithm", value: () => keyMeta.value?.algorithm || "—" },
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
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  } finally {
    isLoadingKey.value = false;
  }
}

async function sealPayload() {
  try {
    if (!keyMeta.value?.public_key) {
      throw new Error("Oracle public key is unavailable.");
    }
    isSealing.value = true;
    ciphertext.value = inputMode.value === "json"
      ? await encryptJsonWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value)
      : await encryptTextWithOraclePublicKey(keyMeta.value.public_key, confidentialInput.value);
    storedRef.value = null;
    setStatus(t("sealed"), "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
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
      throw new Error("Ciphertext is required.");
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
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  } finally {
    isStoring.value = false;
  }
}

async function copyText(value: string, key: "cipher" | "wrapper" | "ref") {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  copiedKey.value = key;
  window.setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = null;
  }, 1500);
}

onMounted(() => {
  void loadKey();
});

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Network", value: keyMeta.value?.network || oracle.network, icon: "🌐" },
  { label: "Field", value: fieldName.value, icon: "🧩" },
  { label: "Mode", value: inputMode.value, icon: "📦" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("algorithm"), value: keyMeta.value?.algorithm || "unloaded", variant: "accent" },
  { label: t("contract"), value: keyMeta.value?.contract || "unloaded", variant: "default" },
  { label: t("source"), value: keyMeta.value?.source || "unloaded", variant: "success" },
]);

const appState = computed(() => ({
  mode: inputMode.value,
  field: fieldName.value,
  hasCiphertext: Boolean(ciphertext.value),
  secretRef: storedRef.value?.secret_ref || null,
}));
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.label {
  display: block;
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
}

.value {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  word-break: break-all;
  white-space: pre-wrap;
}

.json-box {
  width: 100%;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,.08);
  padding: 12px;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
}

.button-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.button-row--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (min-width: 960px) {
  .details-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
