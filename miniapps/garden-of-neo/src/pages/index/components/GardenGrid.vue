<template>
  <NeoCard variant="erobo-neo" class="garden-card-glass">
    <view class="garden-container-glass">
      <view class="garden-grid-glass">
        <view
          v-for="plot in plots"
          :key="plot.id"
          class="plot-glass"
          :class="[{ empty: !plot.plant }, plot.plant ? getGrowthStage(plot.plant.growth) : '']"
          role="button"
          tabindex="0"
          :aria-label="plot.plant ? `${plot.plant.name} — ${Math.floor(plot.plant.growth)}%` : emptyLabel"
          @click="$emit('select', plot)"
        >
          <view v-if="plot.plant" class="plant-box-glass">
            <text class="plant-icon-glass" :class="{ ready: plot.plant.growth >= 100 }">
              {{ plot.plant.icon }}
            </text>
            <view v-if="plot.plant.growth >= 100" class="ready-sticker-glass">{{ readyLabel }}</view>
          </view>
          <text v-else class="empty-icon-glass">🕳️</text>
          <view v-if="plot.plant" class="growth-label-glass">
            <text class="growth-text-glass">{{ Math.floor(plot.plant.growth) }}%</text>
          </view>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import type { Plot } from "../composables/useGarden";

defineProps<{
  plots: Plot[];
  readyLabel: string;
  emptyLabel: string;
}>();

defineEmits<{
  (e: "select", plot: Plot): void;
}>();

const getGrowthStage = (growth: number): string => {
  if (growth >= 100) return "stage-mature";
  if (growth >= 75) return "stage-blooming";
  if (growth >= 50) return "stage-growing";
  if (growth >= 25) return "stage-sprouting";
  return "stage-seedling";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.garden-card-glass {
  margin-bottom: $spacing-6;
}

.garden-grid-glass {
  @include grid-layout(3, $spacing-4);
  padding: $spacing-2;
}

.plot-glass {
  aspect-ratio: 1;
  background: var(--garden-plot-bg);
  border: 1px solid var(--garden-plot-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  box-shadow: var(--garden-plot-shadow);

  &.empty {
    border-style: dashed;
    border-color: var(--garden-plot-empty-border);
    background: var(--garden-plot-empty-bg);
    opacity: 0.7;

    &:hover {
      background: var(--garden-plot-empty-hover-bg);
      border-color: var(--text-secondary);
      opacity: 1;
    }
  }

  &:active {
    transform: scale(0.95);
  }

  &.stage-seedling {
    background: var(--garden-stage-seedling-bg);
    border-color: var(--garden-stage-seedling-border);
  }
  &.stage-sprouting {
    background: var(--garden-stage-sprouting-bg);
    border-color: var(--garden-stage-sprouting-border);
  }
  &.stage-growing {
    background: var(--garden-stage-growing-bg);
    border-color: var(--garden-stage-growing-border);
  }
  &.stage-blooming {
    background: var(--garden-stage-blooming-bg);
    border-color: var(--garden-stage-blooming-border);
  }
  &.stage-mature {
    background: var(--garden-stage-mature-bg);
    border-color: var(--garden-stage-mature-border);
    box-shadow: var(--garden-stage-mature-shadow);
  }
}

.plant-icon-glass {
  font-size: 48px;
  filter: drop-shadow(var(--garden-plant-shadow));
  &.ready {
    animation: glass-bounce 1.5s infinite ease-in-out;
  }
}

@keyframes glass-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.ready-sticker-glass {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, var(--garden-ready-start), var(--garden-ready-end));
  color: var(--garden-ready-text);
  font-size: 10px;
  font-weight: $font-weight-black;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: var(--garden-ready-shadow);
  z-index: 10;
}

.empty-icon-glass {
  font-size: 24px;
  opacity: 0.5;
}

.growth-label-glass {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--garden-growth-bg);
  padding: 4px;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  text-align: center;
}
.growth-text-glass {
  color: var(--text-primary);
  font-size: 10px;
  font-weight: $font-weight-bold;
  font-family: $font-mono;
}
</style>
