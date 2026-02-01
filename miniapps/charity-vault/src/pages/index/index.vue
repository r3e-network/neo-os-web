<template>
  <view class="theme-charity-vault">
    <ResponsiveLayout
      :title="t('title')"
      :nav-items="navTabs"
      :active-tab="activeTab"
      :show-sidebar="isDesktop"
      layout="sidebar"
      @tab-change="activeTab = $event"
    >
      <!-- Chain Warning -->
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="sidebar-stats">
          <text class="sidebar-title">{{ t("totalRaised") }}</text>
          <text class="sidebar-value">{{ totalRaised }} GAS</text>
        </view>

        <view class="sidebar-categories">
          <text class="sidebar-title">{{ t("categories") }}</text>
          <view
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectedCategory = cat.id"
          >
            <text class="category-name">{{ cat.label }}</text>
          </view>
        </view>
      </template>

      <!-- Campaigns Tab -->
      <view v-if="activeTab === 'campaigns'" class="tab-content">
        <!-- Mobile: Category Filter -->
        <view v-if="!isDesktop" class="category-filter">
          <scroll-view scroll-x class="category-scroll">
            <view
              v-for="cat in categories"
              :key="cat.id"
              class="category-chip"
              :class="{ active: selectedCategory === cat.id }"
              @click="selectedCategory = cat.id"
            >
              <text>{{ cat.label }}</text>
            </view>
          </scroll-view>
        </view>

        <!-- Campaign List -->
        <view class="campaign-list">
          <view v-if="loadingCampaigns" class="loading-state">
            <text>{{ t("loading") }}</text>
          </view>
          <view v-else-if="filteredCampaigns.length === 0" class="empty-state">
            <text>{{ t("noCampaigns") }}</text>
          </view>
          <CampaignCard
            v-else
            v-for="campaign in filteredCampaigns"
            :key="campaign.id"
            :campaign="campaign"
            :t="t as (key: string) => string"
            @click="selectCampaign(campaign)"
          />
        </view>
      </view>

      <!-- Donate Tab (Selected Campaign) -->
      <view v-if="activeTab === 'donate' && selectedCampaign" class="tab-content scrollable">
        <CampaignDetail
          :campaign="selectedCampaign"
          :recent-donations="recentDonations"
          :is-donating="isDonating"
          :t="t as (key: string) => string"
          @donate="makeDonation"
          @back="
            activeTab = 'campaigns';
            selectedCampaign = null;
          "
        />
      </view>

      <!-- My Donations Tab -->
      <view v-if="activeTab === 'my-donations'" class="tab-content scrollable">
        <MyDonationsView :donations="myDonations" :total-donated="totalDonated" :t="t as (key: string) => string" />
      </view>

      <!-- Create Tab -->
      <view v-if="activeTab === 'create'" class="tab-content scrollable">
        <CreateCampaignForm :is-creating="isCreating" :t="t as (key: string) => string" @submit="createCampaign" />
      </view>

      <!-- Docs Tab -->
      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>

      <!-- Error Toast -->
      <view v-if="errorMessage" class="error-toast">
        <text>{{ errorMessage }}</text>
      </view>
    </ResponsiveLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import CampaignCard from "./components/CampaignCard.vue";
import CampaignDetail from "./components/CampaignDetail.vue";
import MyDonationsView from "./components/MyDonationsView.vue";
import CreateCampaignForm from "./components/CreateCampaignForm.vue";

const { t } = useI18n();
const APP_ID = "miniapp-charity-vault";

const navTabs = computed<NavTab[]>(() => [
  { id: "campaigns", icon: "heart", label: t("campaigns") },
  { id: "my-donations", icon: "wallet", label: t("myDonationsTab") },
  { id: "create", icon: "add", label: t("create") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("campaigns");
const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);

// State
const contractAddress = ref<string | null>(null);
const selectedCampaign = ref<CharityCampaign | null>(null);
const campaigns = ref<CharityCampaign[]>([]);
const myDonations = ref<Donation[]>([]);
const recentDonations = ref<Donation[]>([]);
const selectedCategory = ref<string>("all");
const loadingCampaigns = ref(false);
const isDonating = ref(false);
const isCreating = ref(false);
const errorMessage = ref<string | null>(null);

// Categories
const categories = computed(() => [
  { id: "all", label: t("categoryAll") },
  { id: "disaster", label: t("categoryDisaster") },
  { id: "education", label: t("categoryEducation") },
  { id: "health", label: t("categoryHealth") },
  { id: "environment", label: t("categoryEnvironment") },
  { id: "poverty", label: t("categoryPoverty") },
  { id: "animals", label: t("categoryAnimals") },
  { id: "other", label: t("categoryOther") },
]);

// Filtered campaigns
const filteredCampaigns = computed(() => {
  if (selectedCategory.value === "all") return campaigns.value;
  return campaigns.value.filter((c) => c.category === selectedCategory.value);
});

// Total donated
const totalDonated = computed(() => {
  return myDonations.value.reduce((sum, d) => sum + d.amount, 0);
});

// Docs content
const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
  { name: t("feature4Name"), desc: t("feature4Desc") },
]);

