<template>
  <div class="album-play-area">
    <div class="hero-container">
      <HeroSection variant="erobo" icon="camera" compact>
        <template #background>
          <div class="photo-grid-scene" aria-hidden="true">
            <div class="photo-thumb" v-for="i in 6" :key="i" :class="`thumb-${i}`" />
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">{{ photosCount }}</span>
              <span class="hero-stat-label">{{ t("albumTab") }}</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">{{ encryptedCount }}</span>
              <span class="hero-stat-label">{{ t("sidebarEncrypted") }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <div class="header">
      <span class="title">{{ t("title") }}</span>
      <span class="subtitle">{{ t("subtitle") }}</span>
    </div>

    <AlbumGrid :photos="photos" :loading="loadingPhotos" @view="handleViewPhoto" @upload="handleOpenUpload" />

    <div class="helper-note">
      <span>{{ t("tapToSelect") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import AlbumGrid from "./pages/index/components/AlbumGrid.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const photos = computed(() => (props.state.photos?.value ?? []) as unknown[]);
const photosCount = computed(() => Number(props.state.photosCount?.value ?? 0));
const encryptedCount = computed(() => Number(props.state.encryptedCount?.value ?? 0));
const loadingPhotos = computed(() => Boolean(props.state.loadingPhotos?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleViewPhoto = async (photo: unknown) => {
  const handler = actions.get("viewPhoto");
  if (handler) await handler(photo);
};

const handleOpenUpload = async () => {
  const handler = actions.get("openUpload");
  if (handler) await handler();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/forever-album-theme.scss" as *;

.album-play-area { display: flex; flex-direction: column; gap: 24px; padding: 20px 12px; min-height: 300px; }
.hero-container { background: radial-gradient(ellipse at center, rgba(180, 140, 255, 0.1) 0%, transparent 70%); }
.photo-grid-scene { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 16px; height: 100px; background: linear-gradient(180deg, rgba(180, 140, 255, 0.04) 0%, transparent 100%); }
.photo-thumb { background: linear-gradient(135deg, rgba(180, 140, 255, 0.08) 0%, rgba(255, 255, 255, 0.06) 100%); border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 1px rgba(255, 255, 255, 0.1); animation: photo-shuffle 8s ease-in-out infinite; }
.thumb-2, .thumb-4 { grid-row: span 2; }
.thumb-1 { animation-delay: 0s; } .thumb-2 { animation-delay: 0.8s; } .thumb-3 { animation-delay: 1.6s; } .thumb-4 { animation-delay: 2.4s; } .thumb-5 { animation-delay: 3.2s; } .thumb-6 { animation-delay: 4s; }
@keyframes photo-shuffle { 0%, 100% { transform: rotate(0deg) translateY(0); opacity: 0.6; } 20% { transform: rotate(-2deg) translateY(-2px); opacity: 0.8; } 40% { transform: rotate(1deg) translateY(1px); opacity: 0.5; } 60% { transform: rotate(-1deg) translateY(-1px); opacity: 0.9; } 80% { transform: rotate(2deg) translateY(2px); opacity: 0.7; } }
.hero-stats { display: flex; gap: 16px; justify-content: center; }
.hero-stat { text-align: center; padding: 8px 16px; background: linear-gradient(135deg, rgba(180, 140, 255, 0.1) 0%, rgba(140, 100, 220, 0.06) 100%); border-radius: 8px; border: 1px solid rgba(180, 140, 255, 0.15); }
.hero-stat-value { display: block; font-size: 20px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; text-shadow: 0 0 8px rgba(180, 140, 255, 0.3); }
.hero-stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-top: 2px; }
.header { margin-bottom: 4px; }
.title { font-size: 22px; font-weight: 800; display: block; letter-spacing: 0.02em; }
.subtitle { font-size: 12px; color: var(--text-secondary); }
.helper-note { font-size: 11px; color: var(--text-muted); }
@media (prefers-reduced-motion: reduce) { .photo-thumb { animation: none; } }
</style>
