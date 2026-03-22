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
          <div class="tombstone-scene" aria-hidden="true">
            <div class="moon"></div>
            <div class="fog fog-1"></div>
            <div class="fog fog-2"></div>
            <div v-for="i in 3" :key="i" :class="['tombstone', `tombstone-${i}`]">
              <span class="rip">{{ t("rip") }}</span>
            </div>
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <AppIcon name="skull" :size="28" class="hero-stat-icon" />
              <span class="hero-stat-value">{{ totalDestroyed }}</span>
              <span class="hero-stat-label">{{ t("itemsDestroyed") }}</span>
            </div>
            <div class="hero-stat">
              <AppIcon name="gas" :size="28" class="hero-stat-icon" />
              <span class="hero-stat-value">{{ formatNum(gasReclaimed) }}</span>
              <span class="hero-stat-label">{{ t("gasReclaimed") }}</span>
            </div>
          </div>
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
import { MiniAppPage, HeroSection, AppIcon } from "@shared/components"; // eslint-disable-line @typescript-eslint/no-unused-vars
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
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "graveyard",
  messages,
  template: {
    tabs: [{ key: "main", labelKey: "destroy", icon: "🗑️", default: true, ariaHidden: true }],
    fireworks: true,
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "totalDestroyed", value: () => totalDestroyed.value },
    { labelKey: "gasReclaimed", value: () => `${gasReclaimed.value} ${t("tokenGas")}` },
    { labelKey: "history", value: () => history.value.length },
  ],
});

const resetAndReload = async () => {
  await loadStats();
  await loadHistory();
};

const activeTab = ref("main");
const isMounted = ref(true);

const appState = computed(() => ({
  totalDestroyed: totalDestroyed.value,
  gasReclaimed: gasReclaimed.value,
}));

onMounted(async () => {
  if (!isMounted.value) return;
  try {
    await loadStats();
    await loadHistory();
  } catch (_e: unknown) {
    console.warn("[graveyard] initial load failed:", _e instanceof Error ? _e.message : String(_e));
  }
});

const stopActiveTabWatch = watch(activeTab, async (tab) => {
  if (!isMounted.value) return;
  if (tab === "history") {
    try {
      await loadHistory();
    } catch (_e: unknown) {
      console.warn("[graveyard] history tab load failed:", _e instanceof Error ? _e.message : String(_e));
    }
  }
});

onUnmounted(() => {
  isMounted.value = false;
  cleanupTimers();
  stopActiveTabWatch();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./graveyard-theme.scss" as *;

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

/* ── Graveyard Hero Enhancements: Ghostly Ethereal ── */
@keyframes ghost-float {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-12px) rotate(2deg);
    opacity: 1;
  }
}
@keyframes mist-drift {
  0% {
    transform: translateX(-20px);
    opacity: 0;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    transform: translateX(20px);
    opacity: 0;
  }
}

.tombstone-scene {
  background: radial-gradient(ellipse at center, rgba(16, 185, 129, 0.08) 0%, transparent 65%);
}
.hero-stat-icon {
  animation: ghost-float 4s ease-in-out infinite;
}
.hero-stats {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
  transition: box-shadow 0.3s ease;
  &:hover {
    box-shadow: 0 0 30px rgba(16, 185, 129, 0.35);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);
}
.moon {
  box-shadow:
    0 0 24px var(--grave-warning-glow, rgba(255, 222, 89, 0.5)),
    0 0 48px var(--grave-warning-glow, rgba(255, 222, 89, 0.2));
}
.fog-1 {
  animation: mist-drift 8s ease-in-out infinite;
}
.fog-2 {
  animation: mist-drift 8s ease-in-out infinite 3s;
}
</style>
