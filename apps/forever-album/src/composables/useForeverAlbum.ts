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

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
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
  const loadingPhotos = createObservable(false);
  const photos = createObservable<PhotoItem[]>([]);
  const showViewer = createObservable(false);
  const viewingPhoto = createObservable<PhotoItem | null>(null);

  // ── Decryption state ─────────────────────────────────────────────────
  const showDecrypt = createObservable(false);
  const decryptTarget = createObservable<PhotoItem | null>(null);
  const decrypting = createObservable(false);
  const decryptedPreview = createObservable("");

  // ── Upload state ─────────────────────────────────────────────────────
  const showUpload = createObservable(false);
  const uploading = createObservable(false);
  const selectedImages = createObservable<UploadItem[]>([]);
  const isEncrypted = createObservable(false);
  const password = createObservable("");

  // ── Computed ──────────────────────────────────────────────────────────
  const photosCount: Observable = {
    get: () => photos.get().length,
    set: () => {},
    subscribe: (listener) => photos.subscribe(listener),
  };
  const encryptedCount: Observable = {
    get: () => photos.get().filter((p) => p.encrypted).length,
    set: () => {},
    subscribe: (listener) => photos.subscribe(listener),
  };
  const publicCount: Observable = {
    get: () => photos.get().filter((p) => !p.encrypted).length,
    set: () => {},
    subscribe: (listener) => photos.subscribe(listener),
  };
  const totalPayloadSize: Observable = {
    get: () => selectedImages.get().reduce((sum, item) => sum + item.size, 0),
    set: () => {},
    subscribe: (listener) => selectedImages.subscribe(listener),
  };

  // ── Photo loading (via StorageProxy) ────────────────────────────────

  /**
   * Load all photos via StorageProxy.list().
   * The edge function handles the contract reads and returns normalized data.
   */
  const loadPhotos = async () => {
    loadingPhotos.set(true);
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
      photos.set(entries.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.warn("[useForeverAlbum] loadPhotos failed:", e instanceof Error ? e.message : String(e));
    } finally {
      loadingPhotos.set(false);
    }
  };

  // ── Photo viewing ────────────────────────────────────────────────────

  const viewPhoto = (photo: PhotoItem) => {
    if (photo.encrypted) {
      decryptTarget.set(photo);
      decryptedPreview.set("");
      showDecrypt.set(true);
      return;
    }
    viewingPhoto.set(photo);
    showViewer.set(true);
  };

  const closeViewer = () => {
    showViewer.set(false);
    viewingPhoto.set(null);
  };

  // ── Decryption ───────────────────────────────────────────────────────

  const openDecrypt = () => {
    showViewer.set(false);
    showDecrypt.set(true);
  };

  const closeDecrypt = () => {
    showDecrypt.set(false);
    decryptTarget.set(null);
    decryptedPreview.set("");
  };

  const handleDecrypt = async (pwd: string) => {
    if (!decryptTarget.get() || !pwd) {
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }
    decrypting.set(true);
    try {
      const result = await decryptPayload(decryptTarget.get().data, pwd);
      if (!result.startsWith("data:image")) throw new Error(t("invalidPayload"));
      decryptedPreview.set(result);
    } catch (e) {
      eventBus.emit("album:error", {
        message: e instanceof Error ? e.message : t("decryptFailed"),
      });
    } finally {
      decrypting.set(false);
    }
  };

  // ── Upload (via NFTProxy + StorageProxy) ────────────────────────────

  const openUpload = () => {
    showUpload.set(true);
    selectedImages.set([]);
    isEncrypted.set(false);
    password.set("");
  };

  const closeUpload = () => {
    showUpload.set(false);
  };

  const removeImage = (id: string) => {
    selectedImages.set(selectedImages.get().filter((item) => item.id !== id));
  };

  /**
   * Upload photos via NFTProxy.mint() for each photo.
   * The edge function handles the contract call for storing photo data on-chain.
   */
  const uploadPhotos = async () => {
    if (uploading.get() || selectedImages.get().length === 0) return;
    if (isEncrypted.get() && !password.get()) {
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }

    uploading.set(true);
    try {
      const payloads: string[] = [];
      let totalSize = 0;
      for (const item of selectedImages.get()) {
        const payload = isEncrypted.get()
          ? await encryptPayload(item.dataUrl, password.get())
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
          encrypted: isEncrypted.get(),
        });
      }

      eventBus.emit("album:uploaded", { action: t("uploadSuccess") });

      // Hint badge for album creator (fire-and-forget)
      badgeService.award("album-creator", "").catch(() => {});

      closeUpload();
      selectedImages.set([]);
      await loadPhotos();
    } catch (e) {
      eventBus.emit("album:error", {
        message: e instanceof Error ? e.message : t("uploadFailed"),
      });
      throw e;
    } finally {
      uploading.set(false);
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
