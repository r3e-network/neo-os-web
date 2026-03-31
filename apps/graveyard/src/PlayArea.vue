<template>
  <div class="graveyard-play-area">
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
            <AppIcon name="skull" :size="28" class="hero-stat-icon" aria-hidden="true" />
            <span class="hero-stat-value">{{ totalDestroyed }}</span>
            <span class="hero-stat-label">{{ t("itemsDestroyed") }}</span>
          </div>
          <div class="hero-stat">
            <AppIcon name="gas" :size="28" class="hero-stat-icon" aria-hidden="true" />
            <span class="hero-stat-value">{{ gasReclaimed }}</span>
            <span class="hero-stat-label">{{ t("gasReclaimed") }}</span>
          </div>
        </div>
      </template>
    </HeroSection>

    <HistoryTab :history="historyItems" :forgetting-id="forgettingId" @forget="handleForget" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, AppIcon } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import HistoryTab from "./pages/index/components/HistoryTab.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const totalDestroyed = computed(() => Number(props.state.totalDestroyed?.value ?? 0));
const gasReclaimed = computed(() => Number(props.state.gasReclaimed?.value ?? 0));
const historyItems = computed(() => (props.state.history?.value ?? []) as unknown[]);
const forgettingId = computed(() => props.state.forgettingId?.value as string | null);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleForget = async (item: unknown) => {
  const handler = actions.get("forgetMemory");
  if (handler) await handler(item);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/graveyard-theme.scss" as *;

.graveyard-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

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
  box-shadow: 0 0 24px var(--grave-warning-glow, rgba(255, 222, 89, 0.5)), 0 0 48px var(--grave-warning-glow, rgba(255, 222, 89, 0.2));
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
  &.tombstone-1 { bottom: 0; transform: scale(0.9); }
  &.tombstone-2 { bottom: 0; transform: scale(1.1); z-index: 3; }
  &.tombstone-3 { bottom: 0; transform: scale(0.95); }
}

.rip { font-size: 10px; color: var(--text-secondary); font-weight: 700; letter-spacing: 1px; }

.hero-stats { display: flex; gap: $spacing-4; }

.hero-stat {
  flex: 1;
  text-align: center;
  background: var(--grave-panel-soft);
  padding: $spacing-4;
  border-radius: 8px;
  border: 1px solid var(--grave-panel-border);
  transition: background 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);
  &:hover { background: var(--grave-panel-strong); }
}

.hero-stat-icon { font-size: 24px; margin-bottom: 8px; animation: ghost-float 4s ease-in-out infinite; }
.hero-stat-value { font-size: 20px; font-weight: 800; color: var(--text-primary); font-family: $font-mono; font-variant-numeric: tabular-nums; display: block; }
.hero-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-top: 4px; display: block; }

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
.fog-1 { animation: mist-drift 8s ease-in-out infinite; }
.fog-2 { animation: mist-drift 8s ease-in-out infinite 3s; }

@keyframes ghost-float { 0%, 100% { transform: translateY(0) rotate(-2deg); opacity: 0.7; } 50% { transform: translateY(-12px) rotate(2deg); opacity: 1; } }
@keyframes mist-drift { 0% { transform: translateX(-20px); opacity: 0; } 50% { opacity: 0.3; } 100% { transform: translateX(20px); opacity: 0; } }
</style>
