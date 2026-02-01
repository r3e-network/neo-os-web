<template>
  <ResponsiveLayout 
    class="theme-forever-album" 
    :tabs="navTabs" 
    :active-tab="activeTab"
    :desktop-breakpoint="1024"
    show-top-nav
    @tab-change="onTabChange"
  >
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <view class="album-container">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

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

      <AlbumGrid
        :t="t"
        :photos="photos"
        :loading="loadingPhotos"
        @view="viewPhoto"
        @upload="openUpload"
      />

      <view class="helper-note">
        <text>{{ t("tapToSelect") }}</text>
      </view>
    </view>

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

    <AlbumViewer
      :t="t"
      :visible="showViewer"
      :photo="viewingPhoto"
      @close="closeViewer"
      @decrypt="openDecrypt"
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

    <WalletPrompt :visible="showWalletPrompt" @close="closeWalletPrompt" @connect="handleConnect" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { ResponsiveLayout, NeoCard, NeoButton, WalletPrompt, ChainWarning } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { useCrypto } from "@shared/composables";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import AlbumGrid from "./components/AlbumGrid.vue";
import PhotoUpload from "./components/PhotoUpload.vue";
import AlbumViewer from "./components/AlbumViewer.vue";
import DecryptModal from "./components/DecryptModal.vue";

const { t } = useI18n();
const { address, connect, invokeRead, invokeContract, chainType, getContractAddress } = useWallet() as WalletSDK;
const { encryptPayload, decryptPayload } = useCrypto();

const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTO_BYTES = 45000;
const MAX_TOTAL_BYTES = 60000;

const activeTab = ref("album");
const navTabs = computed(() => [
  { id: "album", icon: "archive", label: t("albumTab") },
  { id: "docs", icon: "book", label: t("docsTab") },
]);

const onTabChange = (tabId: string) => {
  if (tabId === "docs") {
    uni.navigateTo({ url: "/pages/docs/index" });
  } else {
    activeTab.value = tabId;
  }
};

const contractAddress = ref<string | null>(null);
const loadingPhotos = ref(false);

interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

interface UploadItem {
  id: string;
  dataUrl: string;
  size: number;
}

const photos = ref<PhotoItem[]>([]);
const showUpload = ref(false);
const selectedImages = ref<UploadItem[]>([]);
const isEncrypted = ref(false);
const password = ref("");
const uploading = ref(false);

const showViewer = ref(false);
const viewingPhoto = ref<PhotoItem | null>(null);
const showDecrypt = ref(false);
const decryptTarget = ref<PhotoItem | null>(null);
const decrypting = ref(false);
const decryptedPreview = ref("");

const showWalletPrompt = ref(false);

const totalPayloadSize = computed(() => selectedImages.value.reduce((sum, item) => sum + item.size, 0));

const openWalletPrompt = () => showWalletPrompt.value = true;
const closeWalletPrompt = () => showWalletPrompt.value = false;

const handleConnect = async () => {
  try {
    await connect();
    showWalletPrompt.value = false;
  } catch {
    showWalletPrompt.value = false;
  }
};

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) throw new Error(t("wrongChain"));
  if (!contractAddress.value) contractAddress.value = await getContractAddress();
  if (!contractAddress.value) throw new Error(t("missingContract"));
  return contractAddress.value;
};

const parsePhotoInfo = (raw: any): PhotoItem | null => {
  if (!Array.isArray(raw) || raw.length < 5) return null;
  const [photoId, _owner, encrypted, data, createdAt] = raw;
  if (!photoId || !data) return null;
  return {
    id: String(photoId),
    data: String(data),
    encrypted: Boolean(encrypted),
    createdAt: Number(createdAt || 0),
  };
};

const loadPhotos = async () => {
  if (!address.value) {
    photos.value = [];
    return;
  }
  loadingPhotos.value = true;
  try {
    const contract = await ensureContractAddress();
    const countRes = await invokeRead({
      contractAddress: contract,
      operation: "getUserPhotoCount",
      args: [{ type: "Hash160", value: address.value }],
    });
    const count = Number(parseInvokeResult(countRes) || 0);
    if (!count) {
      photos.value = [];
      return;
    }
    const limit = Math.min(count, 50);
    const idsRes = await invokeRead({
      contractAddress: contract,
      operation: "getUserPhotoIds",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(limit) },
      ],
    });
    const idsRaw = parseInvokeResult(idsRes);
    const ids = Array.isArray(idsRaw) ? idsRaw.map((id) => String(id)).filter(Boolean) : [];
    const entries = await Promise.all(
      ids.map(async (id) => {
        const detailRes = await invokeRead({
          contractAddress: contract,
          operation: "getPhoto",
          args: [{ type: "ByteArray", value: id }],
        });
        return parsePhotoInfo(parseInvokeResult(detailRes));
      })
    );
    photos.value = entries.filter((entry): entry is PhotoItem => !!entry).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e: any) {
    uni.showToast({ title: e?.message || t("loadFailed"), icon: "none" });
  } finally {
    loadingPhotos.value = false;
  }
};

const openUpload = async () => {
  if (!address.value) {
    openWalletPrompt();
    return;
  }
  showUpload.value = true;
  selectedImages.value = [];
  isEncrypted.value = false;
  password.value = "";
};

