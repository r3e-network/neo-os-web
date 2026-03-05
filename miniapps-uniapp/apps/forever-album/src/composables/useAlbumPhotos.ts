import { ref, watch, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useCrypto } from "@shared/composables";
import { parseInvokeResult } from "@shared/utils/neo";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { PhotoItem } from "@/types";

export function useAlbumPhotos(t: (key: string) => string) {
  const { address, invokeRead } = useWallet() as WalletSDK;
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
  const { decryptPayload } = useCrypto();
  const { status, setStatus } = useStatusMessage(5000);

  const loadingPhotos = ref(false);
  const photos = ref<PhotoItem[]>([]);

  const showViewer = ref(false);
  const viewingPhoto = ref<PhotoItem | null>(null);
  const showDecrypt = ref(false);
  const decryptTarget = ref<PhotoItem | null>(null);
  const decrypting = ref(false);
  const decryptedPreview = ref("");

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

  const loadPhotos = async () => {
    if (!address.value) {
      photos.value = [];
      return;
    }
    loadingPhotos.value = true;
    try {
      const contract = await ensureContractAddress();
      const countRes = await invokeRead({
        scriptHash: contract,
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
        scriptHash: contract,
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
            scriptHash: contract,
            operation: "getPhoto",
            args: [{ type: "ByteArray", value: id }],
          });
          return parsePhotoInfo(parseInvokeResult(detailRes));
        })
      );
      photos.value = entries.filter((entry): entry is PhotoItem => !!entry).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("loadFailed")), "error");
    } finally {
      loadingPhotos.value = false;
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
      setStatus(t("passwordRequired"), "error");
      return;
    }
    decrypting.value = true;
    try {
      const result = await decryptPayload(decryptTarget.value.data, pwd);
      if (!result.startsWith("data:image")) throw new Error(t("invalidPayload"));
      decryptedPreview.value = result;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("decryptFailed")), "error");
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

  return {
    status,
    setStatus,
    loadingPhotos,
    photos,
    showViewer,
    viewingPhoto,
    showDecrypt,
    decryptTarget,
    decrypting,
    decryptedPreview,
    loadPhotos,
    viewPhoto,
    closeViewer,
    openDecrypt,
    closeDecrypt,
    handleDecrypt,
    previewDecrypted,
  };
}
