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
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

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
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

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
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

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
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useCertificateActions } from "@/composables/useCertificateActions";
import CertificateForm from "@/components/CertificateForm.vue";
import TemplateList from "@/components/TemplateList.vue";
import CertificateGallery from "@/components/CertificateGallery.vue";
import VerifyCertificate from "@/components/VerifyCertificate.vue";
import IssueModal from "@/components/IssueModal.vue";

const { t } = useI18n();
const { status, setStatus } = useStatusMessage();

const {
  address, connect,
  templates, certificates, certQrs, refreshTemplates, refreshCertificates,
  isCreating, isIssuing, isLookingUp, isRevoking, togglingId, lookup,
  connectWallet, createTemplate, issueCertificate, toggleTemplate,
  lookupCertificate, revokeCertificate, copyTokenId,
} = useCertificateActions(setStatus);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "templates", labelKey: "templatesTab", icon: "\u{1F4DC}", default: true },
    { key: "certificates", labelKey: "certificatesTab", icon: "\u{1F3C5}" },
    { key: "verify", labelKey: "verifyTab", icon: "\u2705" },
    { key: "docs", labelKey: "docs", icon: "\u{1F4D6}" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

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

const sidebarItems = computed(() => [
  { label: t("templatesTab"), value: templates.value.length },
  { label: t("certificatesTab"), value: certificates.value.length },
  { label: "Active", value: templates.value.filter((tpl) => tpl.active).length },
]);

const openIssueModal = (template: { id: string }) => {
  issueTemplateId.value = template.id;
  issueModalOpen.value = true;
};

const closeIssueModal = () => { issueModalOpen.value = false; };

const handleIssueCertificate = async (data: {
  templateId: string; recipient: string; recipientName: string; achievement: string; memo: string;
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
@import "./soulbound-certificate-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--soul-bg-start) 0%, var(--soul-bg-end) 100%);
  color: var(--soul-text);
}

.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
