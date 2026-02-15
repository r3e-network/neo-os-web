<template>
  <MiniAppPage
    name="dev-tipping"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="refreshData"
  >
    <!-- Main Tab — LEFT panel -->
    <template #content>
      <TipList :developers="developers" :formatNum="formatNum" @select="handleSelectDev" />
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
        @submit="handleSendTip"
      />
    </template>

    <template #tab-stats>
      <WalletInfo :totalDonated="totalDonated" :recentTips="recentTips" :formatNum="formatNum" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useDevTippingStats } from "@/composables/useDevTippingStats";
import { useDevTippingWallet } from "@/composables/useDevTippingWallet";
import TipList from "@/components/TipList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "dev-tipping",
  messages,
  template: {
    tabs: [
      { key: "send", labelKey: "sendTip", icon: "💰", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "developers", value: () => developers.value.length },
    { labelKey: "totalDonated", value: () => formatNum(totalDonated.value) },
    { labelKey: "recentTips", value: () => recentTips.value.length },
  ],
});
const APP_ID = "miniapp-dev-tipping";

const { developers, recentTips, totalDonated, formatNum, loadDevelopers, loadRecentTips } = useDevTippingStats();
const { address, isLoading, status, setStatus, sendTip } = useDevTippingWallet(APP_ID);

const appState = computed(() => ({
  totalDonated: totalDonated.value,
  developerCount: developers.value.length,
}));

const selectedDevId = ref<number | null>(null);
const tipAmount = ref("1");
const tipMessage = ref("");
const tipperName = ref("");
const anonymous = ref(false);

const refreshData = async () => {
  await loadDevelopers();
  await loadRecentTips(APP_ID);
};

const handleSelectDev = (dev: Developer) => {
  selectedDevId.value = dev.id;
  setStatus(`${t("selected")} ${dev.name}`, "success");
};

const handleSendTip = async () => {
  if (!selectedDevId.value) return;

  const success = await sendTip(
    selectedDevId.value,
    tipAmount.value,
    tipMessage.value,
    tipperName.value,
    anonymous.value,
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
@use "@shared/styles/page-common" as *;
@import "./dev-tipping-theme.scss";

@include page-background(var(--bg-primary));
</style>