// Interfaces
interface CharityCampaign {
  id: number;
  title: string;
  description: string;
  story: string;
  category: string;
  organizer: string;
  beneficiary: string;
  targetAmount: number;
  raisedAmount: number;
  donorCount: number;
  endTime: number;
  createdAt: number;
  status: "active" | "completed" | "withdrawn" | "cancelled";
  multisigAddresses: string[];
}

interface Donation {
  id: number;
  campaignId: number;
  donor: string;
  amount: number;
  message: string;
  timestamp: number;
}

// Ensure contract address
const ensureContractAddress = async (): Promise<boolean> => {
  if (!requireNeoChain(chainType, t)) return false;
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  return !!contractAddress.value;
};

// Load campaigns
const loadCampaigns = async () => {
  if (!(await ensureContractAddress())) return;

  try {
    loadingCampaigns.value = true;
    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getCampaigns",
      args: [],
    });

    const parsed = parseInvokeResult(result) as unknown[];
    if (Array.isArray(parsed)) {
      campaigns.value = parsed.map((c: any) => ({
        id: Number(c.id || 0),
        title: String(c.title || ""),
        description: String(c.description || ""),
        story: String(c.story || ""),
        category: String(c.category || "other"),
        organizer: String(c.organizer || ""),
        beneficiary: String(c.beneficiary || ""),
        targetAmount: Number(c.targetAmount || 0) / 1e8,
        raisedAmount: Number(c.raisedAmount || 0) / 1e8,
        donorCount: Number(c.donorCount || 0),
        endTime: Number(c.endTime || 0) * 1000,
        createdAt: Number(c.createdAt || 0) * 1000,
        status: c.status || "active",
        multisigAddresses: Array.isArray(c.multisigAddresses) ? c.multisigAddresses : [],
      }));
    }
  } catch (e: any) {
    showError(e.message || t("failedToLoad"));
  } finally {
    loadingCampaigns.value = false;
  }
};

// Load user's donations
const loadMyDonations = async () => {
  if (!address.value || !(await ensureContractAddress())) return;

  try {
    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getUserDonations",
      args: [{ type: "Hash160", value: address.value }],
    });

    const parsed = parseInvokeResult(result) as unknown[];
    if (Array.isArray(parsed)) {
      myDonations.value = parsed.map((d: any) => ({
        id: Number(d.id || 0),
        campaignId: Number(d.campaignId || 0),
        donor: String(d.donor || ""),
        amount: Number(d.amount || 0) / 1e8,
        message: String(d.message || ""),
        timestamp: Number(d.timestamp || 0) * 1000,
      }));
    }
  } catch (e: any) {
    // Silent fail
  }
};

// Load recent donations for selected campaign
const loadRecentDonations = async (campaignId: number) => {
  try {
    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getCampaignDonations",
      args: [
        { type: "Integer", value: campaignId },
        { type: "Integer", value: 10 }, // Last 10
      ],
    });

    const parsed = parseInvokeResult(result) as unknown[];
    if (Array.isArray(parsed)) {
      recentDonations.value = parsed.map((d: any) => ({
        id: Number(d.id || 0),
        campaignId: Number(d.campaignId || 0),
        donor: String(d.donor || ""),
        amount: Number(d.amount || 0) / 1e8,
        message: String(d.message || ""),
        timestamp: Number(d.timestamp || 0) * 1000,
      }));
    }
  } catch (e: any) {
    // Silent fail
  }
};

// Select campaign
const selectCampaign = async (campaign: CharityCampaign) => {
  selectedCampaign.value = campaign;
  activeTab.value = "donate";
  await loadRecentDonations(campaign.id);
};

