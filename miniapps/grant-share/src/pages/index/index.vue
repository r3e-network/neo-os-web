<template>
  <MiniAppPage
    name="grant-share"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="statusMessage ? { msg: statusMessage, type: statusType } : null"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadGrants"
  >
    <template #content>
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
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('quickActions')">
        <view class="op-actions">
          <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="loadGrants">
            {{ loading ? t("loading") : t("refreshProposals") }}
          </NeoButton>
          <NeoButton size="sm" variant="secondary" class="op-btn" @click="openForum">
            {{ t("createProposal") }}
          </NeoButton>
        </view>
        <StatsDisplay :items="poolStatsArray" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";

import { useGrantProposals } from "@/composables/useGrantProposals";
import { useGrantVoting } from "@/composables/useGrantVoting";
import ProposalGallery from "./components/ProposalGallery.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "grant-share",
  messages,
  template: {
    tabs: [{ key: "main", labelKey: "tabGrants", icon: "📋", default: true }],
  },
  sidebarItems: [
    { labelKey: "totalPool", value: () => formatCount(totalProposals.value) },
    { labelKey: "activeProjects", value: () => formatCount(activeProposals.value) },
    { labelKey: "yourShare", value: () => formatCount(displayedProposals.value) },
  ],
});

const {
  grants,
  totalProposals,
  loading,
  fetchError,
  activeProposals,
  displayedProposals,
  loadGrants,
  formatCount,
  formatDate,
  getStatusLabel,
} = useGrantProposals();

const { statusMessage, statusType, copyLink } = useGrantVoting();

const activeTab = ref<string>("main");

const appState = computed(() => ({
  totalProposals: totalProposals.value,
  activeProposals: activeProposals.value,
  displayedProposals: displayedProposals.value,
}));

const poolStatsArray = computed(() => [
  { label: t("totalPool"), value: formatCount(totalProposals.value) },
  { label: t("activeProjects"), value: formatCount(activeProposals.value) },
  { label: t("yourShare"), value: formatCount(displayedProposals.value), variant: "accent" as const },
]);

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
  loadGrants();
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
