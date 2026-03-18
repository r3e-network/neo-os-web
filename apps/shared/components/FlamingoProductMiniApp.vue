<template>
  <OfficialLauncherMiniApp
    :page-name="pageName"
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
    hero-mark="F"
    :hero-kicker="t('protocolValue')"
    :hero-title="t('title')"
    :hero-blurb="t('heroBlurb')"
    :overview-stats="overviewStats"
    :main-cards="mainCards"
    :detail-cards="detailCards"
    :operation-title="t('product')"
    :operation-actions="operationActions"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { OfficialLauncherMiniApp } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import type { FlamingoProductDefinition } from "@shared/utils/flamingo-products";

const props = defineProps<{
  pageName: string;
  product: FlamingoProductDefinition;
  templateConfig: object;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: unknown;
  sidebarItems: unknown;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  resetStatus: () => void;
}>();

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: props.t("protocol"), value: props.t("protocolValue"), variant: "accent" },
  { label: props.t("category"), value: props.t("categoryValue"), variant: "success" },
  { label: props.t("integrationMode"), value: props.t("integrationModeValue"), variant: "erobo" },
]);

const detailStats = computed<StatsDisplayItem[]>(() => [
  { label: props.t("product"), value: props.t("title"), variant: "accent" },
  { label: props.t("network"), value: props.t("networkValue"), variant: "default" },
  { label: props.t("officialUrl"), value: props.product.officialUrl, variant: "default" },
  { label: props.t("docsUrl"), value: props.product.docsUrl, variant: "default" },
]);

const mainCards = computed(() => [
  {
    title: props.t("summaryTitle"),
    variant: "erobo" as const,
    paragraphs: [props.t("summaryText")],
  },
]);

const detailCards = computed(() => [
  {
    title: props.t("tabDetails"),
    variant: "erobo" as const,
    stats: detailStats.value,
  },
  {
    title: props.t("notesTitle"),
    variant: "erobo-neo" as const,
    className: "notes-card",
    paragraphs: [props.t("notePrimary"), props.t("noteSecondary")],
  },
]);

const operationActions = computed(() => [
  { label: props.t("openOfficial"), variant: "primary" as const, onClick: () => openExternal(props.product.officialUrl) },
  { label: props.t("openProtocolHome"), variant: "secondary" as const, onClick: () => openExternal(props.product.protocolUrl) },
  { label: props.t("openDocs"), variant: "secondary" as const, onClick: () => openExternal(props.product.docsUrl) },
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
</script>
