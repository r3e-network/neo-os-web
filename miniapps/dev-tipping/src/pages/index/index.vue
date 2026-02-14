<template>
  <view class="theme-dev-tipping">
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
<!-- Main Tab — LEFT panel -->
      <template #content>
        
          <TipList :developers="developers" :formatNum="formatNum" :t="t" @select="handleSelectDev" />
        
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
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppShell } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createUseI18n } from "@shared/composables/useI18n";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";
import { messages } from "@/locale/messages";
import { useDevTippingStats, type Developer } from "@/composables/useDevTippingStats";
import { useDevTippingWallet } from "@/composables/useDevTippingWallet";
import TipForm from "@/components/TipForm.vue";
import TipList from "@/components/TipList.vue";
import WalletInfo from "@/components/WalletInfo.vue";

const { t } = createUseI18n(messages)();
const APP_ID = "miniapp-dev-tipping";

const { developers, recentTips, totalDonated, formatNum, loadDevelopers, loadRecentTips } = useDevTippingStats();
const { address, isLoading, status, setStatus, sendTip } = useDevTippingWallet(APP_ID);

const activeTab = ref<string>("send");

const templateConfig = createPrimaryStatsTemplateConfig(
  { key: "send", labelKey: "sendTip", icon: "💰", default: true },
  {
    fireworks: true,
  },
);

const appState = computed(() => ({
  totalDonated: totalDonated.value,
  developerCount: developers.value.length,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "developers", value: () => developers.value.length },
  { labelKey: "totalDonated", value: () => formatNum(totalDonated.value) },
  { labelKey: "recentTips", value: () => recentTips.value.length },
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
@use "@shared/styles/page-common" as *;
@import "./dev-tipping-theme.scss";

@include page-background(var(--bg-primary));
</style>
