<template>
  <view class="theme-grant-share">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMessage ? { msg: statusMessage, type: statusType } : null"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <ProposalGallery
            :grants="grants"
            :loading="loading"
            :fetch-error="fetchError"
            :t="t"
            :format-count="formatCount"
            :format-date="formatDate"
            :get-status-label="getStatusLabel"
            @select="goToDetail"
            @copy-link="copyLink"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('quickActions')">
          <view class="op-actions">
            <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="fetchGrants">
              {{ loading ? t("loading") : t("refreshProposals") }}
            </NeoButton>
            <NeoButton size="sm" variant="secondary" class="op-btn" @click="openForum">
              {{ t("createProposal") }}
            </NeoButton>
          </view>
          <NeoStats :stats="poolStatsArray" />
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";

import { useGrantProposals } from "@/composables/useGrantProposals";
import { useGrantVoting } from "@/composables/useGrantVoting";
import ProposalGallery from "./components/ProposalGallery.vue";

const { t } = useI18n();

const {
  grants,
  totalProposals,
  loading,
  fetchError,
  activeProposals,
  displayedProposals,
  fetchGrants,
  formatCount,
  formatDate,
  getStatusLabel,
} = useGrantProposals();

const { statusMessage, statusType, copyLink } = useGrantVoting();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "tabGrants", icon: "📋", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
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

const activeTab = ref<string>("main");

const appState = computed(() => ({
  totalProposals: totalProposals.value,
  activeProposals: activeProposals.value,
  displayedProposals: displayedProposals.value,
}));

const sidebarItems = computed(() => [
  { label: t("totalPool"), value: formatCount(totalProposals.value) },
  { label: t("activeProjects"), value: formatCount(activeProposals.value) },
  { label: t("yourShare"), value: formatCount(displayedProposals.value) },
]);

const poolStatsArray = computed(() => [
  { label: t("totalPool"), value: formatCount(totalProposals.value) },
  { label: t("activeProjects"), value: formatCount(activeProposals.value) },
  { label: t("yourShare"), value: formatCount(displayedProposals.value), variant: "accent" as const },
]);

const handleBoundaryError = (error: Error) => {
  console.error("[grant-share] boundary error:", error);
};

const resetAndReload = async () => {
  await fetchGrants();
};

function goToDetail(grant: Record<string, unknown>) {
  try {
    uni.setStorageSync("current_grant_detail", grant);
  } catch (_e: unknown) {
    // Storage save failed - continue anyway
  }
  uni.navigateTo({
    url: `/pages/detail/index?id=${grant.id}`,
  });
}

function openForum() {
  uni.navigateTo({
    url: "/pages/index/index?action=forum",
    fail: () => {
      // Fallback: open external forum URL
      if (typeof window !== "undefined") {
        window.open("https://forum.grantshares.io", "_blank");
      }
    },
  });
}

onMounted(() => {
  fetchGrants();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./grant-share-theme.scss";

:global(page) {
  background: var(--eco-bg);
}

.op-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.op-btn {
  width: 100%;
}
</style>
