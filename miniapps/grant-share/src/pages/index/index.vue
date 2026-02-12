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
        <view class="app-container">
          <NeoCard
            v-if="statusMessage"
            :variant="statusType === 'error' ? 'danger' : 'success'"
            class="mb-4 text-center"
          >
            <text class="font-bold tracking-wider uppercase">{{ statusMessage }}</text>
          </NeoCard>

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
        </view>
      </template>

      <template #tab-stats>
        <NeoCard variant="erobo" class="pool-overview-card">
          <view class="pool-stats">
            <view class="pool-stat-glass">
              <text class="stat-label-glass">{{ t("totalPool") }}</text>
              <text class="stat-value-glass">{{ formatCount(totalProposals) }}</text>
            </view>
            <view class="pool-stat-glass">
              <text class="stat-label-glass">{{ t("activeProjects") }}</text>
              <text class="stat-value-glass">{{ formatCount(activeProposals) }}</text>
            </view>
            <view class="pool-stat-glass">
              <text class="stat-label-glass">{{ t("yourShare") }}</text>
              <text class="stat-value-glass highlight">{{ formatCount(displayedProposals) }}</text>
            </view>
          </view>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
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
  contentType: "market-list",
  tabs: [
    { key: "grants", labelKey: "tabGrants", icon: "📋", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
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

const activeTab = ref<string>("grants");

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

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--eco-bg);
  background-image:
    radial-gradient(circle at 10% 10%, var(--eco-bg-pattern) 0%, transparent 40%),
    radial-gradient(circle at 90% 90%, var(--eco-bg-pattern) 0%, transparent 40%);
  min-height: 100vh;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mb-4 {
  margin-bottom: 16px;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
}

.uppercase {
  text-transform: uppercase;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.pool-overview-card {
  margin-bottom: 16px;
}

.pool-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.pool-stat-glass {
  padding: 16px;
  background: var(--eco-pool-stat-bg);
  border: 1px solid var(--eco-pool-stat-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-label-glass {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--eco-text-muted);
  margin-bottom: 4px;
}

.stat-value-glass {
  font-weight: 700;
  font-size: 18px;
  color: var(--eco-text);
  &.highlight {
    color: var(--eco-accent-strong);
  }
}


@media (max-width: 767px) {
  .app-container {
    padding: 12px;
  }
  .pool-stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (min-width: 1024px) {
  .app-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
}
</style>
