<template>
  <MiniAppPage
    name="gov-merc"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-neo" compact>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ formatNum(totalPool, 0) }}</span>
                <span class="hero-stat-label">{{ t("totalPool") }} {{ t("tokenNeo") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ bids.length }}</span>
                <span class="hero-stat-label">{{ t("activeBids") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ currentEpoch }}</span>
                <span class="hero-stat-label">{{ t("currentEpoch") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <NeoCard class="mb-6" variant="erobo">
        <div class="form-group-neo">
          <NeoInput v-model="depositAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenNeo')" :label="t('depositAmount')" :min="0" />
          <NeoButton type="button" variant="primary" size="lg" block :loading="isBusy" @click="depositNeo">
            {{ t("depositNeo") }}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard class="mb-6" variant="erobo">
        <div class="form-group-neo">
          <NeoInput v-model="withdrawAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenNeo')" :label="t('withdrawAmount')" :min="0" />
          <NeoButton type="button" variant="secondary" size="lg" block :loading="isBusy" @click="withdrawNeo">
            {{ t("withdrawNeo") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('placeBid')" class="mb-6">
        <div class="form-group-neo">
          <NeoInput v-model="bidAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenGas')" :label="t('bidAmount')" :min="0" />
          <NeoButton type="button" variant="primary" size="lg" block :loading="isBusy" @click="placeBid">
            {{ t("placeBid") }}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard variant="erobo">
        <div v-if="bids.length === 0" class="empty-neo p-8 text-center font-bold uppercase opacity-60">
          {{ t("noBids") }}
        </div>
        <div v-for="bid in bids" :key="bid.address" class="bid-row">
          <div class="bid-address">{{ bid.address }}</div>
          <div class="bid-amount">{{ formatNum(bid.amount, 2) }} {{ t("tokenGas") }}</div>
        </div>
      </NeoCard>
    </template>

    <template #tab-stats>
      <StatsTab :grid-items="poolStats" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoButton, NeoInput, NeoCard, HeroSection } from "@shared/components";
import { useGovMercPool } from "@/composables/useGovMercPool";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "gov-merc",
  messages,
  template: {
    tabs: [
      { key: "rent", labelKey: "rent", icon: "💰", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
  },
  sidebarItems: [
    { labelKey: "totalPool", value: () => `${formatNum(totalPool.value, 0)} ${t("tokenNeo")}` },
    { labelKey: "currentEpoch", value: () => currentEpoch.value },
    { labelKey: "yourDeposits", value: () => `${formatNum(userDeposits.value, 0)} ${t("tokenNeo")}` },
    { labelKey: "activeBids", value: () => bids.value.length },
  ],
});

const {
  address,
  depositAmount,
  withdrawAmount,
  bidAmount,
  totalPool,
  currentEpoch,
  userDeposits,
  bids,
  status,
  dataLoading,
  isBusy,
  poolStats,
  formatNum,
  depositNeo,
  withdrawNeo,
  placeBid,
} = useGovMercPool(t);

const appState = computed(() => ({
  address: address.value,
  totalPool: totalPool.value,
  currentEpoch: currentEpoch.value,
  isLoading: dataLoading.value,
}));
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./gov-merc-theme.scss" as *;

:global(body) {
  background: var(--merc-bg);
}

.hero-container {
  margin-bottom: 20px;
}

.hero-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-stat {
  text-align: center;
  padding: 8px 14px;
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--font-family-mono, "Courier New", monospace);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

.form-group-neo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-neo {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--merc-empty-text);
  text-align: center;
  text-shadow: var(--merc-empty-shadow);
  padding: 32px;
}

.bid-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dotted var(--merc-bid-divider);
}
.bid-address {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 10px;
  color: var(--merc-bid-address);
}
.bid-amount {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-weight: 700;
  color: var(--merc-bid-amount);
  text-shadow: var(--merc-bid-amount-shadow);
}

.status-text {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--merc-status-text);
}

/* ── Gov Merc Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(120, 40, 200, 0.12) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

@keyframes sword-cross {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.85;
  }
  25% {
    transform: rotate(8deg) scale(1.06);
    opacity: 1;
  }
  50% {
    transform: rotate(-5deg) scale(0.98);
    opacity: 0.8;
  }
  75% {
    transform: rotate(3deg) scale(1.03);
    opacity: 0.95;
  }
}

@keyframes power-aura {
  0%,
  100% {
    box-shadow:
      0 0 15px rgba(120, 40, 200, 0.1),
      0 0 30px rgba(120, 40, 200, 0.05);
  }
  50% {
    box-shadow:
      0 0 25px rgba(120, 40, 200, 0.25),
      0 0 50px rgba(120, 40, 200, 0.1),
      0 0 80px rgba(120, 40, 200, 0.05);
  }
}

@keyframes merc-gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-stat {
    animation: none;
  }
  :deep(.hero-icon) {
    animation: none;
  }
}

.hero-stat {
  background: linear-gradient(135deg, rgba(120, 40, 200, 0.12) 0%, rgba(0, 229, 153, 0.06) 100%);
  background-size: 200% 200%;
  animation:
    power-aura 4s ease-in-out infinite,
    merc-gradient-shift 8s ease infinite;
  border: 1px solid rgba(120, 40, 200, 0.15);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 28px rgba(120, 40, 200, 0.35);
    transform: translateY(-1px);
  }
}

.hero-stat:nth-child(2) {
  animation-delay: 0.4s;
}

.hero-stat:nth-child(3) {
  animation-delay: 0.8s;
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(120, 40, 200, 0.35);
}

:deep(.hero-icon) {
  animation: sword-cross 4s ease-in-out infinite;
  transform-origin: center center;
}

.bid-row {
  transition: background 0.2s ease;

  &:hover {
    background: rgba(120, 40, 200, 0.05);
  }
}

.bid-amount {
  text-shadow: 0 0 6px rgba(0, 229, 153, 0.3);
}
</style>
