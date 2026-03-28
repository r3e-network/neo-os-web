<template>
  <ConsoleMiniApp
    page-name="aa-session-key-lab"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="checkSponsor"
    hero-icon="key"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestState')"
    :operation-title="t('configureSession')"
  >
    <template #result>
      <DetailCardGrid :items="detailItems" />
    </template>

    <template #operation>
      <div class="stack">
        <NeoInput v-model="form.accountSeed" :label="t('accountSeed')" :placeholder="t('accountSeedPlaceholder')" />
        <NeoInput v-model="form.sessionPublicKey" :label="t('sessionPublicKey')" :placeholder="t('sessionPublicKeyPlaceholder')" />
        <NeoInput v-model="form.targetContract" :label="t('targetContract')" :placeholder="t('targetContractPlaceholder')" />
        <NeoInput v-model="form.allowedMethod" :label="t('allowedMethod')" :placeholder="t('allowedMethodPlaceholder')" />
        <NeoInput v-model="form.expiresAt" :label="t('expiresAt')" :placeholder="t('expiresAtPlaceholder')" />
        <div class="actions-row">
          <NeoButton variant="secondary" type="button" @click="generateSessionKey" :aria-label="t('generateKey')">{{ t("generateKey") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="aa.isCheckingSponsorship.value" @click="checkSponsor" :aria-label="t('checkSponsor')">{{ t("checkSponsor") }}</NeoButton>
          <NeoButton variant="secondary" type="button" :loading="aa.isCheckingSponsorship.value" @click="requestSponsor" :aria-label="t('requestSponsor')">{{ t("requestSponsor") }}</NeoButton>
          <NeoButton variant="primary" type="button" :loading="isSubmitting" @click="configureSessionKey" :aria-label="t('configureSession')">{{ t("configureSession") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ConsoleMiniApp, DetailCardGrid, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildAAHeroStats, buildAAOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";
import type { GasSponsorCheckResponse } from "@shared/composables/useAbstractAccount";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { deriveAAAccountIdHash, generateAASessionKeyPair } from "@shared/utils/aa-account";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

type SessionConfiguration = {
  txid: string;
  accountIdHash: string;
  publicKey: string;
  targetContract: string;
  allowedMethod: string;
  expiresAt: number;
};

const wallet = useWallet() as WalletSDK;
const { address, connect, invokeContract } = wallet;
const integration = getExternalIntegrationConfig("testnet");
const aaCore = integration.contracts.aaCore;
const aa = useAbstractAccount({
  network: "testnet",
  paymasterDappId: "miniapp-aa-session-key-lab",
});

const form = reactive({
  accountSeed: "",
  sessionPublicKey: "",
  targetContract: "",
  allowedMethod: "*",
  expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
});

const sponsorState = ref<GasSponsorCheckResponse | null>(null);
const generatedPrivateKey = ref("");
const lastConfigured = ref<SessionConfiguration | null>(null);
const isSubmitting = ref(false);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "aa-session-key-lab",
  messages,
  tab: { key: "session", labelKey: "latestState", icon: "key" },
  sidebarItems: [
    { labelKey: "accountIdHash", value: () => derivedAccountIdHash.value || t("notAvailable") },
    { labelKey: "targetContract", value: () => normalizedTargetContract.value || t("notAvailable") },
    { labelKey: "allowedMethod", value: () => normalizedAllowedMethod.value || t("anyMethod") },
  ],
});

const derivedAccountIdHash = computed(() => {
  try {
    return form.accountSeed.trim() ? `0x${deriveAAAccountIdHash(form.accountSeed)}` : "";
  } catch (_e) {
    console.warn("[aa-session-key-lab] deriveAAAccountIdHash failed:", _e instanceof Error ? _e.message : String(_e));
    return "";
  }
});

const normalizedAllowedMethod = computed(() => String(form.allowedMethod || "").trim() || t("anyMethod"));

const normalizedTargetContract = computed(() => {
  try {
    return form.targetContract.trim() ? normalizeHashOrAddress(form.targetContract) : "";
  } catch (_e) {
    console.warn("[aa-session-key-lab] normalizeHashOrAddress failed:", _e instanceof Error ? _e.message : String(_e));
    return "";
  }
});

function normalizeHashOrAddress(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error(t("invalidTargetContract"));
  }
  const normalized = trimmed.startsWith("N") ? addressToScriptHash(trimmed) : normalizeScriptHash(trimmed);
  if (!/^0x[0-9a-f]{40}$/i.test(normalized)) {
    throw new Error(t("invalidTargetContract"));
  }
  return normalized.toLowerCase();
}

function normalizeSessionPublicKey(value: string): string {
  const normalized = String(value || "").trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{66}$/i.test(normalized)) {
    throw new Error(t("invalidSessionPublicKey"));
  }
  return normalized;
}

