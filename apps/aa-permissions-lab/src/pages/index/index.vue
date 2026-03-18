<template>
  <MiniAppPage
    name="aa-permissions-lab"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="refreshState"
  >
    <template #content>
      <HeroSection variant="erobo" icon="🧩" compact>
        <template #stats><HeroStatsStrip :items="heroStats" compact /></template>
      </HeroSection>
      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />
      <NeoCard variant="erobo" class="px-1">
        <div class="stack">
          <NeoInput v-model="form.accountIdHash" :label="t('accountId')" placeholder="20-byte hash" />
          <NeoButton variant="secondary" :loading="isRefreshing" @click="refreshState">{{ t("inspect") }}</NeoButton>
        </div>
        <div class="detail-grid">
          <div class="detail-card"><span class="detail-label">{{ t("currentVerifier") }}</span><span class="detail-value">{{ current.verifier || "—" }}</span></div>
          <div class="detail-card"><span class="detail-label">{{ t("currentHook") }}</span><span class="detail-value">{{ current.hook || "—" }}</span></div>
          <div class="detail-card"><span class="detail-label">{{ t("currentBackupOwner") }}</span><span class="detail-value">{{ current.backupOwner || "—" }}</span></div>
        </div>
      </NeoCard>
    </template>
    <template #operation>
      <NeoCard variant="erobo" :title="t('updateVerifier')" class="mb-4 px-1">
        <div class="stack">
          <NeoInput v-model="form.verifierHash" :label="t('verifier')" placeholder="0x..." />
          <NeoInput v-model="form.verifierParamsHex" :label="t('verifierParams')" placeholder="hex payload" />
          <NeoButton variant="primary" :loading="isVerifierBusy" @click="submitVerifier">{{ t("updateVerifier") }}</NeoButton>
        </div>
      </NeoCard>
      <NeoCard variant="erobo" :title="t('updateHook')" class="px-1">
        <div class="stack">
          <NeoInput v-model="form.hookHash" :label="t('hook')" placeholder="0x..." />
          <NeoButton variant="secondary" :loading="isHookBusy" @click="submitHook">{{ t("updateHook") }}</NeoButton>
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
import { buildAAHeroStats, buildAAOverviewStats } from "@shared/utils/console-stats";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

const wallet = useWallet() as WalletSDK;
const { address, connect, invokeRead, invokeContract } = wallet;
const aaCore = getExternalIntegrationConfig("testnet").contracts.aaCore;

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "aa-permissions-lab",
  messages,
  tab: { key: "permissions", labelKey: "updateVerifier", icon: "🧩" },
  sidebarItems: [
    { labelKey: "currentVerifier", value: () => current.verifier || "—" },
    { labelKey: "currentHook", value: () => current.hook || "—" },
    { labelKey: "currentBackupOwner", value: () => current.backupOwner || "—" },
  ],
});

const form = reactive({ accountIdHash: "", verifierHash: "", verifierParamsHex: "", hookHash: "" });
const current = reactive({ verifier: "", hook: "", backupOwner: "" });
const isRefreshing = ref(false);
const isVerifierBusy = ref(false);
const isHookBusy = ref(false);

async function refreshState() {
  try {
    isRefreshing.value = true;
    const accountId = normalizeScriptHash(form.accountIdHash).replace(/^0x/, "");
    const [verifier, hook, backup] = await Promise.all([
      invokeRead({ scriptHash: aaCore, operation: "getVerifier", args: [{ type: "Hash160", value: `0x${accountId}` }] }),
      invokeRead({ scriptHash: aaCore, operation: "getHook", args: [{ type: "Hash160", value: `0x${accountId}` }] }),
      invokeRead({ scriptHash: aaCore, operation: "getBackupOwner", args: [{ type: "Hash160", value: `0x${accountId}` }] }),
    ]);
    current.verifier = String(parseInvokeResult(verifier) || "—");
    current.hook = String(parseInvokeResult(hook) || "—");
    current.backupOwner = String(parseInvokeResult(backup) || "—");
  } catch (error) {
    setStatus(formatErrorMessage(error, "inspect failed"), "error");
  } finally {
    isRefreshing.value = false;
  }
}

async function submitVerifier() {
  try {
    isVerifierBusy.value = true;
    if (!address.value) await connect();
    await invokeContract({
      scriptHash: aaCore,
      operation: "updateVerifier",
      args: [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.verifierHash) },
        { type: "ByteArray", value: form.verifierParamsHex.trim().replace(/^0x/, "") },
      ],
    });
    setStatus(t("successVerifier"), "success");
    await refreshState();
  } catch (error) {
    setStatus(formatErrorMessage(error, "updateVerifier failed"), "error");
  } finally {
    isVerifierBusy.value = false;
  }
}

async function submitHook() {
  try {
    isHookBusy.value = true;
    if (!address.value) await connect();
    await invokeContract({
      scriptHash: aaCore,
      operation: "updateHook",
      args: [
        { type: "Hash160", value: normalizeScriptHash(form.accountIdHash) },
        { type: "Hash160", value: normalizeScriptHash(form.hookHash) },
      ],
    });
    setStatus(t("successHook"), "success");
    await refreshState();
  } catch (error) {
    setStatus(formatErrorMessage(error, "updateHook failed"), "error");
  } finally {
    isHookBusy.value = false;
  }
}

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore,
    middleLabel: "Verifier",
    middleValue: current.verifier ? "set" : "unset",
    trailingLabel: "Hook",
    trailingValue: current.hook ? "set" : "unset",
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore,
    walletValue: address.value || "not connected",
  }),
);
const appState = computed(() => ({ address: address.value, accountId: form.accountIdHash }));
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.detail-grid { @include console.detail-grid(3, 900px); margin-top: 16px; }
.detail-card { @include console.detail-card; }
.detail-label { @include console.label; letter-spacing: .12em; }
.detail-value { @include console.value; margin-top: 8px; }
</style>
