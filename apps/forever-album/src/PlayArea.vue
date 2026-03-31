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
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap');

.album-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 16px;
  min-height: 300px;
  font-family: 'Nunito', sans-serif;
  background:
    linear-gradient(135deg, #FAF5FF 0%, #FFF5F5 30%, #FFFBEB 60%, #FAF5FF 100%);
  color: #3F3F46;
  border-radius: 12px;
  position: relative;
}

.album-play-area::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 15% 15%, rgba(180, 140, 255, 0.06) 0%, transparent 30%),
    radial-gradient(circle at 85% 85%, rgba(255, 182, 193, 0.06) 0%, transparent 30%);
  pointer-events: none;
}

.hero-container {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 1;
}

.photo-grid-scene {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 16px;
  height: 100px;
}

.photo-thumb {
  background: linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%);
  border-radius: 3px;
  border: 3px solid #FFFFFF;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  animation: photo-shuffle 8s ease-in-out infinite;
  position: relative;
}

.photo-thumb::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(180, 140, 255, 0.08), rgba(255, 182, 193, 0.08));
  border-radius: 1px;
}

.thumb-2, .thumb-4 { grid-row: span 2; }
.thumb-1 { animation-delay: 0s; transform: rotate(-2deg); }
.thumb-2 { animation-delay: 0.8s; transform: rotate(1deg); }
.thumb-3 { animation-delay: 1.6s; transform: rotate(-1deg); }
.thumb-4 { animation-delay: 2.4s; transform: rotate(2deg); }
.thumb-5 { animation-delay: 3.2s; transform: rotate(-1.5deg); }
.thumb-6 { animation-delay: 4s; transform: rotate(0.5deg); }

@keyframes photo-shuffle {
  0%, 100% { opacity: 0.7; }
  20% { opacity: 0.9; }
  40% { opacity: 0.65; }
  60% { opacity: 0.95; }
  80% { opacity: 0.75; }
}

.hero-stats { display: flex; gap: 16px; justify-content: center; position: relative; z-index: 1; }

.hero-stat {
  text-align: center;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 800;
  color: #6D28D9;
  font-variant-numeric: tabular-nums;
  font-family: 'Nunito', sans-serif;
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #9CA3AF;
  letter-spacing: 1px;
  margin-top: 2px;
}

.header {
  margin-bottom: 4px;
  position: relative;
  z-index: 1;
}

.title {
  font-size: 24px;
  font-weight: 700;
  display: block;
  letter-spacing: 0.02em;
  color: #3F3F46;
  font-family: 'Caveat', cursive;
  font-size: 32px;
}

.subtitle {
  font-size: 13px;
  color: #9CA3AF;
  font-family: 'Nunito', sans-serif;
}

.helper-note {
  font-size: 11px;
  color: #A1A1AA;
  font-style: italic;
  font-family: 'Caveat', cursive;
  font-size: 14px;
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) { .photo-thumb { animation: none; } }
</style>
