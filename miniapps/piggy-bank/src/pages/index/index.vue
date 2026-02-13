<template>
  <view class="theme-piggy-bank">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" :status-message="status" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab (default) - LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <BankHeader
          :chain-label="currentChain?.shortName || 'Neo N3'"
          :user-address="userAddress"
          :is-connected="isConnected"
          :t="t"
          @connect="handleConnect"
        />

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
        </ErrorBoundary>
      </template>

      <!-- Main Tab - RIGHT panel -->
      <template #operation>
        <OperationPanel
          :is-empty="piggyBanks.length === 0"
          :t="t"
          @create="goToCreate"
        />
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
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePiggyStore, type PiggyBank } from "@/stores/piggy";
import { storeToRefs } from "pinia";
import { useI18n } from "@/composables/useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import BankHeader from "./components/BankHeader.vue";
import BankCard from "./components/BankCard.vue";
import ConfigWarning from "./components/ConfigWarning.vue";
import OperationPanel from "./components/OperationPanel.vue";
import SettingsPanel from "./components/SettingsPanel.vue";

const { t } = useI18n();
const { status, setStatus } = useStatusMessage(5000);
const store = usePiggyStore();
const { piggyBanks, currentChainId, alchemyApiKey, walletConnectProjectId, userAddress, isConnected } =
  storeToRefs(store);

// Tab state
const activeTab = ref("main");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "tabMain", icon: "🐷", default: true },
    { key: "settings", labelKey: "tabSettings", icon: "⚙️" },
    { key: "docs", labelKey: "tabDocs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: false,
    statusMessages: true,
    docs: {
      titleKey: "app.title",
      subtitleKey: "docSubtitle",
      stepKeys: ["docStep1", "docStep2", "docStep3", "docStep4", "docStep5"],
      featureKeys: [
        { nameKey: "docFeature1Name", descKey: "docFeature1Desc" },
        { nameKey: "docFeature2Name", descKey: "docFeature2Desc" },
        { nameKey: "docFeature3Name", descKey: "docFeature3Desc" },
        { nameKey: "docFeature4Name", descKey: "docFeature4Desc" },
        { nameKey: "docFeature5Name", descKey: "docFeature5Desc" },
        { nameKey: "docFeature6Name", descKey: "docFeature6Desc" },
      ],
    },
  },
};

const appState = computed(() => ({
  bankCount: piggyBanks.value.length,
  isConnected: isConnected.value,
}));

const sidebarItems = computed(() => {
  const banks = piggyBanks.value;
  const total = banks.length;
  const locked = banks.filter((b) => Date.now() / 1000 < b.unlockTime).length;
  const unlocked = total - locked;
  return [
    { label: t("sidebarTotalBanks"), value: total },
    { label: t("sidebarLocked"), value: locked },
    { label: t("sidebarUnlocked"), value: unlocked },
  ];
});

// Settings form
const chainOptions = computed(() => store.EVM_CHAINS);
const currentChain = computed(() => chainOptions.value.find((chain) => chain.id === currentChainId.value));
const selectedChain = computed(() => chainOptions.value.find((chain) => chain.id === settingsForm.value.chainId));
const currentChainIndex = computed(() =>
  Math.max(
    0,
    chainOptions.value.findIndex((chain) => chain.id === settingsForm.value.chainId)
  )
);

const settingsForm = ref({
  chainId: currentChainId.value,
  alchemyApiKey: alchemyApiKey.value,
  walletConnectProjectId: walletConnectProjectId.value,
  contractAddress: store.getContractAddress(currentChainId.value),
});

const configIssues = computed(() => {
  const issues: string[] = [];
  if (!alchemyApiKey.value) issues.push(t("settings.issue_alchemy"));
  if (!store.getContractAddress(currentChainId.value)) issues.push(t("settings.issue_contract"));
  return issues;
});

// Actions
const isLocked = (bank: PiggyBank) => Date.now() / 1000 < bank.unlockTime;

const onChainChange = (e: { detail: { value: number } }) => {
  const idx = Number(e.detail.value);
  const chain = chainOptions.value[idx];
  if (!chain) return;
  settingsForm.value.chainId = chain.id;
  settingsForm.value.contractAddress = store.getContractAddress(chain.id);
};

const saveSettings = async () => {
  try {
    store.setAlchemyApiKey(settingsForm.value.alchemyApiKey);
    store.setWalletConnectProjectId(settingsForm.value.walletConnectProjectId);
    store.setContractAddress(settingsForm.value.chainId, settingsForm.value.contractAddress);
    await store.switchChain(settingsForm.value.chainId);
    setStatus(t("settings.saved"), "success");
  } catch (err: unknown) {
    setStatus(formatErrorMessage(err, t("settings.error")), "error");
  }
};

const handleConnect = async () => {
  try {
    await store.connectWallet();
  } catch (err: unknown) {
    setStatus(formatErrorMessage(err, t("wallet.connect_failed")), "error");
  }
};

const goToCreate = () => {
  uni.navigateTo({ url: "/pages/create/create" });
};

const goToDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
};

const handleBoundaryError = (error: Error) => {
  console.error("[piggy-bank] boundary error:", error);
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
</style>
