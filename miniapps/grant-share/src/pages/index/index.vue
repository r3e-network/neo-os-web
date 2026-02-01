<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-grant-share" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <view class="app-container">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="statusMessage" :variant="statusType === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold uppercase tracking-wider">{{ statusMessage }}</text>
      </NeoCard>

      <!-- Grants Tab -->
      <view v-if="activeTab === 'grants'" class="tab-content">
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

      <!-- Stats Tab -->
      <view v-if="activeTab === 'stats'" class="tab-content">
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
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoCard, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";

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

const activeTab = ref<string>("grants");
const navTabs = computed<NavTab[]>(() => [
  { id: "grants", icon: "gift", label: t("tabGrants") },
  { id: "stats", icon: "chart", label: t("tabStats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

function goToDetail(grant: any) {
  try {
    uni.setStorageSync("current_grant_detail", grant);
  } catch (e) {
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
@use "@shared/styles/variables.scss";
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

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 767px) {
  .app-container { padding: 12px; }
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
