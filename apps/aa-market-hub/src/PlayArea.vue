<template>
  <div class="market-play-area">
    <!-- Summary -->
    <NeoCard variant="erobo" class="mb-6">
      <p class="summary">{{ t("hubSummary") }}</p>
    </NeoCard>

    <div v-if="!marketHash.trim()" class="empty-state">
      {{ t("emptyStateEnterHash") }}
    </div>

    <div v-else-if="listings.length === 0 && !isLoading" class="empty-state">
      {{ t("emptyStateNoListings") }}
    </div>

    <!-- Listing Cards -->
    <div class="listings">
      <ListingCard
        v-for="listing in listings"
        :key="listing.id"
        :listing="listing"
        :is-selected="listing.id === selectedListingId"
        :t="t"
        @select="handleSelectListing"
      />
    </div>

    <!-- Wallet & Market -->
    <WalletConnectCard
      v-model="marketHash"
      :t="t"
      :wallet-address="walletAddress"
      :is-wallet-connecting="isWalletConnecting"
      :is-loading="isLoading"
      @load-listings="handleLoadListings"
    />

    <!-- Create Listing -->
    <CreateListingCard
      :t="t"
      :is-submitting="isSubmitting"
      :can-create-listing="canCreateListing"
    />

    <!-- Manage Listing -->
    <ManageListingCard
      :t="t"
      :selected-listing="selectedListing"
      :is-submitting="isSubmitting"
      :can-manage="canManageSelectedListing"
      :can-buy="canBuySelectedListing"
      :has-pending-refund="selectedListingHasPendingRefund"
      :wallet-address="walletAddress"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — AA Market Hub
 *
 * Composes sub-components for listings, wallet connection, listing creation,
 * and listing management. Actions are dispatched via injected action registry.
 */
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import type { MarketListing } from "./utils/aa-market";
import ListingCard from "./components/ListingCard.vue";
import WalletConnectCard from "./components/WalletConnectCard.vue";
import CreateListingCard from "./components/CreateListingCard.vue";
import ManageListingCard from "./components/ManageListingCard.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// -- State bindings --
const listings = computed(() => (props.state.listings?.value ?? []) as MarketListing[]);
const isLoading = computed(() => Boolean(props.state.isLoading?.value));
const isSubmitting = computed(() => Boolean(props.state.isSubmitting?.value));
const isWalletConnecting = computed(() => Boolean(props.state.isWalletConnecting?.value));
const walletAddress = computed(() => String(props.state.walletAddress?.value ?? ""));
const selectedListingId = computed(() => String(props.state.selectedListingId?.value ?? ""));
const selectedListing = computed(() => (props.state.selectedListing?.value ?? null) as MarketListing | null);
const selectedListingHasPendingRefund = computed(() => Boolean(props.state.selectedListingHasPendingRefund?.value));
const canCreateListing = computed(() => Boolean(props.state.canCreateListing?.value));
const canManageSelectedListing = computed(() => Boolean(props.state.canManageSelectedListing?.value));
const canBuySelectedListing = computed(() => Boolean(props.state.canBuySelectedListing?.value));

// -- Local form state --
const marketHash = ref("");

// -- Action handlers --
const handleLoadListings = async () => {
  const handler = actions.get("loadListings");
  if (handler) await handler(marketHash.value);
};

const handleSelectListing = (listing: MarketListing) => {
  const handler = actions.get("selectListing");
  if (handler) handler(listing.id);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.market-play-area { @include console.play-area; }

.summary {
  margin: 0;
  line-height: 1.6;
  color: var(--text-secondary);
}

.empty-state {
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.02);
}

.listings {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.mb-6 { margin-bottom: 14px; }

@media (min-width: 960px) {
  .listings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
