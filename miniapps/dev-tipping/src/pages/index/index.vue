<template>
  <view class="theme-dev-tipping">
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
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab — LEFT panel -->
      <template #content>
        <view class="app-container">
          <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4">
            <text class="text-glass text-center font-bold">{{ status.msg }}</text>
          </NeoCard>
        </view>
      </template>

      <!-- Main Tab — RIGHT panel -->
      <template #operation>
        <view class="app-container">
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
      </template>

      <template #tab-developers>
        <view class="app-container">
          <TipList :developers="developers" :formatNum="formatNum" :t="t" @select="handleSelectDev" />
        </view>
      </template>

      <template #tab-stats>
        <view class="app-container">
          <WalletInfo :totalDonated="totalDonated" :recentTips="recentTips" :formatNum="formatNum" :t="t" />
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useDevTippingStats, type Developer } from "@/composables/useDevTippingStats";
import { useDevTippingWallet } from "@/composables/useDevTippingWallet";
import TipForm from "@/components/TipForm.vue";
import TipList from "@/components/TipList.vue";
import WalletInfo from "@/components/WalletInfo.vue";

const { t } = useI18n();
const APP_ID = "miniapp-dev-tipping";

const { developers, recentTips, totalDonated, formatNum, loadDevelopers, loadRecentTips } = useDevTippingStats();
const { address, isLoading, status, setStatus, sendTip } = useDevTippingWallet(APP_ID);

const activeTab = ref<string>("send");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "send", labelKey: "sendTip", icon: "💰", default: true },
    { key: "developers", labelKey: "developers", icon: "👨‍💻" },
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

const appState = computed(() => ({
  totalDonated: totalDonated.value,
  developerCount: developers.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("developers"), value: developers.value.length },
  { label: "Total Donated", value: formatNum(totalDonated.value) },
  { label: "Recent Tips", value: recentTips.value.length },
]);

const selectedDevId = ref<number | null>(null);
const tipAmount = ref("1");
const tipMessage = ref("");
const tipperName = ref("");
const anonymous = ref(false);

const refreshData = async () => {
  await loadDevelopers(t);
  await loadRecentTips(APP_ID, t);
};

const handleSelectDev = (dev: Developer) => {
  selectedDevId.value = dev.id;
  setStatus(`${t("selected")} ${dev.name}`, "success");
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
@use "@shared/styles/variables.scss" as *;
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

</style>
