<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-dev-tipping" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <view
      v-if="activeTab === 'developers' || activeTab === 'send' || activeTab === 'stats'"
      class="app-container theme-dev-tipping"
    >
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4">
        <text class="text-center font-bold text-glass">{{ status.msg }}</text>
      </NeoCard>

      <view v-if="activeTab === 'developers'" class="tab-content">
        <TipList :developers="developers" :formatNum="formatNum" :t="t" @select="handleSelectDev" />
      </view>

      <view v-if="activeTab === 'send'" class="tab-content">
        <TipForm
          :developers="developers"
          v-model="selectedDevId"
          v-model:amount="tipAmount"
          v-model:message="tipMessage"
          v-model:tipperName="tipperName"
          v-model:anonymous="anonymous"
          :isLoading="isLoading"
          :t="t"
          @submit="handleSendTip"
        />
      </view>

      <view v-if="activeTab === 'stats'" class="tab-content">
        <WalletInfo :totalDonated="totalDonated" :recentTips="recentTips" :formatNum="formatNum" :t="t" />
      </view>
    </view>

    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
    <Fireworks :active="status?.type === 'success'" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ResponsiveLayout, NeoDoc, NeoCard, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useI18n } from "@/composables/useI18n";
import { useDevTippingStats, type Developer } from "@/composables/useDevTippingStats";
import { useDevTippingWallet } from "@/composables/useDevTippingWallet";
import TipForm from "@/components/TipForm.vue";
import TipList from "@/components/TipList.vue";
import WalletInfo from "@/components/WalletInfo.vue";

const { t } = useI18n();
const APP_ID = "miniapp-dev-tipping";

const { developers, recentTips, totalDonated, formatNum, loadDevelopers, loadRecentTips } = useDevTippingStats();
const { address, isLoading, status, sendTip } = useDevTippingWallet(APP_ID);

const activeTab = ref<string>("send");
const navTabs = computed<NavTab[]>(() => [
  { id: "send", label: t("sendTip"), icon: "💰" },
  { id: "developers", label: t("developers"), icon: "👨‍💻" },
  { id: "stats", label: t("stats"), icon: "chart" },
  { id: "docs", icon: "book", label: t("docs") },
]);

const selectedDevId = ref<number | null>(null);
const tipAmount = ref("1");
const tipMessage = ref("");
const tipperName = ref("");
const anonymous = ref(false);

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const refreshData = async () => {
  await loadDevelopers(t);
  await loadRecentTips(APP_ID, t);
};

const handleSelectDev = (dev: Developer) => {
  selectedDevId.value = dev.id;
  status.value = { msg: `${t("selected")} ${dev.name}`, type: "success" };
  activeTab.value = "send";
};

const handleSendTip = async () => {
  if (!selectedDevId.value) return;
  
  const success = await sendTip(
    selectedDevId.value,
    tipAmount.value,
    tipMessage.value,
    tipperName.value,
    anonymous.value,
    t,
    () => {
      tipAmount.value = "1";
      tipMessage.value = "";
      tipperName.value = "";
      anonymous.value = false;
    }
  );
  
  if (success) {
    await refreshData();
  }
};

onMounted(() => {
  refreshData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./dev-tipping-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.app-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  gap: 16px;
  background-color: var(--cafe-bg);
  background-image:
    linear-gradient(var(--cafe-panel-weak), var(--cafe-panel-weak)),
    repeating-linear-gradient(0deg, transparent, transparent 20px, var(--cafe-border) 21px),
    repeating-linear-gradient(90deg, transparent, transparent 20px, var(--cafe-border) 21px);
}

.tab-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

:global(.theme-dev-tipping) :deep(.neo-card) {
  background: linear-gradient(135deg, var(--cafe-glass) 0%, var(--cafe-panel) 100%) !important;
  border: 1px solid var(--cafe-neon) !important;
  border-radius: 16px !important;
  box-shadow: var(--cafe-card-shadow) !important;
  color: var(--cafe-text) !important;
  backdrop-filter: blur(10px);

  &.variant-danger {
    border-color: var(--cafe-error-border) !important;
    background: var(--cafe-error-bg) !important;
  }
}

:global(.theme-dev-tipping) :deep(.neo-button) {
  border-radius: 8px !important;
  font-family: "JetBrains Mono", monospace !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.variant-primary {
    background: var(--cafe-neon) !important;
    color: var(--cafe-button-text) !important;
    border: none !important;
    box-shadow: var(--cafe-button-shadow) !important;

    &:active {
      transform: scale(0.98);
      box-shadow: var(--cafe-button-shadow-press) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--cafe-secondary-border) !important;
    color: var(--cafe-secondary-text) !important;
  }
}

:global(.theme-dev-tipping) :deep(input),
:global(.theme-dev-tipping) :deep(.neo-input) {
  background: var(--cafe-input-bg) !important;
  border: 1px solid var(--cafe-input-border) !important;
  color: var(--cafe-text) !important;
  border-radius: 8px !important;
  font-family: "JetBrains Mono", monospace !important;

  &:focus {
    border-color: var(--cafe-neon) !important;
    box-shadow: 0 0 0 1px var(--cafe-neon) !important;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
