/**
 * useForeverAlbum — Domain logic for the Forever Album miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (NFTProxy, StorageProxy, BadgeProxy) via edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getUserPhotoCount", [...])
 *     chain.read("getUserPhotoIds", [...])
 *     chain.read("getPhoto", [...])
 *     chain.invoke("uploadPhotos", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("photos:", 50)
 *     storageService.get("photo:<id>")
 *     nftService.mint({ type: "photo", ... })
 *     storageService.set("upload:batch", { payloads, encrypted })
 *     badgeService.award("album-creator", "")
 */

import { ref, computed } from "vue";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { decryptPayload, encryptPayload } from "../utils/crypto";
import type { PhotoItem, UploadItem } from "../types";

// ============================================================================
// Constants
// ============================================================================

const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTO_BYTES = 45000;
const MAX_TOTAL_BYTES = 60000;

// ============================================================================
// Types
// ============================================================================

export interface UseForeverAlbumOptions {
  /** OS NFTProxy instance from ctx.os.nft */
  nftService: NFTProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredPhoto {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useForeverAlbum({
  nftService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseForeverAlbumOptions) {
  // ── Photo browsing state ─────────────────────────────────────────────
  const loadingPhotos = ref(false);
  const photos = ref<PhotoItem[]>([]);
  const showViewer = ref(false);
  const viewingPhoto = ref<PhotoItem | null>(null);

  // ── Decryption state ─────────────────────────────────────────────────
  const showDecrypt = ref(false);
  const decryptTarget = ref<PhotoItem | null>(null);
  const decrypting = ref(false);
  const decryptedPreview = ref("");

  // ── Upload state ─────────────────────────────────────────────────────
  const showUpload = ref(false);
  const uploading = ref(false);
  const selectedImages = ref<UploadItem[]>([]);
  const isEncrypted = ref(false);
  const password = ref("");

  // ── Computed ──────────────────────────────────────────────────────────
  const photosCount = computed(() => photos.value.length);
  const encryptedCount = computed(() => photos.value.filter((p) => p.encrypted).length);
  const publicCount = computed(() => photos.value.filter((p) => !p.encrypted).length);
  const totalPayloadSize = computed(() => selectedImages.value.reduce((sum, item) => sum + item.size, 0));

  // ── Photo loading (via StorageProxy) ────────────────────────────────

  /**
   * Load all photos via StorageProxy.list().
   * The edge function handles the contract reads and returns normalized data.
   */
  const loadPhotos = async () => {
    loadingPhotos.value = true;
    try {
      const photoMap = await storageService.list("photos:", 50);
      const entries: PhotoItem[] = [];
      if (photoMap && typeof photoMap === "object") {
        for (const [, value] of Object.entries(photoMap)) {
          const stored = value as StoredPhoto;
          if (stored && stored.id && stored.data) {
            entries.push({
              id: String(stored.id),
              data: String(stored.data),
              encrypted: Boolean(stored.encrypted),
              createdAt: Number(stored.createdAt || 0),
            });
          }
        }
      }
      photos.value = entries.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.warn("[useForeverAlbum] loadPhotos failed:", e instanceof Error ? e.message : String(e));
    } finally {
      loadingPhotos.value = false;
    }
  };

  // ── Photo viewing ────────────────────────────────────────────────────

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

  // ── Decryption ───────────────────────────────────────────────────────

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
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }
    decrypting.value = true;
    try {
      const result = await decryptPayload(decryptTarget.value.data, pwd);
      if (!result.startsWith("data:image")) throw new Error(t("invalidPayload"));
      decryptedPreview.value = result;
    } catch (e) {
      eventBus.emit("album:error", {
        message: e instanceof Error ? e.message : t("decryptFailed"),
      });
    } finally {
      decrypting.value = false;
    }
  };

  // ── Upload (via NFTProxy + StorageProxy) ────────────────────────────

  const openUpload = () => {
    showUpload.value = true;
    selectedImages.value = [];
    isEncrypted.value = false;
    password.value = "";
  };

  const closeUpload = () => {
    showUpload.value = false;
  };

  const removeImage = (id: string) => {
    selectedImages.value = selectedImages.value.filter((item) => item.id !== id);
  };

  /**
   * Upload photos via NFTProxy.mint() for each photo.
   * The edge function handles the contract call for storing photo data on-chain.
   */
  const uploadPhotos = async () => {
    if (uploading.value || selectedImages.value.length === 0) return;
    if (isEncrypted.value && !password.value) {
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }

    uploading.value = true;
    try {
      const payloads: string[] = [];
      let totalSize = 0;
      for (const item of selectedImages.value) {
        const payload = isEncrypted.value
          ? await encryptPayload(item.dataUrl, password.value)
          : item.dataUrl;
        if (payload.length > MAX_PHOTO_BYTES) throw new Error(t("encryptedTooLarge"));
        totalSize += payload.length;
        if (totalSize > MAX_TOTAL_BYTES) throw new Error(t("totalTooLarge"));
        payloads.push(payload);
      }

      // Upload each photo as an NFT via the edge function
      for (const payload of payloads) {
        await nftService.mint({
          type: "photo",
          data: payload,
          encrypted: isEncrypted.value,
        });
      }

      eventBus.emit("album:uploaded", { action: t("uploadSuccess") });

      // Hint badge for album creator (fire-and-forget)
      badgeService.award("album-creator", "").catch(() => {});

      closeUpload();
      selectedImages.value = [];
      await loadPhotos();
    } catch (e) {
      eventBus.emit("album:error", {
        message: e instanceof Error ? e.message : t("uploadFailed"),
      });
      throw e;
    } finally {
      uploading.value = false;
    }
  };

  return {
    // ── Photo state ──────────────────────────────────────────────────
    photos,
    loadingPhotos,
    photosCount,
    encryptedCount,
    publicCount,

    // ── Viewer state ─────────────────────────────────────────────────
    showViewer,
    viewingPhoto,

    // ── Decrypt state ────────────────────────────────────────────────
    showDecrypt,
    decryptTarget,
    decrypting,
    decryptedPreview,

    // ── Upload state ─────────────────────────────────────────────────
    showUpload,
    uploading,
    selectedImages,
    isEncrypted,
    password,
    totalPayloadSize,

    // ── Constants ────────────────────────────────────────────────────
    MAX_PHOTOS_PER_UPLOAD,
    MAX_TOTAL_BYTES,

    // ── Actions ──────────────────────────────────────────────────────
    loadPhotos,
    viewPhoto,
    closeViewer,
    openDecrypt,
    closeDecrypt,
    handleDecrypt,
    openUpload,
    closeUpload,
    removeImage,
    uploadPhotos,
  };
}

export type UseForeverAlbumReturn = ReturnType<typeof useForeverAlbum>;
