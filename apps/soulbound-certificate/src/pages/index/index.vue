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
      <div class="hero-container">
        <HeroSection variant="erobo" icon="🏅" compact>
          <template #background>
            <div class="certificate-scene" aria-hidden="true">
              <div class="cert-badge">
                <div class="cert-ribbon" />
                <div class="cert-seal">✦</div>
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ templates.length }}</span>
                <span class="hero-stat-label">{{ t("templatesTab") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ certificates.length }}</span>
                <span class="hero-stat-label">{{ t("certificatesTab") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <TemplateList
        :templates="displayTemplates"
        :refreshing="isRefreshing"
        :toggling-id="togglingId"
        :has-address="!!address"
        @refresh="refreshTemplates"
        @connect="connectWallet"
        @issue="openIssueModal"
        @toggle="toggleTemplate"
        @copy-issue-link="copyTemplateIssueLink"
        @share-issue-link="shareTemplateIssueLink"
      />

      <div class="issue-draft-card">
        <p class="issue-draft-title">{{ t("registryTitle") }}</p>
        <p class="issue-draft-text">{{ t("registryText") }}</p>
        <div class="operator-history-list">
          <div v-for="entry in credentialRegistryEntries" :key="entry.key" class="operator-history-row">
            <div class="operator-history-copy">
              <p class="operator-history-name">{{ t("registryKey") }}: {{ entry.key }}</p>
              <p class="operator-history-meta">{{ t("category") }}: {{ entry.category }}</p>
              <p class="operator-history-meta">{{ t("draftCredentialType") }}: {{ entry.credentialType }}</p>
              <p class="operator-history-meta">{{ t("draftIssuerPolicy") }}: {{ entry.issuerPolicy }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="recentTemplateItems.length || issueLinkHistory.length" class="operator-history-grid">
        <div class="operator-history-card">
          <p class="issue-draft-title">{{ t("recentTemplatesTitle") }}</p>
          <div v-if="recentTemplateItems.length" class="operator-history-list">
            <div v-for="template in recentTemplateItems" :key="`recent-template-${template.id}`" class="operator-history-row">
              <div class="operator-history-copy">
                <p class="operator-history-name">{{ template.name || `#${template.id}` }}</p>
                <p class="operator-history-meta">{{ template.category || t("notAvailable") }}</p>
              </div>
              <NeoButton size="sm" variant="secondary" type="button" @click="openIssueModal(template)">{{ t("reuseTemplate") }}</NeoButton>
            </div>
          </div>
          <p v-else class="operator-history-empty">{{ t("recentTemplatesEmpty") }}</p>
        </div>

        <div class="operator-history-card">
          <p class="issue-draft-title">{{ t("recentLinksTitle") }}</p>
          <div v-if="issueLinkHistory.length" class="operator-history-list">
            <div v-for="entry in issueLinkHistory" :key="`recent-link-${entry.url}`" class="operator-history-row">
              <div class="operator-history-copy">
                <p class="operator-history-name">{{ resolveTemplateName(entry.templateId) }}</p>
                <p class="operator-history-meta">{{ t("issuedAt") }}: {{ formatHistoryTime(entry.createdAt) }}</p>
                <p v-if="entry.credentialType" class="operator-history-meta">{{ t("draftCredentialType") }}: {{ entry.credentialType }}</p>
                <p v-if="entry.issuerPolicy" class="operator-history-meta">{{ t("draftIssuerPolicy") }}: {{ entry.issuerPolicy }}</p>
              </div>
              <div class="operator-history-actions">
                <NeoButton size="sm" variant="secondary" type="button" @click="openStoredIssueLink(entry.url)">{{ t("openLink") }}</NeoButton>
                <NeoButton size="sm" variant="secondary" type="button" @click="copyStoredIssueLink(entry.url)">{{ t("copyIssueLink") }}</NeoButton>
              </div>
            </div>
          </div>
          <p v-else class="operator-history-empty">{{ t("recentLinksEmpty") }}</p>
        </div>
      </div>

      <div v-if="issueDraft" class="issue-draft-card">
        <p class="issue-draft-title">{{ t("draftReadyTitle") }}</p>
        <p class="issue-draft-text">{{ t("draftReadyText") }}</p>
        <p class="issue-draft-meta">{{ issueDraft.achievement || t("notAvailable") }}</p>
        <p v-if="issueDraft.credentialType" class="issue-draft-meta">{{ t("draftCredentialType") }}: {{ issueDraft.credentialType }}</p>
        <p v-if="issueDraft.issuerPolicy" class="issue-draft-meta">{{ t("draftIssuerPolicy") }}: {{ issueDraft.issuerPolicy }}</p>
        <p v-if="issueDraft.source" class="issue-draft-meta">{{ t("draftSource") }}: {{ issueDraft.source }}</p>
        <div v-if="draftCategory && recommendedTemplates.length" class="issue-draft-filters">
          <div class="issue-draft-filter-copy">
            <p class="issue-draft-filter-title">{{ t("recommendedTemplatesTitle") }}</p>
            <p class="issue-draft-filter-text">{{ t("recommendedTemplatesText") }}</p>
          </div>
          <div class="issue-draft-filter-actions">
            <NeoButton size="sm" :variant="showRecommendedOnly ? 'primary' : 'secondary'" type="button" @click="showRecommendedOnly = true">
              {{ t("recommendedOnly") }}
            </NeoButton>
            <NeoButton size="sm" :variant="!showRecommendedOnly ? 'primary' : 'secondary'" type="button" @click="showRecommendedOnly = false">
              {{ t("allTemplates") }}
            </NeoButton>
          </div>
          <p class="issue-draft-filter-count">{{ t("matchingTemplatesCount") }}: {{ recommendedTemplates.length }}</p>
        </div>
        <div v-else-if="draftCategory === 'event' || draftCategory === 'identity' || draftCategory === 'recovery'" class="issue-draft-filters">
          <div class="issue-draft-filter-copy">
            <p class="issue-draft-filter-title">{{ t("recommendedTemplatesTitle") }}</p>
            <p class="issue-draft-filter-text">{{ t("recommendedTemplatesText") }}</p>
          </div>
          <div class="issue-draft-filter-actions">
            <NeoButton size="sm" variant="primary" type="button" @click="applyDraftTemplatePreset">
              {{
                draftCategory === "identity"
                  ? t("createIdentityTemplatePreset")
                  : draftCategory === "recovery"
                    ? t("createRecoveryTemplatePreset")
                    : t("createEventTemplatePreset")
              }}
            </NeoButton>
          </div>
        </div>
      </div>
    </template>

    <template #operation>
      <CertificateForm
        :loading="isCreating"
        :prefill="templateFormPrefill"
        :prefill-key="templateFormPrefillKey"
        @create="createTemplate"
      />
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
    :prefill="issueDraft"
    @close="closeIssueModal"
    @issue="handleIssueCertificate"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { CREDENTIAL_REGISTRY } from "@shared/constants";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection, NeoButton } from "@shared/components";
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
const showRecommendedOnly = ref(false);
const templateFormPrefillKey = ref(0);
const recentTemplateIds = ref<string[]>([]);
const issueLinkHistory = ref<Array<{ templateId: string; url: string; createdAt: string; credentialType?: string; issuerPolicy?: string }>>([]);
const issueDraft = ref<{
  recipient?: string;
  recipientName?: string;
  achievement?: string;
  memo?: string;
  category?: string;
  credentialType?: string;
  issuerPolicy?: string;
  source?: string;
} | null>(null);
const RECENT_TEMPLATE_STORAGE_KEY = "soulbound-certificate.recent-template-ids";
const RECENT_LINK_STORAGE_KEY = "soulbound-certificate.recent-issue-links";
const credentialRegistryEntries = Object.entries(CREDENTIAL_REGISTRY).map(([key, value]) => ({
  key,
  category: value.category,
  credentialType: value.credentialType,
  issuerPolicy: value.issuerPolicy,
}));

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: isCreating.value,
  isRefreshing: isRefreshing.value,
  templatesCount: templates.value.length,
  displayedTemplatesCount: displayTemplates.value.length,
  certificatesCount: certificates.value.length,
  issueDraft: issueDraft.value,
  showRecommendedOnly: showRecommendedOnly.value,
  recentTemplatesCount: recentTemplateItems.value.length,
  recentLinksCount: issueLinkHistory.value.length,
}));

