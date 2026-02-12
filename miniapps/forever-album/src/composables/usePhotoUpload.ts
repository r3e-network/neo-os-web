import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useCrypto } from "@shared/composables";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { UploadItem } from "@/types";

const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTO_BYTES = 45000;
const MAX_TOTAL_BYTES = 60000;

export function usePhotoUpload(
  t: (key: string) => string,
  setStatus: (msg: string, type: "success" | "error") => void,
  loadPhotos: () => Promise<void>,
  openWalletPrompt: () => void
) {
  const { address, invokeContract } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress(t);
  const { encryptPayload } = useCrypto();

  const showUpload = ref(false);
  const selectedImages = ref<UploadItem[]>([]);
  const isEncrypted = ref(false);
  const password = ref("");
  const uploading = ref(false);

  const totalPayloadSize = computed(() => selectedImages.value.reduce((sum, item) => sum + item.size, 0));

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

  const closeUpload = () => (showUpload.value = false);

  const chooseImages = () => {
    const remaining = MAX_PHOTOS_PER_UPLOAD - selectedImages.value.length;
    if (remaining <= 0) {
      setStatus(t("maxPhotosReached"), "error");
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
            setStatus(t("imageTooLarge"), "error");
            continue;
          }
          const nextTotal = totalPayloadSize.value + size;
          if (nextTotal > MAX_TOTAL_BYTES) {
            setStatus(t("totalTooLarge"), "error");
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
      setStatus(t("passwordRequired"), "error");
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
        scriptHash: contract,
        operation: "uploadPhotos",
        args: [
          { type: "Array", value: payloads.map((p) => ({ type: "String", value: p })) },
          { type: "Array", value: payloads.map(() => ({ type: "Boolean", value: isEncrypted.value })) },
        ],
      });

      setStatus(t("uploadSuccess"), "success");
      closeUpload();
      selectedImages.value = [];
      await loadPhotos();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("uploadFailed")), "error");
    } finally {
      uploading.value = false;
    }
  };

  return {
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
  };
}
