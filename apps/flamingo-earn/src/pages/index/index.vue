<template><FlamingoProductMiniApp :page-name="product.slug" :product="product" :template-config="templateConfig" :app-state="appState" :t="t" :status="status" :sidebar-items="sidebarItems" :sidebar-title="sidebarTitle" :fallback-message="fallbackMessage" :handle-boundary-error="handleBoundaryError" :reset-status="clearStatus" /></template>
<script setup lang="ts">
import FlamingoProductMiniApp from "@shared/components/FlamingoProductMiniApp.vue";
import { useFlamingoLauncherPage } from "@shared/utils/flamingo-launcher-page";
const { product, t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, clearStatus, handleBoundaryError, appState } = useFlamingoLauncherPage("earn");
</script>
