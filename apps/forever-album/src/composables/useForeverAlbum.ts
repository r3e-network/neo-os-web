/**
 * useForeverAlbum — Domain logic for the Forever Album miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import type { PhotoItem } from "../types";

export interface UseForeverAlbumOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useForeverAlbum({ chain, eventBus, t }: UseForeverAlbumOptions) {
  const loadingPhotos = ref(false);
  const photos = ref<PhotoItem[]>([]);
  const showViewer = ref(false);
  const viewingPhoto = ref<PhotoItem | null>(null);
  const showDecrypt = ref(false);
  const decrypting = ref(false);
  const decryptedPreview = ref("");
  const showUpload = ref(false);
  const uploading = ref(false);

  const photosCount = computed(() => photos.value.length);
  const encryptedCount = computed(() => photos.value.filter((p) => p.encrypted).length);
  const publicCount = computed(() => photos.value.filter((p) => !p.encrypted).length);

  const parsePhotoInfo = (raw: unknown): PhotoItem | null => {
    if (!Array.isArray(raw) || raw.length < 5) return null;
    const [photoId, _owner, encrypted, data, createdAt] = raw;
    if (!photoId || !data) return null;
    return { id: String(photoId), data: String(data), encrypted: Boolean(encrypted), createdAt: Number(createdAt || 0) };
  };

  const loadPhotos = async () => {
    if (!chain.address.value) { photos.value = []; return; }
    loadingPhotos.value = true;
    try {
      const count = Number((await chain.read("getUserPhotoCount", [{ type: "Hash160", value: chain.address.value }])) || 0);
      if (!count) { photos.value = []; return; }
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
        })
      );
      photos.value = entries.filter((entry): entry is PhotoItem => !!entry).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e: unknown) {
      console.warn("[useForeverAlbum] loadPhotos failed:", e instanceof Error ? e.message : String(e));
    } finally {
      loadingPhotos.value = false;
    }
  };

  const viewPhoto = (photo: PhotoItem) => {
    if (photo.encrypted) {
      showDecrypt.value = true;
      return;
    }
    viewingPhoto.value = photo;
    showViewer.value = true;
  };

  const openUpload = () => {
    if (!chain.address.value) return;
    showUpload.value = true;
  };

  return {
    photos, loadingPhotos, showViewer, viewingPhoto, showDecrypt, decrypting,
    decryptedPreview, showUpload, uploading,
    photosCount, encryptedCount, publicCount,
    loadPhotos, viewPhoto, openUpload,
  };
}

export type UseForeverAlbumReturn = ReturnType<typeof useForeverAlbum>;
