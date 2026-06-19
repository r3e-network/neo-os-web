/**
 * useForeverAlbum — Domain logic for the Forever Album miniapp.
 *
 * STORAGE MODEL: ON-DEVICE, wallet-scoped.
 *
 * The earlier design wrote each 45KB photo as an OS-storage kernel record
 * through ctx.os.storage + ChainService. That path was broken three ways:
 *   1. EdgeClient AUTO-SUBMITTED the storage intent and the composable
 *      re-invoked the SAME intent — two wallet prompts + two duplicate paid
 *      writes per photo.
 *   2. The list read used a bare-prefix getMiniAppState (a single-key read), so
 *      the gallery was permanently empty even after a successful upload.
 *   3. A 45KB on-chain blob costs ~45 GAS in storage fees at sign time, and the
 *      mainnet storage kernel hash is an "Unknown contract" — uploads failed
 *      outright on the default network.
 *
 * On-chain 45KB photo storage is impractical (cost) and unavailable (kernel),
 * so the honest model is LOCAL-ONLY: photos live in this browser, keyed by the
 * connected wallet address. Encryption (AES-GCM, password never leaves the
 * device) still gives real privacy. Nothing is written on-chain — no wallet
 * prompt, no GAS, no kernel dependency — and the UI copy says so plainly.
 *
 * The wallet is still the album's identity: each wallet address has its own
 * device-local album, so switching wallets switches albums. Photos persist
 * across reloads in localStorage; they do NOT sync across devices.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { decryptPayload, encryptPayload } from "../utils/crypto";
import type { PhotoItem, UploadItem } from "../types";

// ============================================================================
// Constants
// ============================================================================

const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTO_BYTES = 46080; // 45 KiB
// 60 KiB exactly (60 * 1024) so the "60 KB" labels and the 1024-based size
// meter agree — the prior 60000-byte cap read as "58.6 KB" against the meter.
const MAX_TOTAL_BYTES = 61440;

/** localStorage key prefix for a wallet's device-local album. */
const ALBUM_STORE_PREFIX = "forever-album:photos:";

// ============================================================================
// Types
// ============================================================================

