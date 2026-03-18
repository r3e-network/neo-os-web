<template>
  <MiniAppPage name="aa-market-hub" :config="templateConfig" :state="appState" :t="t" :status-message="status"
    :sidebar-items="sidebarItems" :sidebar-title="sidebarTitle" :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError" :on-boundary-retry="loadListings">
    <template #content>
      <HeroSection variant="erobo" icon="🏪" compact>
        <template #stats><HeroStatsStrip :items="heroStats" compact /></template>
      </HeroSection>
      <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />
      <div class="listings">
        <NeoCard v-for="listing in listings" :key="listing.id" variant="erobo" class="listing-card">
          <div class="row"><span class="label">Listing</span><span class="value">#{{ listing.id }}</span></div>
          <div class="row"><span class="label">AA Contract</span><span class="value">{{ listing.aaContractHash }}</span></div>
          <div class="row"><span class="label">AccountId</span><span class="value">{{ listing.accountIdHash }}</span></div>
          <div class="row"><span class="label">Seller</span><span class="value">{{ listing.seller }}</span></div>
          <div class="row"><span class="label">Buyer</span><span class="value">{{ listing.buyer || "—" }}</span></div>
          <div class="row"><span class="label">Price</span><span class="value">{{ listing.price }}</span></div>
          <div class="row"><span class="label">Status</span><span class="value">{{ listing.status }}</span></div>
        </NeoCard>
      </div>
    </template>
    <template #operation>
      <NeoCard variant="erobo" :title="t('loadListings')" class="px-1">
        <div class="stack">
          <NeoInput v-model="marketHash" :label="t('marketHash')" placeholder="0x..." />
          <NeoButton variant="primary" :loading="isLoading" @click="loadListings">{{ t("loadListings") }}</NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { HeroSection, HeroStatsStrip, MiniAppPage, NeoButton, NeoCard, NeoInput, StatsDisplay } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";

const wallet = useWallet() as WalletSDK;
const { invokeRead } = wallet;
const marketHash = ref("");
const listings = ref<Array<{ id: string; aaContractHash: string; accountIdHash: string; seller: string; buyer: string; price: string; status: string }>>([]);
const isLoading = ref(false);
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createMiniApp({
  name: "aa-market-hub", messages,
  template: { tabs: [{ key: "market", labelKey: "totalListings", icon: "🏪", default: true }], docSubtitleKey: "docsSubtitle", docFeatureCount: 3 },
  sidebarItems: [{ labelKey: "totalListings", value: () => listings.value.length }, { labelKey: "marketHash", value: () => marketHash.value || "—" }],
});

function decodeListing(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  return {
    id: String(raw[0] ?? ""),
    aaContractHash: String(raw[1] ?? ""),
    accountIdHash: String(raw[2] ?? ""),
    seller: String(raw[3] ?? ""),
    price: String(raw[4] ?? ""),
    status: String(raw[7] ?? ""),
    buyer: String(raw[8] ?? ""),
  };
}

async function loadListings() {
  try {
    isLoading.value = true;
    const hash = normalizeScriptHash(marketHash.value);
    const countResult = await invokeRead({ scriptHash: hash, operation: "getListingCount", args: [] });
    const count = Number(parseInvokeResult(countResult) || 0);
    const next = [];
    for (let id = 1; id <= count; id += 1) {
      const listing = await invokeRead({ scriptHash: hash, operation: "getListing", args: [{ type: "Integer", value: String(id) }] });
      const decoded = decodeListing(parseInvokeResult(listing));
      if (decoded) next.push(decoded);
    }
    listings.value = next;
    setStatus("market loaded", "success");
  } catch (e) {
    setStatus(String((e as Error)?.message || e), "error");
  } finally {
    isLoading.value = false;
  }
}

const heroStats = computed<HeroStatsStripItem[]>(() => [
  { label: "Listings", value: listings.value.length, icon: "📦" },
  { label: "Mode", value: "read-only", icon: "👁" },
]);
const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: "Market Hash", value: marketHash.value || "unset", variant: "accent" },
]);
const appState = computed(() => ({ totalListings: listings.value.length }));
</script>
<style scoped>.stack{display:flex;flex-direction:column;gap:14px}.listings{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:14px}.listing-card{padding:14px}.row{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:6px 0}.label{font-size:11px;opacity:.6;text-transform:uppercase}.value{font-size:13px;word-break:break-all}@media (min-width: 900px){.listings{grid-template-columns:repeat(2,minmax(0,1fr));}}</style>
