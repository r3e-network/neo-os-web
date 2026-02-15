<template>
  <MiniAppPage
    name="graveyard"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <HeroSection variant="erobo-neo" compact>
        <template #background>
          <view class="tombstone-scene" aria-hidden="true">
            <view class="moon"></view>
            <view class="fog fog-1"></view>
            <view class="fog fog-2"></view>
            <view v-for="i in 3" :key="i" :class="['tombstone', `tombstone-${i}`]">
              <text class="rip">{{ t("rip") }}</text>
            </view>
          </view>
        </template>
        <template #stats>
          <view class="hero-stats">
            <view class="hero-stat">
              <text class="hero-stat-icon">💀</text>
              <text class="hero-stat-value">{{ totalDestroyed }}</text>
              <text class="hero-stat-label">{{ t("itemsDestroyed") }}</text>
            </view>
            <view class="hero-stat">
              <AppIcon name="gas" :size="28" class="hero-stat-icon" />
              <text class="hero-stat-value">{{ formatNum(gasReclaimed) }}</text>
              <text class="hero-stat-label">{{ t("gasReclaimed") }}</text>
            </view>
          </view>
        </template>
      </HeroSection>

      <HistoryTab :history="history" :forgetting-id="forgettingId" @forget="forgetMemory" />
    </template>

    <template #operation>
      <DestructionChamber
        v-model:assetHash="assetHash"
        v-model:memoryType="memoryType"
        :memory-type-options="memoryTypeOptions"
        :is-destroying="isDestroying"
        :show-warning-shake="showWarningShake"
        @initiate="initiateDestroy"
      />

      <ConfirmDestroyModal
        :show="showConfirm"
        :asset-hash="assetHash"
        @cancel="showConfirm = false"
        @confirm="executeDestroy"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useGraveyardActions } from "@/composables/useGraveyardActions";

const {
  totalDestroyed,
  gasReclaimed,
  assetHash,
  memoryType,
  status,
  history,
  showConfirm,
  isDestroying,
  showWarningShake,
  forgettingId,
  memoryTypeOptions,
  initiateDestroy,
  executeDestroy,
  loadStats,
  loadHistory,
  forgetMemory,
  cleanupTimers,
} = useGraveyardActions();

const formatNum = (n: number) => formatNumber(n, 2);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "graveyard",
  messages,
  template: {
    tabs: [{ key: "main", labelKey: "destroy", icon: "🗑️", default: true }],
    fireworks: true,
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "totalDestroyed", value: () => totalDestroyed.value },
    { labelKey: "gasReclaimed", value: () => `${gasReclaimed.value} GAS` },
    { labelKey: "history", value: () => history.value.length },
  ],
});

const resetAndReload = async () => {
  await loadStats();
  await loadHistory();
};

const activeTab = ref("main");

const appState = computed(() => ({
  totalDestroyed: totalDestroyed.value,
  gasReclaimed: gasReclaimed.value,
}));

onUnmounted(() => {
  cleanupTimers();
});

onMounted(async () => {
  await loadStats();
  await loadHistory();
});

watch(activeTab, async (tab) => {
  if (tab === "history") {
    await loadHistory();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./graveyard-theme.scss";

@include page-background(
  var(--grave-bg),
  (
    font-family: var(--grave-font),
  )
);

.tombstone-scene {
  height: 140px;
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  position: relative;
  background: linear-gradient(180deg, var(--grave-panel-soft), var(--grave-panel-strong));
  border-radius: 8px;
  padding: 0 20px;
  border: 1px solid var(--grave-panel-border);
  box-shadow: inset 0 0 20px var(--grave-panel);
}

.moon {
  position: absolute;
  top: 15px;
  right: 30px;
  width: 40px;
  height: 40px;
  background: var(--grave-warning);
  border-radius: 50%;
  box-shadow: 0 0 20px var(--grave-warning-glow, rgba(255, 222, 89, 0.6));
  opacity: 0.8;
}

.tombstone {
  width: 50px;
  height: 80px;
  background: var(--grave-panel-strong);
  border: 1px solid var(--grave-panel-border);
  border-radius: 25px 25px 4px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  backdrop-filter: blur(4px);

  &.tombstone-1 {
    bottom: 0;
    transform: scale(0.9);
  }
  &.tombstone-2 {
    bottom: 0;
    transform: scale(1.1);
    z-index: 3;
  }
  &.tombstone-3 {
    bottom: 0;
    transform: scale(0.95);
  }
}

.rip {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 700;
  letter-spacing: 1px;
}

.hero-stats {
  display: flex;
  gap: $spacing-4;
}

.hero-stat {
  flex: 1;
  text-align: center;
  background: var(--grave-panel-soft);
  padding: $spacing-4;
  border-radius: 8px;
  border: 1px solid var(--grave-panel-border);
  transition: background 0.2s;

  &:hover {
    background: var(--grave-panel-strong);
  }
}

.hero-stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: $font-mono;
  display: block;
}

.hero-stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 4px;
  display: block;
}

.fog {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(0deg, var(--grave-fog), transparent);
  filter: blur(8px);
  z-index: 10;
}
</style>
