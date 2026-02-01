import { ref } from "vue";
import { useI18n } from "./useI18n";

export function useGrantVoting() {
  const { t } = useI18n();

  const statusMessage = ref("");
  const statusType = ref<"success" | "error">("success");

  function showStatus(message: string, type: "success" | "error") {
    statusMessage.value = message;
    statusType.value = type;
    setTimeout(() => (statusMessage.value = ""), 5000);
  }

  function copyLink(url: string) {
    if (!url) return;
    const uniApi = (globalThis as any)?.uni;
    if (uniApi?.setClipboardData) {
      uniApi.setClipboardData({
        data: url,
        success: () => showStatus(t("linkCopied"), "success"),
        fail: () => showStatus(t("copyFailed"), "error"),
      });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => showStatus(t("linkCopied"), "success"))
        .catch(() => showStatus(t("copyFailed"), "error"));
      return;
    }

    showStatus(t("copyFailed"), "error");
  }

  return {
    statusMessage,
    statusType,
    showStatus,
    copyLink,
  };
}