const resetAndReload = async () => {
  try {
    await connect();
    if (address.value) {
      await refreshTemplates();
      await refreshCertificates();
    }
  } catch (_e: unknown) {
    console.warn("[soulbound-certificate] reload failed:", _e instanceof Error ? _e.message : String(_e));
  }
};

function buildTemplateIssueLink(template: { id: string }) {
  const params = new URLSearchParams({
    issueTemplateId: template.id,
    autoIssueDraft: "1",
  });

  if (issueDraft.value) {
    if (issueDraft.value.recipient) params.set("issueRecipient", issueDraft.value.recipient);
    if (issueDraft.value.recipientName) params.set("issueRecipientName", issueDraft.value.recipientName);
    if (issueDraft.value.achievement) params.set("issueAchievement", issueDraft.value.achievement);
    if (issueDraft.value.memo) params.set("issueMemo", issueDraft.value.memo);
    if (issueDraft.value.category) params.set("issueCategory", issueDraft.value.category);
    if (issueDraft.value.credentialType) params.set("issueCredentialType", issueDraft.value.credentialType);
    if (issueDraft.value.issuerPolicy) params.set("issueIssuerPolicy", issueDraft.value.issuerPolicy);
    if (issueDraft.value.source) params.set("issueSource", issueDraft.value.source);
  }

  return `/miniapps/soulbound-certificate/index.html?${params.toString()}`;
}

