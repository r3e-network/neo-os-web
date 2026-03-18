<template>
  <MiniAppPage
    name="aa-account-lab"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="inspectAccount"
  >
    <template #content>
      <HeroSection variant="erobo" icon="🪪" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStats" compact />
        </template>
      </HeroSection>

      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

      <NeoCard variant="erobo" :title="t('inspectorTitle')" class="px-1">
        <div class="field-stack">
          <NeoInput v-model="inspectForm.accountIdInput" :label="t('accountId')" :placeholder="t('accountIdPlaceholder')" />
          <div class="actions-row">
            <NeoButton variant="primary" :loading="isInspecting" @click="inspectAccount">{{ t("inspect") }}</NeoButton>
            <NeoButton variant="secondary" @click="connect">{{ t("connectWallet") }}</NeoButton>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">{{ t("currentVerifier") }}</span>
            <span class="detail-value">{{ inspected.verifier || "—" }}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">{{ t("currentHook") }}</span>
            <span class="detail-value">{{ inspected.hook || "—" }}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">{{ t("currentBackupOwner") }}</span>
            <span class="detail-value">{{ inspected.backupOwner || "—" }}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">AA Core</span>
            <span class="detail-value">{{ aaCore }}</span>
          </div>
        </div>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('registerTitle')" class="px-1">
        <div class="field-stack">
          <NeoInput v-model="registerForm.accountIdInput" :label="t('accountId')" :placeholder="t('accountIdPlaceholder')" />
          <NeoInput v-model="registerForm.verifierHash" :label="t('verifier')" placeholder="0x..." />
          <NeoInput v-model="registerForm.verifierParamsHex" :label="t('verifierParams')" placeholder="hex payload" />
          <NeoInput v-model="registerForm.hookHash" :label="t('hook')" placeholder="0x... or empty" />
          <NeoInput v-model="registerForm.backupOwner" :label="t('backupOwner')" placeholder="N... or 0x..." />
          <NeoInput v-model="registerForm.escapeTimelock" :label="t('timelock')" placeholder="2592000" />
          <NeoButton variant="primary" :loading="isSubmitting" @click="submitRegister">{{ t("register") }}</NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";
import { deriveAAAccountIdHash } from "@shared/utils/aa";

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
    { labelKey: "currentVerifier", value: () => inspected.verifier || "—" },
    { labelKey: "currentHook", value: () => inspected.hook || "—" },
    { labelKey: "currentBackupOwner", value: () => inspected.backupOwner || "—" },
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
  } catch {
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
    inspected.verifier = String(parseInvokeResult(verifier) || "—");
    inspected.hook = String(parseInvokeResult(hook) || "—");
    inspected.backupOwner = String(parseInvokeResult(backupOwner) || "—");
    setStatus(t("inspectSuccess"), "success");
  } catch (error) {
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
  } catch (error) {
    setStatus(formatErrorMessage(error, t("invalidAccountId")), "error");
  } finally {
    isSubmitting.value = false;
  }
}

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "AA Core", value: aaCore.slice(0, 10) + "…" },
  { label: "Verifier", value: defaultVerifier.slice(0, 10) + "…" },
  { label: "Network", value: "Testnet" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "AA Core", value: aaCore, variant: "accent" },
  { label: "Default Verifier", value: defaultVerifier, variant: "erobo" },
  { label: "Wallet", value: address.value || "not connected", variant: "success" },
]);

const appState = computed(() => ({ address: address.value, accountId: inspected.accountIdHash }));
</script>

<style lang="scss" scoped>
.field-stack { display: flex; flex-direction: column; gap: 14px; }
.actions-row { display: flex; gap: 12px; flex-wrap: wrap; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.detail-card { padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
.detail-label { display: block; font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.12em; }
.detail-value { display: block; margin-top: 8px; font-size: 13px; word-break: break-all; }
@media (max-width: 767px) { .detail-grid { grid-template-columns: 1fr; } }
</style>
