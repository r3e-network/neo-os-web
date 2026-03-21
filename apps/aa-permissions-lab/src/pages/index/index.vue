<template>
  <ConsoleMiniApp
    page-name="aa-permissions-lab"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="refreshState"
    hero-icon="🧩"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('updateVerifier')"
    :operation-title="t('updateVerifier')"
    :wrap-operation-card="false"
  >
    <template #result>
      <div class="stack">
        <NeoInput v-model="form.accountIdHash" :label="t('accountId')" :placeholder="t('accountIdHashPlaceholder')" />
        <NeoButton variant="secondary" type="button" :loading="isRefreshing" @click="refreshState" :aria-label="t('inspect')">{{ t("inspect") }}</NeoButton>
      </div>
      <DetailCardGrid :items="detailItems" :columns="3" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('updateVerifier')" class="mb-4 px-1">
        <div class="stack">
          <NeoInput v-model="form.verifierHash" :label="t('verifier')" :placeholder="t('verifierHashPlaceholder')" />
          <NeoInput v-model="form.verifierParamsHex" :label="t('verifierParams')" :placeholder="t('verifierParamsPlaceholder')" />
          <NeoButton variant="primary" type="button" :loading="isVerifierBusy" @click="submitVerifier" :aria-label="t('updateVerifier')">{{ t("updateVerifier") }}</NeoButton>
        </div>
      </NeoCard>
      <NeoCard variant="erobo" :title="t('updateHook')" class="px-1">
        <div class="stack">
          <NeoInput v-model="form.hookHash" :label="t('hook')" :placeholder="t('hookHashPlaceholder')" />
          <NeoButton variant="secondary" type="button" :loading="isHookBusy" @click="submitHook" :aria-label="t('updateHook')">{{ t("updateHook") }}</NeoButton>
        </div>
      </NeoCard>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ConsoleMiniApp, DetailCardGrid, HeroStatsStrip, NeoButton, NeoCard, NeoInput } from "@shared/components";
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
    { labelKey: "currentVerifier", value: () => current.verifier || t("notAvailable") },
    { labelKey: "currentHook", value: () => current.hook || t("notAvailable") },
    { labelKey: "currentBackupOwner", value: () => current.backupOwner || t("notAvailable") },
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
    current.verifier = String(parseInvokeResult(verifier) || t("notAvailable"));
    current.hook = String(parseInvokeResult(hook) || t("notAvailable"));
    current.backupOwner = String(parseInvokeResult(backup) || t("notAvailable"));
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("inspectFailed")), "error");
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
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("updateVerifierFailed")), "error");
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
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("updateHookFailed")), "error");
  } finally {
    isHookBusy.value = false;
  }
}

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore,
    middleLabel: t("verifier"),
    middleValue: current.verifier ? t("configured") : t("notAvailable"),
    trailingLabel: t("hook"),
    trailingValue: current.hook ? t("configured") : t("notAvailable"),
  }),
);
const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore,
    walletValue: address.value || t("notConnected"),
  }),
);
const detailItems = computed(() => [
  { label: t("currentVerifier"), value: current.verifier || t("notAvailable") },
  { label: t("currentHook"), value: current.hook || t("notAvailable") },
  { label: t("currentBackupOwner"), value: current.backupOwner || t("notAvailable") },
]);
const appState = computed(() => ({ address: address.value, accountId: form.accountIdHash }));
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
</style>
