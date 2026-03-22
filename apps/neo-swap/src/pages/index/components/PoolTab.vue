<template>
  <div class="tab-content">
    <NeoCard variant="erobo" :title="t('poolSubtitle')">
      <div class="pool-overview">
        <span class="pool-subtitle">{{ t("poolInfo") }}</span>

        <div v-if="routerAddress" class="router-row">
          <span class="router-label">{{ t("routerLabel") }}</span>
          <span class="router-value mono">{{ routerAddress }}</span>
        </div>

        <NeoButton variant="primary" block type="button" @click="openDex">
          {{ t("openDex") }}
        </NeoButton>
      </div>
      <StatsDisplay :items="poolStats" layout="rows" />
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { NeoCard, StatsDisplay, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { useWallet } from "@shared/utils/wallet-sdk";
import { getPrices } from "@shared/utils/price";
import type { UniAppGlobals } from "@shared/types/globals";

const { t } = createUseI18n(messages)();

const { getContractAddress } = useWallet() as WalletSDK;

const priceData = ref<{ neo: number; neoBurger: number } | null>(null);
const routerAddress = ref<string>("");
const isMounted = ref(true);

const poolStats = computed<StatsDisplayItem[]>(() => [
  { label: `${t("tokenNeo")}/USD`, value: priceData.value ? priceData.value.neo.toFixed(2) : t("notAvailable") },
  { label: `${t("tokenNeo")}/${t("tokenGas")}`, value: priceRatio.value },
]);

const priceRatio = computed(() => {
  if (!priceData.value) return t("notAvailable");
  // neoBurger price is in NEO terms per price.ts
  const ratio = priceData.value.neo / priceData.value.neoBurger;
  return Number.isFinite(ratio) ? ratio.toFixed(6) : t("notAvailable");
});

const loadPrices = async () => {
  try {
    const prices = await getPrices();
    priceData.value = { neo: prices.neo, neoBurger: prices.neoBurger };
  } catch (e: unknown) {
    console.warn("[neo-swap] pool price load failed:", e instanceof Error ? e.message : String(e));
  }
};

const openDex = () => {
  const url = "https://flamingo.finance";
  // Double-cast needed: globalThis is untyped, UniAppGlobals provides platform API types.
  // First cast to 'unknown' then to UniAppGlobals to satisfy TypeScript's strict casting rules.
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
  if (!isMounted.value) return;
  try {
    routerAddress.value = (await getContractAddress()) || "";
    await loadPrices();
  } catch (_e: unknown) {
    console.warn("[neo-swap] initial data load failed:", _e instanceof Error ? _e.message : String(_e));
  }
});

onUnmounted(() => {
  isMounted.value = false;
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

@media (max-width: 480px) {
  .tab-content {
    padding: 16px;
  }

  .router-row {
    padding: 8px;
  }

  .router-value {
    font-size: 10px;
  }
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
