import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export function useMultisigUI() {
  const { t } = createUseI18n(messages)();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "ready":
        return "✅";
      case "broadcasted":
        return "🚀";
      case "cancelled":
        return "❌";
      case "expired":
        return "⏰";
      default:
        return "📄";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return t("statusPending");
      case "ready":
        return t("statusReady");
      case "broadcasted":
        return t("statusBroadcasted");
      case "cancelled":
        return t("statusCancelled");
      case "expired":
        return t("statusExpired");
      default:
        return t("statusUnknown");
    }
  };

  const shorten = (str: string) => (str ? str.slice(0, 8) + "..." + str.slice(-6) : "");

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const tabs = computed(() => [
    { id: "home", label: t("tabHome"), icon: "home" },
    { id: "docs", label: t("tabDocs"), icon: "info" },
  ]);

  return {
    getStatusIcon,
    statusLabel,
    shorten,
    formatDate,
    tabs,
  };
}
