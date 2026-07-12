/**
 * Forever Album domain logic.
 *
 * Product truth:
 * - photos stay in this browser on this device;
 * - the connected wallet address is an album partition, not a signer;
 * - optional AES-GCM encryption happens before the local write;
 * - no contract call, transaction, GAS payment, platform storage, or sync occurs.
 *
 * Persistence goes through an async AlbumStore (see utils/album-store):
 * direct framework localStorage when the runtime allows it, or the
 * host<->miniapp storage bridge inside the opaque-origin embedded iframe
 * (audit fix C-4 removed the allow-same-origin grant that used to make
 * direct Web Storage work there). Every write is confirmed before the UI
 * reports it saved.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  decryptPayload,
  encryptPayload,
  estimateEncryptedPayloadLength,
  isEncryptedPayloadEnvelope,
} from "../utils/crypto";
import { resolveAlbumStore } from "../utils/album-store";
import type { AlbumStore } from "../utils/album-store";
import type { PhotoItem, UploadItem } from "../types";

// Five-at-a-time keeps the import surface calm while the larger local limits
// make the album useful beyond the obsolete 60 KB on-chain prototype ceiling.
const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_SOURCE_PHOTO_FILE_BYTES = 768 * 1024;
const MAX_SOURCE_DATA_URL_BYTES = Math.ceil(MAX_SOURCE_PHOTO_FILE_BYTES / 3) * 4 + 128;
const MAX_STORED_PHOTO_BYTES = 1_500 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_ALBUM_BYTES = 3 * 1024 * 1024;
const ALBUM_STORE_VERSION = 2;
const ALBUM_STORE_PREFIX = "photos:";
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
type SupportedImageType = "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp";

type StorageIssue = "" | "corrupt" | "quota" | "unavailable";

export interface UseForeverAlbumOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Storage lane override (tests / custom hosts). Defaults to
   * resolveAlbumStore(app.storage.local): the framework's direct localStorage
   * path when available, the host storage bridge in the embedded sandbox.
   */
  store?: AlbumStore;
}

interface StoredPhoto {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

interface StoredAlbumEnvelope {
  version: typeof ALBUM_STORE_VERSION;
  photos: StoredPhoto[];
}

interface AlbumReadResult {
  photos: StoredPhoto[];
  invalidCount: number;
}

class AlbumStorageError extends Error {
  readonly issue: Exclude<StorageIssue, "">;

