<template>
  <div class="survivor-play-area">
    <div class="hero-container">
      <DangerRingHero
        :t="t"
        :countdown="countdown"
        :danger-level="dangerLevel"
        :should-pulse="shouldPulse"
        :formatted-pot="formatNum(totalPot)"
        :can-claim="canClaim"
        :is-claiming="isClaiming"
        @claim="handleClaimPrize"
      />

      <DangerMeter
        :t="t"
        :level="dangerLevel"
        :level-text="dangerLevelText"
        :progress="dangerProgress"
      />
    </div>

    <!-- Buy Keys Card -->
    <NeoCard v-if="isRoundActive && !canClaim" variant="erobo" class="buy-keys-card">
      <BuyKeysCard
        v-model:keyCount="localKeyCount"
        :estimated-cost="estimatedCost"
        :is-paying="isBuyingKeys"
        :validation-error="keyValidationError"
        @buy="handleBuyKeys"
      />
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import DangerRingHero from "./components/DangerRingHero.vue";
import DangerMeter from "./components/DangerMeter.vue";
import BuyKeysCard from "./pages/index/components/BuyKeysCard.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const totalPot = computed(() => Number(props.state.totalPot?.value ?? 0));
const canClaim = computed(() => Boolean(props.state.canClaim?.value ?? false));
const isClaiming = computed(() => Boolean(props.state.isClaiming?.value ?? false));
const isBuyingKeys = computed(() => Boolean(props.state.isBuyingKeys?.value ?? false));
const isRoundActive = computed(() => Boolean(props.state.isRoundActive?.value ?? false));
const countdown = computed(() => String(props.state.countdown?.value ?? "00:00:00"));
const dangerLevel = computed(() => String(props.state.dangerLevel?.value ?? "low"));
const dangerLevelText = computed(() => String(props.state.dangerLevelText?.value ?? ""));
const dangerProgress = computed(() => Number(props.state.dangerProgress?.value ?? 0));
const shouldPulse = computed(() => Boolean(props.state.shouldPulse?.value ?? false));
const estimatedCost = computed(() => String(props.state.estimatedCost?.value ?? "0.00"));
const keyValidationError = computed(() => props.state.keyValidationError?.value as string | null);

// ── Local state ───────────────────────────────────────────────────────
const localKeyCount = ref("1");

// ── Helpers ───────────────────────────────────────────────────────────
const formatNum = (n: number) => formatNumber(n, 2);

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleBuyKeys = async () => {
  const handler = actions.get("buyKeys");
  if (handler) {
    const result = await handler(localKeyCount.value);
    if (result !== undefined) {
      localKeyCount.value = "1";
    }
  }
};

const handleClaimPrize = async () => {
  const handler = actions.get("claimPrize");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
.survivor-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 24px;
  padding: 24px 16px;
  width: 100%;
}

.buy-keys-card {
  width: 100%;
  max-width: 400px;
}
</style>
