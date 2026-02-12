import { computed } from "vue";
import { useI18n } from "./useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";

export function useGrantVoting() {
  const { t } = useI18n();

  const { status: statusObj, setStatus: showStatus } = useStatusMessage();
  const statusMessage = computed(() => statusObj.value?.msg ?? "");
  const statusType = computed(() => statusObj.value?.type ?? "success");

  function copyLink(url: string) {
    if (!url) return;
    const uniApi = (globalThis as Record<string, unknown>)?.uni as
      | Record<string, (...args: unknown[]) => void>
      | undefined;
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
