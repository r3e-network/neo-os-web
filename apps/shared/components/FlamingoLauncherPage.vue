<template>
  <OfficialLauncherMiniApp
    :page-name="product.slug"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :reset-status="clearStatus"
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
import type { FlamingoProductKey } from "@shared/utils/flamingo-launcher-page";
import { useFlamingoLauncherPage } from "@shared/utils/flamingo-launcher-page";
import OfficialLauncherMiniApp from "./OfficialLauncherMiniApp.vue";

const props = defineProps<{
  productKey: FlamingoProductKey;
}>();

const {
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
} = useFlamingoLauncherPage(props.productKey);
</script>