// Make donation
const makeDonation = async (data: { amount: number; message: string }) => {
  if (!address.value) {
    showError(t("connectWallet"));
    return;
  }
  if (!(await ensureContractAddress())) return;
  if (!selectedCampaign.value) return;

  if (data.amount < 0.1) {
    showError(t("minimumDonation"));
    return;
  }

  try {
    isDonating.value = true;

    const { receiptId, invoke } = await processPayment(
      data.amount.toFixed(8),
      `donate:${selectedCampaign.value.id}:${data.message.slice(0, 50)}`,
    );

    const tx = (await invoke(
      "donate",
      [
        { type: "Integer", value: selectedCampaign.value.id },
        { type: "Integer", value: String(receiptId) },
        { type: "String", value: data.message },
      ],
      contractAddress.value as string,
    )) as { txid: string };

    if (tx.txid) {
      await waitForEvent(tx.txid, "DonationMade");
      await loadCampaigns();
      await loadMyDonations();
      await loadRecentDonations(selectedCampaign.value.id);
    }
  } catch (e: any) {
    showError(e.message || t("donationFailed"));
  } finally {
    isDonating.value = false;
  }
};

// Create campaign
const createCampaign = async (data: {
  title: string;
  description: string;
  story: string;
  category: string;
  targetAmount: number;
  duration: number;
  beneficiary: string;
  multisigAddresses: string[];
}) => {
  if (!address.value) {
    showError(t("connectWallet"));
    return;
  }
  if (!(await ensureContractAddress())) return;

  try {
    isCreating.value = true;

    const endTime = Math.floor(Date.now() / 1000) + data.duration * 86400;

    const { receiptId, invoke } = await processPayment("1", `create:${data.category}:${data.title.slice(0, 50)}`);

    const tx = (await invoke(
      "createCampaign",
      [
        { type: "String", value: data.title },
        { type: "String", value: data.description },
        { type: "String", value: data.story },
        { type: "String", value: data.category },
        { type: "Integer", value: Math.round(data.targetAmount * 1e8) },
        { type: "Integer", value: endTime },
        { type: "Hash160", value: data.beneficiary },
        { type: "Array", value: data.multisigAddresses },
        { type: "Integer", value: String(receiptId) },
      ],
      contractAddress.value as string,
    )) as { txid: string };

    if (tx.txid) {
      await waitForEvent(tx.txid, "CampaignCreated");
      await loadCampaigns();
      activeTab.value = "campaigns";
    }
  } catch (e: any) {
    showError(e.message || t("creationFailed"));
  } finally {
    isCreating.value = false;
  }
};

// Show error
const showError = (msg: string) => {
  errorMessage.value = msg;
  setTimeout(() => {
    errorMessage.value = null;
  }, 5000);
};

// Initialize
onMounted(async () => {
  await ensureContractAddress();
  await loadCampaigns();
  await loadMyDonations();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/theme-base.scss" as *;
@import "./charity-vault-theme.scss";

// Tab content - works with both mobile and desktop layouts
.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4, 16px);
  color: var(--charity-text-primary, var(--text-primary, #f8fafc));

  // Remove default padding - DesktopLayout provides padding
  // For mobile AppLayout, padding is handled by the layout itself
}

.category-filter {
  display: flex;
  gap: var(--spacing-2, 8px);
  flex-wrap: wrap;
  padding: var(--spacing-1, 4px) 0;
}

.category-chip {
  padding: var(--spacing-2, 8px) var(--spacing-4, 16px);
  border-radius: var(--radius-xl, 20px);
  background: var(--charity-card-bg, var(--bg-card, rgba(30, 41, 59, 0.8)));
  border: 1px solid var(--charity-card-border, var(--border-color, rgba(255, 255, 255, 0.1)));
  color: var(--charity-text-secondary, var(--text-secondary, rgba(248, 250, 252, 0.7)));
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  transition: all var(--transition-normal, 250ms ease);
  cursor: pointer;

  &:hover {
    background: var(--charity-hover-bg, var(--bg-hover, rgba(255, 255, 255, 0.08)));
    border-color: var(--charity-hover-border, var(--border-color-hover, rgba(255, 255, 255, 0.15)));
  }

  &:active {
    transform: scale(0.98);
  }

  &.active {
    background: var(--charity-accent, #10b981);
    border-color: var(--charity-accent, #10b981);
    color: white;
  }
}

.campaign-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px var(--spacing-4, 16px);
  color: var(--charity-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
}

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--charity-danger-bg, rgba(239, 68, 68, 0.9));
  color: var(--charity-danger, white);
  padding: var(--spacing-3, 12px) var(--spacing-6, 24px);
  border-radius: var(--radius-md, 8px);
  font-weight: 600;
  font-size: var(--font-size-md, 14px);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 3000;
  box-shadow: var(--charity-card-shadow, 0 10px 40px rgba(0, 0, 0, 0.3));
  animation: toast-in var(--transition-normal, 300ms ease-out);
}

@keyframes toast-in {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

// Reduced motion support for accessibility
@media (prefers-reduced-motion: reduce) {
  .category-chip {
    transition: none;

    &:active {
      transform: none;
    }
  }

  .error-toast {
    animation: none;
  }
}
</style>
