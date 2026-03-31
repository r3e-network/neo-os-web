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

.memorial-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.hero-container { background: radial-gradient(ellipse at 50% 80%, rgba(218, 165, 32, 0.1) 0%, transparent 60%); }
.candle-scene { display: flex; justify-content: center; align-items: flex-end; height: 100px; padding-bottom: 10px; background: linear-gradient(180deg, transparent, rgba(218, 165, 32, 0.04)); }
.candle { display: flex; flex-direction: column; align-items: center; }
.flame { width: 12px; height: 20px; background: radial-gradient(ellipse at bottom, var(--shrine-gold), var(--shrine-incense), transparent); border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; animation: flame-flicker 2s ease-in-out infinite alternate; filter: blur(1px); }
.flame-inner { width: 4px; height: 8px; background: var(--shrine-gold-light); border-radius: 50%; margin: 6px auto 0; opacity: 0.9; }
.candle-body { width: 16px; height: 40px; background: linear-gradient(180deg, #f5e6d3, #ddd0c0); border-radius: 2px; margin-top: -2px; box-shadow: 0 4px 16px rgba(255, 107, 53, 0.15); }
@keyframes flame-flicker { 0%, 100% { transform: scaleY(1) rotate(-1deg); filter: brightness(1); } 25% { transform: scaleY(1.08) rotate(1deg); filter: brightness(1.15); } 50% { transform: scaleY(0.95) rotate(-0.5deg); filter: brightness(0.95); } 75% { transform: scaleY(1.04) rotate(0.8deg); filter: brightness(1.1); } }

.hero-stats { display: flex; gap: 16px; justify-content: center; box-shadow: 0 0 20px rgba(218, 165, 32, 0.12); }
.hero-stat { text-align: center; padding: 8px 16px; background: rgba(218, 165, 32, 0.08); border-radius: 8px; border: 1px solid rgba(218, 165, 32, 0.15); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.hero-stat-icon { display: block; font-size: 20px; margin-bottom: 4px; }
.hero-stat-value { display: block; font-size: 20px; font-weight: 800; color: var(--shrine-gold, var(--text-primary)); font-variant-numeric: tabular-nums; }
.hero-stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--shrine-muted, var(--text-secondary)); letter-spacing: 1px; margin-top: 2px; }

.header { text-align: center; padding: 32px 16px; }
.header .title { display: block; font-size: 28px; font-weight: 700; color: var(--shrine-gold); text-shadow: 0 0 30px var(--shrine-title-glow); margin-bottom: 8px; }
.header .tagline { display: block; font-size: 16px; color: var(--shrine-gold-light); letter-spacing: 6px; margin-bottom: 8px; }
.header .subtitle { display: block; font-size: 13px; color: var(--shrine-muted); }

.obituary-banner { background: linear-gradient(90deg, var(--shrine-dark), var(--shrine-medium), var(--shrine-dark)); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; border: 1px solid var(--shrine-banner-border); }
.obituary-banner .banner-title { display: block; font-size: 13px; color: var(--shrine-gold); margin-bottom: 8px; }
.obituary-banner .banner-scroll { white-space: nowrap; overflow-x: auto; }
.obituary-item { display: inline-block; margin-right: 32px; font-size: 12px; color: var(--shrine-muted); background: none; border: none; cursor: pointer; }
.obituary-item .name { color: var(--shrine-text); margin-right: 8px; }

.memorials-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.empty-memorials { text-align: center; padding: 48px 16px; color: var(--shrine-muted); }
</style>