export interface UseForeverAlbumOptions {
  /** Chain service — used ONLY to read the connected wallet address (album id). */
  chainService: ChainService;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface StoredPhoto {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

// ============================================================================
// Helpers
// ============================================================================

/** localStorage key for a wallet's album (device-local). */
function albumStoreKey(walletAddress: string): string {
  return `${ALBUM_STORE_PREFIX}${walletAddress}`;
}

/**
 * Estimate the stored payload length for a single item. When `encrypted` is
 * false the data-URL is stored verbatim. When encrypted it is wrapped by
 * encryptPayload() into an AES-GCM JSON envelope, which inflates the base64
 * ciphertext (~4/3) and adds a fixed wrapper. Mirroring that growth keeps the
 * upload meter and gate in agreement with uploadPhotos()'s size checks.
 */
function estimatePayloadBytes(dataUrlLength: number, encrypted: boolean): number {
  if (!encrypted) return dataUrlLength;
  const dataB64 = Math.ceil((dataUrlLength + 16) / 3) * 4;
  return dataB64 + 91;
}

function normalizeStoredPhoto(value: unknown): StoredPhoto | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StoredPhoto>;
  if (!item.id || !item.data) return null;
  return {
    id: String(item.id),
    data: String(item.data),
    encrypted: Boolean(item.encrypted),
    createdAt: Number(item.createdAt || 0),
  };
}

function readAlbum(walletAddress: string): StoredPhoto[] {
  try {
    const raw = readCachedJSON<StoredPhoto[]>(albumStoreKey(walletAddress));
    if (!Array.isArray(raw)) return [];
    return raw
      .map(normalizeStoredPhoto)
      .filter((entry): entry is StoredPhoto => Boolean(entry));
  } catch {
    return [];
  }
}

function writeAlbum(walletAddress: string, photos: StoredPhoto[]): void {
  writeCachedJSON(albumStoreKey(walletAddress), photos);
}

// ============================================================================
// Composable
// ============================================================================

export function useForeverAlbum({
  chainService,
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
  // Wrong-password / invalid-payload feedback, rendered in the decrypt card.
  // (The earlier code emitted on a dead "album:error" eventBus channel, so a
  // wrong password gave the user no feedback at all.)
  const decryptError = createObservable("");

  // ── Upload state ─────────────────────────────────────────────────────
  const showUpload = createObservable(false);
  const uploading = createObservable(false);
  const uploadError = createObservable<string | null>(null);
  const selectedImages = createObservable<UploadItem[]>([]);
  const isEncrypted = createObservable(false);
  const password = createObservable("");

  // Surface the hard total-size limit as a read-only observable so the view's
  // disable gate and meter source the same number uploadPhotos() enforces.
  const maxTotalBytes: Observable = {
    get: () => MAX_TOTAL_BYTES,
    set: () => {},
    subscribe: () => () => {},
  };

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
    get: () => {
      const encrypted = isEncrypted.get();
      return selectedImages
        .get()
        .reduce((sum, item) => sum + estimatePayloadBytes(item.payloadBytes, encrypted), 0);
    },
    set: () => {},
    subscribe: (listener) => {
      const off1 = selectedImages.subscribe(listener);
      const off2 = isEncrypted.subscribe(listener);
      return () => {
        off1();
        off2();
      };
    },
  };

  // ── Photo loading (device-local) ────────────────────────────────────

  /** Load the connected wallet's device-local album, newest first. */
  const loadPhotos = async () => {
    loadingPhotos.set(true);
    try {
      const walletAddress = chainService.address.get();
      if (!walletAddress) {
        photos.set([]);
        return;
      }
      const entries = readAlbum(walletAddress).map((stored) => ({
        id: stored.id,
        data: stored.data,
        encrypted: stored.encrypted,
        createdAt: stored.createdAt,
      }));
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
      decryptError.set("");
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
    const current = viewingPhoto.get();
    if (current) {
      decryptTarget.set(current);
      decryptedPreview.set("");
      decryptError.set("");
    }
    showViewer.set(false);
    showDecrypt.set(true);
  };

  const closeDecrypt = () => {
    showDecrypt.set(false);
    decryptTarget.set(null);
    decryptedPreview.set("");
    decryptError.set("");
  };

  /**
   * Decrypt the selected encrypted photo with the supplied password. On a wrong
   * password / malformed payload the error is surfaced via the decryptError
   * observable (rendered in the decrypt card) AND rethrown so the host's
   * notify.guard errorKey also fires — the user always gets feedback.
   */
  const handleDecrypt = async (pwd: string) => {
    const target = decryptTarget.get();
    decryptError.set("");
    if (!target || !pwd) {
      const message = t("passwordRequired");
      decryptError.set(message);
      throw new Error(message);
    }
    decrypting.set(true);
    try {
      const result = await decryptPayload(target.data, pwd);
      if (!result.startsWith("data:image")) throw new Error(t("invalidPayload"));
      decryptedPreview.set(result);
    } catch (e) {
      // A failed AES-GCM decrypt (wrong password) throws an opaque DOMException;
      // map it to the localized decrypt-failed message for both surfaces.
      const message = e instanceof Error && e.message === t("invalidPayload")
        ? e.message
        : t("decryptFailed");
      decryptError.set(message);
      throw new Error(message);
    } finally {
      decrypting.set(false);
    }
  };

  // ── Upload (device-local) ──────────────────────────────────────────

  const openUpload = () => {
    showUpload.set(true);
    selectedImages.set([]);
    isEncrypted.set(false);
    password.set("");
    uploadError.set(null);
  };

  const closeUpload = () => {
    showUpload.set(false);
    uploadError.set(null);
  };

  const removeImage = (id: string) => {
    uploadError.set(null);
    selectedImages.set(selectedImages.get().filter((item) => item.id !== id));
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(file);
    });

  /**
   * Read browser File objects, convert to data URLs, and append as upload items.
   * Rejections (max-photos / too-large) are surfaced on the rendered uploadError
   * observable — the earlier code emitted them on a dead eventBus channel, so an
   * oversized image silently vanished from the selection.
   */
  const addFiles = async (files: File[] | FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return [];
    uploadError.set(null);
    const availableSlots = Math.max(0, MAX_PHOTOS_PER_UPLOAD - selectedImages.get().length);
    if (availableSlots === 0) {
      uploadError.set(t("maxPhotosReached"));
      return [];
    }
    const additions: UploadItem[] = [];
    let rejectedTooLarge = false;
    for (const file of list.slice(0, availableSlots)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl.length > MAX_PHOTO_BYTES) {
          rejectedTooLarge = true;
          continue;
        }
        additions.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl,
          size: file.size,
          payloadBytes: dataUrl.length,
        });
      } catch (e) {
        console.warn("[forever-album] failed to read file:", e instanceof Error ? e.message : String(e));
      }
    }
    if (additions.length > 0) {
      selectedImages.set([...selectedImages.get(), ...additions]);
    }
    // Surface a too-large rejection (only when nothing else masked it).
    if (rejectedTooLarge) uploadError.set(t("imageTooLarge"));
    if (list.length > availableSlots) uploadError.set(t("maxPhotosReached"));
    return additions;
  };

  /**
   * Save the selected photos into the wallet's device-local album. Encrypted
   * photos are stored as AES-GCM ciphertext only. No on-chain write, no wallet
   * prompt, no GAS — the album lives in this browser.
   */
  const uploadPhotos = async () => {
    if (uploading.get() || selectedImages.get().length === 0) return;
    if (isEncrypted.get() && !password.get()) {
      const message = t("passwordRequired");
      uploadError.set(message);
      throw new Error(message);
    }

    uploading.set(true);
    uploadError.set(null);
    try {
      const walletAddress = chainService.address.get() || (await chainService.ensureWallet());
      if (!walletAddress) throw new Error(t("connectPromptTitle"));

      const records: StoredPhoto[] = [];
      let totalSize = 0;
      const createdAt = Date.now();
      for (const [index, item] of selectedImages.get().entries()) {
        const payload = isEncrypted.get()
          ? await encryptPayload(item.dataUrl, password.get())
          : item.dataUrl;
        if (payload.length > MAX_PHOTO_BYTES) throw new Error(t("encryptedTooLarge"));
        totalSize += payload.length;
        if (totalSize > MAX_TOTAL_BYTES) throw new Error(t("totalTooLarge"));
        records.push({
          id: `${createdAt}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          data: payload,
          encrypted: isEncrypted.get(),
          createdAt: createdAt + index,
        });
      }

      // Persist atomically: append to the existing album and write once. A
      // device-local write either fully succeeds or throws — no partial state.
      const existing = readAlbum(walletAddress);
      writeAlbum(walletAddress, [...existing, ...records]);

      eventBus.emit("album:uploaded", { action: t("uploadSuccess") });
      uploadError.set(null);
      closeUpload();
      selectedImages.set([]);
      await loadPhotos();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("uploadFailed");
      uploadError.set(message);
      throw e;
    } finally {
      uploading.set(false);
    }
  };

  /** Delete a photo from the wallet's device-local album. */
  const deletePhoto = async (id: string) => {
    const walletAddress = chainService.address.get();
    if (!walletAddress || !id) return;
    const remaining = readAlbum(walletAddress).filter((photo) => photo.id !== id);
    writeAlbum(walletAddress, remaining);
    if (viewingPhoto.get()?.id === id) closeViewer();
    await loadPhotos();
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
    decryptError,

    // ── Upload state ─────────────────────────────────────────────────
    showUpload,
    uploading,
    uploadError,
    selectedImages,
    isEncrypted,
    password,
    totalPayloadSize,
    maxTotalBytes,

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
    addFiles,
    removeImage,
    uploadPhotos,
    deletePhoto,
  };
}

export type UseForeverAlbumReturn = ReturnType<typeof useForeverAlbum>;
