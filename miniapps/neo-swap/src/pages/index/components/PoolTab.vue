<template>
  <view class="tab-content">
    <NeoCard variant="erobo">
      <view class="pool-overview">
        <text class="pool-title">{{ t("poolSubtitle") }}</text>
        <text class="pool-subtitle">{{ t("poolInfo") }}</text>

        <NeoStats :stats="poolStats" />

        <view v-if="routerAddress" class="router-row">
          <text class="router-label">{{ t("routerLabel") }}</text>
          <text class="router-value mono">{{ routerAddress }}</text>
        </view>

        <NeoButton variant="primary" block @click="openDex">
          {{ t("openDex") }}
        </NeoButton>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { WalletSDK } from "@neo/types";
import { NeoCard, NeoStats, NeoButton } from "@shared/components";
import { useDatafeed, useWallet } from "@neo/uniapp-sdk";
import type { StatItem } from "@shared/components/NeoStats.vue";
import type { UniAppGlobals } from "@shared/types/globals";

const props = defineProps<{
  t: (key: string) => string;
}>();

const { getPrice } = useDatafeed();
const { getContractAddress } = useWallet() as WalletSDK;

const neoPrice = ref<number | null>(null);
const gasPrice = ref<number | null>(null);
const routerAddress = ref<string>("");

const poolStats = computed<StatItem[]>(() => [
  { label: "NEO/USD", value: neoPrice.value ? neoPrice.value.toFixed(4) : "--" },
  { label: "GAS/USD", value: gasPrice.value ? gasPrice.value.toFixed(4) : "--" },
  { label: "NEO/GAS", value: priceRatio.value },
]);

const priceRatio = computed(() => {
  if (!neoPrice.value || !gasPrice.value) return "--";
  const ratio = neoPrice.value / gasPrice.value;
  return Number.isFinite(ratio) ? ratio.toFixed(6) : "--";
});

const loadPrices = async () => {
  try {
    const neo = await getPrice("NEO-USD");
    const gas = await getPrice("GAS-USD");
    if (neo?.price) neoPrice.value = Number(neo.price);
    if (gas?.price) gasPrice.value = Number(gas.price);
  } catch (e: unknown) {
    /* non-critical: pool price load */
  }
};

const openDex = () => {
  const url = "https://flamingo.finance";
  const uniApi = (globalThis as unknown as UniAppGlobals)?.uni as
    | Record<string, (...args: unknown[]) => void>
    | undefined;
  if (uniApi?.openURL) {
    uniApi.openURL({ url });
    return;
  }
  const plusApi = (globalThis as unknown as UniAppGlobals)?.plus as
    | Record<string, Record<string, (...args: unknown[]) => void>>
    | undefined;
  if (plusApi?.runtime?.openURL) {
    plusApi.runtime.openURL(url);
    return;
  }
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
};

onMounted(async () => {
  routerAddress.value = (await getContractAddress()) || "";
  loadPrices();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content {
  padding: 24px;
  flex: 1;
}

.pool-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pool-title {
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
}

.pool-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.router-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--swap-panel-border);
  background: var(--swap-chip-bg);
}

.router-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.router-value {
  font-size: 11px;
  word-break: break-all;
}

.mono {
  font-family: $font-mono;
}
</style>
