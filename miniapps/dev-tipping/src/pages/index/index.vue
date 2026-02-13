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
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <TipList :developers="developers" :formatNum="formatNum" :t="t" @select="handleSelectDev" />
        </ErrorBoundary>
      </template>

      <!-- Main Tab — RIGHT panel -->
      <template #operation>
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
      </template>

      <template #tab-stats>
        <WalletInfo :totalDonated="totalDonated" :recentTips="recentTips" :formatNum="formatNum" :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
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
  { label: t("totalDonated"), value: formatNum(totalDonated.value) },
  { label: t("recentTips"), value: recentTips.value.length },
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

const { handleBoundaryError } = useHandleBoundaryError("dev-tipping");
const resetAndReload = async () => {
  await refreshData();
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
</style>
