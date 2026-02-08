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
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>

      <template #content>
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

        <CertificateForm :loading="isCreating" @create="createTemplate" />

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
    :template-id="issueForm.templateId"
    @close="closeIssueModal"
    @issue="issueCertificate"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoCard, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { addressToScriptHash } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { useCertificates } from "@/composables/useCertificates";
import CertificateForm from "@/components/CertificateForm.vue";
import TemplateList from "@/components/TemplateList.vue";
import CertificateGallery from "@/components/CertificateGallery.vue";
import VerifyCertificate from "@/components/VerifyCertificate.vue";
import IssueModal from "@/components/IssueModal.vue";

const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;

const activeTab = ref("templates");
const navTabs = computed<NavTab[]>(() => [
  { id: "templates", icon: "file", label: t("templatesTab") },
  { id: "certificates", icon: "star", label: t("certificatesTab") },
  { id: "verify", icon: "check-circle", label: t("verifyTab") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const form = reactive({
  name: "",
  issuerName: "",
  category: "",
  maxSupply: "100",
  description: "",
});

const issueForm = reactive({
  templateId: "",
  recipient: "",
  recipientName: "",
  achievement: "",
  memo: "",
});

const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
const isCreating = ref(false);
const isRefreshing = ref(false);
const isRefreshingCertificates = ref(false);
const isIssuing = ref(false);
const isLookingUp = ref(false);
const isRevoking = ref(false);
const issueModalOpen = ref(false);
const togglingId = ref<string | null>(null);
const lookup = ref<any>(null);

const { templates, certificates, certQrs, refreshTemplates, refreshCertificates, parseBigInt, ensureContractAddress } = useCertificates();

const setStatus = (msg: string, type: "success" | "error") => {
  status.value = { msg, type };
  setTimeout(() => {
    if (status.value?.msg === msg) status.value = null;
  }, 4000);
};

const connectWallet = async () => {
  try {
    await connect();
    if (address.value) {
      await refreshTemplates();
      await refreshCertificates();
    }
  } catch (e: any) {
    setStatus(e.message || t("walletNotConnected"), "error");
  }
};

const createTemplate = async (data: { name: string; issuerName: string; category: string; maxSupply: string; description: string }) => {
  if (isCreating.value) return;
  if (!requireNeoChain(chainType, t)) return;

  const name = data.name.trim();
  if (!name) {
    setStatus(t("nameRequired"), "error");
    return;
  }

  const maxSupply = parseBigInt(data.maxSupply);
  if (maxSupply <= 0n) {
    setStatus(t("invalidSupply"), "error");
    return;
  }

  try {
    isCreating.value = true;
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));

    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "CreateTemplate",
      args: [
        { type: "Hash160", value: address.value },
        { type: "String", value: name },
        { type: "String", value: data.issuerName.trim() },
        { type: "String", value: data.category.trim() },
        { type: "Integer", value: maxSupply.toString() },
        { type: "String", value: data.description.trim() },
      ],
    });

    setStatus(t("templateCreated"), "success");
    form.name = "";
    form.issuerName = "";
    form.category = "";
    form.maxSupply = "100";
    form.description = "";

    await refreshTemplates();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isCreating.value = false;
  }
};

const openIssueModal = (template: any) => {
  issueForm.templateId = template.id;
  issueForm.recipient = "";
  issueForm.recipientName = "";
  issueForm.achievement = "";
  issueForm.memo = "";
  issueModalOpen.value = true;
};

const closeIssueModal = () => {
  issueModalOpen.value = false;
};

const issueCertificate = async (data: { templateId: string; recipient: string; recipientName: string; achievement: string; memo: string }) => {
  if (isIssuing.value) return;
  if (!requireNeoChain(chainType, t)) return;

  const recipient = data.recipient.trim();
  if (!recipient || !addressToScriptHash(recipient)) {
    setStatus(t("invalidRecipient"), "error");
    return;
  }

  try {
    isIssuing.value = true;
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();

    await invokeContract({
      scriptHash: contract,
      operation: "IssueCertificate",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: recipient },
        { type: "Integer", value: data.templateId },
        { type: "String", value: data.recipientName.trim() },
        { type: "String", value: data.achievement.trim() },
        { type: "String", value: data.memo.trim() },
      ],
    });

    setStatus(t("issuedSuccess"), "success");
    issueModalOpen.value = false;
    await refreshTemplates();
    await refreshCertificates();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isIssuing.value = false;
  }
};

const toggleTemplate = async (template: any) => {
  if (togglingId.value) return;
  if (!requireNeoChain(chainType, t)) return;
  try {
    togglingId.value = template.id;
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "SetTemplateActive",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: template.id },
        { type: "Boolean", value: !template.active },
      ],
    });
    await refreshTemplates();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    togglingId.value = null;
  }
};

const lookupCertificate = async (tokenId: string) => {
  if (isLookingUp.value) return;
  if (!requireNeoChain(chainType, t)) return;
  if (!tokenId) {
    setStatus(t("invalidTokenId"), "error");
    return;
  }
  try {
    isLookingUp.value = true;
    const contract = await ensureContractAddress();
    const detailResult = await invokeRead({
      contractAddress: contract,
      operation: "GetCertificateDetails",
      args: [{ type: "ByteArray", value: tokenId }],
    });
    const detailParsed = detailResult as any;
    if (!detailParsed) {
      setStatus(t("certificateNotFound"), "error");
      lookup.value = null;
      return;
    }
    lookup.value = detailParsed;
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isLookingUp.value = false;
  }
};

const revokeCertificate = async (tokenId: string) => {
  if (isRevoking.value) return;
  if (!requireNeoChain(chainType, t)) return;
  if (!tokenId) {
    setStatus(t("invalidTokenId"), "error");
    return;
  }
  try {
    isRevoking.value = true;
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "RevokeCertificate",
      args: [
        { type: "Hash160", value: address.value },
        { type: "ByteArray", value: tokenId },
      ],
    });
    setStatus(t("revokeSuccess"), "success");
    await lookupCertificate(tokenId);
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isRevoking.value = false;
  }
};

const copyTokenId = (tokenId: string) => {
  uni.setClipboardData({
    data: tokenId,
    success: () => {
      setStatus(t("copied"), "success");
    },
  });
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

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.template-cards,
.certificate-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.template-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.template-title {
  font-size: 15px;
  font-weight: 700;
}

.template-subtitle {
  display: block;
  font-size: 11px;
  color: var(--soul-muted);
  margin-top: 2px;
}

.template-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--soul-muted);
}

.meta-value {
  font-size: 12px;
}

.template-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.metric-label {
  font-size: 10px;
  color: var(--soul-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--soul-accent-strong);
}

.template-desc {
  font-size: 12px;
  color: var(--soul-muted);
}

.template-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.certificate-body {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  align-items: center;
}

.certificate-qr {
  width: 110px;
  height: 110px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.certificate-qr__img {
  width: 100px;
  height: 100px;
}

.certificate-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  font-size: 12px;
  color: var(--soul-muted);
}

.copy-btn {
  align-self: flex-start;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(16, 185, 129, 0.2);
  color: var(--soul-accent);
}

.status-pill.revoked {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.status-pill.inactive {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
