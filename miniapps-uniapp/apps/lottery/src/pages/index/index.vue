<template>
  <MiniAppPage
    name="lottery"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="errorStatus"
    :fireworks-active="showFireworks"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <!-- Wallet Prompt -->
      <view v-if="!address && activeTab === 'game'" class="wallet-prompt-container">
        <NeoCard variant="warning" class="mb-4 text-center">
          <text class="mb-2 block font-bold">{{ t("connectWalletToPlay") }}</text>
          <NeoButton variant="primary" size="sm" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </view>

      <!-- Unscratched Tickets Reminder -->
      <view v-if="unscratchedTickets.length > 0" class="mb-6 px-1" aria-live="polite">
        <NeoCard variant="accent" class="border-gold">
          <view class="flex items-center justify-between">
            <view>
              <text class="mb-1 text-lg font-bold">{{ t("ticketsWaiting") }}</text>
              <text class="text-sm opacity-80">{{
                t("ticketsWaitingDesc", { count: unscratchedTickets.length })
              }}</text>
            </view>
            <NeoButton size="sm" variant="primary" @click="playUnscratched(unscratchedTickets[0])">
              {{ t("playNow") }}
            </NeoButton>
          </view>
        </NeoCard>
      </view>

      <GameCardGrid
        :instant-types="instantTypes"
        :is-loading="isLoading"
        :buying-type="buyingType"
        :is-connected="!!address"
        @buy="handleBuy"
      />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('game')">
        <view class="action-buttons">
          <NeoButton
            v-if="instantTypes.length > 0"
            variant="primary"
            size="lg"
            block
            :loading="!!buyingType"
            :disabled="!address"
            @click="handleBuy(instantTypes[0])"
          >
            {{ t("ticketsBought") }}
          </NeoButton>
          <NeoButton
            v-if="unscratchedTickets.length > 0"
            variant="secondary"
            size="lg"
            block
            @click="playUnscratched(unscratchedTickets[0])"
          >
            {{ t("playNow") }}
          </NeoButton>
        </view>
        <StatsDisplay :items="lotteryStats" layout="rows" />
      </NeoCard>
    </template>

    <template #tab-winners>
      <WinnersTab :winners="winners" :format-num="formatNum" />
    </template>

    <template #tab-stats>
      <StatsTab :grid-items="statsGridItems" :row-items="statsRowItems" :rows-title="t('yourStatsTitle')" />
    </template>
  </MiniAppPage>

  <!-- Scratch Modal -->
  <ScratchModal
    v-if="activeTicket"
    :is-open="!!activeTicket"
    :type-info="activeTicketTypeInfo"
    :ticket-id="activeTicket.id"
    :on-reveal="onReveal"
    @close="closeModal"
  />
</template>

<script setup lang="ts">
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
import GameCardGrid from "./components/GameCardGrid.vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useLotteryPage } from "./composables/useLotteryPage";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status: errorStatus,
  setStatus: setErrorStatus,
  clearStatus: clearErrorStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "lottery",
  messages,
  template: {
    tabs: [
      { key: "game", labelKey: "game", icon: "\uD83C\uDFAE", default: true },
      { key: "winners", labelKey: "winners", icon: "\uD83D\uDCCB" },
      { key: "stats", labelKey: "stats", icon: "\uD83D\uDCCA" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "totalTickets", value: () => totalTickets.value },
    { labelKey: "totalPaidOut", value: () => `${formatNum(prizePool.value)} GAS` },
    { labelKey: "ticketsBought", value: () => playerTickets.value.length },
    { labelKey: "totalWinnings", value: () => `${formatNum(userWinnings.value)} GAS` },
  ],
  fallbackMessageKey: "lotteryErrorFallback",
});

const {
  address,
  instantTypes,
  unscratchedTickets,
  playerTickets,
  isLoading,
  activeTab,
  buyingType,
  showFireworks,
  winners,
  totalTickets,
  prizePool,
  formatNum,
  appState,
  userWinnings,
  lotteryStats,
  statsGridItems,
  statsRowItems,
  activeTicket,
  activeTicketTypeInfo,
  connectWallet,
  resetAndReload,
  handleBuy,
  playUnscratched,
  onReveal,
  closeModal,
} = useLotteryPage(t, setErrorStatus, clearErrorStatus);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./lottery-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.wallet-prompt-container {
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