  constructor(issue: Exclude<StorageIssue, "">, message: string) {
    super(message);
    this.name = "AlbumStorageError";
    this.issue = issue;
  }
}

function albumStoreKey(walletAddress: string): string {
  return `${ALBUM_STORE_PREFIX}${walletAddress}`;
}

function estimatePayloadBytes(dataUrlLength: number, encrypted: boolean): number {
  return encrypted ? estimateEncryptedPayloadLength(dataUrlLength) : dataUrlLength;
}

function startsWithBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function detectSupportedImageType(bytes: Uint8Array): SupportedImageType | null {
  if (bytes.length >= 8 && startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (bytes.length >= 3 && startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = [ascii(bytes, 8, 4)];
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      brands.push(ascii(bytes, offset, 4));
    }
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
  }
  return null;
}

function isSupportedImageDataUrl(value: string): boolean {
  const match = value.match(/^data:(image\/(?:avif|gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return false;
  const [, declaredType = "", payload = ""] = match;
  if (payload.length % 4 !== 0) return false;
  try {
    const sampleLength = Math.min(payload.length, 88);
    const sample = payload.slice(0, sampleLength - sampleLength % 4);
    const binary = atob(sample);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return detectSupportedImageType(bytes) === declaredType.toLowerCase();
  } catch {
    return false;
  }
}

function normalizeStoredPhoto(value: unknown): StoredPhoto | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<StoredPhoto>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const data = typeof item.data === "string" ? item.data : "";
  const createdAt = Number(item.createdAt);
  if (
    !id
    || !data
    || data.length > MAX_STORED_PHOTO_BYTES
    || typeof item.encrypted !== "boolean"
    || !Number.isFinite(createdAt)
    || Number.isNaN(new Date(createdAt).getTime())
  ) return null;
  if (item.encrypted ? !isEncryptedPayloadEnvelope(data) : !isSupportedImageDataUrl(data)) return null;
  return {
    id,
    data,
    encrypted: Boolean(item.encrypted),
    createdAt,
  };
}

function isStoredAlbumEnvelope(value: unknown): value is StoredAlbumEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<StoredAlbumEnvelope>;
  return candidate.version === ALBUM_STORE_VERSION && Array.isArray(candidate.photos);
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return candidate.name === "QuotaExceededError"
    || /quota|storage.*full/i.test(String(candidate.message || ""));
}

function sameEnvelope(left: unknown, right: StoredAlbumEnvelope): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function useForeverAlbum({ app, t, store }: UseForeverAlbumOptions) {
  const storage = store ?? resolveAlbumStore(app.storage.local);
  const loadingPhotos = createObservable(false);
  const photos = createObservable<PhotoItem[]>([]);
  const walletAddress = createObservable("");
  const storageIssue = createObservable<StorageIssue>("");
  const storageMessage = createObservable("");
  const storageNotice = createObservable("");

  const showViewer = createObservable(false);
  const viewingPhoto = createObservable<PhotoItem | null>(null);

  const showDecrypt = createObservable(false);
  const decryptTarget = createObservable<PhotoItem | null>(null);
  const decrypting = createObservable(false);
  const decryptedPreview = createObservable("");
  const decryptPassword = createObservable("");
  const decryptError = createObservable("");

  const processingFiles = createObservable(false);
  const uploading = createObservable(false);
  const uploadError = createObservable<string | null>(null);
  const selectedImages = createObservable<UploadItem[]>([]);
  const isEncrypted = createObservable(false);
  const password = createObservable("");
  const passwordConfirm = createObservable("");

  const readonlyNumber = (read: () => number, sources: Observable[]): Observable => ({
    get: read,
    set: () => {},
    subscribe: (listener) => {
      const cleanups = sources.map((source) => source.subscribe(listener));
      return () => cleanups.forEach((cleanup) => cleanup());
    },
  });

  const maxTotalBytes: Observable = {
    get: () => MAX_TOTAL_BYTES,
    set: () => {},
    subscribe: () => () => {},
  };
  const maxAlbumBytes: Observable = {
    get: () => MAX_ALBUM_BYTES,
    set: () => {},
    subscribe: () => () => {},
  };
  const photosCount = readonlyNumber(() => photos.get().length, [photos]);
  const encryptedCount = readonlyNumber(
    () => photos.get().filter((photo) => photo.encrypted).length,
    [photos],
  );
  const publicCount = readonlyNumber(
    () => photos.get().filter((photo) => !photo.encrypted).length,
    [photos],
  );
  const albumPayloadSize = readonlyNumber(
    () => photos.get().reduce((sum, photo) => sum + photo.data.length, 0),
    [photos],
  );
  const totalPayloadSize = readonlyNumber(
    () => selectedImages
      .get()
      .reduce(
        (sum, item) => sum + estimatePayloadBytes(item.payloadBytes, isEncrypted.get()),
        0,
      ),
    [selectedImages, isEncrypted],
  );

  function storageError(
    error: unknown,
    fallback: Exclude<StorageIssue, ""> = "unavailable",
  ): AlbumStorageError {
    if (error instanceof AlbumStorageError) return error;
    if (isQuotaError(error)) return new AlbumStorageError("quota", t("storageFull"));
    return new AlbumStorageError(fallback, t("storageUnavailable"));
  }

  function surfaceStorageError(error: unknown): AlbumStorageError {
    const normalized = storageError(error);
    storageIssue.set(normalized.issue);
    storageMessage.set(normalized.message);
    return normalized;
  }

  function clearStorageFeedback(): void {
    storageIssue.set("");
    storageMessage.set("");
  }

  async function assertStorageAvailable(): Promise<void> {
    const probeKey = `__probe__:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const token = `ok:${Math.random().toString(36).slice(2)}`;
    try {
      await storage.set(probeKey, token);
      if ((await storage.get<string>(probeKey)) !== token) {
        throw new AlbumStorageError("unavailable", t("storageUnavailable"));
      }
    } catch (error) {
      throw storageError(error);
    } finally {
      try {
        await storage.delete(probeKey);
      } catch {
        // The write/read verification above is authoritative. A failed probe
        // cleanup must not hide the original storage result.
      }
    }
  }

  async function readAlbum(address: string): Promise<AlbumReadResult> {
    const key = albumStoreKey(address);
    let entries: Record<string, unknown>;
    try {
      entries = await storage.list(key);
    } catch (error) {
      throw storageError(error);
    }
    if (!Object.prototype.hasOwnProperty.call(entries, key)) {
      // An empty list is also what the framework adapter returns when browser
      // storage is unavailable. Probe only the empty case so a quota-full album
      // remains readable and its owner can delete photos to free space.
      try {
        await assertStorageAvailable();
      } catch (error) {
        const normalized = storageError(error);
        if (normalized.issue !== "quota") throw normalized;
      }
      return { photos: [], invalidCount: 0 };
    }

    const raw = entries[key];
    const values = Array.isArray(raw)
      ? raw // v1 migration: the earlier local-only release stored a bare array.
      : isStoredAlbumEnvelope(raw)
        ? raw.photos
        : null;
    if (!values) {
      throw new AlbumStorageError("corrupt", t("albumDataDamaged"));
    }

    const normalized = values.map(normalizeStoredPhoto);
    const seenIds = new Set<string>();
    const valid = normalized.filter((photo): photo is StoredPhoto => {
      if (!photo || seenIds.has(photo.id)) return false;
      seenIds.add(photo.id);
      return true;
    });
    const invalidCount = normalized.length - valid.length;
    if (values.length > 0 && valid.length === 0) {
      throw new AlbumStorageError("corrupt", t("albumDataDamaged"));
    }
    return { photos: valid, invalidCount };
  }

  async function writeAlbum(address: string, records: StoredPhoto[]): Promise<void> {
    const key = albumStoreKey(address);
    const envelope: StoredAlbumEnvelope = {
      version: ALBUM_STORE_VERSION,
      photos: records,
    };
    try {
      await storage.set(key, envelope);
      const confirmed = await storage.get<unknown>(key);
      if (!sameEnvelope(confirmed, envelope)) {
        throw new AlbumStorageError("unavailable", t("storageWriteNotConfirmed"));
      }
    } catch (error) {
      throw storageError(error);
    }
  }

  async function deleteAlbumStore(address: string): Promise<void> {
    const key = albumStoreKey(address);
    try {
      const before = await storage.list(key);
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        await assertStorageAvailable();
        return;
      }
      await storage.delete(key);
      const remaining = await storage.list(key);
      if (Object.prototype.hasOwnProperty.call(remaining, key)) {
        throw new AlbumStorageError("unavailable", t("storageWriteNotConfirmed"));
      }
      try {
        await assertStorageAvailable();
      } catch (error) {
        const normalized = storageError(error);
        // The exact key existed before and is gone now. A quota-only probe
        // failure can be caused by other site data and does not undo deletion.
        if (normalized.issue !== "quota") throw normalized;
      }
    } catch (error) {
      throw storageError(error);
    }
  }

  let loadSequence = 0;
  let draftSequence = 0;
  let decryptSequence = 0;

  const cancelDecryptWork = () => {
    decryptSequence += 1;
    decrypting.set(false);
  };

  /** Load the active wallet partition without ever showing the previous wallet's photos. */
  const loadPhotos = async () => {
    const sequence = ++loadSequence;
    const address = app.wallet.address() || "";
    const identityChanged = walletAddress.get() !== address;
    walletAddress.set(address);
    if (identityChanged) photos.set([]);
    if (!address) {
      photos.set([]);
      storageNotice.set("");
      clearStorageFeedback();
      loadingPhotos.set(false);
      return;
    }

    loadingPhotos.set(true);
    try {
      const result = await readAlbum(address);
      if (sequence !== loadSequence || app.wallet.address() !== address) return;
      photos.set(
        result.photos
          .map((stored) => ({ ...stored }))
          .sort((left, right) => right.createdAt - left.createdAt),
      );
      storageNotice.set(
        result.invalidCount > 0
          ? t("albumPartiallyRecovered", { count: result.invalidCount })
          : "",
      );
      clearStorageFeedback();
    } catch (error) {
      if (sequence !== loadSequence || app.wallet.address() !== address) return;
      photos.set([]);
      throw surfaceStorageError(error);
    } finally {
      if (sequence === loadSequence) loadingPhotos.set(false);
    }
  };

  /** Clear every identity-sensitive draft/view before loading a new wallet partition. */
  const handleWalletChange = async (options: { preserveDraft?: boolean } = {}) => {
    loadSequence += 1;
    draftSequence += 1;
    cancelDecryptWork();
    walletAddress.set(app.wallet.address() || "");
    photos.set([]);
    if (!options.preserveDraft) {
      selectedImages.set([]);
      password.set("");
      passwordConfirm.set("");
      uploadError.set(null);
    }
    viewingPhoto.set(null);
    showViewer.set(false);
    decryptTarget.set(null);
    decryptPassword.set("");
    decryptedPreview.set("");
    decryptError.set("");
    showDecrypt.set(false);
    storageNotice.set("");
    clearStorageFeedback();
    await loadPhotos();
  };

  const viewPhoto = (photo: PhotoItem) => {
    cancelDecryptWork();
    decryptedPreview.set("");
    decryptError.set("");
    decryptPassword.set("");
    if (photo.encrypted) {
      viewingPhoto.set(null);
      showViewer.set(false);
      decryptTarget.set(photo);
      showDecrypt.set(true);
      return;
    }
    viewingPhoto.set(photo);
    showViewer.set(true);
  };

  const closeViewer = () => {
    cancelDecryptWork();
    showViewer.set(false);
    viewingPhoto.set(null);
    decryptedPreview.set("");
  };

  const openDecrypt = () => {
    const current = viewingPhoto.get();
    if (!current) return;
    cancelDecryptWork();
    decryptTarget.set(current);
    decryptPassword.set("");
    decryptedPreview.set("");
    decryptError.set("");
    showViewer.set(false);
    showDecrypt.set(true);
  };

  const closeDecrypt = () => {
    cancelDecryptWork();
    showDecrypt.set(false);
    decryptTarget.set(null);
    decryptPassword.set("");
    decryptedPreview.set("");
    decryptError.set("");
  };

  const handleDecrypt = async (pwd: string) => {
    if (decrypting.get()) throw new Error(t("decryptInProgress"));
    const target = decryptTarget.get();
    decryptError.set("");
    if (!target || !pwd) {
      const message = t("passwordRequired");
      decryptError.set(message);
      throw new Error(message);
    }
    const sequence = ++decryptSequence;
    const requestedWallet = app.wallet.address() || "";
    decrypting.set(true);
    try {
      const result = await decryptPayload(target.data, pwd);
      if (
        sequence !== decryptSequence
        || (app.wallet.address() || "") !== requestedWallet
        || decryptTarget.get()?.id !== target.id
      ) {
        throw new Error(t("decryptContextChanged"));
      }
      if (!isSupportedImageDataUrl(result)) throw new Error(t("invalidPayload"));
      decryptedPreview.set(result);
      viewingPhoto.set(target);
      decryptTarget.set(null);
      decryptPassword.set("");
      showDecrypt.set(false);
      showViewer.set(true);
    } catch (error) {
      if (
        sequence !== decryptSequence
        || (app.wallet.address() || "") !== requestedWallet
        || decryptTarget.get()?.id !== target.id
      ) {
        throw new Error(t("decryptContextChanged"));
      }
      const raw = error instanceof Error ? error.message : "";
      const message = raw === t("invalidPayload") || raw.startsWith("Invalid payload format")
        ? t("invalidPayload")
        : raw.includes("Crypto API not available")
          ? t("cryptoUnavailable")
          : t("decryptFailed");
      decryptError.set(message);
      throw new Error(message);
    } finally {
      if (sequence === decryptSequence) decrypting.set(false);
    }
  };

  const removeImage = (id: string) => {
    if (uploading.get() || processingFiles.get()) {
      uploadError.set(t(uploading.get() ? "saveInProgress" : "fileReadInProgress"));
      return false;
    }
    uploadError.set(null);
    selectedImages.set(selectedImages.get().filter((item) => item.id !== id));
    return true;
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result);
        else reject(new Error("read failed"));
      };
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsArrayBuffer(blob);
    });

  const detectFileImageType = async (file: File): Promise<SupportedImageType | null> => {
    const header = new Uint8Array(await readBlobAsArrayBuffer(file.slice(0, 64)));
    return detectSupportedImageType(header);
  };

  const addFiles = async (files: File[] | FileList) => {
    if (uploading.get() || processingFiles.get()) {
      uploadError.set(t(uploading.get() ? "saveInProgress" : "fileReadInProgress"));
      return [];
    }
    const list = Array.from(files);
    if (list.length === 0) return [];
    uploadError.set(null);

    const existing = selectedImages.get();
    const availableSlots = Math.max(0, MAX_PHOTOS_PER_UPLOAD - existing.length);
    if (availableSlots === 0) {
      uploadError.set(t("maxPhotosReached"));
      return [];
    }

    const sequence = draftSequence;
    processingFiles.set(true);
    try {
      const additions: UploadItem[] = [];
      let invalidContent = false;
      let tooLarge = false;
      let totalTooLarge = false;
      let readFailed = false;
      let maxReached = false;

      for (const file of list) {
        if (additions.length >= availableSlots) {
          maxReached = true;
          break;
        }
        if (file.size > MAX_SOURCE_PHOTO_FILE_BYTES) {
          tooLarge = true;
          continue;
        }
        try {
          const detectedType = await detectFileImageType(file);
          if (sequence !== draftSequence) return [];
          if (!detectedType || !SUPPORTED_IMAGE_TYPES.has(detectedType)) {
            invalidContent = true;
            continue;
          }
          const rawDataUrl = await readFileAsDataUrl(file);
          if (sequence !== draftSequence) return [];
          const comma = rawDataUrl.indexOf(",");
          const dataUrl = comma > 0
            ? `data:${detectedType};base64,${rawDataUrl.slice(comma + 1)}`
            : "";
          if (!isSupportedImageDataUrl(dataUrl)) {
            invalidContent = true;
            continue;
          }
          if (dataUrl.length > MAX_SOURCE_DATA_URL_BYTES) {
            tooLarge = true;
            continue;
          }
          const next: UploadItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl,
            size: file.size,
            payloadBytes: dataUrl.length,
          };
          const projected = [...existing, ...additions, next].reduce(
            (sum, item) => sum + estimatePayloadBytes(item.payloadBytes, isEncrypted.get()),
            0,
          );
          if (projected > MAX_TOTAL_BYTES) {
            totalTooLarge = true;
            continue;
          }
          additions.push(next);
        } catch (error) {
          readFailed = true;
          console.warn(
            "[forever-album] failed to read file:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      if (sequence !== draftSequence) return [];
      if (additions.length > 0) selectedImages.set([...existing, ...additions]);
      if (readFailed) uploadError.set(t("imageReadFailed"));
      else if (invalidContent) uploadError.set(t("invalidImageContent"));
      else if (tooLarge) uploadError.set(t("imageTooLarge"));
      else if (totalTooLarge) uploadError.set(t("totalTooLarge"));
      else if (maxReached || list.length > availableSlots) uploadError.set(t("maxPhotosReached"));
      return additions;
    } finally {
      processingFiles.set(false);
    }
  };

  const uploadPhotos = async () => {
    if (processingFiles.get()) throw new Error(t("fileReadInProgress"));
    if (uploading.get()) throw new Error(t("saveInProgress"));
    const draft = [...selectedImages.get()];
    if (draft.length === 0) {
      const message = t("selectPhotosFirst");
      uploadError.set(message);
      throw new Error(message);
    }

    const encrypted = isEncrypted.get();
    const encryptionPassword = password.get();
    if (encrypted && !encryptionPassword) {
      const message = t("passwordRequired");
      uploadError.set(message);
      throw new Error(message);
    }
    if (encrypted && encryptionPassword !== passwordConfirm.get()) {
      const message = t("passwordMismatch");
      uploadError.set(message);
      throw new Error(message);
    }
    if (
      draft.reduce(
        (sum, item) => sum + estimatePayloadBytes(item.payloadBytes, encrypted),
        0,
      ) > MAX_TOTAL_BYTES
    ) {
      const message = t("totalTooLarge");
      uploadError.set(message);
      throw new Error(message);
    }

    uploading.set(true);
    uploadError.set(null);
    try {
      const address = app.wallet.address() || (await app.wallet.ensure());
      if (!address) throw new Error(t("connectPromptTitle"));
      walletAddress.set(address);

      const records: StoredPhoto[] = [];
      let batchSize = 0;
      const createdAt = Date.now();
      for (const [index, item] of draft.entries()) {
        const payload = encrypted
          ? await encryptPayload(item.dataUrl, encryptionPassword)
          : item.dataUrl;
        if (payload.length > MAX_STORED_PHOTO_BYTES) {
          throw new Error(t("encryptedTooLarge"));
        }
        batchSize += payload.length;
        if (batchSize > MAX_TOTAL_BYTES) throw new Error(t("totalTooLarge"));
        records.push({
          id: `${createdAt}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          data: payload,
          encrypted,
          createdAt: createdAt + index,
        });
      }

