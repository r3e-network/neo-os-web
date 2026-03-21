<template>
  <MiniAppPage
    name="forever-album"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="onTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadPhotos"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" icon="📸" compact>
          <template #background>
            <div class="photo-grid-scene" aria-hidden="true">
              <div class="photo-thumb" v-for="i in 6" :key="i" :class="`thumb-${i}`" />
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ photos.length }}</span>
                <span class="hero-stat-label">{{ t("albumTab") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ photos.filter((p) => p.encrypted).length }}</span>
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

      <NeoCard v-if="!address" variant="warning" class="connect-card">
        <div class="connect-card__content">
          <span class="connect-card__title">{{ t("connectPromptTitle") }}</span>
          <span class="connect-card__desc">{{ t("connectPromptDesc") }}</span>
          <NeoButton size="sm" variant="primary" @click="openWalletPrompt">
            {{ t("connectWallet") }}
          </NeoButton>
        </div>
      </NeoCard>

      <AlbumGrid :photos="photos" :loading="loadingPhotos" @view="viewPhoto" @upload="openUpload" />

      <div class="helper-note">
        <span>{{ t("tapToSelect") }}</span>
      </div>

      <AlbumViewer :visible="showViewer" :photo="viewingPhoto" @close="closeViewer" @decrypt="openDecrypt" />

      <WalletPrompt :visible="showWalletPrompt" @close="closeWalletPrompt" @connect="handleConnect" />
    </template>

    <template #operation>
      <PhotoUpload
        :visible="showUpload"
        :images="selectedImages"
        :max-photos="MAX_PHOTOS_PER_UPLOAD"
        :max-bytes="MAX_TOTAL_BYTES"
        :total-size="totalPayloadSize"
        :encrypted="isEncrypted"
        :password="password"
        :uploading="uploading"
        @close="closeUpload"
        @remove="removeImage"
        @choose="chooseImages"
        @confirm="uploadPhotos"
        @update:encrypted="isEncrypted = $event"
        @update:password="password = $event"
      />

      <DecryptModal
        :visible="showDecrypt"
        :decrypting="decrypting"
        :preview="decryptedPreview"
        @close="closeDecrypt"
        @decrypt="handleDecrypt"
        @preview="previewDecrypted"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { MiniAppPage, NeoCard, NeoButton, WalletPrompt, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { messages } from "@/locale/messages";
import { useAlbumPhotos } from "@/composables/useAlbumPhotos";
import { usePhotoUpload } from "@/composables/usePhotoUpload";
import AlbumGrid from "./components/AlbumGrid.vue";
import AlbumViewer from "./components/AlbumViewer.vue";

const { address, connect } = useWallet() as WalletSDK;

const activeTab = ref("album");
const showWalletPrompt = ref(false);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "forever-album",
  messages,
  template: {
    tabs: [{ key: "album", labelKey: "albumTab", icon: "📸", default: true }],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "albumTab", value: () => photos.value.length },
    { labelKey: "sidebarEncrypted", value: () => photos.value.filter((p) => p.encrypted).length },
    { labelKey: "sidebarPublic", value: () => photos.value.filter((p) => !p.encrypted).length },
  ],
});

const {
  status,
  setStatus,
  loadingPhotos,
  photos,
  showViewer,
  viewingPhoto,
  showDecrypt,
  decrypting,
  decryptedPreview,
  loadPhotos,
  viewPhoto,
  closeViewer,
  openDecrypt,
  closeDecrypt,
  handleDecrypt,
  previewDecrypted,
} = useAlbumPhotos(t);

const openWalletPrompt = () => (showWalletPrompt.value = true);
const closeWalletPrompt = () => (showWalletPrompt.value = false);

const {
  MAX_PHOTOS_PER_UPLOAD,
  MAX_TOTAL_BYTES,
  showUpload,
  selectedImages,
  isEncrypted,
  password,
  uploading,
  totalPayloadSize,
  openUpload,
  closeUpload,
  chooseImages,
  removeImage,
  uploadPhotos,
} = usePhotoUpload(t, setStatus, loadPhotos, openWalletPrompt);

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  photosCount: photos.value.length,
  loadingPhotos: loadingPhotos.value,
  uploading: uploading.value,
}));

const onTabChange = (tabId: string) => {
  activeTab.value = tabId;
};

const handleConnect = async () => {
  try {
    await connect();
    showWalletPrompt.value = false;
  } catch (e: unknown) {
    showWalletPrompt.value = false;
    setStatus(formatErrorMessage(e, t("connectFailed")), "error");
  }
};
</script>

<style scoped lang="scss">
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./forever-album-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  margin-bottom: 20px;
}

.photo-grid-scene {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 16px;
  height: 100px;
}

.photo-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.thumb-2,
.thumb-4 {
  grid-row: span 2;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
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

.header {
  margin-bottom: 4px;
}

.title {
  font-size: 22px;
  font-weight: 800;
  display: block;
  letter-spacing: 0.02em;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.connect-card__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.connect-card__title {
  font-size: 14px;
  font-weight: 700;
}

.connect-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.helper-note {
  font-size: 11px;
  color: var(--text-muted);
}

/* ── Forever Album Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(180, 140, 255, 0.1) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes photo-shuffle {
  0%,
  100% {
    transform: rotate(0deg) translateY(0);
    opacity: 0.6;
  }
  20% {
    transform: rotate(-2deg) translateY(-2px);
    opacity: 0.8;
  }
  40% {
    transform: rotate(1deg) translateY(1px);
    opacity: 0.5;
  }
  60% {
    transform: rotate(-1deg) translateY(-1px);
    opacity: 0.9;
  }
  80% {
    transform: rotate(2deg) translateY(2px);
    opacity: 0.7;
  }
}

@keyframes polaroid-glow {
  0%,
  100% {
    box-shadow: 0 2px 8px rgba(180, 140, 255, 0.08);
  }
  50% {
    box-shadow:
      0 4px 16px rgba(180, 140, 255, 0.2),
      0 0 30px rgba(180, 140, 255, 0.08);
  }
}

.photo-grid-scene {
  background: linear-gradient(180deg, rgba(180, 140, 255, 0.04) 0%, transparent 100%);
}

.photo-thumb {
  background: linear-gradient(135deg, rgba(180, 140, 255, 0.08) 0%, rgba(255, 255, 255, 0.06) 100%);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.15),
    0 0 1px rgba(255, 255, 255, 0.1);
  animation: photo-shuffle 8s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;
}

.thumb-1 {
  animation-delay: 0s;
}
.thumb-2 {
  animation-delay: 0.8s;
}
.thumb-3 {
  animation-delay: 1.6s;
}
.thumb-4 {
  animation-delay: 2.4s;
}
.thumb-5 {
  animation-delay: 3.2s;
}
.thumb-6 {
  animation-delay: 4s;
}

.hero-stat {
  background: linear-gradient(135deg, rgba(180, 140, 255, 0.1) 0%, rgba(140, 100, 220, 0.06) 100%);
  border: 1px solid rgba(180, 140, 255, 0.15);
  animation: polaroid-glow 4s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 4px 20px rgba(180, 140, 255, 0.25);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.7s;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(180, 140, 255, 0.3);
}
</style>
