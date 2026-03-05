<template>
  <MiniAppPage
    name="piggy-bank"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <!-- Main Tab (default) - LEFT panel -->
    <template #content>
      <HeroSection :title="t('app.title')" :subtitle="t('app.subtitle')" icon="🐷" variant="erobo" compact>
        <view class="status-row">
          <text class="status-chip">{{ currentChain?.shortName || "Neo N3" }}</text>
          <text class="status-chip" :class="{ connected: isConnected }">
            {{ isConnected ? formatAddress(userAddress) : t("wallet.not_connected") }}
          </text>
          <button class="connect-btn" v-if="!isConnected" @click="handleConnect">
            {{ t("wallet.connect") }}
          </button>
        </view>
      </HeroSection>

      <ConfigWarning :issues="configIssues" :t="t" />

      <!-- Piggy Banks list -->
      <scroll-view v-if="piggyBanks.length > 0" scroll-y class="banks-list">
        <view class="grid">
          <BankCard
            v-for="bank in piggyBanks"
            :key="bank.id"
            :bank="bank"
            :locked="isLocked(bank)"
            :t="t"
            @select="goToDetail"
          />
        </view>
      </scroll-view>
    </template>

    <!-- Main Tab - RIGHT panel -->
    <template #operation>
      <OperationPanel :is-empty="piggyBanks.length === 0" :t="t" @create="goToCreate" />
    </template>

    <!-- Settings Tab -->
    <template #tab-settings>
      <SettingsPanel
        :form="settingsForm"
        :chain-options="chainOptions"
        :current-chain-index="currentChainIndex"
        :selected-chain-name="selectedChain?.name || ''"
        :t="t"
        @chain-change="onChainChange"
        @save="saveSettings"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePiggyStore } from "@/stores/piggy";
import { storeToRefs } from "pinia";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppPage, HeroSection } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createMiniApp } from "@shared/utils/createMiniApp";
import BankCard from "./components/BankCard.vue";
import ConfigWarning from "./components/ConfigWarning.vue";

const store = usePiggyStore();
const { piggyBanks, currentChainId, alchemyApiKey, walletConnectProjectId, userAddress, isConnected } =
  storeToRefs(store);

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "piggy-bank",
  messages,
  template: {
    tabs: [
      { key: "main", labelKey: "tabMain", icon: "🐷", default: true },
      { key: "settings", labelKey: "tabSettings", icon: "⚙️" },
    ],
    chainWarning: false,
    docTitleKey: "app.title",
    docStepCount: 5,
    docFeatureCount: 6,
    docStepPrefix: "docStep",
    docFeaturePrefix: "docFeature",
  },
  sidebarItems: [
    { labelKey: "sidebarTotalBanks", value: () => piggyBanks.value.length },
    { labelKey: "sidebarLocked", value: () => piggyBanks.value.filter((b) => Date.now() / 1000 < b.unlockTime).length },
    {
      labelKey: "sidebarUnlocked",
      value: () => piggyBanks.value.length - piggyBanks.value.filter((b) => Date.now() / 1000 < b.unlockTime).length,
    },
  ],
  statusTimeoutMs: 5000,
});

const appState = computed(() => ({
  bankCount: piggyBanks.value.length,
  isConnected: isConnected.value,
}));

// Settings form
const chainOptions = computed(() => store.EVM_CHAINS);
const currentChain = computed(() => chainOptions.value.find((chain) => chain.id === currentChainId.value));
const configIssues = computed(() => {
  const issues: string[] = [];
  if (!alchemyApiKey.value) issues.push(t("settings.issue_alchemy"));
  if (!store.getContractAddress(currentChainId.value)) issues.push(t("settings.issue_contract"));
  return issues;
});

// Actions
const isLocked = (bank: PiggyBank) => Date.now() / 1000 < bank.unlockTime;
const handleConnect = async () => {
  try {
    await store.connectWallet();
  } catch (err: unknown) {
    setStatus(formatErrorMessage(err, t("wallet.connect_failed")), "error");
  }
};
const goToDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
};

const resetAndReload = async () => {
  if (isConnected.value) {
    await store.loadBanks();
  }
};
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./piggy-bank-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.banks-list {
  flex: 1;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 80px;
}

@media (min-width: 1024px) {
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
}

.status-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.status-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--piggy-chip-bg);
  border: 1px solid var(--piggy-chip-border);
  font-size: 11px;
  color: var(--piggy-chip-text);

  &.connected {
    background: var(--piggy-chip-connected-bg);
    border-color: var(--piggy-chip-connected-border);
    color: var(--piggy-chip-connected-text);
  }
}

.connect-btn {
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  color: var(--piggy-accent-text);
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-weight: 700;
  font-size: 11px;
}
</style>
