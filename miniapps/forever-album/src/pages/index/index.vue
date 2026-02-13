<template>
  <view class="theme-forever-album">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" :status-message="status" @tab-change="onTabChange">
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <view class="header">
            <text class="title">{{ t("title") }}</text>
            <text class="subtitle">{{ t("subtitle") }}</text>
          </view>

          <NeoCard v-if="!address" variant="warning" class="connect-card">
            <view class="connect-card__content">
              <text class="connect-card__title">{{ t("connectPromptTitle") }}</text>
              <text class="connect-card__desc">{{ t("connectPromptDesc") }}</text>
              <NeoButton size="sm" variant="primary" @click="openWalletPrompt">
                {{ t("connectWallet") }}
              </NeoButton>
            </view>
          </NeoCard>

          <AlbumGrid :t="t" :photos="photos" :loading="loadingPhotos" @view="viewPhoto" @upload="openUpload" />

          <view class="helper-note">
            <text>{{ t("tapToSelect") }}</text>
          </view>

          <AlbumViewer :t="t" :visible="showViewer" :photo="viewingPhoto" @close="closeViewer" @decrypt="openDecrypt" />

          <WalletPrompt :visible="showWalletPrompt" @close="closeWalletPrompt" @connect="handleConnect" />
        </ErrorBoundary>
      </template>

      <template #operation>
        <PhotoUpload
          :t="t"
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
          :t="t"
          :visible="showDecrypt"
          :decrypting="decrypting"
          :preview="decryptedPreview"
          @close="closeDecrypt"
          @decrypt="handleDecrypt"
          @preview="previewDecrypted"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { MiniAppTemplate, NeoCard, NeoButton, WalletPrompt, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { useI18n } from "@/composables/useI18n";
import { useAlbumPhotos } from "@/composables/useAlbumPhotos";
import { usePhotoUpload } from "@/composables/usePhotoUpload";
import AlbumGrid from "./components/AlbumGrid.vue";
import PhotoUpload from "./components/PhotoUpload.vue";
import AlbumViewer from "./components/AlbumViewer.vue";
import DecryptModal from "./components/DecryptModal.vue";

const { t } = useI18n();
const { address, connect } = useWallet() as WalletSDK;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "album", labelKey: "albumTab", icon: "📸", default: true },
    { key: "docs", labelKey: "docsTab", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const activeTab = ref("album");
const showWalletPrompt = ref(false);

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

const sidebarItems = computed(() => [
  { label: t("albumTab"), value: photos.value.length },
  { label: t("sidebarEncrypted"), value: photos.value.filter((p) => p.encrypted).length },
  { label: t("sidebarPublic"), value: photos.value.filter((p) => !p.encrypted).length },
]);

const onTabChange = (tabId: string) => {
  if (tabId === "docs") {
    uni.navigateTo({ url: "/pages/docs/index" });
  } else {
    activeTab.value = tabId;
  }
};

const { handleBoundaryError } = useHandleBoundaryError("forever-album");
const resetAndReload = async () => {
  await loadPhotos();
};

const handleConnect = async () => {
  try {
    await connect();
    showWalletPrompt.value = false;
  } catch {
    showWalletPrompt.value = false;
  }
};
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./forever-album-theme.scss";

:global(page) {
  background: var(--bg-primary);
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
</style>
