<template>
  <MiniAppPage
    name="neo-multisig"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="handleTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
  >
    <!-- LEFT panel: Activity & Stats -->
    <template #content>
      <HeroSection :title="t('appTitle')" :headline="t('homeTitle')" :subtitle="t('homeSubtitle')" />

      <ActivitySection
        :items="history"
        :count="history.length"
        :title="t('recentTitle')"
        :empty-title="t('sidebarNoActivity')"
        :empty-description="t('recentEmpty')"
        :get-status-icon="getStatusIcon"
        :status-label="statusLabel"
        :shorten="shorten"
        :format-date="formatDate"
        @select="openHistory"
      />

      <StatsDisplay :items="multisigStats" layout="grid" :columns="3" />
    </template>

    <!-- RIGHT panel: Create / Load -->
    <template #operation>
      <MainCard
        v-model="idInput"
        :create-title="t('createCta')"
        :create-desc="t('createDesc')"
        :divider-text="t('dividerOr')"
        :load-label="t('loadTitle')"
        :load-placeholder="t('loadPlaceholder')"
        :load-button-text="t('loadButton')"
        @create="navigateToCreate"
        @load="loadTransaction"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { MiniAppPage, StatsDisplay } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useMultisigHistory } from "@/composables/useMultisigHistory";
import { useMultisigUI } from "@/composables/useMultisigUI";
import HeroSection from "@/components/HeroSection.vue";
import ActivitySection from "@/components/ActivitySection.vue";

const { history, pendingCount, completedCount } = useMultisigHistory();
const { getStatusIcon, statusLabel, shorten, formatDate } = useMultisigUI();

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "neo-multisig",
  messages,
  template: {
    tabs: [{ key: "home", labelKey: "tabHome", icon: "🏠", default: true }],
    docTitleKey: "docTitle",
    docFeatureCount: 3,
    docStepPrefix: "docStep",
    docFeaturePrefix: "docFeature",
  },
  sidebarItems: [
    { labelKey: "sidebarTotalTxs", value: () => history.value.length },
    { labelKey: "statPending", value: () => pendingCount.value },
    { labelKey: "statCompleted", value: () => completedCount.value },
  ],
});

const appState = computed(() => ({
  totalTxs: history.value.length,
  pending: pendingCount.value,
  completed: completedCount.value,
}));

const multisigStats = computed<StatsDisplayItem[]>(() => [
  { label: t("sidebarTotalTxs"), value: history.value.length },
  { label: t("statPending"), value: pendingCount.value },
  { label: t("statCompleted"), value: completedCount.value },
]);

const idInput = ref("");

const handleTabChange = (tabId: string) => {
  if (tabId === "docs") {
    uni.navigateTo({ url: "/pages/docs/index" });
    return;
  }
};

const navigateToCreate = () => {
  uni.navigateTo({ url: "/pages/create/index" });
};

const loadTransaction = () => {
  if (!idInput.value) return;
  uni.navigateTo({ url: `/pages/sign/index?id=${idInput.value}` });
};

const openHistory = (id: string) => {
  uni.navigateTo({ url: `/pages/sign/index?id=${id}` });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-multisig-theme.scss";

:global(page) {
  background: var(--multi-bg-start);
}
</style>
