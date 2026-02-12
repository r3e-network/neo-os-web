<template>
  <view class="theme-neo-multisig">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="handleTabChange">
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="multisig-container">
          <view class="bg-effects">
            <view class="glow-orb orb-1"></view>
            <view class="glow-orb orb-2"></view>
            <view class="grid-overlay"></view>
          </view>

          <HeroSection :title="t('appTitle')" :headline="t('homeTitle')" :subtitle="t('homeSubtitle')" />

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
      </template>

      <template #operation>
        <view class="multisig-container">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
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
  { label: "Total Txs", value: history.value.length },
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-multisig-theme.scss";

:global(page) {
  background: var(--multi-bg-start);
}

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
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(30px, -20px);
  }
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
