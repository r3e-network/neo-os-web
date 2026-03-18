<template>
  <MiniAppPage
    name="aa-market-hub"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadListings"
  >
    <template #content>
      <HeroSection variant="erobo" icon="🏪" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStats" compact />
        </template>
      </HeroSection>

      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

      <NeoCard variant="erobo" class="mb-6">
        <p class="summary">
          Trade deterministic Neo Abstract Account addresses through a trustless GAS escrow market. Settlement
          transfers only the AA shell. Existing verifier, hook, and backup-owner configuration must be reattached by
          the buyer after purchase.
        </p>
      </NeoCard>

      <div v-if="!marketHash.trim()" class="empty-state">
        Enter an AA market contract hash in the operation panel to load listings.
      </div>

      <div v-else-if="listings.length === 0 && !isLoading" class="empty-state">
        No listings found for the current market hash.
      </div>

      <div class="listings">
        <NeoCard
          v-for="listing in listings"
          :key="listing.id"
          variant="erobo"
          class="listing-card"
          :class="{ 'listing-card--selected': listing.id === selectedListingId }"
        >
          <div class="listing-card__header">
            <div>
              <div class="listing-card__title">
                <span>#{{ listing.id }}</span>
                <span class="chip" :class="`chip--${listing.status}`">{{ listing.status }}</span>
                <span v-if="listing.isMine" class="chip chip--mine">{{ t("mine") }}</span>
                <span v-if="hasPendingPayment(listing)" class="chip chip--pending">{{ t("pendingRefund") }}</span>
              </div>
              <p class="listing-card__subtitle">{{ listing.title || t("untitledListing") }}</p>
            </div>
            <NeoButton variant="secondary" @click="selectListing(listing)">
              {{ listing.id === selectedListingId ? t("selected") : t("selectListing") }}
            </NeoButton>
          </div>

          <div class="row"><span class="label">{{ t("priceLabel") }}</span><span class="value">{{ listing.priceGas }} GAS</span></div>
          <div class="row"><span class="label">{{ t("aaContractLabel") }}</span><span class="value">{{ listing.aaContractHash }}</span></div>
          <div class="row"><span class="label">{{ t("accountIdLabel") }}</span><span class="value">{{ listing.accountIdHash }}</span></div>
          <div class="row"><span class="label">{{ t("sellerLabel") }}</span><span class="value">{{ listing.seller || "—" }}</span></div>
          <div class="row"><span class="label">{{ t("buyerLabel") }}</span><span class="value">{{ listing.buyer || "—" }}</span></div>
          <div v-if="listing.metadataUri" class="row">
            <span class="label">{{ t("metadataLabel") }}</span>
            <a class="value value--link" :href="listing.metadataUri" target="_blank" rel="noreferrer">{{ listing.metadataUri }}</a>
          </div>
          <div v-if="hasPendingPayment(listing)" class="row">
            <span class="label">{{ t("myPendingPayment") }}</span>
            <span class="value">{{ formatGasFractions(listing.myPendingPayment) }} GAS</span>
          </div>
        </NeoCard>
      </div>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('walletAndMarket')" class="operation-card">
        <div class="stack">
          <NeoInput v-model="marketHash" :label="t('marketHash')" placeholder="0x..." />
          <NeoButton variant="secondary" :loading="isWalletConnecting" @click="connectWallet">
            {{ walletAddress ? t("walletConnected") : t("connectWallet") }}
          </NeoButton>
          <NeoButton variant="primary" :loading="isLoading" @click="loadListings">{{ t("loadListings") }}</NeoButton>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('createListingTitle')" class="operation-card">
        <div class="stack">
          <NeoInput
            v-model="aaContractHash"
            :label="t('aaContractInput')"
            :hint="t('aaContractHint')"
            placeholder="0x..."
          />
          <NeoInput
            v-model="accountIdHash"
            :label="t('accountIdInput')"
            :hint="t('accountIdHint')"
            placeholder="0x..."
          />
          <NeoInput v-model="priceGas" :label="t('priceInput')" placeholder="1.5" />
          <NeoInput v-model="listingTitle" :label="t('titleInput')" :placeholder="t('titlePlaceholder')" />
          <NeoInput
            v-model="metadataUri"
            type="textarea"
            :label="t('metadataInput')"
            :placeholder="t('metadataPlaceholder')"
          />
          <NeoButton variant="primary" :loading="isSubmitting" :disabled="!canCreateListing" @click="submitCreateListing">
            {{ t("createListingCta") }}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" :title="t('manageListingTitle')" class="operation-card">
        <div v-if="selectedListing" class="stack">
          <div class="selection-summary">
            <div class="selection-summary__title">{{ selectedListing.title || t("untitledListing") }}</div>
            <div class="selection-summary__meta">
              <span>#{{ selectedListing.id }}</span>
              <span>{{ selectedListing.priceGas }} GAS</span>
              <span>{{ selectedListing.status }}</span>
            </div>
          </div>

          <NeoInput
            v-model="nextPriceGas"
            :label="t('newPriceInput')"
            :hint="t('newPriceHint')"
            placeholder="2"
            :disabled="!canManageSelectedListing"
          />

          <NeoButton
            v-if="canManageSelectedListing"
            variant="primary"
            :loading="isSubmitting"
            :disabled="!nextPriceGas.trim()"
            @click="submitUpdatePrice"
          >
            {{ t("updatePriceCta") }}
          </NeoButton>

          <NeoButton
            v-if="canManageSelectedListing"
            variant="secondary"
            :loading="isSubmitting"
            @click="submitCancelSelected"
          >
            {{ t("cancelListingCta") }}
          </NeoButton>

          <NeoInput
            v-if="canBuySelectedListing"
            v-model="newBackupOwner"
            :label="t('newBackupOwnerInput')"
            :hint="t('newBackupOwnerHint')"
            placeholder="Neo address or 0x..."
          />

          <NeoButton
            v-if="canBuySelectedListing"
            variant="primary"
            :loading="isSubmitting"
            @click="submitBuySelected"
          >
            {{ t("buyListingCta") }}
          </NeoButton>

          <NeoButton
            v-if="selectedListingHasPendingRefund"
            variant="secondary"
            :loading="isSubmitting"
            @click="submitRefundSelected"
          >
            {{ t("refundPendingCta") }}
          </NeoButton>
        </div>

        <p v-else class="hint-text">
          {{ t("selectListingHint") }}
        </p>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import {
  buyAddressListing,
  cancelAddressListing,
  createAddressListing,
  formatGasFractions,
  getDefaultAAContractHash,
  listAddressListings,
  refundPendingAddressPurchase,
  type MarketListing,
  updateAddressListingPrice,
} from "@shared/utils/aa-market";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";