function loadHistory() {
  if (typeof window === "undefined") return;
  try {
    const templateIds = JSON.parse(window.localStorage.getItem(RECENT_TEMPLATE_STORAGE_KEY) || "[]");
    if (Array.isArray(templateIds)) {
      recentTemplateIds.value = templateIds.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 6);
    }
  } catch {
    recentTemplateIds.value = [];
  }

  try {
    const links = JSON.parse(window.localStorage.getItem(RECENT_LINK_STORAGE_KEY) || "[]");
    if (Array.isArray(links)) {
      issueLinkHistory.value = links
        .map((entry) => ({
          templateId: String(entry?.templateId || "").trim(),
          url: String(entry?.url || "").trim(),
          createdAt: String(entry?.createdAt || "").trim(),
          credentialType: String(entry?.credentialType || "").trim(),
          issuerPolicy: String(entry?.issuerPolicy || "").trim(),
        }))
        .filter((entry) => entry.url)
        .slice(0, 8);
    }
  } catch {
    issueLinkHistory.value = [];
  }
}

function persistHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_TEMPLATE_STORAGE_KEY, JSON.stringify(recentTemplateIds.value));
  window.localStorage.setItem(RECENT_LINK_STORAGE_KEY, JSON.stringify(issueLinkHistory.value));
}

function recordRecentTemplate(templateId: string) {
  const normalized = String(templateId || "").trim();
  if (!normalized) return;
  recentTemplateIds.value = [normalized, ...recentTemplateIds.value.filter((entry) => entry !== normalized)].slice(0, 6);
  persistHistory();
}

function recordIssueLink(templateId: string, url: string) {
  const normalizedTemplate = String(templateId || "").trim();
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return;
  issueLinkHistory.value = [
    {
      templateId: normalizedTemplate,
      url: normalizedUrl,
      createdAt: new Date().toISOString(),
      credentialType: String(issueDraft.value?.credentialType || "").trim(),
      issuerPolicy: String(issueDraft.value?.issuerPolicy || "").trim(),
    },
    ...issueLinkHistory.value.filter((entry) => entry.url !== normalizedUrl),
  ].slice(0, 8);
  persistHistory();
}

const recentTemplateItems = computed(() =>
  recentTemplateIds.value
    .map((templateId) => templates.value.find((template) => template.id === templateId))
    .filter((template): template is NonNullable<typeof template> => Boolean(template)),
);

function resolveTemplateName(templateId: string) {
  return templates.value.find((template) => template.id === templateId)?.name || `#${templateId}`;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("notAvailable") : date.toLocaleString();
}

function resolveDraftTemplateId() {
  if (issueTemplateId.value) return issueTemplateId.value;
  const activeTemplates = templates.value.filter((template) => template.active);
  const draftCategory = String(issueDraft.value?.category || "").trim().toLowerCase();
  if (draftCategory) {
    const categoryMatches = activeTemplates.filter((template) =>
      String(template.category || "").trim().toLowerCase() === draftCategory,
    );
    if (categoryMatches.length === 1) {
      return categoryMatches[0].id;
    }
  }
  return "";
}

