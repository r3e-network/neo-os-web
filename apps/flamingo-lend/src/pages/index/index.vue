<template><FlamingoProductMiniApp :page-name="product.slug" :product="product" :template-config="templateConfig" :app-state="appState" :t="t" :status="status" :sidebar-items="sidebarItems" :sidebar-title="sidebarTitle" :fallback-message="fallbackMessage" :handle-boundary-error="handleBoundaryError" :reset-status="clearStatus" /></template>
<script setup lang="ts">
import { computed } from "vue";
import FlamingoProductMiniApp from "@shared/components/FlamingoProductMiniApp.vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { flamingoProducts } from "@shared/utils/flamingo-products";
import { messages } from "@/locale/messages";
const product = flamingoProducts.lend;
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, clearStatus, handleBoundaryError } = createMiniApp({
  name: product.slug,
  messages,
  template: { tabs: [{ key: "overview", labelKey: "tabOverview", icon: "🔥", default: true }, { key: "details", labelKey: "tabDetails", icon: "🧭" }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "protocol", value: () => t("protocolValue") }, { labelKey: "product", value: () => t("title") }, { labelKey: "network", value: () => t("networkValue") }, { labelKey: "integrationMode", value: () => t("integrationModeValue") }],
});
const appState = computed(() => ({ officialUrl: product.officialUrl, docsUrl: product.docsUrl }));
</script>
