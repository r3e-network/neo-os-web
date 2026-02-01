<template>
  <ResponsiveLayout
    :desktop-breakpoint="1024"
    class="theme-neo-multisig"
    :tabs="tabs"
    :active-tab="activeTab"
    @tab-change="handleTabChange"
  >
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <view class="multisig-container">
      <view class="bg-effects">
        <view class="glow-orb orb-1"></view>
        <view class="glow-orb orb-2"></view>
        <view class="grid-overlay"></view>
      </view>

      <HeroSection
        :title="t('appTitle')"
        :headline="t('homeTitle')"
        :subtitle="t('homeSubtitle')"
      />

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

      <ActivitySection
        :items="history"
        :count="history.length"
        :title="t('recentTitle')"
        :empty-title="'No Activity Yet'"
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
        total-label="Total Txs"
        :pending-label="t('statPending')"
        :completed-label="t('statCompleted')"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ResponsiveLayout, ChainWarning } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { useMultisigHistory } from "@/composables/useMultisigHistory";
import { useMultisigUI } from "@/composables/useMultisigUI";
import HeroSection from "@/components/HeroSection.vue";
import MainCard from "@/components/MainCard.vue";
import ActivitySection from "@/components/ActivitySection.vue";
import StatsRow from "@/components/StatsRow.vue";

const { t } = useI18n();
const { history, pendingCount, completedCount } = useMultisigHistory();
const { getStatusIcon, statusLabel, shorten, formatDate, tabs } = useMultisigUI();

const activeTab = ref("home");
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./neo-multisig-theme.scss";

.multisig-container {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  background: var(--multi-bg-gradient);
  overflow: hidden;
}

.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 10s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: var(--multi-orb-one);
  top: -100px;
  left: -100px;
}

.orb-2 {
  width: 200px;
  height: 200px;
  background: var(--multi-orb-two);
  bottom: 100px;
  right: -50px;
  animation-delay: -5s;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--multi-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--multi-grid-line) 1px, transparent 1px);
  background-size: 50px 50px;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, -20px); }
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
  .multisig-container {
    padding: 12px;
  }
}

@media (min-width: 1024px) {
  .multisig-container {
    padding: 32px;
    max-width: 800px;
    margin: 0 auto;
  }
}
</style>
