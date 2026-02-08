<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-grant-share">
    <view class="app-container">
      <view class="nav-header mb-4">
        <NeoButton size="sm" variant="secondary" @click="goBack">
          &larr; {{ t("back") }}
        </NeoButton>
      </view>

      <view v-if="loading" class="empty-state">
        <text class="empty-text">{{ t("loading") }}</text>
      </view>

      <view v-else-if="fetchError" class="empty-state">
        <text class="empty-text">{{ t("loadFailed") }}</text>
      </view>

      <view v-else-if="grant" class="grant-detail">
        <NeoCard variant="erobo-neo" class="mb-4">
          <view class="header-section">
            <text class="grant-title-glass">{{ grant.title }}</text>
            <view class="meta-row mt-2">
               <text class="grant-creator-glass">{{ t("by") }} {{ grant.proposer }}</text>
               <view :class="['grant-badge-glass', grant.state]">
                  <text class="badge-text">{{ getStatusLabel(grant.state) }}</text>
               </view>
            </view>
            <view class="proposal-meta mt-2">
                <text v-if="grant.onchainId !== null" class="meta-item">#{{ grant.onchainId }}</text>
                <text v-if="grant.createdAt" class="meta-item">{{ formatDate(grant.createdAt) }}</text>
            </view>
          </view>
        </NeoCard>

        <NeoCard variant="erobo-neo" class="mb-4">
            <view class="section-title-glass">{{ t("details") }}</view>
            <view class="description-content">
                <text class="desc-text">{{ grant.description || t("noDescription") }}</text>
            </view>
        </NeoCard>

        <NeoCard variant="erobo-neo" class="mb-4">
             <view class="section-title-glass">{{ t("voting") }}</view>
             <view class="proposal-stats">
                <view class="stat-chip accept">{{ t("votesFor") }} {{ formatCount(grant.votesAccept) }}</view>
                <view class="stat-chip reject">{{ t("votesAgainst") }} {{ formatCount(grant.votesReject) }}</view>
             </view>
             
             <view class="mt-4 flex gap-2">
                 <NeoButton
                   size="sm"
                   variant="secondary"
                   :disabled="!grant.discussionUrl"
                   @click="copyLink(grant.discussionUrl)"
                 >
                   {{ grant.discussionUrl ? t("discussionLink") : t("noDiscussion") }}
                 </NeoButton>
             </view>
        </NeoCard>

      </view>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoButton, NeoCard } from "@shared/components";

const { t, locale } = useI18n();
const id = ref("");
const loading = ref(true);
const fetchError = ref(false);
const grant = ref<any>(null);
const statusMessage = ref("");

const isLocalPreview =
  typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const LOCAL_PROPOSAL_DETAIL_MOCK = {
  items: [
    {
      offchain_id: "101",
      title: "Developer Education Sprint",
      description: "Build a 6-week education sprint focused on secure NEO smart contract development.",
      proposer: "NfYhP6Yw5tM4oX2Qz7bR5mU8dC6jK9vW1Q",
      state: "active",
      votes_amount_accept: 152340,
      votes_amount_reject: 12340,
      discussion_url: "https://forum.grantshares.io/t/dev-education-sprint",
      offchain_creation_timestamp: "2026-01-30T08:12:00.000Z",
      onchain_id: 57,
    },
    {
      offchain_id: "102",
      title: "Neo Wallet UX Research",
      description: "Research and prototype better onboarding and transaction clarity for first-time users.",
      proposer: "NQf1fY3mP8jC2rL7nD4sX9aV6kW3mP5tYH",
      state: "review",
      votes_amount_accept: 92340,
      votes_amount_reject: 4560,
      discussion_url: "https://forum.grantshares.io/t/wallet-ux-research",
      offchain_creation_timestamp: "2026-02-01T13:20:00.000Z",
      onchain_id: 58,
    },
    {
      offchain_id: "103",
      title: "Cross-Chain Tooling Maintenance",
      description: "Maintain bridge and indexing tooling to improve reliability and incident response.",
      proposer: "NdR6mX4tW8qL2dP5sH9fV3bN1kJ7gC2qZT",
      state: "executed",
      votes_amount_accept: 210340,
      votes_amount_reject: 7830,
      discussion_url: "https://forum.grantshares.io/t/cross-chain-tooling-maintenance",
      offchain_creation_timestamp: "2025-12-18T10:45:00.000Z",
      onchain_id: 54,
    },
  ],
};

const parseResponseData = (payload: unknown) => {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
};

interface GrantDetail {
  id: string;
  title: string;
  description: string;
  proposer: string;
  state: string;
  votesAccept: number;
  votesReject: number;
  discussionUrl: string;
  createdAt: string;
  onchainId: number | null;
}

onLoad((options:any) => {
    if (options && options.id) {
        id.value = options.id;
        
        // Try to get from storage first to avoid proxy issues or delay
        try {
            const stored = uni.getStorageSync('current_grant_detail');
            if (stored && String(stored.id) === String(options.id)) {
                grant.value = stored;
                loading.value = false;
                return;
            }
        } catch(e) {
            // Storage read error - silent fail
        }

        fetchGrantDetail(options.id);
    } else {
        fetchError.value = true;
        loading.value = false;
    }
});

