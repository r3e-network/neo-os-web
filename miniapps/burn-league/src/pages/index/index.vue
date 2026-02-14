<template>
  <view class="theme-burn-league">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <!-- Total Burned Hero Section with Fire Animation -->
          <HeroSection :total-burned="totalBurned" :t="t" />
        
      </template>

      <template #operation>
        <!-- Burn Action Card -->
        <BurnActionCard
          v-model:burnAmount="burnAmount"
          :estimated-reward="estimatedReward"
          :is-loading="isLoading"
          :t="t"
          @burn="burnTokens"
        />
      </template>

      <template #tab-stats>
        <!-- Total Burned Hero Section with Fire Animation -->
        <HeroSection :total-burned="totalBurned" :t="t" />

        <!-- Stats Grid -->
        <StatsGrid :user-burned="userBurned" :rank="rank" :t="t" />

        <StatsTab
          :burn-count="burnCount"
          :user-burned="userBurned"
          :total-burned="totalBurned"
          :rank="rank"
          :estimated-reward="estimatedReward"
          :t="t"
        />

        <!-- Leaderboard in Stats Tab -->
        <LeaderboardList :leaderboard="leaderboard" />
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppShell } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";

import HeroSection from "./components/HeroSection.vue";
import StatsGrid from "./components/StatsGrid.vue";
import BurnActionCard from "./components/BurnActionCard.vue";
import LeaderboardList, { type LeaderEntry } from "./components/LeaderboardList.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = createUseI18n(messages)();

const templateConfig = createPrimaryStatsTemplateConfig(
  { key: "game", labelKey: "game", icon: "🎮", default: true },
  { fireworks: true },
);

const activeTab = ref("game");

const appState = computed(() => ({
  totalBurned: totalBurned.value,
  userBurned: userBurned.value,
  rank: rank.value,
  burnCount: burnCount.value,
}));

const APP_ID = "miniapp-burn-league";
const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
const { list: listEvents } = useEvents();
const { processPayment, isProcessing: paymentProcessing } = usePaymentFlow(APP_ID);

const burnAmount = ref("1");
const totalBurned = ref(0);
const rewardPool = ref(0);
const userBurned = ref(0);
const rank = ref(0);
const burnCount = ref(0);
const { status, setStatus, clearStatus } = useStatusMessage();
const leaderboard = ref<LeaderEntry[]>([]);
const MIN_BURN = 1;
const isLoading = computed(() => paymentProcessing.value);

const sidebarItems = createSidebarItems(t, [
  { labelKey: "stats", value: () => `${totalBurned.value} GAS` },
  { labelKey: "game", value: () => `${userBurned.value} GAS` },
  { labelKey: "sidebarRank", value: () => rank.value || "-" },
  { labelKey: "sidebarBurns", value: () => burnCount.value },
  { labelKey: "sidebarRewardPool", value: () => `${rewardPool.value} GAS` },
]);

const estimatedReward = computed(() => {
  if (!totalBurned.value) return 0;
  return (userBurned.value / totalBurned.value) * rewardPool.value;
});

const { listAllEvents } = useAllEvents(listEvents, APP_ID);

const loadStats = async () => {
  const contract = await ensureContractAddress();
  const totalRes = await invokeRead({ scriptHash: contract, operation: "TotalBurned" });
  totalBurned.value = parseGas(parseInvokeResult(totalRes));
  const poolRes = await invokeRead({ scriptHash: contract, operation: "RewardPool" });
  rewardPool.value = parseGas(parseInvokeResult(poolRes));
  if (address.value) {
    const userRes = await invokeRead({
      scriptHash: contract,
      operation: "GetUserTotalBurned",
      args: [{ type: "Hash160", value: address.value }],
    });
    userBurned.value = parseGas(parseInvokeResult(userRes));
  } else {
    userBurned.value = 0;
  }
};

const loadLeaderboard = async () => {
  const events = await listAllEvents("GasBurned");
  const totals: Record<string, number> = {};
  let userBurns = 0;
  events.forEach((evt) => {
    const evtRecord = evt as unknown as Record<string, unknown>;
    const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
    const burner = String(values[0] ?? "");
    const amount = Number(values[1] ?? 0);
    if (!burner) return;
    totals[burner] = (totals[burner] || 0) + amount;
    if (address.value && burner === address.value) {
      userBurns += 1;
    }
  });
  const entries = Object.entries(totals)
    .map(([addr, amount]) => ({
      address: addr,
      burned: parseGas(amount),
      isUser: address.value ? addr === address.value : false,
    }))
    .sort((a, b) => b.burned - a.burned)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
  leaderboard.value = entries;
  const userEntry = entries.find((entry) => entry.isUser);
  rank.value = userEntry ? userEntry.rank : 0;
  burnCount.value = userBurns;
};

const refreshData = async () => {
  try {
    await Promise.all([loadStats(), loadLeaderboard()]);
  } catch {
    setStatus(t("loadFailed"), "error");
  }
};

const burnTokens = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(burnAmount.value);
  if (!Number.isFinite(amount) || amount < MIN_BURN) {
    setStatus(t("minBurn", { amount: MIN_BURN }), "error");
    return;
  }
  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("error"));
    }
    await ensureContractAddress();
    setStatus(t("burning"), "loading");

    const { receiptId, invoke: invokeWithReceipt, waitForEvent } = await processPayment(burnAmount.value, "burn");

    const result = await invokeWithReceipt(contractAddress.value as string, "burnGas", [
      { type: "Hash160", value: address.value },
      { type: "Integer", value: toFixed8(burnAmount.value) },
      { type: "Integer", value: String(receiptId) },
    ]);

    // Wait for event confirmation
    await waitForEvent(result.txid, "GasBurned");

    setStatus(`${t("burned")} ${amount} GAS ${t("success")}`, "success");
    burnAmount.value = "1";
    await refreshData();
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("error")), "error");
  }
};

const { handleBoundaryError } = useHandleBoundaryError("burn-league");
const resetAndReload = async () => {
  await refreshData();
};

watch(
  address,
  () => {
    refreshData();
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./burn-league-theme.scss";

:global(page) {
  background: var(--burn-bg);
  font-family: var(--burn-font);
}
</style>
