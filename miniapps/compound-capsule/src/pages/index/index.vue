<template>
  <MiniAppPage
    name="compound-capsule"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadData"
  >
    <!-- Main Tab — LEFT panel -->
    <template #content>
      <RewardClaim :position="position" />
    </template>

    <!-- Main Tab — RIGHT panel -->
    <template #operation>
      <CapsuleCreate
        v-model="selectedPeriod"
        :is-loading="isLoading"
        :min-lock-days="MIN_LOCK_DAYS"
        @create="createCapsule"
      />
    </template>

    <template #tab-stats>
      <CapsuleDetails :vault="vault" />

      <CapsuleList :capsules="activeCapsules" :is-loading="isLoading" @unlock="unlockCapsule" />

      <!-- Statistics -->
      <StatsTab :grid-items="capsuleStats" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { formatNumber } from "@shared/utils/format";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useCompoundCapsule } from "@/composables/useCompoundCapsule";
import RewardClaim from "./components/RewardClaim.vue";

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
  name: "compound-capsule",
  messages,
  template: {
    tabs: [
      { key: "main", labelKey: "main", icon: "💊", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "totalCapsules", value: () => capsule.stats.value.totalCapsules },
    { labelKey: "totalLocked", value: () => `${fmt(capsule.stats.value.totalLocked, 0)} NEO` },
    { labelKey: "totalAccrued", value: () => `${fmt(capsule.stats.value.totalAccrued, 4)} GAS` },
  ],
});

const capsule = useCompoundCapsule(t, setStatus);
const { address, isLoading, vault, position, stats, activeCapsules, loadData, unlockCapsule } = capsule;

const MIN_LOCK_DAYS = 7;
const selectedPeriod = ref<number>(30);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const appState = computed(() => ({
  totalCapsules: stats.value.totalCapsules,
  totalLocked: stats.value.totalLocked,
  totalAccrued: stats.value.totalAccrued,
}));

const capsuleStats = computed(() => [
  { label: t("totalCapsules"), value: stats.value.totalCapsules },
  { label: t("totalLocked"), value: `${fmt(stats.value.totalLocked, 0)} NEO` },
  { label: t("totalAccrued"), value: `${fmt(stats.value.totalAccrued, 4)} GAS` },
]);

const createCapsule = () => capsule.createCapsule(selectedPeriod.value);

watch(
  address,
  () => {
    loadData();
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./compound-capsule-theme.scss";

:global(page) {
  background: var(--capsule-bg);
}
</style>