      if (app.wallet.address() !== address) throw new Error(t("walletChangedDuringSave"));
      const existing = await readAlbum(address);
      if (app.wallet.address() !== address) throw new Error(t("walletChangedDuringSave"));
      const next = [...existing.photos, ...records];
      const nextSize = next.reduce((sum, photo) => sum + photo.data.length, 0);
      if (nextSize > MAX_ALBUM_BYTES) throw new Error(t("albumFull"));
      await writeAlbum(address, next);

      // The write landed in the captured wallet partition; if the wallet
      // switched while the (now genuinely async) store round-tripped, the
      // wallet-change handler owns the UI and this save must not repaint it.
      if (app.wallet.address() !== address) return records.length;
      // Invalidate any in-flight loadPhotos started before this write so a
      // stale pre-write read cannot overwrite the fresh album below.
      loadSequence += 1;
      loadingPhotos.set(false);
      photos.set(
        next
          .map((stored) => ({ ...stored }))
          .sort((left, right) => right.createdAt - left.createdAt),
      );
      storageNotice.set(
        existing.invalidCount > 0
          ? t("albumPartiallyRecovered", { count: existing.invalidCount })
          : "",
      );
      clearStorageFeedback();
      selectedImages.set([]);
      password.set("");
      passwordConfirm.set("");
      return records.length;
    } catch (error) {
      if (error instanceof AlbumStorageError || isQuotaError(error)) {
        const normalized = surfaceStorageError(error);
        uploadError.set(normalized.message);
        throw normalized;
      }
      const message = error instanceof Error ? error.message : t("uploadFailed");
      uploadError.set(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      uploading.set(false);
    }
  };

  const deletePhoto = async (id: string) => {
    const address = app.wallet.address();
    if (!address) throw new Error(t("connectPromptTitle"));
    if (!id) throw new Error(t("photoNotFound"));
    try {
      const existing = await readAlbum(address);
      if (!existing.photos.some((photo) => photo.id === id)) {
        throw new Error(t("photoNotFound"));
      }
      if (app.wallet.address() !== address) throw new Error(t("walletChangedDuringSave"));
      const remaining = existing.photos.filter((photo) => photo.id !== id);
      await writeAlbum(address, remaining);
      // Same post-write discipline as uploadPhotos: the delete landed in the
      // captured partition; only repaint if this wallet still owns the view,
      // and invalidate stale in-flight loads first.
      if (app.wallet.address() !== address) return true;
      loadSequence += 1;
      loadingPhotos.set(false);
      photos.set(
        remaining
          .map((stored) => ({ ...stored }))
          .sort((left, right) => right.createdAt - left.createdAt),
      );
      clearStorageFeedback();
      closeViewer();
      return true;
    } catch (error) {
      if (error instanceof AlbumStorageError || isQuotaError(error)) {
        throw surfaceStorageError(error);
      }
      throw error;
    }
  };

  const resetDamagedAlbum = async () => {
    const address = app.wallet.address();
    if (!address) throw new Error(t("connectPromptTitle"));
    if (storageIssue.get() !== "corrupt") throw new Error(t("resetNotNeeded"));
    try {
      await deleteAlbumStore(address);
      // The damaged partition is gone; only clear the view if the same wallet
      // still owns it (a mid-await switch already repainted for the new one).
      if (app.wallet.address() !== address) return true;
      loadSequence += 1;
      loadingPhotos.set(false);
      photos.set([]);
      storageNotice.set("");
      clearStorageFeedback();
      closeViewer();
      closeDecrypt();
      return true;
    } catch (error) {
      throw surfaceStorageError(error);
    }
  };

  return {
    photos,
    loadingPhotos,
    photosCount,
    encryptedCount,
    publicCount,
    albumPayloadSize,
    maxAlbumBytes,
    walletAddress,
    storageIssue,
    storageMessage,
    storageNotice,

    showViewer,
    viewingPhoto,

    showDecrypt,
    decryptTarget,
    decrypting,
    decryptedPreview,
    decryptPassword,
    decryptError,

    processingFiles,
    uploading,
    uploadError,
    selectedImages,
    isEncrypted,
    password,
    passwordConfirm,
    totalPayloadSize,
    maxTotalBytes,

    MAX_PHOTOS_PER_UPLOAD,
    MAX_TOTAL_BYTES,
    MAX_ALBUM_BYTES,

    loadPhotos,
    handleWalletChange,
    viewPhoto,
    closeViewer,
    openDecrypt,
    closeDecrypt,
    handleDecrypt,
    addFiles,
    removeImage,
    uploadPhotos,
    deletePhoto,
    resetDamagedAlbum,
  };
}

export type UseForeverAlbumReturn = ReturnType<typeof useForeverAlbum>;
