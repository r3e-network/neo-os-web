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

    <!-- Last Buyer Badge -->
    <div v-if="lastBuyer && isRoundActive" class="last-buyer-badge">
      <span class="last-buyer-icon" aria-hidden="true">&#x1F451;</span>
      <div class="last-buyer-info">
        <span class="last-buyer-label">{{ t("lastBuyer") || "CURRENT LEADER" }}</span>
        <span class="last-buyer-address">{{ formatBuyerAddress(lastBuyer) }}</span>
      </div>
      <span class="last-buyer-hint">{{ t("timeUntilEvent") }}</span>
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
const lastBuyer = computed(() => (props.state.lastBuyer?.value ?? "") as string);

const formatBuyerAddress = (addr: string) => {
  if (!addr || addr.length < 10) return addr || "---";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

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
@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap");

.survivor-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  position: relative;
  font-family: "Orbitron", monospace;
  background:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 49px,
      rgba(220, 38, 38, 0.04) 49px,
      rgba(220, 38, 38, 0.04) 50px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 49px,
      rgba(220, 38, 38, 0.04) 49px,
      rgba(220, 38, 38, 0.04) 50px
    );

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: repeating-linear-gradient(
      90deg,
      #dc2626 0,
      #dc2626 20px,
      #eab308 20px,
      #eab308 40px
    );
    animation: hazard-scroll 2s linear infinite;
  }

  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: repeating-linear-gradient(
      90deg,
      #eab308 0,
      #eab308 20px,
      #dc2626 20px,
      #dc2626 40px
    );
    animation: hazard-scroll 2s linear infinite reverse;
  }
}

@keyframes hazard-scroll {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 0;
  }
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
  position: relative;
  z-index: 1;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 30%, rgba(220, 38, 38, 0.12) 0%, transparent 70%);
    pointer-events: none;
  }
}

.buy-keys-card {
  width: 100%;
  max-width: 400px;
  background: rgba(220, 38, 38, 0.05);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 4px;
  padding: 20px;
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 1;
  box-shadow:
    0 0 20px rgba(220, 38, 38, 0.08),
    inset 0 1px 0 rgba(234, 179, 8, 0.1);

  &::before {
    content: "// ACQUIRE KEYS";
    position: absolute;
    top: -10px;
    left: 16px;
    font-family: "Orbitron", monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: #eab308;
    background: #0a0a0a;
    padding: 2px 8px;
    text-transform: uppercase;
  }
}

:deep(.neo-card) {
  font-family: "Orbitron", monospace;
  border-radius: 4px;
}

:deep(.neo-btn) {
  font-family: "Orbitron", monospace;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

/* Last Buyer Badge */
.last-buyer-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: rgba(234, 179, 8, 0.06);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 8px;
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  animation: leader-glow 3s ease-in-out infinite;
}

.last-buyer-icon {
  font-size: 22px;
}

.last-buyer-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.last-buyer-label {
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: rgba(234, 179, 8, 0.6);
  text-transform: uppercase;
}

.last-buyer-address {
  font-size: 13px;
  font-weight: 800;
  font-family: "Orbitron", monospace;
  color: #eab308;
  filter: drop-shadow(0 0 6px rgba(234, 179, 8, 0.3));
}

.last-buyer-hint {
  font-size: 8px;
  font-weight: 700;
  color: rgba(220, 38, 38, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

@keyframes leader-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.1); }
  50% { box-shadow: 0 0 18px rgba(234, 179, 8, 0.2); }
}

@media (prefers-reduced-motion: reduce) {
  .survivor-play-area {
    &::before,
    &::after {
      animation: none;
    }
  }
}
</style>