const MARKET_HASH_STORAGE_KEY = "aa-market-hub:market-hash";
const AA_HASH_STORAGE_KEY = "aa-market-hub:aa-contract-hash";

const wallet = useWallet() as WalletSDK;

const marketHash = ref("");
const aaContractHash = ref(getDefaultAAContractHash());
const accountIdHash = ref("");
const priceGas = ref("");
const listingTitle = ref("");
const metadataUri = ref("");
const nextPriceGas = ref("");
const newBackupOwner = ref("");
const selectedListingId = ref("");
const listings = ref<MarketListing[]>([]);
const isLoading = ref(false);
const isSubmitting = ref(false);
const isWalletConnecting = ref(false);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "aa-market-hub",
  messages,
  template: { tabs: [{ key: "market", labelKey: "totalListings", icon: "🏪", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [
    { labelKey: "totalListings", value: () => listings.value.length },
    { labelKey: "marketHash", value: () => marketHash.value || "—" },
    { labelKey: "walletLabel", value: () => wallet.address.value || "—" },
  ],
});

const walletAddress = computed(() => wallet.address.value || "");
const selectedListing = computed(() => listings.value.find((listing) => listing.id === selectedListingId.value) ?? null);
const activeListings = computed(() => listings.value.filter((listing) => listing.status === "active").length);
const selectedListingHasPendingRefund = computed(() => {
  const pending = selectedListing.value?.myPendingPayment || "0";
  return BigInt(pending) > 0n;
});
const canCreateListing = computed(() =>
  Boolean(marketHash.value.trim() && aaContractHash.value.trim() && accountIdHash.value.trim() && priceGas.value.trim()));
const canManageSelectedListing = computed(() =>
  Boolean(selectedListing.value && selectedListing.value.status === "active" && selectedListing.value.isMine));
const canBuySelectedListing = computed(() =>
  Boolean(selectedListing.value && selectedListing.value.status === "active" && !selectedListing.value.isMine));

function truncateMiddle(value: string, left = 10, right = 8) {
  if (!value || value.length <= left + right + 3) return value || "—";
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function hasPendingPayment(listing: MarketListing) {
  return BigInt(listing.myPendingPayment || "0") > 0n;
}

function selectListing(listing: MarketListing) {
  selectedListingId.value = listing.id;
  nextPriceGas.value = listing.priceGas;
  newBackupOwner.value = walletAddress.value;
}

function persistConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MARKET_HASH_STORAGE_KEY, marketHash.value.trim());
  window.localStorage.setItem(AA_HASH_STORAGE_KEY, aaContractHash.value.trim());
}

async function connectWallet() {
  try {
    isWalletConnecting.value = true;
    await wallet.connect();
    newBackupOwner.value = walletAddress.value;
    setStatus(`${t("walletConnected")}: ${walletAddress.value}`, "success");
    if (marketHash.value.trim()) {
      await loadListings();
    }
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  } finally {
    isWalletConnecting.value = false;
  }
}

