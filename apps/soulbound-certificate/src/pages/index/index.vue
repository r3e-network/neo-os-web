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
        :templates="templates"
        :refreshing="isRefreshing"
        :toggling-id="togglingId"
        :has-address="!!address"
        @refresh="refreshTemplates"
        @connect="connectWallet"
        @issue="openIssueModal"
        @toggle="toggleTemplate"
      />

      <div v-if="issueDraft" class="issue-draft-card">
        <p class="issue-draft-title">{{ t("draftReadyTitle") }}</p>
        <p class="issue-draft-text">{{ t("draftReadyText") }}</p>
        <p class="issue-draft-meta">{{ issueDraft.achievement || t("notAvailable") }}</p>
      </div>
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
    :prefill="issueDraft"
    @close="closeIssueModal"
    @issue="handleIssueCertificate"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
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
const issueDraft = ref<{
  recipient?: string;
  recipientName?: string;
  achievement?: string;
  memo?: string;
} | null>(null);

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: isCreating.value,
  isRefreshing: isRefreshing.value,
  templatesCount: templates.value.length,
  certificatesCount: certificates.value.length,
  issueDraft: issueDraft.value,
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

const openIssueModal = (template: { id: string }) => {
  issueTemplateId.value = template.id;
  issueModalOpen.value = true;
};
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
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const recipient = String(params.get("issueRecipient") || "").trim();
    const recipientName = String(params.get("issueRecipientName") || "").trim();
    const achievement = String(params.get("issueAchievement") || "").trim();
    const memo = String(params.get("issueMemo") || "").trim();
    const templateId = String(params.get("issueTemplateId") || "").trim();
    const autoIssueDraft = ["1", "true", "yes"].includes(String(params.get("autoIssueDraft") || "").trim().toLowerCase());
    if (recipient || recipientName || achievement || memo) {
      issueDraft.value = { recipient, recipientName, achievement, memo };
      if (templateId) {
        issueTemplateId.value = templateId;
      }
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
      if (issueDraft.value) {
        const targetTemplateId = issueTemplateId.value || templates.value.find((template) => template.active)?.id || "";
        if (targetTemplateId) {
          issueTemplateId.value = targetTemplateId;
          issueModalOpen.value = true;
        }
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
      if (issueDraft.value && !issueModalOpen.value) {
        const targetTemplateId = issueTemplateId.value || templates.value.find((template) => template.active)?.id || "";
        if (targetTemplateId) {
          issueTemplateId.value = targetTemplateId;
          issueModalOpen.value = true;
        }
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
