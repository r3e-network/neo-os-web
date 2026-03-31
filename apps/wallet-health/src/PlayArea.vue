<template>
  <div class="health-play-area">
    <!-- ── Hero Section ── -->
    <div class="hero-container">
      <HeroSection variant="accent" compact>
        <template #background>
          <div class="health-gauge-scene" aria-hidden="true">
            <div class="gauge-ring" :style="{ '--score': safetyScore }">
              <span class="gauge-value" :class="riskClass">{{ safetyScore }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <!-- ── Risk Alerts ── -->
    <div v-if="riskLabel" class="risk-alert" :class="riskClass">
      <span class="risk-icon">{{ riskIcon }}</span>
      <span class="risk-text">{{ riskLabel }}</span>
    </div>

    <!-- ── Not Connected State ── -->
    <div v-if="!isConnected" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" @click="handleAction('connectWallet')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <!-- ── Health Dashboard ── -->
    <div v-else class="health-stack">
      <div class="stats-grid">
        <div v-for="stat in healthStats" :key="stat.label" class="stat-item">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value">{{ stat.value }}</span>
        </div>
      </div>

      <NeoButton
        size="sm"
        variant="secondary"
        :disabled="isRefreshing"
        @click="handleAction('refreshBalances')"
      >
        {{ isRefreshing ? t("loading") : t("refresh") }}
      </NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Wallet Health
 *
 * Presentation-only. All logic, derived state, and formatting live in
 * composables and are wired through main.ts setup() -> props.state.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import type { HealthStat } from "./composables/useWalletHealth";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings (read-only from composable via main.ts) ───────────
const safetyScore = computed(() => Number(props.state.safetyScore?.value ?? 0));
const riskLabel = computed(() => String(props.state.riskLabel?.value ?? ""));
const riskClass = computed(() => String(props.state.riskClass?.value ?? ""));
const riskIcon = computed(() => String(props.state.riskIcon?.value ?? ""));
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value ?? false));
const healthStats = computed(() => {
  const raw = props.state.healthStats?.value;
  return Array.isArray(raw) ? (raw as HealthStat[]) : [];
});

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleAction = async (name: string) => {
  const handler = actions.get(name);
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.health-play-area { @include console.play-area; min-height: 300px; }

.hero-container {
  margin-bottom: 20px;
  background: radial-gradient(ellipse at 50% 40%, var(--health-accent-soft, rgba(0, 229, 153, 0.08)) 0%, transparent 55%);
}

.health-gauge-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

.gauge-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(var(--health-accent, #00e599) calc(var(--score, 0) * 1%), rgba(255, 255, 255, 0.08) 0);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: heartbeat-pulse 2.5s ease-in-out infinite;
  box-shadow: 0 0 20px var(--health-accent-glow, rgba(0, 229, 153, 0.2));

  &::before {
    content: "";
    position: absolute;
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: var(--health-bg-start, #0a0a0a);
  }
}

.gauge-value {
  position: relative;
  z-index: 1;
  font-size: 22px;
  font-weight: 900;
  color: var(--health-accent-strong, #00e599);
  text-shadow: 0 0 12px var(--health-accent-glow-strong, rgba(0, 229, 153, 0.4));
}

.risk-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.risk-icon { font-size: 16px; }

.empty-state { text-align: center; }

.health-stack { @include console.stack(16px); }

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item { @include console.stat-row; }
.stat-label { @include console.stat-label; }
.stat-value { @include console.stat-value; }

@keyframes heartbeat-pulse {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.08); }
  28% { transform: scale(1); }
  42% { transform: scale(1.12); }
  56% { transform: scale(1); }
}

@media (max-width: 480px) {
  .gauge-ring { width: 64px; height: 64px; }
  .gauge-ring::before { width: 50px; height: 50px; }
  .gauge-value { font-size: 18px; }
  .health-gauge-scene { height: 80px; }
}

@media (prefers-reduced-motion: reduce) {
  .gauge-ring { animation: none; }
}
</style>
