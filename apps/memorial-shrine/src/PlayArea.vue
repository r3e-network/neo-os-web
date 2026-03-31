<template>
  <div class="memorial-play-area">
    <div class="hero-container">
      <HeroSection variant="accent" compact>
        <template #background>
          <div class="candle-scene" aria-hidden="true">
            <div class="candle">
              <div class="flame"><div class="flame-inner" /></div>
              <div class="candle-body" />
            </div>
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <AppIcon name="candle" :size="28" class="hero-stat-icon" aria-hidden="true" />
              <span class="hero-stat-value">{{ memorialCount }}</span>
              <span class="hero-stat-label">{{ t("memorials") }}</span>
            </div>
            <div class="hero-stat">
              <AppIcon name="pray" :size="28" class="hero-stat-icon" aria-hidden="true" />
              <span class="hero-stat-value">{{ tributeCount }}</span>
              <span class="hero-stat-label">{{ t("myTributes") }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <div class="header" aria-hidden="true">
      <span class="title">{{ t("title") }}</span>
      <span class="tagline">{{ t("tagline") }}</span>
      <span class="subtitle">{{ t("subtitle") }}</span>
    </div>

    <div class="obituary-banner" v-if="recentObituaries.length">
      <span class="banner-title">{{ t("obituaries") }}</span>
      <div class="banner-scroll">
        <button
          v-for="ob in recentObituaries"
          :key="ob.id"
          type="button"
          class="obituary-item"
          :aria-label="ob.name"
          @click="handleOpenMemorial(ob.id)"
        >
          <span class="name">{{ ob.name }}</span>
          <span class="text">{{ ob.text }}</span>
        </button>
      </div>
    </div>

    <div v-if="memorials.length" class="memorials-grid">
      <TombstoneCard
        v-for="memorial in memorials"
        :key="memorial.id"
        :memorial="memorial"
        @click="handleOpenMemorial(memorial.id)"
      />
    </div>
    <div v-else class="empty-memorials">
      <AppIcon name="tombstone" :size="48" class="empty-icon" aria-hidden="true" />
      <p>{{ t("noMemorials") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, AppIcon } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import TombstoneCard from "./pages/index/components/TombstoneCard.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const memorials = computed(() => (props.state.memorials?.value ?? []) as Array<{ id: number; [key: string]: unknown }>);
const memorialCount = computed(() => memorials.value.length);
const tributeCount = computed(() => Number(props.state.tributeCount?.value ?? 0));
const recentObituaries = computed(() => (props.state.recentObituaries?.value ?? []) as Array<{ id: number; name: string; text: string }>);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleOpenMemorial = async (id: number) => {
  const handler = actions.get("openMemorial");
  if (handler) await handler(id);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/memorial-shrine-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap');

.memorial-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Lora', Georgia, serif;
  background: linear-gradient(180deg, #1E293B 0%, #0F172A 50%, #1A1A2E 100%);
  color: #CBD5E1;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.memorial-play-area::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 90%, rgba(245, 222, 179, 0.06) 0%, transparent 50%);
  pointer-events: none;
}

.hero-container {
  background: radial-gradient(ellipse at 50% 80%, rgba(245, 222, 179, 0.1) 0%, transparent 60%);
  position: relative;
  z-index: 1;
}

.candle-scene {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 100px;
  padding-bottom: 10px;
  background: linear-gradient(180deg, transparent, rgba(245, 222, 179, 0.04));
}

.candle { display: flex; flex-direction: column; align-items: center; }

.flame {
  width: 12px;
  height: 22px;
  background: radial-gradient(ellipse at bottom, #F5DEB3, #DAA520, transparent);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  animation: flame-flicker 2s ease-in-out infinite alternate;
  filter: blur(1px);
  box-shadow: 0 0 16px rgba(245, 222, 179, 0.5), 0 0 40px rgba(245, 222, 179, 0.2);
}

.flame-inner {
  width: 4px;
  height: 8px;
  background: #FFF8DC;
  border-radius: 50%;
  margin: 6px auto 0;
  opacity: 0.9;
}

.candle-body {
  width: 16px;
  height: 40px;
  background: linear-gradient(180deg, #FAF5FF, #E8E0D4);
  border-radius: 2px;
  margin-top: -2px;
  box-shadow: 0 4px 16px rgba(245, 222, 179, 0.15);
}

@keyframes flame-flicker {
  0%, 100% { transform: scaleY(1) rotate(-1deg); filter: brightness(1); }
  25% { transform: scaleY(1.08) rotate(1deg); filter: brightness(1.15); }
  50% { transform: scaleY(0.95) rotate(-0.5deg); filter: brightness(0.95); }
  75% { transform: scaleY(1.04) rotate(0.8deg); filter: brightness(1.1); }
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.hero-stat {
  text-align: center;
  padding: 10px 18px;
  background: rgba(245, 222, 179, 0.06);
  border-radius: 10px;
  border: 1px solid rgba(245, 222, 179, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.hero-stat-icon { display: block; font-size: 20px; margin-bottom: 4px; opacity: 0.7; }

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #F5DEB3;
  font-variant-numeric: tabular-nums;
  font-family: 'Lora', Georgia, serif;
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #94A3B8;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

.header {
  text-align: center;
  padding: 32px 16px;
  position: relative;
  z-index: 1;
}

.header .title {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #F5DEB3;
  text-shadow: 0 0 30px rgba(245, 222, 179, 0.3);
  margin-bottom: 8px;
  font-family: 'Lora', Georgia, serif;
}

.header .tagline {
  display: block;
  font-size: 16px;
  color: rgba(245, 222, 179, 0.6);
  letter-spacing: 6px;
  margin-bottom: 8px;
  font-style: italic;
}

.header .subtitle {
  display: block;
  font-size: 13px;
  color: #64748B;
}

.obituary-banner {
  background: linear-gradient(90deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.6), rgba(30, 41, 59, 0.8));
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 20px;
  border: 1px solid rgba(245, 222, 179, 0.08);
  position: relative;
  z-index: 1;
}

.obituary-banner .banner-title {
  display: block;
  font-size: 13px;
  color: #F5DEB3;
  margin-bottom: 8px;
  font-weight: 600;
  letter-spacing: 1px;
}

.obituary-banner .banner-scroll { white-space: nowrap; overflow-x: auto; }

.obituary-item {
  display: inline-block;
  margin-right: 32px;
  font-size: 12px;
  color: #94A3B8;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Lora', Georgia, serif;
  transition: color 0.2s;
}

.obituary-item:hover { color: #F5DEB3; }
.obituary-item .name { color: #CBD5E1; margin-right: 8px; }

.memorials-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.empty-memorials {
  text-align: center;
  padding: 48px 16px;
  color: #64748B;
  font-style: italic;
  position: relative;
  z-index: 1;
}
</style>
