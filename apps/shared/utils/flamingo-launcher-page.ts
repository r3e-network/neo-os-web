import { computed } from "vue";
import type { StatsDisplayItem } from "@shared/components";
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

  const overviewStats = computed<StatsDisplayItem[]>(() => [
    { label: t("protocol"), value: t("protocolValue"), variant: "accent" },
    { label: t("category"), value: t("categoryValue"), variant: "success" },
    { label: t("integrationMode"), value: t("integrationModeValue"), variant: "erobo" },
  ]);

  const detailStats = computed<StatsDisplayItem[]>(() => [
    { label: t("product"), value: t("title"), variant: "accent" },
    { label: t("network"), value: t("networkValue"), variant: "default" },
    { label: t("officialUrl"), value: product.officialUrl, variant: "default" },
    { label: t("docsUrl"), value: product.docsUrl, variant: "default" },
  ]);

  const mainCards = computed(() => [
    {
      title: t("summaryTitle"),
      variant: "erobo" as const,
      paragraphs: [t("summaryText")],
    },
  ]);

  const detailCards = computed(() => [
    {
      title: t("tabDetails"),
      variant: "erobo" as const,
      stats: detailStats.value,
    },
    {
      title: t("notesTitle"),
      variant: "erobo-neo" as const,
      className: "notes-card",
      paragraphs: [t("notePrimary"), t("noteSecondary")],
    },
  ]);

  function openExternal(url: string) {
    if (!url) return;
    if (typeof window !== "undefined" && window.open) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
  }

  const operationActions = computed(() => [
    { label: t("openOfficial"), variant: "primary" as const, onClick: () => openExternal(product.officialUrl) },
    { label: t("openProtocolHome"), variant: "secondary" as const, onClick: () => openExternal(product.protocolUrl) },
    { label: t("openDocs"), variant: "secondary" as const, onClick: () => openExternal(product.docsUrl) },
  ]);

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
    overviewStats,
    mainCards,
    detailCards,
    operationActions,
  };
}
