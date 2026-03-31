<template>
  <div class="price-play-area">
    <!-- Result Section -->
    <div class="result-card">
      <span class="result-symbol">{{ asset }}</span>
      <span class="result-price">{{ priceDisplay }}</span>
    </div>

    <!-- Operation Section -->
    <div class="stack">
      <NeoInput :modelValue="asset" :label="t('asset')" :placeholder="t('assetPlaceholder')" @update:modelValue="updateAsset($event)" />
      <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleFetchPrice" :aria-label="t('fetchPrice')">{{ t("fetchPrice") }}</NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const asset = computed(() => String(props.state.asset?.value ?? "NEO"));
const priceDisplay = computed(() => String(props.state.priceDisplay?.value ?? t("notAvailable")));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const updateAsset = (val: string) => {
  const handler = actions.get("updateAsset");
  if (handler) handler(val);
};
const handleFetchPrice = async () => {
  const handler = actions.get("fetchPrice");
  if (handler) await handler();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.price-play-area { @include console.play-area; }
.stack { @include console.stack; }

.result-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  @include console.console-output;
  padding: 20px;
}

.result-symbol { @include console.section-header; letter-spacing: 0.12em; }

.result-price {
  font-size: 32px;
  font-weight: 900;
  color: #00e599;
  font-family: 'JetBrains Mono', var(--font-mono, monospace);
}
</style>
