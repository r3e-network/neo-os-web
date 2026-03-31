<template>
  <div class="breakup-play-area">
    <div class="hero-container">
      <HeroSection variant="danger" icon="broken_heart" compact>
        <template #background>
          <div class="contract-scene" aria-hidden="true">
            <div class="contract-doc">
              <div class="contract-line" v-for="i in 4" :key="i" />
              <div class="contract-signatures">
                <AppIcon name="signature" :size="24" class="signature signature--left" />
                <AppIcon name="signature" :size="24" class="signature signature--right" />
              </div>
            </div>
          </div>
        </template>
        <template #stats>
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">{{ activeCount }}</span>
              <span class="hero-stat-label">{{ t("active") }}</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">{{ pendingCount }}</span>
              <span class="hero-stat-label">{{ t("pending") }}</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">{{ contractCount }}</span>
              <span class="hero-stat-label">{{ t("total") }}</span>
            </div>
          </div>
        </template>
      </HeroSection>
    </div>

    <ContractList :contracts="contracts" :address="address" @sign="handleSign" @break="handleBreak" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, AppIcon } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import ContractList from "./pages/index/components/ContractList.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const contracts = computed(() => (props.state.contracts?.value ?? []) as unknown[]);
const address = computed(() => props.state.address?.value as string | null);
const activeCount = computed(() => Number(props.state.activeCount?.value ?? 0));
const pendingCount = computed(() => Number(props.state.pendingCount?.value ?? 0));
const contractCount = computed(() => Number(props.state.contractCount?.value ?? 0));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleSign = async (contract: unknown) => {
  const handler = actions.get("signContract");
  if (handler) await handler(contract);
};

const handleBreak = async (contract: unknown) => {
  const handler = actions.get("breakContract");
  if (handler) await handler(contract);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/breakup-contract-theme.scss" as *;

.breakup-play-area { display: flex; flex-direction: column; gap: 24px; padding: 20px 12px; min-height: 300px; }
.hero-container { background: radial-gradient(ellipse at center, rgba(255, 70, 100, 0.12) 0%, transparent 70%); }
.contract-scene { display: flex; justify-content: center; align-items: center; height: 120px; padding: 16px; }
.contract-doc { width: 100px; background: linear-gradient(135deg, rgba(255, 70, 100, 0.1) 0%, rgba(255, 150, 180, 0.06) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; padding: 12px 10px; box-shadow: 0 0 20px rgba(255, 70, 100, 0.15), 0 0 40px rgba(255, 70, 100, 0.05); animation: breakup-card-pulse 4s ease-in-out infinite; }
.contract-line { height: 3px; background: linear-gradient(90deg, rgba(255, 70, 100, 0.12) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 70, 100, 0.12) 100%); border-radius: 2px; margin-bottom: 6px; }
.contract-signatures { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1); animation: heartbeat-crack 3s ease-in-out infinite; }
.signature { font-size: 16px; opacity: 0.8; }
.signature--left { text-shadow: 0 0 10px rgba(255, 70, 100, 0.6); }
.signature--right { text-shadow: 0 0 10px rgba(255, 150, 200, 0.6); }
.hero-stats { display: flex; gap: 16px; justify-content: center; }
.hero-stat { text-align: center; padding: 8px 16px; background: linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 70, 100, 0.06) 100%); border-radius: 8px; border: 1px solid rgba(255, 107, 107, 0.15); }
.hero-stat-value { display: block; font-size: 20px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; text-shadow: 0 0 8px rgba(255, 107, 107, 0.3); }
.hero-stat-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px; margin-top: 2px; }
@keyframes breakup-card-pulse { 0%, 100% { box-shadow: 0 0 20px rgba(255, 70, 100, 0.15), 0 0 40px rgba(255, 70, 100, 0.05); transform: scale(1); } 50% { box-shadow: 0 0 30px rgba(255, 70, 100, 0.3), 0 0 60px rgba(255, 70, 100, 0.1); transform: scale(1.03); } }
@keyframes heartbeat-crack { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; } 25% { transform: scale(1.15) rotate(-2deg); opacity: 1; } 50% { transform: scale(0.95) rotate(1deg); opacity: 0.7; } 75% { transform: scale(1.08) rotate(-1deg); opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) { .contract-doc, .contract-signatures { animation: none; } }
</style>
