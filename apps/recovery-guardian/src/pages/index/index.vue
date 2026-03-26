<template>
  <OfficialLauncherMiniApp
    page-name="recovery-guardian"
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
    hero-mark="RG"
    :hero-kicker="t('heroKicker')"
    :hero-title="t('title')"
    :hero-blurb="t('heroBlurb')"
    :overview-stats="overviewStats"
    :main-cards="mainCards"
    :detail-cards="detailCards"
    :operation-title="t('openGuardianSetup')"
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
const aaWorkspaceUrl = "https://neo-abstract-account.vercel.app/app";
const recoveryDocsUrl = "https://neo-abstract-account.vercel.app/docs";
const neoDidDocsUrl = "https://oracle.meshmini.app/docs/neodid";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, clearStatus, handleBoundaryError } =
  createMiniApp({
    name: "recovery-guardian",
    messages,
    template: {
      tabs: [
        { key: "recovery", labelKey: "tabRecovery", icon: "🛡️", default: true },
        { key: "guardians", labelKey: "tabGuardians", icon: "🧿" },
      ],
      docSubtitleKey: "docsSubtitle",
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "guardianPolicy", value: () => t("guardianPolicyValue") },
      { labelKey: "recoveryEvidence", value: () => t("recoveryEvidenceValue") },
      { labelKey: "timelockLabel", value: () => t("timelockValue") },
      { labelKey: "guardianMode", value: () => t("guardianModeValue") },
    ],
  });

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("guardianPolicy"), value: t("guardianPolicyValue"), variant: "accent" },
  { label: t("recoveryEvidence"), value: t("recoveryEvidenceValue"), variant: "success" },
  { label: t("timelockLabel"), value: t("timelockValue"), variant: "erobo" },
]);

const appState = computed(() => ({
  recoveryWorkspace: identityWorkspaceUrl,
  aaWorkspace: aaWorkspaceUrl,
  recoveryDocs: recoveryDocsUrl,
  neoDidDocs: neoDidDocsUrl,
}));

const mainCards = computed(() => [
  {
    title: t("guardianPolicyTitle"),
    variant: "erobo" as const,
    paragraphs: [t("guardianPolicyText")],
  },
  {
    title: t("ticketFlowTitle"),
    variant: "erobo-neo" as const,
    paragraphs: [t("ticketFlowText")],
  },
]);

const detailCards = computed(() => [
  {
    title: t("guardianRoute"),
    variant: "erobo" as const,
    stats: [
      { label: t("guardianRoute"), value: aaWorkspaceUrl, variant: "accent" },
      { label: t("recoveryRoute"), value: identityWorkspaceUrl, variant: "default" },
    ],
  },
  {
    title: t("ticketRoute"),
    variant: "erobo" as const,
    stats: [
      { label: t("ticketRoute"), value: neoDidDocsUrl, variant: "accent" },
      { label: "Docs", value: recoveryDocsUrl, variant: "default" },
    ],
  },
]);

const operationActions = computed(() => [
  { label: t("openGuardianSetup"), variant: "primary" as const, onClick: () => openExternal(aaWorkspaceUrl) },
  { label: t("openRecoveryWorkspace"), variant: "secondary" as const, onClick: () => openExternal(identityWorkspaceUrl) },
  { label: t("openRecoveryDocs"), variant: "secondary" as const, onClick: () => openExternal(recoveryDocsUrl) },
  { label: t("openNeoDidDocs"), variant: "secondary" as const, onClick: () => openExternal(neoDidDocsUrl) },
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
