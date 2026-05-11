/**
 * useForeverAlbum — Domain logic for the Forever Album miniapp
 *
 * Uses OS service proxies to build contract intents, then submits those
 * intents through ChainService so uploads become real wallet-signed writes.
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
 *     storageService.list("photos:<wallet>:", 50) -> ChainService.read(...)
 *     storageService.set("photos:<wallet>:<id>", photo) -> ChainService.invoke(...)
 *     badgeService.award("album-creator", "")
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, ContractArg, TxResult } from "@shared/services";
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
  /** Chain service used to read and submit OS service intents. */
  chainService: ChainService;
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
  owner?: string;
  txid?: string;
}

interface InvocationIntent {
  contract: string;
  operation: string;
  args: ContractArg[];
}

function isInvocationIntent(value: unknown): value is InvocationIntent {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<InvocationIntent>;
  return Boolean(data.contract && data.operation && Array.isArray(data.args));
}

function walletPhotoPrefix(walletAddress: string): string {
  return `photos:${walletAddress}:`;
}

function normalizeStoredPhoto(value: unknown): StoredPhoto | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<StoredPhoto>;
  if (!item.id || !item.data) return null;
  return {
    id: String(item.id),
    data: String(item.data),
    encrypted: Boolean(item.encrypted),
    createdAt: Number(item.createdAt || 0),
    owner: item.owner ? String(item.owner) : undefined,
    txid: item.txid ? String(item.txid) : undefined,
  };
}

function normalizePhotoEntries(value: unknown): StoredPhoto[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeStoredPhoto(entry))
      .filter((entry): entry is StoredPhoto => Boolean(entry));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => normalizeStoredPhoto(entry))
      .filter((entry): entry is StoredPhoto => Boolean(entry));
  }
  return [];
}

// ============================================================================
// Composable
// ============================================================================

export function useForeverAlbum({
  chainService,
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
  const lastTx = createObservable<TxResult | null>(null);

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

  async function resolveReadIntent(value: unknown): Promise<unknown> {
    if (!isInvocationIntent(value)) return value;
    return chainService.read(value.operation, value.args, {
      scriptHash: value.contract,
    });
  }

  async function submitWriteIntent(value: unknown): Promise<TxResult | null> {
    if (!isInvocationIntent(value)) return null;
    const tx = await chainService.invoke(value.operation, value.args, {
      scriptHash: value.contract,
    });
    lastTx.set(tx);
    return tx;
  }

  /**
   * Load all wallet-scoped photos via StorageProxy.list().
   * The proxy may return either concrete data or a read intent depending on
   * environment; both paths are handled here.
   */
  const loadPhotos = async () => {
    loadingPhotos.set(true);
    try {
      const walletAddress = chainService.address.get();
      if (!walletAddress) {
        photos.set([]);
        return;
      }
      const photoMap = await resolveReadIntent(
        await storageService.list(walletPhotoPrefix(walletAddress), 50),
      );
      const entries = normalizePhotoEntries(photoMap).map((stored) => ({
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

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(file);
    });

  /**
   * Read browser File objects, convert to data URLs, and append as upload items.
   * Returns the list of items that were successfully read.
   */
  const addFiles = async (files: File[] | FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return [];
    const availableSlots = Math.max(0, MAX_PHOTOS_PER_UPLOAD - selectedImages.get().length);
    if (availableSlots === 0) {
      eventBus.emit("album:error", { message: t("maxPhotosReached") });
      return [];
    }
    const additions: UploadItem[] = [];
    for (const file of list.slice(0, availableSlots)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_PHOTO_BYTES) {
        eventBus.emit("album:error", { message: t("imageTooLarge") });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        additions.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl,
          size: file.size,
        });
      } catch (e) {
        console.warn("[forever-album] failed to read file:", e instanceof Error ? e.message : String(e));
      }
    }
    if (additions.length > 0) {
      selectedImages.set([...selectedImages.get(), ...additions]);
    }
    return additions;
  };

  /**
   * Upload photos as wallet-scoped OS storage records. Each proxy call returns
   * a contract intent and ChainService submits it through the connected wallet.
   */
  const uploadPhotos = async () => {
    if (uploading.get() || selectedImages.get().length === 0) return;
    if (isEncrypted.get() && !password.get()) {
      eventBus.emit("album:error", { message: t("passwordRequired") });
      return;
    }

    uploading.set(true);
    try {
      const walletAddress = await chainService.ensureWallet();
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
          owner: walletAddress,
        });
      }

      for (const record of records) {
        const tx = await submitWriteIntent(
          await storageService.set(`${walletPhotoPrefix(walletAddress)}${record.id}`, record),
        );
        if (tx?.txid) record.txid = tx.txid;
      }

      // Mint a lightweight album marker when the backend supports it. The
      // durable photo payload is already written above, so marker failures do
      // not hide successful uploads or block viewing.
      await nftService
        .mint({
          type: "album-upload",
          photoIds: records.map((record) => record.id),
          count: records.length,
          encrypted: isEncrypted.get(),
          createdAt,
        })
        .then(submitWriteIntent)
        .catch(() => {});

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
    lastTx,

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
  };
}

export type UseForeverAlbumReturn = ReturnType<typeof useForeverAlbum>;
