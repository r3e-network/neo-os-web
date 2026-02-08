<template>
  <view class="theme-burn-league">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

        <!-- Burn Action Card -->
        <BurnActionCard
          v-model:burnAmount="burnAmount"
          :estimated-reward="estimatedReward"
          :is-loading="isLoading"
          :t="t as any"
          @burn="burnTokens"
        />
      </template>

      <template #tab-stats>
        <!-- Total Burned Hero Section with Fire Animation -->
        <HeroSection :total-burned="totalBurned" :t="t as any" />

        <!-- Stats Grid -->
        <StatsGrid :user-burned="userBurned" :rank="rank" :t="t as any" />

        <StatsTab
          :burn-count="burnCount"
          :user-burned="userBurned"
          :total-burned="totalBurned"
          :rank="rank"
          :estimated-reward="estimatedReward"
          :t="t as any"
        />

        <!-- Leaderboard in Stats Tab -->
        <LeaderboardList :leaderboard="leaderboard" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { useI18n } from "@/composables/useI18n";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";

import HeroSection from "./components/HeroSection.vue";
import StatsGrid from "./components/StatsGrid.vue";
import BurnActionCard from "./components/BurnActionCard.vue";
import LeaderboardList, { type LeaderEntry } from "./components/LeaderboardList.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "custom",
  tabs: [
    { key: "game", labelKey: "game", icon: "🎮", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const activeTab = ref("game");

const appState = computed(() => ({
  totalBurned: totalBurned.value,
  userBurned: userBurned.value,
  rank: rank.value,
  burnCount: burnCount.value,
}));

const APP_ID = "miniapp-burn-league";
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();
const { processPayment, isProcessing: paymentProcessing } = usePaymentFlow(APP_ID);

const burnAmount = ref("1");
const totalBurned = ref(0);
const rewardPool = ref(0);
const userBurned = ref(0);
const rank = ref(0);
const burnCount = ref(0);
const status = ref<{ msg: string; type: string } | null>(null);
const contractAddress = ref<string | null>(null);

const leaderboard = ref<LeaderEntry[]>([]);
const MIN_BURN = 1;
const isLoading = computed(() => paymentProcessing.value);

const estimatedReward = computed(() => {
  if (!totalBurned.value) return 0;
  return (userBurned.value / totalBurned.value) * rewardPool.value;
});

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) {
    throw new Error(t("missingContract"));
  }
};

const listAllEvents = async (eventName: string) => {
  const events: any[] = [];
  let afterId: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 50, after_id: afterId });
    events.push(...res.events);
    hasMore = Boolean(res.has_more && res.last_id);
    afterId = res.last_id || undefined;
  }
  return events;
};

const loadStats = async () => {
  await ensureContractAddress();
  const totalRes = await invokeRead({ scriptHash: contractAddress.value!, operation: "TotalBurned" });
  totalBurned.value = parseGas(parseInvokeResult(totalRes));
  const poolRes = await invokeRead({ scriptHash: contractAddress.value!, operation: "RewardPool" });
  rewardPool.value = parseGas(parseInvokeResult(poolRes));
  if (address.value) {
    const userRes = await invokeRead({
      scriptHash: contractAddress.value!,
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
    const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
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
    status.value = { msg: t("loadFailed"), type: "error" };
  }
};

const burnTokens = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(burnAmount.value);
  if (!Number.isFinite(amount) || amount < MIN_BURN) {
    status.value = { msg: t("minBurn", { amount: MIN_BURN }), type: "error" };
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
    status.value = { msg: t("burning"), type: "loading" };

    const { receiptId, invoke: invokeWithReceipt, waitForEvent } = await processPayment(burnAmount.value, "burn");

    const result = await invokeWithReceipt(contractAddress.value!, "burnGas", [
      { type: "Hash160", value: address.value },
      { type: "Integer", value: toFixed8(burnAmount.value) },
      { type: "Integer", value: String(receiptId) },
    ]);

    // Wait for event confirmation
    await waitForEvent(result.txid, "GasBurned");

    status.value = { msg: `${t("burned")} ${amount} GAS ${t("success")}`, type: "success" };
    burnAmount.value = "1";
    await refreshData();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

onMounted(() => {
  refreshData();
});

watch(address, () => {
  refreshData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./burn-league-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Russo+One&display=swap");

:global(page) {
  background: var(--burn-bg);
  font-family: var(--burn-font);
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: radial-gradient(circle at 50% 100%, var(--burn-gradient-start) 0%, var(--burn-gradient-end) 100%);
  min-height: 100vh;
  position: relative;
  font-family: var(--burn-font);

  /* Ember effects */
  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2ZmNDUwMCIgb3BhY2l0eT0iMC41Ii8+PC9zdmc+");
    opacity: 0.4;
    pointer-events: none;
    mask-image: linear-gradient(to top, black, transparent);
  }
}

/* Inferno Component Overrides */
:deep(.neo-card) {
  background: var(--burn-card-bg) !important;
  border: 1px solid var(--burn-card-border) !important;
  border-bottom: 4px solid var(--burn-orange) !important;
  border-radius: 4px !important;
  box-shadow: var(--burn-card-shadow) !important;
  color: var(--burn-text) !important;
  backdrop-filter: blur(5px);
  font-family: var(--burn-font) !important;

  &.variant-danger {
    background: var(--burn-danger-bg) !important;
    border-color: var(--burn-danger-border) !important;
  }
}

:deep(.neo-button) {
  text-transform: uppercase;
  font-weight: 900 !important;
  font-style: italic;
  letter-spacing: 0.05em;
  transform: skewX(-10deg);
  border-radius: 2px !important;
  font-family: var(--burn-font) !important;

  &.variant-primary {
    background: var(--burn-button-gradient) !important;
    color: var(--burn-button-text) !important;
    box-shadow: var(--burn-button-shadow) !important;
    border: none !important;

    &:active {
      transform: skewX(-10deg) translateY(2px);
      box-shadow: var(--burn-button-shadow-press) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 2px solid var(--burn-orange) !important;
    color: var(--burn-orange) !important;

    &:active {
      transform: skewX(-10deg) translateY(2px);
    }
  }

  /* Counter-skew content */
  & > view,
  & > text {
    transform: skewX(10deg);
    display: inline-block;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
