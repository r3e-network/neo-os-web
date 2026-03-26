<template>
  <OfficialLauncherMiniApp
    page-name="automation-copilot"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :reset-status="resetStatus"
    hero-mode="flamingo"
    hero-mark="AI"
    :hero-kicker="t('heroKicker')"
    :hero-title="t('title')"
    :hero-blurb="t('heroBlurb')"
    :overview-stats="overviewStats"
    :main-cards="mainCards"
    :detail-cards="detailCards"
    :operation-title="t('openRunbookDocs')"
    :operation-actions="operationActions"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { OfficialLauncherMiniApp } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";

const runbookDocsUrl = "https://oracle.meshmini.app/docs/architecture";
const datafeedDocsUrl = "https://oracle.meshmini.app/docs/datafeeds";
const runtimeExplorerUrl = "https://oracle.meshmini.app/explorer";
const aaWorkspaceUrl = "https://neo-abstract-account.vercel.app/app";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, clearStatus, handleBoundaryError } =
  createMiniApp({
    name: "automation-copilot",
    messages,
    template: {
      tabs: [
        { key: "recipes", labelKey: "tabRecipes", icon: "🧠", default: true },
        { key: "routes", labelKey: "tabRoutes", icon: "🛰️" },
      ],
      docSubtitleKey: "docsSubtitle",
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "triggerLabel", value: () => t("triggerValue") },
      { labelKey: "executionLabel", value: () => t("executionValue") },
      { labelKey: "feedPriority", value: () => t("feedPriorityValue") },
      { labelKey: "controlMode", value: () => t("controlModeValue") },
    ],
  });

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("triggerLabel"), value: t("triggerValue"), variant: "accent" },
  { label: t("executionLabel"), value: t("executionValue"), variant: "success" },
  { label: t("feedPriority"), value: t("feedPriorityValue"), variant: "erobo" },
]);

const appState = computed(() => ({
  runbookDocs: runbookDocsUrl,
  datafeedDocs: datafeedDocsUrl,
  runtimeExplorer: runtimeExplorerUrl,
  aaWorkspace: aaWorkspaceUrl,
}));

const mainCards = computed(() => [
  {
    title: t("recipeTitle"),
    variant: "erobo" as const,
    paragraphs: [t("recipeText")],
  },
  {
    title: t("feedTitle"),
    variant: "erobo-neo" as const,
    paragraphs: [t("feedText")],
  },
]);

const detailCards = computed(() => [
  {
    title: t("routeDatafeed"),
    variant: "erobo" as const,
    stats: [
      { label: t("routeDatafeed"), value: datafeedDocsUrl, variant: "accent" },
      { label: t("routeOracle"), value: runtimeExplorerUrl, variant: "default" },
    ],
  },
  {
    title: t("routeAa"),
    variant: "erobo" as const,
    stats: [
      { label: t("routeAa"), value: aaWorkspaceUrl, variant: "accent" },
      { label: "Runbooks", value: runbookDocsUrl, variant: "default" },
    ],
  },
]);

const operationActions = computed(() => [
  { label: t("openRunbookDocs"), variant: "primary" as const, onClick: () => openExternal(runbookDocsUrl) },
  { label: t("openFeedDocs"), variant: "secondary" as const, onClick: () => openExternal(datafeedDocsUrl) },
  { label: t("openExplorer"), variant: "secondary" as const, onClick: () => openExternal(runtimeExplorerUrl) },
  { label: t("openAaWorkspace"), variant: "secondary" as const, onClick: () => openExternal(aaWorkspaceUrl) },
]);

function openExternal(url: string) {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function resetStatus() {
  clearStatus();
}

setStatus(t("subtitle"), "success");
</script>
