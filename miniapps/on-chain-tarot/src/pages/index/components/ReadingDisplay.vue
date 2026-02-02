<template>
  <NeoCard variant="erobo-bitcoin" class="reading-card-container">
    <view class="fortune-container-glass">
      <text class="fortune-icon">🔮</text>
      <text class="reading-text-glass">{{ reading }}</text>
      <view class="mystical-divider-glass">
        <text>✦ ✦ ✦</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  reading: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.reading-card-container {
  margin-top: $space-6;
}

.fortune-container-glass {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 16px;
}

.fortune-icon {
  font-size: 64px;
  filter: drop-shadow(0 0 20px rgba(138, 43, 226, 0.5));
}

.reading-text-glass {
  font-family: $font-mono;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  display: block;
  line-height: 1.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.mystical-divider-glass {
  color: #00E599;
  font-weight: 700;
  letter-spacing: 12px;
  font-size: 20px;
  opacity: 0.8;
  filter: drop-shadow(0 0 5px rgba(0, 229, 153, 0.5));
}
</style>
