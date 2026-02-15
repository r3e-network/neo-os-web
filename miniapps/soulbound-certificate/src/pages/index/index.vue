<template>
  <MiniAppPage
    name="soulbound-certificate"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="onTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <TemplateList
        :templates="templates"
        :refreshing="isRefreshing"
        :toggling-id="togglingId"
        :has-address="!!address"
        @refresh="refreshTemplates"
        @connect="connectWallet"
        @issue="openIssueModal"
        @toggle="toggleTemplate"
      />
    </template>

    <template #operation>
      <CertificateForm :loading="isCreating" @create="createTemplate" />
    </template>

    <template #tab-certificates>
      <CertificateGallery
        :certificates="certificates"
        :cert-qrs="certQrs"
        :refreshing="isRefreshingCertificates"
        :has-address="!!address"
        @refresh="refreshCertificates"
        @connect="connectWallet"
        @copy-token-id="copyTokenId"
      />
    </template>

    <template #tab-verify>
      <VerifyCertificate
        :looking-up="isLookingUp"
        :revoking="isRevoking"
        :result="lookup"
        @lookup="lookupCertificate"
        @revoke="revokeCertificate"
      />
    </template>
  </MiniAppPage>

  <IssueModal
    :visible="issueModalOpen"
    :loading="isIssuing"
    :template-id="issueTemplateId"
    @close="closeIssueModal"
    @issue="handleIssueCertificate"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { useCertificateActions } from "@/composables/useCertificateActions";
import TemplateList from "@/components/TemplateList.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "soulbound-certificate",
    messages,
    template: {
      tabs: [
        { key: "templates", labelKey: "templatesTab", icon: "\u{1F4DC}", default: true },
        { key: "certificates", labelKey: "certificatesTab", icon: "\u{1F3C5}" },
        { key: "verify", labelKey: "verifyTab", icon: "\u2705" },
      ],
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "templatesTab", value: () => templates.value.length },
      { labelKey: "certificatesTab", value: () => certificates.value.length },
      { labelKey: "sidebarActive", value: () => templates.value.filter((tpl) => tpl.active).length },
    ],
  });

const {
  address,
  connect,
  templates,
  certificates,
  certQrs,
  refreshTemplates,
  refreshCertificates,
  isCreating,
  isIssuing,
  isLookingUp,
  isRevoking,
  togglingId,
  lookup,
  connectWallet,
  createTemplate,
  issueCertificate,
  toggleTemplate,
  lookupCertificate,
  revokeCertificate,
  copyTokenId,
} = useCertificateActions(setStatus);

const activeTab = ref("templates");
const isRefreshing = ref(false);
const issueModalOpen = ref(false);
const issueTemplateId = ref("");

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: isCreating.value,
  isRefreshing: isRefreshing.value,
  templatesCount: templates.value.length,
  certificatesCount: certificates.value.length,
}));

const resetAndReload = async () => {
  await connect();
  if (address.value) {
    await refreshTemplates();
    await refreshCertificates();
  }
};

const openIssueModal = (template: { id: string }) => {
  issueTemplateId.value = template.id;
  issueModalOpen.value = true;
};
const onTabChange = async (tab: string) => {
  activeTab.value = tab;
  if (tab === "templates") await refreshTemplates();
  if (tab === "certificates") await refreshCertificates();
};

onMounted(async () => {
  await connect();
  if (address.value) {
    await refreshTemplates();
    await refreshCertificates();
  }
});

watch(address, async (newAddr) => {
  if (newAddr) {
    await refreshTemplates();
    await refreshCertificates();
  } else {
    templates.value = [];
    certificates.value = [];
    lookup.value = null;
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./soulbound-certificate-theme.scss";

@include page-background(
  linear-gradient(135deg, var(--soul-bg-start) 0%, var(--soul-bg-end) 100%),
  (
    color: var(--soul-text),
  )
);
</style>
