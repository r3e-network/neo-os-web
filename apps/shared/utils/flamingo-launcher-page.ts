import { computed } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { createFlamingoMessages } from "./flamingo-messages";
import { flamingoProducts } from "./flamingo-products";

export type FlamingoProductKey = "swap" | "lend" | "earn" | "analytics" | "actionCenter";

export function useFlamingoLauncherPage(productKey: FlamingoProductKey) {
  const product = flamingoProducts[productKey];
  const messages = createFlamingoMessages(product);

  const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, clearStatus, handleBoundaryError } =
    createMiniApp({
      name: product.slug,
      messages,
      template: {
        tabs: [
          { key: "overview", labelKey: "tabOverview", icon: "🔥", default: true },
          { key: "details", labelKey: "tabDetails", icon: "🧭" },
        ],
        docSubtitleKey: "docsSubtitle",
        docFeatureCount: 3,
      },
      sidebarItems: [
        { labelKey: "protocol", value: () => t("protocolValue") },
        { labelKey: "product", value: () => t("title") },
        { labelKey: "network", value: () => t("networkValue") },
        { labelKey: "integrationMode", value: () => t("integrationModeValue") },
      ],
    });

  const appState = computed(() => ({
    officialUrl: product.officialUrl,
    docsUrl: product.docsUrl,
  }));

  return {
    product,
    t,
    templateConfig,
    sidebarItems,
    sidebarTitle,
    fallbackMessage,
    status,
    clearStatus,
    handleBoundaryError,
    appState,
  };
}
