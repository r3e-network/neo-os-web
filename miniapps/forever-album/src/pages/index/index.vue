<template>
  <view class="theme-forever-album">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="onTabChange"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
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
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { MiniAppShell, NeoCard, NeoButton, WalletPrompt } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { messages } from "@/locale/messages";
import { useAlbumPhotos } from "@/composables/useAlbumPhotos";
import { usePhotoUpload } from "@/composables/usePhotoUpload";
import AlbumGrid from "./components/AlbumGrid.vue";
import PhotoUpload from "./components/PhotoUpload.vue";
import AlbumViewer from "./components/AlbumViewer.vue";
import DecryptModal from "./components/DecryptModal.vue";

const { t } = createUseI18n(messages)();
const { address, connect } = useWallet() as WalletSDK;

const templateConfig = createTemplateConfig({
  tabs: [{ key: "album", labelKey: "albumTab", icon: "📸", default: true }],
  docFeatureCount: 3,
});

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

const sidebarItems = createSidebarItems(t, [
  { labelKey: "albumTab", value: () => photos.value.length },
  { labelKey: "sidebarEncrypted", value: () => photos.value.filter((p) => p.encrypted).length },
  { labelKey: "sidebarPublic", value: () => photos.value.filter((p) => !p.encrypted).length },
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
