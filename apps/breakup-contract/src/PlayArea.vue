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
@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

.breakup-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Courier Prime', 'Courier New', monospace;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(30, 64, 175, 0.03) 24px, rgba(30, 64, 175, 0.03) 25px),
    linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%);
  color: #1E293B;
  border-radius: 12px;
  border: 1px solid #CBD5E1;
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.breakup-play-area::before {
  content: "LEGAL DOCUMENT";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 48px;
  font-weight: 700;
  color: rgba(220, 38, 38, 0.04);
  letter-spacing: 12px;
  white-space: nowrap;
  pointer-events: none;
  font-family: 'Courier Prime', monospace;
}

.hero-container {
  background: none;
  border-bottom: 2px solid #CBD5E1;
  padding-bottom: 16px;
  position: relative;
  z-index: 1;
}

.contract-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  padding: 16px;
}

.contract-doc {
  width: 100px;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 2px;
  padding: 12px 10px;
  box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.1);
  animation: breakup-card-pulse 4s ease-in-out infinite;
  position: relative;
}

.contract-doc::after {
  content: "";
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border: 2px solid #DC2626;
  border-radius: 50%;
  opacity: 0.3;
}

.contract-line {
  height: 2px;
  background: linear-gradient(90deg, #1E40AF 0%, rgba(30, 64, 175, 0.3) 60%, transparent 100%);
  border-radius: 1px;
  margin-bottom: 6px;
}

.contract-signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #CBD5E1;
  animation: heartbeat-crack 3s ease-in-out infinite;
}

.signature { font-size: 16px; opacity: 0.8; }
.signature--left { color: #1E40AF; }
.signature--right { color: #DC2626; }

.hero-stats { display: flex; gap: 16px; justify-content: center; position: relative; z-index: 1; }

.hero-stat {
  text-align: center;
  padding: 10px 18px;
  background: #FFFFFF;
  border-radius: 4px;
  border: 1px solid #CBD5E1;
  box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.06);
}

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #1E40AF;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier Prime', monospace;
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748B;
  letter-spacing: 1.5px;
  margin-top: 2px;
}

@keyframes breakup-card-pulse {
  0%, 100% { box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.1); transform: scale(1); }
  50% { box-shadow: 2px 3px 16px rgba(0, 0, 0, 0.15); transform: scale(1.02); }
}

@keyframes heartbeat-crack {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) { .contract-doc, .contract-signatures { animation: none; } }
</style>
