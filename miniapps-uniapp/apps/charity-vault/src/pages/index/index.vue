<template>
  <MiniAppPage
    name="charity-vault"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="statusMessage"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="init"
  >
    <!-- LEFT panel: Campaign List -->
    <template #content>
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
        <view v-if="loadingCampaigns" class="loading-state" role="status" aria-live="polite">
          <text>{{ t("loading") }}</text>
        </view>
        <view v-else-if="filteredCampaigns.length === 0" class="empty-state" role="status">
          <text>{{ t("noCampaigns") }}</text>
        </view>
        <CampaignCard
          v-else
          v-for="campaign in filteredCampaigns"
          :key="campaign.id"
          :campaign="campaign"
          @click="selectCampaign(campaign)"
        />
      </view>
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
        <StatsDisplay :items="charityStats" layout="rows" />
      </NeoCard>
    </template>

    <template #tab-donate>
      <CampaignDetail
        v-if="selectedCampaign"
        :campaign="selectedCampaign"
        :recent-donations="recentDonations"
        :is-donating="isDonating"
        @donate="makeDonation"
        @back="
          activeTab = 'campaigns';
          selectedCampaign = null;
        "
      />
    </template>

    <template #tab-my-donations>
      <MyDonationsView :donations="myDonations" :total-donated="totalDonated" />
    </template>

    <template #tab-create>
      <CreateCampaignForm :is-creating="isCreating" @submit="handleCreateCampaign" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import CampaignCard from "./components/CampaignCard.vue";
import { useCharityContract } from "@/composables/useCharityContract";
import type { CharityCampaign } from "@/types";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "charity-vault",
  messages,
  template: {
    tabs: [
      { key: "campaigns", labelKey: "campaigns", icon: "❤️", default: true },
      { key: "donate", labelKey: "myDonationsTab", icon: "💰" },
      { key: "my-donations", labelKey: "myDonationsTab", icon: "📋" },
      { key: "create", labelKey: "create", icon: "➕" },
    ],
    docFeatureCount: 4,
  },
  sidebarItems: [
    { labelKey: "campaigns", value: () => campaigns.value.length },
    { labelKey: "myDonations", value: () => myDonations.value.length },
    { labelKey: "totalRaised", value: () => `${totalRaised.value.toFixed(2)} GAS` },
  ],
});

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

const activeTab = ref("campaigns");

const appState = computed(() => ({
  campaignCount: campaigns.value.length,
  totalDonated: totalDonated.value,
}));
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
// Initialize
onMounted(async () => {
  await init();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./charity-vault-theme.scss";

@include page-background(var(--charity-bg));

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
