<template>
  <ConsoleMiniApp
    page-name="neodid-passport"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="resolveDidDocument"
    hero-icon="user"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestResult')"
    :operation-title="t('passportActions')"
  >
    <template #result>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="did" :label="t('did')" :placeholder="t('didPlaceholder')" />
        <NeoInput v-model="format" :label="t('format')" :placeholder="t('formatPlaceholder')" />
        <NeoInput v-model="secretName" :label="t('secretName')" :placeholder="t('secretNamePlaceholder')" />
        <NeoInput v-model="credentialRecipient" :label="t('credentialRecipient')" :placeholder="t('credentialRecipientPlaceholder')" />
        <NeoInput v-model="credentialTemplateId" :label="t('credentialTemplateId')" :placeholder="t('credentialTemplateIdPlaceholder')" />
        <NeoInput v-model="ciphertext" type="textarea" :label="t('ciphertext')" :placeholder="t('ciphertextPlaceholder')" />
        <div class="button-row">
          <NeoButton variant="primary" type="button" :loading="oracle.isRequesting" @click="resolveDidDocument" :aria-label="t('resolveDid')">{{ t("resolveDid") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="loadProviders" :aria-label="t('loadProviders')">{{ t("loadProviders") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="fetchOracleKey" :aria-label="t('fetchOracleKey')">{{ t("fetchOracleKey") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="oracle.isRequesting" @click="storeRef" :aria-label="t('storeConfidentialRef')">{{ t("storeConfidentialRef") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openIdentityCredentialDraft" :aria-label="t('openIdentityCredential')">{{ t("openIdentityCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="copyIdentityCredentialLink" :aria-label="t('copyIdentityCredential')">{{ t("copyIdentityCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="shareIdentityCredentialLink" :aria-label="t('shareIdentityCredential')">{{ t("shareIdentityCredential") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildOracleHeroStats, buildOracleOverviewStats } from "@shared/utils/console-stats";
import { useOracle } from "@shared/composables/useOracle";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { messages } from "@/locale/messages";

const oracle = useOracle({ appId: "miniapp-neodid-passport" });
const wallet = useWallet() as WalletSDK;
const did = ref("did:morpheus:neo_n3:service:neodid");
const format = ref("resolution");
const secretName = ref("passport-ref");
const credentialRecipient = ref("");
const credentialTemplateId = ref("");
const ciphertext = ref("");
const latestPayload = ref<Record<string, unknown> | null>(null);
const soulboundAppUrl = "/miniapps/soulbound-certificate/index.html";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "neodid-passport",
  messages,
  tab: { key: "passport", labelKey: "latestResult", icon: "🪪" },
  sidebarItems: [
    { labelKey: "did", value: () => did.value },
    { labelKey: "format", value: () => normalizedFormat.value },
    { labelKey: "providerCount", value: () => providerCount.value },
    { labelKey: "secretName", value: () => secretName.value || t("notAvailable") },
  ],
});

const normalizedFormat = computed<"resolution" | "document">(() =>
  String(format.value || "").trim().toLowerCase() === "document" ? "document" : "resolution",
);

async function resolveDidDocument() {
  try {
    latestPayload.value = await oracle.resolveNeoDid(did.value, normalizedFormat.value);
    setStatus(t("resultLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("resolveFailed")), "error");
  }
}

async function loadProviders() {
  try {
    latestPayload.value = await oracle.getNeoDidProviders();
    setStatus(t("providersLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("loadProvidersFailed")), "error");
  }
}

async function fetchOracleKey() {
  try {
    latestPayload.value = await oracle.getOraclePublicKey() as Record<string, unknown>;
    setStatus(t("keyLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("keyFailed")), "error");
  }
}

async function storeRef() {
  if (!String(ciphertext.value || "").trim()) {
    setStatus(t("storeFailed"), "error");
    return;
  }
  try {
    latestPayload.value = await oracle.storeConfidentialCiphertext({
      ciphertext: ciphertext.value,
      name: secretName.value || undefined,
      project_slug: "neodid-passport",
      metadata: {
        did: did.value,
        format: normalizedFormat.value,
      },
    }) as unknown as Record<string, unknown>;
    setStatus(t("refStored"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("storeFailed")), "error");
  }
}

function buildIdentityCredentialUrl() {
  const payload = latestPayload.value || {};
  const recipient = String(credentialRecipient.value || wallet.address.value || "").trim();
  const resolvedDid = String((payload.id as string) || did.value || "").trim();
  const achievement = resolvedDid ? `NeoDID Passport Verified` : "Identity Credential";
  const memo = resolvedDid ? `DID ${resolvedDid}` : "Identity credential draft";
  const params = new URLSearchParams({
    issueRecipient: recipient,
    issueRecipientName: "",
    issueAchievement: achievement,
    issueMemo: memo,
    issueCategory: "Identity",
    issueCredentialType: "identity_passport",
    issueIssuerPolicy: "identity_issuer_attests_neodid_resolution",
    issueSource: "neodid-passport",
    autoIssueDraft: "1",
  });
  if (credentialTemplateId.value.trim()) {
    params.set("issueTemplateId", credentialTemplateId.value.trim());
  }
  return `${soulboundAppUrl}?${params.toString()}`;
}

function openIdentityCredentialDraft() {
  try {
    const url = buildIdentityCredentialUrl();
    if (typeof window !== "undefined" && window.open) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setStatus(t("identityCredentialReady"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("resolveFailed")), "error");
  }
}

async function copyIdentityCredentialLink() {
  try {
    const url = buildIdentityCredentialUrl();
    await navigator.clipboard.writeText(url);
    setStatus(t("identityCredentialCopied"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("resolveFailed")), "error");
  }
}

async function shareIdentityCredentialLink() {
  try {
    const url = buildIdentityCredentialUrl();
    if (navigator.share) {
      await navigator.share({
        title: t("openIdentityCredential"),
        text: t("openIdentityCredential"),
        url,
      });
      setStatus(t("identityCredentialShared"), "success");
      return;
    }
    await copyIdentityCredentialLink();
  } catch (error: unknown) {
    if (error instanceof Error && /abort|cancel/i.test(error.message)) return;
    await copyIdentityCredentialLink();
  }
}

const providerCount = computed(() => {
  const payload = latestPayload.value;
  if (!payload) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload.providers)) return payload.providers.length;
  if (payload.providers && typeof payload.providers === "object") {
    return Object.keys(payload.providers as Record<string, unknown>).length;
  }
  return 0;
});

const renderedPayload = computed(() => JSON.stringify(latestPayload.value ?? {}, null, 2) || t("notAvailable"));

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildOracleHeroStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    network: oracle.network,
    middleLabel: t("format"),
    middleValue: normalizedFormat.value,
  }),
);

const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildOracleOverviewStats({
    oracleHash: oracle.integration.contracts.morpheusOracle,
    publicApiUrl: oracle.integration.morpheusPublicApiUrl,
    extra: {
      label: oracle.integration.domains.neodid ? t("neodidDomain") : t("oracleKeyAlgorithm"),
      value: oracle.integration.domains.neodid || oracle.integration.contracts.morpheusNeoDid || t("notAvailable"),
      variant: "erobo",
    },
  }),
);

const appState = computed(() => ({
  did: did.value,
  format: normalizedFormat.value,
  providerCount: providerCount.value,
  secretName: secretName.value,
  credentialRecipient: credentialRecipient.value || wallet.address.value || "",
  credentialTemplateId: credentialTemplateId.value,
  hasCiphertext: Boolean(ciphertext.value.trim()),
}));
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
