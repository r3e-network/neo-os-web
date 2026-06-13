import { createDerived } from "@shared/react/context";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export function useMultisigUI() {
  const { t } = createUseI18n(messages)();

  /** Map an on-chain request status (pending/executed/cancelled) to its label. */
  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return t("statusPending");
      case "executed":
        return t("statusExecuted");
      case "cancelled":
        return t("statusCancelled");
      default:
        return t("statusUnknown");
    }
  };

  const shorten = (str: string) =>
    str ? str.slice(0, 8) + "..." + str.slice(-6) : "";

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    // Use the runtime locale (undefined) rather than a hardcoded "en" so zh
    // users see locale-formatted dates in the activity panel.
    return (
      date.toLocaleDateString(undefined) +
      " " +
      date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  };

  const tabs = createDerived(
    () => [
      { id: "home", label: t("tabHome"), icon: "home" },
      { id: "docs", label: t("tabDocs"), icon: "info" },
    ],
    [],
  );

  return {
    statusLabel,
    shorten,
    formatDate,
    tabs,
  };
}