const draftCategory = computed(() => String(issueDraft.value?.category || "").trim().toLowerCase());
const templateFormPrefill = computed(() => {
  if (!issueDraft.value) return null;
  if (draftCategory.value === "event") {
    const achievement = String(issueDraft.value.achievement || "").trim() || "Event Attendance Badge";
    return {
      name: "Event Attendance Badge",
      issuerName: "Event Organizer",
      category: "Event",
      maxSupply: "1000",
      description: `${achievement}. Imported from the event ticket attendance flow.`,
    };
  }
  if (draftCategory.value === "identity") {
    const achievement = String(issueDraft.value.achievement || "").trim() || "NeoDID Passport Verified";
    return {
      name: "Identity Credential",
      issuerName: "Identity Issuer",
      category: "Identity",
      maxSupply: "1000",
      description: `${achievement}. Imported from the NeoDID passport identity flow.`,
    };
  }
  if (draftCategory.value === "recovery") {
    const achievement = String(issueDraft.value.achievement || "").trim() || "Recovery Flow Verified";
    return {
      name: "Recovery Credential",
      issuerName: "Recovery Operator",
      category: "Recovery",
      maxSupply: "1000",
      description: `${achievement}. Imported from the recovery guardian flow.`,
    };
  }
  return null;
});

const recommendedTemplates = computed(() => {
  if (!draftCategory.value) return [];
  return templates.value.filter((template) => template.active && String(template.category || "").trim().toLowerCase() === draftCategory.value);
});

const displayTemplates = computed(() => {
  if (!issueDraft.value || !draftCategory.value || recommendedTemplates.value.length === 0) {
    return templates.value;
  }
  if (showRecommendedOnly.value) {
    return recommendedTemplates.value;
  }
  const recommendedIds = new Set(recommendedTemplates.value.map((template) => template.id));
  return [
    ...recommendedTemplates.value,
    ...templates.value.filter((template) => !recommendedIds.has(template.id)),
  ];
});

function applyDraftTemplatePreset() {
  if (!templateFormPrefill.value) return;
  templateFormPrefillKey.value += 1;
  activeTab.value = "templates";
  showRecommendedOnly.value = false;
  setStatus(t("templatePresetReady"), "success");
}

const openIssueModal = (template: { id: string }) => {
  issueTemplateId.value = template.id;
  issueModalOpen.value = true;
  recordRecentTemplate(template.id);
};

async function copyTemplateIssueLink(template: { id: string }) {
  try {
    const url = buildTemplateIssueLink(template);
    await navigator.clipboard.writeText(url);
    recordIssueLink(template.id, url);
    setStatus(t("issueLinkCopied"), "success");
  } catch (error: unknown) {
    console.warn("[soulbound-certificate] copy issue link failed:", error instanceof Error ? error.message : String(error));
  }
}

async function shareTemplateIssueLink(template: { id: string }) {
  try {
    const url = buildTemplateIssueLink(template);
    if (navigator.share) {
      await navigator.share({
        title: t("issueCertificate"),
        text: template.id,
        url,
      });
      recordIssueLink(template.id, url);
      setStatus(t("issueLinkShared"), "success");
      return;
    }
    await copyTemplateIssueLink(template);
  } catch (error: unknown) {
    if (error instanceof Error && /abort|cancel/i.test(error.message)) return;
    await copyTemplateIssueLink(template);
  }
}

function openStoredIssueLink(url: string) {
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function copyStoredIssueLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    setStatus(t("issueLinkCopied"), "success");
  } catch (error: unknown) {
    console.warn("[soulbound-certificate] copy stored issue link failed:", error instanceof Error ? error.message : String(error));
  }
}
const onTabChange = async (tab: string) => {
  activeTab.value = tab;
  try {
    if (tab === "templates") await refreshTemplates();
    if (tab === "certificates") await refreshCertificates();
  } catch (_e: unknown) {
    console.warn("[soulbound-certificate] tab change failed:", _e instanceof Error ? _e.message : String(_e));
  }
};

const isMounted = ref(true);

