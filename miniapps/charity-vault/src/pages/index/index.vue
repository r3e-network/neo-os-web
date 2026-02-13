<template>
  <view class="theme-charity-vault">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMessage"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- LEFT panel: Campaign List -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Category Filter -->
          <view class="category-filter">
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
        </ErrorBoundary>
      </template>

      <!-- RIGHT panel: Actions -->
      <template #operation>
        <NeoCard variant="erobo" :title="t('quickActions')">
          <view class="action-buttons">
            <NeoButton variant="primary" size="lg" block @click="activeTab = 'create'">
              {{ t("create") }}
            </NeoButton>
            <NeoButton variant="secondary" size="lg" block @click="activeTab = 'my-donations'">
              {{ t("myDonationsTab") }}
            </NeoButton>
          </view>
        </NeoCard>
        <NeoStats :stats="charityStats" />
      </template>

      <template #tab-donate>
        <CampaignDetail
          v-if="selectedCampaign"
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
      </template>

      <template #tab-my-donations>
        <MyDonationsView :donations="myDonations" :total-donated="totalDonated" :t="t as (key: string) => string" />
      </template>

      <template #tab-create>
        <CreateCampaignForm
          :is-creating="isCreating"
          :t="t as (key: string) => string"
          @submit="handleCreateCampaign"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import CampaignCard from "./components/CampaignCard.vue";
import CampaignDetail from "./components/CampaignDetail.vue";
import MyDonationsView from "./components/MyDonationsView.vue";
import CreateCampaignForm from "./components/CreateCampaignForm.vue";
import { useCharityContract } from "@/composables/useCharityContract";
import type { CharityCampaign } from "@/types";

const { t } = createUseI18n(messages)();

const {
  selectedCampaign,
  campaigns,
  myDonations,
  recentDonations,
  selectedCategory,
  loadingCampaigns,
  isDonating,
  isCreating,
  errorMessage,
  filteredCampaigns,
  totalDonated,
  totalRaised,
  loadRecentDonations,
  makeDonation,
  createCampaign,
  init,
} = useCharityContract(t);

const statusMessage = computed(() => (errorMessage.value ? { msg: errorMessage.value, type: "error" as const } : null));

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "campaigns", labelKey: "campaigns", icon: "❤️", default: true },
    { key: "donate", labelKey: "myDonationsTab", icon: "💰" },
    { key: "my-donations", labelKey: "myDonationsTab", icon: "📋" },
    { key: "create", labelKey: "create", icon: "➕" },
    { key: "docs", labelKey: "docs", icon: "📖" },
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
        { nameKey: "feature4Name", descKey: "feature4Desc" },
      ],
    },
  },
};

const activeTab = ref("campaigns");

const sidebarItems = computed(() => [
  { label: t("campaigns"), value: campaigns.value.length },
  { label: t("myDonations"), value: myDonations.value.length },
  { label: t("totalRaised"), value: `${totalRaised.value.toFixed(2)} GAS` },
]);

const appState = computed(() => ({
  campaignCount: campaigns.value.length,
  totalDonated: totalDonated.value,
}));

const charityStats = computed(() => [
  { label: t("campaigns"), value: campaigns.value.length },
  { label: t("totalRaised"), value: `${totalRaised.value.toFixed(2)} GAS` },
  { label: t("myDonations"), value: myDonations.value.length },
]);

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

// Select campaign
const selectCampaign = async (campaign: CharityCampaign) => {
  selectedCampaign.value = campaign;
  activeTab.value = "donate";
  await loadRecentDonations(campaign.id);
};

// Create campaign wrapper
const handleCreateCampaign = async (data: {
  title: string;
  description: string;
  story: string;
  category: string;
  targetAmount: number;
  duration: number;
  beneficiary: string;
  multisigAddresses: string[];
}) => {
  const success = await createCampaign(data);
  if (success) {
    activeTab.value = "campaigns";
  }
};

const { handleBoundaryError } = useHandleBoundaryError("charity-vault");
const resetAndReload = async () => {
  await init();
};

// Initialize
onMounted(async () => {
  await init();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./charity-vault-theme.scss";

:global(page) {
  background: var(--charity-bg);
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
  }

  &.active {
    background: var(--charity-accent);
    border-color: var(--charity-accent);
    color: var(--text-on-accent, white);
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

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .category-chip {
    transition: none;
  }
}
</style>
