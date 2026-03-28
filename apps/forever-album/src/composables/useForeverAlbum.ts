/**
 * useForeverAlbum — Domain logic for the Forever Album miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Includes photo browsing, decryption, and upload functionality.
 *
 * Replaces the legacy useAlbumPhotos.ts and usePhotoUpload.ts which
 * manually wired useContractInteraction + useStatusMessage + useWallet.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
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
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useForeverAlbum({ chain, eventBus, t }: UseForeverAlbumOptions) {
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

  // ── Helpers ───────────────────────────────────────────────────────────

  const parsePhotoInfo = (raw: unknown): PhotoItem | null => {
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

  // ── Photo loading ────────────────────────────────────────────────────

  const loadPhotos = async () => {
    if (!chain.address.value) {
      photos.value = [];
      return;
    }
    loadingPhotos.value = true;
    try {
      const count = Number(
        (await chain.read("getUserPhotoCount", [
          { type: "Hash160", value: chain.address.value },
        ])) || 0,
      );
      if (!count) {
        photos.value = [];
        return;
      }
      const limit = Math.min(count, 50);
      const idsRaw = await chain.read("getUserPhotoIds", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(limit) },
      ]);
      const ids = Array.isArray(idsRaw) ? idsRaw.map((id) => String(id)).filter(Boolean) : [];
      const entries = await Promise.all(
        ids.map(async (id) => {
          const detail = await chain.read("getPhoto", [{ type: "ByteArray", value: id }]);
          return parsePhotoInfo(detail);
        }),
      );
      photos.value = entries
        .filter((entry): entry is PhotoItem => !!entry)
        .sort((a, b) => b.createdAt - a.createdAt);
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

  // ── Upload ───────────────────────────────────────────────────────────

  const openUpload = () => {
    if (!chain.address.value) return;
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

  const uploadPhotos = async () => {
    if (uploading.value || selectedImages.value.length === 0) return;
    if (!chain.address.value) return;
    if (isEncrypted.value && !password.value) {
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }

    uploading.value = true;
    try {
      await chain.ensureWallet();

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

      await chain.invoke(
        "uploadPhotos",
        [
          {
            type: "Array",
            value: payloads.map((p) => ({ type: "String", value: p })),
          } as unknown as { type: "Array"; value: string },
          {
            type: "Array",
            value: payloads.map(() => ({ type: "Boolean", value: isEncrypted.value })),
          } as unknown as { type: "Array"; value: string },
        ],
      );

      eventBus.emit("album:uploaded", { action: t("uploadSuccess") });
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