onMounted(async () => {
  loadHistory();
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const recipient = String(params.get("issueRecipient") || "").trim();
    const recipientName = String(params.get("issueRecipientName") || "").trim();
    const achievement = String(params.get("issueAchievement") || "").trim();
    const memo = String(params.get("issueMemo") || "").trim();
    const category = String(params.get("issueCategory") || "").trim();
    const credentialType = String(params.get("issueCredentialType") || "").trim();
    const issuerPolicy = String(params.get("issueIssuerPolicy") || "").trim();
    const source = String(params.get("issueSource") || "").trim();
    const templateId = String(params.get("issueTemplateId") || "").trim();
    const autoIssueDraft = ["1", "true", "yes"].includes(String(params.get("autoIssueDraft") || "").trim().toLowerCase());
    if (recipient || recipientName || achievement || memo) {
      issueDraft.value = { recipient, recipientName, achievement, memo, category, credentialType, issuerPolicy, source };
      if (templateId) {
        issueTemplateId.value = templateId;
      }
      if (autoIssueDraft) {
        activeTab.value = "templates";
        showRecommendedOnly.value = category.length > 0;
      }
    }
    if (!issueDraft.value && templateId) {
      issueTemplateId.value = templateId;
      if (autoIssueDraft) {
        activeTab.value = "templates";
      }
    }
  }
  if (!isMounted.value) return;
  try {
    await connect();
    if (address.value) {
      await refreshTemplates();
      await refreshCertificates();
      const targetTemplateId = issueDraft.value ? resolveDraftTemplateId() : issueTemplateId.value;
      if (targetTemplateId) {
        issueTemplateId.value = targetTemplateId;
        issueModalOpen.value = true;
      }
    }
  } catch (_e: unknown) {
    console.warn("[soulbound-certificate] initial data load failed:", _e instanceof Error ? _e.message : String(_e));
  }
});
const stopAddressWatch = watch(address, async (newAddr) => {
  if (!isMounted.value) return;
  if (newAddr) {
    try {
      await refreshTemplates();
      await refreshCertificates();
      const targetTemplateId = issueDraft.value ? resolveDraftTemplateId() : issueTemplateId.value;
      if (targetTemplateId && !issueModalOpen.value) {
        issueTemplateId.value = targetTemplateId;
        issueModalOpen.value = true;
      }
    } catch (_e: unknown) {
      console.warn("[soulbound-certificate] address change failed:", _e instanceof Error ? _e.message : String(_e));
    }
  } else {
    templates.value = [];
    certificates.value = [];
    lookup.value = null;
  }
});

onUnmounted(() => {
  isMounted.value = false;
  stopAddressWatch();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./soulbound-certificate-theme.scss" as *;

@include page-background(
  linear-gradient(135deg, var(--soul-bg-start) 0%, var(--soul-bg-end) 100%),
  (
    color: var(--soul-text),
  )
);

.hero-container {
  margin-bottom: 20px;
}

.issue-draft-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(159, 157, 243, 0.24);
  background: rgba(159, 157, 243, 0.08);
}

.issue-draft-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.issue-draft-text {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.82;
}

.issue-draft-meta {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
}

.issue-draft-filters {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.issue-draft-filter-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-draft-filter-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.issue-draft-filter-text {
  font-size: 12px;
  line-height: 1.55;
  opacity: 0.82;
}

.issue-draft-filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.issue-draft-filter-count {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.75;
}

.certificate-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

.cert-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cert-ribbon {
  width: 30px;
  height: 20px;
  background: linear-gradient(135deg, var(--soul-accent, #9f9df3), var(--soul-accent-secondary, #f7aac7));
  clip-path: polygon(0 0, 100% 0, 80% 100%, 50% 70%, 20% 100%);
}

.cert-seal {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(159, 157, 243, 0.3), rgba(247, 170, 199, 0.2));
  border: 2px solid rgba(159, 157, 243, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--soul-accent, #9f9df3);
  margin-top: -8px;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

/* ── Soulbound Certificate Hero Enhancements: Official Seal ── */
@keyframes stamp-press {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  15% {
    transform: scale(1.12);
    opacity: 1;
  }
  30% {
    transform: scale(0.96);
    opacity: 0.95;
  }
  50% {
    transform: scale(1);
  }
}
@keyframes seal-radiance {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(159, 157, 243, 0.2);
  }
  50% {
    box-shadow:
      0 0 24px rgba(159, 157, 243, 0.45),
      0 0 48px rgba(247, 170, 199, 0.12);
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 40%, rgba(159, 157, 243, 0.08) 0%, transparent 55%);
}
.cert-seal {
  animation: stamp-press 3s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(159, 157, 243, 0.25);
}
.cert-badge {
  animation: seal-radiance 4s ease-in-out infinite;
}
.hero-stats {
  box-shadow: 0 4px 20px rgba(159, 157, 243, 0.1);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(159, 157, 243, 0.25);
    transform: translateY(-2px);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(159, 157, 243, 0.05), transparent);
}
.certificate-scene {
  background: linear-gradient(180deg, rgba(159, 157, 243, 0.04), transparent);
}

@media (prefers-reduced-motion: reduce) {
  .cert-seal,
  .cert-badge {
    animation: none;
  }
}
</style>