const closeUpload = () => showUpload.value = false;

const chooseImages = () => {
  const remaining = MAX_PHOTOS_PER_UPLOAD - selectedImages.value.length;
  if (remaining <= 0) {
    uni.showToast({ title: t("maxPhotosReached"), icon: "none" });
    return;
  }
  uni.chooseImage({
    count: remaining,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: async (res) => {
      const paths = res.tempFilePaths || [];
      for (const path of paths) {
        const dataUrl = await readImageAsDataUrl(path);
        const size = dataUrl.length;
        if (size > MAX_PHOTO_BYTES) {
          uni.showToast({ title: t("imageTooLarge"), icon: "none" });
          continue;
        }
        const nextTotal = totalPayloadSize.value + size;
        if (nextTotal > MAX_TOTAL_BYTES) {
          uni.showToast({ title: t("totalTooLarge"), icon: "none" });
          break;
        }
        selectedImages.value.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          dataUrl,
          size,
        });
      }
    },
  });
};

const removeImage = (id: string) => {
  selectedImages.value = selectedImages.value.filter((item) => item.id !== id);
};

const readImageAsDataUrl = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    uni.getImageInfo({
      src: path,
      success: (info) => {
        const mime = resolveMimeType(info?.type, path);
        uni.getFileSystemManager().readFile({
          filePath: path,
          encoding: "base64",
          success: (res) => resolve(`data:${mime};base64,${res.data}`),
          fail: reject,
        });
      },
      fail: reject,
    });
  });

const resolveMimeType = (type: string | undefined, path: string) => {
  const ext = (type || path.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

const uploadPhotos = async () => {
  if (uploading.value || selectedImages.value.length === 0) return;
  if (!address.value) {
    openWalletPrompt();
    return;
  }
  if (isEncrypted.value && !password.value) {
    uni.showToast({ title: t("passwordRequired"), icon: "none" });
    return;
  }

  uploading.value = true;
  try {
    const contract = await ensureContractAddress();
    const payloads: string[] = [];
    let totalSize = 0;
    for (const item of selectedImages.value) {
      const payload = isEncrypted.value ? await encryptPayload(item.dataUrl, password.value) : item.dataUrl;
      if (payload.length > MAX_PHOTO_BYTES) throw new Error(t("encryptedTooLarge"));
      totalSize += payload.length;
      if (totalSize > MAX_TOTAL_BYTES) throw new Error(t("totalTooLarge"));
      payloads.push(payload);
    }

    await invokeContract({
      contractAddress: contract,
      operation: "uploadPhotos",
      args: [
        { type: "Array", value: payloads.map((p) => ({ type: "String", value: p })) },
        { type: "Array", value: payloads.map(() => ({ type: "Boolean", value: isEncrypted.value })) },
      ],
    });

    uni.showToast({ title: t("uploadSuccess"), icon: "success" });
    closeUpload();
    selectedImages.value = [];
    await loadPhotos();
  } catch (e: any) {
    uni.showToast({ title: e?.message || t("uploadFailed"), icon: "none" });
  } finally {
    uploading.value = false;
  }
};

const viewPhoto = (photo: PhotoItem) => {
  if (photo.encrypted) {
    decryptTarget.value = photo;
    decryptedPreview.value = "";
    showDecrypt.value = true;
    return;
  }
  viewingPhoto.value = photo;
  showViewer.value = true;
};

const closeViewer = () => {
  showViewer.value = false;
  viewingPhoto.value = null;
};

const openDecrypt = () => {
  showViewer.value = false;
  showDecrypt.value = true;
};

const closeDecrypt = () => {
  showDecrypt.value = false;
  decryptTarget.value = null;
  decryptedPreview.value = "";
};

const handleDecrypt = async (pwd: string) => {
  if (!decryptTarget.value || !pwd) {
    uni.showToast({ title: t("passwordRequired"), icon: "none" });
    return;
  }
  decrypting.value = true;
  try {
    const result = await decryptPayload(decryptTarget.value.data, pwd);
    if (!result.startsWith("data:image")) throw new Error(t("invalidPayload"));
    decryptedPreview.value = result;
  } catch (e: any) {
    uni.showToast({ title: e?.message || t("decryptFailed"), icon: "none" });
  } finally {
    decrypting.value = false;
  }
};

const previewDecrypted = () => {
  if (!decryptedPreview.value) return;
  uni.previewImage({ urls: [decryptedPreview.value] });
};

onMounted(() => {
  if (address.value) loadPhotos();
});

watch(address, () => loadPhotos());
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@use "@shared/styles/responsive.scss" as responsive;
@import "./forever-album-theme.scss";

.album-container {
  padding: 16px;
  min-height: 100%;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  @include responsive.tablet-up {
    padding: 24px;
    gap: 20px;
  }
  
  @include responsive.desktop {
    padding: 32px;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }
}

.header {
  margin-bottom: 4px;
}

.title {
  font-size: 22px;
  font-weight: 800;
  display: block;
  letter-spacing: 0.02em;
  
  @include responsive.tablet-up {
    font-size: 26px;
  }
  
  @include responsive.desktop {
    font-size: 32px;
  }
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  
  @include responsive.desktop {
    font-size: 14px;
  }
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

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
