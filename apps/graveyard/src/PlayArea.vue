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
@import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');

.graveyard-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  background: linear-gradient(180deg, #0A0A0A 0%, #0F0F0F 40%, #111111 100%);
  color: #9CA3AF;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.graveyard-play-area::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 100%, rgba(74, 222, 128, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 10%, rgba(107, 114, 128, 0.06) 0%, transparent 30%);
  pointer-events: none;
}

.tombstone-scene {
  height: 140px;
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  position: relative;
  background: linear-gradient(180deg, rgba(15, 15, 15, 0.9), rgba(20, 20, 20, 0.95));
  border-radius: 8px;
  padding: 0 20px;
  border: 1px solid rgba(74, 222, 128, 0.08);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.moon {
  position: absolute;
  top: 15px;
  right: 30px;
  width: 40px;
  height: 40px;
  background: radial-gradient(circle at 35% 35%, #E5E7EB, #9CA3AF);
  border-radius: 50%;
  box-shadow: 0 0 24px rgba(229, 231, 235, 0.3), 0 0 60px rgba(229, 231, 235, 0.1);
  opacity: 0.8;
}

.tombstone {
  width: 50px;
  height: 80px;
  background: linear-gradient(180deg, #2A2A2A, #1A1A1A);
  border: 1px solid rgba(107, 114, 128, 0.2);
  border-radius: 25px 25px 4px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03);

  &.tombstone-1 { bottom: 0; transform: scale(0.9) rotate(-3deg); }
  &.tombstone-2 { bottom: 0; transform: scale(1.1); z-index: 3; }
  &.tombstone-3 { bottom: 0; transform: scale(0.95) rotate(2deg); }
}

.rip {
  font-size: 11px;
  color: #6B7280;
  font-weight: 700;
  letter-spacing: 2px;
  font-family: 'Creepster', cursive;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.3);
}

.hero-stats { display: flex; gap: $spacing-4; position: relative; z-index: 1; }

.hero-stat {
  flex: 1;
  text-align: center;
  padding: $spacing-4;
  border-radius: 8px;
  border: 1px solid rgba(74, 222, 128, 0.08);
  transition: background 0.2s, border-color 0.2s;
  background: linear-gradient(180deg, rgba(74, 222, 128, 0.03), rgba(0, 0, 0, 0.2));
  &:hover {
    background: linear-gradient(180deg, rgba(74, 222, 128, 0.06), rgba(0, 0, 0, 0.3));
    border-color: rgba(74, 222, 128, 0.15);
  }
}

.hero-stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
  animation: ghost-float 4s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(74, 222, 128, 0.4));
}

.hero-stat-value {
  font-size: 22px;
  font-weight: 800;
  color: #4ADE80;
  font-family: $font-mono;
  font-variant-numeric: tabular-nums;
  display: block;
  text-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
}

.hero-stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #6B7280;
  letter-spacing: 1.5px;
  margin-top: 4px;
  display: block;
}

.fog {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: linear-gradient(0deg, rgba(74, 222, 128, 0.04), transparent);
  filter: blur(12px);
  z-index: 10;
}

.fog-1 { animation: mist-drift 8s ease-in-out infinite; }
.fog-2 { animation: mist-drift 8s ease-in-out infinite 3s; opacity: 0.6; }

@keyframes ghost-float {
  0%, 100% { transform: translateY(0) rotate(-2deg); opacity: 0.7; }
  50% { transform: translateY(-12px) rotate(2deg); opacity: 1; }
}

@keyframes mist-drift {
  0% { transform: translateX(-20px); opacity: 0; }
  50% { opacity: 0.3; }
  100% { transform: translateX(20px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat-icon, .fog-1, .fog-2 { animation: none; }
}
</style>
