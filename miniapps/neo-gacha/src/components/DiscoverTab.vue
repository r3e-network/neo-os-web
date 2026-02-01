<template>
  <view class="tab-content">
    <NeoCard variant="erobo" class="section-card">
      <NeoInput v-model="searchQuery" :placeholder="t('searchPlaceholder')" />
      <view class="chip-row">
        <NeoButton
          size="sm"
          :variant="selectedCategory === null ? 'primary' : 'secondary'"
          @click="selectedCategory = null"
        >
          All
        </NeoButton>
        <NeoButton
          v-for="category in categories"
          :key="category"
          size="sm"
          :variant="selectedCategory === category ? 'primary' : 'secondary'"
          @click="selectedCategory = category"
        >
          {{ category }}
        </NeoButton>
      </view>
      <view class="chip-row">
        <NeoButton
          size="sm"
          :variant="sortMode === 'popular' ? 'primary' : 'secondary'"
          @click="sortMode = 'popular'"
        >
          {{ t("sortPopular") }}
        </NeoButton>
        <NeoButton
          size="sm"
          :variant="sortMode === 'newest' ? 'primary' : 'secondary'"
          @click="sortMode = 'newest'"
        >
          {{ t("sortNewest") }}
        </NeoButton>
        <NeoButton
          size="sm"
          :variant="sortMode === 'priceLow' ? 'primary' : 'secondary'"
          @click="sortMode = 'priceLow'"
        >
          {{ t("sortPriceLow") }}
        </NeoButton>
        <NeoButton
          size="sm"
          :variant="sortMode === 'priceHigh' ? 'primary' : 'secondary'"
          @click="sortMode = 'priceHigh'"
        >
          {{ t("sortPriceHigh") }}
        </NeoButton>
      </view>
    </NeoCard>

    <view v-if="isLoading" class="loading-state">
      {{ t("loadingMachines") }}
    </view>
    <view v-else-if="sortedMachines.length === 0" class="empty-state">
      {{ t("noMachines") }}
    </view>
    <view v-else class="grid-container">
      <GachaCard
        v-for="machine in sortedMachines"
        :key="machine.id"
        :machine="machine"
        @select="$emit('select-machine', machine)"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import GachaCard from "../pages/index/components/GachaCard.vue";

interface MachineItem {
  name: string;
  probability: number;
  displayProbability: number;
  rarity: string;
  assetType: number;
  assetHash: string;
  amountRaw: number;
  amountDisplay: string;
  tokenId: string;
  stockRaw: number;
  stockDisplay: string;
  tokenCount: number;
  decimals: number;
  available: boolean;
  icon?: string;
}

interface Machine {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  tagsList: string[];
  creator: string;
  creatorHash: string;
  owner: string;
  ownerHash: string;
  price: string;
  priceRaw: number;
  itemCount: number;
  totalWeight: number;
  availableWeight: number;
  plays: number;
  revenue: string;
  revenueRaw: number;
  sales: number;
  salesVolume: string;
  salesVolumeRaw: number;
  createdAt: number;
  lastPlayedAt: number;
  active: boolean;
  listed: boolean;
  banned: boolean;
  locked: boolean;
  forSale: boolean;
  salePrice: string;
  salePriceRaw: number;
  inventoryReady: boolean;
  items: MachineItem[];
  topPrize?: string;
  winRate?: number;
}

const props = defineProps<{
  machines: Machine[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "select-machine", machine: Machine): void;
}>();

const { t } = useI18n();

const searchQuery = ref("");
const selectedCategory = ref<string | null>(null);
const sortMode = ref("popular");

const marketMachines = computed(() =>
  props.machines.filter((machine) => machine.active && machine.listed && !machine.banned),
);

const categories = computed(() => {
  const set = new Set<string>();
  props.machines.forEach((machine) => {
    if (machine.category) set.add(machine.category);
  });
  return Array.from(set.values());
});

const filteredMachines = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return marketMachines.value.filter((machine) => {
    if (selectedCategory.value && machine.category !== selectedCategory.value) return false;
    if (!query) return true;
    const haystack = [
      machine.name,
      machine.creator,
      machine.owner,
      machine.category,
      machine.tags,
      ...(machine.tagsList || []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

const sortedMachines = computed(() => {
  const items = [...filteredMachines.value];
  switch (sortMode.value) {
    case "newest":
      return items.sort((a, b) => b.createdAt - a.createdAt);
    case "priceLow":
      return items.sort((a, b) => a.priceRaw - b.priceRaw);
    case "priceHigh":
      return items.sort((a, b) => b.priceRaw - a.priceRaw);
    default:
      return items.sort((a, b) => b.plays - a.plays);
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chip-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
