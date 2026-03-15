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
      <div class="hero-container">
        <HeroSection variant="erobo-neo" compact>
          <template #background>
            <div class="multisig-scene" aria-hidden="true">
              <div class="key-group">
                <span class="key-icon key-icon--active">🔑</span>
                <span class="key-icon key-icon--active">🔑</span>
                <span class="key-icon key-icon--inactive">🔑</span>
              </div>
              <span class="key-label">2 of 3</span>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ pendingCount }}</span>
                <span class="hero-stat-label">{{ t("statPending") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ completedCount }}</span>
                <span class="hero-stat-label">{{ t("statCompleted") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ history.length }}</span>
                <span class="hero-stat-label">{{ t("sidebarTotalTxs") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

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
import { computed } from "vue";
import { MiniAppPage, StatsDisplay, HeroSection } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useMultisigHistory } from "@/composables/useMultisigHistory";
import { useMultisigUI } from "@/composables/useMultisigUI";
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
const handleTabChange = (tabId: string) => {
  if (tabId === "docs") {
    uni.navigateTo({ url: "/pages/docs/index" });
    return;
  }
};
const openHistory = (id: string) => {
  uni.navigateTo({ url: `/pages/sign/index?id=${id}` });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./neo-multisig-theme.scss" as *;

:global(body) {
  background: var(--multi-bg-start);
}

.hero-container {
  margin-bottom: 20px;
}

.multisig-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 80px;
  justify-content: center;
}

.key-group {
  display: flex;
  gap: 12px;
}

.key-icon {
  font-size: 24px;
  transition: opacity 0.3s;
}

.key-icon--active {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(0, 229, 153, 0.5));
}

.key-icon--inactive {
  opacity: 0.3;
}

.key-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 2px;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

/* ── Neo Multisig Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes key-rotate {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(15deg) scale(1.1);
  }
  50% {
    transform: rotate(0deg) scale(1);
  }
  75% {
    transform: rotate(-10deg) scale(1.05);
  }
}

@keyframes shield-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes lock-pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 12px rgba(0, 229, 153, 0.1),
      0 0 24px rgba(0, 229, 153, 0.05);
    border-color: rgba(0, 229, 153, 0.15);
  }
  50% {
    box-shadow:
      0 0 22px rgba(0, 229, 153, 0.25),
      0 0 44px rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);
  }
}

.multisig-scene {
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.04) 0%, transparent 100%);
}

.key-icon--active {
  animation: key-rotate 5s ease-in-out infinite;
  display: inline-block;
}

.key-icon--active:nth-child(2) {
  animation-delay: 1s;
  animation-direction: reverse;
}

.key-group {
  background: linear-gradient(
    90deg,
    rgba(0, 229, 153, 0.06) 0%,
    rgba(0, 180, 120, 0.03) 50%,
    rgba(0, 229, 153, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: shield-gradient 6s ease infinite;
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 229, 153, 0.1);
}

.key-label {
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.4);
}

.hero-stat {
  animation: lock-pulse-glow 4s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(0, 180, 120, 0.06) 100%);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 24px rgba(0, 229, 153, 0.3);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.5s;
}

.hero-stat:nth-child(3) {
  animation-delay: 1s;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
}
</style>
