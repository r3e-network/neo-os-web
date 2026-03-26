<template>
  <OfficialLauncherMiniApp
    page-name="neodid-passport"
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
    hero-mark="ID"
    :hero-kicker="t('heroKicker')"
    :hero-title="t('title')"
    :hero-blurb="t('heroBlurb')"
    :overview-stats="overviewStats"
    :main-cards="mainCards"
    :detail-cards="detailCards"
    :operation-title="t('bindPassport')"
    :operation-actions="operationActions"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { OfficialLauncherMiniApp } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";

const identityWorkspaceUrl = "https://neo-abstract-account.vercel.app/identity";
const neoDidStudioUrl = "https://oracle.meshmini.app/launchpad/neodid-live";
const verifierUrl = "https://oracle.meshmini.app/verifier";
const docsUrl = "https://oracle.meshmini.app/docs/neodid";
const exampleDid = "did:morpheus:neo_n3:service:neodid";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, clearStatus, handleBoundaryError } =
  createMiniApp({
    name: "neodid-passport",
    messages,
    template: {
      tabs: [
        { key: "passport", labelKey: "tabPassport", icon: "🪪", default: true },
        { key: "flows", labelKey: "tabFlows", icon: "🧬" },
      ],
      docSubtitleKey: "docsSubtitle",
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "identityRoot", value: () => t("identityRootValue") },
      { labelKey: "verifierReady", value: () => t("verifierReadyValue") },
      { labelKey: "reusableAcross", value: () => t("reusableAcrossValue") },
      { labelKey: "passportMode", value: () => t("passportModeValue") },
    ],
  });

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("identityRoot"), value: t("identityRootValue"), variant: "accent" },
  { label: t("verifierReady"), value: t("verifierReadyValue"), variant: "success" },
  { label: t("reusableAcross"), value: t("reusableAcrossValue"), variant: "erobo" },
]);

const appState = computed(() => ({
  did: exampleDid,
  identityWorkspace: identityWorkspaceUrl,
  neoDidStudio: neoDidStudioUrl,
  verifier: verifierUrl,
}));

const mainCards = computed(() => [
  {
    title: t("passportLayers"),
    variant: "erobo" as const,
    stats: [
      { label: t("identityRoot"), value: t("identityRootValue"), variant: "accent" },
      { label: t("routeOracle"), value: neoDidStudioUrl, variant: "default" },
      { label: t("routeAA"), value: identityWorkspaceUrl, variant: "default" },
    ],
  },
  {
    title: t("passportRouting"),
    variant: "erobo-neo" as const,
    paragraphs: [t("passportLayersText"), t("passportRoutingText")],
  },
]);

const detailCards = computed(() => [
  {
    title: t("routeOracle"),
    variant: "erobo" as const,
    stats: [
      { label: t("routeOracle"), value: neoDidStudioUrl, variant: "accent" },
      { label: t("routeVerifier"), value: verifierUrl, variant: "default" },
    ],
  },
  {
    title: t("routeAA"),
    variant: "erobo" as const,
    stats: [
      { label: t("routeAA"), value: identityWorkspaceUrl, variant: "accent" },
      { label: "Example DID", value: exampleDid, variant: "default" },
    ],
  },
]);

const operationActions = computed(() => [
  { label: t("openIdentityWorkspace"), variant: "primary" as const, onClick: () => openExternal(identityWorkspaceUrl) },
  { label: t("openNeoDidStudio"), variant: "secondary" as const, onClick: () => openExternal(neoDidStudioUrl) },
  { label: t("openVerifier"), variant: "secondary" as const, onClick: () => openExternal(verifierUrl) },
  { label: t("openDocs"), variant: "secondary" as const, onClick: () => openExternal(docsUrl) },
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
