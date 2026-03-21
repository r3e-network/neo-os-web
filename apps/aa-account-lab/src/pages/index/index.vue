<template>
  <ConsoleMiniApp
    page-name="aa-account-lab"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="inspectAccount"
    hero-icon="🪪"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('inspectorTitle')"
    :operation-title="t('registerTitle')"
  >
    <template #result>
      <div class="field-stack">
        <NeoInput v-model="inspectForm.accountIdInput" :label="t('accountId')" :placeholder="t('accountIdPlaceholder')" />
        <div class="actions-row">
          <NeoButton variant="primary" type="button" :loading="isInspecting" @click="inspectAccount" :aria-label="t('inspect')">{{ t("inspect") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="connect" :aria-label="t('connectWallet')">{{ t("connectWallet") }}</NeoButton>
        </div>
      </div>

      <DetailCardGrid :items="detailItems" />
    </template>

    <template #operation>
      <div class="field-stack">
        <NeoInput v-model="registerForm.accountIdInput" :label="t('accountId')" :placeholder="t('accountIdPlaceholder')" />
        <NeoInput v-model="registerForm.verifierHash" :label="t('verifier')" :placeholder="t('verifierPlaceholder')" />
        <NeoInput v-model="registerForm.verifierParamsHex" :label="t('verifierParams')" :placeholder="t('verifierParamsPlaceholder')" />
        <NeoInput v-model="registerForm.hookHash" :label="t('hook')" :placeholder="t('hookPlaceholder')" />
        <NeoInput v-model="registerForm.backupOwner" :label="t('backupOwner')" :placeholder="t('backupOwnerPlaceholder')" />
        <NeoInput v-model="registerForm.escapeTimelock" :label="t('timelock')" :placeholder="t('timelockPlaceholder')" />
        <NeoButton variant="primary" type="button" :loading="isSubmitting" @click="submitRegister" :aria-label="t('register')">{{ t("register") }}</NeoButton>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ConsoleMiniApp, DetailCardGrid, HeroStatsStrip, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildAAHeroStats, buildAAOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";
import { deriveAAAccountIdHash } from "@shared/utils/aa-account";

const wallet = useWallet() as WalletSDK;
const { address, connect, invokeRead, invokeContract } = wallet;
const integration = getExternalIntegrationConfig("testnet");
const aaCore = integration.contracts.aaCore;
const defaultVerifier = integration.contracts.aaWeb3AuthVerifier;

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  handleBoundaryError,
} = createConsolePage({
  name: "aa-account-lab",
  messages,
  tab: { key: "register", labelKey: "register", icon: "🪪" },
  sidebarItems: [
    { labelKey: "currentVerifier", value: () => inspected.verifier || t("notAvailable") },
    { labelKey: "currentHook", value: () => inspected.hook || t("notAvailable") },
    { labelKey: "currentBackupOwner", value: () => inspected.backupOwner || t("notAvailable") },
  ],
});

const inspectForm = reactive({ accountIdInput: "" });
const registerForm = reactive({
  accountIdInput: "",
  verifierHash: defaultVerifier,
  verifierParamsHex: "",
  hookHash: "",
  backupOwner: "",
  escapeTimelock: "2592000",
});

const inspected = reactive({
  accountIdHash: "",
  verifier: "",
  hook: "",
  backupOwner: "",
});

const isInspecting = ref(false);
const isSubmitting = ref(false);

function deriveAccountIdHash(input: string): string {
  try {
    return deriveAAAccountIdHash(input);
  } catch (e: unknown) {
    throw new Error(t("invalidAccountId"));
  }
}

function normalizeHashOrZero(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "0x0000000000000000000000000000000000000000";
  const normalized = trimmed.startsWith("N") ? addressToScriptHash(trimmed) : normalizeScriptHash(trimmed);
  if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidHash"));
  return normalized;
}

function normalizeBackupOwner(value: string): string {
  const normalized = value.trim().startsWith("N") ? addressToScriptHash(value.trim()) : normalizeScriptHash(value.trim());
  if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidBackupOwner"));
  return normalized;
}

async function inspectAccount() {
  try {
    isInspecting.value = true;
    const accountIdHash = deriveAccountIdHash(inspectForm.accountIdInput);
    inspected.accountIdHash = accountIdHash;
    const accountId = `0x${accountIdHash}`;
    const [verifier, hook, backupOwner] = await Promise.all([
      invokeRead({ scriptHash: aaCore, operation: "getVerifier", args: [{ type: "Hash160", value: accountId }] }),
      invokeRead({ scriptHash: aaCore, operation: "getHook", args: [{ type: "Hash160", value: accountId }] }),
      invokeRead({ scriptHash: aaCore, operation: "getBackupOwner", args: [{ type: "Hash160", value: accountId }] }),
    ]);
    inspected.verifier = String(parseInvokeResult(verifier) || t("notAvailable"));
    inspected.hook = String(parseInvokeResult(hook) || t("notAvailable"));
    inspected.backupOwner = String(parseInvokeResult(backupOwner) || t("notAvailable"));
    setStatus(t("inspectSuccess"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("invalidAccountId")), "error");
  } finally {
    isInspecting.value = false;
  }
}

async function submitRegister() {
  try {
    isSubmitting.value = true;
    if (!address.value) await connect();
    const accountIdHash = deriveAccountIdHash(registerForm.accountIdInput);
    const verifierHash = normalizeHashOrZero(registerForm.verifierHash);
    const hookHash = normalizeHashOrZero(registerForm.hookHash);
    const backupOwner = normalizeBackupOwner(registerForm.backupOwner);
    const escapeTimelock = parseInt(registerForm.escapeTimelock, 10) || 2592000;
    const verifierParams = registerForm.verifierParamsHex.trim().replace(/^0x/, "");
    await invokeContract({
      scriptHash: aaCore,
      operation: "registerAccount",
      args: [
        { type: "Hash160", value: `0x${accountIdHash}` },
        { type: "Hash160", value: verifierHash },
        { type: "ByteArray", value: verifierParams },
        { type: "Hash160", value: hookHash },
        { type: "Hash160", value: backupOwner },
        { type: "Integer", value: String(escapeTimelock) },
      ],
    });
    setStatus(t("registerSuccess"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("invalidAccountId")), "error");
  } finally {
    isSubmitting.value = false;
  }
}

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore,
    middleLabel: t("verifier"),
    middleValue: `${defaultVerifier.slice(0, 10)}…`,
    trailingLabel: t("network"),
    trailingValue: t("testnet"),
  }),
);

const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore,
    walletValue: address.value || t("notConnected"),
    extra: { label: t("defaultVerifier"), value: defaultVerifier, variant: "erobo" },
  }),
);

const detailItems = computed(() => [
  { label: t("currentVerifier"), value: inspected.verifier || t("notAvailable") },
  { label: t("currentHook"), value: inspected.hook || t("notAvailable") },
  { label: t("currentBackupOwner"), value: inspected.backupOwner || t("notAvailable") },
  { label: t("aaCore"), value: aaCore },
]);

const appState = computed(() => ({ address: address.value, accountId: inspected.accountIdHash }));
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.field-stack { @include console.stack; }
.actions-row { @include console.actions-row; }
</style>