function goBack() {
    uni.navigateBack();
}

function decodeBase64(str: string) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return str;
  }
}

function normalizeState(state: string): string {
  return String(state || "").toLowerCase();
}

async function fetchGrantDetail(proposalId: string) {
  loading.value = true;
  fetchError.value = false;
  try {
    let res: any = null;

    if (isLocalPreview) {
      const mockPayload = LOCAL_PROPOSAL_DETAIL_MOCK;
      if (Array.isArray((mockPayload as any).items)) {
        res = (mockPayload as any).items.find((item: any) =>
          String(item.offchain_id || item.id || "") === String(proposalId),
        ) || null;
      }
    }

    if (!res) {
      res = await new Promise<any>((resolve, reject) => {
        uni.request({
          url: `/api/grantshares/proposal?id=${proposalId}`,
          success: (r) => resolve(parseResponseData(r.data)),
          fail: (e) => reject(e),
        });
      });
    }

    if (res) {
        // Adapt response fields - assuming similar mapping to list but single object
        // Note: The API might return the object directly or wrapped.
        // Based on proxy implementation: `return res.json(data)`.
        const item = res;
        
        grant.value = {
            id: String(item.offchain_id || item.id || ""),
            title: decodeBase64(item.title || ""),
            description: decodeBase64(item.description || ""), 
            proposer: String(item.proposer || item.proposer_address || item.proposerAddress || ""),
            state: normalizeState(item.state || ""),
            votesAccept: Number(item.votes_amount_accept || item.votesAmountAccept || 0),
            votesReject: Number(item.votes_amount_reject || item.votesAmountReject || 0),
            discussionUrl: String(item.discussion_url || item.discussionUrl || ""),
            createdAt: String(item.offchain_creation_timestamp || item.offchainCreationTimestamp || ""),
            onchainId: item.onchain_id ?? item.onchainId ?? null,
        };
    } else {
        fetchError.value = true;
    }
  } catch (e) {
    fetchError.value = true;
  } finally {
    loading.value = false;
  }
}

function formatCount(amount: number): string {
  return Number.isFinite(amount) ? amount.toLocaleString() : "0";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const dateLocale = locale.value === "zh" ? "zh-CN" : "en-US";
  return date.toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusLabel(state: string): string {
  const statusMap: Record<string, string> = {
    active: t("statusActive"),
    review: t("statusReview"),
    voting: t("statusVoting"),
    discussion: t("statusDiscussion"),
    executed: t("statusExecuted"),
    cancelled: t("statusCancelled"),
    rejected: t("statusRejected"),
    expired: t("statusExpired"),
  };
  return statusMap[normalizeState(state)] || state;
}

function showStatus(_message: string) { // Simplified
    // could implement toast
}

function copyLink(url: string) {
  if (!url) return;
  const uniApi = (globalThis as any)?.uni;
  if (uniApi?.setClipboardData) {
    uniApi.setClipboardData({
      data: url,
      success: () => showStatus(t("linkCopied")),
      fail: () => showStatus(t("copyFailed")),
    });
    return;
  }
}

</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
/* Duplicate styles from index.vue for consistency */
:global(.theme-grant-share) {
  --eco-bg: #0f1c15;
  --eco-bg-pattern: rgba(52, 211, 153, 0.14);
  --eco-card-bg: rgba(17, 32, 25, 0.9);
  --eco-card-border: rgba(52, 211, 153, 0.18);
  --eco-card-accent-border: rgba(52, 211, 153, 0.35);
  --eco-card-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
  --eco-text: #e5f8ee;
  --eco-text-muted: #9cc7b3;
  --eco-accent: #34d399;
  
  --eco-chip-accept-bg: rgba(16, 185, 129, 0.2);
  --eco-chip-accept-text: #34d399;
  --eco-chip-accept-border: rgba(16, 185, 129, 0.4);
  --eco-chip-reject-bg: rgba(239, 68, 68, 0.2);
  --eco-chip-reject-text: #f87171;
  --eco-chip-reject-border: rgba(239, 68, 68, 0.4);
  
  --eco-badge-review-bg: rgba(59, 130, 246, 0.2);
  --eco-badge-review-text: #60a5fa;

  --eco-meta-bg: rgba(255, 255, 255, 0.08);
  --eco-meta-text: #c1ddcf;

  /* Simplified palette for brevity */
}

/* Ensure global page bg */
:global(page) {
    background: #0f1c15;
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #0f1c15; /* Fallback */
  min-height: 100vh;
}

.grant-title-glass {
  font-weight: 700;
  font-size: 20px;
  color: #e5f8ee;
}
.grant-creator-glass {
    color: #9cc7b3;
    font-size: 12px;
}
.section-title-glass {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 12px;
    margin-bottom: 12px;
    color: #9cc7b3;
    border-left: 3px solid #34d399;
    padding-left: 8px;
}
.desc-text {
    color: #e5f8ee;
    font-size: 14px;
    line-height: 1.6;
}

.meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