async function loadListings() {
  try {
    if (!marketHash.value.trim()) {
      throw new Error("Market hash is required.");
    }
    isLoading.value = true;
    listings.value = await listAddressListings(wallet, marketHash.value, walletAddress.value);

    if (selectedListingId.value) {
      const nextSelected = listings.value.find((listing) => listing.id === selectedListingId.value);
      if (nextSelected) {
        selectListing(nextSelected);
      } else if (listings.value[0]) {
        selectListing(listings.value[0]);
      } else {
        selectedListingId.value = "";
      }
    } else if (listings.value[0]) {
      selectListing(listings.value[0]);
    }

    persistConfig();
    setStatus(t("marketLoaded"), "success");
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  } finally {
    isLoading.value = false;
  }
}

async function runWriteAction(action: () => Promise<{ txid: string }>, successMessage: string) {
  try {
    isSubmitting.value = true;
    const result = await action();
    setStatus(`${successMessage}: ${result.txid || "submitted"}`, "success");
    await loadListings();
  } catch (error) {
    setStatus(String((error as Error)?.message || error), "error");
  } finally {
    isSubmitting.value = false;
  }
}

async function submitCreateListing() {
  await runWriteAction(
    () => createAddressListing(wallet, marketHash.value, {
      aaContractHash: aaContractHash.value,
      accountIdHash: accountIdHash.value,
      priceGas: priceGas.value,
      title: listingTitle.value,
      metadataUri: metadataUri.value,
    }),
    t("createListingSuccess"),
  );
  accountIdHash.value = "";
  priceGas.value = "";
  listingTitle.value = "";
  metadataUri.value = "";
}

async function submitUpdatePrice() {
  if (!selectedListing.value) return;
  await runWriteAction(
    () => updateAddressListingPrice(wallet, marketHash.value, selectedListing.value!.id, nextPriceGas.value),
    t("updatePriceSuccess"),
  );
}

async function submitCancelSelected() {
  if (!selectedListing.value) return;
  await runWriteAction(
    () => cancelAddressListing(wallet, marketHash.value, selectedListing.value!.id),
    t("cancelListingSuccess"),
  );
}

async function submitBuySelected() {
  if (!selectedListing.value) return;
  await runWriteAction(
    () => buyAddressListing(wallet, marketHash.value, selectedListing.value!.id, { newBackupOwner: newBackupOwner.value }),
    t("buyListingSuccess"),
  );
}

async function submitRefundSelected() {
  if (!selectedListing.value) return;
  await runWriteAction(
    () => refundPendingAddressPurchase(wallet, marketHash.value, selectedListing.value!.id),
    t("refundPendingSuccess"),
  );
}

watch([marketHash, aaContractHash], persistConfig);

onMounted(() => {
  if (typeof window === "undefined") return;
  marketHash.value = window.localStorage.getItem(MARKET_HASH_STORAGE_KEY) || "";
  aaContractHash.value = window.localStorage.getItem(AA_HASH_STORAGE_KEY) || getDefaultAAContractHash();
  newBackupOwner.value = walletAddress.value;
  if (marketHash.value.trim()) {
    void loadListings();
  }
});

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: t("totalListings"), value: listings.value.length, icon: "📦" },
  { label: t("activeListings"), value: activeListings.value, icon: "⚡" },
  { label: t("modeLabel"), value: t("interactiveMode"), icon: "🧩" },
]);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("marketHash"), value: truncateMiddle(marketHash.value || "unset"), variant: "accent" },
  { label: t("walletLabel"), value: truncateMiddle(walletAddress.value || "not connected"), variant: "default" },
  { label: t("selectedListingLabel"), value: selectedListing.value ? `#${selectedListing.value.id}` : "—", variant: "success" },
]);

const appState = computed(() => ({
  totalListings: listings.value.length,
  activeListings: activeListings.value,
  selectedListingId: selectedListingId.value || null,
  walletAddress: walletAddress.value || null,
}));
</script>

<style scoped>
.summary {
  margin: 0;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}

.operation-card + .operation-card {
  margin-top: 14px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.03);
}

.listings {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}

.listing-card {
  padding: 16px;
  border: 1px solid transparent;
}

.listing-card--selected {
  border-color: rgba(159, 157, 243, 0.45);
  box-shadow: 0 0 0 1px rgba(159, 157, 243, 0.24);
}

.listing-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.listing-card__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
}

.listing-card__subtitle {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.72);
}

.row {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 10px;
  padding: 7px 0;
}

.label {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.value {
  font-size: 13px;
  word-break: break-all;
}

.value--link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.3);
}

.chip {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.08);
}

.chip--active {
  background: rgba(34, 197, 94, 0.16);
  color: #8ef0aa;
}

.chip--sold {
  background: rgba(59, 130, 246, 0.16);
  color: #8cc6ff;
}

.chip--cancelled {
  background: rgba(248, 113, 113, 0.16);
  color: #ffb1b1;
}

.chip--mine {
  background: rgba(250, 204, 21, 0.16);
  color: #f8df86;
}

.chip--pending {
  background: rgba(244, 114, 182, 0.16);
  color: #ffb8df;
}

.selection-summary {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.selection-summary__title {
  font-size: 14px;
  font-weight: 700;
}

.selection-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.hint-text {
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.6;
}

@media (min-width: 960px) {
  .listings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
