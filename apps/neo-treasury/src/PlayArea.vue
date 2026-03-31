<template>
  <div class="treasury-play-area">
    <TreasuryHero
      :t="t"
      :total-usd="data?.totalUsd"
      :total-neo="data?.totalNeo"
      :total-gas="data?.totalGas"
    />

    <!-- Main Content -->
    <div v-if="data">
      <TreasuryLoadingState :t="t" :loading="loading" :error="''" :has-data="true" />

      <TotalSummaryCard
        :total-usd="data.totalUsd"
        :total-neo="data.totalNeo"
        :total-gas="data.totalGas"
        :last-updated="data.lastUpdated"
        :t="t"
      />

      <PriceGrid :prices="data.prices" />

      <FoundersList :categories="data.categories" :t="t" @select="goToFounder" />
    </div>

    <!-- Initial Loading / Error States -->
    <TreasuryLoadingState
      v-else
      :t="t"
      :loading="loading"
      :error="error"
      :has-data="false"
      @retry="handleRefresh"
    />

    <!-- Operation Panel Inline -->
    <NeoCard variant="erobo" :title="t('treasuryInfo')">
      <NeoButton type="button" size="sm" variant="primary" class="op-btn" :disabled="loading" @click="handleRefresh">
        {{ loading ? t("refreshing") : t("refreshData") }}
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoCard } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import TreasuryHero from "./components/TreasuryHero.vue";
import TreasuryLoadingState from "./components/TreasuryLoadingState.vue";
import TotalSummaryCard from "./pages/index/components/TotalSummaryCard.vue";
import PriceGrid from "./pages/index/components/PriceGrid.vue";
import FoundersList from "./pages/index/components/FoundersList.vue";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: string;
  prices: Record<string, unknown>;
  categories: Array<{ name: string; [key: string]: unknown }>;
}

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const data = computed(() => props.state.data?.value as TreasuryData | null);
const loading = computed(() => Boolean(props.state.loading?.value ?? false));
const error = computed(() => String(props.state.error?.value ?? ""));

const goToFounder = (_name: string) => {
  // Tab navigation handled by platform
};

const handleRefresh = async () => {
  const handler = actions.get("refresh");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/neo-treasury-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.treasury-play-area { @include console.play-area; }

.op-btn { width: 100%; }
</style>
