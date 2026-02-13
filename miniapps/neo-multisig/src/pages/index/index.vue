<template>
  <view class="theme-neo-multisig">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="handleTabChange">
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- LEFT panel: Activity & Stats -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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

        <StatsRow
          :total="history.length"
          :pending="pendingCount"
          :completed="completedCount"
          :total-label="t('sidebarTotalTxs')"
          :pending-label="t('statPending')"
          :completed-label="t('statCompleted')"
        />
        </ErrorBoundary>
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
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useMultisigHistory } from "@/composables/useMultisigHistory";
import { useMultisigUI } from "@/composables/useMultisigUI";
import HeroSection from "@/components/HeroSection.vue";
import MainCard from "@/components/MainCard.vue";
import ActivitySection from "@/components/ActivitySection.vue";
import StatsRow from "@/components/StatsRow.vue";

const { t } = useI18n();
const { history, pendingCount, completedCount } = useMultisigHistory();
const { getStatusIcon, statusLabel, shorten, formatDate } = useMultisigUI();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "home", labelKey: "tabHome", icon: "🏠", default: true },
    { key: "docs", labelKey: "tabDocs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
  },
};
const activeTab = ref("home");
const appState = computed(() => ({
  totalTxs: history.value.length,
  pending: pendingCount.value,
  completed: completedCount.value,
}));
const sidebarItems = computed(() => [
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
  activeTab.value = tabId;
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

const handleBoundaryError = (error: Error) => {
  console.error("[neo-multisig] boundary error:", error);
};
const resetAndReload = () => {
  /* no async data to reload on home page */
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
