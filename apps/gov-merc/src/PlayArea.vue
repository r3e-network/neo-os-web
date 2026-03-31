<template>
  <div class="gov-merc-play-area">
    <MercHeroStats
      :t="t"
      :total-pool="totalPool"
      :bid-count="bids.length"
      :current-epoch="currentEpoch"
    />

    <MercActionCards
      :t="t"
      :is-busy="isBusy"
      :deposit-amount-ref="state.depositAmount as Ref<string> | undefined"
      :withdraw-amount-ref="state.withdrawAmount as Ref<string> | undefined"
      :bid-amount-ref="state.bidAmount as Ref<string> | undefined"
    />

    <MercBidsList :t="t" :bids="bids" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ref } from "vue";
import MercHeroStats from "./components/MercHeroStats.vue";
import MercActionCards from "./components/MercActionCards.vue";
import MercBidsList from "./components/MercBidsList.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const totalPool = computed(() => Number(props.state.totalPool?.value ?? 0));
const currentEpoch = computed(() => Number(props.state.currentEpoch?.value ?? 0));
const bids = computed(() => (props.state.bids?.value ?? []) as Array<{ address: string; amount: number }>);
const isBusy = computed(() => Boolean(props.state.isBusy?.value ?? false));
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/gov-merc-theme.scss" as *;

:global(body) {
  background: var(--merc-bg);
}

.gov-merc-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