function normalizeExpiry(value: string): number {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= Math.floor(Date.now() / 1000)) {
    throw new Error(t("invalidExpiry"));
  }
  return parsed;
}

function generateSessionKey() {
  const pair = generateAASessionKeyPair();
  form.sessionPublicKey = pair.publicKey;
  generatedPrivateKey.value = pair.privateKey;
  setStatus(t("sessionKeyGenerated"), "success");
}

async function checkSponsor() {
  try {
    sponsorState.value = await aa.checkGasSponsorship();
    setStatus(t("sponsorCheckComplete"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("sponsorCheckFailed")), "error");
  }
}

async function requestSponsor() {
  try {
    sponsorState.value = await aa.requestGasSponsorship("0.1");
    setStatus(t("sponsorRequestComplete"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("sponsorRequestFailed")), "error");
  }
}

async function configureSessionKey() {
  try {
    isSubmitting.value = true;
    if (!address.value) await connect();

    const accountIdHash = deriveAAAccountIdHash(form.accountSeed);
    const publicKey = normalizeSessionPublicKey(form.sessionPublicKey);
    const targetContract = normalizeHashOrAddress(form.targetContract);
    const allowedMethod = normalizedAllowedMethod.value;
    const expiresAt = normalizeExpiry(form.expiresAt);

    const result = await invokeContract({
      scriptHash: aaCore,
      operation: "callVerifier",
      args: [
        { type: "Hash160", value: `0x${accountIdHash}` },
        { type: "String", value: "setSessionKey" },
        {
          type: "Array",
          value: [
            { type: "Hash160", value: `0x${accountIdHash}` },
            { type: "ByteArray", value: publicKey },
            { type: "Hash160", value: targetContract },
            { type: "String", value: allowedMethod },
            { type: "Integer", value: String(expiresAt) },
          ],
        },
      ],
    });

    lastConfigured.value = {
      txid: String(result.txid || result.tx || ""),
      accountIdHash: `0x${accountIdHash}`,
      publicKey: publicKey,
      targetContract,
      allowedMethod,
      expiresAt,
    };
    setStatus(t("sessionConfigured"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("sessionConfigureFailed")), "error");
  } finally {
    isSubmitting.value = false;
  }
}

const sponsorStateText = computed(() => JSON.stringify(sponsorState.value ?? {}, null, 2));
const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore,
    middleLabel: t("sessionLabel"),
    middleValue: lastConfigured.value ? t("configured") : t("pending"),
    trailingLabel: t("verifierLabel"),
    trailingValue: integration.contracts.aaSessionKeyVerifier || t("notAvailable"),
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore,
    walletValue: address.value || t("notConnected"),
    extra: { label: t("sessionVerifier"), value: integration.contracts.aaSessionKeyVerifier || t("unset"), variant: "erobo" },
  }).concat([{ label: t("sponsor"), value: sponsorState.value ? t("checked") : t("idle"), variant: "success" }]),
);
const detailItems = computed(() => [
  { label: t("accountIdHash"), value: lastConfigured.value?.accountIdHash || derivedAccountIdHash.value || t("notAvailable") },
  { label: t("sessionPublicKey"), value: lastConfigured.value?.publicKey || form.sessionPublicKey || t("notAvailable") },
  { label: t("targetContract"), value: lastConfigured.value?.targetContract || normalizedTargetContract.value || t("notAvailable") },
  { label: t("allowedMethod"), value: lastConfigured.value?.allowedMethod || normalizedAllowedMethod.value || t("anyMethod") },
  { label: t("expiresAt"), value: lastConfigured.value?.expiresAt || form.expiresAt || t("notAvailable") },
  { label: t("lastTx"), value: lastConfigured.value?.txid || t("notAvailable") },
  { label: t("generatedPrivateKey"), value: generatedPrivateKey.value || t("notAvailable") },
  { label: t("sponsorship"), value: sponsorStateText.value },
]);
const appState = computed(() => ({
  accountIdHash: derivedAccountIdHash.value,
  targetContract: normalizedTargetContract.value,
  sessionConfigured: Boolean(lastConfigured.value),
}));
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.actions-row { @include console.actions-row; }
</style>
