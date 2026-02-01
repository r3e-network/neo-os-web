<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-piggy-bank" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Main Tab -->
    <view v-if="activeTab === 'main'" class="tab-content">
      <!-- Header with wallet status -->
      <view class="header">
        <view class="title-row">
          <text class="title">{{ t("app.title") }}</text>
          <text class="subtitle">{{ t("app.subtitle") }}</text>
        </view>
        <view class="status-row">
          <text class="status-chip">{{ currentChain?.shortName || "Neo N3" }}</text>
          <text class="status-chip" :class="{ connected: isConnected }">
            {{ isConnected ? formatAddress(userAddress) : t("wallet.not_connected") }}
          </text>
          <button class="connect-btn" v-if="!isConnected" @click="handleConnect">
            {{ t("wallet.connect") }}
          </button>
        </view>
      </view>

      <!-- Config warning -->
      <view v-if="configIssues.length > 0" class="config-warning">
        <text class="warning-title">{{ t("settings.missing_config") }}</text>
        <text v-for="issue in configIssues" :key="issue" class="warning-item"> • {{ issue }} </text>
      </view>

      <!-- Piggy Banks list or empty state -->
      <scroll-view v-if="piggyBanks.length === 0" scroll-y class="empty-state">
        <text class="empty-text">{{ t("empty.banks") }}</text>
        <button class="create-btn" @click="goToCreate">{{ t("create.create_btn") }}</button>
      </scroll-view>

      <scroll-view v-else scroll-y class="banks-list">
        <view class="grid">
          <view
            v-for="bank in piggyBanks"
            :key="bank.id"
            class="card"
            @click="goToDetail(bank.id)"
            :style="{ borderColor: bank.themeColor, boxShadow: `0 0 10px ${bank.themeColor}40` }"
          >
            <view class="card-header">
              <text class="bank-name">{{ bank.name }}</text>
              <view class="status-badge" :class="{ locked: isLocked(bank) }">
                {{ isLocked(bank) ? "🔒" : "🔓" }}
              </view>
            </view>

            <text class="purpose">{{ bank.purpose }}</text>

            <view class="progress-section">
              <text class="label">
                {{ t("create.target_label") }}: {{ bank.targetAmount }} {{ bank.targetToken.symbol }}
              </text>
              <view class="progress-bar-bg">
                <view class="progress-bar-fill unknown"></view>
              </view>
            </view>

            <text class="date-info">
              {{ new Date(bank.unlockTime * 1000).toLocaleDateString() }}
            </text>
          </view>
        </view>
      </scroll-view>

      <!-- FAB for creating new bank -->
      <view v-if="piggyBanks.length > 0" class="fab" @click="goToCreate">
        <text class="fab-icon">+</text>
      </view>
    </view>

    <!-- Settings Tab -->
    <view v-if="activeTab === 'settings'" class="tab-content">
      <view class="settings-container">
        <view class="form-group">
          <text class="label">{{ t("settings.network") }}</text>
          <picker
            mode="selector"
            :value="currentChainIndex"
            :range="chainOptions"
            range-key="name"
            @change="onChainChange"
          >
            <view class="picker-view">
              {{ selectedChain?.name || t("settings.select_network") }}
            </view>
          </picker>
        </view>

        <view class="form-group">
          <text class="label">{{ t("settings.alchemy_key") }}</text>
          <input
            class="input-field"
            type="password"
            v-model="settingsForm.alchemyApiKey"
            :placeholder="t('settings.alchemy_placeholder')"
            placeholder-class="placeholder"
          />
        </view>

        <view class="form-group">
          <text class="label">{{ t("settings.walletconnect") }}</text>
          <input
            class="input-field"
            v-model="settingsForm.walletConnectProjectId"
            :placeholder="t('settings.walletconnect_placeholder')"
            placeholder-class="placeholder"
          />
        </view>

        <view class="form-group">
          <text class="label">{{ t("settings.contract_address") }}</text>
          <input
            class="input-field"
            v-model="settingsForm.contractAddress"
            placeholder="0x..."
            placeholder-class="placeholder"
          />
        </view>

        <view class="settings-actions">
          <button class="save-btn" @click="saveSettings">{{ t("common.confirm") }}</button>
        </view>
      </view>
    </view>

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('app.title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { usePiggyStore, type PiggyBank } from "@/stores/piggy";
import { storeToRefs } from "pinia";
import { useI18n } from "@/composables/useI18n";
import { formatAddress } from "@shared/utils/format";
import { ResponsiveLayout, NeoDoc } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";

const { t } = useI18n();
const store = usePiggyStore();
const { piggyBanks, currentChainId, alchemyApiKey, walletConnectProjectId, userAddress, isConnected } =
  storeToRefs(store);

// Tab state
const activeTab = ref("main");

// Navigation tabs
const navTabs = computed<NavTab[]>(() => [
  { id: "main", icon: "game", label: t("tabMain") },
  { id: "settings", icon: "setting", label: t("tabSettings") },
  { id: "docs", icon: "book", label: t("tabDocs") },
]);

// Settings form
const chainOptions = computed(() => store.EVM_CHAINS);
const currentChain = computed(() => chainOptions.value.find((chain) => chain.id === currentChainId.value));
const selectedChain = computed(() => chainOptions.value.find((chain) => chain.id === settingsForm.value.chainId));
const currentChainIndex = computed(() =>
  Math.max(
    0,
    chainOptions.value.findIndex((chain) => chain.id === settingsForm.value.chainId),
  ),
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

// Documentation
const docSteps = computed(() => [t("docStep1"), t("docStep2"), t("docStep3"), t("docStep4"), t("docStep5")]);

const docFeatures = computed(() => [
  { name: t("docFeature1Name"), desc: t("docFeature1Desc") },
  { name: t("docFeature2Name"), desc: t("docFeature2Desc") },
  { name: t("docFeature3Name"), desc: t("docFeature3Desc") },
  { name: t("docFeature4Name"), desc: t("docFeature4Desc") },
  { name: t("docFeature5Name"), desc: t("docFeature5Desc") },
  { name: t("docFeature6Name"), desc: t("docFeature6Desc") },
]);

// Actions
const isLocked = (bank: PiggyBank) => Date.now() / 1000 < bank.unlockTime;

const onChainChange = (e: any) => {
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
    uni.showToast({ title: "Settings saved", icon: "success" });
  } catch (err: any) {
    uni.showToast({ title: err?.message || "Settings error", icon: "none" });
  }
};

const handleConnect = async () => {
  try {
    await store.connectWallet();
  } catch (err: any) {
    uni.showToast({ title: err?.message || t("wallet.connect_failed"), icon: "none" });
  }
};

const goToCreate = () => {
  uni.navigateTo({ url: "/pages/create/create" });
};

const goToDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}` });
};

// Responsive layout
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);

const handleResize = () => { windowWidth.value = window.innerWidth; };
onMounted(() => window.addEventListener('resize', handleResize));
onUnmounted(() => window.removeEventListener('resize', handleResize));
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./piggy-bank-theme.scss";

.tab-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.header {
  padding: 20px;
  padding-bottom: 10px;
}

.title-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 14px;
  opacity: 0.7;
}

.status-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.status-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--piggy-chip-bg);
  border: 1px solid var(--piggy-chip-border);
  font-size: 11px;
  color: var(--piggy-chip-text);
}

.status-chip.connected {
  background: var(--piggy-chip-connected-bg);
  border-color: var(--piggy-chip-connected-border);
  color: var(--piggy-chip-connected-text);
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

.config-warning {
  margin: 0 20px 16px;
  border: 1px solid var(--piggy-warning-border);
  background: var(--piggy-warning-bg);
  padding: 12px 16px;
  border-radius: 12px;
}

.warning-title {
  font-weight: 700;
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.warning-item {
  display: block;
  font-size: 11px;
  opacity: 0.8;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.empty-text {
  font-size: 16px;
  opacity: 0.5;
  margin-bottom: 20px;
}

.create-btn {
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  color: var(--piggy-accent-text);
  border: none;
  border-radius: 20px;
  padding: 10px 30px;
  font-weight: bold;
}

.banks-list {
  flex: 1;
  padding: 0 20px;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 80px;
}

.card {
  background: var(--piggy-card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--piggy-card-border);
  border-radius: 16px;
  padding: 16px;

  &:active {
    transform: scale(0.98);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.bank-name {
  font-size: 18px;
  font-weight: bold;
}

.status-badge {
  font-size: 16px;
}

.purpose {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 12px;
  display: block;
}

.progress-section {
  margin-bottom: 8px;
}

.label {
  font-size: 11px;
  opacity: 0.6;
}

.progress-bar-bg {
  height: 6px;
  background: var(--piggy-progress-bg);
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}

.progress-bar-fill.unknown {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    var(--piggy-progress-fill),
    var(--piggy-progress-fill) 10px,
    var(--piggy-progress-fill-strong) 10px,
    var(--piggy-progress-fill-strong) 20px
  );
}

.date-info {
  font-size: 11px;
  opacity: 0.5;
  text-align: right;
  display: block;
}

.fab {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: linear-gradient(135deg, var(--piggy-accent-start), var(--piggy-accent-end));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--piggy-fab-shadow);
  z-index: 100;

  &:active {
    transform: scale(0.9);
  }
}

.fab-icon {
  font-size: 28px;
  color: var(--piggy-accent-text);
  font-weight: bold;
}

// Settings styles
.settings-container {
  padding: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.8;
}

.input-field {
  background: var(--piggy-input-bg);
  border: 1px solid var(--piggy-input-border);
  border-radius: 10px;
  padding: 12px;
  color: var(--piggy-input-text);
  font-size: 14px;
}

.picker-view {
  border: 1px solid var(--piggy-input-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--piggy-input-bg);
  font-size: 14px;
}

.settings-actions {
  margin-top: 24px;
}

.save-btn {
  width: 100%;
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  color: var(--piggy-accent-text);
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-weight: 700;
  font-size: 14px;
}

// Responsive styles
@media (max-width: 767px) {
  .header { padding: 12px; }
  .title { font-size: 24px; }
  .grid {
    padding: 0 12px;
    gap: 12px;
  }
  .fab {
    right: 12px;
    bottom: 70px;
  }
  .settings-container { padding: 12px; }
}
@media (min-width: 1024px) {
  .tab-content { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
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
