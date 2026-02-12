<template>
  <view class="tab-content">
    <view v-if="selectedMachine">
      <GachaMachine
        :machine="selectedMachine"
        :is-playing="isPlaying"
        :show-result="showResult"
        :result-item="resultItem"
        :error-message="playError"
        :is-owner="selectedMachine?.ownerHash === walletHash"
        @back="$emit('back')"
        @play="$emit('play')"
        @close-result="$emit('close-result')"
        @buy="$emit('buy')"
      />
    </view>

    <view v-else class="market-grid">
      <NeoCard variant="erobo-neo" class="hero-banner mb-4">
        <view class="hero-content">
          <text class="hero-title">{{ t("title") }}</text>
          <text class="hero-subtitle">{{ t("heroSubtitle") }}</text>
        </view>
        <text class="hero-icon">💊</text>
      </NeoCard>

      <view v-if="isLoading" class="loading-state">
        {{ t("loadingMachines") }}
      </view>
      <view v-else-if="marketMachines.length === 0" class="empty-state">
        {{ t("noMachines") }}
      </view>
      <view v-else>
        <NeoCard v-if="recommendedMachines.length" variant="erobo" class="section-card">
          <text class="section-title">{{ t("recommended") }}</text>
          <view class="grid-container">
            <GachaCard
              v-for="machine in recommendedMachines"
              :key="machine.id"
              :machine="machine"
              @select="$emit('select-machine', machine)"
            />
          </view>
          <NeoButton size="sm" variant="secondary" @click="$emit('browse-all')">
            {{ t("browseAll") }}
          </NeoButton>
        </NeoCard>

        <view class="ranking-grid">
          <NeoCard variant="erobo" class="section-card">
            <text class="section-title">{{ t("topPlays") }}</text>
            <view class="rank-list">
              <view v-for="machine in topByPlays" :key="machine.id" class="rank-row">
                <text class="rank-name">{{ machine.name }}</text>
                <text class="rank-value">{{ machine.plays }}</text>
              </view>
            </view>
          </NeoCard>
          <NeoCard variant="erobo" class="section-card">
            <text class="section-title">{{ t("topRevenue") }}</text>
            <view class="rank-list">
              <view v-for="machine in topByRevenue" :key="machine.id" class="rank-row">
                <text class="rank-name">{{ machine.name }}</text>
                <text class="rank-value">{{ formatGas(machine.revenueRaw + machine.salesVolumeRaw) }} GAS</text>
              </view>
            </view>
          </NeoCard>
        </view>

        <NeoCard v-if="forSaleMachines.length" variant="erobo" class="section-card">
          <text class="section-title">{{ t("forSale") }}</text>
          <view class="grid-container">
            <GachaCard
              v-for="machine in forSaleMachines"
              :key="machine.id"
              :machine="machine"
              @select="$emit('select-machine', machine)"
            />
          </view>
        </NeoCard>

        <NeoCard variant="erobo" class="section-card">
          <text class="section-title">{{ t("allMachines") }}</text>
          <view class="grid-container">
            <GachaCard
              v-for="machine in marketMachines"
              :key="machine.id"
              :machine="machine"
              @select="$emit('select-machine', machine)"
            />
          </view>
        </NeoCard>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { formatGas } from "@shared/utils/format";
import GachaCard from "../pages/index/components/GachaCard.vue";
import GachaMachine from "../pages/index/components/GachaMachine.vue";
import type { Machine, MachineItem } from "@/types";

const props = defineProps<{
  machines: Machine[];
  isLoading: boolean;
  selectedMachine: Machine | null;
  walletHash: string;
  isPlaying: boolean;
  showResult: boolean;
  resultItem: MachineItem | null;
  playError: string | null;
}>();

const emit = defineEmits<{
  (e: "select-machine", machine: Machine): void;
  (e: "browse-all"): void;
  (e: "back"): void;
  (e: "play"): void;
  (e: "close-result"): void;
  (e: "buy"): void;
}>();

const { t } = useI18n();

const marketMachines = computed(() =>
  props.machines.filter((machine) => machine.active && machine.listed && !machine.banned),
);

const recommendedMachines = computed(() =>
  [...marketMachines.value].sort((a, b) => b.plays - a.plays).slice(0, 4),
);

const topByPlays = computed(() =>
  [...marketMachines.value].sort((a, b) => b.plays - a.plays).slice(0, 5),
);

const topByRevenue = computed(() =>
  [...marketMachines.value]
    .sort((a, b) => b.revenueRaw + b.salesVolumeRaw - (a.revenueRaw + a.salesVolumeRaw))
    .slice(0, 5),
);

const forSaleMachines = computed(() =>
  props.machines.filter((machine) => machine.forSale && !machine.banned),
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.market-grid,
.grid-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--gacha-accent-pink);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  display: inline-block;
}

.hero-banner {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  margin-bottom: 24px;

  .hero-content {
    display: flex;
    flex-direction: column;
  }
  .hero-title {
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, var(--gacha-accent-pink) 0%, var(--gacha-accent-blue) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .hero-subtitle {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
    background: var(--gacha-hero-subtitle-bg);
    padding: 4px 8px;
    border-radius: 8px;
  }
}

.hero-icon {
  font-size: 40px;
  animation: bounce 2s infinite ease-in-out;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.ranking-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--gacha-divider);
  padding-bottom: 8px;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
}

.rank-name {
  font-weight: 700;
  color: var(--text-primary);
}
.rank-value {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace;
  font-weight: 700;
  background: var(--gacha-rank-pill-bg);
  color: var(--gacha-rank-pill-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
