<template>
  <view class="theme-soulbound-certificate">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="onTabChange"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
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
    </MiniAppTemplate>

    <IssueModal
      :visible="issueModalOpen"
      :loading="isIssuing"
      :template-id="issueTemplateId"
      @close="closeIssueModal"
      @issue="handleIssueCertificate"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, ErrorBoundary, SidebarPanel } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { useCertificateActions } from "@/composables/useCertificateActions";
import CertificateForm from "@/components/CertificateForm.vue";
import TemplateList from "@/components/TemplateList.vue";
import CertificateGallery from "@/components/CertificateGallery.vue";
import VerifyCertificate from "@/components/VerifyCertificate.vue";
import IssueModal from "@/components/IssueModal.vue";

const { t } = createUseI18n(messages)();
const { status, setStatus } = useStatusMessage();

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

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "templates", labelKey: "templatesTab", icon: "\u{1F4DC}", default: true },
    { key: "certificates", labelKey: "certificatesTab", icon: "\u{1F3C5}" },
    { key: "verify", labelKey: "verifyTab", icon: "\u2705" },
  ],
  docFeatureCount: 3,
});

const activeTab = ref("templates");
const isRefreshing = ref(false);
const isRefreshingCertificates = ref(false);
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

const sidebarItems = createSidebarItems(t, [
  { labelKey: "templatesTab", value: () => templates.value.length },
  { labelKey: "certificatesTab", value: () => certificates.value.length },
  { labelKey: "sidebarActive", value: () => templates.value.filter((tpl) => tpl.active).length },
]);

const { handleBoundaryError } = useHandleBoundaryError("soulbound-certificate");
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

const closeIssueModal = () => {
  issueModalOpen.value = false;
};

const handleIssueCertificate = async (data: {
  templateId: string;
  recipient: string;
  recipientName: string;
  achievement: string;
  memo: string;
}) => {
  const success = await issueCertificate(data);
  if (success) issueModalOpen.value = false;
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
